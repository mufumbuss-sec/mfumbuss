import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ALevelSubjectRow = {
  id: string;
  name: string;
  code: string;
  subject_type: string;
  has_practical: boolean;
};

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

  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");

  if (level === "alevel") {
    const { data, error } = await adminSupabase
      .from("a_level_subjects")
      .select("id, name, code, subject_type, has_practical")
      .eq("active", true)
      .eq("status", "Active")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const subjects = ((data ?? []) as ALevelSubjectRow[]).map((subject) => ({
      id: subject.id,
      name: subject.name,
      subject_code: subject.code,
      subject_type: subject.subject_type,
      has_practical: subject.has_practical,
    }));

    return NextResponse.json({ subjects });
  }

  const { data: subjects, error } = await adminSupabase
    .from("subjects")
    .select("id, name, subject_code, has_practical, created_at")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subjects: subjects || [] });
}
