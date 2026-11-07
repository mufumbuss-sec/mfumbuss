export function PageLoading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-6 py-16">
      <div
        role="status"
        className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
      >
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-100 opacity-70" />
          <span className="relative h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        </span>
        <p className="mt-5 text-base font-semibold text-slate-800">
          Loading...
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Please wait a moment
        </p>
        <span className="sr-only">Loading page</span>
      </div>
    </main>
  );
}
