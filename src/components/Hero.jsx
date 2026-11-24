import { useState } from 'react';
import LottiePlayer from './LottiePlayer.jsx';
import { useI18n } from '../lib/i18n.jsx';

const loadHero = () => import('../assets/animation/landingpage_langkahbaswara.json');

export default function Hero({ onExplore, onSearch }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [ready, setReady] = useState(false);

  return (
    <div className={`hero-landing${ready ? ' is-animated' : ''}`}>
      <LottiePlayer load={loadHero} width={1920} height={1203} onReady={() => setReady(true)} />
      <div className="container hero-inner">
        <div className="hero-content-left">
          <h1 className="hero-title">
            {t('hero.l1')}<br />
            <span className="hero-nowrap">{t('hero.l2')}</span>
          </h1>
          <p className="hero-tagline">
            {t('hero.tag')}
          </p>
          <button type="button" className="btn-hero-explore" onClick={onExplore}>
            {t('hero.cta')}
          </button>
        </div>
        <div className="hero-search-wrapper">
          <form
            className="hero-search-box"
            id="heroSearchForm"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(q.trim());
            }}
          >
            <input
              type="text"
              id="heroSearchInput"
              className="hero-search-input"
              placeholder={t('hero.ph')}
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="hero-search-btn" aria-label={t('hero.find')}>
              <i className="bi bi-search"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}