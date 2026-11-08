import type { ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "app-badge-success",
  warning: "app-badge-warning",
  danger: "app-badge-danger",
  neutral: "app-badge-neutral",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`app-badge ${toneClass[tone]} ${className}`}>{children}</span>
  );
}
