import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSignatureLayout } from "@/lib/report-card-signatures";
import { sortStudentsForDisplay } from "@/lib/student-sort";

type SubjectBreakdownEntry = {
  subject_id: string;
  subject: string;
  code?: string;
  has_practical?: boolean;
  theory: number | null;
  practical: number | null;
  total: number | null;
  percentage: number | null;
  grade: string;
  points: number | null;
  absent: boolean;
  missing?: boolean;
};

type ExamRow = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
};

type ResultRow = {
  exam_id: string;
  student_id: string;
  average: number | null;
  grade: string | null;
  division: string | null;
  points: number | null;
  position: number | null;
  is_incomplete: boolean | null;
  subject_breakdown?: SubjectBreakdownEntry[] | null;
};

export async function GET(request: Request) {
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
  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) {
    return NextResponse.json({ error: "Select an examination." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select(
      "id, name, class_form, term, academic_year, start_date, end_date, status, created_at",
    )
    .eq("id", examId)
    .maybeSingle<ExamRow>();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  if (exam.status !== "Processed") {
    return NextResponse.json(
      { error: "Report cards are available after the examination has been processed." },
      { status: 409 },
    );
  }

  const [{ data: classExams, error: classExamsError }, { data: currentResults, error: currentResultsError }] =
    await Promise.all([
      admin
        .from("exams")
        .select(
          "id, name, class_form, term, academic_year, start_date, end_date, status, created_at",
        )
        .eq("class_form", exam.class_form)
        .eq("academic_year", exam.academic_year)
        .eq("status", "Processed")
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<ExamRow[]>(),
      admin
        .from("exam_results")
        .select(
          "exam_id, student_id, average, grade, division, points, position, is_incomplete, subject_breakdown",
        )
        .eq("exam_id", exam.id)
        .returns<ResultRow[]>(),
    ]);
  const resultsError = classExamsError || currentResultsError;
  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  const exams = classExams ?? [];
  const selectedResults = currentResults ?? [];
  const studentIds = selectedResults.map((result) => result.student_id);
  const studentIdSet = new Set(studentIds);

  const [
    { data: studentRows, error: studentsError },
    { data: subjectRows, error: subjectsError },
    { data: school, error: schoolError },
  ] = await Promise.all([
    studentIds.length
      ? admin
          .from("students")
          .select("id, full_name, sex, class_id")
          .in("id", studentIds)
          .order("sex")
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
    admin.from("subjects").select("id, name, subject_code").order("name"),
    admin.from("school_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const metadataError = studentsError || subjectsError || schoolError;
  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const classIds = [...new Set((studentRows ?? []).map((student) => student.class_id))];
  const { data: classes, error: classesError } = classIds.length
    ? await admin.from("classes").select("id, form, stream").in("id", classIds)
    : { data: [], error: null };
  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const examIds = exams.map((classExam) => classExam.id);
  let historyResults: ResultRow[] = [];
  if (studentIds.length > 0 && examIds.length > 0) {
    const { data, error } = await admin
      .from("exam_results")
      .select(
        "exam_id, student_id, average, grade, division, points, position, is_incomplete",
      )
      .in("exam_id", examIds)
      .in("student_id", studentIds)
      .returns<ResultRow[]>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    historyResults = data ?? [];
  }

  const resultsByExam: Record<string, Record<string, ResultRow>> = {};
  for (const classExam of exams) {
    resultsByExam[classExam.id] = {};
  }
  for (const row of historyResults) {
    if (!studentIdSet.has(row.student_id)) continue;
    resultsByExam[row.exam_id] = resultsByExam[row.exam_id] ?? {};
    resultsByExam[row.exam_id][row.student_id] = row;
  }
  for (const row of selectedResults) {
    resultsByExam[exam.id] = resultsByExam[exam.id] ?? {};
    resultsByExam[exam.id][row.student_id] = row;
  }

  const classesById = new Map(
    (classes ?? []).map((schoolClass) => [schoolClass.id, schoolClass]),
  );
  const students = sortStudentsForDisplay(
    (studentRows ?? []).map((student) => {
      const schoolClass = classesById.get(student.class_id);
      return {
        id: student.id,
        full_name: student.full_name,
        sex: student.sex,
        form: exam.class_form,
        stream: schoolClass?.stream ?? null,
      };
    }),
  );

  const schoolRow = school as Record<string, unknown> | null;

  return NextResponse.json({
    exam,
    school: {
      school_name: (schoolRow?.school_name as string) || "Mufumbu Secondary School",
      district: (schoolRow?.district as string) || "",
      region: (schoolRow?.region as string) || "",
      address: (schoolRow?.address as string) || "",
      headmaster_signature_url:
        (schoolRow?.headmaster_signature_url as string | null) ?? null,
      academic_signature_url:
        (schoolRow?.academic_signature_url as string | null) ?? null,
      class_teacher_signature_url:
        (schoolRow?.class_teacher_signature_url as string | null) ?? null,
      school_stamp_url: (schoolRow?.school_stamp_url as string | null) ?? null,
      signature_layout: normalizeSignatureLayout(schoolRow?.signature_layout),
    },
    exams,
    students,
    subjects: subjectRows ?? [],
    results: resultsByExam,
  });
}
