import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Only a verified administrator can edit a private internal purchase request memo.
 * This endpoint does not change the request status, inventory, payment or patient data.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid purchase request ID' }, { status: 400 });

    const body = (await request.json()) as { note?: unknown };
    if (typeof body.note !== 'string' || body.note.length > 2000) {
      return NextResponse.json({ error: 'The memo must be text up to 2000 characters' }, { status: 400 });
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
    if (profileError) {
      return NextResponse.json({ error: 'Administrator verification failed' }, { status: 500 });
    }
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Administrator role required' }, { status: 403 });
    }

    const sanitizedNote = body.note.trim() || null;
    const { data: updated, error: updateError } = await supabase
      .from('patient_product_recommendations')
      .update({ purchase_request_admin_note: sanitizedNote })
      .eq('id', params.id)
      .eq('status', 'purchase_requested')
      .select('id, purchase_request_admin_note')
      .maybeSingle<{ id: string; purchase_request_admin_note: string | null }>();

    if (updateError) return NextResponse.json({ error: 'Could not save purchase request memo' }, { status: 500 });
    if (!updated) {
      return NextResponse.json({
        error: 'Purchase request no longer active. Please refresh the patient page.',
      }, { status: 409 });
    }
    return NextResponse.json({ note: updated.purchase_request_admin_note ?? '' });
  } catch (error) {
    console.error('Purchase request note update failed:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
