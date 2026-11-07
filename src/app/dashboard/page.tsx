import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function DashboardRoot() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "headmaster") redirect("/dashboard/headmaster");
  if (profile?.role === "academic") redirect("/dashboard/academic");
  if (profile?.role === "teacher") redirect("/dashboard/teacher");

  redirect("/login");
}
