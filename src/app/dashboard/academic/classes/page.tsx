"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type FormLevel =
  | "Form I"
  | "Form II"
  | "Form III"
  | "Form IV"
  | "Form V"
  | "Form VI";

const FORM_LEVELS: FormLevel[] = [
  "Form I",
  "Form II",
  "Form III",
  "Form IV",
  "Form V",
  "Form VI",
];

type SchoolClass = {
  id: string;
  form: FormLevel;
  stream: string;
  created_at: string;
};

type Student = {
  id: string;
  class_id: string;
};

export default function ClassesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeForm, setActiveForm] = useState<FormLevel>("Form I");
  const [stream, setStream] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const load = useCallback(async () => {
    const [classesResult, studentsResult] = await Promise.all([
      supabase
        .from("classes")
        .select("id, form, stream, created_at")
        .order("form")
        .order("stream"),
      supabase.from("students").select("id, class_id"),
    ]);

    if (classesResult.error || studentsResult.error) {
      showToast(
        "error",
        "Failed to load data. Make sure the supabase/classes.sql migration has been applied."
      );
    } else {
      setClasses((classesResult.data ?? []) as SchoolClass[]);
      setStudents((studentsResult.data ?? []) as Student[]);
    }

    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const formClasses = useMemo(
    () =>
      classes
        .filter((item) => item.form === activeForm)
        .sort((a, b) => a.stream.localeCompare(b.stream)),
    [classes, activeForm]
  );

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const student of students) {
      map.set(student.class_id, (map.get(student.class_id) ?? 0) + 1);
    }
    return map;
  }, [students]);

  async function handleAddClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = stream.trim().toUpperCase();

    if (!name) {
      showToast("error", "Enter a stream name first (e.g. A).");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase
      .from("classes")
      .insert({ form: activeForm, stream: name });

    if (insertError) {
      setSaving(false);
      showToast(
        "error",
        insertError.code === "23505"
          ? `${activeForm} ${name} is already registered.`
          : insertError.message
      );
      return;
    }

    setStream("");
    showToast("success", `${activeForm} ${name} was added successfully.`);
    await load();
    setSaving(false);
  }

  async function confirmDeleteClass() {
    if (!deleteTarget) return;
    const count = studentCountByClass.get(deleteTarget.id) ?? 0;
    if (count > 0) {
      showToast(
        "error",
        "This stream still has students. Move or delete the students first.",
      );
      return;
    }

    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (deleteError) {
      showToast(
        "error",
        deleteError.code === "23503"
          ? "This stream is still referenced by students or other records."
          : deleteError.message,
      );
      return;
    }

    showToast("success", `${deleteTarget.form} ${deleteTarget.stream} was deleted.`);
    setDeleteTarget(null);
    await load();
  }

  const deleteCount = deleteTarget
    ? studentCountByClass.get(deleteTarget.id) ?? 0
    : 0;

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader
          title="Classes"
          subtitle="Manage classes and streams from Form I to Form VI."
        />

        <section className="app-card p-2">
          <div className="flex flex-wrap gap-1.5">
            {FORM_LEVELS.map((form) => {
              const active = activeForm === form;
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => {
                    setActiveForm(form);
                  }}
                  className={`min-h-10 rounded-[10px] px-4 text-sm font-semibold transition ${
                    active ? "bg-brand text-white" : "text-ink-soft hover:bg-brand-tint"
                  }`}
                >
                  {form}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="app-card h-fit p-5">
            <h2 className="app-card-title">Add stream</h2>
            <p className="app-card-subtitle">{activeForm}</p>
            <form onSubmit={(e) => void handleAddClass(e)} className="mt-4 space-y-4">
              <div>
                <label htmlFor="stream" className="app-label">
                  Stream name
                </label>
                <input
                  id="stream"
                  value={stream}
                  onChange={(event) => setStream(event.target.value)}
                  placeholder="e.g. A"
                  className="app-input uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="app-btn app-btn-primary w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Stream
              </button>
            </form>
          </section>

          <section className="app-card min-w-0 overflow-hidden">
            <div className="app-card-header pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-tint text-brand">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="app-card-title">{activeForm} streams</h2>
                  <p className="app-card-subtitle">Streams available for this form.</p>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingIndicator
                label="Loading classes..."
                className="border-t border-line p-6"
              />
            ) : formClasses.length ? (
              <div className="border-t border-line p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {formClasses.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-ink">
                        {item.form} {item.stream}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-danger hover:text-danger-ink"
                        aria-label={`Delete ${item.form} ${item.stream}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-t border-line p-5">
                <div className="app-empty">
                  <span className="app-empty-icon">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <h3 className="app-empty-title">No streams yet</h3>
                  <p className="app-empty-text">Add a stream using the form.</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("stream")?.focus()}
                    className="app-btn app-btn-primary mt-4"
                  >
                    <Plus className="h-4 w-4" />
                    Add stream
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[14px] border border-line bg-white p-5 shadow-xl sm:rounded-[14px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="app-card-title">Delete stream</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.form} {deleteTarget.stream}</span>?
            </p>
            <p className="mt-1 text-xs text-muted">
              {deleteCount > 0
                ? `This stream has ${deleteCount} student(s). Move or delete them before removing the stream.`
                : "This action cannot be undone."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="app-btn app-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteClass()}
                disabled={deleting || deleteCount > 0}
                className="app-btn app-btn-danger"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
