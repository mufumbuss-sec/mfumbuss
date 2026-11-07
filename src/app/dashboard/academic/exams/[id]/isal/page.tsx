import { ISALListPage } from "@/components/dashboard/isal-page";

export const instant = false;

export default async function AcademicExamISALPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ISALListPage examId={id} dashboardBase="/dashboard/academic" />;
}
