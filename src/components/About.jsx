import { useState } from 'react';
import LottiePlayer from './LottiePlayer.jsx';
import { useI18n } from '../lib/i18n.jsx';

const loadLanding = () => import('../assets/animation/landingpage_bagian1_langkahbaswara.json');
const loadAbout = () => import('../assets/animation/aboutpage_bagian1.json');

export default function About({ onExplore, variant = 'landing' }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const aboutArt = variant === 'about';

  return (
    <div className="container">
      <div className="about-landing-section">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-6">
            <div className="about-header-group mb-3">
              <h2 className="about-section-title">
                <span className="about-title-regular">{t('about.kicker')}</span>
                <strong className="about-title-bold">{t('about.name')}</strong>
              </h2>
            </div>
            <p className="about-description mb-4">
              {t('about.body')}
            </p>
            <button type="button" className="btn btn-green-pill" onClick={onExplore}>
              {t('about.cta')}
            </button>
          </div>
          <div className="col-lg-6 text-center">
            <div className={`about-art${aboutArt ? ' is-about' : ''}${ready ? ' is-animated' : ''}`}>
              <img
                src={aboutArt ? '/assets/aboutpage2.png' : '/assets/landingpage2.png'}
                alt={t('about.alt')}
                className="img-fluid about-hero-img"
              />
              <LottiePlayer
                lazy
                load={aboutArt ? loadAbout : loadLanding}
                width={1920}
                height={1080}
                fit="contain"
                onReady={() => setReady(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}