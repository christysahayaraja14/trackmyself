import { useState } from "react";
import { Bell, Trash2, X } from "lucide-react";
import { HABIT_COLORS, colorVar, habitInputSchema, type Habit } from "@/lib/habits";
import { reminderPermissionMessage, requestReminderPermission } from "@/lib/reminders";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface Props { habit: Habit | null; nextOrder: number; onClose: () => void; onSave: (values: Partial<Habit> & { id?: string }) => void; onDelete?: (habit: Habit) => void; }

export function HabitEditor({ habit, nextOrder, onClose, onSave, onDelete }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    name: habit?.name ?? "", description: habit?.description ?? "", emoji: habit?.emoji ?? "⚔️",
    color: (habit?.color ?? "cyan") as (typeof HABIT_COLORS)[number], category: habit?.category ?? "General",
    priority: (habit?.priority ?? "medium") as "low" | "medium" | "high",
    difficulty: (habit?.difficulty ?? "medium") as "easy" | "medium" | "hard",
    target_value: habit?.target_value ?? 1, target_unit: habit?.target_unit ?? "time",
    daily_score: habit?.daily_score ?? 10, reminder_enabled: habit?.reminder_enabled ?? false,
    reminder_time: habit?.reminder_time ?? "19:00",
  });

  async function toggleReminder(enabled: boolean) {
    setValues((current) => ({ ...current, reminder_enabled: enabled }));
    if (!enabled) { setNotice("Reminder disabled."); return; }
    const result = await requestReminderPermission();
    setNotice(reminderPermissionMessage(result));
    if (result !== "enabled") setValues((current) => ({ ...current, reminder_enabled: false }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const result = habitInputSchema.safeParse({ ...(habit ? { id: habit.id } : { sort_order: nextOrder }), ...values, reminder_time: values.reminder_enabled ? values.reminder_time : null });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Check the habit details."); return; }
    onSave(result.data);
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="system-modal">
      <div className="modal-header"><div><p className="system-label">QUEST CONFIGURATION</p><h2>{habit ? "Edit habit" : "Create a habit"}</h2></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button></div>
      <div className="space-y-4">
        <Row label="Habit name"><input className="field" value={values.name} maxLength={120} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="Enter habit name" required /></Row>
        <Row label="Description"><textarea className="field min-h-20 resize-none" value={values.description} maxLength={500} onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder="Why is this habit important?" /></Row>
        <div className="grid grid-cols-2 gap-3"><Row label="Icon"><input className="field" value={values.emoji} maxLength={8} onChange={(e) => setValues({ ...values, emoji: e.target.value })} /></Row><Row label="Category"><input className="field" value={values.category} maxLength={60} onChange={(e) => setValues({ ...values, category: e.target.value })} /></Row></div>
        <div className="grid grid-cols-2 gap-3"><Row label="Daily score"><input className="field" type="number" min={1} max={1000} value={values.daily_score} onChange={(e) => setValues({ ...values, daily_score: Number(e.target.value) })} /></Row><Row label="Target"><input className="field" type="number" min={1} value={values.target_value} onChange={(e) => setValues({ ...values, target_value: Number(e.target.value) })} /></Row></div>
        <Row label="Unit / goal"><input className="field" value={values.target_unit} maxLength={40} onChange={(e) => setValues({ ...values, target_unit: e.target.value })} placeholder="minutes, litres, steps…" /></Row>
        <div className="grid grid-cols-2 gap-3"><Row label="Priority"><select className="field" value={values.priority} onChange={(e) => setValues({ ...values, priority: e.target.value as typeof values.priority })}>{["low","medium","high"].map((item) => <option key={item}>{item}</option>)}</select></Row><Row label="Difficulty"><select className="field" value={values.difficulty} onChange={(e) => setValues({ ...values, difficulty: e.target.value as typeof values.difficulty })}>{["easy","medium","hard"].map((item) => <option key={item}>{item}</option>)}</select></Row></div>
        <div className="reminder-row"><div className="flex min-w-0 items-center gap-3"><Bell className="h-5 w-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Enable reminder</p><p className="text-xs text-muted-foreground">Push notification with Mark done / Snooze buttons</p></div></div><Switch checked={values.reminder_enabled} onCheckedChange={toggleReminder} aria-label="Enable reminder" /></div>
        {values.reminder_enabled && <Row label="Reminder time"><input className="field" type="time" value={values.reminder_time} onChange={(e) => setValues({ ...values, reminder_time: e.target.value })} required /></Row>}
        {notice && <p className="form-notice">{notice}</p>}{error && <p className="form-error">{error}</p>}
        <Row label="Color"><div className="flex gap-3">{HABIT_COLORS.map((color) => <Button key={color} type="button" variant="ghost" size="icon" aria-label={color} onClick={() => setValues({ ...values, color })} className="color-swatch" style={{ background: colorVar(color), outline: values.color === color ? "2px solid var(--color-foreground)" : "none" }} />)}</div></Row>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr_1fr]">{habit && onDelete && <Button type="button" variant="destructive" onClick={() => onDelete(habit)}><Trash2/>Delete habit</Button>}<Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" className="btn-neon">{habit ? "Save changes" : "+ Create habit"}</Button></div>
    </form>
  </div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="field-label">{label}</span>{children}</label>; }
