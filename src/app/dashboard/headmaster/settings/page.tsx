"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Save,
  Trash2,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { AcademicPeriodSettings } from "@/components/dashboard/academic-period-settings";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type SchoolSettings = {
  school_name: string;
  district: string;
  region: string;
  address: string;
  school_logo_url: string | null;
  union_logo_url: string | null;
};

type LogoField = "school_logo_url" | "union_logo_url";

const DEFAULT_SETTINGS: SchoolSettings = {
  school_name: "Mufumbu Secondary School",
  district: "",
  region: "",
  address: "",
  school_logo_url: null,
  union_logo_url: null,
};

const MAX_LOGO_SIZE = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function SchoolSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<LogoField | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Please sign in again to continue.");
        if (active) setUserId(user.id);

        const { data, error } = await supabase
          .from("school_settings")
          .select(
            "school_name, district, region, address, school_logo_url, union_logo_url",
          )
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;
        if (active && data) {
          setSettings({
            school_name: data.school_name,
            district: data.district,
            region: data.region,
            address: data.address,
            school_logo_url: data.school_logo_url,
            union_logo_url: data.union_logo_url,
          });
        }
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "Unable to load school settings.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, [supabase]);

  function updateField<K extends keyof SchoolSettings>(
    field: K,
    value: SchoolSettings[K],
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function handleLogoUpload(field: LogoField, file?: File) {
    if (!file) return;

    const extension = ACCEPTED_IMAGE_TYPES[file.type];
    if (!extension) {
      notify("error", "Only JPG, PNG, or WEBP images are supported.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      notify("error", "Logo images must be 3 MB or smaller.");
      return;
    }
    if (!userId) {
      notify("error", "Your account could not be verified. Please sign in again.");
      return;
    }

    setUploading(field);
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${userId}/${field}-${file.lastModified}-${safeFileName}`;
      const { error } = await supabase.storage
        .from("school-assets")
        .upload(objectPath, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: true,
        });
      if (error) throw error;

      const { data } = supabase.storage
        .from("school-assets")
        .getPublicUrl(objectPath);
      updateField(field, data.publicUrl);
      notify("success", "Logo uploaded. Save the settings to apply it.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to upload the logo.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schoolName = settings.school_name.trim();
    if (!schoolName) {
      notify("error", "School name is required.");
      return;
    }
    if (!userId) {
      notify("error", "Your account could not be verified. Please sign in again.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("school_settings").upsert(
        {
          id: 1,
          school_name: schoolName,
          district: settings.district.trim(),
          region: settings.region.trim(),
          address: settings.address.trim(),
          school_logo_url: settings.school_logo_url,
          union_logo_url: settings.union_logo_url,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      notify("success", "School settings saved.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save school settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LoadingIndicator label="Loading school settings..." className="py-12" />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">School Settings</h2>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Manage the school address, location, and logos.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 sm:h-11 sm:w-11">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">School information</h3>
            <p className="text-sm text-slate-500">
              This information is shared across the school.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            School name
            <input
              required
              maxLength={150}
              value={settings.school_name}
              onChange={(event) => updateField("school_name", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Region
            <span className="relative block">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                maxLength={100}
                value={settings.region}
                onChange={(event) => updateField("region", event.target.value)}
                placeholder="For example: Mbeya"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </span>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            District
            <span className="relative block">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                maxLength={100}
                value={settings.district}
                onChange={(event) => updateField("district", event.target.value)}
                placeholder="Enter district"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </span>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            School address
            <textarea
              rows={3}
              maxLength={500}
              value={settings.address}
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Village/street, ward, postal address, or other address details"
              className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
        </div>

        <div className="border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <h3 className="font-semibold text-slate-900">Logos</h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload JPG, PNG, or WEBP images up to 3 MB.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 sm:gap-5">
            {(
              [
                ["school_logo_url", "School logo"],
                ["union_logo_url", "Union logo"],
              ] as const
            ).map(([field, label]) => {
              const imageUrl = settings[field];
              const isUploading = uploading === field;
              return (
                <div
                  key={field}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex min-w-0 flex-col items-start gap-3 sm:min-h-28 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:h-24 sm:w-24">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={label}
                          width={80}
                          height={80}
                          unoptimized
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImagePlus className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="font-medium text-slate-800">{label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {imageUrl ? "Logo selected" : "No logo uploaded"}
                      </p>
                      <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                        {isUploading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        {isUploading ? "Uploading..." : "Choose image"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploading !== null}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            void handleLogoUpload(field, file);
                          }}
                        />
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => updateField(field, null)}
                          className="ml-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="submit"
            disabled={saving || uploading !== null}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
      <AcademicPeriodSettings />
    </div>
  );
}
