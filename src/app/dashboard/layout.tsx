import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AcademicPeriodBanner } from "@/components/dashboard/academic-period-banner";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const [
    { data: profile },
    { data: schoolSettings },
    { data: academicPeriod, error: academicPeriodError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, email")
      .eq("id", user.id)
      .single(),
    supabase
      .from("school_settings")
      .select("school_name, school_logo_url, union_logo_url")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("academic_period_settings")
      .select("academic_year, term")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const role = profile?.role as "headmaster" | "academic" | "teacher";

  if (!role || !["headmaster", "academic", "teacher"].includes(role)) {
    redirect("/login");
  }
  const academicSettingsHref =
    role === "headmaster"
      ? "/dashboard/headmaster/settings"
      : "/dashboard/academic/settings";

  const schoolName = schoolSettings?.school_name || "Mufumbu Secondary School";

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas">
      <Header
        schoolName={schoolName}
        user={{
          name: profile?.full_name || user.email || "",
          email: profile?.email || user.email || "",
          role: role,
        }}
      />
      <Sidebar role={role} />
      <div className="overflow-x-hidden pt-16 min-[820px]:pl-60">
        <AcademicPeriodBanner
          role={role}
          academicPeriod={academicPeriod ?? null}
          academicPeriodError={academicPeriodError ?? null}
          academicSettingsHref={academicSettingsHref}
        />
        <main className="overflow-x-hidden p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
