"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, LoaderCircle, Save, Search } from "lucide-react";
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
  has_practical: boolean;
};

type Subject = {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
};

type Student = {
  id: string;
  full_name: string;
};

type Mark = {
  student_id: string;
  theory_score: number | null;
  practical_score: number | null;
  is_absent: boolean;
};

type MarkEntry = {
  theory: string;
  practical: string;
  absent: boolean;
};

type SaveMark = {
  student_id: string;
  theory_score: number | null;
  practical_score: number | null;
  is_absent: boolean;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

async function readResponse<T>(response: Response): Promise<T> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "Unable to load examination marks.");
  }
  return result;
}

export function MarksEntryPage({ dashboardBase }: { dashboardBase: string }) {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Record<string, MarkEntry>>({});
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const selectExam = useCallback(async (nextExamId: string) => {
    setExamId(nextExamId);
    setExam(exams.find((item) => item.id === nextExamId) ?? null);
    setSubjectId("");
    setSubjects([]);
    setStudents([]);
    setEntries({});
    setPage(1);
    setTotal(0);
    setOverallTotal(0);
    setSearch("");
    setDebouncedSearch("");
    if (!nextExamId) return;

    setLoadingSubjects(true);
    try {
      const result = await readResponse<{ exam: Exam; subjects: Subject[] }>(
        await fetch(`/api/marks?examId=${encodeURIComponent(nextExamId)}`),
      );
      setExam(result.exam);
      setSubjects(result.subjects);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to load exam subjects.",
      );
    } finally {
      setLoadingSubjects(false);
    }
  }, [exams]);

  useEffect(() => {
    let active = true;

    async function loadExams() {
      const requestedExamId = new URLSearchParams(window.location.search).get("examId");
      if (!requestedExamId) {
        router.replace(`${dashboardBase}/exams`);
        return;
      }

      try {
        const result = await readResponse<{ exams: Exam[] }>(
          await fetch("/api/marks"),
        );
        if (active) setExams(result.exams);
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error ? error.message : "Unable to load active examinations.",
          );
        }
      } finally {
        if (active) setLoadingExams(false);
      }
    }

    void loadExams();
    return () => {
      active = false;
    };
  }, [dashboardBase, router]);

  useEffect(() => {
    const requestedExamId = new URLSearchParams(window.location.search).get("examId");
    if (
      requestedExamId &&
      requestedExamId !== examId &&
      exams.some((item) => item.id === requestedExamId)
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete("examId");
      window.history.replaceState(null, "", url);
      void Promise.resolve().then(() => selectExam(requestedExamId));
    }
  }, [examId, exams, selectExam]);

  function selectSubject(nextSubjectId: string) {
    setSubjectId(nextSubjectId);
    setStudents([]);
    setEntries({});
    setPage(1);
    setTotal(0);
    setOverallTotal(0);
    setSearch("");
    setDebouncedSearch("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, pageSize, subjectId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  useEffect(() => {
    if (!examId || !subjectId) return;
    let active = true;

    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const query = new URLSearchParams({
          examId,
          subjectId,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (debouncedSearch) query.set("search", debouncedSearch);

        const result = await readResponse<{
          students: Student[];
          marks: Mark[];
          total: number;
          overallTotal: number;
        }>(await fetch(`/api/marks?${query.toString()}`));
        if (!active) return;

        const savedMarks = new Map(
          result.marks.map((mark) => [mark.student_id, mark]),
        );
        const initialEntries = Object.fromEntries(
          result.students.map((student) => {
            const mark = savedMarks.get(student.id);
            return [
              student.id,
              {
                theory:
                  mark?.theory_score === null || mark?.theory_score === undefined
                    ? ""
                    : String(mark.theory_score),
                practical:
                  mark?.practical_score === null ||
                  mark?.practical_score === undefined
                    ? ""
                    : String(mark.practical_score),
                absent: mark?.is_absent ?? false,
              },
            ];
          }),
        );
        setStudents(result.students);
        setTotal(result.total ?? 0);
        setOverallTotal(result.overallTotal ?? 0);
        setEntries((current) => ({ ...current, ...initialEntries }));
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "Unable to load students and marks.",
          );
        }
      } finally {
        if (active) setLoadingStudents(false);
      }
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [debouncedSearch, examId, page, pageSize, subjectId]);

  function updateEntry(studentId: string, changes: Partial<MarkEntry>) {
    setEntries((current) => ({
      ...current,
      [studentId]: { ...current[studentId], ...changes },
    }));
  }

  async function saveAllMarks() {
    const marks: SaveMark[] = [];
    for (const student of students) {
      const entry = entries[student.id];
      if (!entry) continue;

      const hasMarks = entry.theory.trim() !== "" || entry.practical.trim() !== "";
      if (!entry.absent && !hasMarks) continue;

      const theory = entry.theory.trim() === "" ? null : Number(entry.theory);
      const practical =
        entry.practical.trim() === "" ? null : Number(entry.practical);

      if (!entry.absent && (theory === null || !Number.isFinite(theory) || theory < 0 || theory > 100)) {
        notify("error", `Enter a valid theory mark for ${student.full_name} (0–100).`);
        return;
      }
      if (
        !entry.absent &&
        subjectHasPractical &&
        (practical === null ||
          !Number.isFinite(practical) ||
          practical < 0 ||
          practical > 50)
      ) {
        notify("error", `Enter a valid practical mark for ${student.full_name} (0–50).`);
        return;
      }

      marks.push({
        student_id: student.id,
        theory_score: theory,
        practical_score: subjectHasPractical ? practical : null,
        is_absent: entry.absent,
      });
    }

    if (marks.length === 0) {
      notify("error", "Enter marks or mark a student absent before saving.");
      return;
    }

    setSavingAll(true);
    try {
      const result = await readResponse<{ marks: Mark[] }>(
        await fetch("/api/marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exam_id: examId, subject_id: subjectId, marks }),
        }),
      );
      const savedEntries = Object.fromEntries(
        result.marks.map((saved) => [
          saved.student_id,
          {
            theory:
              saved.theory_score === null ? "" : String(saved.theory_score),
            practical:
              saved.practical_score === null
                ? ""
                : String(saved.practical_score),
            absent: saved.is_absent,
          },
        ]),
      );
      setEntries((current) => ({ ...current, ...savedEntries }));
      notify("success", `Marks saved for ${result.marks.length} student(s).`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to save student marks.",
      );
    } finally {
      setSavingAll(false);
    }
  }

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const subjectHasPractical =
    Boolean(exam?.has_practical && selectedSubject?.has_practical);
  const readyToSaveCount = students.filter((student) => {
    const entry = entries[student.id];
    return Boolean(
      entry &&
        (entry.absent ||
          entry.theory.trim() !== "" ||
          entry.practical.trim() !== ""),
    );
  }).length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Active examination
          <select
            className={inputClass}
            value={examId}
            disabled={loadingExams}
            onChange={(event) => void selectExam(event.target.value)}
          >
            <option value="">
              {loadingExams ? "Loading examinations..." : "Select an examination"}
            </option>
            {exams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.class_form} · {item.academic_year} {item.term}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Subject
          <select
            className={inputClass}
            value={subjectId}
            disabled={!examId || loadingSubjects || subjects.length === 0}
            onChange={(event) => void selectSubject(event.target.value)}
          >
            <option value="">
              {loadingSubjects
                ? "Loading subjects..."
                : "Select a subject"}
            </option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
                {subject.subject_code ? ` (${subject.subject_code})` : ""}
              </option>
            ))}
          </select>
        </label>
        {exam && (
          <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-800">
              {exam.class_form} · {exam.academic_year} · {exam.term}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
              Mark entry open until results are processed
            </span>
          </div>
        )}
      </section>

      {loadingStudents ? (
        <LoadingIndicator label="Loading students and marks..." className="py-10" />
      ) : subjectId ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedSubject?.name ?? "Students"}
              </h3>
              <p className="text-sm text-slate-500">
                {total} student(s)
                {overallTotal !== total ? ` (filtered from ${overallTotal})` : ""}.
                Enter marks for the class, then save once at the end.
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student name"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          </div>
          {students.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
              {overallTotal === 0
                ? "No students are enrolled in this subject for the selected class."
                : "No students match your search."}
            </div>
          ) : (
            <div className="grid gap-3">
              {students.map((student) => {
                const entry = entries[student.id];
                return (
                  <article
                    key={student.id}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-4"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 lg:flex lg:justify-between">
                      <div className="min-w-0 lg:w-56">
                        <h4 className="truncate font-semibold text-slate-900">
                          {student.full_name}
                        </h4>
                      </div>

                      <label className="inline-flex min-h-9 items-center gap-1.5 justify-self-end text-xs font-medium text-slate-600 sm:gap-2 sm:text-sm">
                        <input
                          type="checkbox"
                          disabled={savingAll}
                          checked={entry?.absent ?? false}
                          onChange={(event) =>
                            updateEntry(student.id, {
                              absent: event.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                        />
                        Absent
                      </label>

                      <div className="col-span-2 flex min-w-0 items-end gap-2 lg:col-span-1 lg:flex-1 lg:justify-end">
                        <div
                          className={`grid min-w-0 flex-1 gap-2 ${
                            subjectHasPractical ? "grid-cols-2" : "grid-cols-1"
                          } lg:max-w-xl`}
                        >
                          <label className="min-w-0 space-y-1 text-[11px] font-semibold text-slate-600 sm:text-xs">
                            Theory /100
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              inputMode="decimal"
                              disabled={savingAll || entry?.absent}
                              value={entry?.theory ?? ""}
                              onChange={(event) =>
                                updateEntry(student.id, { theory: event.target.value })
                              }
                              className={`${inputClass} min-h-9 px-2 sm:min-h-11 sm:px-3`}
                            />
                          </label>
                          {subjectHasPractical && (
                            <label className="min-w-0 space-y-1 text-[11px] font-semibold text-slate-600 sm:text-xs">
                              Practical /50
                              <input
                                type="number"
                                min="0"
                                max="50"
                                step="0.01"
                                inputMode="decimal"
                                disabled={savingAll || entry?.absent}
                                value={entry?.practical ?? ""}
                                onChange={(event) =>
                                  updateEntry(student.id, {
                                    practical: event.target.value,
                                  })
                                }
                                className={`${inputClass} min-h-9 px-2 sm:min-h-11 sm:px-3`}
                              />
                            </label>
                          )}
                        </div>
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
            loading={loadingStudents}
          />
          {students.length > 0 && (
            <div className="sticky bottom-2 z-20 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {readyToSaveCount} student(s) ready to save
              </p>
              <button
                type="button"
                onClick={() => void saveAllMarks()}
                disabled={savingAll || loadingStudents || readyToSaveCount === 0}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {savingAll ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingAll ? "Saving marks..." : "Save all marks"}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
