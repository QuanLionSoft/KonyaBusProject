import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import 'bootstrap/dist/css/bootstrap.min.css';

const Dashboard = () => {
    // --- STATE ---
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");
    const [tahminVerisi, setTahminVerisi] = useState([]);
    const [analizVerisi, setAnalizVerisi] = useState([]);
    const [loading, setLoading] = useState(false);

    // 1. Hat Listesini Çek
    useEffect(() => {
        axios.get('http://127.0.0.1:8000/api/hatlar/')
            .then(res => setHatlar(res.data))
            .catch(err => console.error("Hatlar alınamadı:", err));
    }, []);

    // 2. Hat Seçilince Verileri Getir
    useEffect(() => {
        if (seciliHat) {
            setLoading(true);
            const hatObj = hatlar.find(h => h.id.toString() === seciliHat);
            if (!hatObj) return;

            // A) Yapay Zeka Tahminlerini Çek (Prophet)
            axios.get(`http://127.0.0.1:8000/api/talep-tahmin/${hatObj.ana_hat_no}/`)
                .then(res => {
                    if (res.data.tahminler) {
                        const data = res.data.tahminler.map(item => ({
                            saat: new Date(item.ds).getHours() + ":00",
                            tahmin: Math.round(item.yhat),
                            ust_sinir: Math.round(item.yhat_upper)
                        }));
                        setTahminVerisi(data);
                    } else {
                        setTahminVerisi([]);
                    }
                })
                .catch(() => setTahminVerisi([]));

            // B) Kapasite Analizi (İzdiham Uyarıları)
            axios.get(`http://127.0.0.1:8000/api/analiz/kapasite/${hatObj.ana_hat_no}/`)
                .then(res => {
                    setAnalizVerisi(res.data.analiz || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [seciliHat]);

    // Kritik Saatleri Filtrele (Doluluk > %100)
    const kritikSaatler = analizVerisi.filter(a => a.doluluk_yuzdesi > 100);

    return (
        <div className="container-fluid p-4 bg-light min-vh-100">
            {/* ÜST BAR */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-0">📊 Akıllı Yönetim Paneli</h2>
                    <small className="text-muted">Konya Büyükşehir Belediyesi - Ulaşım Dairesi</small>
                </div>
                <div style={{ width: '300px' }}>
                    <select
                        className="form-select border-primary shadow-sm fw-bold"
                        value={seciliHat}
                        onChange={(e) => setSeciliHat(e.target.value)}
                    >
                        <option value="">Analiz İçin Hat Seçiniz...</option>
                        {hatlar.map(h => (
                            <option key={h.id} value={h.id}>
                                {h.ana_hat_no} - {h.ana_hat_adi}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {!seciliHat ? (
                <div className="alert alert-warning text-center p-5 shadow-sm rounded-4">
                    <h4>👈 Lütfen analiz etmek istediğiniz hattı yukarıdan seçiniz.</h4>
                </div>
            ) : (
                <div className="row g-4">

                    {/* 1. KART: ÖZET İSTATİSTİKLER */}
                    <div className="col-12">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <div className="p-3 bg-white shadow-sm rounded border-start border-5 border-primary">
                                    <h6 className="text-muted text-uppercase small ls-1">Planlanan Sefer</h6>
                                    <h2 className="fw-bold text-primary mb-0">
                                        {analizVerisi.reduce((acc, curr) => acc + curr.sefer_sayisi, 0)}
                                    </h2>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-3 bg-white shadow-sm rounded border-start border-5 border-success">
                                    <h6 className="text-muted text-uppercase small ls-1">Beklenen Yolcu</h6>
                                    <h2 className="fw-bold text-success mb-0">
                                        {analizVerisi.reduce((acc, curr) => acc + curr.ortalama_yolcu, 0)}
                                    </h2>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-3 bg-white shadow-sm rounded border-start border-5 border-danger">
                                    <h6 className="text-muted text-uppercase small ls-1">Riskli Saatler</h6>
                                    <h2 className="fw-bold text-danger mb-0">
                                        {kritikSaatler.length} Saat
                                    </h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. KART: YAPAY ZEKA GRAFİĞİ */}
                    <div className="col-lg-8">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white py-3">
                                <h6 className="fw-bold mb-0">📈 Gelecek 24 Saat Yolcu Tahmini (AI)</h6>
                            </div>
                            <div className="card-body">
                                {loading ? (
                                    <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
                                ) : tahminVerisi.length > 0 ? (
                                    <div style={{ width: '100%', height: 350 }}>
                                        <ResponsiveContainer>
                                            <AreaChart data={tahminVerisi}>
                                                <defs>
                                                    <linearGradient id="colorTahmin" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="saat" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                                                <Area
                                                    type="monotone"
                                                    dataKey="tahmin"
                                                    stroke="#8884d8"
                                                    fillOpacity={1}
                                                    fill="url(#colorTahmin)"
                                                    name="Tahmini Yolcu Sayısı"
                                                    strokeWidth={3}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="ust_sinir"
                                                    stroke="#82ca9d"
                                                    fill="transparent"
                                                    strokeDasharray="5 5"
                                                    name="Olası Üst Sınır"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="alert alert-secondary text-center m-4">
                                        Bu hat için henüz AI modeli eğitilmemiş.<br/>
                                        <small>Terminalden <code>python manage.py egit_yapayzeka</code> komutunu çalıştırın.</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. KART: KRİTİK UYARILAR (SAĞ TARAF) */}
                    <div className="col-lg-4">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-danger text-white py-3">
                                <h6 className="fw-bold mb-0">⚠️ Acil Müdahale Gerekenler</h6>
                            </div>
                            <div className="card-body p-0 overflow-auto" style={{ maxHeight: '400px' }}>
                                {kritikSaatler.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <span className="fs-1">✅</span>
                                        <p className="mt-2">İzdiham riski bulunmuyor.</p>
                                    </div>
                                ) : (
                                    <ul className="list-group list-group-flush">
                                        {kritikSaatler.map((k, i) => (
                                            <li key={i} className="list-group-item d-flex justify-content-between align-items-center p-3">
                                                <div>
                                                    <span className="badge bg-danger rounded-pill mb-1">Saat {k.saat}</span>
                                                    <div className="small text-muted">Yolcu: <strong>{k.ortalama_yolcu}</strong> / Kapasite: {k.kapasite}</div>
                                                </div>
                                                <div className="text-end text-danger fw-bold">
                                                    %{k.doluluk_yuzdesi}
                                                    <small className="d-block text-muted" style={{fontSize: '10px'}}>DOLULUK</small>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="card-footer bg-white text-center">
                                <small className="text-muted">Kapasite aşımı olan saatlere <strong>Ek Sefer</strong> eklenmelidir.</small>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Dashboard;