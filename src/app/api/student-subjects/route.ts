import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: schoolClass, error: classError } = await adminSupabase
    .from("classes")
    .select("id, form")
    .eq("id", classId)
    .single();

  if (classError || !schoolClass) {
    return NextResponse.json({ error: classError?.message || "Class not found" }, { status: 404 });
  }

  const { data: assignments, error: assignmentsError } = await adminSupabase
    .from("class_subject_assignments")
    .select("id, subject_id, is_compulsory")
    .eq("form", schoolClass.form);

  if (assignmentsError) {
    return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
  }

  const optionalAssignments = (assignments || []).filter((a) => !a.is_compulsory);
  const subjectIds = [...new Set(optionalAssignments.map((a) => a.subject_id))];

  if (subjectIds.length === 0) {
    return NextResponse.json({ subjects: [] });
  }

  const { data: subjects, error: subjectsError } = await adminSupabase
    .from("subjects")
    .select("id, name, subject_code")
    .in("id", subjectIds);

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  return NextResponse.json({
    subjects: (subjects || []).map((s) => ({ id: s.id, name: s.name, subject_code: s.subject_code })),
  });
}

export async function POST(req: Request) {
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

  let body: {
    studentIds?: unknown;
    subjectId?: unknown;
    subjectIds?: unknown;
    action?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawStudentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
  const studentIds = rawStudentIds.filter(
    (studentId): studentId is string =>
      typeof studentId === "string" && studentId.length > 0,
  );
  const rawSubjectIds = Array.isArray(body.subjectIds)
    ? body.subjectIds
    : typeof body.subjectId === "string"
      ? [body.subjectId]
      : [];
  const subjectIds = rawSubjectIds.filter(
    (subjectId): subjectId is string =>
      typeof subjectId === "string" && subjectId.length > 0,
  );
  const action = body.action === "unassign" ? "unassign" : body.action ?? "assign";

  if (
    studentIds.length === 0 ||
    studentIds.length > 500 ||
    studentIds.length !== rawStudentIds.length ||
    subjectIds.length === 0 ||
    subjectIds.length > 100 ||
    subjectIds.length !== rawSubjectIds.length ||
    studentIds.length * subjectIds.length > 5000
  ) {
    return NextResponse.json(
      {
        error:
          "Provide 1 to 500 valid student IDs and 1 to 100 valid subject IDs, with no more than 5,000 student-subject assignments",
      },
      { status: 400 },
    );
  }
  if (studentIds.length !== new Set(studentIds).size) {
    return NextResponse.json({ error: "Duplicate student IDs are not allowed" }, { status: 400 });
  }
  if (subjectIds.length !== new Set(subjectIds).size) {
    return NextResponse.json({ error: "Duplicate subject IDs are not allowed" }, { status: 400 });
  }
  if (action !== "assign" && action !== "unassign") {
    return NextResponse.json({ error: "Invalid enrollment action" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: students, error: studentsError } = await adminSupabase
    .from("students")
    .select("id, class_id")
    .in("id", studentIds);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }
  if (!students || students.length !== studentIds.length) {
    return NextResponse.json({ error: "One or more students were not found" }, { status: 404 });
  }

  const classIds = [...new Set(students.map((student) => student.class_id))];
  const { data: studentClasses, error: studentClassesError } =
    await adminSupabase.from("classes").select("id, form").in("id", classIds);

  if (studentClassesError) {
    return NextResponse.json({ error: studentClassesError.message }, { status: 500 });
  }

  const forms = [...new Set((studentClasses ?? []).map((schoolClass) => schoolClass.form))];
  if (forms.length !== 1 || studentClasses?.length !== classIds.length) {
    return NextResponse.json(
      { error: "Students must belong to the same form to update their subjects" },
      { status: 400 },
    );
  }

  const { data: assignments, error: assignmentError } = await adminSupabase
    .from("class_subject_assignments")
    .select("is_compulsory")
    .eq("form", forms[0])
    .in("subject_id", subjectIds);
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  if (
    !assignments ||
    assignments.length !== subjectIds.length ||
    assignments.some((assignment) => assignment.is_compulsory)
  ) {
    return NextResponse.json(
      { error: "One or more subjects are not optional for the students' form" },
      { status: 400 },
    );
  }

  if (action === "assign") {
    const payload = studentIds.flatMap((studentId) =>
      subjectIds.map((subjectId) => ({
        student_id: studentId,
        subject_id: subjectId,
        enrollment_type: "optional" as const,
      })),
    );

    const { error } = await adminSupabase
      .from("student_subjects")
      .upsert(payload, { onConflict: "student_id,subject_id", ignoreDuplicates: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error } = await adminSupabase
    .from("student_subjects")
    .delete()
    .in("student_id", studentIds)
    .in("subject_id", subjectIds)
    .eq("enrollment_type", "optional");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
