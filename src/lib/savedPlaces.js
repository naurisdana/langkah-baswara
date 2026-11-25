import { detailJelajahi } from './api.js';

const empty = () => ({ wishlist: [], visited: [] });

const keyFor = (email) => `lb_saved:${String(email || '').trim().toLowerCase()}`;

export function loadSaved(email) {
  if (!email) return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(email)) || '');
    return {
      wishlist: Array.isArray(raw.wishlist) ? raw.wishlist : [],
      visited: Array.isArray(raw.visited) ? raw.visited : [],
    };
  } catch {
    return empty();
  }
}

export function saveSaved(email, data) {
  if (!email) return;
  localStorage.setItem(keyFor(email), JSON.stringify({
    wishlist: data.wishlist || [],
    visited: data.visited || [],
  }));
}

export function placeSnapshot(dest) {
  const id = Number(dest.id ?? dest.key);
  const img = (Array.isArray(dest.img) ? dest.img : [dest.img]).filter(Boolean);
  return {
    key: Number.isInteger(id) ? String(id) : String(dest.key),
    id: Number.isInteger(id) ? id : dest.id,
    title: dest.title,
    rating: dest.rating,
    img,
    blurb: dest.blurb || '',
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function blankCard(id) {
  return { key: String(id), id, title: '', rating: '–', img: [], blurb: '' };
}

function cardFromRow(row) {
  if (typeof row === 'number' || (typeof row === 'string' && /^\d+$/.test(row))) {
    const id = Number(row);
    return Number.isInteger(id) ? blankCard(id) : null;
  }
  if (!row || typeof row !== 'object') return null;
  const nested = row.wisata && typeof row.wisata === 'object' ? row.wisata : null;
  const id = Number(row.wisata_id ?? nested?.wisata_id ?? row.id ?? nested?.id);
  if (!Number.isInteger(id)) return null;
  const foto = firstText(row.foto, nested?.foto);
  const img = foto
    ? [foto]
    : (Array.isArray(row.img) ? row.img.filter(Boolean) : []);
  const ratingRaw = row.rating ?? nested?.rating;
  return {
    key: String(id),
    id,
    title: firstText(row.nama, nested?.nama, row.name, nested?.name, row.title),
    rating: ratingRaw == null || ratingRaw === '' ? '–' : String(ratingRaw),
    img,
    blurb: firstText(row.deskripsi, nested?.deskripsi, row.blurb),
  };
}

function firstArray(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const preferred = ['data', 'items', 'results', 'favorit', 'simpan', 'dikunjungi', 'wisata', 'destinasi', 'daftar', 'rows'];
  for (const key of preferred) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  if (Array.isArray(obj.ids)) return obj.ids;
  const arrays = Object.values(obj).filter(Array.isArray);
  return arrays.length === 1 ? arrays[0] : null;
}

/** Ubah balasan GET simpan/dikunjungi menjadi kartu. null = bentuk balasan tidak dikenali. */
export function readSavedPayload(payload) {
  if (Array.isArray(payload)) return { ok: true, rows: payload };
  if (!payload || typeof payload !== 'object') return { ok: false, rows: [] };
  const rows = firstArray(payload) || (payload.data && typeof payload.data === 'object' ? firstArray(payload.data) : null);
  if (rows) return { ok: true, rows };
  if (Object.keys(payload).length === 0) return { ok: true, rows: [] };
  return { ok: false, rows: [] };
}

async function enrichCard(card) {
  if (card.title && card.title !== card.key) return card;
  const r = await detailJelajahi(card.id);
  const detail = r.ok ? (r.data?.data && !Array.isArray(r.data.data) ? r.data.data : r.data) : null;
  if (!detail || typeof detail !== 'object') return card;
  const foto = typeof detail.foto === 'string' ? detail.foto.trim() : '';
  const rating = detail.rating == null || detail.rating === '' ? null : Number(detail.rating);
  return {
    ...card,
    title: detail.nama || card.title,
    rating: Number.isFinite(rating) ? String(rating) : card.rating,
    img: card.img.length ? card.img : (foto ? [foto] : []),
    blurb: detail.deskripsi || card.blurb,
  };
}

export async function cardsFromSavedPayload(payload) {
  const parsed = readSavedPayload(payload);
  if (!parsed.ok) return null;
  const cards = [];
  const seen = new Set();
  parsed.rows.forEach((row) => {
    const card = cardFromRow(row);
    if (!card || seen.has(card.key)) return;
    seen.add(card.key);
    cards.push(card);
  });
  return Promise.all(cards.map(enrichCard));
}

export function togglePlace(list, place) {
  const items = Array.isArray(list) ? list : [];
  if (items.some((item) => item.key === place.key)) {
    return items.filter((item) => item.key !== place.key);
  }
  return [place, ...items];
}
