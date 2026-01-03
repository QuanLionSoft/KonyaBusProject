import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Hat, Durak, HatDurak


class Command(BaseCommand):
    help = 'Eksik dosya durumunda sadece hatdurak.csv kullanarak sistemi kurar (Hatasız).'

    def handle(self, *args, **options):

        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        dosya_hatdurak = os.path.join(base_path, "hatdurak.csv")

        if not os.path.exists(dosya_hatdurak):
            self.stdout.write(self.style.ERROR("hatdurak.csv bulunamadı!"))
            return

        self.stdout.write("1. Veritabanı temizleniyor...")
        HatDurak.objects.all().delete()
        Durak.objects.all().delete()

        self.stdout.write("2. hatdurak.csv okunuyor...")

        df = pd.read_csv(dosya_hatdurak, sep=';', encoding='utf-8-sig', dtype=str)
        df.columns = df.columns.str.strip().str.lower()


        col_h_ana = 'ana_hat_no'
        col_h_alt = 'alt_hat_no'
        col_d_no = 'durak_no'
        col_sira = 'sira'
        col_yon = 'istikamet'

        hat_cache = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}


        self.stdout.write("3. Duraklar oluşturuluyor...")
        unique_duraks = df[col_d_no].unique()
        self.stdout.write(f"   -> {len(unique_duraks)} benzersiz durak bulundu.")


        durak_objs = [
            Durak(
                durak_no=d,
                durak_adi=f"Durak {d}",
                enlem=0,
                boylam=0
            )
            for d in unique_duraks
        ]


        Durak.objects.bulk_create(durak_objs, ignore_conflicts=True)


        durak_db_map = {d.durak_no: d for d in Durak.objects.all()}


        self.stdout.write("4. Hat-Durak bağlantıları kuruluyor...")

        rel_batch = []

        seen = set()
        count = 0

        for _, row in df.iterrows():
            try:
                h_key = f"{str(row[col_h_ana]).strip()}-{str(row[col_h_alt]).strip()}"
                hat = hat_cache.get(h_key)

                d_no = str(row[col_d_no]).strip()
                durak = durak_db_map.get(d_no)

                sira_val = int(row[col_sira])

                if hat and durak:

                    key = (hat.id, sira_val)

                    if key in seen:
                        continue
                    seen.add(key)

                    rel_batch.append(HatDurak(
                        hat=hat,
                        durak=durak,
                        sira=sira_val,
                        istikamet=row.get(col_yon, '')
                    ))
                    count += 1
            except:
                continue

            if len(rel_batch) >= 5000:
                HatDurak.objects.bulk_create(rel_batch, ignore_conflicts=True)
                rel_batch = []
                self.stdout.write(f"   -> {count} ilişki işlendi...", ending='\r')

        if rel_batch:
            HatDurak.objects.bulk_create(rel_batch, ignore_conflicts=True)

        self.stdout.write(self.style.SUCCESS(f"\n✅ İŞLEM TAMAM! Toplam {count} durak hatta bağlandı."))