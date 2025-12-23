import pandas as pd
import numpy as np
import os
import joblib
import glob
from datetime import datetime, timedelta

# --- KÜTÜPHANE KONTROLLERİ ---
try:
    from prophet import Prophet
except ImportError:
    Prophet = None
    print("[ML] UYARI: 'prophet' kütüphanesi yüklü değil. Talep tahmini çalışmayabilir.")

try:
    from xgboost import XGBRegressor
except ImportError:
    XGBRegressor = None

try:
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
except ImportError:
    Sequential, LSTM, Dense, Dropout, load_model = None, None, None, None, None

from sklearn.preprocessing import MinMaxScaler, LabelEncoder

# --- DİZİN AYARLARI ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')
MODEL_DIR = os.path.join(CURRENT_DIR, 'saved_models')

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)


# =============================================================================
# 1. HYBRID DEMAND PREDICTOR (PROPHET + LSTM) - YOLCU TALEP TAHMİNİ
# =============================================================================
class DemandPredictor:
    def _clean_hat_no(self, val):
        """Hat numarasını standartlaştırır (örn: '4.0' -> '4')."""
        try:
            s = str(val).strip()
            if '.' in s:
                return s.split('.')[0]
            return s
        except:
            return str(val)

    def _read_all_data(self, hat_no):
        """
        Elkart verilerini okur. Hat numarası eşleşmesini esnek yapar.
        Saat formatlarını düzeltir.
        """
        if not os.path.exists(VERI_SETI_KLASORU): return None

        dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
        if not dosyalar: return None

        df_list = []
        hedef_hat = self._clean_hat_no(hat_no)  # '4'

        print(f"[ML] Hat {hat_no} (Aranan: {hedef_hat}) için veri taranıyor...")

        for dosya in dosyalar:
            try:
                with open(dosya, 'r', encoding='utf-8', errors='ignore') as f:
                    ilk_satir = f.readline()
                    ayirici = ';' if ';' in ilk_satir else ','

                chunk_iter = pd.read_csv(dosya, sep=ayirici, chunksize=50000, encoding='utf-8', on_bad_lines='skip',
                                         low_memory=False)

                for temp in chunk_iter:
                    # Sütunları Temizle
                    temp.columns = [str(c).strip().upper().replace('İ', 'I').replace(' ', '_') for c in temp.columns]

                    hat_col = next((c for c in temp.columns if 'HAT' in c and 'NO' in c), None)
                    tarih_col = next((c for c in temp.columns if 'TARIH' in c or 'ISLEM' in c or 'ZAMAN' in c), None)
                    saat_col = next((c for c in temp.columns if 'SAAT' in c), None)
                    yolcu_col = next((c for c in temp.columns if 'BINIS' in c or 'YOLCU' in c or 'SAYI' in c), None)

                    if hat_col and tarih_col and saat_col:
                        # --- KRİTİK DÜZELTME: Hat No Temizliği ---
                        # Verideki '4.0' değerini '4' yapıp karşılaştırıyoruz
                        temp['hat_clean'] = temp[hat_col].apply(self._clean_hat_no)

                        filtered = temp[temp['hat_clean'] == hedef_hat].copy()

                        if not filtered.empty:
                            rename_map = {tarih_col: 'ds_date', saat_col: 'ds_hour'}
                            if yolcu_col:
                                rename_map[yolcu_col] = 'y'
                            else:
                                filtered['y'] = 1

                            filtered = filtered.rename(columns=rename_map)
                            if 'y' not in filtered.columns: filtered['y'] = 1
                            filtered['y'] = pd.to_numeric(filtered['y'], errors='coerce').fillna(1)

                            df_list.append(filtered[['ds_date', 'ds_hour', 'y']])
            except Exception as e:
                continue

        if not df_list:
            print(f"[ML] Hat {hat_no} için HİÇ VERİ BULUNAMADI. CSV dosyalarındaki Hat No sütununu kontrol edin.")
            return None

        # --- VERİ BİRLEŞTİRME ---
        try:
            full_df = pd.concat(df_list, ignore_index=True)

            # Saat Temizliği
            def temizle_saat(val):
                s = str(val).strip()
                if '.' in s and ':' not in s: s = s.split('.')[0]
                if ':' not in s: return s.zfill(2) + ':00'

                parts = s.split(':')
                h = parts[0].zfill(2)
                m = parts[1].zfill(2) if len(parts) > 1 else "00"
                return f"{h}:{m}"

            full_df['clean_hour'] = full_df['ds_hour'].apply(temizle_saat)
            full_df['ds_str'] = full_df['ds_date'].astype(str) + ' ' + full_df['clean_hour']

            # Datetime Dönüşümü
            full_df['ds'] = pd.to_datetime(full_df['ds_str'], dayfirst=True, errors='coerce')
            full_df = full_df.dropna(subset=['ds'])

            return full_df

        except Exception as e:
            print(f"[ML] Veri birleştirme hatası: {e}")
            return None

    def __init__(self):
        self.models_prophet = {}
        self.scalers = {}

    def train_model(self, hat_no):
        """Prophet modelini 'Gerçekçi Döngüler' üretecek şekilde eğitir."""
        if Prophet is None: return False

        df = self._read_all_data(hat_no)
        if df is None or df.empty: return False

        print(f"[ML] Hat {hat_no} için {len(df)} satır veri ile eğitim başlıyor...")

        # 2. Aggregation
        df_agg = df.groupby('ds')['y'].sum().reset_index().sort_values('ds')
        df_agg = df_agg.set_index('ds').resample('H').sum().fillna(0).reset_index()

        try:
            # --- GERÇEKÇİLİK AYARLARI ---
            model_p = Prophet(
                daily_seasonality=True,  # Günlük döngüyü (Sabah/Akşam pikleri) zorla
                weekly_seasonality=True,  # Haftalık döngüyü (Hafta sonu düşüşü) zorla
                yearly_seasonality=True,
                # changepoint_prior_scale=0.001: Trendi çok katı yapar.
                # Yani veri eski olsa bile 1 yıl sonrasına "düşüş" veya "yükseliş" abartılı yansımaz.
                changepoint_prior_scale=0.001,
                # seasonality_prior_scale=10.0: Saatlik dalgalanmaları (sabah yoğunluğu vb.) belirginleştirir.
                seasonality_prior_scale=10.0
            )

            # Negatif tahminleri engellemek için 'logistic' büyüme kullanılabilir ama
            # basitlik adına trendi sabitledik.

            model_p.add_country_holidays(country_name='TR')
            model_p.fit(df_agg)

            path = os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl')
            joblib.dump(model_p, path)
            self.models_prophet[str(hat_no)] = model_p

            print(f"[ML] Model eğitildi (Realistic Mode): {path}")
            return True
        except Exception as e:
            print(f"[ML] Eğitim hatası: {e}")
            return False

    def predict(self, hat_no, hours=24, agg='hour'):
        """Gelecek tahmini üretir."""
        hat_no = str(hat_no)
        p_path = os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl')

        # Modeli Yükle
        model_p = self.models_prophet.get(hat_no)
        if model_p is None:
            if os.path.exists(p_path):
                try:
                    model_p = joblib.load(p_path)
                    self.models_prophet[hat_no] = model_p
                except:
                    pass

            if model_p is None:
                if self.train_model(hat_no):
                    model_p = self.models_prophet.get(hat_no)
                else:
                    return None

        # Tahmin (Bugünden İtibaren)
        try:
            # Şu anki saati al, dakikayı sıfırla
            start_date = datetime.now().replace(minute=0, second=0, microsecond=0)

            # Gelecek tarihleri oluştur
            future_dates = pd.date_range(start=start_date, periods=hours, freq='H')
            future = pd.DataFrame({'ds': future_dates})

            # Prophet Tahmini
            forecast = model_p.predict(future)
            forecast['yhat'] = forecast['yhat'].clip(lower=0)  # Negatifleri temizle

            # Sonuçları Grupla
            if agg == 'day':
                result = forecast.resample('D', on='ds')['yhat'].sum().reset_index()
            elif agg == 'month':
                result = forecast.resample('MS', on='ds')['yhat'].sum().reset_index()
            else:
                result = forecast[['ds', 'yhat']].copy()

            # Tarihleri string formatına çevir (Frontend için garanti olsun)
            # ISO Format: 2025-01-01T14:00:00
            result['ds'] = result['ds'].apply(lambda x: x.isoformat())

            return result.to_dict('records')

        except Exception as e:
            print(f"[ML] Tahmin hatası: {e}")
            # Model bozuksa sil
            if os.path.exists(p_path): os.remove(p_path)
            return None


# =============================================================================
# 2. HYBRID TRAVEL TIME PREDICTOR
# =============================================================================
class TravelTimePredictor:
    def __init__(self):
        self.xgb_model = None
        self.lstm_model = None
        self.label_encoders = {}
        self.scaler = MinMaxScaler()

        self.xgb_path = os.path.join(MODEL_DIR, 'travel_xgb.json')
        self.lstm_path = os.path.join(MODEL_DIR, 'travel_lstm.h5')
        self.artifacts_path = os.path.join(MODEL_DIR, 'travel_artifacts.pkl')

        self.load_models()

    def load_models(self):
        if os.path.exists(self.xgb_path) and XGBRegressor:
            self.xgb_model = XGBRegressor()
            self.xgb_model.load_model(self.xgb_path)
        if os.path.exists(self.lstm_path) and load_model:
            try:
                self.lstm_model = load_model(self.lstm_path)
            except:
                pass
        if os.path.exists(self.artifacts_path):
            try:
                artifacts = joblib.load(self.artifacts_path)
                self.label_encoders = artifacts.get('encoders', {})
                self.scaler = artifacts.get('scaler', MinMaxScaler())
            except:
                pass

    def prepare_data(self):
        # Önceki kodunuzdakiyle aynı mantık, sadece dosya okuma kontrollerini ekleyin
        dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "otobusdurakvaris*.csv"))
        if not dosyalar: return None

        df_list = []
        cols = ['ana_hat_no', 'baslangic_durak_no', 'bitis_durak_no', 'cikis_zaman', 'varis_zaman']

        for dosya in dosyalar:
            try:
                with open(dosya, 'r', encoding='utf-8') as f:
                    ayirici = ';' if ';' in f.readline() else ','

                temp = pd.read_csv(dosya, sep=ayirici, usecols=lambda c: c.lower() in cols, low_memory=False)
                temp.columns = [c.lower() for c in temp.columns]

                temp['cikis_zaman'] = pd.to_datetime(temp['cikis_zaman'], errors='coerce')
                temp['varis_zaman'] = pd.to_datetime(temp['varis_zaman'], errors='coerce')
                temp = temp.dropna()

                temp['sure'] = (temp['varis_zaman'] - temp['cikis_zaman']).dt.total_seconds()
                temp = temp[(temp['sure'] > 0) & (temp['sure'] < 7200)]

                temp['saat'] = temp['cikis_zaman'].dt.hour
                temp['gun'] = temp['cikis_zaman'].dt.weekday
                df_list.append(temp)
            except:
                continue

        if not df_list: return None
        return pd.concat(df_list, ignore_index=True)

    def train_hybrid(self):
        df = self.prepare_data()
        if df is None: return "Veri Yok"

        le_hat = LabelEncoder()
        le_durak = LabelEncoder()

        tum_duraklar = pd.concat([df['baslangic_durak_no'].astype(str), df['bitis_durak_no'].astype(str)]).unique()
        le_durak.fit(tum_duraklar)

        df['hat_enc'] = le_hat.fit_transform(df['ana_hat_no'].astype(str))
        df = df[df['baslangic_durak_no'].astype(str).isin(tum_duraklar)]
        df = df[df['bitis_durak_no'].astype(str).isin(tum_duraklar)]

        df['bas_durak_enc'] = le_durak.transform(df['baslangic_durak_no'].astype(str))
        df['bit_durak_enc'] = le_durak.transform(df['bitis_durak_no'].astype(str))

        if XGBRegressor:
            X = df[['hat_enc', 'bas_durak_enc', 'bit_durak_enc', 'saat', 'gun']]
            y = df['sure']
            self.xgb_model = XGBRegressor(n_estimators=100, max_depth=5)
            self.xgb_model.fit(X, y)
            self.xgb_model.save_model(self.xgb_path)

        self.label_encoders = {'le_hat': le_hat, 'le_durak': le_durak}
        joblib.dump({'encoders': self.label_encoders, 'scaler': self.scaler}, self.artifacts_path)
        return "Eğitim Tamamlandı"

    def predict_duration(self, hat_no, durak_a, durak_b, saat, gun, recent_delays=None):
        if not self.xgb_model or not self.label_encoders: return 60
        try:
            hat_enc = self.label_encoders['le_hat'].transform([str(hat_no)])[0]
            bas_enc = self.label_encoders['le_durak'].transform([str(durak_a)])[0]
            bit_enc = self.label_encoders['le_durak'].transform([str(durak_b)])[0]

            pred = self.xgb_model.predict(pd.DataFrame([[hat_enc, bas_enc, bit_enc, saat, gun]],
                                                       columns=['hat_enc', 'bas_durak_enc', 'bit_durak_enc', 'saat',
                                                                'gun']))[0]
            return max(30, round(pred))
        except:
            return 60


# --- SINGLETON ---
demand_predictor = DemandPredictor()
travel_predictor = TravelTimePredictor()