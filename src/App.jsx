import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_IDS } from './data/pageConfig.js';
import useWisata from './lib/useWisata.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import AuthModal from './components/AuthModal.jsx';
import Beranda from './pages/Beranda.jsx';
import Jelajahi from './pages/Jelajahi.jsx';
import Tentang from './pages/Tentang.jsx';
import Profil from './pages/Profil.jsx';
import Loader from './components/Loader.jsx';
import { loadSaved, placeSnapshot, saveSaved, togglePlace } from './lib/savedPlaces.js';
import { saveProfile, withProfile } from './lib/profile.js';

export default function App() {
  const [activePage, setActivePage] = useState('beranda'); // 'beranda' | 'tentang' | 'jelajahi' | 'profil'
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState({ wishlist: [], visited: [] });
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState('');   // kata kunci dari pencarian Hero
  const [focus, setFocus] = useState(null); // destinasi dari tombol "Buka di Peta"
  const [visit, setVisit] = useState(0);
  const [pageReady, setPageReady] = useState(false);
  const { places, error, loading } = useWisata();
  const pageRef = useRef(activePage);

  useEffect(() => {
    setSaved(user?.email ? loadSaved(user.email) : { wishlist: [], visited: [] });
  }, [user?.email]);

  const toggleSaved = useCallback((kind, dest) => {
    if (!user?.email || (kind !== 'wishlist' && kind !== 'visited')) return;
    setSaved((current) => {
      const next = { ...current, [kind]: togglePlace(current[kind], placeSnapshot(dest)) };
      saveSaved(user.email, next);
      return next;
    });
  }, [user]);
  const updateUser = useCallback((patch) => {
    setUser((current) => {
      if (!current?.email) return current;
      const next = { ...current, ...patch };
      saveProfile(current.email, next);
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
    localStorage.removeItem('lb_token');
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
        places={places}
        error={error}
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
      <Loader key={visit} done={!loading && pageReady} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onLoggedIn={(u) => { setUser(withProfile(u)); setAuthOpen(false); }} />

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