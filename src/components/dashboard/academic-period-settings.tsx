"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle, Save } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { notify } from "@/lib/notifications";

type AcademicPeriod = {
  academic_year: string;
  term: "Term I" | "Term II";
};

const MIN_ACADEMIC_YEAR = 2000;
const MAX_ACADEMIC_YEAR = 2100;
const ACADEMIC_YEARS = Array.from(
  { length: MAX_ACADEMIC_YEAR - MIN_ACADEMIC_YEAR + 1 },
  (_, index) => String(MIN_ACADEMIC_YEAR + index),
);
const CURRENT_YEAR = String(new Date().getFullYear());
const DEFAULT_ACADEMIC_YEAR = ACADEMIC_YEARS.includes(CURRENT_YEAR)
  ? CURRENT_YEAR
  : String(MIN_ACADEMIC_YEAR);

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export function AcademicPeriodSettings() {
  const [period, setPeriod] = useState<AcademicPeriod>({
    academic_year: DEFAULT_ACADEMIC_YEAR,
    term: "Term I",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPeriod() {
      try {
        const response = await fetch("/api/settings/academic-period");
        const result = (await response.json()) as {
          period?: AcademicPeriod;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Unable to load the active academic period.");
        }
        if (active && result.period) setPeriod(result.period);
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "Unable to load the active academic period.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPeriod();
    return () => {
      active = false;
    };
  }, []);

  async function savePeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ACADEMIC_YEARS.includes(period.academic_year)) {
      notify(
        "error",
        `Select an academic year from ${MIN_ACADEMIC_YEAR} to ${MAX_ACADEMIC_YEAR}.`,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings/academic-period", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(period),
      });
      const result = (await response.json()) as {
        period?: AcademicPeriod;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to save the active academic period.");
      }
      if (!result.period) throw new Error("The saved academic period was not returned.");
      setPeriod(result.period);
      notify("success", "Active academic year and term saved.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save the active academic period.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingIndicator label="Loading academic period..." className="py-8" />;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 sm:h-11 sm:w-11">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900">Active Academic Period</h3>
          <p className="text-sm text-slate-500">
            All new examinations will use this academic year and term.
          </p>
        </div>
      </div>

      <p className="border-b border-slate-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800 sm:px-6">
        Examinations and results remain grouped under the academic year they
        were created in. Changing the active year starts a fresh examination
        workspace; previous years stay available through the year filter.
      </p>

      <form onSubmit={(event) => void savePeriod(event)}>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Academic year
            <select
              required
              value={period.academic_year}
              onChange={(event) => {
                if (ACADEMIC_YEARS.includes(event.target.value)) {
                  setPeriod((current) => ({
                    ...current,
                    academic_year: event.target.value,
                  }));
                }
              }}
              className={inputClass}
            >
              {ACADEMIC_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Active term
            <select
              value={period.term}
              onChange={(event) => {
                const term = event.target.value;
                if (term === "Term I" || term === "Term II") {
                  setPeriod((current) => ({ ...current, term }));
                }
              }}
              className={inputClass}
            >
              <option value="Term I">Term I</option>
              <option value="Term II">Term II</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save active period"}
          </button>
        </div>
      </form>
    </section>
  );
}
