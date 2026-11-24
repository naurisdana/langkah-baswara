const keyFor = (email) => `lb_profile:${String(email || '').trim().toLowerCase()}`;

export function loadProfile(email) {
  if (!email) return { name: '', photo: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(email)) || '');
    const photo = typeof raw.photo === 'string' && raw.photo.startsWith('data:image/') ? raw.photo : '';
    return { name: String(raw.name || '').trim(), photo };
  } catch {
    return { name: '', photo: '' };
  }
}

export function saveProfile(email, profile) {
  if (!email) return;
  localStorage.setItem(keyFor(email), JSON.stringify({
    name: String(profile?.name || '').trim(),
    photo: typeof profile?.photo === 'string' && profile.photo.startsWith('data:image/') ? profile.photo : '',
  }));
}

export function withProfile(user) {
  if (!user?.email) return user;
  const extra = loadProfile(user.email);
  return {
    ...user,
    name: extra.name || user.name,
    photo: extra.photo || user.photo || '',
  };
}
