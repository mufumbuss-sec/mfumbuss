import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    studentId?: unknown;
    studentIds?: unknown;
    targetClassId?: unknown;
    action?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const studentIds = Array.isArray(body.studentIds)
    ? body.studentIds
    : studentId
      ? [studentId]
      : [];
  const targetClassId =
    typeof body.targetClassId === "string" ? body.targetClassId : null;
  const action = body.action ?? "promote";

  if (
    studentIds.length === 0 ||
    studentIds.length > 500 ||
    !studentIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return NextResponse.json(
      { error: "Provide between 1 and 500 valid student IDs" },
      { status: 400 },
    );
  }
  if (studentIds.length !== new Set(studentIds).size) {
    return NextResponse.json(
      { error: "Duplicate student IDs are not allowed" },
      { status: 400 },
    );
  }
  if (action !== "promote" && action !== "graduate" && action !== "transfer") {
    return NextResponse.json({ error: "Invalid student action" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: students, error: studentsError } = await adminSupabase
    .from("students")
    .select("id, class_id")
    .in("id", studentIds);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }
  if (!students || students.length !== studentIds.length) {
    return NextResponse.json(
      { error: "One or more students were not found" },
      { status: 404 },
    );
  }

  if (action === "graduate") {
    return NextResponse.json(
      {
        error:
          "Graduation cannot delete student records because it would remove their academic history. Keep the student record or move the student to a dedicated alumni class.",
      },
      { status: 409 },
    );
  }

  if (!targetClassId) {
    return NextResponse.json({ error: "targetClassId is required" }, { status: 400 });
  }

  const currentClassIds = [...new Set(students.map((student) => student.class_id))];
  const { data: currentClasses, error: currentClassesError } = await adminSupabase
    .from("classes")
    .select("id, form")
    .in("id", currentClassIds);
  const { data: targetClass, error: targetClassError } = await adminSupabase
    .from("classes")
    .select("form")
    .eq("id", targetClassId)
    .single();

  if (
    currentClassesError ||
    !currentClasses ||
    currentClasses.length !== currentClassIds.length ||
    targetClassError ||
    !targetClass
  ) {
    return NextResponse.json({ error: "Current or target class not found" }, { status: 404 });
  }

  if (action === "promote") {
    const formOrder = ["Form I", "Form II", "Form III", "Form IV"];
    const forms = [
      ...new Set(currentClasses.map((schoolClass) => schoolClass.form)),
    ];
    if (forms.length !== 1) {
      return NextResponse.json(
        { error: "Selected students must belong to the same form." },
        { status: 400 },
      );
    }
    const currentFormIndex = formOrder.indexOf(forms[0]);
    if (
      currentFormIndex < 0 ||
      formOrder[currentFormIndex + 1] !== targetClass.form
    ) {
      return NextResponse.json(
        { error: "Students can only be promoted to the next form." },
        { status: 400 },
      );
    }

    const { data: sourceAssignments, error: sourceAssignmentsError } =
      await adminSupabase
        .from("class_subject_assignments")
        .select("subject_id, is_compulsory")
        .eq("form", forms[0]);
    if (sourceAssignmentsError) {
      return NextResponse.json(
        {
          error: `Subject assignments for the current form could not be loaded: ${sourceAssignmentsError.message}`,
        },
        { status: 500 },
      );
    }

    const { data: targetAssignments, error: targetAssignmentsError } =
      await adminSupabase
        .from("class_subject_assignments")
        .select("subject_id")
        .eq("form", targetClass.form);
    if (targetAssignmentsError) {
      return NextResponse.json(
        {
          error: `Subject assignments for the destination form could not be loaded: ${targetAssignmentsError.message}`,
        },
        { status: 500 },
      );
    }

    const targetSubjectIds = new Set(
      (targetAssignments ?? []).map((assignment) => assignment.subject_id),
    );
    const missingAssignments = (sourceAssignments ?? [])
      .filter((assignment) => !targetSubjectIds.has(assignment.subject_id))
      .map((assignment) => ({
        form: targetClass.form,
        subject_id: assignment.subject_id,
        is_compulsory: assignment.is_compulsory,
      }));

    if (missingAssignments.length > 0) {
      const { error: copyError } = await adminSupabase
        .from("class_subject_assignments")
        .upsert(missingAssignments, {
          onConflict: "form,subject_id",
          ignoreDuplicates: true,
        });
      if (copyError) {
        return NextResponse.json(
          {
            error: `Subject assignments could not be carried to the destination form: ${copyError.message}`,
          },
          { status: 500 },
        );
      }
    }
  }

  const { error: updateError } = await adminSupabase
    .from("students")
    .update({ class_id: targetClassId })
    .in("id", studentIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (action === "promote") {
    const { data: optionalAssignments, error: assignmentsError } =
      await adminSupabase
        .from("class_subject_assignments")
        .select("subject_id")
        .eq("form", targetClass.form)
        .eq("is_compulsory", false);

    if (assignmentsError) {
      return NextResponse.json(
        {
          error: `Student was promoted, but optional enrollments could not be synchronized: ${assignmentsError.message}`,
        },
        { status: 500 },
      );
    }

    const validOptionalSubjectIds = new Set(
      (optionalAssignments ?? []).map((assignment) => assignment.subject_id),
    );
    const { data: optionalEnrollments, error: enrollmentsError } =
      await adminSupabase
        .from("student_subjects")
        .select("subject_id")
        .in("student_id", studentIds)
        .eq("enrollment_type", "optional");

    if (enrollmentsError) {
      return NextResponse.json(
        {
          error: `Student was promoted, but optional enrollments could not be synchronized: ${enrollmentsError.message}`,
        },
        { status: 500 },
      );
    }

    const staleSubjectIds = (optionalEnrollments ?? [])
      .filter((enrollment) => !validOptionalSubjectIds.has(enrollment.subject_id))
      .map((enrollment) => enrollment.subject_id);

    if (staleSubjectIds.length > 0) {
      const { error: cleanupError } = await adminSupabase
        .from("student_subjects")
        .delete()
        .in("student_id", studentIds)
        .eq("enrollment_type", "optional")
        .in("subject_id", staleSubjectIds);

      if (cleanupError) {
        return NextResponse.json(
          {
            error: `Student was promoted, but outdated optional enrollments could not be removed: ${cleanupError.message}`,
          },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
