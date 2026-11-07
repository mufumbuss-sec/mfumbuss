"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react";
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Change password
        </h2>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">
          Update your account password securely.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
            Account security
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Verify your current password before setting a new one.
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-5 p-4 sm:p-6">
          <div>
            <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Current password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={visiblePasswords.current ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="min-h-12 w-full rounded-xl border border-gray-300 px-3 py-2 pr-12 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("current")}
                aria-label={visiblePasswords.current ? "Hide current password" : "Show current password"}
                aria-pressed={visiblePasswords.current}
                className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {visiblePasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={visiblePasswords.new ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="min-h-12 w-full rounded-xl border border-gray-300 px-3 py-2 pr-12 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("new")}
                aria-label={visiblePasswords.new ? "Hide new password" : "Show new password"}
                aria-pressed={visiblePasswords.new}
                className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {visiblePasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={visiblePasswords.confirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="min-h-12 w-full rounded-xl border border-gray-300 px-3 py-2 pr-12 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirm")}
                aria-label={visiblePasswords.confirm ? "Hide password confirmation" : "Show password confirmation"}
                aria-pressed={visiblePasswords.confirm}
                className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {visiblePasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {loading ? "Updating..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
