"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BookOpen, CheckCircle2, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type FormLevel = "Form V" | "Form VI";
type SubjectType = "CORE" | "SUBSIDIARY" | "ADDITIONAL_CORE";
type EnrollmentSource = "COMBINATION" | "OPTIONAL";

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  admission_no: string | null;
  class_id: string;
  class_form: string | null;
  class_stream: string | null;
};

type CombinationRecord = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type ALevelSubjectRecord = {
  id: string;
  name: string;
  code: string;
  subject_type: SubjectType;
  has_practical: boolean;
};

type AssignmentRecord = {
  id: string;
  student_id: string;
  combination_id: string;
  form: string;
  academic_year: string;
  combination_name: string | null;
  combination_code: string | null;
  student_name: string | null;
  student_admission_no: string | null;
};

type StudentSubjectRecord = {
  student_id: string;
  subject_id: string;
  source: EnrollmentSource;
};

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  admission_no: string | null;
  class_id: string;
  classes: { form: string | null; stream: string | null } | null;
};

type AssignmentRow = {
  id: string;
  student_id: string;
  combination_id: string;
  form: string;
  academic_year: string;
  a_level_combinations: { id: string; name: string; code: string } | null;
  students: { id: string; full_name: string; admission_no: string | null } | null;
};

const formOptions = ["Form V", "Form VI"] as const;

export default function ALevelAllocationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [combinations, setCombinations] = useState<CombinationRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<ALevelSubjectRecord[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<StudentSubjectRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedCombinationId, setSelectedCombinationId] = useState<string>("");
  const [selectedForm, setSelectedForm] = useState<FormLevel>("Form V");
  const [academicYear, setAcademicYear] = useState<string>(new Date().getFullYear().toString());
  const [bulkInput, setBulkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [optionalSelection, setOptionalSelection] = useState<Set<string>>(new Set());
  const [optionalSaving, setOptionalSaving] = useState(false);
  const [bulkOptionalSubjectId, setBulkOptionalSubjectId] = useState("");
  const [bulkOptionalStudentIds, setBulkOptionalStudentIds] = useState<Set<string>>(new Set());
  const [bulkOptionalSaving, setBulkOptionalSaving] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const load = useCallback(async () => {
    const [
      studentsResult,
      combinationsResult,
      assignmentsResult,
      subjectsResult,
      studentSubjectsResult,
    ] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, first_name, last_name, full_name, admission_no, class_id, classes (form, stream)",
        )
        .order("last_name"),
      supabase
        .from("a_level_combinations")
        .select("id, name, code, active")
        .eq("active", true)
        .order("name"),
      supabase
        .from("a_level_student_combinations")
        .select(
          "id, student_id, combination_id, form, academic_year, a_level_combinations (id, name, code), students (id, full_name, admission_no)",
        )
        .order("academic_year", { ascending: false }),
      supabase
        .from("a_level_subjects")
        .select("id, name, code, subject_type, has_practical")
        .eq("status", "Active")
        .order("name"),
      supabase
        .from("a_level_student_subjects")
        .select("student_id, subject_id, source"),
    ]);

    if (studentsResult.error) showToast("error", studentsResult.error.message);
    if (combinationsResult.error) showToast("error", combinationsResult.error.message);
    if (assignmentsResult.error) showToast("error", assignmentsResult.error.message);
    if (subjectsResult.error) showToast("error", subjectsResult.error.message);
    if (studentSubjectsResult.error) showToast("error", studentSubjectsResult.error.message);

    const normalizedStudents = ((studentsResult.data ?? []) as unknown as StudentRow[]).map(
      (item) => ({
        id: item.id,
        first_name: item.first_name,
        last_name: item.last_name,
        full_name: item.full_name,
        admission_no: item.admission_no,
        class_id: item.class_id,
        class_form: item.classes?.form ?? null,
        class_stream: item.classes?.stream ?? null,
      }),
    ) as StudentRecord[];

    const normalizedAssignments = (
      (assignmentsResult.data ?? []) as unknown as AssignmentRow[]
    ).map((item) => ({
      id: item.id,
      student_id: item.student_id,
      combination_id: item.combination_id,
      form: item.form,
      academic_year: item.academic_year,
      combination_name: item.a_level_combinations?.name ?? null,
      combination_code: item.a_level_combinations?.code ?? null,
      student_name: item.students?.full_name ?? null,
      student_admission_no: item.students?.admission_no ?? null,
    })) as AssignmentRecord[];

    setStudents(normalizedStudents);
    setCombinations((combinationsResult.data ?? []) as CombinationRecord[]);
    setAssignments(normalizedAssignments);
    setSubjectOptions((subjectsResult.data ?? []) as ALevelSubjectRecord[]);
    setStudentSubjects((studentSubjectsResult.data ?? []) as StudentSubjectRecord[]);
  }, [showToast, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const aLevelStudents = useMemo(
    () =>
      students.filter(
        (student) => student.class_form === "Form V" || student.class_form === "Form VI",
      ),
    [students],
  );

  const formStudents = useMemo(
    () => aLevelStudents.filter((student) => student.class_form === selectedForm),
    [aLevelStudents, selectedForm],
  );

  const formAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.form === selectedForm && assignment.academic_year === academicYear,
      ),
    [academicYear, assignments, selectedForm],
  );

  const unassignedStudents = useMemo(
    () =>
      formStudents.filter(
        (student) =>
          !formAssignments.some((assignment) => assignment.student_id === student.id),
      ),
    [formAssignments, formStudents],
  );

  const selectedStudent = formStudents.find((student) => student.id === selectedStudentId) ?? null;

  const selectedStudentHasCombination = Boolean(
    selectedStudent &&
      formAssignments.some((assignment) => assignment.student_id === selectedStudent.id),
  );

  const combinationSubjectIdsByStudent = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const enrollment of studentSubjects) {
      if (enrollment.source !== "COMBINATION") continue;
      const existing = map.get(enrollment.student_id) ?? new Set<string>();
      existing.add(enrollment.subject_id);
      map.set(enrollment.student_id, existing);
    }
    return map;
  }, [studentSubjects]);

  const optionalSubjectOptions = useMemo(() => {
    if (!selectedStudent) return [];
    const combinationIds = combinationSubjectIdsByStudent.get(selectedStudent.id) ?? new Set();
    return subjectOptions.filter(
      (subject) =>
        subject.subject_type !== "SUBSIDIARY" && !combinationIds.has(subject.id),
    );
  }, [combinationSubjectIdsByStudent, selectedStudent, subjectOptions]);

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setOptionalSelection(
      new Set(
        studentSubjects
          .filter(
            (enrollment) =>
              enrollment.student_id === studentId && enrollment.source === "OPTIONAL",
          )
          .map((enrollment) => enrollment.subject_id),
      ),
    );
  }

  async function assignStudent(
    studentId: string,
    combinationId: string,
    form: FormLevel,
    year: string,
    options: { silent?: boolean } = {},
  ): Promise<boolean> {
    const fail = (message: string) => {
      if (!options.silent) showToast("error", message);
      return false;
    };

    if (!studentId || !combinationId) {
      return fail("Choose both a student and a combination first.");
    }

    const student = students.find((item) => item.id === studentId);
    if (!student || (student.class_form !== "Form V" && student.class_form !== "Form VI")) {
      return fail("Only Form V and Form VI students can be allocated A-Level combinations.");
    }
    if (student.class_form !== form) {
      return fail(
        `${student.full_name} is in ${student.class_form ?? "an unknown form"}, not ${form}.`,
      );
    }

    const { data: previousAssignment, error: previousLookupError } = await supabase
      .from("a_level_student_combinations")
      .select("id, combination_id")
      .eq("student_id", studentId)
      .eq("academic_year", year)
      .eq("form", form)
      .maybeSingle();

    if (previousLookupError) {
      return fail(previousLookupError.message);
    }

    const previousCombinationId = previousAssignment?.combination_id ?? null;
    if (previousCombinationId && previousCombinationId !== combinationId) {
      const { count: marksCount, error: marksError } = await supabase
        .from("a_level_marks")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId);

      if (marksError) {
        return fail(marksError.message);
      }

      if ((marksCount ?? 0) > 0) {
        const confirmed = window.confirm(
          "This student already has recorded A-Level marks. Changing the combination requires admin approval and will be logged. Continue?",
        );
        if (!confirmed) return false;

        await supabase.from("a_level_combination_transfer_logs").insert({
          student_id: studentId,
          previous_combination_id: previousCombinationId,
          new_combination_id: combinationId,
          reason: "Transfer after marks entered",
          approved: false,
          approval_required: true,
        });
      }
    }

    const { data: activeCombination, error: combinationError } = await supabase
      .from("a_level_combinations")
      .select("id, name, code")
      .eq("id", combinationId)
      .single();

    if (combinationError || !activeCombination) {
      return fail(combinationError?.message ?? "Unable to load the selected combination.");
    }

    setSaving(true);

    const payload = {
      student_id: studentId,
      combination_id: combinationId,
      form,
      academic_year: year,
    };

    const existingAssignment = await supabase
      .from("a_level_student_combinations")
      .select("id")
      .eq("student_id", studentId)
      .eq("academic_year", year)
      .eq("form", form)
      .maybeSingle();

    const result = existingAssignment.data
      ? await supabase
          .from("a_level_student_combinations")
          .update(payload)
          .eq("id", existingAssignment.data.id)
      : await supabase.from("a_level_student_combinations").insert(payload);

    setSaving(false);

    if (result.error) {
      return fail(result.error.message);
    }

    if (!options.silent) {
      showToast("success", `Combination assigned to ${student.full_name}.`);
    }
    return true;
  }

  async function handleSingleAssign() {
    const ok = await assignStudent(
      selectedStudentId,
      selectedCombinationId,
      selectedForm,
      academicYear,
    );
    if (!ok) return;
    setSelectedStudentId("");
    setSelectedCombinationId("");
    setOptionalSelection(new Set());
    await load();
  }

  async function handleBulkAssign() {
    const lines = bulkInput
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast("error", "Paste at least one student and combination code pair.");
      return;
    }

    const matches: Array<{ studentId: string; combinationId: string }> = [];
    const issues: string[] = [];

    for (const line of lines) {
      const [studentValue, combinationCodeValue] = line
        .split(/[\t,|]/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (!studentValue || !combinationCodeValue) {
        issues.push(`Invalid row: ${line}`);
        continue;
      }

      const student = formStudents.find(
        (person) =>
          person.admission_no?.toLowerCase() === studentValue.toLowerCase() ||
          `${person.first_name} ${person.last_name}`.toLowerCase() ===
            studentValue.toLowerCase() ||
          person.full_name.toLowerCase() === studentValue.toLowerCase(),
      );
      const combination = combinations.find(
        (item) => item.code.toLowerCase() === combinationCodeValue.toLowerCase(),
      );

      if (!student) {
        issues.push(`Student not found in ${selectedForm}: ${studentValue}`);
        continue;
      }
      if (!combination) {
        issues.push(`Combination not found: ${combinationCodeValue}`);
        continue;
      }

      matches.push({ studentId: student.id, combinationId: combination.id });
    }

    if (matches.length === 0) {
      showToast("error", issues.join(" | ") || "No valid rows were detected in the bulk import.");
      return;
    }

    let assignedCount = 0;
    for (const match of matches) {
      const ok = await assignStudent(
        match.studentId,
        match.combinationId,
        selectedForm,
        academicYear,
        { silent: true },
      );
      if (ok) assignedCount += 1;
    }

    setBulkInput("");
    await load();

    if (issues.length > 0 || assignedCount !== matches.length) {
      showToast(
        "error",
        `Assigned ${assignedCount} of ${matches.length}. ${issues.join(" | ")}`.trim(),
      );
    } else {
      showToast("success", `${assignedCount} students were bulk assigned.`);
    }
  }

  function toggleOptionalSubject(subjectId: string) {
    setOptionalSelection((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  async function handleSaveOptionalSubjects() {
    if (!selectedStudent) {
      showToast("error", "Select a student first.");
      return;
    }
    if (!selectedStudentHasCombination) {
      showToast("error", "Assign a combination to this student before adding optional subjects.");
      return;
    }

    const hasSubsidiarySelected = subjectOptions.some(
      (subject) => subject.subject_type === "SUBSIDIARY" && optionalSelection.has(subject.id),
    );
    if (hasSubsidiarySelected) {
      showToast("error", "SUBSIDIARY subjects are compulsory, not optional.");
      return;
    }

    const combinationIds = combinationSubjectIdsByStudent.get(selectedStudent.id) ?? new Set();
    const conflicting = Array.from(optionalSelection).filter((subjectId) =>
      combinationIds.has(subjectId),
    );
    if (conflicting.length > 0) {
      showToast("error", "A subject already in the student's combination cannot be optional.");
      return;
    }

    setOptionalSaving(true);

    const { error: deleteError } = await supabase
      .from("a_level_student_subjects")
      .delete()
      .eq("student_id", selectedStudent.id)
      .eq("source", "OPTIONAL");

    if (deleteError) {
      setOptionalSaving(false);
      showToast("error", deleteError.message);
      return;
    }

    const rows = Array.from(optionalSelection).map((subjectId) => ({
      student_id: selectedStudent.id,
      subject_id: subjectId,
      source: "OPTIONAL" as const,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("a_level_student_subjects")
        .insert(rows);
      if (insertError) {
        setOptionalSaving(false);
        showToast("error", insertError.message);
        return;
      }
    }

    setOptionalSaving(false);
    showToast("success", `Optional subjects updated for ${selectedStudent.full_name}.`);
    await load();
  }

  function toggleBulkOptionalStudent(studentId: string) {
    setBulkOptionalStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  async function handleBulkOptionalAssign() {
    if (!bulkOptionalSubjectId) {
      showToast("error", "Choose the optional subject to assign.");
      return;
    }
    if (bulkOptionalStudentIds.size === 0) {
      showToast("error", "Select at least one student.");
      return;
    }

    const subject = subjectOptions.find((item) => item.id === bulkOptionalSubjectId);
    if (!subject) {
      showToast("error", "The selected subject could not be found.");
      return;
    }
    if (subject.subject_type === "SUBSIDIARY") {
      showToast("error", "SUBSIDIARY subjects are compulsory, not optional.");
      return;
    }

    setBulkOptionalSaving(true);

    let assignedCount = 0;
    let skippedCount = 0;

    for (const studentId of bulkOptionalStudentIds) {
      const hasCombination = formAssignments.some(
        (assignment) => assignment.student_id === studentId,
      );
      if (!hasCombination) {
        skippedCount += 1;
        continue;
      }

      const combinationIds = combinationSubjectIdsByStudent.get(studentId) ?? new Set();
      if (combinationIds.has(bulkOptionalSubjectId)) {
        skippedCount += 1;
        continue;
      }

      const { error } = await supabase.from("a_level_student_subjects").upsert(
        {
          student_id: studentId,
          subject_id: bulkOptionalSubjectId,
          source: "OPTIONAL",
        },
        { onConflict: "student_id,subject_id" },
      );

      if (error) {
        showToast("error", error.message);
        setBulkOptionalSaving(false);
        return;
      }
      assignedCount += 1;
    }

    setBulkOptionalSaving(false);
    setBulkOptionalStudentIds(new Set());
    await load();

    const skippedNote =
      skippedCount > 0
        ? ` ${skippedCount} skipped (no combination or subject already in combination).`
        : "";
    showToast(
      assignedCount > 0 ? "success" : "error",
      `${subject.name} assigned to ${assignedCount} student(s).${skippedNote}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="A-Level Allocations"
        subtitle="Assign students to combinations and optional subjects."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card title="Assign one student" bodyClassName="p-5 pt-4">
          <div className="space-y-4">
            <Field label="Form" htmlFor="allocation-form">
              <Select
                id="allocation-form"
                value={selectedForm}
                onChange={(event) => {
                  setSelectedForm(event.target.value as FormLevel);
                  setSelectedStudentId("");
                  setSelectedCombinationId("");
                  setOptionalSelection(new Set());
                  setBulkOptionalStudentIds(new Set());
                }}
              >
                {formOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </Field>

            <Field label="Student" htmlFor="student-select">
              <Select
                id="student-select"
                value={selectedStudentId}
                onChange={(event) => selectStudent(event.target.value)}
              >
                <option value="">
                  {formStudents.length === 0
                    ? `No ${selectedForm} students registered`
                    : "Select a student"}
                </option>
                {formStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                    {student.class_stream ? ` · ${student.class_stream}` : ""}
                    {student.admission_no ? ` (${student.admission_no})` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Academic year" htmlFor="academic-year">
              <Input
                id="academic-year"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              />
            </Field>

            <Field label="Combination" htmlFor="combination-select">
              <Select
                id="combination-select"
                value={selectedCombinationId}
                onChange={(event) => setSelectedCombinationId(event.target.value)}
              >
                <option value="">Select a combination</option>
                {combinations.map((combination) => (
                  <option key={combination.id} value={combination.id}>
                    {combination.name} ({combination.code})
                  </option>
                ))}
              </Select>
            </Field>

            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={saving || !selectedStudentId || !selectedCombinationId}
              onClick={() => void handleSingleAssign()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Assign combination
                </>
              )}
            </Button>

            {selectedStudent && (
              <div className="rounded-xl border border-line bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <BookOpen className="h-4 w-4 text-brand" />
                      Optional subjects
                    </h4>
                    <p className="mt-1 text-xs text-muted">
                      Subjects outside {selectedStudent.full_name}&apos;s combination.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted">
                    {optionalSelection.size} selected
                  </span>
                </div>

                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {optionalSubjectOptions.length === 0 ? (
                    <p className="text-xs text-muted">
                      No optional subjects available. Register more active A-Level subjects.
                    </p>
                  ) : (
                    optionalSubjectOptions.map((subject) => (
                      <label
                        key={subject.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="block font-medium text-ink">
                            {subject.name}
                          </span>
                          <span className="text-xs text-muted">
                            {subject.code} · {subject.subject_type}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={optionalSelection.has(subject.id)}
                          onChange={() => toggleOptionalSubject(subject.id)}
                          className="h-4 w-4 rounded border-line-strong accent-brand"
                        />
                      </label>
                    ))
                  )}
                </div>

                {!selectedStudentHasCombination && (
                  <p className="mt-3 rounded-lg bg-highlight px-3 py-2 text-xs text-highlight-ink">
                    Assign a combination to this student first, then add optional subjects.
                  </p>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={optionalSaving || !selectedStudentHasCombination}
                  onClick={() => void handleSaveOptionalSubjects()}
                >
                  {optionalSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save optional subjects"
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Bulk combination assignment" bodyClassName="p-5 pt-4">
            <p className="text-sm text-muted">
              One per line: admission number, combination code or name.
            </p>
            <textarea
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              rows={8}
              placeholder={"S-001, PCM\nS-002, HGL"}
              className="app-textarea mt-4 min-h-36"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                aria-label="Form for bulk assignment"
                value={selectedForm}
                onChange={(event) => {
                  setSelectedForm(event.target.value as FormLevel);
                  setSelectedStudentId("");
                  setSelectedCombinationId("");
                  setOptionalSelection(new Set());
                  setBulkOptionalStudentIds(new Set());
                }}
              >
                {formOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Input
                aria-label="Academic year for bulk assignment"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                placeholder="2026"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => void handleBulkAssign()}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Assign bulk list
            </Button>
          </Card>

          <Card title="Bulk optional subjects" bodyClassName="p-5 pt-4">
            <p className="text-sm text-muted">
              Choose one subject, then select the {selectedForm} students who take it.
            </p>

            <Select
              aria-label="Optional subject"
              value={bulkOptionalSubjectId}
              onChange={(event) => setBulkOptionalSubjectId(event.target.value)}
              className="mt-4"
            >
              <option value="">Select an optional subject</option>
              {subjectOptions
                .filter((subject) => subject.subject_type !== "SUBSIDIARY")
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
            </Select>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line bg-canvas p-2">
              {formStudents.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted">
                  No {selectedForm} students registered.
                </p>
              ) : (
                formStudents.map((student) => {
                  const combinationIds =
                    combinationSubjectIdsByStudent.get(student.id) ?? new Set<string>();
                  const alreadyInCombination =
                    Boolean(bulkOptionalSubjectId) &&
                    combinationIds.has(bulkOptionalSubjectId);
                  return (
                    <label
                      key={student.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                        alreadyInCombination
                          ? "border-line bg-slate-100 text-slate-400"
                          : "border-line bg-white"
                      }`}
                    >
                      <span>
                        <span className="block font-medium">{student.full_name}</span>
                        <span className="text-xs text-muted">
                          {student.admission_no ?? "No admission number"}
                          {alreadyInCombination ? " · already in combination" : ""}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        disabled={alreadyInCombination}
                        checked={bulkOptionalStudentIds.has(student.id)}
                        onChange={() => toggleBulkOptionalStudent(student.id)}
                        className="h-4 w-4 rounded border-line-strong accent-brand disabled:opacity-50"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              disabled={
                bulkOptionalSaving ||
                !bulkOptionalSubjectId ||
                bulkOptionalStudentIds.size === 0
              }
              onClick={() => void handleBulkOptionalAssign()}
            >
              {bulkOptionalSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  Assign optional subject ({bulkOptionalStudentIds.size})
                </>
              )}
            </Button>
          </Card>

          <Card
            title="Students not assigned yet"
            action={
              <Badge tone="neutral">
                {selectedForm} · {academicYear}
              </Badge>
            }
            bodyClassName="p-5 pt-4"
          >
            {unassignedStudents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Everyone is assigned"
                description={`All registered ${selectedForm} students have a combination for ${academicYear}.`}
              />
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {unassignedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{student.full_name}</div>
                      <div className="text-xs text-muted">
                        {student.admission_no ?? "No admission number"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => selectStudent(student.id)}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
