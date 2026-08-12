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
 * 患者詳細で返す患者情報。
 */
type AdminPatientDetail = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
  line_link_code: string | null;
  line_link_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 患者更新APIで受け取るbody。
 * unknownにしておき、API側で型と空文字を確認する。
 */
type UpdatePatientBody = {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
  memo?: unknown;
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
 * 患者詳細APIで共通利用するselect句。
 */
const patientDetailSelect = `
  id,
  name,
  kana,
  phone,
  memo,
  line_user_id,
  line_display_name,
  line_picture_url,
  line_linked_at,
  line_link_code,
  line_link_code_expires_at,
  created_at,
  updated_at
`;

/**
 * GET /api/admin/patients/[id]
 *
 * 管理画面の患者詳細で使うAPI。
 * MVPではまず patients の基本情報だけを返す。
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

    if (!patientId) {
      return NextResponse.json(
        { error: 'patient id is required' },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select(patientDetailSelect)
      .eq('id', patientId)
      .maybeSingle<AdminPatientDetail>();

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

    return NextResponse.json({ patient });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/patients/[id]
 *
 * 管理画面の患者詳細から基本情報を更新するAPI。
 *
 * 更新対象：
 * - name：必須
 * - kana：任意
 * - phone：任意
 * - memo：任意
 */
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

    const patientId = params.id;

    if (!patientId) {
      return NextResponse.json(
        { error: 'patient id is required' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdatePatientBody;

    /**
     * 氏名は患者管理の主キーではないが、画面表示上の必須項目として扱う。
     */
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const kana = normalizeOptionalText(body.kana);
    const phone = normalizeOptionalText(body.phone);
    const memo = normalizeOptionalText(body.memo);

    const { data: patient, error: updateError } = await adminResult.supabaseAdmin
      .from('patients')
      .update({
        name,
        kana,
        phone,
        memo,
      })
      .eq('id', patientId)
      .select(patientDetailSelect)
      .single<AdminPatientDetail>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update patient',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/patients/[id]
 *
 * 管理画面から患者を削除するAPI。
 *
 * 注意：
 * patients に紐づく programs / visits / plans などは schema.sql 側で
 * on delete cascade を設定しているため、患者削除時に関連データも削除される。
 * そのため、画面側では必ず確認してから実行する。
 */
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

    const patientId = params.id;

    if (!patientId) {
      return NextResponse.json(
        { error: 'patient id is required' },
        { status: 400 }
      );
    }

    /**
     * 削除前に存在確認する。
     * 存在しないIDに対しても成功扱いにしないため。
     */
    const { data: existingPatient, error: fetchError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id, name')
      .eq('id', patientId)
      .maybeSingle<{ id: string; name: string }>();

    if (fetchError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient before delete',
          detail: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', patientId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete patient',
          detail: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deleted: true,
      patient: existingPatient,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
