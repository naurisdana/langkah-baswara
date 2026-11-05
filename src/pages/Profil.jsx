// Placeholder: form profil & wishlist lengkap menyusul (kelas .pf-* sudah ada di index.css)
export default function Profil({ user, onLogout }) {
  const initial = String(user.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="pf-wrap">
      <div className="pf-card pf-account">
        <div className="pf-account-head">
          <h2 className="pf-h2">Profil Saya</h2>
          <span className="pf-badge-verified">Terverifikasi</span>
        </div>
        <div className="pf-user">
          <div className="pf-avatar-wrap">
            <div className="pf-avatar"><span>{initial}</span></div>
          </div>
          <div>
            <div className="pf-user-name">{user.name}</div>
            <div className="pf-user-mail">{user.email}</div>
          </div>
        </div>
        <div className="pf-actions">
          <button type="button" className="pf-btn pf-btn-danger" onClick={onLogout}>
            <i className="bi bi-box-arrow-right"></i> Keluar
          </button>
        </div>
      </div>
      <div className="pf-main">
        <section className="pf-card pf-wish-head">
          <h2 className="pf-wish-title"><i className="bi bi-heart-fill"></i> Destinasi Favorit</h2>
          <p className="pf-wish-sub">Tempat yang kamu tandai favorit akan muncul di sini.</p>
          <div className="pf-empty">
            <i className="bi bi-heart"></i>
            <p>Belum ada destinasi favorit.</p>
          </div>
        </section>
        <section className="pf-card pf-wish-head">
          <h2 className="pf-wish-title"><i className="bi bi-bookmark-heart-fill"></i> Wishlist Saya</h2>
          <p className="pf-wish-sub">Destinasi yang kamu simpan akan muncul di sini.</p>
          <div className="pf-empty">
            <i className="bi bi-bookmark"></i>
            <p>Wishlist masih kosong.</p>
          </div>
        </section>
      </div>
    </div>
  );
}