import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSignatureKind,
  normalizeSignatureLayout,
  SIGNATURE_URL_FIELDS,
  type SchoolSignatures,
} from "@/lib/report-card-signatures";

const STORAGE_BUCKET = "school-assets";
const MAX_SIGNATURE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function signaturesFromRow(row: Record<string, unknown> | null): SchoolSignatures {
  return {
    headmaster_signature_url: textValue(row?.headmaster_signature_url),
    academic_signature_url: textValue(row?.academic_signature_url),
    class_teacher_signature_url: textValue(row?.class_teacher_signature_url),
    school_stamp_url: textValue(row?.school_stamp_url),
    signature_layout: normalizeSignatureLayout(row?.signature_layout),
  };
}

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  const path = url.slice(markerIndex + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

async function deleteStorageFile(admin: SupabaseAdmin, url: string | null) {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await admin.storage.from(STORAGE_BUCKET).remove([path]);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (profile?.role !== "headmaster" && profile?.role !== "academic") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData();
    const rawKind = form.get("kind");
    const kind = typeof rawKind === "string" ? rawKind : "";
    const remove = form.get("remove") === "1";
    const rawFile = form.get("file");
    const file = rawFile instanceof File ? rawFile : null;
    const rawLayout = form.get("layout");

    if ((remove || file) && !isSignatureKind(kind)) {
      return NextResponse.json(
        { error: "Select a valid signature or stamp." },
        { status: 400 },
      );
    }

    let layout = null;
    if (typeof rawLayout === "string" && rawLayout.trim()) {
      try {
        layout = normalizeSignatureLayout(JSON.parse(rawLayout));
      } catch {
        return NextResponse.json(
          { error: "The signature layout is invalid." },
          { status: 400 },
        );
      }
    }

    if (!layout && !remove && !file) {
      return NextResponse.json({ error: "No changes were provided." }, { status: 400 });
    }

    if (file) {
      if (!ACCEPTED_IMAGE_TYPES[file.type]) {
        return NextResponse.json(
          { error: "Only JPG, PNG, or WEBP images are supported." },
          { status: 400 },
        );
      }
      if (file.size > MAX_SIGNATURE_SIZE) {
        return NextResponse.json(
          { error: "Signature images must be 3 MB or smaller." },
          { status: 400 },
        );
      }
    }

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("school_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const update: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    let oldUrl: string | null = null;
    let newUrl: string | null = null;

    if (layout) update.signature_layout = layout;

    if (remove && isSignatureKind(kind)) {
      const field = SIGNATURE_URL_FIELDS[kind];
      oldUrl = textValue(current?.[field]);
      update[field] = null;
    }

    if (file && isSignatureKind(kind)) {
      const extension = ACCEPTED_IMAGE_TYPES[file.type];
      const field = SIGNATURE_URL_FIELDS[kind];
      oldUrl = textValue(current?.[field]);

      const objectPath = `signatures/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { data: publicUrl } = admin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(objectPath);
      newUrl = publicUrl.publicUrl;
      update[field] = newUrl;
    }

    const { data: updated, error: updateError } = await admin
      .from("school_settings")
      .update(update)
      .eq("id", 1)
      .select("*")
      .maybeSingle();

    if (updateError) {
      if (newUrl) await deleteStorageFile(admin, newUrl);
      const message = /signature|stamp/i.test(updateError.message)
        ? `${updateError.message}. Apply supabase/report-card-signatures.sql in Supabase.`
        : updateError.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!updated) {
      if (newUrl) await deleteStorageFile(admin, newUrl);
      return NextResponse.json(
        { error: "School settings row is missing." },
        { status: 500 },
      );
    }

    if (oldUrl && oldUrl !== newUrl) {
      await deleteStorageFile(admin, oldUrl);
    }

    return NextResponse.json({ signatures: signaturesFromRow(updated) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the signature.",
      },
      { status: 500 },
    );
  }
}
