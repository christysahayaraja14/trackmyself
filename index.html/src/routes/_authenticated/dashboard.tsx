import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Flame, LogOut, Plus, Star, Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysInMonth, toDateKey, useHabitMutations, useHabits, useLogs, useProfile, type Habit } from "@/lib/habits";
import { calculateAchievements, calculateLevel, calculateStreak, calculateTodayProgress, calculateTotalScore } from "@/lib/progression";
import { disablePushSubscription, startLocalReminderScheduler } from "@/lib/reminders";
import { HabitEditor } from "@/components/dashboard/HabitEditor";
import { HabitList } from "@/components/dashboard/HabitList";
import { MonthGrid } from "@/components/dashboard/MonthGrid";
import { Analytics } from "@/components/dashboard/Analytics";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { LoadingScreen } from "@/components/dashboard/LoadingScreen";
import { Achievements } from "@/components/dashboard/Achievements";
import { DeleteHabitDialog } from "@/components/dashboard/DeleteHabitDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Hunter Dashboard — Better Than Yesterday" },
    { name: "description", content: "Track daily quests, Total Score, levels, streaks, reminders and real progress." },
    { property: "og:title", content: "Hunter Dashboard — Better Than Yesterday" },
    { property: "og:description", content: "A personal progression system powered by consistent daily action." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Habit | "new" | null>(null); const [deleting, setDeleting] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true); const [questComplete, setQuestComplete] = useState(false);
  const finishLoading = useCallback(() => setLoading(false), []);
  const today = new Date(); const todayKey = toDateKey(today); const monthStart = new Date(today.getFullYear(), today.getMonth(), 1); const monthEnd = new Date(today.getFullYear(), today.getMonth(), daysInMonth(today.getFullYear(), today.getMonth()));
  const { data: profile, isLoading: profileLoading } = useProfile(); const { data: habits = [], isLoading: habitsLoading } = useHabits(); const { data: logs = [], isLoading: logsLoading } = useLogs(); const { saveHabit, deleteHabit, setLog } = useHabitMutations();
  const currentHabits = useMemo(() => habits.filter((habit) => !habit.deleted_at), [habits]);
  const activeHabits = useMemo(() => currentHabits.filter((habit) => !habit.archived), [currentHabits]);
  const monthLogs = useMemo(() => logs.filter((log) => log.log_date >= toDateKey(monthStart) && log.log_date <= toDateKey(monthEnd)), [logs, monthStart, monthEnd]);
  const todayLogs = useMemo(() => logs.filter((log) => log.log_date === todayKey), [logs, todayKey]);
  const totalScore = useMemo(() => calculateTotalScore(logs), [logs]); const level = useMemo(() => calculateLevel(totalScore), [totalScore]);
  const streak = useMemo(() => calculateStreak(habits, logs, todayKey), [habits, logs, todayKey]); const todayProgress = useMemo(() => calculateTodayProgress(activeHabits, logs, todayKey), [activeHabits, logs, todayKey]);
  const achievements = useMemo(() => calculateAchievements(totalScore, streak, logs), [totalScore, streak, logs]);
  useEffect(() => startLocalReminderScheduler(activeHabits), [activeHabits]);
  // Stop pushing to this device once no habit has a reminder any more.
  useEffect(() => { if (!habitsLoading && !activeHabits.some((habit) => habit.reminder_enabled)) void disablePushSubscription(); }, [activeHabits, habitsLoading]);
  // Notification "Mark done" button opens /dashboard?habit=<id>&action=done
  useEffect(() => {
    if (loading || habitsLoading) return;
    const params = new URLSearchParams(window.location.search);
    const habitId = params.get("habit"); const action = params.get("action");
    if (!habitId) return;
    if (action === "done" && activeHabits.some((habit) => habit.id === habitId)) setLog.mutate({ habitId, date: todayKey, status: "completed" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [loading, habitsLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (todayProgress.allComplete) { setQuestComplete(true); const timer = window.setTimeout(() => setQuestComplete(false), 3600); return () => window.clearTimeout(timer); } }, [todayProgress.allComplete]);
  async function signOut() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/", replace: true }); }
  if (loading) return <LoadingScreen ready={!profileLoading && !habitsLoading && !logsLoading} onComplete={finishLoading} />;

  return <div className="dashboard-shell">
    {questComplete && <div className="quest-toast" role="status"><p>QUEST COMPLETE</p><strong>TOTAL SCORE INCREASED</strong><span>STREAK MAINTAINED · ARISE.</span></div>}
    <header className="app-header"><div className="brand-lockup"><div className="brand-mark">BTY</div><div className="min-w-0"><p>BETTER THAN YESTERDAY</p><span>PERSONAL PROGRESSION SYSTEM</span></div></div><Button variant="ghost" onClick={signOut}><LogOut/> <span className="hidden sm:inline">Sign out</span></Button></header>
    <main className="dashboard-main">
      <WelcomeCard name={profile?.full_name?.split(" ")[0] ?? "Hunter"} score={todayProgress.percentage} totalScore={totalScore} level={level.level} />
      <section className="stats-grid"><Stat icon={Star} label="Current level" value={`LEVEL ${String(level.level).padStart(2,"0")}`} tone="cyan"/><Stat icon={Trophy} label="Total score" value={totalScore.toLocaleString()} tone="purple"/><Stat icon={Flame} label="Current streak" value={`${streak.current} DAYS`} tone="orange"/><Stat icon={Target} label="Today's progress" value={`${todayProgress.completed} / ${todayProgress.total}`} tone="emerald"/></section>
      <section className="system-panel p-5 sm:p-6"><div className="section-heading"><div><p className="system-label">DAILY QUEST</p><h2>Today's quests</h2><span>{todayProgress.completed} of {todayProgress.total} missions complete</span></div><Button className="btn-neon" onClick={() => setEditing("new")}><Plus/>Create habit</Button></div><HabitList habits={activeHabits} logs={todayLogs} loading={habitsLoading} onToggle={(habitId,status) => setLog.mutate({ habitId, date: todayKey, status })} onNote={(habitId,note,status) => setLog.mutate({ habitId, date: todayKey, status: status ?? "partial", note })} onEdit={setEditing} onDelete={setDeleting}/></section>
      <MonthGrid habits={activeHabits} logs={monthLogs} year={today.getFullYear()} month={today.getMonth()} onToggle={(habitId,date,status) => setLog.mutate({ habitId,date,status })}/>
      <Achievements achievements={achievements}/>
      <Analytics habits={activeHabits} logs={logs} monthLogs={monthLogs}/>
      {currentHabits.some((habit) => habit.archived) && <section className="system-panel p-5"><p className="system-label mb-3">ARCHIVED QUESTS</p><div className="flex flex-wrap gap-2">{currentHabits.filter((habit) => habit.archived).map((habit) => <Button key={habit.id} variant="outline" onClick={() => saveHabit.mutate({ ...habit, archived: false })}>{habit.emoji} {habit.name} · restore</Button>)}</div></section>}
    </main>
    {editing && <HabitEditor habit={editing === "new" ? null : editing} nextOrder={activeHabits.length} onClose={() => setEditing(null)} onSave={(values) => { saveHabit.mutate(values); setEditing(null); }} onDelete={(habit) => { setEditing(null); setDeleting(habit); }}/>}<DeleteHabitDialog habit={deleting} onCancel={() => setDeleting(null)} onConfirm={(habit) => { deleteHabit.mutate(habit.id); setDeleting(null); }}/>
  </div>;
}
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Bell; label: string; value: string; tone: string }) { return <article className="stat-tile"><div className="stat-icon" data-tone={tone}><Icon/></div><div className="min-w-0"><p>{label}</p><strong className="truncate">{value}</strong></div></article>; }
