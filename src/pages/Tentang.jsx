import { useEffect, useRef, useState } from 'react';
import About from '../components/About.jsx';
import FeatureWheel from '../components/FeatureWheel.jsx';
import Testimonials from '../components/Testimonials.jsx';
import LottiePlayer from '../components/LottiePlayer.jsx';
import { useI18n } from '../lib/i18n.jsx';

const loadAboutHero = () => import('../assets/animation/aboutpage_landingpage_revisi.json');

// Animasi muncul saat di-scroll: .about-reveal -> tambah .is-visible (CSS: .about-js .about-reveal)
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.15 }
    );
    root.querySelectorAll('.about-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

export default function Tentang({ onExplore, onReady }) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const [heroReady, setHeroReady] = useState(false);
  useReveal(rootRef);
  useEffect(() => { onReady?.(); }, [onReady]);

  return (
    <div className="about-wrap about-js" ref={rootRef}>
      <div className={`about-hero${heroReady ? ' is-animated' : ''}`}>
        <LottiePlayer load={loadAboutHero} width={1920} height={1080} onReady={() => setHeroReady(true)} />
        <div className="about-hero-inner">
          <h1 className="about-hero-title">
            {t('ab.hero1')} <strong>{t('ab.hero2')}</strong>
          </h1>
          <p className="about-hero-tagline">
            {t('ab.tag')} <strong>{t('ab.tagb')}</strong>
          </p>
        </div>
      </div>

      <About onExplore={onExplore} variant="about" />
      <FeatureWheel />

      <div className="about-cta">
        <div className="about-cta-inner about-reveal">
          <h2 className="about-cta-title">
            <strong>{t('ab.ready')}</strong> {t('ab.start')}
            <span className="highlight-oval-yellow"> {t('ab.dream')}<br />{t('ab.dream2')}</span>
            {' '}{t('ab.in')} <strong>{t('ab.bali')}</strong>
          </h2>
          <p className="about-cta-desc">
            {t('ab.ctaD')}
          </p>
          <button type="button" className="btn btn-green-pill" onClick={onExplore}>
            {t('about.cta')}
          </button>
        </div>
      </div>

      <Testimonials />
    </div>
  );
}