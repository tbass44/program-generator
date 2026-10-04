import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PurchaseRequestBody = {
  productId?: unknown;
  recommendationId?: unknown;
  programId?: unknown;
  purchasedAt?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  totalPrice?: unknown;
  note?: unknown;
};

type PurchaseRow = {
  id: string;
  patient_id: string;
  product_id: string | null;
  recommendation_id: string | null;
  program_id: string | null;
  purchased_at: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  product_url: string | null;
};

type ProgramRow = {
  id: string;
  summary: string | null;
  created_at: string;
};

type RecommendationRow = {
  id: string;
  product_id: string | null;
  program_id: string | null;
  reason: string | null;
  status: string;
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
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
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

function toNullableUuid(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (!isUuid(normalized)) {
    return undefined;
  }

  return normalized;
}

function toPositiveInteger(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toNonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function uniq(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function attachDetails(
  purchases: PurchaseRow[],
  products: ProductRow[],
  programs: ProgramRow[],
  recommendations: RecommendationRow[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const programMap = new Map(programs.map((program) => [program.id, program]));
  const recommendationMap = new Map(recommendations.map((recommendation) => [recommendation.id, recommendation]));

  return purchases.map((purchase) => ({
    id: purchase.id,
    patientId: purchase.patient_id,
    productId: purchase.product_id,
    recommendationId: purchase.recommendation_id,
    programId: purchase.program_id,
    purchasedAt: purchase.purchased_at,
    quantity: purchase.quantity,
    unitPrice: purchase.unit_price,
    totalPrice: purchase.total_price,
    note: purchase.note,
    createdAt: purchase.created_at,
    updatedAt: purchase.updated_at,
    product: purchase.product_id ? productMap.get(purchase.product_id) ?? null : null,
    program: purchase.program_id ? programMap.get(purchase.program_id) ?? null : null,
    recommendation: purchase.recommendation_id
      ? recommendationMap.get(purchase.recommendation_id) ?? null
      : null,
  }));
}

async function fetchPurchases(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, patientId: string) {
  const { data: purchases, error: purchasesError } = await supabaseAdmin
    .from('patient_product_purchases')
    .select(
      `
      id,
      patient_id,
      product_id,
      recommendation_id,
      program_id,
      purchased_at,
      quantity,
      unit_price,
      total_price,
      note,
      created_at,
      updated_at
    `
    )
    .eq('patient_id', patientId)
    .order('purchased_at', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<PurchaseRow[]>();

  if (purchasesError) {
    return { purchases: null, error: purchasesError };
  }

  const purchaseRows = purchases ?? [];
  const productIds = uniq(purchaseRows.map((purchase) => purchase.product_id));
  const programIds = uniq(purchaseRows.map((purchase) => purchase.program_id));
  const recommendationIds = uniq(purchaseRows.map((purchase) => purchase.recommendation_id));

  const [productsResult, programsResult, recommendationsResult] = await Promise.all([
    productIds.length > 0
      ? supabaseAdmin
          .from('products')
          .select('id, name, category, description, price, product_url')
          .in('id', productIds)
          .returns<ProductRow[]>()
      : Promise.resolve({ data: [] as ProductRow[], error: null }),
    programIds.length > 0
      ? supabaseAdmin
          .from('programs')
          .select('id, summary, created_at')
          .in('id', programIds)
          .returns<ProgramRow[]>()
      : Promise.resolve({ data: [] as ProgramRow[], error: null }),
    recommendationIds.length > 0
      ? supabaseAdmin
          .from('patient_product_recommendations')
          .select('id, product_id, program_id, reason, status')
          .in('id', recommendationIds)
          .returns<RecommendationRow[]>()
      : Promise.resolve({ data: [] as RecommendationRow[], error: null }),
  ]);

  const firstError = productsResult.error ?? programsResult.error ?? recommendationsResult.error;

  if (firstError) {
    return { purchases: null, error: firstError };
  }

  return {
    purchases: attachDetails(
      purchaseRows,
      productsResult.data ?? [],
      programsResult.data ?? [],
      recommendationsResult.data ?? []
    ),
    error: null,
  };
}

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
        { error: 'Invalid patient id format', detail: 'patient id must be UUID' },
        { status: 400 }
      );
    }

    const result = await fetchPurchases(adminResult.supabaseAdmin, patientId);

    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to fetch patient purchases', detail: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ purchases: result.purchases ?? [] });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

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

    const patientId = params.id;

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        { error: 'Invalid patient id format', detail: 'patient id must be UUID' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as PurchaseRequestBody;
    const recommendationId = toNullableUuid(body.recommendationId);
    const productIdFromBody = toNullableUuid(body.productId);
    const programIdFromBody = toNullableUuid(body.programId);
    const quantity = toPositiveInteger(body.quantity, 1);
    const unitPrice = toNonNegativeInteger(body.unitPrice);
    const totalPriceFromBody = toNonNegativeInteger(body.totalPrice);
    const purchasedAt = normalizeDateTime(body.purchasedAt);
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    if (recommendationId === undefined || productIdFromBody === undefined || programIdFromBody === undefined) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    if (quantity === null) {
      return NextResponse.json(
        { error: 'quantity must be positive integer' },
        { status: 400 }
      );
    }

    if (unitPrice === undefined || totalPriceFromBody === undefined) {
      return NextResponse.json(
        { error: 'price must be non-negative integer' },
        { status: 400 }
      );
    }

    if (!purchasedAt) {
      return NextResponse.json(
        { error: 'Invalid purchasedAt' },
        { status: 400 }
      );
    }

    let productId = productIdFromBody;
    let programId = programIdFromBody;

    if (recommendationId) {
      const { data: recommendation, error: recommendationError } = await adminResult.supabaseAdmin
        .from('patient_product_recommendations')
        .select('id, patient_id, product_id, program_id')
        .eq('id', recommendationId)
        .eq('patient_id', patientId)
        .maybeSingle<{ id: string; patient_id: string; product_id: string | null; program_id: string | null }>();

      if (recommendationError) {
        return NextResponse.json(
          { error: 'Failed to fetch recommendation', detail: recommendationError.message },
          { status: 500 }
        );
      }

      if (!recommendation) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      productId = productId ?? recommendation.product_id;
      programId = programId ?? recommendation.program_id;
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'productId or recommendationId is required' },
        { status: 400 }
      );
    }

    const totalPrice = totalPriceFromBody ?? (unitPrice !== null ? unitPrice * quantity : null);

    const { data: purchase, error: insertError } = await adminResult.supabaseAdmin
      .from('patient_product_purchases')
      .insert({
        patient_id: patientId,
        product_id: productId,
        recommendation_id: recommendationId,
        program_id: programId,
        purchased_at: purchasedAt,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        note,
      })
      .select('id')
      .single<{ id: string }>();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create purchase', detail: insertError.message },
        { status: 500 }
      );
    }

    const result = await fetchPurchases(adminResult.supabaseAdmin, patientId);

    if (result.error) {
      return NextResponse.json(
        {
          purchase,
          error: 'Created purchase but failed to fetch purchases',
          detail: result.error.message,
        },
        { status: 207 }
      );
    }

    return NextResponse.json({ purchase, purchases: result.purchases ?? [] });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
