import { useState } from 'react';
import LottiePlayer from './LottiePlayer.jsx';

const loadLanding = () => import('../assets/animation/landingpage_bagian1_langkahbaswara.json');
const loadAbout = () => import('../assets/animation/aboutpage_bagian1.json');

export default function About({ onExplore, variant = 'landing' }) {
  const [ready, setReady] = useState(false);
  const aboutArt = variant === 'about';

  return (
    <div className="container">
      <div className="about-landing-section">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-6">
            <div className="about-header-group mb-3">
              <h2 className="about-section-title">
                <span className="about-title-regular">Apa itu</span>
                <strong className="about-title-bold">Langkah Baswara?</strong>
              </h2>
            </div>
            <p className="about-description mb-4">
              Langkah Baswara hadir sebagai sistem informasi geografis (Web-GIS) interaktif yang dirancang untuk membantu kamu merencanakan liburan. Dengan dukungan visualisasi peta interaktif, analisis radius lokasi, hingga sistem rekomandasi dan optimasi rute pintar, kamu bisa menikmati perjalanan liburan yang lebih efektif, hemat waktu, dan sesuai preferensi kamu.
            </p>
            <button type="button" className="btn btn-green-pill" onClick={onExplore}>
              Jelajahi Sekarang
            </button>
          </div>
          <div className="col-lg-6 text-center">
            <div className={`about-art${aboutArt ? ' is-about' : ''}${ready ? ' is-animated' : ''}`}>
              <img
                src={aboutArt ? '/assets/aboutpage2.png' : '/assets/landingpage2.png'}
                alt="Ilustrasi Apa itu Langkah Baswara"
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