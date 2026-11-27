import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RequestBody = { reviewed?: unknown };

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Acknowledgement only, not purchase completion, payment or stock adjustment. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });

    const body = (await request.json()) as RequestBody;
    if (typeof body.reviewed !== 'boolean') {
      return NextResponse.json({ error: 'reviewed must be boolean' }, { status: 400 });
    }
    const supabase = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_user_id', userId)
      .maybeSingle<{ id: string; role: string }>();

    if (profileError) return NextResponse.json({ error: 'Administrator verification failed' }, { status: 500 });
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const reviewedAt = body.reviewed ? new Date().toISOString() : null;
    const { data: updated, error: updateError } = await supabase
      .from('patient_product_recommendations')
      .update({ purchase_request_reviewed_at: reviewedAt })
      .eq('id', params.id)
      .eq('status', 'purchase_requested')
      .select('id, status, purchase_request_reviewed_at')
      .maybeSingle<{ id: string; status: string; purchase_request_reviewed_at: string | null }>();
    if (updateError) return NextResponse.json({ error: 'Could not update purchase review' }, { status: 500 });
    if (!updated) {
      return NextResponse.json({
        error: 'Purchase request no longer exists or was cancelled. Refresh the dashboard.',
      }, { status: 409 });
    }
    return NextResponse.json({
      reviewed: updated.purchase_request_reviewed_at !== null,
      reviewedAt: updated.purchase_request_reviewed_at,
    });
  } catch (error) {
    console.error('Purchase review failed:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
