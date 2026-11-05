const REVIEWS = [
  { tone: 'yellow', tag: 'Pantai Melasti & Ubud', initials: 'RP', name: 'Rian Pratama', role: 'Solo Traveler • Jakarta', quote: 'Fitur peta interaktifnya juara banget! Bikin kami nggak bingung milih rute jalan dan bisa hemat waktu 3 jam di perjalanan tanpa drama nyasar.' },
  { tone: 'yellow', tag: 'Tanah Lot & Bedugul', initials: 'SA', name: 'Sinta Anggraini', role: 'Family Trip • Bandung', quote: 'Kami bawa dua anak, jadi jarak tempuh harus masuk akal. Slider radiusnya ngebantu banget nyusun pura, danau, dan tempat makan dalam satu hari tanpa kelelahan.' },
  { tone: 'yellow', tag: 'Uluwatu Sunset', initials: 'DW', name: 'Dimas Wicaksono', role: 'Fotografer • Surabaya', quote: 'Saya cari spot budaya yang masih sepi. Filter kategorinya langsung nunjukin pura dan tebing, jadi jadwal syuting sunset nggak tabrakan sama keramaian pantai.' },
  { tone: 'green', tag: 'Nusa Penida Day Trip', initials: 'NU', name: 'Nadia Utami', role: 'Bali Explorer • Yogyakarta', quote: 'Sistem pencarian cerdasnya ngebantu banget pilih objek wisata alam & budaya yang pas dengan budget backpacker kami. Sangat direkomendasikan!' },
  { tone: 'green', tag: 'Kintamani & Besakih', initials: 'MA', name: 'Made Arya', role: 'Pemandu Lokal • Bangli', quote: 'Tamu saya sering minta rute yang nggak muter-muter. Urutan titik terdekatnya masuk akal, dari danau ke pura, jadi saya tinggal sesuaikan jam keberangkatan.' },
  { tone: 'green', tag: 'Sanur & Nusa Dua', initials: 'LK', name: 'Laras Kirana', role: 'Honeymoon • Semarang', quote: 'Kami cuma punya dua hari. Setelah pakai lokasi sendiri, kartu rutenya langsung ngasih enam tempat yang masih saling dekat. Liburan jadi tenang, nggak kejebak macet.' },
];

export default function Testimonials() {
  return (
    <div className="container">
      <div className="about-review-section">
        <div className="text-center mb-5 about-reveal">
          <h2 className="about-heading">
            <span className="highlight-oval-yellow">Apa</span> Kata <strong>Mereka?</strong>
          </h2>
          <p className="about-subheading">
            Dengar cerita dan pengalaman langsung dari para wisatawan yang telah merencanakan liburan impian mereka di Bali bersama Langkah Baswara.
          </p>
        </div>
        <div className="row g-4">
          {REVIEWS.map((r, i) => (
            <div className="col-lg-4 col-md-6 about-reveal" style={{ '--reveal-delay': `${(i % 3) * 0.1}s` }} key={r.name}>
              <div className={`about-review-card about-review-${r.tone}`}>
                <div className="arc-top">
                  <span className="arc-stars">
                    {[0, 1, 2, 3, 4].map((s) => <i className="bi bi-star-fill" key={s}></i>)}
                  </span>
                  <span className="arc-tag">{r.tag}</span>
                </div>
                <p className="arc-quote">"{r.quote}"</p>
                <div className="arc-user">
                  <span className="arc-avatar">{r.initials}</span>
                  <div>
                    <div className="arc-name">{r.name}</div>
                    <div className="arc-role">{r.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}