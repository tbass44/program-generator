import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

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

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type AdminProgramDetail = {
  id: string;
  patient_id: string;
  create_mode: 'manual' | 'ai';
  memo: string | null;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  today_task: string | null;
  program_text: string | null;
  created_at: string;
  updated_at: string;
};

type AdminProgramPatient = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
};

type UpdateProgramBody = {
  memo?: unknown;
  summary?: unknown;
  shortTermProgram?: unknown;
  longTermProgram?: unknown;
};

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

function normalizeRequiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildProgramText(params: {
  memo: string | null;
  summary: string;
  shortTermProgram: string;
  longTermProgram: string | null;
}) {
  return [
    params.memo ? ['【メモ】', params.memo].join('\n') : '',
    ['【状態まとめ】', params.summary].join('\n'),
    ['【短期プログラム（3カ月）】', params.shortTermProgram].join('\n'),
    params.longTermProgram ? ['【長期プログラム】', params.longTermProgram].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const programSelect = `
  id,
  patient_id,
  create_mode,
  memo,
  summary,
  short_term_program,
  long_term_program,
  today_task,
  program_text,
  created_at,
  updated_at
`;

function getProgramId(params: { id: string }) {
  const programId = params.id;

  if (!programId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'program id is required' },
        { status: 400 }
      ),
    };
  }

  if (!isUuid(programId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Invalid program id format',
          detail: 'program id must be UUID',
        },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true as const,
    programId,
  };
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

    const parsedProgramId = getProgramId(params);

    if (!parsedProgramId.ok) {
      return parsedProgramId.response;
    }

    const { data: program, error: programError } = await adminResult.supabaseAdmin
      .from('programs')
      .select(programSelect)
      .eq('id', parsedProgramId.programId)
      .maybeSingle<AdminProgramDetail>();

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
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const { data: patient, error: patientError } = await adminResult.supabaseAdmin
      .from('patients')
      .select('id, name, kana, phone')
      .eq('id', program.patient_id)
      .maybeSingle<AdminProgramPatient>();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch program patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      program,
      patient: patient ?? null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const parsedProgramId = getProgramId(params);

    if (!parsedProgramId.ok) {
      return parsedProgramId.response;
    }

    const body = (await request.json()) as UpdateProgramBody;

    const memo = normalizeOptionalText(body.memo);
    const summary = normalizeRequiredText(body.summary);
    const shortTermProgram = normalizeRequiredText(body.shortTermProgram);
    const longTermProgram = normalizeOptionalText(body.longTermProgram);

    if (!summary) {
      return NextResponse.json(
        { error: 'summary is required' },
        { status: 400 }
      );
    }

    if (!shortTermProgram) {
      return NextResponse.json(
        { error: 'shortTermProgram is required' },
        { status: 400 }
      );
    }

    const { data: existingProgram, error: existingProgramError } =
      await adminResult.supabaseAdmin
        .from('programs')
        .select('id')
        .eq('id', parsedProgramId.programId)
        .maybeSingle<{ id: string }>();

    if (existingProgramError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm program',
          detail: existingProgramError.message,
        },
        { status: 500 }
      );
    }

    if (!existingProgram) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const programText = buildProgramText({
      memo,
      summary,
      shortTermProgram,
      longTermProgram,
    });

    const { data: program, error: updateError } = await adminResult.supabaseAdmin
      .from('programs')
      .update({
        memo,
        summary,
        short_term_program: shortTermProgram,
        long_term_program: longTermProgram,
        today_task: null,
        program_text: programText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedProgramId.programId)
      .select(programSelect)
      .single<AdminProgramDetail>();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update program',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ program });
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

    const parsedProgramId = getProgramId(params);

    if (!parsedProgramId.ok) {
      return parsedProgramId.response;
    }

    const { data: existingProgram, error: existingProgramError } =
      await adminResult.supabaseAdmin
        .from('programs')
        .select('id')
        .eq('id', parsedProgramId.programId)
        .maybeSingle<{ id: string }>();

    if (existingProgramError) {
      return NextResponse.json(
        {
          error: 'Failed to confirm program',
          detail: existingProgramError.message,
        },
        { status: 500 }
      );
    }

    if (!existingProgram) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('programs')
      .delete()
      .eq('id', parsedProgramId.programId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete program',
          detail: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deleted: true,
      id: parsedProgramId.programId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
