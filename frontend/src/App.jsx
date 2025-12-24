import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Bileşenler
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Harita from './components/Harita';
import HatYonetimi from './components/HatYonetimi'; // <-- BU EKLENDİ

function App() {
  return (
    <BrowserRouter>
      <div className="d-flex bg-light min-vh-100">

        {/* Sidebar: Navigasyon Menüsü */}
        <Sidebar />

        {/* Ana İçerik Alanı */}
        {/* Sidebar mobilde gizlendiği veya desktopta daraldığı için margin-left ayarını Sidebar.jsx içindeki spacer hallediyor */}
        <div className="flex-grow-1 d-flex flex-column position-relative" style={{overflowX: 'hidden'}}>

          <Routes>
            {/* 1. Dashboard (Ana Sayfa) */}
            <Route path="/" element={<Dashboard />} />

            {/* 2. Canlı Harita */}
            <Route path="/harita" element={<Harita />} />

            {/* 3. Hat Yönetimi (YENİ EKLENEN ROTA) */}
            <Route path="/hat-yonetimi" element={<HatYonetimi />} />

            {/* Hatalı linkler için yönlendirme (Opsiyonel) */}
            <Route path="*" element={<div className="p-5 text-center"><h3>Sayfa Bulunamadı (404)</h3></div>} />
          </Routes>

        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;