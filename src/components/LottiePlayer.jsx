import { useEffect, useRef } from 'react';

/**
 * Latar atau ilustrasi Lottie.
 * Gambar statis di belakangnya tetap tampil sampai animasi siap.
 * Berulang seperti hero, dan diam di frame akhir bila gerak dikurangi.
 */
export default function LottiePlayer({ load, width, height, fit = 'cover', lazy = false, onReady }) {
  const stageRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let anim;
    let observer;
    let cancelled = false;
    let started = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const start = async () => {
      const [{ default: lottie }, mod] = await Promise.all([
        import('lottie-web'),
        load(),
      ]);
      if (cancelled || stageRef.current !== stage) return;
      anim = lottie.loadAnimation({
        container: stage,
        renderer: 'svg',
        loop: !reduce,
        autoplay: false,
        animationData: mod.default,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
          progressiveLoad: true,
        },
      });
      anim.addEventListener('DOMLoaded', () => {
        if (cancelled) return;
        if (reduce) anim.goToAndStop(Math.max(0, anim.totalFrames - 1), true);
        else if (stage.getBoundingClientRect().bottom > 0 && stage.getBoundingClientRect().top < window.innerHeight) {
          anim.play();
        }
        onReadyRef.current?.();
      });
    };

    const watch = (root) => {
      observer = new IntersectionObserver((entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && !started) {
          started = true;
          start();
          return;
        }
        if (!anim || reduce) return;
        if (visible) anim.play();
        else anim.pause();
      }, { rootMargin: '240px' });
      observer.observe(root);
    };

    if (lazy) watch(stage.parentElement || stage);
    else {
      started = true;
      start();
      watch(stage.parentElement || stage);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      anim?.destroy();
    };
  }, [lazy, load]);

  return (
    <div
      className={`lb-anim${fit === 'contain' ? ' is-contain' : ''}`}
      style={{ '--lb-w': width, '--lb-h': height }}
      aria-hidden="true"
    >
      <div className="lb-anim-stage" ref={stageRef} />
    </div>
  );
}
