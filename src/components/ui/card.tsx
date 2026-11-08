import type { ReactNode } from "react";

export function Card({
  title,
  description,
  action,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`app-card overflow-hidden ${className}`}>
      {title || action ? (
        <div className="app-card-header pb-4">
          <div className="min-w-0">
            {title ? <h2 className="app-card-title">{title}</h2> : null}
            {description ? <p className="app-card-subtitle">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName || "p-5"}>{children}</div>
    </section>
  );
}
