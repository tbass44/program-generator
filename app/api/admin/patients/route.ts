import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 必須の環境変数を取得する。
 * undefined の可能性をここで弾き、以降は string として扱う。
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
 * 患者一覧・登録完了時に返す患者情報。
 */
type AdminPatient = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_linked_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 新規患者登録APIで受け取るbody。
 */
type CreatePatientBody = {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
  memo?: unknown;
};

/**
 * サーバー側で使うSupabaseクライアントを作成する。
 * service_role key はAPI Route内だけで使い、ブラウザには出さない。
 */
function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * ログイン中ユーザーが admin か確認する。
 * 画面側だけでなく、API側でも権限確認する。
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
 * 空文字をDB保存用の null に変換する。
 * 任意項目で空文字がそのまま溜まらないようにするため。
 */
function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * GET /api/admin/patients
 *
 * 管理画面の患者一覧で使うAPI。
 * q がある場合は、氏名・カナ・電話番号で部分一致検索する。
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';

    /**
     * 一覧表示に必要な患者基本情報を取得する。
     */
    let patientQuery = adminResult.supabaseAdmin
      .from('patients')
      .select(
        `
        id,
        name,
        kana,
        phone,
        memo,
        line_user_id,
        line_display_name,
        line_linked_at,
        created_at,
        updated_at
      `
      )
      .order('created_at', { ascending: false });

    /**
     * 検索文字列がある場合のみ絞り込む。
     */
    if (query) {
      patientQuery = patientQuery.or(
        `name.ilike.%${query}%,kana.ilike.%${query}%,phone.ilike.%${query}%`
      );
    }

    const { data: patients, error: patientsError } =
      await patientQuery.returns<AdminPatient[]>();

    if (patientsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patients',
          detail: patientsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patients: patients ?? [],
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
 * POST /api/admin/patients
 *
 * 管理画面から新規患者を登録するAPI。
 * MVPではまず patients の基本項目だけを保存する。
 *
 * 保存対象：
 * - name：必須
 * - kana：任意
 * - phone：任意
 * - memo：任意
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

    const body = (await request.json()) as CreatePatientBody;

    /**
     * 患者名は必須。
     * 空白だけの入力も弾く。
     */
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    /**
     * 任意項目は空文字なら null として保存する。
     */
    const kana = normalizeOptionalText(body.kana);
    const phone = normalizeOptionalText(body.phone);
    const memo = normalizeOptionalText(body.memo);

    const { data: patient, error: createError } = await adminResult.supabaseAdmin
      .from('patients')
      .insert({
        name,
        kana,
        phone,
        memo,
      })
      .select(
        `
        id,
        name,
        kana,
        phone,
        memo,
        line_user_id,
        line_display_name,
        line_linked_at,
        created_at,
        updated_at
      `
      )
      .single<AdminPatient>();

    if (createError) {
      return NextResponse.json(
        {
          error: 'Failed to create patient',
          detail: createError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
