import pandas as pd
import numpy as np
import os
import joblib
import glob
from prophet import Prophet
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from datetime import datetime

# Dizin Ayarları
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
DATA_PATH_VARIS = os.path.join(PROJECT_ROOT, 'veri_seti', 'otobusdurakvaris01.csv')
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')
MODEL_DIR = os.path.join(CURRENT_DIR, 'saved_models')

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)


# --- PROPHET MODELİ (AGGREGATION DESTEKLİ) ---
class DemandPredictor:
    def __init__(self):
        self.models = {}

    def train_model(self, hat_no):
        try:
            # Tüm elkart dosyalarını bul ve birleştir
            dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
            if not dosyalar: return None

            df_list = []
            for dosya in dosyalar:
                try:
                    with open(dosya, 'r', encoding='utf-8') as f:
                        ayirici = ';' if ';' in f.readline() else ','
                    temp_df = pd.read_csv(dosya, sep=ayirici, encoding='utf-8')
                    temp_df.columns = [c.strip().upper().replace('İ', 'I').replace(' ', '_') for c in temp_df.columns]

                    for col in temp_df.columns:
                        if 'BINIS' in col or 'BİNİŞ' in col: temp_df.rename(columns={col: 'y'}, inplace=True)
                    if 'TARIH' in temp_df.columns: temp_df.rename(columns={'TARIH': 'ds_date'}, inplace=True)
                    if 'SAAT' in temp_df.columns: temp_df.rename(columns={'SAAT': 'ds_hour'}, inplace=True)

                    if 'HAT_NO' in temp_df.columns and 'y' in temp_df.columns:
                        df_list.append(temp_df[['HAT_NO', 'ds_date', 'ds_hour', 'y']])
                except:
                    pass

            if not df_list: return "Veri yok."
            df = pd.concat(df_list, ignore_index=True)

            df = df[df['HAT_NO'] == hat_no].copy()
            if df.empty: return f"Hat {hat_no} verisi yok."

            df['ds_str'] = df['ds_date'].astype(str) + ' ' + df['ds_hour'].astype(str) + ':00'
            df['ds'] = pd.to_datetime(df['ds_str'], dayfirst=True, errors='coerce')
            df = df.dropna(subset=['ds']).groupby('ds')['y'].sum().reset_index().sort_values('ds')

            model = Prophet(yearly_seasonality=True, daily_seasonality=True)
            model.add_country_holidays(country_name='TR')
            model.fit(df)

            joblib.dump(model, os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl'))
            self.models[hat_no] = model
            return f"Hat {hat_no} eğitildi."
        except Exception as e:
            print(f"Hata: {e}")
            return None

    def predict(self, hat_no, hours=24, agg='hour'):
        model_path = os.path.join(MODEL_DIR, f'prophet_hat_{hat_no}.pkl')
        if hat_no not in self.models:
            if os.path.exists(model_path):
                self.models[hat_no] = joblib.load(model_path)
            else:
                return None

        model = self.models[hat_no]

        # 1. Her zaman saatlik tahmin üret (En hassas veri)
        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        future_dates = pd.date_range(start=now, periods=hours, freq='h')
        future = pd.DataFrame({'ds': future_dates})

        forecast = model.predict(future)
        result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()

        # 2. İstenen formata göre topla (Aggregation)
        if agg == 'day':
            # Günlük Toplam
            result = result.resample('D', on='ds').sum().reset_index()
        elif agg == 'month':
            # Aylık Toplam (Yıllık görünüm için) - 'MS' Month Start kullanıyoruz
            result = result.resample('MS', on='ds').sum().reset_index()

        # Negatif değerleri sıfırla
        result['yhat'] = result['yhat'].clip(lower=0)
        result['yhat_lower'] = result['yhat_lower'].clip(lower=0)
        result['yhat_upper'] = result['yhat_upper'].clip(lower=0)

        return result.to_dict('records')


# --- LSTM MODELİ ---
class TravelTimeLSTM:
    # (LSTM kodları aynı kalacak, önceki Turn'deki ile aynı)
    def __init__(self):
        self.model = None
        self.scaler_y = MinMaxScaler(feature_range=(0, 1))
        self.le_hat = LabelEncoder()
        self.le_durak = LabelEncoder()
        self.model_path = os.path.join(MODEL_DIR, 'lstm_travel_time.h5')
        self.encoders_path = os.path.join(MODEL_DIR, 'encoders.pkl')
        self.load_artifacts()

    # ... (LSTM metodlarının geri kalanı aynı) ...
    # (Kodun çok uzamaması için önceki cevaptaki LSTM kısmını buraya yapıştırabilirsiniz)
    def train_model(self):
        pass  # Önceki koddaki gibi doldurun

    def load_artifacts(self):
        if os.path.exists(self.model_path) and os.path.exists(self.encoders_path):
            try:
                self.model = load_model(self.model_path)
                artifacts = joblib.load(self.encoders_path)
                self.le_hat = artifacts['le_hat']
                self.le_durak = artifacts['le_durak']
                self.scaler_y = artifacts['scaler_y']
            except:
                pass

    def predict_segment(self, hat_no, durak_a, durak_b, saat, gun):
        return 60  # Basitleştirildi, önceki kodu kullanın


demand_predictor = DemandPredictor()
lstm_predictor = TravelTimeLSTM()