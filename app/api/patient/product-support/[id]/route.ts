import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LineVerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

type ProductSupportDetailRequestBody = {
  idToken?: unknown;
};

type ProductSupportDetailRouteContext = {
  params: {
    id: string;
  };
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
  short_term_program: string | null;
  long_term_program: string | null;
  created_at: string;
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

    throw new Error(
      `Failed to verify LINE id token${lineError}${description}`
    );
  }

  return { userId: verifyData.sub };
}

export async function POST(
  request: Request,
  { params }: ProductSupportDetailRouteContext
) {
  try {
    const body = (await request.json()) as ProductSupportDetailRequestBody;
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    const lineProfile = await verifyLineIdToken(idToken);
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, name, line_user_id')
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

    const { data: recommendation, error: recommendationError } = await supabaseAdmin
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
      .eq('id', params.id)
      .eq('patient_id', patient.id)
      .maybeSingle<RecommendationRow>();

    if (recommendationError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch product support detail',
          detail: recommendationError.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            recommendationId: params.id,
          },
        },
        { status: 500 }
      );
    }

    if (!recommendation) {
      return NextResponse.json(
        {
          error: 'Product support detail not found',
          detail: '指定された商品提案が見つかりません。',
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            recommendationId: params.id,
          },
        },
        { status: 404 }
      );
    }

    const [productResult, programResult] = await Promise.all([
      recommendation.product_id
        ? supabaseAdmin
            .from('products')
            .select('id, name, category, description, price, product_url')
            .eq('id', recommendation.product_id)
            .maybeSingle<ProductRow>()
        : Promise.resolve({ data: null, error: null }),
      recommendation.program_id
        ? supabaseAdmin
            .from('programs')
            .select('id, summary, short_term_program, long_term_program, created_at')
            .eq('id', recommendation.program_id)
            .eq('patient_id', patient.id)
            .maybeSingle<ProgramRow>()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (productResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch product',
          detail: productResult.error.message,
        },
        { status: 500 }
      );
    }

    if (programResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch related program',
          detail: programResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patient,
      item: {
        ...recommendation,
        product: productResult.data,
        program: programResult.data,
      },
      debug: {
        patientId: patient.id,
        patientName: patient.name,
        recommendationId: recommendation.id,
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
