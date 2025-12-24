import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Form, Button,
  Table, Spinner, Alert, Badge, ButtonGroup, Tab, Tabs
} from 'react-bootstrap';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart
} from 'recharts';
import {
  Users, TrendingUp, AlertTriangle,
  Activity, LayoutDashboard, PieChart, List
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- DEĞİŞİKLİK BURADA
import { Download } from 'lucide-react';





const Dashboard = () => {
  // --- STATE TANIMLARI ---
  const [hatlar, setHatlar] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [period, setPeriod] = useState('daily');
  const [activeTab, setActiveTab] = useState('charts');

  // VERİ STATE'LERİ
  const [predictions, setPredictions] = useState([]);
  const [capacityData, setCapacityData] = useState([]);

  // AYRI LOADING STATE'LERİ (EŞ ZAMANLI HİSSİYAT İÇİN)
  const [loadingProphet, setLoadingProphet] = useState(false);
  const [loadingCapacity, setLoadingCapacity] = useState(false);

  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    totalDemand: 0, maxDemand: 0, riskHour: '-', avgOccupancy: 0
  });

const downloadReport = () => {
        const doc = new jsPDF();

        // 1. Periyot İsmini Türkçeleştir (Dosya ve Başlık için)
        const periodLabels = {
            'daily': 'GUNLUK',
            'weekly': 'HAFTALIK',
            'monthly': 'AYLIK',
            'yearly': 'YILLIK'
        };
        const currentLabel = periodLabels[period] || 'GENEL'; // 'period' state'inden gelir

        // 2. Dinamik Başlık
        doc.setFontSize(18);
        doc.text(`KonyaBus - ${currentLabel} Hat Analiz Raporu`, 14, 22);

        doc.setFontSize(11);
        doc.text(`Tarih: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`Hat: ${selectedLine}`, 14, 36);
        doc.text(`Periyot: ${currentLabel}`, 14, 42); // Raporun içine de ekledik

        // Tablo Verisini Hazırla
        const tableColumn = ["Saat", "Sefer Sayisi", "Yolcu Tahmini", "Kapasite", "Doluluk %"];
        const tableRows = [];

        capacityData.forEach(item => {
            const rowData = [
                item.saat,
                item.sefer_sayisi,
                item.ortalama_yolcu,
                item.kapasite,
                `%${item.doluluk_yuzdesi}`
            ];
            tableRows.push(rowData);
        });

        // Tabloyu Çiz
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 48,
        });

        // 3. Dinamik Dosya İsmi (Örn: Rapor_AYLIK_4-A_2025-12-24.pdf)
        const dateStr = new Date().toISOString().slice(0,10);
        doc.save(`Rapor_${currentLabel}_${selectedLine}_${dateStr}.pdf`);
    };
  // 1. Hat Listesini Çek
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/hatlar/')
      .then(res => {
        setHatlar(res.data);
        if (res.data.length > 0) setSelectedLine(res.data[0].ana_hat_no);
      })
      .catch(err => console.error("Hatlar alınamadı:", err));
  }, []);

  // 2. Seçili Hat Değişince Verileri Çek (PARALEL ÇALIŞMA)
  useEffect(() => {
    if (!selectedLine) return;

    // --- A) KAPASİTE VERİSİNİ ÇEK (HIZLI) ---
    const fetchCapacity = async () => {
        setLoadingCapacity(true);
        setCapacityData([]);
        try {
            // DEĞİŞİKLİK BURADA: Sonuna /?period=${period} eklendi.
            const res = await axios.get(`http://127.0.0.1:8000/api/capacity-analysis/${selectedLine}/?period=${period}`);
            setCapacityData(res.data.analiz || []);
        } catch (e) {
            console.warn("Kapasite verisi alınamadı.");
        } finally {
            setLoadingCapacity(false);
        }
    };

    // --- B) PROPHET VERİSİNİ ÇEK (YAVAŞ) ---
    const fetchProphet = async () => {
        setLoadingProphet(true);
        setPredictions([]);
        setError(null);
        try {
            const res = await axios.get(`http://127.0.0.1:8000/api/predict-demand/${selectedLine}/?period=${period}`);

            const processed = (res.data.predictions || []).map(item => {
                const dateObj = new Date(item.ds);
                return {
                    fullDate: item.ds,
                    displayDate: dateObj.toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short',
                        hour: period === 'daily' ? '2-digit' : undefined
                    }) + (period === 'daily' ? ` ${dateObj.getHours()}:00` : ''),
                    tahmin: Math.max(0, Math.round(item.yhat))
                };
            });
            setPredictions(processed);
        } catch (e) {
            console.error("Prophet hatası:", e);
            setError("Tahmin verisi oluşturulamadı.");
        } finally {
            setLoadingProphet(false);
        }
    };

    // İkisini de başlat
    fetchCapacity();
    fetchProphet();

  }, [selectedLine, period]);

  // İstatistikleri Güncelle (Her iki veri de değiştikçe)
  useEffect(() => {
    let total = 0, maxVal = 0, risky = '-', avgOcc = 0;

    if (predictions.length > 0) {
        total = predictions.reduce((a, b) => a + b.tahmin, 0);
        maxVal = Math.max(...predictions.map(d => d.tahmin));
    }

    if (capacityData.length > 0) {
        const risks = capacityData.filter(a => a.doluluk_yuzdesi > 90);
        if (risks.length > 0) risky = risks[0].saat;
        const totalOcc = capacityData.reduce((a, b) => a + b.doluluk_yuzdesi, 0);
        avgOcc = Math.round(totalOcc / capacityData.length);
    }

    setStats({ totalDemand: total, maxDemand: maxVal, riskHour: risky, avgOccupancy: avgOcc });
  }, [predictions, capacityData]);

  return (
    <Container fluid className="py-4 bg-light min-vh-100">
<div className="d-flex justify-content-between align-items-center mb-4">
    <h2 className="fw-bold text-dark m-0">Yönetim Paneli</h2>

    {/* PDF BUTONU */}
    <Button variant="outline-primary" onClick={downloadReport}>
        <Download size={18} className="me-2"/>
        Rapor İndir (PDF)
    </Button>
</div>
      {/* BAŞLIK VE FİLTRELER */}
      <Card className="border-0 shadow-sm mb-4 bg-white">
        <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-center p-4">
            <div className="d-flex align-items-center mb-3 mb-md-0">
                <div className="bg-primary text-white p-3 rounded-circle me-3">
                    <LayoutDashboard size={28} />
                </div>
                <div>
                    <h2 className="mb-0 fw-bold text-dark">Akıllı Hat Analizi</h2>
                    <div className="text-muted small">Yapay Zeka Destekli Tahmin Sistemi</div>
                </div>
            </div>

            <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                <Form.Select
                    value={selectedLine}
                    onChange={e => setSelectedLine(e.target.value)}
                    className="fw-bold border-primary"
                    style={{minWidth: '150px'}}
                >
                    {hatlar.map(h => <option key={h.id} value={h.ana_hat_no}>{h.ana_hat_no} - {h.ana_hat_adi}</option>)}
                </Form.Select>

                <ButtonGroup className="shadow-sm">
                    {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                        <Button
                            key={p}
                            variant={period === p ? 'primary' : 'outline-secondary'}
                            onClick={() => setPeriod(p)}
                            size="sm"
                            className="px-3"
                        >
                            {p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                        </Button>
                    ))}
                </ButtonGroup>
            </div>
        </Card.Body>
      </Card>

      {/* KPI KARTLARI */}
      <Row className="g-3 mb-4">
        <Col md={3}>
            <KpiCard title="Toplam Tahmin" val={stats.totalDemand.toLocaleString()} icon={<Users/>} color="primary" />
        </Col>
        <Col md={3}>
            <KpiCard title="Maksimum Talep" val={stats.maxDemand.toLocaleString()} icon={<TrendingUp/>} color="success" />
        </Col>
        <Col md={3}>
            <KpiCard title="Ortalama Doluluk" val={`%${stats.avgOccupancy}`} icon={<PieChart/>} color="info" />
        </Col>
        <Col md={3}>
            <KpiCard title="Riskli Saat" val={stats.riskHour} icon={<AlertTriangle/>} color={stats.riskHour !== '-' ? 'danger' : 'secondary'} />
        </Col>
      </Row>

      {/* ANA İÇERİK */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4 border-bottom-0">
            <Tab eventKey="charts" title={<><Activity size={18} className="me-2"/>Grafik Analizi</>}>
                <Row className="g-4">

                    {/* --- SOL GRAFİK: PROPHET TAHMİNİ --- */}
                    <Col lg={8}>
                        <Card className="h-100 border-0 shadow-sm">
                            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                <h5 className="m-0 fw-bold text-primary">Yolcu Talep Tahmini (Gelecek)</h5>
                                {loadingProphet && <Spinner animation="border" size="sm" variant="primary"/>}
                            </Card.Header>
                            <Card.Body>
                                <div style={{height: '400px', width: '100%'}}>
                                    {loadingProphet ? (
                                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                            <Spinner animation="grow" variant="primary" />
                                            <p className="mt-3">Yapay Zeka Hesaplanıyor...</p>
                                        </div>
                                    ) : error ? (
                                        <Alert variant="danger">{error}</Alert>
                                    ) : predictions.length > 0 ? (
                                        <ResponsiveContainer>
                                            <AreaChart data={predictions} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#0d6efd" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                                                <XAxis dataKey="displayDate" tick={{fontSize: 12}} />
                                                <YAxis tick={{fontSize: 12}} />
                                                <Tooltip contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}/>
                                                <Area type="monotone" dataKey="tahmin" stroke="#0d6efd" strokeWidth={3} fill="url(#colorY)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-100 d-flex align-items-center justify-content-center text-muted">Veri Yok</div>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    {/* --- SAĞ GRAFİK: KAPASİTE ANALİZİ --- */}
                    <Col lg={4}>
                        <Card className="h-100 border-0 shadow-sm">
                            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                <h5 className="m-0 fw-bold text-info">Anlık Kapasite Durumu</h5>
                                {loadingCapacity && <Spinner animation="border" size="sm" variant="info"/>}
                            </Card.Header>
                            <Card.Body>
                                <div style={{height: '400px', width: '100%'}}>
                                    {loadingCapacity ? (
                                        <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                                            <Spinner animation="border" size="sm" className="me-2"/> Yükleniyor...
                                        </div>
                                    ) : capacityData.length > 0 ? (
                                        <ResponsiveContainer>
                                            <ComposedChart data={capacityData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                                <CartesianGrid horizontal={false} stroke="#f0f0f0"/>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="saat" type="category" scale="band" width={45} tick={{fontSize: 12, fontWeight: 'bold'}}/>
                                                <Tooltip />
                                                <Bar dataKey="kapasite" fill="#e9ecef" barSize={20} radius={[0,10,10,0]} name="Kapasite" />
                                                <Bar dataKey="ortalama_yolcu" fill="#0dcaf0" barSize={12} radius={[0,10,10,0]} name="Yolcu" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-100 d-flex align-items-center justify-content-center text-muted">Veri Yok</div>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Tab>

            <Tab eventKey="details" title={<><List size={18} className="me-2"/>Detaylı Veriler</>}>
                <Row>
                    <Col md={6}>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white fw-bold">Prophet Tahmin Verileri</Card.Header>
                            <div className="table-responsive" style={{maxHeight: '500px'}}>
                                <Table hover striped className="mb-0">
                                    <thead><tr><th>Tarih</th><th>Tahmini Yolcu</th></tr></thead>
                                    <tbody>
                                        {predictions.map((p, i) => (
                                            <tr key={i}><td>{p.displayDate}</td><td className="fw-bold text-primary">{p.tahmin}</td></tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Card>
                    </Col>
                    <Col md={6}>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white fw-bold">Doluluk Analizi Verileri</Card.Header>
                            <div className="table-responsive" style={{maxHeight: '500px'}}>
                                <Table hover className="mb-0">
                                    <thead><tr><th>Saat</th><th>Sefer</th><th>Doluluk</th><th>Durum</th></tr></thead>
                                    <tbody>
                                        {capacityData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="fw-bold">{row.saat}</td>
                                                <td>{row.sefer_sayisi}</td>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        <div className="progress flex-grow-1" style={{height: 6}}>
                                                            <div className={`progress-bar bg-${row.doluluk_yuzdesi>90?'danger':row.doluluk_yuzdesi>70?'warning':'success'}`} style={{width: `${Math.min(row.doluluk_yuzdesi,100)}%`}}></div>
                                                        </div>
                                                        <span className="ms-2 small">%{row.doluluk_yuzdesi}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {row.doluluk_yuzdesi > 90 ? <Badge bg="danger">Kritik</Badge> :
                                                     row.doluluk_yuzdesi > 70 ? <Badge bg="warning">Yoğun</Badge> :
                                                     <Badge bg="success">Normal</Badge>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Tab>
      </Tabs>
    </Container>
  );
};

const KpiCard = ({ title, val, icon, color }) => (
    <Card className={`border-0 shadow-sm h-100 border-start border-4 border-${color}`}>
        <Card.Body>
            <div className="d-flex justify-content-between align-items-center">
                <div>
                    <h3 className="fw-bold text-dark mb-0">{val}</h3>
                    <div className="text-muted small">{title}</div>
                </div>
                <div className={`text-${color} bg-${color}-subtle p-3 rounded-circle d-flex align-items-center justify-content-center`}>
                    {icon}
                </div>
            </div>
        </Card.Body>
    </Card>
);

export default Dashboard;