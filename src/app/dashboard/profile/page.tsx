"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, LoaderCircle, Mail, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="app-card p-6 text-sm text-muted">
        Your profile could not be found. Make sure your account has a record in
        the profiles table.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader
        title="My Profile"
        subtitle="Update your personal information."
      />

      <form onSubmit={handleSave} className="app-card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-line px-5 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand-dark">
            {profile.full_name?.charAt(0).toUpperCase() || <User />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-ink">
              {profile.full_name}
            </h3>
            <p className="text-sm capitalize text-muted">{profile.role}</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="First name">
            <Input
              required
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label="Middle name">
            <Input
              maxLength={80}
              value={middleName}
              onChange={(event) => setMiddleName(event.target.value)}
            />
          </Field>
          <Field label="Last name">
            <Input
              required
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
          <Field label="Phone number">
            <Input
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <div className="lg:col-span-2">
            <p className="app-label">Email address</p>
            <div className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-canvas px-3 text-sm text-muted">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="break-all">{email || "Not provided"}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Change your email address through your authentication account settings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted lg:col-span-2">
            <Calendar className="h-4 w-4" />
            Account created{" "}
            {new Date(profile.created_at).toLocaleDateString("en-TZ")}
            <span className="ml-2 capitalize">· {profile.sex === "M" ? "Male" : "Female"}</span>
          </div>
        </div>

        <div className="flex justify-end border-t border-line px-5 py-4">
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
