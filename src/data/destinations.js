/* Destinasi populer di Beranda.
   img    = daftar nama file di public/assets/ (dicoba berurutan sampai ada yang ketemu)
   match  = nama tempat di GeoJSON, coords = [lat, lng] cadangan bila tidak ada di GeoJSON
   Setelah nama file di public/assets/ dipastikan, sisakan satu nama saja per destinasi. */
export const DESTINATIONS = [
  { key: 'Uluwatu', cat: 'budaya', img: ['uluwatu.jpg', 'pura-uluwatu.jpg'], title: 'Uluwatu, Bali', rating: '4.8', match: 'Uluwatu Temple', coords: [-8.8291, 115.0849], blurb: 'Pura di tepi tebing kapur dengan pemandangan samudra Hindia. Waktu terbaik datang menjelang sore, saat langit berubah jingga di atas jurang.' },
  { key: 'Tanah Lot', cat: 'budaya', img: ['tanahlot.jpg', 'tanah-lot.jpg', 'pura-tanah-lot.jpg'], title: 'Pura Tanah Lot, Tabanan', rating: '4.7', match: 'Tanah Lot', coords: [-8.6212, 115.0868], blurb: 'Pura yang berdiri di atas batu karang di tengah laut. Saat air surut, pengunjung bisa mendekat dan melihat ombak mengelilingi kaki pura.' },
  { key: 'Tegallalang', cat: 'alam', img: ['tegallalang.jpg', 'tegalalang.jpg'], title: 'Tegallalang Rice Terrace', rating: '4.6', match: 'Ricefields Tegallalang', coords: [-8.4312, 115.2792], blurb: 'Sawah berundak di utara Ubud. Jalur setapak mengikuti pematang, dengan pemandangan hijau yang berlapis sampai ke lembah.' },
  { key: 'Kuta', cat: 'olahraga', img: ['pantai-kuta.jpg', 'kuta.jpg'], title: 'Pantai Kuta & Legian', rating: '4.5', match: 'Pantai Kuta', coords: [-8.7180, 115.1686], blurb: 'Pantai pasir panjang dengan ombak yang ramah untuk pemula. Senja di sini ramai, dengan deretan kafe tepat di belakang pantai.' },
  { key: 'Ulun Danu Beratan', cat: 'budaya', img: ['pura-ulun-danu.jpg', 'puraulundanu.webp', 'pura-ulun-danu.webp'], title: 'Pura Ulun Danu Beratan', rating: '4.8', match: 'Ulun Danu Beratan', coords: [-8.2755, 115.1666], blurb: 'Pura di tepi Danau Beratan, Bedugul. Sebagian pelataran seolah mengapung ketika permukaan danau sedang tinggi.' },
  { key: 'Pandawa', cat: 'alam edukasi', img: ['pantai-pandawa.jpg', 'pantaipandawa.jpg'], title: 'Pantai Pandawa, Badung', rating: '4.7', match: 'Pantai Pandawa', coords: [-8.8456, 115.1869], blurb: 'Pantai tersembunyi di balik tebing kapur, dengan patung Pandawa di dinding batu. Airnya jernih dan pasirnya putih.' },
];

/** Foto lokal bila nama tempat cocok dengan destinasi populer. */
export function photoForPlace(place) {
  const name = String(place?.nama || place?.title || '').toLowerCase();
  if (!name) return null;
  const hit = DESTINATIONS.find((d) => {
    const keys = [d.match, d.title, d.key].map((s) => String(s || '').toLowerCase());
    return keys.some((k) => k && (name.includes(k) || k.includes(name)));
  });
  return hit ? hit.img : null;
}

export const CHIPS = [['all', 'All'], ['budaya', 'Budaya'], ['alam', 'Alam'], ['olahraga', 'Olahraga'], ['edukasi', 'Edukasi']];

/** Batas geser peta: barat-daya dan timur-laut Pulau Bali. */
export const BALI_SW = [-8.95, 114.4];
export const BALI_NE = [-8.0, 115.7];
export const BALI_MIN_ZOOM = 9;

export const EXPLORE_CATS = [
  { id: 'alam', label: 'Alam', chip: 'chip-alam' },
  { id: 'budaya', label: 'Budaya', chip: 'chip-budaya' },
  { id: 'rekreasi', label: 'Rekreasi', chip: 'chip-rekreasi' },
  { id: 'umum', label: 'Umum', chip: 'chip-umum' },
];

const ALAM = ['alam', 'alami', 'pantai', 'air terjun', 'danau', 'gunung'];
const BUDAYA = ['budaya', 'religi', 'museum', 'pura', 'candi', 'sejarah'];
const REKREASI = ['rekreasi', 'kuliner', 'edukasi', 'taman', 'hiburan', 'olahraga'];

export function categoryGroup(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'umum';
  if (ALAM.some((k) => s.includes(k))) return 'alam';
  if (BUDAYA.some((k) => s.includes(k))) return 'budaya';
  if (REKREASI.some((k) => s.includes(k))) return 'rekreasi';
  return 'umum';
}

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointOf(place) {
  const lat = Number(place.lat ?? place.coords?.[0]);
  const lng = Number(place.lng ?? place.coords?.[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/** Teks AND kategori (kosong = semua) AND radius bila diaktifkan. */
export function filterPlaces(places, { query = '', categories = [], origin = null, radiusOn = false, radiusKm = 10 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const cats = categories.map((c) => String(c).toLowerCase());
  return places.filter((p) => {
    const name = String(p.nama || p.title || '').toLowerCase();
    if (q && !name.includes(q)) return false;
    if (cats.length && !cats.includes(categoryGroup(p.kategori || p.cat))) return false;
    if (radiusOn && origin) {
      const pt = pointOf(p);
      if (!pt || haversineKm(origin, pt) > Number(radiusKm)) return false;
    }
    return true;
  });
}

/** Urut terdekat dari titik pengguna, dibatasi perkiraan durasi (3 titik per hari). */
export function buildRoute(origin, places, days) {
  if (!origin || !places.length) return [];
  const limit = Math.max(1, Math.min(places.length, Number(days) * 3 || 3));
  const left = places.slice();
  const picked = [];
  let cursor = origin;
  while (picked.length < limit && left.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < left.length; i += 1) {
      const pt = pointOf(left[i]);
      const d = pt ? haversineKm(cursor, pt) : Infinity;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const next = left.splice(bestI, 1)[0];
    picked.push(next);
    const pt = pointOf(next);
    if (pt) cursor = pt;
  }
  return picked;
}