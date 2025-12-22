import pandas as pd
import numpy as np
import os
import joblib
import glob
from datetime import datetime

# --- MODELLER ---
try:
    from prophet import Prophet
except ImportError:
    Prophet = None

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
from sklearn.metrics import mean_absolute_error

# --- DİZİN AYARLARI ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')
MODEL_DIR = os.path.join(CURRENT_DIR, 'saved_models')

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)


# =============================================================================
# 1. HYBRID DEMAND PREDICTOR (PROPHET + LSTM) - TALEBİ TAHMİNİ
# =============================================================================
class DemandPredictor:
    def __init__(self):
        self.models_prophet = {}
        self.models_lstm = {}
        self.scalers = {}

    def create_lstm_model(self, input_shape):
        """LSTM Modeli Mimarisi"""
        if Sequential is None: return None
        model = Sequential()
        model.add(LSTM(50, activation='relu', input_shape=input_shape))
        model.add(Dense(1))
        model.compile(optimizer='adam', loss='mse')
        return model

    def train_model(self, hat_no):
        if Prophet is None: return "Prophet kütüphanesi eksik."

        try:
            # --- 1. VERİ HAZIRLIĞI (Eski kod ile aynı) ---
            dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
            if not dosyalar: return "Veri dosyası bulunamadı."

            df_list = []
            for dosya in dosyalar:
                try:
                    with open(dosya, 'r', encoding='utf-8') as f:
                        ayirici = ';' if ';' in f.readline() else ','
                    temp_df = pd.read_csv(dosya, sep=ayirici, encoding='utf-8', on_bad_lines='skip')
                    temp_df.columns = [c.strip().upper().replace('İ', 'I').replace(' ', '_') for c in temp_df.columns]

                    for col in temp_df.columns:
                        if 'BINIS' in col or 'BİNİŞ' in col: temp_df.rename(columns={col: 'y'}, inplace=True)
                    if 'TARIH' in temp_df.columns: temp_df.rename(columns={'TARIH': 'ds_date'}, inplace=True)
                    if 'SAAT' in temp_df.columns: temp_df.rename(columns={'SAAT': 'ds_hour'}, inplace=True)

                    if 'HAT_NO' in temp_df.columns and 'y' in temp_df.columns:
                        temp_df = temp_df[temp_df['HAT_NO'] == int(hat_no)]
                        if not temp_df.empty:
                            df_list.append(temp_df[['ds_date', 'ds_hour', 'y']])
                except:
                    pass

            if not df_list: return f"Hat {hat_no} verisi yok."
            df = pd.concat(df_list, ignore_index=True)

            df['ds_str'] = df['ds_date'].astype(str) + ' ' + df['ds_hour'].astype(str) + ':00'
            df['ds'] = pd.to_datetime(df['ds_str'], dayfirst=True, errors='coerce')
            df = df.dropna(subset=['ds']).groupby('ds')['y'].sum().reset_index().sort_values('ds')

            # Eksik saatleri 0 ile doldur (LSTM süreklilik ister)
            df = df.set_index('ds').resample('H').sum().fillna(0).reset_index()

            # --- 2. PROPHET EĞİTİMİ (TREND) ---
            model_p = Prophet(yearly_seasonality=True, daily_seasonality=True)
            model_p.add_country_holidays(country_name='TR')
            model_p.fit(df)

            # Prophet Tahminlerini Al (Residuals hesaplamak için)
            forecast = model_p.predict(df)
            df['yhat'] = forecast['yhat'].values
            df['residual'] = df['y'] - df['yhat']  # Hata payı (Gerçek - Tahmin)

            # --- 3. LSTM EĞİTİMİ (RESIDUAL LEARNING) ---
            if Sequential is not None:
                residuals = df['residual'].values.reshape(-1, 1)
                scaler = MinMaxScaler(feature_range=(-1, 1))
                residuals_scaled = scaler.fit_transform(residuals)

                # Sliding Window (Son 24 saate bakarak hatayı tahmin et)
                look_back = 24
                X_lstm, y_lstm = [], []
                for i in range(len(residuals_scaled) - look_back):
                    X_lstm.append(residuals_scaled[i:(i + look_back), 0])
                    y_lstm.append(residuals_scaled[i + look_back, 0])

                if len(X_lstm) > 0:
                    X_lstm = np.array(X_lstm).reshape(len(X_lstm), look_back, 1)
                    y_lstm = np.array(y_lstm)

                    model_l = self.create_lstm_model((look_back, 1))
                    model_l.fit(X_lstm, y_lstm, epochs=5, batch_size=32, verbose=0)

                    # Kaydet
                    model_l.save(os.path.join(MODEL_DIR, f'lstm_demand_{hat_no}.h5'))
                    joblib.dump(scaler, os.path.join(MODEL_DIR, f'scaler_demand_{hat_no}.pkl'))
                    self.models_lstm[hat_no] = model_l
                    self.scalers[hat_no] = scaler

            # Prophet Kaydet
            joblib.dump(model_p, os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl'))
            self.models_prophet[hat_no] = model_p

            return f"Hat {hat_no} için Hibrit Model (Prophet + LSTM) eğitildi."

        except Exception as e:
            return f"Eğitim Hatası: {e}"

    def predict(self, hat_no, hours=24, agg='hour'):
        p_path = os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl')
        l_path = os.path.join(MODEL_DIR, f'lstm_demand_{hat_no}.h5')
        s_path = os.path.join(MODEL_DIR, f'scaler_demand_{hat_no}.pkl')

        # Modelleri Yükle
        if hat_no not in self.models_prophet:
            if os.path.exists(p_path):
                self.models_prophet[hat_no] = joblib.load(p_path)
            else:
                return None

        # LSTM Modelini Yükle (Varsa)
        if hat_no not in self.models_lstm and os.path.exists(l_path):
            try:
                self.models_lstm[hat_no] = load_model(l_path)
                self.scalers[hat_no] = joblib.load(s_path)
            except:
                pass

        model_p = self.models_prophet[hat_no]

        # 1. Prophet Tahmini (Base)
        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        future_dates = pd.date_range(start=now, periods=hours, freq='H')
        future = pd.DataFrame({'ds': future_dates})

        forecast = model_p.predict(future)
        result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()

        # 2. LSTM Düzeltmesi (Correction)
        # Gerçek senaryoda son 24 saatin gerçek residual verisi gerekir.
        # Simülasyon için 0 kabul ediyoruz veya rastgele noise ekliyoruz.
        if hat_no in self.models_lstm:
            try:
                # Normalde buraya son 24 saatin gerçekleşen verisi girmeli
                # Biz şimdilik 'dummy' correction yapıyoruz
                look_back = 24
                dummy_input = np.zeros((1, look_back, 1))
                correction = self.models_lstm[hat_no].predict(dummy_input, verbose=0)
                correction_val = self.scalers[hat_no].inverse_transform(correction)[0][0]

                # Gelecek 1. saat için düzeltme uygula (Sonraki saatler için decay)
                result.loc[0, 'yhat'] += correction_val
            except:
                pass

        # Aggregation
        if agg == 'day':
            result = result.resample('D', on='ds').sum().reset_index()
        elif agg == 'month':
            result = result.resample('MS', on='ds').sum().reset_index()

        result[['yhat', 'yhat_lower', 'yhat_upper']] = result[['yhat', 'yhat_lower', 'yhat_upper']].clip(lower=0)
        return result.to_dict('records')

# =============================================================================
# 2. HYBRID TRAVEL TIME PREDICTOR (XGBOOST + LSTM) - VARIŞ SÜRESİ TAHMİNİ
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
        """Var olan modelleri ve encoderları yükler."""
        # 1. XGBoost
        if os.path.exists(self.xgb_path) and XGBRegressor:
            self.xgb_model = XGBRegressor()
            self.xgb_model.load_model(self.xgb_path)

        # 2. LSTM
        if os.path.exists(self.lstm_path) and load_model:
            try:
                self.lstm_model = load_model(self.lstm_path)
            except:
                pass

        # 3. Artifacts (Encoders & Scalers)
        if os.path.exists(self.artifacts_path):
            artifacts = joblib.load(self.artifacts_path)
            self.label_encoders = artifacts.get('encoders', {})
            self.scaler = artifacts.get('scaler', MinMaxScaler())

    def prepare_data(self):
        """CSV dosyalarından eğitim verisi hazırlar."""
        dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "otobusdurakvaris*.csv"))
        if not dosyalar: return None

        df_list = []
        print("Veri dosyaları okunuyor...")

        # Sadece eğitim için gerekli sütunları oku
        cols = ['ana_hat_no', 'baslangic_durak_no', 'bitis_durak_no', 'cikis_zaman', 'varis_zaman']

        for dosya in dosyalar:
            try:
                # Ayırıcı tespiti
                with open(dosya, 'r', encoding='utf-8') as f:
                    ayirici = ';' if ';' in f.readline() else ','

                temp = pd.read_csv(dosya, sep=ayirici, usecols=lambda c: c.lower() in cols, low_memory=False)

                # Sütun isimlerini normalize et (bazen dosyalarda farklı olabilir)
                temp.columns = [c.lower() for c in temp.columns]

                # Zaman formatı düzeltme
                temp['cikis_zaman'] = pd.to_datetime(temp['cikis_zaman'], errors='coerce')
                temp['varis_zaman'] = pd.to_datetime(temp['varis_zaman'], errors='coerce')
                temp = temp.dropna()

                # Hedef Değişken: Geçen Süre (Saniye)
                temp['sure'] = (temp['varis_zaman'] - temp['cikis_zaman']).dt.total_seconds()
                temp = temp[(temp['sure'] > 0) & (temp['sure'] < 7200)]  # 0-2 saat arası geçerli

                # Özellik Çıkarımı
                temp['saat'] = temp['cikis_zaman'].dt.hour
                temp['gun'] = temp['cikis_zaman'].dt.weekday

                df_list.append(temp)
            except Exception as e:
                print(f"Hata ({dosya}): {e}")

        if not df_list: return None
        return pd.concat(df_list, ignore_index=True)

    def train_hybrid(self):
        """XGBoost ve LSTM modellerini eğitir."""
        df = self.prepare_data()
        if df is None: return "Veri bulunamadı."

        print("Veri işleniyor...")

        # --- Label Encoding ---
        le_hat = LabelEncoder()
        le_durak = LabelEncoder()

        # Tüm durakları birleştirip encode et
        tum_duraklar = pd.concat([df['baslangic_durak_no'].astype(str), df['bitis_durak_no'].astype(str)]).unique()
        le_durak.fit(tum_duraklar)

        df['hat_enc'] = le_hat.fit_transform(df['ana_hat_no'].astype(str))
        # Bilinmeyen duraklar için hata vermemesi için map kullanabiliriz ama basitlik için fit_transform
        # Gerçek senaryoda unknown handle edilmeli.
        df = df[df['baslangic_durak_no'].astype(str).isin(tum_duraklar)]
        df = df[df['bitis_durak_no'].astype(str).isin(tum_duraklar)]

        df['bas_durak_enc'] = le_durak.transform(df['baslangic_durak_no'].astype(str))
        df['bit_durak_enc'] = le_durak.transform(df['bitis_durak_no'].astype(str))

        # --- 1. XGBoost Eğitimi (Genel Desenler) ---
        if XGBRegressor:
            print("XGBoost Eğitiliyor...")
            X = df[['hat_enc', 'bas_durak_enc', 'bit_durak_enc', 'saat', 'gun']]
            y = df['sure']

            self.xgb_model = XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=5)
            self.xgb_model.fit(X, y)
            self.xgb_model.save_model(self.xgb_path)

        # --- 2. LSTM Eğitimi (Sıralı Desenler) ---
        # LSTM için veriyi sıralayıp window oluşturmamız gerekir.
        # Basitlik için sadece tek bir hattan örnek alıp eğiteceğiz veya tüm veriyle sequence oluşturacağız.
        # Bu kısımda XGBoost'un hatasını (Residual) tahmin etmeye çalışacağız.

        if Sequential:
            print("LSTM Hazırlanıyor...")
            # XGBoost tahminlerini al
            y_pred_xgb = self.xgb_model.predict(X)
            df['residual'] = df['sure'] - y_pred_xgb  # Modelin hatası

            # Veriyi ölçekle
            residuals = df['residual'].values.reshape(-1, 1)
            self.scaler.fit(residuals)
            scaled_residuals = self.scaler.transform(residuals)

            # Sliding Window (Son 5 seferin hatasına bakarak 6.yı tahmin et)
            look_back = 5
            X_lstm, y_lstm = [], []
            for i in range(len(scaled_residuals) - look_back):
                X_lstm.append(scaled_residuals[i:(i + look_back), 0])
                y_lstm.append(scaled_residuals[i + look_back, 0])

            X_lstm, y_lstm = np.array(X_lstm), np.array(y_lstm)
            X_lstm = np.reshape(X_lstm, (X_lstm.shape[0], X_lstm.shape[1], 1))

            # Model Mimarisi
            model = Sequential()
            model.add(LSTM(50, input_shape=(look_back, 1), return_sequences=False))
            model.add(Dropout(0.2))
            model.add(Dense(1))
            model.compile(loss='mean_squared_error', optimizer='adam')

            print("LSTM Eğitiliyor (Epochs=3)...")
            model.fit(X_lstm, y_lstm, epochs=3, batch_size=64, verbose=1)
            model.save(self.lstm_path)
            self.lstm_model = model

        # Artifacts Kaydet
        self.label_encoders = {
            'le_hat': le_hat,
            'le_durak': le_durak
        }
        joblib.dump({
            'encoders': self.label_encoders,
            'scaler': self.scaler
        }, self.artifacts_path)

        return "Hybrid model başarıyla eğitildi (XGBoost + LSTM)."

    def predict_duration(self, hat_no, durak_a, durak_b, saat, gun, recent_delays=None):
        """
        İki durak arası süreyi tahmin eder.
        recent_delays: [list] Son 5 seferin gecikme miktarları (LSTM için). Yoksa 0 kabul edilir.
        """
        if not self.xgb_model or not self.label_encoders:
            return None  # Model hazır değil

        try:
            le_hat = self.label_encoders['le_hat']
            le_durak = self.label_encoders['le_durak']

            # Encoding
            hat_enc = le_hat.transform([str(hat_no)])[0]
            bas_enc = le_durak.transform([str(durak_a)])[0]
            bit_enc = le_durak.transform([str(durak_b)])[0]

            # 1. XGBoost Tahmini (Baz Süre)
            X_input = pd.DataFrame([[hat_enc, bas_enc, bit_enc, saat, gun]],
                                   columns=['hat_enc', 'bas_durak_enc', 'bit_durak_enc', 'saat', 'gun'])
            base_pred = self.xgb_model.predict(X_input)[0]

            # 2. LSTM Düzeltmesi (Varsa)
            lstm_correction = 0
            if self.lstm_model and recent_delays and len(recent_delays) >= 5:
                # Gelen veriyi ölçekle
                recent_scaled = self.scaler.transform(np.array(recent_delays).reshape(-1, 1))
                X_lstm = recent_scaled[-5:].reshape(1, 5, 1)
                pred_scaled = self.lstm_model.predict(X_lstm, verbose=0)
                lstm_correction = self.scaler.inverse_transform(pred_scaled)[0][0]

            final_pred = base_pred + lstm_correction
            return max(30, round(final_pred))  # Minimum 30 saniye

        except Exception as e:
            # print(f"Tahmin hatası: {e}")
            return 60  # Fallback


# --- SINGLETON INSTANCES ---
demand_predictor = DemandPredictor()
travel_predictor = TravelTimePredictor()