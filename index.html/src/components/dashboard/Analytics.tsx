import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STATUS_META, colorVar, toDateKey, type Habit, type HabitLog } from "@/lib/habits";

interface Props {
  habits: Habit[];
  logs: HabitLog[];
  monthLogs: HabitLog[];
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  color: "var(--color-foreground)",
  fontSize: "12px",
};

export function Analytics({ habits, logs, monthLogs }: Props) {
  const trend = useMemo(() => {
    const out: { day: string; rate: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);
      const done = logs.filter((l) => l.log_date === k && l.status === "completed").length;
      out.push({
        day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        rate: habits.length ? Math.round((done / habits.length) * 100) : 0,
      });
    }
    return out;
  }, [logs, habits.length]);

  const ranking = useMemo(
    () =>
      habits
        .map((h) => ({
          name: h.name.length > 16 ? `${h.name.slice(0, 15)}…` : h.name,
          color: colorVar(h.color),
          done: monthLogs.filter((l) => l.habit_id === h.id && l.status === "completed").length,
        }))
        .sort((a, b) => b.done - a.done)
        .slice(0, 8),
    [habits, monthLogs],
  );

  const mix = useMemo(
    () =>
      (["completed", "partial", "skipped", "missed"] as const)
        .map((s) => ({
          name: STATUS_META[s].label,
          value: monthLogs.filter((l) => l.status === s).length,
          color: STATUS_META[s].color,
        }))
        .filter((s) => s.value > 0),
    [monthLogs],
  );

  const radar = useMemo(() => {
    const byCategory = new Map<string, { done: number; total: number }>();
    habits.forEach((h) => {
      const entry = byCategory.get(h.category) ?? { done: 0, total: 0 };
      entry.done += monthLogs.filter((l) => l.habit_id === h.id && l.status === "completed").length;
      entry.total += new Date().getDate();
      byCategory.set(h.category, entry);
    });
    return [...byCategory.entries()].map(([category, v]) => ({
      category,
      score: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
  }, [habits, monthLogs]);

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <Panel title="Completion Trend" subtitle="Last 14 days">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--glass-border)" vertical={false} />
            <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Completion"]} />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--neon-cyan)"
              strokeWidth={2.5}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Habit Ranking" subtitle="Completed days this month">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ranking} margin={{ left: -20, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--glass-border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} interval={0} angle={-18} height={54} textAnchor="end" />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--glass)" }} />
            <Bar dataKey="done" radius={[6, 6, 0, 0]}>
              {ranking.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Status Mix" subtitle="This month">
        {mix.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={mix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
                {mix.map((m) => (
                  <Cell key={m.name} fill={m.color} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="Category Balance" subtitle="Consistency by area">
        {radar.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radar} outerRadius={90}>
              <PolarGrid stroke="var(--glass-border)" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <Radar
                dataKey="score"
                stroke="var(--neon-purple)"
                fill="var(--neon-purple)"
                fillOpacity={0.35}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Score"]} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </Panel>
    </section>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="grid h-[240px] place-items-center text-sm text-muted-foreground">
      Track a few habits to unlock this chart.
    </p>
  );
}
