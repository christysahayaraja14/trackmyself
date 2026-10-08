import { describe, expect, it } from "vitest";
import { calculateLevel, calculateStreak, calculateTodayProgress, calculateTotalScore } from "./progression";
import type { Habit, HabitLog } from "./habits";
const habit = (id: string, active_from = "2026-09-01"): Habit => ({ id, owner_id:"u", name:id, description:"", emoji:"✓", color:"cyan", category:"General", priority:"medium", difficulty:"medium", target_value:1, target_unit:"time", daily_score:10, reminder_enabled:false, reminder_time:null, sort_order:0, archived:false, active_from, deleted_at:null });
const log = (id: string, date: string, score=10): HabitLog => ({ id:`${id}-${date}`, habit_id:id, log_date:date, status:"completed", progress:100, note:null, score_awarded:score });
describe("progression", () => {
  it("sums score snapshots exactly once", () => expect(calculateTotalScore([log("a","2026-09-14",20),log("a","2026-09-15",20)])).toBe(40));
  it("calculates level boundaries", () => { expect(calculateLevel(0).level).toBe(1); expect(calculateLevel(100).level).toBe(2); expect(calculateLevel(400).level).toBe(3); });
  it("derives consecutive complete days", () => expect(calculateStreak([habit("a")],[log("a","2026-09-13"),log("a","2026-09-14"),log("a","2026-09-15")],"2026-09-15").current).toBe(3));
  it("does not let an incomplete today erase yesterday's streak", () => expect(calculateStreak([habit("a")],[log("a","2026-09-13"),log("a","2026-09-14")],"2026-09-15").current).toBe(2));
  it("calculates today's applicable habits", () => expect(calculateTodayProgress([habit("a"),habit("b","2026-09-16")],[log("a","2026-09-15")],"2026-09-15")).toMatchObject({completed:1,total:1,percentage:100,allComplete:true}));
});
