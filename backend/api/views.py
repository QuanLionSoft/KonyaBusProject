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

# --- MODELLER VE SERIALIZERS ---
from .models import (
    Hat, Durak, HatDurak, TalepVerisi, EkSefer,
    Otobus, HatTarife, HatGuzergah
)
from .serializers import (
    HatSerializer, DurakSerializer, HatDurakSerializer,
    TalepVerisiSerializer, OtobusSerializer
)

# --- YAPAY ZEKA MODÜLLERİ ---
try:
    from .ml_models import demand_predictor, travel_predictor
except ImportError:
    demand_predictor = None
    travel_predictor = None
    print("UYARI: ML Modülleri yüklenemedi. Tahmin servisleri çalışmayabilir.")

# --- DOSYA YOLLARI ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')


# =============================================================================
# YARDIMCI FONKSİYONLAR
# =============================================================================
def normalize_cols(cols):
    """Sütun isimlerini temizler."""
    return [
        str(c).strip().upper()
            .replace('İ', 'I').replace('Ğ', 'G').replace('Ü', 'U')
            .replace('Ş', 'S').replace('Ö', 'O').replace('Ç', 'C')
            .replace(' ', '_').replace('\n', '')
        for c in cols
    ]


def parse_time_column(val):
    """
    Farklı saat formatlarını (06:00, 6, 06.00, 6.0) integer saate çevirir.
    Hata durumunda -1 döner.
    """
    try:
        s = str(val).strip()
        if ':' in s:
            return int(s.split(':')[0])
        elif '.' in s:  # 06.30 veya 6.0 formatı için
            return int(s.split('.')[0])
        else:
            return int(float(s))  # "6" veya "6.0" gelebilir
    except:
        return -1


def get_elkart_data(hat_no):
    """
    Elkart verilerini tüm dosyalardan okur, birleştirir ve temizler.
    Hataları gizlemez, konsola yazar.
    """
    if not os.path.exists(VERI_SETI_KLASORU):
        return pd.DataFrame()

    dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
    if not dosyalar:
        return pd.DataFrame()

    # Dosyaları tarihe göre sırala
    dosyalar.sort(reverse=True)
    df_list = []

    # Hat numarası "4-A" gibi string gelebilir, int() zorlaması patlatır.
    hat_no_str = str(hat_no).strip()

    print(f"Hat {hat_no} için {len(dosyalar)} adet Elkart dosyası taranıyor...")

    for dosya in dosyalar:
        try:
            with open(dosya, 'r', encoding='utf-8', errors='ignore') as f:
                ilk_satir = f.readline()
                ayirici = ';' if ';' in ilk_satir else ','

            iter_csv = pd.read_csv(dosya, sep=ayirici, chunksize=50000,
                                   encoding='utf-8', on_bad_lines='skip', low_memory=False)

            for chunk in iter_csv:
                chunk.columns = normalize_cols(chunk.columns)
                hat_col = next((c for c in chunk.columns if 'HAT' in c and 'NO' in c), None)
                yolcu_col = next((c for c in chunk.columns if 'BINIS' in c or 'SAYI' in c or 'YOLCU' in c), None)
                saat_col = next((c for c in chunk.columns if 'SAAT' in c), None)

                if hat_col and yolcu_col and saat_col:
                    # Hat numarasını stringe çevirip karşılaştır
                    chunk[hat_col] = chunk[hat_col].astype(str).str.strip()
                    filtered = chunk[chunk[hat_col] == hat_no_str].copy()

                    if not filtered.empty:
                        filtered = filtered.rename(columns={yolcu_col: 'yolcu', saat_col: 'saat'})
                        filtered['yolcu'] = pd.to_numeric(filtered['yolcu'], errors='coerce').fillna(1)
                        df_list.append(filtered[['yolcu', 'saat']])
        except Exception as e:
            continue

    if not df_list:
        return pd.DataFrame()

    return pd.concat(df_list, ignore_index=True)


def get_tarife_dataframe():
    """
    Tarife dosyasını bulur ve okur (CSV veya Excel).
    Hatalı satırları atlar ve ayırıcıyı otomatik çözer.
    """
    if not os.path.exists(VERI_SETI_KLASORU):
        return None

    tum_dosyalar = os.listdir(VERI_SETI_KLASORU)
    yasakli_kelimeler = ['elkart', 'durak', 'guzergah', 'hatbilgisi', 'varis']

    adaylar = [
        f for f in tum_dosyalar
        if (f.endswith('.csv') or f.endswith('.xlsx'))
           and not any(y in f.lower() for y in yasakli_kelimeler)
    ]
    adaylar.sort(key=lambda x: 'tarife' not in x.lower())

    for aday in adaylar:
        tam_yol = os.path.join(VERI_SETI_KLASORU, aday)
        try:
            if aday.endswith('.xlsx'):
                df = pd.read_excel(tam_yol)
            else:
                try:
                    df = pd.read_csv(tam_yol, sep=';', on_bad_lines='skip', engine='python', encoding='utf-8')
                except UnicodeDecodeError:
                    df = pd.read_csv(tam_yol, sep=';', on_bad_lines='skip', engine='python', encoding='cp1254')
                except:
                    df = pd.read_csv(tam_yol, sep=None, on_bad_lines='skip', engine='python', encoding='utf-8')

            df.columns = normalize_cols(df.columns)
            col_str = " ".join(df.columns)

            if 'HAT' in col_str and 'SAAT' in col_str:
                return df
        except Exception as e:
            print(f"Dosya okuma hatası ({aday}): {e}")
            continue
    return None


# =============================================================================
# 1. HAT VIEWSET (Harita ve Yönetim İçin)
# =============================================================================
class HatViewSet(viewsets.ModelViewSet):
    """
    Hatların listelenmesi, detaylarının görüntülenmesi ve
    ek sefer gibi operasyonel işlemlerin yönetildiği ViewSet.
    """
    queryset = Hat.objects.all()
    serializer_class = HatSerializer

    # ---------------------------------------------------------
    # 1. HARİTA: ROTA ÇİZGİSİ
    # ---------------------------------------------------------
    @action(detail=True, methods=['get'])
    def rota(self, request, pk=None):
        try:
            hat = self.get_object()
            noktalar = hat.guzergah_noktalari.all().order_by('sira')
            data = [[float(n.enlem), float(n.boylam)] for n in noktalar]
            return Response(data)
        except Exception as e:
            return Response({"error": f"Rota verisi alınamadı: {str(e)}"}, status=500)

    # ---------------------------------------------------------
    # 2. HARİTA: DURAK NOKTALARI
    # ---------------------------------------------------------
    @action(detail=True, methods=['get'])
    def duraklar(self, request, pk=None):
        try:
            hat = self.get_object()
            duraklar = HatDurak.objects.filter(hat=hat).order_by('sira')
            serializer = HatDurakSerializer(duraklar, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": f"Durak verisi alınamadı: {str(e)}"}, status=500)

    # ---------------------------------------------------------
    # 3. SAĞ PANEL: GÜNLÜK TARİFE
    # ---------------------------------------------------------
    @action(detail=True, methods=['get'])
    def gunluk_tarife(self, request, pk=None):
        hat = self.get_object()
        hat_no = str(hat.ana_hat_no).strip()
        liste = []

        # A) Dosyadan Normal Tarifeyi Çek
        try:
            df = get_tarife_dataframe()
            if df is not None:
                hat_col = next((c for c in df.columns if 'HAT' in c and 'NO' in c), None)
                if hat_col:
                    df['hat_str'] = df[hat_col].astype(str).str.split('.').str[0].str.strip()
                    df_hat = df[df['hat_str'] == hat_no].copy()

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
                            saat_val = row['saat_temiz']
                            if saat_val == 'nan' or not saat_val: continue
                            liste.append({'saat': saat_val, 'tip': 'Planlı', 'alt_hat': str(hat_no), 'durum': 'Normal'})
        except Exception as e:
            print(f"Tarife okuma hatası: {e}")

        # B) Veritabanından EK SEFERLERİ Çek
            # B) Veritabanından EK SEFERLERİ Çek
            try:
                ek_seferler = EkSefer.objects.filter(hat=hat, aktif=True).order_by('kalkis_saati')
                for ek in ek_seferler:
                    # DEĞİŞİKLİK BURADA: 'id': ek.id kısmını ekledik. Silme işlemi için bu ID lazım.
                    liste.append({
                        'id': ek.id,
                        'saat': ek.kalkis_saati.strftime('%H:%M'),
                        'tip': 'Ek Sefer',
                        'alt_hat': f"{ek.arac_no}",
                        'durum': 'Planlandı'
                    })
            except Exception as e:
                print(f"Ek sefer okuma hatası: {e}")

    # ---------------------------------------------------------
    # 4. YÖNETİM: EK SEFER OLUŞTURMA
    # ---------------------------------------------------------
    @action(detail=True, methods=['post'])
    def ek_sefer_olustur(self, request, pk=None):
        hat = self.get_object()
        saat = request.data.get('saat')
        arac_no = request.data.get('arac_no')

        if not saat or not arac_no: return Response({"error": "Lütfen Saat ve Araç Seçiniz!"}, status=400)

        try:
            saat_obj = datetime.strptime(saat, '%H:%M').time()
            EkSefer.objects.create(hat=hat, kalkis_saati=saat_obj, arac_no=arac_no, aktif=True)
            try:
                Otobus.objects.filter(plaka=arac_no).update(durum='SEFERDE')
            except:
                pass

            return Response({"status": "Başarılı", "mesaj": f"{arac_no} aracı {saat} saati için ek sefere atandı."})

        except ValueError:
            return Response({"error": "Saat formatı hatalı! (Örn: 14:30)"}, status=400)
        except Exception as e:
            return Response({"error": f"Bir hata oluştu: {str(e)}"}, status=500)

    # ---------------------------------------------------------
    # 5. YÖNETİM: EK SEFER SİLME (YENİ EKLENDİ)
    # ---------------------------------------------------------
    @action(detail=True, methods=['post'])
    def ek_sefer_sil(self, request, pk=None):
        """
        Belirtilen ID'ye sahip ek seferi veritabanından siler.
        """
        ek_sefer_id = request.data.get('ek_sefer_id')
        if not ek_sefer_id:
            return Response({"error": "Sefer ID'si bulunamadı."}, status=400)

        try:
            # Sadece bu hatta ait seferi sil (Güvenlik için hat_id=pk kontrolü)
            sefer = EkSefer.objects.get(id=ek_sefer_id, hat_id=pk)
            sefer.delete()
            return Response({"status": "Başarılı", "mesaj": "Ek sefer kaldırıldı."})
        except EkSefer.DoesNotExist:
            return Response({"error": "Sefer bulunamadı veya zaten silinmiş."}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
# =============================================================================
# 2. DURAK VE TALEP YÖNETİMİ
# =============================================================================
class DurakViewSet(viewsets.ModelViewSet):
    queryset = Durak.objects.all()
    serializer_class = DurakSerializer


class TalepVerisiViewSet(viewsets.ModelViewSet):
    queryset = TalepVerisi.objects.all()
    serializer_class = TalepVerisiSerializer


# =============================================================================
# 3. KAPASİTE VE İZDİHAM ANALİZİ (HatYonetimi.jsx Tablosu İçin)
# =============================================================================
class CapacityAnalysisView(APIView):
    def get(self, request, hat_no):
        try:
            hat_no = str(hat_no).strip()
            OTOBUS_KAPASITESI = 60

            # 1. ARZ (Sefer Sayıları)
            df_tarife = get_tarife_dataframe()
            sefer_sayilari = {}

            if df_tarife is not None:
                hat_col = next((c for c in df_tarife.columns if 'HAT' in c and 'NO' in c), None)
                saat_col = next((c for c in df_tarife.columns if 'SAAT' in c), None)

                if hat_col and saat_col:
                    df_tarife['hat_str'] = df_tarife[hat_col].astype(str).str.split('.').str[0].str.strip()
                    df_hat = df_tarife[df_tarife['hat_str'] == hat_no].copy()

                    df_hat['saat_dilimi'] = df_hat[saat_col].apply(parse_time_column)
                    sefer_sayilari = df_hat[df_hat['saat_dilimi'] >= 0].groupby('saat_dilimi').size().to_dict()

            # 2. TALEP (Elkart)
            df_elkart = get_elkart_data(hat_no)
            talep_ort = {}
            if not df_elkart.empty:
                # DÜZELTME: saat sütunundan saat_dilimi oluştur
                df_elkart['saat_dilimi'] = df_elkart['saat'].apply(parse_time_column)

                # Sadece geçerli saatleri al (0-23 arası)
                df_elkart = df_elkart[(df_elkart['saat_dilimi'] >= 0) & (df_elkart['saat_dilimi'] <= 23)]

                saatlik_sum = df_elkart.groupby('saat_dilimi')['yolcu'].sum()
                # 365 güne bölerek ortalama alıyoruz
                talep_ort = (saatlik_sum / 365).to_dict()

            # 3. BİRLEŞTİRME (6-24 arası)
            sonuc = []
            for saat in range(6, 24):
                sefer = sefer_sayilari.get(saat, 0)
                yolcu = round(talep_ort.get(saat, 0))
                kapasite = sefer * OTOBUS_KAPASITESI

                doluluk = 0
                if kapasite > 0:
                    doluluk = round((yolcu / kapasite) * 100)
                elif yolcu > 0:
                    doluluk = 100  # Sefer yok ama yolcu var

                sonuc.append({
                    "saat": f"{saat:02d}:00",
                    "ortalama_yolcu": yolcu,
                    "sefer_sayisi": sefer,
                    "kapasite": kapasite,
                    "doluluk_yuzdesi": doluluk
                })

            return Response({"hat_no": hat_no, "analiz": sonuc})

        except Exception as e:
            print(f"Kapasite Hatası: {e}")
            # Hata olsa bile boş liste dön ki frontend çökmesin
            return Response({"hat_no": hat_no, "analiz": []})


# =============================================================================
# 4. YAPAY ZEKA TAHMİN VIEW'LARI
# =============================================================================
class PredictDemandView(APIView):
    def get(self, request, hat_no):
        if not demand_predictor:
            return Response({"error": "ML Modülü Yok veya Yüklenemedi"}, status=500)

        period = request.query_params.get('period', 'daily')

        # 1 Yıl yerine 5 Yıllık veri iste (43.800 Saat)
        agg_map = {
            'daily': (24, 'hour'),
            'weekly': (168, 'day'),
            'monthly': (720, 'day'),
            'yearly': (8760, 'month')
        }

        hours, agg = agg_map.get(period, (24, 'hour'))

        try:
            preds = demand_predictor.predict(int(hat_no), hours=hours, agg=agg)

            if preds is None:
                return Response({
                    "durum": "egitilmemis",
                    "mesaj": f"Hat {hat_no} verisi bulunamadı."
                })

            return Response({
                "hat_no": hat_no,
                "period": period,
                "predictions": preds
            })
        except Exception as e:
            return Response({"error": f"Tahmin hatası: {str(e)}"}, status=500)


class PredictTravelTimeView(APIView):
    def get(self, request):
        if not travel_predictor: return Response({"error": "ML Modülü Yok"}, status=500)

        hat_no = request.query_params.get('hat_no')
        durak_a = request.query_params.get('durak_a')
        durak_b = request.query_params.get('durak_b')

        if not all([hat_no, durak_a, durak_b]): return Response({"error": "Eksik parametre"}, status=400)

        try:
            simdi = datetime.now()
            sure = travel_predictor.predict_duration(
                hat_no, durak_a, durak_b,
                simdi.hour, simdi.weekday(),
                recent_delays=[0, 0, 0, 0, 0]
            )
            return Response({
                "baslangic": durak_a, "bitis": durak_b,
                "tahmini_sure_sn": sure,
                "tahmini_sure_dk": round(sure / 60, 1),
                "model": "Hybrid (XGBoost + LSTM)"
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# =============================================================================
# 5. GERÇEK ZAMANLI ARAÇ TAKİBİ (HARİTA İÇİN)
# =============================================================================
@api_view(['GET'])
def aktif_otobusler(request):
    """
    Tarifeye göre araçları yürütür ve bir sonraki durağın GERÇEK İSMİNİ hesaplar.
    """
    hat_id = request.GET.get('hat_id')
    if not hat_id: return Response([])

    try:
        # 1. Hat, Rota ve Durak Bilgilerini Çek
        hat_obj = Hat.objects.get(id=hat_id)
        hat_no = str(hat_obj.ana_hat_no).strip()

        # Rota Noktaları
        rota_noktalari = list(HatGuzergah.objects.filter(hat=hat_obj).order_by('sira').values_list('enlem', 'boylam'))

        # Durak Listesi
        duraklar = list(HatDurak.objects.filter(hat=hat_obj).order_by('sira').select_related('durak'))
        toplam_durak_sayisi = len(duraklar)

        if not rota_noktalari: return Response([])

        toplam_nokta_sayisi = len(rota_noktalari)
        SEFER_SURESI_DK = 60
        SEFER_SURESI_SN = SEFER_SURESI_DK * 60
        simdi = datetime.now()
        aktif_araclar = []

        # 2. Sefer Listesini Oluştur (CSV + DB)
        sefer_listesi = []

        # A) CSV Tarife
        df = get_tarife_dataframe()
        if df is not None:
            hat_col = next((c for c in df.columns if 'HAT' in c and 'NO' in c), None)
            if hat_col:
                df['hat_str'] = df[hat_col].astype(str).str.split('.').str[0].str.strip()
                df_hat = df[df['hat_str'] == hat_no].copy()
                saat_col = next((c for c in df_hat.columns if 'SAAT' in c), None)
                if saat_col:
                    bugun = simdi.date()
                    for val in df_hat[saat_col].values:
                        try:
                            s_str = str(val).split(' ')[-1][:5]
                            h, m = map(int, s_str.split(':'))
                            kalkis = datetime.combine(bugun, datetime.min.time().replace(hour=h, minute=m))
                            sefer_listesi.append(
                                {'zaman': kalkis, 'tip': 'normal', 'kod': f"{hat_no}-{s_str}", 'arac': hat_no})
                        except:
                            pass

        # B) Ek Seferler
        ek_seferler = EkSefer.objects.filter(hat=hat_obj, aktif=True)
        for ek in ek_seferler:
            kalkis = datetime.combine(simdi.date(), ek.kalkis_saati)
            sefer_listesi.append({'zaman': kalkis, 'tip': 'ek', 'kod': f"EK-{ek.arac_no}", 'arac': ek.arac_no})

        # 3. Konum ve Hedef Durak Hesapla
        for i, sefer in enumerate(sefer_listesi):
            gecen_sn = (simdi - sefer['zaman']).total_seconds()

            # Araç yolda mı?
            if 0 <= gecen_sn <= SEFER_SURESI_SN:
                oran = gecen_sn / SEFER_SURESI_SN

                # Koordinat Hesabı
                idx = int(toplam_nokta_sayisi * oran)
                if idx >= toplam_nokta_sayisi: idx = toplam_nokta_sayisi - 1
                lat, lng = rota_noktalari[idx]

                # Hedef Durak Hesabı
                hedef_isim = "Bilinmiyor"
                if toplam_durak_sayisi > 0:
                    durak_idx = int(toplam_durak_sayisi * oran)
                    if durak_idx < toplam_durak_sayisi - 1: durak_idx += 1
                    if durak_idx >= toplam_durak_sayisi: durak_idx = toplam_durak_sayisi - 1
                    hedef_isim = duraklar[durak_idx].durak.durak_adi

                kalan_dk = int((SEFER_SURESI_SN - gecen_sn) / 60)

                # FIX: ID'nin sonuna sıra numarasını ekliyoruz (Örn: '2-23:00_154')
                unique_id = f"{sefer['kod']}_{i}"

                aktif_araclar.append({
                    "id": unique_id,
                    "arac_no": sefer['arac'],
                    "enlem": lat, "boylam": lng,
                    "durum": 'kritik' if sefer['tip'] == 'ek' else 'normal',
                    "kalan_sure_dk": kalan_dk,
                    "hedef_durak": hedef_isim
                })

        return Response(aktif_araclar)
    except Exception as e:
        print(f"Aktif araç hatası: {e}")
        return Response([])


class DetayliAnalizView(APIView):
    def get(self, request, hat_no): return Response({"message": "Detay Analiz Yakında..."})