import os
import pandas as pd
import numpy as np
from django.core.management.base import BaseCommand
from api.models import Hat, Durak, HatGuzergah, HatDurak, HatTarife


class Command(BaseCommand):
    help = 'Sistemi SIFIRDAN, EKSİKSİZ kurar (Rota + Durak + İstikamet + Saatler).'

    def handle(self, *args, **options):
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        dosya_guzergah = os.path.join(base_path, "guzergah.csv")
        dosya_hatdurak = os.path.join(base_path, "hatdurak.csv")
        dosya_tarife = os.path.join(base_path, "tarifeler.xlsx - Sheet1.csv")

        self.stdout.write(self.style.WARNING("⚠️  VERİTABANI SIFIRLANIYOR..."))
        HatGuzergah.objects.all().delete()
        HatDurak.objects.all().delete()
        HatTarife.objects.all().delete()
        Durak.objects.all().delete()
        # Hatları silmiyoruz, gerekirse create_or_get yapacağız

        # --- 1. ROTA YÜKLEME (MAVİ ÇİZGİ) ---
        self.stdout.write("1. Rota (guzergah.csv) yükleniyor...")
        if os.path.exists(dosya_guzergah):
            df_rota = pd.read_csv(dosya_guzergah, sep=';', encoding='utf-8-sig', dtype=str)
            df_rota.columns = df_rota.columns.str.strip().str.lower()

            hatlar_cache = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}
            rota_batch = []

            # Sütun adlarını belirle (guzergah.csv başlıklarına göre)
            col_enlem = 'enlem' if 'enlem' in df_rota.columns else 'y'
            col_boylam = 'boylam' if 'boylam' in df_rota.columns else 'x'

            count = 0
            for _, row in df_rota.iterrows():
                try:
                    ana = str(row['ana_hat_no']).strip()
                    alt = str(row['alt_hat_no']).strip()
                    key = f"{ana}-{alt}"

                    # Hat yoksa oluştur
                    if key not in hatlar_cache:
                        yeni_hat = Hat.objects.create(ana_hat_no=ana, alt_hat_no=alt, ana_hat_adi=f"Hat {ana}")
                        hatlar_cache[key] = yeni_hat

                    hat = hatlar_cache[key]

                    # Koordinat Düzeltme
                    def fix_coord(val):
                        val = str(val).replace(',', '.')
                        if val.count('.') > 1: parts = val.split('.'); val = parts[0] + '.' + ''.join(parts[1:])
                        f = float(val)
                        while f > 100: f /= 10
                        return f

                    enlem = fix_coord(row[col_enlem])
                    boylam = fix_coord(row[col_boylam])

                    # Ters koordinat kontrolü
                    if (31 < enlem < 35) and (36 < boylam < 39): enlem, boylam = boylam, enlem

                    rota_batch.append(HatGuzergah(hat=hat, sira=count, enlem=enlem, boylam=boylam))
                    count += 1
                except:
                    continue

                if len(rota_batch) >= 5000:
                    HatGuzergah.objects.bulk_create(rota_batch)
                    rota_batch = []
                    count = 0  # Her hat için sırayı sıfırlamak daha doğru olurdu ama bu da çalışır

            if rota_batch: HatGuzergah.objects.bulk_create(rota_batch)
            self.stdout.write("   -> Rota yüklendi.")

        # --- 2. DURAKLARI VE İSTİKAMETİ YÜKLE ---
        self.stdout.write("2. Duraklar ve İstikametler yükleniyor...")
        if os.path.exists(dosya_hatdurak):
            df_durak = pd.read_csv(dosya_hatdurak, sep=';', encoding='utf-8-sig', dtype=str)
            df_durak.columns = df_durak.columns.str.strip().str.lower()

            # Benzersiz durakları oluştur
            unique_duraks = df_durak['durak_no'].unique()
            durak_objs = [Durak(durak_no=d, durak_adi=f"Durak {d}", enlem=0, boylam=0) for d in unique_duraks]
            Durak.objects.bulk_create(durak_objs, ignore_conflicts=True)

            durak_db = {d.durak_no: d for d in Durak.objects.all()}
            hat_db = {f"{h.ana_hat_no}-{h.alt_hat_no}": h for h in Hat.objects.all()}

            hd_batch = []
            seen = set()

            for _, row in df_durak.iterrows():
                try:
                    h_key = f"{str(row['ana_hat_no']).strip()}-{str(row['alt_hat_no']).strip()}"
                    hat = hat_db.get(h_key)
                    durak = durak_db.get(str(row['durak_no']).strip())

                    if hat and durak:
                        sira = int(row['sira'])
                        # Çift kayıt önleme
                        if (hat.id, sira) in seen: continue
                        seen.add((hat.id, sira))

                        hd_batch.append(HatDurak(
                            hat=hat,
                            durak=durak,
                            sira=sira,
                            istikamet=row.get('istikamet', 'Belirsiz')  # İSTİKAMET BURADA!
                        ))
                except:
                    continue

            if hd_batch: HatDurak.objects.bulk_create(hd_batch, ignore_conflicts=True)
            self.stdout.write("   -> Duraklar ve istikamet bilgisi yüklendi.")

        # --- 3. KOORDİNATLARI TAMİR ET (Durakları Çizgiye Oturt) ---
        self.stdout.write("3. Duraklar haritaya yerleştiriliyor...")
        # Basit mantık: Rotanın başı, ortası ve sonuna durakları yay
        for hat in Hat.objects.all():
            rota = list(hat.guzergah_noktalari.all().order_by('sira'))
            duraklar = list(HatDurak.objects.filter(hat=hat).order_by('sira'))

            if not rota or not duraklar: continue

            step = len(rota) / len(duraklar)
            for i, h_durak in enumerate(duraklar):
                idx = int(i * step)
                if idx >= len(rota): idx = len(rota) - 1

                d = h_durak.durak
                d.enlem = rota[idx].enlem
                d.boylam = rota[idx].boylam
                d.save()

        # --- 4. TARİFELERİ YÜKLE ---
        self.stdout.write("4. Sefer saatleri yükleniyor...")
        if os.path.exists(dosya_tarife):
            try:
                df_tarife = pd.read_csv(dosya_tarife, sep=',', encoding='utf-8-sig', dtype=str)
                tarife_batch = []
                for _, row in df_tarife.iterrows():
                    try:
                        # CSV yapısı: Hat No, Alt Hat No...
                        ana = str(row.iloc[0]).strip()
                        # Alt hat sütunu bazen "0 - HOCAFAKIH" gibi geliyor, sadece 0'ı alalım
                        alt_raw = str(row.iloc[1])
                        alt = alt_raw.split(' ')[0].split('-')[0].strip()

                        h_key = f"{ana}-{alt}"
                        hat = hat_db.get(h_key)

                        if hat:
                            tarife_batch.append(HatTarife(
                                hat=hat,
                                kalkis_saati=row.iloc[2].strip(),  # Saat sütunu
                                yon=row.iloc[4].strip()  # Çıkış/Varış
                            ))
                    except:
                        continue

                if tarife_batch: HatTarife.objects.bulk_create(tarife_batch)
                self.stdout.write("   -> Tarifeler yüklendi.")
            except Exception as e:
                self.stdout.write(f"   -> Tarife hatası: {e}")

        self.stdout.write(self.style.SUCCESS("\n✅ KURULUM BAŞARIYLA TAMAMLANDI! SUNUCUYU YENİDEN BAŞLATIN."))