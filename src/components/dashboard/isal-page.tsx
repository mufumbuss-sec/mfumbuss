import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortStudentsForDisplay } from "@/lib/student-sort";
import { ISALDocument } from "@/components/dashboard/isal-document";

async function ensureAuthorized() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (profile?.role !== "academic" && profile?.role !== "headmaster") {
    redirect("/dashboard");
  }

  return { user, role: profile?.role as "academic" | "headmaster" };
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
    .select("id, full_name, sex, class_id")
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

export async function ISALListPage({
  examId,
  dashboardBase,
}: {
  examId: string;
  dashboardBase: string;
}) {
  await ensureAuthorized();

  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date")
    .eq("id", examId)
    .maybeSingle();

  if (examError) throw new Error(examError.message);
  if (!exam) redirect(`${dashboardBase}/exams`);

  const { data: examSubjects, error: examSubjectsError } = await admin
    .from("exam_subjects")
    .select("subject_id")
    .eq("exam_id", examId);

  if (examSubjectsError) throw new Error(examSubjectsError.message);

  const subjectIds = (examSubjects ?? []).map((item) => item.subject_id);
  const { data: subjects, error: subjectsError } = subjectIds.length
    ? await admin
        .from("subjects")
        .select("id, name, subject_code")
        .in("id", subjectIds)
        .order("name")
    : { data: [], error: null };

  if (subjectsError) throw new Error(subjectsError.message);

  const subjectCounts: Record<string, number> = {};
  for (const subject of subjects ?? []) {
    const students = await getEligibleStudents(admin, exam.class_form, subject.id);
    subjectCounts[subject.id] = students.length;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Link
          href={`${dashboardBase}/exams`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to exams
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">ISAL</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{exam.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {exam.class_form} · {exam.term} · {exam.academic_year}
        </p>

        {(!subjects || subjects.length === 0) ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No subjects are registered for this examination.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href={`${dashboardBase}/exams/${exam.id}/isal/${subject.id}`}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {subject.subject_code ?? "SUBJECT"}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-slate-900 group-hover:text-blue-800">
                      {subject.name}
                    </h2>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                    {subjectCounts[subject.id] ?? 0}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">Open attendance list</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export async function ISALSubjectPage({
  examId,
  subjectId,
  dashboardBase,
}: {
  examId: string;
  subjectId: string;
  dashboardBase: string;
}) {
  await ensureAuthorized();

  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date")
    .eq("id", examId)
    .maybeSingle();

  if (examError) throw new Error(examError.message);
  if (!exam) redirect(`${dashboardBase}/exams`);

  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("id, name, subject_code")
    .eq("id", subjectId)
    .maybeSingle();

  if (subjectError) throw new Error(subjectError.message);
  if (!subject) redirect(`${dashboardBase}/exams/${exam.id}/isal`);

  const students = sortStudentsForDisplay(
    await getEligibleStudents(admin, exam.class_form, subject.id),
  );

  const { data: schoolSettings, error: schoolSettingsError } = await admin
    .from("school_settings")
    .select("school_name")
    .eq("id", 1)
    .maybeSingle();

  if (schoolSettingsError) throw new Error(schoolSettingsError.message);

  return (
    <ISALDocument
      exam={exam}
      subject={subject}
      students={students.map((student) => ({
        id: student.id ?? "",
        full_name: student.full_name ?? "",
        sex: student.sex ?? null,
      }))}
      schoolName={schoolSettings?.school_name ?? "School Name"}
      dashboardBase={dashboardBase}
    />
  );
}
