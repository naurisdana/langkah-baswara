/* Helper API + path aset. Semua file statis ada di public/ → URL publik dimulai dari "/". */

// Foto/gambar: public/assets/<nama-file>  →  /assets/<nama-file>
export const assetUrl = (file) => `/assets/${encodeURIComponent(file)}`;

// Data spasial: public/data/wisata-bali.geojson  →  /data/wisata-bali.geojson
export const GEOJSON_URL = '/data/wisata-bali.geojson';

// Browser selalu memanggil /api di origin yang sama (login: /api/auth/login).
// Dev: proxy Vite di vite.config.js. Produksi: fungsi Vercel di /api.
// Jangan panggil URL ngrok langsung dari browser — backend menolak origin Vercel.
export const API_BASE = '';

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

export async function apiRequest(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(API_BASE.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, data, message: res.ok ? null : (messageFrom(data) || 'Tidak dapat terhubung ke server.') };
  } catch (err) {
    console.error(err);
    return { ok: false, data: null, message: 'Tidak dapat terhubung ke server.' };
  }
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