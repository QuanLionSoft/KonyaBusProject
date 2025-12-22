import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Durak


class Command(BaseCommand):
    help = 'durak.csv dosyasından gerçek durak isimlerini okuyup veritabanını günceller.'

    def handle(self, *args, **options):
        # 1. DOSYA YOLUNU GARANTİYE ALALIM
        # yukle_duraklar.py dosyasındaki çalışan yolu kullanıyoruz:
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        csv_path = os.path.join(base_path, 'hatdurak.csv')

        self.stdout.write(self.style.WARNING(f"Aranan Dosya: {csv_path}"))

        # Dosya var mı kontrol et
        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR("HATA: Dosya hala bulunamadı!"))
            self.stdout.write(
                self.style.ERROR("Lütfen 'veri_seti' klasörünün içinde 'durak.csv' dosyasının olduğundan emin olun."))
            return

        self.stdout.write("Dosya bulundu, okuma başlıyor...")

        try:
            # 2. CSV'yi Oku (Ayırıcı ; veya , olabilir)
            try:
                # Önce noktalı virgül dene (Genelde Türkçe CSV'ler böyledir)
                df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig', on_bad_lines='skip', dtype=str)
                if len(df.columns) < 2:  # Eğer tek kolon okuduysa ayırıcı yanlıştır
                    raise ValueError
            except:
                # Virgül dene
                df = pd.read_csv(csv_path, sep=',', encoding='utf-8-sig', on_bad_lines='skip', dtype=str)

            # 3. Kolon İsimlerini Temizle
            df.columns = [c.strip().upper() for c in df.columns]

            # Gerekli kolonları bul (Esnek arama)
            no_col = next((c for c in df.columns if 'NO' in c), None)
            ad_col = next((c for c in df.columns if 'ADI' in c or 'ISIM' in c or 'AD' in c), None)

            if not no_col or not ad_col:
                self.stdout.write(self.style.ERROR(f"CSV sütunları tanınamadı. Bulunan sütunlar: {list(df.columns)}"))
                return

            # 4. Güncelleme Döngüsü
            updated_count = 0
            # Veritabanındaki tüm durakları çek (Kod -> Durak Nesnesi eşlemesi)
            # durak_no string olduğu için veritabanından da string olarak kıyaslayacağız
            db_duraklar = {str(d.durak_no).strip(): d for d in Durak.objects.all()}

            print(f"Veritabanında {len(db_duraklar)} durak var. CSV'de {len(df)} satır var.")

            for index, row in df.iterrows():
                csv_durak_no = str(row[no_col]).strip()
                yeni_isim = str(row[ad_col]).strip()

                if csv_durak_no in db_duraklar:
                    durak = db_duraklar[csv_durak_no]

                    # Sadece isim farklıysa güncelle (Performans için)
                    if durak.durak_adi != yeni_isim:
                        durak.durak_adi = yeni_isim
                        durak.save()
                        updated_count += 1

                        if updated_count % 100 == 0:
                            self.stdout.write(f"{updated_count} durak güncellendi...", ending='\r')

            self.stdout.write(
                self.style.SUCCESS(f"\nİŞLEM TAMAM! Toplam {updated_count} durağın ismi gerçek isme dönüştürüldü."))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Bir hata oluştu: {str(e)}"))