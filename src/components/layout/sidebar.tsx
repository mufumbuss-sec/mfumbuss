"use client";

import Link from "next/link";
import Image from "next/image";
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
  school,
}: {
  role: "headmaster" | "academic" | "teacher";
  school: { name: string; logoUrl: string | null; unionLogoUrl: string | null };
  user: { name: string; email: string; role: string };
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
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobileNav}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col bg-slate-900 text-white shadow-2xl transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex min-w-0 items-center gap-3">
            {school.logoUrl ? (
              <Image
                src={school.logoUrl}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                NSS
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{school.name}</h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Exams System
              </p>
            </div>
            {school.unionLogoUrl && (
              <Image
                src={school.unionLogoUrl}
                alt="Union logo"
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5"
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={closeMobileNav}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {(() => {
            const Icon = dashboard.icon;
            const active = pathname === dashboard.href;
            return (
              <Link
                href={dashboard.href}
                onClick={closeMobileNav}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
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
                    className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
                      groupActive
                        ? "text-blue-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
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
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                              active
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
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
