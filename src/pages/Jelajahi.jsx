import { useEffect, useRef, useState } from 'react';
import MapSection from '../components/MapSection.jsx';
import { BALI_CENTER, destinasiJelajahi, detailJelajahi, ruteJelajahi } from '../lib/api.js';
import {
  EXPLORE_CATS,
  categoryGroup,
  haversineKm,
  BALI_NE,
  BALI_SW,
} from '../data/destinations.js';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function insideBali(ll) {
  return ll[0] >= BALI_SW[0] && ll[0] <= BALI_NE[0] && ll[1] >= BALI_SW[1] && ll[1] <= BALI_NE[1];
}

function countGroups(rows) {
  const c = { alam: 0, budaya: 0, rekreasi: 0, umum: 0 };
  rows.forEach((p) => {
    c[categoryGroup(p.kategori)] += 1;
  });
  return c;
}

function toPlace(row) {
  const lat = Number(row.latitude ?? row.lat);
  const lng = Number(row.longitude ?? row.lng);
  const rating = row.rating == null || row.rating === '' ? null : Number(row.rating);
  return {
    id: row.id,
    nama: row.nama || row.name || '',
    kategori: row.kategori || '',
    kabupaten: row.kabupaten || row.kabupaten_kota || '',
    lokasi: row.lokasi || '',
    preferensi: row.preferensi || '',
    deskripsi: row.deskripsi || '',
    foto: row.foto || '',
    ulasan: row.ulasan || null,
    link: row.link_maps || row.link || '',
    rating: Number.isFinite(rating) ? rating : null,
    lat,
    lng,
  };
}

function routeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.hari) && payload.hari.some((day) => Array.isArray(day?.destinasi))) {
    return payload.hari.flatMap((day) => (
      Array.isArray(day.destinasi)
        ? day.destinasi.map((row) => ({ ...row, hari_ke: day.hari_ke }))
        : []
    ));
  }
  const keys = ['data', 'rute', 'hasil', 'titik', 'stops', 'items', 'destinasi', 'waypoints', 'hari'];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  const arrays = Object.values(payload).filter(Array.isArray);
  return arrays.length === 1 ? arrays[0] : [];
}

function toStops(payload, origin) {
  let cursor = origin;
  return routeRows(payload)
    .map((row) => {
      const place = toPlace(row);
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null;
      const given = Number(
        row.jarak_dari_sebelumnya_km
        ?? row.jarak_km
        ?? row.jarak
        ?? row.km
        ?? row.distance_km,
      );
      const km = Number.isFinite(given) ? given : (cursor ? haversineKm(cursor, [place.lat, place.lng]) : 0);
      cursor = [place.lat, place.lng];
      return { ...place, km };
    })
    .filter(Boolean);
}

export default function Jelajahi({ query, focus, onReady }) {
  const [search, setSearch] = useState(query || '');
  const [cats, setCats] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [locMode, setLocMode] = useState('pin');
  const [radiusOn, setRadiusOn] = useState(false);
  const [radiusKm, setRadiusKm] = useState(15);
  const [days, setDays] = useState(2);
  const [routeOn, setRouteOn] = useState(false);
  const [routeTick, setRouteTick] = useState(0);
  const flyAfterRoute = useRef(false);
  const [routeStops, setRouteStops] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [flyToken, setFlyToken] = useState(0);
  const [hint, setHint] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [places, setPlaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ alam: 0, budaya: 0, rekreasi: 0, umum: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(true);
  const toldReady = useRef(false);

  useEffect(() => {
    setSearch(query || '');
  }, [query]);

  useEffect(() => {
    if (listLoading || toldReady.current) return;
    toldReady.current = true;
    onReady?.();
  }, [listLoading, onReady]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setListLoading(true);
      const kategori = cats
        .map((id) => EXPLORE_CATS.find((c) => c.id === id)?.label)
        .filter(Boolean);
      const spatial = origin && radiusOn;
      const r = await destinasiJelajahi({
        q: search,
        kategori,
        lat: spatial ? origin[0] : null,
        lng: spatial ? origin[1] : null,
        radiusKm: spatial ? radiusKm : null,
      });
      if (!alive) return;
      setListLoading(false);
      if (!r.ok) {
        setPlaces([]);
        setTotal(0);
        setListError(r.message || 'Destinasi tidak dapat dimuat.');
        return;
      }
      const rows = ((r.data && r.data.data) || []).map(toPlace).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      setPlaces(rows);
      setTotal(Number(r.data && r.data.total) || rows.length);
      if (!cats.length) setCounts(countGroups(rows));
      setListError(null);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, cats, origin, radiusOn, radiusKm]);

  useEffect(() => {
    if (!routeOn || !origin) {
      setRouteStops([]);
      setRouteLoading(false);
      return undefined;
    }
    let alive = true;
    setRouteLoading(true);
    (async () => {
      const kategori = cats
        .map((id) => EXPLORE_CATS.find((c) => c.id === id)?.label)
        .filter(Boolean);
      const r = await ruteJelajahi({
        lat: origin[0],
        lng: origin[1],
        radiusKm,
        hari: days,
        kategori,
      });
      if (!alive) return;
      setRouteLoading(false);
      if (!r.ok) {
        setRouteStops([]);
        setRouteOn(false);
        setHint(r.message && r.message !== 'Not Found' ? r.message : 'Tidak ada rute untuk titik dan filter ini.');
        return;
      }
      const stops = toStops(r.data, origin);
      if (!stops.length) {
        setRouteStops([]);
        setRouteOn(false);
        setHint(kategori.length
          ? 'Tidak ada destinasi yang masuk filter ini.'
          : 'Tidak ada destinasi untuk titik dan jarak ini.');
        return;
      }
      setRouteStops(stops);
      setHint('');
      if (flyAfterRoute.current) {
        flyAfterRoute.current = false;
        setFlyToken((n) => n + 1);
      }
    })();
    return () => { alive = false; };
  }, [routeOn, routeTick, origin, radiusKm, days, cats]);

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

  const openPlace = (place) => {
    if (!place) {
      setSelected(null);
      return;
    }
    setSelected({ ...place, detailLoading: place.id != null });
    if (place.id == null) return;
    const requestId = place.id;
    detailJelajahi(requestId).then((r) => {
      if (!r.ok) {
        setSelected((cur) => (cur && cur.id === requestId ? { ...cur, detailLoading: false } : cur));
        return;
      }
      const detail = toPlace(r.data || {});
      setSelected((cur) => {
        if (!cur || cur.id !== requestId) return cur;
        const extra = Object.fromEntries(Object.entries(detail).filter(([, v]) => {
          if (v == null || v === '') return false;
          if (typeof v === 'number' && !Number.isFinite(v)) return false;
          return true;
        }));
        return { ...cur, ...extra, detailLoading: false };
      });
    });
  };

  const startRoute = () => {
    if (!origin) {
      setHint('Pakai lokasi saya, atau klik peta untuk memilih titik.');
      setLocMode('pin');
      return;
    }
    setHint('');
    flyAfterRoute.current = true;
    setRouteOn(true);
    setRouteTick((n) => n + 1);
  };

  const radiusLabel = origin
    ? `${total} tempat dalam ${radiusKm} km`
    : 'Belum dipilih';

  return (
    <>
      <MapSection
        places={places}
        error={listError}
        query=""
        focus={focus}
        origin={origin}
        locMode={locMode}
        radiusOn={radiusOn}
        radiusKm={radiusKm}
        routeStops={routeStops}
        flyToken={flyToken}
        onOriginChange={placeOrigin}
        onClearRoute={() => { setRouteOn(false); setRouteStops([]); }}
        selected={selected}
        onSelectPlace={openPlace}
      >
        <aside className={`ex-panel${toolsOpen ? '' : ' is-min'}`}>
          <button
            type="button"
            className="ex-dock"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <i className={`bi ${toolsOpen ? 'bi-chevron-left' : 'bi-sliders'}`}></i>
            {toolsOpen ? 'Sembunyikan' : 'Filter & rute'}
          </button>
          {toolsOpen ? (
          <>
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
            {listLoading ? <p className="ex-route-meta">Memuat destinasi...</p> : null}
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
            <button type="button" className="ex-cta" onClick={startRoute} disabled={routeLoading}>
              {routeLoading ? 'Menyusun rute...' : 'Buat rute'}
              <span className="ex-cta-arrow"><i className="bi bi-arrow-right"></i></span>
            </button>
            {hint ? <p className="au-msg" role="status" data-type="info">{hint}</p> : null}
          </div>
          </>
          ) : null}
        </aside>
      </MapSection>
    </>
  );
}
