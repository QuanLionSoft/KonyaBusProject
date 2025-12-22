import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Hat


class Command(BaseCommand):
    help = 'hatbilgisi.csv dosyasından hat isimlerini okur ve veritabanındaki Hat kayıtlarını günceller.'

    def handle(self, *args, **options):
        # 1. DOSYA YOLUNU BELİRLE
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        dosya_yolu = os.path.join(base_path, "hatbilgisi.csv")

        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.ERROR(f"Dosya bulunamadı: {dosya_yolu}"))
            return

        self.stdout.write(self.style.WARNING(f"Hat bilgileri okunuyor: {dosya_yolu}"))

        try:
            # 2. CSV OKUMA (Encoding ve Ayırıcı Denemeleri)
            try:
                # Genelde noktalı virgül ve Türkçe karakter içerir
                df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str, on_bad_lines='skip')
            except:
                try:
                    df = pd.read_csv(dosya_yolu, sep=';', encoding='cp1254', dtype=str, on_bad_lines='skip')
                except:
                    # Virgül ile ayrılmış olabilir
                    df = pd.read_csv(dosya_yolu, sep=',', encoding='utf-8', dtype=str, on_bad_lines='skip')

            # Sütun isimlerini temizle (Boşlukları sil, büyüt)
            df.columns = [c.strip().upper() for c in df.columns]

            # Gerekli Sütunları Tespit Et
            # Genellikle: HAT_NO, HAT_ADI veya TARIFE_HAT_ADI
            col_no = next((c for c in df.columns if 'NO' in c and 'HAT' in c), None)  # HAT_NO
            col_ad = next((c for c in df.columns if 'AD' in c and 'HAT' in c), None)  # HAT_ADI

            if not col_no or not col_ad:
                self.stdout.write(self.style.ERROR(f"Sütunlar bulunamadı! Mevcut sütunlar: {list(df.columns)}"))
                return

            self.stdout.write(f"Sütunlar bulundu -> No: {col_no}, Ad: {col_ad}")

            # 3. GÜNCELLEME İŞLEMİ
            guncellenen_sayisi = 0

            # Veritabanındaki tüm hatları çek
            # Not: Bir ana hattın (Örn: 56) birden fazla alt hattı (56-0, 56-1) olabilir.
            # hatbilgisi.csv genelde ana hat bazındadır, bu yüzden o ana hatta bağlı tüm alt hatları aynı isimle güncelleyeceğiz.

            db_hatlar = Hat.objects.all()

            # Pandas DataFrame üzerinde döngü
            for _, row in df.iterrows():
                try:
                    csv_hat_no = str(row[col_no]).strip()
                    csv_hat_adi = str(row[col_ad]).strip()

                    # Bu numaraya sahip veritabanındaki TÜM alt hatları bul (Örn: 56-0, 56-1)
                    # Hat modelinizde 'ana_hat_no' alanı integer veya string olabilir, stringe çevirip kıyaslıyoruz.

                    # Filtreleme: Ana hat numarası eşleşenleri getir
                    eslesen_hatlar = [h for h in db_hatlar if str(h.ana_hat_no).strip() == csv_hat_no]

                    for hat in eslesen_hatlar:
                        # Eğer isim boşsa veya farklıysa güncelle
                        if not hat.ana_hat_adi or hat.ana_hat_adi != csv_hat_adi:
                            hat.ana_hat_adi = csv_hat_adi
                            hat.save()
                            guncellenen_sayisi += 1
                except Exception as e:
                    continue

            self.stdout.write(
                self.style.SUCCESS(f"\n✅ İŞLEM TAMAM! Toplam {guncellenen_sayisi} hattın ismi güncellendi."))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Kritik Hata: {str(e)}"))