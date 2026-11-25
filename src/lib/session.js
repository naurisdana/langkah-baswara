const KEY = 'lb_session';

export function loadSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '');
    const email = String(raw.email || '').trim();
    if (!email) return null;
    return {
      email,
      name: String(raw.name || '').trim(),
      photo: typeof raw.photo === 'string' ? raw.photo : '',
    };
  } catch {
    return null;
  }
}

export function saveSession(user) {
  if (!user?.email) return;
  const prev = loadSession();
  const incoming = typeof user.photo === 'string' ? user.photo : '';
  const photo = incoming && !incoming.startsWith('data:')
    ? incoming
    : (prev?.email === user.email ? prev.photo : '');
  localStorage.setItem(KEY, JSON.stringify({
    email: user.email,
    name: user.name || '',
    photo,
  }));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('lb_token');
}

function textField(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickUser(source) {
  if (!source || typeof source !== 'object') return {};
  const account = source.user && typeof source.user === 'object' ? source.user : {};
  const meta = account.user_metadata && typeof account.user_metadata === 'object' ? account.user_metadata : {};
  return {
    email: textField(source.email, account.email, meta.email),
    name: textField(source.name, source.nama, source.full_name, account.name, account.nama, account.full_name, meta.full_name, meta.name, meta.nama),
    photo: textField(source.foto, source.photo, source.avatar, account.foto, account.photo, meta.avatar_url, meta.foto, meta.photo),
  };
}

/** Ambil email, nama, dan foto dari GET /api/auth/me atau balasan login. */
export function userFromAuth(data, fallback = null) {
  const root = data && typeof data === 'object' ? data : {};
  const nested = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data : null;
  const fromRoot = pickUser(root);
  const fromNested = pickUser(nested);
  const email = textField(fromNested.email, fromRoot.email, fallback?.email);
  const name = textField(fromNested.name, fromRoot.name, fallback?.name);
  const photo = textField(fromNested.photo, fromRoot.photo, fallback?.photo);
  if (!email) return null;
  return { email, name: name || email.split('@')[0], photo };
}

/** Cadangan kalau /api/auth/me tidak mengirim email, selama token masih berlaku. */
export function userFromToken(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(padded))));
    const sub = typeof json.sub === 'string' && json.sub.includes('@') ? json.sub : '';
    return userFromAuth({
      email: json.email || json.user_metadata?.email || sub,
      name: json.name || json.nama || json.user_metadata?.full_name || json.user_metadata?.name || '',
    });
  } catch {
    return null;
  }
}
