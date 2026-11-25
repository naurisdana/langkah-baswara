/* Helper API + path aset. Semua file statis ada di public/ → URL publik dimulai dari "/". */

// Foto/gambar: public/assets/<nama-file>  →  /assets/<nama-file>
export const assetUrl = (file) => `/assets/${encodeURIComponent(file)}`;

/** URL foto: tautan dari backend dipakai apa adanya, nama file lokal lewat /assets. */
export function photoSrc(file) {
  const s = String(file || '').trim();
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:') || s.startsWith('/')) return s;
  return assetUrl(s);
}

// Data spasial: public/data/wisata-bali.geojson  →  /data/wisata-bali.geojson
export const GEOJSON_URL = '/data/wisata-bali.geojson';

const RAILWAY = 'https://web-production-3071457d.up.railway.app';
// Saat development, permintaan lewat proxy Vite (/api) supaya pin tetap muncul
// di port mana pun. Production tetap memanggil Railway langsung.
export const API_BASE = import.meta.env.DEV ? '' : RAILWAY;

export const OTP_LENGTH = 6;
export const BALI_CENTER = [-8.4095, 115.1889];

/* pesan error HANYA diambil dari respon server */
export function messageFrom(body) {
  if (!body) return null;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail.length) {
    return body.detail.map((d) => d.msg).filter(Boolean).join('; ') || null;
  }
  if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string') {
    return body.error.message;
  }
  const m = body.message || body.error || body.msg;
  return typeof m === 'string' ? m : null;
}

function bearer(token) {
  if (typeof token === 'string' && token) return token;
  try {
    return localStorage.getItem('lb_token') || '';
  } catch {
    return '';
  }
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const auth = bearer(token);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(API_BASE.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data, message: res.ok ? null : (messageFrom(data) || 'Tidak dapat terhubung ke server.') };
  } catch (err) {
    console.error(err);
    return { ok: false, status: 0, data: null, message: 'Tidak dapat terhubung ke server.' };
  }
}

/** Permintaan multipart, misalnya PATCH /api/auth/profile (name, foto, password). */
export async function apiForm(path, { method = 'POST', form, token } = {}) {
  const auth = bearer(token);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: form,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data, message: res.ok ? null : (messageFrom(data) || 'Tidak dapat terhubung ke server.') };
  } catch (err) {
    console.error(err);
    return { ok: false, status: 0, data: null, message: 'Tidak dapat terhubung ke server.' };
  }
}

/** GET /api/auth/me — identitas pemilik token. */
export function authMe(token) {
  return apiRequest('/api/auth/me', { token });
}

/** POST /api/auth/logout — cabut token di server. */
export function authLogout(token) {
  return apiRequest('/api/auth/logout', { method: 'POST', token });
}

const SAVED_PATH = { wishlist: 'simpan', visited: 'dikunjungi' };

/** GET daftar favorit atau destinasi yang sudah dikunjungi. */
export function fetchSavedList(kind, token) {
  return apiRequest(`/api/beranda/${SAVED_PATH[kind]}`, { token });
}

/** POST atau DELETE satu wisata di favorit / dikunjungi. */
export function changeSaved(kind, token, wisataId, remove) {
  const base = `/api/beranda/${SAVED_PATH[kind]}`;
  if (remove) return apiRequest(`${base}/${wisataId}`, { method: 'DELETE', token });
  return apiRequest(base, { method: 'POST', token, body: { wisata_id: wisataId } });
}

/** GET /api/beranda/search?q= — hasil kotak cari di Beranda. */
export function searchBeranda(q) {
  const params = new URLSearchParams({ q: String(q || '').trim() });
  return apiRequest(`/api/beranda/search?${params}`);
}

/** GET /api/beranda/populer?kategori= — kartu destinasi populer di Beranda. */
export function populerBeranda(kategori = 'all') {
  const params = new URLSearchParams({ kategori: kategori || 'all' });
  return apiRequest(`/api/beranda/populer?${params}`);
}

/** GET /api/jelajahi/destinasi — daftar titik di peta Jelajahi. */
export function destinasiJelajahi({ q, kategori = [], lat, lng, radiusKm, limit = 1000 } = {}) {
  const params = new URLSearchParams();
  const query = String(q || '').trim();
  if (query) params.set('q', query.slice(0, 100));
  kategori.forEach((k) => { if (k) params.append('kategori', k); });
  if (lat != null && lng != null && radiusKm != null) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
    params.set('radius_km', String(radiusKm));
  }
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return apiRequest(`/api/jelajahi/destinasi${qs ? `?${qs}` : ''}`);
}

/** GET /api/jelajahi/destinasi/{id} — detail satu destinasi (nama path di server). */
export function detailJelajahi(id) {
  return apiRequest(`/api/jelajahi/destinasi/${encodeURIComponent(id)}`);
}

/** POST /api/jelajahi/rute — susun rute dari titik awal. Server menolak GET. */
export function ruteJelajahi({ lat, lng, radiusKm = 15, hari, kategori = [] }) {
  return apiRequest('/api/jelajahi/rute', {
    method: 'POST',
    body: {
      lat,
      lng,
      radius_km: radiusKm,
      hari,
      kategori,
    },
  });
}

// Ubah balasan /api/wisata atau GeoJSON menjadi daftar { nama, kategori, lat, lng }
export function normalizeWisata(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && (payload.features || payload.data || payload.results || payload.items)) || [];
  return rows
    .map((r) => {
      const p = r.properties || r;
      const g = r.geometry && r.geometry.coordinates;
      const lat = g ? Number(g[1]) : Number(p.latitude ?? p.lat);
      const lng = g ? Number(g[0]) : Number(p.longitude ?? p.lng ?? p.lon);
      const kategori = p.kategori && typeof p.kategori === 'object' ? p.kategori.nama : p.kategori;
      const rating = p.rating == null || p.rating === '' ? null : Number(p.rating);
      return {
        nama: p.nama || p.name || '',
        kategori: kategori || '',
        kabupaten: p.kabupaten_kota || p.kabupaten || p.kota || '',
        preferensi: p.preferensi || '',
        rating: Number.isFinite(rating) ? rating : null,
        link: p.link || p.url || '',
        lat,
        lng,
      };
    })
    .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}