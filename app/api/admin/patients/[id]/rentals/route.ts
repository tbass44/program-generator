import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type ProductCategoryDb = 'physical_sleep' | 'nutrition' | 'exercise' | 'skincare';
type ProductCategoryLabel = '物理療法（睡眠）' | '栄養療法' | '運動療法' | 'スキンケア';

type RentalStatusDb = 'rental_requested' | 'renting' | 'rental_returned';
type RentalStatusLabel = 'レンタル希望' | 'レンタル中' | 'レンタル終了';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PatientRow = {
  id: string;
  name: string;
};

type RentalRecommendationRow = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: ProductCategoryDb;
  reason: string | null;
  status: RentalStatusDb;
  rental_started_at: string | null;
  rental_returned_at: string | null;
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

type CreateRentalBody = {
  productId?: unknown;
  status?: unknown;
  reason?: unknown;
  rentalStartedAt?: unknown;
  rentalReturnedAt?: unknown;
};

const rentalStatuses: RentalStatusDb[] = ['rental_requested', 'renting', 'rental_returned'];

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

function getPatientIdFromRequest(request: Request, paramId: string) {
  if (paramId && isUuid(paramId)) {
    return paramId;
  }

  const pathname = new URL(request.url).pathname;
  const pathMatch = pathname.match(/\/api\/admin\/patients\/([0-9a-f-]{36})\/rentals/i);
  const pathValue = pathMatch?.[1] ?? '';

  if (pathValue && isUuid(pathValue)) {
    return pathValue;
  }

  return '';
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

function toDbStatus(status: unknown): RentalStatusDb | null {
  switch (status) {
    case 'レンタル希望':
      return 'rental_requested';
    case 'レンタル中':
      return 'renting';
    case 'レンタル終了':
      return 'rental_returned';
    default:
      return null;
  }
}

function toLabelStatus(status: RentalStatusDb): RentalStatusLabel {
  switch (status) {
    case 'rental_requested':
      return 'レンタル希望';
    case 'renting':
      return 'レンタル中';
    case 'rental_returned':
      return 'レンタル終了';
  }
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000+09:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatRental(
  row: RentalRecommendationRow,
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
    rentalStartedAt: row.rental_started_at ?? row.created_at,
    rentalReturnedAt: row.rental_returned_at,
    rentalUpdatedAt: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchPatient(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string
) {
  return supabaseAdmin
    .from('patients')
    .select('id, name')
    .eq('id', patientId)
    .maybeSingle<PatientRow>();
}

async function fetchRentalRows(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string
) {
  return supabaseAdmin
    .from('patient_product_recommendations')
    .select('id, patient_id, program_id, product_id, category, reason, status, rental_started_at, rental_returned_at, created_at, updated_at')
    .eq('patient_id', patientId)
    .in('status', rentalStatuses)
    .order('rental_started_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .returns<RentalRecommendationRow[]>();
}

async function formatRentals(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  rentals: RentalRecommendationRow[]
) {
  const productIds = Array.from(
    new Set((rentals ?? []).map((item) => item.product_id).filter(Boolean))
  ) as string[];

  const programIds = Array.from(
    new Set((rentals ?? []).map((item) => item.program_id).filter(Boolean))
  ) as string[];

  let productMap = new Map<string, ProductRow>();
  let programMap = new Map<string, ProgramRow>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, category, product_url')
      .in('id', productIds)
      .returns<ProductRow[]>();

    if (productsError) {
      throw new Error(productsError.message);
    }

    productMap = new Map((products ?? []).map((product) => [product.id, product]));
  }

  if (programIds.length > 0) {
    const { data: programs, error: programsError } = await supabaseAdmin
      .from('programs')
      .select('id, summary, memo, created_at')
      .in('id', programIds)
      .returns<ProgramRow[]>();

    if (programsError) {
      throw new Error(programsError.message);
    }

    programMap = new Map((programs ?? []).map((program) => [program.id, program]));
  }

  return (rentals ?? []).map((item) => formatRental(item, productMap, programMap));
}

async function buildRentalsResponse(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patient: PatientRow,
  patientId: string
) {
  const { data: rentals, error: rentalsError } = await fetchRentalRows(supabaseAdmin, patientId);

  if (rentalsError) {
    return NextResponse.json(
      { error: 'Failed to fetch rentals', detail: rentalsError.message },
      { status: 500 }
    );
  }

  try {
    const formattedRentals = await formatRentals(supabaseAdmin, rentals ?? []);

    return NextResponse.json({
      patient,
      rentals: formattedRentals,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to format rentals', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const patientId = getPatientIdFromRequest(request, params.id);

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
          receivedId: params.id,
          pathname: new URL(request.url).pathname,
        },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await fetchPatient(
      adminResult.supabaseAdmin,
      patientId
    );

    if (patientError) {
      return NextResponse.json(
        { error: 'Failed to fetch patient', detail: patientError.message },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return buildRentalsResponse(adminResult.supabaseAdmin, patient, patientId);
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

    const patientId = getPatientIdFromRequest(request, params.id);

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
          receivedId: params.id,
          pathname: new URL(request.url).pathname,
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as CreateRentalBody;
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const status = toDbStatus(body.status);
    const rentalStartedAt = normalizeOptionalDate(body.rentalStartedAt) ?? new Date().toISOString();
    const rentalReturnedAt = status === 'rental_returned' ? normalizeOptionalDate(body.rentalReturnedAt) : null;

    if (!productId || !isUuid(productId)) {
      return NextResponse.json(
        { error: 'Invalid product id format', detail: 'productId must be UUID' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        {
          error: 'Invalid rental status',
          detail: 'status must be one of レンタル希望 / レンタル中 / レンタル終了',
        },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await fetchPatient(
      adminResult.supabaseAdmin,
      patientId
    );

    if (patientError) {
      return NextResponse.json(
        { error: 'Failed to fetch patient', detail: patientError.message },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const { data: product, error: productError } = await adminResult.supabaseAdmin
      .from('products')
      .select('id, name, category, product_url, status')
      .eq('id', productId)
      .maybeSingle<ProductRow & { status: 'active' | 'inactive' }>();

    if (productError) {
      return NextResponse.json(
        { error: 'Failed to fetch product', detail: productError.message },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { error: 'Product is inactive', detail: 'active products only can be rented' },
        { status: 400 }
      );
    }

    /**
     * レンタル履歴は patient_product_recommendations を使う。
     * 商品提案由来ではなく管理画面から直接追加した場合も、患者と商品を紐づけるレンタル状態として同じテーブルに保存する。
     */
    const { error: insertError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .insert({
        patient_id: patientId,
        product_id: product.id,
        category: product.category,
        reason: normalizeOptionalText(body.reason),
        status,
        rental_started_at: rentalStartedAt,
        rental_returned_at: rentalReturnedAt,
      });

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create rental', detail: insertError.message },
        { status: 500 }
      );
    }

    return buildRentalsResponse(adminResult.supabaseAdmin, patient, patientId);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
