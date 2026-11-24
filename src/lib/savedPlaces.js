const empty = () => ({ wishlist: [], visited: [] });

const keyFor = (email) => `lb_saved:${String(email || '').trim().toLowerCase()}`;

export function loadSaved(email) {
  if (!email) return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(email)) || '');
    return {
      wishlist: Array.isArray(raw.wishlist) ? raw.wishlist : [],
      visited: Array.isArray(raw.visited) ? raw.visited : [],
    };
  } catch {
    return empty();
  }
}

export function saveSaved(email, data) {
  if (!email) return;
  localStorage.setItem(keyFor(email), JSON.stringify({
    wishlist: data.wishlist || [],
    visited: data.visited || [],
  }));
}

export function placeSnapshot(dest) {
  const img = (Array.isArray(dest.img) ? dest.img : [dest.img]).filter(Boolean);
  return {
    key: String(dest.key),
    title: dest.title,
    rating: dest.rating,
    img,
    blurb: dest.blurb || '',
  };
}

export function togglePlace(list, place) {
  const items = Array.isArray(list) ? list : [];
  if (items.some((item) => item.key === place.key)) {
    return items.filter((item) => item.key !== place.key);
  }
  return [place, ...items];
}
