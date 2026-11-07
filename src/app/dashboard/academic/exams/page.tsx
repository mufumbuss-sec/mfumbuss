import { ExamManagementPage } from "@/components/dashboard/exam-management-page";

export const instant = false;

export default async function AcademicExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <ExamManagementPage
      canManageExams
      dashboardBase="/dashboard/academic"
      initialStatus={status}
    />
  );
}
