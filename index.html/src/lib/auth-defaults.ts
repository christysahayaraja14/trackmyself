import { z } from "zod";

export const USER_ID_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  username: z.string().trim().min(2).max(40),
  userId: z.string().trim().regex(USER_ID_RE),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
});

export const internalEmailFor = (userId: string) =>
  `${userId.trim().toLowerCase()}@id.upgradetracker.app`;

export const DEFAULT_HABITS = [
  { name: "Wake up at 5:00 AM", emoji: "🌅", color: "orange", category: "Morning", target_unit: "time", target_value: 1, difficulty: "hard", priority: "high" },
  { name: "Drink 3 Litres Water", emoji: "💧", color: "cyan", category: "Health", target_unit: "litres", target_value: 3, difficulty: "easy", priority: "high" },
  { name: "Upgrade Yourself (Learn Any Skill)", emoji: "🚀", color: "purple", category: "Growth", target_unit: "session", target_value: 1, difficulty: "medium", priority: "high" },
  { name: "Read Book for 30 Minutes", emoji: "📚", color: "emerald", category: "Growth", target_unit: "minutes", target_value: 30, difficulty: "easy", priority: "medium" },
  { name: "Study for 1.5 Hours", emoji: "🧠", color: "purple", category: "Growth", target_unit: "minutes", target_value: 90, difficulty: "hard", priority: "high" },
  { name: "Walk 6000 Steps", emoji: "🚶", color: "emerald", category: "Fitness", target_unit: "steps", target_value: 6000, difficulty: "medium", priority: "medium" },
  { name: "Sleep 8 Hours", emoji: "😴", color: "cyan", category: "Health", target_unit: "hours", target_value: 8, difficulty: "medium", priority: "high" },
  { name: "Eat Proper Food 3 Times Daily", emoji: "🥗", color: "emerald", category: "Health", target_unit: "meals", target_value: 3, difficulty: "easy", priority: "medium" },
  { name: "30 Push Ups", emoji: "💪", color: "orange", category: "Fitness", target_unit: "reps", target_value: 30, difficulty: "medium", priority: "high" },
  { name: "10 Pull Ups", emoji: "🏋️", color: "purple", category: "Fitness", target_unit: "reps", target_value: 10, difficulty: "hard", priority: "high" },
  { name: "1 Min Plank", emoji: "🧱", color: "emerald", category: "Fitness", target_unit: "minutes", target_value: 1, difficulty: "medium", priority: "medium" },
  { name: "Self Reflection / Thinking 15 Minutes", emoji: "🧘", color: "purple", category: "Mind", target_unit: "minutes", target_value: 15, difficulty: "easy", priority: "medium" },
  { name: "Listen to Music", emoji: "🎧", color: "cyan", category: "Mind", target_unit: "session", target_value: 1, difficulty: "easy", priority: "low" },
  { name: "Instagram Screen Time < 1h 30m", emoji: "📵", color: "orange", category: "Discipline", target_unit: "minutes", target_value: 90, difficulty: "hard", priority: "high" },
];
