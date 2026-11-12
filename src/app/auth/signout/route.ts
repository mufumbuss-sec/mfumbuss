import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Revoking the refresh token on Supabase's auth server is a network request.
// On slow mobile connections it can hang for a minute, so it must never block
// the response: the local session is cleared first (fast), then we cap how
// long we wait for the server-side revocation.
const REVOKE_TIMEOUT_MS = 2000;

async function signOut(request: Request) {
  const supabase = await createClient();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      // `scope: "local"` removes the session from the cookies *before* it
      // talks to Supabase, so the user is signed out even if the network fails.
      supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, REVOKE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Safety net: never leave an auth cookie behind, even if the SDK could not
  // finish clearing the session within the timeout.
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") &&
      (cookie.name.includes("-auth-token") ||
        cookie.name.includes("-code-verifier"))
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  // 303 makes the browser follow the redirect with a GET. A 307 (the
  // `redirect()` default) would re-POST to /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: Request) {
  return signOut(request);
}

export async function GET(request: Request) {
  return signOut(request);
}
