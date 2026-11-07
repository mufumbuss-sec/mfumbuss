import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortStudentsForDisplay } from "@/lib/student-sort";

type MarkInput = {
  exam_id?: unknown;
  subject_id?: unknown;
  student_id?: unknown;
  theory_score?: unknown;
  practical_score?: unknown;
  is_absent?: unknown;
  marks?: unknown;
};

type StudentMarkInput = Omit<MarkInput, "marks">;

function isStudentMarkInput(value: unknown): value is StudentMarkInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScore(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
  );
}

async function getMarksContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { error: profileError.message, status: 500 as const };
  }
  if (profile?.role !== "teacher" && profile?.role !== "academic") {
    return { error: "Only teachers and academic staff can manage marks here." as const, status: 403 as const };
  }

  const admin = createAdminClient();

  return { user, role: profile.role, admin };
}

async function getEligibleStudents(
  admin: ReturnType<typeof createAdminClient>,
  classForm: string,
  subjectId: string,
) {
  const { data: schoolClasses, error: classesError } = await admin
    .from("classes")
    .select("id")
    .eq("form", classForm);
  if (classesError) throw new Error(classesError.message);

  const classIds = (schoolClasses ?? []).map((schoolClass) => schoolClass.id);
  if (classIds.length === 0) return [];

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id, full_name, class_id, sex")
    .in("class_id", classIds)
    .order("first_name")
    .order("middle_name")
    .order("last_name")
    .order("id");
  if (studentsError) throw new Error(studentsError.message);

  const { data: classSubject, error: classSubjectError } = await admin
    .from("class_subject_assignments")
    .select("is_compulsory")
    .eq("form", classForm)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (classSubjectError) throw new Error(classSubjectError.message);
  if (!classSubject) return [];
  if (classSubject.is_compulsory) return students ?? [];

  const studentIds = (students ?? []).map((student) => student.id);
  if (studentIds.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await admin
    .from("student_subjects")
    .select("student_id")
    .eq("subject_id", subjectId)
    .in("student_id", studentIds);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  const enrolledIds = new Set((enrollments ?? []).map((item) => item.student_id));
  return (students ?? []).filter((student) => enrolledIds.has(student.id));
}

export async function GET(request: Request) {
  const context = await getMarksContext();
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }
  const { user, role, admin } = context;
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");

  if (!examId) {
    let assignedForms: Set<string> | null = null;
    if (role === "teacher") {
      const { data: assignments, error: assignmentsError } = await admin
        .from("teaching_assignments")
        .select("class_name")
        .eq("teacher_id", user.id);
      if (assignmentsError) {
        return NextResponse.json(
          { error: assignmentsError.message },
          { status: 500 },
        );
      }
      assignedForms = new Set(
        (assignments ?? []).map((assignment) => assignment.class_name),
      );
      if (assignedForms.size === 0) {
        return NextResponse.json({ exams: [] });
      }
    }

    const { data: activePeriod, error: periodError } = await admin
      .from("academic_period_settings")
      .select("academic_year")
      .eq("id", 1)
      .maybeSingle();
    if (periodError) {
      return NextResponse.json({ error: periodError.message }, { status: 500 });
    }

    let examsQuery = admin
      .from("exams")
      .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
      .eq("status", "Active");
    if (activePeriod?.academic_year) {
      examsQuery = examsQuery.eq("academic_year", activePeriod.academic_year);
    }
    const { data: exams, error } = await examsQuery.order("created_at", {
      ascending: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      exams:
        role === "teacher"
          ? (exams ?? []).filter((item) => assignedForms?.has(item.class_form))
          : exams ?? [],
    });
  }

  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
    .eq("id", examId)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam || exam.status !== "Active") {
    return NextResponse.json(
      { error: "This examination is not available for mark entry." },
      { status: 404 },
    );
  }

  let assignedSubjects: Set<string> | null = null;
  if (role === "teacher") {
    const { data: assignments, error: assignmentsError } = await admin
      .from("teaching_assignments")
      .select("subject_name")
      .eq("teacher_id", user.id)
      .eq("class_name", exam.class_form);
    if (assignmentsError) {
      return NextResponse.json(
        { error: assignmentsError.message },
        { status: 500 },
      );
    }
    assignedSubjects = new Set(
      (assignments ?? []).map((assignment) => assignment.subject_name.trim().toLowerCase()),
    );
  }
  const { data: examSubjects, error: examSubjectsError } = await admin
    .from("exam_subjects")
    .select("subject_id")
    .eq("exam_id", exam.id);
  if (examSubjectsError) {
    return NextResponse.json({ error: examSubjectsError.message }, { status: 500 });
  }
  const examSubjectIds = (examSubjects ?? []).map((item) => item.subject_id);
  if (examSubjectIds.length === 0) {
    return NextResponse.json({ error: "No subjects are attached to this examination." }, { status: 409 });
  }

  const { data: subjectRows, error: subjectsError } = await admin
    .from("subjects")
    .select("id, name, subject_code, has_practical")
    .in("id", examSubjectIds)
    .order("name");
  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }
  const subjects =
    role === "teacher"
      ? (subjectRows ?? []).filter((subject) =>
          assignedSubjects?.has(subject.name.trim().toLowerCase()),
        )
      : subjectRows ?? [];
  if (subjects.length === 0) {
    return NextResponse.json({ exam, subjects: [] });
  }

  const subjectId = searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ exam, subjects });
  }
  if (!subjects.some((subject) => subject.id === subjectId)) {
    return NextResponse.json({ error: "This subject is not included in this examination." }, { status: 403 });
  }

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
  );
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 20),
  );
  const search = (searchParams.get("search") ?? "")
    .replace(/[,()%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const from = (page - 1) * pageSize;

  try {
    const { data: schoolClasses, error: classesError } = await admin
      .from("classes")
      .select("id")
      .eq("form", exam.class_form);
    if (classesError) {
      return NextResponse.json({ error: classesError.message }, { status: 500 });
    }
    const classIds = (schoolClasses ?? []).map((schoolClass) => schoolClass.id);
    if (classIds.length === 0) {
      return NextResponse.json({
        exam,
        subjects,
        students: [],
        marks: [],
        total: 0,
        overallTotal: 0,
        page: 1,
        pageSize,
        totalPages: 1,
      });
    }

    const { data: classSubject, error: classSubjectError } = await admin
      .from("class_subject_assignments")
      .select("is_compulsory")
      .eq("form", exam.class_form)
      .eq("subject_id", subjectId)
      .maybeSingle();
    if (classSubjectError) {
      return NextResponse.json(
        { error: classSubjectError.message },
        { status: 500 },
      );
    }
    if (!classSubject) {
      return NextResponse.json({
        exam,
        subjects,
        students: [],
        marks: [],
        total: 0,
        overallTotal: 0,
        page: 1,
        pageSize,
        totalPages: 1,
      });
    }

    type StudentRow = {
      id: string;
      full_name: string;
      class_id: string;
      sex: "F" | "M";
    };

    let students: StudentRow[] = [];
    let total = 0;
    let overallTotal = 0;

    if (classSubject.is_compulsory) {
      let listQuery = admin
        .from("students")
        .select("id, full_name, class_id, sex", { count: "exact" })
        .in("class_id", classIds);
      if (search) {
        listQuery = listQuery.ilike("full_name", `%${search}%`);
      }

      const [listResult, overallResult] = await Promise.all([
        listQuery
          .order("sex")
          .order("full_name")
          .order("id")
          .range(from, from + pageSize - 1),
        admin
          .from("students")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIds),
      ]);
      if (listResult.error || overallResult.error) {
        return NextResponse.json(
          { error: listResult.error?.message ?? overallResult.error?.message },
          { status: 500 },
        );
      }
      students = sortStudentsForDisplay((listResult.data ?? []) as StudentRow[]);
      total = listResult.count ?? 0;
      overallTotal = overallResult.count ?? 0;
    } else {
      let listQuery = admin
        .from("student_subjects")
        .select(
          "student_id, students!inner(id, full_name, class_id, sex)",
          { count: "exact" },
        )
        .eq("subject_id", subjectId)
        .in("students.class_id", classIds);
      if (search) {
        listQuery = listQuery.or(`full_name.ilike.%${search}%`, {
          referencedTable: "students",
        });
      }

      const [listResult, overallResult] = await Promise.all([
        listQuery
          .order("sex", { referencedTable: "students" })
          .order("full_name", { referencedTable: "students" })
          .order("student_id")
          .range(from, from + pageSize - 1),
        admin
          .from("student_subjects")
          .select("student_id, students!inner(id)", {
            count: "exact",
            head: true,
          })
          .eq("subject_id", subjectId)
          .in("students.class_id", classIds),
      ]);
      if (listResult.error || overallResult.error) {
        return NextResponse.json(
          { error: listResult.error?.message ?? overallResult.error?.message },
          { status: 500 },
        );
      }

      students = sortStudentsForDisplay(
        (listResult.data ?? []).flatMap((row) => {
          const embedded = row.students as unknown as
            | StudentRow
            | StudentRow[]
            | null;
          if (!embedded) return [];
          return [Array.isArray(embedded) ? embedded[0] : embedded];
        }),
      );
      total = listResult.count ?? 0;
      overallTotal = overallResult.count ?? 0;
    }

    const studentIds = students.map((student) => student.id);
    const { data: marks, error: marksError } = studentIds.length
      ? await admin
          .from("marks")
          .select("student_id, theory_score, practical_score, is_absent")
          .eq("exam_id", exam.id)
          .eq("subject_id", subjectId)
          .in("student_id", studentIds)
      : { data: [], error: null };
    if (marksError) {
      return NextResponse.json({ error: marksError.message }, { status: 500 });
    }

    return NextResponse.json({
      exam,
      subjects,
      students,
      marks: marks ?? [],
      total,
      overallTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load students for this subject.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getMarksContext();
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }
  const { user, role, admin } = context;

  let body: MarkInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const examId = typeof body.exam_id === "string" ? body.exam_id : "";
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : "";
  const requestedMarks = body.marks;
  const isBatch = Array.isArray(requestedMarks);
  const markInputs: unknown[] = isBatch ? requestedMarks : [body];
  if (!examId || !subjectId || markInputs.length === 0) {
    return NextResponse.json(
      { error: "Exam, subject, and at least one student mark are required." },
      { status: 400 },
    );
  }
  if (markInputs.length > 100) {
    return NextResponse.json(
      { error: "Save no more than 100 student marks at a time." },
      { status: 400 },
    );
  }
  if (!markInputs.every(isStudentMarkInput)) {
    return NextResponse.json({ error: "Invalid student mark data." }, { status: 400 });
  }
  const studentMarks = markInputs;
  const studentIds = studentMarks.map((mark) =>
    typeof mark.student_id === "string" ? mark.student_id : "",
  );
  if (studentIds.some((id) => !id) || new Set(studentIds).size !== studentIds.length) {
    return NextResponse.json(
      { error: "Each mark must have a unique student." },
      { status: 400 },
    );
  }

  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, class_form, start_date, end_date, has_practical, status")
    .eq("id", examId)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam || exam.status !== "Active") {
    return NextResponse.json({ error: "This examination is not active." }, { status: 403 });
  }

  let assignedSubjects: Set<string> | null = null;
  if (role === "teacher") {
    const { data: assignments, error: assignmentsError } = await admin
      .from("teaching_assignments")
      .select("subject_name")
      .eq("teacher_id", user.id)
      .eq("class_name", exam.class_form);
    if (assignmentsError) {
      return NextResponse.json(
        { error: assignmentsError.message },
        { status: 500 },
      );
    }
    assignedSubjects = new Set(
      (assignments ?? []).map((assignment) => assignment.subject_name.trim().toLowerCase()),
    );
  }
  const { data: examSubject, error: examSubjectError } = await admin
    .from("exam_subjects")
    .select("subject_id")
    .eq("exam_id", examId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (examSubjectError) {
    return NextResponse.json({ error: examSubjectError.message }, { status: 500 });
  }
  if (!examSubject) {
    return NextResponse.json({ error: "This subject is not included in the examination." }, { status: 400 });
  }

  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("name, has_practical")
    .eq("id", subjectId)
    .maybeSingle();
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 500 });
  if (!subject) {
    return NextResponse.json({ error: "This subject is not included in the examination." }, { status: 400 });
  }
  if (
    role === "teacher" &&
    !assignedSubjects?.has(subject.name.trim().toLowerCase())
  ) {
    return NextResponse.json(
      { error: "You are not assigned to teach this subject in this class." },
      { status: 403 },
    );
  }
  const subjectHasPractical = exam.has_practical && subject.has_practical;

  let eligibleStudents;
  try {
    eligibleStudents = await getEligibleStudents(admin, exam.class_form, subjectId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify student enrollment." },
      { status: 500 },
    );
  }
  const eligibleStudentIds = new Set(eligibleStudents.map((student) => student.id));
  const rows = [];
  for (const mark of studentMarks) {
    const studentId = mark.student_id as string;
    if (!eligibleStudentIds.has(studentId)) {
      return NextResponse.json(
        { error: `Student ${studentId} is not enrolled in the selected subject.` },
        { status: 403 },
      );
    }

    const isAbsent = mark.is_absent === true;
    const theory = isAbsent ? null : mark.theory_score;
    const practical = isAbsent ? null : mark.practical_score;
    if (!isAbsent && !isScore(theory, 100)) {
      return NextResponse.json(
        { error: `Theory marks must be between 0 and 100 for student ${studentId}.` },
        { status: 400 },
      );
    }
    if (subjectHasPractical) {
      if (!isAbsent && !isScore(practical, 50)) {
        return NextResponse.json(
          { error: `Practical marks must be between 0 and 50 for student ${studentId}.` },
          { status: 400 },
        );
      }
    } else if (mark.practical_score !== undefined && mark.practical_score !== null) {
      return NextResponse.json(
        { error: "This examination does not include practical marks." },
        { status: 400 },
      );
    }

    const theoryScore = isAbsent ? null : isScore(theory, 100) ? theory : null;
    const practicalScore =
      subjectHasPractical && !isAbsent && isScore(practical, 50)
        ? practical
        : null;
    if (!isAbsent && theoryScore === null) {
      return NextResponse.json(
        { error: `Theory marks are required for student ${studentId}.` },
        { status: 400 },
      );
    }
    if (subjectHasPractical && !isAbsent && practicalScore === null) {
      return NextResponse.json(
        { error: `Practical marks are required for student ${studentId}.` },
        { status: 400 },
      );
    }
    rows.push({
      exam_id: examId,
      subject_id: subjectId,
      student_id: studentId,
      theory_score: theoryScore,
      practical_score: practicalScore,
      total_score:
        isAbsent || theoryScore === null
          ? null
          : theoryScore + (practicalScore ?? 0),
      is_absent: isAbsent,
      entered_by: user.id,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: marks, error: markError } = await admin
    .from("marks")
    .upsert(
      rows,
      { onConflict: "exam_id,student_id,subject_id" },
    )
    .select("student_id, theory_score, practical_score, is_absent")
    ;
  if (markError) {
    return NextResponse.json({ error: markError.message }, { status: 500 });
  }

  if (!marks || marks.length !== rows.length) {
    return NextResponse.json(
      { error: "Not all student marks were saved. Please check and try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    isBatch ? { marks } : { mark: marks[0] },
  );
}
