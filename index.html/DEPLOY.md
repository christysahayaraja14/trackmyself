# Deploying this project

This is a **TanStack Start (Vite + React 19)** app with server-side rendering and server
functions. The backend is **Supabase** — the database, auth, and keys live
there and keep working no matter where you host the frontend.

## 1. Requirements

- Node.js 20+ and a package manager (npm, pnpm, bun, or yarn)
- Your Supabase connection values (see `.env.example`)

## 2. Environment variables

Set these on your hosting provider (Vercel/Netlify dashboards) or in a local `.env` file:

| Variable | Where it's used |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser (client bundle) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser (client bundle) |
| `SUPABASE_URL` | Server (SSR + server functions) |
| `SUPABASE_PUBLISHABLE_KEY` | Server (SSR + server functions) |
| `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` | Helpers |

The publishable key is safe to expose; never put a service/secret key in these variables.

## 3. Install and build

```bash
npm install
npm run build     # outputs the production build
```

## 4. Where to deploy

**Cloudflare (native target):** this project's build is preconfigured for Cloudflare
Workers, so it deploys there without changes (`npm run build` produces the worker output).

**Vercel / Netlify:** supported, but you must select the matching Nitro server preset so
SSR and server functions run correctly:

- Vercel: set `NITRO_PRESET=vercel` in your environment before building.
- Netlify: set `NITRO_PRESET=netlify` in your environment before building.

Then point the platform at the build output that Nitro produces (e.g. `.output/` or the
preset's generated output folder) and configure the framework preset as "Vite" with
`npm run build` as the build command.

**Important:** environment variables must be set on the hosting provider for *both* build
and runtime, or the app will fail with
"Missing Supabase environment variable(s)".

## 5. After deploying

- Log in to your hosting dashboard and add a redirect/rewrite rule only if the provider
  asks for one; TanStack Start routes normally need no extra config.
- Test sign-up, sign-in, and the dashboard — they exercise both the client and the
  server-function paths.

## 6. Push notification reminders

Set these on the server: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`) and `REMINDER_CRON_SECRET`.
Then schedule a request **every minute** to `https://<your-domain>/api/public/hooks/reminder-dispatch` with header `x-reminder-secret: <REMINDER_CRON_SECRET>`.
Run the SQL in `supabase/migrations` so the `push_subscriptions` and `reminder_deliveries` tables exist. Push requires https.
