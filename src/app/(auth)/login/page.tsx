"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        setError(error.message);
        notify("error", error.message);
        return;
      }

      let role =
        typeof data.user.app_metadata?.role === "string"
          ? data.user.app_metadata.role
          : null;

      if (!role) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();
        role = profile?.role ?? null;
      }

      const home =
        role === "headmaster"
          ? "/dashboard/headmaster"
          : role === "academic"
            ? "/dashboard/academic"
            : role === "teacher"
              ? "/dashboard/teacher"
              : "/dashboard";

      const requested = new URLSearchParams(window.location.search).get("next");
      const destination =
        requested && requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : home;
      window.dispatchEvent(new Event("app:navigation-start"));
      router.replace(destination);
    } catch (error) {
      setLoading(false);
      const message =
        error instanceof Error ? error.message : "Unable to sign in. Please try again.";
      setError(message);
      notify("error", message);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-[420px] rounded-[14px] border border-line bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-accent-ink">
            NSS
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight text-ink">
              Mufumbu Secondary School
            </h1>
            <p className="mt-0.5 text-sm text-muted">Exams System</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="app-label">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="app-input"
              placeholder="you@gmail.com"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="password" className="app-label !mb-0">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-brand hover:text-brand-dark hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="app-input pr-12"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error ? <p className="app-error">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="app-btn app-btn-primary w-full"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
