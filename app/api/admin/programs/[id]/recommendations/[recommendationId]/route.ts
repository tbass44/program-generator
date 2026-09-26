import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * patient_product_recommendations.status のDB保存値。
 */
type PatientProductStatusDb =
  | 'recommended'
  | 'rental_requested'
  | 'renting'
  | 'rental_returned'
  | 'purchase_requested';

/**
 * 管理画面で表示する商品提案ステータス。
 */
type PatientProductStatusLabel =
  | '提案中'
  | 'レンタル希望'
  | 'レンタル中'
  | 'レンタル終了'
  | '購入希望';

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * 商品提案更新APIで受け取るbody。
 */
type UpdateRecommendationBody = {
  status?: unknown;
};

/**
 * 商品提案更新APIで返す最小型。
 */
type RecommendationRow = {
  id: string;
  program_id: string | null;
  status: PatientProductStatusDb;
  updated_at: string;
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
 * UI表示用ステータスをDB保存値へ変換する。
 */
function toDbStatus(status: unknown): PatientProductStatusDb | null {
  switch (status) {
    case '提案中':
      return 'recommended';
    case 'レンタル希望':
      return 'rental_requested';
    case 'レンタル中':
      return 'renting';
    case 'レンタル終了':
      return 'rental_returned';
    case '購入希望':
      return 'purchase_requested';
    default:
      return null;
  }
}

/**
 * DB保存値をUI表示用ステータスへ変換する。
 */
function toLabelStatus(status: PatientProductStatusDb): PatientProductStatusLabel {
  switch (status) {
    case 'recommended':
      return '提案中';
    case 'rental_requested':
      return 'レンタル希望';
    case 'renting':
      return 'レンタル中';
    case 'rental_returned':
      return 'レンタル終了';
    case 'purchase_requested':
      return '購入希望';
  }
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
 * 管理画面APIでは、画面側とは別に必ず権限確認する。
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
 * URLパラメータを検証する。
 */
function validateIds(programId: string, recommendationId: string) {
  if (!programId || !isUuid(programId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      ),
    };
  }

  if (!recommendationId || !isUuid(recommendationId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Invalid recommendation id format',
          detail: 'recommendation id must be UUID',
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const };
}

/**
 * 改善プログラムの存在を確認する。
 */
async function confirmProgram(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  programId: string
) {
  const { data: program, error: programError } = await supabaseAdmin
    .from('programs')
    .select('id')
    .eq('id', programId)
    .maybeSingle<{ id: string }>();

  return { program, programError };
}

/**
 * 商品提案が対象プログラムに紐づいているか確認する。
 */
async function confirmRecommendation(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  programId: string,
  recommendationId: string
) {
  const { data: recommendation, error: recommendationError } = await supabaseAdmin
    .from('patient_product_recommendations')
    .select('id, program_id')
    .eq('id', recommendationId)
    .eq('program_id', programId)
    .maybeSingle<{ id: string; program_id: string | null }>();

  return { recommendation, recommendationError };
}

/**
 * PATCH /api/admin/programs/[id]/recommendations/[recommendationId]
 *
 * 商品提案のステータスを更新するAPI。
 */
export async function PATCH(
  request: Request,
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
    const idValidation = validateIds(programId, recommendationId);

    if (!idValidation.ok) {
      return idValidation.response;
    }

    const body = (await request.json()) as UpdateRecommendationBody;
    const status = toDbStatus(body.status);

    if (!status) {
      return NextResponse.json(
        {
          error: 'Invalid recommendation status',
          detail: 'status must be one of 提案中 / レンタル希望 / レンタル中 / レンタル終了 / 購入希望',
        },
        { status: 400 }
      );
    }

    const { program, programError } = await confirmProgram(adminResult.supabaseAdmin, programId);

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

    const { recommendation, recommendationError } = await confirmRecommendation(
      adminResult.supabaseAdmin,
      programId,
      recommendationId
    );

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

    const { data: updatedRecommendation, error: updateError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendationId)
      .eq('program_id', programId)
      .select('id, program_id, status, updated_at')
      .single<RecommendationRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update recommendation',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      recommendation: {
        id: updatedRecommendation.id,
        programId: updatedRecommendation.program_id,
        status: toLabelStatus(updatedRecommendation.status),
        updatedAt: updatedRecommendation.updated_at,
      },
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
    const idValidation = validateIds(programId, recommendationId);

    if (!idValidation.ok) {
      return idValidation.response;
    }

    const { program, programError } = await confirmProgram(adminResult.supabaseAdmin, programId);

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

    const { recommendation, recommendationError } = await confirmRecommendation(
      adminResult.supabaseAdmin,
      programId,
      recommendationId
    );

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
