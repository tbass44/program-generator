import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PlanRow = {
  id: string;
  patient_id: string;
  type: 'ticket' | 'subscription';
  name: string;
  total_count: number | null;
  remaining_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
};

type PatientRow = {
  id: string;
  name: string;
  kana: string | null;
};

type TicketUsageRow = {
  id: string;
  plan_id: string;
  used_at: string;
  note: string | null;
  created_at: string;
};

type CreateTicketUsageBody = {
  note?: unknown;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey);
}

async function requireAdmin() {
  const { userId } = auth();

  if (!userId) {
    return {
      ok: false as const,
      status: 401,
      error: 'Not signed in',
      supabaseAdmin: null,
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, clerk_user_id, role')
    .eq('clerk_user_id', userId)
    .maybeSingle<AdminProfile>();

  if (profileError) {
    return {
      ok: false as const,
      status: 500,
      error: 'Failed to fetch profile',
      detail: profileError.message,
      supabaseAdmin: null,
    };
  }

  if (!profile || profile.role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      error: 'Admin role required',
      supabaseAdmin: null,
    };
  }

  return {
    ok: true as const,
    supabaseAdmin,
    profile,
  };
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toLabelPlanType(type: PlanRow['type']) {
  return type === 'ticket' ? '回数券' : 'サブスク';
}

function toLabelPlanStatus(status: PlanRow['status']) {
  switch (status) {
    case 'active':
      return '有効';
    case 'expired':
      return '期限切れ';
    case 'cancelled':
      return '停止';
  }
}

function formatPlan(row: PlanRow, patient: PatientRow | null) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: patient?.name ?? '患者情報なし',
    patientKana: patient?.kana ?? '',
    type: toLabelPlanType(row.type),
    name: row.name,
    totalCount: row.total_count,
    remainingCount: row.remaining_count,
    startDate: row.start_date,
    endDate: row.end_date,
    status: toLabelPlanStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatUsage(row: TicketUsageRow) {
  return {
    id: row.id,
    planId: row.plan_id,
    usedAt: row.used_at,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

const planSelect = `
  id,
  patient_id,
  type,
  name,
  total_count,
  remaining_count,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
`;

async function fetchPlan(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  planId: string
) {
  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select(planSelect)
    .eq('id', planId)
    .maybeSingle<PlanRow>();

  return { plan, planError };
}

async function fetchPatient(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string
) {
  const { data: patient, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('id, name, kana')
    .eq('id', patientId)
    .maybeSingle<PatientRow>();

  return { patient, patientError };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await requireAdmin();

    if (!adminResult.ok) {
      return NextResponse.json(
        {
          error: adminResult.error,
          detail: 'detail' in adminResult ? adminResult.detail : undefined,
        },
        { status: adminResult.status }
      );
    }

    const planId = params.id;

    if (!planId || !isUuid(planId)) {
      return NextResponse.json(
        {
          error: 'Invalid plan id format',
          detail: 'plan id must be UUID',
        },
        { status: 400 }
      );
    }

    const { plan, planError } = await fetchPlan(adminResult.supabaseAdmin, planId);

    if (planError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch plan',
          detail: planError.message,
        },
        { status: 500 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const { data: usages, error: usagesError } = await adminResult.supabaseAdmin
      .from('ticket_usages')
      .select('id, plan_id, used_at, note, created_at')
      .eq('plan_id', planId)
      .order('used_at', { ascending: false })
      .returns<TicketUsageRow[]>();

    if (usagesError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch ticket usages',
          detail: usagesError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      usages: (usages ?? []).map(formatUsage),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await requireAdmin();

    if (!adminResult.ok) {
      return NextResponse.json(
        {
          error: adminResult.error,
          detail: 'detail' in adminResult ? adminResult.detail : undefined,
        },
        { status: adminResult.status }
      );
    }

    const planId = params.id;

    if (!planId || !isUuid(planId)) {
      return NextResponse.json(
        {
          error: 'Invalid plan id format',
          detail: 'plan id must be UUID',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as CreateTicketUsageBody;
    const note = normalizeOptionalText(body.note);

    const { plan, planError } = await fetchPlan(adminResult.supabaseAdmin, planId);

    if (planError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch plan',
          detail: planError.message,
        },
        { status: 500 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    if (plan.type !== 'ticket') {
      return NextResponse.json(
        { error: 'Only ticket plans can be used' },
        { status: 400 }
      );
    }

    const currentRemainingCount = plan.remaining_count ?? 0;

    if (currentRemainingCount <= 0) {
      return NextResponse.json(
        { error: 'No remaining tickets' },
        { status: 400 }
      );
    }

    const nextRemainingCount = currentRemainingCount - 1;
    const nextStatus = nextRemainingCount === 0 ? 'expired' : plan.status;

    const { data: usage, error: usageError } = await adminResult.supabaseAdmin
      .from('ticket_usages')
      .insert({
        plan_id: plan.id,
        note,
      })
      .select('id, plan_id, used_at, note, created_at')
      .single<TicketUsageRow>();

    if (usageError) {
      return NextResponse.json(
        {
          error: 'Failed to create ticket usage',
          detail: usageError.message,
        },
        { status: 500 }
      );
    }

    const { data: updatedPlan, error: updateError } = await adminResult.supabaseAdmin
      .from('plans')
      .update({
        remaining_count: nextRemainingCount,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)
      .select(planSelect)
      .single<PlanRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update remaining count',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    const { patient } = await fetchPatient(adminResult.supabaseAdmin, updatedPlan.patient_id);

    return NextResponse.json(
      {
        usage: formatUsage(usage),
        plan: formatPlan(updatedPlan, patient ?? null),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
