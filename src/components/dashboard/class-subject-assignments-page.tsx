"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

const FORM_LEVELS = ["Form I", "Form II", "Form III", "Form IV"] as const;
type FormLevel = (typeof FORM_LEVELS)[number];

interface Subject {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
}

interface Assignment {
  id: string;
  form: FormLevel;
  subject_id: string;
  is_compulsory: boolean;
}

export default function ClassSubjectAssignmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeForm, setActiveForm] = useState<FormLevel>("Form I");
  const [loading, setLoading] = useState(true);
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Subject | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const load = useCallback(async () => {
    const [subjectsResult, assignmentsResult] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, subject_code, has_practical")
        .order("name"),
      supabase
        .from("class_subject_assignments")
        .select("id, form, subject_id, is_compulsory")
        .order("form"),
    ]);

    if (subjectsResult.error || assignmentsResult.error) {
      showToast(
        "error",
        subjectsResult.error?.message ||
          assignmentsResult.error?.message ||
          "Unable to load class subject assignments.",
      );
    } else {
      setSubjects((subjectsResult.data ?? []) as Subject[]);
      setAssignments((assignmentsResult.data ?? []) as Assignment[]);
    }
    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const currentAssignments = assignments.filter(
    (assignment) => assignment.form === activeForm,
  );

  async function setAssignmentType(
    subject: Subject,
    type: "unassigned" | "compulsory" | "optional",
  ) {
    setSavingSubjectId(subject.id);

    const existing = currentAssignments.find(
      (assignment) => assignment.subject_id === subject.id,
    );
    const result = type === "unassigned" && existing
      ? await supabase
          .from("class_subject_assignments")
          .delete()
          .eq("id", existing.id)
      : existing
        ? await supabase
            .from("class_subject_assignments")
            .update({ is_compulsory: type === "compulsory" })
            .eq("id", existing.id)
        : type !== "unassigned"
          ? await supabase.from("class_subject_assignments").insert({
              form: activeForm,
              subject_id: subject.id,
              is_compulsory: type === "compulsory",
            })
          : { error: null };

    if (result.error) {
      showToast("error", result.error.message);
    } else {
      showToast(
        "success",
        type === "unassigned"
          ? `${subject.name} removed from ${activeForm}.`
          : `${subject.name} set as ${type} for ${activeForm}.`,
      );
      await load();
    }
    setSavingSubjectId(null);
  }

  async function confirmRemoval() {
    if (!pendingRemoval) return;
    const subject = pendingRemoval;
    setPendingRemoval(null);
    await setAssignmentType(subject, "unassigned");
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader
          title="Class Subject Assignments"
          subtitle="Assign subjects to each form."
        />

        <section className="app-card p-2">
          <div className="flex flex-wrap gap-1.5">
            {FORM_LEVELS.map((form) => {
              const isActive = activeForm === form;
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => setActiveForm(form)}
                  aria-pressed={isActive}
                  className={`min-h-10 rounded-[10px] px-4 text-sm font-semibold transition ${
                    isActive
                      ? "bg-brand text-white"
                      : "text-ink-soft hover:bg-brand-tint"
                  }`}
                >
                  {form}
                </button>
              );
            })}
          </div>
        </section>

        <section className="app-card min-w-0 overflow-hidden">
          <div className="app-card-header pb-4">
            <div>
              <h2 className="app-card-title">{activeForm} subjects</h2>
              <p className="app-card-subtitle">
                Set each subject as compulsory, optional, or unassigned.
              </p>
            </div>
          </div>
          {loading ? (
            <LoadingIndicator
              label="Loading subjects..."
              className="border-t border-line justify-center px-4 py-12"
            />
          ) : subjects.length === 0 ? (
            <div className="border-t border-line p-5">
              <div className="app-empty">
                <span className="app-empty-icon">
                  <BookOpen className="h-5 w-5" />
                </span>
                <h3 className="app-empty-title">No subjects registered</h3>
                <p className="app-empty-text">
                  Register subjects before assigning them to a form.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 border-t border-line p-4">
              {subjects.map((subject) => {
                const assignment = currentAssignments.find(
                  (item) => item.subject_id === subject.id,
                );
                const isSaving = savingSubjectId === subject.id;
                return (
                  <article
                    key={subject.id}
                    className="flex flex-col gap-3 rounded-[10px] border border-line p-3 transition-colors hover:bg-brand-tint sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-ink">
                          {subject.name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="app-badge app-badge-neutral font-mono">
                            {subject.subject_code}
                          </span>
                          {subject.has_practical && (
                            <span className="text-xs text-muted">
                              Includes practical
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <label htmlFor={`assignment-${subject.id}`} className="sr-only">
                        Assignment type for {subject.name}
                      </label>
                      <select
                        id={`assignment-${subject.id}`}
                        value={
                          assignment
                            ? assignment.is_compulsory
                              ? "compulsory"
                              : "optional"
                            : "unassigned"
                        }
                        disabled={savingSubjectId !== null}
                        onChange={(event) => {
                          const value = event.target.value as
                            | "unassigned"
                            | "compulsory"
                            | "optional";
                          if (value === "unassigned" && assignment) {
                            setPendingRemoval(subject);
                          } else {
                            void setAssignmentType(subject, value);
                          }
                        }}
                        className="app-select min-w-0 flex-1 font-medium disabled:opacity-60 sm:w-48 sm:flex-none"
                      >
                        <option value="unassigned">Not assigned</option>
                        <option value="compulsory">Compulsory</option>
                        <option value="optional">Optional</option>
                      </select>
                      {assignment && (
                        <button
                          type="button"
                          onClick={() => setPendingRemoval(subject)}
                          disabled={savingSubjectId !== null}
                          aria-label={`Remove ${subject.name} from ${activeForm}`}
                          title="Remove assignment"
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-danger-line text-danger-ink transition-colors hover:bg-danger disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-assignment-title"
            className="w-full rounded-t-[14px] border border-line bg-white p-5 shadow-xl sm:max-w-md sm:rounded-[14px] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-danger text-danger-ink">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h3 id="remove-assignment-title" className="app-card-title">
                  Remove subject assignment?
                </h3>
                <p className="mt-1 text-sm leading-5 text-ink-soft">
                  Remove {pendingRemoval.name} from {activeForm}? Compulsory
                  enrollment for students in this form will also be removed.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className="app-btn app-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemoval()}
                className="app-btn app-btn-danger"
              >
                Remove assignment
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
