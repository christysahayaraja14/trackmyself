import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/progression";
export { toDateKey };

export type HabitStatus = "completed" | "partial" | "skipped" | "missed";

export interface Habit {
  id: string; owner_id: string; name: string; description: string; emoji: string; color: string;
  category: string; priority: string; difficulty: string; target_value: number; target_unit: string;
  daily_score: number; reminder_enabled: boolean; reminder_time: string | null; sort_order: number;
  archived: boolean; active_from: string; deleted_at: string | null; created_at?: string;
}
export interface HabitLog {
  id: string; habit_id: string; log_date: string; status: HabitStatus; progress: number;
  note: string | null; score_awarded: number;
}

export const HABIT_COLORS = ["cyan", "purple", "emerald", "orange", "pink"] as const;
export const STATUS_META: Record<HabitStatus, { label: string; short: string; color: string }> = {
  completed: { label: "Completed", short: "✓", color: "var(--neon-emerald)" },
  partial: { label: "Partial", short: "◐", color: "var(--neon-orange)" },
  skipped: { label: "Skipped", short: "–", color: "var(--neon-purple)" },
  missed: { label: "Missed", short: "✕", color: "var(--destructive)" },
};
export const STATUS_CYCLE: HabitStatus[] = ["completed", "partial", "skipped", "missed"];

export function colorVar(color: string) {
  return `var(--neon-${HABIT_COLORS.includes(color as (typeof HABIT_COLORS)[number]) ? color : "cyan"})`;
}
export function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

export const habitInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  emoji: z.string().trim().min(1).max(8),
  color: z.enum(HABIT_COLORS),
  category: z.string().trim().min(1).max(60),
  priority: z.enum(["low", "medium", "high"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  target_value: z.number().positive().max(1_000_000),
  target_unit: z.string().trim().min(1).max(40),
  daily_score: z.number().int().min(1).max(1000),
  reminder_enabled: z.boolean(),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  sort_order: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
});

const logInputSchema = z.object({
  habitId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["completed", "partial", "skipped", "missed"]).nullable(),
  progress: z.number().min(0).max(100).optional(), note: z.string().trim().max(280).nullable().optional(),
});

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const { data, error } = await supabase.from("profiles").update({ timezone }).eq("id", auth.user.id).select("*").maybeSingle();
    if (error) throw error;
    return data;
  }});
}
export function useHabits() {
  return useQuery({ queryKey: ["habits"], queryFn: async () => {
    const { data, error } = await supabase.from("habits").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Habit[];
  }});
}
export function useLogs(from?: string, to?: string) {
  return useQuery({ queryKey: ["logs", from ?? "all", to ?? "all"], queryFn: async () => {
    let query = supabase.from("habit_logs").select("*").order("log_date", { ascending: true });
    if (from) query = query.gte("log_date", from);
    if (to) query = query.lte("log_date", to);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as HabitLog[];
  }});
}

export function useHabitMutations() {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["logs"] }); };
  const saveHabit = useMutation({ mutationFn: async (raw: unknown) => {
    const habit = habitInputSchema.parse(raw);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const reminderTime = habit.reminder_enabled ? habit.reminder_time : null;
    if (habit.reminder_enabled && !reminderTime) throw new Error("Choose a reminder time.");
    if (habit.id) {
      const { id, ...patch } = habit;
      const { error } = await supabase.from("habits").update({ ...patch, reminder_time: reminderTime } as never).eq("id", id).eq("owner_id", auth.user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("habits").insert({ ...habit, reminder_time: reminderTime, owner_id: auth.user.id, active_from: toDateKey(new Date()) } as never);
      if (error) throw error;
    }
  }, onSuccess: invalidate });

  const deleteHabit = useMutation({ mutationFn: async (id: string) => {
    const parsed = z.string().uuid().parse(id);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const { error } = await supabase.from("habits").update({ deleted_at: new Date().toISOString(), archived: true } as never).eq("id", parsed).eq("owner_id", auth.user.id);
    if (error) throw error;
  }, onSuccess: invalidate });

  const setLog = useMutation({ mutationFn: async (raw: unknown) => {
    const input = logInputSchema.parse(raw);
    if (input.date !== toDateKey(new Date())) throw new Error("Previous days are locked.");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    if (input.status === null) {
      const { error } = await supabase.from("habit_logs").delete().eq("habit_id", input.habitId).eq("log_date", input.date);
      if (error) throw error;
      return;
    }
    const progress = input.progress ?? (input.status === "completed" ? 100 : input.status === "partial" ? 50 : 0);
    const { error } = await supabase.from("habit_logs").upsert({ owner_id: auth.user.id, habit_id: input.habitId, log_date: input.date, status: input.status, progress, note: input.note ?? null } as never, { onConflict: "habit_id,log_date" });
    if (error) throw error;
  }, onSuccess: invalidate });
  return { saveHabit, deleteHabit, setLog };
}
