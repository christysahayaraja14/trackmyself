import type { Habit, HabitLog } from "@/lib/habits";

const DAY_MS = 86_400_000;

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function calculateTotalScore(logs: HabitLog[]) {
  return logs.reduce((total, log) => total + (log.status === "completed" ? log.score_awarded : 0), 0);
}

export function levelThreshold(level: number) {
  return 100 * Math.max(0, level - 1) ** 2;
}

export function calculateLevel(totalScore: number) {
  const safeScore = Math.max(0, totalScore);
  const level = Math.floor(Math.sqrt(safeScore / 100)) + 1;
  const currentThreshold = levelThreshold(level);
  const nextThreshold = levelThreshold(level + 1);
  const progress = Math.min(100, Math.max(0, ((safeScore - currentThreshold) / (nextThreshold - currentThreshold)) * 100));
  return {
    level,
    currentThreshold,
    nextThreshold,
    pointsToNext: nextThreshold - safeScore,
    progress,
  };
}

function applicableHabits(habits: Habit[], dateKey: string) {
  return habits.filter((habit) => habit.active_from <= dateKey && (!habit.deleted_at || habit.deleted_at.slice(0, 10) > dateKey));
}

function isCompleteDay(dateKey: string, habits: Habit[], logs: HabitLog[]) {
  const expected = applicableHabits(habits, dateKey);
  if (expected.length === 0) return false;
  const completed = new Set(
    logs.filter((log) => log.log_date === dateKey && log.status === "completed").map((log) => log.habit_id),
  );
  return expected.every((habit) => completed.has(habit.id));
}

export function calculateStreak(habits: Habit[], logs: HabitLog[], todayKey = toDateKey(new Date())) {
  const start = dateFromKey(todayKey);
  if (!isCompleteDay(todayKey, habits, logs)) start.setDate(start.getDate() - 1);

  let current = 0;
  const cursor = new Date(start);
  for (let i = 0; i < 3660; i++) {
    const key = toDateKey(cursor);
    if (!isCompleteDay(key, habits, logs)) break;
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const completedDates = [...new Set(logs.map((log) => log.log_date))]
    .filter((date) => isCompleteDay(date, habits, logs))
    .sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  completedDates.forEach((key) => {
    const currentDate = dateFromKey(key);
    run = previous && Math.round((currentDate.getTime() - previous.getTime()) / DAY_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = currentDate;
  });
  return { current, longest: Math.max(longest, current) };
}

export function calculateTodayProgress(habits: Habit[], logs: HabitLog[], todayKey = toDateKey(new Date())) {
  const applicable = applicableHabits(habits, todayKey).filter((habit) => !habit.archived && !habit.deleted_at);
  const completedIds = new Set(
    logs.filter((log) => log.log_date === todayKey && log.status === "completed").map((log) => log.habit_id),
  );
  const completed = applicable.filter((habit) => completedIds.has(habit.id)).length;
  return { completed, total: applicable.length, percentage: applicable.length ? Math.round((completed / applicable.length) * 100) : 0, allComplete: applicable.length > 0 && completed === applicable.length };
}

export function calculateAchievements(totalScore: number, streak: { current: number; longest: number }, logs: HabitLog[]) {
  const completed = logs.filter((log) => log.status === "completed").length;
  const level = calculateLevel(totalScore).level;
  return [
    { id: "first", title: "First Step", detail: "Complete your first daily quest.", unlocked: completed >= 1 },
    { id: "warrior", title: "7 Day Warrior", detail: "Maintain a seven-day streak.", unlocked: streak.longest >= 7 },
    { id: "discipline", title: "30 Day Discipline", detail: "Maintain a thirty-day streak.", unlocked: streak.longest >= 30 },
    { id: "level", title: "Level Up", detail: "Reach level two.", unlocked: level >= 2 },
    { id: "master", title: "Consistency Master", detail: "Complete one hundred quests.", unlocked: completed >= 100 },
  ];
}
