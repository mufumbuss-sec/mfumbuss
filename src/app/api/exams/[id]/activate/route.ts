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
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  if (exam.status !== "Draft") {
    return NextResponse.json(
      { error: "Only draft examinations can be activated." },
      { status: 409 },
    );
  }

  const { count, error: subjectsError } = await admin
    .from("exam_subjects")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", id);
  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Add at least one subject before activating the examination." },
      { status: 400 },
    );
  }

  const { data: updatedExam, error: updateError } = await admin
    .from("exams")
    .update({ status: "Active", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "Draft")
    .select("*")
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedExam) {
    return NextResponse.json(
      { error: "The examination status changed. Refresh and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ exam: updatedExam });
}
