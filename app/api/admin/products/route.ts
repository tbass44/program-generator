import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 商品管理APIで使うUI表示用カテゴリ。
 * 管理画面では日本語で扱い、DB保存時だけ英語enumへ変換する。
 */
type ProductCategoryLabel = '物理療法（睡眠）' | '栄養療法' | '運動療法' | 'スキンケア';

/**
 * products.category のDB保存値。
 * supabase/schema.sql の product_category enum と合わせる。
 */
type ProductCategoryDb = 'physical_sleep' | 'nutrition' | 'exercise' | 'skincare';

/**
 * 商品マスタのUI表示用ステータス。
 */
type ProductStatusLabel = '有効' | '無効';

/**
 * products.status のDB保存値。
 * supabase/schema.sql の product_master_status enum と合わせる。
 */
type ProductStatusDb = 'active' | 'inactive';

/**
 * 管理者判定で使う profiles の最小型。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

/**
 * productsテーブルから取得するDB側の型。
 */
type ProductRow = {
  id: string;
  name: string;
  category: ProductCategoryDb;
  description: string | null;
  target_concerns: string | null;
  recommendation_template: string | null;
  price: number;
  inventory_count: number;
  product_url: string | null;
  status: ProductStatusDb;
  created_at: string;
  updated_at: string;
};

/**
 * 商品作成APIで受け取るbody。
 * ブラウザから来る値は信用せず、API側で型と必須項目を確認する。
 */
type CreateProductBody = {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  concerns?: unknown;
  reasonTemplate?: unknown;
  price?: unknown;
  inventoryCount?: unknown;
  url?: unknown;
  status?: unknown;
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
 * UI表示用カテゴリをDB保存値へ変換する。
 */
function toDbCategory(category: unknown): ProductCategoryDb | null {
  switch (category) {
    case '物理療法（睡眠）':
      return 'physical_sleep';
    case '栄養療法':
      return 'nutrition';
    case '運動療法':
      return 'exercise';
    case 'スキンケア':
      return 'skincare';
    default:
      return null;
  }
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
 * UI表示用ステータスをDB保存値へ変換する。
 */
function toDbStatus(status: unknown): ProductStatusDb | null {
  switch (status) {
    case '有効':
      return 'active';
    case '無効':
      return 'inactive';
    default:
      return null;
  }
}

/**
 * DB保存値をUI表示用ステータスへ変換する。
 */
function toLabelStatus(status: ProductStatusDb): ProductStatusLabel {
  return status === 'active' ? '有効' : '無効';
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
 * 0以上の整数として扱う値を整える。
 * 未入力や不正値はfallbackへ寄せる。
 */
function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numericValue));
}

/**
 * DBのproducts行を管理画面で扱う形へ変換する。
 */
function formatProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    category: toLabelCategory(row.category),
    description: row.description ?? '',
    concerns: row.target_concerns ?? '',
    reasonTemplate: row.recommendation_template ?? '',
    price: row.price,
    inventoryCount: row.inventory_count,
    url: row.product_url ?? '',
    status: toLabelStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * productsテーブル一覧・詳細で使うselect句。
 */
const productSelect = `
  id,
  name,
  category,
  description,
  target_concerns,
  recommendation_template,
  price,
  inventory_count,
  product_url,
  status,
  created_at,
  updated_at
`;

/**
 * GET /api/admin/products
 *
 * 商品マスタ一覧を取得するAPI。
 * 管理画面の商品一覧と、今後の商品提案選択UIで利用する。
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

    const { data: products, error: productsError } = await adminResult.supabaseAdmin
      .from('products')
      .select(productSelect)
      .order('created_at', { ascending: false })
      .returns<ProductRow[]>();

    if (productsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch products',
          detail: productsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      products: (products ?? []).map(formatProduct),
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
 * POST /api/admin/products
 *
 * 商品マスタを新規登録するAPI。
 * MVPでは商品名・カテゴリを必須とし、価格・在庫は未入力なら0で保存する。
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

    const body = (await request.json()) as CreateProductBody;

    const name = normalizeRequiredText(body.name);
    const category = toDbCategory(body.category);
    const status = toDbStatus(body.status);

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'category is invalid' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is invalid' },
        { status: 400 }
      );
    }

    const insertValues = {
      name,
      category,
      description: normalizeOptionalText(body.description),
      target_concerns: normalizeOptionalText(body.concerns),
      recommendation_template: normalizeOptionalText(body.reasonTemplate),
      price: normalizeNonNegativeInteger(body.price),
      inventory_count: normalizeNonNegativeInteger(body.inventoryCount),
      product_url: normalizeOptionalText(body.url),
      status,
    };

    const { data: product, error: insertError } = await adminResult.supabaseAdmin
      .from('products')
      .insert(insertValues)
      .select(productSelect)
      .single<ProductRow>();

    if (insertError) {
      return NextResponse.json(
        {
          error: 'Failed to create product',
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        product: formatProduct(product),
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
