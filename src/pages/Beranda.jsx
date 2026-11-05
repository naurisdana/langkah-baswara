import { useState } from 'react';
import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CardWisata from '../components/CardWisata.jsx';
import FaqSection from '../components/FaqSection.jsx';
import { DESTINATIONS, CHIPS } from '../data/destinations.js';

const STEPS = [
  ['1', 'Tentukan Preferensi', 'Pilih kategori wisata (alam, budaya, umum) atau wilayah kabupaten yang ingin kamu kunjungi.'],
  ['2', 'Gunakan Filter & Peta', 'Manfaatkan fitur analisis radius (buffering) dan peta interaktif untuk melihat titik lokasi terdekat.'],
  ['3', 'Dapatkan Rute Terbaik', 'Dapatkan rekomendasi lokasi serta rute perjalanan teroptimasi untuk menghemat waktu dan biaya kamu.'],
];

function Steps() {
  return (
    <div className="steps-landing-section">
      <div className="container">
        <div className="steps-header text-center mb-5">
          <h2 className="steps-title">
            Rencanakan <span className="highlight-oval-yellow">Liburanmu</span><br />dalam 3 Langkah
          </h2>
        </div>
        <div className="steps-container position-relative">
          <div className="steps-connector-line d-none d-md-block"></div>
          <div className="row g-4 text-center justify-content-center">
            {STEPS.map(([n, title, desc]) => (
              <div className="col-md-4" key={n}>
                <div className="step-item">
                  <div className="step-circle-badge">{n}</div>
                  <h3 className="step-item-title">{title}</h3>
                  <p className="step-item-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Beranda({ user, onNeedLogin, onExplore, onSearch, onOpenMap }) {
  const [filter, setFilter] = useState('all');
  const [favs, setFavs] = useState({});

  const toggleFav = (key) => {
    if (!user) return onNeedLogin(); // favorit hanya untuk yang sudah masuk
    setFavs((f) => ({ ...f, [key]: !f[key] }));
  };

  return (
    <div className="landing-wrap">
      <Hero onExplore={onExplore} onSearch={onSearch} />
      <About onExplore={onExplore} />
      <Steps />

      <div className="container">
        <div className="popular-landing-section">
          <div className="popular-header text-center mb-4">
            <h2 className="popular-section-title mb-3">
              <span className="highlight-oval-yellow">Temukan</span> Destinasi<br />Populer di Bali.
            </h2>
            <div className="landing-filter-chips d-flex justify-content-center align-items-center gap-2 flex-wrap">
              {CHIPS.map(([id, label]) => (
                <button key={id} type="button" className={`landing-chip${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="row g-4" id="landingDestCards">
            {DESTINATIONS.filter((d) => filter === 'all' || d.cat.split(' ').includes(filter)).map((d) => (
              <div className="col-lg-4 col-md-6 landing-card-col" key={d.key}>
                <CardWisata dest={d} isFav={!!favs[d.key]} onToggleFav={toggleFav} onOpenMap={onOpenMap} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <FaqSection />
    </div>
  );
}