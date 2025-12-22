import os
import pandas as pd
from django.core.management.base import BaseCommand
from api.models import Hat, HatGuzergah, HatDurak


class Command(BaseCommand):
    help = 'Veritabanını temizler, rotayı yükler ve durakları rotaya oturtur (FULL TAMİR).'

    def handle(self, *args, **options):
        # DOSYA YOLUNU KENDİNE GÖRE KONTROL ET!
        dosya_yolu = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti\guzergah.csv"

        self.stdout.write(self.style.WARNING("--- MASTER TAMİR BAŞLIYOR ---"))

        # 1. TEMİZLİK
        self.stdout.write("1. Eski ve bozuk veriler temizleniyor...")
        HatGuzergah.objects.all().delete()

        # 2. ROTA YÜKLEME
        self.stdout.write("2. Rota verisi yükleniyor...")
        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.ERROR(f"DOSYA BULUNAMADI: {dosya_yolu}"))
            return

        df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)
        df.columns = df.columns.str.strip().str.lower()

        # Sütun isimleri
        col_ana = 'ana_hat_no' if 'ana_hat_no' in df.columns else 'hat_no'
        col_alt = 'alt_hat_no'
        col_enlem = 'enlem' if 'enlem' in df.columns else 'y'
        col_boylam = 'boylam' if 'boylam' in df.columns else 'x'

        hatlar_cache = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}
        hat_sira_sayac = {}
        batch = []
        count = 0

        for _, row in df.iterrows():
            try:
                key = f"{str(row[col_ana]).strip()}-{str(row[col_alt]).strip()}"
                hat = hatlar_cache.get(key)
                if not hat: continue

                # Sıra No Üret
                sira = hat_sira_sayac.get(key, 0)
                hat_sira_sayac[key] = sira + 1

                # Koordinat Düzelt (37123456 -> 37.123456)
                def fix_coord(val):
                    val = str(val).replace(',', '.')
                    if val.count('.') > 1: val = val.rsplit('.', 1)[0] + val.rsplit('.', 1)[1]
                    f = float(val)
                    while f > 100: f /= 10
                    return f

                enlem = fix_coord(row[col_enlem])
                boylam = fix_coord(row[col_boylam])

                # Ters mi yazılmış?
                if (31 < enlem < 35) and (36 < boylam < 39):
                    enlem, boylam = boylam, enlem

                if 36 < enlem < 39 and 31 < boylam < 35:
                    batch.append(HatGuzergah(hat=hat, sira=sira, enlem=enlem, boylam=boylam))
                    count += 1

                if len(batch) >= 5000:
                    HatGuzergah.objects.bulk_create(batch)
                    batch = []
                    self.stdout.write(f"   -> {count} nokta işlendi...", ending='\r')

            except:
                continue

        if batch: HatGuzergah.objects.bulk_create(batch)
        self.stdout.write(self.style.SUCCESS(f"\n   -> Toplam {count} rota noktası yüklendi."))

        # 3. DURAKLARI ROTAYA OTURTMA
        self.stdout.write("3. Duraklar rotanın üzerine çivileniyor...")
        duzeltilen = 0
        for hat in Hat.objects.all():
            rota = list(hat.guzergah_noktalari.all().order_by('sira'))
            duraklar = list(HatDurak.objects.filter(hat=hat).order_by('sira'))

            if not rota or not duraklar: continue

            adim = len(rota) / len(duraklar)
            for i, h_durak in enumerate(duraklar):
                hedef_idx = int(i * adim)
                if hedef_idx >= len(rota): hedef_idx = len(rota) - 1

                nokta = rota[hedef_idx]
                # Durak koordinatını güncelle
                d = h_durak.durak
                d.enlem = nokta.enlem
                d.boylam = nokta.boylam
                d.save()
                duzeltilen += 1

        self.stdout.write(self.style.SUCCESS(f"✅ İŞLEM BİTTİ! {duzeltilen} durak haritaya yerleştirildi."))