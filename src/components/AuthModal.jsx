import { useEffect, useRef, useState } from 'react';
import { apiRequest, OTP_LENGTH } from '../lib/api.js';

const GOOGLE_ICON = (
  <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export default function AuthModal({ open, onClose, onLoggedIn }) {
  const [errorMessage, setErrorMessage] = useState(null); // hanya terisi dari respon API
  const [view, setView] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    document.body.classList.toggle('au-open', open);
    if (!open) setErrorMessage(null);
  }, [open, setErrorMessage]);

  const go = (v) => { setErrorMessage(null); setView(v); };
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Ambil token & identitas dari balasan backend lalu masuk
  const finish = (data) => {
    const token = data && (data.access_token || data.token);
    if (!token) return go('login'); // terverifikasi, tinggal masuk
    localStorage.setItem('lb_token', token);
    const u = (data.user && (data.user.user_metadata || data.user)) || {};
    onLoggedIn({ name: data.name || u.full_name || u.name || f.name || f.email.split('@')[0], email: data.email || f.email });
  };

  const submit = (path, body, after) => async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    try {
      const r = await apiRequest(path, { method: 'POST', body });
      if (!r.ok) setErrorMessage(r.message);
      else after(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onOtpChange = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setOtp((o) => o.map((x, k) => (k === i ? d : x)));
    if (d && otpRefs.current[i + 1]) otpRefs.current[i + 1].focus();
  };

  const msg = typeof errorMessage === 'string' && errorMessage ? <p className="au-msg" data-type="error" role="alert">{errorMessage}</p> : null;
  const eye = (
    <button type="button" className="au-eye" aria-label="Tampilkan kata sandi" onClick={() => setShowPass((s) => !s)}>
      <i className={`bi ${showPass ? 'bi-eye' : 'bi-eye-slash'}`}></i>
    </button>
  );

  return (
    <div className={`au-screen${open ? ' is-active' : ''}`} id="authScreen" data-view={view} role="dialog" aria-modal="true" aria-label="Masuk atau daftar akun">
      <div className="au-photo">
        <img src="/assets/authenticationpage.png" alt="Ilustrasi wisatawan menatap gapura Bali saat matahari terbit" draggable="false" />
      </div>
      <div className="au-right">
        <div className="au-bg" aria-hidden="true">
          <div className="lb-deco lb-deco-tl"></div>
          <div className="lb-deco lb-deco-br"></div>
        </div>
        <div className="au-main">
          <div className="au-box">
            <a className="au-logo" href="#" aria-label="Kembali ke beranda" onClick={(e) => { e.preventDefault(); onClose(); }}>
              <img src="/assets/logofix.png" alt="Logo Langkah Baswara" />
            </a>

            {/* MASUK */}
            <section className={`au-view${view === 'login' ? ' is-current' : ''}`} data-view="login">
              <h1 className="au-title">Masuk ke Akun Anda</h1>
              <p className="au-sub">Halo! Senang melihatmu kembali.<br />Silakan masuk ke akun Anda.</p>
              <form className="au-form" onSubmit={submit('/api/auth/login', { email: f.email, password: f.password }, finish)}>
                <label className="au-field">
                  <i className="bi bi-envelope-fill" aria-hidden="true"></i>
                  <input type="email" required placeholder="Email" autoComplete="email" aria-label="Email" value={f.email} onChange={set('email')} />
                </label>
                <label className="au-field">
                  <i className="bi bi-lock-fill" aria-hidden="true"></i>
                  <input type={showPass ? 'text' : 'password'} required placeholder="Password" autoComplete="current-password" aria-label="Password" value={f.password} onChange={set('password')} />
                  {eye}
                </label>
                {view === 'login' ? msg : null}
                <button type="submit" className="au-btn au-btn-primary" disabled={busy}>Masuk</button>
              </form>
              <div className="au-or"><span>atau</span></div>
              <button
                type="button"
                className="au-btn au-btn-google"
                aria-label="Masuk dengan Google"
                title="Masuk dengan Google"
                onClick={submit('/api/auth/google', null, (d) => { if (d && d.url) window.location.href = d.url; })}
              >
                {GOOGLE_ICON}
              </button>
              <p className="au-switch">Belum punya akun? <button type="button" className="au-link" onClick={() => go('register')}>Daftar</button></p>
            </section>

            {/* DAFTAR */}
            <section className={`au-view${view === 'register' ? ' is-current' : ''}`} data-view="register">
              <h1 className="au-title">Daftar Akun</h1>
              <p className="au-sub">Halo! Senang melihatmu kembali.<br />Silakan buat akun Anda.</p>
              <form className="au-form" onSubmit={submit('/api/auth/register', { name: f.name, email: f.email, password: f.password }, () => go('verify'))}>
                <label className="au-field">
                  <i className="bi bi-person-fill" aria-hidden="true"></i>
                  <input type="text" required minLength={2} placeholder="Nama" autoComplete="name" aria-label="Nama" value={f.name} onChange={set('name')} />
                </label>
                <label className="au-field">
                  <i className="bi bi-envelope-fill" aria-hidden="true"></i>
                  <input type="email" required placeholder="Email" autoComplete="email" aria-label="Email" value={f.email} onChange={set('email')} />
                </label>
                <label className="au-field">
                  <i className="bi bi-lock-fill" aria-hidden="true"></i>
                  <input type={showPass ? 'text' : 'password'} required minLength={8} placeholder="Password" autoComplete="new-password" aria-label="Password" value={f.password} onChange={set('password')} />
                  {eye}
                </label>
                {view === 'register' ? msg : null}
                <button type="submit" className="au-btn au-btn-primary au-btn-gap" disabled={busy}>Daftar</button>
              </form>
              <p className="au-switch">Sudah punya akun? <button type="button" className="au-link" onClick={() => go('login')}>Masuk</button></p>
            </section>

            {/* VERIFIKASI OTP */}
            <section className={`au-view${view === 'verify' ? ' is-current' : ''}`} data-view="verify">
              <h1 className="au-title">Masukkan Kode Verifikasi</h1>
              <p className="au-sub">Kami telah mengirimkan kode<br />verifikasi ke email anda.</p>
              <p className="au-mail">{f.email}</p>
              <div className="au-otp" role="group" aria-label="Kode verifikasi">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    className="au-otp-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    value={d}
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !d && otpRefs.current[i - 1]) otpRefs.current[i - 1].focus(); }}
                  />
                ))}
              </div>
              {view === 'verify' ? msg : null}
              <p className="au-resend-row">
                Tidak menerima kode?{' '}
                <button type="button" className="au-resend" onClick={submit('/api/auth/resend-otp', { email: f.email }, () => {})}>Kirim ulang</button>
              </p>
              <button type="button" className="au-btn au-btn-primary" disabled={busy || otp.join('').length < OTP_LENGTH} onClick={submit('/api/auth/verify-email', { email: f.email, otp: otp.join('') }, finish)}>
                Verifikasi
              </button>
              <p className="au-switch"><button type="button" className="au-link" onClick={() => go('register')}>Salah email? Kembali</button></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}