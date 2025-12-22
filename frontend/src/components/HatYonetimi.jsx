import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const HatYonetimi = () => {
    // --- STATE TANIMLARI ---
    const [hatlar, setHatlar] = useState([]);
    const [seciliHat, setSeciliHat] = useState("");

    // Analiz verisi (Kapasite/İzdiham)
    const [analizVerisi, setAnalizVerisi] = useState([]);
    const [loading, setLoading] = useState(false);

    // Görev Atama Formu
    const [ekSeferSaati, setEkSeferSaati] = useState("");
    const [seciliArac, setSeciliArac] = useState("");
    const [mesaj, setMesaj] = useState(null);

    // --- HAT LİSTESİNİ ÇEK ---
    useEffect(() => {
        axios.get(`${API_BASE_URL}/hatlar/`)
            .then(res => setHatlar(res.data || []))
            .catch(err => console.error("Hatlar yüklenemedi", err));
    }, []);

    // --- HAT SEÇİLİNCE ANALİZİ GETİR ---
    const hatSecildi = async (hatId) => {
        setSeciliHat(hatId);
        setAnalizVerisi([]); // Temizle
        setEkSeferSaati("");

        if (!hatId) return;

        setLoading(true);
        const secilenHatObj = hatlar.find(h => h.id.toString() === hatId);
        const hatNo = secilenHatObj ? secilenHatObj.ana_hat_no : null;

        if (hatNo) {
            try {
                // SADECE KAPASİTE ANALİZİNİ ÇEKİYORUZ
                const res = await axios.get(`${API_BASE_URL}/analiz/kapasite/${hatNo}/`);

                if (res.data && Array.isArray(res.data.analiz)) {
                    setAnalizVerisi(res.data.analiz);
                } else {
                    setAnalizVerisi([]);
                }

                if (res.data.error) {
                    setMesaj({ tur: 'danger', text: `HATA: ${res.data.error}` });
                }

            } catch (error) {
                console.error("Analiz hatası:", error);
                setMesaj({ tur: 'danger', text: "Sunucu bağlantı hatası!" });
                setAnalizVerisi([]);
            }
        }
        setLoading(false);
    };

    // --- EK SEFER KAYDETME ---
    const ekSeferEkle = () => {
        if (!seciliHat || !ekSeferSaati || !seciliArac) {
            setMesaj({ tur: 'warning', text: "Lütfen tüm alanları doldurunuz!" });
            return;
        }

        axios.post(`${API_BASE_URL}/hatlar/${seciliHat}/ek_sefer_olustur/`, {
            saat: ekSeferSaati,
            arac_no: seciliArac
        })
        .then(res => {
            setMesaj({ tur: 'success', text: `✅ ${seciliArac} plakalı araç ${ekSeferSaati} seferine atandı.` });
            setSeciliArac("");
            setTimeout(() => setMesaj(null), 5000);
        })
        .catch(err => {
            setMesaj({ tur: 'danger', text: "Kaydetme başarısız oldu." });
        });
    };

    // Hata önlemek için güvenli veri
    const guvenliVeri = Array.isArray(analizVerisi) ? analizVerisi : [];

    return (
        <div className="container-fluid p-4 bg-light min-vh-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-primary">🚌 Hat & Filo Yönetimi</h2>
                <span className="badge bg-secondary p-2">Kapasite Analizi</span>
            </div>

            {/* ÜST KISIM: HAT SEÇİMİ */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body">
                    <label className="form-label fw-bold text-muted">Yönetilecek Hattı Seçin:</label>
                    <select
                        className="form-select form-select-lg fw-bold border-primary"
                        value={seciliHat}
                        onChange={(e) => hatSecildi(e.target.value)}
                    >
                        <option value="">Hat Seçiniz...</option>
                        {hatlar.map(h => (
                            <option key={h.id} value={h.id}>
                                {h.ana_hat_no} - {h.ana_hat_adi}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {mesaj && (
                <div className={`alert alert-${mesaj.tur} shadow-sm animate__animated animate__fadeIn`} role="alert">
                    {mesaj.text}
                </div>
            )}

            {seciliHat && (
                <div className="row g-4">
                    {/* SOL TARAF: KAPASİTE ANALİZ TABLOSU */}
                    <div className="col-lg-8">
                        <div className="card shadow border-0 h-100">
                            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold text-dark">📊 Kapasite & İzdiham Analizi (2019-2024)</h5>
                                {loading && <div className="spinner-border spinner-border-sm text-primary"></div>}
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 text-center">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Saat</th>
                                            <th>Ort. Yolcu</th>
                                            <th>Mevcut Sefer</th>
                                            <th>Doluluk %</th>
                                            <th>Durum & Aksiyon</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {guvenliVeri.length === 0 && !loading ? (
                                            <tr><td colSpan="5" className="py-4 text-muted">Veri yok veya analiz edilemedi.</td></tr>
                                        ) : (
                                            guvenliVeri.map((veri, index) => {
                                                const doluluk = veri.doluluk_yuzdesi;
                                                let rowClass = "";
                                                let durumBadge = <span className="badge bg-success bg-opacity-75">Normal</span>;

                                                if (doluluk > 100) {
                                                    rowClass = "table-danger border-start border-5 border-danger";
                                                    durumBadge = (
                                                        <button
                                                            className="btn btn-danger btn-sm fw-bold shadow-sm"
                                                            onClick={() => setEkSeferSaati(veri.saat)}
                                                        >
                                                            ⚠️ EK SEFER ŞART
                                                        </button>
                                                    );
                                                } else if (doluluk > 80) {
                                                    rowClass = "table-warning";
                                                    durumBadge = <span className="badge bg-warning text-dark">Yoğun</span>;
                                                } else if (veri.sefer_sayisi === 0 && veri.ortalama_yolcu > 15) {
                                                    rowClass = "table-warning border-start border-5 border-warning";
                                                    durumBadge = (
                                                        <button
                                                            className="btn btn-warning btn-sm fw-bold text-dark"
                                                            onClick={() => setEkSeferSaati(veri.saat)}
                                                        >
                                                            ⚠️ HAT AÇILMALI
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <tr key={index} className={rowClass}>
                                                        <td className="fw-bold fs-5">{veri.saat}</td>
                                                        <td className="text-muted">{veri.ortalama_yolcu}</td>
                                                        <td>
                                                            <span className="badge bg-light text-dark border">
                                                                {veri.sefer_sayisi}
                                                            </span>
                                                        </td>
                                                        <td className={`fw-bold ${doluluk > 100 ? 'text-danger' : 'text-success'}`}>
                                                            %{doluluk}
                                                        </td>
                                                        <td>{durumBadge}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* SAĞ TARAF: GÖREV ATAMA FORMU */}
                    <div className="col-lg-4">
                        <div className="card shadow border-0 h-100 bg-success bg-opacity-10">
                            <div className="card-header bg-success text-white py-3">
                                <h5 className="mb-0 fw-bold">🚀 Hızlı Görev Emri</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-4">
                                    <label className="form-label fw-bold">1. Ek Sefer Saati</label>
                                    <input
                                        type="time"
                                        className="form-control form-control-lg text-center fw-bold border-success"
                                        value={ekSeferSaati}
                                        onChange={(e) => setEkSeferSaati(e.target.value)}
                                    />
                                    <small className="text-muted">Soldaki kırmızı butonlara basarak saati otomatik seçebilirsiniz.</small>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold">2. Atanacak Araç Plakası</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg border-success"
                                        placeholder="Örn: 42 KNY 123"
                                        value={seciliArac}
                                        onChange={(e) => setSeciliArac(e.target.value)}
                                    />
                                </div>

                                <button
                                    className="btn btn-success w-100 py-3 fw-bold shadow-lg"
                                    onClick={ekSeferEkle}
                                    disabled={!ekSeferSaati || !seciliArac}
                                >
                                    GÖREVİ ONAYLA & GÖNDER
                                </button>

                                <hr className="my-4" />
                                <div className="alert alert-light border small text-muted">
                                    <strong>Bilgi:</strong> Bu ekran, 2019-2024 yılları arasındaki biniş verilerinin ortalamasını alarak, mevcut tarife ile karşılaştırır.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HatYonetimi;