"use client";

import { useState, useRef, useEffect } from "react";
import { User, Lock, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import Link from "next/link";

export function UserMenu({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-11 items-center gap-2.5 rounded-xl bg-white/10 px-2 text-white transition hover:bg-white/15"
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden items-center gap-1 md:flex">
          <span className="max-w-32 truncate text-sm font-medium">
            {user.name}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-white/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-white py-1 text-ink shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-brand-tint"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-brand-tint"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <Link
            href="/dashboard/change-password"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-brand-tint"
            onClick={() => setOpen(false)}
          >
            <Lock className="h-4 w-4" />
            Change Password
          </Link>
          <div className="mt-1 border-t border-line">
            <form action="/auth/signout" method="post">
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger-ink hover:bg-danger">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
