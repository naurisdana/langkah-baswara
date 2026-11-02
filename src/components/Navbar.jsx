import { useEffect, useState } from 'react';
import { PAGES } from '../data/pageConfig.js';

export default function Navbar({ activePage, onSelect, user, onAuthClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const pick = (e, id) => {
    e.preventDefault();
    setMenuOpen(false);
    onSelect(id);
  };
  const first = user ? String(user.name || '').trim().split(/\s+/)[0] || 'Akun' : '';

  return (
    <nav className={`navbar navbar-expand-lg navbar-lb${scrolled ? ' scrolled' : ''}`}>
      <div className="container">
        <a className="navbar-brand d-flex align-items-center mb-0" href="#" onClick={(e) => pick(e, 'beranda')}>
          <img src="/assets/logofix.png" alt="Logo Langkah Baswara" className="navbar-brand-logo" height={76} />
        </a>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navMain"
          aria-expanded={menuOpen}
          aria-label="Buka navigasi"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`} id="navMain">
          <div className="navbar-nav-wrapper">
            <ul className="navbar-nav nav-pills-lb my-2 my-lg-0">
              {PAGES.map((t) => (
                <li className="nav-item" key={t.id}>
                  <a className={`nav-link${activePage === t.id ? ' active' : ''}`} href={`#${t.id}`} onClick={(e) => pick(e, t.id)}>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="navbar-actions">
            <button className={`btn btn-masuk${user ? ' is-user' : ''}`} type="button" id="navAuthBtn" onClick={onAuthClick}>
              {user ? (
                <>
                  <span className="nav-avatar">{first.charAt(0).toUpperCase()}</span>
                  <span>{first}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-door-closed-fill"></i>
                  <span>Masuk</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}