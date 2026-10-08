import { useEffect, useState } from "react";
import loadingArt from "@/assets/loading-art.jpg.asset.json";

export function LoadingScreen({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (ready) {
      setProgress(100);
      return;
    }

    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, Math.round((92 - current) / 7)), 92));
    }, 220);

    return () => window.clearInterval(progressTimer);
  }, [ready]);

  useEffect(() => {
    const delay = ready ? 850 : 8000;
    const exitTimer = window.setTimeout(() => setExiting(true), delay);
    const completeTimer = window.setTimeout(onComplete, delay + 520);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [ready, onComplete]);

  const particles = Array.from({ length: 16 }, (_, index) => index);

  return (
    <div className={`loading-screen${exiting ? " loading-screen-exit" : ""}`} role="status" aria-live="polite" aria-label="Preparing your journey">
      <div className="loading-atmosphere" aria-hidden>
        <span className="awakening-aura awakening-aura-main" />
        <span className="awakening-aura awakening-aura-high" />
      </div>
      <div className="loading-rays" aria-hidden />
      <div className="awakening-sparks" aria-hidden><span /><span /><span /><span /></div>
      <div className="loading-particles" aria-hidden>
        {particles.map((particle) => <span key={particle} />)}
      </div>
      <img className="loading-art" src={loadingArt.url} alt="" aria-hidden />
      <div className="loading-mist loading-mist-left" aria-hidden />
      <div className="loading-mist loading-mist-right" aria-hidden />
      <div className="loading-copy">
        <div className="loading-brand">
          <h1>BETTER THAN <span>YESTERDAY</span></h1>
          <p>LEVEL UP YOUR LIFE</p>
        </div>
        <div className="loading-status">
          <div><span>SYSTEM INITIALIZING<span className="loading-dots" aria-hidden>...</span></span><strong>{progress}%</strong></div>
          <div className="loading-track" aria-hidden><span style={{ width: `${progress}%` }} /></div>
        </div>
        <p className="loading-sync">Synchronizing your daily progress</p>
      </div>
      <div className="loading-vignette" aria-hidden />
    </div>
  );
}
