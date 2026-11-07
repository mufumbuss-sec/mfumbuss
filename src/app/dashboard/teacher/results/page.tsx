import { redirect } from "next/navigation";

export const instant = false;

export default function TeacherResultsRedirect() {
  redirect("/dashboard/teacher/exams");
}
