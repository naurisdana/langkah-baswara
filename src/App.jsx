import { useCallback, useState } from 'react';
import { PAGE_IDS } from './data/pageConfig.js';
import useWisata from './lib/useWisata.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import AuthModal from './components/AuthModal.jsx';
import Beranda from './pages/Beranda.jsx';
import Jelajahi from './pages/Jelajahi.jsx';
import Tentang from './pages/Tentang.jsx';
import Profil from './pages/Profil.jsx';

export default function App() {
  const [activePage, setActivePage] = useState('beranda'); // 'beranda' | 'tentang' | 'jelajahi' | 'profil'
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState('');   // kata kunci dari pencarian Hero
  const [focus, setFocus] = useState(null); // destinasi dari tombol "Buka di Peta"
  const { places, error } = useWisata();  

  // Satu-satunya pintu perpindahan halaman (dipakai Navbar, Hero, kartu, Footer)
  const goTo = useCallback(
    (id) => {
      if (!PAGE_IDS.includes(id)) return;
      if (id === 'profil' && !user) {
        setAuthOpen(true); // Profil butuh login
        return;
      }
      setActivePage(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user],
  );

  const handleAuthClick = () => (user ? goTo('profil') : setAuthOpen(true));

  const handleLogout = () => {
    localStorage.removeItem('lb_token');
    setUser(null);
    setActivePage('beranda');
    window.scrollTo({ top: 0 });
  };

  let page = null;
  if (activePage === 'beranda') {
    page = (
      <Beranda
        user={user}
        onNeedLogin={() => setAuthOpen(true)}
        onExplore={() => goTo('jelajahi')}
        onSearch={(q) => { setQuery(q); setFocus(null); goTo('jelajahi'); }}
        onOpenMap={(dest) => { setQuery(''); setFocus({ ...dest }); goTo('jelajahi'); }}
      />
    );
  } else if (activePage === 'tentang') {
    page = <Tentang onExplore={() => goTo('jelajahi')} />;
  } else if (activePage === 'jelajahi') {
    page = (
      <Jelajahi
        places={places}
        error={error}
        query={query}
        focus={focus}
        user={user}
        onNeedLogin={() => setAuthOpen(true)}
        onOpenMap={(dest) => { setQuery(''); setFocus({ ...dest }); }}
      />
    );
  } else if (activePage === 'profil' && user) {
    page = <Profil user={user} onLogout={handleLogout} />;
  }

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onLoggedIn={(u) => { setUser(u); setAuthOpen(false); }} />

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