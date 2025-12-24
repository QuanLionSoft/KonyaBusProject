import React, { useState } from 'react';
import axios from 'axios';
import { Container, Card, Form, Button, Alert, Nav } from 'react-bootstrap';
import { Bus, Key, User, ShieldAlert } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Giriş Türü: 'operator' veya 'user'
  const [loginType, setLoginType] = useState('operator');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/login/', {
        username,
        password
      });

      const role = res.data.role; // Backend'den gelen rol

      // Güvenlik Kontrolü: Operatör panelinden giren 'user' ise uyarı ver
      if (loginType === 'operator' && role !== 'operator') {
         setError('Yetkisiz Giriş! Bu panel sadece Operatörler içindir.');
         return;
      }

      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('username', username);
      localStorage.setItem('role', role);

      // Rola göre yönlendirme
      if (role === 'operator') {
          window.location.href = '/'; // Dashboard
      } else {
          window.location.href = '/harita'; // Normal kullanıcı Harita'ya gider
      }

    } catch (err) {
      setError('Kullanıcı adı veya şifre hatalı!');
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <Container style={{maxWidth: '420px'}}>
            <Card className="border-0 shadow-lg overflow-hidden">
                {/* Üst Sekmeler */}
                <div className="d-flex border-bottom">
                    <div
                        onClick={() => setLoginType('operator')}
                        className={`flex-grow-1 p-3 text-center cursor-pointer fw-bold ${loginType === 'operator' ? 'bg-primary text-white' : 'bg-light text-muted'}`}
                        style={{cursor: 'pointer'}}
                    >
                        <ShieldAlert size={18} className="me-2"/>
                        OPERATÖR
                    </div>
                    <div
                        onClick={() => setLoginType('user')}
                        className={`flex-grow-1 p-3 text-center cursor-pointer fw-bold ${loginType === 'user' ? 'bg-success text-white' : 'bg-light text-muted'}`}
                        style={{cursor: 'pointer'}}
                    >
                        <User size={18} className="me-2"/>
                        YOLCU
                    </div>
                </div>

                <Card.Body className="p-5">
                    <div className="text-center mb-4">
                        <div className={`text-white p-3 rounded-circle d-inline-flex mb-3 ${loginType === 'operator' ? 'bg-primary' : 'bg-success'}`}>
                            <Bus size={32} />
                        </div>
                        <h4 className="fw-bold text-dark">
                            {loginType === 'operator' ? 'Yönetim Paneli' : 'KonyaBus Giriş'}
                        </h4>
                        <p className="text-muted small">Lütfen kimlik bilgilerinizi doğrulayın</p>
                    </div>

                    {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                    <Form onSubmit={handleLogin}>
                        <Form.Group className="mb-3">
                            <div className="input-group">
                                <span className="input-group-text bg-white"><User size={18}/></span>
                                <Form.Control
                                    type="text" placeholder="Kullanıcı Adı"
                                    value={username} onChange={e => setUsername(e.target.value)} required
                                />
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <div className="input-group">
                                <span className="input-group-text bg-white"><Key size={18}/></span>
                                <Form.Control
                                    type="password" placeholder="Şifre"
                                    value={password} onChange={e => setPassword(e.target.value)} required
                                />
                            </div>
                        </Form.Group>

                        <Button
                            variant={loginType === 'operator' ? 'primary' : 'success'}
                            type="submit"
                            className="w-100 fw-bold py-2 mb-3"
                        >
                            GİRİŞ YAP
                        </Button>

                        <div className="text-center small">
                            <a href="/register" className="text-decoration-none fw-bold text-secondary">Yeni Hesap Oluştur</a>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    </div>
  );
};
export default Login;