import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Bus, TrendingUp, Calendar, Activity, AlertCircle, BarChart3, Clock } from 'lucide-react';

const Dashboard = () => {
  // --- STATE TANIMLARI ---
  const [predictions, setPredictions] = useState([]);
  const [selectedLine, setSelectedLine] = useState('56'); // Varsayılan hat (Veri setinde olan bir hat seçin)
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, yearly
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, max: 0, avg: 0 });

  // --- API İSTEĞİ (GERÇEK VERİ) ---
  useEffect(() => {
    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      setPredictions([]); // Yeni istekte eski veriyi temizle

      try {
        // Django API adresin (urls.py ile uyumlu olmalı)
        const url = `http://127.0.0.1:8000/api/predict-demand/${selectedLine}/?period=${period}`;
        console.log("İstek atılıyor:", url);

        const response = await fetch(url);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Sunucu Hatası: ${response.status} - ${errText}`);
        }

        const result = await response.json();

        // Backend'den gelen veri yapısını kontrol et
        if (result.predictions && Array.isArray(result.predictions) && result.predictions.length > 0) {

          // Veriyi Grafik İçin Formatla
          const formattedData = result.predictions.map(item => {
            const dateObj = new Date(item.ds);
            return {
              fullDate: item.ds,
              // Grafikte görünecek eksen formatı (Periyoda göre değişir)
              displayDate: dateObj.toLocaleDateString('tr-TR', {
                month: period === 'yearly' ? 'long' : 'short',
                day: period === 'yearly' ? undefined : 'numeric',
                hour: period === 'daily' ? '2-digit' : undefined,
                minute: period === 'daily' ? '2-digit' : undefined,
                year: period === 'yearly' ? 'numeric' : undefined
              }),
              tahmin: Math.round(item.yhat), // Küsuratı at
              alt_sinir: Math.round(item.yhat_lower || 0),
              ust_sinir: Math.round(item.yhat_upper || 0)
            };
          });

          setPredictions(formattedData);

          // KPI Kartları İçin İstatistik Hesapla
          const total = formattedData.reduce((acc, curr) => acc + curr.tahmin, 0);
          const vals = formattedData.map(d => d.tahmin);
          const max = Math.max(...vals);
          const avg = Math.round(total / formattedData.length);

          setStats({ total, max, avg });

        } else {
          // Veri boş dönerse (Model henüz eğitilmemiş olabilir)
          setError("Bu hat için henüz yeterli tahmin verisi oluşturulamadı. Arka planda model eğitimi devam ediyor olabilir.");
        }

      } catch (err) {
        console.error("Dashboard Hatası:", err);
        setError("Veri sunucudan çekilemedi. Django terminalini kontrol edin.");
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [selectedLine, period]); // Hat veya Periyot değişince tekrar çalışır

  // --- BAŞLIK DÜZENLEYİCİ ---
  const getTitle = () => {
    switch(period) {
      case 'daily': return '24 Saatlik Anlık Tahmin';
      case 'weekly': return '7 Günlük Planlama';
      case 'monthly': return '30 Günlük Projeksiyon';
      case 'yearly': return 'Yıllık (12 Aylık) Uzun Vadeli Trend';
      default: return 'Talep Tahmini';
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">

      {/* --- HEADER ALANI --- */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <BarChart3 size={24} />
            </div>
            Akıllı Talep Tahmin Paneli
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-1">
            Hibrit Model (Prophet + XGBoost) Analiz Sonuçları
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Hat Filtresi */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center px-3 border border-slate-200">
            <span className="text-xs font-bold text-slate-400 mr-2">HAT:</span>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer py-1"
            >
              {/* Burayı veritabanındaki gerçek hat numaralarına göre düzenleyin */}
              <option value="56">56 - KÖPRÜBAŞI</option>
              <option value="47">47 - MERAM</option>
              <option value="64">64 - KAMPÜS</option>
              <option value="52">52 - SANAYİ</option>
            </select>
          </div>

          {/* Periyot Filtresi */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center px-3 border border-slate-200">
             <span className="text-xs font-bold text-slate-400 mr-2">SÜRE:</span>
             <select
               value={period}
               onChange={(e) => setPeriod(e.target.value)}
               className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer py-1"
             >
               <option value="daily">Günlük (Saatlik)</option>
               <option value="weekly">Haftalık (Günlük)</option>
               <option value="monthly">Aylık (30 Gün)</option>
               <option value="yearly">Yıllık (12 Ay)</option>
             </select>
          </div>
        </div>
      </div>

      {/* --- YÜKLENİYOR / HATA DURUMU --- */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-80 bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse">
          <Activity className="text-indigo-500 w-12 h-12 mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-slate-700">Yapay Zeka Modelleri Çalışıyor...</h3>
          <p className="text-slate-400 text-sm">Geçmiş veriler taranıyor ve tahmin oluşturuluyor.</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="text-red-600 w-6 h-6 mt-1" />
          <div>
            <h3 className="text-red-800 font-bold text-lg">Veri Analiz Hatası</h3>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* --- SONUÇ EKRANI (GRAFİK + KPI) --- */}
      {!loading && !error && predictions.length > 0 && (
        <>
          {/* KPI KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <StatsCard
              title="TOPLAM TAHMİNİ YOLCU"
              value={stats.total.toLocaleString('tr-TR')}
              subText={`Seçili dönem (${period}) toplamı`}
              icon={<Bus className="text-white" />}
              color="bg-gradient-to-r from-blue-500 to-blue-600"
            />
            <StatsCard
              title="EN YOĞUN ZAMAN"
              value={stats.max.toLocaleString('tr-TR')}
              subText="Yolcu / Sefer (Maksimum)"
              icon={<TrendingUp className="text-white" />}
              color="bg-gradient-to-r from-emerald-500 to-emerald-600"
            />
            <StatsCard
              title="ORTALAMA TALEP"
              value={stats.avg.toLocaleString('tr-TR')}
              subText="Dönem Ortalaması"
              icon={<Activity className="text-white" />}
              color="bg-gradient-to-r from-violet-500 to-violet-600"
            />
          </div>

          {/* ANA GRAFİK */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-slate-400" size={20}/>
                {getTitle()}
              </h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Tahmin
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/* Yıllık veride BarChart, diğerlerinde AreaChart daha şık durur */}
                {period === 'yearly' ? (
                  <BarChart data={predictions} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" tick={{fontSize: 12}} />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tahmin" fill="#6366f1" radius={[4, 4, 0, 0]} name="Yolcu" />
                  </BarChart>
                ) : (
                  <AreaChart data={predictions} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTahmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" tick={{fontSize: 12}} />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="tahmin"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#colorTahmin)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- YARDIMCI BİLEŞENLER ---

// Şık Tooltip Tasarımı
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100">
        <p className="text-slate-500 text-xs font-semibold mb-1">{label}</p>
        <p className="text-indigo-600 text-lg font-bold flex items-center gap-1">
          {payload[0].value.toLocaleString()}
          <span className="text-xs font-normal text-slate-400">Yolcu</span>
        </p>
      </div>
    );
  }
  return null;
};

// KPI Kart Tasarımı
const StatsCard = ({ title, value, subText, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between overflow-hidden relative group">
    <div className="z-10">
      <p className="text-slate-400 text-xs font-bold tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
        <Clock size={12} /> {subText}
      </p>
    </div>
    <div className={`p-4 rounded-xl shadow-lg ${color} group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
  </div>
);

export default Dashboard;