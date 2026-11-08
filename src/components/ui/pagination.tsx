"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  className?: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  loading = false,
  className = "",
}: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  return (
    <div
      className={`flex flex-col gap-3 border-t border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span>
          Showing <span className="font-semibold text-ink">{from}</span>-
          <span className="font-semibold text-ink">{to}</span> of{" "}
          <span className="font-semibold text-ink">{total}</span>
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Per page
            </span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={loading}
              className="h-9 rounded-[10px] border border-line-strong bg-white px-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
          className="app-btn app-btn-secondary app-btn-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="text-sm font-medium text-muted">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= totalPages}
          className="app-btn app-btn-secondary app-btn-sm"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
