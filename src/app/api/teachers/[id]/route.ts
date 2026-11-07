import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getHeadmaster() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { error: profileError.message, status: 500 as const };
  }
  if (profile?.role !== "headmaster") {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  return { user };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getHeadmaster();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  let body: {
    first_name?: unknown;
    middle_name?: unknown;
    last_name?: unknown;
    email?: unknown;
    sex?: unknown;
    phone?: unknown;
    role?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const firstName =
    typeof body.first_name === "string" ? body.first_name.trim() : "";
  const middleName =
    typeof body.middle_name === "string" ? body.middle_name.trim() : "";
  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const sex = body.sex;
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const role = body.role;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required." },
      { status: 400 },
    );
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (sex !== "M" && sex !== "F") {
    return NextResponse.json({ error: "Sex must be M or F." }, { status: 400 });
  }
  if (role !== "teacher" && role !== "academic") {
    return NextResponse.json(
      { error: "Role must be Teacher or Academic." },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: target, error: targetError } = await adminSupabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", id)
    .maybeSingle();
  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }
  if (target.role !== "teacher" && target.role !== "academic") {
    return NextResponse.json(
      { error: "Only staff accounts can be updated here." },
      { status: 400 },
    );
  }

  if (target.email?.toLowerCase() !== email) {
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      id,
      { email, email_confirm: true },
    );
    if (authError) {
      const status = authError.message.toLowerCase().includes("already")
        ? 409
        : 500;
      return NextResponse.json({ error: authError.message }, { status });
    }
  }

  const { error } = await adminSupabase
    .from("profiles")
    .update({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email,
      sex,
      phone: phone || null,
      role,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: metadataError } = await adminSupabase.auth.admin.updateUserById(
    id,
    { app_metadata: { role } },
  );
  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getHeadmaster();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: target, error: targetError } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  }
  if (target.role !== "teacher" && target.role !== "academic") {
    return NextResponse.json(
      { error: "Only staff accounts can be deleted here." },
      { status: 400 },
    );
  }

  const { count: marksCount, error: marksError } = await adminSupabase
    .from("marks")
    .select("id", { count: "exact", head: true })
    .eq("entered_by", id);
  if (marksError) {
    return NextResponse.json({ error: marksError.message }, { status: 500 });
  }
  if ((marksCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This teacher has entered marks and cannot be deleted. Remove the account only after the marks are reassigned or the teacher is no longer needed.",
      },
      { status: 409 },
    );
  }

  const { error } = await adminSupabase.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
