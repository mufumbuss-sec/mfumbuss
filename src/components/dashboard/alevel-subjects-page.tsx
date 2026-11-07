"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpen,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type SubjectType = "CORE" | "SUBSIDIARY" | "ADDITIONAL_CORE";
type SubjectStatus = "Active" | "Inactive";

type ALevelSubject = {
  id: string;
  name: string;
  code: string;
  subject_type: SubjectType;
  subsidiary_rule: string | null;
  has_practical: boolean;
  status: SubjectStatus;
  active: boolean;
  created_at: string;
};

type SubjectFormState = {
  name: string;
  code: string;
  subject_type: SubjectType;
  subsidiary_rule: string;
  has_practical: boolean;
  status: SubjectStatus;
};

const emptyForm: SubjectFormState = {
  name: "",
  code: "",
  subject_type: "CORE",
  subsidiary_rule: "Compulsory for all students",
  has_practical: false,
  status: "Active",
};

const typeOptions: Array<{ value: SubjectType; label: string }> = [
  { value: "CORE", label: "CORE (Principal)" },
  { value: "SUBSIDIARY", label: "SUBSIDIARY (Compulsory)" },
  { value: "ADDITIONAL_CORE", label: "ADDITIONAL CORE" },
];

const statusOptions: SubjectStatus[] = ["Active", "Inactive"];
const subsidiaryRuleOptions = [
  "Compulsory for all students",
  "Optional / Conditional",
];

export default function ALevelSubjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<ALevelSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SubjectFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ALevelSubject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const loadSubjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("a_level_subjects")
      .select("id, name, code, subject_type, subsidiary_rule, has_practical, status, active, created_at")
      .order("name");

    if (error) {
      showToast("error", error.message);
      setLoading(false);
      return;
    }

    setSubjects((data ?? []) as ALevelSubject[]);
    setLoading(false);
  }, [showToast, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubjects();
  }, [loadSubjects]);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const code = form.code.trim();
    if (!name || !code) {
      showToast("error", "Subject name and code are both required.");
      return;
    }

    const payload = {
      name,
      code: code.toUpperCase(),
      subject_type: form.subject_type,
      subsidiary_rule:
        form.subject_type === "SUBSIDIARY"
          ? form.subsidiary_rule || "Compulsory for all students"
          : null,
      has_practical: form.has_practical,
      status: form.status,
      active: form.status === "Active",
    };

    setSaving(true);

    const result = editingId
      ? await supabase.from("a_level_subjects").update(payload).eq("id", editingId)
      : await supabase.from("a_level_subjects").insert(payload);

    setSaving(false);

    if (result.error) {
      showToast(
        "error",
        result.error.code === "23505"
          ? "A subject with this name or code already exists."
          : result.error.message,
      );
      return;
    }

    showToast(
      "success",
      editingId ? "Subject updated successfully." : "Subject created successfully.",
    );
    resetForm();
    await loadSubjects();
  }

  function handleEdit(subject: ALevelSubject) {
    setEditingId(subject.id);
    setForm({
      name: subject.name,
      code: subject.code,
      subject_type: subject.subject_type,
      subsidiary_rule:
        subject.subject_type === "SUBSIDIARY" && subject.subsidiary_rule
          ? subject.subsidiary_rule
          : "Compulsory for all students",
      has_practical: Boolean(subject.has_practical),
      status: subject.status,
    });
  }

  async function handleDelete(target: ALevelSubject) {
    if (!target) return;

    const [{ count: combinationCount }, { count: markCount }] = await Promise.all([
      supabase
        .from("a_level_combination_subjects")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", target.id),
      supabase
        .from("a_level_marks")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", target.id),
    ]);

    if ((combinationCount ?? 0) > 0 || (markCount ?? 0) > 0) {
      showToast(
        "error",
        "This subject is already linked to a combination or marks and cannot be deleted.",
      );
      return;
    }

    setDeleting(true);
    const { error } = await supabase.from("a_level_subjects").delete().eq("id", target.id);
    setDeleting(false);

    if (error) {
      showToast("error", error.message);
      return;
    }

    setDeleteTarget(null);
    showToast("success", `${target.name} was deleted.`);
    await loadSubjects();
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">A-Level Subjects Registry</h2>
            <p className="mt-1 text-sm text-slate-600">
              Register CORE, SUBSIDIARY and ADDITIONAL CORE subjects, and mark the ones that have practicals.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit subject" : "Add subject"}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subject-name" className="mb-1 block text-sm font-medium text-slate-700">
                Subject name
              </label>
              <input
                id="subject-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Physics"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="subject-code" className="mb-1 block text-sm font-medium text-slate-700">
                Short name / code
              </label>
              <input
                id="subject-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="PHY"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="subject-type" className="mb-1 block text-sm font-medium text-slate-700">
                Subject type
              </label>
              <select
                id="subject-type"
                value={form.subject_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subject_type: event.target.value as SubjectType,
                    subsidiary_rule:
                      event.target.value === "SUBSIDIARY"
                        ? current.subsidiary_rule || "Compulsory for all students"
                        : "Compulsory for all students",
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {form.subject_type === "SUBSIDIARY" && (
              <div>
                <label htmlFor="subsidiary-rule" className="mb-1 block text-sm font-medium text-slate-700">
                  Subsidiary rule
                </label>
                <select
                  id="subsidiary-rule"
                  value={form.subsidiary_rule}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subsidiary_rule: event.target.value }))
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {subsidiaryRuleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                id="subject-has-practical"
                type="checkbox"
                checked={form.has_practical}
                onChange={(event) =>
                  setForm((current) => ({ ...current, has_practical: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">This subject has practical</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Marks: Theory 100 + Practical 50, total divided by 150 times 100.
                </span>
              </span>
            </label>

            <div>
              <label htmlFor="subject-status" className="mb-1 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="subject-status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as SubjectStatus,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                <>
                  <Save className="h-4 w-4" />
                  Update subject
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add subject
                </>
              )}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Registered subjects</h3>
              <p className="text-sm text-slate-500">{subjects.length} subject(s)</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subjects...
            </div>
          ) : subjects.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No A-Level subjects registered yet. Add the first one from the form.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Practical</th>
                    <th className="px-4 py-3 font-medium">Rule</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{subject.name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{subject.code}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            subject.subject_type === "CORE"
                              ? "bg-blue-50 text-blue-700"
                              : subject.subject_type === "SUBSIDIARY"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {subject.subject_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            subject.has_practical
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {subject.has_practical ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {subject.subject_type === "SUBSIDIARY"
                          ? subject.subsidiary_rule || "Compulsory for all students"
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            subject.status === "Active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {subject.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(subject)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(subject)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete subject</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTarget.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDelete(deleteTarget);
                }}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
