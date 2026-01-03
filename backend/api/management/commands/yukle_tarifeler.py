import os
import pandas as pd
from datetime import datetime
from django.core.management.base import BaseCommand
from api.models import Hat, HatTarife


class Command(BaseCommand):
    help = 'Sefer saatlerini yükler.'

    def handle(self, *args, **options):

        dosya_yolu = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti\tarifeler.csv"

        if not os.path.exists(dosya_yolu):

            self.stdout.write(self.style.WARNING("Tarife dosyası bulunamadı, RASTGELE örnek saatler oluşturuluyor..."))
            HatTarife.objects.all().delete()
            for hat in Hat.objects.all():

                for saat in range(6, 24):
                    HatTarife.objects.create(
                        hat=hat,
                        kalkis_saati=f"{saat:02d}:00",
                        yon="Merkez"
                    )
                    HatTarife.objects.create(
                        hat=hat,
                        kalkis_saati=f"{saat:02d}:30",
                        yon="Dönüş"
                    )
            self.stdout.write(self.style.SUCCESS("✅ Örnek tarifeler yüklendi."))
            return

        self.stdout.write("Tarifeler yükleniyor...")
        HatTarife.objects.all().delete()



        self.stdout.write(self.style.SUCCESS("İşlem tamam."))