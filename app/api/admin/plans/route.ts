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
 * patientsテーブルから取得する患者の最小情報。
 */
type PatientRow = {
  id: string;
  name: string;
  kana: string | null;
};

/**
 * プラン作成APIで受け取るbody。
 */
type CreatePlanBody = {
  patientId?: unknown;
  type?: unknown;
  name?: unknown;
  totalCount?: unknown;
  remainingCount?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
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

/**
 * 必須テキストを取り出す。
 */
function normalizeRequiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 任意の日付文字列をDB保存用に整える。
 */
function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * 0以上の整数またはnullに整える。
 */
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

/**
 * UI表示用プラン種別をDB保存値へ変換する。
 */
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

/**
 * UI表示用ステータスをDB保存値へ変換する。
 */
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

/**
 * plans行を管理画面表示用へ変換する。
 */
function formatPlan(row: PlanRow, patientMap: Map<string, PatientRow>) {
  const patient = patientMap.get(row.patient_id);

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

/**
 * GET /api/admin/plans
 *
 * 管理画面のプラン一覧で使うAPI。
 */
export async function GET() {
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

    const { data: plans, error: plansError } = await adminResult.supabaseAdmin
      .from('plans')
      .select(planSelect)
      .order('created_at', { ascending: false })
      .returns<PlanRow[]>();

    if (plansError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch plans',
          detail: plansError.message,
        },
        { status: 500 }
      );
    }

    const patientIds = Array.from(new Set((plans ?? []).map((plan) => plan.patient_id)));
    let patientMap = new Map<string, PatientRow>();

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await adminResult.supabaseAdmin
        .from('patients')
        .select('id, name, kana')
        .in('id', patientIds)
        .returns<PatientRow[]>();

      if (patientsError) {
        return NextResponse.json(
          {
            error: 'Failed to fetch plan patients',
            detail: patientsError.message,
          },
          { status: 500 }
        );
      }

      patientMap = new Map((patients ?? []).map((patient) => [patient.id, patient]));
    }

    return NextResponse.json({
      plans: (plans ?? []).map((plan) => formatPlan(plan, patientMap)),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans
 *
 * 新規プランを作成するAPI。
 */
export async function POST(request: Request) {
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

    const body = (await request.json()) as CreatePlanBody;

    const patientId = typeof body.patientId === 'string' ? body.patientId : '';
    const type = toDbPlanType(body.type);
    const status = toDbPlanStatus(body.status ?? '有効');
    const name = normalizeRequiredText(body.name);

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
        },
        { status: 400 }
      );
    }

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

    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id, name, kana')
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

    const totalCount = type === 'ticket' ? normalizeNullableNonNegativeInteger(body.totalCount) : null;
    const remainingCount = type === 'ticket'
      ? normalizeNullableNonNegativeInteger(body.remainingCount ?? body.totalCount)
      : null;

    const { data: plan, error: createError } = await adminResult.supabaseAdmin
      .from('plans')
      .insert({
        patient_id: patient.id,
        type,
        name,
        total_count: totalCount,
        remaining_count: remainingCount,
        start_date: normalizeOptionalDate(body.startDate),
        end_date: normalizeOptionalDate(body.endDate),
        status,
      })
      .select(planSelect)
      .single<PlanRow>();

    if (createError) {
      return NextResponse.json(
        {
          error: 'Failed to create plan',
          detail: createError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        plan: formatPlan(plan, new Map([[patient.id, patient]])),
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
