import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/reset-password";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const flowId = url.searchParams.get("flow_id");
  const next = safeRedirectPath(url.searchParams.get("next"));
  const authError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(authError)}`, url.origin),
    );
  }

  const supabase = await createClient();
  let exchangeError: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    exchangeError = error.message;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    exchangeError = error.message;
  }

  const reason =
    exchangeError && /code verifier|pkce|flow/i.test(exchangeError)
      ? "open-same-browser"
      : "link-expired";

  return NextResponse.redirect(
    new URL(`/forgot-password?error=${reason}`, url.origin),
  );
}
