import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { User, Lock, Bell, Moon, Sun } from 'lucide-react';

const Ayarlar = () => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // LocalStorage'dan bilgileri çek
    setUsername(localStorage.getItem('username') || 'Kullanıcı');
    const r = localStorage.getItem('role') || 'user';
    setRole(r === 'operator' ? 'Operatör (Yönetici)' : 'Yolcu (Kullanıcı)');
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setMsg('Ayarlar başarıyla güncellendi!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <Container fluid className="p-4">
      <h2 className="mb-4 fw-bold text-dark">Sistem Ayarları</h2>

      {msg && <Alert variant="success">{msg}</Alert>}

      <Row>
        {/* PROFİL KARTI */}
        <Col md={6} className="mb-4">
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white fw-bold py-3 border-bottom-0">
              <User size={20} className="me-2 text-primary"/> Profil Bilgileri
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Kullanıcı Adı</Form.Label>
                  <Form.Control type="text" value={username} disabled className="bg-light"/>
                  <Form.Text className="text-muted">Kullanıcı adı değiştirilemez.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Yetki Seviyesi</Form.Label>
                  <Form.Control type="text" value={role} disabled className="bg-light fw-bold text-primary"/>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* GÜVENLİK KARTI */}
        <Col md={6} className="mb-4">
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white fw-bold py-3 border-bottom-0">
              <Lock size={20} className="me-2 text-danger"/> Güvenlik
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSave}>
                <Form.Group className="mb-3">
                  <Form.Label>Mevcut Şifre</Form.Label>
                  <Form.Control type="password" placeholder="••••••" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Yeni Şifre</Form.Label>
                  <Form.Control type="password" placeholder="Yeni şifreniz" />
                </Form.Group>
                <Button variant="outline-danger" size="sm" type="submit">Şifreyi Güncelle</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* TERCİHLER KARTI */}
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white fw-bold py-3 border-bottom-0">
              <Bell size={20} className="me-2 text-warning"/> Tercihler
            </Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h6 className="mb-0">Karanlık Mod (Dark Mode)</h6>
                  <small className="text-muted">Arayüzü koyu renklere çevirir (Demo).</small>
                </div>
                <Form.Check
                  type="switch"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                />
              </div>
              <hr className="text-muted opacity-25"/>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-0">E-Posta Bildirimleri</h6>
                  <small className="text-muted">Kritik yoğunluk durumunda e-posta al.</small>
                </div>
                <Form.Check type="switch" defaultChecked />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Ayarlar;