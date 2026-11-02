import { useState } from 'react';
import { assetUrl } from '../lib/api.js';

/* Kartu destinasi (seragam): foto + tombol favorit, judul, rating bintang, tombol "Buka di Peta". Foto dibaca dari public/assets/ lewat URL "/assets/<nama-file>".
   dest.img boleh string atau daftar nama file; kalau satu gagal dimuat, dicoba nama berikutnya. */
export default function CardWisata({ dest, isFav, onToggleFav, onOpenMap }) {
  const files = Array.isArray(dest.img) ? dest.img : [dest.img];
  const [idx, setIdx] = useState(0);
  const allFailed = idx >= files.length;

  const handleError = () => {
    if (idx + 1 >= files.length) {
      console.warn(
        `[CardWisata] Foto "${dest.title}" tidak ditemukan. Sudah dicoba: ${files.map(assetUrl).join(', ')}. ` +
          'Samakan nama file dengan isi folder public/assets/ (perhatikan huruf besar/kecil & tanda "-").',
      );
    }
    setIdx((i) => i + 1);
  };

  return (
    <div className="landing-card">
      <div className="landing-card-thumb">
        {allFailed ? (
          <div className="landing-card-thumb-ph" role="img" aria-label={`Foto ${dest.title} belum tersedia`}>
            <i className="bi bi-image"></i>
          </div>
        ) : (
          <img key={files[idx]} src={assetUrl(files[idx])} alt={dest.title} loading="lazy" onError={handleError} />
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
        <h3 className="landing-card-title">{dest.title}</h3>
        <div className="landing-card-rating">
          <span className="stars-icon">
            {[0, 1, 2, 3, 4].map((i) => <i className="bi bi-star-fill" key={i}></i>)}
          </span>
          <span className="rating-number">{dest.rating}</span>
        </div>
        <button type="button" className="btn-card-explore mt-auto" onClick={() => onOpenMap(dest)}>
          <i className="bi bi-geo-alt-fill me-1"></i> Buka di Peta
        </button>
      </div>
    </div>
  );
}