"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type SubjectType = "CORE" | "SUBSIDIARY" | "ADDITIONAL_CORE";
type SubjectStatus = "Active" | "Inactive";

type SubjectRecord = {
  id: string;
  name: string;
  code: string;
  subject_type: SubjectType;
  subsidiary_rule: string | null;
  has_practical: boolean;
  status: SubjectStatus;
  active: boolean;
};

type CombinationRecord = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type CombinationWithSubjects = CombinationRecord & {
  coreSubjectIds: string[];
  subsidiarySubjectIds: string[];
  additionalCoreSubjectIds: string[];
};

type SubjectSelectionKey =
  | "coreSubjectIds"
  | "subsidiarySubjectIds"
  | "additionalCoreSubjectIds";

type CombinationFormState = {
  id: string | null;
  name: string;
  code: string;
  active: boolean;
  coreSubjectIds: string[];
  subsidiarySubjectIds: string[];
  additionalCoreSubjectIds: string[];
};

const emptyForm: CombinationFormState = {
  id: null,
  name: "",
  code: "",
  active: true,
  coreSubjectIds: [],
  subsidiarySubjectIds: [],
  additionalCoreSubjectIds: [],
};

export default function ALevelCombinationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [combinations, setCombinations] = useState<CombinationWithSubjects[]>([]);
  const [requiredCoreCount, setRequiredCoreCount] = useState(3);
  const [form, setForm] = useState<CombinationFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CombinationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const load = useCallback(async () => {
    const [settingsResult, subjectsResult, combinationsResult, linksResult] = await Promise.all([
      supabase.from("a_level_settings").select("core_subject_count").eq("key", "default").maybeSingle(),
      supabase
        .from("a_level_subjects")
        .select("id, name, code, subject_type, subsidiary_rule, has_practical, status, active")
        .eq("status", "Active")
        .order("name"),
      supabase
        .from("a_level_combinations")
        .select("id, name, code, active")
        .order("name"),
      supabase.from("a_level_combination_subjects").select("combination_id, subject_id"),
    ]);

    if (settingsResult.error) {
      showToast("error", settingsResult.error.message);
    }

    if (subjectsResult.error) {
      showToast("error", subjectsResult.error.message);
    }

    if (combinationsResult.error) {
      showToast("error", combinationsResult.error.message);
    }

    if (linksResult.error) {
      showToast("error", linksResult.error.message);
    }

    const settingsCount = Number(settingsResult.data?.core_subject_count ?? 3);
    setRequiredCoreCount(settingsCount || 3);

    const subjectLookup = new Map<string, SubjectRecord>();
    for (const subject of subjectsResult.data ?? []) {
      subjectLookup.set(subject.id, subject as SubjectRecord);
    }

    const map = new Map<string, CombinationWithSubjects>();
    for (const combination of combinationsResult.data ?? []) {
      map.set(combination.id, {
        ...(combination as CombinationRecord),
        coreSubjectIds: [],
        subsidiarySubjectIds: [],
        additionalCoreSubjectIds: [],
      });
    }

    for (const link of linksResult.data ?? []) {
      const combination = map.get(link.combination_id as string);
      const subject = subjectLookup.get(link.subject_id as string);
      if (!combination || !subject) continue;
      if (subject.subject_type === "CORE") {
        combination.coreSubjectIds.push(subject.id);
      } else if (subject.subject_type === "SUBSIDIARY") {
        combination.subsidiarySubjectIds.push(subject.id);
      } else {
        combination.additionalCoreSubjectIds.push(subject.id);
      }
    }

    setSubjects((subjectsResult.data ?? []) as SubjectRecord[]);
    setCombinations(Array.from(map.values()));
    setLoading(false);
  }, [showToast, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
  }

  function toggleSubject(id: string, selectedKey: SubjectSelectionKey) {
    setForm((current) => {
      const currentIds = current[selectedKey];
      const nextIds = currentIds.includes(id)
        ? currentIds.filter((value) => value !== id)
        : [...currentIds, id];

      return {
        ...current,
        [selectedKey]: nextIds,
      };
    });
  }

  function loadCombinationForEdit(combination: CombinationWithSubjects) {
    setForm({
      id: combination.id,
      name: combination.name,
      code: combination.code,
      active: combination.active,
      coreSubjectIds: [...combination.coreSubjectIds],
      subsidiarySubjectIds: [...combination.subsidiarySubjectIds],
      additionalCoreSubjectIds: [...combination.additionalCoreSubjectIds],
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const code = form.code.trim();
    if (!name || !code) {
      showToast("error", "Combination name and code are required.");
      return;
    }

    const coreIds = form.coreSubjectIds;
    const subsidiaryIds = form.subsidiarySubjectIds;
    const additionalCoreIds = form.additionalCoreSubjectIds;
    const duplicateIds = [...coreIds, ...subsidiaryIds, ...additionalCoreIds];
    if (new Set(duplicateIds).size !== duplicateIds.length) {
      showToast("error", "A subject cannot be selected twice in the same combination.");
      return;
    }

    if (coreIds.length !== requiredCoreCount) {
      showToast(
        "error",
        `This combination must contain exactly ${requiredCoreCount} CORE subjects.`,
      );
      return;
    }

    if (subsidiaryIds.length === 0) {
      showToast(
        "error",
        "Every combination must include at least one SUBSIDIARY subject. The subsidiary is compulsory, not optional.",
      );
      return;
    }

    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    for (const id of coreIds) {
      const subject = subjectMap.get(id);
      if (!subject || subject.subject_type !== "CORE") {
        showToast("error", "CORE subjects must be selected from the CORE registry.");
        return;
      }
    }

    for (const id of subsidiaryIds) {
      const subject = subjectMap.get(id);
      if (!subject || subject.subject_type !== "SUBSIDIARY") {
        showToast("error", "SUBSIDIARY subjects must be selected from the SUBSIDIARY registry.");
        return;
      }
    }

    for (const id of additionalCoreIds) {
      const subject = subjectMap.get(id);
      if (!subject || subject.subject_type !== "ADDITIONAL_CORE") {
        showToast(
          "error",
          "ADDITIONAL CORE subjects must be selected from the ADDITIONAL CORE registry.",
        );
        return;
      }
    }

    const coreSignature = [...coreIds].sort().join("|");
    const hasExistingCoreMatch = combinations.some(
      (combination) =>
        combination.id !== form.id &&
        [...combination.coreSubjectIds].sort().join("|") === coreSignature,
    );
    if (hasExistingCoreMatch) {
      showToast("error", "Another combination already uses the same CORE subject set.");
      return;
    }

    let existingAssignmentCount = 0;
    if (form.id) {
      const combination = combinations.find((item) => item.id === form.id);
      const previousCore = combination?.coreSubjectIds ?? [];
      const previousSubsidiary = combination?.subsidiarySubjectIds ?? [];
      const previousAdditionalCore = combination?.additionalCoreSubjectIds ?? [];
      const hasChanged =
        previousCore.sort().join("|") !== [...coreIds].sort().join("|") ||
        previousSubsidiary.sort().join("|") !== [...subsidiaryIds].sort().join("|") ||
        previousAdditionalCore.sort().join("|") !== [...additionalCoreIds].sort().join("|");

      if (hasChanged) {
        const { count, error } = await supabase
          .from("a_level_student_combinations")
          .select("id", { count: "exact", head: true })
          .eq("combination_id", form.id);

        if (error) {
          showToast("error", error.message);
          return;
        }

        existingAssignmentCount = count ?? 0;

        if (existingAssignmentCount > 0) {
          const confirmed = window.confirm(
            "This combination has students assigned to it. Changing the subject set will affect existing student marks and report data. Continue?",
          );
          if (!confirmed) return;
        }
      }
    }

    setSaving(true);
    const nextCombination = {
      name,
      code: code.toUpperCase(),
      active: form.active,
    };

    const result = form.id
      ? await supabase.from("a_level_combinations").update(nextCombination).eq("id", form.id).select("id").single()
      : await supabase.from("a_level_combinations").insert(nextCombination).select("id").single();

    if (result.error || !result.data) {
      setSaving(false);
      showToast("error", result.error?.message ?? "Unable to save the combination.");
      return;
    }

    const combinationId = result.data.id;

    await supabase.from("a_level_combination_subjects").delete().eq("combination_id", combinationId);

    const rows = [...coreIds, ...subsidiaryIds, ...additionalCoreIds].map((subjectId) => ({
      combination_id: combinationId,
      subject_id: subjectId,
    }));

    const linksResult = await supabase.from("a_level_combination_subjects").insert(rows);
    setSaving(false);

    if (linksResult.error) {
      showToast("error", linksResult.error.message);
      return;
    }

    showToast("success", form.id ? "Combination updated successfully." : "Combination created successfully.");
    resetForm();
    await load();
  }

  async function handleDelete(target: CombinationRecord) {
    const { count, error } = await supabase
      .from("a_level_student_combinations")
      .select("id", { count: "exact", head: true })
      .eq("combination_id", target.id);

    if (error) {
      showToast("error", error.message);
      return;
    }

    if ((count ?? 0) > 0) {
      showToast("error", "This combination is already assigned to students and cannot be deleted.");
      return;
    }

    setDeleting(true);
    const { error: deleteError } = await supabase.from("a_level_combinations").delete().eq("id", target.id);
    setDeleting(false);

    if (deleteError) {
      showToast("error", deleteError.message);
      return;
    }

    setDeleteTarget(null);
    showToast("success", `${target.name} was deleted.`);
    await load();
  }

  const activeCoreSubjects = subjects.filter((subject) => subject.subject_type === "CORE");
  const activeSubsidiarySubjects = subjects.filter((subject) => subject.subject_type === "SUBSIDIARY");
  const activeAdditionalCoreSubjects = subjects.filter(
    (subject) => subject.subject_type === "ADDITIONAL_CORE",
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="A-Level Combinations"
        subtitle="Build subject combinations for A-Level students."
      />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="app-card h-fit p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="app-card-title">
              {form.id ? "Edit combination" : "Create combination"}
            </h2>
            {form.id && (
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

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="combo-name" className="app-label">Combination name</label>
              <input
                id="combo-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Physics, Chemistry, Mathematics"
                className="app-input"
              />
            </div>

            <div>
              <label htmlFor="combo-code" className="app-label">Combination code</label>
              <input
                id="combo-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="PCM"
                className="app-input uppercase"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2.5 text-sm text-ink-soft">
              <span className="font-medium text-ink">Required CORE count</span>
              <span className="app-badge app-badge-neutral">
                {form.coreSubjectIds.length} / {requiredCoreCount} selected
              </span>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">CORE subjects</h3>
                <span className="text-xs text-muted">{form.coreSubjectIds.length}/{requiredCoreCount}</span>
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto rounded-[10px] border border-line bg-canvas p-2">
                {activeCoreSubjects.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">No active CORE subjects registered.</p>
                ) : (
                  activeCoreSubjects.map((subject) => (
                    <label key={subject.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-ink">{subject.name}</div>
                        <div className="text-xs text-muted">{subject.code}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.coreSubjectIds.includes(subject.id)}
                        onChange={() => toggleSubject(subject.id, "coreSubjectIds")}
                        className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">SUBSIDIARY subjects</h3>
                  <p className="text-xs text-highlight-ink">Compulsory — select at least one.</p>
                </div>
                <span className="text-xs text-muted">{form.subsidiarySubjectIds.length} selected</span>
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto rounded-[10px] border border-line bg-canvas p-2">
                {activeSubsidiarySubjects.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">No active SUBSIDIARY subjects registered.</p>
                ) : (
                  activeSubsidiarySubjects.map((subject) => (
                    <label key={subject.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-ink">{subject.name}</div>
                        <div className="text-xs text-muted">{subject.code} · {subject.subsidiary_rule ?? "Compulsory for all students"}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.subsidiarySubjectIds.includes(subject.id)}
                        onChange={() => toggleSubject(subject.id, "subsidiarySubjectIds")}
                        className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">ADDITIONAL CORE subjects</h3>
                  <p className="text-xs text-muted">Optional — attach to this combination when needed.</p>
                </div>
                <span className="text-xs text-muted">{form.additionalCoreSubjectIds.length} selected</span>
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto rounded-[10px] border border-line bg-canvas p-2">
                {activeAdditionalCoreSubjects.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">No active ADDITIONAL CORE subjects registered.</p>
                ) : (
                  activeAdditionalCoreSubjects.map((subject) => (
                    <label key={subject.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-ink">{subject.name}</div>
                        <div className="text-xs text-muted">{subject.code}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.additionalCoreSubjectIds.includes(subject.id)}
                        onChange={() => toggleSubject(subject.id, "additionalCoreSubjectIds")}
                        className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-[10px] border border-line bg-canvas p-3">
              <input
                id="combo-active"
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              <label htmlFor="combo-active" className="text-sm text-ink-soft">Active</label>
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
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {form.id ? "Update combination" : "Create combination"}
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
                <h2 className="app-card-title">Existing combinations</h2>
                <p className="app-card-subtitle">All defined A-Level combinations.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 border-t border-line px-5 py-12 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading combinations...
            </div>
          ) : combinations.length === 0 ? (
            <div className="border-t border-line p-5">
              <div className="app-empty">
                <span className="app-empty-icon">
                  <BookOpen className="h-5 w-5" />
                </span>
                <h3 className="app-empty-title">No combinations yet</h3>
                <p className="app-empty-text">Create a combination using the form.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t border-line p-4">
              {combinations.map((combination) => (
                <div key={combination.id} className="rounded-[10px] border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink">{combination.name}</h3>
                        <span className={`app-badge ${combination.active ? "app-badge-success" : "app-badge-neutral"}`}>
                          {combination.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted">{combination.code}</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => loadCombinationForEdit(combination)} className="app-btn app-btn-secondary app-btn-sm">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(combination)} className="app-btn app-btn-danger app-btn-sm">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">CORE</div>
                      <div className="flex flex-wrap gap-2">
                        {combination.coreSubjectIds.length === 0 ? (
                          <span className="text-xs text-muted">None selected</span>
                        ) : (
                          subjects
                            .filter((subject) => combination.coreSubjectIds.includes(subject.id))
                            .map((subject) => (
                              <span key={subject.id} className="app-badge app-badge-neutral">
                                {subject.code}
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">SUBSIDIARY</div>
                      <div className="flex flex-wrap gap-2">
                        {combination.subsidiarySubjectIds.length === 0 ? (
                          <span className="text-xs text-muted">None selected</span>
                        ) : (
                          subjects
                            .filter((subject) => combination.subsidiarySubjectIds.includes(subject.id))
                            .map((subject) => (
                              <span key={subject.id} className="app-badge app-badge-warning">
                                {subject.code}
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">ADDITIONAL CORE</div>
                      <div className="flex flex-wrap gap-2">
                        {combination.additionalCoreSubjectIds.length === 0 ? (
                          <span className="text-xs text-muted">None selected</span>
                        ) : (
                          subjects
                            .filter((subject) => combination.additionalCoreSubjectIds.includes(subject.id))
                            .map((subject) => (
                              <span key={subject.id} className="app-badge app-badge-neutral">
                                {subject.code}
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[14px] border border-line bg-white p-5 shadow-xl sm:rounded-[14px] sm:p-6">
            <h3 className="app-card-title">Delete combination</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.name}</span>? This removes the combination definition from the system.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="app-btn app-btn-secondary">Cancel</button>
              <button type="button" onClick={() => void handleDelete(deleteTarget)} disabled={deleting} className="app-btn app-btn-danger">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
