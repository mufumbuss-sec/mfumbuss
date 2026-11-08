import {
  CalendarDays,
  FileText,
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

const DIVISIONS = ["DIV I", "DIV II", "DIV III", "DIV IV", "DIV 0"];

type ExamStatus = "Draft" | "Active" | "Processed";

const statusTones: Record<ExamStatus, string> = {
  Draft: "bg-amber-500",
  Active: "bg-emerald-500",
  Processed: "bg-violet-500",
};

export default async function HeadmasterDashboard() {
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

  const latestProcessedQuery = () => {
    let query = admin
      .from("exams")
      .select("id, name, class_form, term, academic_year, processed_at")
      .eq("status", "Processed");
    if (activeYear) query = query.eq("academic_year", activeYear);
    return query.order("processed_at", { ascending: false }).limit(1).maybeSingle();
  };

  const [
    teachersRes,
    studentsRes,
    classesRes,
    subjectsRes,
    draftRes,
    activeRes,
    processedRes,
    recentExamsRes,
    latestProcessedRes,
    auditRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher"),
    admin.from("students").select("id", { count: "exact", head: true }),
    admin.from("classes").select("id", { count: "exact", head: true }),
    admin.from("subjects").select("id", { count: "exact", head: true }),
    examCountQuery("Draft"),
    examCountQuery("Active"),
    examCountQuery("Processed"),
    recentExamsQuery(),
    latestProcessedQuery(),
    admin
      .from("exam_audit_logs")
      .select("id", { count: "exact", head: true }),
  ]);

  assertDashboardQueries([
    { name: "teachers", error: teachersRes.error },
    { name: "students", error: studentsRes.error },
    { name: "classes", error: classesRes.error },
    { name: "subjects", error: subjectsRes.error },
    { name: "draft examinations", error: draftRes.error },
    { name: "active examinations", error: activeRes.error },
    { name: "processed examinations", error: processedRes.error },
    { name: "recent examinations", error: recentExamsRes.error },
    { name: "latest processed examination", error: latestProcessedRes.error },
    { name: "audit log", error: auditRes.error },
  ]);

  const teacherCount = requireDashboardCount(teachersRes.count, "teachers");
  const studentCount = requireDashboardCount(studentsRes.count, "students");
  const classCount = requireDashboardCount(classesRes.count, "classes");
  const subjectCount = requireDashboardCount(subjectsRes.count, "subjects");
  const draftCount = requireDashboardCount(draftRes.count, "draft examinations");
  const activeCount = requireDashboardCount(activeRes.count, "active examinations");
  const processedCount = requireDashboardCount(processedRes.count, "processed examinations");
  const totalExams = draftCount + activeCount + processedCount;
  const recentExams = recentExamsRes.data ?? [];
  const latestProcessedExam = latestProcessedRes.data ?? null;

  const latestResults: Array<{ division: string | null; average: number | null }> = [];
  let latestResultsCount = 0;
  if (latestProcessedExam) {
    const resultCount = await admin
      .from("exam_results")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", latestProcessedExam.id);
    assertDashboardQueries([{ name: "latest exam result count", error: resultCount.error }]);
    latestResultsCount = requireDashboardCount(resultCount.count, "latest exam results");

    for (let offset = 0; offset < latestResultsCount; offset += 1000) {
      const resultPage = await admin
        .from("exam_results")
        .select("division, average")
        .eq("exam_id", latestProcessedExam.id)
        .order("student_id")
        .range(offset, offset + 999);
      assertDashboardQueries([{ name: "latest exam results", error: resultPage.error }]);
      latestResults.push(...(resultPage.data ?? []));
    }
    if (latestResults.length !== latestResultsCount) {
      throw new Error("Latest exam results changed while the dashboard was loading.");
    }
  }

  const divisionCounts = [...DIVISIONS, "INC", "ABS"].map((division) => ({
    division,
    count: latestResults.filter((result) => result.division === division).length,
  }));
  const completedResults = latestResults.filter(
    (result) =>
      result.division !== "Incomplete" &&
      result.division !== "INC" &&
      result.division !== "ABS",
  ).length;
  const incompleteResults = latestResults.length - completedResults;
  const averages = latestResults
    .map((result) => result.average)
    .filter((value): value is number => value !== null);
  const overallAverage =
    averages.length > 0
      ? averages.reduce((sum, value) => sum + value, 0) / averages.length
      : null;
  const bestDivision = divisionCounts.reduce(
    (best, item) => (item.count > best.count ? item : best),
    divisionCounts[0],
  );

  const statusItems: Array<{ label: ExamStatus; count: number }> = [
    { label: "Draft", count: draftCount },
    { label: "Active", count: activeCount },
    { label: "Processed", count: processedCount },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DashboardHeader
        title="School dashboard"
        description={
          period
            ? `Live data for ${period.academic_year} · ${period.term}.`
            : "Live data from the school database."
        }
      >
        <span className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-4 text-sm font-semibold text-ink">
          <CalendarDays className="h-4 w-4 text-brand" />
          {period ? `${period.academic_year} · ${period.term}` : "No active period"}
        </span>
      </DashboardHeader>

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Teachers"
          value={formatNumber(teacherCount)}
          hint="Registered teaching staff"
        />
        <StatCard
          label="Students"
          value={formatNumber(studentCount)}
          hint="All registered learners"
        />
        <StatCard
          label="Classes"
          value={formatNumber(classCount)}
          hint="Forms and streams"
        />
        <StatCard
          label="Subjects"
          value={formatNumber(subjectCount)}
          hint="Subjects in the curriculum"
        />
      </section>

      <div className="space-y-5">
        <SectionCard
          title="Recent examinations"
          description="The latest examinations created in the system"
          action={
            <ViewAllLink
              href="/dashboard/headmaster/exams"
              label="Exam management"
            />
          }
        >
          {recentExams.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No examinations yet"
              description="Create an examination to begin collecting marks and results."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="app-table min-w-[620px]">
                <thead>
                  <tr>
                    <th>Examination</th>
                    <th>Class</th>
                    <th>Period</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.map((exam) => (
                    <tr key={exam.id}>
                      <td>
                        <p className="font-semibold text-ink">
                          {exam.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {exam.academic_year} · {exam.term}
                        </p>
                      </td>
                      <td className="text-ink-soft">{exam.class_form}</td>
                      <td className="text-ink-soft">{exam.term}</td>
                      <td className="text-xs leading-5 text-muted">
                        {formatDashboardDate(exam.start_date)}
                        <br />
                        {formatDashboardDate(exam.end_date)}
                      </td>
                      <td>
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
            <div className="mt-5 flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-xs">
              <span className="text-slate-500">Audit log entries</span>
              <span className="font-semibold text-slate-800">
                {formatNumber(requireDashboardCount(auditRes.count, "audit log"))}
              </span>
            </div>
          </SectionCard>

          <SectionCard
            title="Latest results snapshot"
            description={
              latestProcessedExam
                ? `${latestProcessedExam.name} · ${latestProcessedExam.class_form}`
                : "Processed examination results"
            }
            action={
              latestProcessedExam ? (
                <ViewAllLink
                  href={`/dashboard/headmaster/exams/${latestProcessedExam.id}/results`}
                  label="Open results"
                />
              ) : undefined
            }
          >
            {!latestProcessedExam ? (
              <EmptyState
                icon={FileText}
                title="No processed results"
                description="Results will appear here once an examination is processed."
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-canvas p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Students
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {formatNumber(latestResultsCount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-canvas p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Average
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {overallAverage === null
                        ? "—"
                        : `${overallAverage.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-canvas p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Incomplete
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {formatNumber(incompleteResults)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {divisionCounts.map((item) => {
                    const percentage =
                      latestResultsCount > 0
                        ? Math.round((item.count / latestResultsCount) * 100)
                        : 0;
                    return (
                      <div
                        key={item.division}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="w-14 shrink-0 font-medium text-slate-600">
                          {item.division}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-semibold text-slate-800">
                          {item.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                  {formatNumber(completedResults)} completed result(s).
                  {bestDivision && bestDivision.count > 0
                    ? ` Most students are in ${bestDivision.division}.`
                    : ""}{" "}
                  Processed {formatDashboardDate(latestProcessedExam.processed_at)}.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
