import { useEffect, useState } from 'react';
import { photoSrc } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { sentenceCase } from '../lib/text.js';

/** Popup detail destinasi populer di Beranda. */
export default function DestPopup({ dest, onClose, onOpenMap }) {
  const { t } = useI18n();
  const files = (Array.isArray(dest?.img) ? dest.img : []).filter(Boolean);
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
  const title = sentenceCase(dest.title);
  const blurb = sentenceCase(dest.blurb);

  return (
    <div className="dest-pop" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="dest-pop-backdrop" aria-label={t('close')} onClick={onClose}></button>
      <article className="dest-pop-card">
        <div className="dest-pop-photo">
          {failed ? (
            <div className="ex-photo-ph" role="img" aria-label={t('card.photo', { name: title })}>
              <i className="bi bi-image"></i>
            </div>
          ) : (
            <img src={photoSrc(files[idx])} alt={title} referrerPolicy="no-referrer" onError={() => setIdx((i) => i + 1)} />
          )}
          <span className="ex-rating"><i className="bi bi-star-fill"></i> {dest.rating}</span>
        </div>
        <button type="button" className="dest-pop-x" aria-label={t('close.detail')} onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
        <div className="dest-pop-body">
          <p className="ex-eyebrow">{t('pop.label')}</p>
          <h3>{title}</h3>
          <p>{blurb}</p>
          <button type="button" className="btn-card-explore" onClick={() => onOpenMap(dest)}>
            <i className="bi bi-geo-alt-fill"></i> {t('card.map')}
          </button>
        </div>
      </article>
    </div>
  );
}
