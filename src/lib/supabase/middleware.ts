import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  createTimeoutFetch,
  isAuthNetworkError,
} from "@/lib/supabase/timeout-fetch";

const timeoutFetch = createTimeoutFetch();

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Signing out must answer instantly. Refreshing/validating the session here
  // only adds another round trip to Supabase before the cookies are cleared.
  if (path === "/auth/signout") {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: timeoutFetch,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  type AuthedUser = {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
  };

  let user: AuthedUser | null = null;

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  // Supabase is unreachable or timed out. Do not lock the user out of the app
  // because of a network blip — let the page decide what to show.
  if (isAuthNetworkError(claimsError)) {
    return supabaseResponse;
  }

  const claims = claimsData?.claims as Record<string, unknown> | undefined;

  if (typeof claims?.sub === "string") {
    user = {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      app_metadata:
        claims.app_metadata && typeof claims.app_metadata === "object"
          ? (claims.app_metadata as Record<string, unknown>)
          : {},
    };
  } else {
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (isAuthNetworkError(userError)) {
      return supabaseResponse;
    }

    if (authUser) {
      user = {
        id: authUser.id,
        email: authUser.email ?? undefined,
        app_metadata: authUser.app_metadata as Record<string, unknown>,
      };
    }
  }

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/dashboard")) {
    const metadataRole =
      typeof user.app_metadata?.role === "string"
        ? user.app_metadata.role
        : null;

    let role = metadataRole;
    if (!role) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      role = profile?.role ?? null;
    }
    const sharedAccountPath =
      path === "/dashboard/profile" || path === "/dashboard/change-password";

    if (
      role === "headmaster" &&
      !path.startsWith("/dashboard/headmaster") &&
      !sharedAccountPath
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/headmaster";
      return NextResponse.redirect(url);
    }
    if (
      role === "academic" &&
      !path.startsWith("/dashboard/academic") &&
      !sharedAccountPath
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/academic";
      return NextResponse.redirect(url);
    }
    if (
      role === "teacher" &&
      !path.startsWith("/dashboard/teacher") &&
      !sharedAccountPath
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/teacher";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
