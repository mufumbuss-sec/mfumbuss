import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: reopened, error: reopenError } = await admin.rpc(
    "reopen_exam_results",
    {
      p_exam_id: id,
      p_user_id: user.id,
    },
  );
  if (reopenError) {
    const message = reopenError.message || "Unable to reopen the examination.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only processed")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const summary = (reopened ?? {}) as { results_removed?: number };

  return NextResponse.json({
    exam: { id, status: "Active" },
    results_removed: summary.results_removed ?? 0,
  });
}
