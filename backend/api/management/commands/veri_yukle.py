import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.utils.timezone import make_aware
from datetime import datetime
from api.models import Hat, Durak, HatDurak, DurakVaris


class Command(BaseCommand):
    help = 'Konya Otobüs Verilerini Hata Ayıklayarak Yükler'

    def handle(self, *args, **options):
        # Dosya yolu
        base_dir = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        self.stdout.write(f"📂 Veri Kaynağı: {base_dir}")

        try:
            # 1. Hatları Yükle
            self.yukle_hatlar(os.path.join(base_dir, 'hatbilgisi.csv'))

            # 2. Durakları ve İlişkileri Yükle
            self.yukle_hat_durak(os.path.join(base_dir, 'hatdurak.csv'))

            # 3. Durak Varış Verilerini Yükle (Kritik Kısım)
            self.yukle_durak_varis(os.path.join(base_dir, 'otobusdurakvaris01.csv'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ KRİTİK HATA: {str(e)}'))

    def yukle_hatlar(self, dosya_yolu):
        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.WARNING(f'⚠️ Dosya yok: {dosya_yolu}'))
            return

        self.stdout.write("⏳ Hatlar yükleniyor...")
        # 'utf-8-sig' BOM karakterini (ï»¿) temizler
        df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)
        # Sütun isimlerindeki boşlukları temizle
        df.columns = df.columns.str.strip()

        count = 0
        for _, row in df.iterrows():
            try:
                Hat.objects.update_or_create(
                    ana_hat_no=int(row['ana_hat_no']),
                    alt_hat_no=int(row['alt_hat_no']),
                    defaults={
                        'ana_hat_adi': row.get('ana_hat_adi', ''),
                        'alt_hat_adi': row.get('alt_hat_adi', ''),
                        'durak_sayisi': int(row.get('durak_sayisi', 0) or 0)
                    }
                )
                count += 1
            except Exception as e:
                pass
        self.stdout.write(self.style.SUCCESS(f'✅ {count} hat yüklendi.'))

    def yukle_hat_durak(self, dosya_yolu):
        if not os.path.exists(dosya_yolu): return
        self.stdout.write("⏳ Duraklar yükleniyor...")
        df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)
        df.columns = df.columns.str.strip()

        count = 0
        # Hız için toplu oluşturma yapalım
        duraklar_to_create = []
        mevcut_duraklar = set(Durak.objects.values_list('durak_no', flat=True))

        for _, row in df.iterrows():
            d_no = row['durak_no'].strip()
            if d_no and d_no not in mevcut_duraklar:
                duraklar_to_create.append(Durak(durak_no=d_no, durak_adi=f"Durak {d_no}"))
                mevcut_duraklar.add(d_no)

        if duraklar_to_create:
            Durak.objects.bulk_create(duraklar_to_create, ignore_conflicts=True)
            self.stdout.write(f"   -> {len(duraklar_to_create)} yeni durak oluşturuldu.")

        # Şimdi ilişkileri kuralım
        for _, row in df.iterrows():
            try:
                hat = Hat.objects.filter(ana_hat_no=int(row['ana_hat_no']), alt_hat_no=int(row['alt_hat_no'])).first()
                durak = Durak.objects.get(durak_no=row['durak_no'].strip())
                if hat and durak:
                    HatDurak.objects.update_or_create(
                        hat=hat, durak=durak, sira=int(row['sira']),
                        defaults={'istikamet': row.get('istikamet', '')}
                    )
                    count += 1
            except:
                pass
        self.stdout.write(self.style.SUCCESS(f'✅ {count} durak-hat ilişkisi kuruldu.'))

    def yukle_durak_varis(self, dosya_yolu):
        if not os.path.exists(dosya_yolu): return
        self.stdout.write("⏳ Durak Varış verileri işleniyor (Bu işlem uzun sürebilir)...")

        # Pandas ile oku, sütun hatalarını gider
        try:
            df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)
            df.columns = df.columns.str.strip()  # Sütun adlarındaki boşlukları sil
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"CSV Okuma Hatası: {e}"))
            return

        batch = []
        count = 0
        hatalar = 0

        # Hafızaya al (Cache)
        hat_cache = {(h.ana_hat_no, h.alt_hat_no): h.id for h in Hat.objects.all()}
        durak_cache = {d.durak_no: d.id for d in Durak.objects.all()}

        self.stdout.write(f"   -> Toplam satır sayısı: {len(df)}")

        for index, row in df.iterrows():
            try:
                # 1. Hat Bul
                ana = int(row['ana_hat_no'])
                alt = int(row['alt_hat_no'])
                hat_id = hat_cache.get((ana, alt))

                if not hat_id:
                    # Hat bulunamadıysa (Veri tutarsızlığı), atla
                    continue

                    # 2. Durakları Bul
                baslangic_no = str(row['baslangic_durak_no']).strip()
                bitis_no = str(row['bitis_durak_no']).strip()

                # Durak veritabanında yoksa oluştur (Burası hatayı önler)
                if baslangic_no and baslangic_no not in durak_cache:
                    d = Durak.objects.create(durak_no=baslangic_no, durak_adi=f"Durak {baslangic_no}")
                    durak_cache[baslangic_no] = d.id

                if bitis_no and bitis_no not in durak_cache:
                    d = Durak.objects.create(durak_no=bitis_no, durak_adi=f"Durak {bitis_no}")
                    durak_cache[bitis_no] = d.id

                if not baslangic_no or not bitis_no:
                    continue

                # 3. Tarih Dönüşümü
                cikis = make_aware(datetime.strptime(row['cikis_zaman'], "%Y-%m-%d %H:%M:%S"))
                varis = make_aware(datetime.strptime(row['varis_zaman'], "%Y-%m-%d %H:%M:%S"))

                # Süre Hesapla
                sure = int((varis - cikis).total_seconds())

                # Listeye ekle
                batch.append(DurakVaris(
                    hat_id=hat_id,
                    baslangic_durak_id=durak_cache[baslangic_no],
                    bitis_durak_id=durak_cache[bitis_no],
                    cikis_zaman=cikis,
                    varis_zaman=varis,
                    gecen_sure_saniye=sure,
                    arac_no=str(row['arac_no'])
                ))
                count += 1

                # 5000'de bir kaydet
                if len(batch) >= 5000:
                    DurakVaris.objects.bulk_create(batch)
                    batch = []
                    self.stdout.write(f"   -> {count} kayıt işlendi...", ending='\r')

            except Exception as e:
                hatalar += 1
                if hatalar < 5:  # Sadece ilk 5 hatayı göster, ekranı doldurma
                    self.stdout.write(self.style.WARNING(f"Satır {index} hatası: {e}"))
                continue

        # Kalanları kaydet
        if batch:
            DurakVaris.objects.bulk_create(batch)

        self.stdout.write(self.style.SUCCESS(f'\n✅ İŞLEM TAMAMLANDI! Toplam {count} Durak Varış verisi yüklendi.'))
        if hatalar > 0:
            self.stdout.write(self.style.WARNING(f"⚠️ Toplam {hatalar} satır hatalı olduğu için atlandı."))