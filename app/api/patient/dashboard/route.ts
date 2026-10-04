import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LineVerifyResponse = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

type PatientDashboardRequestBody = {
  idToken?: unknown;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  product_url: string | null;
};

type ProgramRow = {
  id: string;
  summary: string | null;
};

type RecommendationRow = {
  id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type VisitRow = {
  id: string;
  patient_id: string;
  visit_date: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

const rentalStatuses = ['rental_requested', 'renting', 'rental_returned'];

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

async function verifyLineIdToken(idToken: string): Promise<{
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
}> {
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

  return {
    userId: verifyData.sub,
    displayName: verifyData.name ?? null,
    pictureUrl: verifyData.picture ?? null,
  };
}

function uniq(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function attachRecommendationDetails(
  recommendations: RecommendationRow[],
  products: ProductRow[],
  programs: ProgramRow[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const programMap = new Map(programs.map((program) => [program.id, program]));

  return recommendations.map((recommendation) => {
    const product = recommendation.product_id
      ? productMap.get(recommendation.product_id) ?? null
      : null;
    const program = recommendation.program_id
      ? programMap.get(recommendation.program_id) ?? null
      : null;

    return {
      ...recommendation,
      product,
      program,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PatientDashboardRequestBody;
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
      .select(
        `
        id,
        name,
        memo,
        line_user_id,
        line_display_name,
        line_picture_url,
        line_linked_at
      `
      )
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
          lineProfile,
          debug: {
            lineUserId: lineProfile.userId,
          },
        },
        { status: 404 }
      );
    }

    const [programResult, planResult, recommendationsResult, visitsResult] =
      await Promise.all([
        supabaseAdmin
          .from('programs')
          .select(
            `
            id,
            summary,
            short_term_program,
            long_term_program,
            created_at
          `
          )
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('plans')
          .select(
            `
            id,
            type,
            name,
            total_count,
            remaining_count,
            start_date,
            end_date,
            status,
            created_at
          `
          )
          .eq('patient_id', patient.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('patient_product_recommendations')
          .select(
            `
            id,
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
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .returns<RecommendationRow[]>(),
        supabaseAdmin
          .from('visits')
          .select(
            `
            id,
            patient_id,
            visit_date,
            note,
            created_at,
            updated_at
          `
          )
          .eq('patient_id', patient.id)
          .order('visit_date', { ascending: false })
          .order('created_at', { ascending: false })
          .returns<VisitRow[]>(),
      ]);

    if (programResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch current program',
          detail: programResult.error.message,
        },
        { status: 500 }
      );
    }

    if (planResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch current plan',
          detail: planResult.error.message,
        },
        { status: 500 }
      );
    }

    if (recommendationsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch product recommendations',
          detail: recommendationsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (visitsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recent visits',
          detail: visitsResult.error.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    const allRecommendations = recommendationsResult.data ?? [];
    const productIds = uniq(allRecommendations.map((recommendation) => recommendation.product_id));
    const programIds = uniq(allRecommendations.map((recommendation) => recommendation.program_id));

    let products: ProductRow[] = [];
    let programs: ProgramRow[] = [];

    if (productIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, name, category, description, product_url')
        .in('id', productIds)
        .returns<ProductRow[]>();

      if (error) {
        return NextResponse.json(
          {
            error: 'Failed to fetch recommendation products',
            detail: error.message,
          },
          { status: 500 }
        );
      }

      products = data ?? [];
    }

    if (programIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('programs')
        .select('id, summary')
        .in('id', programIds)
        .returns<ProgramRow[]>();

      if (error) {
        return NextResponse.json(
          {
            error: 'Failed to fetch recommendation programs',
            detail: error.message,
          },
          { status: 500 }
        );
      }

      programs = data ?? [];
    }

    const recommendationDetails = attachRecommendationDetails(
      allRecommendations,
      products,
      programs
    );

    const rentals = recommendationDetails.filter((recommendation) =>
      rentalStatuses.includes(recommendation.status)
    );
    const productRecommendations = recommendationDetails.filter(
      (recommendation) => !rentalStatuses.includes(recommendation.status)
    );
    const visitRows = visitsResult.data ?? [];

    return NextResponse.json({
      lineProfile,
      patient,
      currentProgram: programResult.data,
      currentPlan: planResult.data,
      recommendations: productRecommendations.slice(0, 6),
      recentVisits: visitRows.slice(0, 3),
      rentals: rentals.slice(0, 5),
      debug: {
        patientId: patient.id,
        patientName: patient.name,
        lineUserId: lineProfile.userId,
        recommendationsCount: productRecommendations.length,
        visitsCount: visitRows.length,
        rentalsCount: rentals.length,
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
