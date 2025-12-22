import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const Dashboard = () => {
    // --- STATE ---
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");
    const [tahminVerisi, setTahminVerisi] = useState(null);
    const [donem, setDonem] = useState('daily'); // daily, weekly, monthly, yearly
    const [loading, setLoading] = useState(false);

    // İstatistikler (Mock veya Hesaplanan)
    const [stats, setStats] = useState({ toplamSefer: 0, aktifArac: 0, yolcuTahmini: 0 });

    useEffect(() => {
        axios.get(`${API_BASE_URL}/hatlar/`).then(res => setHatlar(res.data || []));
    }, []);

    const veriGetir = (hatId, periyot) => {
        if (!hatId) return;
        setLoading(true);
        setTahminVerisi(null);

        axios.get(`${API_BASE_URL}/predict-demand/${hatId}/`, { params: { period: periyot } })
            .then(res => {
                if (res.data && res.data.predictions) {
                    setTahminVerisi(res.data.predictions);
                    // Basit istatistik hesapla
                    const vals = Object.values(res.data.predictions);
                    const toplam = vals.reduce((a, b) => a + b, 0);
                    setStats(prev => ({ ...prev, yolcuTahmini: Math.round(toplam) }));
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    const handleHatChange = (e) => {
        const id = e.target.value;
        setSeciliHat(id);
        const hat = hatlar.find(h => h.id.toString() === id);
        if (hat) {
            veriGetir(hat.ana_hat_no, donem);
            // Hat değişince aktif araç sayısı simülasyonu (Fake data yerine API çağrılabilir)
            setStats(prev => ({ ...prev, aktifArac: Math.floor(Math.random() * 10) + 1 }));
        }
    };

    const handleDonemChange = (yeniDonem) => {
        setDonem(yeniDonem);
        const hat = hatlar.find(h => h.id.toString() === seciliHat);
        if (hat) veriGetir(hat.ana_hat_no, yeniDonem);
    };

    return (
        <div className="d-flex bg-light min-vh-100 font-sans">
            {/* SIDEBAR (SOL MENÜ) */}
            <div className="bg-dark text-white p-3 d-flex flex-column" style={{width: '250px', minHeight: '100vh'}}>
                <h4 className="fw-bold mb-4 text-center text-primary">🚍 KONYA ULAŞIM</h4>
                <div className="nav flex-column gap-2">
                    <button className="btn btn-primary text-start fw-bold">📊 Dashboard</button>
                    <button className="btn btn-outline-secondary text-start border-0 text-white disabled">🗺️ Canlı Harita</button>
                    <button className="btn btn-outline-secondary text-start border-0 text-white disabled">🚌 Hat Yönetimi</button>
                    <div className="mt-auto text-muted small text-center pt-4 border-top border-secondary">
                        v2.0.0 PRO Sürüm
                    </div>
                </div>
            </div>

            {/* ANA İÇERİK */}
            <div className="flex-grow-1 p-4">
                {/* ÜST İSTATİSTİK KARTLARI */}
                <div className="row g-4 mb-4">
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div className="card-body d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="text-muted fw-bold mb-1">TOPLAM HAT</h6>
                                    <h2 className="mb-0 fw-bold text-dark">{hatlar.length}</h2>
                                </div>
                                <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary">
                                    <i className="bi bi-diagram-3 fs-3"></i> 🚏
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div className="card-body d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="text-muted fw-bold mb-1">TAHMİNİ AKTİF ARAÇ</h6>
                                    <h2 className="mb-0 fw-bold text-success">{stats.aktifArac}</h2>
                                </div>
                                <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success">
                                    <i className="bi bi-bus-front fs-3"></i> 🚌
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div className="card-body d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="text-muted fw-bold mb-1">ÖNGÖRÜLEN YOLCU</h6>
                                    <h2 className="mb-0 fw-bold text-warning">{stats.yolcuTahmini > 0 ? stats.yolcuTahmini : '-'}</h2>
                                </div>
                                <div className="bg-warning bg-opacity-10 p-3 rounded-circle text-warning">
                                    <i className="bi bi-people fs-3"></i> 👥
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ANA GRAFİK ALANI */}
                <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
                    <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
                        <div>
                            <h5 className="mb-0 fw-bold text-dark">🔮 Prophet Yapay Zeka Analizi</h5>
                            <small className="text-muted">Gelecek yolcu talebi tahmini ve trend analizi</small>
                        </div>

                        {/* FİLTRE BUTONLARI */}
                        <div className="d-flex gap-2">
                             <select className="form-select fw-bold border-secondary bg-light" onChange={handleHatChange} value={seciliHat} style={{width:'200px'}}>
                                <option value="">Hat Seçiniz...</option>
                                {hatlar.map(h => <option key={h.id} value={h.id}>{h.ana_hat_no} - {h.ana_hat_adi}</option>)}
                            </select>
                            <div className="btn-group shadow-sm">
                                {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                                    <button
                                        key={p}
                                        className={`btn fw-bold ${donem === p ? 'btn-dark' : 'btn-outline-secondary'}`}
                                        onClick={() => handleDonemChange(p)}
                                    >
                                        {p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card-body p-4 bg-light">
                        {!seciliHat && (
                            <div className="d-flex flex-column align-items-center justify-content-center text-muted py-5">
                                <span style={{fontSize: '3rem'}}>👈</span>
                                <h5 className="mt-3">Lütfen analiz etmek için yukarıdan bir hat seçiniz.</h5>
                            </div>
                        )}

                        {loading && (
                            <div className="d-flex flex-column align-items-center justify-content-center py-5">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="mt-3 fw-bold text-primary">Yapay Zeka Modeli Çalışıyor...</p>
                            </div>
                        )}

                        {!loading && tahminVerisi && (
                            <div style={{height: '350px', position: 'relative'}}>
                                {/* PROPHET GRAFİĞİ SİMÜLASYONU (CSS İLE) */}
                                <div className="h-100 w-100 d-flex align-items-end justify-content-between px-2 gap-1">
                                    {Object.entries(tahminVerisi).map(([tarih, deger], idx) => {
                                        const maxVal = Math.max(...Object.values(tahminVerisi));
                                        const yukseklik = (deger / maxVal) * 100;

                                        // Etiketleme
                                        let etiket = tarih;
                                        const d = new Date(tarih);
                                        if(donem === 'daily') etiket = `${d.getHours()}:00`;
                                        else if(donem === 'weekly') etiket = d.toLocaleDateString('tr-TR', {weekday:'short'});
                                        else if(donem === 'monthly') etiket = d.getDate();
                                        else etiket = d.toLocaleDateString('tr-TR', {month:'short'});

                                        return (
                                            <div key={idx} className="flex-fill d-flex flex-column justify-content-end align-items-center group">
                                                {/* Tooltip Effect */}
                                                <div
                                                    className="bg-primary rounded-top opacity-75 shadow-sm"
                                                    style={{
                                                        height: `${yukseklik}%`,
                                                        width: '70%',
                                                        transition: 'all 0.5s ease',
                                                        minHeight: '5px'
                                                    }}
                                                    title={`${tarih}: ${Math.round(deger)} Yolcu`}
                                                ></div>
                                                <small className="text-muted mt-2 fw-bold" style={{fontSize: '10px', transform: 'rotate(-45deg)', whiteSpace:'nowrap'}}>
                                                    {etiket}
                                                </small>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;