"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
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

        {sent ? (
          <div className="mt-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-ink">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-ink">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              If an account exists for{" "}
              <span className="font-semibold text-ink">{lastEmail}</span>, we sent
              a password reset link to that address.
            </p>
            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => setSent(false)}
                className="app-btn app-btn-secondary w-full"
              >
                <Send className="h-4 w-4" />
                Send another link
              </button>
              <Link href="/login" className="app-btn app-btn-primary w-full">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
            <h2 className="mt-3 text-lg font-bold text-ink">Forgot password?</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Enter the email linked to your account and we will send a reset
              link.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="email" className="app-label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="you@gmail.com"
                  className="app-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="app-btn app-btn-primary w-full"
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

            <p className="mt-4 text-center text-xs leading-5 text-muted">
              The link expires after a short time.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
