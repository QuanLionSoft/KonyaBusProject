import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// --- İKON TANIMLAMALARI ---
// Otobüs İkonu (Mavi)
const busIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35]
});

// Ek Sefer İkonu (Kırmızı)
const urgentBusIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097144.png', // Kırmızımsı bir ikon
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const CanliHarita = ({ hatId }) => {
    const [otobusler, setOtobusler] = useState([]);
    const [rota, setRota] = useState([]);

    // 1. Rota Çizgisini Getir (Sadece hat değişince çalışır)
    useEffect(() => {
        if (!hatId) return;
        axios.get(`${API_BASE_URL}/hatlar/${hatId}/rota/`)
            .then(res => setRota(res.data))
            .catch(err => console.error("Rota hatası:", err));
    }, [hatId]);

    // 2. Canlı Otobüs Konumlarını Getir (Her 3 saniyede bir)
    useEffect(() => {
        if (!hatId) return;

        const veriCek = () => {
            axios.get(`${API_BASE_URL}/simulasyon/aktif-otobusler/`, { params: { hat_id: hatId } })
                .then(res => setOtobusler(res.data))
                .catch(err => console.error("Konum hatası:", err));
        };

        veriCek(); // İlk açılışta çek
        const interval = setInterval(veriCek, 3000); // 3 saniyede bir yenile

        return () => clearInterval(interval);
    }, [hatId]);

    if (!hatId) return <div className="alert alert-info">Haritayı görmek için bir hat seçiniz.</div>;

    // Harita Merkezi (Rota varsa rotanın ortası, yoksa Konya Merkez)
    const center = rota.length > 0 ? rota[Math.floor(rota.length / 2)] : [37.8716, 32.4851];

    return (
        <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-white fw-bold text-primary">
                🗺️ Canlı Hat İzleme & Trafik
            </div>
            <div className="card-body p-0">
                <MapContainer center={center} zoom={13} style={{ height: "500px", width: "100%" }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    {/* Rota Çizgisi */}
                    {rota.length > 0 && <Polyline positions={rota} color="blue" weight={4} opacity={0.6} />}

                    {/* Otobüsler */}
                    {otobusler.map((bus) => (
                        <Marker
                            key={bus.id}
                            position={[bus.enlem, bus.boylam]}
                            icon={bus.durum === 'kritik' ? urgentBusIcon : busIcon}
                        >
                            <Popup>
                                <div className="text-center">
                                    <h6 className="fw-bold mb-1">{bus.arac_no}</h6>
                                    <p className="mb-0 text-muted small">{bus.bilgi}</p>
                                    <span className={`badge ${bus.durum === 'kritik' ? 'bg-danger' : 'bg-success'}`}>
                                        {bus.durum === 'kritik' ? 'EK SEFER' : 'Zamanında'}
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};

export default CanliHarita;