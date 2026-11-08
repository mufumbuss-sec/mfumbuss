"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
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
    <section className="app-card overflow-hidden">
      <div className="app-card-header border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="app-card-title">Active Academic Period</h2>
          <p className="app-card-subtitle">
            Used by all new examinations.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void savePeriod(event)}>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="Academic year">
            <Select
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
            >
              {ACADEMIC_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Active term">
            <Select
              value={period.term}
              onChange={(event) => {
                const term = event.target.value;
                if (term === "Term I" || term === "Term II") {
                  setPeriod((current) => ({ ...current, term }));
                }
              }}
            >
              <option value="Term I">Term I</option>
              <option value="Term II">Term II</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4">
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save active period"}
          </Button>
        </div>
      </form>
    </section>
  );
}
