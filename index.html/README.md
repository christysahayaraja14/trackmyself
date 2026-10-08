# Better Than Yesterday

A personal progression system for daily habits, streaks and push-notification reminders.

## Development

```sh
cp .env.example .env   # fill in your Supabase values
npm i
npm run dev
```

## Reminders / push notifications

- Each habit can have a daily reminder time. Enabling it asks for notification permission and registers the device for Web Push.
- `POST/GET /api/public/hooks/reminder-dispatch` must be called every minute by a scheduler (secret in `REMINDER_CRON_SECRET`). It sends a push to every device of users whose reminder is due.
- Server env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `REMINDER_CRON_SECRET`. The public key must match `src/lib/push-config.ts`.
- Notifications show **Mark done** and **Snooze 10 min** buttons. *Mark done* opens the app and completes today's habit.

## Built with

TanStack Start, TypeScript, React, Tailwind CSS, Supabase
