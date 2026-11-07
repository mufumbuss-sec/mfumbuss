import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  PenLine,
  Users,
} from "@/components/ui/lucide-icons";
import {
  DashboardHeader,
  EmptyState,
  ExamStatusBadge,
  SectionCard,
  StatCard,
  ViewAllLink,
  assertDashboardQueries,
  formatDashboardDate,
  formatNumber,
  requireDashboardCount,
} from "@/components/dashboard/overview";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type Assignment = {
  class_name: string;
  subject_name: string;
};

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: string;
};

type RecentMark = {
  id: string;
  total_score: number | null;
  is_absent: boolean | null;
  updated_at: string | null;
  exams: { name: string; class_form: string } | null;
  subjects: { name: string } | null;
  students: { full_name: string } | null;
};

export default async function TeacherDashboard() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const assignmentsRes = await admin
    .from("teaching_assignments")
    .select("class_name, subject_name")
    .eq("teacher_id", user.id)
    .order("class_name")
    .order("subject_name");
  assertDashboardQueries([
    { name: "teaching assignments", error: assignmentsRes.error },
  ]);

  const periodRes = await admin
    .from("academic_period_settings")
    .select("academic_year")
    .eq("id", 1)
    .maybeSingle();
  assertDashboardQueries([
    { name: "academic period", error: periodRes.error },
  ]);
  const activeYear = periodRes.data?.academic_year ?? "";

  const assignments = (assignmentsRes.data ?? []) as Assignment[];
  const forms = [...new Set(assignments.map((item) => item.class_name))];
  const subjectNames = [...new Set(assignments.map((item) => item.subject_name))];

  const examsQuery = () => {
    let query = admin
      .from("exams")
      .select(
        "id, name, class_form, term, academic_year, start_date, end_date, status",
      )
      .in("class_form", forms)
      .order("created_at", { ascending: false });
    if (activeYear) query = query.eq("academic_year", activeYear);
    return query.limit(6);
  };

  const marksCountQuery = () => {
    let query = admin
      .from("marks")
      .select("id, exams!inner(academic_year)", {
        count: "exact",
        head: true,
      })
      .eq("entered_by", user.id);
    if (activeYear) query = query.eq("exams.academic_year", activeYear);
    return query;
  };

  const recentMarksQuery = () => {
    let query = admin
      .from("marks")
      .select(
        "id, total_score, is_absent, updated_at, exams!inner(name, class_form, academic_year), subjects(name), students(full_name)",
      )
      .eq("entered_by", user.id)
      .order("updated_at", { ascending: false });
    if (activeYear) query = query.eq("exams.academic_year", activeYear);
    return query.limit(5);
  };

  const examCountQuery = (status: string) => {
    let query = admin
      .from("exams")
      .select("id", { count: "exact", head: true })
      .in("class_form", forms)
      .eq("status", status);
    if (activeYear) query = query.eq("academic_year", activeYear);
    return query;
  };

  const [
    examsRes,
    marksCountRes,
    recentMarksRes,
    classesRes,
    activeExamsCountRes,
    processedExamsCountRes,
  ] =
    await Promise.all([
      forms.length
        ? examsQuery()
        : Promise.resolve({ data: [] as Exam[], error: null }),
      marksCountQuery(),
      recentMarksQuery(),
      forms.length
        ? admin.from("classes").select("id, form").in("form", forms)
        : Promise.resolve({
            data: [] as Array<{ id: string; form: string }>,
            error: null,
          }),
      forms.length
        ? examCountQuery("Active")
        : Promise.resolve({ count: 0, error: null }),
      forms.length
        ? examCountQuery("Processed")
        : Promise.resolve({ count: 0, error: null }),
    ]);

  assertDashboardQueries([
    { name: "assigned examinations", error: examsRes.error },
    { name: "saved marks count", error: marksCountRes.error },
    { name: "recent marks", error: recentMarksRes.error },
    { name: "assigned classes", error: classesRes.error },
    { name: "active assigned examinations", error: activeExamsCountRes.error },
    {
      name: "processed assigned examinations",
      error: processedExamsCountRes.error,
    },
  ]);

  const exams = (examsRes.data ?? []) as Exam[];
  const recentMarks = (recentMarksRes.data ?? []) as unknown as RecentMark[];
  const classRows = classesRes.data ?? [];

  const studentCountsByForm = await Promise.all(
    forms.map(async (form) => {
      const formClassIds = classRows
        .filter((schoolClass) => schoolClass.form === form)
        .map((schoolClass) => schoolClass.id);
      if (formClassIds.length === 0) return [form, 0] as const;

      const studentCountRes = await admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", formClassIds);
      assertDashboardQueries([
        { name: `students in ${form}`, error: studentCountRes.error },
      ]);
      return [
        form,
        requireDashboardCount(studentCountRes.count, `students in ${form}`),
      ] as const;
    }),
  );
  const studentsByForm = new Map(studentCountsByForm);
  const totalStudents = studentCountsByForm.reduce(
    (total, [, count]) => total + count,
    0,
  );
  const marksSavedCount = requireDashboardCount(marksCountRes.count, "saved marks");
  const activeExamsCount = requireDashboardCount(
    activeExamsCountRes.count,
    "active assigned examinations",
  );
  const processedExamsCount = requireDashboardCount(
    processedExamsCountRes.count,
    "processed assigned examinations",
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DashboardHeader
        eyebrow="Teaching overview"
        title="My dashboard"
        description={
          assignments.length > 0
            ? `You teach ${subjectNames.length} subject(s) across ${forms.length} class form(s). This overview shows the examinations and marks stored against your account.`
            : "Your teaching assignments, examinations and saved marks will appear here once they are registered."
        }
        icon={BookOpen}
      >
        {assignments.length > 0 ? (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white">
            <PenLine className="h-4 w-4" />
            {formatNumber(marksSavedCount)} marks saved
          </span>
        ) : null}
      </DashboardHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My classes"
          value={formatNumber(forms.length)}
          icon={BookOpen}
          tone="blue"
          hint="Class forms assigned to you"
        />
        <StatCard
          label="My subjects"
          value={formatNumber(subjectNames.length)}
          icon={ClipboardList}
          tone="emerald"
          hint="Subjects you teach"
        />
        <StatCard
          label="Students"
          value={formatNumber(totalStudents)}
          icon={GraduationCap}
          tone="violet"
          hint="Learners in your assigned forms"
        />
        <StatCard
          label="Marks saved"
          value={formatNumber(marksSavedCount)}
          icon={FileText}
          tone="amber"
          hint="Marks entered by your account"
        />
      </section>

      <div className="space-y-5">
        <SectionCard
          title="My examinations"
          description={`${formatNumber(activeExamsCount)} active · ${formatNumber(processedExamsCount)} processed`}
          action={
            <ViewAllLink href="/dashboard/teacher/exams" label="All exams" />
          }
        >
          {exams.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No examinations for your classes"
              description="Examinations created for your assigned class forms will appear here."
            />
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <article
                  key={exam.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">
                          {exam.name}
                        </h4>
                        <ExamStatusBadge status={exam.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {exam.class_form} · {exam.academic_year} · {exam.term}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDashboardDate(exam.start_date)} —{" "}
                        {formatDashboardDate(exam.end_date)}
                      </p>
                    </div>
                    {exam.status === "Active" ? (
                      <a
                        href="/dashboard/teacher/exams"
                        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white transition hover:bg-blue-800"
                      >
                        <ClipboardList className="h-4 w-4" />
                        My exams
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Teaching assignments"
          description="Classes and subjects registered to your account"
        >
          {assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Ask the academic office to assign your classes and subjects."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.map((assignment) => (
                <div
                  key={`${assignment.class_name}:${assignment.subject_name}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {assignment.subject_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {assignment.class_name}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <Users className="h-3.5 w-3.5" />
                    {formatNumber(studentsByForm.get(assignment.class_name) ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recently saved marks"
        description="The last marks saved from your account"
        action={
          <ViewAllLink href="/dashboard/teacher/exams" label="My exams" />
        }
      >
        {recentMarks.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No marks saved yet"
            description="Saved marks will be listed here with the student, subject and examination."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4 font-semibold">Student</th>
                  <th className="pb-3 pr-4 font-semibold">Subject</th>
                  <th className="pb-3 pr-4 font-semibold">Examination</th>
                  <th className="pb-3 pr-4 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMarks.map((mark) => (
                  <tr key={mark.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900">
                        {mark.students?.full_name ?? "Unknown student"}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {mark.subjects?.name ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-slate-700">
                        {mark.exams?.name ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {mark.exams?.class_form ?? ""}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      {mark.is_absent ? (
                        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                          Absent
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-900">
                          {mark.total_score === null
                            ? "—"
                            : formatNumber(Number(mark.total_score))}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {formatDashboardDate(mark.updated_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
