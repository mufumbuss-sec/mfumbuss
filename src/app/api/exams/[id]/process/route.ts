import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const A_LEVEL_FORMS = new Set(["Form V", "Form VI"]);

type SubjectInfo = {
  id: string;
  name: string;
  code: string;
  has_practical: boolean;
  subject_type: string | null;
};

function gradeFor(percentage: number, aLevel: boolean) {
  const wholePercentage = Math.floor(percentage);
  if (aLevel) {
    if (wholePercentage >= 80) return "A";
    if (wholePercentage >= 70) return "B";
    if (wholePercentage >= 60) return "C";
    if (wholePercentage >= 50) return "D";
    if (wholePercentage >= 40) return "E";
    if (wholePercentage >= 35) return "S";
    return "F";
  }
  if (wholePercentage >= 75) return "A";
  if (wholePercentage >= 65) return "B";
  if (wholePercentage >= 45) return "C";
  if (wholePercentage >= 30) return "D";
  return "F";
}

function pointsForGrade(grade: string, aLevel: boolean) {
  const points = aLevel
    ? ({ A: 1, B: 2, C: 3, D: 4, E: 5, S: 6, F: 7 } as Record<string, number>)
    : ({ A: 1, B: 2, C: 3, D: 4, F: 5 } as Record<string, number>);
  return points[grade] ?? null;
}

function bestPoints(
  subjects: Array<{ percentage: number | null; points: number | null }>,
  count: number,
  aLevel: boolean,
) {
  const ranked = [...subjects]
    .filter((subject) => subject.percentage !== null && subject.points !== null)
    .sort((a, b) =>
      aLevel
        ? (a.points ?? 99) - (b.points ?? 99) ||
          (b.percentage ?? 0) - (a.percentage ?? 0)
        : (b.percentage ?? 0) - (a.percentage ?? 0) ||
          (b.points ?? 0) - (a.points ?? 0),
    )
    .slice(0, count);
  return ranked.reduce((sum, subject) => sum + (subject.points ?? 0), 0);
}

function divisionFor(points: number, aLevel: boolean) {
  if (aLevel) {
    if (points >= 3 && points <= 9) return "DIV I";
    if (points >= 10 && points <= 12) return "DIV II";
    if (points >= 13 && points <= 17) return "DIV III";
    if (points >= 18 && points <= 19) return "DIV IV";
    return "DIV 0";
  }
  if (points >= 7 && points <= 17) return "DIV I";
  if (points >= 18 && points <= 21) return "DIV II";
  if (points >= 22 && points <= 25) return "DIV III";
  if (points >= 26 && points <= 33) return "DIV IV";
  return "DIV 0";
}

export async function POST(_request: Request, { params }: RouteContext) {
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

  const { id } = await params;
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, has_practical, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  if (exam.status !== "Active") {
    return NextResponse.json(
      { error: "Only active examinations can be processed." },
      { status: 409 },
    );
  }

  const isALevel = A_LEVEL_FORMS.has(exam.class_form);
  const examSubjectTable = isALevel ? "a_level_exam_subjects" : "exam_subjects";
  const marksTable = isALevel ? "a_level_marks" : "marks";

  const [
    { data: examSubjectRows, error: examSubjectsError },
    { data: classSubjectRows, error: classSubjectsError },
    { data: schoolClasses, error: classesError },
  ] = await Promise.all([
    admin.from(examSubjectTable).select("subject_id").eq("exam_id", id),
    isALevel
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("class_subject_assignments")
          .select("subject_id, is_compulsory")
          .eq("form", exam.class_form),
    admin.from("classes").select("id").eq("form", exam.class_form),
  ]);
  const queryError = examSubjectsError || classSubjectsError || classesError;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const examSubjectIds = [
    ...new Set((examSubjectRows ?? []).map((row) => row.subject_id)),
  ];
  if (examSubjectIds.length === 0) {
    return NextResponse.json(
      { error: "Add at least one subject before processing results." },
      { status: 400 },
    );
  }

  if (!isALevel) {
    const classSubjectSet = new Set(
      (classSubjectRows ?? []).map((assignment) => assignment.subject_id),
    );
    if (examSubjectIds.some((subjectId) => !classSubjectSet.has(subjectId))) {
      return NextResponse.json(
        { error: "An examination subject is not assigned to this class form." },
        { status: 409 },
      );
    }
  }

  let subjectRows: SubjectInfo[] = [];
  if (isALevel) {
    const { data, error } = await admin
      .from("a_level_subjects")
      .select("id, name, code, has_practical, subject_type")
      .in("id", examSubjectIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    subjectRows = (data ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      has_practical: Boolean(subject.has_practical),
      subject_type: subject.subject_type,
    }));
  } else {
    const { data, error } = await admin
      .from("subjects")
      .select("id, name, subject_code, has_practical")
      .in("id", examSubjectIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    subjectRows = (data ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.subject_code,
      has_practical: Boolean(subject.has_practical),
      subject_type: null,
    }));
  }
  const subjectById = new Map<string, SubjectInfo>(
    subjectRows.map((subject) => [subject.id, subject]),
  );
  const subjectHasPractical = (subjectId: string) =>
    Boolean(exam.has_practical && subjectById.get(subjectId)?.has_practical);

  const classIds = (schoolClasses ?? []).map((schoolClass) => schoolClass.id);
  if (classIds.length === 0) {
    return NextResponse.json(
      { error: "There are no classes or students for this form." },
      { status: 400 },
    );
  }

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id, full_name, class_id")
    .in("class_id", classIds)
    .order("full_name");
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }
  if (!students?.length) {
    return NextResponse.json(
      { error: "There are no students to process for this examination." },
      { status: 400 },
    );
  }

  let expectedEntries: Array<{ student_id: string; subject_id: string }> = [];
  if (isALevel) {
    const { data: enrollments, error: enrollmentError } = await admin
      .from("a_level_student_subjects")
      .select("student_id, subject_id")
      .in(
        "student_id",
        students.map((student) => student.id),
      )
      .in("subject_id", examSubjectIds);
    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }
    expectedEntries = enrollments ?? [];
  } else {
    const examSubjectSet = new Set(examSubjectIds);
    const optionalSubjectIds = (classSubjectRows ?? [])
      .filter((assignment) => !assignment.is_compulsory)
      .map((assignment) => assignment.subject_id)
      .filter((subjectId) => examSubjectSet.has(subjectId));
    const { data: optionalEnrollments, error: enrollmentError } =
      optionalSubjectIds.length > 0
        ? await admin
            .from("student_subjects")
            .select("student_id, subject_id")
            .in(
              "student_id",
              students.map((student) => student.id),
            )
            .in("subject_id", optionalSubjectIds)
        : { data: [], error: null };
    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }
    const enrollmentSet = new Set(
      (optionalEnrollments ?? []).map(
        (item) => `${item.student_id}:${item.subject_id}`,
      ),
    );
    expectedEntries = students.flatMap((student) =>
      examSubjectIds
        .filter((subjectId) => {
          const classSubject = classSubjectRows?.find(
            (assignment) => assignment.subject_id === subjectId,
          );
          return (
            classSubject?.is_compulsory ||
            enrollmentSet.has(`${student.id}:${subjectId}`)
          );
        })
        .map((subjectId) => ({ student_id: student.id, subject_id: subjectId })),
    );
  }

  if (expectedEntries.length === 0) {
    return NextResponse.json(
      { error: "No students are enrolled in the selected examination subjects." },
      { status: 400 },
    );
  }

  // Supabase/PostgREST caps a single select at 1000 rows, so a subject whose
  // marks fall beyond that window (e.g. History) would be treated as missing.
  // Fetch all marks page by page with a stable order.
  const markPageSize = 1000;
  const marks: Array<{
    student_id: string;
    subject_id: string;
    theory_score: number | null;
    practical_score: number | null;
    is_absent: boolean;
  }> = [];
  for (let from = 0; ; from += markPageSize) {
    const { data, error: marksError } = await admin
      .from(marksTable)
      .select("student_id, subject_id, theory_score, practical_score, is_absent")
      .eq("exam_id", id)
      .order("student_id")
      .order("subject_id")
      .range(from, from + markPageSize - 1);
    if (marksError) {
      return NextResponse.json({ error: marksError.message }, { status: 500 });
    }
    const page = (data ?? []) as typeof marks;
    marks.push(...page);
    if (page.length < markPageSize) break;
  }
  const markMap = new Map(
    marks.map((mark) => [
      `${mark.student_id}:${mark.subject_id}`,
      mark,
    ]),
  );

  const requiredSubjects = isALevel ? 3 : 7;
  const resultRows = students
    .filter((student) =>
      expectedEntries.some((entry) => entry.student_id === student.id),
    )
    .map((student) => {
      const breakdown = expectedEntries
        .filter((entry) => entry.student_id === student.id)
        .map(({ subject_id }) => {
          const subject = subjectById.get(subject_id);
          const mark = markMap.get(`${student.id}:${subject_id}`);
          const hasPractical = subjectHasPractical(subject_id);
          const missing =
            !mark ||
            (!mark.is_absent &&
              (mark.theory_score === null ||
                (hasPractical && mark.practical_score === null)));
          const sat = Boolean(mark && !mark.is_absent && !missing);
          const rawTotal = sat
            ? Number(mark?.theory_score) +
              Number(hasPractical ? mark?.practical_score ?? 0 : 0)
            : null;
          const maximum = hasPractical ? 150 : 100;
          const percentage =
            rawTotal === null
              ? null
              : Math.round((rawTotal / maximum) * 10000) / 100;
          const grade =
            percentage === null
              ? mark?.is_absent || missing
                ? "X"
                : "—"
              : gradeFor(percentage, isALevel);
          const points = pointsForGrade(grade, isALevel);
          return {
            subject_id,
            subject: subject?.name ?? "Subject",
            code: subject?.code ?? "",
            subject_type: subject?.subject_type ?? null,
            has_practical: hasPractical,
            theory: sat ? mark?.theory_score ?? null : null,
            practical: sat && hasPractical ? mark?.practical_score ?? null : null,
            total: rawTotal,
            percentage,
            grade,
            points,
            absent: mark?.is_absent ?? false,
            missing,
          };
        });
      const satSubjects = breakdown.filter(
        (subject) =>
          !subject.missing && !subject.absent && subject.percentage !== null,
      );
      // A-Level divisions use the best three principal (CORE/ADDITIONAL_CORE)
      // subjects. Subsidiary subjects are compulsory but do not add points.
      const countableSubjects = isALevel
        ? satSubjects.filter((subject) => subject.subject_type !== "SUBSIDIARY")
        : satSubjects;
      const totalMarks = satSubjects.reduce(
        (sum, subject) => sum + (subject.total ?? 0),
        0,
      );
      const average =
        satSubjects.length > 0
          ? Math.round(
              (satSubjects.reduce(
                (sum, subject) => sum + (subject.percentage ?? 0),
                0,
              ) /
                satSubjects.length) *
                100,
            ) / 100
          : null;
      const completedCount = countableSubjects.length;
      const hasNoValidScores = satSubjects.length === 0;
      const isIncomplete =
        !hasNoValidScores && completedCount < requiredSubjects;
      const bestPointsValue = bestPoints(
        countableSubjects,
        requiredSubjects,
        isALevel,
      );
      const points = hasNoValidScores || isIncomplete ? null : bestPointsValue;
      const division = hasNoValidScores
        ? "ABS"
        : isIncomplete
          ? "INC"
          : points !== null
            ? divisionFor(points, isALevel)
            : "INC";
      const grade = hasNoValidScores
        ? "ABS"
        : isIncomplete
          ? "INC"
          : average === null
            ? "—"
            : gradeFor(average, isALevel);

      return {
        exam_id: id,
        student_id: student.id,
        total_marks: hasNoValidScores ? 0 : totalMarks,
        average: hasNoValidScores || isIncomplete ? null : average,
        grade,
        division,
        points,
        is_incomplete: hasNoValidScores || isIncomplete,
        subject_breakdown: breakdown.map((subject) => ({
          ...subject,
          grade: hasNoValidScores
            ? "X"
            : subject.absent || subject.missing
              ? "ABS"
              : subject.grade,
        })),
        computed_at: new Date().toISOString(),
      };
    });

  const sortedRows = [...resultRows]
    .filter(
      (result) =>
        result.average !== null &&
        result.division !== "INC" &&
        result.division !== "ABS",
    )
    .sort(
      (a, b) =>
        (b.average ?? -1) - (a.average ?? -1) ||
        (a.points ?? 0) - (b.points ?? 0) ||
        a.student_id.localeCompare(b.student_id),
    );
  let previousAverage: number | null = null;
  let previousPosition = 0;
  const rankedRows = sortedRows.map((result, index) => {
    const position =
      result.average !== null && result.average === previousAverage
        ? previousPosition
        : result.average === null
          ? null
          : index + 1;
    if (result.average !== null) {
      previousAverage = result.average;
      previousPosition = position ?? index + 1;
    }
    return { ...result, position };
  });
  const { data: finalized, error: finalizeError } = await admin.rpc(
    "finalize_exam_results",
    {
      p_exam_id: id,
      p_user_id: user.id,
      p_results: rankedRows,
    },
  );
  if (finalizeError) {
    const message = finalizeError.message || "Unable to process examination results.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only active")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const summary = (finalized ?? {}) as {
    results_count?: number;
    incomplete_count?: number;
  };

  const fallbackIncompleteCount = resultRows.filter(
    (result) =>
      result.is_incomplete ||
      result.division === "INC" ||
      result.division === "ABS",
  ).length;

  return NextResponse.json({
    exam: { id, status: "Processed" },
    results_count: summary.results_count ?? rankedRows.length,
    incomplete_count: summary.incomplete_count ?? fallbackIncompleteCount,
  });
}
