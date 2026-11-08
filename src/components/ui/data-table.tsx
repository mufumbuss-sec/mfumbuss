import type { ReactNode } from "react";

export function DataTable({
  head,
  children,
  minWidth = "640px",
  className = "",
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="app-table" style={{ minWidth }}>
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
