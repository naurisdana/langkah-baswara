import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet'; // npm i leaflet  (CSS-nya diimpor di main.jsx)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { BALI_CENTER } from '../lib/api.js';

// Perbaikan ikon marker default Leaflet di Vite (tanpa ini marker tampil sebagai gambar rusak)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const BASEMAPS = {
  street: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }],
  satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }],
  dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }],
};
const BASEMAP_LABELS = [['street', 'Jalan'], ['satellite', 'Satelit'], ['dark', 'Gelap']];

/* places = daftar { nama, kategori, lat, lng } ; query = filter nama ; focus = destinasi dari kartu */
export default function MapSection({ places, error, query, focus }) {
  const mapEl = useRef(null);      // <div id="map">  (tingginya diatur CSS: #map / .explore-shell #map)
  const mapRef = useRef(null);     // instance L.map
  const layerRef = useRef(null);   // tile layer aktif
  const markersRef = useRef(null); // layerGroup marker
  const [basemap, setBasemap] = useState('street');

  // 1) Inisialisasi peta SEKALI di useEffect (container sudah ada di DOM) + cleanup
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, { center: BALI_CENTER, zoom: 10, zoomControl: false });
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    // Hitung ulang ukuran tiap container berubah (mencegah peta "abu-abu"/setengah tampil)
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // 2) Ganti basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const [url, opts] = BASEMAPS[basemap];
    layerRef.current = L.tileLayer(url, opts).addTo(map);
  }, [basemap]);

  // 3) Marker (difilter kata kunci pencarian Hero)
  const shown = useMemo(() => {
    const q = (query || '').toLowerCase();
    return q ? places.filter((p) => p.nama.toLowerCase().includes(q)) : places;
  }, [places, query]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    shown.forEach((p) => {
      const el = document.createElement('div'); // textContent → aman dari HTML injection
      const b = document.createElement('b');
      b.textContent = p.nama;
      el.appendChild(b);
      if (p.kategori) {
        el.appendChild(document.createElement('br'));
        el.appendChild(document.createTextNode(p.kategori));
      }
      L.marker([p.lat, p.lng]).bindPopup(el).addTo(markersRef.current);
    });
  }, [shown]);

  // 4) "Buka di Peta" dari kartu: cocokkan nama di GeoJSON, jika tak ada pakai koordinat cadangan
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const key = (focus.match || focus.key).toLowerCase();
    const hit = places.find((p) => p.nama.toLowerCase() === key) || places.find((p) => p.nama.toLowerCase().includes(key));
    const target = hit ? [hit.lat, hit.lng] : focus.coords;
    if (target) mapRef.current.setView(target, 15);
  }, [focus, places]);

  const zoom = (d) => mapRef.current && mapRef.current.setZoom(mapRef.current.getZoom() + d);

  return (
    <div className="explore-wrap">
      <div className="explore-shell" id="exploreShell">
        <div className="ex-mapbox">
          <div id="map" ref={mapEl}></div>

          <div className="ex-zoom" role="group" aria-label="Kontrol peta">
            <button type="button" aria-label="Perbesar" onClick={() => zoom(1)}><i className="bi bi-plus-lg"></i></button>
            <button type="button" aria-label="Perkecil" onClick={() => zoom(-1)}><i className="bi bi-dash-lg"></i></button>
          </div>

          <div className="map-mode">
            {BASEMAP_LABELS.map(([id, label]) => (
              <button key={id} type="button" className={basemap === id ? 'active' : ''} onClick={() => setBasemap(id)}>{label}</button>
            ))}
          </div>

          <div className="ex-status">
            <span className="ex-status-dot"></span>
            <span><b>{shown.length}</b> Titik Wisata Terverifikasi</span>
          </div>

          {error ? <p className="au-msg" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}