from django.core.management.base import BaseCommand
from api.models import Hat, HatDurak, HatGuzergah, Durak


class Command(BaseCommand):
    help = 'Durakların koordinatlarını, yüklenen gerçek güzergah rotasının üzerine oturtur.'

    def handle(self, *args, **options):
        hatlar = Hat.objects.all()

        self.stdout.write(f"Toplam {hatlar.count()} hat için durak konumları düzeltiliyor...")

        duzeltilen_durak_sayisi = 0

        for hat in hatlar:
            # 1. Bu hattın gerçek yol noktalarını çek (Sıralı)
            rota_noktalari = list(hat.guzergah_noktalari.all().order_by('sira'))
            rota_uzunlugu = len(rota_noktalari)

            if rota_uzunlugu == 0:
                continue  # Rotası olmayan hattı geç

            # 2. Bu hattın duraklarını çek (Sıralı)
            duraklar = list(HatDurak.objects.filter(hat=hat).order_by('sira'))
            durak_sayisi = len(duraklar)

            if durak_sayisi == 0:
                continue

            # 3. MATEMATİKSEL DAĞITIM
            # Örnek: 1000 noktalı bir yolda 10 durak varsa, durakları her 100. noktaya koy.
            # Böylece duraklar çizginin üzerine tam oturur.

            adim = rota_uzunlugu / durak_sayisi

            for i, hat_durak in enumerate(duraklar):
                # Hangi rota noktasına denk geliyor?
                hedef_index = int(i * adim)

                # İndeks taşmasını önle
                if hedef_index >= rota_uzunlugu:
                    hedef_index = rota_uzunlugu - 1

                secilen_nokta = rota_noktalari[hedef_index]

                # Durağın asıl kaydını güncelle
                asil_durak = hat_durak.durak
                asil_durak.enlem = secilen_nokta.enlem
                asil_durak.boylam = secilen_nokta.boylam
                asil_durak.save()

                duzeltilen_durak_sayisi += 1

            self.stdout.write(f"Hat {hat.ana_hat_no}: {durak_sayisi} durak rotaya oturtuldu.", ending='\r')

        self.stdout.write(self.style.SUCCESS(
            f"\n\nİŞLEM TAMAM! Toplam {duzeltilen_durak_sayisi} durağın konumu rotaya göre güncellendi."))