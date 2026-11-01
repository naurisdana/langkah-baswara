(function () {
  'use strict';

  const loaderEl = document.getElementById('lbLoader');
  const errorEl = document.getElementById('lbError');
  const bar = document.getElementById('lbBar');
  const reloadBtn = document.getElementById('lbReload');

  // Jika markup tidak ada, sediakan API kosong supaya kode lain tidak error
  if (!loaderEl || !errorEl || !bar) {
    window.LBLoader = { bump() {}, done() {}, fail() {} };
    return;
  }

  const MIN_SHOW_MS = 1200;   // loader minimal tampil segini lama (biar tidak "kedip")
  const TIMEOUT_MS = 30000;   // lebih lama dari ini dianggap gagal memuat
  const preview = new URLSearchParams(location.search).get('lb');
  const t0 = performance.now();

  let state = 'loading';      // loading | done | failed
  let progress = 0;           // nilai yang tampil di bar (0-100)
  let target = 8;             // nilai yang sedang dikejar
  let finishing = false;
  let finishScheduled = false;
  let pageLoaded = false;
  let dataReady = false;
  let raf = 0;
  let trickleTimer = 0;
  let timeoutTimer = 0;

  function render() {
    bar.style.setProperty('--p', progress.toFixed(2));
    bar.setAttribute('aria-valuenow', String(Math.round(progress)));
  }

  function frame() {
    if (state !== 'loading') return;
    const speed = finishing ? 0.14 : 0.05;
    progress += (target - progress) * speed;
    if (target - progress < (finishing ? 0.4 : 0.02)) progress = target;
    render();
    if (finishing && progress >= 100) {
      setTimeout(hide, 320); // jeda sebentar supaya bar terlihat penuh
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  // Bar terus merayap pelan sampai ~90% selama proses belum selesai
  function trickle() {
    if (state !== 'loading' || finishing) return;
    if (target < 90) target = Math.min(90, target + 1 + Math.random() * 5 * (1 - target / 100));
  }

  function bump(n) {
    if (state !== 'loading' || finishing) return;
    target = Math.max(target, Math.min(n, 92));
  }

  function stopTimers() {
    cancelAnimationFrame(raf);
    clearInterval(trickleTimer);
    clearTimeout(timeoutTimer);
  }

  function hide() {
    if (state !== 'loading') return;
    state = 'done';
    stopTimers();
    loaderEl.classList.remove('is-active');
    document.body.classList.remove('lb-lock');
    // Jika peta sudah ada, pastikan ukurannya benar setelah overlay hilang
    if (window._leafletMap && typeof window._leafletMap.invalidateSize === 'function') {
      setTimeout(() => window._leafletMap && window._leafletMap.invalidateSize(), 50);
    }
  }

  function fail(reason) {
    if (state === 'failed') return;
    state = 'failed';
    stopTimers();
    console.warn('[LBLoader] Gagal memuat:', reason || 'tidak diketahui');
    loaderEl.classList.remove('is-active');
    errorEl.classList.add('is-active');
    document.body.classList.add('lb-lock');
  }

  function tryFinish() {
    if (state !== 'loading' || finishScheduled) return;
    if (!pageLoaded || !dataReady) return;
    if (preview === 'loading') return; // mode pratinjau: tahan loader
    finishScheduled = true;
    const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - t0));
    setTimeout(() => {
      if (state !== 'loading') return;
      finishing = true;
      target = 100;
    }, wait);
  }

  // Tombol "Muat Ulang"
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      reloadBtn.disabled = true;
      reloadBtn.classList.add('is-busy');
      reloadBtn.textContent = 'Memuat...';
      setTimeout(() => location.reload(), 250);
    });
  }

  // Pantau tahap pemuatan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bump(30));
  } else {
    bump(30);
  }

  function onPageLoaded() {
    pageLoaded = true;
    bump(70);
    tryFinish();
  }
  if (document.readyState === 'complete') {
    onPageLoaded();
  } else {
    window.addEventListener('load', onPageLoaded);
  }

  window.LBLoader = {
    bump,
    fail,
    // dipanggil saat data GeoJSON sudah siap
    done() {
      dataReady = true;
      bump(85);
      tryFinish();
    }
  };

  // Mulai animasi
  if (preview === 'error') {
    fail('pratinjau (?lb=error)');
    return;
  }
  render();
  raf = requestAnimationFrame(frame);
  trickleTimer = setInterval(trickle, 500);
  if (preview !== 'loading') {
    timeoutTimer = setTimeout(() => { if (state === 'loading') fail('timeout'); }, TIMEOUT_MS);
  }
})();

(function () {
      'use strict';

      // true  = jika data GeoJSON gagal diambil, tampilkan halaman "Oops! Halaman ini tidak tersedia!"
      // false = perilaku lama (diam-diam pakai marker cadangan, loader tetap selesai)
      const SHOW_ERROR_ON_DATA_FAIL = true;

      // ---------- Sumber data wisata ----------
      // true  = ambil data dari backend (GET /api/wisata); jika gagal otomatis pakai file lokal
      // false = selalu pakai public/data/wisata-bali.geojson
      const USE_WISATA_API = true;
      const API_BASE = String((window.LB_CONFIG && window.LB_CONFIG.API_BASE) || 'https://2fz3bcnb-8000.asse.devtunnels.ms').replace(/\/+$/, '');
      const WISATA_API_PATH = '/api/wisata';
      const API_TIMEOUT_MS = 8000;

      // Koordinat default
      const BALI = [-8.409518, 115.188919];
      const ULUWATU = [-8.8291, 115.0849];

      // Variabel state & layer
      let map = null;
      let markers = null;
      let boundsLayer = null;
      let userMarker = null;
      let allFeatures = [];

      let currentSearch = '';
      let currentKabupaten = 'all';
      let currentCategory = 'all';

      // Konfigurasi Basemap Tile Layers
      const layers = {
        street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri'
        }),
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; OSM &copy; CARTO'
        })
      };

      // 1. Inisialisasi Peta Leaflet yang aman dari konflik "Map container is already initialized"
      function initMap() {
        const container = document.getElementById('map');
        if (!container) return;

        // Bersihkan instance lama jika sudah terpasang
        if (window._leafletMap && typeof window._leafletMap.remove === 'function') {
          window._leafletMap.remove();
          window._leafletMap = null;
        } else if (container._leaflet_id) {
          container._leaflet_id = null;
        }

        map = L.map('map', {
          center: BALI,
          zoom: 10,
          zoomControl: false,
          zoomSnap: 0.25,
          minZoom: 9,
          maxBounds: BALI_MAX,
          maxBoundsViscosity: 1.0,
          layers: [layers.street]
        });

        // Simpan referensi global agar bisa di-remove dengan aman saat re-render
        window._leafletMap = map;

        // Group layer untuk titik wisata (kontrol zoom memakai tombol kustom di halaman Jelajahi)
        markers = L.layerGroup().addTo(map);

        // Peta dikunci ke Pulau Bali & otomatis menyesuaikan ukuran
        watchMapSize();
      }

      // Hanya izinkan URL http(s) (cegah javascript: / data: dari data API)
      function safeUrl(u) {
        try {
          const x = new URL(String(u), location.href);
          return /^https?:$/.test(x.protocol) ? x.href : '';
        } catch (e) { return ''; }
      }

      // Template popup info destinasi (semua data di-escape agar aman dari XSS)
      function createPopupContent(props) {
        const loc = esc(props.kabupaten_kota || 'Bali');
        const nama = esc(props.nama || 'Destinasi Wisata');
        const rating = props.rating ? `⭐ ${esc(props.rating)}` : '⭐ 4.5';
        const kategori = props.kategori ? ` • ${esc(props.kategori)}` : '';
        const linkOk = safeUrl(props.link);
        const mapAction = linkOk
          ? `<a href="${esc(linkOk)}" target="_blank" rel="noopener noreferrer" class="btn btn-navy btn-sm w-100 text-white text-decoration-none text-center d-block mt-2">Buka di Peta ↗</a>`
          : `<button class="btn btn-navy btn-sm w-100 mt-2" type="button">Lihat Detail Lengkap</button>`;

        return `
          <div class="popup-card p-2">
            <div class="loc">${loc}</div>
            <h6 class="fw-bold mb-1">${nama}</h6>
            <div class="small mb-1"><span class="rating-val">${rating}</span>${kategori}</div>
            ${mapAction}
          </div>`;
      }

      // ==========================================
      // HALAMAN JELAJAHI: batas Bali, panel, detail, radius & rute
      // (data GeoJSON & peta dasar tidak diubah, hanya tampilan/UI)
      // ==========================================
      const BALI_BOUNDS = L.latLngBounds([-8.95, 114.35], [-8.0, 115.8]);   // wilayah pulau Bali
      const BALI_MAX = L.latLngBounds([-9.05, 113.95], [-7.9, 115.95]);     // batas geser peta (sedikit lebih longgar)

      const CAT_META = {
        alam: { icon: 'bi-tree-fill', label: 'Wisata Alam' },
        budaya: { icon: 'bi-bank2', label: 'Wisata Budaya' },
        rekreasi: { icon: 'bi-camera-fill', label: 'Rekreasi' },
        umum: { icon: 'bi-geo-alt-fill', label: 'Wisata Umum' }
      };

      // Nama properti GeoJSON yang dicoba berurutan (sesuaikan di sini jika nama field datamu berbeda)
      const PROP_KEYS = {
        alamat: ['alamat', 'address', 'lokasi', 'desa', 'kecamatan'],
        deskripsi: ['deskripsi', 'description', 'keterangan', 'ket'],
        harga: ['harga_tiket', 'tiket', 'harga', 'htm', 'ticket', 'price', 'biaya'],
        foto: ['foto', 'gambar', 'image', 'img', 'thumbnail', 'photo', 'url_foto', 'foto_url']
      };

      // Foto lokal yang sudah ada di public/assets (dipakai bila data tidak punya foto)
      const KNOWN_PHOTOS = [
        [/^uluwatu temple$/i, 'public/assets/uluwatu.jpg'],
        [/^tanah lot$/i, 'public/assets/tanahlot.jpg'],
        [/^ricefields tegal+alang/i, 'public/assets/tegallalang.jpg'],
        [/^pantai kuta$/i, 'public/assets/kuta.jpg'],
        [/beratan/i, 'public/assets/puraulundanu.webp'],
        [/^pantai pandawa$/i, 'public/assets/pantaipandawa.jpg']
      ];

      let selectedFeature = null;
      let userLatLng = null;
      let currentRating = 0;
      let radiusKm = 0;
      let radiusCenter = null;
      let radiusCircle = null;
      let routeLayer = null;
      let lastRendered = [];
      let viewFitted = false;
      const featureMarkers = new Map();
      let pillMode = false; // mode hasil pencarian: marker berupa label nama + harga

      const $id = (id) => document.getElementById(id);
      const setText = (id, v) => { const el = $id(id); if (el) el.textContent = v; };
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const isDesktop = () => window.matchMedia('(min-width: 992px)').matches;

      function pick(props, keys) {
        for (const k of keys) {
          if (props && props[k] != null && String(props[k]).trim() !== '') return props[k];
        }
        return null;
      }

      function coordsOf(f) {
        const c = f && f.geometry && f.geometry.coordinates;
        if (!Array.isArray(c)) return null;
        const lng = Number(c[0]);
        const lat = Number(c[1]);
        return isFinite(lat) && isFinite(lng) ? [lat, lng] : null;
      }

      function distKm(a, b) {
        const R = 6371;
        const rad = (d) => (d * Math.PI) / 180;
        const dLat = rad(b[0] - a[0]);
        const dLng = rad(b[1] - a[1]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      }

      function ratingOf(f) {
        const r = parseFloat(f && f.properties && f.properties.rating);
        return isFinite(r) ? r : 0;
      }

      function formatPrice(v) {
        if (v == null) return null;
        const n = Number(String(v).replace(/[^\d.-]/g, ''));
        if (typeof v === 'number' || /^[\d.,\s]+$/.test(String(v))) {
          return n === 0 ? 'Gratis' : 'Rp ' + n.toLocaleString('id-ID');
        }
        return String(v);
      }

      function mapsLink(f) {
        const p = (f && f.properties) || {};
        const safeLink = safeUrl(p.link);
        if (safeLink) return safeLink;
        const c = coordsOf(f);
        return c ? 'https://www.google.com/maps?q=' + c[0] + ',' + c[1] : '#';
      }

      function photoFor(f) {
        const p = (f && f.properties) || {};
        const raw = pick(p, PROP_KEYS.foto);
        if (raw && /^(https?:)?\/\/|^public\/|^\.?\//.test(String(raw))) return String(raw);
        const name = p.nama || '';
        const hit = KNOWN_PHOTOS.find(([re]) => re.test(name));
        return hit ? hit[1] : null;
      }

      function photoHtml(f, cls) {
        const src = photoFor(f);
        const cat = getCategoryGroup(f);
        if (src) return `<img src="${esc(src)}" alt="${esc((f.properties && f.properties.nama) || 'Destinasi')}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ex-photo-ph cat-${cat}',innerHTML:'<i class=&quot;bi ${(CAT_META[cat] || CAT_META.umum).icon}&quot;></i>'}))" />`;
        return `<div class="ex-photo-ph cat-${cat}"><i class="bi ${(CAT_META[cat] || CAT_META.umum).icon}"></i></div>`;
      }

      // ---------- Marker (pin berwarna per kategori) ----------
      function pinIcon(cat, selected) {
        const m = CAT_META[cat] || CAT_META.umum;
        return L.divIcon({
          className: 'lb-pin-wrap',
          html: `<span class="lb-pin cat-${cat}${selected ? ' is-selected' : ''}"><i class="bi ${m.icon}"></i></span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 38]
        });
      }

      // Harga ringkas untuk label marker (Rp 50k / Gratis)
      function shortPrice(f) {
        const s = formatPrice(pick((f && f.properties) || {}, PROP_KEYS.harga));
        if (!s) return '';
        const m = String(s).match(/^Rp\s([\d.,]+)$/);
        if (m) {
          const n = Number(m[1].replace(/[.,]/g, ''));
          return n >= 1000 ? 'Rp ' + String(n / 1000).replace('.', ',') + 'k' : s;
        }
        return String(s).length > 14 ? String(s).slice(0, 13) + '…' : String(s);
      }

      // Marker berbentuk label (seperti mockup hasil pencarian)
      function pillIcon(f, selected) {
        const p = (f && f.properties) || {};
        const cat = getCategoryGroup(f);
        const price = shortPrice(f);
        return L.divIcon({
          className: 'lb-pill-wrap',
          html: `<span class="lb-pill cat-${cat}${selected ? ' is-selected' : ''}"><i class="lb-pill-dot"></i><b>${esc(p.nama || 'Destinasi')}</b>${price ? `<em class="${price === 'Gratis' ? 'is-free' : ''}">${esc(price)}</em>` : ''}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
      }

      function markerIcon(f, selected) {
        return pillMode ? pillIcon(f, selected) : pinIcon(getCategoryGroup(f), selected);
      }

      // Render daftar marker ke peta
      function renderMarkers(features) {
        if (!markers || !map) return;
        markers.clearLayers();
        featureMarkers.clear();
        lastRendered = features || [];

        lastRendered.forEach((feature) => {
          const c = coordsOf(feature);
          if (!c) return;
          const isSel = feature === selectedFeature;
          const m = L.marker(c, { icon: markerIcon(feature, isSel), zIndexOffset: isSel ? 1000 : 0 });
          const nama = feature.properties && feature.properties.nama;
          if (nama && !pillMode) m.bindTooltip(esc(nama), { direction: 'top', offset: [0, -36], className: 'lb-tip' });
          m.on('click', () => selectFeature(feature, { fly: false }));
          m.addTo(markers);
          featureMarkers.set(feature, m);
        });
      }

      // ---------- Detail destinasi ----------
      function refreshMarker(f) {
        const m = f && featureMarkers.get(f);
        if (!m) return;
        const sel = f === selectedFeature;
        m.setIcon(markerIcon(f, sel));
        m.setZIndexOffset(sel ? 1000 : 0);
      }

      function nearestOf(f, n) {
        const c = coordsOf(f);
        if (!c) return [];
        return allFeatures
          .filter((x) => x !== f && coordsOf(x))
          .map((x) => ({ x, d: distKm(c, coordsOf(x)) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, n);
      }

      function renderDetail(f) {
        const p = f.properties || {};
        const cat = getCategoryGroup(f);
        const meta = CAT_META[cat] || CAT_META.umum;
        const c = coordsOf(f);

        const r = ratingOf(f);
        const area = pick(p, ['kecamatan']) || p.kabupaten_kota;
        setText('dEyebrow', r >= 4.5 ? 'PILIHAN TERPOPULER' : (p.kabupaten_kota ? String(p.kabupaten_kota) : 'Destinasi Wisata').toUpperCase());
        setText('dName', area ? 'Kawasan Wisata ' + area : (p.nama || 'Destinasi Wisata'));
        setText('dPlace', p.nama || 'Destinasi Wisata');
        $id('dPlace').hidden = !area;

        const photoSrc = photoFor(f);
        $id('dPhoto').innerHTML =
          photoHtml(f) +
          (r ? `<span class="ex-rating"><i class="bi bi-star-fill"></i> ${esc(r.toFixed(1))}</span>` : '') +
          (photoSrc ? `<a class="ex-photo-btn" href="${esc(photoSrc)}" target="_blank" rel="noopener noreferrer" aria-label="Lihat foto penuh"><i class="bi bi-fullscreen"></i></a>` : '');

        const alamat = pick(p, PROP_KEYS.alamat);
        setText('dAddr', alamat || [p.kabupaten_kota, 'Bali'].filter(Boolean).join(', ') + (c ? ' • ' + c[0].toFixed(4) + ', ' + c[1].toFixed(4) : ''));

        const tags = [];
        tags.push(p.preferensi ? String(p.preferensi) : meta.label);
        if (p.kategori) tags.push('Kategori ' + String(p.kategori));
        if (p.kabupaten_kota) tags.push(String(p.kabupaten_kota));
        $id('dTags').innerHTML = tags.slice(0, 4).map((t) => `<span class="ex-tag">${esc(t)}</span>`).join('');

        const desc = pick(p, PROP_KEYS.deskripsi);
        const descEl = $id('dDesc');
        descEl.textContent = desc || '';
        descEl.hidden = !desc;

        const harga = formatPrice(pick(p, PROP_KEYS.harga));
        if (harga) {
          setText('dFootLabel', 'Tiket Masuk');
          $id('dFootValue').innerHTML = /^Rp\s/.test(harga) ? `${esc(harga)} <small>/ orang</small>` : esc(harga);
        } else {
          setText('dFootLabel', 'Kategori');
          setText('dFootValue', meta.label);
        }
        $id('dMapLink').href = mapsLink(f);

        // Destinasi terdekat
        const near = nearestOf(f, 6);
        $id('dNearHint').textContent = near.length > 3 ? 'Geser untuk melihat ' + (near.length - 3) + ' lainnya →' : '';
        const wrap = $id('dNearby');
        wrap.innerHTML = near
          .map(
            ({ x, d }, i) => {
              const xp = x.properties || {};
              const price = formatPrice(pick(xp, PROP_KEYS.harga));
              const priceHtml = price ? (/^Rp\s/.test(price) ? `${esc(price)} <small>/ org</small>` : esc(price)) : '&nbsp;';
              return `
          <button type="button" class="ex-near-card" data-near="${i}" title="${esc(d.toFixed(1))} km dari lokasi ini">
            <div class="ex-near-thumb">${photoHtml(x)}<span class="ex-near-fav" role="button" aria-label="Favorit"><i class="bi bi-heart"></i></span></div>
            <div class="ex-near-price">${priceHtml}</div>
            <div class="ex-near-name">${esc(xp.nama || 'Destinasi')}</div>
            <div class="ex-near-meta"><span>${esc(xp.kabupaten_kota || '')}</span>${ratingOf(x) ? `<span><i class="bi bi-star-fill"></i> ${esc(ratingOf(x).toFixed(1))}</span>` : ''}</div>
          </button>`;
            }
          )
          .join('');
        wrap.querySelectorAll('.ex-near-card').forEach((btn) => {
          btn.addEventListener('click', () => selectFeature(near[Number(btn.dataset.near)].x, { fly: true }));
          const fav = btn.querySelector('.ex-near-fav');
          if (fav) fav.addEventListener('click', (e) => {
            e.stopPropagation();
            const on = fav.classList.toggle('active');
            fav.querySelector('i').className = on ? 'bi bi-heart-fill' : 'bi bi-heart';
          });
        });

        $id('dSave').classList.remove('active');
        $id('dSave').querySelector('i').className = 'bi bi-bookmark';
        $id('exDetail').scrollTop = 0;
        void c;
      }

      function selectFeature(f, opts) {
        const prev = selectedFeature;
        selectedFeature = f;
        refreshMarker(prev);
        refreshMarker(f);
        renderDetail(f);
        $id('exDetail').hidden = false;
        $id('exploreShell').classList.add('has-detail');
        const c = coordsOf(f);
        if (opts && opts.fly && c && map) map.flyTo(c, Math.max(map.getZoom(), 13), { duration: 1 });
      }

      function closeDetail() {
        const prev = selectedFeature;
        selectedFeature = null;
        refreshMarker(prev);
        $id('exDetail').hidden = true;
        $id('exploreShell').classList.remove('has-detail');
      }

      // ---------- Filter (pencarian + kabupaten + kategori + rating + radius) ----------
      function applyFilter() {
        if (!allFeatures || allFeatures.length === 0) return;

        const filtered = allFeatures.filter((feature) => {
          const props = feature.properties || {};
          const matchSearch = !currentSearch || (props.nama && props.nama.toLowerCase().includes(currentSearch));
          const matchKab = currentKabupaten === 'all' || currentKabupaten === 'semua' ||
            (props.kabupaten_kota && props.kabupaten_kota.toLowerCase().includes(currentKabupaten));
          const matchCat = isCategoryMatch(feature, currentCategory);
          const matchRating = currentRating <= 0 || ratingOf(feature) >= currentRating;
          let matchRadius = true;
          if (radiusKm > 0 && radiusCenter) {
            const c = coordsOf(feature);
            matchRadius = !!c && distKm(radiusCenter, c) <= radiusKm;
          }
          return matchSearch && matchKab && matchCat && matchRating && matchRadius;
        });

        pillMode = !!currentSearch && filtered.length <= 25;
        renderMarkers(filtered);
        updateExploreUI(filtered);

        // Mode hasil pencarian: panel mengecil jadi bar di atas, detail hasil teratas tampil di kanan
        const shell = $id('exploreShell');
        const resultMode = !!currentSearch;
        if (shell) {
          shell.classList.toggle('is-results', resultMode);
          if (!resultMode) shell.classList.remove('more-open');
        }
        if (resultMode && filtered.length) {
          if (!selectedFeature || !filtered.includes(selectedFeature)) {
            selectFeature(topMatch(filtered), { fly: false });
          }
          fitResults(filtered);
        }
      }

      // Hasil paling relevan: nama diawali kata kunci dulu, lalu rating tertinggi
      function topMatch(list) {
        const q = currentSearch;
        return list.slice().sort((a, b) => {
          const sa = String((a.properties && a.properties.nama) || '').toLowerCase().startsWith(q) ? 1 : 0;
          const sb = String((b.properties && b.properties.nama) || '').toLowerCase().startsWith(q) ? 1 : 0;
          return sb - sa || ratingOf(b) - ratingOf(a);
        })[0];
      }

      // Arahkan peta ke hasil pencarian (menyisakan ruang untuk bar atas & kartu detail)
      function fitResults(list) {
        if (!map) return;
        const pts = list.map(coordsOf).filter(Boolean);
        if (!pts.length) return;
        const dw = isDesktop() ? ($id('exDetail').offsetWidth || 0) : 0;
        map.fitBounds(L.latLngBounds(pts), {
          paddingTopLeft: isDesktop() ? [50, 150] : [20, 20],
          paddingBottomRight: [dw ? dw + 50 : 30, 90],
          maxZoom: 14
        });
      }

      // Estimasi lama jelajah berdasarkan jumlah titik yang masuk rute (maks. 5 titik)
      function estimateDays(n) {
        if (!n) return '-';
        const stops = Math.min(n, 5);
        if (stops <= 2) return '1 Hari';
        if (stops <= 4) return '1 - 2 Hari';
        return '2 - 3 Hari';
      }

      function updateExploreUI(filtered) {
        setText('exCount', filtered.length);
        setText('exShown', estimateDays(filtered.length));
        setText('exBuffer', radiusKm > 0 ? radiusKm + ' km' : 'Nonaktif');
        drawRadius();
        renderActiveChips();
        clearRoute();
      }

      function drawRadius() {
        if (radiusCircle && map) { map.removeLayer(radiusCircle); radiusCircle = null; }
        if (!map || radiusKm <= 0 || !radiusCenter) return;
        radiusCircle = L.circle(radiusCenter, {
          radius: radiusKm * 1000,
          color: '#458132',
          weight: 1.5,
          dashArray: '6 6',
          fillColor: '#9ad872',
          fillOpacity: 0.14,
          interactive: false
        }).addTo(map);
      }

      function updateRadiusLabels() {
        setText('exRadiusVal', radiusKm > 0 ? radiusKm + ' km' : 'Nonaktif');
        let note = 'Geser slider';
        let tip = '';
        if (radiusKm > 0) {
          note = 'Zona buffer aktif';
          tip = userLatLng && radiusCenter === userLatLng ? 'Pusat: lokasi kamu'
            : selectedFeature && radiusCenter && coordsOf(selectedFeature) && radiusCenter[0] === coordsOf(selectedFeature)[0] ? 'Pusat: destinasi terpilih'
            : 'Pusat: tengah peta';
        }
        setText('exRadiusNote', note);
        const noteEl = $id('exRadiusNote');
        if (noteEl) noteEl.title = tip;
      }

      function renderActiveChips() {
        const wrap = $id('exActiveFilters');
        if (!wrap) return;
        const kabSel = $id('kabupatenFilter');
        const items = [];
        if (currentCategory !== 'all') items.push(['Kategori: ' + currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1), () => { const a = document.querySelector('.chip[data-category="all"]'); if (a) a.click(); }]);
        if (currentKabupaten !== 'all' && kabSel) items.push(['Kab: ' + kabSel.value, () => { kabSel.selectedIndex = 0; kabSel.dispatchEvent(new Event('change')); }]);
        if (currentRating > 0) items.push(['Rating ' + currentRating + '+', () => { $id('ratingFilter').value = '0'; $id('ratingFilter').dispatchEvent(new Event('change')); }]);
        if (radiusKm > 0) items.push(['Radius ' + radiusKm + ' km', () => { const r = $id('radiusRange'); r.value = 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }]);

        wrap.innerHTML = '';
        wrap.hidden = items.length === 0;
        items.forEach(([label, off]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ex-active-chip';
          b.innerHTML = `${esc(label)} <i class="bi bi-x-lg"></i>`;
          b.addEventListener('click', off);
          wrap.appendChild(b);
        });
        if (items.length > 1) {
          const r = document.createElement('button');
          r.type = 'button';
          r.className = 'ex-reset';
          r.textContent = 'Reset semua';
          r.addEventListener('click', resetAllFilters);
          wrap.appendChild(r);
        }
      }

      function resetAllFilters() {
        const si = $id('searchInput'); if (si) si.value = '';
        currentSearch = '';
        const kab = $id('kabupatenFilter'); if (kab) kab.selectedIndex = 0;
        currentKabupaten = 'all';
        const rt = $id('ratingFilter'); if (rt) rt.value = '0';
        currentRating = 0;
        const rr = $id('radiusRange'); if (rr) rr.value = 0;
        radiusKm = 0;
        radiusCenter = null;
        updateRadiusLabels();
        document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.category === 'all'));
        currentCategory = 'all';
        applyFilter();
        fitBali(true);
      }

      // ---------- Batas peta: hanya Pulau Bali ----------
      function fitBali(force) {
        if (!map) return;
        const el = map.getContainer();
        if (!el.clientWidth || !el.clientHeight) return;
        map.invalidateSize();
        map.setMinZoom(Math.max(8, map.getBoundsZoom(BALI_MAX, false)));
        if (force || !viewFitted) {
          viewFitted = true;
          map.fitBounds(BALI_BOUNDS, {
            paddingTopLeft: isDesktop() ? [410, 24] : [10, 10],
            paddingBottomRight: [10, 10],
            animate: !!force
          });
        }
      }

      function watchMapSize() {
        const el = map && map.getContainer();
        if (!el) return;
        if ('ResizeObserver' in window) {
          new ResizeObserver(() => fitBali(false)).observe(el);
        } else {
          window.addEventListener('resize', () => fitBali(false));
        }
        map.on('zoomend', () => el.classList.toggle('lb-low', map.getZoom() < 11.5));
      }

      // ---------- Rute sederhana (titik terdekat berurutan) ----------
      function clearRoute() {
        if (routeLayer && map) { map.removeLayer(routeLayer); }
        routeLayer = null;
        const card = $id('exRoute');
        if (card) card.hidden = true;
      }

      function buildRoute() {
        if (!map) return;
        const list = (lastRendered || []).map((f) => ({ f, c: coordsOf(f) })).filter((x) => x.c);
        if (!list.length) {
          setText('exRouteTitle', 'Belum ada destinasi');
          setText('exRouteMeta', 'Ubah filter agar ada titik wisata yang bisa dirutekan.');
          $id('exRouteList').innerHTML = '';
          const rp0 = $id('exRoutePhoto'); if (rp0) rp0.innerHTML = '';
          $id('exRouteLink').hidden = true;
          $id('exRoute').hidden = false;
          return;
        }
        const ctr = map.getCenter();
        const start = radiusCenter || userLatLng || [ctr.lat, ctr.lng];

        list.sort((a, b) => distKm(start, a.c) - distKm(start, b.c));
        let pool = list.slice(0, 5);
        const ordered = [];
        let cur = start;
        while (pool.length) {
          let bi = 0;
          let bd = Infinity;
          pool.forEach((x, i) => { const d = distKm(cur, x.c); if (d < bd) { bd = d; bi = i; } });
          const nx = pool.splice(bi, 1)[0];
          ordered.push(nx);
          cur = nx.c;
        }

        const path = [start].concat(ordered.map((x) => x.c));
        let total = 0;
        for (let i = 1; i < path.length; i++) total += distKm(path[i - 1], path[i]);

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.layerGroup().addTo(map);
        L.polyline(path, { color: '#458132', weight: 4, dashArray: '2 8', lineCap: 'round', opacity: 0.95 }).addTo(routeLayer);
        L.circleMarker(start, { radius: 6, color: '#fff', weight: 2, fillColor: '#ffa12f', fillOpacity: 1 }).addTo(routeLayer);
        ordered.forEach((x, i) => {
          L.marker(x.c, {
            icon: L.divIcon({ className: 'lb-route-num-wrap', html: `<span class="lb-route-num">${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
            interactive: false,
            zIndexOffset: 1500
          }).addTo(routeLayer);
        });

        setText('exRouteTitle', 'Jalur ' + ordered.length + ' Destinasi Terdekat');
        setText('exRouteMeta', '± ' + total.toFixed(1) + ' km garis lurus • mulai dari ' + (radiusCenter ? 'pusat radius' : userLatLng ? 'lokasimu' : 'tengah peta'));
        $id('exRouteList').innerHTML = ordered.map((x) => `<li>${esc((x.f.properties && x.f.properties.nama) || 'Destinasi')}</li>`).join('');
        const rp = $id('exRoutePhoto');
        if (rp) rp.innerHTML = photoHtml(ordered[0].f);
        const last = ordered[ordered.length - 1].c;
        const mid = ordered.slice(0, -1).map((x) => x.c.join(',')).join('|');
        const link = $id('exRouteLink');
        link.hidden = false;
        link.href = 'https://www.google.com/maps/dir/?api=1&origin=' + start.join(',') + '&destination=' + last.join(',') + (mid ? '&waypoints=' + encodeURIComponent(mid) : '') + '&travelmode=driving';
        $id('exRoute').hidden = false;

        map.fitBounds(L.latLngBounds(path), {
          paddingTopLeft: isDesktop() ? [410, 40] : [30, 30],
          paddingBottomRight: [30, 30],
          maxZoom: 13
        });
      }

      // Setelah data GeoJSON siap: isi jumlah kategori & status
      function onDataReady() {
        const counts = { all: allFeatures.length, alam: 0, budaya: 0, rekreasi: 0, umum: 0 };
        allFeatures.forEach((f) => { counts[getCategoryGroup(f)]++; });
        document.querySelectorAll('[data-cnt]').forEach((el) => { el.textContent = '(' + counts[el.dataset.cnt] + ')'; });
        setText('exTotal', 'Semua (' + counts.all + ')');
        updateExploreUI(lastRendered);
      }

      function setupExplore() {
        const shell = $id('exploreShell');
        if (!shell) return;

        // Kontrol peta
        $id('exZoomIn').addEventListener('click', () => map && map.zoomIn());
        $id('exZoomOut').addEventListener('click', () => map && map.zoomOut());
        $id('exLocate').addEventListener('click', () => locateUser());
        $id('exFullscreen').addEventListener('click', () => {
          shell.classList.toggle('is-fullscreen');
          document.body.classList.toggle('ex-noscroll', shell.classList.contains('is-fullscreen'));
          setTimeout(() => map && map.invalidateSize(), 80);
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && shell.classList.contains('is-fullscreen')) $id('exFullscreen').click();
        });

        // Filter rating
        $id('ratingFilter').addEventListener('change', (e) => {
          currentRating = parseFloat(e.target.value) || 0;
          applyFilter();
        });

        // Radius / buffer
        const range = $id('radiusRange');
        range.addEventListener('input', () => {
          radiusKm = Number(range.value) || 0;
          setText('exRadiusVal', radiusKm > 0 ? radiusKm + ' km' : 'Nonaktif');
        });
        range.addEventListener('change', () => {
          radiusKm = Number(range.value) || 0;
          if (radiusKm > 0) {
            const sc = selectedFeature && coordsOf(selectedFeature);
            const ctr = map.getCenter();
            radiusCenter = userLatLng || sc || [ctr.lat, ctr.lng];
          } else {
            radiusCenter = null;
          }
          updateRadiusLabels();
          applyFilter();
          if (radiusCircle) {
            map.fitBounds(radiusCircle.getBounds(), {
              paddingTopLeft: isDesktop() ? [410, 30] : [20, 20],
              paddingBottomRight: [20, 20],
              maxZoom: 13
            });
          }
        });

        // Label "Semua (n)" = reset kategori
        const tot = $id('exTotal');
        if (tot) tot.addEventListener('click', () => {
          const a = document.querySelector('.chip[data-category="all"]');
          if (a) a.click();
        });

        // Tombol ... (kategori & radius) pada mode hasil pencarian
        $id('exMore').addEventListener('click', () => shell.classList.toggle('more-open'));

        // Rute
        $id('btnRoute').addEventListener('click', buildRoute);
        $id('exRouteClose').addEventListener('click', clearRoute);

        // Detail
        $id('dClose').addEventListener('click', closeDetail);
        $id('dSave').addEventListener('click', (e) => {
          const b = e.currentTarget;
          const on = b.classList.toggle('active');
          b.querySelector('i').className = on ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
        });
        $id('dShare').addEventListener('click', async () => {
          if (!selectedFeature) return;
          const url = mapsLink(selectedFeature);
          const title = (selectedFeature.properties && selectedFeature.properties.nama) || 'Langkah Baswara';
          const label = $id('dShare').querySelector('span');
          try {
            if (navigator.share) {
              await navigator.share({ title, url });
            } else {
              await navigator.clipboard.writeText(url);
              label.textContent = 'Tersalin!';
              setTimeout(() => { label.textContent = 'Bagikan'; }, 1500);
            }
          } catch (err) { /* dibatalkan pengguna */ }
        });

        updateRadiusLabels();
        renderActiveChips();
      }

      // Lokasi pengguna (hanya dipakai bila berada di Pulau Bali)
      function locateUser() {
        if (map) map.locate({ setView: false, enableHighAccuracy: true });
      }

      // Fallback jika fetch GeoJSON terkendala (misalnya file:// protocol)
      function loadFallbackMarker() {
        if (!markers || !map) return;
        allFeatures = [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [ULUWATU[1], ULUWATU[0]] },
          properties: {
            kabupaten_kota: 'Badung Selatan',
            nama: 'Pura Luhur Uluwatu',
            rating: 4.8,
            kategori: 'Budaya',
            link: 'https://maps.google.com/?q=-8.8291,115.0849'
          }
        }];
        renderMarkers(allFeatures);
        onDataReady();
      }

      // ---------- Adaptor data API -> format Feature yang dipakai peta ----------
      // Menerima: GeoJSON FeatureCollection, array objek, atau objek { data | results | items | wisata: [...] }.
      // Setiap objek perlu koordinat (latitude/longitude, lat/lng, atau geometry) dan nama.
      function pickAny(o, keys) {
        for (const k of keys) {
          if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
        }
        return undefined;
      }

      function toNum(v) {
        const n = parseFloat(String(v).replace(',', '.'));
        return isFinite(n) ? n : null;
      }

      function coordsFromRow(row) {
        let lat = toNum(pickAny(row, ['latitude', 'lat', 'lintang', 'y']));
        let lng = toNum(pickAny(row, ['longitude', 'lng', 'lon', 'long', 'bujur', 'x']));
        if (lat !== null && lng !== null) return [lat, lng];

        const g = row.geometry && row.geometry.coordinates;
        if (Array.isArray(g) && g.length >= 2) return [toNum(g[1]), toNum(g[0])];

        const raw = pickAny(row, ['koordinat', 'coordinates', 'coordinate', 'lokasi_koordinat', 'location', 'posisi']);
        if (typeof raw === 'string') {
          const p = raw.split(/[,;\s]+/).map(toNum).filter((n) => n !== null);
          if (p.length >= 2) return Math.abs(p[0]) <= Math.abs(p[1]) ? [p[0], p[1]] : [p[1], p[0]];
        } else if (Array.isArray(raw) && raw.length >= 2) {
          const p = [toNum(raw[0]), toNum(raw[1])];
          if (p[0] !== null && p[1] !== null) return Math.abs(p[0]) <= Math.abs(p[1]) ? p : [p[1], p[0]];
        } else if (raw && typeof raw === 'object') {
          lat = toNum(pickAny(raw, ['latitude', 'lat']));
          lng = toNum(pickAny(raw, ['longitude', 'lng', 'lon']));
          if (lat !== null && lng !== null) return [lat, lng];
        }
        return null;
      }

      function rowToFeature(row) {
        if (!row || typeof row !== 'object') return null;
        if (row.type === 'Feature' && row.geometry) return row;

        const c = coordsFromRow(row);
        if (!c) return null;

        const props = Object.assign({}, row.properties || {}, row);
        delete props.geometry;
        delete props.properties;

        const flat = (v) => (v && typeof v === 'object' ? (v.nama || v.name || v.label || '') : v);
        const alias = (target, keys) => {
          if (props[target] === undefined || props[target] === null || props[target] === '') {
            const v = flat(pickAny(props, keys));
            if (v !== undefined && v !== '') props[target] = v;
          }
        };
        alias('nama', ['nama_wisata', 'nama_destinasi', 'nama_objek', 'name', 'title', 'judul']);
        alias('kabupaten_kota', ['kabupaten', 'kota', 'kab_kota', 'kabupaten_kota_nama', 'regency', 'city']);
        alias('kategori', ['kategori_wisata', 'category', 'jenis', 'tipe', 'type']);
        alias('link', ['url', 'maps_url', 'gmaps', 'google_maps']);
        if (props.kategori && typeof props.kategori === 'object') props.kategori = flat(props.kategori);

        return { type: 'Feature', geometry: { type: 'Point', coordinates: [c[1], c[0]] }, properties: props };
      }

      function normalizeWisata(payload) {
        if (!payload) return [];
        if (Array.isArray(payload.features)) return payload.features;
        let rows = payload;
        if (!Array.isArray(rows)) {
          const key = ['data', 'results', 'items', 'wisata', 'destinasi', 'rows', 'records'].find((k) => {
            const v = payload[k];
            return Array.isArray(v) || (v && Array.isArray(v.features));
          });
          if (!key) return [];
          if (Array.isArray(payload[key].features)) return payload[key].features;
          rows = payload[key];
        }
        return rows.map(rowToFeature).filter(Boolean);
      }

      async function fetchFromApi() {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
        try {
          const res = await fetch(API_BASE + WISATA_API_PATH + '?ngrok-skip-browser-warning=1', {
            headers: { Accept: 'application/json' },
            signal: ctrl.signal
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (!(res.headers.get('content-type') || '').includes('json')) {
            throw new Error('Respons bukan JSON (cek apakah tunnel sudah publik)');
          }
          const features = normalizeWisata(await res.json());
          if (!features.length) throw new Error('Data API kosong atau format tidak dikenali');
          return features;
        } finally {
          clearTimeout(timer);
        }
      }

      async function fetchFromLocal() {
        const response = await fetch('public/data/wisata-bali.geojson');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        const geoData = await response.json();
        if (geoData && Array.isArray(geoData.features) && geoData.features.length > 0) {
          return geoData.features;
        }
        throw new Error('Data GeoJSON kosong atau format tidak sesuai');
      }

      // 2. Ambil data wisata: backend dulu, jika gagal pakai file lokal, jika gagal juga -> halaman error
      async function fetchWisataGeoJson() {
        if (window.LBLoader) window.LBLoader.bump(45);
        try {
          let features = null;

          if (USE_WISATA_API) {
            try {
              features = await fetchFromApi();
              console.info('[Wisata] Data dari backend:', features.length, 'destinasi');
            } catch (apiErr) {
              console.warn('[Wisata] Backend gagal, memakai file lokal:', apiErr.message);
            }
          }

          if (!features) features = await fetchFromLocal();

          allFeatures = features;
          renderMarkers(allFeatures);
          onDataReady();
          if (window.LBLoader) window.LBLoader.done();
        } catch (err) {
          console.warn('GeoJSON fetch error (fallback aktif):', err.message);
          loadFallbackMarker();
          if (window.LBLoader) {
            if (SHOW_ERROR_ON_DATA_FAIL) window.LBLoader.fail('GeoJSON: ' + err.message);
            else window.LBLoader.done();
          }
        }
      }

      // 2. Fungsi Pengelompokan Kategori (Category Mapper)
      function getCategoryGroup(feature) {
        if (!feature || !feature.properties || feature.properties.kategori == null) {
          return 'umum';
        }

        const raw = feature.properties.kategori.toString().trim().toLowerCase();

        // "alam": jika properti kategori mengandung 'alam', 'alami', 'pantai', 'air terjun', 'danau', 'gunung'
        const alamKeywords = ['alam', 'alami', 'pantai', 'air terjun', 'danau', 'gunung'];
        if (alamKeywords.some((k) => raw.includes(k))) {
          return 'alam';
        }

        // "budaya": jika properti kategori mengandung 'budaya', 'religi', 'museum', 'pura', 'candi', 'sejarah'
        const budayaKeywords = ['budaya', 'religi', 'museum', 'pura', 'candi', 'sejarah'];
        if (budayaKeywords.some((k) => raw.includes(k))) {
          return 'budaya';
        }

        // "rekreasi": jika properti kategori mengandung 'rekreasi', 'kuliner', 'edukasi', 'taman', 'hiburan'
        const rekreasiKeywords = ['rekreasi', 'kuliner', 'edukasi', 'taman', 'hiburan'];
        if (rekreasiKeywords.some((k) => raw.includes(k))) {
          return 'rekreasi';
        }

        // "umum": untuk sisa lokasi lainnya
        return 'umum';
      }

      // 3. Logika Filter Kategori GeoJSON
      function isCategoryMatch(feature, selectedCategory) {
        if (!selectedCategory) return true;
        const selCat = selectedCategory.toString().trim().toLowerCase();

        // Jika filter bernilai 'all' atau 'semua', tampilkan seluruh data
        if (selCat === 'all' || selCat === 'semua' || selCat.startsWith('semua')) {
          return true;
        }

        return getCategoryGroup(feature) === selCat;
      }

      // Inisialisasi Event Listener
      function setupEventListeners() {
        // 4. Logika Interaksi Navigasi Section (Single Page Application Switcher)
        function setupSectionNavigation() {
          const navLinks = document.querySelectorAll('.nav-pills-lb .nav-link');
          const sections = document.querySelectorAll('.content-section');

          navLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const targetId = link.dataset.section;
              if (!targetId) return;

              // a. Ubah status class active pada menu
              navLinks.forEach((l) => l.classList.remove('active'));
              link.classList.add('active');

              // b. Tampilkan section yang sesuai dan sembunyikan section lainnya (d-none)
              sections.forEach((sec) => {
                if (sec.id === targetId) {
                  sec.classList.remove('d-none');
                } else {
                  sec.classList.add('d-none');
                }
              });

              // Tutup menu collapse mobile jika sedang terbuka
              const navCollapse = document.getElementById('navMain');
              if (navCollapse && navCollapse.classList.contains('show') && window.bootstrap) {
                const bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
                if (bsCollapse) bsCollapse.hide();
              }

              // c. KONTRAK KHUSUS LEAFLET: jika kembali ke tab "Jelajahi", jalankan map.invalidateSize()
              if (targetId === 'sec-jelajahi' && map) {
                map.invalidateSize();
                setTimeout(() => {
                  if (map) map.invalidateSize();
                }, 100);
              }
            });
          });
        }

        setupSectionNavigation();

        // Mode basemap
        document.querySelectorAll('.map-mode button').forEach((btn) => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.map-mode button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const basemapKey = btn.dataset.basemap;
            if (layers[basemapKey] && map) {
              Object.values(layers).forEach((lyr) => {
                if (map.hasLayer(lyr)) map.removeLayer(lyr);
              });
              layers[basemapKey].addTo(map);
            }
          });
        });

        // Kontrol Layer Marker
        const lyrCat = document.getElementById('lyrCat');
        if (lyrCat) {
          lyrCat.addEventListener('change', (e) => {
            if (!map || !markers) return;
            if (e.target.checked) {
              if (!map.hasLayer(markers)) markers.addTo(map);
            } else {
              if (map.hasLayer(markers)) map.removeLayer(markers);
            }
          });
        }

        // Kontrol Layer Batas Wilayah
        const lyrBound = document.getElementById('lyrBound');
        if (lyrBound) {
          lyrBound.addEventListener('change', (e) => {
            if (!map) return;
            if (e.target.checked) {
              if (boundsLayer && map.hasLayer(boundsLayer)) map.removeLayer(boundsLayer);
              boundsLayer = L.rectangle([[-8.85, 114.42], [-8.06, 115.72]], {
                color: '#111827',
                weight: 1,
                fillOpacity: 0.04
              }).addTo(map);
            } else if (boundsLayer && map.hasLayer(boundsLayer)) {
              map.removeLayer(boundsLayer);
              boundsLayer = null;
            }
          });
        }

        // Kontrol GPS & Lokasi
        const btnLocate = document.getElementById('btnLocate');
        if (btnLocate) {
          btnLocate.addEventListener('click', locateUser);
        }

        const lyrGps = document.getElementById('lyrGps');
        if (lyrGps) {
          lyrGps.addEventListener('change', (e) => {
            if (e.target.checked) {
              locateUser();
            } else if (userMarker && map) {
              if (map.hasLayer(userMarker)) map.removeLayer(userMarker);
              userMarker = null;
            }
          });
        }

        if (map) {
          map.on('locationfound', (e) => {
            const gpsCheck = document.getElementById('lyrGps');
            if (!BALI_BOUNDS.contains(e.latlng)) {
              alert('Lokasimu berada di luar Pulau Bali, jadi tidak bisa ditampilkan di peta ini.');
              if (gpsCheck) gpsCheck.checked = false;
              return;
            }
            userLatLng = [e.latlng.lat, e.latlng.lng];
            if (userMarker && map.hasLayer(userMarker)) map.removeLayer(userMarker);
            userMarker = L.circleMarker(e.latlng, {
              radius: 8,
              color: '#458132',
              fillColor: '#9ad872',
              fillOpacity: 1,
              weight: 2
            }).addTo(map).bindPopup('Lokasi Anda');
            if (gpsCheck) gpsCheck.checked = true;
            map.flyTo(e.latlng, 12, { duration: 1 });
            if (radiusKm > 0) {
              radiusCenter = userLatLng;
              updateRadiusLabels();
              applyFilter();
            }
          });

          map.on('locationerror', (err) => {
            console.warn('Geolokasi tidak dapat diakses:', err.message);
            alert('Lokasi tidak dapat diakses. Izinkan GPS di browser.');
            const gpsCheck = document.getElementById('lyrGps');
            if (gpsCheck) gpsCheck.checked = false;
          });
        }

        // Tombol Terapkan Filter
        const btnApply = document.querySelector('.filter-card .btn-navy');
        if (btnApply) {
          btnApply.addEventListener('click', applyFilter);
        }

        // Pencarian input & tombol clear
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');

        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim().toLowerCase();
            applyFilter();
          });
        }

        if (clearSearch && searchInput) {
          clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            currentSearch = '';
            applyFilter();
          });
        }

        // Dropdown Filter Kabupaten
        const kabupatenFilter = document.getElementById('kabupatenFilter');
        if (kabupatenFilter) {
          kabupatenFilter.addEventListener('change', (e) => {
            const val = e.target.value;
            currentKabupaten = (val === 'all' || val.includes('Semua Kabupaten')) ? 'all' : val.trim().toLowerCase();
            applyFilter();
          });
        }

        // Filter Kategori Chips
        document.querySelectorAll('.chip').forEach((chip) => {
          chip.addEventListener('click', (ev) => {
            ev.preventDefault();
            document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');

            // Ambil dari data-category atau fallback parsing teks
            const catAttr = chip.dataset.category;
            if (catAttr) {
              currentCategory = catAttr.toLowerCase();
            } else {
              const text = chip.textContent.trim().toLowerCase();
              if (text.includes('semua')) {
                currentCategory = 'all';
              } else {
                currentCategory = text.split('(')[0].trim().toLowerCase();
              }
            }
            applyFilter();
          });
        });

        // Interaktivitas kartu galeri (Buka di Peta)
        const galleryLocations = {
          'Tanah Lot': [-8.6212, 115.0868],
          'Pura Uluwatu': [-8.8291, 115.0849],
          'Terasering Tegalalang': [-8.4348, 115.2789],
          'Pantai Sanur': [-8.6833, 115.2625]
        };

        document.querySelectorAll('.dest-card').forEach((card) => {
          const titleEl = card.querySelector('strong');
          const btn = card.querySelector('button.btn-ghost');
          if (titleEl && btn) {
            const name = titleEl.textContent.trim();
            if (galleryLocations[name]) {
              btn.addEventListener('click', () => {
                if (!map) return;
                map.flyTo(galleryLocations[name], 14, { duration: 1.2 });
                const mapEl = document.getElementById('map');
                if (mapEl) {
                  window.scrollTo({ top: mapEl.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
                }
              });
            }
          }
        });

        // Tombol Reset Filter di Banner
        const resetBtn = document.querySelector('.banner-route .btn-ghost');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentSearch = '';
            if (kabupatenFilter) kabupatenFilter.selectedIndex = 0;
            currentKabupaten = 'all';
            document.querySelectorAll('.chip').forEach((c, idx) => {
              c.classList.toggle('active', idx === 0);
            });
            currentCategory = 'all';
            applyFilter();
            if (map) map.flyTo(BALI, 10);
          });
        }

        // Navigasi Navbar & Tombol Masuk
        document.querySelectorAll('[data-section]').forEach((el) => {
          el.addEventListener('click', (ev) => {
            ev.preventDefault();
            const target = el.getAttribute('data-section');
            if (target) {
              switchSection(target);
            }
          });
        });
      }

      // ==========================================
      // SISTEM NAVIGASI & PERPINDAHAN SECTION
      // ==========================================
      function switchSection(targetSectionId) {
        if (!targetSectionId) return;

        // 1. Pindahkan class 'active' ke menu yang dipilih
        document.querySelectorAll('.navbar-nav .nav-link').forEach((link) => {
          const isTarget = link.getAttribute('data-section') === targetSectionId;
          link.classList.toggle('active', isTarget);
        });

        // 2. Tampilkan section yang sesuai, sembunyikan section lain (d-none)
        document.querySelectorAll('.content-section').forEach((sec) => {
          if (sec.id === targetSectionId) {
            sec.classList.remove('d-none');
          } else {
            sec.classList.add('d-none');
          }
        });

        // 3. KONTRAK LEAFLET: Jika menu 'Jelajahi' diklik, jalankan map.invalidateSize()
        if (targetSectionId === 'sec-jelajahi') {
          setTimeout(() => {
            if (map && typeof map.invalidateSize === 'function') {
              map.invalidateSize();
            } else if (window._leafletMap && typeof window._leafletMap.invalidateSize === 'function') {
              window._leafletMap.invalidateSize();
            }
          }, 150);
        }

        // Tutup navbar collapse di layar kecil jika sedang terbuka
        const navMain = document.getElementById('navMain');
        if (navMain && navMain.classList.contains('show') && window.bootstrap && window.bootstrap.Collapse) {
          const bsCollapse = window.bootstrap.Collapse.getInstance(navMain);
          if (bsCollapse) bsCollapse.hide();
        }

        // Scroll halus ke atas
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Navigasi ke destinasi tertentu dari Landing Page
      function navigateToDestination(keyword) {
        switchSection('sec-jelajahi');
        setTimeout(() => {
          const searchInput = document.getElementById('searchInput');
          if (searchInput) {
            searchInput.value = keyword;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 200);
      }

      // Form pencarian hero di Beranda
      function handleHeroSearch(e) {
        if (e) e.preventDefault();
        const heroInput = document.getElementById('heroSearchInput');
        const query = heroInput ? heroInput.value.trim() : '';
        switchSection('sec-jelajahi');
        if (query) {
          setTimeout(() => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
              searchInput.value = query;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 200);
        }
      }

      // Filter kategori pada kartu destinasi Beranda
      function setupBerandaFilters() {
        const chips = document.querySelectorAll('.landing-chip');
        const cards = document.querySelectorAll('.landing-card-col');

        chips.forEach((chip) => {
          chip.addEventListener('click', () => {
            chips.forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            const filter = (chip.getAttribute('data-filter') || 'all').toLowerCase();

            cards.forEach((col) => {
              const cat = (col.getAttribute('data-category') || '').toLowerCase();
              if (filter === 'all' || cat.includes(filter)) {
                col.style.display = '';
              } else {
                col.style.display = 'none';
              }
            });
          });
        });
      }

      // Interaktivitas Accordion FAQ kustom
      function setupFaqAccordion() {
        const faqItems = document.querySelectorAll('.faq-item-custom');
        faqItems.forEach((item) => {
          item.addEventListener('click', () => {
            const wasActive = item.classList.contains('active');

            // Tutup semua item lain
            faqItems.forEach((other) => {
              other.classList.remove('active');
              const icon = other.querySelector('.faq-toggle-btn i');
              if (icon) icon.className = 'bi bi-plus-lg';
            });

            // Toggle item yang diklik
            if (!wasActive) {
              item.classList.add('active');
              const icon = item.querySelector('.faq-toggle-btn i');
              if (icon) icon.className = 'bi bi-x-lg';
            }
          });
        });
      }

      // Expose ke global scope agar dapat diakses dari event handler inline
      window.switchSection = switchSection;
      window.navigateToDestination = navigateToDestination;
      window.handleHeroSearch = handleHeroSearch;

      function startApp() {
        initMap();
        setupEventListeners();
        setupBerandaFilters();
        setupFaqAccordion();
        setupNavbarScroll();
        fetchWisataGeoJson();
        setupExplore();
      }

      // Navbar: beri latar blur saat halaman di-scroll
      function setupNavbarScroll() {
        const nav = document.querySelector('.navbar-lb');
        if (!nav) return;
        const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }

      // Eksekusi saat DOM siap
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
      } else {
        startApp();
      }
    })();

// ==========================================
// HALAMAN TENTANG: scroll reveal + wheel fitur
// ==========================================
(function () {
  'use strict';

  document.documentElement.classList.add('about-js');

  // ---- Reveal halus saat section masuk layar ----
  const revealEls = document.querySelectorAll('#sec-tentang .about-reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // ---- Wheel fitur (bisa digeser / drag) ----
  const track = document.getElementById('aboutWheelTrack');
  const dotsWrap = document.getElementById('aboutWheelDots');
  if (!track || !dotsWrap) return;

  const originals = Array.from(track.querySelectorAll('.about-feature-card'));
  const N = originals.length;
  if (!N) return;

  // ---- Loop tanpa ujung: gandakan kartu 2 set di kiri & 2 set di kanan ----
  const COPIES = 2;
  const makeClones = () =>
    originals.map((c) => {
      const k = c.cloneNode(true);
      k.setAttribute('aria-hidden', 'true');
      k.classList.remove('is-active');
      return k;
    });
  for (let i = 0; i < COPIES; i++) {
    makeClones().forEach((c) => track.insertBefore(c, originals[0]));
    makeClones().forEach((c) => track.appendChild(c));
  }

  const cards = Array.from(track.querySelectorAll('.about-feature-card'));
  const HOME = COPIES * N; // indeks kartu pertama di set asli
  const START_INDEX = HOME + Math.min(2, N - 1); // kartu ke-3 di tengah
  let activeIndex = -1;
  let initialized = false;
  let ticking = false;
  let dragging = false;
  let idleTimer = null;

  const mod = (i) => ((i % N) + N) % N;

  const dots = originals.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Tampilkan fitur ' + (i + 1));
    b.addEventListener('click', () => {
      const cur = nearestIndex();
      let diff = mod(i - cur);
      if (diff > N / 2) diff -= N;
      scrollToCard(cur + diff, true);
    });
    dotsWrap.appendChild(b);
    return b;
  });

  const cardCenter = (card) => card.offsetLeft + card.offsetWidth / 2;

  function scrollToCard(i, smooth) {
    const card = cards[i];
    if (!card) return;
    track.scrollTo({
      left: cardCenter(card) - track.clientWidth / 2,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  function nearestIndex() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(cardCenter(c) - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  // Jika sudah masuk set kloning, lompat diam-diam ke kartu yang sama di set asli
  function recenter() {
    if (dragging || track.clientWidth === 0) return;
    const idx = nearestIndex();
    if (idx >= HOME && idx < HOME + N) return;
    const target = HOME + mod(idx);
    const delta = cardCenter(cards[target]) - cardCenter(cards[idx]);
    track.style.scrollSnapType = 'none';
    track.scrollLeft += delta;
    requestAnimationFrame(() => {
      track.style.scrollSnapType = '';
      update();
    });
  }

  // Skala & opacity mengikuti jarak ke tengah -> efek wheel
  function update() {
    ticking = false;
    const mid = track.scrollLeft + track.clientWidth / 2;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    cards.forEach((c) => {
      const dist = Math.abs(cardCenter(c) - mid);
      const t = Math.min(dist / (c.offsetWidth + gap), 1);
      c.style.transform = 'scale(' + (1.06 - t * 0.18).toFixed(3) + ')';
      c.style.opacity = (1 - t * 0.25).toFixed(2);
    });
    const best = nearestIndex();
    if (best !== activeIndex) {
      activeIndex = best;
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
      dots.forEach((d, i) => d.classList.toggle('active', i === mod(best)));
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(recenter, 140);
  }

  track.addEventListener('scroll', requestUpdate, { passive: true });

  // Section awalnya d-none (lebar 0): posisikan saat pertama kali tampil
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (track.clientWidth === 0) return;
      const idx = initialized && activeIndex >= 0 ? HOME + mod(activeIndex) : START_INDEX;
      initialized = true;
      scrollToCard(idx, false);
      update();
    }).observe(track);
  } else {
    window.addEventListener('resize', () => {
      scrollToCard(activeIndex >= 0 ? HOME + mod(activeIndex) : START_INDEX, false);
      update();
    });
  }

  // Drag dengan mouse (sentuhan memakai scroll bawaan browser)
  let startX = 0;
  let startScroll = 0;

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    track.scrollLeft = startScroll - (e.clientX - startX);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    if (e && e.pointerId !== undefined && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
    scrollToCard(nearestIndex(), true);
  }

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // Keyboard: panah kiri/kanan
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToCard(activeIndex + 1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToCard(activeIndex - 1, true);
    }
  });
})();

// ==========================================
// HALAMAN PROFIL: form, preferensi, wishlist
// ==========================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const sec = $('sec-profil');
  if (!sec) return;

  // ---- Toast kecil ----
  let toastTimer = null;
  function toast(msg) {
    const t = $('pfToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---- Tampilkan / sembunyikan password ----
  const pass = $('pfPass');
  const eye = $('pfEye');
  if (pass && eye) {
    eye.addEventListener('click', () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.querySelector('i').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
      eye.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
  }
  const chg = $('pfChangePass');
  if (chg && pass) chg.addEventListener('click', () => { pass.focus(); pass.select(); });

  // ---- Preferensi (toggle) ----
  sec.querySelectorAll('.pf-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const on = chip.classList.toggle('is-on');
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });

  // ---- Ganti foto profil ----
  const camBtn = $('pfAvatarBtn');
  const file = $('pfAvatarFile');
  if (camBtn && file) {
    camBtn.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const av = $('pfAvatar');
      av.style.backgroundImage = 'url("' + url + '")';
      av.classList.add('has-photo');
    });
  }

  // ---- Simpan perubahan ----
  const initials = (a, b) => ((a || '').trim().charAt(0) + (b || '').trim().charAt(0) || 'U').toUpperCase();
  const save = $('pfSave');
  if (save) {
    save.addEventListener('click', () => {
      const first = $('pfFirst').value.trim();
      const last = $('pfLast').value.trim();
      const mail = $('pfEmail').value.trim();
      if (!first || !mail) { toast('Nama depan dan email wajib diisi'); return; }
      $('pfDisplayName').textContent = (first + ' ' + last).trim();
      $('pfDisplayMail').textContent = mail;
      $('pfInitials').textContent = initials(first, last);
      toast('Perubahan berhasil disimpan');
    });
  }

  const logout = $('pfLogout');
  if (logout) {
    logout.addEventListener('click', () => {
      toast('Kamu telah keluar dari akun');
      if (typeof window.switchSection === 'function') window.switchSection('sec-beranda');
    });
  }

  // ---- Wishlist: tab kategori, hapus bookmark, rute ----
  const tabs = Array.from(sec.querySelectorAll('.pf-tab'));
  const items = Array.from(sec.querySelectorAll('.pf-item'));
  const empty = $('pfEmpty');
  const counts = {};
  tabs.forEach((t) => { counts[t.dataset.cat] = Number(t.dataset.count) || 0; });
  let activeCat = 'all';

  function renderTabs() {
    tabs.forEach((t) => {
      const label = t.dataset.label || (t.dataset.label = t.textContent.trim());
      t.textContent = label + ' (' + counts[t.dataset.cat] + ')';
    });
    const total = $('pfSavedCount');
    if (total) total.textContent = counts.all;
  }

  function applyTab() {
    let visible = 0;
    items.forEach((it) => {
      const show = !it.hidden && (activeCat === 'all' || it.dataset.cat === activeCat);
      it.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (empty) empty.hidden = visible > 0;
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.toggle('active', x === t));
      activeCat = t.dataset.cat;
      applyTab();
    });
  });

  items.forEach((it) => {
    const a = it.querySelector('.pf-route');
    if (a) {
      const lat = parseFloat(it.dataset.lat), lng = parseFloat(it.dataset.lng);
      if (isFinite(lat) && isFinite(lng)) {
        a.href = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=driving';
      }
    }
    const btn = it.querySelector('.pf-save');
    if (btn) {
      btn.addEventListener('click', () => {
        const name = it.querySelector('.pf-item-title').textContent;
        it.hidden = true;
        counts.all = Math.max(0, counts.all - 1);
        if (counts[it.dataset.cat] != null) counts[it.dataset.cat] = Math.max(0, counts[it.dataset.cat] - 1);
        renderTabs();
        applyTab();
        toast(name + ' dihapus dari wishlist');
      });
    }
  });

  renderTabs();
  applyTab();
})();