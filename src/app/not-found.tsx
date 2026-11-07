import Link from "next/link";
import { FileQuestion } from "@/components/ui/lucide-icons";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <FileQuestion className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-950">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
