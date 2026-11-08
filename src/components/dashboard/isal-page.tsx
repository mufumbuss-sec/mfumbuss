import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, ClipboardList } from "@/components/ui/lucide-icons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortStudentsForDisplay } from "@/lib/student-sort";
import { ISALDocument } from "@/components/dashboard/isal-document";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="ISAL"
        subtitle="Subject attendance lists for this examination."
        action={
          <Link
            href={`${dashboardBase}/exams`}
            className="app-btn app-btn-secondary"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to exams
          </Link>
        }
      />

      <section className="app-card">
        <div className="app-card-header border-b border-line pb-4">
          <div className="min-w-0">
            <h2 className="app-card-title">{exam.name}</h2>
            <p className="app-card-subtitle">
              {exam.class_form} · {exam.term} · {exam.academic_year}
            </p>
          </div>
        </div>

        <div className="app-card-body">
          {!subjects || subjects.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No subjects registered"
              description="Add subjects to this examination to open attendance lists."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`${dashboardBase}/exams/${exam.id}/isal/${subject.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-line bg-white p-4 text-left transition hover:border-brand-light hover:bg-brand-tint"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {subject.subject_code ?? "Subject"}
                    </p>
                    <h3 className="mt-1 text-[15px] font-bold text-ink group-hover:text-brand-dark">
                      {subject.name}
                    </h3>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    Open attendance list
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
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
