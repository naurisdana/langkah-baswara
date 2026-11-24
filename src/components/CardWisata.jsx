import { useEffect, useRef, useState } from 'react';
import { photoSrc } from '../lib/api.js';

/* Kartu destinasi: foto dari URL backend, atau nama file di public/assets bila URL tidak ada.
   dest.img boleh string atau daftar; kalau satu gagal dimuat, dicoba sumber berikutnya. */
export default function CardWisata({ dest, isFav, onToggleFav, onOpenMap, onOpenDetail }) {
  const files = (Array.isArray(dest.img) ? dest.img : [dest.img]).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [focus, setFocus] = useState('center 45%');
  const imgRef = useRef(null);
  const allFailed = idx >= files.length;

  const placePhoto = (img) => {
    const w = img?.naturalWidth;
    const h = img?.naturalHeight;
    if (!w || !h) return;
    if (/kedonganan/i.test(dest.title)) {
      setFocus('center 30%');
      return;
    }
    const ratio = h / w;
    // Foto tegak subjeknya sering di bawah; foto hampir persegi (gapura) lebih ke bawah lagi.
    if (ratio > 1.15) setFocus('center 62%');
    else if (ratio > 0.98) setFocus('center 78%');
    else setFocus('center 40%');
  };

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) placePhoto(img);
  });

  const handleError = () => {
    if (idx + 1 >= files.length) {
      console.warn(`[CardWisata] Foto "${dest.title}" tidak dapat dimuat. Sudah dicoba: ${files.map(photoSrc).join(', ')}.`);
    }
    setIdx((i) => i + 1);
  };

  return (
    <div className="landing-card">
      <div className="landing-card-thumb" onClick={() => onOpenDetail && onOpenDetail(dest)}>
        {allFailed ? (
          <div className="landing-card-thumb-ph" role="img" aria-label={`Foto ${dest.title} belum tersedia`}>
            <i className="bi bi-image"></i>
          </div>
        ) : (
          <img ref={imgRef} key={files[idx]} src={photoSrc(files[idx])} alt={dest.title} loading="lazy" referrerPolicy="no-referrer" style={{ objectPosition: focus }} onLoad={(event) => placePhoto(event.currentTarget)} onError={handleError} />
        )}
        <button
          type="button"
          className={`landing-card-fav${isFav ? ' active' : ''}`}
          title="Tambah ke Favorit"
          aria-label="Tambah ke Favorit"
          onClick={(e) => { e.stopPropagation(); onToggleFav(dest.key); }}
        >
          <i className="bi bi-heart-fill"></i>
        </button>
      </div>
      <div className="landing-card-body">
        <h3 className="landing-card-title">
          <button type="button" className="landing-card-title-btn" onClick={() => onOpenDetail && onOpenDetail(dest)}>{dest.title}</button>
        </h3>
        <div className="landing-card-rating">
          <span className="stars-icon">
            {[0, 1, 2, 3, 4].map((i) => <i className="bi bi-star-fill" key={i}></i>)}
          </span>
          <span className="rating-number">{dest.rating}</span>
        </div>
        <div className="landing-card-actions mt-auto">
          <button type="button" className="btn-card-detail" onClick={() => onOpenDetail && onOpenDetail(dest)}>
            Lihat detail
          </button>
          <button type="button" className="btn-card-explore" onClick={() => onOpenMap(dest)}>
            <i className="bi bi-geo-alt-fill me-1"></i> Buka di Peta
          </button>
        </div>
      </div>
    </div>
  );
}