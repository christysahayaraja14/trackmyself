import { useState } from "react";
import { Bell, Check, FilePenLine, MoreHorizontal, StickyNote, Trash2 } from "lucide-react";
import { STATUS_CYCLE, STATUS_META, type Habit, type HabitLog, type HabitStatus } from "@/lib/habits";

function nextStatus(current: HabitStatus | null | undefined): HabitStatus | null {
  if (!current) return STATUS_CYCLE[0]!;
  const index = STATUS_CYCLE.indexOf(current);
  return index === -1 || index === STATUS_CYCLE.length - 1 ? null : STATUS_CYCLE[index + 1]!;
}
import { Button } from "@/components/ui/button";

interface Props { habits: Habit[]; logs: HabitLog[]; loading: boolean; onToggle: (habitId: string, status: HabitStatus | null) => void; onNote: (habitId: string, note: string, status: HabitStatus | null) => void; onEdit: (habit: Habit) => void; onDelete: (habit: Habit) => void; }

export function HabitList({ habits, logs, loading, onToggle, onNote, onEdit, onDelete }: Props) {
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  if (loading) return <div className="grid gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-md bg-secondary/50" />)}</div>;
  if (!habits.length) return <div className="empty-quests"><p className="system-label">NO ACTIVE QUESTS</p><h3>Your next chapter starts here.</h3><p>Create one clear habit and return tomorrow stronger.</p></div>;

  return <div className="grid gap-3">{habits.map((habit) => {
    const log = logs.find((item) => item.habit_id === habit.id);
    const status = log?.status ?? null;
    const complete = status === "completed";
    const meta = status ? STATUS_META[status] : null;
    return <article key={habit.id} className={complete ? "quest-row quest-complete" : "quest-row"}>
      <Button variant="ghost" size="icon" className="quest-check" aria-label={`${habit.name} status: ${meta?.label ?? "Unchecked"}. Click to cycle`} aria-pressed={complete} style={meta ? { background: meta.color, color: "var(--surface-deep)", borderColor: meta.color } : undefined} onClick={() => onToggle(habit.id, nextStatus(status))}>{status ? <span className="text-sm font-bold leading-none">{meta!.short}</span> : <Check />}</Button>
      <div className="quest-icon" aria-hidden>{habit.emoji}</div>
      <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h3 className="truncate">{habit.name}</h3><span className="score-chip">+{habit.daily_score}</span></div><p className="truncate">{habit.description || `${habit.category} · ${habit.target_value} ${habit.target_unit}`}</p><div className="quest-meta"><span>{habit.category}</span>{habit.reminder_enabled && habit.reminder_time && <span><Bell className="h-3 w-3" />{habit.reminder_time}</span>}{complete && <span className="completed-label">MISSION COMPLETE</span>}</div>
        {noteFor === habit.id && <div className="mt-3 flex gap-2"><input className="field" value={noteText} maxLength={280} placeholder="Daily note…" onChange={(e) => setNoteText(e.target.value)} /><Button onClick={() => { onNote(habit.id, noteText, log?.status ?? null); setNoteFor(null); }}>Save</Button></div>}
      </div>
      <div className="quest-actions"><Button variant="ghost" size="icon" aria-label={`Add note to ${habit.name}`} onClick={() => { setNoteFor(noteFor === habit.id ? null : habit.id); setNoteText(log?.note ?? ""); }}><StickyNote /></Button><Button variant="ghost" size="icon" aria-label={`Edit ${habit.name}`} onClick={() => onEdit(habit)}><FilePenLine /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${habit.name}`} onClick={() => onDelete(habit)}><Trash2 /></Button></div>
    </article>;
  })}</div>;
}
