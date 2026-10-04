import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LineVerifyResponse = {
  sub?: string;
  error?: string;
  error_description?: string;
};

type PurchasesRequestBody = {
  idToken?: unknown;
};

type RecommendationRow = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type PurchaseHistoryRow = {
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
  inventory_count: number | null;
  product_url: string | null;
  status: string;
};

type ProgramRow = {
  id: string;
  summary: string | null;
  created_at: string;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

async function verifyLineIdToken(idToken: string): Promise<{ userId: string }> {
  const lineChannelId = getRequiredEnv('LINE_CHANNEL_ID');

  const params = new URLSearchParams();
  params.append('id_token', idToken);
  params.append('client_id', lineChannelId);

  const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    cache: 'no-store',
  });

  const verifyData = (await verifyResponse.json()) as LineVerifyResponse;

  if (!verifyResponse.ok || !verifyData.sub) {
    const lineError = verifyData.error ? ` / ${verifyData.error}` : '';
    const description = verifyData.error_description
      ? ` / ${verifyData.error_description}`
      : '';

    throw new Error(`Failed to verify LINE id token${lineError}${description}`);
  }

  return { userId: verifyData.sub };
}

function uniq(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function attachRecommendationDetails(
  purchaseRequests: RecommendationRow[],
  products: ProductRow[],
  programs: ProgramRow[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const programMap = new Map(programs.map((program) => [program.id, program]));

  return purchaseRequests.map((purchaseRequest) => ({
    ...purchaseRequest,
    product: purchaseRequest.product_id
      ? productMap.get(purchaseRequest.product_id) ?? null
      : null,
    program: purchaseRequest.program_id
      ? programMap.get(purchaseRequest.program_id) ?? null
      : null,
  }));
}

function attachPurchaseHistoryDetails(
  purchaseHistory: PurchaseHistoryRow[],
  products: ProductRow[],
  programs: ProgramRow[],
  recommendations: RecommendationRow[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const programMap = new Map(programs.map((program) => [program.id, program]));
  const recommendationMap = new Map(recommendations.map((recommendation) => [recommendation.id, recommendation]));

  return purchaseHistory.map((purchase) => ({
    ...purchase,
    product: purchase.product_id ? productMap.get(purchase.product_id) ?? null : null,
    program: purchase.program_id ? programMap.get(purchase.program_id) ?? null : null,
    recommendation: purchase.recommendation_id
      ? recommendationMap.get(purchase.recommendation_id) ?? null
      : null,
  }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PurchasesRequestBody;
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const lineProfile = await verifyLineIdToken(idToken);
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, name, line_user_id, line_display_name')
      .eq('line_user_id', lineProfile.userId)
      .maybeSingle();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
          debug: {
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json(
        {
          error: 'Patient not linked',
          detail: 'このLINEアカウントに紐づく患者データがありません。',
          debug: {
            lineUserId: lineProfile.userId,
          },
        },
        { status: 404 }
      );
    }

    const [purchaseRequestsResult, purchaseHistoryResult] = await Promise.all([
      supabaseAdmin
        .from('patient_product_recommendations')
        .select(
          `
          id,
          patient_id,
          program_id,
          product_id,
          category,
          reason,
          status,
          created_at,
          updated_at
        `
        )
        .eq('patient_id', patient.id)
        .eq('status', 'purchase_requested')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .returns<RecommendationRow[]>(),
      supabaseAdmin
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
        .eq('patient_id', patient.id)
        .order('purchased_at', { ascending: false })
        .order('created_at', { ascending: false })
        .returns<PurchaseHistoryRow[]>(),
    ]);

    if (purchaseRequestsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch purchase requests',
          detail: purchaseRequestsResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    if (purchaseHistoryResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch purchase history',
          detail: purchaseHistoryResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    const purchaseRequests = purchaseRequestsResult.data ?? [];
    const purchaseHistory = purchaseHistoryResult.data ?? [];
    const requestProductIds = purchaseRequests.map((purchase) => purchase.product_id);
    const requestProgramIds = purchaseRequests.map((purchase) => purchase.program_id);
    const historyProductIds = purchaseHistory.map((purchase) => purchase.product_id);
    const historyProgramIds = purchaseHistory.map((purchase) => purchase.program_id);
    const historyRecommendationIds = uniq(purchaseHistory.map((purchase) => purchase.recommendation_id));
    const productIds = uniq([...requestProductIds, ...historyProductIds]);
    const programIds = uniq([...requestProgramIds, ...historyProgramIds]);

    const productsPromise = productIds.length > 0
      ? supabaseAdmin
          .from('products')
          .select('id, name, category, description, price, inventory_count, product_url, status')
          .in('id', productIds)
          .returns<ProductRow[]>()
      : Promise.resolve({ data: [] as ProductRow[], error: null });
    const programsPromise = programIds.length > 0
      ? supabaseAdmin
          .from('programs')
          .select('id, summary, created_at')
          .in('id', programIds)
          .returns<ProgramRow[]>()
      : Promise.resolve({ data: [] as ProgramRow[], error: null });
    const historyRecommendationsPromise = historyRecommendationIds.length > 0
      ? supabaseAdmin
          .from('patient_product_recommendations')
          .select('id, patient_id, program_id, product_id, category, reason, status, created_at, updated_at')
          .in('id', historyRecommendationIds)
          .returns<RecommendationRow[]>()
      : Promise.resolve({ data: [] as RecommendationRow[], error: null });

    const [productsResult, programsResult, historyRecommendationsResult] = await Promise.all([
      productsPromise,
      programsPromise,
      historyRecommendationsPromise,
    ]);

    if (productsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch products',
          detail: productsResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
          },
        },
        { status: 500 }
      );
    }

    if (programsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch programs',
          detail: programsResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
          },
        },
        { status: 500 }
      );
    }

    if (historyRecommendationsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch purchase recommendations',
          detail: historyRecommendationsResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
          },
        },
        { status: 500 }
      );
    }

    const productRows = productsResult.data ?? [];
    const programRows = programsResult.data ?? [];
    const purchaseRequestsWithDetails = attachRecommendationDetails(
      purchaseRequests,
      productRows,
      programRows
    );
    const purchaseHistoryWithDetails = attachPurchaseHistoryDetails(
      purchaseHistory,
      productRows,
      programRows,
      historyRecommendationsResult.data ?? []
    );

    return NextResponse.json({
      patient,
      purchaseRequests: purchaseRequestsWithDetails,
      purchaseHistory: purchaseHistoryWithDetails,
      debug: {
        patientId: patient.id,
        patientName: patient.name,
        lineUserId: lineProfile.userId,
        purchaseRequestsCount: purchaseRequestsWithDetails.length,
        purchaseHistoryCount: purchaseHistoryWithDetails.length,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
