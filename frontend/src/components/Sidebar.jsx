import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, List, Menu, ChevronLeft, ChevronRight,
  Bus, Settings, LogOut
} from 'lucide-react';
import { Button, Tooltip, OverlayTrigger } from 'react-bootstrap';

const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };
const Sidebar = () => {
  // Ekran genişliğine göre başlangıç durumu
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Pencere boyutu değişince mobil/desktop ayrımını yap
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowMobile(false); // Masaüstüne dönünce mobil menüyü kapat
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Menü Linkleri
  const menuItems = [
    { path: "/", name: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { path: "/harita", name: "Canlı Harita", icon: <Map size={20} /> },
    { path: "/hat-yonetimi", name: "Hat Yönetimi", icon: <List size={20} /> },
  ];

  // Alt Menü (Ayarlar vb.)
  const bottomItems = [
    { path: "/ayarlar", name: "Ayarlar", icon: <Settings size={20} /> },
  ];

  // --- RENDER ---

  // 1. MOBİL MENÜ BUTONU (Sadece Mobilde Görünür)
  const MobileToggle = () => (
    <Button
      variant="primary"
      className="d-md-none position-fixed top-0 start-0 m-3 z-3 shadow rounded-circle p-2"
      onClick={() => setShowMobile(!showMobile)}
    >
      <Menu size={24} color="white" />
    </Button>
  );

  // 2. SIDEBAR İÇERİĞİ
  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 text-white">
      {/* LOGO ALANI */}
      <div className={`d-flex align-items-center p-3 ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`} style={{height: '70px'}}>

        {/* Logo / Başlık */}
        {!isCollapsed && (
          <div className="d-flex align-items-center animate-fade-in">
            <div className="bg-primary text-white rounded p-1 me-2 fw-bold d-flex align-items-center justify-content-center" style={{width: 32, height: 32}}>
              <Bus size={20}/>
            </div>
            <span className="fw-bold fs-5" style={{letterSpacing: '1px'}}>KONYA<span className="text-primary">BUS</span></span>
          </div>
        )}

        {/* Desktop Collapse Butonu */}
        <Button
          variant="link"
          className="text-white-50 p-0 d-none d-md-block hover-white"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={24}/> : <ChevronLeft size={24}/>}
        </Button>

        {/* Mobil Kapatma Butonu */}
        <Button
          variant="link"
          className="text-white d-md-none ms-auto"
          onClick={() => setShowMobile(false)}
        >
          <ChevronLeft size={24}/>
        </Button>
      </div>

      <hr className="border-secondary mx-3 my-0 opacity-25"/>

      {/* MENÜ LİSTESİ */}
      <div className="flex-grow-1 py-3 overflow-y-auto">
        <div className="d-flex flex-column gap-1 px-2">
          {menuItems.map((item, idx) => (
            <NavItem key={idx} item={item} isCollapsed={isCollapsed} onClick={() => isMobile && setShowMobile(false)} />
          ))}
        </div>
      </div>

      {/* ALT MENÜ */}
      <div className="p-2 border-top border-secondary border-opacity-25 bg-black bg-opacity-25">
        {bottomItems.map((item, idx) => (
           <NavItem key={idx} item={item} isCollapsed={isCollapsed} />
        ))}

        {/* Çıkış Butonu (Örnek) */}
        <div onClick={handleLogout} className="...">
      <LogOut size={20} />
      {!isCollapsed && <span className="ms-3 fw-bold">Çıkış Yap</span>}
  </div>
      </div>
    </div>
  );

  // Sidebar Wrapper Stili
  const sidebarStyle = {
    width: isMobile ? '280px' : (isCollapsed ? '80px' : '260px'),
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: isMobile ? (showMobile ? '0' : '-280px') : '0',
    backgroundColor: '#1e293b', // Modern Dark Blue-Gray
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 1040,
    boxShadow: '4px 0 24px rgba(0,0,0,0.1)'
  };

  // Overlay (Sadece Mobilde arka planı karartmak için)
  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1039,
    display: (isMobile && showMobile) ? 'block' : 'none'
  };

  // İçerik Kaydırma (Main Content Margin)
  // Bu stil App.jsx içinde kullanılmalı ama burada sidebar'ın kapladığı alanı göstermek için
  // App.jsx'e bir prop veya class ile haber vermek gerekir.
  // Şimdilik sadece Sidebar componentini yapıyoruz.

  return (
    <>
      <MobileToggle />
      <div style={overlayStyle} onClick={() => setShowMobile(false)} />
      <div style={sidebarStyle} className="sidebar-container">
        <SidebarContent />
      </div>

      {/* Masaüstünde içerik sola kaymasın diye boş div (Spacer) */}
      {!isMobile && (
        <div style={{
            width: isCollapsed ? '80px' : '260px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0
        }} />
      )}
    </>
  );
};

// YARDIMCI BİLEŞEN: NavItem
const NavItem = ({ item, isCollapsed, onClick }) => {
  const content = (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `d-flex align-items-center text-decoration-none rounded p-2 my-1 transition-all ${
          isActive 
            ? 'bg-primary text-white shadow-sm' 
            : 'text-white-50 hover-bg-white-10 hover-text-white'
        } ${isCollapsed ? 'justify-content-center' : ''}`
      }
      style={{height: '48px'}}
    >
      <div className="d-flex align-items-center justify-content-center">
        {item.icon}
      </div>
      {!isCollapsed && (
        <span className="ms-3 fw-medium text-nowrap animate-fade-in">
          {item.name}
        </span>
      )}
    </NavLink>
  );

  // Daraltılmış modda Tooltip göster
  if (isCollapsed) {
    return (
      <OverlayTrigger
        placement="right"
        overlay={<Tooltip>{item.name}</Tooltip>}
      >
        <div>{content}</div>
      </OverlayTrigger>
    );
  }

  return content;
};

export default Sidebar;