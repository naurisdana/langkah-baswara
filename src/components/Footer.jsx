/* =====================================================================
   Footer — Langkah Baswara
   Gaya: footer.site / .ft-* di src/index.css.
   Navigasi memakai callback onNavigate(id) dari App.jsx (bukan reload).
   ===================================================================== */

const SOCIAL = [
  { icon: 'bi-instagram', label: 'Instagram', href: '#' },
  { icon: 'bi-tiktok', label: 'TikTok', href: '#' },
  { icon: 'bi-envelope', label: 'Email', href: 'mailto:hello@langkahbaswara.id' },
];

const COLUMNS = [
  {
    title: 'Eksplorasi',
    links: [
      { label: 'Peta Wisata', page: 'jelajahi' },
      { label: 'Kategori', page: 'jelajahi' },
      { label: 'Kabupaten', page: 'jelajahi' },
      { label: 'Rute Perjalanan', page: 'jelajahi' },
    ],
  },
  {
    title: 'Informasi',
    links: [
      { label: 'Tentang Platform', page: 'tentang' },
      { label: 'Budaya & Etika', page: 'tentang' },
      { label: 'Kebijakan Privasi' },
      { label: 'Syarat Layanan' },
    ],
  },
  {
    title: 'Kontak & Bantuan',
    links: [
      { label: 'Pusat Bantuan' },
      { label: 'Lapor Destinasi' },
      { label: 'hello@langkahbaswara.id', href: 'mailto:hello@langkahbaswara.id' },
      { label: 'Instagram', href: '#' },
    ],
  },
];

export default function Footer({ onNavigate }) {
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
            <h2 className="ft-cta-title">Siap menjelajah Bali?</h2>
            <p className="ft-cta-desc">Temukan destinasi favoritmu dan susun rute perjalanan terbaik dalam hitungan detik.</p>
          </div>
          <button type="button" className="ft-cta-btn" onClick={() => onNavigate('jelajahi')}>
            Jelajahi Sekarang <i className="bi bi-arrow-right"></i>
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
              Platform eksplorasi destinasi wisata Bali terpadu dengan panduan budaya, keindahan alam, dan peta interaktif untuk merencanakan perjalanan Anda.
            </p>
            <div className="ft-social">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} title={s.label}>
                  <i className={`bi ${s.icon}`}></i>
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
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
          <span>&copy; {new Date().getFullYear()} Langkah Baswara. Seluruh hak cipta dilindungi undang-undang.</span>
          <span className="ft-made">
            Dibuat dengan <i className="bi bi-heart-fill"></i> di Bali
          </span>
        </div>
      </div>
    </footer>
  );
}
