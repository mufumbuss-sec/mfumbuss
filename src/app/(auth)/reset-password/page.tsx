"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
        setChecking(false);
      }
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (!error && data.user) {
        setHasSession(true);
      }
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      notify("error", "The new password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      notify("error", "The new password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.message.toLowerCase().includes("session")) {
          setHasSession(false);
        }
        notify("error", error.message);
        return;
      }

      await supabase.auth.signOut({ scope: "local" });
      setDone(true);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update your password. Please try again.",
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

        <div className="mt-7">
          {checking ? (
            <div className="flex flex-col items-center py-8 text-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-brand" />
              <p className="mt-3 text-sm text-muted">
                Verifying your reset link...
              </p>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-ink">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-ink">Password updated</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your password has been changed successfully. Sign in with your
                new password to continue.
              </p>
              <Link href="/login" className="app-btn app-btn-primary mt-6 w-full">
                Go to sign in
              </Link>
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-highlight text-highlight-ink">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-ink">
                Reset link expired
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                This password reset link is invalid or has already been used.
                Request a new link to continue.
              </p>
              <Link
                href="/forgot-password"
                className="app-btn app-btn-primary mt-6 w-full"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-ink">Set a new password</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Choose a strong password with at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="password" className="app-label">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      placeholder="At least 8 characters"
                      className="app-input pr-12"
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

                <div>
                  <label htmlFor="confirm-password" className="app-label">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                      placeholder="Re-enter your new password"
                      className="app-input pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((visible) => !visible)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      aria-pressed={showConfirm}
                      className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      {showConfirm ? (
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
                  className="app-btn app-btn-primary w-full"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Update password
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
