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

  return (
    <div className="px-4 pt-4 sm:px-6">
      <div
        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          academicPeriod && !academicPeriodError
            ? "border-indigo-200 bg-indigo-50 text-indigo-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
          <div>
            <p className="text-sm font-semibold">Active Academic Period</p>
            {academicPeriod && !academicPeriodError ? (
              <p className="mt-0.5 text-sm">
                Academic Year {academicPeriod.academic_year} · {academicPeriod.term}
              </p>
            ) : (
              <p className="mt-0.5 text-sm">
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
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-indigo-300 bg-white px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
          >
            Set academic period
          </Link>
        )}
      </div>
    </div>
  );
}
