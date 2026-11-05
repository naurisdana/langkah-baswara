import { useEffect, useRef, useState } from 'react';

/** Splash awal. Bar merayap sampai data wisata siap, lalu menghilang. */
export default function Loader({ done }) {
  const barRef = useRef(null);
  const [phase, setPhase] = useState('show');

  useEffect(() => {
    let raf = 0;
    let hideTimer = 0;
    let goneTimer = 0;
    let p = 6;
    let target = 10;
    const started = performance.now();

    const frame = (now) => {
      const ready = done && now - started > 700;
      if (ready) target = 100;
      else target = Math.min(90, target + 0.18);
      p += (target - p) * (ready ? 0.18 : 0.06);
      if (barRef.current) {
        barRef.current.style.setProperty('--p', p.toFixed(2));
        barRef.current.setAttribute('aria-valuenow', String(Math.round(p)));
      }
      if (ready && p >= 99.4) {
        hideTimer = window.setTimeout(() => setPhase('hide'), 280);
        goneTimer = window.setTimeout(() => setPhase('gone'), 900);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
      window.clearTimeout(goneTimer);
    };
  }, [done]);

  if (phase === 'gone') return null;

  return (
    <div className={`lb-screen${phase === 'show' ? ' is-active' : ''}`} role="status" aria-live="polite" aria-label="Memuat Langkah Baswara">
      <div className="lb-deco lb-deco-tl"></div>
      <div className="lb-deco lb-deco-br"></div>
      <div className="lb-loader-box">
        <p className="lb-loader-text">
          Memuat Langkah Baswara
          <span className="lb-dots"><i>.</i><i>.</i><i>.</i></span>
        </p>
        <div ref={barRef} className="lb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div className="lb-bush"></div>
          <div className="lb-fill"><div className="lb-fill-shine"></div></div>
          <svg className="lb-flower" viewBox="0 0 46 46" aria-hidden="true">
            <g fill="#ffb703">
              <ellipse cx="23" cy="8" rx="6" ry="9" />
              <ellipse cx="23" cy="38" rx="6" ry="9" />
              <ellipse cx="8" cy="23" rx="9" ry="6" />
              <ellipse cx="38" cy="23" rx="9" ry="6" />
              <ellipse cx="12" cy="12" rx="6" ry="8" transform="rotate(-40 12 12)" />
              <ellipse cx="34" cy="12" rx="6" ry="8" transform="rotate(40 34 12)" />
              <ellipse cx="12" cy="34" rx="6" ry="8" transform="rotate(40 12 34)" />
              <ellipse cx="34" cy="34" rx="6" ry="8" transform="rotate(-40 34 34)" />
            </g>
            <circle cx="23" cy="23" r="6.5" fill="#fff4c2" />
          </svg>
          <svg className="lb-leaves" viewBox="0 0 54 28" aria-hidden="true">
            <ellipse cx="16" cy="16" rx="14" ry="7" fill="#458132" transform="rotate(-28 16 16)" />
            <ellipse cx="36" cy="13" rx="14" ry="7" fill="#7cb342" transform="rotate(22 36 13)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
