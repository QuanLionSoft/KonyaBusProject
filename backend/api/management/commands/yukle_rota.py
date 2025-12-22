import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Hat, HatGuzergah


class Command(BaseCommand):
    help = 'Güzergah verilerini sıra numarası olmasa bile otomatik üreterek yükler.'

    def handle(self, *args, **options):
        dosya_yolu = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti\guzergah.csv"

        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.ERROR('Dosya bulunamadı!'))
            return

        self.stdout.write("1. Veritabanı temizleniyor...")
        HatGuzergah.objects.all().delete()

        self.stdout.write("2. CSV okunuyor...")
        df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)
        df.columns = df.columns.str.strip().str.lower()

        # Sütun isimlerini belirle
        col_ana = 'ana_hat_no' if 'ana_hat_no' in df.columns else 'hat_no'
        col_alt = 'alt_hat_no'

        # 'sira' sütunu var mı? Yoksa biz üreteceğiz, hata vermesin.
        col_sira = None
        if 'sira_no' in df.columns:
            col_sira = 'sira_no'
        elif 'sira' in df.columns:
            col_sira = 'sira'

        # Koordinat sütunları
        col_enlem = 'enlem' if 'enlem' in df.columns else 'y'
        col_boylam = 'boylam' if 'boylam' in df.columns else 'x'

        # Hatları hafızaya al
        hatlar_cache = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}

        # Her hat için ayrı sayaç tutacağız (Otomatik sıra no üretmek için)
        hat_sira_sayac = {}

        batch = []
        count = 0
        atlanan = 0

        self.stdout.write("3. Veriler işleniyor...")

        for _, row in df.iterrows():
            try:
                # Hat Kontrolü
                ana = str(row[col_ana]).strip()
                alt = str(row[col_alt]).strip()
                key = f"{ana}-{alt}"

                hat = hatlar_cache.get(key)
                if not hat:
                    atlanan += 1
                    continue

                # --- SIRA NUMARASI BELİRLEME ---
                if col_sira and pd.notna(row[col_sira]):
                    # Dosyada varsa onu kullan
                    sira = int(row[col_sira])
                else:
                    # Yoksa biz üretelim: Bu hat için sayaç kaçtaysa onu ver
                    current_count = hat_sira_sayac.get(key, 0)
                    sira = current_count
                    hat_sira_sayac[key] = current_count + 1

                # --- KOORDİNAT ONARMA ---
                def duzelt(val):
                    val = str(val).replace(',', '.')
                    # "37.123.456" hatası varsa düzelt
                    if val.count('.') > 1:
                        parts = val.split('.')
                        val = parts[0] + '.' + ''.join(parts[1:])

                    f_val = float(val)

                    # Sayı çok büyükse (nokta yoksa) küçült
                    while f_val > 100:
                        f_val /= 10
                    return f_val

                enlem = duzelt(row[col_enlem])
                boylam = duzelt(row[col_boylam])

                # Koordinat TERS Mİ? (Konya Enlem: 37-38, Boylam: 32-33)
                final_enlem = enlem
                final_boylam = boylam

                # Eğer enlem 32 civarı ve boylam 37 civarıysa ters çevir
                if (31 < enlem < 35) and (36 < boylam < 39):
                    final_enlem = boylam
                    final_boylam = enlem

                # Güvenlik Sınırı (Konya dışıysa alma)
                if not (36 < final_enlem < 39) or not (31 < final_boylam < 35):
                    continue

                batch.append(HatGuzergah(
                    hat=hat,
                    sira=sira,
                    enlem=final_enlem,
                    boylam=final_boylam
                ))
                count += 1

                if len(batch) >= 5000:
                    HatGuzergah.objects.bulk_create(batch)
                    batch = []
                    self.stdout.write(f"{count} nokta işlendi...", ending='\r')

            except Exception:
                continue

        if batch:
            HatGuzergah.objects.bulk_create(batch)

        self.stdout.write(self.style.SUCCESS(f"\nİŞLEM TAMAM! Toplam {count} nokta yüklendi."))