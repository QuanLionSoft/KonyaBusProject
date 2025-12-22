import os
from django.core.management.base import BaseCommand
from api.models import Hat

# ml_models dosyasından demand_predictor nesnesini çağırıyoruz
try:
    from api.ml_models import demand_predictor
except ImportError:
    demand_predictor = None


class Command(BaseCommand):
    help = 'Yapay Zeka Modellerini Eğitir'

    def add_arguments(self, parser):
        # --egit parametresini sisteme tanıtıyoruz
        parser.add_argument('--egit', action='store_true', help='Talep tahmin modellerini eğitir')

    def handle(self, *args, **options):
        # Eğer --egit parametresi varsa burası çalışır
        if options['egit']:
            if not demand_predictor:
                self.stdout.write(self.style.ERROR("HATA: ml_models.py yüklenemedi veya Prophet kütüphanesi eksik."))
                return

            self.stdout.write(self.style.WARNING("Yapay Zeka Eğitimi Başlıyor..."))

            # Veritabanındaki tüm hatları çek
            hatlar = Hat.objects.all().order_by('ana_hat_no')

            if not hatlar.exists():
                self.stdout.write(
                    self.style.ERROR("Veritabanında kayıtlı hat bulunamadı! Önce hat verilerini yükleyin."))
                return

            basarili = 0
            for hat in hatlar:
                hat_no = str(hat.ana_hat_no)
                self.stdout.write(f"Hat {hat_no} eğitiliyor...")

                # Eğitimi başlat
                sonuc = demand_predictor.train_model(hat_no)
                self.stdout.write(f"   -> {sonuc}")

                if "başarıyla" in str(sonuc) or "eğitildi" in str(sonuc):
                    basarili += 1

            self.stdout.write(self.style.SUCCESS(f"İŞLEM TAMAMLANDI! Toplam {basarili} model güncellendi."))

        else:
            self.stdout.write("Lütfen komutu şöyle kullanın: python manage.py analiz_araclar --egit")