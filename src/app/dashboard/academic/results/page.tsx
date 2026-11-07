import { redirect } from "next/navigation";

export default function AcademicResultsRedirect() {
  redirect("/dashboard/academic/exams?status=All");
}
