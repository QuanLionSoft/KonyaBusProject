import os
import json
import pandas as pd
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'CSV dosyasından gerçek araç numaralarını analiz eder ve JSON olarak kaydeder.'

    def handle(self, *args, **options):
        # Dosya yolları
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        csv_path = os.path.join(base_path, "otobusdurakvaris01.csv")
        json_path = os.path.join(base_path, "hat_arac_listesi.json")

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f"Dosya bulunamadı: {csv_path}"))
            return

        self.stdout.write("1. CSV dosyası okunuyor (Bu biraz sürebilir)...")

        try:
            # Sadece gerekli sütunları okuyoruz (Hız için)
            df = pd.read_csv(csv_path, sep=';', usecols=['arac_no', 'ana_hat_no'], dtype=str)

            # Boş verileri temizle
            df = df.dropna()

            self.stdout.write("2. Hat başına araçlar gruplanıyor...")

            # Hat ID'sine göre araçları grupla
            # Sonuç: {'10': ['96', '696', '44', ...], '124': ['478'], ...}
            hat_arac_map = df.groupby('ana_hat_no')['arac_no'].unique().apply(list).to_dict()

            # İstatistik
            toplam_hat = len(hat_arac_map)
            toplam_arac = df['arac_no'].nunique()

            self.stdout.write(f"   -> {toplam_hat} farklı hat ve {toplam_arac} farklı araç tespit edildi.")

            # JSON olarak kaydet
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(hat_arac_map, f, ensure_ascii=False)

            self.stdout.write(self.style.SUCCESS(f"✅ Başarılı! Veriler şuraya kaydedildi: {json_path}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Hata oluştu: {str(e)}"))