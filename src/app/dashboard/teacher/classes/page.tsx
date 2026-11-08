import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Users,
} from "@/components/ui/lucide-icons";
import {
  assertDashboardQueries,
  formatNumber,
  requireDashboardCount,
} from "@/components/dashboard/overview";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="My Classes"
        subtitle="Classes and subjects assigned to you."
      />

      {forms.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes assigned"
          description="Contact the academic office to get your classes and subjects assigned."
        />
      ) : (
        <section className="space-y-4" aria-label="Assigned classes">
          {forms.map((form) => {
            const formClasses = classes.filter(
              (schoolClass) => schoolClass.form === form,
            );
            const subjects = [...(subjectsByForm.get(form) ?? [])];

            return (
              <article
                key={form}
                className="app-card overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <h2 className="app-card-title">{form}</h2>
                  </div>
                  <Link
                    href="/dashboard/teacher/exams"
                    className="app-btn app-btn-secondary app-btn-sm"
                  >
                    View exams
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <div>
                    <p className="app-label">Subjects</p>
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map((subject) => (
                        <Badge key={subject} tone="neutral">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="app-label">Streams</p>
                    {formClasses.length === 0 ? (
                      <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-ink">
                        No streams have been created for this form yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {formClasses.map((schoolClass) => (
                          <li
                            key={schoolClass.id}
                            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                          >
                            <span className="text-sm font-medium text-ink">
                              {schoolClass.form} {schoolClass.stream}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
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
