"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, LoaderCircle, PenLine, X } from "lucide-react";

type SignaturePadProps = {
  title: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<boolean>;
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 360;
const PEN_WIDTH = 3.2;
const PEN_COLOR = "#0f172a";

export default function SignaturePad({
  title,
  saving = false,
  onClose,
  onSave,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const working = busy || saving;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = PEN_COLOR;
    context.fillStyle = PEN_COLOR;
    context.lineWidth = PEN_WIDTH;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, working]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  function startStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (working) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;

    const point = pointFromEvent(event);
    drawingRef.current = true;
    lastPointRef.current = point;
    context.beginPath();
    context.arc(point.x, point.y, PEN_WIDTH / 2, 0, Math.PI * 2);
    context.fill();
    setHasInk(true);
    setError("");
  }

  function moveStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const lastPoint = lastPointRef.current;
    if (!context || !lastPoint) return;

    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function endStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHasInk(false);
    setError("");
  }

  async function saveSignature() {
    if (working) return;
    if (!hasInk) {
      setError("Saini kwanza kabla ya kuhifadhi.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setBusy(true);
    setError("");
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        throw new Error("Imeshindikana kutengeneza picha ya saini.");
      }
      const file = new File([blob], `saini-${Date.now()}.png`, {
        type: "image/png",
      });
      const saved = await onSave(file);
      if (saved) {
        onClose();
      } else {
        setError("Imeshindikana kuhifadhi saini. Jaribu tena.");
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Imeshindikana kuhifadhi saini.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-brand-deep/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-pad-title"
        className="w-full max-w-2xl rounded-[14px] border border-line bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="signature-pad-title"
              className="flex items-center gap-2 text-base font-bold text-ink"
            >
              <PenLine className="h-4 w-4 text-brand" />
              {title}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Chora saini yako hapa kwa mouse, kidole au kalamu ya screen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            aria-label="Funga saini"
            className="rounded-lg border border-line p-1.5 text-muted transition hover:bg-brand-tint hover:text-brand disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-white">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full touch-none select-none"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
          {!hasInk && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-slate-400">
              Saini hapa
            </span>
          )}
        </div>

        {error && (
          <p className="app-error mt-2">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={clearPad}
            disabled={working}
            className="app-btn app-btn-secondary app-btn-sm"
          >
            <Eraser className="h-4 w-4" />
            Futa
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="app-btn app-btn-secondary app-btn-sm"
          >
            Ghairi
          </button>
          <button
            type="button"
            onClick={() => void saveSignature()}
            disabled={working}
            className="app-btn app-btn-primary app-btn-sm"
          >
            {working ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="h-4 w-4" />
            )}
            {working ? "Inahifadhi..." : "Hifadhi saini"}
          </button>
        </div>
      </div>
    </div>
  );
}
