import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Urutan penting: Bootstrap & Leaflet dulu, index.css terakhir supaya bisa menimpa
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.jsx';
import { LanguageProvider } from './lib/i18n.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);