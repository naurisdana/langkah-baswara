import { useEffect, useState } from 'react';
import { assetUrl } from '../lib/api.js';

/** Popup detail destinasi populer di Beranda. */
export default function DestPopup({ dest, onClose, onOpenMap }) {
  const files = Array.isArray(dest?.img) ? dest.img : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [dest]);

  useEffect(() => {
    if (!dest) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [dest, onClose]);

  if (!dest) return null;
  const failed = idx >= files.length;

  return (
    <div className="dest-pop" role="dialog" aria-modal="true" aria-label={dest.title}>
      <button type="button" className="dest-pop-backdrop" aria-label="Tutup" onClick={onClose}></button>
      <article className="dest-pop-card">
        <div className="dest-pop-photo">
          {failed ? (
            <div className="ex-photo-ph" role="img" aria-label={`Foto ${dest.title} belum tersedia`}>
              <i className="bi bi-image"></i>
            </div>
          ) : (
            <img src={assetUrl(files[idx])} alt={dest.title} onError={() => setIdx((i) => i + 1)} />
          )}
          <span className="ex-rating"><i className="bi bi-star-fill"></i> {dest.rating}</span>
        </div>
        <button type="button" className="dest-pop-x" aria-label="Tutup detail" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
        <div className="dest-pop-body">
          <p className="ex-eyebrow">Destinasi populer</p>
          <h3>{dest.title}</h3>
          <p>{dest.blurb}</p>
          <button type="button" className="btn-card-explore" onClick={() => onOpenMap(dest)}>
            <i className="bi bi-geo-alt-fill"></i> Buka di Peta
          </button>
        </div>
      </article>
    </div>
  );
}
