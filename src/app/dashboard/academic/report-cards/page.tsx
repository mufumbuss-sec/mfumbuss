import { ReportCardsPage } from "@/components/dashboard/report-cards-page";
import { connection } from "next/server";

export const instant = false;

export default async function AcademicReportCardsPage() {
  await connection();
  return <ReportCardsPage />;
}
