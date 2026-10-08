import { LockKeyhole } from "lucide-react";
import { STATUS_CYCLE, STATUS_META, daysInMonth, type Habit, type HabitLog, type HabitStatus } from "@/lib/habits";
import { toDateKey } from "@/lib/progression";
import { Button } from "@/components/ui/button";

interface Props { habits: Habit[]; logs: HabitLog[]; year: number; month: number; onToggle: (habitId: string, date: string, status: HabitStatus | null) => void; }

function nextStatus(current: HabitStatus | null | undefined): HabitStatus | null {
  if (!current) return STATUS_CYCLE[0]!;
  const index = STATUS_CYCLE.indexOf(current);
  return index === -1 || index === STATUS_CYCLE.length - 1 ? null : STATUS_CYCLE[index + 1]!;
}

export function MonthGrid({ habits, logs, year, month, onToggle }: Props) {
  const total = daysInMonth(year, month); const days = Array.from({ length: total }, (_, index) => index + 1);
  const key = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayKey = toDateKey(new Date());
  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return <section className="system-panel p-5 sm:p-6"><div className="section-heading"><div><p className="system-label">HISTORY ARCHIVE</p><h2>{monthName}</h2></div><span><LockKeyhole className="h-3.5 w-3.5"/>Previous days locked</span></div>
    <div className="overflow-x-auto"><table className="history-table"><thead><tr><th>Quest</th>{days.map((day) => <th key={day}>{day}</th>)}</tr></thead><tbody>{habits.map((habit) => <tr key={habit.id}><td>{habit.emoji} {habit.name}</td>{days.map((day) => { const date = key(day); const status = logs.find((log) => log.habit_id === habit.id && log.log_date === date)?.status; const isToday = date === todayKey; const isFuture = date > todayKey; return <td key={day}><Button variant="ghost" size="icon" disabled={!isToday} className={isToday ? "history-cell history-today" : "history-cell"} aria-label={`${habit.name}, ${date}${isToday ? ", editable" : ", locked"}`} onClick={() => isToday && onToggle(habit.id, date, nextStatus(status))} style={isToday && status ? { color: STATUS_META[status].color } : undefined}>{status ? STATUS_META[status].short : isFuture ? "·" : <LockKeyhole />}</Button></td>; })}</tr>)}</tbody></table></div>
  </section>;
}
