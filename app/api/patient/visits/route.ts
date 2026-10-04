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

type PatientVisitsRequestBody = {
  idToken?: unknown;
};

type PatientVisit = {
  id: string;
  patient_id: string;
  visit_date: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PatientVisitsRequestBody;
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

    const { data: visits, error: visitsError } = await supabaseAdmin
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
      .returns<PatientVisit[]>();

    if (visitsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch visits',
          detail: visitsError.message,
          debug: {
            patientId: patient.id,
            patientName: patient.name,
            lineUserId: lineProfile.userId,
          },
        },
        { status: 500 }
      );
    }

    const visitRows = visits ?? [];

    return NextResponse.json({
      patient,
      visits: visitRows,
      debug: {
        patientId: patient.id,
        patientName: patient.name,
        lineUserId: lineProfile.userId,
        visitsCount: visitRows.length,
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
