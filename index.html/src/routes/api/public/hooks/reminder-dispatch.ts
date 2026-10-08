import { createFileRoute } from "@tanstack/react-router";

import { sendWebPush } from "@/lib/webpush.server";

interface DueReminder {
  habit_id: string;
  owner_id: string;
  habit_name: string;
  emoji: string | null;
  reminder_time: string;
  local_date: string;
  timezone: string;
}

async function dispatch(request: Request) {
  const secret = process.env["REMINDER_CRON_SECRET"];
  if (!secret) return Response.json({ error: "Reminder dispatcher is not configured" }, { status: 500 });

  const provided =
    request.headers.get("x-reminder-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  // Constant-time-ish comparison; the endpoint is public so the caller must prove itself.
  if (provided.length !== secret.length || provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: due, error } = await supabaseAdmin.rpc("due_habit_reminders", { window_minutes: 5 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const reminders = (due ?? []) as DueReminder[];
  if (!reminders.length) return Response.json({ checked: 0, sent: 0 });

  // Claim each reminder occurrence once. The unique key (habit + local date +
  // time) makes duplicates impossible even if the dispatcher runs twice.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("reminder_deliveries")
    .upsert(
      reminders.map((reminder) => ({
        habit_id: reminder.habit_id,
        owner_id: reminder.owner_id,
        local_date: reminder.local_date,
        reminder_time: reminder.reminder_time,
      })) as never,
      { onConflict: "habit_id,local_date,reminder_time", ignoreDuplicates: true },
    )
    .select("habit_id,local_date,reminder_time");

  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });

  const claimedKeys = new Set(
    (claimed ?? []).map((row) => `${row.habit_id}|${row.local_date}|${row.reminder_time}`),
  );
  const toSend = reminders.filter((reminder) =>
    claimedKeys.has(`${reminder.habit_id}|${reminder.local_date}|${reminder.reminder_time}`),
  );

  if (!toSend.length) return Response.json({ checked: reminders.length, sent: 0 });

  const owners = [...new Set(toSend.map((reminder) => reminder.owner_id))];
  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("owner_id,endpoint,p256dh,auth")
    .in("owner_id", owners);

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const reminder of toSend) {
    const targets = (subscriptions ?? []).filter((row) => row.owner_id === reminder.owner_id);

    for (const target of targets) {
      const result = await sendWebPush(target, {
        title: "Better Than Yesterday",
        body: `${reminder.emoji ? `${reminder.emoji} ` : ""}⏰ Time for: ${reminder.habit_name}`,
        habitId: reminder.habit_id,
        habitName: reminder.habit_name,
        occurrenceKey: `bty-reminder-${reminder.habit_id}-${reminder.local_date}-${reminder.reminder_time}`,
        url: "/dashboard",
      });

      if (result.ok) {
        sent += 1;
      } else if (result.gone) {
        staleEndpoints.push(target.endpoint);
      } else {
        console.error(`Push send failed [${result.status}]: ${result.body}`);
      }
    }
  }

  if (staleEndpoints.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return Response.json({ checked: reminders.length, claimed: toSend.length, sent });
}

export const Route = createFileRoute("/api/public/hooks/reminder-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => dispatch(request),
      GET: async ({ request }) => dispatch(request),
    },
  },
});
