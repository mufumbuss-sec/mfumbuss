import { AcademicPeriodSettings } from "@/components/dashboard/academic-period-settings";
import { PageHeader } from "@/components/ui/page-header";

export default function AcademicSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Academic Settings"
        subtitle="Set the active academic year and term."
      />
      <AcademicPeriodSettings />
    </div>
  );
}
