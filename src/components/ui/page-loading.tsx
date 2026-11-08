export function PageLoading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-canvas px-6 py-16">
      <div
        role="status"
        className="flex w-full max-w-sm flex-col items-center rounded-[14px] border border-line bg-white p-8 text-center"
      >
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-soft opacity-70" />
          <span className="relative h-11 w-11 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        </span>
        <p className="mt-5 text-base font-semibold text-ink">Loading...</p>
        <p className="mt-1 text-sm text-muted">Please wait a moment</p>
        <span className="sr-only">Loading page</span>
      </div>
    </main>
  );
}
