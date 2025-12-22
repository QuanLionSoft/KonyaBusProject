import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import Hat, Durak, TalepVerisi, DurakVaris


class Command(BaseCommand):
    help = 'Veritabanini SIFIRLAR ve Hat/Durak verilerini yukler'

    def handle(self, *args, **kwargs):
        base_dir = settings.BASE_DIR.parent
        data_path = os.path.join(base_dir, 'veri_seti')

        self.stdout.write(self.style.ERROR('--- ⚠️ DİKKAT: VERİTABANI TAMAMEN SIFIRLANIYOR ---'))

        # 1. TEMİZLİK: Önce bağlı verileri (Child), sonra ana verileri (Parent) sil
        # Hata almamak için silme sırası önemlidir.
        TalepVerisi.objects.all().delete()
        DurakVaris.objects.all().delete()
        Hat.objects.all().delete()
        Durak.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('--- ✅ TEMİZLİK BİTTİ. SIFIRDAN YÜKLEME BAŞLIYOR ---'))

        if not os.path.exists(data_path):
            self.stdout.write(self.style.ERROR(f"HATA: Veri seti klasörü bulunamadı: {data_path}"))
            return

        # ---------------------------------------------------------
        # 2. ADIM: HATLARIN YÜKLENMESİ
        # ---------------------------------------------------------
        try:
            dosya_adi = 'hatbilgisi.csv'
            dosya_yolu = os.path.join(data_path, dosya_adi)

            if not os.path.exists(dosya_yolu):
                dosya_yolu = os.path.join(data_path, 'tarifeler.xlsx - Sheet1.csv')
                sep = ','
            else:
                sep = ';'

            self.stdout.write(f"📂 Okunuyor: {os.path.basename(dosya_yolu)}")

            try:
                df_hat = pd.read_csv(dosya_yolu, sep=sep, dtype=str, encoding='utf-8')
            except UnicodeDecodeError:
                df_hat = pd.read_csv(dosya_yolu, sep=sep, dtype=str, encoding='latin-1')

            df_hat.columns = df_hat.columns.str.strip().str.lower()

            col_hat_no = next((c for c in df_hat.columns if 'hat' in c and 'no' in c), None)

            if col_hat_no:
                hat_listesi = []
                mevcut_hatlar = set()

                for _, row in df_hat.iterrows():
                    hat_no = str(row[col_hat_no]).strip()
                    if pd.notna(hat_no) and hat_no not in mevcut_hatlar:
                        hat_listesi.append(Hat(hat_no=hat_no, aciklama=f"{hat_no} Nolu Hat"))
                        mevcut_hatlar.add(hat_no)

                Hat.objects.bulk_create(hat_listesi)
                self.stdout.write(self.style.SUCCESS(f'✅ {len(hat_listesi)} adet Hat sıfırdan oluşturuldu.'))
            else:
                self.stdout.write(self.style.ERROR('Hat dosyasında "Hat No" sütunu bulunamadı!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Hatlar yüklenirken hata: {e}'))

        # ---------------------------------------------------------
        # 3. ADIM: DURAKLARIN YÜKLENMESİ
        # ---------------------------------------------------------
        try:
            dosya_adi = 'hatdurak.csv'
            dosya_yolu = os.path.join(data_path, dosya_adi)

            if os.path.exists(dosya_yolu):
                self.stdout.write(f"📂 Okunuyor: {dosya_adi}")

                try:
                    df_durak = pd.read_csv(dosya_yolu, sep=';', dtype=str, encoding='utf-8')
                except UnicodeDecodeError:
                    df_durak = pd.read_csv(dosya_yolu, sep=';', dtype=str, encoding='latin-1')

                df_durak.columns = df_durak.columns.str.strip().str.lower()

                col_durak_no = next((c for c in df_durak.columns if 'durak' in c and 'no' in c), None)
                col_durak_adi = next((c for c in df_durak.columns if 'durak' in c and 'ad' in c), None)
                col_enlem = next((c for c in df_durak.columns if 'enlem' in c or 'lat' in c), None)
                col_boylam = next((c for c in df_durak.columns if 'boylam' in c or 'lng' in c or 'lon' in c), None)

                if col_durak_no:
                    duraklar = []
                    mevcut_duraklar = set()  # Duplicate önlemek için set

                    for _, row in df_durak.iterrows():
                        d_no = str(row[col_durak_no]).strip()

                        if pd.notna(d_no) and d_no not in mevcut_duraklar:
                            lat = float(row[col_enlem].replace(',', '.')) if col_enlem and pd.notna(
                                row[col_enlem]) else None
                            lon = float(row[col_boylam].replace(',', '.')) if col_boylam and pd.notna(
                                row[col_boylam]) else None
                            d_adi = row[col_durak_adi] if col_durak_adi else ""

                            duraklar.append(Durak(
                                durak_no=d_no,
                                durak_adi=d_adi,
                                enlem=lat,
                                boylam=lon
                            ))
                            mevcut_duraklar.add(d_no)

                    Durak.objects.bulk_create(duraklar, batch_size=2000)
                    self.stdout.write(self.style.SUCCESS(f'✅ {len(duraklar)} adet Durak sıfırdan oluşturuldu.'))
                else:
                    self.stdout.write(self.style.ERROR('Durak dosyasında "Durak No" sütunu bulunamadı!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Duraklar yüklenirken hata: {e}'))