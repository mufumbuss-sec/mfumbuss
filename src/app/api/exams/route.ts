import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Active examinations should always appear above drafts and processed ones.
const EXAM_STATUS_ORDER: Record<string, number> = {
  Active: 0,
  Draft: 1,
  Processed: 2,
};

function examStatusRank(status: string | null | undefined) {
  if (!status) return 3;
  return EXAM_STATUS_ORDER[status] ?? 3;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 20),
  );
  const search = (searchParams.get("search") ?? "")
    .replace(/[,()%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const form = searchParams.get("form")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const requestedYear = (searchParams.get("year") ?? "").trim();
  const from = (page - 1) * pageSize;

  const { data: activePeriod, error: periodError } = await admin
    .from("academic_period_settings")
    .select("academic_year")
    .eq("id", 1)
    .maybeSingle();
  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }
  const activeYear = activePeriod?.academic_year ?? "";
  const yearFilter =
    requestedYear === "all" ? "" : requestedYear || activeYear;

  const buildQuery = (head = false) => {
    let query = head
      ? admin.from('exams').select('id', { count: "exact", head: true })
      : admin.from('exams').select('*', { count: "exact" });
    if (profile.role === 'teacher') {
      query = query.eq('status', 'Active');
    } else if (status) {
      query = query.eq('status', status);
    }
    if (yearFilter) query = query.eq("academic_year", yearFilter);
    if (form) query = query.eq('class_form', form);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,class_form.ilike.%${search}%,academic_year.ilike.%${search}%`,
      );
    }
    return query;
  };

  const buildOverallQuery = () => {
    let query = admin
      .from("exams")
      .select("id", { count: "exact", head: true });
    if (profile.role === "teacher") {
      query = query.eq("status", "Active");
    }
    if (yearFilter) query = query.eq("academic_year", yearFilter);
    return query;
  };

  const buildYearsQuery = () => {
    let query = admin
      .from("exams")
      .select("academic_year")
      .order("academic_year", { ascending: false });
    if (profile.role === "teacher") {
      query = query.eq("status", "Active");
    }
    return query;
  };

  const [
    { data: examRows, count, error },
    { count: overallTotal },
    { data: yearRows, error: yearsError },
  ] = await Promise.all([
    buildQuery()
      .order('created_at', { ascending: false })
      .order('id'),
    buildOverallQuery(),
    buildYearsQuery(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (yearsError) {
    return NextResponse.json({ error: yearsError.message }, { status: 500 });
  }
  // `status` is a Postgres enum declared as (Draft, Active, Processed), so a
  // plain SQL order would put drafts first. Rank explicitly to keep active
  // examinations on top, then newest first within each status.
  const exams = [...(examRows ?? [])]
    .sort(
      (a, b) =>
        examStatusRank(a.status) - examStatusRank(b.status) ||
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(from, from + pageSize);

  const total = count ?? 0;
  const availableYears = [
    ...new Set(
      [
        ...(yearRows ?? []).map((row) => row.academic_year),
        activeYear,
      ].filter((year): year is string => Boolean(year)),
    ),
  ].sort((a, b) => b.localeCompare(a));

  const statusCounts: Record<string, number> = {
    Draft: 0,
    Active: 0,
    Processed: 0,
  };
  const statusesToCount =
    profile.role === "teacher" ? ["Active"] : Object.keys(statusCounts);
  await Promise.all(
    statusesToCount.map(async (examStatus) => {
      let query = admin
        .from("exams")
        .select("id", { count: "exact", head: true })
        .eq("status", examStatus);
      if (yearFilter) query = query.eq("academic_year", yearFilter);
      if (form) query = query.eq("class_form", form);
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,class_form.ilike.%${search}%,academic_year.ilike.%${search}%`,
        );
      }
      const { count: statusTotal, error: statusError } = await query;
      statusCounts[examStatus] = statusError ? 0 : statusTotal ?? 0;
    }),
  );

  return NextResponse.json({
    exams: exams || [],
    total,
    overallTotal: overallTotal ?? 0,
    statusCounts,
    availableYears,
    activeYear,
    year: yearFilter || "all",
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'academic' && profile?.role !== 'headmaster') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    name?: unknown;
    class_form?: unknown;
    term?: unknown;
    academic_year?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    subjects?: unknown;
    has_practical?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const classForm = typeof body.class_form === "string" ? body.class_form : "";
  const term = typeof body.term === "string" ? body.term : "";
  const academicYear =
    typeof body.academic_year === "string" ? body.academic_year.trim() : "";
  const startDate =
    typeof body.start_date === "string" ? body.start_date : "";
  const endDate = typeof body.end_date === "string" ? body.end_date : "";
  const subjects = Array.isArray(body.subjects) ? body.subjects : [];
  if (typeof body.has_practical !== "boolean") {
    return NextResponse.json(
      { error: "Specify whether the examination includes practical marks." },
      { status: 400 },
    );
  }
  const hasPractical = body.has_practical;

  if (!name || !academicYear || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["Form I", "Form II", "Form III", "Form IV"].includes(classForm)) {
    return NextResponse.json({ error: "Invalid class form" }, { status: 400 });
  }
  if (!["Term I", "Term II"].includes(term)) {
    return NextResponse.json({ error: "Invalid examination term" }, { status: 400 });
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`)) ||
    endDate < startDate
  ) {
    return NextResponse.json({ error: "Invalid examination date range" }, { status: 400 });
  }
  if (
    subjects.length === 0 ||
    subjects.length > 100 ||
    !subjects.every((subjectId) => typeof subjectId === "string" && subjectId.length > 0)
  ) {
    return NextResponse.json(
      { error: "Select between 1 and 100 valid examination subjects" },
      { status: 400 },
    );
  }
  if (subjects.length !== new Set(subjects).size) {
    return NextResponse.json({ error: "Duplicate subjects are not allowed" }, { status: 400 });
  }

  const { data: activePeriod, error: periodError } = await supabase
    .from("academic_period_settings")
    .select("academic_year, term")
    .eq("id", 1)
    .maybeSingle();
  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }
  if (!activePeriod) {
    return NextResponse.json(
      { error: "Set the active academic year and term before creating an examination." },
      { status: 409 },
    );
  }
  if (
    academicYear !== activePeriod.academic_year ||
    term !== activePeriod.term
  ) {
    return NextResponse.json(
      {
        error:
          "The active academic period changed. Refresh the page and create the examination again.",
      },
      { status: 409 },
    );
  }

  const { data: exam, error } = await supabase
    .from('exams')
    .insert({
      name,
      class_form: classForm,
      term,
      academic_year: academicYear,
      start_date: startDate,
      end_date: endDate,
      has_practical: hasPractical,
      status: 'Draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examSubjects = subjects.map((subjectId) => ({
    exam_id: exam.id,
    subject_id: subjectId,
  }));
  const { error: subjectsError } = await supabase
    .from("exam_subjects")
    .insert(examSubjects);

  if (subjectsError) {
    const { error: rollbackError } = await supabase
      .from("exams")
      .delete()
      .eq("id", exam.id);
    if (rollbackError) {
      return NextResponse.json(
        {
          error: `Exam was created but subjects could not be added, and cleanup failed: ${rollbackError.message}`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  return NextResponse.json({ exam });
}
