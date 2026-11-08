"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Search,
  Square,
  SquareCheck,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type FormLevel = "Form I" | "Form II" | "Form III" | "Form IV";
type Sex = "M" | "F";

type SchoolClass = {
  id: string;
  form: FormLevel;
  stream: string;
};

type Student = {
  id: string;
  class_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  sex: Sex;
  created_at: string;
};

type OptionalSubject = {
  id: string;
  name: string;
  subject_code: string;
};

type EditForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  sex: Sex;
};

const FORMS: FormLevel[] = ["Form I", "Form II", "Form III", "Form IV"];
const EMPTY_EDIT_FORM: EditForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "M",
};

function classLabel(schoolClass: SchoolClass) {
  return `${schoolClass.form} ${schoolClass.stream}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function deleteStudentError(error: unknown, multiple = false) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  ) {
    return multiple
      ? "One or more selected students have marks or examination results. Reopen the affected exam and remove their records first."
      : "This student has marks or examination results and cannot be deleted. Reopen the affected exam and remove their records first.";
  }
  return error instanceof Error
    ? error.message
    : multiple
      ? "Unable to delete students."
      : "Unable to delete student.";
}

export function RegisteredStudentsManager({
  registrationHref,
}: {
  registrationHref: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormLevel | "All">("All");
  const [selectedClassId, setSelectedClassId] = useState("All");
  const [selectedStudentMap, setSelectedStudentMap] = useState<
    Record<string, Student>
  >({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToPromote, setStudentToPromote] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [studentForSubjects, setStudentForSubjects] = useState<Student | null>(
    null,
  );
  const [optionalSubjects, setOptionalSubjects] = useState<OptionalSubject[]>([]);
  const [enrolledSubjectIds, setEnrolledSubjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [updatingSubjectId, setUpdatingSubjectId] = useState<string | null>(
    null,
  );
  const [bulkDialog, setBulkDialog] = useState<
    "subjects" | "promote" | "delete" | null
  >(null);
  const [bulkSubjects, setBulkSubjects] = useState<OptionalSubject[]>([]);
  const [bulkSubjectId, setBulkSubjectId] = useState("");

  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, form, stream")
      .order("form")
      .order("stream");

    if (error) {
      notify("error", error.message);
    } else {
      setClasses((data ?? []) as SchoolClass[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, pageSize, selectedClassId, selectedForm]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        includeCounts: "1",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedForm !== "All") params.set("form", selectedForm);
      if (selectedClassId !== "All") params.set("classId", selectedClassId);

      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load registered students.");
      }

      setStudents((data.students ?? []) as Student[]);
      setTotal(data.total ?? 0);
      setOverallTotal(data.overallTotal ?? 0);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load registered students.",
      );
    } finally {
      setStudentsLoading(false);
    }
  }, [debouncedSearch, page, pageSize, selectedClassId, selectedForm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudents();
  }, [loadStudents, refreshKey]);

  const refreshStudents = useCallback(() => {
    setPage(1);
    setRefreshKey((current) => current + 1);
  }, []);

  const classesForForm = useMemo(
    () =>
      selectedForm === "All"
        ? classes
        : classes.filter((schoolClass) => schoolClass.form === selectedForm),
    [classes, selectedForm],
  );

  const visibleStudents = students;
  const selectedStudents = useMemo(
    () => Object.values(selectedStudentMap),
    [selectedStudentMap],
  );
  const selectedStudentIds = useMemo(
    () => new Set(Object.keys(selectedStudentMap)),
    [selectedStudentMap],
  );
  const selectedForms = useMemo(
    () =>
      new Set(
        selectedStudents
          .map((student) =>
            classes.find((schoolClass) => schoolClass.id === student.class_id)
              ?.form,
          )
          .filter((form): form is FormLevel => Boolean(form)),
      ),
    [classes, selectedStudents],
  );
  const canBulkManageSameForm =
    selectedStudents.length > 0 && selectedForms.size === 1;
  const selectedFormForBulk = selectedForms.values().next().value as
    | FormLevel
    | undefined;
  const nextFormForBulk =
    selectedFormForBulk && selectedFormForBulk !== "Form IV"
      ? FORMS[FORMS.indexOf(selectedFormForBulk) + 1]
      : null;
  const bulkPromotionClasses = nextFormForBulk
    ? classes.filter((schoolClass) => schoolClass.form === nextFormForBulk)
    : [];
  const allVisibleSelected =
    visibleStudents.length > 0 &&
    visibleStudents.every((student) => selectedStudentIds.has(student.id));

  function selectForm(form: FormLevel | "All") {
    setSelectedForm(form);
    setSelectedClassId("All");
  }

  function clearSelection() {
    setSelectedStudentMap({});
  }

  function toggleStudentSelection(student: Student) {
    setSelectedStudentMap((current) => {
      if (current[student.id]) {
        const next = { ...current };
        delete next[student.id];
        return next;
      }
      if (Object.keys(current).length >= 500) {
        notify("error", "You can select up to 500 students for a bulk action.");
        return current;
      }
      return { ...current, [student.id]: student };
    });
  }

  function toggleVisibleStudentSelection() {
    setSelectedStudentMap((current) => {
      if (allVisibleSelected) {
        const next = { ...current };
        for (const student of visibleStudents) delete next[student.id];
        return next;
      }

      const next = { ...current };
      for (const student of visibleStudents) {
        if (Object.keys(next).length >= 500) {
          notify("error", "Bulk actions are limited to 500 selected students.");
          return current;
        }
        next[student.id] = student;
      }
      return next;
    });
  }

  async function openBulkSubjects() {
    if (!canBulkManageSameForm || selectedStudents.length === 0) {
      notify("error", "Select students from the same form to manage subjects.");
      return;
    }

    const representativeStudent = selectedStudents[0];
    try {
      const response = await fetch(
        `/api/student-subjects?classId=${encodeURIComponent(representativeStudent.class_id)}`,
      );
      const result = (await response.json()) as {
        subjects?: OptionalSubject[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to load optional subjects.");
      }
      const subjects = result.subjects ?? [];
      setBulkSubjects(subjects);
      setBulkSubjectId(subjects[0]?.id ?? "");
      setBulkDialog("subjects");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load optional subjects.",
      );
    }
  }

  async function updateSelectedOptionalSubject(action: "assign" | "unassign") {
    if (!bulkSubjectId || selectedStudents.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents.map((student) => student.id),
          subjectId: bulkSubjectId,
          action,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to update optional subjects.");
      }
      notify(
        "success",
        `Optional subject ${action === "assign" ? "assigned to" : "removed from"} ${selectedStudents.length} student(s).`,
      );
      clearSelection();
      setBulkDialog(null);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update optional subjects.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function promoteSelectedStudents() {
    if (!canBulkManageSameForm || !targetClassId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/students/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents.map((student) => student.id),
          targetClassId,
          action: "promote",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to promote selected students.");
      }
      const destination = classes.find((item) => item.id === targetClassId);
      notify(
        "success",
        `${selectedStudents.length} student(s) promoted to ${destination ? classLabel(destination) : "the next form"}.`,
      );
      clearSelection();
      setBulkDialog(null);
      refreshStudents();
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to promote selected students.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedStudents() {
    if (selectedStudents.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .in(
          "id",
          selectedStudents.map((student) => student.id),
        );
      if (error) throw error;
      notify("success", `${selectedStudents.length} student(s) deleted.`);
      clearSelection();
      setBulkDialog(null);
      refreshStudents();
    } catch (error) {
      notify("error", deleteStudentError(error, true));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(student: Student) {
    setStudentToEdit(student);
    setEditForm({
      first_name: student.first_name,
      middle_name: student.middle_name ?? "",
      last_name: student.last_name,
      sex: student.sex,
    });
  }

  async function saveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentToEdit) return;

    const firstName = editForm.first_name.trim();
    const lastName = editForm.last_name.trim();
    if (!firstName || !lastName) {
      notify("error", "First and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName,
          middle_name: editForm.middle_name.trim() || null,
          last_name: lastName,
          sex: editForm.sex,
        })
        .eq("id", studentToEdit.id);

      if (error) throw error;
      notify("success", "Student details updated.");
      setStudentToEdit(null);
      clearSelection();
      refreshStudents();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to update student.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent() {
    if (!studentToDelete) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete.id);

      if (error) throw error;
      notify("success", `${studentToDelete.full_name} was deleted.`);
      setStudentToDelete(null);
      clearSelection();
      refreshStudents();
    } catch (error) {
      notify("error", deleteStudentError(error));
    } finally {
      setSaving(false);
    }
  }

  function openPromote(student: Student) {
    const currentClass = classes.find((item) => item.id === student.class_id);
    if (!currentClass) {
      notify("error", "The student's current class could not be found.");
      return;
    }
    if (currentClass.form === "Form IV") {
      notify("error", "Form IV students cannot be promoted to another form.");
      return;
    }

    const nextForm = FORMS[FORMS.indexOf(currentClass.form) + 1];
    const nextClasses = classes.filter((item) => item.form === nextForm);
    if (nextClasses.length === 0) {
      notify("error", `Create a ${nextForm} stream before promoting students.`);
      return;
    }

    setStudentToPromote(student);
    setTargetClassId(nextClasses[0].id);
  }

  async function promoteStudent() {
    if (!studentToPromote || !targetClassId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/students/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentToPromote.id,
          targetClassId,
          action: "promote",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to promote student.");
      }

      const destination = classes.find((item) => item.id === targetClassId);
      notify(
        "success",
        `${studentToPromote.full_name} promoted to ${destination ? classLabel(destination) : "the next class"}.`,
      );
      setStudentToPromote(null);
      clearSelection();
      refreshStudents();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to promote student.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openOptionalSubjects(student: Student) {
    setStudentForSubjects(student);
    setOptionalSubjects([]);
    setEnrolledSubjectIds(new Set());
    setLoadingSubjects(true);

    try {
      const subjectsResponse = await fetch(
        `/api/student-subjects?classId=${encodeURIComponent(student.class_id)}`,
      );
      const subjectsResult = await subjectsResponse.json();

      if (!subjectsResponse.ok) {
        throw new Error(subjectsResult.error || "Unable to load optional subjects.");
      }

      const subjects = (subjectsResult.subjects ?? []) as OptionalSubject[];
      const statusResults = await Promise.all(
        subjects.map(async (subject) => {
          const response = await fetch(
            `/api/student-subjects/status?classId=${encodeURIComponent(student.class_id)}&subjectId=${encodeURIComponent(subject.id)}`,
          );
          const result = (await response.json()) as {
            enrolledStudentIds?: string[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(result.error || "Unable to load student enrollments.");
          }
          return {
            subjectId: subject.id,
            isEnrolled: (result.enrolledStudentIds ?? []).includes(student.id),
          };
        }),
      );

      setOptionalSubjects(subjects);
      setEnrolledSubjectIds(
        new Set(
          statusResults
            .filter((result) => result.isEnrolled)
            .map((result) => result.subjectId),
        ),
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load optional subjects.",
      );
      setStudentForSubjects(null);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function toggleOptionalSubject(subject: OptionalSubject) {
    if (!studentForSubjects) return;
    const isEnrolled = enrolledSubjectIds.has(subject.id);
    setUpdatingSubjectId(subject.id);

    try {
      const response = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [studentForSubjects.id],
          subjectId: subject.id,
          action: isEnrolled ? "unassign" : "assign",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to update optional subject.");
      }

      setEnrolledSubjectIds((current) => {
        const next = new Set(current);
        if (isEnrolled) next.delete(subject.id);
        else next.add(subject.id);
        return next;
      });
      notify(
        "success",
        isEnrolled ? "Optional subject removed." : "Optional subject assigned.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update optional subject.",
      );
    } finally {
      setUpdatingSubjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registered Students"
        subtitle="Browse, edit and manage enrolled students."
        action={
          <Link href={registrationHref} className="app-btn app-btn-primary">
            <GraduationCap className="h-4 w-4" />
            Student registration
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="app-card overflow-hidden">
        <div className="space-y-4 border-b border-line p-5">
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...FORMS] as const).map((form) => {
              const active = selectedForm === form;
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => selectForm(form)}
                  className={`min-h-10 rounded-[10px] px-4 text-sm font-semibold transition ${
                    active
                      ? "bg-brand text-white"
                      : "text-ink-soft hover:bg-brand-tint"
                  }`}
                >
                  {form}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name"
                className="app-input pl-9"
              />
            </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="app-select"
              aria-label="Filter by class"
            >
              <option value="All">All classes</option>
              {classesForForm.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {classLabel(schoolClass)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && visibleStudents.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-line bg-canvas p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleVisibleStudentSelection}
                className="app-btn app-btn-secondary app-btn-sm"
              >
                {allVisibleSelected ? (
                  <SquareCheck className="h-4 w-4 text-brand" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allVisibleSelected ? "Deselect visible" : "Select visible"}
              </button>
              <span className="text-sm font-medium text-muted">
                {selectedStudentIds.size} selected
                {canBulkManageSameForm &&
                  selectedFormForBulk &&
                  ` · ${selectedFormForBulk}`}
                {selectedStudentIds.size > 0 && !canBulkManageSameForm &&
                  " · Choose one form for subject assignment and promotion"}
              </span>
            </div>
            {selectedStudentIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openBulkSubjects()}
                  disabled={!canBulkManageSameForm || saving}
                  title={
                    canBulkManageSameForm
                      ? "Assign or remove an optional subject"
                      : "Selected students must belong to the same form"
                  }
                  className="app-btn app-btn-secondary app-btn-sm"
                >
                  <BookOpen className="h-4 w-4" />
                  Bulk optional subjects
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canBulkManageSameForm) return;
                    if (bulkPromotionClasses.length === 0) {
                      notify(
                        "error",
                        selectedFormForBulk === "Form IV"
                          ? "Form IV students cannot be promoted to another form."
                          : `Create a ${nextFormForBulk} stream before promoting students.`,
                      );
                      return;
                    }
                    setTargetClassId(bulkPromotionClasses[0].id);
                    setBulkDialog("promote");
                  }}
                  disabled={
                    !canBulkManageSameForm ||
                    selectedFormForBulk === "Form IV" ||
                    saving
                  }
                  title={
                    selectedFormForBulk === "Form IV"
                      ? "Form IV students cannot be promoted"
                      : "Promote selected students to the next form"
                  }
                  className="app-btn app-btn-secondary app-btn-sm"
                >
                  <GraduationCap className="h-4 w-4" />
                  Bulk upgrade
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDialog("delete")}
                  disabled={saving}
                  className="app-btn app-btn-danger app-btn-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Bulk delete
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-9 rounded-[10px] px-3 text-sm font-semibold text-muted transition hover:bg-white"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        )}

        {loading || studentsLoading ? (
          <div className="flex justify-center px-5 py-12">
            <LoadingIndicator label="Loading registered students..." />
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={GraduationCap}
              title={overallTotal === 0 ? "No students registered yet" : "No students found"}
              description={
                overallTotal === 0
                  ? "Register students first. They will appear here for ongoing management."
                  : "Try a different search or class filter."
              }
              action={
                overallTotal === 0 ? (
                  <Link href={registrationHref} className="app-btn app-btn-primary">
                    Go to student registration
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="app-table min-w-[760px]">
                <thead className="bg-canvas">
                  <tr>
                    <th className="w-12">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleStudentSelection}
                        aria-label="Select all visible students"
                        className="h-4 w-4 rounded border-line-strong accent-brand"
                      />
                    </th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Gender</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => {
                    const schoolClass = classes.find(
                      (item) => item.id === student.class_id,
                    );
                    return (
                      <tr
                        key={student.id}
                        className={
                          selectedStudentIds.has(student.id) ? "bg-brand-tint" : undefined
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={() => toggleStudentSelection(student)}
                            aria-label={`Select ${student.full_name}`}
                            className="h-4 w-4 rounded border-line-strong accent-brand"
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="app-avatar h-8 w-8 shrink-0 text-xs">
                              {getInitials(student.full_name)}
                            </span>
                            <span className="font-semibold text-ink">
                              {student.full_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge tone="neutral">
                            {schoolClass ? classLabel(schoolClass) : "Class unavailable"}
                          </Badge>
                        </td>
                        <td className="text-ink-soft">
                          {student.sex === "M" ? "Male" : "Female"}
                        </td>
                        <td>
                          <StudentActions
                            student={student}
                            onEdit={() => openEdit(student)}
                            onSubjects={() => void openOptionalSubjects(student)}
                            onPromote={() => openPromote(student)}
                            onDelete={() => setStudentToDelete(student)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#eef3f1] md:hidden">
              {visibleStudents.map((student) => {
                const schoolClass = classes.find(
                  (item) => item.id === student.class_id,
                );
                return (
                  <article
                    key={student.id}
                    className={`space-y-3 p-4 ${selectedStudentIds.has(student.id) ? "bg-brand-tint" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.id)}
                        onChange={() => toggleStudentSelection(student)}
                        aria-label={`Select ${student.full_name}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-line-strong accent-brand"
                      />
                      <span className="app-avatar h-8 w-8 shrink-0 text-xs">
                        {getInitials(student.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-ink">
                          {student.full_name}
                        </h3>
                        <p className="text-xs text-muted">
                          {student.sex === "M" ? "Male" : "Female"}
                        </p>
                      </div>
                      <Badge tone="neutral" className="shrink-0">
                        {schoolClass ? classLabel(schoolClass) : "Class unavailable"}
                      </Badge>
                    </div>
                    <StudentActions
                      student={student}
                      onEdit={() => openEdit(student)}
                      onSubjects={() => void openOptionalSubjects(student)}
                      onPromote={() => openPromote(student)}
                      onDelete={() => setStudentToDelete(student)}
                    />
                  </article>
                );
              })}
            </div>
          </>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={studentsLoading}
        />
      </section>

      {studentToEdit && (
        <Modal title="Edit student details" onClose={() => setStudentToEdit(null)}>
          <form onSubmit={(event) => void saveStudent(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                value={editForm.first_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, first_name: value }))
                }
                required
              />
              <TextField
                label="Middle name"
                value={editForm.middle_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, middle_name: value }))
                }
              />
              <TextField
                label="Last name"
                value={editForm.last_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, last_name: value }))
                }
                required
              />
              <label className="app-label">
                Gender
                <select
                  value={editForm.sex}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      sex: event.target.value as Sex,
                    }))
                  }
                  className="app-select mt-1.5"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
            </div>
            <ModalActions
              onCancel={() => setStudentToEdit(null)}
              busy={saving}
              submitLabel="Save changes"
            />
          </form>
        </Modal>
      )}

      {studentForSubjects && (
        <Modal
          title="Optional subject enrollment"
          description={`${studentForSubjects.full_name} · ${classes.find((item) => item.id === studentForSubjects.class_id) ? classLabel(classes.find((item) => item.id === studentForSubjects.class_id)!) : ""}`}
          onClose={() => setStudentForSubjects(null)}
        >
          {loadingSubjects ? (
            <LoadingIndicator label="Loading optional subjects..." className="py-6" />
          ) : optionalSubjects.length === 0 ? (
            <p className="rounded-xl bg-highlight p-4 text-sm text-highlight-ink">
              No optional subjects are configured for this form. Set them up in
              the subject assignments page first.
            </p>
          ) : (
            <div className="space-y-2">
              {optionalSubjects.map((subject) => {
                const enrolled = enrolledSubjectIds.has(subject.id);
                const busy = updatingSubjectId === subject.id;
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{subject.name}</p>
                      <p className="text-xs text-muted">{subject.subject_code}</p>
                    </div>
                    <button
                      type="button"
                      disabled={updatingSubjectId !== null}
                      onClick={() => void toggleOptionalSubject(subject)}
                      className={`app-btn app-btn-sm shrink-0 ${
                        enrolled ? "app-btn-secondary" : "app-btn-primary"
                      }`}
                    >
                      {busy ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : enrolled ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                      {enrolled ? "Assigned" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {studentToPromote && (
        <Modal
          title="Promote student"
          description={`Move ${studentToPromote.full_name} to the next form.`}
          onClose={() => setStudentToPromote(null)}
        >
          <div className="space-y-4">
            <label className="app-label">
              Destination class
              <select
                value={targetClassId}
                onChange={(event) => setTargetClassId(event.target.value)}
                className="app-select mt-1.5"
              >
                {classes
                  .filter((schoolClass) => {
                    const currentClass = classes.find(
                      (item) => item.id === studentToPromote.class_id,
                    );
                    return (
                      currentClass &&
                      FORMS.indexOf(schoolClass.form) ===
                        FORMS.indexOf(currentClass.form) + 1
                    );
                  })
                  .map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {classLabel(schoolClass)}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-xs leading-5 text-muted">
              The current form&apos;s subject assignments are added to the
              destination form, and existing destination assignments are kept.
              Compulsory subjects will be updated automatically. Examination
              results stay recorded under the form and academic year of the
              original examination.
            </p>
            <ModalActions
              onCancel={() => setStudentToPromote(null)}
              onConfirm={() => void promoteStudent()}
              busy={saving}
              submitLabel="Promote student"
            />
          </div>
        </Modal>
      )}

      {studentToDelete && (
        <Modal
          title="Delete student"
          description={`Are you sure you want to delete ${studentToDelete.full_name}? This will also remove their subject enrollments. Students with marks or examination results cannot be deleted.`}
          onClose={() => setStudentToDelete(null)}
        >
          <ModalActions
            onCancel={() => setStudentToDelete(null)}
            onConfirm={() => void deleteStudent()}
            busy={saving}
            submitLabel="Delete student"
            destructive
          />
        </Modal>
      )}

      {bulkDialog === "subjects" && (
        <Modal
          title="Bulk optional subject assignment"
          description={`Apply an optional subject to ${selectedStudents.length} selected student(s) in ${selectedFormForBulk ?? "the selected form"}.`}
          onClose={() => setBulkDialog(null)}
        >
          {bulkSubjects.length === 0 ? (
            <p className="rounded-xl bg-highlight p-4 text-sm leading-6 text-highlight-ink">
              No optional subjects are configured for this form. Configure
              optional subjects in the class subject assignments page first.
            </p>
          ) : (
            <div className="space-y-4">
              <label className="app-label">
                Optional subject
                <select
                  value={bulkSubjectId}
                  onChange={(event) => setBulkSubjectId(event.target.value)}
                  className="app-select mt-1.5"
                >
                  {bulkSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.subject_code})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBulkDialog(null)}
                  disabled={saving}
                  className="app-btn app-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelectedOptionalSubject("unassign")}
                  disabled={saving || !bulkSubjectId}
                  className="app-btn app-btn-secondary"
                >
                  Remove from selected
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelectedOptionalSubject("assign")}
                  disabled={saving || !bulkSubjectId}
                  className="app-btn app-btn-primary"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Assign to selected
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {bulkDialog === "promote" && (
        <Modal
          title="Bulk upgrade students"
          description={`Promote ${selectedStudents.length} student(s) from ${selectedFormForBulk ?? "the selected form"} to ${nextFormForBulk ?? "the next form"}.`}
          onClose={() => setBulkDialog(null)}
        >
          <div className="space-y-4">
            <label className="app-label">
              Destination class
              <select
                value={targetClassId}
                onChange={(event) => setTargetClassId(event.target.value)}
                className="app-select mt-1.5"
              >
                {bulkPromotionClasses.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {classLabel(schoolClass)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-5 text-muted">
              All selected students will move to this class. The current
              form&apos;s subject assignments are added to the destination
              form, and existing destination assignments are kept. Compulsory
              subjects update automatically, and optional subjects not offered
              in the next form are removed. Examination results remain recorded
              under the original form and academic year.
            </p>
            <ModalActions
              onCancel={() => setBulkDialog(null)}
              onConfirm={() => void promoteSelectedStudents()}
              busy={saving}
              submitLabel={`Upgrade ${selectedStudents.length} student(s)`}
            />
          </div>
        </Modal>
      )}

      {bulkDialog === "delete" && (
        <Modal
          title="Delete selected students"
          description={`You are about to permanently delete ${selectedStudents.length} student(s) and their subject enrollments. Students with marks or examination results cannot be deleted. This action cannot be undone.`}
          onClose={() => setBulkDialog(null)}
        >
          <ModalActions
            onCancel={() => setBulkDialog(null)}
            onConfirm={() => void deleteSelectedStudents()}
            busy={saving}
            submitLabel={`Delete ${selectedStudents.length} student(s)`}
            destructive
          />
        </Modal>
      )}
    </div>
  );
}

function StudentActions({
  student,
  onEdit,
  onSubjects,
  onPromote,
  onDelete,
}: {
  student: Student;
  onEdit: () => void;
  onSubjects: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ActionButton label={`Edit ${student.full_name}`} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        <span className="hidden lg:inline">Edit</span>
      </ActionButton>
      <ActionButton
        label={`Manage optional subjects for ${student.full_name}`}
        onClick={onSubjects}
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden lg:inline">Subjects</span>
      </ActionButton>
      <ActionButton
        label={`Promote ${student.full_name}`}
        onClick={onPromote}
      >
        <ArrowRight className="h-4 w-4" />
        <span className="hidden lg:inline">Promote</span>
      </ActionButton>
      <ActionButton
        label={`Delete ${student.full_name}`}
        onClick={onDelete}
        destructive
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden lg:inline">Delete</span>
      </ActionButton>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
        destructive
          ? "border-danger-line text-danger-ink hover:bg-danger"
          : "border-line text-ink-soft hover:bg-brand-tint"
      }`}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="app-label">
      {label}
      <input
        value={value}
        required={required}
        maxLength={100}
        onChange={(event) => onChange(event.target.value)}
        className="app-input mt-1.5"
      />
    </label>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-management-modal-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="student-management-modal-title"
              className="text-lg font-bold text-ink"
            >
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm leading-5 text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-canvas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  busy,
  submitLabel,
  destructive = false,
}: {
  onCancel: () => void;
  onConfirm?: () => void;
  busy: boolean;
  submitLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="app-btn app-btn-secondary"
      >
        Cancel
      </button>
      <button
        type={onConfirm ? "button" : "submit"}
        onClick={onConfirm}
        disabled={busy}
        className={`app-btn ${destructive ? "app-btn-danger" : "app-btn-primary"}`}
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
