from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime, timedelta
import os
import glob
import pandas as pd
import numpy as np

# --- MODELLER ---
from .models import Hat, Durak, HatDurak, TalepVerisi, EkSefer, Otobus, HatTarife, HatGuzergah
from .serializers import HatSerializer, DurakSerializer, HatDurakSerializer, TalepVerisiSerializer, OtobusSerializer

# --- YAPAY ZEKA ---
try:
    from .ml_models import demand_predictor
except ImportError:
    demand_predictor = None

# --- DOSYA YOLLARI ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')


# --- YARDIMCI FONKSİYONLAR ---
def normalize_cols(cols):
    """Sütun isimlerini temizler ve standartlaştırır."""
    return [str(c).strip().replace('\n', '').replace('\r', '').upper().replace('İ', 'I').replace(' ', '_') for c in
            cols]


def get_tarife_dataframe():
    """Veri seti klasöründeki Excel veya CSV tarife dosyasını bulur ve okur."""
    if not os.path.exists(VERI_SETI_KLASORU): return None

    tum_dosyalar = os.listdir(VERI_SETI_KLASORU)
    yasakli = ['elkart', 'durak', 'guzergah', 'hatbilgisi']
    adaylar = [f for f in tum_dosyalar if
               (f.endswith('.csv') or f.endswith('.xlsx')) and not any(y in f.lower() for y in yasakli)]

    for aday in adaylar:
        tam_yol = os.path.join(VERI_SETI_KLASORU, aday)
        try:
            if aday.endswith('.xlsx'):
                df = pd.read_excel(tam_yol)
            else:
                try:
                    df = pd.read_csv(tam_yol, sep=None, engine='python', encoding='utf-8')
                except:
                    df = pd.read_csv(tam_yol, sep=None, engine='python', encoding='cp1254')

            df.columns = normalize_cols(df.columns)
            col_str = " ".join(df.columns)
            if 'HAT' in col_str and 'SAAT' in col_str: return df
        except:
            continue
    return None


# ==========================================
# 1. HAT VIEWSET (Harita ve Yönetim İçin)
# ==========================================
class HatViewSet(viewsets.ModelViewSet):
    queryset = Hat.objects.all()
    serializer_class = HatSerializer

    # Harita: Rota Çizgisi
    @action(detail=True, methods=['get'])
    def rota(self, request, pk=None):
        hat = self.get_object()
        noktalar = hat.guzergah_noktalari.all().order_by('sira')
        data = [[float(n.enlem), float(n.boylam)] for n in noktalar]
        return Response(data)

    # Harita: Durak Noktaları
    @action(detail=True, methods=['get'])
    def duraklar(self, request, pk=None):
        hat = self.get_object()
        duraklar = HatDurak.objects.filter(hat=hat).order_by('sira')
        serializer = HatDurakSerializer(duraklar, many=True)
        return Response(serializer.data)

    # Harita: Sağ Panel (Günlük Tarife Listesi - Dosyadan)
    @action(detail=True, methods=['get'])
    def gunluk_tarife(self, request, pk=None):
        hat = self.get_object()
        hat_no = hat.ana_hat_no

        df = get_tarife_dataframe()
        liste = []

        # 1. Dosyadan Normal Tarifeyi Çek
        if df is not None:
            hat_col = next((c for c in df.columns if 'HAT' in c and 'NO' in c), None)
            if hat_col:
                df['hat_str'] = df[hat_col].astype(str).str.split('.').str[0]
                df_hat = df[df['hat_str'] == str(hat_no)].copy()
                bugun = datetime.today().weekday()
                gun_kodu = 'P' if bugun == 6 else ('C' if bugun == 5 else 'H')
                zaman_col = next((c for c in df.columns if 'ZAMAN' in c or 'GUN' in c), None)
                if zaman_col:
                    df_hat = df_hat[df_hat[zaman_col].astype(str).str.upper().str.contains(gun_kodu, na=False)]
                saat_col = next((c for c in df_hat.columns if 'SAAT' in c), None)
                if saat_col:
                    df_hat['saat_temiz'] = df_hat[saat_col].astype(str).apply(lambda x: x.split(' ')[-1][:5])
                    df_hat = df_hat.sort_values('saat_temiz')
                    for _, row in df_hat.iterrows():
                        if row['saat_temiz'] == 'nan': continue
                        liste.append({'saat': row['saat_temiz'], 'tip': 'Planlı', 'alt_hat': str(hat_no)})

        # 2. Veritabanından EK SEFERLERİ Çek
        ek_seferler = EkSefer.objects.filter(hat=hat).order_by('kalkis_saati')
        for ek in ek_seferler:
            liste.append({
                'saat': ek.kalkis_saati.strftime('%H:%M'),
                'tip': 'Ek Sefer',
                'alt_hat': f"{ek.arac_no}"
            })

        liste.sort(key=lambda x: x['saat'])
        return Response(liste)

    # Hat Yönetimi: Ek Sefer Oluşturma
    @action(detail=True, methods=['post'])
    def ek_sefer_olustur(self, request, pk=None):
        hat = self.get_object()
        saat = request.data.get('saat')
        arac_no = request.data.get('arac_no')

        if not saat or not arac_no:
            return Response({"error": "Lütfen Saat ve Araç Seçiniz!"}, status=400)

        try:
            saat_obj = datetime.strptime(saat, '%H:%M').time()
            EkSefer.objects.create(hat=hat, kalkis_saati=saat_obj, arac_no=arac_no)
            try:
                Otobus.objects.filter(plaka=arac_no).update(durum='SEFERDE')
            except:
                pass
            return Response({"status": "Başarılı", "mesaj": f"{arac_no} aracı {saat} seferine atandı."})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ==========================================
# 2. KAPASİTE ANALİZİ (FULL)
# ==========================================
class CapacityAnalysisView(APIView):
    def get(self, request, hat_no):
        try:
            hat_no = int(hat_no)
            OTOBUS_KAPASITESI = 100

            # 1. ARZ (Tarife Dosyası)
            df = get_tarife_dataframe()
            if df is None: return Response({"analiz": [], "error": "Tarife dosyası bulunamadı"}, status=200)

            hat_col = next((c for c in df.columns if 'HAT' in c and 'NO' in c), None)
            if not hat_col: return Response({"analiz": [], "error": "Hat No kolonu yok"}, status=200)

            df['hat_str'] = df[hat_col].astype(str).str.split('.').str[0]
            df_hat = df[df['hat_str'] == str(hat_no)].copy()

            bugun = datetime.today().weekday()
            gun_kodu = 'P' if bugun == 6 else ('C' if bugun == 5 else 'H')
            zaman_col = next((c for c in df.columns if 'ZAMAN' in c or 'GUN' in c), None)
            if zaman_col:
                df_hat = df_hat[df_hat[zaman_col].astype(str).str.upper().str.contains(gun_kodu, na=False)]

            sefer_sayilari = {}
            saat_col = next((c for c in df_hat.columns if 'SAAT' in c), None)
            if saat_col:
                df_hat['saat_dilimi'] = df_hat[saat_col].astype(str).apply(lambda x: x.split(' ')[-1].split(':')[0])
                df_hat = df_hat[df_hat['saat_dilimi'].str.isnumeric()]
                if not df_hat.empty:
                    df_hat['saat_dilimi'] = df_hat['saat_dilimi'].astype(int)
                    sefer_sayilari = df_hat.groupby('saat_dilimi').size().to_dict()

            # 2. TALEP (Elkart Dosyaları)
            dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
            df_list = []
            for dosya in dosyalar:
                try:
                    temp_df = pd.read_csv(dosya, sep=None, engine='python')
                    temp_df.columns = normalize_cols(temp_df.columns)
                    y_col = next((c for c in temp_df.columns if 'BINIS' in c or 'SAYI' in c), None)
                    h_col = next((c for c in temp_df.columns if 'HAT' in c and 'NO' in c and 'ALT' not in c), None)
                    s_col = next((c for c in temp_df.columns if 'SAAT' in c), None)
                    if y_col and h_col and s_col:
                        sub = temp_df[temp_df[h_col] == hat_no].copy()
                        if not sub.empty:
                            sub = sub[[s_col, y_col]]
                            sub.columns = ['saat', 'yolcu']
                            df_list.append(sub)
                except:
                    pass

            talep_ort = {}
            if df_list:
                df_talep = pd.concat(df_list, ignore_index=True)
                talep_ort = df_talep.groupby('saat')['yolcu'].mean().to_dict()

            sonuc = []
            for saat in range(6, 24):
                sefer = sefer_sayilari.get(saat, 0)
                yolcu = round(talep_ort.get(saat, 0))
                kap = sefer * OTOBUS_KAPASITESI
                doluluk = round((yolcu / kap) * 100) if sefer > 0 else 0
                durum, aksiyon = "Normal", "-"
                if doluluk > 100:
                    durum, aksiyon = "İZDİHAM", "⚠️ EK SEFER ŞART"
                elif doluluk > 80:
                    durum, aksiyon = "Çok Yoğun", "İzle"
                elif yolcu > 20 and sefer == 0:
                    durum, aksiyon = "Sefer Yok!", "⚠️ HAT AÇILMALI"

                sonuc.append({
                    "saat": f"{saat}:00", "ortalama_yolcu": yolcu,
                    "sefer_sayisi": sefer, "kapasite": kap,
                    "doluluk_yuzdesi": doluluk, "durum": durum, "aksiyon": aksiyon
                })
            return Response({"hat_no": hat_no, "analiz": sonuc})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ==========================================
# 3. PROPHET TAHMİNİ (DETAYLI)
# ==========================================
class PredictDemandView(APIView):
    def get(self, request, hat_no):
        if not demand_predictor: return Response({"error": "ML Modülü Yok"}, status=500)

        period = request.query_params.get('period', 'daily')
        settings = {
            'daily': (24, 'hour'),
            'weekly': (7, 'day'),
            'monthly': (30, 'day'),
            'yearly': (12, 'month')
        }
        steps, agg = settings.get(period, (24, 'hour'))

        try:
            preds = demand_predictor.predict(int(hat_no), hours=steps, agg=agg)
            if preds is None:
                demand_predictor.train_model(int(hat_no))
                preds = demand_predictor.predict(int(hat_no), hours=steps, agg=agg)

            return Response({"hat_no": hat_no, "period": period, "predictions": preds})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ==========================================
# 4. SİMÜLASYON (Harita İçin - EK SEFER DAHİL)
# ==========================================
@api_view(['GET'])
def aktif_otobusler(request):
    hat_id = request.GET.get('hat_id')
    if not hat_id: return Response([])
    try:
        hat_obj = Hat.objects.get(id=hat_id)
        hat_no = hat_obj.ana_hat_no
        rota_noktalari = list(HatGuzergah.objects.filter(hat=hat_obj).order_by('sira').values_list('enlem', 'boylam'))
        if not rota_noktalari: return Response([])

        toplam_nokta = len(rota_noktalari)
        baslangic = rota_noktalari[0]
        simdi = datetime.now()
        sefer_saatleri = []

        # A) Dosyadan Normal Tarifeyi Çek
        df = get_tarife_dataframe()
        if df is not None:
            hat_col = next((c for c in df.columns if 'HAT' in c and 'NO' in c), None)
            if hat_col:
                df['hat_str'] = df[hat_col].astype(str).str.split('.').str[0]
                df_hat = df[df['hat_str'] == str(hat_no)].copy()
                bugun = datetime.today().weekday()
                gun_kodu = 'P' if bugun == 6 else ('C' if bugun == 5 else 'H')
                zaman_col = next((c for c in df.columns if 'ZAMAN' in c or 'GUN' in c), None)
                if zaman_col:
                    df_hat = df_hat[df_hat[zaman_col].astype(str).str.upper().str.contains(gun_kodu, na=False)]
                saat_col = next((c for c in df_hat.columns if 'SAAT' in c), None)
                if saat_col:
                    simdi_tarih = simdi.date()
                    for val in df_hat[saat_col].values:
                        try:
                            s_str = str(val).split(' ')[-1][:5]
                            if s_str == 'nan': continue
                            h, m = map(int, s_str.split(':'))
                            sefer_saatleri.append((
                                datetime.combine(simdi_tarih, datetime.min.time().replace(hour=h, minute=m)),
                                'normal',
                                f"{h:02}:{m:02}"
                            ))
                        except:
                            pass

        # B) Veritabanından EK SEFERLERİ Çek
        ek_seferler = EkSefer.objects.filter(hat=hat_obj)
        simdi_tarih = simdi.date()
        for ek in ek_seferler:
            sefer_dt = datetime.combine(simdi_tarih, ek.kalkis_saati)
            sefer_saatleri.append((sefer_dt, 'ek', f"EK-{ek.arac_no}"))

        # C) Simülasyon
        data = []
        for dt, tip, arac_no in sefer_saatleri:
            fark_sn = (simdi - dt).total_seconds()

            # YOLDA (0 - 60 dk arası)
            if 0 <= fark_sn <= 3600:
                ilerleme = fark_sn / 3600
                idx = int(toplam_nokta * ilerleme)
                if idx < toplam_nokta:
                    lat, lng = rota_noktalari[idx]
                    data.append({
                        'id': f"{tip}-{arac_no}",
                        'arac_no': arac_no,
                        'durum': 'kritik' if tip == 'ek' else 'aktif',
                        'enlem': lat, 'boylam': lng,
                        'kalan_sure_dk': int(60 - (fark_sn / 60)),
                        'bilgi': 'Seferde'
                    })
            # BEKLEYEN (Gelecek 60 dk içinde)
            elif -3600 <= fark_sn < 0:
                data.append({
                    'id': f"pasif-{tip}-{arac_no}",
                    'arac_no': arac_no,
                    'durum': 'pasif',
                    'enlem': baslangic[0], 'boylam': baslangic[1],
                    'kalan_sure_dk': int(abs(fark_sn) / 60),
                    'bilgi': 'Bekliyor'
                })

        return Response(data)

    except Exception as e:
        return Response([])


# --- STANDART VIEWLER ---
class DurakViewSet(viewsets.ModelViewSet):
    queryset = Durak.objects.all()
    serializer_class = DurakSerializer


class TalepVerisiViewSet(viewsets.ModelViewSet):
    queryset = TalepVerisi.objects.all()
    serializer_class = TalepVerisiSerializer


class EkSeferViewSet(viewsets.ModelViewSet):
    queryset = EkSefer.objects.all()
    serializer_class = TalepVerisiSerializer


class DetayliAnalizView(APIView):
    def get(self, request, hat_no): return Response({"message": "Detay"})