"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, LoaderCircle, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="School Settings"
        subtitle="Manage the school profile and logos."
      />

      <form onSubmit={handleSave} className="app-card overflow-hidden">
        <div className="app-card-header border-b border-line pb-4">
          <div className="min-w-0">
            <h2 className="app-card-title">School information</h2>
            <p className="app-card-subtitle">Shared across the school.</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="School name" className="lg:col-span-2">
            <Input
              required
              maxLength={150}
              value={settings.school_name}
              onChange={(event) => updateField("school_name", event.target.value)}
            />
          </Field>
          <Field label="Region">
            <Input
              maxLength={100}
              value={settings.region}
              onChange={(event) => updateField("region", event.target.value)}
              placeholder="For example: Mbeya"
            />
          </Field>
          <Field label="District">
            <Input
              maxLength={100}
              value={settings.district}
              onChange={(event) => updateField("district", event.target.value)}
              placeholder="Enter district"
            />
          </Field>
          <Field label="School address" className="lg:col-span-2">
            <textarea
              rows={3}
              maxLength={500}
              value={settings.address}
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Village/street, ward, postal address, or other address details"
              className="app-textarea"
            />
          </Field>
        </div>

        <div className="border-t border-line p-5">
          <h3 className="app-card-title">Logos</h3>
          <p className="app-card-subtitle">JPG, PNG, or WEBP up to 3 MB.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                  className="rounded-xl border border-line bg-canvas p-4"
                >
                  <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2">
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
                        <ImagePlus className="h-8 w-8 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-sm font-semibold text-ink">{label}</p>
                      <p className="mt-1 text-xs text-muted">
                        {imageUrl ? "Logo selected" : "No logo uploaded"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="app-btn app-btn-secondary app-btn-sm cursor-pointer">
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
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => updateField(field, null)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-line px-5 py-4">
          <Button
            type="submit"
            variant="primary"
            disabled={saving || uploading !== null}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
      <AcademicPeriodSettings />
    </div>
  );
}
