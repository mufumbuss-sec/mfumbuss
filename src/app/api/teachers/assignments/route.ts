import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
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

  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const teacherIdsParam = searchParams.get("teacherIds");
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const teacherIds = teacherIdsParam
    ? [
        ...new Set(
          teacherIdsParam
            .split(",")
            .map((value) => value.trim())
            .filter((value) => uuidPattern.test(value)),
        ),
      ].slice(0, 100)
    : null;

  if (teacherIdsParam !== null && (!teacherIds || teacherIds.length === 0)) {
    const { count: overallCount } = await adminSupabase
      .from("teaching_assignments")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      assignments: [],
      total: 0,
      overallTotal: overallCount ?? 0,
    });
  }

  let assignmentsQuery = adminSupabase
    .from("teaching_assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (teacherIds) {
    assignmentsQuery = assignmentsQuery.in("teacher_id", teacherIds);
  }

  const [{ data: assignments, error }, { count: overallCount }] = await Promise.all([
    assignmentsQuery,
    adminSupabase
      .from("teaching_assignments")
      .select("id", { count: "exact", head: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assignments: assignments ?? [],
    total: assignments?.length ?? 0,
    overallTotal: overallCount ?? assignments?.length ?? 0,
  });
}

export async function POST(request: Request) {
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
    teacher_id?: unknown;
    assignments?: unknown;
    class_name?: unknown;
    subject_name?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const teacherId = typeof body.teacher_id === "string" ? body.teacher_id : "";
  const rawAssignments = Array.isArray(body.assignments)
    ? body.assignments
    : [{ class_name: body.class_name, subject_name: body.subject_name }];
  const validForms = new Set(["Form I", "Form II", "Form III", "Form IV"]);
  if (!teacherId || rawAssignments.length === 0 || rawAssignments.length > 100) {
    return NextResponse.json(
      { error: "Select a teacher and between 1 and 100 class-subject assignments." },
      { status: 400 },
    );
  }
  const requestedAssignments: { class_name: string; subject_name: string }[] = [];
  for (const item of rawAssignments) {
    if (
      !item ||
      typeof item !== "object" ||
      !("class_name" in item) ||
      !("subject_name" in item) ||
      typeof item.class_name !== "string" ||
      typeof item.subject_name !== "string" ||
      !validForms.has(item.class_name) ||
      !item.subject_name.trim()
    ) {
      return NextResponse.json(
        { error: "Each assignment must include a valid form and subject." },
        { status: 400 },
      );
    }
    requestedAssignments.push({
      class_name: item.class_name,
      subject_name: item.subject_name.trim(),
    });
  }
  const requestedKeys = requestedAssignments.map(
    (assignment) => `${assignment.class_name}:${assignment.subject_name.toLowerCase()}`,
  );
  if (new Set(requestedKeys).size !== requestedKeys.length) {
    return NextResponse.json(
      { error: "Duplicate class and subject selections are not allowed." },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: teacher, error: teacherError } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();

  if (teacherError) {
    return NextResponse.json({ error: teacherError.message }, { status: 500 });
  }
  if (!teacher) {
    return NextResponse.json({ error: "Select a valid teacher." }, { status: 400 });
  }

  const forms = [...new Set(requestedAssignments.map((assignment) => assignment.class_name))];
  const { data: classSubjects, error: classSubjectsError } = await adminSupabase
    .from("class_subject_assignments")
    .select("form, subject_id")
    .in("form", forms);

  if (classSubjectsError) {
    return NextResponse.json({ error: classSubjectsError.message }, { status: 500 });
  }

  const subjectIds = [...new Set((classSubjects || []).map((assignment) => assignment.subject_id))];
  const { data: subjects, error: subjectError } = await adminSupabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (subjectError) {
    return NextResponse.json({ error: subjectError.message }, { status: 500 });
  }
  const subjectNameById = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));
  const eligibleKeys = new Set(
    (classSubjects ?? []).flatMap((assignment) => {
      const subjectName = subjectNameById.get(assignment.subject_id);
      return subjectName
        ? [`${assignment.form}:${subjectName.toLowerCase()}`]
        : [];
    }),
  );
  const invalidAssignment = requestedAssignments.find(
    (assignment) =>
      !eligibleKeys.has(`${assignment.class_name}:${assignment.subject_name.toLowerCase()}`),
  );
  if (invalidAssignment) {
    return NextResponse.json(
      {
        error: `${invalidAssignment.subject_name} is not assigned to ${invalidAssignment.class_name}.`,
      },
      { status: 400 },
    );
  }

  const { data: existingAssignments, error: existingError } = await adminSupabase
    .from("teaching_assignments")
    .select("class_name, subject_name")
    .eq("teacher_id", teacherId);
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  const existingKeys = new Set(
    (existingAssignments ?? []).map(
      (assignment) =>
        `${assignment.class_name}:${assignment.subject_name.toLowerCase()}`,
    ),
  );
  const newAssignments = requestedAssignments
    .filter(
      (assignment) =>
        !existingKeys.has(
          `${assignment.class_name}:${assignment.subject_name.toLowerCase()}`,
        ),
    )
    .map((assignment) => ({
      teacher_id: teacherId,
      class_name: assignment.class_name,
      subject_name: assignment.subject_name,
    }));
  if (newAssignments.length === 0) {
    return NextResponse.json(
      { error: "All selected class and subject assignments already exist." },
      { status: 409 },
    );
  }

  const { error } = await adminSupabase
    .from("teaching_assignments")
    .insert(newAssignments);

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "This teacher already has this subject assigned to this class."
            : error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true, created: newAssignments.length });
}
