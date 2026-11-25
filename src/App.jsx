import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_IDS } from './data/pageConfig.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import AuthModal from './components/AuthModal.jsx';
import Beranda from './pages/Beranda.jsx';
import Jelajahi from './pages/Jelajahi.jsx';
import Tentang from './pages/Tentang.jsx';
import Profil from './pages/Profil.jsx';
import Loader from './components/Loader.jsx';
import { cardsFromSavedPayload, loadSaved, placeSnapshot, saveSaved } from './lib/savedPlaces.js';
import { saveProfile, withProfile } from './lib/profile.js';
import { clearSession, loadSession, saveSession, userFromAuth, userFromToken } from './lib/session.js';
import { authLogout, authMe, changeSaved, fetchSavedList } from './lib/api.js';

const emptySaved = () => ({ wishlist: [], visited: [] });

export default function App() {
  const [activePage, setActivePage] = useState('beranda'); // 'beranda' | 'tentang' | 'jelajahi' | 'profil'
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('lb_token');
    if (!token) return null;
    const session = loadSession() || userFromToken(token);
    return session ? withProfile(session) : null;
  });
  const [saved, setSaved] = useState({ wishlist: [], visited: [] });
  const savedRef = useRef(saved);
  const savedGen = useRef(0);
  savedRef.current = saved;
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState('');   // kata kunci dari pencarian Hero
  const [focus, setFocus] = useState(null); // destinasi dari tombol "Buka di Peta"
  const [visit, setVisit] = useState(0);
  const [pageReady, setPageReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const pageRef = useRef(activePage);

  useEffect(() => {
    const token = localStorage.getItem('lb_token');
    if (!token) {
      setSessionOk(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      const r = await authMe(token);
      if (!alive || localStorage.getItem('lb_token') !== token) return;
      if (r.status === 401 || r.status === 403) {
        clearSession();
        setUser(null);
        setSessionOk(false);
        return;
      }
      if (!r.ok) return;
      const next = userFromAuth(r.data, loadSession() || userFromToken(token));
      if (!next?.email) return;
      const merged = withProfile(next);
      saveSession(merged);
      setUser(merged);
      setSessionOk(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const email = user?.email;
    const token = localStorage.getItem('lb_token');
    if (!email || !token) {
      setSaved(emptySaved());
      return undefined;
    }
    const genAtStart = savedGen.current;
    let alive = true;
    const local = loadSaved(email);
    setSaved(local);
    if (!sessionOk) return () => { alive = false; };
    (async () => {
      const [wish, visit] = await Promise.all([
        fetchSavedList('wishlist', token),
        fetchSavedList('visited', token),
      ]);
      if (!alive || genAtStart !== savedGen.current) return;
      if (!wish.ok || !visit.ok) return;
      const wishlist = await cardsFromSavedPayload(wish.data);
      const visited = await cardsFromSavedPayload(visit.data);
      if (!alive || wishlist == null || visited == null || genAtStart !== savedGen.current) return;
      const wishIds = new Set(wishlist.map((item) => item.key));
      const visitIds = new Set(visited.map((item) => item.key));
      const hasId = (item) => /^\d+$/.test(String(item?.key ?? item?.id ?? ''));
      const missingWish = local.wishlist.filter((item) => hasId(item) && !wishIds.has(String(item.key)));
      const missingVisit = local.visited.filter((item) => hasId(item) && !visitIds.has(String(item.key)));
      await Promise.all([
        ...missingWish.map((item) => changeSaved('wishlist', token, Number(item.key), false)),
        ...missingVisit.map((item) => changeSaved('visited', token, Number(item.key), false)),
      ]);
      if (!alive || genAtStart !== savedGen.current) return;
      const next = {
        wishlist: [...missingWish.map((item) => placeSnapshot(item)), ...wishlist.filter((item) => !missingWish.some((localItem) => localItem.key === item.key))],
        visited: [...missingVisit.map((item) => placeSnapshot(item)), ...visited.filter((item) => !missingVisit.some((localItem) => localItem.key === item.key))],
      };
      saveSaved(email, next);
      setSaved(next);
    })();
    return () => { alive = false; };
  }, [user?.email, sessionOk]);

  const toggleSaved = useCallback((kind, dest) => {
    const email = user?.email;
    const token = localStorage.getItem('lb_token');
    const id = Number(dest?.id ?? dest?.key);
    if (!email || !token) {
      setAuthOpen(true);
      return;
    }
    if ((kind !== 'wishlist' && kind !== 'visited') || !Number.isInteger(id)) return;
    const current = savedRef.current;
    const list = current[kind] || [];
    const on = list.some((item) => item.key === String(id));
    const snapshot = placeSnapshot({ ...dest, id, key: String(id) });
    const next = {
      ...current,
      [kind]: on ? list.filter((item) => item.key !== String(id)) : [snapshot, ...list],
    };
    savedRef.current = next;
    saveSaved(email, next);
    setSaved(next);
    savedGen.current += 1;
    const gen = savedGen.current;
    changeSaved(kind, token, id, on).then((r) => {
      if (r.ok || r.status === 409 || (on && r.status === 404)) return;
      if (savedGen.current !== gen) return;
      const reverted = { ...savedRef.current, [kind]: list };
      savedRef.current = reverted;
      saveSaved(email, reverted);
      setSaved(reverted);
    });
  }, [user]);
  const updateUser = useCallback((patch) => {
    setUser((current) => {
      if (!current?.email) return current;
      const next = { ...current, ...patch };
      saveProfile(current.email, next);
      saveSession(next);
      return next;
    });
  }, []);
  const markPageReady = useCallback(() => setPageReady(true), []);

  const beginVisit = useCallback((id) => {
    if (pageRef.current !== id) {
      setPageReady(false);
      setVisit((n) => n + 1);
    }
    pageRef.current = id;
    setActivePage(id);
  }, []);

  // Satu-satunya pintu perpindahan halaman (dipakai Navbar, Hero, kartu, Footer)
  const goTo = useCallback(
    (id) => {
      if (!PAGE_IDS.includes(id)) return;
      if (id === 'profil' && !user) {
        setAuthOpen(true); // Profil butuh login
        return;
      }
      beginVisit(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user, beginVisit],
  );

  const handleAuthClick = () => (user ? goTo('profil') : setAuthOpen(true));

  const handleLogout = () => {
    const token = localStorage.getItem('lb_token');
    if (token) authLogout(token);
    clearSession();
    setSessionOk(false);
    setUser(null);
    beginVisit('beranda');
    window.scrollTo({ top: 0 });
  };

  let page = null;
  if (activePage === 'beranda') {
    page = (
      <Beranda
        user={user}
        saved={saved}
        onToggleSaved={toggleSaved}
        onNeedLogin={() => setAuthOpen(true)}
        onExplore={() => goTo('jelajahi')}
        onReady={markPageReady}
        onOpenMap={(dest) => { setQuery(''); setFocus({ ...dest }); goTo('jelajahi'); }}
      />
    );
  } else if (activePage === 'tentang') {
    page = <Tentang onExplore={() => goTo('jelajahi')} onReady={markPageReady} />;
  } else if (activePage === 'jelajahi') {
    page = (
      <Jelajahi
        query={query}
        focus={focus}
        onReady={markPageReady}
        user={user}
        onNeedLogin={() => setAuthOpen(true)}
        onOpenMap={(dest) => { setQuery(''); setFocus({ ...dest }); }}
      />
    );
  } else if (activePage === 'profil' && user) {
    page = (
      <Profil
        user={user}
        saved={saved}
        onToggleSaved={toggleSaved}
        onLogout={handleLogout}
        onUpdateUser={updateUser}
        onReady={markPageReady}
      />
    );
  }

  return (
    <>
      <Loader key={visit} done={pageReady} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onLoggedIn={(u) => {
        const next = withProfile(u);
        saveSession(next);
        setSessionOk(true);
        setUser(next);
        setAuthOpen(false);
      }} />

      <Navbar activePage={activePage} onSelect={goTo} user={user} onAuthClick={handleAuthClick} />

      <main className="page-wrap">
        {/* id "sec-<halaman>" dipertahankan karena index.css memakai #sec-jelajahi, #sec-profil, dst. */}
        <section key={activePage} id={`sec-${activePage}`} className="content-section">
          {page}
        </section>
      </main>

      <Footer onNavigate={goTo} />
    </>
  );
}