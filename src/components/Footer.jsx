/* =====================================================================
   Footer — Langkah Baswara
   Gaya: footer.site / .ft-* di src/index.css.
   Navigasi memakai callback onNavigate(id) dari App.jsx (bukan reload).
   ===================================================================== */

import { useI18n } from '../lib/i18n.jsx';

const SOCIAL = [
  { icon: 'bi-envelope', label: 'Email', href: 'mailto:hello@langkahbaswara.id' },
];

export default function Footer({ onNavigate }) {
  const { t } = useI18n();
  const columns = [
    {
      title: t('ft.c1'),
      links: [
        { label: t('ft.c1.a'), page: 'jelajahi' },
        { label: t('ft.c1.b'), page: 'jelajahi' },
        { label: t('ft.c1.c'), page: 'jelajahi' },
        { label: t('ft.c1.d'), page: 'jelajahi' },
      ],
    },
    {
      title: t('ft.c2'),
      links: [
        { label: t('ft.c2.a'), page: 'tentang' },
        { label: t('ft.c2.b'), page: 'tentang' },
        { label: t('ft.c2.c') },
        { label: t('ft.c2.d') },
      ],
    },
  ];
  const go = (e, id) => {
    e.preventDefault();
    if (id) onNavigate(id);
  };

  return (
    <footer className="site">
      <div className="ft-pattern" aria-hidden="true"></div>
      <div className="ft-glow" aria-hidden="true"></div>

      <div className="container ft-inner">
        <div className="ft-cta">
          <div>
            <h2 className="ft-cta-title">{t('ft.cta.t')}</h2>
            <p className="ft-cta-desc">{t('ft.cta.d')}</p>
          </div>
          <button type="button" className="ft-cta-btn" onClick={() => onNavigate('jelajahi')}>
            {t('ft.cta.b')} <i className="bi bi-arrow-right"></i>
          </button>
        </div>

        <div className="ft-grid">
          <div>
            <a className="ft-brand" href="#beranda" onClick={(e) => go(e, 'beranda')}>
              <span className="ft-logo-badge">
                <img src="/assets/logofix.png" alt="Logo Langkah Baswara" />
              </span>
              <span className="ft-brand-name">Langkah Baswara</span>
            </a>
            <p className="ft-about">
              {t('ft.about')}
            </p>
            <div className="ft-social">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} title={s.label}>
                  <i className={`bi ${s.icon}`}></i>
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="ft-heading">{col.title}</h3>
              <ul className="ft-links">
                {col.links.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href || (item.page ? `#${item.page}` : '#')}
                      onClick={(e) => {
                        if (item.page) go(e, item.page);
                        else if (!item.href || item.href === '#') e.preventDefault();
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ft-bottom">
          <span>&copy; {new Date().getFullYear()} Langkah Baswara. {t('ft.copy')}</span>
          <span className="ft-made">
            {t('ft.made')} <i className="bi bi-heart-fill"></i> {t('ft.made2')}
          </span>
        </div>
      </div>
    </footer>
  );
}
