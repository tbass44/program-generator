import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * products.category / patient_product_recommendations.category のDB保存値。
 * supabase/schema.sql の product_category enum と合わせる。
 */
type ProductCategoryDb = 'physical_sleep' | 'nutrition' | 'exercise' | 'skincare';

/**
 * 管理画面で表示する商品カテゴリ。
 */
type ProductCategoryLabel = '物理療法（睡眠）' | '栄養療法' | '運動療法' | 'スキンケア';

/**
 * patient_product_recommendations.status のDB保存値。
 */
type PatientProductStatusDb =
  | 'recommended'
  | 'rental_requested'
  | 'renting'
  | 'purchase_requested';

/**
 * 管理画面で表示する商品提案ステータス。
 */
type PatientProductStatusLabel = '提案中' | 'レンタル希望' | 'レンタル中' | '購入希望';

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * 改善プログラムの存在確認と患者ID取得に使う型。
 */
type ProgramRow = {
  id: string;
  patient_id: string;
};

/**
 * 商品提案APIで参照するproductsの型。
 */
type ProductRow = {
  id: string;
  name: string;
  category: ProductCategoryDb;
  recommendation_template: string | null;
  status: 'active' | 'inactive';
};

/**
 * patient_product_recommendations の型。
 */
type RecommendationRow = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: ProductCategoryDb;
  reason: string | null;
  status: PatientProductStatusDb;
  created_at: string;
  updated_at: string;
};

/**
 * 商品提案作成APIで受け取るbody。
 */
type CreateRecommendationBody = {
  productId?: unknown;
  reason?: unknown;
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
 * DB保存値をUI表示用カテゴリへ変換する。
 */
function toLabelCategory(category: ProductCategoryDb): ProductCategoryLabel {
  switch (category) {
    case 'physical_sleep':
      return '物理療法（睡眠）';
    case 'nutrition':
      return '栄養療法';
    case 'exercise':
      return '運動療法';
    case 'skincare':
      return 'スキンケア';
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
    case 'purchase_requested':
      return '購入希望';
  }
}

/**
 * programsテーブルから対象プログラムを取得する。
 * 商品提案は患者にも紐づくため、patient_idもここで取得する。
 */
async function fetchProgram(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  programId: string
) {
  const { data: program, error: programError } = await supabaseAdmin
    .from('programs')
    .select('id, patient_id')
    .eq('id', programId)
    .maybeSingle<ProgramRow>();

  return { program, programError };
}

/**
 * patient_product_recommendations の行を管理画面表示用に整える。
 * product_id がnullの提案にも対応できるよう、商品情報が無い場合の表示も用意する。
 */
function formatRecommendation(
  row: RecommendationRow,
  productMap: Map<string, ProductRow>
) {
  const product = row.product_id ? productMap.get(row.product_id) : undefined;

  return {
    id: row.id,
    patientId: row.patient_id,
    programId: row.program_id,
    productId: row.product_id,
    productName: product?.name ?? '商品情報なし',
    category: toLabelCategory(row.category),
    reason: row.reason ?? '',
    status: toLabelStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/admin/programs/[id]/recommendations
 *
 * 改善プログラムに紐づく商品提案一覧を取得するAPI。
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

    if (!programId || !isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    const { program, programError } = await fetchProgram(adminResult.supabaseAdmin, programId);

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

    const { data: recommendations, error: recommendationsError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .select('id, patient_id, program_id, product_id, category, reason, status, created_at, updated_at')
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .returns<RecommendationRow[]>();

    if (recommendationsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recommendations',
          detail: recommendationsError.message,
        },
        { status: 500 }
      );
    }

    const productIds = Array.from(
      new Set((recommendations ?? []).map((item) => item.product_id).filter(Boolean))
    ) as string[];

    let productMap = new Map<string, ProductRow>();

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await adminResult.supabaseAdmin
        .from('products')
        .select('id, name, category, recommendation_template, status')
        .in('id', productIds)
        .returns<ProductRow[]>();

      if (productsError) {
        return NextResponse.json(
          {
            error: 'Failed to fetch recommendation products',
            detail: productsError.message,
          },
          { status: 500 }
        );
      }

      productMap = new Map((products ?? []).map((product) => [product.id, product]));
    }

    return NextResponse.json({
      recommendations: (recommendations ?? []).map((item) => formatRecommendation(item, productMap)),
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
 * POST /api/admin/programs/[id]/recommendations
 *
 * 改善プログラムに商品提案を追加するAPI。
 * 患者IDはprograms.patient_idから取得し、画面からは受け取らない。
 */
export async function POST(
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

    const programId = params.id;

    if (!programId || !isUuid(programId)) {
      return NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as CreateRecommendationBody;
    const productId = typeof body.productId === 'string' ? body.productId : '';

    if (!productId || !isUuid(productId)) {
      return NextResponse.json(
        {
          error: 'Invalid product id format',
          detail: 'product id must be UUID',
        },
        { status: 400 }
      );
    }

    const { program, programError } = await fetchProgram(adminResult.supabaseAdmin, programId);

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

    const { data: product, error: productError } = await adminResult.supabaseAdmin
      .from('products')
      .select('id, name, category, recommendation_template, status')
      .eq('id', productId)
      .maybeSingle<ProductRow>();

    if (productError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch product',
          detail: productError.message,
        },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const reason = normalizeOptionalText(body.reason) ?? product.recommendation_template;

    const { data: recommendation, error: insertError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .insert({
        patient_id: program.patient_id,
        program_id: program.id,
        product_id: product.id,
        category: product.category,
        reason,
        status: 'recommended',
      })
      .select('id, patient_id, program_id, product_id, category, reason, status, created_at, updated_at')
      .single<RecommendationRow>();

    if (insertError) {
      return NextResponse.json(
        {
          error: 'Failed to create recommendation',
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        recommendation: formatRecommendation(recommendation, new Map([[product.id, product]])),
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
