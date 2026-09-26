import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * plans.type のDB保存値。
 */
type PlanTypeDb = 'ticket' | 'subscription';

/**
 * plans.status のDB保存値。
 */
type PlanStatusDb = 'active' | 'expired' | 'cancelled';

/**
 * 管理画面で表示するプラン種別。
 */
type PlanTypeLabel = '回数券' | 'サブスク';

/**
 * 管理画面で表示するプラン状態。
 */
type PlanStatusLabel = '有効' | '期限切れ' | '停止';

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * patientsテーブルの存在確認に使う型。
 */
type PatientRow = {
  id: string;
  name: string;
};

/**
 * plansテーブルから取得する行。
 */
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

/**
 * 必須環境変数を取得する。
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

/**
 * UUID形式かどうかを確認する。
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Supabase管理クライアントを作成する。
 */
function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * 管理者権限を確認する。
 */
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

/**
 * plans行を患者詳細画面用に整える。
 */
function formatPlan(row: PlanRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
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

/**
 * GET /api/admin/patients/[id]/plans
 *
 * 患者詳細画面で使う、患者ごとのプラン一覧取得API。
 * 現在のプラン表示では active を優先して使う。
 */
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

    const patientId = params.id;

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
        },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id, name')
      .eq('id', patientId)
      .maybeSingle<PatientRow>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const { data: plans, error: plansError } = await adminResult.supabaseAdmin
      .from('plans')
      .select(planSelect)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .returns<PlanRow[]>();

    if (plansError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient plans',
          detail: plansError.message,
        },
        { status: 500 }
      );
    }

    const formattedPlans = (plans ?? []).map(formatPlan);
    const currentPlan =
      formattedPlans.find((plan) => plan.status === '有効') ?? formattedPlans[0] ?? null;

    return NextResponse.json({
      plans: formattedPlans,
      currentPlan,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
