import { RegisteredStudentsManager } from "@/components/dashboard/registered-students-manager";

export default function RegisteredStudentsPage() {
  return (
    <RegisteredStudentsManager registrationHref="/dashboard/academic/students" />
  );
}
