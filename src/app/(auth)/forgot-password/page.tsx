"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Mail,
  Send,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastEmail, setLastEmail] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const errorShown = useRef(false);

  useEffect(() => {
    if (errorShown.current) return;
    errorShown.current = true;
    const error = new URLSearchParams(window.location.search).get("error");
    if (!error) return;
    const message =
      error === "link-expired"
        ? "That reset link has expired or is invalid. Request a new one."
        : error === "open-same-browser"
          ? "Open the reset link in the same browser where you requested it, then try again."
          : error;
    notify("error", message);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      notify("error", "Enter your email address first.");
      return;
    }

    setLoading(true);
    try {
      const siteUrl = (
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      ).replace(/\/$/, "");
      const redirectTo = `${siteUrl}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo,
      });

      if (error) {
        notify("error", error.message);
        return;
      }

      setLastEmail(address);
      setSent(true);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to send the reset link. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/70 via-transparent to-transparent" />
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              Mufumbu RMS
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Staff Portal
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.25)] sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                Check your email
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                If an account exists for{" "}
                <span className="font-medium text-slate-700">{lastEmail}</span>,
                we sent a password reset link to that Gmail address. Check your
                inbox and spam folder.
              </p>
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Send className="h-4 w-4" />
                  Send another link
                </button>
                <Link
                  href="/login"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                Forgot password?
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter the email address linked to your account. We will send a
                reset link to your Gmail so you can set a new password.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      placeholder="you@gmail.com"
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send reset link
                    </>
                  )}
                </button>
              </form>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                The link expires after a short time. Check your spam folder if
                you do not see the email.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
