import { useState } from 'react';
import LottiePlayer from './LottiePlayer.jsx';

const loadHero = () => import('../assets/animation/landingpage_langkahbaswara.json');

export default function Hero({ onExplore, onSearch }) {
  const [q, setQ] = useState('');
  const [ready, setReady] = useState(false);

  return (
    <div className={`hero-landing${ready ? ' is-animated' : ''}`}>
      <LottiePlayer load={loadHero} width={1920} height={1203} onReady={() => setReady(true)} />
      <div className="container hero-inner">
        <div className="hero-content-left">
          <h1 className="hero-title">
            Jelajahi Keindahan Bali,<br />
            <span className="hero-nowrap">Dalam Satu Genggaman.</span>
          </h1>
          <p className="hero-tagline">
            Temukan lebih dari 700 destinasi wisata impian dan susun rute perjalanan terbaikmu secara efisien bersama Langkah Baswara.
          </p>
          <button type="button" className="btn-hero-explore" onClick={onExplore}>
            Jelajahi Sekarang
          </button>
        </div>
        <div className="hero-search-wrapper">
          <form
            className="hero-search-box"
            id="heroSearchForm"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(q.trim());
            }}
          >
            <input
              type="text"
              id="heroSearchInput"
              className="hero-search-input"
              placeholder="Masukkan kata kunci atau nama tempat..."
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="hero-search-btn" aria-label="Cari Destinasi">
              <i className="bi bi-search"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}