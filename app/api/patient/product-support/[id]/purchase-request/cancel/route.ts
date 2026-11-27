import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RequestBody = { idToken?: unknown };
type LineVerifyResponse = { sub?: string; error?: string; error_description?: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

async function verifyLineIdToken(idToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    id_token: idToken,
    client_id: requiredEnv('LINE_CHANNEL_ID'),
  });
  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as LineVerifyResponse;
  return data.sub ?? null;
}

/**
 * POST: undo a purchase request for a product belonging to the LINE-linked patient.
 * Does not create orders, charge payment, change stock or send notifications.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Invalid recommendation id' }, { status: 400 });
    }
    const body = (await request.json()) as RequestBody;
    if (typeof body.idToken !== 'string' || !body.idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }
    const lineUserId = await verifyLineIdToken(body.idToken);
    if (!lineUserId) {
      return NextResponse.json({ error: 'LINE authentication failed' }, { status: 401 });
    }

    const supabase = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('line_user_id', lineUserId)
      .maybeSingle<{ id: string }>();
    if (patientError) {
      return NextResponse.json({ error: 'Failed to resolve patient' }, { status: 500 });
    }
    if (!patient) {
      return NextResponse.json({ error: 'Patient not linked' }, { status: 404 });
    }

    // Never accept patient_id or product_id from the request body. Only update
    // a recommendation that belongs to the verified LINE-linked patient.
    const { data: updated, error: updateError } = await supabase
      .from('patient_product_recommendations')
      .update({ status: 'recommended', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('patient_id', patient.id)
      .eq('status', 'purchase_requested')
      .not('product_id', 'is', null)
      .select('id, status, updated_at')
      .maybeSingle<{ id: string; status: string; updated_at: string }>();
    if (updateError) {
      return NextResponse.json({ error: 'Failed to cancel purchase request' }, { status: 500 });
    }
    if (updated) {
      return NextResponse.json({ cancelled: true, alreadyCancelled: false, item: updated });
    }

    // Idempotency for repeated taps or concurrent cancellation requests.
    const { data: existing, error: lookupError } = await supabase
      .from('patient_product_recommendations')
      .select('id, status, updated_at')
      .eq('id', params.id)
      .eq('patient_id', patient.id)
      .maybeSingle<{ id: string; status: string; updated_at: string }>();
    if (lookupError) {
      return NextResponse.json({ error: 'Failed to confirm purchase request' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Product recommendation not found' }, { status: 404 });
    }
    if (existing.status === 'recommended') {
      return NextResponse.json({ cancelled: true, alreadyCancelled: true, item: existing });
    }
    return NextResponse.json(
      { error: 'This purchase request cannot be cancelled in its current state' },
      { status: 409 }
    );
  } catch (error) {
    console.error('Cancel purchase request failed:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
