import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
};

type PurchaseRow = {
  id: string;
  patient_id: string;
};

type PurchaseRequestBody = {
  productId?: unknown;
  recommendationId?: unknown;
  programId?: unknown;
  purchasedAt?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  totalPrice?: unknown;
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

function toNullableUuid(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!isUuid(normalized)) {
    return undefined;
  }

  return normalized;
}

function toPositiveInteger(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toNonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeNote(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateParams(patientId: string, purchaseId: string) {
  if (!patientId || !isUuid(patientId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Invalid patient id format', detail: 'patient id must be UUID' },
        { status: 400 }
      ),
    };
  }

  if (!purchaseId || !isUuid(purchaseId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Invalid purchase id format', detail: 'purchase id must be UUID' },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const };
}

async function fetchPurchase(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  patientId: string,
  purchaseId: string
) {
  return supabaseAdmin
    .from('patient_product_purchases')
    .select('id, patient_id')
    .eq('id', purchaseId)
    .eq('patient_id', patientId)
    .maybeSingle<PurchaseRow>();
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; purchaseId: string } }
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
    const purchaseId = params.purchaseId;
    const paramResult = validateParams(patientId, purchaseId);

    if (!paramResult.ok) {
      return paramResult.response;
    }

    const { data: purchase, error: fetchError } = await fetchPurchase(
      adminResult.supabaseAdmin,
      patientId,
      purchaseId
    );

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch purchase', detail: fetchError.message },
        { status: 500 }
      );
    }

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PurchaseRequestBody;
    const recommendationId = toNullableUuid(body.recommendationId);
    const productIdFromBody = toNullableUuid(body.productId);
    const programIdFromBody = toNullableUuid(body.programId);
    const quantity = toPositiveInteger(body.quantity, 1);
    const unitPrice = toNonNegativeInteger(body.unitPrice);
    const totalPriceFromBody = toNonNegativeInteger(body.totalPrice);
    const purchasedAt = normalizeDateTime(body.purchasedAt);
    const note = normalizeNote(body.note);

    if (recommendationId === undefined || productIdFromBody === undefined || programIdFromBody === undefined) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    if (quantity === null) {
      return NextResponse.json(
        { error: 'quantity must be positive integer' },
        { status: 400 }
      );
    }

    if (unitPrice === undefined || totalPriceFromBody === undefined) {
      return NextResponse.json(
        { error: 'price must be non-negative integer' },
        { status: 400 }
      );
    }

    if (!purchasedAt) {
      return NextResponse.json(
        { error: 'Invalid purchasedAt' },
        { status: 400 }
      );
    }

    let productId = productIdFromBody;
    let programId = programIdFromBody;

    if (recommendationId) {
      const { data: recommendation, error: recommendationError } = await adminResult.supabaseAdmin
        .from('patient_product_recommendations')
        .select('id, patient_id, product_id, program_id')
        .eq('id', recommendationId)
        .eq('patient_id', patientId)
        .maybeSingle<{ id: string; patient_id: string; product_id: string | null; program_id: string | null }>();

      if (recommendationError) {
        return NextResponse.json(
          { error: 'Failed to fetch recommendation', detail: recommendationError.message },
          { status: 500 }
        );
      }

      if (!recommendation) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      productId = productId ?? recommendation.product_id;
      programId = programId ?? recommendation.program_id;
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'productId or recommendationId is required' },
        { status: 400 }
      );
    }

    const totalPrice = totalPriceFromBody ?? (unitPrice !== null ? unitPrice * quantity : null);

    const { data: updatedPurchase, error: updateError } = await adminResult.supabaseAdmin
      .from('patient_product_purchases')
      .update({
        product_id: productId,
        recommendation_id: recommendationId,
        program_id: programId,
        purchased_at: purchasedAt,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase.id)
      .eq('patient_id', patientId)
      .select('id')
      .single<{ id: string }>();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update purchase', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ purchase: updatedPurchase });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; purchaseId: string } }
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
    const purchaseId = params.purchaseId;
    const paramResult = validateParams(patientId, purchaseId);

    if (!paramResult.ok) {
      return paramResult.response;
    }

    const { data: purchase, error: fetchError } = await fetchPurchase(
      adminResult.supabaseAdmin,
      patientId,
      purchaseId
    );

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch purchase', detail: fetchError.message },
        { status: 500 }
      );
    }

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminResult.supabaseAdmin
      .from('patient_product_purchases')
      .delete()
      .eq('id', purchase.id)
      .eq('patient_id', patientId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete purchase', detail: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true, id: purchase.id });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
