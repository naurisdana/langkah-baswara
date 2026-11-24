import { useEffect, useRef, useState } from 'react';
import { apiRequest, photoSrc } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { sentenceCase } from '../lib/text.js';

function SavedList({ items, emptyIcon, emptyText, onRemove, removeLabel }) {
  if (!items.length) {
    return (
      <div className="pf-empty">
        <i className={`bi ${emptyIcon}`}></i>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="pf-list pf-saved-list">
      {items.map((item) => {
        const src = photoSrc(item.img && item.img[0]);
        return (
          <article className="pf-item" key={item.key}>
            <div className="pf-photo">
              {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : null}
              <span className="pf-rate"><i className="bi bi-star-fill"></i> {item.rating}</span>
            </div>
            <div className="pf-item-body">
              <h3 className="pf-item-title">{sentenceCase(item.title)}</h3>
              {item.blurb ? <p className="pf-item-desc">{sentenceCase(item.blurb)}</p> : null}
              <div className="pf-item-foot">
                <button type="button" className="pf-link" onClick={() => onRemove(item)}>
                  {removeLabel}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      reject(new Error('type'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 480;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('read'));
    };
    img.src = url;
  });
}

export default function Profil({ user, saved, onToggleSaved, onLogout, onUpdateUser, onReady }) {
  const { t } = useI18n();
  const lists = saved || { wishlist: [], visited: [] };
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [photo, setPhoto] = useState(user.photo || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const initial = String((editing ? name : user.name) || '?').trim().charAt(0).toUpperCase() || '?';

  useEffect(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    if (editing) return;
    setName(user.name || '');
    setPhoto(user.photo || '');
  }, [editing, user.name, user.photo]);

  const startEdit = () => {
    setName(user.name || '');
    setPhoto(user.photo || '');
    setPassword('');
    setConfirm('');
    setShowPass(false);
    setNote(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setName(user.name || '');
    setPhoto(user.photo || '');
    setPassword('');
    setConfirm('');
    setEditing(false);
    setNote(null);
  };

  const onPhoto = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPhoto(await readPhoto(file));
      setNote(null);
    } catch {
      setNote({ type: 'error', text: t('pf.photoFail') });
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setNote({ type: 'error', text: t('pf.needName') });
      return;
    }
    if (password || confirm) {
      if (password.length < 8) {
        setNote({ type: 'error', text: t('pf.passShort') });
        return;
      }
      if (password !== confirm) {
        setNote({ type: 'error', text: t('pf.passMismatch') });
        return;
      }
      const token = localStorage.getItem('lb_token');
      if (!token) {
        setNote({ type: 'error', text: t('pf.passNeedLogin') });
        return;
      }
      setBusy(true);
      const result = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        token,
        body: { access_token: token, new_password: password },
      });
      setBusy(false);
      if (!result.ok) {
        setNote({ type: 'error', text: result.message || t('pf.passFail') });
        return;
      }
    }
    onUpdateUser?.({ name: nextName, photo });
    setPassword('');
    setConfirm('');
    setEditing(false);
    setNote({ type: 'ok', text: t('pf.saved') });
  };

  return (
    <div className="pf-wrap">
      <div className="pf-card pf-account">
        <div className="pf-account-head">
          <h2 className="pf-h2">{t('pf.title')}</h2>
          <span className="pf-badge-verified">{t('pf.verified')}</span>
        </div>
        <div className="pf-user">
          <div className="pf-avatar-wrap">
            <div className={`pf-avatar${photo ? ' has-photo' : ''}`} style={photo ? { backgroundImage: `url("${photo}")` } : undefined}>
              <span>{initial}</span>
            </div>
            {editing ? (
              <button type="button" className="pf-avatar-cam" aria-label={t('pf.photo')} onClick={() => fileRef.current?.click()}>
                <i className="bi bi-camera-fill"></i>
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPhoto} />
          </div>
          <div>
            <div className="pf-user-name">{editing ? name.trim() || user.name : user.name}</div>
            <div className="pf-user-mail">{user.email}</div>
            {editing && photo ? (
              <button type="button" className="pf-link" onClick={() => setPhoto('')}>{t('pf.removePhoto')}</button>
            ) : null}
          </div>
        </div>
        {editing ? (
          <form className="pf-form" onSubmit={save}>
            <div className="pf-field">
              <label htmlFor="pfName">{t('pf.username')}</label>
              <input id="pfName" value={name} autoComplete="nickname" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="pf-field">
              <label htmlFor="pfPass">{t('pf.password')}</label>
              <div className="pf-input-icon">
                <input id="pfPass" className="pf-pass" type={showPass ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="pf-eye" aria-label={showPass ? t('au.hide') : t('au.show')} onClick={() => setShowPass((open) => !open)}>
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              <p className="pf-pass-hint">{t('pf.passHint')}</p>
            </div>
            <div className="pf-field">
              <label htmlFor="pfPass2">{t('pf.password2')}</label>
              <input id="pfPass2" className="pf-pass" type={showPass ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </div>
            {note ? <p className="pf-note" data-type={note.type} role="status">{note.text}</p> : null}
            <div className="pf-actions">
              <button type="button" className="pf-btn pf-btn-ghost" onClick={cancelEdit} disabled={busy}>{t('pf.cancel')}</button>
              <button type="submit" className="pf-btn pf-btn-primary" disabled={busy}>{busy ? t('pf.saving') : t('pf.save')}</button>
            </div>
          </form>
        ) : (
          <>
            {note ? <p className="pf-note" data-type={note.type} role="status">{note.text}</p> : null}
            <div className="pf-actions">
              <button type="button" className="pf-btn pf-btn-primary" onClick={startEdit}>
                <i className="bi bi-pencil-fill"></i> {t('pf.edit')}
              </button>
              <button type="button" className="pf-btn pf-btn-danger" onClick={onLogout}>
                <i className="bi bi-box-arrow-right"></i> {t('pf.out')}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="pf-main">
        <section className="pf-card pf-wish-head">
          <div className="pf-wish-top">
            <div>
              <h2 className="pf-wish-title"><i className="bi bi-check-circle-fill"></i> {t('pf.visited')}</h2>
              <p className="pf-wish-sub">{t('pf.visitedSub')}</p>
            </div>
            {lists.visited.length > 0 ? <span className="pf-saved-pill">{t('pf.count', { n: lists.visited.length })}</span> : null}
          </div>
          <SavedList
            items={lists.visited}
            emptyIcon="bi-check-circle"
            emptyText={t('pf.visitedEmpty')}
            removeLabel={t('pf.removeVisit')}
            onRemove={(item) => onToggleSaved('visited', item)}
          />
        </section>
        <section className="pf-card pf-wish-head">
          <div className="pf-wish-top">
            <div>
              <h2 className="pf-wish-title"><i className="bi bi-bookmark-heart-fill"></i> {t('pf.wish')}</h2>
              <p className="pf-wish-sub">{t('pf.wishSub')}</p>
            </div>
            {lists.wishlist.length > 0 ? <span className="pf-saved-pill">{t('pf.count', { n: lists.wishlist.length })}</span> : null}
          </div>
          <SavedList
            items={lists.wishlist}
            emptyIcon="bi-bookmark"
            emptyText={t('pf.wishEmpty')}
            removeLabel={t('pf.removeWish')}
            onRemove={(item) => onToggleSaved('wishlist', item)}
          />
        </section>
      </div>
    </div>
  );
}
