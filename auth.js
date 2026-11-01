/* =====================================================================
   AUTH — Login, Daftar, Verifikasi (kode 4 digit) & Daftar/Masuk via Google
   Langkah Baswara

   CATATAN PENTING
   - Daftar, masuk, verifikasi OTP, dan atur ulang kata sandi diproses oleh
     BACKEND (lihat CFG.ENDPOINTS di bawah). Kode OTP dibuat & dikirim ke email
     oleh server — tidak ada lagi kode dummy di browser.
   - Jika nama path / nama field backend berbeda, cukup ubah tabel ENDPOINTS.
   - Google: isi GOOGLE_CLIENT_ID (Google Cloud Console > Credentials >
     OAuth client ID > Web application). Tambahkan alamat situsmu (mis.
     http://localhost:5500) di "Authorized JavaScript origins". Google tidak
     jalan kalau halaman dibuka lewat file:// — pakai Live Server / hosting.
   ===================================================================== */
(function () {
  'use strict';

  var CFG = {
  GOOGLE_CLIENT_ID: '316259317142-4qmau60auevgeo0hqpjjc7prp232k4fj.apps.googleusercontent.com',          // contoh: '1234567890-abc.apps.googleusercontent.com'

    // ===== LOGIN GOOGLE LEWAT BACKEND (FastAPI) =====
    // Jika API_BASE diisi, tombol Google memanggil
    //   API_BASE + GOOGLE_LOGIN_PATH   -> backend membalas JSON { "url": ... }
    // lalu browser dipindahkan ke url itu (Supabase/Google).
    // Setelah selesai, backend harus mengarahkan balik ke alamat web ini
    // (lihat handleBackendCallback di bawah untuk format yang dibaca).
    // Kosongkan API_BASE untuk kembali ke mode Google langsung (GOOGLE_CLIENT_ID).
    API_BASE: 'https://2fz3bcnb-8000.asse.devtunnels.ms',
    GOOGLE_LOGIN_PATH: '/api/auth/google',
    ME_PATH: '',                   // opsional, mis. '/api/auth/me' (dipakai jika callback hanya mengirim token)
    OTP_LENGTH: 6,                 // jumlah digit kode OTP dari backend (Supabase bawaan: 6)
    RESEND_COOLDOWN_S: 30,         // jeda kirim ulang kode
    MIN_PASSWORD: 8,
    MAX_NAME: 60,                  // batas panjang nama
    MAX_LOGIN_TRIES: 5,            // batas salah password sebelum dikunci sementara (di browser)
    LOGIN_LOCK_MS: 30 * 1000,      // lama kunci

    // ===== ENDPOINT BACKEND (semua POST + JSON) =====
    // path = alamat endpoint, body = data yang dikirim.
    // Ubah di sini jika backend memakai nama lain.
    ENDPOINTS: {
      register:       { path: '/api/auth/register',        body: function (d) { return { name: d.name, email: d.email, password: d.password }; } },
      verifyOtp:      { path: '/api/auth/verify-email',    body: function (d) { return { email: d.email, otp: d.code }; } },
      resendOtp:      { path: '/api/auth/resend-otp',      body: function (d) { return { email: d.email }; } },
      login:          { path: '/api/auth/login',           body: function (d) { return { email: d.email, password: d.password }; } },
      forgotPassword: { path: '/api/auth/forgot-password', body: function (d) { return { email: d.email }; } },
      resetPassword:  { path: '/api/auth/reset-password',  body: function (d) { return { email: d.email, otp: d.code, new_password: d.password }; } }
    }
  };

  var LS_USERS = 'lb_users';
  var LS_SESSION = 'lb_session';
  var LS_TOKEN = 'lb_token';

  var $ = function (id) { return document.getElementById(id); };
  var screen = $('authScreen');
  if (!screen) return;

  /* ---------------- penyimpanan ---------------- */
  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function getUsers() { return read(LS_USERS, []); }
  function findUser(email) {
    email = String(email || '').trim().toLowerCase();
    return getUsers().filter(function (u) { return u.email === email; })[0] || null;
  }
  function upsertUser(user) {
    var users = getUsers();
    var i = users.findIndex(function (u) { return u.email === user.email; });
    if (i >= 0) users[i] = user; else users.push(user);
    write(LS_USERS, users);
  }
  function currentUser() {
    var s = read(LS_SESSION, null);
    return s && s.email ? findUser(s.email) : null;
  }

  /* ---------------- util ---------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // Hanya izinkan gambar https:// atau data:image (bukan svg) untuk foto profil
  function safePicture(u) {
    u = String(u || '');
    if (/^https:\/\/[^\s"'()\\]+$/i.test(u)) return u;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u)) return u;
    return '';
  }
  function firstName(u) { return String((u && u.name) || 'Akun').trim().split(/\s+/)[0]; }
  function initialsOf(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return 'U';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  /* ---------------- toast ---------------- */
  var toastTimer = 0;
  function toast(msg) {
    var t = $('auToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------------- pesan di form ---------------- */
  function setMsg(view, text, type) {
    var el = screen.querySelector('[data-msg="' + view + '"]');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.type = type || 'error';
    el.hidden = !text;
  }

  /* ---------------- tampilan (view) ---------------- */
  var ctx = { returnTo: null, resumeSection: null };
  var pendingFav = null;   // tombol favorit yang diklik sebelum masuk (diulang otomatis setelah login)
  var pending = null;   // { email, name, purpose }
  var lastPending = null;  // untuk kirim ulang setelah kode dibatalkan
  var cooldownTimer = 0;
  var resetGrant = null;   // { email, code, exp } — kode yang diketik, dikirim bersama kata sandi baru

  function showView(name) {
    screen.dataset.view = name;
    screen.querySelectorAll('.au-view').forEach(function (v) {
      v.classList.toggle('is-current', v.dataset.view === name);
    });
    ['login', 'register', 'verify', 'forgot', 'reset'].forEach(function (v) { setMsg(v, ''); });
    var first = screen.querySelector('.au-view.is-current input:not([type="hidden"])');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function openAuth(view, opts) {
    ctx.returnTo = (opts && opts.returnTo) || null;
    ctx.resumeSection = (opts && opts.resumeSection) || null;
    screen.classList.add('is-active');
    document.body.classList.add('au-open');
    showView(view || 'login');
  }

  function closeAuth() {
    screen.classList.remove('is-active');
    document.body.classList.remove('au-open');
    clearInterval(cooldownTimer);
    screen.querySelectorAll('input').forEach(function (i) { if (i.type !== 'hidden') i.value = ''; });
    screen.querySelectorAll('[data-eye]').forEach(function (b) { setEye(b, false); });
    pending = null;
    resetGrant = null;
    pendingFav = null;
  }

  /* ---------------- tombol mata (password) ---------------- */
  function setEye(btn, show) {
    var input = $(btn.dataset.eye);
    if (!input) return;
    input.type = show ? 'text' : 'password';
    btn.querySelector('i').className = show ? 'bi bi-eye' : 'bi bi-eye-slash';
    btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  }
  screen.querySelectorAll('[data-eye]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.dataset.eye);
      setEye(btn, input && input.type === 'password');
    });
  });

  /* ---------------- navbar & profil ---------------- */
  var navBtn = document.querySelector('.btn-masuk');
  var navDefault = navBtn ? navBtn.innerHTML : '';

  function renderNav() {
    if (!navBtn) return;
    var u = currentUser();
    if (!u) {
      navBtn.classList.remove('is-user');
      navBtn.innerHTML = navDefault;
      navBtn.removeAttribute('title');
      return;
    }
    navBtn.classList.add('is-user');
    navBtn.title = 'Buka profil';
    navBtn.textContent = '';
    var av = document.createElement('span');
    av.className = 'nav-avatar';
    if (safePicture(u.picture)) { av.style.backgroundImage = 'url("' + safePicture(u.picture) + '")'; }
    else { av.textContent = initialsOf(u.name); }
    var nm = document.createElement('span');
    nm.textContent = firstName(u);
    navBtn.appendChild(av);
    navBtn.appendChild(nm);
  }

  function fillProfile() {
    var u = currentUser();
    if (!u) return;
    var parts = String(u.name || '').trim().split(/\s+/);
    var first = parts.shift() || '';
    var last = parts.join(' ');
    var set = function (id, v) { var e = $(id); if (e) e.value = v; };
    var txt = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('pfFirst', first);
    set('pfLast', last);
    set('pfEmail', u.email);
    var mail = $('pfEmail'); if (mail) mail.readOnly = true;
    txt('pfDisplayName', u.name);
    txt('pfDisplayMail', u.email);
    txt('pfInitials', initialsOf(u.name));
    var av = $('pfAvatar');
    if (av) {
      if (safePicture(u.picture)) { av.style.backgroundImage = 'url("' + safePicture(u.picture) + '")'; av.classList.add('has-photo'); }
      else { av.style.backgroundImage = ''; av.classList.remove('has-photo'); }
    }
    var pass = $('pfPass');
    var googleOnly = u.provider === 'google';
    if (pass) {
      pass.value = '';
      pass.readOnly = googleOnly;
      pass.placeholder = googleOnly ? 'Masuk dengan Google' : '••••••••';
    }
    var chg = $('pfChangePass'); if (chg) chg.hidden = googleOnly;
  }

  function login(user, message) {
    write(LS_SESSION, { email: user.email });
    renderNav();
    fillProfile();
    var back = ctx.returnTo;
    var favEl = pendingFav;
    closeAuth();
    if (back && typeof window.switchSection === 'function') window.switchSection(back);
    toast(message || ('Selamat datang, ' + firstName(user) + '!'));
    // lanjutkan aksi favorit yang tadi tertunda (jika tombolnya masih ada di halaman)
    if (favEl && favEl.isConnected) setTimeout(function () { favEl.click(); }, 450);
  }

  function logout() {
    try { localStorage.removeItem(LS_SESSION); localStorage.removeItem(LS_TOKEN); } catch (e) { /* abaikan */ }
    renderNav();
  }

  /* ---------------- komunikasi dengan backend ---------------- */
  function requireBackend(view) {
    if (CFG.API_BASE) return true;
    setMsg(view, 'Server belum diatur. Isi API_BASE di index.html (window.LB_CONFIG).', 'info');
    return false;
  }

  // Ubah balasan error backend menjadi kalimat yang ramah
  function errorText(status, body, path) {
    var raw = '';
    if (body) {
      if (typeof body.detail === 'string') raw = body.detail;
      else if (Array.isArray(body.detail) && body.detail.length) {
        raw = body.detail.map(function (d) { return (d.loc ? d.loc.slice(1).join('.') + ': ' : '') + (d.msg || ''); }).join('; ');
      } else raw = body.message || body.error || body.msg || '';
    }
    if (status === 404 || status === 405) return 'Endpoint ' + path + ' tidak ditemukan di backend. Cek tabel ENDPOINTS di auth.js.';
    if (status === 429 || /rate limit|too many/i.test(raw)) return 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.';
    if (status >= 500) return 'Server sedang bermasalah (' + status + '). Coba lagi nanti.' + (raw ? ' [' + raw + ']' : '');
    if (/invalid login credentials|invalid credentials|incorrect/i.test(raw)) return 'Email atau password salah.';
    if (/already (been )?registered|already exists|sudah terdaftar/i.test(raw)) return 'Email ini sudah terdaftar. Silakan masuk.';
    if (/otp|token/i.test(raw) && /expired|invalid|kedaluwarsa|salah/i.test(raw)) return 'Kode salah atau sudah kedaluwarsa.';
    if (status === 422) return 'Data yang dikirim tidak sesuai format backend' + (raw ? ' (' + raw + ')' : '') + '.';
    return raw || ('Permintaan gagal (' + status + ').');
  }

  async function callApi(key, data, extra) {
    var ep = CFG.ENDPOINTS[key];
    var url = CFG.API_BASE.replace(/\/+$/, '') + ep.path + '?ngrok-skip-browser-warning=1';
    var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (extra && extra.token) headers.Authorization = 'Bearer ' + extra.token;
    var res;
    try {
      res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(ep.body(data)) });
    } catch (err) {
      console.error('[Auth] ' + key + ': tidak bisa terhubung ke', url, err);
      return { ok: false, status: 0, data: {}, message: 'Permintaan ke ' + ep.path + ' tidak mendapat balasan yang bisa dibaca browser. Kemungkinan: server error (500), alamat endpoint berbeda, atau tunnel terputus. Cek tab Network (F12) dan terminal backend.' };
    }
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) console.warn('[Auth] POST ' + ep.path + ' -> ' + res.status, body);
    return { ok: res.ok, status: res.status, data: body || {}, message: res.ok ? '' : errorText(res.status, body, ep.path) };
  }

  async function withBusy(btn, fn) {
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    try { return await fn(); }
    finally { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
  }

  // Ambil token & data akun dari berbagai kemungkinan bentuk balasan backend
  function sessionFrom(data) {
    data = data || {};
    var sess = data.session || {};
    var u = data.user || sess.user || {};
    var meta = u.user_metadata || {};
    var token = data.access_token || sess.access_token || data.token || data.jwt || '';
    var claims = token ? (parseJwt(token) || {}) : {};
    var cm = claims.user_metadata || {};
    return {
      token: token,
      refresh: data.refresh_token || sess.refresh_token || '',
      email: String(data.email || u.email || claims.email || '').toLowerCase(),
      name: data.name || data.full_name || meta.full_name || meta.name || u.name || cm.full_name || cm.name || claims.name || '',
      picture: meta.avatar_url || meta.picture || u.picture || cm.avatar_url || cm.picture || claims.picture || '',
      id: data.user_id || u.id || claims.sub || ''
    };
  }

  // Simpan token + akun, lalu masuk ke web
  function completeAuth(data, fallback, verified, view) {
    var s = sessionFrom(data);
    var email = s.email || String((fallback && fallback.email) || '').toLowerCase();
    if (!s.token || !email) {
      return setMsg(view, 'Backend tidak mengirim token / email akun. Cek balasan endpoint di Console (F12).');
    }
    try {
      localStorage.setItem(LS_TOKEN, s.token);
      if (s.refresh) localStorage.setItem('lb_refresh', s.refresh);
    } catch (e) { /* abaikan */ }
    var old = findUser(email) || {};
    var user = {
      id: old.id || s.id || ('u' + Date.now().toString(36)),
      name: s.name || (fallback && fallback.name) || old.name || email.split('@')[0],
      email: email,
      provider: old.provider === 'google' ? 'google' : 'password',
      verified: true,
      picture: s.picture || old.picture || ''
    };
    upsertUser(user);
    login(user, verified ? 'Akun terverifikasi. Selamat datang, ' + firstName(user) + '!' : null);
  }

  /* ---------------- verifikasi kode (OTP dikirim backend ke email) ---------------- */
  var otpWrap = screen.querySelector('.au-otp');
  if (otpWrap) {
    otpWrap.innerHTML = '';
    for (var oi = 0; oi < CFG.OTP_LENGTH; oi++) {
      var ob = document.createElement('input');
      ob.className = 'au-otp-box';
      ob.type = 'text';
      ob.inputMode = 'numeric';
      ob.maxLength = 1;
      ob.setAttribute('aria-label', 'Digit ' + (oi + 1));
      if (oi === 0) ob.autocomplete = 'one-time-code';
      otpWrap.appendChild(ob);
    }
    otpWrap.setAttribute('aria-label', 'Kode verifikasi ' + CFG.OTP_LENGTH + ' digit');
  }
  var otp = Array.prototype.slice.call(screen.querySelectorAll('.au-otp-box'));
  var resendBtn = $('auResend');

  function startCooldown() {
    clearInterval(cooldownTimer);
    var left = CFG.RESEND_COOLDOWN_S;
    function paint() {
      if (!resendBtn) return;
      resendBtn.disabled = left > 0;
      resendBtn.textContent = left > 0 ? 'Kirim ulang (' + left + ')' : 'Kirim ulang';
    }
    paint();
    cooldownTimer = setInterval(function () {
      left -= 1; paint();
      if (left <= 0) clearInterval(cooldownTimer);
    }, 1000);
  }

  // Tampilkan layar OTP (kode sudah dikirim backend ke email)
  function startVerification(user, purpose) {
    otp.forEach(function (b) { b.value = ''; });
    pending = { email: user.email, name: user.name || '', purpose: purpose };
    lastPending = { email: user.email, name: user.name || '', purpose: purpose };
    var back = $('auVerifyBack');
    if (back) back.dataset.authOpen = purpose === 'reset' ? 'forgot' : 'register';
    var mailInfo = $('auVerifyMail');
    if (mailInfo) mailInfo.textContent = user.email;
    showView('verify');
    startCooldown();
  }

  function otpValue() { return otp.map(function (b) { return b.value; }).join(''); }

  otp.forEach(function (box, i) {
    box.addEventListener('input', function () {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      if (box.value && otp[i + 1]) otp[i + 1].focus();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !box.value && otp[i - 1]) { otp[i - 1].focus(); otp[i - 1].value = ''; e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && otp[i - 1]) otp[i - 1].focus();
      else if (e.key === 'ArrowRight' && otp[i + 1]) otp[i + 1].focus();
      else if (e.key === 'Enter') { e.preventDefault(); submitVerify(); }
    });
    box.addEventListener('focus', function () { box.select(); });
    box.addEventListener('paste', function (e) {
      var digits = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, otp.length);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach(function (d, k) { if (otp[k]) otp[k].value = d; });
      (otp[Math.min(digits.length, otp.length - 1)]).focus();
    });
  });

  async function submitVerify() {
    var p = pending;
    if (!p) { setMsg('verify', 'Sesi verifikasi berakhir. Silakan daftar / masuk lagi.'); return; }
    var val = otpValue();
    if (val.length < otp.length) { setMsg('verify', 'Masukkan ' + otp.length + ' digit kode verifikasi.'); return; }

    // Lupa password: kode diperiksa backend bersamaan dengan kata sandi baru (langkah berikutnya)
    if (p.purpose === 'reset') {
      resetGrant = { email: p.email, code: val, exp: Date.now() + 10 * 60 * 1000 };
      pending = null;
      clearInterval(cooldownTimer);
      otp.forEach(function (b) { b.value = ''; });
      showView('reset');
      return;
    }

    if (!requireBackend('verify')) return;
    var r = await withBusy($('auVerifyBtn'), function () {
      return callApi('verifyOtp', { email: p.email, code: val, purpose: p.purpose });
    });
    if (!r.ok) {
      setMsg('verify', r.message);
      var box = screen.querySelector('.au-otp');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      otp.forEach(function (b) { b.value = ''; });
      otp[0].focus();
      return;
    }
    if (!sessionFrom(r.data).token) {   // terverifikasi, tapi backend tidak memberi sesi -> minta masuk
      pending = null;
      showView('login');
      $('auLoginEmail').value = p.email;
      setMsg('login', 'Email berhasil diverifikasi. Silakan masuk.', 'success');
      return;
    }
    completeAuth(r.data, p, true, 'verify');
  }

  $('auVerifyBtn') && $('auVerifyBtn').addEventListener('click', submitVerify);

  if (resendBtn) {
    resendBtn.addEventListener('click', async function () {
      var src = pending || lastPending;
      if (!src || !requireBackend('verify')) return;
      otp.forEach(function (b) { b.value = ''; });
      var r = await callApi(src.purpose === 'reset' ? 'forgotPassword' : 'resendOtp', { email: src.email });
      if (!r.ok) return setMsg('verify', r.message);
      if (!pending) pending = { email: src.email, name: src.name, purpose: src.purpose };
      setMsg('verify', '');
      startCooldown();
      toast('Kode baru telah dikirim ke email');
      otp[0].focus();
    });
  }

  /* ---------------- daftar ---------------- */
  var regForm = $('auRegisterForm');
  if (regForm) {
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = $('auRegName').value.trim();
      var email = $('auRegEmail').value.trim().toLowerCase();
      var pass = $('auRegPass').value;
      if (name.length < 2) return setMsg('register', 'Nama minimal 2 karakter.');
      if (name.length > CFG.MAX_NAME) return setMsg('register', 'Nama maksimal ' + CFG.MAX_NAME + ' karakter.');
      if (!EMAIL_RE.test(email)) return setMsg('register', 'Format email belum benar.');
      if (pass.length < CFG.MIN_PASSWORD) return setMsg('register', 'Password minimal ' + CFG.MIN_PASSWORD + ' karakter.');
      if (!requireBackend('register')) return;
      setMsg('register', '');
      var r = await withBusy(regForm.querySelector('[type=submit]'), function () {
        return callApi('register', { name: name, email: email, password: pass });
      });
      if (!r.ok) return setMsg('register', r.message);
      // Jika backend langsung memberi sesi (verifikasi email dimatikan), langsung masuk
      if (sessionFrom(r.data).token) return completeAuth(r.data, { email: email, name: name }, false, 'register');
      startVerification({ email: email, name: name }, 'register');
    });
  }

  /* ---------------- masuk ---------------- */
  var loginThrottle = {};   // { email: { n, until } }
  var loginForm = $('auLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = $('auLoginEmail').value.trim().toLowerCase();
      var pass = $('auLoginPass').value;
      if (!EMAIL_RE.test(email)) return setMsg('login', 'Format email belum benar.');
      if (!pass) return setMsg('login', 'Password wajib diisi.');
      var th = loginThrottle[email] || (loginThrottle[email] = { n: 0, until: 0 });
      if (Date.now() < th.until) return setMsg('login', 'Terlalu banyak percobaan. Coba lagi sebentar lagi.');
      if (!requireBackend('login')) return;
      setMsg('login', '');
      var r = await withBusy(loginForm.querySelector('[type=submit]'), function () {
        return callApi('login', { email: email, password: pass });
      });
      if (r.ok) {
        delete loginThrottle[email];
        return completeAuth(r.data, { email: email }, false, 'login');
      }
      // Email belum diverifikasi -> kirim OTP & arahkan ke layar kode
      if (r.status === 403 || /belum.*(verifikasi|konfirmasi)|not confirmed|not verified|unverified/i.test(r.message)) {
        startVerification({ email: email }, 'login');
        callApi('resendOtp', { email: email });
        return setMsg('verify', 'Email belum diverifikasi. Kami kirim kode baru ke email kamu.', 'info');
      }
      if (r.status === 400 || r.status === 401 || r.status === 422) {
        th.n++;
        if (th.n >= CFG.MAX_LOGIN_TRIES) { th.until = Date.now() + CFG.LOGIN_LOCK_MS; th.n = 0; }
      }
      setMsg('login', r.message || 'Email atau password salah.');
    });
  }

  /* ---------------- lupa & atur ulang kata sandi ---------------- */
  var forgot = $('auForgot');
  if (forgot) {
    forgot.addEventListener('click', function () {
      var typed = ($('auLoginEmail') && $('auLoginEmail').value || '').trim();
      showView('forgot');
      if ($('auForgotEmail')) $('auForgotEmail').value = typed;
    });
  }

  // 1) masukkan email -> backend mengirim kode ke email
  var forgotForm = $('auForgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = $('auForgotEmail').value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return setMsg('forgot', 'Format email belum benar.');
      if (!requireBackend('forgot')) return;
      setMsg('forgot', '');
      var r = await withBusy(forgotForm.querySelector('[type=submit]'), function () {
        return callApi('forgotPassword', { email: email });
      });
      if (!r.ok) return setMsg('forgot', r.message);
      startVerification({ email: email }, 'reset');
    });
  }

  // 2) kode + kata sandi baru -> backend memeriksa & menyimpan
  var resetForm = $('auResetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!resetGrant || Date.now() > resetGrant.exp) {
        resetGrant = null;
        showView('forgot');
        return setMsg('forgot', 'Sesi atur ulang berakhir. Minta kode verifikasi baru.');
      }
      var p1 = $('auResetPass').value;
      var p2 = $('auResetPass2').value;
      if (p1.length < CFG.MIN_PASSWORD) return setMsg('reset', 'Kata sandi minimal ' + CFG.MIN_PASSWORD + ' karakter.');
      if (p1 !== p2) return setMsg('reset', 'Konfirmasi kata sandi tidak sama.');
      if (!requireBackend('reset')) return;
      var g = resetGrant;
      var r = await withBusy(resetForm.querySelector('[type=submit]'), function () {
        return callApi('resetPassword', { email: g.email, code: g.code, password: p1 });
      });
      if (!r.ok) {
        if (r.status === 400 || r.status === 401 || r.status === 403 || /kode|otp|token/i.test(r.message)) {
          // kode salah / kedaluwarsa -> kembali ke layar kode
          resetGrant = null;
          startVerification({ email: g.email }, 'reset');
          return setMsg('verify', r.message || 'Kode salah atau kedaluwarsa. Minta kode baru.');
        }
        return setMsg('reset', r.message);
      }
      delete loginThrottle[g.email];
      resetGrant = null;
      $('auResetPass').value = '';
      $('auResetPass2').value = '';
      showView('login');
      $('auLoginEmail').value = g.email;
      setMsg('login', 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.', 'success');
      toast('Kata sandi berhasil diubah');
    });
  }

  /* ---------------- Google ---------------- */
  function loadGsi() {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('gsi')); };
      document.head.appendChild(s);
    });
  }

  function finishGoogle(info) {
    if (!info || !info.email || info.email_verified === false) {
      return setMsg(screen.dataset.view === 'login' ? 'login' : 'register', 'Email Google tidak valid / belum terverifikasi.');
    }
    var email = String(info.email).toLowerCase();
    var user = findUser(email);
    var isNew = !user;
    if (!user) {
      user = { id: 'g' + (info.sub || Date.now().toString(36)), name: info.name || email.split('@')[0], email: email, provider: 'google' };
    }
    user.verified = true;
    user.googleId = info.sub || user.googleId;
    if (safePicture(info.picture)) user.picture = info.picture;
    if (!user.name && info.name) user.name = info.name;
    upsertUser(user);
    login(user, isNew ? 'Akun berhasil dibuat dengan Google. Selamat datang, ' + firstName(user) + '!' : 'Selamat datang kembali, ' + firstName(user) + '!');
  }

  async function googleFlow(btn) {
    var view = screen.dataset.view === 'login' ? 'login' : 'register';
    setMsg(view, '');

    // Mode backend: endpoint mengembalikan JSON { "url": "<alamat login Google/Supabase>" }.
    // Ambil dulu JSON-nya, lalu pindahkan browser ke alamat itu.
    if (CFG.API_BASE) {
      btn.setAttribute('aria-busy', 'true');
      setMsg(view, 'Menghubungkan ke Google...', 'info');
      try {
        var res = await fetch(CFG.API_BASE.replace(/\/+$/, '') + CFG.GOOGLE_LOGIN_PATH + '?ngrok-skip-browser-warning=1', {
          headers: { Accept: 'application/json' }
        });
        var ctype = res.headers.get('content-type') || '';
        if (ctype.indexOf('json') < 0) throw new Error('NOT_JSON status=' + res.status + ' type=' + ctype);
        var data = await res.json();
        var target = data && (data.url || data.auth_url || data.redirect_url);
        if (!res.ok || !target) throw new Error('Respons backend tidak berisi url');
        try { sessionStorage.setItem('lb_auth_return', ctx.returnTo || ctx.resumeSection || ''); } catch (e) { /* abaikan */ }
        window.location.href = target;
      } catch (err) {
        btn.removeAttribute('aria-busy');
        console.error('[Auth] Gagal menghubungi backend:', err);
        var why = String(err && err.message || err);
        if (why.indexOf('NOT_JSON') === 0) {
          setMsg(view, 'Server membalas, tapi bukan JSON (' + why.replace('NOT_JSON ', '') + '). Kemungkinan halaman ngrok / backend belum jalan atau path /api/auth/google salah.');
        } else if (why.indexOf('Respons backend') === 0) {
          setMsg(view, 'Backend membalas JSON tapi tanpa field "url". Cek endpoint /api/auth/google.');
        } else {
          // Bedakan: server tidak terjangkau (tunnel mati) vs server hidup tapi CORS menolak
          var reachable = false;
          try {
            await fetch(CFG.API_BASE.replace(/\/+$/, '') + CFG.GOOGLE_LOGIN_PATH + '?ngrok-skip-browser-warning=1', { mode: 'no-cors' });
            reachable = true;
          } catch (e2) { reachable = false; }
          if (reachable) {
            setMsg(view, 'Server terjangkau, tapi diblokir CORS. Minta backend (FastAPI) mengizinkan origin ' + location.origin + ' di allow_origins. Jika sudah, cek apakah endpoint melakukan redirect (mis. / di akhir path).');
          } else {
            setMsg(view, 'Server tidak terjangkau. Tunnel ngrok kemungkinan mati / URL sudah berganti. Minta URL ngrok terbaru, lalu ubah di index.html (LB_CONFIG).');
          }
        }
      }
      return;
    }

    if (!CFG.GOOGLE_CLIENT_ID) {
      return setMsg(view, 'Daftar dengan Google belum aktif: isi GOOGLE_CLIENT_ID di auth.js.', 'info');
    }
    if (location.protocol === 'file:') {
      return setMsg(view, 'Google tidak bisa jalan dari file://. Buka lewat Live Server atau hosting (http/https).', 'info');
    }
    btn.setAttribute('aria-busy', 'true');
    try {
      await loadGsi();
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CFG.GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async function (resp) {
          btn.removeAttribute('aria-busy');
          if (!resp || resp.error || !resp.access_token) return setMsg(view, 'Proses Google dibatalkan atau gagal.');
          try {
            var r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } });
            if (!r.ok) throw new Error('userinfo');
            finishGoogle(await r.json());
          } catch (err) { setMsg(view, 'Gagal mengambil data akun Google. Coba lagi.'); }
        },
        error_callback: function () {
          btn.removeAttribute('aria-busy');
          setMsg(view, 'Jendela Google ditutup atau diblokir browser.');
        }
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      btn.removeAttribute('aria-busy');
      setMsg(view, 'Tidak bisa memuat Google. Periksa koneksi internet kamu.');
    }
  }
  screen.querySelectorAll('[data-google]').forEach(function (b) {
    b.addEventListener('click', function () { googleFlow(b); });
  });

  /* ---------------- pemicu buka/tutup ---------------- */
  document.addEventListener('click', function (e) {
    var openEl = e.target.closest('[data-auth-open]');
    if (openEl) { e.preventDefault(); openAuth(openEl.dataset.authOpen, { returnTo: ctx.returnTo }); return; }
    var closeEl = e.target.closest('[data-auth-close]');
    if (closeEl) { e.preventDefault(); closeAuth(); }
  });

  // Tombol "Masuk" di navbar: belum login -> halaman masuk; sudah login -> profil
  if (navBtn) {
    navBtn.addEventListener('click', function () {
      if (currentUser()) { if (typeof window.switchSection === 'function') window.switchSection('sec-profil'); }
      else openAuth('login');
    });
  }

  // Menu "Profil" hanya untuk yang sudah masuk (capture = jalan sebelum handler navbar)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-section="sec-profil"]');
    if (link && !currentUser()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openAuth('login', { returnTo: 'sec-profil' });
      setMsg('login', 'Masuk dulu untuk membuka profil kamu.', 'info');
    }
  }, true);

  // Tombol favorit / simpan wishlist hanya untuk yang sudah masuk:
  // kartu di Beranda, hati di "Wisata Terdekat", dan bookmark di panel detail.
  // (capture = jalan sebelum handler masing-masing tombol)
  var FAV_SELECTOR = '.landing-card-fav, .ex-near-fav, #dSave';
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest(FAV_SELECTOR) : null;
    if (!el || currentUser()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var sec = document.querySelector('.content-section:not(.d-none)');
    openAuth('login', { resumeSection: sec ? sec.id : null });
    pendingFav = el;
    setMsg('login', 'Masuk atau daftar dulu untuk menyimpan wisata ke favorit.', 'info');
  }, true);

  /* ---------------- sinkron dengan halaman Profil ---------------- */
  var pfSave = $('pfSave');
  if (pfSave) {
    pfSave.addEventListener('click', function () {
      var u = currentUser();
      var first = ($('pfFirst') && $('pfFirst').value.trim()) || '';
      var last = ($('pfLast') && $('pfLast').value.trim()) || '';
      if (!u || !first) return;
      u.name = (first + ' ' + last).trim().slice(0, CFG.MAX_NAME);
      upsertUser(u);
      renderNav();
    });
  }
  var pfLogout = $('pfLogout');
  if (pfLogout) pfLogout.addEventListener('click', logout);

  var pfFile = $('pfAvatarFile');
  if (pfFile) {
    pfFile.addEventListener('change', function () {
      var u = currentUser(), f = pfFile.files && pfFile.files[0];
      if (!u || !f || f.size > 400 * 1024) return;  // simpan hanya yang kecil (batas localStorage)
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return;  // tolak SVG / file bukan gambar
      var fr = new FileReader();
      fr.onload = function () { if (!safePicture(fr.result)) return; u.picture = fr.result; upsertUser(u); renderNav(); fillProfile(); };
      fr.readAsDataURL(f);
    });
  }

  /* ---------------- balik dari login Google (backend) ----------------
     Backend mengarahkan balik ke web ini dengan data di URL, contoh:
       https://situs-kamu/?token=<JWT>
       https://situs-kamu/?token=...&email=a@b.com&name=Budi&picture=https://...
       https://situs-kamu/?error=pesan   (jika gagal)
     Parameter di hash (#token=...) juga dibaca. Jika token berupa JWT,
     email / nama / foto dibaca dari isinya. */
  function parseJwt(t) {
    try {
      var p = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(atob(p).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers);
    var tk = null;
    try { tk = localStorage.getItem(LS_TOKEN); } catch (e) { /* abaikan */ }
    if (tk) opts.headers.Authorization = 'Bearer ' + tk;
    return fetch(CFG.API_BASE.replace(/\/+$/, '') + path + (path.indexOf('?') < 0 ? '?' : '&') + 'ngrok-skip-browser-warning=1', opts);
  }

  async function handleBackendCallback() {
    var q = new URLSearchParams(location.search);
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var KEYS = ['token', 'access_token', 'jwt', 'id_token', 'email', 'name', 'picture', 'sub', 'error', 'auth_error'];
    var get = function (k) { return q.get(k) || h.get(k); };

    var err = get('error') || get('auth_error');
    var token = get('token') || get('access_token') || get('jwt') || get('id_token');
    var email = get('email');
    if (!err && !token && !email) return;

    var info = { email: email, name: get('name'), picture: get('picture'), sub: get('sub'), email_verified: true };
    var hadToken = !!token;

    // bersihkan parameter dari URL (token tidak boleh tertinggal di address bar)
    KEYS.forEach(function (k) { q.delete(k); h.delete(k); });
    var qs = q.toString(), hs = h.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (hs ? '#' + hs : ''));

    try { ctx.returnTo = sessionStorage.getItem('lb_auth_return') || null; sessionStorage.removeItem('lb_auth_return'); } catch (e) { /* abaikan */ }

    if (err) {
      openAuth('login');
      return setMsg('login', 'Login Google gagal: ' + err);
    }

    if (token) {
      try { localStorage.setItem(LS_TOKEN, token); } catch (e) { /* abaikan */ }
      var c = parseJwt(token) || {};
      if (c.exp && c.exp * 1000 < Date.now()) {
        try { localStorage.removeItem(LS_TOKEN); } catch (e) { /* abaikan */ }
        openAuth('login');
        return setMsg('login', 'Sesi Google sudah kedaluwarsa. Silakan masuk lagi.');
      }
      // isi token diutamakan dibanding parameter URL (yang bisa dipalsukan)
      info.email = c.email || info.email || (String(c.sub || '').indexOf('@') > 0 ? c.sub : '');
      info.name = info.name || c.name || c.full_name;
      info.picture = info.picture || c.picture || c.avatar;
      info.sub = info.sub || c.sub || c.id || c.user_id;
    }

    // Token saja tanpa email: tanyakan ke endpoint "saya" (jika diatur)
    if (!info.email && token && CFG.ME_PATH) {
      try {
        var r = await apiFetch(CFG.ME_PATH);
        if (r.ok) {
          var me = await r.json();
          info.email = me.email;
          info.name = info.name || me.name || me.full_name;
          info.picture = info.picture || me.picture || me.avatar;
          info.sub = info.sub || me.id || me.sub;
        }
      } catch (e) { /* ditangani di bawah */ }
    }

    if (!info.email) {
      openAuth('login');
      return setMsg('login', 'Login Google berhasil, tetapi backend tidak mengirim email. Hubungi admin.');
    }
    // Tanpa token, parameter ?email= di URL bisa dipalsukan siapa pun → tolak
    if (!hadToken || !EMAIL_RE.test(String(info.email))) {
      openAuth('login');
      return setMsg('login', 'Data login Google tidak valid.');
    }
    finishGoogle(info);
  }

  renderNav();
  fillProfile();

  if (document.readyState === 'complete') handleBackendCallback();
  else window.addEventListener('load', handleBackendCallback);

  window.LBAuth = { open: openAuth, close: closeAuth, logout: logout, currentUser: currentUser, config: CFG, apiFetch: apiFetch };
})();