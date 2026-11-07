"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Edit, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
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
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Subjects</h2>
          <p className="mt-1 text-sm text-gray-600">
            Register subjects with a unique code and indicate whether they have practical.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Add Subject</h3>
            <p className="mt-1 text-sm text-gray-600">New subject details</p>
            <form onSubmit={handleAddSubject} className="mt-4 space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 sm:p-4">
                <label htmlFor="subject_code" className="mb-1 block text-sm font-semibold text-gray-800">
                  Subject code <span className="text-red-600">*</span>
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
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                />
                <p id="subject_code_help" className="mt-1 text-xs text-gray-600">
                  Enter a unique code for this subject.
                </p>
              </div>
              <div>
                <label htmlFor="subject_name" className="mb-1 block text-sm font-medium text-gray-700">
                  Subject name <span className="text-red-600">*</span>
                </label>
                <input
                  id="subject_name"
                  name="subject_name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Chemistry"
                  className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={hasPractical}
                  onChange={(event) => setHasPractical(event.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Has practical
              </label>
              <button
                type="submit"
                disabled={saving}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Register Subject
              </button>
            </form>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg">
                    <BookOpen className="h-5 w-5 shrink-0 text-blue-600" />
                    Subjects List
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-600">{subjects.length} subject(s)</p>
                </div>
              </div>
              {loading ? (
                <LoadingIndicator
                  label="Loading subjects..."
                  className="p-5 sm:p-6"
                />
              ) : subjects.length ? (
                <>
                <div className="divide-y divide-gray-100 md:hidden">
                  {subjects.map((subject, index) => (
                    <article key={subject.id} className="space-y-3 p-4">
                      {editId === subject.id ? (
                        <>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label htmlFor={`mobile-subject-name-${subject.id}`} className="mb-1 block text-xs font-medium text-gray-600">
                                Subject name
                              </label>
                              <input
                                id={`mobile-subject-name-${subject.id}`}
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor={`mobile-subject-code-${subject.id}`} className="mb-1 block text-xs font-medium text-gray-600">
                                Subject code
                              </label>
                              <input
                                id={`mobile-subject-code-${subject.id}`}
                                value={editSubjectCode}
                                onChange={(event) => setEditSubjectCode(event.target.value.toUpperCase())}
                                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          </div>
                          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editPractical}
                              onChange={(event) => setEditPractical(event.target.checked)}
                              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Has practical
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUpdateSubject()}
                              disabled={updating}
                              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                              <h4 className="break-words font-semibold text-gray-900">{subject.name}</h4>
                              <p className="mt-1 text-xs text-gray-500">Subject {index + 1}</p>
                            </div>
                            <span className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1 font-mono text-xs font-semibold text-blue-800">
                              {subject.subject_code}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-500">Practical</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              subject.has_practical
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {subject.has_practical ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                            <button
                              type="button"
                              onClick={() => startEdit(subject)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(subject)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
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
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Subject</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Subject code</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Practical</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject, index) => (
                        <tr key={subject.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {editId === subject.id ? (
                              <input
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="w-full max-w-xs rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              subject.name
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {editId === subject.id ? (
                              <input
                                value={editSubjectCode}
                                onChange={(event) =>
                                  setEditSubjectCode(event.target.value.toUpperCase())
                                }
                                className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Subject code"
                              />
                            ) : (
                              subject.subject_code
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {editId === subject.id ? (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editPractical}
                                  onChange={(event) => setEditPractical(event.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Yes</span>
                              </label>
                            ) : subject.has_practical ? (
                              "Yes"
                            ) : (
                              "No"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editId === subject.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateSubject()}
                                  disabled={updating}
                                  className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
                                  aria-label="Save"
                                >
                                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
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
                                  className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                  aria-label="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(subject)}
                                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
                <div className="p-6 text-center text-sm text-gray-600 sm:p-8">
                  No subjects yet. Add one using the form.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Subject</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.name}</span>?
              </p>
              <p className="mt-1 text-xs text-gray-500">This action cannot be undone.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200 px-5 py-4 sm:flex sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSubject()}
                disabled={deleting}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
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
