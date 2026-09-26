import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * products.category / patient_product_recommendations.category のDB保存値。
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

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

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

type ProductRow = {
  id: string;
  name: string;
  category: ProductCategoryDb;
  product_url: string | null;
};

type ProgramRow = {
  id: string;
  summary: string | null;
  memo: string | null;
  created_at: string;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey);
}

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

function formatRecommendation(
  row: RecommendationRow,
  productMap: Map<string, ProductRow>,
  programMap: Map<string, ProgramRow>
) {
  const product = row.product_id ? productMap.get(row.product_id) : undefined;
  const program = row.program_id ? programMap.get(row.program_id) : undefined;

  return {
    id: row.id,
    patientId: row.patient_id,
    programId: row.program_id,
    productId: row.product_id,
    productName: product?.name ?? '商品情報なし',
    productUrl: product?.product_url ?? '',
    category: toLabelCategory(row.category),
    reason: row.reason ?? '',
    status: toLabelStatus(row.status),
    programSummary: program?.summary ?? program?.memo ?? '',
    programCreatedAt: program?.created_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/admin/patients/[id]/recommendations
 *
 * 患者詳細画面で、患者に紐づく商品提案履歴を取得するAPI。
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

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
        },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .maybeSingle<{ id: string }>();

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

    const { data: recommendations, error: recommendationsError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .select('id, patient_id, program_id, product_id, category, reason, status, created_at, updated_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .returns<RecommendationRow[]>();

    if (recommendationsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient product recommendations',
          detail: recommendationsError.message,
        },
        { status: 500 }
      );
    }

    const productIds = Array.from(
      new Set((recommendations ?? []).map((item) => item.product_id).filter(Boolean))
    ) as string[];

    const programIds = Array.from(
      new Set((recommendations ?? []).map((item) => item.program_id).filter(Boolean))
    ) as string[];

    let productMap = new Map<string, ProductRow>();
    let programMap = new Map<string, ProgramRow>();

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await adminResult.supabaseAdmin
        .from('products')
        .select('id, name, category, product_url')
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

    if (programIds.length > 0) {
      const { data: programs, error: programsError } = await adminResult.supabaseAdmin
        .from('programs')
        .select('id, summary, memo, created_at')
        .in('id', programIds)
        .returns<ProgramRow[]>();

      if (programsError) {
        return NextResponse.json(
          {
            error: 'Failed to fetch recommendation programs',
            detail: programsError.message,
          },
          { status: 500 }
        );
      }

      programMap = new Map((programs ?? []).map((program) => [program.id, program]));
    }

    return NextResponse.json({
      recommendations: (recommendations ?? []).map((item) =>
        formatRecommendation(item, productMap, programMap)
      ),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
