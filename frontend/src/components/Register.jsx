import React, { useState } from 'react';
import axios from 'axios';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { UserPlus } from 'lucide-react';

const Register = () => {
  // Varsayılan rol: user
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'user' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:8000/api/register/', formData);
      setMsg({ type: 'success', text: 'Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...' });
      setTimeout(() => window.location.href = '/login', 2000);
    } catch (err) {
      setMsg({ type: 'danger', text: 'Kayıt başarısız. Kullanıcı adı alınmış olabilir.' });
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <Container style={{maxWidth: '400px'}}>
            <Card className="border-0 shadow-lg">
                <Card.Body className="p-5">
                    <div className="text-center mb-4">
                        <UserPlus size={48} className="text-primary mb-2"/>
                        <h3 className="fw-bold">Hesap Oluştur</h3>
                    </div>

                    {msg.text && <Alert variant={msg.type}>{msg.text}</Alert>}

                    <Form onSubmit={handleRegister}>
                        <Form.Group className="mb-3">
                            <Form.Control type="text" placeholder="Kullanıcı Adı" required
                                onChange={e => setFormData({...formData, username: e.target.value})} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Control type="email" placeholder="E-Posta"
                                onChange={e => setFormData({...formData, email: e.target.value})} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Control type="password" placeholder="Şifre" required
                                onChange={e => setFormData({...formData, password: e.target.value})} />
                        </Form.Group>

                        {/* ROL SEÇİMİ */}
                        <Form.Group className="mb-4">
                            <Form.Label className="small text-muted fw-bold">Hesap Türü</Form.Label>
                            <Form.Select
                                onChange={e => setFormData({...formData, role: e.target.value})}
                                value={formData.role}
                            >
                                <option value="user">Yolcu (Normal Kullanıcı)</option>
                                <option value="operator">Operatör (Yönetici)</option>
                            </Form.Select>
                        </Form.Group>

                        <Button variant="success" type="submit" className="w-100 fw-bold">KAYDOL</Button>
                        <div className="text-center mt-3">
                            <a href="/login" className="text-decoration-none small">Giriş Yap</a>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    </div>
  );
};
export default Register;