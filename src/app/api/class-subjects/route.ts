import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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
  const { data: assignments, error: assignmentsError } = await adminSupabase
    .from("class_subject_assignments")
    .select("id, form, subject_id, is_compulsory")
    .order("form");

  if (assignmentsError) {
    return NextResponse.json(
      { error: assignmentsError.message },
      { status: 500 },
    );
  }

  const subjectIds = [...new Set((assignments || []).map((item) => item.subject_id))];
  if (!subjectIds.length) {
    return NextResponse.json({ assignments: [] });
  }

  const { data: subjects, error: subjectsError } = await adminSupabase
    .from("subjects")
    .select("id, name, subject_code")
    .in("id", subjectIds);

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const subjectById = new Map((subjects || []).map((subject) => [subject.id, subject]));

  return NextResponse.json({
    assignments: (assignments || []).flatMap((assignment) => {
      const subject = subjectById.get(assignment.subject_id);
      return subject
        ? [
            {
              id: assignment.id,
              form: assignment.form,
              subject_id: assignment.subject_id,
              is_compulsory: assignment.is_compulsory,
              subject_name: subject.name,
              subject_code: subject.subject_code,
            },
          ]
        : [];
    }),
  });
}
