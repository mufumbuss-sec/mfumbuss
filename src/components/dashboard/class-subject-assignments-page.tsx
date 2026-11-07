"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
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
      <div className="space-y-5 sm:space-y-6">
        <header className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Class Subject Assignments
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                Assign subjects once per form. Changes apply to every stream
                within the selected form.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-blue-900">
              <span className="font-semibold">Compulsory:</span> automatically
              enrolled for all students in the form.
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-amber-900">
              <span className="font-semibold">Optional:</span> assigned to the
              form, but not automatically enrolled.
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900">Select a form</h3>
              <p className="mt-1 text-xs text-gray-500">
                Choose which class level to manage.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FORM_LEVELS.map((form) => {
                const formAssignments = assignments.filter(
                  (assignment) => assignment.form === form,
                );
                const compulsoryCount = formAssignments.filter(
                  (assignment) => assignment.is_compulsory,
                ).length;
                const isActive = activeForm === form;
                return (
                  <button
                    key={form}
                    type="button"
                    onClick={() => setActiveForm(form)}
                    aria-pressed={isActive}
                    className={`flex min-h-[68px] items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{form}</span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          isActive ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {formAssignments.length} subjects
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {compulsoryCount} compulsory
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 className="font-semibold text-gray-900">{activeForm} subjects</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Set each subject as compulsory, optional, or unassigned.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                {currentAssignments.length} assigned
              </span>
            </div>
            {loading ? (
              <LoadingIndicator
                label="Loading subjects..."
                className="justify-center px-4 py-12"
              />
            ) : subjects.length === 0 ? (
              <div className="m-4 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center sm:m-5">
                <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  No subjects registered
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Register subjects before assigning them to a form.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-3 sm:p-4">
                {subjects.map((subject) => {
                  const assignment = currentAssignments.find(
                    (item) => item.subject_id === subject.id,
                  );
                  const isSaving = savingSubjectId === subject.id;
                  return (
                    <article
                      key={subject.id}
                      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-300 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-gray-100 p-2 text-gray-600">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-gray-900">
                            {subject.name}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-700">
                              {subject.subject_code}
                            </span>
                            {subject.has_practical && (
                              <span className="text-xs text-gray-500">
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
                          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 sm:w-48 sm:flex-none"
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
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
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
          </div>
        </section>
      </div>

      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-assignment-title"
            className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-50 p-2 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 id="remove-assignment-title" className="font-semibold text-gray-900">
                  Remove subject assignment?
                </h3>
                <p className="mt-1 text-sm leading-5 text-gray-600">
                  Remove {pendingRemoval.name} from {activeForm}? Compulsory
                  enrollment for students in this form will also be removed.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemoval()}
                className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
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
