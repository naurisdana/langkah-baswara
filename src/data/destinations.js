/* Destinasi populer di Beranda.
   img    = daftar nama file di public/assets/ (dicoba berurutan sampai ada yang ketemu)
   match  = nama tempat di GeoJSON, coords = [lat, lng] cadangan bila tidak ada di GeoJSON
   Setelah nama file di public/assets/ dipastikan, sisakan satu nama saja per destinasi. */
export const DESTINATIONS = [
  { key: 'Uluwatu', cat: 'budaya', img: ['uluwatu.jpg', 'pura-uluwatu.jpg'], title: 'Uluwatu, Bali', rating: '4.8', match: 'Uluwatu Temple', coords: [-8.8291, 115.0849] },
  { key: 'Tanah Lot', cat: 'budaya', img: ['tanahlot.jpg', 'tanah-lot.jpg', 'pura-tanah-lot.jpg'], title: 'Pura Tanah Lot, Tabanan', rating: '4.7', match: 'Tanah Lot', coords: [-8.6212, 115.0868] },
  { key: 'Tegallalang', cat: 'alam', img: ['tegallalang.jpg', 'tegalalang.jpg'], title: 'Tegallalang Rice Terrace', rating: '4.6', match: 'Ricefields Tegallalang', coords: [-8.4312, 115.2792] },
  { key: 'Kuta', cat: 'olahraga', img: ['pantai-kuta.jpg', 'kuta.jpg'], title: 'Pantai Kuta & Legian', rating: '4.5', match: 'Pantai Kuta', coords: [-8.7180, 115.1686] },
  { key: 'Ulun Danu Beratan', cat: 'budaya', img: ['pura-ulun-danu.jpg', 'puraulundanu.webp', 'pura-ulun-danu.webp'], title: 'Pura Ulun Danu Beratan', rating: '4.8', match: 'Ulun Danu Beratan', coords: [-8.2755, 115.1666] },
  { key: 'Pandawa', cat: 'alam edukasi', img: ['pantai-pandawa.jpg', 'pantaipandawa.jpg'], title: 'Pantai Pandawa, Badung', rating: '4.7', match: 'Pantai Pandawa', coords: [-8.8456, 115.1869] },
];

export const CHIPS = [['all', 'All'], ['budaya', 'Budaya'], ['alam', 'Alam'], ['olahraga', 'Olahraga'], ['edukasi', 'Edukasi']];