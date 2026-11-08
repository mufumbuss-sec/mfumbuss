"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[14px] border border-line bg-white p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-danger text-danger-ink">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This page could not be loaded. Try again, or return to your dashboard.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="app-btn app-btn-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/dashboard" className="app-btn app-btn-secondary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
