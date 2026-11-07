"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Pagination } from "@/components/ui/pagination";
import { notify } from "@/lib/notifications";

interface Teacher {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  email: string | null;
  sex: string;
  phone: string | null;
  role: "teacher" | "academic";
}

interface Assignment {
  id: string;
  teacher_id: string;
  class_name: string;
  subject_name: string;
}

interface Subject {
  id: string;
  form: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
}

interface TeachersPageProps {
  canManageTeachers: boolean;
}

const inputClassName =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const passwordInputClassName =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

export default function TeachersPage({ canManageTeachers }: TeachersPageProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentTotal, setAssignmentTotal] = useState(0);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [confirmTeacher, setConfirmTeacher] = useState<Teacher | null>(null);
  const [confirmAssignment, setConfirmAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "",
    sex: "M",
    phone: "",
    role: "teacher" as "teacher" | "academic",
  });
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [selectedAssignmentKeys, setSelectedAssignmentKeys] = useState<Set<string>>(
    new Set(),
  );

  const fetchSupport = useCallback(async () => {
    try {
      const response = await fetch("/api/class-subjects");
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Unable to load teacher information.");
      }

      setClassSubjects(body.assignments || []);
    } catch (fetchError) {
      notify(
        "error",
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load teacher information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSupport();
  }, [fetchSupport]);

  const teacherIds = teachers.map((teacher) => teacher.id).join(",");

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/teachers/assignments?teacherIds=${encodeURIComponent(teacherIds)}`,
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Unable to load teacher information.");
      }

      setAssignments((body.assignments ?? []) as Assignment[]);
      setAssignmentTotal(body.overallTotal ?? 0);
    } catch (fetchError) {
      notify(
        "error",
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load teacher information.",
      );
    }
  }, [teacherIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  const fetchTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`/api/teachers?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load teacher information.");
      }

      setTeachers((data.teachers ?? []) as Teacher[]);
      setTotal(data.total ?? 0);
      setOverallTotal(data.overallTotal ?? 0);
    } catch (fetchError) {
      notify(
        "error",
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load teacher information.",
      );
    } finally {
      setTeachersLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTeachers();
  }, [fetchTeachers, refreshKey]);

  const refreshAll = useCallback(async () => {
    setPage(1);
    setRefreshKey((current) => current + 1);
    await Promise.all([fetchSupport(), fetchAssignments()]);
  }, [fetchAssignments, fetchSupport]);

  const showToast = (type: "success" | "error", message: string) => {
    notify(type, message);
  };

  const openAddTeacher = () => {
    setEditing(null);
    setForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password: "",
      sex: "M",
      phone: "",
      role: "teacher",
    });
    setShowFormPassword(false);
    setShowTeacherModal(true);
  };

  const openEditTeacher = (teacher: Teacher) => {
    setEditing(teacher);
    setForm({
      first_name: teacher.first_name,
      middle_name: teacher.middle_name || "",
      last_name: teacher.last_name,
      email: teacher.email || "",
      password: "",
      sex: teacher.sex,
      phone: teacher.phone || "",
      role: teacher.role,
    });
    setShowFormPassword(false);
    setShowTeacherModal(true);
  };

  const openAssignmentModal = (teacher: Teacher) => {
    setAssigningTeacher(teacher);
    setSelectedForms(new Set());
    setSelectedAssignmentKeys(new Set());
    setShowAssignmentModal(true);
  };

  const saveTeacher = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast("error", "First name and last name are required.");
      return;
    }
    if (!editing && (!form.email.trim() || !form.password)) {
      showToast("error", "Email and password are required to add a teacher.");
      return;
    }

    try {
      const response = await fetch(
        editing ? `/api/teachers/${editing.id}` : "/api/teachers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            middle_name: form.middle_name || null,
            email: form.email || null,
            phone: form.phone || null,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save the staff account.");
      }

      setShowTeacherModal(false);
      showToast(
        "success",
        editing ? "Staff account updated successfully." : "Staff account added successfully.",
      );
      await refreshAll();
    } catch (saveError) {
      showToast(
        "error",
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the staff account.",
      );
    }
  };

  const deleteTeacher = async (teacher: Teacher) => {
    setConfirmTeacher(teacher);
  };

  const confirmTeacherDelete = async () => {
    if (!confirmTeacher) return;

    try {
      const response = await fetch(`/api/teachers/${confirmTeacher.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to delete the staff account.");
      }
      showToast("success", `${confirmTeacher.full_name} was deleted successfully.`);
      setConfirmTeacher(null);
      await refreshAll();
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the staff account.",
      );
      setConfirmTeacher(null);
    }
  };

  const saveAssignment = async () => {
    if (!assigningTeacher || selectedAssignmentKeys.size === 0) {
      showToast("error", "Select at least one class and subject.");
      return;
    }

    const selectedAssignments = [...selectedAssignmentKeys].flatMap((key) => {
      const separator = key.indexOf(":");
      const form = key.slice(0, separator);
      const subjectId = key.slice(separator + 1);
      const subject = classSubjects.find(
        (assignment) =>
          assignment.form === form && assignment.subject_id === subjectId,
      );
      return subject ? [{ class_name: form, subject_name: subject.subject_name }] : [];
    });
    if (selectedAssignments.length !== selectedAssignmentKeys.size) {
      showToast("error", "Some selected subjects are no longer available. Reload and try again.");
      await refreshAll();
      return;
    }

    setSavingAssignments(true);
    try {
      const response = await fetch("/api/teachers/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: assigningTeacher.id,
          assignments: selectedAssignments,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save the assignment.");
      }
      setShowAssignmentModal(false);
      showToast(
        "success",
        `${data.created} teaching assignment(s) added for ${assigningTeacher.full_name}.`,
      );
      await refreshAll();
    } catch (saveError) {
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Unable to save the assignment.",
      );
    } finally {
      setSavingAssignments(false);
    }
  };

  const deleteAssignment = async (assignment: Assignment) => {
    setConfirmAssignment(assignment);
  };

  const confirmAssignmentDelete = async () => {
    if (!confirmAssignment) return;

    try {
      const response = await fetch(
        `/api/teachers/assignments/${confirmAssignment.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to remove the assignment.");
      }
      showToast("success", `${confirmAssignment.class_name} - ${confirmAssignment.subject_name} was removed.`);
      setConfirmAssignment(null);
      await refreshAll();
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error ? deleteError.message : "Unable to remove the assignment.",
      );
      setConfirmAssignment(null);
    }
  };

  const getAssignments = (teacherId: string) =>
    assignments.filter((assignment) => assignment.teacher_id === teacherId);
  const visibleTeachers = teachers;
  const existingAssignmentKeys = new Set(
    assignments
      .filter((assignment) => assignment.teacher_id === assigningTeacher?.id)
      .flatMap((assignment) => {
        const subject = classSubjects.find(
          (item) =>
            item.form === assignment.class_name &&
            item.subject_name === assignment.subject_name,
        );
        return subject ? [`${assignment.class_name}:${subject.subject_id}`] : [];
      }),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-4 text-white shadow-lg sm:p-5">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col items-start gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
              <Users className="h-3.5 w-3.5" />
              Staff directory
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              {canManageTeachers ? "Staff accounts" : "Teachers"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/90 sm:text-base">
              {canManageTeachers
                ? "Manage staff profiles, roles, contact information, and teaching assignments."
                : "Browse the teaching team and manage class subject assignments."}
            </p>
          </div>
          {canManageTeachers && (
            <button
              type="button"
              onClick={openAddTeacher}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-blue-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add staff member
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-500">
            {canManageTeachers ? "Total staff accounts" : "Total teachers"}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950">{overallTotal}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-500">Teaching assignments</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{assignmentTotal}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-1 sm:p-5">
          <p className="text-sm text-slate-500">Showing</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{total}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="relative block max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search by ${canManageTeachers ? "staff" : "teacher"} name, email, or phone`}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </label>

        {loading || teachersLoading ? (
          <LoadingIndicator
            label={`Loading ${canManageTeachers ? "staff" : "teacher"} information...`}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-8"
          />
        ) : visibleTeachers.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-800">
              <Users className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">
              {overallTotal === 0
                ? canManageTeachers
                  ? "No staff accounts added yet"
                  : "No teachers added yet"
                : `No matching ${canManageTeachers ? "staff accounts" : "teachers"}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {overallTotal === 0
                ? canManageTeachers
                  ? "Add a staff account to build your school directory."
                  : "Add a teacher to build your school staff directory."
                : "Try searching with a different name or contact detail."}
            </p>
            {canManageTeachers && overallTotal === 0 && (
              <button
                type="button"
                onClick={openAddTeacher}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                {canManageTeachers ? "Add first staff member" : "Add first teacher"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTeachers.map((teacher) => {
              const teacherAssignments = getAssignments(teacher.id);
              const assignmentsByClass = new Map<string, Assignment[]>();
              for (const assignment of teacherAssignments) {
                const classAssignments =
                  assignmentsByClass.get(assignment.class_name) ?? [];
                classAssignments.push(assignment);
                assignmentsByClass.set(assignment.class_name, classAssignments);
              }
              const initials = teacher.full_name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();

              return (
                <article
                  key={teacher.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-600 text-sm font-bold text-white shadow-sm">
                        {initials || <UserRound className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-bold text-slate-950">
                            {teacher.full_name}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {teacher.sex === "M" ? "Male" : "Female"}
                          </span>
                          {canManageTeachers && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-blue-800">
                              {teacher.role}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                          <p className="flex min-w-0 items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{teacher.email || "No email provided"}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            <span>{teacher.phone || "No phone provided"}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {teacher.role === "teacher" && (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          <BookOpen className="h-3.5 w-3.5" />
                          Teaching assignments
                        </p>
                        {assignmentsByClass.size ? (
                          <div className="mt-2 space-y-2">
                            {[...assignmentsByClass].map(([className, classAssignments]) => (
                              <div
                                key={className}
                                className="flex flex-col gap-1.5 sm:flex-row sm:items-start"
                              >
                                <span className="shrink-0 pt-1 text-xs font-bold text-slate-700 sm:w-16">
                                  {className}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {classAssignments.map((assignment) => (
                                    <span
                                      key={assignment.id}
                                      className="inline-flex max-w-full items-center gap-1 rounded-lg border border-violet-100 bg-white py-1 pl-2.5 pr-1 text-xs font-medium text-violet-800"
                                    >
                                      <span className="truncate">
                                        {assignment.subject_name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => void deleteAssignment(assignment)}
                                        aria-label={`Remove ${assignment.class_name} ${assignment.subject_name} assignment`}
                                        title="Remove assignment"
                                        className="rounded-md p-1 text-violet-600 hover:bg-rose-50 hover:text-rose-700"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">
                            No teaching assignments yet.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                      {teacher.role === "teacher" && (
                        <button
                          type="button"
                          onClick={() => openAssignmentModal(teacher)}
                          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <Plus className="h-4 w-4" />
                          Assign classes & subjects
                        </button>
                      )}
                      {canManageTeachers && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditTeacher(teacher)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTeacher(teacher)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={teachersLoading}
        />
      </section>

      {confirmTeacher && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
            <h3 className="text-lg font-bold text-slate-950">Confirm deletion</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to delete {confirmTeacher.full_name}?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmTeacher(null)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmTeacherDelete()}
                className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAssignment && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
            <h3 className="text-lg font-bold text-slate-950">Remove assignment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Remove {confirmAssignment.class_name} - {confirmAssignment.subject_name} from this teacher?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmAssignment(null)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAssignmentDelete()}
                className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Staff directory</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">
                  {editing ? "Edit staff account" : "Add staff account"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First name *
                </label>
                <input
                  required
                  value={form.first_name}
                  onChange={(event) =>
                    setForm({ ...form, first_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Middle name
                </label>
                <input
                  value={form.middle_name}
                  onChange={(event) =>
                    setForm({ ...form, middle_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last name *
                </label>
                <input
                  required
                  value={form.last_name}
                  onChange={(event) =>
                    setForm({ ...form, last_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Gender *
                </label>
                <select
                  value={form.sex}
                  onChange={(event) => setForm({ ...form, sex: event.target.value })}
                  className={inputClassName}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              {canManageTeachers && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Role *
                  </label>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role:
                          event.currentTarget.value === "academic"
                            ? "academic"
                            : "teacher",
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="academic">Academic</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email {!editing && "*"}
                </label>
                <input
                  type="email"
                  required={!editing}
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className={inputClassName}
                />
              </div>
              {!editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        setForm({ ...form, password: event.target.value })
                      }
                      className={passwordInputClassName}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((visible) => !visible)}
                      aria-label={
                        showFormPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showFormPassword}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {showFormPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTeacher()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Save staff account
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Assign Classes and Subjects
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Choose any number of forms and subjects for{" "}
                  <span className="font-semibold text-slate-700">
                    {assigningTeacher?.full_name}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                disabled={savingAssignments}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-800">
                  1. Select class forms
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["Form I", "Form II", "Form III", "Form IV"].map((form) => {
                    const checked = selectedForms.has(form);
                    const subjectCount = classSubjects.filter(
                      (subject) => subject.form === form,
                    ).length;
                    return (
                      <label
                        key={form}
                        className={`flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          checked
                            ? "border-blue-300 bg-blue-50 text-blue-900"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={savingAssignments || subjectCount === 0}
                          onChange={(event) => {
                            const selected = event.target.checked;
                            setSelectedForms((current) => {
                              const next = new Set(current);
                              if (selected) next.add(form);
                              else next.delete(form);
                              return next;
                            });
                            if (!selected) {
                              setSelectedAssignmentKeys((current) =>
                                new Set(
                                  [...current].filter(
                                    (key) => !key.startsWith(`${form}:`),
                                  ),
                                ),
                              );
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                        />
                        <span>
                          {form}
                          <span className="block text-[11px] font-normal text-slate-500">
                            {subjectCount} subjects available
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  2. Select subjects for each form
                </h4>
                {selectedForms.size === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                    Choose one or more forms above to see their available subjects.
                  </p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {["Form I", "Form II", "Form III", "Form IV"]
                      .filter((form) => selectedForms.has(form))
                      .map((form) => {
                        const formSubjects = classSubjects.filter(
                          (subject) => subject.form === form,
                        );
                        const availableSubjects = formSubjects.filter(
                          (subject) =>
                            !existingAssignmentKeys.has(
                              `${form}:${subject.subject_id}`,
                            ),
                        );
                        const allSelected =
                          availableSubjects.length > 0 &&
                          availableSubjects.every((subject) =>
                            selectedAssignmentKeys.has(
                              `${form}:${subject.subject_id}`,
                            ),
                          );
                        return (
                          <section
                            key={form}
                            className="rounded-xl border border-slate-200 p-3 sm:p-4"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <h5 className="text-sm font-bold text-slate-900">
                                {form}
                              </h5>
                              <button
                                type="button"
                                disabled={
                                  savingAssignments ||
                                  availableSubjects.length === 0
                                }
                                onClick={() =>
                                  setSelectedAssignmentKeys((current) => {
                                    const next = new Set(current);
                                    for (const subject of availableSubjects) {
                                      const key = `${form}:${subject.subject_id}`;
                                      if (allSelected) next.delete(key);
                                      else next.add(key);
                                    }
                                    return next;
                                  })
                                }
                                className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                              >
                                {allSelected ? "Clear selections" : "Select all"}
                              </button>
                            </div>
                            {formSubjects.length === 0 ? (
                              <p className="text-sm text-amber-700">
                                No subjects are assigned to this form yet.
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {formSubjects.map((subject) => {
                                  const key = `${form}:${subject.subject_id}`;
                                  const alreadyAssigned =
                                    existingAssignmentKeys.has(key);
                                  return (
                                    <label
                                      key={key}
                                      className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                                        alreadyAssigned
                                          ? "border-emerald-100 bg-emerald-50/70"
                                          : "border-slate-100 hover:bg-slate-50"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          alreadyAssigned ||
                                          selectedAssignmentKeys.has(key)
                                        }
                                        disabled={
                                          savingAssignments || alreadyAssigned
                                        }
                                        onChange={(event) =>
                                          setSelectedAssignmentKeys((current) => {
                                            const next = new Set(current);
                                            if (event.target.checked) next.add(key);
                                            else next.delete(key);
                                            return next;
                                          })
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-slate-800">
                                          {subject.subject_name}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {subject.subject_code || "No code"}
                                        </span>
                                      </span>
                                      {alreadyAssigned && (
                                        <span className="shrink-0 text-[11px] font-semibold text-emerald-700">
                                          Assigned
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })}
                  </div>
                )}
              </div>

              <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                {selectedAssignmentKeys.size} new class-subject assignment(s)
                selected. Teachers can have multiple subjects in one form and
                different subjects across forms.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                disabled={savingAssignments}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveAssignment()}
                disabled={savingAssignments || selectedAssignmentKeys.size === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAssignments ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {savingAssignments ? "Saving..." : "Save assignments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
