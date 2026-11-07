"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function NavigationFeedback() {
  return (
    <Suspense fallback={null}>
      <NavigationFeedbackContent />
    </Suspense>
  );
}

function NavigationFeedbackContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocation = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const [loadingLocation, setLoadingLocation] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const startLoading = () => {
      setLoadingLocation(`${window.location.pathname}${window.location.search}`);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setLoadingLocation(null), 20000);
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute("download") || (link.target && link.target !== "_self")) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      const destinationLocation = `${destination.pathname}${destination.search}`;
      if (
        destination.origin !== window.location.origin ||
        destinationLocation === `${window.location.pathname}${window.location.search}`
      ) {
        return;
      }

      startLoading();
    };

    const handleNavigationStart = () => startLoading();
    document.addEventListener("click", handleClick);
    window.addEventListener("app:navigation-start", handleNavigationStart);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("app:navigation-start", handleNavigationStart);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (loadingLocation !== currentLocation) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-3 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg"
    >
      <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
      Loading page...
    </div>
  );
}
