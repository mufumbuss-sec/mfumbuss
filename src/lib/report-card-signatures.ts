export const SIGNATURE_KINDS = [
  "headmaster",
  "academic",
  "classTeacher",
  "stamp",
] as const;

export type SignatureKind = (typeof SIGNATURE_KINDS)[number];

export type SignaturePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SignatureLayout = Record<SignatureKind, SignaturePlacement>;

export type SchoolSignatures = {
  headmaster_signature_url: string | null;
  academic_signature_url: string | null;
  class_teacher_signature_url: string | null;
  school_stamp_url: string | null;
  signature_layout: SignatureLayout | null;
};

export const SIGNATURE_URL_FIELDS: Record<
  SignatureKind,
  Exclude<keyof SchoolSignatures, "signature_layout">
> = {
  headmaster: "headmaster_signature_url",
  academic: "academic_signature_url",
  classTeacher: "class_teacher_signature_url",
  stamp: "school_stamp_url",
};

export const SIGNATURE_LABELS: Record<SignatureKind, string> = {
  headmaster: "Saini ya Mkuu wa Shule",
  academic: "Saini ya Mwalimu wa Taaluma",
  classTeacher: "Saini ya Mwalimu wa Darasa",
  stamp: "Muhuri wa Shule",
};

export const SIGNATURE_SHORT_LABELS: Record<SignatureKind, string> = {
  headmaster: "Mkuu wa Shule",
  academic: "Mwalimu wa Taaluma",
  classTeacher: "Mwalimu wa Darasa",
  stamp: "Muhuri",
};

export const SIGNATURE_COLUMN_LABELS: Record<SignatureKind, string> = {
  headmaster: "MKUU WA SHULE",
  academic: "MWALIMU WA TAALUMA",
  classTeacher: "MWALIMU WA DARASA",
  stamp: "MUHURI WA SHULE",
};

export const DEFAULT_SIGNATURE_LAYOUT: SignatureLayout = {
  classTeacher: { x: 7, y: 2, width: 19, height: 70 },
  academic: { x: 40.5, y: 2, width: 19, height: 70 },
  headmaster: { x: 74, y: 2, width: 19, height: 70 },
  stamp: { x: 88, y: 14, width: 10, height: 62 },
};

const MIN_SIZE = 3;

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePlacement(
  value: unknown,
  fallback: SignaturePlacement,
): SignaturePlacement {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(finiteNumber(source.width, fallback.width), MIN_SIZE, 100);
  const height = clamp(finiteNumber(source.height, fallback.height), MIN_SIZE, 100);
  const x = clamp(finiteNumber(source.x, fallback.x), 0, 100 - width);
  const y = clamp(finiteNumber(source.y, fallback.y), 0, 100 - height);

  return {
    x: round(x),
    y: round(y),
    width: round(width),
    height: round(height),
  };
}

export function normalizeSignatureLayout(value: unknown): SignatureLayout {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const layout = {} as SignatureLayout;

  for (const kind of SIGNATURE_KINDS) {
    layout[kind] = normalizePlacement(source[kind], DEFAULT_SIGNATURE_LAYOUT[kind]);
  }

  return layout;
}

export function isSignatureKind(value: string): value is SignatureKind {
  return (SIGNATURE_KINDS as readonly string[]).includes(value);
}
