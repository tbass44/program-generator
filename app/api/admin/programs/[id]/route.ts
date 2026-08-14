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
 * 改善プログラム更新APIで受け取るbody。
 * 画面から来る値は信用せず、API側で型と必須項目を確認する。
 */
type UpdateProgramBody = {
  memo?: unknown;
  summary?: unknown;
  shortTermProgram?: unknown;
  longTermProgram?: unknown;
  todayTask?: unknown;
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
 * LINE送信・コピー用に、入力内容を1つの文章へまとめる。
 * DB上は各カラムにも分けて保存するが、全文表示用として program_text も更新する。
 */
function buildProgramText(params: {
  memo: string | null;
  summary: string;
  shortTermProgram: string;
  longTermProgram: string | null;
  todayTask: string | null;
}) {
  return [
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

/**
 * PATCH /api/admin/programs/[id]
 *
 * 改善プログラム編集ページから、既存プログラムを更新するAPI。
 * MVPでは商品提案はまだ更新せず、プログラム本文だけを更新する。
 */

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    /**
     * 管理画面APIなので、画面側のログイン制御だけに頼らず、
     * API側でも必ずadmin権限を確認する。
     */
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

    /**
     * URLパラメータにIDが無い場合は、DBへ問い合わせず400を返す。
     */
    if (!programId) {
      return NextResponse.json(
        { error: 'program id is required' },
        { status: 400 }
      );
    }

    /**
     * UUID形式ではないIDをSupabaseへ投げると、
     * DB側エラーになって原因が分かりづらいため、API側で先に弾く。
     */
    if (!isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdateProgramBody;

    /**
     * 画面から送られた値をDB保存用に整える。
     * 空文字はnullに寄せ、必須項目は空なら400を返す。
     */
    const memo = normalizeOptionalText(body.memo);
    const summary = normalizeRequiredText(body.summary);
    const shortTermProgram = normalizeRequiredText(body.shortTermProgram);
    const longTermProgram = normalizeOptionalText(body.longTermProgram);
    const todayTask = normalizeOptionalText(body.todayTask);

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
     * 更新前に対象プログラムが存在するか確認する。
     * 存在しないIDに対してupdateを投げても分かりにくいため、先に404を返す。
     */
    const { data: existingProgram, error: existingProgramError } =
      await adminResult.supabaseAdmin
        .from('programs')
        .select('id')
        .eq('id', programId)
        .maybeSingle<{ id: string }>();

    if (existingProgramError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm program',
          detail: existingProgramError.message,
        },
        { status: 500 }
      );
    }

    if (!existingProgram) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    /**
     * 各カラムに分けて保存しつつ、
     * LINE送信・コピー用の全文としてprogram_textも更新する。
     */
    const programText = buildProgramText({
      memo,
      summary,
      shortTermProgram,
      longTermProgram,
      todayTask,
    });

    const { data: program, error: updateError } = await adminResult.supabaseAdmin
      .from('programs')
      .update({
        memo,
        summary,
        short_term_program: shortTermProgram,
        long_term_program: longTermProgram,
        today_task: todayTask,
        program_text: programText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', programId)
      .select(programSelect)
      .single<AdminProgramDetail>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update program',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ program });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/programs/[id]
 *
 * 改善プログラム詳細ページから、既存プログラムを削除するAPI。
 *
 * 注意：
 * - 削除は元に戻しにくい操作なので、必ず管理者確認・ID形式確認・存在確認を行う。
 * - service_role key を使うため、この処理は必ずサーバー側のAPI Route内だけで実行する。
 * - MVP段階では、programs本体のみ削除する。商品提案など別テーブル連携は後続対応とする。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    /**
     * 管理画面APIなので、画面側のログイン制御だけに頼らず、
     * API側でも必ずadmin権限を確認する。
     */
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

    /**
     * URLパラメータにIDが無い場合は、DBへ問い合わせず400を返す。
     */
    if (!programId) {
      return NextResponse.json(
        { error: 'program id is required' },
        { status: 400 }
      );
    }

    /**
     * UUID形式ではないIDをSupabaseへ投げると、
     * DB側エラーになって原因が分かりづらいため、API側で先に弾く。
     */
    if (!isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    /**
     * 削除前に対象プログラムが存在するか確認する。
     * 存在しないIDに対してdeleteを実行しても画面側で判断しづらいため、
     * 先に404を返して「対象なし」と分かるようにする。
     */
    const { data: existingProgram, error: existingProgramError } =
      await adminResult.supabaseAdmin
        .from('programs')
        .select('id')
        .eq('id', programId)
        .maybeSingle<{ id: string }>();

    if (existingProgramError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm program',
          detail: existingProgramError.message,
        },
        { status: 500 }
      );
    }

    if (!existingProgram) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    /**
     * 存在確認が取れたプログラムのみ削除する。
     * patient_id単位ではなくprogram id単位で削除し、他のプログラム履歴へ影響しないようにする。
     */
    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('programs')
      .delete()
      .eq('id', programId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete program',
          detail: deleteError.message,
        },
        { status: 500 }
      );
    }

    /**
     * 画面側で削除成功を判定しやすいように、deleted: true を返す。
     */
    return NextResponse.json({
      deleted: true,
      id: programId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
