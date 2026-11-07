import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Layers,
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
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type ExamStatus = "Draft" | "Active" | "Processed";

const statusTones: Record<ExamStatus, string> = {
  Draft: "bg-amber-500",
  Active: "bg-emerald-500",
  Processed: "bg-violet-500",
};

export default async function AcademicDashboard() {
  const admin = createAdminClient();

  const periodRes = await admin
    .from("academic_period_settings")
    .select("academic_year, term")
    .eq("id", 1)
    .maybeSingle();
  assertDashboardQueries([
    { name: "academic period", error: periodRes.error },
  ]);
  const period = periodRes.data ?? null;
  const activeYear = period?.academic_year ?? "";

  const examCountQuery = (status: ExamStatus) => {
    let query = admin
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (activeYear) query = query.eq("academic_year", activeYear);
    return query;
  };

  const recentExamsQuery = () => {
    let query = admin
      .from("exams")
      .select(
        "id, name, class_form, term, academic_year, start_date, end_date, status",
      )
      .order("created_at", { ascending: false });
    if (activeYear) query = query.eq("academic_year", activeYear);
    return query.limit(6);
  };

  const yearScopedMarksQuery = () => {
    let query = admin
      .from("marks")
      .select("id, exams!inner(academic_year)", { count: "exact", head: true });
    if (activeYear) query = query.eq("exams.academic_year", activeYear);
    return query;
  };

  const yearScopedResultsQuery = () => {
    let query = admin
      .from("exam_results")
      .select("id, exams!inner(academic_year)", { count: "exact", head: true });
    if (activeYear) query = query.eq("exams.academic_year", activeYear);
    return query;
  };

  const [
    classesRes,
    subjectsRes,
    teachersRes,
    studentsRes,
    draftRes,
    activeRes,
    processedRes,
    recentExamsRes,
    marksRes,
    resultsRes,
    allocationsRes,
    assignmentsRes,
  ] = await Promise.all([
    admin.from("classes").select("id", { count: "exact", head: true }),
    admin.from("subjects").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher"),
    admin.from("students").select("id", { count: "exact", head: true }),
    examCountQuery("Draft"),
    examCountQuery("Active"),
    examCountQuery("Processed"),
    recentExamsQuery(),
    yearScopedMarksQuery(),
    yearScopedResultsQuery(),
    admin
      .from("class_subject_assignments")
      .select("id", { count: "exact", head: true }),
    admin
      .from("teaching_assignments")
      .select("id", { count: "exact", head: true }),
  ]);

  assertDashboardQueries([
    { name: "classes", error: classesRes.error },
    { name: "subjects", error: subjectsRes.error },
    { name: "teachers", error: teachersRes.error },
    { name: "students", error: studentsRes.error },
    { name: "draft examinations", error: draftRes.error },
    { name: "active examinations", error: activeRes.error },
    { name: "processed examinations", error: processedRes.error },
    { name: "recent examinations", error: recentExamsRes.error },
    { name: "marks", error: marksRes.error },
    { name: "exam results", error: resultsRes.error },
    { name: "subject allocations", error: allocationsRes.error },
    { name: "teaching assignments", error: assignmentsRes.error },
  ]);

  const classCount = requireDashboardCount(classesRes.count, "classes");
  const subjectCount = requireDashboardCount(subjectsRes.count, "subjects");
  const teacherCount = requireDashboardCount(teachersRes.count, "teachers");
  const studentCount = requireDashboardCount(studentsRes.count, "students");
  const draftCount = requireDashboardCount(draftRes.count, "draft examinations");
  const activeCount = requireDashboardCount(activeRes.count, "active examinations");
  const processedCount = requireDashboardCount(processedRes.count, "processed examinations");
  const totalExams = draftCount + activeCount + processedCount;
  const recentExams = recentExamsRes.data ?? [];

  const statusItems: Array<{ label: ExamStatus; count: number }> = [
    { label: "Draft", count: draftCount },
    { label: "Active", count: activeCount },
    { label: "Processed", count: processedCount },
  ];

  const snapshot = [
    {
      label: "Marks entered",
      value: requireDashboardCount(marksRes.count, "marks"),
      icon: FileText,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Results computed",
      value: requireDashboardCount(resultsRes.count, "exam results"),
      icon: Database,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Subject allocations",
      value: requireDashboardCount(allocationsRes.count, "subject allocations"),
      icon: Layers,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Teaching assignments",
      value: requireDashboardCount(assignmentsRes.count, "teaching assignments"),
      icon: ClipboardList,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DashboardHeader
        eyebrow="Academic overview"
        title="Academic dashboard"
        description={
          period
            ? `Live academic data for the ${period.academic_year} ${period.term} academic period. Counts and recent activity come straight from the database.`
            : "Live academic data read directly from the database."
        }
        icon={GraduationCap}
      >
        <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white">
          <CalendarDays className="h-4 w-4" />
          {period ? `${period.academic_year} · ${period.term}` : "No active period"}
        </span>
      </DashboardHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Classes"
          value={formatNumber(classCount)}
          icon={BookOpen}
          tone="blue"
          hint="Forms and streams"
        />
        <StatCard
          label="Subjects"
          value={formatNumber(subjectCount)}
          icon={ClipboardList}
          tone="emerald"
          hint="Curriculum subjects"
        />
        <StatCard
          label="Teachers"
          value={formatNumber(teacherCount)}
          icon={Users}
          tone="violet"
          hint="Registered teaching staff"
        />
        <StatCard
          label="Students"
          value={formatNumber(studentCount)}
          icon={GraduationCap}
          tone="amber"
          hint="All registered learners"
        />
      </section>

      <div className="space-y-5">
        <SectionCard
          title="Recent examinations"
          description="Latest examinations with their current workflow status"
          action={
            <ViewAllLink
              href="/dashboard/academic/exams"
              label="Exam management"
            />
          }
        >
          {recentExams.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No examinations yet"
              description="Create an examination to start collecting marks from teachers."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-4 font-semibold">Examination</th>
                    <th className="pb-3 pr-4 font-semibold">Class</th>
                    <th className="pb-3 pr-4 font-semibold">Period</th>
                    <th className="pb-3 pr-4 font-semibold">Dates</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentExams.map((exam) => (
                    <tr key={exam.id} className="align-top">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">
                          {exam.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {exam.academic_year} · {exam.term}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {exam.class_form}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{exam.term}</td>
                      <td className="py-3 pr-4 text-xs leading-5 text-slate-500">
                        {formatDashboardDate(exam.start_date)}
                        <br />
                        {formatDashboardDate(exam.end_date)}
                      </td>
                      <td className="py-3">
                        <ExamStatusBadge status={exam.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="Examination pipeline"
            description={`${formatNumber(totalExams)} examination(s) in total`}
          >
            <div className="space-y-4">
              {statusItems.map((item) => {
                const percentage =
                  totalExams > 0 ? Math.round((item.count / totalExams) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {item.label}
                      </span>
                      <span className="font-semibold text-slate-950">
                        {formatNumber(item.count)}
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          ({percentage}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${statusTones[item.label]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {activeCount > 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                {formatNumber(activeCount)} examination(s) are open for mark
                entry.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Database snapshot"
            description="Records currently stored in the system"
          >
            <div className="grid grid-cols-2 gap-3">
              {snapshot.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-xl font-bold text-slate-950">
                      {formatNumber(item.value)}
                    </p>
                    <p className="text-[11px] font-medium leading-4 text-slate-500">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
