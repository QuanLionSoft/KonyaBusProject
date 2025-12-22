import os
import pandas as pd
from datetime import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import Hat, TalepVerisi
from django.utils.timezone import make_aware


class Command(BaseCommand):
    help = 'Yolcu talep verilerini (elkartbinis2021.csv) yükler'

    def handle(self, *args, **options):
        # Dosya yolunu kendi bilgisayarına göre ayarla
        # Örnek: C:\Users\Quantum\Desktop\konyatalepdata...
        # Buraya elkartbinis2021.csv dosyasının TAM YOLUNU yazmalısın:
        dosya_yolu = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti\elkartbinis2021.csv"

        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.ERROR(f'Dosya bulunamadı: {dosya_yolu}'))
            return

        self.stdout.write("Talep verileri okunuyor (Bu işlem biraz sürebilir)...")

        # CSV'yi oku (Noktalı virgül ayracıyla)
        try:
            df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'CSV okuma hatası: {e}'))
            return

        # Sütun isimlerini temizle (boşlukları sil, büyüt)
        df.columns = [c.strip().upper() for c in df.columns]
        # Bazen "BİNİŞ SAYISI" alt satıra kayabilir, düzeltelim:
        # Kodun bu kısmı dosya yapısına göre esneklik sağlar.

        talep_listesi = []
        hatlar_cache = {}  # Hatları hafızada tutarak hız kazanalım

        sayac = 0
        total = len(df)

        self.stdout.write(f"Toplam {total} satır işlenecek...")

        for index, row in df.iterrows():
            try:
                hat_no = int(row['HAT_NO'])
                alt_hat_no = int(row['ALT_HAT_NO'])
                tarih_str = str(row['TARIH']).split(' ')[0]  # Sadece tarihi al
                saat = int(row['SAAT'])
                yolcu_sayisi = int(row['BİNİŞ SAYISI'])

                # Tarih ve saati birleştir
                # Örnek: 2021-01-01 06:00:00
                tarih_saat_str = f"{tarih_str} {saat:02d}:00:00"
                tarih_saat = datetime.strptime(tarih_saat_str, "%Y-%m-%d %H:%M:%S")
                tarih_saat = make_aware(tarih_saat)  # Django için timezone ekle

                # Hattı bul (Cache'den veya DB'den)
                hat_key = (hat_no, alt_hat_no)
                if hat_key in hatlar_cache:
                    hat_obj = hatlar_cache[hat_key]
                else:
                    hat_obj = Hat.objects.filter(ana_hat_no=hat_no, alt_hat_no=alt_hat_no).first()
                    if hat_obj:
                        hatlar_cache[hat_key] = hat_obj

                if hat_obj:
                    talep_listesi.append(TalepVerisi(
                        hat=hat_obj,
                        tarih_saat=tarih_saat,
                        yolcu_sayisi=yolcu_sayisi
                    ))
                    sayac += 1

                # Her 5000 kayıtta bir veritabanına yaz (Performans için)
                if len(talep_listesi) >= 5000:
                    TalepVerisi.objects.bulk_create(talep_listesi)
                    talep_listesi = []
                    self.stdout.write(f"{sayac}/{total} yüklendi...")

            except Exception as e:
                # Hatalı satırları atla
                continue

        # Kalanları yaz
        if talep_listesi:
            TalepVerisi.objects.bulk_create(talep_listesi)

        self.stdout.write(self.style.SUCCESS(f'İşlem tamamlandı! Toplam {sayac} veri yüklendi.'))