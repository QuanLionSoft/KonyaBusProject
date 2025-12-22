import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// --- İKON TANIMLAMALARI ---

// 1. Mavi Otobüs (Yolda - Aktif)
const busIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
});

// 2. Gri Otobüs (Bekleyen - Pasif)
const passiveBusIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2084/2084084.png',
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30],
    className: 'opacity-75' // Hafif şeffaf
});

// 3. Kırmızı Otobüs (Ek Sefer / Acil)
const urgentBusIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097144.png',
    iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40]
});

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Harita Odaklama Bileşeni
const MapRecenter = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, zoom); }, [center, zoom, map]);
    return null;
};

const Harita = () => {
    // --- STATE ---
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");
    const [rota, setRota] = useState([]);
    const [otobusler, setOtobusler] = useState([]); // Canlı Simülasyon Verisi
    const [duraklar, setDuraklar] = useState([]);   // Durak Noktaları
    const [tarifeListesi, setTarifeListesi] = useState([]); // Günlük Liste (Excel'den)

    const [merkez, setMerkez] = useState([37.8716, 32.4851]); // Konya
    const activeRef = useRef(null); // Otomatik kaydırma için

    // 1. Hatları Yükle
    useEffect(() => {
        axios.get(`${API_BASE_URL}/hatlar/`).then(res => setHatlar(res.data));
    }, []);

    // 2. Hat Değişince Verileri Çek
    const hatDegisti = (hatId) => {
        setSeciliHat(hatId);
        setOtobusler([]);
        setDuraklar([]);
        setTarifeListesi([]);

        if (!hatId) return;

        // A) Rotayı Çek
        axios.get(`${API_BASE_URL}/hatlar/${hatId}/rota/`).then(res => {
            if (res.data.length > 0) {
                setRota(res.data);
                setMerkez(res.data[Math.floor(res.data.length / 2)]);
            }
        });

        // B) Durakları Çek
        axios.get(`${API_BASE_URL}/hatlar/${hatId}/duraklar/`).then(res => setDuraklar(res.data));

        // C) GÜNLÜK TARİFE LİSTESİNİ ÇEK (Dosyadan okur)
        axios.get(`${API_BASE_URL}/hatlar/${hatId}/gunluk_tarife/`).then(res => {
            setTarifeListesi(res.data);
        });

        // D) Canlı Otobüsleri Çek
        verileriGuncelle(hatId);
    };

    // 3. Simülasyon Döngüsü
    const verileriGuncelle = (hatId) => {
        if (!hatId) return;
        axios.get(`${API_BASE_URL}/simulasyon/aktif-otobusler/`, { params: { hat_id: hatId } })
            .then(res => setOtobusler(res.data));
    };

    useEffect(() => {
        if (seciliHat) {
            const interval = setInterval(() => verileriGuncelle(seciliHat), 2000);
            return () => clearInterval(interval);
        }
    }, [seciliHat]);

    // 4. Listede Aktif Olana Otomatik Kaydır
    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [otobusler]);

    // --- YARDIMCI FONKSİYONLAR ---

    // Harita İkonunu Seç
    const getIcon = (durum) => {
        if (durum === 'aktif') return busIcon;       // Mavi
        if (durum === 'pasif') return passiveBusIcon; // Gri
        return urgentBusIcon;                        // Kırmızı (Kritik)
    };

    // Sağ Paneldeki Sefer Durumunu Belirle
    const getSeferDurumu = (saat) => {
        // 1. Bu saatte canlı (aktif) bir otobüs var mı?
        const aktifBus = otobusler.find(b => b.arac_no === saat && b.durum === 'aktif');
        if (aktifBus) return 'seferde';

        // 2. Bu saatte bekleyen (pasif) bir otobüs var mı?
        const pasifBus = otobusler.find(b => b.arac_no === saat && b.durum === 'pasif');
        if (pasifBus) return 'bekliyor_yakinda'; // Haritada görünüyor ama durakta

        // 3. Zaman kontrolü (Geçmiş mi Gelecek mi?)
        const simdi = new Date();
        const [h, m] = saat.split(':');
        const seferTarihi = new Date();
        seferTarihi.setHours(parseInt(h), parseInt(m), 0);

        if (simdi > seferTarihi) return 'tamamlandi';
        return 'gelecek'; // Henüz haritaya düşmedi
    };

    return (
        <div className="container-fluid p-3">
            <div className="row g-3">
                {/* SOL TARAFTA HARİTA */}
                <div className="col-lg-9 col-md-8">
                    {/* Üst Menü */}
                    <div className="card shadow-sm mb-3">
                        <div className="card-body py-2 d-flex align-items-center gap-3">
                            <h5 className="m-0 text-primary fw-bold">🗺️ Canlı Hat Takibi</h5>
                            <select
                                className="form-select w-auto fw-bold border-primary"
                                onChange={e => hatDegisti(e.target.value)}
                                value={seciliHat}
                            >
                                <option value="">Hat Seçiniz...</option>
                                {hatlar.map(h => (
                                    <option key={h.id} value={h.id}>
                                        {h.ana_hat_no} - {h.ana_hat_adi}
                                    </option>
                                ))}
                            </select>
                            {seciliHat && (
                                <span className="badge bg-success ms-auto fs-6">
                                    {otobusler.filter(o => o.durum === 'aktif').length} Araç Yolda
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Harita */}
                    <div className="card border-0 shadow-sm">
                        <MapContainer center={merkez} zoom={13} style={{height: "75vh", width: "100%"}}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                            <MapRecenter center={merkez} zoom={13}/>

                            {/* Rota */}
                            {rota.length > 0 && <Polyline positions={rota} color="#0d6efd" weight={5} opacity={0.6}/>}

                            {/* Duraklar */}
                            {duraklar.map((d, i) => (
                                <CircleMarker
                                    key={i}
                                    center={[d.durak.enlem, d.durak.boylam]}
                                    radius={4}
                                    pathOptions={{ color: 'gray', fillColor: 'white', fillOpacity: 1, weight: 1 }}
                                >
                                    <Popup><strong>{d.sira}. Durak</strong><br/>{d.durak.durak_adi}</Popup>
                                </CircleMarker>
                            ))}

                            {/* Otobüsler (Aktif ve Pasif) */}
                            {otobusler.map(b => (
                                <Marker
                                    key={b.id}
                                    position={[b.enlem, b.boylam]}
                                    icon={getIcon(b.durum)}
                                >
                                    <Popup>
                                        <div className="text-center">
                                            <strong className="text-primary">{b.arac_no}</strong><br/>
                                            <span className="badge bg-light text-dark border mb-1">{b.bilgi}</span><br/>
                                            {b.durum === 'pasif' ?
                                                <small className="text-muted">Kalkışa {b.kalan_sure_dk} dk</small> :
                                                <small className="text-success fw-bold">Varışa ~{b.kalan_sure_dk} dk</small>
                                            }
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* SAĞ PANEL: GÜNLÜK SEFER PANOSU */}
                <div className="col-lg-3 col-md-4">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-dark text-white fw-bold d-flex justify-content-between align-items-center">
                            <span>🕒 Günlük Sefer Panosu</span>
                            <span className="badge bg-light text-dark">{tarifeListesi.length}</span>
                        </div>

                        <div className="card-body p-0 bg-light" style={{maxHeight: '80vh', overflowY: 'auto'}}>
                            {!seciliHat ? (
                                <div className="p-4 text-center text-muted">Lütfen haritadan bir hat seçiniz.</div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {tarifeListesi.length === 0 && (
                                        <div className="p-4 text-center text-danger">
                                            ⚠️ Tarife dosyası okunamadı veya sefer bulunamadı.
                                        </div>
                                    )}

                                    {tarifeListesi.map((t, i) => {
                                        const durum = getSeferDurumu(t.saat);
                                        let stil = "bg-white";
                                        let ikon = "⏳";
                                        let yazi = "Bekliyor";

                                        if (durum === 'seferde') {
                                            stil = "bg-success text-white border-start border-5 border-warning shadow";
                                            ikon = "🚌";
                                            yazi = "SEFERDE";
                                        } else if (durum === 'bekliyor_yakinda') {
                                            stil = "bg-warning bg-opacity-25 text-dark border-start border-5 border-secondary";
                                            ikon = "🛑";
                                            yazi = "Durakta";
                                        } else if (durum === 'tamamlandi') {
                                            stil = "bg-light text-muted text-decoration-line-through opacity-50";
                                            ikon = "✅";
                                            yazi = "Bitti";
                                        }

                                        return (
                                            <div
                                                key={i}
                                                ref={durum === 'seferde' ? activeRef : null}
                                                className={`list-group-item d-flex justify-content-between align-items-center ${stil}`}
                                                style={{transition: 'all 0.3s ease'}}
                                            >
                                                <div className="d-flex align-items-center">
                                                    <span className="me-3 fs-5">{ikon}</span>
                                                    <div>
                                                        <span className="fs-5 fw-bold">{t.saat}</span>
                                                    </div>
                                                </div>

                                                {durum === 'seferde' ? (
                                                    <span className="badge bg-warning text-dark animate__animated animate__pulse animate__infinite">
                                                        {yazi}
                                                    </span>
                                                ) : (
                                                    <small style={{fontSize: '0.8rem'}}>{yazi}</small>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        {seciliHat && (
                            <div className="card-footer bg-white small text-muted text-center border-top">
                                * Veriler <strong>tarifeler.csv</strong> dosyasından çekilmektedir.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Harita;