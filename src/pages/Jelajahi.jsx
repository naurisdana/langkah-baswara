import { useMemo, useState } from 'react';
import MapSection from '../components/MapSection.jsx';
import CardWisata from '../components/CardWisata.jsx';
import { DESTINATIONS, CHIPS } from '../data/destinations.js';

/* places/error/query/focus dari App (sama seperti props MapSection) */
export default function Jelajahi({ places, error, query, focus, user, onNeedLogin, onOpenMap }) {
  const [cat, setCat] = useState('all');
  const [favs, setFavs] = useState({});

  const toggleFav = (key) => {
    if (!user) return onNeedLogin(); // favorit hanya untuk yang sudah masuk
    setFavs((f) => ({ ...f, [key]: !f[key] }));
  };

  // Filter kategori berlaku ke peta (kategori dari data GeoJSON/API) dan ke grid kartu
  const mapPlaces = useMemo(
    () => (cat === 'all' ? places : places.filter((p) => String(p.kategori || '').toLowerCase().includes(cat))),
    [places, cat]
  );
  const cards = DESTINATIONS.filter((d) => cat === 'all' || d.cat.split(' ').includes(cat));

  return (
    <>
      <div className="container mb-3">
        <div className="landing-filter-chips d-flex justify-content-center align-items-center gap-2 flex-wrap">
          {CHIPS.map(([id, label]) => (
            <button key={id} type="button" className={`landing-chip${cat === id ? ' active' : ''}`} onClick={() => setCat(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minHeight: 500 }}>
        <MapSection places={mapPlaces} error={error} query={query} focus={focus} />
      </div>

      <div className="container mt-5">
        <div className="row g-4">
          {cards.map((d) => (
            <div className="col-lg-4 col-md-6 landing-card-col" key={d.key}>
              <CardWisata dest={d} isFav={!!favs[d.key]} onToggleFav={toggleFav} onOpenMap={onOpenMap} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}