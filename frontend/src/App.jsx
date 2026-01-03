import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';


import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Harita from './components/Harita';
import HatYonetimi from './components/HatYonetimi';
import Login from './components/Login';
import Register from './components/Register';
import Ayarlar from './components/Ayarlar';

const OperatorRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const role = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" />;


  if (role !== 'operator') return <Navigate to="/harita" />;

  return children;
};


const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('access_token');
    return token ? children : <Navigate to="/login" />;
};

const MainLayout = ({ children }) => {
  const location = useLocation();
  const hideSidebar = ['/login', '/register'].includes(location.pathname);


  const role = localStorage.getItem('role');
  const isUser = role === 'user';

  return (
    <div className="d-flex bg-light min-vh-100">
      {!hideSidebar && !isUser && <Sidebar />}


      <div className="flex-grow-1 d-flex flex-column position-relative" style={{overflowX: 'hidden'}}>
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />


          <Route path="/" element={<OperatorRoute><Dashboard /></OperatorRoute>} />
          <Route path="/hat-yonetimi" element={<OperatorRoute><HatYonetimi /></OperatorRoute>} />
            <Route path="/ayarlar" element={<PrivateRoute><Ayarlar /></PrivateRoute>} />

          <Route path="/harita" element={<PrivateRoute><Harita /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;