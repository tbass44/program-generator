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

type PatientRentalsRequestBody = {
  idToken?: unknown;
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
};

type RentalRecommendationRow = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: 'rental_requested' | 'renting' | 'rental_returned' | string;
  created_at: string;
  updated_at: string;
};

const rentalStatuses = ['rental_requested', 'renting', 'rental_returned'];

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

function uniq(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function attachDetails(
  rentals: RentalRecommendationRow[],
  products: ProductRow[],
  programs: ProgramRow[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const programMap = new Map(programs.map((program) => [program.id, program]));

  return rentals.map((rental) => ({
    ...rental,
    product: rental.product_id ? productMap.get(rental.product_id) ?? null : null,
    program: rental.program_id ? programMap.get(rental.program_id) ?? null : null,
  }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PatientRentalsRequestBody;
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

    const { data: rentalRows, error: rentalsError } = await supabaseAdmin
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
      .in('status', rentalStatuses)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<RentalRecommendationRow[]>();

    if (rentalsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch rentals',
          detail: rentalsError.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    const rentals = rentalRows ?? [];
    const productIds = uniq(rentals.map((rental) => rental.product_id));
    const programIds = uniq(rentals.map((rental) => rental.program_id));

    const [productsResult, programsResult] = await Promise.all([
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
            .select('id, summary')
            .in('id', programIds)
            .returns<ProgramRow[]>()
        : Promise.resolve({ data: [] as ProgramRow[], error: null }),
    ]);

    if (productsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch rental products',
          detail: productsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (programsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch rental programs',
          detail: programsResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patient,
      rentals: attachDetails(
        rentals,
        productsResult.data ?? [],
        programsResult.data ?? []
      ),
      debug: {
        patientId: patient.id,
        patientName: patient.name,
        lineUserId: lineProfile.userId,
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
