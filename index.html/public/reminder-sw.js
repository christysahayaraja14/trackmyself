const DB_NAME = "bty-reminders";
const DB_VERSION = 2;
const HABITS_STORE = "habits";
const SENT_STORE = "sent";
const timers = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HABITS_STORE)) db.createObjectStore(HABITS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SENT_STORE)) db.createObjectStore(SENT_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function replaceHabits(habits) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(HABITS_STORE, "readwrite");
    const store = tx.objectStore(HABITS_STORE);
    store.clear();
    habits.forEach((habit) => store.put(habit));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

async function readHabits() {
  const db = await openDb();
  if (!db) return [];
  const habits = await new Promise((resolve) => {
    const request = db.transaction(HABITS_STORE, "readonly").objectStore(HABITS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  db.close();
  return habits;
}

async function wasSent(key) {
  const db = await openDb();
  if (!db) return false;
  const result = await new Promise((resolve) => {
    const request = db.transaction(SENT_STORE, "readonly").objectStore(SENT_STORE).get(key);
    request.onsuccess = () => resolve(Boolean(request.result));
    request.onerror = () => resolve(false);
  });
  db.close();
  return result;
}

async function markSent(key) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(SENT_STORE, "readwrite");
    tx.objectStore(SENT_STORE).put({ key, sentAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

function occurrenceKey(habit, date) {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `bty-reminder-${habit.id}-${dateKey}-${habit.reminder_time}`;
}

const APP_NAME = "Better Than Yesterday";
const APP_ICON = "/icon-192.png";
const SNOOZE_MS = 10 * 60 * 1000;

// Buttons shown on every reminder notification.
const REMINDER_ACTIONS = [
  { action: "done", title: "✅ Mark done" },
  { action: "snooze", title: "⏰ Snooze 10 min" },
];

async function notify(habit, occurrenceKeyValue) {
  if (!habit?.id || !habit?.name || !occurrenceKeyValue) return;
  if (await wasSent(occurrenceKeyValue)) return;

  await self.registration.showNotification(APP_NAME, {
    body: `⏰ Time for: ${habit.name}`,
    icon: APP_ICON,
    badge: APP_ICON,
    tag: `bty-reminder-${habit.id}`,
    renotify: false,
    requireInteraction: false,
    vibrate: [120, 60, 120],
    actions: REMINDER_ACTIONS,
    data: { habitId: habit.id, habitName: habit.name, occurrenceKey: occurrenceKeyValue, url: "/dashboard" },
  });

  await markSent(occurrenceKeyValue);
}

// Real push messages delivered by the browser push service. These arrive even
// when the site/PWA is fully closed, which is what makes reminders reliable.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data ? event.data.json() : {};
      } catch {
        payload = {};
      }

      const habitId = payload.habitId || "reminder";
      const key = payload.occurrenceKey || `bty-push-${habitId}-${Date.now()}`;
      if (await wasSent(key)) return;

      await self.registration.showNotification(payload.title || APP_NAME, {
        body: payload.body || "⏰ Time for your habit",
        icon: APP_ICON,
        badge: APP_ICON,
        tag: `bty-reminder-${habitId}`,
        renotify: false,
        vibrate: [120, 60, 120],
        actions: REMINDER_ACTIONS,
        data: { habitId, habitName: payload.habitName, occurrenceKey: key, url: payload.url || "/dashboard" },
      });

      await markSent(key);
    })(),
  );
});

function nextOccurrence(time, from = new Date()) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(from);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function scheduleHabit(habit) {
  if (!habit.reminder_enabled || !habit.reminder_time) return;
  const existing = timers.get(habit.id);
  if (existing) clearTimeout(existing);

  const target = nextOccurrence(habit.reminder_time);
  const delay = Math.max(1000, target.getTime() - Date.now());

  timers.set(habit.id, setTimeout(async () => {
    await notify(habit, occurrenceKey(habit, target));
    scheduleHabit(habit);
  }, delay));
}

async function scheduleAll() {
  const habits = await readHabits();
  habits.forEach(scheduleHabit);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "BTY_SYNC_REMINDERS") {
    event.waitUntil((async () => {
      await replaceHabits(data.habits || []);
      (data.habits || []).forEach(scheduleHabit);
    })());
  }

  if (data.type === "BTY_SHOW_REMINDER") {
    event.waitUntil(notify(data.habit, data.occurrenceKey));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "bty-daily-reminders") return;
  event.waitUntil((async () => {
    const habits = await readHabits();
    const now = new Date();

    for (const habit of habits) {
      if (!habit.reminder_enabled || !habit.reminder_time) continue;

      const [hours, minutes] = habit.reminder_time.split(":").map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hours, minutes, 0, 0);

      // Only fire for the current local-day occurrence. Older occurrences are ignored.
      if (scheduled.getTime() <= now.getTime() && now.getTime() - scheduled.getTime() < 15 * 60 * 1000) {
        await notify(habit, occurrenceKey(habit, scheduled));
      }
      scheduleHabit(habit);
    }
  })());
});

async function showSnoozed(data) {
  await self.registration.showNotification(APP_NAME, {
    body: `⏰ Reminder: ${data.habitName || "time for your habit"}`,
    icon: APP_ICON,
    badge: APP_ICON,
    tag: `bty-reminder-${data.habitId}`,
    renotify: true,
    vibrate: [120, 60, 120],
    actions: REMINDER_ACTIONS,
    data,
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const habitId = data.habitId;
  const action = event.action; // "done", "snooze" or "" (body tapped)

  if (action === "snooze") {
    // Best effort: the worker may be stopped by the browser before the delay ends.
    event.waitUntil(new Promise((resolve) => setTimeout(() => showSnoozed(data).then(resolve, resolve), SNOOZE_MS)));
    return;
  }

  const target = new URL(data.url || "/dashboard", self.location.origin);
  if (habitId && habitId !== "reminder") target.searchParams.set("habit", habitId);
  if (action === "done") target.searchParams.set("action", "done");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "BTY_REMINDER_CLICK", habitId, action });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target.toString());
    }),
  );
});

scheduleAll();
