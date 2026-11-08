import Link from "next/link";
import { FileQuestion } from "@/components/ui/lucide-icons";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-[14px] border border-line bg-white p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <FileQuestion className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/dashboard"
          className="app-btn app-btn-primary mt-5 w-full"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
