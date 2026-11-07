"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, LoaderCircle, Mail, Phone, Save, User } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type UserProfile = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  sex: "M" | "F";
  phone: string | null;
  role: string;
  email: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Please sign in again to view your profile.");

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, first_name, middle_name, last_name, full_name, sex, phone, role, email, created_at",
          )
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (!active) return;

        const userProfile = data as UserProfile;
        setProfile(userProfile);
        setEmail(user.email ?? userProfile.email ?? "");
        setFirstName(userProfile.first_name);
        setMiddleName(userProfile.middle_name ?? "");
        setLastName(userProfile.last_name);
        setPhone(userProfile.phone ?? "");
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "Unable to load your profile.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      notify("error", "First and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          first_name: first,
          middle_name: middleName.trim() || null,
          last_name: last,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select(
          "id, first_name, middle_name, last_name, full_name, sex, phone, role, email, created_at",
        )
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);
      notify("success", "Profile information saved.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingIndicator label="Loading profile..." className="py-12" />;
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Your profile could not be found. Make sure your account has a record in
        the profiles table.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">My Profile</h2>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Update your personal information.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-xl font-semibold text-white sm:h-14 sm:w-14">
            {profile.full_name?.charAt(0).toUpperCase() || <User />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-slate-900">
              {profile.full_name}
            </h3>
            <p className="text-sm capitalize text-slate-500">{profile.role}</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            First name
            <input
              required
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Middle name
            <input
              maxLength={80}
              value={middleName}
              onChange={(event) => setMiddleName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Last name
            <input
              required
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Phone number
            <span className="relative block">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                maxLength={30}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </span>
          </label>

          <div className="space-y-1.5 text-sm md:col-span-2">
            <p className="font-medium text-slate-700">Email address</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="break-all">{email || "Not provided"}</span>
            </div>
            <p className="text-xs text-slate-500">
              Change your email address through your authentication account settings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 md:col-span-2">
            <Calendar className="h-4 w-4" />
            Account created{" "}
            {new Date(profile.created_at).toLocaleDateString("en-TZ")}
            <span className="ml-2 capitalize">· {profile.sex === "M" ? "Male" : "Female"}</span>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex sm:justify-end sm:px-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
