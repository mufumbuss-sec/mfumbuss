"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";

export function AcademicPeriodBanner({
  role,
  academicPeriod,
  academicPeriodError,
  academicSettingsHref,
}: {
  role: "headmaster" | "academic" | "teacher";
  academicPeriod: { academic_year: string; term: string } | null;
  academicPeriodError: unknown;
  academicSettingsHref: string;
}) {
  const pathname = usePathname();

  if (pathname !== "/dashboard") return null;

  const isReady = Boolean(academicPeriod && !academicPeriodError);

  return (
    <div className="px-4 pt-4 sm:px-6">
      <div
        className={`app-card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          isReady
            ? "border-success-ink/20 bg-success"
            : "border-highlight-line bg-highlight"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ${
              isReady ? "text-success-ink" : "text-highlight-ink"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <p
              className={`text-sm font-semibold ${
                isReady ? "text-success-ink" : "text-highlight-ink"
              }`}
            >
              Active Academic Period
            </p>
            {isReady && academicPeriod ? (
              <p className="mt-0.5 text-sm text-ink-soft">
                Academic Year {academicPeriod.academic_year} · {academicPeriod.term}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-ink-soft">
                {academicPeriodError
                  ? "Academic period setup is unavailable. Apply the exam-management database migration."
                  : "No active year or term is set. Configure it before creating exams."}
              </p>
            )}
          </div>
        </div>
        {(role === "headmaster" || role === "academic") && (
          <Link
            href={academicSettingsHref}
            className="app-btn app-btn-secondary app-btn-sm shrink-0"
          >
            Set academic period
          </Link>
        )}
      </div>
    </div>
  );
}
