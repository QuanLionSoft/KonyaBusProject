import pandas as pd
import numpy as np
import os
import joblib
import glob
import xgboost as xgb
from prophet import Prophet
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Input
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from datetime import datetime, timedelta

# --- DİZİN AYARLARI ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
VERI_SETI_KLASORU = os.path.join(PROJECT_ROOT, 'veri_seti')
MODEL_DIR = os.path.join(CURRENT_DIR, 'saved_models')

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)


# =======================================================
# 1. HİBRİT TALEP TAHMİN MODELİ (Yolcu Sayısı: Prophet + XGB + LSTM)
# =======================================================
class HybridDemandPredictor:
    def __init__(self):
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.look_back = 24  # LSTM geçmiş 24 saate bakar

    def _get_data(self, hat_no):
        """Elkart verilerini okur ve saatlik yolcu sayısını çıkarır."""
        dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "elkart*.csv"))
        if not dosyalar: return None

        df_list = []
        for dosya in dosyalar:
            try:
                with open(dosya, 'r', encoding='utf-8') as f:
                    first_line = f.readline()
                    ayirici = ';' if ';' in first_line else ','

                temp_df = pd.read_csv(dosya, sep=ayirici, encoding='utf-8', on_bad_lines='skip')
                temp_df.columns = [c.strip().upper().replace('İ', 'I').replace(' ', '_') for c in temp_df.columns]

                binis_col = next((c for c in temp_df.columns if 'BINIS' in c or 'SAYI' in c), None)
                hat_col = next((c for c in temp_df.columns if 'HAT' in c and 'NO' in c and 'ALT' not in c), None)

                if binis_col and hat_col and 'TARIH' in temp_df.columns and 'SAAT' in temp_df.columns:
                    temp_df = temp_df[temp_df[hat_col] == int(hat_no)].copy()
                    if not temp_df.empty:
                        temp_df['ds_str'] = temp_df['TARIH'].astype(str) + ' ' + temp_df['SAAT'].astype(str) + ':00'
                        temp_df['ds'] = pd.to_datetime(temp_df['ds_str'], dayfirst=True, errors='coerce')
                        temp_df['y'] = temp_df[binis_col]
                        df_list.append(temp_df[['ds', 'y']])
            except Exception:
                continue

        if not df_list: return None
        df = pd.concat(df_list, ignore_index=True)
        df = df.dropna(subset=['ds'])
        df = df.groupby('ds')['y'].sum().reset_index()
        df = df.set_index('ds').resample('h').sum().reset_index()
        df['y'] = df['y'].fillna(0)
        return df.sort_values('ds')

    def train_hybrid(self, hat_no):
        """Prophet, XGBoost ve LSTM modellerini sırayla eğitir."""
        try:
            df = self._get_data(hat_no)
            if df is None or len(df) < 50: return "Yetersiz veri."

            # 1. Prophet Eğitimi
            prophet = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=True)
            prophet.add_country_holidays(country_name='TR')
            prophet.fit(df)
            joblib.dump(prophet, os.path.join(MODEL_DIR, f'prophet_{hat_no}.pkl'))

            # 2. XGBoost (Residual) Eğitimi
            forecast = prophet.predict(df)
            df['yhat_prophet'] = forecast['yhat'].values
            df['residual'] = df['y'] - df['yhat_prophet']
            df['hour'] = df['ds'].dt.hour
            df['day'] = df['ds'].dt.dayofweek
            df['month'] = df['ds'].dt.month

            xgb_model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
            xgb_model.fit(df[['hour', 'day', 'month']], df['residual'])
            xgb_model.save_model(os.path.join(MODEL_DIR, f'xgb_{hat_no}.json'))

            # 3. LSTM Eğitimi
            data = df['y'].values.reshape(-1, 1)
            scaled_data = self.scaler.fit_transform(data)
            joblib.dump(self.scaler, os.path.join(MODEL_DIR, f'scaler_{hat_no}.pkl'))

            X_lstm, y_lstm = [], []
            for i in range(self.look_back, len(scaled_data)):
                X_lstm.append(scaled_data[i - self.look_back:i, 0])
                y_lstm.append(scaled_data[i, 0])

            X_lstm, y_lstm = np.array(X_lstm), np.array(y_lstm)
            X_lstm = np.reshape(X_lstm, (X_lstm.shape[0], X_lstm.shape[1], 1))

            lstm_model = Sequential()
            lstm_model.add(Input(shape=(self.look_back, 1)))
            lstm_model.add(LSTM(units=50, return_sequences=True))
            lstm_model.add(LSTM(units=50))
            lstm_model.add(Dense(1))
            lstm_model.compile(loss='mean_squared_error', optimizer='adam')
            lstm_model.fit(X_lstm, y_lstm, epochs=5, batch_size=32, verbose=0)
            lstm_model.save(os.path.join(MODEL_DIR, f'lstm_{hat_no}.h5'))

            return f"Hat {hat_no} için Hibrit Model Başarıyla Eğitildi."
        except Exception as e:
            return f"Eğitim Hatası: {str(e)}"

    def predict_hybrid(self, hat_no, hours=24):
        """Gelecek n saati hibrit yöntemle tahmin eder."""
        try:
            p_path = os.path.join(MODEL_DIR, f'prophet_{hat_no}.pkl')
            x_path = os.path.join(MODEL_DIR, f'xgb_{hat_no}.json')
            l_path = os.path.join(MODEL_DIR, f'lstm_{hat_no}.h5')

            if not (os.path.exists(p_path) and os.path.exists(x_path) and os.path.exists(l_path)):
                return None

            prophet_model = joblib.load(p_path)
            xgb_model = xgb.XGBRegressor()
            xgb_model.load_model(x_path)
            lstm_model = load_model(l_path)
            scaler = joblib.load(os.path.join(MODEL_DIR, f'scaler_{hat_no}.pkl'))

            # Gelecek zaman dilimleri
            now = datetime.now().replace(minute=0, second=0, microsecond=0)
            future_dates = [now + timedelta(hours=x) for x in range(hours)]
            future_df = pd.DataFrame({'ds': future_dates})

            # 1. Prophet Tahmini
            forecast = prophet_model.predict(future_df)
            p_preds = forecast['yhat'].values

            # 2. XGBoost Tahmini
            future_df['hour'] = future_df['ds'].dt.hour
            future_df['dayofweek'] = future_df['ds'].dt.dayofweek
            future_df['month'] = future_df['ds'].dt.month
            x_preds = xgb_model.predict(
                future_df[['hour', 'dayofweek', 'month']])  # Sütun isimleri eğitimle aynı olmalı

            # 3. LSTM Tahmini (Simülasyon: Rolling Forecast)
            current_batch = np.zeros((1, self.look_back, 1))
            l_preds = []
            for i in range(hours):
                pred = lstm_model.predict(current_batch, verbose=0)[0, 0]
                l_preds.append(pred)
                current_batch = np.append(current_batch[:, 1:, :], [[[pred]]], axis=1)

            l_preds = scaler.inverse_transform(np.array(l_preds).reshape(-1, 1)).flatten()

            # Ensemble (Birleştirme)
            final_preds = []
            for i in range(hours):
                ensemble_val = ((p_preds[i] + x_preds[i]) * 0.7) + (l_preds[i] * 0.3)
                final_preds.append({
                    'ds': future_dates[i],
                    'yhat': max(0, round(ensemble_val)),
                    'detay': {
                        'prophet': round(p_preds[i], 1),
                        'lstm': round(l_preds[i], 1)
                    }
                })
            return final_preds
        except Exception as e:
            print(f"Tahmin hatası: {e}")
            return None


# =======================================================
# 2. SEYAHAT SÜRESİ TAHMİN MODELİ (OtobusDurakVaris Verileri)
# =======================================================
class TravelTimePredictor:
    def __init__(self):
        pass

    def _get_travel_data(self, hat_no):
        """otobusdurakvaris dosyalarından süre hesaplar."""
        dosyalar = glob.glob(os.path.join(VERI_SETI_KLASORU, "otobusdurakvaris*.csv"))
        if not dosyalar: return None

        df_list = []
        for dosya in dosyalar:
            try:
                # Chunksize ile büyük dosyaları parça parça oku
                for chunk in pd.read_csv(dosya, sep=';', chunksize=50000, on_bad_lines='skip', encoding='utf-8'):
                    chunk.columns = [c.strip().lower() for c in chunk.columns]

                    if 'ana_hat_no' in chunk.columns and 'cikis_zaman' in chunk.columns and 'varis_zaman' in chunk.columns:
                        chunk = chunk[chunk['ana_hat_no'] == int(hat_no)].copy()
                        if not chunk.empty:
                            chunk['cikis'] = pd.to_datetime(chunk['cikis_zaman'], errors='coerce')
                            chunk['varis'] = pd.to_datetime(chunk['varis_zaman'], errors='coerce')
                            chunk.dropna(subset=['cikis', 'varis'], inplace=True)

                            chunk['sure_sn'] = (chunk['varis'] - chunk['cikis']).dt.total_seconds()
                            chunk = chunk[(chunk['sure_sn'] > 60) & (
                                        chunk['sure_sn'] < 7200)]  # 1dk - 120dk arası mantıklı veriler

                            chunk['saat'] = chunk['cikis'].dt.hour
                            chunk['gun'] = chunk['cikis'].dt.dayofweek

                            df_list.append(chunk[['saat', 'gun', 'sure_sn']])
            except Exception as e:
                continue

        if not df_list: return None
        return pd.concat(df_list, ignore_index=True)

    def train_travel_model(self, hat_no):
        df = self._get_travel_data(hat_no)
        if df is None or len(df) < 50: return "Yetersiz seyahat verisi."

        # XGBoost ile Süre Tahmini
        X = df[['saat', 'gun']]
        y = df['sure_sn']

        model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
        model.fit(X, y)
        model.save_model(os.path.join(MODEL_DIR, f'travel_xgb_{hat_no}.json'))
        return "Seyahat Modeli Eğitildi."

    def predict_duration(self, hat_no, hour, day_of_week):
        model_path = os.path.join(MODEL_DIR, f'travel_xgb_{hat_no}.json')
        if not os.path.exists(model_path): return None

        model = xgb.XGBRegressor()
        model.load_model(model_path)

        pred_df = pd.DataFrame({'saat': [hour], 'gun': [day_of_week]})
        sure_sn = model.predict(pred_df)[0]
        return round(float(sure_sn / 60), 1)  # Dakika cinsinden


# Global Nesneler
hybrid_predictor = HybridDemandPredictor()
travel_predictor = TravelTimePredictor()