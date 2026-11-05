// Proxy same-origin untuk Vercel.
// Browser memanggil /api di domain situs. Fungsi ini meneruskan ke backend
// supaya CORS (yang hanya membuka localhost) tidak memblokir login.
// URL bisa ditimpa lewat Environment Variable VITE_API_URL di dashboard Vercel.
const TARGET = String(
  process.env.VITE_API_URL
    || process.env.VITE_API_BASE
    || 'https://bauble-clergyman-glisten.ngrok-free.dev',
).replace(/\/+$/, '');

function upstreamUrl(req) {
  const raw = req.url || '';
  if (raw.startsWith('/api')) return TARGET + raw;
  const parts = req.query && req.query.path;
  const suffix = Array.isArray(parts) ? parts.join('/') : (parts || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  return `${TARGET}/api/${suffix}${query}`;
}

function encodeBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (!req.headers['content-type']) return undefined;
  if (req.body == null) return undefined;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
  return JSON.stringify(req.body);
}

export default async function handler(req, res) {
  try {
    const upstream = await fetch(upstreamUrl(req), {
      method: req.method,
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: encodeBody(req),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(502).json({ message: 'Tidak dapat terhubung ke server.' });
  }
}
