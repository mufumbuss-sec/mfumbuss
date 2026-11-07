import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function gradeFor(percentage: number) {
  const wholePercentage = Math.floor(percentage);
  if (wholePercentage >= 75) return "A";
  if (wholePercentage >= 65) return "B";
  if (wholePercentage >= 45) return "C";
  if (wholePercentage >= 30) return "D";
  return "F";
}

function bestSevenPoints(subjects: Array<{ percentage: number | null; points: number | null }>) {
  const ranked = [...subjects]
    .filter((subject) => subject.percentage !== null && subject.points !== null)
    .sort(
      (a, b) =>
        (b.percentage ?? 0) - (a.percentage ?? 0) ||
        (b.points ?? 0) - (a.points ?? 0),
    )
    .slice(0, 7);
  return ranked.reduce((sum, subject) => sum + (subject.points ?? 0), 0);
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

  const [
    { data: examSubjectRows, error: examSubjectsError },
    { data: classSubjectRows, error: classSubjectsError },
    { data: schoolClasses, error: classesError },
  ] = await Promise.all([
    admin.from("exam_subjects").select("subject_id").eq("exam_id", id),
    admin
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
  const examSubjectSet = new Set(examSubjectIds);
  const classSubjectSet = new Set(
    (classSubjectRows ?? []).map((assignment) => assignment.subject_id),
  );
  if (examSubjectIds.some((subjectId) => !classSubjectSet.has(subjectId))) {
    return NextResponse.json(
      { error: "An examination subject is not assigned to this class form." },
      { status: 409 },
    );
  }
  const { data: subjectRows, error: subjectRowsError } = await admin
    .from("subjects")
    .select("id, name, subject_code, has_practical")
    .in("id", examSubjectIds);
  if (subjectRowsError) {
    return NextResponse.json({ error: subjectRowsError.message }, { status: 500 });
  }
  const subjectById = new Map(
    (subjectRows ?? []).map((subject) => [subject.id, subject]),
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

  const expectedEntries = students.flatMap((student) =>
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
  if (expectedEntries.length === 0) {
    return NextResponse.json(
      { error: "No students are enrolled in the selected examination subjects." },
      { status: 400 },
    );
  }

  const { data: marks, error: marksError } = await admin
    .from("marks")
    .select("student_id, subject_id, theory_score, practical_score, is_absent")
    .eq("exam_id", id);
  if (marksError) return NextResponse.json({ error: marksError.message }, { status: 500 });
  const markMap = new Map(
    (marks ?? []).map((mark) => [
      `${mark.student_id}:${mark.subject_id}`,
      mark,
    ]),
  );
  const subjectNames = new Map(
    (subjectRows ?? []).map((subject) => [
      subject.id,
      { name: subject.name, code: subject.subject_code },
    ]),
  );

  const resultRows = students
    .filter((student) =>
      expectedEntries.some((entry) => entry.student_id === student.id),
    )
    .map((student) => {
    const breakdown = expectedEntries
      .filter((entry) => entry.student_id === student.id)
      .map(({ subject_id }) => {
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
            : gradeFor(percentage);
        const points =
          grade === "A" ? 1
          : grade === "B" ? 2
          : grade === "C" ? 3
          : grade === "D" ? 4
          : grade === "F" ? 5
          : null;
        return {
          subject_id,
          subject: subjectNames.get(subject_id)?.name ?? "Subject",
          code: subjectNames.get(subject_id)?.code ?? "",
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
      (subject) => !subject.missing && !subject.absent && subject.percentage !== null,
    );
    const totalMarks = satSubjects.reduce(
      (sum, subject) => sum + (subject.total ?? 0),
      0,
    );
    const average =
      satSubjects.length > 0
        ? Math.round(
            (satSubjects.reduce((sum, subject) => sum + (subject.percentage ?? 0), 0) /
              satSubjects.length) *
              100,
          ) / 100
        : null;
    const completedCount = satSubjects.length;
    const hasNoValidScores = completedCount === 0;
    const isIncomplete =
      !hasNoValidScores && completedCount < 7 && completedCount > 0;
    const bestSevenPointsValue = bestSevenPoints(satSubjects);
    const points = hasNoValidScores
      ? null
      : isIncomplete
        ? null
        : bestSevenPointsValue;
    const division = hasNoValidScores
      ? "ABS"
      : isIncomplete
        ? "INC"
        : points !== null && points >= 7 && points <= 17
          ? "DIV I"
          : points !== null && points >= 18 && points <= 21
            ? "DIV II"
            : points !== null && points >= 22 && points <= 25
              ? "DIV III"
              : points !== null && points >= 26 && points <= 33
                ? "DIV IV"
                : points !== null
                  ? "DIV 0"
                  : "INC";
    const grade = hasNoValidScores
      ? "ABS"
      : isIncomplete
        ? "INC"
        : average === null
          ? "—"
          : gradeFor(average);

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
        grade:
          hasNoValidScores
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
      (result) => result.average !== null && result.division !== "INC" && result.division !== "ABS",
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
    incomplete_count:
      summary.incomplete_count ?? fallbackIncompleteCount,
  });
}
