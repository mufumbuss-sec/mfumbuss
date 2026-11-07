"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, GraduationCap, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
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
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to sign in. Please try again.",
      );
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-slate-50 lg:h-[100dvh] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/70 via-transparent to-transparent" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl items-center justify-center px-4 py-4 sm:px-6 sm:py-6 lg:h-[100dvh] lg:py-6">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.25)] sm:rounded-3xl lg:max-h-[calc(100dvh-3rem)] lg:grid-cols-2">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white lg:flex xl:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.35),transparent_32%),radial-gradient(circle_at_10%_90%,rgba(14,165,233,0.22),transparent_38%)]" />
            <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-white/10" />
            <div className="absolute -right-10 top-[38%] h-52 w-52 rounded-full border border-white/10" />
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-950/40">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="mt-8 text-sm font-medium uppercase tracking-[0.22em] text-blue-300">
                Mufumbu RMS · Staff Portal
              </p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                Your school, in one secure place.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">
                Sign in to manage classes, students, subjects, and academic
                results.
              </p>
            </div>
            <p className="relative text-sm text-slate-400">
              Results Management System
            </p>
          </section>

          <section className="flex items-center justify-center px-5 py-5 sm:px-10 sm:py-8 lg:px-12 lg:py-6">
            <div className="w-full max-w-md">
              <div className="mb-5 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Mufumbu RMS · Staff Portal
                </p>
              </div>

              <div className="mb-5">
                <p className="text-sm font-semibold text-blue-700">
                  Mufumbu Secondary School
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Welcome to Mufumbu RMS
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  Sign in with your email and password to continue.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                      placeholder="you@gmail.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                  {!loading && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>
              </form>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                Secure access for authorized school staff.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
