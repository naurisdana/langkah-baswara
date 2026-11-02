import { useEffect, useRef } from 'react';
import About from '../components/About.jsx';
import FeatureWheel from '../components/FeatureWheel.jsx';
import Testimonials from '../components/Testimonials.jsx';

// Animasi muncul saat di-scroll: .about-reveal -> tambah .is-visible (CSS: .about-js .about-reveal)
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.15 }
    );
    root.querySelectorAll('.about-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

export default function Tentang({ onExplore }) {
  const rootRef = useRef(null);
  useReveal(rootRef);

  return (
    <div className="about-wrap about-js" ref={rootRef}>
      <div className="about-hero">
        <div className="about-hero-inner">
          <h1 className="about-hero-title">
            Mengenal <strong>Langkah Baswara</strong>
          </h1>
          <p className="about-hero-tagline">
            Web-GIS interaktif untuk merencanakan liburan di Bali: <strong>lebih efektif, hemat waktu, sesuai preferensi.</strong>
          </p>
        </div>
      </div>

      <About onExplore={onExplore} />
      <FeatureWheel />

      <div className="about-cta">
        <div className="about-cta-inner about-reveal">
          <h2 className="about-cta-title">
            <strong>Siap</strong> Memulai
            <span className="highlight-oval-yellow"> Liburan<br />Impianmu</span>
            {' '}di <strong>Bali?</strong>
          </h2>
          <p className="about-cta-desc">
            Temukan tempat wisata favoritmu dan dapatkan rute perjalanan terbaik hanya dalam hitungan detik.
          </p>
          <button type="button" className="btn btn-green-pill" onClick={onExplore}>
            Jelajahi Sekarang
          </button>
        </div>
      </div>

      <Testimonials />
    </div>
  );
}