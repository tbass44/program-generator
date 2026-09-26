import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PatientRow = {
  id: string;
  name: string;
};

type VisitRow = {
  id: string;
  patient_id: string;
  visit_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CreateVisitBody = {
  visitDate?: unknown;
  note?: unknown;
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

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredDate(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function formatVisit(row: VisitRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    visitDate: row.visit_date,
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const visitSelect = `
  id,
  patient_id,
  visit_date,
  note,
  created_at,
  updated_at
`;

async function fetchPatient(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string
) {
  const { data: patient, error } = await supabaseAdmin
    .from('patients')
    .select('id, name')
    .eq('id', patientId)
    .maybeSingle<PatientRow>();

  return { patient, error };
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
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
        },
        { status: 400 }
      );
    }

    const { patient, error: patientError } = await fetchPatient(adminResult.supabaseAdmin, patientId);

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

    const { data: visits, error: visitsError } = await adminResult.supabaseAdmin
      .from('visits')
      .select(visitSelect)
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<VisitRow[]>();

    if (visitsError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch visits',
          detail: visitsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      visits: (visits ?? []).map(formatVisit),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
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
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as CreateVisitBody;
    const visitDate = normalizeRequiredDate(body.visitDate);

    if (!visitDate) {
      return NextResponse.json(
        { error: 'visitDate is required' },
        { status: 400 }
      );
    }

    const { patient, error: patientError } = await fetchPatient(adminResult.supabaseAdmin, patientId);

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

    const { data: visit, error: createError } = await adminResult.supabaseAdmin
      .from('visits')
      .insert({
        patient_id: patient.id,
        visit_date: visitDate,
        note: normalizeOptionalText(body.note),
      })
      .select(visitSelect)
      .single<VisitRow>();

    if (createError) {
      return NextResponse.json(
        {
          error: 'Failed to create visit',
          detail: createError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        visit: formatVisit(visit),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
