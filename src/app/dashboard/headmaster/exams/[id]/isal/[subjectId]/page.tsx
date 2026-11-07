import { ISALSubjectPage } from "@/components/dashboard/isal-page";

export const instant = false;

export default async function HeadmasterExamISALSubjectPage({
  params,
}: {
  params: Promise<{ id: string; subjectId: string }>;
}) {
  const { id, subjectId } = await params;
  return (
    <ISALSubjectPage
      examId={id}
      subjectId={subjectId}
      dashboardBase="/dashboard/headmaster"
    />
  );
}
