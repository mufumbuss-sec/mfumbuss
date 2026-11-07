import { redirect } from "next/navigation";

export default function HeadmasterResultsRedirect() {
  redirect("/dashboard/headmaster/exams?status=All");
}
