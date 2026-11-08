"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";

export function Header({
  schoolName = "Mufumbu Secondary School",
  user,
}: {
  schoolName?: string;
  user: { name: string; email: string; role: string };
}) {
  const toggleMenu = () => {
    const next = !document.body.classList.contains("mobile-nav-open");
    document.body.classList.toggle("mobile-nav-open", next);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 bg-brand text-white">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Toggle navigation menu"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-white transition hover:bg-white/10 min-[820px]:hidden"
            onClick={toggleMenu}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-[13px] font-bold text-accent-ink">
              NSS
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight sm:text-[18px]">
                {schoolName}
              </p>
              <p className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/70 sm:block">
                Exams System
              </p>
            </div>
          </div>
        </div>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
