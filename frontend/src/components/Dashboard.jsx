import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Bus, TrendingUp, Calendar, Activity, AlertCircle, BarChart3, Clock, MapPin } from 'lucide-react';

const Dashboard = () => {
  // --- STATE TANIMLARI ---
  const [hatlar, setHatlar] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, yearly
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, max: 0, avg: 0 });

  // 1. Hat Listesini Çek (Dinamik Seçim İçin)
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/hatlar/')
      .then(res => {
        setHatlar(res.data);
        if (res.data.length > 0) setSelectedLine(res.data[0].ana_hat_no); // İlk hattı seç
      })
      .catch(err => console.error("Hatlar alınamadı:", err));
  }, []);


  // 2. Tahmin Verilerini Çek
  useEffect(() => {
    if (!selectedLine) return;

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      setPredictions([]);

      try {
        const url = `http://127.0.0.1:8000/api/predict-demand/${selectedLine}/?period=${period}`;
        console.log("İstek atılıyor:", url);

        const response = await fetch(url);

        if (!response.ok) {
           // Backend hatası varsa
           if(response.status === 404) {
               throw new Error("Bu hat için henüz yapay zeka modeli eğitilmemiş. Lütfen terminalden modeli eğitin.");
           }
           const errText = await response.text();
           throw new Error(`Sunucu Hatası: ${response.status}`);
        }

        const result = await response.json();

        if (result.predictions && Array.isArray(result.predictions) && result.predictions.length > 0) {
          // Veriyi Formatla
          const formattedData = result.predictions.map(item => {
            const dateObj = new Date(item.ds);
            return {
              fullDate: item.ds,
              displayDate: dateObj.toLocaleDateString('tr-TR', {
                month: period === 'yearly' ? 'long' : 'short',
                day: period === 'yearly' ? undefined : 'numeric',
                hour: period === 'daily' ? '2-digit' : undefined,
                minute: period === 'daily' ? '2-digit' : undefined,
              }),
              tahmin: Math.round(item.yhat),
            };
          });

          setPredictions(formattedData);

          // İstatistikleri Hesapla
          const total = formattedData.reduce((acc, curr) => acc + curr.tahmin, 0);
          const vals = formattedData.map(d => d.tahmin);
          const max = Math.max(...vals);
          const avg = Math.round(total / formattedData.length);

          setStats({ total, max, avg });
        } else {
           setError("Bu periyot için yeterli veri bulunamadı.");
        }

      } catch (err) {
        console.error("Hata:", err);
        setError(err.message || "Veri çekilemedi.");
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [selectedLine, period]);

  // Başlık Yardımcısı
  const getTitle = () => {
    switch(period) {
      case 'daily': return '24 Saatlik Anlık Tahmin';
      case 'weekly': return '7 Günlük Planlama';
      case 'monthly': return '30 Günlük Projeksiyon';
      case 'yearly': return 'Yıllık Trend Analizi';
      default: return 'Talep Tahmini';
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">

      {/* --- HEADER --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <BarChart3 size={28} strokeWidth={2.5} />
            </div>
            Yönetim Paneli
          </h1>
          <p className="text-slate-500 font-medium mt-2 ml-1 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            Yapay Zeka Destekli Talep Tahmin Sistemi
          </p>
        </div>

        <div className="flex flex-wrap gap-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
            {/* Hat Seçimi */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <select
                    value={selectedLine}
                    onChange={(e) => setSelectedLine(e.target.value)}
                    className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm hover:border-indigo-300 transition-all cursor-pointer outline-none appearance-none"
                >
                    <option value="" disabled>Hat Seçiniz</option>
                    {hatlar.map(h => (
                        <option key={h.id} value={h.ana_hat_no}>
                            Hat {h.ana_hat_no} - {h.ana_hat_adi}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>

            {/* Periyot Seçimi */}
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            period === p
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                        }`}
                    >
                        {p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* --- İÇERİK --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl shadow-sm border border-slate-100">
           <div className="relative">
             <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <Activity size={24} className="text-indigo-600" />
             </div>
           </div>
           <h3 className="text-lg font-bold text-slate-800 mt-6">Analiz Yapılıyor...</h3>
           <p className="text-slate-400 text-sm mt-1">AI modelleri verileri işliyor, lütfen bekleyin.</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-2xl mx-auto mt-10">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
             <AlertCircle className="text-red-600 w-8 h-8" />
          </div>
          <h3 className="text-red-900 font-bold text-xl mb-2">Veri Analiz Hatası</h3>
          <p className="text-red-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            Sayfayı Yenile
          </button>
        </div>
      ) : (
        <>
            {/* KPI KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatsCard
                    title="TOPLAM TAHMİNİ YOLCU"
                    value={stats.total.toLocaleString('tr-TR')}
                    subText={`Seçili periyot (${period}) toplamı`}
                    icon={<Bus className="w-6 h-6 text-white" />}
                    gradient="from-blue-500 to-indigo-600"
                    trend="+12%" // Örnek trend
                />
                <StatsCard
                    title="EN YOĞUN ZAMAN"
                    value={stats.max.toLocaleString('tr-TR')}
                    subText="Maksimum anlık yolcu sayısı"
                    icon={<TrendingUp className="w-6 h-6 text-white" />}
                    gradient="from-emerald-500 to-teal-600"
                    trend="Stabil"
                />
                <StatsCard
                    title="ORTALAMA TALEP"
                    value={stats.avg.toLocaleString('tr-TR')}
                    subText="Ortalama doluluk beklentisi"
                    icon={<Activity className="w-6 h-6 text-white" />}
                    gradient="from-violet-500 to-purple-600"
                    trend="-5%"
                />
            </div>

            {/* GRAFİK ALANI */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex justify-between items-end mb-8 relative z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            {getTitle()}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 font-medium">
                            Prophet Algoritması Tahmin Sonuçları
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-sm font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                        <Calendar size={14} />
                        {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                    </div>
                </div>

                {/* Dekoratif Arkaplan */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>

                <div className="h-[450px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        {period === 'yearly' ? (
                            <BarChart data={predictions} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#94a3b8"
                                    tick={{fontSize: 12, fontWeight: 600}}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tick={{fontSize: 12, fontWeight: 600}}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                                <Bar
                                    dataKey="tahmin"
                                    fill="url(#colorBar)"
                                    radius={[8, 8, 0, 0]}
                                    maxBarSize={60}
                                />
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8}/>
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        ) : (
                            <AreaChart data={predictions} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTahmin" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#94a3b8"
                                    tick={{fontSize: 12, fontWeight: 600}}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tick={{fontSize: 12, fontWeight: 600}}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="tahmin"
                                    stroke="#4f46e5"
                                    strokeWidth={4}
                                    fill="url(#colorTahmin)"
                                    activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }}
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

// --- BİLEŞENLER ---

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-sm bg-opacity-90">
        <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold flex items-end gap-1">
          {payload[0].value.toLocaleString()}
          <span className="text-sm font-medium text-slate-400 mb-1">Yolcu</span>
        </p>
      </div>
    );
  }
  return null;
};

const StatsCard = ({ title, value, subText, icon, gradient, trend }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
    <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
        </div>
        {trend && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.includes('+') ? 'bg-emerald-100 text-emerald-700' : (trend.includes('-') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}`}>
                {trend}
            </span>
        )}
    </div>

    <div className="relative z-10">
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        <p className="text-slate-400 text-xs font-bold tracking-wider mt-1 uppercase">{title}</p>
        <p className="text-slate-500 text-xs mt-3 font-medium flex items-center gap-1.5 bg-slate-50 w-fit px-2 py-1 rounded-md">
            <Clock size={12} /> {subText}
        </p>
    </div>

    {/* Arkaplan Efekti */}
    <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-300`}></div>
  </div>
);

export default Dashboard;