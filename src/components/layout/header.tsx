"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";

export function Header({
  title,
  user,
}: {
  title: string;
  user: { name: string; email: string; role: string };
}) {
  const toggleMenu = () => {
    const next = !document.body.classList.contains("mobile-nav-open");
    document.body.classList.toggle("mobile-nav-open", next);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100 lg:hidden"
            onClick={toggleMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">{title}</h1>
        </div>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
