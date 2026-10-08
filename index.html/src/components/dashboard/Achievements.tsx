import { Award, Flame, LockKeyhole, ShieldCheck, Swords, Trophy } from "lucide-react";
import type { calculateAchievements } from "@/lib/progression";

const ICONS = [ShieldCheck, Flame, Swords, Award, Trophy];

type Achievement = ReturnType<typeof calculateAchievements>[number];

export function Achievements({ achievements }: { achievements: Achievement[] }) {
  return (
    <section className="system-panel p-5 sm:p-6">
      <div className="section-heading"><div><p className="system-label">PROGRESSION ARCHIVE</p><h2>Achievements</h2></div><span>{achievements.filter((item) => item.unlocked).length}/{achievements.length} unlocked</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {achievements.map((achievement, index) => {
          const Icon = achievement.unlocked ? ICONS[index] : LockKeyhole;
          return <article key={achievement.id} className={achievement.unlocked ? "achievement-unlocked" : "achievement-locked"}>
            <Icon className="h-5 w-5 shrink-0" />
            <div><h3>{achievement.title}</h3><p>{achievement.detail}</p></div>
          </article>;
        })}
      </div>
    </section>
  );
}
