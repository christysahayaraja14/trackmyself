// Web Push (RFC 8291 / 8292) sender that runs on the edge runtime.
// Uses WebCrypto only, so it works inside the Worker used for server routes.
import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushSendResult = { ok: true } | { ok: false; status: number; gone: boolean; body: string };

let cachedKeys: Promise<ApplicationServerKeys> | null = null;

function getKeys() {
  if (!cachedKeys) {
    const publicKey = process.env["VAPID_PUBLIC_KEY"];
    const privateKey = process.env["VAPID_PRIVATE_KEY"];
    if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");
    cachedKeys = ApplicationServerKeys.fromJSON({ publicKey, privateKey });
  }
  return cachedKeys;
}

export async function sendWebPush(target: PushTarget, payload: unknown): Promise<PushSendResult> {
  const keys = await getKeys();

  const { headers, body, endpoint } = await generatePushHTTPRequest({
    applicationServerKeys: keys,
    payload: JSON.stringify(payload),
    target: { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    adminContact: process.env["VAPID_SUBJECT"] ?? "mailto:reminders@betterthanyesterday.app",
    ttl: 3600,
    urgency: "high",
  });

  const response = await fetch(endpoint, { method: "POST", headers, body });

  if (response.ok) return { ok: true };

  const text = await response.text().catch(() => "");
  // 404/410 mean the browser dropped this subscription for good.
  return { ok: false, status: response.status, gone: response.status === 404 || response.status === 410, body: text };
}
