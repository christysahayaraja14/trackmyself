import { useEffect, useState } from "react";
import { calculateLevel } from "@/lib/progression";

export function WelcomeCard({ name, score, totalScore, level }: { name: string; score: number; totalScore: number; level: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = window.setInterval(() => setNow(new Date()), 1_000); return () => clearInterval(id); }, []);
  const progress = calculateLevel(totalScore);
  return <section className="status-banner"><div className="status-copy"><p className="system-label">HUNTER STATUS // {now?.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase() ?? "SYNCING"}</p><h1>Rise, <span>{name}</span>.</h1><p>Don't become perfect. Become better than yesterday.</p><div className="live-clock"><strong>{now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--:--:-- --"}</strong><span>{now ? now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Syncing…"}</span></div></div><div className="level-core"><small>LEVEL</small><strong>{String(level).padStart(2, "0")}</strong></div><div className="level-progress"><div><span>NEXT LEVEL</span><b>{progress.pointsToNext.toLocaleString()} points</b></div><div className="progress-track"><span style={{ width: `${progress.progress}%` }} /></div><p>{totalScore.toLocaleString()} total score · {score}% today</p></div></section>;
}
