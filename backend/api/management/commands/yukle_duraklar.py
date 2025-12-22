import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Hat, Durak, HatDurak


class Command(BaseCommand):
    help = 'Durakları ve Hat-Durak ilişkilerini CSV dosyalarından yükler.'

    def handle(self, *args, **options):
        # KLASÖR YOLUNU KONTROL ET
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        dosya_durak = os.path.join(base_path, "durak.csv")
        dosya_hatdurak = os.path.join(base_path, "hatdurak.csv")

        if not os.path.exists(dosya_durak) or not os.path.exists(dosya_hatdurak):
            self.stdout.write(self.style.ERROR(f"Dosyalar bulunamadı! Lütfen şu klasörü kontrol et: {base_path}"))
            return

        self.stdout.write(self.style.WARNING("--- DURAK YÜKLEME BAŞLIYOR ---"))

        # 1. TEMİZLİK (Önce ilişkileri, sonra durakları sil)
        self.stdout.write("1. Eski veriler temizleniyor...")
        HatDurak.objects.all().delete()
        Durak.objects.all().delete()

        # 2. DURAKLARI YÜKLE (durak.csv)
        self.stdout.write(f"2. Duraklar yükleniyor ({dosya_durak})...")
        df_durak = pd.read_csv(dosya_durak, sep=';', encoding='utf-8-sig', dtype=str)
        df_durak.columns = df_durak.columns.str.strip().str.lower()

        # Sütun isimlerini bul
        col_no = 'durak_no' if 'durak_no' in df_durak.columns else 'istasyon_no'
        col_adi = 'durak_adi' if 'durak_adi' in df_durak.columns else 'adi'
        col_lat = 'enlem' if 'enlem' in df_durak.columns else 'y'
        col_lng = 'boylam' if 'boylam' in df_durak.columns else 'x'

        durak_batch = []
        durak_map = {}  # ID eşleştirme için

        for _, row in df_durak.iterrows():
            try:
                d_no = str(row[col_no]).strip()
                d_adi = str(row[col_adi]).strip()

                # Koordinat düzeltme
                def fix(val):
                    val = str(val).replace(',', '.')
                    if val == 'nan' or not val: return 0.0
                    f = float(val)
                    while f > 100: f /= 10
                    return f

                lat = fix(row[col_lat])
                lng = fix(row[col_lng])

                # Koordinat Ters mi?
                if (31 < lat < 35) and (36 < lng < 39): lat, lng = lng, lat

                obj = Durak(durak_no=d_no, durak_adi=d_adi, enlem=lat, boylam=lng)
                durak_batch.append(obj)

            except:
                continue

        if durak_batch:
            Durak.objects.bulk_create(durak_batch)
            self.stdout.write(f"   -> {len(durak_batch)} adet durak oluşturuldu.")

        # Veritabanından ID'leri çek (HatDurak için lazım)
        durak_db_map = {d.durak_no: d for d in Durak.objects.all()}

        # 3. HAT-DURAK İLİŞKİSİNİ YÜKLE (hatdurak.csv)
        self.stdout.write(f"3. Hat-Durak bağlantıları kuruluyor ({dosya_hatdurak})...")
        df_rel = pd.read_csv(dosya_hatdurak, sep=';', encoding='utf-8-sig', dtype=str)
        df_rel.columns = df_rel.columns.str.strip().str.lower()

        col_h_ana = 'ana_hat_no'
        col_h_alt = 'alt_hat_no'
        col_d_no = 'durak_no'
        col_sira = 'sira_no' if 'sira_no' in df_rel.columns else 'sira'

        hat_cache = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}
        rel_batch = []
        count = 0

        for _, row in df_rel.iterrows():
            try:
                # Hattı Bul
                h_key = f"{str(row[col_h_ana]).strip()}-{str(row[col_h_alt]).strip()}"
                hat = hat_cache.get(h_key)

                # Durağı Bul
                d_no = str(row[col_d_no]).strip()
                durak = durak_db_map.get(d_no)

                if hat and durak:
                    rel_batch.append(HatDurak(
                        hat=hat,
                        durak=durak,
                        sira=int(row[col_sira]),
                        istikamet=row.get('istikamet', '')  # Varsa al
                    ))
                    count += 1

                if len(rel_batch) >= 5000:
                    HatDurak.objects.bulk_create(rel_batch)
                    rel_batch = []
                    self.stdout.write(f"   -> {count} ilişki kuruldu...", ending='\r')

            except:
                continue

        if rel_batch:
            HatDurak.objects.bulk_create(rel_batch)

        self.stdout.write(self.style.SUCCESS(f"\n✅ İŞLEM TAMAM! Toplam {count} durak hatta bağlandı."))