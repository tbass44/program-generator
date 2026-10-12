import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type RentalStatusDb = 'rental_requested' | 'renting' | 'rental_returned';
type RentalStatusLabel = 'レンタル希望' | 'レンタル中' | 'レンタル終了';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type RentalRow = {
  id: string;
  patient_id: string;
  status: RentalStatusDb;
  reason: string | null;
  rental_started_at: string | null;
  rental_returned_at: string | null;
  updated_at: string;
};

type UpdateRentalBody = {
  status?: unknown;
  reason?: unknown;
  rentalStartedAt?: unknown;
  rentalReturnedAt?: unknown;
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

function getPatientIdFromRequest(request: Request, paramId: string) {
  if (paramId && isUuid(paramId)) {
    return paramId;
  }

  const pathname = new URL(request.url).pathname;
  const pathMatch = pathname.match(/\/api\/admin\/patients\/([0-9a-f-]{36})\/rentals/i);
  const pathValue = pathMatch?.[1] ?? '';

  if (pathValue && isUuid(pathValue)) {
    return pathValue;
  }

  return '';
}

function createSupabaseAdminClient() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
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

function toDbStatus(status: unknown): RentalStatusDb | null {
  switch (status) {
    case 'レンタル希望':
      return 'rental_requested';
    case 'レンタル中':
      return 'renting';
    case 'レンタル終了':
      return 'rental_returned';
    default:
      return null;
  }
}

function toLabelStatus(status: RentalStatusDb): RentalStatusLabel {
  switch (status) {
    case 'rental_requested':
      return 'レンタル希望';
    case 'renting':
      return 'レンタル中';
    case 'rental_returned':
      return 'レンタル終了';
  }
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDateInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function validateIds(patientId: string, recommendationId: string, request: Request, paramId: string) {
  if (!patientId || !isUuid(patientId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Invalid patient id format',
          detail: 'patient id must be UUID',
          receivedId: paramId,
          pathname: new URL(request.url).pathname,
        },
        { status: 400 }
      ),
    };
  }

  if (!recommendationId || !isUuid(recommendationId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Invalid rental id format', detail: 'recommendation id must be UUID' },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const };
}

async function confirmRental(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string,
  recommendationId: string
) {
  const { data: rental, error: rentalError } = await supabaseAdmin
    .from('patient_product_recommendations')
    .select('id, patient_id, status, reason, rental_started_at, rental_returned_at, updated_at')
    .eq('id', recommendationId)
    .eq('patient_id', patientId)
    .in('status', ['rental_requested', 'renting', 'rental_returned'])
    .maybeSingle<RentalRow>();

  return { rental, rentalError };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; recommendationId: string } }
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

    const patientId = getPatientIdFromRequest(request, params.id);
    const recommendationId = params.recommendationId;
    const idValidation = validateIds(patientId, recommendationId, request, params.id);

    if (!idValidation.ok) {
      return idValidation.response;
    }

    const body = (await request.json()) as UpdateRentalBody;
    const status = toDbStatus(body.status);

    if (!status) {
      return NextResponse.json(
        {
          error: 'Invalid rental status',
          detail: 'status must be one of レンタル希望 / レンタル中 / レンタル終了',
        },
        { status: 400 }
      );
    }

    const { rental, rentalError } = await confirmRental(
      adminResult.supabaseAdmin,
      patientId,
      recommendationId
    );

    if (rentalError) {
      return NextResponse.json(
        { error: 'Failed to fetch rental', detail: rentalError.message },
        { status: 500 }
      );
    }

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const rentalStartedAt = normalizeDateInput(body.rentalStartedAt) ?? rental.rental_started_at ?? rental.updated_at;
    const rentalReturnedAt = status === 'rental_returned' ? normalizeDateInput(body.rentalReturnedAt) ?? now : null;

    const { data: updatedRental, error: updateError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .update({
        status,
        reason: normalizeOptionalText(body.reason),
        rental_started_at: rentalStartedAt,
        rental_returned_at: rentalReturnedAt,
        updated_at: now,
      })
      .eq('id', recommendationId)
      .eq('patient_id', patientId)
      .select('id, patient_id, status, reason, rental_started_at, rental_returned_at, updated_at')
      .single<RentalRow>();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update rental', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rental: {
        id: updatedRental.id,
        patientId: updatedRental.patient_id,
        status: toLabelStatus(updatedRental.status),
        reason: updatedRental.reason ?? '',
        rentalStartedAt: updatedRental.rental_started_at,
        rentalReturnedAt: updatedRental.rental_returned_at,
        updatedAt: updatedRental.updated_at,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; recommendationId: string } }
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

    const patientId = getPatientIdFromRequest(request, params.id);
    const recommendationId = params.recommendationId;
    const idValidation = validateIds(patientId, recommendationId, request, params.id);

    if (!idValidation.ok) {
      return idValidation.response;
    }

    const { rental, rentalError } = await confirmRental(
      adminResult.supabaseAdmin,
      patientId,
      recommendationId
    );

    if (rentalError) {
      return NextResponse.json(
        { error: 'Failed to fetch rental', detail: rentalError.message },
        { status: 500 }
      );
    }

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('patient_product_recommendations')
      .delete()
      .eq('id', recommendationId)
      .eq('patient_id', patientId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete rental', detail: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true, id: recommendationId });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
