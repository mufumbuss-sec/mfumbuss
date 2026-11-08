"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  function togglePasswordVisibility(field: keyof typeof visiblePasswords) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      notify("error", "Enter your current password first.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("error", "The new password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 8) {
      notify("error", "The new password must be at least 8 characters long.");
      return;
    }

    if (newPassword === currentPassword) {
      notify("error", "The new password must be different from the current password.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.email) {
        throw new Error("Unable to verify your account. Please sign in again.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error("Your current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      notify("success", "Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to change your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  const toggleClass =
    "absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-muted hover:bg-brand-tint focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader
        title="Change password"
        subtitle="Update your account password securely."
      />
      <div className="app-card overflow-hidden">
        <div className="app-card-header border-b border-line pb-4">
          <div className="min-w-0">
            <h2 className="app-card-title">Account security</h2>
            <p className="app-card-subtitle">
              Verify your current password before setting a new one.
            </p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4 p-5">
          <Field label="Current password" htmlFor="current-password">
            <div className="relative">
              <Input
                id="current-password"
                type={visiblePasswords.current ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="pr-12"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("current")}
                aria-label={visiblePasswords.current ? "Hide current password" : "Show current password"}
                aria-pressed={visiblePasswords.current}
                className={toggleClass}
              >
                {visiblePasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <Field label="New password" htmlFor="new-password">
            <div className="relative">
              <Input
                id="new-password"
                type={visiblePasswords.new ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="pr-12"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("new")}
                aria-label={visiblePasswords.new ? "Hide new password" : "Show new password"}
                aria-pressed={visiblePasswords.new}
                className={toggleClass}
              >
                {visiblePasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <div className="relative">
              <Input
                id="confirm-password"
                type={visiblePasswords.confirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pr-12"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirm")}
                aria-label={visiblePasswords.confirm ? "Hide password confirmation" : "Show password confirmation"}
                aria-pressed={visiblePasswords.confirm}
                className={toggleClass}
              >
                {visiblePasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {loading ? "Updating..." : "Change password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
