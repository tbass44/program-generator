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

    if (!patientId || !isUuid(patientId)) {
      return NextResponse.json(
        { error: 'Invalid patient id format', detail: 'patient id must be UUID' },
        { status: 400 }
      );
    }

    if (!purchaseId || !isUuid(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase id format', detail: 'purchase id must be UUID' },
        { status: 400 }
      );
    }

    const { data: purchase, error: fetchError } = await adminResult.supabaseAdmin
      .from('patient_product_purchases')
      .select('id, patient_id')
      .eq('id', purchaseId)
      .eq('patient_id', patientId)
      .maybeSingle<PurchaseRow>();

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
