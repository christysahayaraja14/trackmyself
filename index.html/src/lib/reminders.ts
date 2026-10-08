import { VAPID_PUBLIC_KEY } from "@/lib/push-config";
import { removePushSubscription, savePushSubscription } from "@/lib/push.functions";

export type ReminderPermissionResult =
  | "enabled"
  | "enabled-local-only"
  | "denied"
  | "unsupported"
  | "insecure"
  | "open-in-new-tab";

const SERVICE_WORKER_PATH = "/reminder-sw.js";
const HABITS_DB = "bty-reminders";
const HABITS_STORE = "habits";

type ReminderHabit = {
  id: string;
  name: string;
  reminder_enabled: boolean;
  reminder_time: string | null;
};

function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported";
}

let serviceWorkerRegistration: Promise<ServiceWorkerRegistration | null> | null = null;

function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!serviceWorkerRegistration) {
    serviceWorkerRegistration = navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, { scope: "/" })
      .then((registration) => {
        return navigator.serviceWorker.ready;
      })
      .catch(() => null);
  }
  return serviceWorkerRegistration;
}

function openReminderDb(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(HABITS_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HABITS_STORE)) {
        request.result.createObjectStore(HABITS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function persistHabitsForServiceWorker(habits: ReminderHabit[]) {
  const db = await openReminderDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(HABITS_STORE, "readwrite");
    const store = tx.objectStore(HABITS_STORE);
    store.clear();
    habits.filter((habit) => habit.reminder_enabled && habit.reminder_time).forEach((habit) => store.put(habit));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function syncHabitsWithServiceWorker(habits: ReminderHabit[]) {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return;

  await persistHabitsForServiceWorker(habits);

  const worker = navigator.serviceWorker.controller ?? registration.active ?? registration.waiting;
  worker?.postMessage({
    type: "BTY_SYNC_REMINDERS",
    habits: habits.filter((habit) => habit.reminder_enabled && habit.reminder_time),
  });

  // Periodic Background Sync is optional and browser-controlled. It is a
  // fallback for times when the page is not open; it cannot guarantee an
  // exact minute on browsers that throttle background work.
  try {
    const periodicSync = registration as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, options?: { minInterval?: number }): Promise<void> };
    };
    await periodicSync.periodicSync?.register("bty-daily-reminders", { minInterval: 15 * 60 * 1000 });
  } catch {
    // Unsupported/denied: the normal page scheduler remains active.
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribes this device to Web Push and stores it so reminders arrive while the app is closed. */
export async function ensurePushSubscription(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || notificationPermission() !== "granted") return false;
    if (!window.isSecureContext || !("PushManager" in window)) return false;
    const registration = await getServiceWorkerRegistration();
    if (!registration) return false;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await savePushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        userAgent: navigator.userAgent.slice(0, 400),
      },
    });
    return true;
  } catch (error) {
    console.error("Push subscription failed", error);
    return false;
  }
}

/** Unsubscribes this device from push (call when the user has no reminders left). */
export async function disablePushSubscription(): Promise<void> {
  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await removePushSubscription({ data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  } catch (error) {
    console.error("Push unsubscribe failed", error);
  }
}

export async function requestReminderPermission(): Promise<ReminderPermissionResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  if (notificationPermission() === "granted") {
    return (await ensurePushSubscription()) ? "enabled" : "enabled-local-only";
  }
  if (notificationPermission() === "denied") return "denied";
  const result = await Notification.requestPermission();
  if (result === "granted") {
    return (await ensurePushSubscription()) ? "enabled" : "enabled-local-only";
  }
  return "denied";
}

export function reminderPermissionMessage(result: ReminderPermissionResult) {
  if (result === "open-in-new-tab") return "Open the app in its own tab to enable notifications.";
  if (result === "denied") return "Notifications are blocked. Allow them in your browser site settings.";
  if (result === "unsupported") return "This browser does not support local notifications.";
  if (result === "insecure") return "Notifications need a secure (https) connection.";
  if (result === "enabled-local-only") return "Reminder enabled, but this browser can't receive background push. Alerts appear only while the app is open.";
  return "Reminder enabled. This device will get a notification at the chosen time.";
}

function occurrenceKey(habit: ReminderHabit, date: Date) {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `bty-reminder-${habit.id}-${dateKey}-${habit.reminder_time}`;
}

function nextReminderDate(time: string, from = new Date()) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(from);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

async function showReminder(habit: ReminderHabit, scheduledFor: Date) {
  if (notificationPermission() !== "granted") return;

  const key = occurrenceKey(habit, scheduledFor);
  if (localStorage.getItem(key)) return;

  const registration = await getServiceWorkerRegistration();
  if (registration) {
    const worker = navigator.serviceWorker.controller ?? registration.active ?? registration.waiting;
    worker?.postMessage({
      type: "BTY_SHOW_REMINDER",
      habit,
      occurrenceKey: key,
    });
  } else {
    new Notification("⏰ Reminder", {
      body: `It's time to do: ${habit.name}`,
      icon: "/favicon.png",
      tag: `bty-reminder-${habit.id}`,
    });
  }

  localStorage.setItem(key, "sent");
}

export function startLocalReminderScheduler(habits: ReminderHabit[]) {
  if (typeof window === "undefined") return () => undefined;

  let stopped = false;
  let timer: number | undefined;

  const schedule = async () => {
    if (stopped) return;

    await syncHabitsWithServiceWorker(habits);
    if (stopped || notificationPermission() !== "granted") return;

    const now = new Date();
    const reminders = habits
      .filter((habit) => habit.reminder_enabled && habit.reminder_time)
      .map((habit) => ({ habit, next: nextReminderDate(habit.reminder_time as string, now) }));

    if (!reminders.length) return;

    const soonest = reminders.reduce((a, b) => (a.next < b.next ? a : b));
    const delay = Math.max(1000, soonest.next.getTime() - Date.now());

    timer = window.setTimeout(async () => {
      const due = new Date();
      for (const { habit } of reminders) {
        const [hours, minutes] = (habit.reminder_time as string).split(":").map(Number);
        const dueAt = new Date(due);
        dueAt.setHours(hours, minutes, 0, 0);
        if (dueAt.getTime() <= due.getTime() && due.getTime() - dueAt.getTime() < 60_000) {
          await showReminder(habit, dueAt);
        }
      }
      schedule();
    }, delay);
  };

  void schedule();
  if (notificationPermission() === "granted" && habits.some((h) => h.reminder_enabled && h.reminder_time)) {
    void ensurePushSubscription();
  }

  const handleWake = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    void schedule();
  };

  window.addEventListener("pageshow", handleWake);
  document.addEventListener("visibilitychange", handleWake);

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
    window.removeEventListener("pageshow", handleWake);
    document.removeEventListener("visibilitychange", handleWake);
  };
}
