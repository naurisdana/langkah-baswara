/* =====================================================================
   Footer — Langkah Baswara
   Gaya: footer.site / .ft-* di src/index.css (hasil style.css lama).
   Navigasi memakai callback onNavigate(id) dari App.jsx (bukan reload).
   ===================================================================== */

import { PAGES } from '../data/pageConfig.js';

const FITUR = [
  { id: 'jelajahi', label: 'Peta Interaktif' },
  { id: 'jelajahi', label: 'Analisis Radius Lokasi' },
  { id: 'jelajahi', label: 'Rekomendasi Destinasi' },
  { id: 'jelajahi', label: 'Optimasi Rute Pintar' },
];

// Ganti href dengan akun resmi Langkah Baswara
const SOCIAL = [
  { icon: 'bi-instagram', label: 'Instagram', href: '#' },
  { icon: 'bi-tiktok', label: 'TikTok', href: '#' },
  { icon: 'bi-youtube', label: 'YouTube', href: '#' },
  { icon: 'bi-envelope-fill', label: 'Email', href: '#' },
];

export default function Footer({ onNavigate }) {
  const go = (e, id) => {
    e.preventDefault();
    onNavigate(id);
  };

  return (
    <footer className="site">
      <div className="ft-pattern" aria-hidden="true"></div>
      <div className="ft-glow" aria-hidden="true"></div>

      <div className="container ft-inner">
        {/* Kartu ajakan */}
        <div className="ft-cta">
          <div>
            <h2 className="ft-cta-title">Siap menyusun perjalananmu di Bali?</h2>
            <p className="ft-cta-desc">Temukan destinasi impian dan susun rute terbaikmu bersama Langkah Baswara.</p>
          </div>
          <button type="button" className="ft-cta-btn" onClick={() => onNavigate('jelajahi')}>
            Jelajahi Sekarang <i className="bi bi-arrow-right"></i>
          </button>
        </div>

        <div className="row g-4 g-lg-5">
          {/* Brand */}
          <div className="col-lg-5">
            <a className="ft-brand" href="#beranda" onClick={(e) => go(e, 'beranda')}>
              <span className="ft-logo-badge">
                <img src="/assets/logofix.png" alt="Logo Langkah Baswara" />
              </span>
              <span className="ft-brand-name">Langkah Baswara</span>
            </a>
            <p className="ft-about">
              Sistem informasi geografis (Web-GIS) interaktif untuk merencanakan liburan di Bali: peta interaktif,
              analisis radius lokasi, hingga optimasi rute pintar.
            </p>
            <div className="ft-social">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} title={s.label}>
                  <i className={`bi ${s.icon}`}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Menu */}
          <div className="col-6 col-lg-3 offset-lg-1">
            <h3 className="ft-heading">Menu</h3>
            <ul className="ft-links">
              {PAGES.map((m) => (
                <li key={m.id}>
                  <a href={`#${m.id}`} onClick={(e) => go(e, m.id)}>{m.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Fitur */}
          <div className="col-6 col-lg-3">
            <h3 className="ft-heading">Fitur</h3>
            <ul className="ft-links">
              {FITUR.map((f) => (
                <li key={f.label}>
                  <a href={`#${f.id}`} onClick={(e) => go(e, f.id)}>{f.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Baris bawah */}
        <div className="ft-bottom">
          <span>&copy; {new Date().getFullYear()} Langkah Baswara. Hak cipta dilindungi.</span>
          <span className="ft-made">
            Dibuat dengan <i className="bi bi-heart-fill"></i> di Bali
          </span>
        </div>
      </div>
    </footer>
  );
}