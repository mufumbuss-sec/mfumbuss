import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortStudentsForDisplay } from "@/lib/student-sort";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanSearch(value: string | null) {
  return (value ?? "").replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    positiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
  );
  const search = cleanSearch(searchParams.get("search"));
  const classId = searchParams.get("classId")?.trim() ?? "";
  const form = searchParams.get("form")?.trim() ?? "";
  const includeCounts = searchParams.get("includeCounts") === "1";
  const admin = createAdminClient();
  const { data: classRows, error: classesError } = await admin
    .from("classes")
    .select("id, form, stream")
    .order("form")
    .order("stream");
  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const classes = classRows ?? [];
  const formClassIds =
    form && form !== "All"
      ? classes.filter((item) => item.form === form).map((item) => item.id)
      : [];

  if (form && form !== "All" && formClassIds.length === 0) {
    return NextResponse.json({
      students: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      overallTotal: 0,
      classCounts: includeCounts ? {} : undefined,
      formCounts: includeCounts ? {} : undefined,
    });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let studentsQuery = admin
    .from("students")
    .select(
      "id, class_id, first_name, middle_name, last_name, full_name, sex, created_at",
      { count: "exact" },
    );

  if (classId) {
    studentsQuery = studentsQuery.eq("class_id", classId);
  } else if (formClassIds.length > 0) {
    studentsQuery = studentsQuery.in("class_id", formClassIds);
  }
  if (search) {
    studentsQuery = studentsQuery.ilike("full_name", `%${search}%`);
  }

  studentsQuery = studentsQuery
    .order("sex")
    .order("full_name")
    .order("id");
  const { data: students, count, error: studentsError } = await studentsQuery.range(
    from,
    to,
  );
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  let overallTotal = count ?? 0;
  let classCounts: Record<string, number> | undefined;
  let formCounts: Record<string, number> | undefined;

  if (includeCounts) {
    const [overallResult, ...classCountResults] = await Promise.all([
      admin.from("students").select("id", { count: "exact", head: true }),
      ...classes.map((schoolClass) =>
        admin
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("class_id", schoolClass.id),
      ),
    ]);

    if (overallResult.error) {
      return NextResponse.json(
        { error: overallResult.error.message },
        { status: 500 },
      );
    }
    overallTotal = overallResult.count ?? 0;
    classCounts = {};
    formCounts = {};
    classCountResults.forEach((result, index) => {
      if (result.error) return;
      const schoolClass = classes[index];
      const classTotal = result.count ?? 0;
      classCounts![schoolClass.id] = classTotal;
      formCounts![schoolClass.form] =
        (formCounts![schoolClass.form] ?? 0) + classTotal;
    });
  }

  const total = count ?? 0;
  return NextResponse.json({
    students: sortStudentsForDisplay(students ?? []),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    overallTotal,
    classCounts,
    formCounts,
  });
}
