import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Form, Button,
  Table, Spinner, Alert, Badge, ButtonGroup
} from 'react-bootstrap';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart
} from 'recharts';
import {
  Bus, Users, TrendingUp, AlertTriangle,
  Activity, LayoutDashboard, PieChart, ArrowRight
} from 'lucide-react';

const Dashboard = () => {
  // --- STATE ---
  const [hatlar, setHatlar] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, yearly

  // Veri State'leri
  const [predictions, setPredictions] = useState([]);
  const [capacityData, setCapacityData] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // İstatistikler
  const [stats, setStats] = useState({
    totalDemand: 0,
    maxDemand: 0,
    riskHour: '-',
    avgOccupancy: 0
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

  // 2. Dashboard Verilerini Çek
  useEffect(() => {
    if (!selectedLine) return;

    // Cleanup flag to prevent state updates after component unmount
    let isCancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setPredictions([]); // Önceki veriyi temizle

      try {
        // A) Talep Tahmini
        const demandRes = await axios.get(`http://127.0.0.1:8000/api/predict-demand/${selectedLine}/?period=${period}`);

        if (isCancelled) return; // Don't update if component unmounted

        // B) Kapasite Analizi (Her periyot için çekmeye çalış)
        let capacityRes = { data: { analiz: [] } };
        try {
            capacityRes = await axios.get(`http://127.0.0.1:8000/api/capacity-analysis/${selectedLine}/`);
        } catch (capacityError) {
            console.warn("Kapasite analizi çekilemedi:", capacityError.message);
        }

        if (isCancelled) return; // Don't update if component unmounted

        // --- Veri İşleme ---

        // 1. Tahmin Verisi Formatlama
        const rawPreds = demandRes.data.predictions || demandRes.data.tahminler || [];

        // Veri yoksa uyarı ver
        if (!Array.isArray(rawPreds) || rawPreds.length === 0) {
            console.warn(`Hat ${selectedLine} için tahmin verisi boş.`);
            if (!isCancelled) {
                setError("Seçili hat ve dönem için tahmin verisi bulunamadı. Lütfen farklı bir hat veya dönem seçin.");
                setLoading(false);
            }
            return;
        }

        const formattedPreds = rawPreds.map(item => {
            const dateObj = new Date(item.ds);
            return {
                fullDate: item.ds,
                // Yıllık görünümde sadece Ay ismi, diğerlerinde Gün/Ay veya Saat
                displayDate: dateObj.toLocaleDateString('tr-TR', {
                    hour: period === 'daily' ? '2-digit' : undefined,
                    day: period === 'yearly' ? undefined : 'numeric', // Yıllıkta günü gizle
                    month: period === 'yearly' ? 'long' : 'short',    // Yıllıkta uzun ay ismi
                    year: period === 'yearly' ? 'numeric' : undefined
                }),
                tahmin: Math.round(item.yhat || 0)
            };
        });
        
        if (!isCancelled) {
            setPredictions(formattedPreds);
        }

        // 2. Kapasite Verisi
        const capacityAnalysis = Array.isArray(capacityRes.data.analiz) ? capacityRes.data.analiz : [];
        
        if (!isCancelled) {
            setCapacityData(capacityAnalysis);
        }

        // 3. KPI Hesaplama
        if (formattedPreds.length > 0) {
            const total = formattedPreds.reduce((acc, cur) => acc + (cur.tahmin || 0), 0);
            const maxVal = Math.max(...formattedPreds.map(d => d.tahmin || 0));

            // Risk sadece günlük modda hesaplanır
            let risky = '-';
            let avgOcc = 0;
            if (capacityAnalysis.length > 0) {
                const risks = capacityAnalysis.filter(a => (a.doluluk_yuzdesi || 0) > 90);
                if (risks.length > 0) risky = risks[0].saat || '-';

                const totalOcc = capacityAnalysis.reduce((acc, cur) => acc + (cur.doluluk_yuzdesi || 0), 0);
                avgOcc = Math.round(totalOcc / capacityAnalysis.length);
            }

            if (!isCancelled) {
                setStats({
                    totalDemand: total,
                    maxDemand: maxVal,
                    riskHour: risky,
                    avgOccupancy: avgOcc
                });
            }
        }

      } catch (err) {
        console.error("Dashboard veri alma hatası:", err);
        
        // Daha detaylı hata mesajı
        let errorMessage = "Veriler alınırken bir hata oluştu. ";
        
        if (err.response) {
            // Backend'den hata yanıtı geldi
            if (err.response.status === 404) {
                errorMessage += "İstenen veri bulunamadı. Lütfen farklı bir hat seçin.";
            } else if (err.response.status === 500) {
                errorMessage += "Backend'te bir hata oluştu. Lütfen modellerin doğru yüklendiğinden emin olun.";
            } else {
                errorMessage += `Hata Kodu: ${err.response.status}`;
            }
        } else if (err.request) {
            // İstek gönderildi ama yanıt alınamadı
            errorMessage += "Backend'e bağlanılamadı. Lütfen backend'in çalıştığından emin olun.";
        } else {
            // İstek hazırlanırken hata oluştu
            errorMessage += err.message || "Bilinmeyen bir hata oluştu.";
        }
        
        if (!isCancelled) {
            setError(errorMessage);
        }
      } finally {
        if (!isCancelled) {
            setLoading(false);
        }
      }
    };

    fetchData();
    
    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [selectedLine, period]);

  // Grafik Bileşeni Seçimi
  const renderMainChart = () => {
    // Veri yoksa boş state göster
    if (!predictions || predictions.length === 0) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                <TrendingUp size={48} className="mb-2 opacity-25" />
                <small className="text-center">
                    {loading ? 'Tahmin verisi yükleniyor...' : 'Veri bulunamadı.'}
                </small>
            </div>
        );
    }
    
    if (period === 'yearly') {
        return (
            // DÜZELTME 1: minWidth={0} eklendi
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={predictions}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                    <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6c757d'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6c757d'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8f9fa'}} />
                    <Bar dataKey="tahmin" fill="#0d6efd" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
            </ResponsiveContainer>
        );
    }
    // Diğerleri için AreaChart
    return (
        // DÜZELTME 2: minWidth={0} eklendi
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={predictions}>
                <defs>
                    <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0d6efd" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6c757d'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6c757d'}} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tahmin" stroke="#0d6efd" strokeWidth={3} fill="url(#colorDemand)" activeDot={{ r: 6 }} />
            </AreaChart>
        </ResponsiveContainer>
    );
  };

  return (
    <Container fluid className="py-4 bg-light min-vh-100">

      {/* --- HEADER --- */}
      <Row className="mb-4 align-items-center">
        <Col md={5}>
          <div className="d-flex align-items-center">
            <div className="bg-primary text-white p-2 rounded me-3 shadow-sm">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h2 className="mb-0 fw-bold text-dark">Yönetim Paneli</h2>
              <small className="text-muted">Akıllı Ulaşım Analizi</small>
            </div>
          </div>
        </Col>

        <Col md={7}>
          <div className="d-flex justify-content-md-end gap-2 mt-3 mt-md-0 flex-wrap">
            {/* Hat Seçimi */}
            <Form.Select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="shadow-sm border-0"
              style={{ minWidth: '180px', maxWidth: '300px' }}
            >
              <option value="" disabled>Hat Seçiniz</option>
              {hatlar.map(h => (
                <option key={h.id} value={h.ana_hat_no}>
                  {h.ana_hat_no} - {h.ana_hat_adi}
                </option>
              ))}
            </Form.Select>

            {/* Periyot Seçimi */}
            <ButtonGroup className="shadow-sm bg-white rounded">
              {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'primary' : 'light'}
                  className={period !== p ? 'bg-white border-0 text-secondary' : ''}
                  onClick={() => setPeriod(p)}
                  size="sm"
                >
                  {p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </Col>
      </Row>

      {/* --- CONTENT --- */}
      {loading ? (
        <div className="d-flex flex-col justify-content-center align-items-center py-5" style={{ minHeight: '400px' }}>
          <Spinner animation="border" variant="primary" role="status" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted fw-medium">Veriler Analiz Ediliyor...</p>
        </div>
      ) : error ? (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm border-0">
          <AlertTriangle className="me-2" />
          <div>{error}</div>
        </Alert>
      ) : (
        <>
            {/* KPI KARTLARI */}
            <Row className="g-3 mb-4">
                <Col md={6} lg={3}>
                    <KpiCard
                        title="Toplam Tahmin"
                        value={stats.totalDemand.toLocaleString()}
                        icon={<Users size={24} />}
                        color="primary"
                        sub="Seçili dönem toplamı"
                    />
                </Col>
                <Col md={6} lg={3}>
                    <KpiCard
                        title="Maksimum Talep"
                        value={stats.maxDemand.toLocaleString()}
                        icon={<Activity size={24} />}
                        color="success"
                        sub="En yoğun periyotta"
                    />
                </Col>
                <Col md={6} lg={3}>
                    <KpiCard
                        title="Ortalama Doluluk"
                        value={`%${stats.avgOccupancy}`}
                        icon={<PieChart size={24} />}
                        color="info"
                        sub="Kapasite kullanım oranı"
                    />
                </Col>
                <Col md={6} lg={3}>
                    <KpiCard
                        title="Riskli Saat"
                        value={stats.riskHour}
                        icon={<AlertTriangle size={24} />}
                        color={stats.riskHour !== '-' ? 'danger' : 'secondary'}
                        sub="Olası izdiham uyarısı"
                        isAlert={stats.riskHour !== '-'}
                    />
                </Col>
            </Row>

            {/* GRAFİKLER */}
            <Row className="g-4 mb-4">
                {/* SOL: Ana Talep Grafiği (Prophet) */}
                <Col lg={8}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="card-title fw-bold mb-0 text-dark">
                                    <TrendingUp size={20} className="me-2 text-primary" />
                                    Yolcu Talebi Tahmini
                                </h5>
                                <Badge bg="light" text="primary" className="border border-primary-subtle">
                                    AI Model: Prophet
                                </Badge>
                            </div>

                            {/* DÜZELTME 3: Kapsayıcı div'e width: 100% ve minWidth: 0 verildi */}
                            <div style={{ width: '100%', height: '350px', minWidth: 0 }}>
                                {renderMainChart()}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                {/* SAĞ: Doluluk Analizi (DÜZELTME 4: Şart kaldırıldı, her zaman görünür) */}
                <Col lg={4}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Body>
                            <div className="mb-4">
                                <h5 className="card-title fw-bold mb-1 text-dark">
                                    <Bus size={20} className="me-2 text-info" />
                                    Doluluk Analizi
                                </h5>
                                <small className="text-muted">Kapasite vs Beklenen Yolcu</small>
                            </div>

                            {capacityData.length > 0 ? (
                                /* DÜZELTME 5: Kapsayıcı div eklendi ve minWidth verildi */
                                <div style={{ width: '100%', height: '350px', minWidth: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <ComposedChart data={capacityData} layout="vertical">
                                            <CartesianGrid stroke="#e9ecef" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="saat"
                                                type="category"
                                                scale="band"
                                                axisLine={false}
                                                tickLine={false}
                                                width={40}
                                                tick={{fontSize: 11, fill: '#6c757d'}}
                                            />
                                            <Tooltip cursor={{fill: 'transparent'}} />
                                            <Legend wrapperStyle={{fontSize: '12px'}} />

                                            <Bar dataKey="kapasite" name="Kapasite" fill="#dee2e6" barSize={12} radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="ortalama_yolcu" name="Beklenen" fill="#0dcaf0" barSize={8} radius={[0, 4, 4, 0]} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                                    <Bus size={48} className="mb-2 opacity-25" />
                                    <small className="text-center">Analiz verisi bulunamadı.<br/>Tarife dosyasını kontrol edin.</small>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* TABLO: Saatlik Detaylar (DÜZELTME 6: Her zaman görünmesi için period şartı kaldırıldı) */}
            {capacityData.length > 0 && (
                <Card className="shadow-sm border-0 overflow-hidden">
                    <Card.Header className="bg-white py-3 border-bottom border-light d-flex justify-content-between align-items-center">
                        <h6 className="m-0 fw-bold text-dark">Saatlik Sefer Planlaması</h6>
                        <Button variant="link" className="text-decoration-none p-0 text-primary fw-bold" size="sm">
                            Detaylı Rapor <ArrowRight size={14} className="ms-1" />
                        </Button>
                    </Card.Header>
                    <div className="table-responsive">
                        <Table hover className="mb-0 align-middle">
                            <thead className="bg-light text-secondary small text-uppercase">
                                <tr>
                                    <th className="ps-4">Saat</th>
                                    <th>Sefer Sayısı</th>
                                    <th>Kapasite</th>
                                    <th>Tahmini Yolcu</th>
                                    <th style={{width: '25%'}}>Doluluk</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {capacityData.map((row, idx) => {
                                    // Güvenli veri erişimi
                                    const doluluk = row.doluluk_yuzdesi || 0;
                                    const seferSayisi = row.sefer_sayisi || 0;
                                    const kapasite = row.kapasite || 0;
                                    const yolcu = row.ortalama_yolcu || 0;
                                    
                                    return (
                                        <tr key={idx}>
                                            <td className="ps-4 fw-bold">{row.saat || '-'}</td>
                                            <td>{seferSayisi}</td>
                                            <td className="text-muted">{kapasite}</td>
                                            <td className="fw-medium">{yolcu}</td>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    <div className="progress flex-grow-1" style={{height: '6px'}}>
                                                        <div
                                                            className={`progress-bar ${doluluk > 90 ? 'bg-danger' : (doluluk > 70 ? 'bg-warning' : 'bg-success')}`}
                                                            role="progressbar"
                                                            style={{width: `${Math.min(doluluk, 100)}%`}}
                                                        ></div>
                                                    </div>
                                                    <span className="ms-2 small text-muted">%{doluluk}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {doluluk > 100 ? (
                                                    <Badge bg="danger-subtle" text="danger">Yetersiz</Badge>
                                                ) : doluluk > 80 ? (
                                                    <Badge bg="warning-subtle" text="warning">Yoğun</Badge>
                                                ) : (
                                                    <Badge bg="success-subtle" text="success">Uygun</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                </Card>
            )}
        </>
      )}
    </Container>
  );
};

// --- YARDIMCI BİLEŞENLER ---

const KpiCard = ({ title, value, icon, sub, color, isAlert }) => (
    <Card className={`border-0 shadow-sm h-100 ${isAlert ? 'border-start border-4 border-danger' : ''}`}>
        <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-2">
                <div className={`p-2 rounded bg-${color}-subtle text-${color}`}>
                    {icon}
                </div>
                {isAlert && <Badge bg="danger" className="rounded-pill">!</Badge>}
            </div>
            <h3 className="fw-bold text-dark mb-1">{value}</h3>
            <div className="text-secondary fw-medium small mb-2">{title}</div>
            {sub && <small className="text-muted d-flex align-items-center"><div className="bg-secondary rounded-circle me-1" style={{width: 4, height: 4}}></div> {sub}</small>}
        </Card.Body>
    </Card>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark text-white p-2 rounded shadow-sm opacity-75" style={{fontSize: '0.85rem'}}>
          <div className="fw-bold mb-1">{label}</div>
          <div className="d-flex align-items-center gap-2">
            <span className="d-inline-block rounded-circle bg-primary" style={{width: 8, height: 8}}></span>
            <span>{payload[0].value} Yolcu</span>
          </div>
        </div>
      );
    }
    return null;
  };

export default Dashboard;