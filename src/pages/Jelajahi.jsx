import { useEffect, useMemo, useState } from 'react';
import MapSection from '../components/MapSection.jsx';
import { BALI_CENTER } from '../lib/api.js';
import {
  EXPLORE_CATS,
  buildRoute,
  categoryGroup,
  filterPlaces,
  haversineKm,
  BALI_NE,
  BALI_SW,
} from '../data/destinations.js';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function insideBali(ll) {
  return ll[0] >= BALI_SW[0] && ll[0] <= BALI_NE[0] && ll[1] >= BALI_SW[1] && ll[1] <= BALI_NE[1];
}

export default function Jelajahi({ places, error, query, focus }) {
  const [search, setSearch] = useState(query || '');
  const [cats, setCats] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [locMode, setLocMode] = useState('pin');
  const [radiusOn, setRadiusOn] = useState(false);
  const [radiusKm, setRadiusKm] = useState(15);
  const [days, setDays] = useState(2);
  const [routeOn, setRouteOn] = useState(false);
  const [flyToken, setFlyToken] = useState(0);
  const [hint, setHint] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSearch(query || '');
  }, [query]);

  const counts = useMemo(() => {
    const c = { alam: 0, budaya: 0, rekreasi: 0, umum: 0 };
    places.forEach((p) => {
      const g = categoryGroup(p.kategori);
      c[g] += 1;
    });
    return c;
  }, [places]);

  const mapPlaces = useMemo(
    () => filterPlaces(places, { query: search, categories: cats, origin, radiusOn, radiusKm })
      .map((p) => ({ ...p, group: categoryGroup(p.kategori) })),
    [places, search, cats, origin, radiusOn, radiusKm],
  );

  const routeStops = useMemo(() => {
    if (!routeOn || !origin) return [];
    const stops = buildRoute(origin, mapPlaces, days);
    let cursor = origin;
    return stops.map((p) => {
      const km = haversineKm(cursor, [p.lat, p.lng]);
      cursor = [p.lat, p.lng];
      return { ...p, km };
    });
  }, [routeOn, origin, mapPlaces, days]);

  const toggleCat = (id) => {
    setCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetFilters = () => {
    setSearch('');
    setCats([]);
    setHint('');
  };

  const useGps = () => {
    if (gpsBusy) return;
    if (!navigator.geolocation) {
      setHint('Browser ini tidak mendukung lokasi. Klik peta untuk memilih titik.');
      return;
    }
    setGpsBusy(true);
    setHint('Mencari lokasimu...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (!insideBali(ll)) {
          setLocMode('pin');
          setOrigin(BALI_CENTER);
          setFlyToken((n) => n + 1);
          setHint('GPS di luar Pulau Bali. Geser pin ke dalam peta.');
          return;
        }
        setOrigin(ll);
        setLocMode('gps');
        setRadiusOn(true);
        setFlyToken((n) => n + 1);
        setHint('');
      },
      () => {
        setGpsBusy(false);
        setHint('Lokasi ditolak. Izinkan GPS, atau klik peta untuk memilih titik.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const usePin = () => {
    if (origin && locMode === 'pin') {
      setLocMode('set');
      setHint('');
      return;
    }
    setLocMode('pin');
    setHint(origin ? '' : 'Klik sekali di peta untuk menaruh titik awal.');
  };

  const placeOrigin = (ll, fromDrag) => {
    setOrigin(ll);
    setRadiusOn(true);
    setHint('');
    if (!fromDrag) setLocMode('set');
  };

  const startRoute = () => {
    if (!origin) {
      setHint('Pakai lokasi saya, atau klik peta untuk memilih titik.');
      setLocMode('pin');
      return;
    }
    if (!mapPlaces.length) {
      setHint('Tidak ada destinasi yang masuk filter ini.');
      setRouteOn(false);
      return;
    }
    setRouteOn(true);
    setHint('');
    setFlyToken((n) => n + 1);
  };

  const radiusLabel = origin
    ? `${mapPlaces.length} tempat dalam ${radiusKm} km`
    : 'Belum dipilih';

  return (
    <>
      <MapSection
        places={mapPlaces}
        error={error}
        query=""
        focus={focus}
        origin={origin}
        locMode={locMode}
        radiusOn={radiusOn}
        radiusKm={radiusKm}
        routeStops={routeStops}
        flyToken={flyToken}
        onOriginChange={placeOrigin}
        onClearRoute={() => setRouteOn(false)}
        selected={selected}
        onSelectPlace={setSelected}
      >
        <aside className="ex-panel">
          <div className="ex-card">
            <div className="ex-label">
              <span>Saring destinasi</span>
              <button type="button" className="ex-reset" onClick={resetFilters}>Reset Filter</button>
            </div>
            <div className="ex-search">
              <i className="bi bi-search ex-search-icon"></i>
              <input
                type="text"
                value={search}
                placeholder="Cari pura, pantai, museum..."
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button type="button" className="ex-clear" aria-label="Hapus pencarian" onClick={() => setSearch('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              ) : null}
            </div>
            <div className="ex-chips">
              {EXPLORE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${c.chip}${cats.includes(c.id) ? ' active' : ''}`}
                  aria-pressed={cats.includes(c.id)}
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label} <em>({counts[c.id] || 0})</em>
                </button>
              ))}
            </div>
          </div>

          <div className="ex-card">
            <div className="ex-label">
              <span>Titik awal</span>
              <span className="ex-label-link">{radiusLabel}</span>
            </div>
            <div className="ex-origin-actions">
              <button
                type="button"
                className={`ex-gps${locMode === 'pin' ? ' is-on' : ''}`}
                aria-pressed={locMode === 'pin'}
                onClick={usePin}
              >
                <i className="bi bi-crosshair"></i>
                {locMode === 'pin' && origin ? 'Selesai memilih' : 'Pilih di peta'}
              </button>
              <button type="button" className="ex-gps" onClick={useGps} disabled={gpsBusy}>
                <i className="bi bi-geo-alt-fill"></i>
                {gpsBusy ? 'Mencari lokasi...' : 'Pakai lokasi saya'}
              </button>
            </div>
            <div className="ex-label">
              <span>Jarak {radiusKm} km</span>
            </div>
            <input
              className="ex-range"
              type="range"
              min="1"
              max="50"
              aria-label={`Jarak ${radiusKm} kilometer`}
              value={radiusKm}
              onChange={(e) => { setRadiusKm(Number(e.target.value)); setRadiusOn(true); }}
            />
            <div className="ex-range-scale"><span>1 km</span><span>50 km</span></div>
            <label className="ex-label" htmlFor="stayDays">Lama liburan</label>
            <select id="stayDays" className="form-select ex-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} hari</option>
              ))}
            </select>
            <button type="button" className="ex-cta" onClick={startRoute}>
              Buat rute
              <span className="ex-cta-arrow"><i className="bi bi-arrow-right"></i></span>
            </button>
            {hint ? <p className="au-msg" role="status" data-type="info">{hint}</p> : null}
          </div>
        </aside>
      </MapSection>
    </>
  );
}
