"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  GraduationCap,
  ListChecks,
  Moon,
  PenLine,
  Printer,
  Sun,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { PageHeader } from "@/components/ui/page-header";
import {
  ReportCardSignatures,
  SignatureManager,
} from "@/components/dashboard/report-card-signatures";
import { notify } from "@/lib/notifications";
import { sortStudentsForDisplay } from "@/lib/student-sort";
import { commentForAverage } from "@/lib/report-card-comments";
import type { SchoolSignatures } from "@/lib/report-card-signatures";

type ExamStatus = "Draft" | "Active" | "Processed";

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: ExamStatus;
  created_at: string;
};

type School = SchoolSignatures & {
  school_name: string;
  district: string;
  region: string;
  address: string;
};

type SubjectMeta = {
  id: string;
  name: string;
  subject_code: string;
};

type SubjectBreakdownEntry = {
  subject_id: string;
  subject: string;
  code?: string;
  has_practical?: boolean;
  theory: number | null;
  practical: number | null;
  total: number | null;
  percentage: number | null;
  grade: string;
  points: number | null;
  absent: boolean;
  missing?: boolean;
};

type StoredResult = {
  exam_id: string;
  student_id: string;
  average: number | null;
  grade: string | null;
  division: string | null;
  points: number | null;
  position: number | null;
  is_incomplete: boolean | null;
  subject_breakdown?: SubjectBreakdownEntry[] | null;
};

type Student = {
  id: string;
  full_name: string;
  sex: "M" | "F";
  form: string | null;
  stream: string | null;
};

type ReportData = {
  exam: Exam;
  school: School;
  exams: Exam[];
  students: Student[];
  subjects: SubjectMeta[];
  results: Record<string, Record<string, StoredResult>>;
};

type SubjectRow = {
  id: string;
  name: string;
  mark: number;
  grade: string;
  points: number;
  remark: string;
};

const GRADE_POINTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const GRADE_REMARKS: Record<string, string> = {
  A: "Bora",
  B: "Nzuri Sana",
  C: "Nzuri",
  D: "Inaridhisha",
  F: "Inahitaji Kuboreshwa",
};
const GRADE_CELL_CLASS: Record<string, string> = {
  A: "grade-a bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  B: "grade-b bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100",
  C: "grade-c bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
  D: "grade-d bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  F: "grade-f bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100",
};
const BEHAVIOUR_ITEMS = [
  "Bidii katika kazi",
  "Heshima kwa walimu na wanafunzi",
  "Kutunza mali za umma",
  "Uelewa na ushirikiano",
  "Usafi binafsi",
  "Utii na kufuata maelekezo",
  "Kuhudhuria masomo kwa wakati",
  "Kutokuruka masomo bila ruhusa",
  "Uadilifu na uaminifu",
];
type BehaviourRating = "vizuriSana" | "vizuri" | "wastani" | "dhaifu";
const BEHAVIOUR_RATINGS: BehaviourRating[] = [
  "vizuriSana",
  "vizuri",
  "wastani",
  "dhaifu",
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function behaviourMarkFor(
  studentId: string,
  item: string,
  index: number,
  average: number | null,
  position: number | null,
  totalStudents: number,
): BehaviourRating {
  const roll = hashString(`${studentId}:${item}:${index}`) / 4294967295;
  const positionRatio =
    position && totalStudents > 0 ? position / totalStudents : 0.5;
  const isTop = positionRatio <= 0.25 || (average !== null && average >= 75);
  const isLow = positionRatio > 0.75 || (average !== null && average < 40);
  const guaranteedIndex = hashString(studentId) % BEHAVIOUR_ITEMS.length;

  if (isTop) {
    if (roll < 0.22 || index === guaranteedIndex) return "vizuriSana";
    if (roll < 0.6) return "vizuri";
    return "wastani";
  }

  if (isLow) {
    // Automatic mode never marks a student as "dhaifu" (weak). Even students
    // with low averages get at most "wastani" so no report card auto-fills a
    // negative conduct rating.
    if (roll < 0.42 || index === guaranteedIndex) return "wastani";
    return "vizuri";
  }

  if (roll < 0.14 || index === guaranteedIndex) return "vizuriSana";
  if (roll < 0.52) return "vizuri";
  return "wastani";
}
const SWAHILI_MONTHS = [
  "Januari",
  "Februari",
  "Machi",
  "Aprili",
  "Mei",
  "Juni",
  "Julai",
  "Agosti",
  "Septemba",
  "Oktoba",
  "Novemba",
  "Desemba",
];
const selectClass = "app-select";
const inputClass = "app-input";

function SelectField({
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
  className,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="app-label flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted" />
        {label}
      </span>
      <select
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="app-label flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-muted" />
        {label}
      </span>
      <input
        type="date"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function gradeFor(mark: number) {
  if (mark >= 75) return "A";
  if (mark >= 65) return "B";
  if (mark >= 45) return "C";
  if (mark >= 30) return "D";
  return "F";
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(Number(value).toFixed(2)).toString();
}

function formatAverage(value: number | null | undefined) {
  const score = formatScore(value);
  return score === "—" ? score : `${score}%`;
}

function formatSwahiliDate(date: Date) {
  return `${date.getDate()} ${SWAHILI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatInputDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatSwahiliDate(date);
}

const DEFAULT_DISTRICT = "Singida Municipal Council";

function swahiliDistrictName(district: string) {
  const raw = (district || "").trim();
  if (!raw) return DEFAULT_DISTRICT;
  const cleaned = raw
    .replace(/\bhalmashauri\s+ya\s+wilaya\s+ya\b/gi, "")
    .replace(/\bdistrict\s+council\b/gi, "")
    .replace(/\bwilaya\s+ya\b/gi, "")
    .replace(/\bdistrict\b/gi, "")
    .trim();
  return cleaned || DEFAULT_DISTRICT;
}

function swahiliSchoolName(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Shule ya Sekondari Mufumbu";
  const secondary = trimmed.match(/^(.*?)\s+secondary\s+school$/i);
  if (secondary?.[1]?.trim()) {
    return `Shule ya Sekondari ${secondary[1].trim()}`;
  }
  return trimmed;
}

function postalLine(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return "S.L.P. 155";
  const match = trimmed.match(
    /(?:p\.?\s*o\.?\s*box|s\.?\s*l\.?\s*p\.?)\s*[:#-]?\s*(.+)/i,
  );
  const box = match?.[1]?.trim();
  if (!box || /^[-—]+$/.test(box)) return "S.L.P. 155";
  return `S.L.P. ${box}`;
}

function divisionText(division: string | null) {
  if (!division) return "—";
  const cleaned = division.replace(/^DIV\s*/i, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "incomplete") return "—";
  return cleaned;
}

function sortExamsNewestFirst(a: Exam, b: Exam) {
  return b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at);
}

function subjectsFor(result: StoredResult, subjects: SubjectMeta[]): SubjectRow[] {
  const namesById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  return (result.subject_breakdown ?? [])
    .filter(
      (entry) =>
        !entry.absent && !entry.missing && entry.percentage !== null && entry.percentage !== undefined,
    )
    .map((entry) => {
      const mark = entry.percentage ?? 0;
      const grade = gradeFor(mark);
      return {
        id: entry.subject_id,
        name: namesById.get(entry.subject_id) ?? entry.subject,
        mark,
        grade,
        points: GRADE_POINTS[grade],
        remark: GRADE_REMARKS[grade],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "sw"));
}

function buildParentParagraph(
  student: Student,
  exam: Exam,
  result: StoredResult,
  totalStudents: number,
) {
  const firstName = student.full_name.trim().split(/\s+/)[0] || student.full_name;
  const position = result.position === null ? "—" : String(result.position);
  const total = totalStudents > 0 ? String(totalStudents) : "—";
  return `Mzazi/Mlezi wa ${student.full_name}, katika mtihani wa ${exam.name} ${exam.academic_year}, ${firstName} ameshika nafasi ya ${position} kati ya wanafunzi ${total} waliofanya mtihani, akiwa na wastani wa ${formatScore(result.average)}%, divisheni ${divisionText(result.division)} za pointi ${result.points ?? "—"}. Asante.`;
}

function ParentParagraph({
  student,
  exam,
  result,
  totalStudents,
}: {
  student: Student;
  exam: Exam;
  result: StoredResult;
  totalStudents: number;
}) {
  const firstName = student.full_name.trim().split(/\s+/)[0] || student.full_name;
  const position = result.position === null ? "—" : String(result.position);
  const total = totalStudents > 0 ? String(totalStudents) : "—";

  return (
    <>
      Mzazi/Mlezi wa <span className="font-bold italic">{student.full_name}</span>, katika
      mtihani wa {exam.name} {exam.academic_year}, {firstName} ameshika nafasi ya {position}{" "}
      kati ya wanafunzi {total} waliofanya mtihani, akiwa na wastani wa {formatScore(result.average)}%,
      divisheni {divisionText(result.division)} za pointi {result.points ?? "—"}. Asante.
    </>
  );
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * Printing certificates clones the certificates into a print-only element and
 * hides the rest of the app while `window.print()` runs. If the browser never
 * fires `afterprint` (or the user navigates away before it does), that state
 * can stay in the document and the next printout shows the certificate sheet
 * instead of the report cards. Always start report printing from a clean state.
 */
function clearCertificatePrintState() {
  if (typeof document === "undefined") return;
  document.body.classList.remove("printing-certificates");
  document.getElementById("certificate-print-root")?.remove();
}

export function ReportCardsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [schoolStatus, setSchoolStatus] = useState<"open" | "closed">("open");
  const [closingDate, setClosingDate] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [behaviourMode, setBehaviourMode] = useState<"blank" | "auto">("blank");
  const [showSignatureManager, setShowSignatureManager] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadExams() {
      try {
        const response = await fetch("/api/exams?pageSize=100&year=all");
        const body = (await response.json()) as { exams?: Exam[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load examinations.");
        if (!active) return;
        const processed = (body.exams ?? [])
          .filter((item) => item.status === "Processed")
          .sort(sortExamsNewestFirst);
        setExams(processed);
        const first = processed[0];
        if (first) {
          setClassFilter(first.class_form);
          setYearFilter(first.academic_year);
          setLoadingReport(true);
          setSelectedExamId(first.id);
        } else {
          setError("No processed examinations are available.");
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load examinations.",
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
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    let active = true;
    async function loadReport() {
      try {
        const response = await fetch(
          `/api/report-cards?examId=${encodeURIComponent(selectedExamId)}`,
        );
        const body = (await response.json()) as Partial<ReportData> & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load report cards.");
        if (
          !body.exam ||
          !body.school ||
          !body.exams ||
          !body.students ||
          !body.subjects ||
          !body.results
        ) {
          throw new Error("Report card data is incomplete.");
        }
        if (!active) return;
        setData(body as ReportData);
        setReportDate(formatSwahiliDate(new Date()));
        setError("");
        setStudentFilter((current) =>
          current !== "all" && !body.students?.some((student) => student.id === current)
            ? "all"
            : current,
        );
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load report cards.",
          );
        }
      } finally {
        if (active) setLoadingReport(false);
      }
    }
    void loadReport();
    return () => {
      active = false;
    };
  }, [selectedExamId]);

  // Drop any leftover certificate print DOM/body class as soon as the report
  // page mounts, and again right before the browser builds a print preview.
  useEffect(() => {
    clearCertificatePrintState();
    const prepare = () => clearCertificatePrintState();
    window.addEventListener("beforeprint", prepare);
    return () => window.removeEventListener("beforeprint", prepare);
  }, []);

  function updateSchoolSignatures(signatures: SchoolSignatures) {
    setData((current) =>
      current
        ? { ...current, school: { ...current.school, ...signatures } }
        : current,
    );
  }

  const classOptions = useMemo(
    () => [...new Set(exams.map((item) => item.class_form))].sort((a, b) => a.localeCompare(b)),
    [exams],
  );
  const yearOptions = useMemo(() => {
    const scoped = exams.filter((item) => !classFilter || item.class_form === classFilter);
    return [...new Set(scoped.map((item) => item.academic_year))].sort((a, b) =>
      b.localeCompare(a),
    );
  }, [classFilter, exams]);
  const examOptions = useMemo(
    () =>
      exams
        .filter(
          (item) =>
            (!classFilter || item.class_form === classFilter) &&
            (!yearFilter || item.academic_year === yearFilter),
        )
        .sort(sortExamsNewestFirst),
    [classFilter, exams, yearFilter],
  );
  const studentOptions = useMemo(
    () => sortStudentsForDisplay(data?.students ?? []),
    [data],
  );
  const selectedExamResults = useMemo(
    () => (data ? data.results[data.exam.id] ?? {} : {}),
    [data],
  );
  const totalStudents = useMemo(
    () => Object.values(selectedExamResults).filter((result) => result.average !== null).length,
    [selectedExamResults],
  );
  const cards = useMemo(() => {
    if (!data) return [];
    return sortStudentsForDisplay(
      data.students.filter(
        (student) => studentFilter === "all" || student.id === studentFilter,
      ),
    );
  }, [data, studentFilter]);

  function selectExam(nextExamId: string) {
    if (!nextExamId || nextExamId === selectedExamId) return;
    setLoadingReport(true);
    setError("");
    setData(null);
    setSelectedExamId(nextExamId);
  }

  function chooseClass(nextClass: string) {
    const matching = exams
      .filter((item) => item.class_form === nextClass)
      .sort(sortExamsNewestFirst);
    const preferred =
      matching.find((item) => item.academic_year === yearFilter) ?? matching[0];
    setClassFilter(nextClass);
    if (preferred) {
      setYearFilter(preferred.academic_year);
      selectExam(preferred.id);
    }
  }

  function chooseYear(nextYear: string) {
    const matching = exams
      .filter(
        (item) =>
          (!classFilter || item.class_form === classFilter) &&
          item.academic_year === nextYear,
      )
      .sort(sortExamsNewestFirst);
    setYearFilter(nextYear);
    if (matching[0]) selectExam(matching[0].id);
  }

  function chooseExam(nextExamId: string) {
    const next = exams.find((item) => item.id === nextExamId);
    if (next) {
      setClassFilter(next.class_form);
      setYearFilter(next.academic_year);
    }
    selectExam(nextExamId);
  }

  function printReport() {
    if (!data) return;
    clearCertificatePrintState();
    document.title = safeFileName(
      `Results - ${data.exam.name} - ${data.exam.class_form} - ${data.exam.academic_year}`,
    );
    window.print();
  }

  function exportExcel() {
    if (!data || cards.length === 0) return;
    const rows: (string | number)[][] = [
      [swahiliSchoolName(data.school.school_name)],
      [
        `HALMASHAURI YA WILAYA YA ${swahiliDistrictName(
          data.school.district,
        ).toUpperCase()}`,
      ],
      [`RIPOTI YA MATOKEO — ${data.exam.name} ${data.exam.academic_year}`],
      [`Darasa: ${data.exam.class_form}`, `Tarehe: ${reportDate || "—"}`],
      [],
      [
        "NAFASI",
        "JINA",
        "JINSIA",
        "MKONDO",
        "WASTANI",
        "DARAJA",
        "POINTI",
        "DIVISENI",
        "MASOMO",
        "MAONI MKUU WA SHULE",
        "MAONI MWALIMU WA TAALUMA",
        "MAONI MWALIMU WA DARASA",
        "MAZUNGUMZO YA MZAZI/MLEZI",
      ],
    ];

    for (const student of cards) {
      const result = selectedExamResults[student.id];
      if (!result) continue;
      const subjectRows = subjectsFor(result, data.subjects);
      rows.push([
        result.position ?? "—",
        student.full_name,
        student.sex,
        student.stream ?? "—",
        formatAverage(result.average),
        result.grade ?? "—",
        result.points ?? "—",
        divisionText(result.division),
        subjectRows
          .map((subject) => `${subject.name}: ${formatScore(subject.mark)}% (${subject.grade}, ${subject.points})`)
          .join("; "),
        commentForAverage(result.average, "headmaster", student.id),
        commentForAverage(result.average, "subjectTeacher", student.id),
        commentForAverage(result.average, "classTeacher", student.id),
        buildParentParagraph(student, data.exam, result, totalStudents),
      ]);
    }

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(
      `Results Report - ${data.exam.name} - ${data.exam.class_form} - ${data.exam.academic_year}`,
    )}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("success", "Excel (CSV) report downloaded.");
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[210mm] space-y-4">
      <div className="report-no-print space-y-4 print:hidden">
        <PageHeader
          title="Report Cards"
          subtitle="Preview and print student report cards."
          action={
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? "Light preview" : "Dark preview"}
            </button>
          }
        />

        <section className="app-card">
          <div className="app-card-header border-b border-line pb-4">
            <div className="min-w-0">
              <h2 className="app-card-title">Report filters</h2>
              <p className="app-card-subtitle">
                Choose class, year, exam and student.
              </p>
            </div>
          </div>

          <div className="app-card-body space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SelectField
                label="Class"
                icon={GraduationCap}
                value={classFilter}
                onChange={chooseClass}
                disabled={loadingExams}
              >
                {classOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Year"
                icon={CalendarDays}
                value={yearFilter}
                onChange={chooseYear}
                disabled={loadingExams}
              >
                {yearOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Exam"
                icon={ClipboardList}
                value={selectedExamId}
                onChange={chooseExam}
                disabled={loadingExams}
              >
                {examOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.term}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Student"
                icon={UserRound}
                value={studentFilter}
                onChange={setStudentFilter}
                disabled={!data || loadingReport}
              >
                <option value="all">All students</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="rounded-xl border border-line bg-canvas p-4">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand" />
                <p className="text-sm font-semibold text-ink">
                  Hali ya Shule — Ripoti Zote
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Hali"
                  icon={Building2}
                  value={schoolStatus}
                  onChange={(value) =>
                    setSchoolStatus(value === "closed" ? "closed" : "open")
                  }
                >
                  <option value="open">Haitafungwa</option>
                  <option value="closed">Itafungwa</option>
                </SelectField>
                {schoolStatus === "closed" ? (
                  <>
                    <DateField
                      label="Tarehe ya Kufunga"
                      value={closingDate}
                      onChange={setClosingDate}
                    />
                    <DateField
                      label="Tarehe ya Kufungua"
                      value={openingDate}
                      onChange={setOpeningDate}
                    />
                  </>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted">
                {schoolStatus === "closed"
                  ? "Tarehe za kufunga na kufungua zitawekwa kwenye ripoti zote."
                  : "Shule Haitafungwa itawekwa kwenye ripoti zote."}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-canvas p-4">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-brand" />
                <p className="text-sm font-semibold text-ink">
                  Tabia na Mwenendo — Ripoti Zote
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Utekelezaji"
                  icon={ListChecks}
                  value={behaviourMode}
                  onChange={(value) =>
                    setBehaviourMode(value === "auto" ? "auto" : "blank")
                  }
                >
                  <option value="blank">Acha tupu (kujaza kwa mkono)</option>
                  <option value="auto">Jaza kiotomatiki</option>
                </SelectField>
              </div>
              <p className="mt-3 text-xs text-muted">
                {behaviourMode === "auto"
                  ? "Alama za ✓ zitawekwa kiotomatiki: wengi VIZURI, wanafunzi bora VIZURI SANA, na wachache WASTANI."
                  : "Masanduku yataachwa tupu ili ujaze kwa mkono baada ya kuchapisha."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={printReport}
              disabled={!data || loadingReport || cards.length === 0}
              className="app-btn app-btn-primary"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={!data || loadingReport || cards.length === 0}
              className="app-btn app-btn-secondary"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => setShowSignatureManager((value) => !value)}
              disabled={!data || loadingReport}
              className="app-btn app-btn-secondary"
              aria-expanded={showSignatureManager}
            >
              <PenLine className="h-4 w-4" />
              Saini na Muhuri
            </button>
          </div>
        </section>
      </div>

      {data && showSignatureManager ? (
        <SignatureManager
          school={data.school}
          onSchoolChange={updateSchoolSignatures}
          onClose={() => setShowSignatureManager(false)}
        />
      ) : null}

      <div
        data-theme={darkMode ? "dark" : "light"}
        className="exam-report report-card-page space-y-4 text-slate-900 dark:text-slate-100"
      >
        {loadingExams || loadingReport ? (
          <LoadingIndicator label="Loading report cards..." className="py-12" />
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger-line bg-danger px-4 py-3 text-sm font-semibold text-danger-ink"
          >
            {error}
          </div>
        ) : data && cards.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No students sat this examination"
            description="Choose another exam or class to preview report cards."
          />
        ) : data ? (
          cards.map((student) => (
            <ReportCard
              key={student.id}
              exam={data.exam}
              school={data.school}
              student={student}
              result={selectedExamResults[student.id]}
              subjects={data.subjects}
              reportDate={reportDate}
              totalStudents={totalStudents}
              schoolStatus={schoolStatus}
              closingDate={closingDate}
              openingDate={openingDate}
              behaviourMode={behaviourMode}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}

function ReportCard({
  exam,
  school,
  student,
  result,
  subjects,
  reportDate,
  totalStudents,
  schoolStatus,
  closingDate,
  openingDate,
  behaviourMode,
}: {
  exam: Exam;
  school: School;
  student: Student;
  result: StoredResult;
  subjects: SubjectMeta[];
  reportDate: string;
  totalStudents: number;
  schoolStatus: "open" | "closed";
  closingDate: string;
  openingDate: string;
  behaviourMode: "blank" | "auto";
}) {
  const subjectRows = subjectsFor(result, subjects);
  const district = swahiliDistrictName(school.district);
  const schoolName = swahiliSchoolName(school.school_name);
  const displayForm = student.form || exam.class_form;
  const displayStream = student.stream || "—";
  const comments = {
    headmaster: commentForAverage(result.average, "headmaster", student.id),
    subjectTeacher: commentForAverage(result.average, "subjectTeacher", student.id),
    classTeacher: commentForAverage(result.average, "classTeacher", student.id),
  };

  return (
    <article className="report-card mx-auto w-full bg-white p-[7mm] text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 sm:p-[8mm]">
      <header className="report-card-header text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          HALMASHAURI YA WILAYA YA {district.toUpperCase()}
        </p>
        <h1 className="text-lg font-extrabold uppercase leading-tight sm:text-xl">
          {schoolName}
        </h1>
        <p className="text-[12px] text-slate-700 dark:text-slate-300">
          {postalLine(school.address)}
        </p>
        <p className="report-card-exam-title mt-1 text-[12px] font-bold uppercase">
          RIPOTI YA MATOKEO — {exam.name} {exam.academic_year}
        </p>
      </header>

      <section className="report-student-info mt-2 border-y border-slate-300 py-1.5 text-[12px] leading-snug dark:border-slate-600">
        <p>
          <span className="font-bold">JINA:</span>{" "}
          <span className="font-bold italic">{student.full_name}</span>
        </p>
        <p className="mt-0.5">
          <span className="font-bold">Darasa:</span> {displayForm} |{" "}
          <span className="font-bold">Mkondo:</span> {displayStream} |{" "}
          <span className="font-bold">Jinsia:</span> {student.sex}
        </p>
      </section>

      <section className="mt-4">
        <table className="w-full table-fixed border-collapse text-left text-[12px] leading-tight">
          <colgroup>
            <col className="w-[44%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
            <tr>
              {["MASOMO", "ALAMA", "DARAJA", "POINTI", "MAONI"].map((label) => (
                <th
                  key={label}
                  className="border border-slate-300 px-1.5 py-1 font-bold uppercase dark:border-slate-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectRows.map((subject) => (
              <tr
                key={subject.id}
                className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60"
              >
                <td className="border border-slate-300 px-1.5 py-0.5 font-medium dark:border-slate-600">
                  {subject.name}
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 text-center dark:border-slate-600">
                  {formatScore(subject.mark)}%
                </td>
                <td className="border border-slate-300 p-0 text-center dark:border-slate-600">
                  <span
                    className={`block px-1 py-0.5 font-bold ${GRADE_CELL_CLASS[subject.grade]}`}
                  >
                    {subject.grade}
                  </span>
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 text-center dark:border-slate-600">
                  {subject.points}
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 dark:border-slate-600">
                  {subject.remark}
                </td>
              </tr>
            ))}
            {subjectRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border border-slate-300 px-1.5 py-2 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400"
                >
                  Hakuna masomo yaliyofanywa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="report-card-parent mt-4 border border-slate-300 p-1.5 text-justify text-[12px] leading-snug dark:border-slate-600">
        <ParentParagraph
          student={student}
          exam={exam}
          result={result}
          totalStudents={totalStudents}
        />
      </p>

      <section className="mt-4">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          TABIA NA MWENENDO
        </h2>
        <table className="mt-1 w-full table-fixed border-collapse text-left text-[12px] leading-tight">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[39%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
            <tr>
              {["NA.", "MAELEZO", "VIZURI SANA", "VIZURI", "WASTANI", "DHAIFU"].map(
                (label) => (
                  <th
                    key={label}
                    className="border border-slate-300 px-1 py-1 text-center font-bold uppercase dark:border-slate-600"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {BEHAVIOUR_ITEMS.map((item, index) => {
              const mark = behaviourMode === "auto"
                ? behaviourMarkFor(
                    student.id,
                    item,
                    index,
                    result.average,
                    result.position,
                    totalStudents,
                  )
                : null;

              return (
                <tr
                  key={item}
                  className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60"
                >
                  <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 dark:border-slate-600">
                    {item}
                  </td>
                  {BEHAVIOUR_RATINGS.map((rating) => {
                    const checked = mark === rating && behaviourMode === "auto";
                    return (
                      <td
                        key={rating}
                        className="border border-slate-300 px-1 py-0.5 text-center align-middle dark:border-slate-600"
                      >
                        {checked ? (
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-emerald-700 bg-emerald-600 text-[9px] font-bold text-white">
                            ✓
                          </span>
                        ) : (
                          <span className="mx-auto block h-3 w-3 rounded-[2px] border border-slate-400 dark:border-slate-500" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-[9px] italic leading-snug text-slate-500 dark:text-slate-400">
          Weka alama ya (✓) kwenye kisanduku kinacholingana na kiwango cha tabia na
          nidhamu ya mwanafunzi.
        </p>
      </section>

      <section className="mt-4">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          MAONI YA UONGOZI NA WALIMU
        </h2>
        <div className="report-card-comments mt-1 space-y-0.5 text-[12px] leading-snug">
          <p>
            <span className="font-bold">Mkuu wa Shule:</span> {comments.headmaster}
          </p>
          <p>
            <span className="font-bold">Mwalimu wa Taaluma:</span> {comments.subjectTeacher}
          </p>
          <p>
            <span className="font-bold">Mwalimu wa Darasa:</span> {comments.classTeacher}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          HALI YA SHULE
        </h2>
        {schoolStatus === "closed" ? (
          <table className="mt-1 w-full table-fixed border-collapse text-left text-[12px] leading-tight">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[30%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
              <tr>
                {["HALI YA SHULE", "TAREHE YA KUFUNGA", "TAREHE YA KUFUNGUA"].map(
                  (label) => (
                    <th
                      key={label}
                      className="border border-slate-300 px-1 py-1 text-center font-bold uppercase dark:border-slate-600"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60">
                <td className="border border-slate-300 px-1 py-1 font-semibold dark:border-slate-600">
                  Shule Itafungwa
                </td>
                <td className="border border-slate-300 px-1 py-1 text-center dark:border-slate-600">
                  {formatInputDate(closingDate)}
                </td>
                <td className="border border-slate-300 px-1 py-1 text-center dark:border-slate-600">
                  {formatInputDate(openingDate)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-1 border border-slate-300 p-1.5 text-center text-[12px] font-bold dark:border-slate-600">
            Shule Haitafungwa
          </p>
        )}
      </section>

      <ReportCardSignatures school={school} />

      <footer className="report-card-footer mt-2 border-t border-slate-300 pt-1 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Ripoti hii imetolewa na Ofisi ya Taaluma | Tarehe: {reportDate || "—"}
      </footer>
    </article>
  );
}
