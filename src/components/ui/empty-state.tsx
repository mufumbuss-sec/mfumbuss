import type { LucideIcon } from "lucide-react";
import { Inbox } from "@/components/ui/lucide-icons";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`app-empty ${className}`}>
      <span className="app-empty-icon">
        <Icon className="h-5 w-5" />
      </span>
      <p className="app-empty-title">{title}</p>
      {description ? <p className="app-empty-text">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
