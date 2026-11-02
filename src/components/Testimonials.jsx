const REVIEWS = [
  { tone: 'yellow', tag: 'Pantai Melasti & Ubud', initials: 'RP', name: 'Rian Pratama', role: 'Solo Traveler • Jakarta', quote: 'Fitur peta interaktifnya juara banget! Bikin kami nggak bingung milih rute jalan dan bisa hemat waktu 3 jam di perjalanan tanpa drama nyasar.' },
  { tone: 'green', tag: 'Nusa Penida Day Trip', initials: 'NU', name: 'Nadia Utami', role: 'Bali Explorer • Yogyakarta', quote: 'Sistem pencarian cerdasnya ngebantu banget pilih objek wisata alam & budaya yang pas dengan budget backpacker kami. Sangat direkomendasikan!' },
];
// Susunan sama seperti HTML lama: 3 kartu kuning lalu 3 kartu hijau (isi masih contoh)
const ROWS = [0, 0, 0, 1, 1, 1].map((r, i) => ({ ...REVIEWS[r], key: i }));

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
          {ROWS.map((r) => (
            <div className="col-lg-4 col-md-6 about-reveal" style={{ '--reveal-delay': `${(r.key % 3) * 0.1}s` }} key={r.key}>
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