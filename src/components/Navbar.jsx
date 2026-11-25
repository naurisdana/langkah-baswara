import { useEffect, useRef, useState } from 'react';
import { PAGES } from '../data/pageConfig.js';
import { useI18n } from '../lib/i18n.jsx';

function Flag({ code }) {
  if (code === 'en') {
    return (
      <svg className="lang-flag" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" fill="#bf0a30" />
        <rect y="2.4" width="32" height="2.5" fill="#fff" />
        <rect y="7.3" width="32" height="2.5" fill="#fff" />
        <rect y="12.2" width="32" height="2.5" fill="#fff" />
        <rect y="17.1" width="32" height="2.5" fill="#fff" />
        <rect y="22" width="32" height="2.5" fill="#fff" />
        <rect y="26.9" width="32" height="2.5" fill="#fff" />
        <rect width="14" height="14" fill="#002868" />
      </svg>
    );
  }
  return (
    <svg className="lang-flag" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="16" fill="#ce1126" />
      <rect y="16" width="32" height="16" fill="#fff" />
    </svg>
  );
}

export default function Navbar({ activePage, onSelect, user, onAuthClick }) {
  const { lang, setLang, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!langOpen) return undefined;
    const onDown = (event) => {
      if (!langRef.current?.contains(event.target)) setLangOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setLangOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [langOpen]);

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
          aria-label={t('nav.menu')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`} id="navMain">
          <div className="navbar-nav-wrapper">
            <ul className="navbar-nav nav-pills-lb my-2 my-lg-0">
              {PAGES.filter((page) => page.id !== 'profil').map((page) => (
                <li className="nav-item" key={page.id}>
                  <a className={`nav-link${activePage === page.id ? ' active' : ''}`} href={`#${page.id}`} onClick={(e) => pick(e, page.id)}>
                    {t(`nav.${page.id}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="navbar-actions">
            <div className="lang-switch" ref={langRef}>
              <button
                type="button"
                className="lang-btn"
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={t('nav.lang')}
                onClick={() => setLangOpen((open) => !open)}
              >
                <span className="lang-flag-wrap"><Flag code={lang} /></span>
                <span>{lang === 'en' ? 'ENG' : 'ID'}</span>
              </button>
              {langOpen ? (
                <ul className="lang-menu" role="listbox" aria-label={t('nav.lang')}>
                  {[['id', 'ID'], ['en', 'ENG']].map(([code, short]) => (
                    <li key={code}>
                      <button
                        type="button"
                        className={lang === code ? 'is-on' : ''}
                        role="option"
                        aria-selected={lang === code}
                        onClick={() => { setLang(code); setLangOpen(false); }}
                      >
                        <span className="lang-flag-wrap"><Flag code={code} /></span>
                        <span>{t(`lang.${code}`)}</span>
                        <span className="lang-short">{short}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button className={`btn btn-masuk${user ? ' is-user' : ''}`} type="button" id="navAuthBtn" onClick={() => { setMenuOpen(false); onAuthClick(); }}>
              {user ? (
                <>
                  <span className={`nav-avatar${user.photo ? ' has-photo' : ''}`} style={user.photo ? { backgroundImage: `url("${user.photo}")` } : undefined}>{user.photo ? null : first.charAt(0).toUpperCase()}</span>
                  <span>{first}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-door-closed-fill"></i>
                  <span>{t('nav.login')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}