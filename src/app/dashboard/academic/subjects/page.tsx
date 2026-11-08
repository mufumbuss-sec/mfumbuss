"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Edit, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type Subject = {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
  created_at: string;
};

export default function SubjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [hasPractical, setHasPractical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubjectCode, setEditSubjectCode] = useState("");
  const [editPractical, setEditPractical] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, subject_code, has_practical, created_at")
      .order("name");

    if (error) {
      showToast("error", error.message);
    } else {
      setSubjects((data ?? []) as Subject[]);
    }
    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleAddSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subjectName = name.trim();
    const code = subjectCode.trim().toUpperCase();

    if (!subjectName || !code) {
      showToast("error", "Enter both the subject name and subject code.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase
      .from("subjects")
      .insert({
        name: subjectName,
        subject_code: code,
        has_practical: hasPractical,
      });

    if (insertError) {
      setSaving(false);
      showToast(
        "error",
        insertError.code === "23505"
          ? "This subject name or code already exists."
          : insertError.message
      );
      return;
    }

    setName("");
    setSubjectCode("");
    setHasPractical(false);
    showToast("success", "Subject registered successfully.");
    await load();
    setSaving(false);
  }

  function startEdit(subject: Subject) {
    setEditId(subject.id);
    setEditName(subject.name);
    setEditSubjectCode(subject.subject_code);
    setEditPractical(subject.has_practical);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditSubjectCode("");
    setEditPractical(false);
  }

  async function handleUpdateSubject() {
    if (!editId) return;
    const subjectName = editName.trim();
    const code = editSubjectCode.trim().toUpperCase();

    if (!subjectName || !code) {
      showToast("error", "Enter both the subject name and subject code.");
      return;
    }

    setUpdating(true);

    const { error: updateError } = await supabase
      .from("subjects")
      .update({
        name: subjectName,
        subject_code: code,
        has_practical: editPractical,
      })
      .eq("id", editId);

    if (updateError) {
      setUpdating(false);
      showToast(
        "error",
        updateError.code === "23505"
          ? "This subject name or code already exists."
          : updateError.message
      );
      return;
    }

    cancelEdit();
    showToast("success", "Subject updated successfully.");
    await load();
    setUpdating(false);
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error: deleteError } = await supabase
      .from("subjects")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (deleteError) {
      showToast(
        "error",
        deleteError.code === "23503"
          ? "This subject is used by classes, examinations, or marks and cannot be deleted."
          : deleteError.message,
      );
      return;
    }

    showToast("success", `${deleteTarget.name} was deleted.`);
    setDeleteTarget(null);
    await load();
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader
          title="Subjects"
          subtitle="Register subjects with a unique code."
        />

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="app-card h-fit p-5">
            <h2 className="app-card-title">Add subject</h2>
            <p className="app-card-subtitle">New subject details.</p>
            <form onSubmit={handleAddSubject} className="mt-4 space-y-4">
              <div>
                <label htmlFor="subject_code" className="app-label">
                  Subject code <span className="text-danger-ink">*</span>
                </label>
                <input
                  id="subject_code"
                  name="subject_code"
                  type="text"
                  required
                  autoComplete="off"
                  value={subjectCode}
                  onChange={(event) => setSubjectCode(event.target.value.toUpperCase())}
                  placeholder="e.g. CHEM"
                  aria-describedby="subject_code_help"
                  className="app-input uppercase"
                />
                <p id="subject_code_help" className="mt-1 text-xs text-muted">
                  Enter a unique code for this subject.
                </p>
              </div>
              <div>
                <label htmlFor="subject_name" className="app-label">
                  Subject name <span className="text-danger-ink">*</span>
                </label>
                <input
                  id="subject_name"
                  name="subject_name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Chemistry"
                  className="app-input"
                />
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-[10px] border border-line px-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={hasPractical}
                  onChange={(event) => setHasPractical(event.target.checked)}
                  className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                />
                Has practical
              </label>
              <button
                type="submit"
                disabled={saving}
                className="app-btn app-btn-primary w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Register Subject
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
                  <h2 className="app-card-title">Subject list</h2>
                  <p className="app-card-subtitle">All registered subjects.</p>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingIndicator
                label="Loading subjects..."
                className="border-t border-line p-6"
              />
            ) : subjects.length ? (
              <>
                <div className="divide-y divide-slate-100 border-t border-line md:hidden">
                  {subjects.map((subject, index) => (
                    <article key={subject.id} className="space-y-3 p-4">
                      {editId === subject.id ? (
                        <>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label htmlFor={`mobile-subject-name-${subject.id}`} className="app-label">
                                Subject name
                              </label>
                              <input
                                id={`mobile-subject-name-${subject.id}`}
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="app-input"
                              />
                            </div>
                            <div>
                              <label htmlFor={`mobile-subject-code-${subject.id}`} className="app-label">
                                Subject code
                              </label>
                              <input
                                id={`mobile-subject-code-${subject.id}`}
                                value={editSubjectCode}
                                onChange={(event) => setEditSubjectCode(event.target.value.toUpperCase())}
                                className="app-input uppercase"
                              />
                            </div>
                          </div>
                          <label className="flex min-h-11 items-center gap-3 rounded-[10px] border border-line px-3 text-sm text-ink-soft">
                            <input
                              type="checkbox"
                              checked={editPractical}
                              onChange={(event) => setEditPractical(event.target.checked)}
                              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                            />
                            Has practical
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUpdateSubject()}
                              disabled={updating}
                              className="app-btn app-btn-primary flex-1"
                            >
                              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="app-btn app-btn-secondary flex-1"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="break-words text-sm font-bold text-ink">{subject.name}</h4>
                              <p className="mt-1 text-xs text-muted">Subject {index + 1}</p>
                            </div>
                            <span className="app-badge app-badge-neutral shrink-0 font-mono">
                              {subject.subject_code}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted">Practical</span>
                            <span className={`app-badge ${subject.has_practical ? "app-badge-success" : "app-badge-neutral"}`}>
                              {subject.has_practical ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                            <button
                              type="button"
                              onClick={() => startEdit(subject)}
                              className="app-btn app-btn-secondary app-btn-sm"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(subject)}
                              className="app-btn app-btn-danger app-btn-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto border-t border-line md:block">
                  <table className="app-table min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="w-12">#</th>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Practical</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject, index) => (
                        <tr key={subject.id}>
                          <td className="text-muted">{index + 1}</td>
                          <td>
                            {editId === subject.id ? (
                              <input
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="app-input min-h-9 max-w-xs py-1 text-sm"
                                aria-label="Subject name"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
                                  <BookOpen className="h-4 w-4" />
                                </span>
                                <span className="font-semibold text-ink">{subject.name}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {editId === subject.id ? (
                              <input
                                value={editSubjectCode}
                                onChange={(event) =>
                                  setEditSubjectCode(event.target.value.toUpperCase())
                                }
                                className="app-input min-h-9 w-28 py-1 text-sm uppercase"
                                aria-label="Subject code"
                              />
                            ) : (
                              <span className="app-badge app-badge-neutral font-mono">
                                {subject.subject_code}
                              </span>
                            )}
                          </td>
                          <td>
                            {editId === subject.id ? (
                              <label className="flex items-center gap-2 text-sm text-ink-soft">
                                <input
                                  type="checkbox"
                                  checked={editPractical}
                                  onChange={(event) => setEditPractical(event.target.checked)}
                                  className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                                />
                                <span>Yes</span>
                              </label>
                            ) : (
                              <span className={`app-badge ${subject.has_practical ? "app-badge-success" : "app-badge-neutral"}`}>
                                {subject.has_practical ? "Yes" : "No"}
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {editId === subject.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateSubject()}
                                  disabled={updating}
                                  className="rounded-lg p-1.5 text-success-ink transition hover:bg-success disabled:opacity-50"
                                  aria-label="Save"
                                >
                                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
                                  aria-label="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(subject)}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-tint hover:text-brand"
                                  aria-label="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(subject)}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-danger hover:text-danger-ink"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="border-t border-line p-5">
                <div className="app-empty">
                  <span className="app-empty-icon">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <h3 className="app-empty-title">No subjects yet</h3>
                  <p className="app-empty-text">Add a subject using the form.</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("subject_name")?.focus()}
                    className="app-btn app-btn-primary mt-4"
                  >
                    <Plus className="h-4 w-4" />
                    Add subject
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
              <h3 className="app-card-title">Delete subject</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.name}</span>?
            </p>
            <p className="mt-1 text-xs text-muted">This action cannot be undone.</p>
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
                onClick={() => void confirmDeleteSubject()}
                disabled={deleting}
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
