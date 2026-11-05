import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { BALI_CENTER } from '../lib/api.js';
import { BALI_MIN_ZOOM, BALI_NE, BALI_SW } from '../data/destinations.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const BASEMAPS = {
  street: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }],
  satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }],
  dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }],
};
const BASEMAP_LABELS = [['street', 'Jalan'], ['satellite', 'Satelit'], ['dark', 'Gelap']];

const PIN_ICON = {
  alam: 'bi-tree-fill',
  budaya: 'bi-bank2',
  rekreasi: 'bi-camera-fill',
  umum: 'bi-geo-alt-fill',
};

function pinIcon(cat, active) {
  const icon = PIN_ICON[cat] || PIN_ICON.umum;
  return L.divIcon({
    className: 'lb-pin-wrap',
    html: `<span class="lb-pin cat-${cat || 'umum'}${active ? ' is-selected' : ''}"><i class="bi ${icon}"></i></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
  });
}

function samePlace(a, b) {
  if (!a || !b) return false;
  return a.nama === b.nama && Number(a.lat) === Number(b.lat) && Number(a.lng) === Number(b.lng);
}

function placeBlurb(p) {
  const kind = p.preferensi || (p.kategori ? `wisata ${String(p.kategori).toLowerCase()}` : 'destinasi wisata');
  const where = p.kabupaten ? ` di ${p.kabupaten}` : ' di Bali';
  return `${p.nama} termasuk ${kind}${where}.`;
}

const USER_ICON = L.divIcon({
  className: 'lb-pin-wrap',
  html: '<span class="lb-pin cat-rekreasi is-selected"><i class="bi bi-geo-alt-fill"></i></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

export default function MapSection({
  places,
  error,
  query,
  focus,
  origin = null,
  locMode = null,
  radiusOn = false,
  radiusKm = 10,
  routeStops = [],
  flyToken = 0,
  onOriginChange,
  onClearRoute,
  selected = null,
  onSelectPlace,
  children,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(null);
  const userRef = useRef(null);
  const circleRef = useRef(null);
  const routeRef = useRef(null);
  const onOriginRef = useRef(onOriginChange);
  const onSelectRef = useRef(onSelectPlace);
  const originRef = useRef(origin);
  const locModeRef = useRef(locMode);
  const [basemap, setBasemap] = useState('street');

  onOriginRef.current = onOriginChange;
  onSelectRef.current = onSelectPlace;
  originRef.current = origin;
  locModeRef.current = locMode;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, {
      center: BALI_CENTER,
      zoom: 10,
      minZoom: BALI_MIN_ZOOM,
      maxBounds: L.latLngBounds(BALI_SW, BALI_NE),
      maxBoundsViscosity: 1,
      zoomControl: false,
    });
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      if (locModeRef.current !== 'pin' || !onOriginRef.current) return;
      map.getContainer().classList.remove('is-picking');
      map.getContainer().style.cursor = 'grab';
      onOriginRef.current([e.latlng.lat, e.latlng.lng]);
    });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = null;
      userRef.current = null;
      circleRef.current = null;
      routeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const [url, opts] = BASEMAPS[basemap];
    layerRef.current = L.tileLayer(url, opts).addTo(map);
  }, [basemap]);

  const shown = useMemo(() => {
    const q = (query || '').toLowerCase();
    return q ? places.filter((p) => String(p.nama || '').toLowerCase().includes(q)) : places;
  }, [places, query]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    shown.forEach((p) => {
      const group = ['alam', 'budaya', 'rekreasi', 'umum'].includes(p.group) ? p.group : 'umum';
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(group, samePlace(selected, p)) }).addTo(markersRef.current);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (locMode === 'pin') {
          const map = mapRef.current;
          if (map) {
            map.getContainer().classList.remove('is-picking');
            map.getContainer().style.cursor = 'grab';
          }
          if (onOriginRef.current) onOriginRef.current([e.latlng.lat, e.latlng.lng]);
          return;
        }
        if (onSelectRef.current) onSelectRef.current(p);
      });
    });
  }, [shown, locMode, selected]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const key = String(focus.match || focus.key || '').toLowerCase();
    const hit = places.find((p) => p.nama.toLowerCase() === key) || places.find((p) => p.nama.toLowerCase().includes(key));
    const target = hit ? [hit.lat, hit.lng] : focus.coords;
    if (target) mapRef.current.setView(target, 15);
  }, [focus, places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (!origin) {
      if (userRef.current) {
        map.removeLayer(userRef.current);
        userRef.current = null;
      }
      return undefined;
    }
    if (!userRef.current) {
      userRef.current = L.marker(origin, {
        icon: USER_ICON,
        draggable: true,
        zIndexOffset: 1200,
        autoPan: true,
      }).addTo(map);
      userRef.current.on('dragend', () => {
        const ll = userRef.current.getLatLng();
        if (onOriginRef.current) onOriginRef.current([ll.lat, ll.lng], true);
      });
    } else {
      const cur = userRef.current.getLatLng();
      if (Math.abs(cur.lat - origin[0]) > 1e-6 || Math.abs(cur.lng - origin[1]) > 1e-6) {
        userRef.current.setLatLng(origin);
      }
    }
    if (userRef.current.dragging) userRef.current.dragging.enable();
    userRef.current.setZIndexOffset(1200);
    return undefined;
  }, [origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const el = map.getContainer();
    const picking = locMode === 'pin';
    el.classList.toggle('is-picking', picking);
    el.style.cursor = picking ? 'crosshair' : 'grab';
  }, [locMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || !Number.isFinite(Number(selected.lat))) return;
    const zoom = Math.max(map.getZoom(), 13);
    map.setView([selected.lat, selected.lng], zoom);
    const shell = map.getContainer().closest('.explore-shell');
    const wide = window.matchMedia('(min-width: 992px)').matches;
    if (shell && wide) {
      const leftW = shell.querySelector('.ex-panel')?.offsetWidth || 0;
      const rightW = shell.querySelector('.ex-side')?.offsetWidth || 0;
      map.panBy([-(leftW - rightW) / 2, 0], { animate: false });
    }
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    const ll = originRef.current;
    if (!map || !flyToken || !ll) return;
    const zoom = Math.min(14, Math.max(map.getZoom(), 12));
    map.setView(ll, zoom);
    const panel = map.getContainer().parentElement && map.getContainer().parentElement.parentElement
      ? map.getContainer().parentElement.parentElement.querySelector('.ex-panel')
      : null;
    const wide = window.matchMedia('(min-width: 992px)').matches;
    if (panel && wide) map.panBy([-(panel.offsetWidth / 2), 0], { animate: false });
  }, [flyToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (radiusOn && origin) {
      circleRef.current = L.circle(origin, {
        radius: Number(radiusKm) * 1000,
        color: '#458132',
        weight: 2,
        fillColor: '#9ad872',
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(map);
    }
  }, [radiusOn, radiusKm, origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (origin && routeStops.length) {
      const latlngs = [origin, ...routeStops.map((p) => [p.lat, p.lng])];
      routeRef.current = L.polyline(latlngs, { color: '#458132', weight: 4, opacity: 0.9, interactive: false }).addTo(map);
    }
  }, [origin, routeStops]);

  const zoom = (d) => mapRef.current && mapRef.current.setZoom(mapRef.current.getZoom() + d);
  const showSide = routeStops.length > 0 || selected;
  const score = selected && Number.isFinite(Number(selected.rating)) ? Number(selected.rating) : null;

  return (
    <div className="explore-wrap">
      <div className={`explore-shell${selected ? ' has-detail' : ''}`} id="exploreShell">
        <div className="ex-mapbox">
          <div id="map" ref={mapEl}></div>

          <div className="ex-mapctrl" role="group" aria-label="Kontrol peta">
            <div className="ex-zoom">
              <button type="button" aria-label="Perbesar" onClick={() => zoom(1)}><i className="bi bi-plus-lg"></i></button>
              <button type="button" aria-label="Perkecil" onClick={() => zoom(-1)}><i className="bi bi-dash-lg"></i></button>
            </div>
            <div className="map-mode">
              {BASEMAP_LABELS.map(([id, label]) => (
                <button key={id} type="button" className={basemap === id ? 'active' : ''} onClick={() => setBasemap(id)}>{label}</button>
              ))}
            </div>
          </div>

          {!origin ? (
            <div className="ex-hint">Klik peta, atau pakai lokasi saya</div>
          ) : null}

          <div className="ex-status">
            <span className="ex-status-dot"></span>
            <span><b>{shown.length}</b> tempat</span>
          </div>

          {showSide ? (
            <aside className="ex-side">
              {routeStops.length > 0 ? (
                <div className="ex-route">
                  <div className="ex-route-head">
                    <div>
                      <div className="ex-eyebrow">Rute perjalanan</div>
                      <h3 className="ex-route-title">{routeStops.length} titik terdekat</h3>
                      <p className="ex-route-meta">
                        {routeStops.reduce((sum, p) => sum + (Number(p.km) || 0), 0).toFixed(1)} km dari titik acuan
                      </p>
                    </div>
                    <button type="button" className="ex-icon-btn ex-route-close" aria-label="Tutup rute" onClick={onClearRoute}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <ol className="ex-route-list">
                    {routeStops.map((p, i) => (
                      <li key={`${p.nama}-${p.lat}`} className={samePlace(selected, p) ? 'is-active' : ''}>
                        <button type="button" className="ex-route-hit" onClick={() => onSelectPlace && onSelectPlace(p)}>
                          <span className="ex-route-num">{i + 1}</span>
                          <span className="ex-route-name">{p.nama}</span>
                          <span className="ex-route-km">{Number(p.km || 0).toFixed(1)} km</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {selected ? (
                <article className="ex-detail">
                  <div className="ex-detail-head">
                    <div className="ex-detail-titles">
                      <div className="ex-eyebrow">Detail wisata</div>
                      <h3 className="ex-detail-name">{selected.nama}</h3>
                    </div>
                    <button type="button" className="ex-icon-btn" aria-label="Tutup detail" onClick={() => onSelectPlace && onSelectPlace(null)}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <p className="ex-addr">
                    <i className="bi bi-geo-alt"></i>
                    <span>{selected.kabupaten || 'Pulau Bali'}</span>
                  </p>
                  <div className="ex-tags">
                    {selected.kategori ? <span className="ex-tag">{selected.kategori}</span> : null}
                    {selected.preferensi ? <span className="ex-tag">{selected.preferensi}</span> : null}
                  </div>
                  <p className="ex-desc">{placeBlurb(selected)}</p>
                  <div className="ex-review">
                    <div className="ex-eyebrow">Hasil ulasan</div>
                    {score != null ? (
                      <>
                        <div className="ex-review-score">
                          <span className="ex-stars" aria-hidden="true">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <i key={n} className={`bi ${n <= Math.round(score) ? 'bi-star-fill' : 'bi-star'}`}></i>
                            ))}
                          </span>
                          <b>{score.toFixed(1)}</b>
                          <span>/ 5</span>
                        </div>
                        <p>Skor ini dirangkum dari ulasan pengunjung untuk {selected.nama}.</p>
                      </>
                    ) : (
                      <p>Belum ada ulasan untuk tempat ini.</p>
                    )}
                  </div>
                  {selected.link ? (
                    <a className="ex-open-btn" href={selected.link} target="_blank" rel="noreferrer">Lihat lokasi</a>
                  ) : null}
                </article>
              ) : null}
            </aside>
          ) : null}

          {error ? <p className="au-msg" role="alert" data-type="error">{error}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
