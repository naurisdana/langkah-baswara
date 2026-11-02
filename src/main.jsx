import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Urutan penting: Bootstrap & Leaflet dulu, index.css terakhir supaya bisa menimpa
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);