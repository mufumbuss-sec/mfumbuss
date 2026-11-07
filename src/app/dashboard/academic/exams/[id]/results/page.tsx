import { ExamResultsPage } from "@/components/dashboard/exam-results-page";

export const instant = false;

export default async function AcademicExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ExamResultsPage
      examId={id}
      examsHref="/dashboard/academic/exams"
    />
  );
}
