import random
from django.core.management.base import BaseCommand
from api.models import Durak


class Command(BaseCommand):
    help = 'Eksik durak koordinatlarını Konya merkezi etrafında rastgele doldurur (Demo için)'

    def handle(self, *args, **options):
        # Konya Merkez Koordinatları
        MERKEZ_ENLEM = 37.8716
        MERKEZ_BOYLAM = 32.4851

        # Koordinatı olmayan durakları bul
        eksik_duraklar = Durak.objects.filter(enlem__isnull=True)
        toplam = eksik_duraklar.count()

        self.stdout.write(f"Toplam {toplam} durağın koordinatı eksik. Dolduruluyor...")

        batch = []
        for durak in eksik_duraklar:
            # Merkezin etrafında +/- 0.1 derece (yaklaşık 10km) dağıt
            # Böylece haritada hepsi üst üste binmez, bir ağ gibi görünür.
            offset_lat = random.uniform(-0.10, 0.10)
            offset_lon = random.uniform(-0.10, 0.10)

            durak.enlem = MERKEZ_ENLEM + offset_lat
            durak.boylam = MERKEZ_BOYLAM + offset_lon

            # Tek tek save yapmak yavaştır ama batch update için bu yöntem güvenlidir
            durak.save()

            # İlerleme çubuğu gibi çıktı verelim
            if batch and len(batch) % 100 == 0:
                self.stdout.write(".", ending="")

        self.stdout.write(self.style.SUCCESS(f'\nBAŞARILI! {toplam} durağa koordinat atandı.'))