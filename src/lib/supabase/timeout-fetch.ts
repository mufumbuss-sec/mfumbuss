const DEFAULT_AUTH_TIMEOUT_MS = 5000;

function isAuthRequest(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  return url.includes("/auth/v1/");
}

/**
 * Supabase's auth endpoints (`/auth/v1/...`) are the calls that can hang for a
 * minute on slow or unstable connections. Bound them with an `AbortSignal` so
 * a request never waits forever. Data requests (PostgREST, storage, ...) are
 * left untouched because they can legitimately take longer.
 */
export function createTimeoutFetch(timeoutMs = DEFAULT_AUTH_TIMEOUT_MS) {
  return function timeoutFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (!isAuthRequest(input)) {
      return fetch(input, init);
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    return fetch(input, { ...init, signal });
  };
}

/**
 * `AuthRetryableFetchError` means Supabase could not be reached (offline,
 * timeout, 5xx) — as opposed to "this user is not signed in".
 */
export function isAuthNetworkError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AuthRetryableFetchError"
  );
}
