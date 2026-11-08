"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileUp, GraduationCap, Loader2, Plus, Search, Square, SquareCheck, Trash2, Users, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import Papa from "papaparse";
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
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  sex: "M" | "F";
  created_at: string;
};

type StudentForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  sex: "M" | "F";
};

type OptionalSubject = {
  id: string;
  name: string;
  subject_code: string;
};

type CsvRow = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  surname?: string;
  sex?: string;
  gender?: string;
  class?: string;
  class_name?: string;
  darasa?: string;
  mkondo?: string;
  form?: string;
  stream?: string;
};

const EMPTY_STUDENT: StudentForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "M",
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeSex(value: unknown) {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "F" || v === "FEMALE" || v === "KE") return "F" as const;
  if (v === "M" || v === "MALE" || v === "ME" || v === "BOY" || v === "BOYS") return "M" as const;
  return null;
}

function getFirstName(row: CsvRow) {
  return row.first_name?.trim() || "";
}

function getLastName(row: CsvRow) {
  return row.last_name?.trim() || row.surname?.trim() || "";
}

function getMiddleName(row: CsvRow) {
  return row.middle_name?.trim() || "";
}

function getSex(row: CsvRow) {
  return normalizeSex(row.sex ?? row.gender);
}

const ROMAN_TO_NUMBER: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
};

function normalizeClassKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bform\b/g, "")
    .replace(/\b(vi|v|iv|iii|ii|i)\b/g, (match) => ROMAN_TO_NUMBER[match] ?? match)
    .replace(/[^a-z0-9]/g, "");
}

function buildClassLookup(classes: SchoolClass[]) {
  const lookup = new Map<string, string>();
  const classesPerForm = new Map<string, number>();

  for (const item of classes) {
    classesPerForm.set(item.form, (classesPerForm.get(item.form) ?? 0) + 1);
  }

  for (const item of classes) {
    const roman = item.form.replace(/^Form\s+/i, "");
    const number = String(FORM_LEVELS.indexOf(item.form) + 1);
    const stream = item.stream;

    for (const alias of [
      `${item.form} ${stream}`,
      `${item.form}${stream}`,
      `${item.form} - ${stream}`,
      `${roman} ${stream}`,
      `${roman}${stream}`,
      `${roman} - ${stream}`,
      `${number} ${stream}`,
      `${number}${stream}`,
      `${number} - ${stream}`,
    ]) {
      lookup.set(normalizeClassKey(alias), item.id);
    }

    if (classesPerForm.get(item.form) === 1) {
      lookup.set(normalizeClassKey(item.form), item.id);
      lookup.set(normalizeClassKey(roman), item.id);
      lookup.set(normalizeClassKey(number), item.id);
    }
  }

  return lookup;
}

function getClassId(row: CsvRow, lookup: Map<string, string>) {
  const directClass = row.class ?? row.class_name;
  if (directClass?.trim()) {
    return lookup.get(normalizeClassKey(directClass)) ?? null;
  }

  const darasa = row.darasa?.trim();
  const mkondo = row.mkondo?.trim();
  if (darasa && mkondo) {
    return lookup.get(normalizeClassKey(`${darasa} ${mkondo}`)) ?? null;
  }
  if (darasa) {
    return lookup.get(normalizeClassKey(darasa)) ?? null;
  }

  const form = row.form?.trim();
  const stream = row.stream?.trim() ?? mkondo;
  if (form && stream) {
    return lookup.get(normalizeClassKey(`${form} ${stream}`)) ?? null;
  }
  if (form) {
    return lookup.get(normalizeClassKey(form)) ?? null;
  }

  return null;
}

function downloadTemplate(form: FormLevel, classes: SchoolClass[]) {
  const streams = classes
    .filter((item) => item.form === form)
    .map((item) => item.stream)
    .sort((a, b) => a.localeCompare(b));
  const classLabels =
    streams.length > 0
      ? streams.map((stream) => `${form} ${stream}`)
      : [form];
  const rows = classLabels.flatMap((label) => [
    `John,Paul,Mdoe,M,${label}`,
    `Mary,,Kweka,F,${label}`,
  ]);
  const csv = [
    "first_name,middle_name,last_name,sex,class",
    ...rows,
    "",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `students_template_${form.replace(/\s+/g, "_").toLowerCase()}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeForm, setActiveForm] = useState<FormLevel>("Form I");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentForm, setStudentForm] = useState<StudentForm>(EMPTY_STUDENT);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [optionalSubjects, setOptionalSubjects] = useState<OptionalSubject[]>([]);
  const [selectedOptionalSubjectIds, setSelectedOptionalSubjectIds] = useState<Set<string>>(new Set());
  const [enrolledSubjects, setEnrolledSubjects] = useState<Set<string>>(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, form, stream, created_at")
      .order("form")
      .order("stream");

    if (error) {
      showToast(
        "error",
        "Failed to load classes. Make sure the supabase/classes.sql migration has been applied."
      );
    } else {
      setClasses((data ?? []) as SchoolClass[]);
    }

    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClasses();
  }, [loadClasses]);

  const formClasses = useMemo(
    () =>
      classes
        .filter((item) => item.form === activeForm)
        .sort((a, b) => a.stream.localeCompare(b.stream)),
    [classes, activeForm]
  );

  const effectiveClassId = formClasses.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : formClasses[0]?.id ?? "";

  const selectedClass =
    classes.find((item) => item.id === effectiveClassId) ?? null;

  const classTotal = classCounts[effectiveClassId] ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [effectiveClassId, debouncedSearch, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  const loadStudents = useCallback(async () => {
    if (!effectiveClassId) {
      setStudents([]);
      setTotal(0);
      return;
    }

    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        classId: effectiveClassId,
        includeCounts: "1",
        sort: "name",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load students.");
      }

      setStudents((data.students ?? []) as Student[]);
      setTotal(data.total ?? 0);
      setClassCounts(
        (data.classCounts ?? {}) as Record<string, number>
      );
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Unable to load students."
      );
    } finally {
      setStudentsLoading(false);
    }
  }, [debouncedSearch, effectiveClassId, page, pageSize, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudents();
  }, [loadStudents, refreshKey]);

  const refreshStudents = useCallback(() => {
    setPage(1);
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => setSelectedStudentIds(new Set()));
  }, [effectiveClassId]);

  const loadOptionalSubjects = useCallback(async () => {
    if (!effectiveClassId) {
      setOptionalSubjects([]);
      setSelectedOptionalSubjectIds(new Set());
      setEnrolledSubjects(new Set());
      return;
    }
    try {
      const res = await fetch(`/api/student-subjects?classId=${encodeURIComponent(effectiveClassId)}`);
      const data = await res.json();
      if (res.ok) {
        const subjects = ((data.subjects || []) as OptionalSubject[]).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        setOptionalSubjects(subjects);
        setSelectedOptionalSubjectIds((current) => {
          const validIds = new Set(subjects.map((subject) => subject.id));
          const retained = new Set([...current].filter((id) => validIds.has(id)));
          return retained.size > 0 || subjects.length === 0
            ? retained
            : new Set([subjects[0].id]);
        });
      } else {
        throw new Error(data.error || "Unable to load optional subjects.");
      }
    } catch (error) {
      setOptionalSubjects([]);
      setSelectedOptionalSubjectIds(new Set());
      showToast(
        "error",
        error instanceof Error ? error.message : "Unable to load optional subjects.",
      );
    }
  }, [effectiveClassId, showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadOptionalSubjects);
  }, [loadOptionalSubjects]);

  const loadEnrollmentStatus = useCallback(async () => {
    if (!effectiveClassId || selectedOptionalSubjectIds.size === 0) {
      setEnrolledSubjects(new Set());
      return;
    }
    try {
      const params = new URLSearchParams({
        classId: effectiveClassId,
      });
      selectedOptionalSubjectIds.forEach((subjectId) =>
        params.append("subjectId", subjectId),
      );
      const res = await fetch(
        `/api/student-subjects/status?${params.toString()}`
      );
      const data = await res.json();
      if (res.ok) {
        setEnrolledSubjects(
          new Set(
            (data.enrollments || []).map(
              (enrollment: { studentId: string; subjectId: string }) =>
                `${enrollment.studentId}:${enrollment.subjectId}`,
            ),
          ),
        );
      } else {
        throw new Error(data.error || "Unable to load subject enrollment status.");
      }
    } catch (error) {
      setEnrolledSubjects(new Set());
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load subject enrollment status.",
      );
    }
  }, [effectiveClassId, selectedOptionalSubjectIds, showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadEnrollmentStatus);
  }, [loadEnrollmentStatus]);

  const filteredStudents = students;

  async function handleAddStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!effectiveClassId) {
      showToast("error", "Select a stream first before registering a student.");
      return;
    }

    const firstName = studentForm.first_name.trim();
    const lastName = studentForm.last_name.trim();

    if (!firstName || !lastName) {
      showToast("error", "First name and last name are required.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("students").insert({
      class_id: effectiveClassId,
      first_name: firstName,
      middle_name: studentForm.middle_name.trim() || null,
      last_name: lastName,
      sex: studentForm.sex,
    });

    if (insertError) {
      setSaving(false);
      showToast("error", insertError.message);
      return;
    }

    setStudentForm((current) => ({
      ...EMPTY_STUDENT,
      sex: current.sex,
    }));
    showToast("success", "Student registered successfully.");
    refreshStudents();
    setSaving(false);
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setImporting(true);
    try {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, "_"),
        complete: async (results) => {
          const rows = results.data;
          if (!rows.length) {
            setImporting(false);
            showToast("error", "The CSV file has no rows to import.");
            return;
          }

          const payload: Array<{
            class_id: string;
            first_name: string;
            middle_name: string | null;
            last_name: string;
            sex: "M" | "F";
          }> = [];
          const classLookup = buildClassLookup(classes);
          let skipped = 0;

          for (const row of rows) {
            const firstName = getFirstName(row);
            const lastName = getLastName(row);
            const sex = getSex(row);
            const hasClassValue = Boolean(
              (row.class ?? row.class_name ?? row.darasa)?.trim() ||
                row.form?.trim() ||
                row.mkondo?.trim(),
            );
            const csvClassId = getClassId(row, classLookup);
            const classId = csvClassId ?? (hasClassValue ? null : effectiveClassId);

            if (!firstName || !lastName || !sex || !classId) {
              skipped += 1;
              continue;
            }

            payload.push({
              class_id: classId,
              first_name: firstName,
              middle_name: getMiddleName(row) || null,
              last_name: lastName,
              sex,
            });
          }

          if (!payload.length) {
            setImporting(false);
            showToast(
              "error",
              "No valid rows found. Required columns: first_name/first name, last_name/surname, sex/gender (M/F), and class/darasa. Stream is optional.",
            );
            return;
          }

          const { error: insertError } = await supabase
            .from("students")
            .insert(payload);

          if (insertError) {
            setImporting(false);
            showToast("error", insertError.message);
            return;
          }

          showToast(
            "success",
            `${payload.length} student(s) imported successfully.${
              skipped
                ? ` ${skipped} row(s) skipped because required data or class was missing.`
                : ""
            }`,
          );
          refreshStudents();
          setImporting(false);
        },
        error: (parseError) => {
          setImporting(false);
          showToast("error", parseError.message);
        },
      });
    } catch (e: unknown) {
      setImporting(false);
      showToast("error", e instanceof Error ? e.message : String(e));
    }
  }

  async function confirmDeleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (deleteError) {
      showToast("error", deleteError.message);
      return;
    }

    showToast("success", `${deleteTarget.full_name} was deleted.`);
    setDeleteTarget(null);
    refreshStudents();
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredStudents.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.has(id));
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkOptionalAssignment(action: "assign" | "unassign") {
    if (selectedOptionalSubjectIds.size === 0 || selectedStudentIds.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          subjectIds: Array.from(selectedOptionalSubjectIds),
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Failed to update optional subject assignments.");
        return;
      }
      showToast(
        "success",
        action === "assign"
          ? `${selectedOptionalSubjectIds.size} subject(s) assigned to ${selectedStudentIds.size} student(s).`
          : `${selectedOptionalSubjectIds.size} subject(s) unassigned from ${selectedStudentIds.size} student(s).`
      );
      setSelectedStudentIds(new Set());
      await loadEnrollmentStatus();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="Student Registration"
        subtitle="Register students by class or import a CSV."
        action={
          <>
            <button
              type="button"
              onClick={() => downloadTemplate(activeForm, classes)}
              className="app-btn app-btn-secondary"
            >
              <Download className="h-4 w-4" />
              {activeForm} CSV
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="app-btn app-btn-primary"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Register by CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleCsvImport(e)}
            />
          </>
        }
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
                  setSelectedClassId("");
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

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="app-card h-fit p-5">
          <h2 className="app-card-title">Streams</h2>
          <p className="app-card-subtitle">{activeForm}</p>
          {loading ? (
            <LoadingIndicator label="Loading classes..." className="py-4" />
          ) : formClasses.length ? (
            <div className="mt-4 space-y-1.5">
              {formClasses.map((item) => {
                const active = effectiveClassId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(item.id);
                    }}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border px-3 text-left text-sm font-semibold transition ${
                      active
                        ? "border-brand bg-brand-soft text-brand-dark"
                        : "border-line text-ink-soft hover:bg-brand-tint"
                    }`}
                  >
                    <span>
                      {item.form} {item.stream}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-[10px] bg-highlight p-3 text-sm leading-5 text-highlight-ink">
              No streams found. Add streams under Classes first.
            </p>
          )}
        </aside>

        <div className="min-w-0">
          <div className="app-card overflow-hidden">
            <div className="app-card-header pb-4">
              <div>
                <h2 className="app-card-title">
                  {selectedClass ? `${selectedClass.form} ${selectedClass.stream}` : "Select a stream"}
                </h2>
                <p className="app-card-subtitle">
                  {selectedClass
                    ? "Register and manage students in this stream."
                    : "Choose a stream to begin registration."}
                </p>
              </div>
            </div>

            {selectedClass ? (
              <>
                <form onSubmit={handleAddStudent} className="border-t border-line p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-bold text-ink">Add student</h3>
                    <span className="app-badge app-badge-neutral hidden sm:inline-flex">
                      Manual entry
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
                    <div>
                      <label htmlFor="first_name" className="app-label">
                        First name
                      </label>
                      <input
                        id="first_name"
                        value={studentForm.first_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, first_name: event.target.value }))
                        }
                        required
                        className="app-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="middle_name" className="app-label">
                        Middle name (optional)
                      </label>
                      <input
                        id="middle_name"
                        value={studentForm.middle_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, middle_name: event.target.value }))
                        }
                        className="app-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="last_name" className="app-label">
                        Last name
                      </label>
                      <input
                        id="last_name"
                        value={studentForm.last_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, last_name: event.target.value }))
                        }
                        required
                        className="app-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="sex" className="app-label">
                        Gender
                      </label>
                      <select
                        id="sex"
                        value={studentForm.sex}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, sex: event.target.value as "M" | "F" }))
                        }
                        className="app-select"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div className="min-[1024px]:col-span-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="app-btn app-btn-primary w-full sm:w-auto"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add Student
                      </button>
                    </div>
                  </div>
                </form>

                <div className="border-t border-line">
                  <div className="p-5 pb-3">
                    <label className="relative block w-full max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search students"
                        className="app-input pl-9"
                      />
                    </label>
                  </div>

                  <div className="mx-5 mb-4 rounded-[10px] bg-canvas p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-ink">Bulk optional subjects</h4>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          Select subjects and students, then assign or unassign together.
                        </p>
                      </div>
                      {optionalSubjects.length === 0 && (
                        <span className="app-badge app-badge-warning">
                          No optional subjects for {selectedClass.form}
                        </span>
                      )}
                    </div>
                    {optionalSubjects.length > 0 && (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted">
                            Optional subjects ({selectedOptionalSubjectIds.size} selected)
                          </p>
                          <div className="flex gap-3 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedOptionalSubjectIds(
                                  new Set(optionalSubjects.map((subject) => subject.id)),
                                )
                              }
                              className="text-brand hover:text-brand-dark"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedOptionalSubjectIds(new Set())}
                              className="text-muted hover:text-ink"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {optionalSubjects.map((subject) => {
                            const isSubjectSelected = selectedOptionalSubjectIds.has(subject.id);
                            return (
                              <label
                                key={subject.id}
                                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 text-sm transition ${
                                  isSubjectSelected
                                    ? "border-brand bg-brand-soft text-brand-dark"
                                    : "border-line bg-white text-ink-soft hover:border-brand-light"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSubjectSelected}
                                  onChange={() =>
                                    setSelectedOptionalSubjectIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(subject.id)) next.delete(subject.id);
                                      else next.add(subject.id);
                                      return next;
                                    })
                                  }
                                  className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                                />
                                <span className="min-w-0 flex-1 font-medium">{subject.name}</span>
                                <span className="shrink-0 text-xs text-muted">{subject.subject_code}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                          <span className="text-xs font-medium text-muted">
                            {selectedStudentIds.size} student(s) selected
                          </span>
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleBulkOptionalAssignment("assign")}
                            disabled={bulkSaving || selectedStudentIds.size === 0 || selectedOptionalSubjectIds.size === 0}
                            className="app-btn app-btn-primary app-btn-sm"
                          >
                            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Assign selected
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBulkOptionalAssignment("unassign")}
                            disabled={bulkSaving || selectedStudentIds.size === 0 || selectedOptionalSubjectIds.size === 0}
                            className="app-btn app-btn-secondary app-btn-sm"
                          >
                            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            Unassign selected
                          </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {filteredStudents.length ? (
                    <>
                      <div className="hidden max-h-[60vh] overflow-auto md:block">
                        <table className="app-table min-w-[760px]">
                          <thead className="sticky top-0 z-10 bg-canvas">
                            <tr>
                              <th className="w-10">
                                <button
                                  type="button"
                                  onClick={toggleSelectAllVisible}
                                  className="inline-flex items-center gap-2"
                                  aria-label="Select all visible students"
                                >
                                  {filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id)) ? (
                                    <SquareCheck className="h-4 w-4 text-brand" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="sr-only">Select all</span>
                                </button>
                              </th>
                              <th>#</th>
                              <th>Full name</th>
                              <th>Gender</th>
                              <th>Optional status</th>
                              <th className="text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((student, index) => {
                              const enrolledCount = [...selectedOptionalSubjectIds].filter((subjectId) =>
                                enrolledSubjects.has(`${student.id}:${subjectId}`),
                              ).length;
                              const isSelected = selectedStudentIds.has(student.id);
                              return (
                                <tr key={student.id} className={isSelected ? "bg-brand-tint" : undefined}>
                                  <td>
                                    <button
                                      type="button"
                                      onClick={() => toggleStudentSelection(student.id)}
                                      aria-label={`Select ${student.full_name}`}
                                    >
                                      {isSelected ? (
                                        <SquareCheck className="h-4 w-4 text-brand" />
                                      ) : (
                                        <Square className="h-4 w-4 text-slate-400" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="text-muted">{(page - 1) * pageSize + index + 1}</td>
                                  <td>
                                    <div className="flex items-center gap-3">
                                      <span className="app-avatar h-8 w-8 shrink-0 text-xs">
                                        {getInitials(student.full_name)}
                                      </span>
                                      <span className="font-semibold text-ink">{student.full_name}</span>
                                    </div>
                                  </td>
                                  <td className="text-ink-soft">{student.sex === "M" ? "Male" : "Female"}</td>
                                  <td>
                                    {selectedOptionalSubjectIds.size > 0 ? (
                                      <span className={`app-badge ${
                                        enrolledCount === selectedOptionalSubjectIds.size
                                          ? "app-badge-success"
                                          : enrolledCount > 0
                                            ? "app-badge-warning"
                                            : "app-badge-neutral"
                                      }`}>
                                        {enrolledCount}/{selectedOptionalSubjectIds.size} assigned
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="text-right">
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget(student)}
                                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-danger hover:text-danger-ink"
                                      aria-label={`Delete ${student.full_name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto md:hidden">
                        {filteredStudents.map((student, index) => {
                          const enrolledCount = [...selectedOptionalSubjectIds].filter((subjectId) =>
                            enrolledSubjects.has(`${student.id}:${subjectId}`),
                          ).length;
                          const isSelected = selectedStudentIds.has(student.id);
                          return (
                            <article
                              key={student.id}
                              className={`space-y-3 p-4 ${isSelected ? "bg-brand-tint" : "bg-white"}`}
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggleStudentSelection(student.id)}
                                  aria-label={`${isSelected ? "Deselect" : "Select"} ${student.full_name}`}
                                  className="mt-0.5 shrink-0 rounded-md"
                                >
                                  {isSelected ? (
                                    <SquareCheck className="h-5 w-5 text-brand" />
                                  ) : (
                                    <Square className="h-5 w-5 text-slate-400" />
                                  )}
                                </button>
                                <span className="app-avatar h-9 w-9 shrink-0 text-xs">
                                  {getInitials(student.full_name)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="break-words text-sm font-bold text-ink">
                                      {student.full_name}
                                    </h4>
                                    <span className="app-badge app-badge-neutral shrink-0">
                                      {student.sex === "M" ? "Male" : "Female"}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    {selectedOptionalSubjectIds.size > 0 ? (
                                      <span className={`app-badge ${
                                        enrolledCount === selectedOptionalSubjectIds.size
                                          ? "app-badge-success"
                                          : enrolledCount > 0
                                            ? "app-badge-warning"
                                            : "app-badge-neutral"
                                      }`}>
                                        {enrolledCount}/{selectedOptionalSubjectIds.size} subjects assigned
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400">Student {(page - 1) * pageSize + index + 1}</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget(student)}
                                      aria-label={`Delete ${student.full_name}`}
                                      className="app-btn app-btn-danger app-btn-sm"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-line p-5">
                      <div className="app-empty">
                        <span className="app-empty-icon">
                          <Users className="h-5 w-5" />
                        </span>
                        <h3 className="app-empty-title">
                          {classTotal ? "No matching students" : "No students in this stream"}
                        </h3>
                        <p className="app-empty-text">
                          {classTotal
                            ? "Try searching with a different name."
                            : "Register a student to get started."}
                        </p>
                        {!classTotal && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="app-btn app-btn-primary mt-4"
                          >
                            <FileUp className="h-4 w-4" />
                            Register by CSV
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    loading={studentsLoading}
                  />
                </div>
              </>
            ) : (
              <div className="border-t border-line p-5">
                <div className="app-empty">
                  <span className="app-empty-icon">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <h3 className="app-empty-title">Select a stream</h3>
                  <p className="app-empty-text">
                    Choose a stream on the left to register and view students.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[14px] border border-line bg-white p-5 shadow-xl sm:rounded-[14px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="app-card-title">Delete student</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.full_name}</span>?
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
                onClick={() => void confirmDeleteStudent()}
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


    </div>
  );
}
