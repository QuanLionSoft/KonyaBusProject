import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Bootstrap ve Animasyon kütüphanelerini ekliyoruz
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css'; // <-- BU SATIRI EKLE

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)