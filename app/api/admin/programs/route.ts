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
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * 改善プログラム作成APIで受け取るbody。
 * 画面から来る値は信用せず、API側で必須項目を確認する。
 */
type CreateProgramBody = {
  patientId?: unknown;
  status?: unknown;
  memo?: unknown;
  summary?: unknown;
  shortTermProgram?: unknown;
  longTermProgram?: unknown;
  todayTask?: unknown;
};

/**
 * programs テーブルへ保存した後に返す最小型。
 */
type AdminProgram = {
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
 * 改善プログラム一覧で返す型。
 * Supabaseのリレーション取得で patients を一緒に返す。
 */
type AdminProgramListItem = AdminProgram & {
  patients: {
    id: string;
    name: string;
    kana: string | null;
  } | null;
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
 * 任意テキスト項目をDB保存用に整える。
 * 空文字は null として保存する。
 */
function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * 必須テキスト項目を取り出す。
 */
function normalizeRequiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * programsテーブル共通のselect句。
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
 * LINE送信・コピー用に、入力内容を1つの文章へまとめる。
 * DB上は各カラムにも分けて保存するが、全文表示用として program_text も持たせる。
 */
function buildProgramText(params: {
  status: string | null;
  memo: string | null;
  summary: string;
  shortTermProgram: string;
  longTermProgram: string | null;
  todayTask: string | null;
}) {
  return [
    params.status ? ['【状態】', params.status].join('\n') : '',
    params.memo ? ['【メモ】', params.memo].join('\n') : '',
    ['【状態まとめ】', params.summary].join('\n'),
    ['【短期プログラム（3カ月）】', params.shortTermProgram].join('\n'),
    params.longTermProgram ? ['【長期プログラム】', params.longTermProgram].join('\n') : '',
    params.todayTask ? ['【今日やること】', params.todayTask].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * GET /api/admin/programs
 *
 * 管理画面の改善プログラム一覧で使うAPI。
 * programsを新しい順に取得し、患者名も一緒に返す。
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

    const { data: programs, error: programsError } = await adminResult.supabaseAdmin
      .from('programs')
      .select(
        `
        ${programSelect},
        patients (
          id,
          name,
          kana
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<AdminProgramListItem[]>();

    if (programsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch programs',
          detail: programsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ programs: programs ?? [] });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/programs
 *
 * 管理画面から手動入力した改善プログラムを作成するAPI。
 * MVPではAI生成ではなく、まず手動保存を確実に通す。
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

    const body = (await request.json()) as CreateProgramBody;

    const patientId = normalizeRequiredText(body.patientId);
    const status = normalizeOptionalText(body.status);
    const memo = normalizeOptionalText(body.memo);
    const summary = normalizeRequiredText(body.summary);
    const shortTermProgram = normalizeRequiredText(body.shortTermProgram);
    const longTermProgram = normalizeOptionalText(body.longTermProgram);
    const todayTask = normalizeOptionalText(body.todayTask);

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'summary is required' },
        { status: 400 }
      );
    }

    if (!shortTermProgram) {
      return NextResponse.json(
        { error: 'shortTermProgram is required' },
        { status: 400 }
      );
    }

    /**
     * 存在しない患者IDへの登録を避けるため、先にpatientsを確認する。
     */
    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .maybeSingle<{ id: string }>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm patient',
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

    const programText = buildProgramText({
      status,
      memo,
      summary,
      shortTermProgram,
      longTermProgram,
      todayTask,
    });

    /**
     * statusカラムはprogramsテーブルにまだ無いため、状態はmemoの先頭へまとめて保存する。
     * 後続で状態管理が必要になったら、programs.statusカラム追加を検討する。
     */
    const memoWithStatus = [
      status ? `状態: ${status}` : '',
      memo,
    ]
      .filter(Boolean)
      .join('\n\n') || null;

    const { data: program, error: insertError } = await adminResult.supabaseAdmin
      .from('programs')
      .insert({
        patient_id: patientId,
        create_mode: 'manual',
        memo: memoWithStatus,
        summary,
        short_term_program: shortTermProgram,
        long_term_program: longTermProgram,
        today_task: todayTask,
        program_text: programText,
      })
      .select(programSelect)
      .single<AdminProgram>();

    if (insertError) {
      return NextResponse.json(
        {
          error: 'Failed to create program',
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
