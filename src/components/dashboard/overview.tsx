import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Inbox } from "@/components/ui/lucide-icons";

type Tone = "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

const examStatusClasses: Record<string, string> = {
  Draft: "bg-amber-50 text-amber-700 ring-amber-200",
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Processed: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function formatDashboardDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? { day: "numeric", month: "short", year: "numeric" },
  ).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function assertDashboardQueries(
  queries: Array<{ name: string; error: { message: string } | null }>,
) {
  const failures = queries
    .filter((query) => query.error)
    .map((query) => `${query.name}: ${query.error?.message}`);

  if (failures.length > 0) {
    throw new Error(`Unable to load dashboard data. ${failures.join("; ")}`);
  }
}

export function requireDashboardCount(count: number | null, name: string) {
  if (count === null) {
    throw new Error(`Unable to load dashboard data. The ${name} count is missing.`);
  }
  return count;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-4 text-white shadow-lg sm:p-5">
      <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex flex-col items-start gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-blue-100/90">
            {description}
          </p>
        </div>
        {children ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
          ) : null}
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
        className ?? ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ViewAllLink({
  href,
  label = "View all",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function ExamStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        examStatusClasses[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
