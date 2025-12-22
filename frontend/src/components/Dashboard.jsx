import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Bus, Users, TrendingUp, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [selectedLine, setSelectedLine] = useState('56-A');
  const [loading, setLoading] = useState(true);

  // Örnek Veri Seti (Backend bağlanana kadar placeholder)
  // Normalde burası Django API'den (ör: http://127.0.0.1:8000/api/predict/) gelecek.
  useEffect(() => {
    // API çağrısı simülasyonu
    const fetchData = async () => {
      setLoading(true);
      try {
        // const response = await fetch(`http://localhost:8000/api/forecast/?line=${selectedLine}`);
        // const result = await response.json();

        // Şimdilik sahte veri üretiyoruz:
        const mockData = [
          { date: '2025-12-01', gercekles: 1200, tahmin: 1150 },
          { date: '2025-12-02', gercekles: 1350, tahmin: 1380 },
          { date: '2025-12-03', gercekles: 1100, tahmin: 1120 },
          { date: '2025-12-04', gercekles: 1400, tahmin: 1390 },
          { date: '2025-12-05', gercekles: 1600, tahmin: 1550 },
          { date: '2025-12-06', gercekles: 900,  tahmin: 950 }, // Hafta sonu düşüşü
          { date: '2025-12-07', gercekles: 850,  tahmin: 870 },
        ];
        setData(mockData);
      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLine]);

  // Özet İstatistik Hesaplama (Basit KPI'lar)
  const totalPassenger = data.reduce((acc, curr) => acc + curr.gercekles, 0);
  const totalForecast = data.reduce((acc, curr) => acc + curr.tahmin, 0);
  const accuracy = data.length > 0 ? (100 - (Math.abs(totalPassenger - totalForecast) / totalPassenger * 100)).toFixed(2) : 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* --- Üst Başlık ve Filtreler --- */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Talep Tahmin Paneli</h1>
          <p className="text-gray-500 text-sm">Konya Otobüs Hatları Yolcu Tahminleme Sistemi</p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Hat Seçimi:</label>
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="56-A">56-A (Köprübaşı)</option>
            <option value="47-A">47-A (Meram)</option>
            <option value="64-B">64-B (Kampüs)</option>
          </select>
        </div>
      </div>

      {/* --- KPI Kartları --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Toplam Gerçekleşen Yolcu"
          value={totalPassenger.toLocaleString()}
          icon={<Users size={24} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Toplam Tahmin Edilen"
          value={totalForecast.toLocaleString()}
          icon={<TrendingUp size={24} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Model Doğruluğu"
          value={`%${accuracy}`}
          subText="Son 7 gün baz alındı"
          icon={<Bus size={24} className="text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      {/* --- Ana Grafik --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={20} />
          Tahmin vs. Gerçekleşen (Zaman Serisi)
        </h2>

        <div className="h-80 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">Yükleniyor...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGercek" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTahmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }}/>

                <Area
                  type="monotone"
                  dataKey="gercekles"
                  name="Gerçekleşen Yolcu"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGercek)"
                />
                <Area
                  type="monotone"
                  dataKey="tahmin"
                  name="Model Tahmini"
                  stroke="#10b981"
                  strokeDasharray="5 5" // Tahmin olduğu belli olsun diye kesik çizgi
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTahmin)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

// Yardımcı Alt Bileşen (Kart Yapısı)
const StatCard = ({ title, value, icon, color, subText }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-lg ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
    </div>
  </div>
);

export default Dashboard;