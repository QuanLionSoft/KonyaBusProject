import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Form, Button,
  Table, Badge, Spinner, Alert, Modal, InputGroup
} from 'react-bootstrap';
import {
  MapPin, Clock, Plus, Bus, Navigation,
  Calendar, CheckCircle, AlertTriangle, Search, Trash2,
  MoreVertical, Filter, ArrowRight
} from 'lucide-react';

const HatYonetimi = () => {
  // --- STATE ---
  const [hatlar, setHatlar] = useState([]);
  const [filteredHatlar, setFilteredHatlar] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHat, setSelectedHat] = useState(null);

  const [duraklar, setDuraklar] = useState([]);
  const [tarife, setTarife] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [ekSeferSaat, setEkSeferSaat] = useState('');
  const [ekSeferArac, setEkSeferArac] = useState('');
  const [modalMsg, setModalMsg] = useState(null);

  // 1. Hatları Çek
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/hatlar/')
      .then(res => {
        setHatlar(res.data);
        setFilteredHatlar(res.data);
        if (res.data.length > 0) setSelectedHat(res.data[0]);
      })
      .catch(err => setError("Hat listesi yüklenemedi."));
  }, []);

  // Arama Filtresi
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = hatlar.filter(h =>
      h.ana_hat_no.toLowerCase().includes(term) ||
      h.ana_hat_adi.toLowerCase().includes(term)
    );
    setFilteredHatlar(filtered);
  }, [searchTerm, hatlar]);

  // 2. Detayları Çek
  useEffect(() => {
    if (!selectedHat) return;
    refreshData();
  }, [selectedHat]);

  const refreshData = async () => {
    setLoading(true);
    setDuraklar([]);
    setTarife([]);

    try {
      const [resDurak, resTarife] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/hatlar/${selectedHat.id}/duraklar/`),
        axios.get(`http://127.0.0.1:8000/api/hatlar/${selectedHat.id}/gunluk_tarife/`)
      ]);
      setDuraklar(resDurak.data);
      setTarife(resTarife.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. İşlemler (Ekle/Sil)
  const handleEkSeferEkle = async () => {
    if (!ekSeferSaat || !ekSeferArac) {
      setModalMsg({ type: 'warning', text: 'Lütfen tüm alanları doldurun.' });
      return;
    }
    try {
      await axios.post(`http://127.0.0.1:8000/api/hatlar/${selectedHat.id}/ek_sefer_olustur/`, {
        saat: ekSeferSaat, arac_no: ekSeferArac
      });
      setModalMsg({ type: 'success', text: 'Sefer eklendi.' });
      await refreshData();
      setTimeout(() => { setShowModal(false); setModalMsg(null); setEkSeferSaat(''); setEkSeferArac(''); }, 1000);
    } catch (err) {
      setModalMsg({ type: 'danger', text: 'İşlem başarısız.' });
    }
  };

  const handleEkSeferSil = async (id) => {
    if(!window.confirm("Seferi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.post(`http://127.0.0.1:8000/api/hatlar/${selectedHat.id}/ek_sefer_sil/`, { ek_sefer_id: id });
      await refreshData();
    } catch (err) { alert("Silinemedi."); }
  };

  // İstatistik Hesapla
  const stats = {
    toplamSefer: tarife.length,
    ekSefer: tarife.filter(t => t.tip === 'Ek Sefer').length,
    durakSayisi: duraklar.length
  };

  return (
    <Container fluid className="py-4 bg-light min-vh-100 font-monospace">

      {/* ÜST PANEL: SEÇİM VE ARAMA */}
      <Card className="border-0 shadow-sm mb-4 bg-white">
        <Card.Body className="p-4">
          <Row className="align-items-center g-3">
            <Col md={4}>
              <div className="d-flex align-items-center">
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3 text-primary">
                  <Navigation size={32} />
                </div>
                <div>
                  <h4 className="mb-0 fw-bold text-dark">Hat Yönetimi</h4>
                  <div className="text-muted small">Operasyon Paneli</div>
                </div>
              </div>
            </Col>
            <Col md={8}>
              <InputGroup className="shadow-sm">
                <InputGroup.Text className="bg-white border-end-0">
                  <Search size={18} className="text-muted"/>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Hat No veya Adı ile ara..."
                  className="border-start-0 border-end-0"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Form.Select
                  className="bg-light fw-bold border-start-0"
                  style={{maxWidth: '300px'}}
                  value={selectedHat?.id || ''}
                  onChange={e => setSelectedHat(hatlar.find(h => h.id === parseInt(e.target.value)))}
                >
                  {filteredHatlar.map(h => (
                    <option key={h.id} value={h.id}>{h.ana_hat_no} - {h.ana_hat_adi}</option>
                  ))}
                </Form.Select>
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {selectedHat && (
        <>
          {/* ÖZET İSTATİSTİKLER (Mini Cards) */}
          <Row className="g-3 mb-4">
             <Col xs={6} md={3}>
                <div className="bg-white p-3 rounded shadow-sm border-start border-4 border-primary d-flex justify-content-between align-items-center">
                   <div><div className="text-muted small">Durak Sayısı</div><h4 className="mb-0 fw-bold">{stats.durakSayisi}</h4></div>
                   <MapPin className="text-primary opacity-50"/>
                </div>
             </Col>
             <Col xs={6} md={3}>
                <div className="bg-white p-3 rounded shadow-sm border-start border-4 border-success d-flex justify-content-between align-items-center">
                   <div><div className="text-muted small">Toplam Sefer</div><h4 className="mb-0 fw-bold">{stats.toplamSefer}</h4></div>
                   <Clock className="text-success opacity-50"/>
                </div>
             </Col>
             <Col xs={6} md={3}>
                <div className="bg-white p-3 rounded shadow-sm border-start border-4 border-warning d-flex justify-content-between align-items-center">
                   <div><div className="text-muted small">Ek Seferler</div><h4 className="mb-0 fw-bold">{stats.ekSefer}</h4></div>
                   <Bus className="text-warning opacity-50"/>
                </div>
             </Col>
             <Col xs={6} md={3}>
                <Button
                    variant="success"
                    className="w-100 h-100 fw-bold d-flex align-items-center justify-content-center shadow-sm"
                    onClick={() => setShowModal(true)}
                >
                    <Plus size={20} className="me-2"/> YENİ EK SEFER
                </Button>
             </Col>
          </Row>

          <Row className="g-4">
            {/* SOL: DURAK ROTA (TIMELINE GÖRÜNÜMÜ) */}
            <Col lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white py-3 border-bottom fw-bold text-primary">
                    <MapPin size={18} className="me-2 mb-1"/> Güzergah ve Duraklar
                </Card.Header>
                <Card.Body className="p-0 overflow-auto" style={{maxHeight: '650px'}}>
                   {loading ? <div className="text-center p-4"><Spinner animation="border"/></div> : (
                     <div className="p-3">
                        {duraklar.map((d, i) => (
                           <div key={i} className="d-flex mb-3 position-relative">
                              {/* Rota Çizgisi */}
                              {i !== duraklar.length - 1 && (
                                <div style={{
                                    position: 'absolute', left: '14px', top: '25px', bottom: '-18px',
                                    width: '2px', backgroundColor: '#e9ecef', zIndex: 0
                                }}></div>
                              )}

                              {/* Durak Noktası */}
                              <div className="me-3 z-1">
                                 <div className="bg-white border border-2 border-primary rounded-circle d-flex align-items-center justify-content-center"
                                      style={{width: '30px', height: '30px', fontSize: '12px', fontWeight: 'bold'}}>
                                    {i+1}
                                 </div>
                              </div>

                              {/* Bilgi - DÜZELTME BURADA */}
                              <div className="bg-light p-2 rounded w-100 border-start border-2 border-primary-subtle">
                                 <div className="fw-bold text-dark">{d.durak?.durak_adi || 'Bilinmeyen Durak'}</div>
                                 <div className="d-flex justify-content-between small text-muted">
                                    <span>No: {d.durak?.durak_no}</span>
                                    <span>
                                        {/* toFixed hatasını önlemek için Number() dönüşümü yapıldı */}
                                        {d.durak?.enlem ? Number(d.durak.enlem).toFixed(4) : '-'},
                                        {d.durak?.boylam ? Number(d.durak.boylam).toFixed(4) : '-'}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                </Card.Body>
              </Card>
            </Col>

            {/* SAĞ: SEFER YÖNETİMİ (TABLO) */}
            <Col lg={8}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                    <div className="fw-bold text-success"><Clock size={18} className="me-2 mb-1"/>Günlük Tarife</div>
                    <Badge bg="light" text="dark" className="border">Bugün: {new Date().toLocaleDateString('tr-TR')}</Badge>
                </Card.Header>
                <Card.Body className="p-0 overflow-auto" style={{maxHeight: '650px'}}>
                    <Table hover responsive className="mb-0 align-middle">
                        <thead className="bg-light sticky-top">
                            <tr>
                                <th className="ps-4">Saat</th>
                                <th>Araç / Hat</th>
                                <th>Sefer Tipi</th>
                                <th>Durum</th>
                                <th className="text-end pe-4">Yönetim</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tarife.map((t, idx) => (
                                <tr key={idx} className={t.tip === 'Ek Sefer' ? 'bg-warning bg-opacity-10' : ''}>
                                    <td className="ps-4">
                                        <div className="d-flex align-items-center">
                                            <div className="bg-white border rounded p-1 px-2 fw-bold shadow-sm">
                                                {t.saat}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {t.tip === 'Ek Sefer' ? (
                                            <div className="d-flex align-items-center text-danger fw-bold">
                                                <Bus size={16} className="me-2"/> {t.alt_hat}
                                            </div>
                                        ) : (
                                            <span className="text-muted small">{t.alt_hat}</span>
                                        )}
                                    </td>
                                    <td>
                                        {t.tip === 'Ek Sefer' ? (
                                            <Badge bg="warning" text="dark" className="px-3 py-2 rounded-pill">EK SEFER</Badge>
                                        ) : (
                                            <Badge bg="success" className="px-3 py-2 rounded-pill bg-opacity-75">PLANLI</Badge>
                                        )}
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            {t.durum === 'Normal' ? (
                                                <CheckCircle size={16} className="text-success me-1"/>
                                            ) : (
                                                <AlertTriangle size={16} className="text-danger me-1"/>
                                            )}
                                            <span className="small">{t.durum}</span>
                                        </div>
                                    </td>
                                    <td className="text-end pe-4">
                                        {t.tip === 'Ek Sefer' && (
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                className="rounded-circle p-2 shadow-sm border-0"
                                                onClick={() => handleEkSeferSil(t.id)}
                                                title="Seferi İptal Et"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {tarife.length === 0 && !loading && (
                        <div className="text-center py-5 text-muted">
                            <Calendar size={48} className="mb-3 opacity-25"/>
                            <p>Bu hat için planlanmış sefer bulunmuyor.</p>
                        </div>
                    )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* MODAL */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered backdrop="static">
         <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold text-success">
                <Plus size={24} className="me-2 mb-1"/>
                Yeni Ek Sefer
            </Modal.Title>
         </Modal.Header>
         <Modal.Body>
            {modalMsg && <Alert variant={modalMsg.type}>{modalMsg.text}</Alert>}
            <Form className="p-2">
                <Form.Group className="mb-4">
                    <Form.Label className="fw-bold text-muted small">KALKIŞ SAATİ</Form.Label>
                    <Form.Control
                        type="time"
                        size="lg"
                        className="fw-bold"
                        value={ekSeferSaat}
                        onChange={e => setEkSeferSaat(e.target.value)}
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold text-muted small">ATANACAK ARAÇ (PLAKA/KOD)</Form.Label>
                    <Form.Control
                        type="text"
                        size="lg"
                        placeholder="Örn: 42 B 9999"
                        className="text-uppercase"
                        value={ekSeferArac}
                        onChange={e => setEkSeferArac(e.target.value)}
                    />
                </Form.Group>
            </Form>
         </Modal.Body>
         <Modal.Footer className="border-0 pt-0">
            <Button variant="light" onClick={() => setShowModal(false)}>Vazgeç</Button>
            <Button variant="success" className="px-4 fw-bold" onClick={handleEkSeferEkle}>
                ONAYLA VE EKLE
            </Button>
         </Modal.Footer>
      </Modal>

    </Container>
  );
};

export default HatYonetimi;