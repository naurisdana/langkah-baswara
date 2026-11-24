import { useEffect, useRef, useState } from 'react';
import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CardWisata from '../components/CardWisata.jsx';
import DestPopup from '../components/DestPopup.jsx';
import FaqSection from '../components/FaqSection.jsx';
import { CHIPS, photoForPlace } from '../data/destinations.js';
import { detailJelajahi, populerBeranda, searchBeranda } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

function Steps() {
  const { t } = useI18n();
  const steps = [1, 2, 3];
  return (
    <div className="steps-landing-section">
      <div className="container">
        <div className="steps-header text-center mb-5">
          <h2 className="steps-title">
            {t('steps.h1')} <span className="highlight-oval-yellow">{t('steps.h2')}</span><br />{t('steps.h3')}
          </h2>
        </div>
        <div className="steps-container position-relative">
          <div className="steps-connector-line d-none d-md-block"></div>
          <div className="row g-4 text-center justify-content-center">
            {steps.map((n) => (
              <div className="col-md-4" key={n}>
                <div className="step-item">
                  <div className="step-circle-badge">{n}</div>
                  <h3 className="step-item-title">{t(`steps.${n}.t`)}</h3>
                  <p className="step-item-desc">{t(`steps.${n}.d`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function fromBlurb(text) {
  const s = String(text || '');
  const cat = s.match(/termasuk Wisata\s+(.+?)\s+di\s+/i);
  const kab = s.match(/\bdi\s+(Kabupaten\s+[^.]*)/i);
  return {
    kategori: cat ? cat[1].trim() : '',
    lokasi: kab ? kab[1].trim() : '',
  };
}

function toCard(row, t) {
  const nama = String(row.nama || '').trim() || t('card.name');
  const rating = row.rating == null || row.rating === '' ? null : Number(row.rating);
  const remote = typeof row.foto === 'string' ? row.foto.trim() : '';
  const local = photoForPlace({ nama }) || [];
  const parsed = fromBlurb(row.deskripsi);
  const lokasi = row.lokasi || [row.desa_kelurahan, row.kabupaten].filter(Boolean).join(', ') || parsed.lokasi;
  return {
    key: String(row.id ?? nama),
    id: row.id,
    img: remote ? [remote, ...local] : local,
    title: nama,
    rating: Number.isFinite(rating) ? String(rating) : '–',
    kategori: row.kategori || parsed.kategori,
    lokasi,
    match: nama,
    blurb: row.deskripsi || t('card.blurb', { name: nama }),
  };
}

async function withDetails(cards) {
  return Promise.all(cards.map(async (card) => {
    if (card.id == null || card.id === '') return card;
    const r = await detailJelajahi(card.id);
    const detail = r.ok ? (r.data?.data && !Array.isArray(r.data.data) ? r.data.data : r.data) : null;
    if (!detail || typeof detail !== 'object' || detail.nama == null && detail.lokasi == null) return card;
    const remote = typeof detail.foto === 'string' ? detail.foto.trim() : '';
    const img = Array.isArray(card.img) ? card.img : [];
    const lokasi = detail.lokasi || [detail.desa_kelurahan, detail.kabupaten].filter(Boolean).join(', ');
    const rating = detail.rating == null || detail.rating === '' ? null : Number(detail.rating);
    return {
      ...card,
      title: detail.nama || card.title,
      kategori: detail.kategori || card.kategori,
      lokasi: lokasi || card.lokasi,
      rating: Number.isFinite(rating) ? String(rating) : card.rating,
      img: img.length ? img : (remote ? [remote] : []),
      blurb: detail.deskripsi || card.blurb,
    };
  }));
}

function DestGrid({ items, saved, onToggleSaved, onOpenMap, onOpenDetail }) {
  const wished = new Set((saved.wishlist || []).map((item) => item.key));
  const visited = new Set((saved.visited || []).map((item) => item.key));
  return (
    <div className="row g-4">
      {items.map((d) => (
        <div className="col-lg-4 col-md-6 landing-card-col" key={d.key}>
          <CardWisata
            dest={d}
            inWishlist={wished.has(d.key)}
            visited={visited.has(d.key)}
            onToggleWishlist={(place) => onToggleSaved('wishlist', place)}
            onToggleVisited={(place) => onToggleSaved('visited', place)}
            onOpenMap={onOpenMap}
            onOpenDetail={onOpenDetail}
          />
        </div>
      ))}
    </div>
  );
}

export default function Beranda({ user, saved, onToggleSaved, onNeedLogin, onExplore, onOpenMap, onReady }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [populer, setPopuler] = useState([]);
  const [popLoading, setPopLoading] = useState(true);
  const [popError, setPopError] = useState(null);
  const [searched, setSearched] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const resultsRef = useRef(null);
  const toldReady = useRef(false);

  const toggleSaved = (kind, place) => {
    if (!user) return onNeedLogin();
    onToggleSaved(kind, place);
  };

  useEffect(() => {
    let alive = true;
    setPopLoading(true);
    setPopError(null);
    (async () => {
      const r = await populerBeranda(filter);
      if (!alive) return;
      if (!r.ok) {
        setPopuler([]);
        setPopError(r.message || t('pop.error'));
        setPopLoading(false);
        return;
      }
      const rows = (r.data && r.data.data) || [];
      const cards = rows.map((row) => toCard(row, t));
      const rich = await withDetails(cards);
      if (!alive) return;
      setPopuler(rich);
      setPopLoading(false);
    })();
    return () => { alive = false; };
  }, [filter, t]);

  useEffect(() => {
    if (popLoading || toldReady.current) return;
    toldReady.current = true;
    onReady?.();
  }, [popLoading, onReady]);

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
      setSearchError(r.message || t('search.fail'));
      return;
    }
    const cards = ((r.data && r.data.data) || []).map((row) => toCard(row, t));
    setResults(cards);
    setResults(await withDetails(cards));
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
              <h2 className="popular-section-title mb-2">{t('search.title', { q: searched })}</h2>
            </div>
            {searching ? <p className="text-center text-muted">{t('search.loading')}</p> : null}
            {searchError ? <p className="text-center text-muted">{searchError}</p> : null}
            {!searching && !searchError && results.length === 0 ? (
              <p className="text-center text-muted">{t('search.empty')}</p>
            ) : null}
            {!searching && results.length > 0 ? (
              <DestGrid items={results} saved={saved} onToggleSaved={toggleSaved} onOpenMap={onOpenMap} onOpenDetail={setDetail} />
            ) : null}
          </div>
        ) : null}

        <div className="popular-landing-section">
          <div className="popular-header text-center mb-4">
            <h2 className="popular-section-title mb-3">
              <span className="highlight-oval-yellow">{t('pop.find')}</span> {t('pop.rest')}<br />{t('pop.rest2')}
            </h2>
            <div className="landing-filter-chips d-flex justify-content-center align-items-center gap-2 flex-wrap">
              {CHIPS.map(([id]) => (
                <button key={id} type="button" className={`landing-chip${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
                  {t(`chip.${id}`)}
                </button>
              ))}
            </div>
          </div>
          {popLoading ? <p className="text-center text-muted">{t('pop.loading')}</p> : null}
          {popError ? <p className="text-center text-muted">{popError}</p> : null}
          {!popLoading && !popError && populer.length === 0 ? (
            <p className="text-center text-muted">{t('pop.empty')}</p>
          ) : null}
          {!popLoading && populer.length > 0 ? (
            <DestGrid items={populer} saved={saved} onToggleSaved={toggleSaved} onOpenMap={onOpenMap} onOpenDetail={setDetail} />
          ) : null}
        </div>
      </div>

      <FaqSection />
      <DestPopup dest={detail} onClose={() => setDetail(null)} onOpenMap={(dest) => { setDetail(null); onOpenMap(dest); }} />
    </div>
  );
}