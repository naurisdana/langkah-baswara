import { useEffect, useRef, useState } from 'react';
import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CardWisata from '../components/CardWisata.jsx';
import DestPopup from '../components/DestPopup.jsx';
import FaqSection from '../components/FaqSection.jsx';
import { CHIPS, photoForPlace } from '../data/destinations.js';
import { populerBeranda, searchBeranda } from '../lib/api.js';

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

function toCard(row) {
  const nama = String(row.nama || '').trim() || 'Destinasi';
  const rating = row.rating == null || row.rating === '' ? null : Number(row.rating);
  return {
    key: String(row.id ?? nama),
    img: photoForPlace({ nama }) || [],
    title: nama,
    rating: Number.isFinite(rating) ? String(rating) : '–',
    match: nama,
    blurb: row.deskripsi || `${nama} termasuk destinasi wisata di Bali.`,
  };
}

function DestGrid({ items, favs, onToggleFav, onOpenMap, onOpenDetail }) {
  return (
    <div className="row g-4">
      {items.map((d) => (
        <div className="col-lg-4 col-md-6 landing-card-col" key={d.key}>
          <CardWisata dest={d} isFav={!!favs[d.key]} onToggleFav={onToggleFav} onOpenMap={onOpenMap} onOpenDetail={onOpenDetail} />
        </div>
      ))}
    </div>
  );
}

export default function Beranda({ user, onNeedLogin, onExplore, onOpenMap }) {
  const [filter, setFilter] = useState('all');
  const [favs, setFavs] = useState({});
  const [detail, setDetail] = useState(null);
  const [populer, setPopuler] = useState([]);
  const [popLoading, setPopLoading] = useState(true);
  const [popError, setPopError] = useState(null);
  const [searched, setSearched] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const resultsRef = useRef(null);

  const toggleFav = (key) => {
    if (!user) return onNeedLogin(); // favorit hanya untuk yang sudah masuk
    setFavs((f) => ({ ...f, [key]: !f[key] }));
  };

  useEffect(() => {
    let alive = true;
    setPopLoading(true);
    setPopError(null);
    (async () => {
      const r = await populerBeranda(filter);
      if (!alive) return;
      setPopLoading(false);
      if (!r.ok) {
        setPopuler([]);
        setPopError(r.message || 'Destinasi populer tidak dapat dimuat.');
        return;
      }
      const rows = (r.data && r.data.data) || [];
      setPopuler(rows.map(toCard));
    })();
    return () => { alive = false; };
  }, [filter]);

  useEffect(() => {
    if (searched) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searched]);

  const runSearch = async (q) => {
    const keyword = String(q || '').trim();
    if (!keyword) return;
    setSearched(keyword);
    setSearching(true);
    setSearchError(null);
    setResults([]);
    const r = await searchBeranda(keyword);
    setSearching(false);
    if (!r.ok) {
      setSearchError(r.message || 'Pencarian gagal.');
      return;
    }
    setResults(((r.data && r.data.data) || []).map(toCard));
  };

  return (
    <div className="landing-wrap">
      <Hero onExplore={onExplore} onSearch={runSearch} />
      <About onExplore={onExplore} />
      <Steps />

      <div className="container">
        {searched ? (
          <div className="popular-landing-section" ref={resultsRef}>
            <div className="popular-header text-center mb-4">
              <h2 className="popular-section-title mb-2">Hasil pencarian “{searched}”</h2>
            </div>
            {searching ? <p className="text-center text-muted">Mencari destinasi...</p> : null}
            {searchError ? <p className="text-center text-muted">{searchError}</p> : null}
            {!searching && !searchError && results.length === 0 ? (
              <p className="text-center text-muted">Tidak ada destinasi untuk kata kunci itu.</p>
            ) : null}
            {!searching && results.length > 0 ? (
              <DestGrid items={results} favs={favs} onToggleFav={toggleFav} onOpenMap={onOpenMap} onOpenDetail={setDetail} />
            ) : null}
          </div>
        ) : null}

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
          {popLoading ? <p className="text-center text-muted">Memuat destinasi populer...</p> : null}
          {popError ? <p className="text-center text-muted">{popError}</p> : null}
          {!popLoading && !popError && populer.length === 0 ? (
            <p className="text-center text-muted">Belum ada destinasi untuk kategori ini.</p>
          ) : null}
          {!popLoading && populer.length > 0 ? (
            <DestGrid items={populer} favs={favs} onToggleFav={toggleFav} onOpenMap={onOpenMap} onOpenDetail={setDetail} />
          ) : null}
        </div>
      </div>

      <FaqSection />
      <DestPopup dest={detail} onClose={() => setDetail(null)} onOpenMap={(dest) => { setDetail(null); onOpenMap(dest); }} />
    </div>
  );
}