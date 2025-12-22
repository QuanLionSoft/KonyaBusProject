import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Bus, Settings, LogOut } from 'lucide-react';

const Sidebar = () => {
    const menuItems = [
        {
            path: "/",
            name: "Yönetim Paneli",
            icon: <LayoutDashboard size={20} />
        },
        {
            path: "/harita",
            name: "Canlı Harita",
            icon: <Map size={20} />
        },
        {
            path: "/yonetim",
            name: "Hat & Sefer Yönetimi",
            icon: <Bus size={20} />
        },
    ];

    return (
        <div className="d-flex flex-column flex-shrink-0 p-3 bg-dark text-white" style={{ width: '280px', height: '100vh' }}>
            <a href="/" className="d-flex align-items-center mb-4 mb-md-0 me-md-auto text-white text-decoration-none">
                <span className="fs-4 fw-bold ms-2">🚌 KonyaBus AI</span>
            </a>
            <hr />
            <ul className="nav nav-pills flex-column mb-auto">
                {menuItems.map((item, index) => (
                    <li className="nav-item mb-2" key={index}>
                        <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-link d-flex align-items-center text-white ${isActive ? 'active bg-primary' : ''}`
                            }
                            style={{ gap: '10px', padding: '12px 15px', borderRadius: '8px', transition: 'all 0.2s' }}
                        >
                            {item.icon}
                            <span className="fw-medium">{item.name}</span>
                        </NavLink>
                    </li>
                ))}
            </ul>
            <hr />
            <div className="dropdown">
                <a href="#" className="d-flex align-items-center text-white text-decoration-none dropdown-toggle" id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">
                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2" style={{width: 32, height: 32}}>
                        A
                    </div>
                    <strong>Admin</strong>
                </a>
                <ul className="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser1">
                    <li><a className="dropdown-item" href="#">Ayarlar</a></li>
                    <li><a className="dropdown-item" href="#">Profil</a></li>
                    <li><hr className="dropdown-divider" /></li>
                    <li><a className="dropdown-item text-danger" href="#">Çıkış Yap</a></li>
                </ul>
            </div>
        </div>
    );
};

export default Sidebar;