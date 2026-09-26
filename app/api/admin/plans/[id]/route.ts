import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type PlanTypeDb = 'ticket' | 'subscription';
type PlanStatusDb = 'active' | 'expired' | 'cancelled';
type PlanTypeLabel = '回数券' | 'サブスク';
type PlanStatusLabel = '有効' | '期限切れ' | '停止';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PlanRow = {
  id: string;
  patient_id: string;
  type: PlanTypeDb;
  name: string;
  total_count: number | null;
  remaining_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: PlanStatusDb;
  created_at: string;
  updated_at: string;
};

type PatientRow = {
  id: string;
  name: string;
  kana: string | null;
};

type UpdatePlanBody = {
  type?: unknown;
  name?: unknown;
  totalCount?: unknown;
  remainingCount?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
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

function normalizeRequiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(0, Math.floor(numericValue));
}

function toDbPlanType(type: unknown): PlanTypeDb | null {
  switch (type) {
    case '回数券':
    case 'ticket':
      return 'ticket';
    case 'サブスク':
    case 'subscription':
      return 'subscription';
    default:
      return null;
  }
}

function toDbPlanStatus(status: unknown): PlanStatusDb | null {
  switch (status) {
    case '有効':
    case 'active':
      return 'active';
    case '期限切れ':
    case 'expired':
      return 'expired';
    case '停止':
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

function toLabelPlanType(type: PlanTypeDb): PlanTypeLabel {
  return type === 'ticket' ? '回数券' : 'サブスク';
}

function toLabelPlanStatus(status: PlanStatusDb): PlanStatusLabel {
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

async function fetchPlanWithPatient(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  planId: string
) {
  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select(planSelect)
    .eq('id', planId)
    .maybeSingle<PlanRow>();

  if (planError || !plan) {
    return { plan, patient: null, error: planError };
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('id, name, kana')
    .eq('id', plan.patient_id)
    .maybeSingle<PatientRow>();

  return { plan, patient: patient ?? null, error: patientError };
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

    const { plan, patient, error } = await fetchPlanWithPatient(adminResult.supabaseAdmin, planId);

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch plan',
          detail: error.message,
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

    return NextResponse.json({
      plan: formatPlan(plan, patient),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = (await request.json()) as UpdatePlanBody;
    const type = toDbPlanType(body.type);
    const status = toDbPlanStatus(body.status);
    const name = normalizeRequiredText(body.name);

    if (!type) {
      return NextResponse.json(
        { error: 'type is invalid' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is invalid' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const { plan: existingPlan, patient, error: existingError } =
      await fetchPlanWithPatient(adminResult.supabaseAdmin, planId);

    if (existingError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm plan',
          detail: existingError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const totalCount = type === 'ticket' ? normalizeNullableNonNegativeInteger(body.totalCount) : null;
    const remainingCount = type === 'ticket'
      ? normalizeNullableNonNegativeInteger(body.remainingCount ?? body.totalCount)
      : null;

    const { data: plan, error: updateError } = await adminResult.supabaseAdmin
      .from('plans')
      .update({
        type,
        name,
        total_count: totalCount,
        remaining_count: remainingCount,
        start_date: normalizeOptionalDate(body.startDate),
        end_date: normalizeOptionalDate(body.endDate),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select(planSelect)
      .single<PlanRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update plan',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      plan: formatPlan(plan, patient),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { plan: existingPlan, error: existingError } =
      await fetchPlanWithPatient(adminResult.supabaseAdmin, planId);

    if (existingError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm plan',
          detail: existingError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('plans')
      .delete()
      .eq('id', planId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete plan',
          detail: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deleted: true,
      id: planId,
      patientId: existingPlan.patient_id,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
