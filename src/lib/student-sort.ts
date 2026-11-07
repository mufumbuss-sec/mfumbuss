export type StudentSortItem = {
  id?: string | null;
  student_id?: string | null;
  sex?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  student?: StudentSortItem | null;
};

function normalizeGender(value?: string | null) {
  const normalized = (value ?? "").trim().toUpperCase();
  if (["F", "FEMALE", "GIRL"].includes(normalized)) return 0;
  if (["M", "MALE", "BOY"].includes(normalized)) return 1;
  return 2;
}

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function resolveStudentRecord(value: StudentSortItem) {
  return value.student ?? value;
}

export function getStudentSortName(student: StudentSortItem) {
  const resolved = resolveStudentRecord(student);
  const fullName = safeText(resolved.full_name);
  if (fullName) return fullName;

  const parts = [resolved.first_name, resolved.middle_name, resolved.last_name]
    .map((part) => safeText(part))
    .filter(Boolean);

  return parts.join(" ");
}

export function compareStudentsForDisplay<T extends StudentSortItem>(a: T, b: T) {
  const studentA = resolveStudentRecord(a);
  const studentB = resolveStudentRecord(b);

  const genderOrder = normalizeGender(studentA.sex) - normalizeGender(studentB.sex);
  if (genderOrder !== 0) return genderOrder;

  const nameOrder = getStudentSortName(a).localeCompare(
    getStudentSortName(b),
    undefined,
    { sensitivity: "base" },
  );
  if (nameOrder !== 0) return nameOrder;

  return safeText(studentA.id ?? a.id ?? a.student_id).localeCompare(
    safeText(studentB.id ?? b.id ?? b.student_id),
  );
}

export function sortStudentsForDisplay<T extends StudentSortItem>(students: T[]) {
  return [...students].sort(compareStudentsForDisplay);
}
