import { useEffect, useState } from 'react';
import { apiRequest, normalizeWisata, GEOJSON_URL } from './api.js';

/** Muat data wisata sekali: backend dulu, kalau kosong/gagal pakai public/data/wisata-bali.geojson */
export default function useWisata() {
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = [];
      let apiMsg = null;
      try {
        const r = await apiRequest('/api/wisata');
        if (r.ok) list = normalizeWisata(r.data);
        else apiMsg = r.message;
      } catch (err) {
        console.error(err);
      }
      if (!list.length) {
        try {
          const res = await fetch(GEOJSON_URL);
          if (res.ok) list = normalizeWisata(await res.json());
        } catch (err) {
          console.error(err);
        }
      }
      if (!alive) return;
      setPlaces(list);
      if (!list.length) setError(apiMsg || 'Data wisata tidak dapat dimuat.');
    })();
    return () => { alive = false; };
  }, []);

  return { places, error };
}