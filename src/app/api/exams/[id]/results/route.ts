import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortStudentsForDisplay } from "@/lib/student-sort";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const A_LEVEL_FORMS = new Set(["Form V", "Form VI"]);

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  const role = profile?.role;
  if (role !== "headmaster" && role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) {
    return NextResponse.json({ error: examError.message }, { status: 500 });
  }
  if (!exam) {
    return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  }

  if (exam.status !== "Processed") {
    return NextResponse.json(
      { error: "Results are available after the examination has been processed." },
      { status: 409 },
    );
  }

  const { data: results, error: resultsError } = await admin
    .from("exam_results")
    .select(
      "student_id, total_marks, average, grade, division, points, position, is_incomplete, subject_breakdown",
    )
    .eq("exam_id", id)
    .order("position");
  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  const studentIds = (results ?? []).map((result) => result.student_id);
  const { data: students, error: studentsError } = studentIds.length
    ? await admin
        .from("students")
        .select("id, full_name, sex")
        .in("id", studentIds)
    : { data: [], error: null };
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const isALevel = A_LEVEL_FORMS.has(exam.class_form);
  const examSubjectTable = isALevel ? "a_level_exam_subjects" : "exam_subjects";

  const [
    { data: school, error: schoolError },
    { data: examSubjects, error: examSubjectsError },
  ] = await Promise.all([
    admin
      .from("school_settings")
      .select("school_name, district, address")
      .eq("id", 1)
      .maybeSingle(),
    admin.from(examSubjectTable).select("subject_id").eq("exam_id", id),
  ]);
  const metadataError = schoolError || examSubjectsError;
  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const subjectIds = (examSubjects ?? []).map((item) => item.subject_id);
  let subjectRows: Array<{
    id: string;
    name: string;
    subject_code: string;
    has_practical: boolean;
    subject_type: string | null;
  }> = [];
  if (subjectIds.length > 0) {
    if (isALevel) {
      const { data, error } = await admin
        .from("a_level_subjects")
        .select("id, name, code, has_practical, subject_type")
        .in("id", subjectIds)
        .order("name");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      subjectRows = (data ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        subject_code: subject.code,
        has_practical: Boolean(subject.has_practical),
        subject_type: subject.subject_type,
      }));
    } else {
      const { data, error } = await admin
        .from("subjects")
        .select("id, name, subject_code, has_practical")
        .in("id", subjectIds)
        .order("name");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      subjectRows = (data ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        subject_code: subject.subject_code,
        has_practical: Boolean(subject.has_practical),
        subject_type: null,
      }));
    }
  }

  const registeredCounts = new Map<string, number>();
  for (const result of results ?? []) {
    const breakdown = Array.isArray(result.subject_breakdown)
      ? (result.subject_breakdown as Array<{ subject_id?: string }>)
      : [];
    for (const entry of breakdown) {
      if (!entry.subject_id) continue;
      registeredCounts.set(
        entry.subject_id,
        (registeredCounts.get(entry.subject_id) ?? 0) + 1,
      );
    }
  }
  const subjects = subjectRows.map((subject) => ({
    ...subject,
    registered: registeredCounts.get(subject.id) ?? 0,
  }));

  const studentsById = new Map(
    (students ?? []).map((student) => [student.id, student]),
  );
  const orderedResults = sortStudentsForDisplay(
    (results ?? []).map((result) => ({
      ...result,
      student: studentsById.get(result.student_id) ?? null,
    })),
  );

  return NextResponse.json({
    exam,
    school: school ?? {
      school_name: "Mufumbu Secondary School",
      district: "",
      address: "",
    },
    subjects,
    results: orderedResults,
  });
}
