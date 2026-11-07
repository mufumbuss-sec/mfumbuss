import { ExamManagementPage } from "@/components/dashboard/exam-management-page";

export const instant = false;

export default async function TeacherExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <ExamManagementPage
      canManageExams={false}
      dashboardBase="/dashboard/teacher"
      initialStatus={status}
    />
  );
}
