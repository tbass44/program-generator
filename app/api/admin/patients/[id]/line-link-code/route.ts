import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'crypto';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PatientRow = {
  id: string;
  name: string;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
  line_link_code: string | null;
  line_link_code_expires_at: string | null;
  updated_at: string;
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

function generateLineLinkCode(): string {
  return String(randomInt(100000, 1000000));
}

function createExpiresAt(): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt.toISOString();
}

function formatPatient(row: PatientRow) {
  return {
    id: row.id,
    name: row.name,
    lineUserId: row.line_user_id,
    lineDisplayName: row.line_display_name,
    linePictureUrl: row.line_picture_url,
    lineLinkedAt: row.line_linked_at,
    lineLinkCode: row.line_link_code,
    lineLinkCodeExpiresAt: row.line_link_code_expires_at,
    updatedAt: row.updated_at,
  };
}

async function validateAdminAndPatientId(patientId: string) {
  const adminResult = await requireAdmin();

  if (!adminResult.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: adminResult.error,
          detail: 'detail' in adminResult ? adminResult.detail : undefined,
        },
        { status: adminResult.status }
      ),
      supabaseAdmin: null,
    };
  }

  if (!isUuid(patientId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Invalid patient id' },
        { status: 400 }
      ),
      supabaseAdmin: null,
    };
  }

  return {
    ok: true as const,
    supabaseAdmin: adminResult.supabaseAdmin,
  };
}

const patientSelect = `
  id,
  name,
  line_user_id,
  line_display_name,
  line_picture_url,
  line_linked_at,
  line_link_code,
  line_link_code_expires_at,
  updated_at
`;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const validation = await validateAdminAndPatientId(patientId);

    if (!validation.ok) {
      return validation.response;
    }

    const { data: existingPatient, error: patientError } = await validation.supabaseAdmin
      .from('patients')
      .select(patientSelect)
      .eq('id', patientId)
      .maybeSingle<PatientRow>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    if (existingPatient.line_user_id) {
      return NextResponse.json(
        {
          error: 'Patient already linked LINE account',
          patient: formatPatient(existingPatient),
        },
        { status: 400 }
      );
    }

    const lineLinkCode = generateLineLinkCode();
    const lineLinkCodeExpiresAt = createExpiresAt();

    const { data: updatedPatient, error: updateError } = await validation.supabaseAdmin
      .from('patients')
      .update({
        line_link_code: lineLinkCode,
        line_link_code_expires_at: lineLinkCodeExpiresAt,
      })
      .eq('id', patientId)
      .select(patientSelect)
      .single<PatientRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update patient line link code',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patient: formatPatient(updatedPatient),
      lineLinkCode,
      lineLinkCodeExpiresAt,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const validation = await validateAdminAndPatientId(patientId);

    if (!validation.ok) {
      return validation.response;
    }

    const { data: existingPatient, error: patientError } = await validation.supabaseAdmin
      .from('patients')
      .select(patientSelect)
      .eq('id', patientId)
      .maybeSingle<PatientRow>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const { data: updatedPatient, error: updateError } = await validation.supabaseAdmin
      .from('patients')
      .update({
        line_user_id: null,
        line_display_name: null,
        line_picture_url: null,
        line_linked_at: null,
        line_link_code: null,
        line_link_code_expires_at: null,
      })
      .eq('id', patientId)
      .select(patientSelect)
      .single<PatientRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to unlink LINE account',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      unlinked: true,
      patient: formatPatient(updatedPatient),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
