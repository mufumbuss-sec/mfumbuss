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
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="A-Level Subjects"
        subtitle="Manage CORE, SUBSIDIARY and ADDITIONAL CORE subjects."
      />

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="app-card h-fit p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="app-card-title">
              {editingId ? "Edit subject" : "Add subject"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="app-btn app-btn-secondary app-btn-sm"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subject-name" className="app-label">
                Subject name
              </label>
              <input
                id="subject-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Physics"
                className="app-input"
              />
            </div>

            <div>
              <label htmlFor="subject-code" className="app-label">
                Short name / code
              </label>
              <input
                id="subject-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="PHY"
                className="app-input uppercase"
              />
            </div>

            <div>
              <label htmlFor="subject-type" className="app-label">
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
                className="app-select"
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
                <label htmlFor="subsidiary-rule" className="app-label">
                  Subsidiary rule
                </label>
                <select
                  id="subsidiary-rule"
                  value={form.subsidiary_rule}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subsidiary_rule: event.target.value }))
                  }
                  className="app-select"
                >
                  {subsidiaryRuleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-canvas p-3">
              <input
                id="subject-has-practical"
                type="checkbox"
                checked={form.has_practical}
                onChange={(event) =>
                  setForm((current) => ({ ...current, has_practical: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              <span>
                <span className="block text-sm font-medium text-ink">This subject has practical</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Includes a theory and practical mark.
                </span>
              </span>
            </label>

            <div>
              <label htmlFor="subject-status" className="app-label">
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
                className="app-select"
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
              className="app-btn app-btn-primary w-full"
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

        <section className="app-card min-w-0 overflow-hidden">
          <div className="app-card-header pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-tint text-brand">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <h2 className="app-card-title">Registered subjects</h2>
                <p className="app-card-subtitle">All A-Level subjects.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 border-t border-line px-5 py-12 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subjects...
            </div>
          ) : subjects.length === 0 ? (
            <div className="border-t border-line p-5">
              <div className="app-empty">
                <span className="app-empty-icon">
                  <BookOpen className="h-5 w-5" />
                </span>
                <h3 className="app-empty-title">No subjects yet</h3>
                <p className="app-empty-text">Add the first A-Level subject using the form.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-line">
              <table className="app-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Practical</th>
                    <th>Rule</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td className="font-semibold text-ink">{subject.name}</td>
                      <td className="font-mono text-ink-soft">{subject.code}</td>
                      <td>
                        <span
                          className={`app-badge ${
                            subject.subject_type === "CORE"
                              ? "app-badge-neutral"
                              : subject.subject_type === "SUBSIDIARY"
                                ? "app-badge-warning"
                                : "app-badge-success"
                          }`}
                        >
                          {subject.subject_type}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`app-badge ${
                            subject.has_practical ? "app-badge-success" : "app-badge-neutral"
                          }`}
                        >
                          {subject.has_practical ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="text-ink-soft">
                        {subject.subject_type === "SUBSIDIARY"
                          ? subject.subsidiary_rule || "Compulsory for all students"
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`app-badge ${
                            subject.status === "Active" ? "app-badge-success" : "app-badge-neutral"
                          }`}
                        >
                          {subject.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(subject)}
                            className="app-btn app-btn-secondary app-btn-sm"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(subject)}
                            className="app-btn app-btn-danger app-btn-sm"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[14px] border border-line bg-white p-5 shadow-xl sm:rounded-[14px] sm:p-6">
            <h3 className="app-card-title">Delete subject</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.name}</span>? This action cannot be undone.
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
                onClick={() => {
                  void handleDelete(deleteTarget);
                }}
                disabled={deleting}
                className="app-btn app-btn-danger"
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
