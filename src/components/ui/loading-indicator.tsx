export function LoadingIndicator({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-center gap-3 text-sm font-medium text-slate-600 ${className}`}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-100 opacity-70" />
        <span className="relative h-6 w-6 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
      </span>
      <span>{label}</span>
      <span className="sr-only">Please wait</span>
    </div>
  );
}
