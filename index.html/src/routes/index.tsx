import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registerAccount, resolveLoginEmail } from "@/lib/auth.functions";
import { USER_ID_RE } from "@/lib/auth-defaults";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Better Than Yesterday" },
      {
        name: "description",
        content:
          "Sign in with your User ID to your Better Than Yesterday dashboard and keep your streaks, Total Score and habit analytics growing.",
      },
      { property: "og:title", content: "Sign In — Better Than Yesterday" },
      { property: "og:description", content: "Sign in with your User ID to your Better Than Yesterday dashboard and keep your streaks, Total Score and habit analytics growing." },
    ],
  }),
  component: AuthPage,
});

function friendlyError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (/fetch|network|load failed|timeout/i.test(message)) {
    return "Can't reach the server right now. Check your connection and try again in a moment.";
  }
  return message || fallback;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [remember, setRemember] = useState(true);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    userId: "",
    email: "",
    password: "",
    confirm: "",
  });

  const resolveEmail = useServerFn(resolveLoginEmail);
  const register = useServerFn(registerAccount);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const resolved = await resolveEmail({ data: { userId: loginId } });
      if (!resolved.ok) throw new Error("No account found with that User ID.");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolved.authEmail,
        password: loginPw,
      });
      if (signInError) throw new Error("Incorrect User ID or password.");
      if (remember) localStorage.setItem("ut_last_user", loginId.trim().toLowerCase());
      else localStorage.removeItem("ut_last_user");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(friendlyError(err, "Login failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!USER_ID_RE.test(form.userId.trim()))
      return setError("User ID must be 3–32 characters (letters, numbers, . _ -).");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const result = await register({
        data: {
          fullName: form.fullName,
          username: form.username,
          userId: form.userId,
          email: form.email,
          password: form.password,
        },
      });
      if (!result.ok) throw new Error(result.error);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.authEmail,
        password: form.password,
      });
      if (signInError) {
        setMode("login");
        setNotice("Account created. Please sign in with your User ID.");
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(friendlyError(err, "Registration failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl gap-10 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <section className="mb-10 lg:mb-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs font-semibold tracking-widest text-primary uppercase">
            <img
              src="/better-than-yesterday-logo.jpg"
              alt="Better Than Yesterday logo"
              className="h-5 w-5 rounded-md object-cover"
            /> Daily growth system
          </span>
          <div className="mb-4 flex h-20 w-20 overflow-hidden rounded-3xl border border-glass-border shadow-lg">
            <img
              src="/better-than-yesterday-logo.jpg"
              alt="Better Than Yesterday logo"
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="mt-2 text-4xl leading-tight font-extrabold sm:text-6xl">
            Better <span className="neon-text">Than Yesterday</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Become better than yesterday. Track habits, streaks, Total Score and productivity with a dashboard
            built for consistent daily progress.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              { icon: Zap, text: "Streaks, Total Score & levels" },
              { icon: Sparkles, text: "Live habit analytics" },
              { icon: ShieldCheck, text: "Private User ID login" },
              { icon: Zap, text: "Fully editable habits" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="glass-tile flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-panel p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1 text-sm font-semibold">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={`rounded-lg py-2 transition-colors ${
                  mode === m ? "btn-neon" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Login" : "Create Account"}
              </button>
            ))}
          </div>

          {notice && (
            <p className="mb-4 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-primary">
              {notice}
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </p>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="User ID">
                <input
                  className="field"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="your-user-id"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Password">
                <input
                  className="field"
                  type="password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[var(--neon-cyan)]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setNotice(
                      "Password recovery is handled by your account owner for now — contact support or create a new account.",
                    )
                  }
                  className="text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={busy} className="btn-neon w-full py-3">
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Enter Dashboard"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name">
                  <input
                    className="field"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Username">
                  <input
                    className="field"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field label="User ID (unique)">
                <input
                  className="field"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  placeholder="christy_01"
                  required
                />
              </Field>
              <Field label="Email (optional)">
                <input
                  className="field"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password">
                  <input
                    className="field"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Confirm Password">
                  <input
                    className="field"
                    type="password"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <button type="submit" disabled={busy} className="btn-neon w-full py-3">
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Create My Account"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
