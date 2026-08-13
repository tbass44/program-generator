import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 必須環境変数を取得する。
 * API実行時に読むことで、build時の環境変数未設定エラーを避ける。
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
 * 不正なIDをSupabaseへ投げるとDB側で500相当のエラーになるため、API側で先に弾く。
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * 改善プログラム詳細APIで返すprogramsの型。
 */
type AdminProgramDetail = {
  id: string;
  patient_id: string;
  create_mode: 'manual' | 'ai';
  memo: string | null;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  today_task: string | null;
  program_text: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 改善プログラムに紐づけて返す患者情報。
 */
type AdminProgramPatient = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
};

/**
 * サーバー側で使うSupabase管理クライアントを作成する。
 * service_role key はブラウザに出さず、API Route内だけで使う。
 */
function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * ログイン中ユーザーがadminか確認する。
 * 管理画面APIでは、画面側とは別にサーバー側でも必ず権限確認する。
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
 * programsテーブル詳細用のselect句。
 */
const programSelect = `
  id,
  patient_id,
  create_mode,
  memo,
  summary,
  short_term_program,
  long_term_program,
  today_task,
  program_text,
  created_at,
  updated_at
`;

/**
 * GET /api/admin/programs/[id]
 *
 * 改善プログラム詳細ページで使うAPI。
 * programsを1件取得し、患者情報は別クエリで安全に紐づける。
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

    const programId = params.id;

    if (!programId) {
      return NextResponse.json(
        { error: 'program id is required' },
        { status: 400 }
      );
    }

    if (!isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    const { data: program, error: programError } = await adminResult.supabaseAdmin
      .from('programs')
      .select(programSelect)
      .eq('id', programId)
      .maybeSingle<AdminProgramDetail>();

    if (programError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch program',
          detail: programError.message,
        },
        { status: 500 }
      );
    }

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    /**
     * JOINではなく別クエリにしておく。
     * 外部キー名やSupabaseのリレーション推論に依存させないため。
     */
    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id, name, kana, phone')
      .eq('id', program.patient_id)
      .maybeSingle<AdminProgramPatient>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch program patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      program,
      patient: patient ?? null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
