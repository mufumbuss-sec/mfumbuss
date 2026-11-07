import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Users,
} from "@/components/ui/lucide-icons";
import {
  assertDashboardQueries,
  formatNumber,
  requireDashboardCount,
} from "@/components/dashboard/overview";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connection } from "next/server";

export const instant = false;

type Assignment = {
  class_name: string;
  subject_name: string;
};

type SchoolClass = {
  id: string;
  form: string;
  stream: string;
};

export default async function TeacherClassesPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const assignmentResult = await admin
    .from("teaching_assignments")
    .select("class_name, subject_name")
    .eq("teacher_id", user.id)
    .order("class_name")
    .order("subject_name");

  assertDashboardQueries([
    { name: "teacher class assignments", error: assignmentResult.error },
  ]);

  const assignments = (assignmentResult.data ?? []) as Assignment[];
  const subjectsByForm = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    const subjects = subjectsByForm.get(assignment.class_name) ?? new Set<string>();
    subjects.add(assignment.subject_name);
    subjectsByForm.set(assignment.class_name, subjects);
  }

  const forms = [...subjectsByForm.keys()];
  const classResult = forms.length
    ? await admin
        .from("classes")
        .select("id, form, stream")
        .in("form", forms)
        .order("form")
        .order("stream")
    : { data: [] as SchoolClass[], error: null };

  assertDashboardQueries([
    { name: "classes", error: classResult.error },
  ]);

  const classes = (classResult.data ?? []) as SchoolClass[];
  const classCounts = await Promise.all(
    classes.map(async (schoolClass) => {
      const result = await admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("class_id", schoolClass.id);

      assertDashboardQueries([
        {
          name: `students in ${schoolClass.form} ${schoolClass.stream}`,
          error: result.error,
        },
      ]);

      return [
        schoolClass.id,
        requireDashboardCount(
          result.count,
          `students in ${schoolClass.form} ${schoolClass.stream}`,
        ),
      ] as const;
    }),
  );
  const studentsByClass = new Map(classCounts);
  const totalStudents = classCounts.reduce((total, [, count]) => total + count, 0);
  const totalSubjects = [...subjectsByForm.values()].reduce(
    (total, subjects) => total + subjects.size,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          My Classes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Classes and subjects assigned to you.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Class summary">
        {[
          {
            label: "Assigned forms",
            value: formatNumber(forms.length),
            icon: BookOpen,
          },
          {
            label: "Assigned subjects",
            value: formatNumber(totalSubjects),
            icon: ClipboardList,
          },
          {
            label: "Students",
            value: formatNumber(totalStudents),
            icon: GraduationCap,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-950">{value}</p>
            </div>
          </div>
        ))}
      </section>

      {forms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            No classes assigned
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Contact the academic office to get your classes and subjects assigned.
          </p>
        </div>
      ) : (
        <section className="space-y-3" aria-label="Assigned classes">
          {forms.map((form) => {
            const formClasses = classes.filter(
              (schoolClass) => schoolClass.form === form,
            );
            const formStudentCount = formClasses.reduce(
              (total, schoolClass) =>
                total + (studentsByClass.get(schoolClass.id) ?? 0),
              0,
            );
            const subjects = [...(subjectsByForm.get(form) ?? [])];

            return (
              <article
                key={form}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">{form}</h2>
                      <p className="text-xs text-slate-500">
                        {formatNumber(formClasses.length)} stream(s) ·{" "}
                        {formatNumber(formStudentCount)} student(s)
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/teacher/exams"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                  >
                    View exams
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Subjects
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map((subject) => (
                        <span
                          key={subject}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Streams
                    </p>
                    {formClasses.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No streams have been created for this form yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {formClasses.map((schoolClass) => (
                          <li
                            key={schoolClass.id}
                            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                          >
                            <span className="text-sm font-medium text-slate-800">
                              {schoolClass.form} {schoolClass.stream}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Users className="h-3.5 w-3.5" />
                              {formatNumber(
                                studentsByClass.get(schoolClass.id) ?? 0,
                              )}{" "}
                              students
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
