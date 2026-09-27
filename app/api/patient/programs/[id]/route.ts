import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type LineVerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

type PatientProgramDetailRequestBody = {
  idToken?: unknown;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function verifyLineIdToken(idToken: string): Promise<{ userId: string }> {
  const lineChannelId = getRequiredEnv('LINE_CHANNEL_ID');

  const params = new URLSearchParams();
  params.append('id_token', idToken);
  params.append('client_id', lineChannelId);

  const verifyResponse = await fetch(
    'https://api.line.me/oauth2/v2.1/verify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    }
  );

  const verifyData = (await verifyResponse.json()) as LineVerifyResponse;

  if (!verifyResponse.ok || !verifyData.sub) {
    throw new Error('Failed to verify LINE id token');
  }

  return { userId: verifyData.sub };
}

function mapRecommendationStatus(status: string | null) {
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
    default:
      return '提案中';
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: programId } = await context.params;

    if (!isValidUuid(programId)) {
      return NextResponse.json(
        { error: 'Invalid program id' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as PatientProgramDetailRequestBody;
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
      .select('id, name')
      .eq('line_user_id', lineProfile.userId)
      .maybeSingle();

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
        {
          error: 'Patient not linked',
          detail: 'このLINEアカウントに紐づく患者データがありません。',
        },
        { status: 404 }
      );
    }

    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .select(
        `
        id,
        patient_id,
        memo,
        summary,
        short_term_program,
        long_term_program,
        today_task,
        program_text,
        created_at
      `
      )
      .eq('id', programId)
      .eq('patient_id', patient.id)
      .maybeSingle();

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
        {
          error: 'Program not found',
          detail: 'この患者データに紐づく改善プログラムが見つかりません。',
        },
        { status: 404 }
      );
    }

    const { data: recommendations, error: recommendationsError } =
      await supabaseAdmin
        .from('patient_product_recommendations')
        .select(
          `
          id,
          reason,
          status,
          created_at,
          products (
            id,
            name,
            category,
            description,
            product_url
          )
        `
        )
        .eq('program_id', program.id)
        .order('created_at', { ascending: false });

    if (recommendationsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recommendations',
          detail: recommendationsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patient,
      program,
      recommendations: (recommendations ?? []).map((recommendation) => {
        const product = Array.isArray(recommendation.products)
          ? recommendation.products[0]
          : recommendation.products;

        return {
          id: recommendation.id,
          reason: recommendation.reason,
          status: recommendation.status,
          statusLabel: mapRecommendationStatus(recommendation.status),
          created_at: recommendation.created_at,
          product: product
            ? {
                id: product.id,
                name: product.name,
                category: product.category,
                description: product.description,
                product_url: product.product_url,
              }
            : null,
        };
      }),
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
