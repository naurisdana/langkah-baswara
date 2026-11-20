import { useEffect, useRef, useState } from 'react';
import LottiePlayer from './LottiePlayer.jsx';

const loadHow1 = () => import('../assets/animation/howto_bagian1.json');
const loadHow2 = () => import('../assets/animation/howto_bagian2.json');
const loadHow3 = () => import('../assets/animation/howto_bagian3.json');
const loadHow4 = () => import('../assets/animation/howto_bagian4.json');

const FEATURES = [
  {
    title: 'Tentukan Titik Awal',
    desc: 'Pakai lokasi kamu atau pilih titik di peta, lalu terapkan untuk melihat destinasi di sekitarmu.',
    load: loadHow4,
    w: 533,
    h: 520,
  },
  {
    title: 'Peta Interaktif',
    desc: 'Geser peta, ganti tampilan satelit, dan temukan tempat wisata langsung di Pulau Bali.',
    load: loadHow1,
    w: 554,
    h: 420,
  },
  {
    title: 'Simpan ke Wishlist',
    desc: 'Tandai dan simpan tempat wisata favoritmu agar mudah dilihat kembali saat menyusun rencana liburan.',
    load: loadHow2,
    w: 510,
    h: 349,
  },
  {
    title: 'Cari & Lihat Detail',
    desc: 'Cari destinasi, buka kartunya, dan lihat lokasi serta informasi tempat yang ingin kamu kunjungi.',
    load: loadHow3,
    w: 694,
    h: 499,
  },
];

/* Beberapa set disambung supaya geseran bisa berputar tanpa mentok.
   Posisinya hanya berubah saat digeser atau titik di bawah ditekan. */
const N = FEATURES.length;
const COPIES = 3;
const START = 0;

const ITEMS = [];
for (let c = 0; c < COPIES; c += 1) {
  FEATURES.forEach((f, i) => ITEMS.push({ f, n: i + 1, clone: c !== 0, key: `${c}:${i}` }));
}

const mod = (i) => ((i % N) + N) % N;

export default function FeatureWheel({ captureWheel = false }) {
  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const apiRef = useRef(null);
  const [active, setActive] = useState(START);

  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track) return undefined;

    const cards = Array.from(track.children);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cardCenter = (card) => card.offsetLeft + card.offsetWidth / 2;

    let setWidth = 0;
    let x = 0;
    let placed = false;
    let dragging = false;
    let activeIndex = -1;
    let raf = 0;
    let glide = null;
    let pointer = null;
    let velocity = 0;
    let lastMove = 0;

    const measure = () => {
      const next = cards[N];
      const first = cards[0];
      if (!first || !next) return 0;
      setWidth = next.offsetLeft - first.offsetLeft;
      return setWidth;
    };

    const wrap = (v) => {
      if (!setWidth) return 0;
      const w = setWidth;
      v %= w;
      return v < 0 ? v + w : v;
    };

    const shortest = (from, to) => {
      let d = wrap(to) - wrap(from);
      if (d > setWidth / 2) d -= setWidth;
      if (d < -setWidth / 2) d += setWidth;
      return d;
    };

    const apply = () => {
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
      const mid = view.getBoundingClientRect().left + view.clientWidth / 2;
      const span = Math.max(view.clientWidth * 0.72, 1);
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - mid);
        const t = Math.min(dist / span, 1);
        const scale = reduceMotion ? 1 : 1 - t * 0.14;
        card.style.transform = `scale(${scale})`;
        card.style.boxShadow = t < 0.35
          ? '0 18px 36px rgba(40, 60, 20, 0.16)'
          : '0 8px 18px rgba(40, 60, 20, 0.05)';
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      const logical = mod(best);
      if (logical !== activeIndex) {
        activeIndex = logical;
        setActive(logical);
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const goTo = (logical, smooth) => {
      if (!measure()) return;
      const feature = ((logical % N) + N) % N;
      const target = wrap(cardCenter(cards[feature]) - view.clientWidth / 2);
      if (!smooth || reduceMotion) {
        glide = null;
        x = target;
        apply();
        return;
      }
      const delta = shortest(x, target);
      glide = {
        from: x,
        delta,
        t0: performance.now(),
        dur: Math.min(480, Math.max(340, Math.abs(delta) * 0.55)),
      };
      kick();
    };

    const frame = (now) => {
      raf = 0;
      if (!setWidth) measure();
      if (!(setWidth && view.clientWidth)) {
        kick();
        return;
      }
      if (!placed) {
        x = wrap(cardCenter(cards[START]) - view.clientWidth / 2);
        placed = true;
      } else if (glide && !dragging) {
        const t = Math.min(1, (now - glide.t0) / glide.dur);
        const eased = 1 - (1 - t) ** 4;
        x = wrap(glide.from + glide.delta * eased);
        if (t >= 1) glide = null;
      }
      apply();
      if ((glide && !dragging) || !placed) kick();
    };
    kick();

    const settle = () => {
      if (!measure()) return;
      apply();
      const speed = velocity;
      velocity = 0;
      let feature = activeIndex;
      if (speed > 0.45) feature += 1;
      else if (speed < -0.45) feature -= 1;
      goTo(feature, true);
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      velocity = 0;
      lastMove = performance.now();
      glide = null;
    };
    const onPointerMove = (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      if (!pointer.moved) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          pointer = null;
          return;
        }
        pointer.moved = true;
        dragging = true;
        glide = null;
        view.classList.add('is-dragging');
        try { view.setPointerCapture(e.pointerId); } catch { /* pointer sintetis tidak bisa ditangkap */ }
      }
      const now = performance.now();
      const dt = Math.max(1, now - lastMove);
      velocity = velocity * 0.65 + (-dx / dt) * 0.35;
      lastMove = now;
      x = wrap(x - dx);
      pointer.x = e.clientX;
      kick();
    };
    const endPointer = (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const wasDragging = dragging;
      if (dragging && view.hasPointerCapture(e.pointerId)) view.releasePointerCapture(e.pointerId);
      dragging = false;
      pointer = null;
      view.classList.remove('is-dragging');
      if (wasDragging) settle();
    };

    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIndex + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIndex - 1, true); }
    };

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) && e.deltaX === 0) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      glide = null;
      x = wrap(x + delta);
      apply();
    };

    const ro = new ResizeObserver(() => { measure(); });
    ro.observe(view);

    view.addEventListener('pointerdown', onPointerDown);
    view.addEventListener('pointermove', onPointerMove);
    view.addEventListener('pointerup', endPointer);
    view.addEventListener('pointercancel', endPointer);
    view.addEventListener('keydown', onKeyDown);
    if (captureWheel) view.addEventListener('wheel', onWheel, { passive: false });

    apiRef.current = { goTo };

    return () => {
      apiRef.current = null;
      ro.disconnect();
      cancelAnimationFrame(raf);
      view.removeEventListener('pointerdown', onPointerDown);
      view.removeEventListener('pointermove', onPointerMove);
      view.removeEventListener('pointerup', endPointer);
      view.removeEventListener('pointercancel', endPointer);
      view.removeEventListener('keydown', onKeyDown);
      view.removeEventListener('wheel', onWheel);
      view.classList.remove('is-dragging');
    };
  }, [captureWheel]);

  const goToDot = (i) => {
    apiRef.current?.goTo(i, true);
  };

  return (
    <div className="about-feature-section">
      <div className="container">
        <div className="text-center about-reveal">
          <h2 className="about-heading">
            <span className="highlight-oval-yellow">Fitur</span><br />
            <strong>Unggulan Kami</strong>
          </h2>
          <p className="about-subheading">
            Solusi lengkap dan pintar untuk membantu kamu menemukan serta menyusun alur perjalanan wisata terbaik di Pulau Bali.
          </p>
        </div>
      </div>
      <div className="about-wheel about-reveal">
        <div
          className="about-wheel-viewport"
          ref={viewRef}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label="Daftar fitur unggulan, geser atau gunakan tombol panah untuk melihat fitur lainnya"
        >
          <div className="about-wheel-track" id="aboutWheelTrack" ref={trackRef}>
            {ITEMS.map(({ f, n, clone, key }) => (
              <article
                className="about-feature-card"
                key={key}
                aria-hidden={clone ? 'true' : undefined}
              >
                <div className="afc-visual">
                  <LottiePlayer load={f.load} width={f.w} height={f.h} fit="contain" lazy />
                </div>
                <div className="afc-copy">
                  <span className="afc-kicker">{String(n).padStart(2, '0')}</span>
                  <h3 className="afc-title">{f.title}</h3>
                  <p className="afc-desc">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="about-wheel-dots" id="aboutWheelDots">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              className={i === active ? 'active' : ''}
              aria-label={`Lihat fitur ${f.title}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => goToDot(i)}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
}
