import { useEffect, useRef, useState } from 'react';
import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CardWisata from '../components/CardWisata.jsx';
import DestPopup from '../components/DestPopup.jsx';
import FaqSection from '../components/FaqSection.jsx';
import { CHIPS, photoForPlace } from '../data/destinations.js';
import { detailJelajahi, populerBeranda, searchBeranda } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

const STEP_CARDS = [
  { tone: 'green', clip: '#2f6a34', pin: -7 },
  { tone: 'gold', clip: '#f0c14a', pin: 4 },
  { tone: 'sky', clip: '#7fd4ea', pin: 8 },
];

const ROPE = { x0: -40, x1: 1040, y0: 16, y1: 320, viewW: 1000, viewH: 210, px: 200 };

function ropeTop(along) {
  const viewX = along * ROPE.viewW;
  const t = (viewX - ROPE.x0) / (ROPE.x1 - ROPE.x0);
  const y = ROPE.y0 + 2 * (ROPE.y1 - ROPE.y0) * t * (1 - t);
  return (y / ROPE.viewH) * ROPE.px + 14;
}

function loopShifts(index, pos) {
  const turn = Math.round((pos - index) / 3);
  return [turn - 1, turn, turn + 1];
}

function Steps() {
  const { t } = useI18n();
  const railRef = useRef(null);
  const dragRef = useRef(null);
  const suppressRef = useRef(false);
  const frameRef = useRef(0);
  const posRef = useRef(1);
  const spreadRef = useRef(0.32);
  const [pos, setPos] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [spread, setSpread] = useState(0.32);

  const place = (value) => {
    posRef.current = value;
    setPos(value);
  };

  const glideTo = (target) => {
    cancelAnimationFrame(frameRef.current);
    const from = posRef.current;
    const distance = target - from;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || Math.abs(distance) < 0.001) {
      place(target);
      return;
    }
    const duration = Math.min(720, 420 + Math.abs(distance) * 180);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = Math.sin((t * Math.PI) / 2);
      place(from + distance * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const apply = () => {
      const next = rail.clientWidth < 720 ? 0.4 : 0.32;
      spreadRef.current = next;
      setSpread(next);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(rail);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(frameRef.current);
    dragRef.current = { id: e.pointerId, x: e.clientX, moved: false, origin: posRef.current };
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      suppressRef.current = true;
      setDragging(true);
      try { railRef.current?.setPointerCapture(e.pointerId); } catch { /* pointer sintetis */ }
    }
    const width = railRef.current?.clientWidth || 1;
    place(drag.origin - dx / (width * spreadRef.current));
  };

  const endPointer = (e) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    dragRef.current = null;
    if (railRef.current?.hasPointerCapture?.(e.pointerId)) {
      try { railRef.current.releasePointerCapture(e.pointerId); } catch { /* sudah lepas */ }
    }
    if (!moved) return;
    setDragging(false);
    const delta = posRef.current - drag.origin;
    let target = Math.round(posRef.current);
    if (Math.abs(delta) > 0.12 && target === Math.round(drag.origin)) {
      target = Math.round(drag.origin) + Math.sign(delta);
    }
    glideTo(target);
  };

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    glideTo(Math.round(posRef.current) + (e.key === 'ArrowRight' ? 1 : -1));
  };

  return (
    <section
      className="steps-landing-section"
      aria-roledescription="carousel"
      aria-label={`${t('steps.h1')} ${t('steps.h2')} ${t('steps.h3')}`}
      onKeyDown={onKeyDown}
    >
      <h2 className="steps-title">
        <span className="steps-title-line">
          {t('steps.h1')} <span className="highlight-oval-yellow">{t('steps.h2')}</span>
        </span>
        <span className="steps-title-line">{t('steps.h3')}</span>
      </h2>
      <div
        className={`steps-rail${dragging ? ' is-dragging' : ''}`}
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <svg className="steps-rope" viewBox={`0 0 ${ROPE.viewW} ${ROPE.viewH}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={`M${ROPE.x0} ${ROPE.y0} Q 500 ${ROPE.y1} ${ROPE.x1} ${ROPE.y0}`} fill="none" stroke="#2a241c" strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {STEP_CARDS.map((card, i) => loopShifts(i, pos).map((turn) => {
          const d = i + turn * 3 - pos;
          if (Math.abs(d) > 2.4) return null;
          const along = 0.5 + d * spread;
          const y = ropeTop(along);
          const ad = Math.abs(d);
          const focus = Math.max(0, 1 - ad);
          const rot = Math.max(-7, Math.min(7, d * 7));
          const scale = 1.14 - Math.min(ad, 1) * 0.3;
          const edge = 0.52 / spread;
          const fade = ad <= edge ? 1 : Math.max(0, 1 - (ad - edge) / 0.5);
          const nearest = ((Math.round(pos) % 3) + 3) % 3;
          const primary = ad <= Math.min(...loopShifts(i, pos).map((shift) => Math.abs(i + shift * 3 - pos)));
          return (
            <button
              key={`${card.tone}-${turn}`}
              type="button"
              className={`steps-card is-${card.tone}${ad < 0.35 ? ' is-focus' : ''}`}
              data-step={i}
              data-d={d}
              style={{
                left: `${along * 100}%`,
                top: `${y}px`,
                transform: `translateX(-50%) rotate(${rot}deg) scale(${scale})`,
                zIndex: Math.round(30 - ad * 12),
                opacity: fade,
                '--focus': focus,
                '--clip': card.clip,
                '--pin': `${card.pin}deg`,
              }}
              tabIndex={primary ? 0 : -1}
              aria-hidden={primary ? undefined : true}
              aria-current={primary && i === nearest ? 'true' : undefined}
              aria-label={t(`steps.${i + 1}.t`)}
              onClick={(e) => {
                if (suppressRef.current) {
                  suppressRef.current = false;
                  return;
                }
                glideTo(posRef.current + Number(e.currentTarget.dataset.d));
              }}
            >
              <span className="steps-clip" aria-hidden="true" />
              <span className="steps-card-sheet">
                <span className="steps-card-face">
                  <span className="steps-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="steps-copy">{t(`steps.${i + 1}.d`)}</span>
                </span>
              </span>
            </button>
          );
        }))}
      </div>
    </section>
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