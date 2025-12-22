import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Harita from './components/Harita';
import HatYonetimi from './components/HatYonetimi';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';

function App() {
  return (
    <Router>
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1 bg-light" style={{ height: '100vh', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/harita" element={<Harita />} />
            <Route path="/yonetim" element={<HatYonetimi />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;