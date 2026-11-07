import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staffRoles = profile.role === "headmaster" ? ["teacher", "academic"] : ["teacher"];
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 20),
  );
  const search = (searchParams.get("search") ?? "")
    .replace(/[,()%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const adminSupabase = createAdminClient();
  let query = adminSupabase
    .from("profiles")
    .select(
      "id, first_name, middle_name, last_name, full_name, email, sex, phone, role",
      { count: "exact" },
    )
    .in("role", staffRoles);

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const [{ data: teachers, count, error }, { count: overallTotal }] =
    await Promise.all([
      query
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + pageSize - 1),
      adminSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", staffRoles),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    teachers: teachers ?? [],
    total,
    overallTotal: overallTotal ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "headmaster") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    first_name,
    middle_name,
    last_name,
    email,
    password,
    sex,
    phone,
    role = "teacher",
  } = body;

  if (!first_name || !last_name || !email || !password || !sex) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (role !== "teacher" && role !== "academic") {
    return NextResponse.json(
      { error: "Role must be Teacher or Academic." },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Failed to create user" }, { status: 500 });
  }

  const { error: profileError } = await adminSupabase.from("profiles").insert({
    id: authData.user.id,
    first_name,
    middle_name: middle_name || null,
    last_name,
    sex,
    phone: phone || null,
    email,
    role,
  });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
