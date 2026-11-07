"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  LoaderCircle,
  Move,
  PenLine,
  Trash2,
  X,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import SignaturePad from "@/components/dashboard/signature-pad";
import {
  normalizeSignatureLayout,
  SIGNATURE_COLUMN_LABELS,
  SIGNATURE_KINDS,
  SIGNATURE_LABELS,
  SIGNATURE_SHORT_LABELS,
  SIGNATURE_URL_FIELDS,
  type SchoolSignatures,
  type SignatureKind,
  type SignatureLayout,
  type SignaturePlacement,
} from "@/lib/report-card-signatures";

type SignatureManagerProps = {
  school: SchoolSignatures;
  onSchoolChange: (signatures: SchoolSignatures) => void;
  onClose: () => void;
};

type DragMode = "move" | "resize";

type DragState = {
  kind: SignatureKind;
  mode: DragMode;
  startX: number;
  startY: number;
  start: SignaturePlacement;
  bounds: { width: number; height: number };
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SIGNATURE_COLUMNS: SignatureKind[] = ["classTeacher", "academic", "headmaster"];
// The report card is signed by the headmaster and the academic teacher only.
const REPORT_CARD_SIGNATURE_COLUMNS: SignatureKind[] = ["academic", "headmaster"];
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIGNATURE_SIZE = 3 * 1024 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ReportCardSignatures({ school }: { school: SchoolSignatures }) {
  const layout = normalizeSignatureLayout(school.signature_layout);
  const stampUrl = school.school_stamp_url;

  return (
    <section className="report-card-signatures relative mt-4 grid grid-cols-2 gap-6">
      <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
        {REPORT_CARD_SIGNATURE_COLUMNS.map((kind, index) => {
          const url = school[SIGNATURE_URL_FIELDS[kind]];
          if (!url) return null;
          const placement = layout[kind];
          const left =
            ((index + 0.5) * 100) / REPORT_CARD_SIGNATURE_COLUMNS.length -
            placement.width / 2;
          return (
            <div
              key={kind}
              className="absolute"
              style={{
                left: `${Math.max(0, left)}%`,
                top: `${placement.y}%`,
                width: `${placement.width}%`,
                height: `${placement.height}%`,
              }}
            >
              <Image
                src={url}
                alt=""
                fill
                unoptimized
                sizes="20vw"
                className="object-contain"
              />
            </div>
          );
        })}
      </div>

      {stampUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20"
          style={{
            left: `${layout.stamp.x}%`,
            top: `${layout.stamp.y}%`,
            width: `${layout.stamp.width}%`,
            height: `${layout.stamp.height}%`,
          }}
        >
          <Image
            src={stampUrl}
            alt=""
            fill
            unoptimized
            sizes="30vw"
            className="object-contain"
          />
        </div>
      ) : null}

      {REPORT_CARD_SIGNATURE_COLUMNS.map((kind) => (
        <div
          key={kind}
          className="report-card-signature relative z-20 text-center text-[12px] font-bold uppercase"
        >
          <div className="report-card-signature-space h-[60px]" aria-hidden="true" />
          <div className="report-card-signature-line border-t border-slate-500 pt-1">
            {SIGNATURE_COLUMN_LABELS[kind]}
          </div>
        </div>
      ))}
    </section>
  );
}

export function SignatureManager({
  school,
  onSchoolChange,
  onClose,
}: SignatureManagerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SignatureLayout>(() =>
    normalizeSignatureLayout(school.signature_layout),
  );
  const layoutRef = useRef<SignatureLayout>(layout);
  const dragRef = useRef<DragState | null>(null);
  const [selected, setSelected] = useState<SignatureKind | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState<SignatureKind | null>(null);
  const [removing, setRemoving] = useState<SignatureKind | null>(null);
  const [padKind, setPadKind] = useState<SignatureKind | null>(null);

  useEffect(() => {
    if (dragRef.current) return;
    const next = normalizeSignatureLayout(school.signature_layout);
    layoutRef.current = next;
    setLayout(next);
  }, [school.signature_layout]);

  function updateLayout(next: SignatureLayout) {
    layoutRef.current = next;
    setLayout(next);
  }

  async function postSignature(form: FormData) {
    const response = await fetch("/api/report-cards/signatures", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as {
      signatures?: SchoolSignatures;
      error?: string;
    };
    if (!response.ok || !body.signatures) {
      throw new Error(body.error || "Imeshindikana kuhifadhi saini.");
    }
    onSchoolChange(body.signatures);
    return body.signatures;
  }

  async function saveLayout(next: SignatureLayout) {
    setSaveState("saving");
    try {
      const form = new FormData();
      form.set("layout", JSON.stringify(next));
      await postSignature(form);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      notify(
        "error",
        error instanceof Error ? error.message : "Imeshindikana kuhifadhi mpangilio.",
      );
    }
  }

  function startDrag(
    event: React.PointerEvent<HTMLElement>,
    kind: SignatureKind,
    mode: DragMode,
  ) {
    if (event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(kind);

    const bounds = canvas.getBoundingClientRect();
    dragRef.current = {
      kind,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...layoutRef.current[kind] },
      bounds: { width: bounds.width, height: bounds.height },
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();

    const dx = ((event.clientX - drag.startX) / drag.bounds.width) * 100;
    const dy = ((event.clientY - drag.startY) / drag.bounds.height) * 100;

    let placement: SignaturePlacement;
    if (drag.mode === "move") {
      placement = {
        ...drag.start,
        x: clamp(drag.start.x + dx, 0, 100 - drag.start.width),
        y: clamp(drag.start.y + dy, 0, 100 - drag.start.height),
      };
    } else {
      placement = {
        ...drag.start,
        width: clamp(drag.start.width + dx, 3, 100 - drag.start.x),
        height: clamp(drag.start.height + dy, 3, 100 - drag.start.y),
      };
    }

    const next = normalizeSignatureLayout({
      ...layoutRef.current,
      [drag.kind]: placement,
    });
    updateLayout(next);
    setSaveState("idle");
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
    void saveLayout(layoutRef.current);
  }

  async function handleUpload(kind: SignatureKind, file?: File) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      notify("error", "Tumia picha ya JPG, PNG, au WEBP.");
      return;
    }
    if (file.size > MAX_SIGNATURE_SIZE) {
      notify("error", "Picha ya saini isizidi 3 MB.");
      return;
    }

    setUploading(kind);
    setSaveState("saving");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("layout", JSON.stringify(layoutRef.current));
      form.set("file", file);
      await postSignature(form);
      setSaveState("saved");
      notify("success", `${SIGNATURE_LABELS[kind]} imehifadhiwa.`);
    } catch (error) {
      setSaveState("error");
      notify(
        "error",
        error instanceof Error ? error.message : "Imeshindikana kupakia saini.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function handleRemove(kind: SignatureKind) {
    const confirmed = window.confirm(`Ondoa ${SIGNATURE_LABELS[kind]}?`);
    if (!confirmed) return;

    setRemoving(kind);
    setSaveState("saving");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("remove", "1");
      form.set("layout", JSON.stringify(layoutRef.current));
      await postSignature(form);
      setSaveState("saved");
      notify("success", `${SIGNATURE_LABELS[kind]} imeondolewa.`);
    } catch (error) {
      setSaveState("error");
      notify(
        "error",
        error instanceof Error ? error.message : "Imeshindikana kuondoa saini.",
      );
    } finally {
      setRemoving(null);
    }
  }

  const savedLabel =
    saveState === "saving"
      ? "Inahifadhi..."
      : saveState === "saved"
        ? "Imehifadhiwa"
        : saveState === "error"
          ? "Haikuhifadhiwa"
          : "Mabadiliko huhifadhiwa moja kwa moja";

  return (
    <div className="report-no-print space-y-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <PenLine className="h-4 w-4" />
            Saini na Muhuri
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pakia saini za mkuu wa shule, mwalimu wa taaluma, mwalimu wa darasa na
            muhuri wa shule. Buruta picha kusogeza; vuta kishale cha pembe ya chini
            kulia kukuza au kupunguza.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${
              saveState === "error"
                ? "text-rose-600 dark:text-rose-400"
                : saveState === "saved"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {savedLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga saini na muhuri"
            className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="relative h-[180px] w-full touch-none select-none overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60"
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-4 p-3">
          {SIGNATURE_COLUMNS.map((kind) => (
            <div key={kind} className="relative">
              <div className="absolute inset-x-0 bottom-7 border-t border-dashed border-slate-300 dark:border-slate-600" />
              <span className="absolute inset-x-0 bottom-0 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {SIGNATURE_SHORT_LABELS[kind]}
              </span>
            </div>
          ))}
        </div>

        {SIGNATURE_KINDS.map((kind) => {
          const url = school[SIGNATURE_URL_FIELDS[kind]];
          if (!url) return null;
          const placement = layout[kind];
          const isSelected = selected === kind;
          return (
            <div
              key={kind}
              aria-label={`${SIGNATURE_LABELS[kind]} - buruta kusogeza`}
              onPointerDown={(event) => startDrag(event, kind, "move")}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onFocus={() => setSelected(kind)}
              tabIndex={0}
              className={`absolute cursor-move touch-none rounded outline-none ${
                isSelected
                  ? "z-20 ring-2 ring-blue-500 ring-offset-1"
                  : "z-10 ring-1 ring-slate-300 dark:ring-slate-500"
              }`}
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                width: `${placement.width}%`,
                height: `${placement.height}%`,
              }}
            >
              <Image
                src={url}
                alt={SIGNATURE_LABELS[kind]}
                fill
                unoptimized
                sizes="220px"
                draggable={false}
                className="pointer-events-none object-contain"
              />
              {isSelected && (
                <button
                  type="button"
                  aria-label={`Kuza au punguza ${SIGNATURE_LABELS[kind]}`}
                  onPointerDown={(event) => startDrag(event, kind, "resize")}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="absolute -bottom-2.5 -right-2.5 grid h-6 w-6 cursor-nwse-resize touch-none place-items-center rounded-full bg-blue-600 text-white shadow-md"
                >
                  <Move className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {SIGNATURE_KINDS.every(
          (kind) => !school[SIGNATURE_URL_FIELDS[kind]],
        ) && (
          <div className="absolute inset-0 grid place-items-center text-center text-xs font-medium text-slate-400">
            Pakia saini au muhuri chini kuanza kupanga.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SIGNATURE_KINDS.map((kind) => {
          const url = school[SIGNATURE_URL_FIELDS[kind]];
          const isUploading = uploading === kind;
          const isRemoving = removing === kind;
          const busy = isUploading || isRemoving;

          return (
            <div
              key={kind}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {SIGNATURE_LABELS[kind]}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {url ? "Picha imepakiwa" : "Hakuna picha"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <label
                    className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
                      busy ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {isUploading ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    {url ? "Badilisha" : "Pakia"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        void handleUpload(kind, file);
                      }}
                    />
                  </label>
                  {url && (
                    <button
                      type="button"
                      aria-label={`Ondoa ${SIGNATURE_LABELS[kind]}`}
                      disabled={busy}
                      onClick={() => void handleRemove(kind)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-rose-300 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      {isRemoving ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Ondoa
                    </button>
                  )}
                </div>
              </div>

              {url && (
                <div className="mt-2 flex h-16 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <Image
                    src={url}
                    alt={SIGNATURE_LABELS[kind]}
                    width={220}
                    height={64}
                    unoptimized
                    className="max-h-14 w-auto object-contain"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Mpangilio wa mwisho: {Math.round(layout.headmaster.x)}% kushoto,{" "}
        {Math.round(layout.headmaster.y)}% juu kwa saini ya mkuu wa shule. Picha
        zote zinaonekana kwenye kila kadi ya mwanafunzi.
      </p>
    </div>
  );
}
