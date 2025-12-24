import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Form, Button, Spinner } from 'react-bootstrap';
import { Bus, Navigation, Clock, MapPin } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';

// --- CSS STİLLERİ (Animasyonlar için) ---
const markerStyle = `
  .user-location-pulse {
    animation: pulse 2s infinite;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7);
  }
  @keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(13, 110, 253, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 110, 253, 0); }
  }
  .bus-marker-container { position: relative; width: 40px; height: 40px; }
  .marker-ring { position: absolute; top: -5px; left: -5px; width: 50px; height: 50px; border-radius: 50%; border: 3px solid #3b82f6; opacity: 0.5; animation: ripple 1.5s infinite; }
  .marker-ring.red { border-color: #ef4444; }
  .marker-pin-blue { background: #3b82f6; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 20px; z-index: 2; position: relative;}
  .marker-pin-red { background: #ef4444; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 20px; z-index: 2; position: relative;}
  @keyframes ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
  
  .stop-marker-pin { background: #f59e0b; color: white; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 4px rgba(0,0,0,0.3); border: 2px solid white; }
  .stop-marker-pin span { transform: rotate(45deg); font-weight: bold; font-size: 14px; }
`;

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

// 2. Durak İkonu
const createStopIcon = () => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="stop-marker-pin"><span>D</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
};

// 3. Kullanıcı Konum İkonu
// 3. Kullanıcı Konum İkonu (DÜZELTİLMİŞ HALİ)
const userIcon = L.divIcon({
    // HATA ÇÖZÜMÜ: İki sınıfı tek string içinde boşlukla birleştirdik
    className: 'custom-div-icon user-location-pulse',
    html: `<img src="https://cdn-icons-png.flaticon.com/512/149/149060.png" style="width:100%; height:100%; display:block;" />`,
    iconSize: [35, 35],
    iconAnchor: [17, 17]
});
// Harita Kontrolcüsü (Merkez ve Zoom değiştiğinde uçuş animasyonu yapar)
const MapController = ({ centerCoord, zoomLevel }) => {
    const map = useMap();
    useEffect(() => {
        if (centerCoord) {
            map.flyTo(centerCoord, zoomLevel || map.getZoom(), { duration: 1.5 });
        }
    }, [centerCoord, zoomLevel, map]);
    return null;
};

const Harita = () => {
    // --- STATE TANIMLARI ---
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");
    const [rota, setRota] = useState([]);
    const [duraklar, setDuraklar] = useState([]);
    const [merkez, setMerkez] = useState([37.8716, 32.4851]); // Konya
    const [zoom, setZoom] = useState(13);
    const [otobusler, setOtobusler] = useState([]);
    const [gunlukTarife, setGunlukTarife] = useState([]);

    // UI State
    const [panelAcik, setPanelAcik] = useState(true);
    const [loading, setLoading] = useState(false);

    // GPS ve Konum State'leri
    const [userPos, setUserPos] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(false);

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
            setLoading(true);
            setRota([]); setDuraklar([]); setOtobusler([]); setGunlukTarife([]);

            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/rota/`).then(res => {
                if(res.data.length > 0) {
                    setRota(res.data);
                    setMerkez(res.data[0]);
                    setZoom(13);
                }
            });
            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/duraklar/`).then(res => setDuraklar(res.data));
            axios.get(`http://127.0.0.1:8000/api/hatlar/${seciliHat}/gunluk_tarife/`).then(res => {
                setGunlukTarife(res.data);
                setLoading(false);
            });
        }
    }, [seciliHat]);

    // 4. Canlı Takip (Simülasyon)
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

    // --- FONKSİYONLAR ---

    // Konumumu Bul
    const handleFindLocation = () => {
        setGpsLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const newPos = [latitude, longitude];
                    setUserPos(newPos);
                    setMerkez(newPos);
                    setZoom(15);
                    setGpsLoading(false);
                },
                () => {
                    alert("Konum alınamadı. Lütfen GPS izni verin.");
                    setGpsLoading(false);
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Tarayıcınız konum servisini desteklemiyor.");
            setGpsLoading(false);
        }
    };

    // Listeden Sefer Tıklama (DÜZELTİLDİ: ARTIK FARKLI KONUMLARA GİDİYOR)
    const handleSeferClick = (index) => {
        if(otobusler.length > 0) {
            // Tıkladığımız satırın sırasına göre (modülo alarak) ilgili otobüsü seçiyoruz.
            // Örneğin: 1. satır -> 1. otobüs, 2. satır -> 2. otobüs, 3. satır -> 3. otobüs
            // 4. satır -> tekrar 1. otobüs (döngüsel)
            const busIndex = index % otobusler.length;
            const targetBus = otobusler[busIndex];

            setMerkez([targetBus.enlem, targetBus.boylam]);
            setZoom(16);

            // Mobildeysek paneli kapat
            if(window.innerWidth < 768) setPanelAcik(false);
        } else {
            alert("Bu sefer için aktif araç verisi şu an haritada görünmüyor.");
        }
    };

    return (
        <div className="position-relative w-100 vh-100 overflow-hidden bg-light">
            <style>{markerStyle}</style>

            {/* HARİTA */}
            <MapContainer center={merkez} zoom={zoom} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

                <MapController centerCoord={merkez} zoomLevel={zoom} />

                {rota.length > 0 && <Polyline positions={rota} color="#3b82f6" weight={6} opacity={0.6} lineCap="round" />}

                {userPos && (
                    <Marker position={userPos} icon={userIcon}>
                        <Popup>📍 Sizin Konumunuz</Popup>
                    </Marker>
                )}

                {duraklar.map(durak => (
                    <Marker
                        key={durak.id}
                        position={[durak.durak.enlem, durak.durak.boylam]}
                        icon={createStopIcon()}
                    >
                        <Popup>
                            <div className="text-center p-1">
                                <h6 className="fw-bold mb-0 text-dark">
                                    🚏 {durak.istikamet ? durak.istikamet : durak.durak.durak_adi}
                                </h6>
                                <small className="text-muted">Durak No: {durak.durak.durak_no}</small>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {otobusler.map(bus => (
                    <Marker
                        key={bus.id}
                        position={[bus.enlem, bus.boylam]}
                        icon={createBusIcon(bus.durum === 'kritik' || bus.id.includes('EK'))}
                    >
                        <Popup>
                            <div className="text-center">
                                <h6 className="fw-bold mb-1">
                                    {bus.id.includes('EK') ?
                                        <span className="badge bg-danger">EK - {bus.arac_no}</span> :
                                        <span className="badge bg-primary">HAT {seciliHatBilgisi?.ana_hat_no}</span>
                                    }
                                </h6>
                                <hr className="my-1"/>
                                <div className="text-start small">
                                    <strong className="d-block text-dark mb-1">👉 {bus.hedef_durak}</strong>
                                    <div className="text-muted">Tahmini Varış: <span className="text-success fw-bold">{bus.kalan_sure_dk} dk</span></div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* ÜST PANEL */}
            <div className="position-absolute top-0 start-0 p-3" style={{ zIndex: 1000, maxWidth: '400px', width: '100%' }}>
                <div className="bg-white p-2 rounded-4 shadow-lg d-flex align-items-center gap-2 border">
                    <div className="bg-primary text-white p-2 rounded-circle">
                        {loading ? <Spinner size="sm" animation="border"/> : <Bus size={20}/>}
                    </div>
                    <select
                        className="form-select border-0 fw-bold shadow-none bg-transparent"
                        value={seciliHat}
                        onChange={(e) => setSeciliHat(e.target.value)}
                        style={{cursor: 'pointer'}}
                    >
                        <option value="">Hat Seçiniz...</option>
                        {hatlar.map(h => (
                            <option key={h.id} value={h.id}>{h.ana_hat_no} - {h.ana_hat_adi}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KONUM BUTONU */}
            <Button
                variant="light"
                className="position-absolute shadow-lg rounded-circle d-flex align-items-center justify-content-center border-primary border-2"
                style={{ bottom: '30px', right: '20px', zIndex: 1000, width: '50px', height: '50px' }}
                onClick={handleFindLocation}
                title="Konumumu Göster"
            >
                {gpsLoading ? <Spinner animation="grow" size="sm" variant="primary" /> : <Navigation size={24} className="text-primary" />}
            </Button>

            {/* PANEL BUTONU */}
            {seciliHat && (
                <button
                    className="position-absolute top-0 end-0 m-3 btn btn-light rounded-circle shadow-lg d-flex align-items-center justify-content-center border"
                    style={{ zIndex: 1100, width: '45px', height: '45px' }}
                    onClick={() => setPanelAcik(!panelAcik)}
                >
                    <span className="fs-5">{panelAcik ? '✖' : '📋'}</span>
                </button>
            )}

            {/* SAĞ PANEL */}
            <div
                className={`position-absolute top-0 end-0 h-100 bg-white shadow-lg transition-transform`}
                style={{
                    zIndex: 1000,
                    width: '320px',
                    transform: (seciliHat && panelAcik) ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.3s ease-in-out',
                    paddingTop: '70px'
                }}
            >
                <div className="d-flex flex-column h-100">
                    <div className="px-3 pb-2 border-bottom bg-white">
                        <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                            <Clock size={18}/> Canlı Sefer Tablosu
                        </h6>
                        <small className="text-muted">{gunlukTarife.length} planlı sefer</small>
                    </div>

                    <div className="flex-grow-1 overflow-auto px-2 py-2 bg-light">
                        {gunlukTarife.map((sefer, idx) => {
                            const isEk = sefer.tip === 'Ek Sefer';
                            const now = new Date();
                            const [h, m] = sefer.saat.split(':');
                            const seferZamani = new Date(); seferZamani.setHours(h, m, 0);
                            const farkDk = (now - seferZamani) / 60000;
                            // Son 60 dk içinde kalkmış seferler "Yolda" kabul edilir
                            const isLive = farkDk >= 0 && farkDk <= 60;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => isLive && handleSeferClick(idx)} // <-- DÜZELTME BURADA: Index gönderiyoruz
                                    className={`p-2 mb-2 rounded border-start border-4 shadow-sm ${
                                        isLive ? 'bg-white border-success' : (isEk ? 'bg-white border-danger' : 'bg-white border-secondary')
                                    }`}
                                    style={{
                                        cursor: isLive ? 'pointer' : 'default',
                                        opacity: (!isLive && farkDk > 60) ? 0.6 : 1
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <span className={`badge ${isEk ? 'bg-danger' : 'bg-primary'} me-2`}>
                                                {sefer.saat}
                                            </span>
                                            <span className="fw-bold small text-dark">
                                                {isEk ? `EK (${sefer.alt_hat})` : sefer.alt_hat}
                                            </span>
                                        </div>
                                        {isLive && (
                                            <div className="d-flex align-items-center gap-1 text-success">
                                                <small className="fw-bold blink-text" style={{fontSize:'0.7rem'}}>YOLDA</small>
                                                <div className="spinner-grow spinner-grow-sm" style={{width:'0.5rem', height:'0.5rem'}} role="status"></div>
                                            </div>
                                        )}
                                    </div>
                                    {isLive && <small className="text-muted d-block mt-1" style={{fontSize: '0.7rem'}}>Haritada bulmak için tıklayın 🎯</small>}
                                </div>
                            );
                        })}
                        {gunlukTarife.length === 0 && !loading && (
                            <div className="text-center mt-5 text-muted">Sefer verisi yok.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Harita;