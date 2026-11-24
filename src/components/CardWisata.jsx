import { useEffect, useRef, useState } from 'react';
import { photoSrc } from '../lib/api.js';
import { categoryGroup } from '../data/destinations.js';
import { useI18n } from '../lib/i18n.jsx';
import { sentenceCase } from '../lib/text.js';

function Stars({ value }) {
  const n = Number(value);
  const score = Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
  const full = Math.floor(score);
  const frac = score - full;
  const half = frac >= 0.25 && frac < 0.75;
  const filled = Math.min(5, full + (frac >= 0.75 ? 1 : 0));
  return (
    <span className="landing-card-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        let icon = 'bi-star-fill';
        let tone = 'is-empty';
        if (i < filled) tone = 'is-full';
        else if (half && i === filled) icon = 'bi-star-half';
        if (icon === 'bi-star-half') tone = 'is-full';
        return <i className={`bi ${icon} ${tone}`} key={i}></i>;
      })}
    </span>
  );
}

function placeLine(value) {
  return String(value || '').replace(/\bKabupaten\s+/gi, '').replace(/\s+,/g, ',').trim();
}

function ratingText(value, lang) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  const text = n.toFixed(1);
  return lang === 'id' ? text.replace('.', ',') : text;
}

/* Kartu destinasi populer: nama dan lokasi di atas, foto di bawah. */
export default function CardWisata({ dest, inWishlist, visited, onToggleWishlist, onToggleVisited, onOpenMap, onOpenDetail }) {
  const { lang, t } = useI18n();
  const files = (Array.isArray(dest.img) ? dest.img : [dest.img]).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [focus, setFocus] = useState('center 45%');
  const imgRef = useRef(null);
  const allFailed = idx >= files.length;
  const cat = dest.kategori ? t(`ex.cat.${categoryGroup(dest.kategori)}`) : '';
  const title = sentenceCase(dest.title);
  const lokasi = sentenceCase(placeLine(dest.lokasi));

  const placePhoto = (img) => {
    const w = img?.naturalWidth;
    const h = img?.naturalHeight;
    if (!w || !h) return;
    if (/kedonganan/i.test(dest.title)) {
      setFocus('center 30%');
      return;
    }
    const ratio = h / w;
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

  const openDetail = () => { if (onOpenDetail) onOpenDetail(dest); };

  return (
    <article className="landing-card">
      <div className="landing-card-head">
        <h3 className="landing-card-title">
          <button type="button" className="landing-card-title-btn" onClick={openDetail}>{title}</button>
        </h3>
        {dest.lokasi ? (
          <p className="landing-card-loc">
            <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
            <span>{lokasi}</span>
          </p>
        ) : null}
        <div className="landing-card-rule"></div>
        <div className="landing-card-meta">
          {cat ? <span className="landing-card-cat">{cat}</span> : null}
          <Stars value={dest.rating} />
          <span className="landing-card-score">{ratingText(dest.rating, lang)}</span>
        </div>
      </div>
      <div className="landing-card-photo">
        <button type="button" className="landing-card-shot" onClick={openDetail} aria-label={title}>
          {allFailed ? (
            <span className="landing-card-thumb-ph" role="img" aria-label={t('card.photo', { name: title })}>
              <i className="bi bi-image"></i>
            </span>
          ) : (
            <img ref={imgRef} key={files[idx]} src={photoSrc(files[idx])} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ objectPosition: focus }} onLoad={(event) => placePhoto(event.currentTarget)} onError={handleError} />
          )}
        </button>
        <button
          type="button"
          className={`landing-card-visit${visited ? ' is-on' : ''}`}
          aria-pressed={visited ? 'true' : 'false'}
          title={visited ? t('card.visitOn') : t('card.visit')}
          onClick={(event) => { event.stopPropagation(); if (onToggleVisited) onToggleVisited(dest); }}
        >
          <i className={`bi ${visited ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden="true"></i>
          <span>{t('card.visit')}</span>
        </button>
        <button
          type="button"
          className={`landing-card-save${inWishlist ? ' is-on' : ''}`}
          aria-pressed={inWishlist ? 'true' : 'false'}
          title={inWishlist ? t('card.wishOn') : t('card.wish')}
          aria-label={inWishlist ? t('card.wishOn') : t('card.wish')}
          onClick={(event) => { event.stopPropagation(); if (onToggleWishlist) onToggleWishlist(dest); }}
        >
          <i className={`bi ${inWishlist ? 'bi-bookmark-fill' : 'bi-bookmark'}`} aria-hidden="true"></i>
        </button>
        <button type="button" className="landing-card-map" onClick={() => onOpenMap && onOpenMap(dest)}>
          {t('card.map')}
        </button>
      </div>
    </article>
  );
}
