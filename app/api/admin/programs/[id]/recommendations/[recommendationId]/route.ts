import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

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
 * DELETE /api/admin/programs/[id]/recommendations/[recommendationId]
 *
 * 改善プログラム詳細画面から、商品提案を1件削除するAPI。
 * program_id と recommendation id の両方を見て、別プログラムの提案を誤削除しないようにする。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; recommendationId: string } }
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
    const recommendationId = params.recommendationId;

    if (!programId || !isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    if (!recommendationId || !isUuid(recommendationId)) {
      return NextResponse.json(
        {
          error: 'Invalid recommendation id format',
          detail: 'recommendation id must be UUID',
        },
        { status: 400 }
      );
    }

    /**
     * 先に改善プログラムの存在を確認する。
     * 存在しないprogram idに紐づく削除は404として扱う。
     */
    const { data: program, error: programError } = await adminResult.supabaseAdmin
      .from('programs')
      .select('id')
      .eq('id', programId)
      .maybeSingle<{ id: string }>();

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
     * 商品提案がこのプログラムに紐づいているか確認する。
     * recommendationId単独で削除せず、program_idも条件に含める。
     */
    const { data: recommendation, error: recommendationError } =
      await adminResult.supabaseAdmin
        .from('patient_product_recommendations')
        .select('id, program_id')
        .eq('id', recommendationId)
        .eq('program_id', programId)
        .maybeSingle<{ id: string; program_id: string | null }>();

    if (recommendationError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recommendation',
          detail: recommendationError.message,
        },
        { status: 500 }
      );
    }

    if (!recommendation) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .delete()
      .eq('id', recommendationId)
      .eq('program_id', programId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete recommendation',
          detail: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deleted: true,
      id: recommendationId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
