import os
import pandas as pd
from datetime import datetime
from django.core.management.base import BaseCommand
from api.models import Hat, TalepVerisi
from django.utils import timezone


class Command(BaseCommand):
    help = 'elkartbinis2021.csv dosyasını ESNEK TARİH FORMATI ile yükler.'

    def handle(self, *args, **options):
        base_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"
        dosya_yolu = os.path.join(base_path, "elkartbinis2021.csv")

        if not os.path.exists(dosya_yolu):
            self.stdout.write(self.style.ERROR(f"Dosya bulunamadı: {dosya_yolu}"))
            return

        self.stdout.write("1. Veriler okunuyor...")

        try:
            # CSV Oku
            df = pd.read_csv(dosya_yolu, sep=';', encoding='utf-8-sig', dtype=str)

            # Sütun isimlerini normalize et
            def temizle(col):
                return col.strip().lower().replace(' ', '').replace('_', '').replace('ı', 'i').replace('ş',
                                                                                                       's').replace('ç',
                                                                                                                    'c')

            df.columns = [temizle(c) for c in df.columns]

            # Sütunları Bul
            col_hat = next((c for c in df.columns if 'hat' in c and 'no' in c), None)
            col_tarih = next((c for c in df.columns if 'tarih' in c), None)
            col_saat = next((c for c in df.columns if 'saat' in c), None)  # Saat ayrı sütundaysa

            if not col_hat or not col_tarih:
                self.stdout.write(self.style.ERROR("❌ HATA: Gerekli sütunlar bulunamadı!"))
                return

            # Hatları Hafızaya Al
            hat_cache = {str(h.ana_hat_no).strip(): h for h in Hat.objects.all()}

            # Önceki verileri temizle
            TalepVerisi.objects.all().delete()

            batch = []
            count = 0

            self.stdout.write("2. Veritabanına yazılıyor...")

            for index, row in df.iterrows():
                try:
                    hat_no_raw = str(row[col_hat]).strip().split('.')[0]  # 1.0 -> 1 temizliği
                    tarih_raw = str(row[col_tarih]).strip()

                    hat = hat_cache.get(hat_no_raw)

                    if hat:
                        # --- TARİH FORMATI DÜZELTME KISMI ---
                        tarih_saat_str = tarih_raw

                        # Eğer saat ayrı sütundaysa birleştir
                        if col_saat and pd.notna(row[col_saat]):
                            saat_part = str(row[col_saat]).strip()
                            tarih_saat_str = f"{tarih_raw} {saat_part}"

                        tarih_saat = None

                        # Olası tüm formatları dene (Senin hatan buradaydı)
                        formatlar = [
                            '%Y-%m-%d %H',  # 2021-12-21 11 (Senin CSV'deki format bu!)
                            '%Y-%m-%d %H:%M:%S',  # 2021-12-21 11:30:00
                            '%d.%m.%Y %H:%M:%S',  # 21.12.2021 11:30:00
                            '%d.%m.%Y %H',  # 21.12.2021 11
                            '%Y-%m-%d',  # Sadece tarih
                        ]

                        for fmt in formatlar:
                            try:
                                tarih_saat = datetime.strptime(tarih_saat_str, fmt)
                                break  # Başarılı olursa döngüden çık
                            except ValueError:
                                continue

                        # Eğer hiçbir format uymadıysa atla
                        if not tarih_saat:
                            continue

                        batch.append(TalepVerisi(
                            hat=hat,
                            tarih_saat=tarih_saat,
                            yolcu_sayisi=1
                        ))
                        count += 1

                    # Batch Kaydetme
                    if len(batch) >= 5000:
                        TalepVerisi.objects.bulk_create(batch)
                        batch = []
                        print(f"   -> {count} kayıt işlendi...", end='\r')

                except Exception:
                    continue

            if batch:
                TalepVerisi.objects.bulk_create(batch)

            self.stdout.write(self.style.SUCCESS(f"\n✅ TOPLAM {count} ADET VERİ BAŞARIYLA YÜKLENDİ!"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Genel Hata: {e}"))