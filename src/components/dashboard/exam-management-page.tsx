"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calculator,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  GraduationCap,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Pagination } from "@/components/ui/pagination";
import { notify } from "@/lib/notifications";

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: "Draft" | "Active" | "Processed";
  created_at: string;
  has_practical: boolean;
};

type Subject = {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
};

type AcademicPeriod = {
  academic_year: string;
  term: "Term I" | "Term II";
};

const FORMS = ["Form I", "Form II", "Form III", "Form IV"];

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function statusStyle(status: Exam["status"]) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Processed") return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function ExamManagementPage({
  canManageExams,
  dashboardBase,
  initialStatus = "All",
}: {
  canManageExams: boolean;
  dashboardBase: string;
  initialStatus?: string;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activePeriod, setActivePeriod] = useState<AcademicPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingExamId, setUpdatingExamId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [examToProcess, setExamToProcess] = useState<Exam | null>(null);
  const [examToReopen, setExamToReopen] = useState<Exam | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);
  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    Draft: 0,
    Active: 0,
    Processed: 0,
  });
  const [examsLoading, setExamsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState(
    !canManageExams
      ? "Active"
      : ["All", "Draft", "Active", "Processed"].includes(initialStatus)
        ? initialStatus
        : "All",
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [form, setForm] = useState({
    name: "",
    class_form: "Form I",
    start_date: "",
    end_date: "",
    has_practical: false,
  });

  const loadSupport = useCallback(async () => {
    if (!canManageExams) {
      setLoading(false);
      return;
    }
    try {
      const [subjectsResponse, periodResponse] = await Promise.all([
        fetch("/api/subjects"),
        fetch("/api/settings/academic-period"),
      ]);

      const subjectsResult = await subjectsResponse.json();
      if (!subjectsResponse.ok) {
        throw new Error(subjectsResult.error || "Unable to load subjects.");
      }
      setSubjects((subjectsResult.subjects ?? []) as Subject[]);

      const periodResult = await periodResponse.json();
      if (!periodResponse.ok && periodResponse.status !== 409) {
        throw new Error(
          periodResult.error || "Unable to load the active academic period.",
        );
      }
      setActivePeriod(
        periodResponse.ok
          ? (periodResult.period as AcademicPeriod | null)
          : null,
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to load exam information.",
      );
    } finally {
      setLoading(false);
    }
  }, [canManageExams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSupport();
  }, [loadSupport]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, pageSize, selectedYear, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (selectedYear) params.set("year", selectedYear);

      const response = await fetch(`/api/exams?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load examinations.");
      }

      setExams((data.exams ?? []) as Exam[]);
      setTotal(data.total ?? 0);
      setOverallTotal(data.overallTotal ?? 0);
      setAvailableYears((data.availableYears ?? []) as string[]);
      setStatusCounts(
        (data.statusCounts ?? { Draft: 0, Active: 0, Processed: 0 }) as Record<
          string,
          number
        >,
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to load examinations.",
      );
    } finally {
      setExamsLoading(false);
    }
  }, [debouncedSearch, page, pageSize, selectedYear, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExams();
  }, [loadExams, refreshKey]);

  const refreshAll = useCallback(async () => {
    setPage(1);
    setRefreshKey((current) => current + 1);
    await loadSupport();
  }, [loadSupport]);

  const visibleExams = exams;
  const draftCount = statusCounts.Draft ?? 0;
  const activeCount = statusCounts.Active ?? 0;
  const processedCount = statusCounts.Processed ?? 0;

  function closeCreateForm() {
    setShowCreateForm(false);
    setSelectedSubjectIds(new Set());
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.end_date < form.start_date) {
      notify("error", "The end date must be on or after the start date.");
      return;
    }
    if (selectedSubjectIds.size === 0) {
      notify("error", "Select at least one subject for this examination.");
      return;
    }
    if (!activePeriod) {
      notify("error", "Set the active academic year and term in Settings first.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          academic_year: activePeriod.academic_year,
          term: activePeriod.term,
          has_practical: form.has_practical,
          subjects: Array.from(selectedSubjectIds),
        }),
      });
      const result = (await response.json()) as {
        exam?: Exam;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to create examination.");
      }

      notify("success", "Examination created as a draft.");
      setForm((current) => ({
        ...current,
        name: "",
        start_date: "",
        end_date: "",
        has_practical: false,
      }));
      closeCreateForm();
      setSelectedYear("");
      await refreshAll();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to create examination.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateExamStatus(
    exam: Exam,
    action: "activate" | "process" | "reopen",
  ) {
    setUpdatingExamId(exam.id);
    try {
      const response = await fetch(`/api/exams/${exam.id}/${action}`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        results_count?: number;
        incomplete_count?: number;
        results_removed?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || `Unable to ${action} examination.`);
      }
      notify(
        "success",
        action === "activate"
          ? "Examination activated. Teachers can now enter marks."
          : action === "process"
            ? `Examination processed. ${result.results_count ?? 0} student results are ready; ${result.incomplete_count ?? 0} are incomplete.`
            : `Examination reopened for mark entry. ${result.results_removed ?? 0} previous result(s) were removed.`,
      );
      if (action === "process") setStatusFilter("Processed");
      if (action === "reopen") setStatusFilter("Active");
      await refreshAll();
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : `Unable to ${action} examination.`,
      );
    } finally {
      setUpdatingExamId(null);
      if (action === "process") setExamToProcess(null);
      if (action === "reopen") setExamToReopen(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Assessment centre
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              {canManageExams ? "Exam Management" : "My Exams"}
            </h2>
          </div>
          {canManageExams && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              disabled={!activePeriod}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Create examination
            </button>
          )}
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <label className="relative block w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search exam, form, or year"
              className={`${inputClass} min-h-10 rounded-lg pl-9 text-sm`}
            />
          </label>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className={`${inputClass} min-h-10 rounded-lg text-sm sm:w-52`}
              aria-label="Filter exams by academic year"
            >
              <option value="">
                Current year
                {activePeriod?.academic_year
                  ? ` (${activePeriod.academic_year})`
                  : ""}
              </option>
              <option value="all">All years</option>
              {availableYears
                .filter((year) => year !== activePeriod?.academic_year)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={`${inputClass} min-h-10 rounded-lg text-sm sm:w-40`}
              aria-label="Filter exams by status"
              disabled={!canManageExams && statusFilter === "Active"}
            >
              {canManageExams ? (
                <>
                  <option>All</option>
                  <option>Draft</option>
                  <option>Active</option>
                  <option>Processed</option>
                </>
              ) : (
                <option>Active</option>
              )}
            </select>
          </div>
        </div>

        {loading || examsLoading ? (
          <div className="flex justify-center p-10">
            <LoadingIndicator label="Loading examinations..." />
          </div>
        ) : visibleExams.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <GraduationCap className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">
              {overallTotal === 0
                ? selectedYear === "all"
                  ? "No examinations yet"
                  : "No examinations for this year"
                : "No matching examinations"}
            </h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              {canManageExams
                ? "Create an examination to start organizing assessment periods."
                : "Active examinations across all classes and forms will appear here, even if their dates have not started."}
            </p>
            {canManageExams && overallTotal === 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                disabled={!activePeriod}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Create first examination
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleExams.map((exam) => (
              <article
                key={exam.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-slate-950">
                        {exam.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {exam.class_form}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{exam.term}</span>
                        <span aria-hidden="true">·</span>
                        <span>{exam.academic_year}</span>
                        {exam.has_practical && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-emerald-700">
                              Practical
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyle(exam.status)}`}
                  >
                    {exam.status}
                  </span>
                </div>

                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(exam.start_date)} – {formatDate(exam.end_date)}
                </p>

                {(canManageExams || exam.status !== "Draft") && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-2">
                    {canManageExams && exam.status === "Draft" && (
                      <button
                        type="button"
                        disabled={updatingExamId !== null}
                        onClick={() => void updateExamStatus(exam, "activate")}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingExamId === exam.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Activate
                      </button>
                    )}
                    {canManageExams && exam.status === "Active" && (
                      <button
                        type="button"
                        disabled={updatingExamId !== null}
                        onClick={() => setExamToProcess(exam)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingExamId === exam.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Calculator className="h-3.5 w-3.5" />
                        )}
                        Process
                      </button>
                    )}
                    {canManageExams && exam.status === "Active" && (
                      <Link
                        href={`${dashboardBase}/marks?examId=${encodeURIComponent(exam.id)}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Enter Marks
                      </Link>
                    )}
                    {canManageExams && exam.status === "Processed" && (
                      <button
                        type="button"
                        disabled={updatingExamId !== null}
                        onClick={() => setExamToReopen(exam)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingExamId === exam.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Reopen
                      </button>
                    )}
                    {canManageExams && exam.status === "Processed" && (
                      <Link
                        href={`${dashboardBase}/exams/${exam.id}/results`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Results
                      </Link>
                    )}
                    {canManageExams && (
                      <Link
                        href={`${dashboardBase}/exams/${exam.id}/isal`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        ISAL
                      </Link>
                    )}
                    {!canManageExams && exam.status === "Active" && (
                      <Link
                        href={`${dashboardBase}/marks?examId=${encodeURIComponent(exam.id)}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Enter Marks
                      </Link>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={examsLoading}
        />
      </section>

      {showCreateForm && canManageExams && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeCreateForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-exam-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  New assessment
                </p>
                <h3 id="create-exam-title" className="mt-1 text-lg font-bold text-slate-950">
                  Create examination
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={saving}
                aria-label="Close create examination"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(event) => void createExam(event)}>
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                  Examination name
                  <input
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="e.g. Mid-Term Examination"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  Class form
                  <select
                    value={form.class_form}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        class_form: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {FORMS.map((schoolForm) => (
                      <option key={schoolForm}>{schoolForm}</option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Academic period for this examination
                  </p>
                  <p className="mt-1 font-bold text-indigo-950">
                    {activePeriod?.academic_year} · {activePeriod?.term}
                  </p>
                  <p className="mt-1 text-xs text-indigo-800">
                    This is controlled in Academic Settings and cannot be changed
                    for an individual examination.
                  </p>
                </div>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.has_practical}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        has_practical: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                  />
                  This examination has practical marks
                  <span className="ml-auto text-xs font-medium text-slate-500">
                    Theory /100 + Practical /50
                  </span>
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  Start date
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_date: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  End date
                  <input
                    required
                    type="date"
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        end_date: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <fieldset className="space-y-2 sm:col-span-2">
                  <legend className="text-sm font-semibold text-slate-700">
                    Subjects included
                  </legend>
                  {subjects.length === 0 ? (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                      Add subjects before creating an examination.
                    </p>
                  ) : (
                    <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                      {subjects.map((subject) => (
                        <label
                          key={subject.id}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSubjectIds.has(subject.id)}
                            onChange={() => toggleSubject(subject.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">
                              {subject.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {subject.subject_code}
                              {subject.has_practical ? " · Practical" : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    {selectedSubjectIds.size} subject(s) selected
                  </p>
                </fieldset>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  disabled={saving}
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || subjects.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Save as draft
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {examToReopen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && updatingExamId === null) {
              setExamToReopen(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reopen-exam-title"
            aria-describedby="reopen-exam-description"
            className="w-full rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <RotateCcw className="h-5 w-5" />
            </span>
            <h3 id="reopen-exam-title" className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
              Reopen examination for editing?
            </h3>
            <p id="reopen-exam-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Results for <span className="font-semibold">{examToReopen.name}</span> will be removed, and mark entry will be reopened. Process the examination again when corrections are complete.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={updatingExamId !== null}
                onClick={() => setExamToReopen(null)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingExamId !== null}
                onClick={() => {
                  void updateExamStatus(examToReopen, "reopen");
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingExamId === examToReopen.id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Reopen examination
              </button>
            </div>
          </section>
        </div>
      )}

      {examToProcess && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && updatingExamId === null) {
              setExamToProcess(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="process-exam-title"
            aria-describedby="process-exam-description"
            className="w-full rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <h3 id="process-exam-title" className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
              Process examination results?
            </h3>
            <p id="process-exam-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Results for <span className="font-semibold">{examToProcess.name}</span> will be calculated. Missing required marks will be recorded as incomplete, and mark entry will close.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={updatingExamId !== null}
                onClick={() => setExamToProcess(null)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingExamId !== null}
                onClick={() => {
                  void updateExamStatus(examToProcess, "process");
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingExamId === examToProcess.id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Process results
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
