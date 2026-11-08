"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  ClipboardList,
  Settings,
  Award,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type RoleNavigation = {
  dashboard: NavItem;
  groups: NavGroup[];
};

const navByRole: Record<string, RoleNavigation> = {
  headmaster: {
    dashboard: { label: "Dashboard", href: "/dashboard/headmaster", icon: LayoutDashboard },
    groups: [
      {
        label: "People & Classes",
        items: [
          { label: "Teachers", href: "/dashboard/headmaster/teachers", icon: Users },
          { label: "Student Registration", href: "/dashboard/headmaster/students", icon: GraduationCap },
          { label: "Registered Students", href: "/dashboard/headmaster/registered-students", icon: Users },
          { label: "Classes", href: "/dashboard/headmaster/classes", icon: BookOpen },
        ],
      },
      {
        label: "Academic Setup",
        items: [
          { label: "Subjects", href: "/dashboard/headmaster/subjects", icon: ClipboardList },
          { label: "Assignments", href: "/dashboard/headmaster/assignments", icon: ClipboardList },
        ],
      },
      {
        label: "A-Level Setup",
        items: [
          { label: "A-Level Subjects", href: "/dashboard/headmaster/a-level/subjects", icon: BookOpen },
          { label: "Combinations", href: "/dashboard/headmaster/a-level/combinations", icon: ClipboardList },
          { label: "Student Allocation", href: "/dashboard/headmaster/a-level/allocations", icon: GraduationCap },
        ],
      },
      {
        label: "Examinations",
        items: [
          { label: "Exam Management", href: "/dashboard/headmaster/exams", icon: FileText },
          { label: "Report Cards", href: "/dashboard/headmaster/report-cards", icon: FileText },
        ],
      },
      {
        label: "Certificates",
        items: [
          { label: "Award Certificates", href: "/dashboard/headmaster/award-certificates", icon: Award },
        ],
      },
      {
        label: "School Settings",
        items: [
          { label: "Settings", href: "/dashboard/headmaster/settings", icon: Settings },
        ],
      },
    ],
  },
  academic: {
    dashboard: { label: "Dashboard", href: "/dashboard/academic", icon: LayoutDashboard },
    groups: [
      {
        label: "People & Classes",
        items: [
          { label: "Teachers", href: "/dashboard/academic/teachers", icon: Users },
          { label: "Student Registration", href: "/dashboard/academic/students", icon: GraduationCap },
          { label: "Registered Students", href: "/dashboard/academic/registered-students", icon: Users },
          { label: "Classes", href: "/dashboard/academic/classes", icon: BookOpen },
        ],
      },
      {
        label: "Academic Setup",
        items: [
          { label: "Subjects", href: "/dashboard/academic/subjects", icon: ClipboardList },
          { label: "Assignments", href: "/dashboard/academic/assignments", icon: ClipboardList },
        ],
      },
      {
        label: "A-Level Setup",
        items: [
          { label: "A-Level Subjects", href: "/dashboard/academic/a-level/subjects", icon: BookOpen },
          { label: "Combinations", href: "/dashboard/academic/a-level/combinations", icon: ClipboardList },
          { label: "Student Allocation", href: "/dashboard/academic/a-level/allocations", icon: GraduationCap },
        ],
      },
      {
        label: "Examinations",
        items: [
          { label: "Exam Management", href: "/dashboard/academic/exams", icon: FileText },
          { label: "Report Cards", href: "/dashboard/academic/report-cards", icon: FileText },
        ],
      },
      {
        label: "Certificates",
        items: [
          { label: "Award Certificates", href: "/dashboard/academic/award-certificates", icon: Award },
        ],
      },
      {
        label: "School Settings",
        items: [
          { label: "Settings", href: "/dashboard/academic/settings", icon: Settings },
        ],
      },
    ],
  },
  teacher: {
    dashboard: { label: "Dashboard", href: "/dashboard/teacher", icon: LayoutDashboard },
    groups: [
      {
        label: "Teaching",
        items: [
          { label: "My Classes", href: "/dashboard/teacher/classes", icon: BookOpen },
          { label: "My Exams", href: "/dashboard/teacher/exams", icon: ClipboardList },
          { label: "Award Certificates", href: "/dashboard/teacher/award-certificates", icon: Award },
        ],
      },
    ],
  },
};

export function Sidebar({
  role,
}: {
  role: "headmaster" | "academic" | "teacher";
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupOverride, setGroupOverride] = useState<{
    pathname: string;
    group: string | null;
  } | null>(null);
  const navigation = navByRole[role];
  const dashboard = navigation.dashboard;
  const groups = navigation.groups;
  const activeGroup = groups.find((group) =>
    group.items.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );
  const expandedGroup =
    groupOverride?.pathname === pathname
      ? groupOverride.group
      : activeGroup?.label ?? null;

  useEffect(() => {
    const sync = () => setMobileOpen(document.body.classList.contains("mobile-nav-open"));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const closeMobileNav = () => {
    document.body.classList.remove("mobile-nav-open");
    setMobileOpen(false);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-brand-deep/40 transition-opacity duration-200 min-[820px]:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobileNav}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`fixed bottom-0 left-0 top-16 z-50 flex w-60 flex-col border-r border-line bg-white transition-transform duration-200 ease-out min-[820px]:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 min-[820px]:hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Menu
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted transition hover:bg-brand-tint hover:text-ink"
            onClick={closeMobileNav}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {(() => {
            const Icon = dashboard.icon;
            const active = pathname === dashboard.href;
            return (
              <Link
                href={dashboard.href}
                onClick={closeMobileNav}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3.5 text-[15px] transition-colors ${
                  active
                    ? "bg-brand-soft font-bold text-brand-dark"
                    : "font-medium text-ink-soft hover:bg-brand-tint"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {dashboard.label}
              </Link>
            );
          })()}

          <div className="space-y-1 pt-2">
            {groups.map((group) => {
              const expanded = expandedGroup === group.label;
              const groupActive = group.items.some(
                (item) =>
                  pathname === item.href || pathname.startsWith(`${item.href}/`),
              );

              return (
                <section key={group.label}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setGroupOverride({
                        pathname,
                        group: expanded ? null : group.label,
                      })
                    }
                    className={`flex min-h-11 w-full items-center justify-between rounded-[10px] px-3.5 text-left text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                      groupActive
                        ? "text-brand-dark"
                        : "text-muted hover:bg-brand-tint hover:text-ink-soft"
                    }`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expanded && (
                    <div className="mt-1 space-y-1 pl-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMobileNav}
                            className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3.5 text-sm transition-colors ${
                              active
                                ? "bg-brand-soft font-bold text-brand-dark"
                                : "font-medium text-ink-soft hover:bg-brand-tint"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}
