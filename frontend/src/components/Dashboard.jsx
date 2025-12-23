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

const Dashboard = () => {
  // --- STATE TANIMLARI ---
  const [hatlar, setHatlar] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [period, setPeriod] = useState('daily');
  const [activeTab, setActiveTab] = useState('charts');

  // Grafikler için ayrı state'ler
  const [predictions, setPredictions] = useState([]); // Sol Grafik (Prophet)
  const [capacityData, setCapacityData] = useState([]); // Sağ Grafik (Doluluk)

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    totalDemand: 0, maxDemand: 0, riskHour: '-', avgOccupancy: 0
  });

  // 1. Hat Listesini Çek
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/hatlar/')
      .then(res => {
        setHatlar(res.data);
        if (res.data.length > 0) setSelectedLine(res.data[0].ana_hat_no);
      })
      .catch(err => console.error("Hatlar alınamadı:", err));
  }, []);

  // 2. Seçili Hat İçin Verileri Çek
  useEffect(() => {
    if (!selectedLine) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      // State'leri sıfırla ki eski veri gözükmesin
      setPredictions([]);
      setCapacityData([]);

      try {
        console.log(`[Dashboard] Veri isteniyor: Hat ${selectedLine}, Periyot ${period}`);

        // A) YOLCU TALEP TAHMİNİ (PROPHET)
        const demandRes = await axios.get(`http://127.0.0.1:8000/api/predict-demand/${selectedLine}/?period=${period}`);
        console.log("[Dashboard] Prophet Ham Veri:", demandRes.data);

        // B) KAPASİTE ANALİZİ (DOLULUK)
        let capRes = { data: { analiz: [] } };
        try {
            capRes = await axios.get(`http://127.0.0.1:8000/api/capacity-analysis/${selectedLine}/`);
            console.log("[Dashboard] Kapasite Ham Veri:", capRes.data);
        } catch(e) {
            console.warn("Kapasite servisi yanıt vermedi.");
        }

        // --- VERİ İŞLEME (PROPHET) ---
        const rawPreds = demandRes.data.predictions || [];
        const processedPreds = rawPreds.map(item => {
            // Tarih formatlama
            const dateObj = new Date(item.ds);
            return {
                rawDate: item.ds,
                // Grafikte görünecek tarih formatı
                displayDate: dateObj.toLocaleDateString('tr-TR', {
                    hour: period === 'daily' ? '2-digit' : undefined,
                    day: 'numeric',
                    month: 'short',
                    year: period === 'yearly' ? 'numeric' : undefined
                }) + (period === 'daily' ? ` ${dateObj.getHours()}:00` : ''),
                saat: dateObj.getHours(),
                tahmin: Math.max(0, Math.round(item.yhat)) // Eksi değerleri 0 yap
            };
        });

        // --- VERİ İŞLEME (KAPASİTE) ---
        const processedCap = capRes.data.analiz || [];

        // State'leri güncelle
        setPredictions(processedPreds);
        setCapacityData(processedCap);

        // --- İSTATİSTİKLER ---
        if (processedPreds.length > 0) {
            const total = processedPreds.reduce((a, b) => a + b.tahmin, 0);
            const maxVal = Math.max(...processedPreds.map(d => d.tahmin));

            let risky = '-';
            let avgOcc = 0;

            if (processedCap.length > 0) {
                const risks = processedCap.filter(a => a.doluluk_yuzdesi > 90);
                if (risks.length > 0) risky = risks[0].saat;
                const totalOcc = processedCap.reduce((a, b) => a + b.doluluk_yuzdesi, 0);
                avgOcc = Math.round(totalOcc / processedCap.length);
            }
            setStats({ totalDemand: total, maxDemand: maxVal, riskHour: risky, avgOccupancy: avgOcc });
        } else {
             setStats({ totalDemand: 0, maxDemand: 0, riskHour: '-', avgOccupancy: 0 });
        }

      } catch (err) {
        console.error("Dashboard Hatası:", err);
        setError("Veriler alınırken bir hata oluştu. Lütfen Backend'in çalıştığından emin olun.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLine, period]);

  return (
    <Container fluid className="py-4 bg-light min-vh-100">

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
      {loading ? (
         <div className="text-center py-5">
             <Spinner animation="border" variant="primary" style={{width: '3rem', height:'3rem'}} />
             <p className="mt-3 text-muted">Yapay Zeka Modelleri Çalışıyor...</p>
         </div>
      ) : error ? (
         <Alert variant="danger">{error}</Alert>
      ) : (
        <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4 border-bottom-0"
        >
            <Tab eventKey="charts" title={<><Activity size={18} className="me-2"/>Grafik Analizi</>}>
                <Row className="g-4">
                    {/* --- SOL GRAFİK: PROPHET TAHMİNİ --- */}
                    <Col lg={8}>
                        <Card className="h-100 border-0 shadow-sm">
                            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                <h5 className="m-0 fw-bold text-primary">Yolcu Talep Tahmini (Gelecek)</h5>
                                <Badge bg="primary">Prophet AI</Badge>
                            </Card.Header>
                            <Card.Body>
                                <div style={{height: '400px', width: '100%'}}>
                                    {predictions.length > 0 ? (
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
                                                <Tooltip
                                                    contentStyle={{backgroundColor: '#fff', borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="tahmin"
                                                    stroke="#0d6efd"
                                                    strokeWidth={3}
                                                    fill="url(#colorY)"
                                                    name="Tahmini Yolcu"
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                            <AlertTriangle size={48} className="mb-3 text-warning"/>
                                            <p>Bu hat veya dönem için tahmin verisi oluşturulamadı.</p>
                                        </div>
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
                                <Badge bg="info">Gerçek Zamanlı</Badge>
                            </Card.Header>
                            <Card.Body>
                                <div style={{height: '400px', width: '100%'}}>
                                    {capacityData.length > 0 ? (
                                        <ResponsiveContainer>
                                            <ComposedChart data={capacityData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                                <CartesianGrid horizontal={false} stroke="#f0f0f0"/>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="saat" type="category" scale="band" width={45} tick={{fontSize: 12, fontWeight: 'bold'}}/>
                                                <Tooltip cursor={{fill: 'transparent'}} />
                                                <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '10px'}}/>

                                                {/* Kapasite (Arkaplan Bar) */}
                                                <Bar dataKey="kapasite" fill="#e9ecef" barSize={20} radius={[0,10,10,0]} name="Kapasite" />

                                                {/* Tahmini Yolcu (Ön Bar) */}
                                                <Bar dataKey="ortalama_yolcu" fill="#0dcaf0" barSize={12} radius={[0,10,10,0]} name="Yolcu" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                            <p>Sefer veya tarife verisi bulunamadı.</p>
                                        </div>
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
                                            <tr key={i}>
                                                <td>{p.displayDate}</td>
                                                <td className="fw-bold text-primary">{p.tahmin}</td>
                                            </tr>
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
      )}
    </Container>
  );
};

// Basit KPI Kart Bileşeni
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