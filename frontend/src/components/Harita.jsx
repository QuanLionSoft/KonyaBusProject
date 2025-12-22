import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'bootstrap/dist/css/bootstrap.min.css';

// --- İKON OLUŞTURUCULAR ---

// 1. Otobüs İkonu
const createBusIcon = (isEkSefer) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="bus-marker-container">
                <div class="marker-ring ${isEkSefer ? 'red' : ''}"></div>
                <div class="${isEkSefer ? 'marker-pin-red' : 'marker-pin-blue'}">
                    🚌
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -25]
    });
};

// 2. Durak İkonu (Turuncu)
const createStopIcon = () => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="stop-marker-container">
                <div class="stop-marker-pin">D</div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -20]
    });
};

// Haritayı yumuşakça ortala
const RecenterAutomatically = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) map.flyTo([lat, lng], 14, { duration: 1.5 });
    }, [lat, lng, map]);
    return null;
};

const Harita = () => {
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");
    const [rota, setRota] = useState([]);
    const [duraklar, setDuraklar] = useState([]);
    const [merkez, setMerkez] = useState([37.8716, 32.4851]);
    const [otobusler, setOtobusler] = useState([]);
    const [gunlukTarife, setGunlukTarife] = useState([]);

    // UI State
    const [panelAcik, setPanelAcik] = useState(true);

    // 1. Hat Listesini Çek
    useEffect(() => {
        axios.get('http://127.0.0.1:8000/api/hatlar/').then(res => setHatlar(res.data));
    }, []);

    // 2. Seçili Hattın Detaylarını Bul
    const seciliHatBilgisi = useMemo(() => {
        return hatlar.find(h => h.id.toString() === seciliHat.toString());
    }, [seciliHat, hatlar]);

    // 3. Hat Seçilince Verileri Çek
    useEffect(() => {
        if (seciliHat) {
            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/rota/`).then(res => {
                if(res.data.length > 0) { setRota(res.data); setMerkez(res.data[0]); }
            });
            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/duraklar/`).then(res => setDuraklar(res.data));
            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/gunluk_tarife/`).then(res => setGunlukTarife(res.data));
            setOtobusler([]);
        }
    }, [seciliHat]);

    // 4. Canlı Takip
    useEffect(() => {
        if (!seciliHat) return;
        const fetchBus = () => {
            axios.get(`http://127.0.0.1:8000/api/simulasyon/aktif-otobusler/?hat_id=${seciliHat}`)
                .then(res => setOtobusler(res.data || []))
                .catch(e => console.error(e));
        };
        fetchBus();
        const interval = setInterval(fetchBus, 2000);
        return () => clearInterval(interval);
    }, [seciliHat]);

    return (
        <div className="position-relative w-100 vh-100 overflow-hidden bg-light">

            {/* HARİTA */}
            <MapContainer center={merkez} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <RecenterAutomatically lat={merkez[0]} lng={merkez[1]} />

                {/* Rota */}
                {rota.length > 0 && <Polyline positions={rota} color="#3b82f6" weight={6} opacity={0.6} lineCap="round" />}

                {/* DURAKLAR */}
                {duraklar.map(durak => (
                    <Marker
                        key={durak.id}
                        position={[durak.durak.enlem, durak.durak.boylam]}
                        icon={createStopIcon()}
                    >
                        <Popup>
                            <div className="text-center p-1">
                                {/* HAT BİLGİSİ */}
                                {seciliHatBilgisi && (
                                    <div className="mb-2 pb-1 border-bottom">
                                        <div className="badge bg-primary fs-6 mb-1">
                                            Hat {seciliHatBilgisi.ana_hat_no}
                                        </div>
                                        <div className="fw-bold text-primary small text-uppercase">
                                            {seciliHatBilgisi.ana_hat_adi}
                                        </div>
                                    </div>
                                )}

                                {/* DURAK İSMİ (İstikamet varsa onu kullan, yoksa kodu yaz) */}
                                <h6 className="fw-bold mb-0 text-dark">
                                    🚏 {durak.istikamet ? durak.istikamet : durak.durak.durak_adi}
                                </h6>
                                <small className="text-muted">Durak No: {durak.durak.durak_no}</small>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* CANLI OTOBÜSLER */}
                {otobusler.map(bus => (
                    <Marker
                        key={bus.id}
                        position={[bus.enlem, bus.boylam]}
                        icon={createBusIcon(bus.durum === 'kritik' || bus.id.includes('EK'))}
                    >
                        <Popup>
                            <div className="text-center">
                                <h6 className="fw-bold mb-1">
                                    {bus.durum === 'kritik' ?
                                        <span className="text-danger">🚨 EK SEFER</span> :
                                        <span className="text-primary">🚌 Hat {bus.arac_no}</span>
                                    }
                                </h6>
                                <hr className="my-1"/>
                                <div className="text-start small">
                                    <div className="text-muted">İstikamet:</div>
                                    <strong className="d-block text-dark mb-1">👉 {bus.hedef_durak}</strong>
                                    <div className="text-muted">Tahmini Varış:</div>
                                    <span className="badge bg-success">{bus.kalan_sure_dk} dk</span>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* ÜST PANEL */}
            <div className="position-absolute top-0 start-0 p-3" style={{ zIndex: 1000, maxWidth: '400px' }}>
                <div className="bg-white p-2 rounded-4 shadow-lg d-flex align-items-center gap-2 border">
                    <span className="fs-3 ms-2">🚍</span>
                    <select
                        className="form-select border-0 fw-bold shadow-none bg-transparent"
                        value={seciliHat}
                        onChange={(e) => setSeciliHat(e.target.value)}
                    >
                        <option value="">Hat Seçiniz...</option>
                        {hatlar.map(h => (
                            <option key={h.id} value={h.id}>{h.ana_hat_no} - {h.ana_hat_adi}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* PANEL BUTONU */}
            {seciliHat && (
                <button
                    className="position-absolute top-0 end-0 m-3 btn btn-light rounded-circle shadow-lg d-flex align-items-center justify-content-center border"
                    style={{ zIndex: 1100, width: '50px', height: '50px' }}
                    onClick={() => setPanelAcik(!panelAcik)}
                >
                    <span className="fs-4">{panelAcik ? '✖' : '📋'}</span>
                </button>
            )}

            {/* SAĞ PANEL */}
            {seciliHat && (
                <div
                    className={`position-absolute top-0 end-0 h-100 bg-white shadow-lg transition-transform`}
                    style={{
                        zIndex: 1000,
                        width: '320px',
                        transform: panelAcik ? 'translateX(0)' : 'translateX(100%)',
                        transition: 'transform 0.3s ease-in-out',
                        paddingTop: '70px'
                    }}
                >
                    <div className="d-flex flex-column h-100">
                        <div className="px-3 pb-2 border-bottom">
                            <h6 className="fw-bold text-primary mb-0">Canlı Sefer Tablosu</h6>
                            <small className="text-muted">{gunlukTarife.length} planlı sefer</small>
                        </div>

                        <div className="flex-grow-1 overflow-auto px-2 py-2">
                            {gunlukTarife.map((sefer, idx) => {
                                const isEk = sefer.tip === 'Ek Sefer';
                                const now = new Date();
                                const [h, m] = sefer.saat.split(':');
                                const seferZamani = new Date(); seferZamani.setHours(h, m, 0);
                                const farkDk = (now - seferZamani) / 60000;
                                const isLive = farkDk >= 0 && farkDk <= 60;

                                return (
                                    <div key={idx} className={`p-2 mb-2 rounded border-start border-4 ${isLive ? 'bg-success bg-opacity-10 border-success shadow-sm' : (isEk ? 'bg-danger bg-opacity-10 border-danger' : 'border-light bg-light')}`}>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <span className={`badge ${isEk ? 'bg-danger' : 'bg-primary'} me-2`}>
                                                    {sefer.saat}
                                                </span>
                                                <span className="fw-bold small text-dark">
                                                    {isEk ? 'EK SEFER' : sefer.alt_hat}
                                                </span>
                                            </div>
                                            {isLive && <div className="spinner-grow spinner-grow-sm text-success" role="status"></div>}
                                        </div>
                                        {isLive && <small className="text-success d-block mt-1 ms-1">● Şu an yolda</small>}
                                    </div>
                                );
                            })}
                            {gunlukTarife.length === 0 && <div className="text-center mt-5 text-muted">Sefer verisi yok.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Harita;