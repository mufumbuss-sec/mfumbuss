import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Inbox } from "@/components/ui/lucide-icons";

type Tone = "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";

const examStatusClasses: Record<string, string> = {
  Draft: "app-badge-warning",
  Active: "app-badge-success",
  Processed: "app-badge-neutral",
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
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <header className="app-page-header">
      <div className="min-w-0">
        <h1 className="app-page-title">{title}</h1>
        {description ? <p className="app-page-subtitle">{description}</p> : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`app-stat-card ${highlight ? "app-stat-card-highlight" : ""}`}
    >
      <p className="app-stat-label">{label}</p>
      <p className="app-stat-value">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
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
    <section className={`app-card overflow-hidden ${className ?? ""}`}>
      <div className="app-card-header">
        <div className="min-w-0">
          <h2 className="app-card-title">{title}</h2>
          {description ? (
            <p className="app-card-subtitle">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
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
    <Link href={href} className="app-btn app-btn-secondary app-btn-sm">
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function ExamStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`app-badge ${
        examStatusClasses[status] ?? "app-badge-neutral"
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
    <div className="app-empty">
      <span className="app-empty-icon">
        <Icon className="h-5 w-5" />
      </span>
      <p className="app-empty-title">{title}</p>
      {description ? <p className="app-empty-text">{description}</p> : null}
    </div>
  );
}
