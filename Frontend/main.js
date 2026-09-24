(function () {
      'use strict';

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
          layers: [layers.street]
        });

        // Simpan referensi global agar bisa di-remove dengan aman saat re-render
        window._leafletMap = map;

        // Kontrol zoom di kanan atas
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Group layer untuk titik wisata
        markers = L.layerGroup().addTo(map);
      }

      // Template popup info destinasi
      function createPopupContent(props) {
        const loc = props.kabupaten_kota || 'Bali';
        const nama = props.nama || 'Destinasi Wisata';
        const rating = props.rating ? `⭐ ${props.rating}` : '⭐ 4.5';
        const kategori = props.kategori ? ` • ${props.kategori}` : '';
        const mapAction = props.link
          ? `<a href="${props.link}" target="_blank" rel="noopener noreferrer" class="btn btn-navy btn-sm w-100 text-white text-decoration-none text-center d-block mt-2">Buka di Peta ↗</a>`
          : `<button class="btn btn-navy btn-sm w-100 mt-2" type="button">Lihat Detail Lengkap</button>`;

        return `
          <div class="popup-card p-2">
            <div class="loc">${loc}</div>
            <h6 class="fw-bold mb-1">${nama}</h6>
            <div class="small mb-1"><span class="rating-val">${rating}</span>${kategori}</div>
            ${mapAction}
          </div>`;
      }

      // Render daftar marker ke peta
      function renderMarkers(features) {
        if (!markers || !map) return;
        markers.clearLayers();

        let firstMarker = null;

        features.forEach((feature) => {
          if (feature.geometry && Array.isArray(feature.geometry.coordinates)) {
            const [lng, lat] = feature.geometry.coordinates;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
              const m = L.marker([lat, lng]);
              m.bindPopup(createPopupContent(feature.properties || {}));
              m.addTo(markers);
              if (!firstMarker) firstMarker = m;
            }
          }
        });

        // Buka popup pertama jika layer aktif
        if (firstMarker && map.hasLayer(markers)) {
          firstMarker.openPopup();
        }
      }

      // Fallback jika fetch GeoJSON terkendala (misalnya file:// protocol)
      function loadFallbackMarker() {
        if (!markers || !map) return;
        markers.clearLayers();
        const fallbackProps = {
          kabupaten_kota: 'Badung Selatan',
          nama: 'Pura Luhur Uluwatu',
          rating: 4.8,
          kategori: 'Budaya',
          link: 'https://maps.google.com/?q=-8.8291,115.0849'
        };
        const uluwatuMarker = L.marker(ULUWATU).bindPopup(createPopupContent(fallbackProps)).addTo(markers);
        if (map.hasLayer(markers)) {
          uluwatuMarker.openPopup();
        }
      }

      // 2. Pemanggilan GeoJSON via fetch menggunakan async/await & try-catch bersih
      async function fetchWisataGeoJson() {
        try {
          const response = await fetch('public/data/wisata-bali.geojson');
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
          }
          const geoData = await response.json();
          if (geoData && Array.isArray(geoData.features) && geoData.features.length > 0) {
            allFeatures = geoData.features;
            renderMarkers(allFeatures);
          } else {
            throw new Error('Data GeoJSON kosong atau format tidak sesuai');
          }
        } catch (err) {
          console.warn('GeoJSON fetch error (fallback aktif):', err.message);
          loadFallbackMarker();
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

      // Filter destinasi berdasarkan input pencarian, dropdown kabupaten, dan chips kategori
      function applyFilter() {
        if (!allFeatures || allFeatures.length === 0) return;

        const filtered = allFeatures.filter((feature) => {
          const props = feature.properties || {};
          const matchSearch = !currentSearch || (props.nama && props.nama.toLowerCase().includes(currentSearch));
          const matchKab = currentKabupaten === 'all' || currentKabupaten === 'semua' ||
            (props.kabupaten_kota && props.kabupaten_kota.toLowerCase().includes(currentKabupaten));
          const matchCat = isCategoryMatch(feature, currentCategory);

          return matchSearch && matchKab && matchCat;
        });

        renderMarkers(filtered);
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
        function locateUser() {
          if (map) map.locate({ setView: true, maxZoom: 13 });
        }

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
            if (userMarker && map.hasLayer(userMarker)) map.removeLayer(userMarker);
            userMarker = L.circleMarker(e.latlng, {
              radius: 8,
              color: '#458132',
              fillColor: '#9ad872',
              fillOpacity: 1,
              weight: 2
            }).addTo(map).bindPopup('Lokasi Anda');
            const gpsCheck = document.getElementById('lyrGps');
            if (gpsCheck) gpsCheck.checked = true;
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
            currentKabupaten = val.includes('Semua Kabupaten') ? 'all' : val.trim().toLowerCase();
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
        fetchWisataGeoJson();
      }

      // Eksekusi saat DOM siap
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
      } else {
        startApp();
      }
    })();