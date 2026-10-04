import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type LineVerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

type PatientPlansRequestBody = {
  idToken?: unknown;
};

type PatientPlan = {
  id: string;
  patient_id: string;
  type: 'ticket' | 'subscription';
  name: string;
  total_count: number | null;
  remaining_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string | null;
};

type TicketUsage = {
  id: string;
  plan_id: string;
  used_at: string;
  note: string | null;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PatientPlansRequestBody;
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

    const { data: plans, error: plansError } = await supabaseAdmin
      .from('plans')
      .select(
        `
        id,
        patient_id,
        type,
        name,
        total_count,
        remaining_count,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      `
      )
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .returns<PatientPlan[]>();

    if (plansError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch plans',
          detail: plansError.message,
        },
        { status: 500 }
      );
    }

    const planRows = plans ?? [];
    const ticketPlanIds = planRows
      .filter((plan) => plan.type === 'ticket')
      .map((plan) => plan.id);

    let usages: TicketUsage[] = [];

    if (ticketPlanIds.length > 0) {
      const { data: usageRows, error: usagesError } = await supabaseAdmin
        .from('ticket_usages')
        .select('id, plan_id, used_at, note, created_at')
        .in('plan_id', ticketPlanIds)
        .order('used_at', { ascending: false })
        .returns<TicketUsage[]>();

      if (usagesError) {
        return NextResponse.json(
          {
            error: 'Failed to fetch ticket usages',
            detail: usagesError.message,
          },
          { status: 500 }
        );
      }

      usages = usageRows ?? [];
    }

    return NextResponse.json({
      patient,
      plans: planRows.map((plan) => ({
        ...plan,
        usages: usages.filter((usage) => usage.plan_id === plan.id),
      })),
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
