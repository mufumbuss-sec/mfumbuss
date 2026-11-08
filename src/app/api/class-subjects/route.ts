import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const A_LEVEL_FORMS = ["Form V", "Form VI"];

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

  const [{ data: assignments, error: assignmentsError }, { data: aLevelSubjects, error: aLevelError }] =
    await Promise.all([
      adminSupabase
        .from("class_subject_assignments")
        .select("id, form, subject_id, is_compulsory")
        .order("form"),
      adminSupabase
        .from("a_level_subjects")
        .select("id, name, code")
        .eq("active", true)
        .eq("status", "Active")
        .order("name"),
    ]);

  if (assignmentsError) {
    return NextResponse.json(
      { error: assignmentsError.message },
      { status: 500 },
    );
  }
  if (aLevelError) {
    return NextResponse.json({ error: aLevelError.message }, { status: 500 });
  }

  const subjectIds = [...new Set((assignments || []).map((item) => item.subject_id))];
  const { data: subjects, error: subjectsError } = subjectIds.length
    ? await adminSupabase
        .from("subjects")
        .select("id, name, subject_code")
        .in("id", subjectIds)
    : { data: [], error: null };

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const subjectById = new Map((subjects || []).map((subject) => [subject.id, subject]));

  const oLevelAssignments = (assignments || []).flatMap((assignment) => {
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
  });

  const aLevelAssignments = A_LEVEL_FORMS.flatMap((form) =>
    (aLevelSubjects || []).map((subject) => ({
      id: `a-level:${form}:${subject.id}`,
      form,
      subject_id: subject.id,
      is_compulsory: true,
      subject_name: subject.name,
      subject_code: subject.code,
    })),
  );

  return NextResponse.json({
    assignments: [...oLevelAssignments, ...aLevelAssignments],
  });
}
