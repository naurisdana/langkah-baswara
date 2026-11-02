import { useEffect, useRef, useState } from 'react';

const FEATURES = [
  { img: 'fiturabout1.png', title: 'Wishlist', alt: 'Fitur Wishlist', desc: 'Simpan tempat wisata impianmu agar mudah menyusun rencana perjalanan.' },
  { img: 'fiturabout2.png', title: 'Filter Jarak (Radius)', alt: 'Fitur Filter Jarak (Radius)', desc: 'Cari dan temukanlah tempat-tempat seru yang lokasinya paling dekat dari posisi kamu.' },
  { img: 'fiturabout3.png', title: 'Peta Interaktif', alt: 'Fitur Peta Interaktif', desc: 'Lihat dan jelajahi sebaran tempat wisata di Bali langsung lewat peta yang mudah digunakan.' },
  { img: 'fiturabout4.png', title: 'Pencarian & Filter Cerdas', alt: 'Fitur Pencarian dan Filter Cerdas', desc: 'Cari tempat wisata sesuai kategori favoritmu (alam, budaya, budget, pantai) atau berdasarkan lokasi kabupaten.' },
  { img: 'fiturabout5.png', title: 'Detail Wisata', alt: 'Fitur Detail Wisata', desc: 'Klik titik di peta untuk melihat foto, deskripsi, dan info dari tempat yang dikunjungi.' },
];

/* ---------------------------------------------------------------------
   Loop tanpa ujung: set kartu asli diapit COPIES set kloning di kiri & kanan.
   Urutan DOM: [kloning x2][ASLI][kloning x2]. Begitu pengguna masuk ke set
   kloning, posisi scroll dipindah diam-diam ke kartu yang sama di set asli
   (lihat recenter) — tampilannya identik sehingga tidak terlihat ada lompatan.
   --------------------------------------------------------------------- */
const N = FEATURES.length;
const COPIES = 2;
const HOME = COPIES * N; // indeks kartu pertama di set asli
const START_INDEX = HOME + Math.min(2, N - 1); // kartu ke-3 berada di tengah saat pertama tampil
const mod = (i) => ((i % N) + N) % N;

const ITEMS = [];
for (let c = -COPIES; c <= COPIES; c += 1) {
  FEATURES.forEach((f, i) => ITEMS.push({ f, clone: c !== 0, key: `${c}:${i}` }));
}

/**
 * Props:
 *  - autoPlay     : geser otomatis ke kartu berikutnya (default true)
 *  - interval     : jeda autoplay dalam ms (default 3500)
 *  - captureWheel : kalau true, roda mouse vertikal di atas slider ikut menggeser slider
 *                   (default false supaya scroll halaman tidak "tersangkut"; trackpad/Shift+roda
 *                   selalu bisa menggeser slider)
 */
export default function FeatureWheel({ autoPlay = true, interval = 3500, captureWheel = false }) {
  const trackRef = useRef(null);
  const apiRef = useRef(null);
  const [active, setActive] = useState(START_INDEX); // indeks GLOBAL kartu di tengah (0 … ITEMS.length-1)

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const cards = Array.from(track.children);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let activeIndex = -1;
    let initialized = false;
    let ticking = false;
    let dragging = false;
    let pressed = false;
    let hovered = false;
    let focused = false;
    let lastScroll = 0;
    let idleTimer = null;
    let playTimer = null;
    let raf = 0;
    let startX = 0;
    let startScroll = 0;

    const cardCenter = (card) => card.offsetLeft + card.offsetWidth / 2;

    const scrollToCard = (i, smooth) => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
      track.scrollTo({
        left: cardCenter(card) - track.clientWidth / 2,
        behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
      });
    };

    const nearestIndex = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(cardCenter(c) - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    };

    // Skala & opacity mengikuti jarak ke tengah (efek roda); indeks aktif → state React
    const update = () => {
      ticking = false;
      const mid = track.scrollLeft + track.clientWidth / 2;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      cards.forEach((c) => {
        const t = Math.min(Math.abs(cardCenter(c) - mid) / (c.offsetWidth + gap), 1);
        c.style.transform = `scale(${(1.06 - t * 0.18).toFixed(3)})`;
        c.style.opacity = (1 - t * 0.25).toFixed(2);
      });
      const best = nearestIndex();
      if (best !== activeIndex) {
        activeIndex = best;
        setActive(best);
      }
    };

    // Masuk set kloning? lompat diam-diam ke kartu yang sama di set asli
    const recenter = () => {
      if (dragging || track.clientWidth === 0) return;
      const idx = nearestIndex();
      if (idx >= HOME && idx < HOME + N) return;
      const target = HOME + mod(idx);
      const delta = cardCenter(cards[target]) - cardCenter(cards[idx]);
      track.style.scrollSnapType = 'none'; // cegah snap menganimasikan lompatan
      track.scrollLeft += delta;
      requestAnimationFrame(() => {
        track.style.scrollSnapType = '';
        update();
      });
    };

    const onScroll = () => {
      lastScroll = Date.now();
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(recenter, 140);
    };

    // Section bisa tampil belakangan (lebar 0 saat pertama render): posisikan saat ukuran tersedia
    const ro = new ResizeObserver(() => {
      if (track.clientWidth === 0) return;
      const idx = initialized && activeIndex >= 0 ? HOME + mod(activeIndex) : START_INDEX;
      initialized = true;
      scrollToCard(idx, false);
      update();
    });
    ro.observe(track);

    // ---- Drag mouse (sentuhan memakai scroll/swipe bawaan browser + scroll-snap) ----
    const onPointerDown = (e) => {
      pressed = true;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (dragging) track.scrollLeft = startScroll - (e.clientX - startX);
    };
    const endPress = (e) => {
      pressed = false;
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      if (e && e.pointerId !== undefined && track.hasPointerCapture(e.pointerId)) {
        track.releasePointerCapture(e.pointerId);
      }
      scrollToCard(nearestIndex(), true);
    };

    // ---- Roda mouse (opsional): vertikal → horizontal ----
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // gerak horizontal sudah ditangani browser
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    };

    // ---- Keyboard ----
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollToCard(nearestIndex() + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollToCard(nearestIndex() - 1, true); }
    };

    // ---- Pause autoplay: hover (mouse), fokus keyboard ----
    const onEnter = () => { hovered = true; };
    const onLeave = () => { hovered = false; };
    const onFocusIn = () => { focused = true; };
    const onFocusOut = () => { focused = false; };

    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', endPress);
    track.addEventListener('pointercancel', endPress);
    track.addEventListener('keydown', onKeyDown);
    track.addEventListener('mouseenter', onEnter);
    track.addEventListener('mouseleave', onLeave);
    track.addEventListener('focusin', onFocusIn);
    track.addEventListener('focusout', onFocusOut);
    if (captureWheel) track.addEventListener('wheel', onWheel, { passive: false });

    // ---- Autoplay: geser pelan ke kartu berikutnya ----
    if (autoPlay && !reduceMotion) {
      playTimer = setInterval(() => {
        if (hovered || pressed || dragging || focused || document.hidden) return;
        if (Date.now() - lastScroll < 600) return; // masih bergerak (inersia swipe / animasi)
        scrollToCard(nearestIndex() + 1, true);
      }, interval);
    }

    apiRef.current = { scrollToCard, nearestIndex };

    return () => {
      apiRef.current = null;
      ro.disconnect();
      clearInterval(playTimer);
      clearTimeout(idleTimer);
      cancelAnimationFrame(raf);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', endPress);
      track.removeEventListener('pointercancel', endPress);
      track.removeEventListener('keydown', onKeyDown);
      track.removeEventListener('mouseenter', onEnter);
      track.removeEventListener('mouseleave', onLeave);
      track.removeEventListener('focusin', onFocusIn);
      track.removeEventListener('focusout', onFocusOut);
      track.removeEventListener('wheel', onWheel);
      track.style.scrollSnapType = '';
    };
  }, [autoPlay, interval, captureWheel]);

  // Klik titik → meluncur lewat jalur terpendek (kiri/kanan) ke kartu yang bersangkutan
  const goToDot = (i) => {
    const api = apiRef.current;
    if (!api) return;
    const cur = api.nearestIndex();
    let diff = mod(i - cur);
    if (diff > N / 2) diff -= N;
    api.scrollToCard(cur + diff, true);
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
          className="about-wheel-track"
          id="aboutWheelTrack"
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label="Daftar fitur unggulan, geser atau gunakan tombol panah untuk melihat fitur lainnya"
        >
          {ITEMS.map(({ f, clone, key }, idx) => (
            <article
              className={`about-feature-card${idx === active ? ' is-active' : ''}`}
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
        <div className="about-wheel-dots" id="aboutWheelDots">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              className={i === mod(active) ? 'active' : ''}
              aria-label={`Lihat fitur ${f.title}`}
              aria-current={i === mod(active) ? 'true' : undefined}
              onClick={() => goToDot(i)}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
}