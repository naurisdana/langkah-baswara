import { useEffect, useRef, useState } from 'react';

const FEATURES = [
  { img: 'fiturabout1.png', title: 'Wishlist', alt: 'Fitur Wishlist', desc: 'Simpan tempat wisata impianmu agar mudah menyusun rencana perjalanan.' },
  { img: 'fiturabout2.png', title: 'Filter Jarak (Radius)', alt: 'Fitur Filter Jarak (Radius)', desc: 'Cari dan temukanlah tempat-tempat seru yang lokasinya paling dekat dari posisi kamu.' },
  { img: 'fiturabout3.png', title: 'Peta Interaktif', alt: 'Fitur Peta Interaktif', desc: 'Lihat dan jelajahi sebaran tempat wisata di Bali langsung lewat peta yang mudah digunakan.' },
  { img: 'fiturabout4.png', title: 'Pencarian & Filter Cerdas', alt: 'Fitur Pencarian dan Filter Cerdas', desc: 'Cari tempat wisata sesuai kategori favoritmu (alam, budaya, budget, pantai) atau berdasarkan lokasi kabupaten.' },
  { img: 'fiturabout5.png', title: 'Detail Wisata', alt: 'Fitur Detail Wisata', desc: 'Klik titik di peta untuk melihat foto, deskripsi, dan info dari tempat yang dikunjungi.' },
];

/* Tiga set identik. Posisi digeser terus, lalu dilipat balik selebar satu set
   supaya tampilannya sama dan putaran tidak pernah mentok. */
const N = FEATURES.length;
const COPIES = 4;
const START = Math.min(2, N - 1);
const SPEED = 64;

const ITEMS = [];
for (let c = 0; c < COPIES; c += 1) {
  FEATURES.forEach((f, i) => ITEMS.push({ f, clone: c !== 0, key: `${c}:${i}` }));
}

const mod = (i) => ((i % N) + N) % N;

export default function FeatureWheel({ autoPlay = true, captureWheel = false }) {
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
    let last = performance.now();
    let glide = null;
    let pointer = null;

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

    let shown = -1;
    const apply = () => {
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
      const mid = view.getBoundingClientRect().left + view.clientWidth / 2;
      const span = (cards[0]?.offsetWidth || 1) * 1.25;
      const dists = cards.map((c) => {
        const rect = c.getBoundingClientRect();
        return Math.abs(rect.left + rect.width / 2 - mid);
      });
      let best = 0;
      dists.forEach((dist, i) => {
        const t = Math.min(dist / span, 1);
        cards[i].style.transform = `scale(${1.08 - t * 0.22})`;
        cards[i].style.opacity = `${1 - t * 0.22}`;
        if (dist < dists[best]) best = i;
      });
      if (best !== shown) {
        if (shown >= 0) cards[shown].style.boxShadow = '';
        cards[best].style.boxShadow = '0 14px 30px rgba(69, 129, 50, 0.2)';
        shown = best;
        const logical = mod(best);
        if (logical !== activeIndex) {
          activeIndex = logical;
          setActive(logical);
        }
      }
    };

    const goTo = (logical, smooth) => {
      if (!measure()) return;
      const target = wrap(cardCenter(cards[mod(logical)]) - view.clientWidth / 2);
      if (!smooth || reduceMotion) {
        glide = null;
        x = target;
        apply();
        return;
      }
      glide = { from: x, delta: shortest(x, target), t0: performance.now(), dur: 900 };
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!setWidth) measure();
      if (setWidth && view.clientWidth) {
        if (!placed) {
          x = wrap(cardCenter(cards[START]) - view.clientWidth / 2);
          placed = true;
        }
        if (glide) {
          const t = Math.min(1, (now - glide.t0) / glide.dur);
          const eased = 1 - (1 - t) ** 3;
          x = wrap(glide.from + glide.delta * eased);
          if (t >= 1) glide = null;
        } else if (autoPlay && !dragging && !reduceMotion) {
          x = wrap(x + SPEED * dt);
        }
        apply();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
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
        view.setPointerCapture(e.pointerId);
      }
      x = wrap(x - dx);
      pointer.x = e.clientX;
    };
    const endPointer = (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      if (dragging && view.hasPointerCapture(e.pointerId)) view.releasePointerCapture(e.pointerId);
      dragging = false;
      pointer = null;
      view.classList.remove('is-dragging');
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
  }, [autoPlay, captureWheel]);

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
            {ITEMS.map(({ f, clone, key }) => (
              <article
                className="about-feature-card"
                key={key}
                aria-hidden={clone ? 'true' : undefined}
              >
                <div className="afc-visual">
                  <img src={`/assets/${f.img}`} alt={clone ? '' : f.alt} draggable="false" />
                </div>
                <h3 className="afc-title">{f.title}</h3>
                <p className="afc-desc">{f.desc}</p>
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
