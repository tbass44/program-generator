import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
type LineResult = { sub?: string };
type RequestBody = { idToken?: unknown };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error('Missing server configuration');
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (typeof body.idToken !== 'string' || body.idToken.length < 1) {
      return NextResponse.json({ error: 'LINE login required' }, { status: 401 });
    }

    // Never trust a browser-supplied patient ID. Verify LINE's ID token.
    const params = new URLSearchParams({
      id_token: body.idToken,
      client_id: required('LINE_CHANNEL_ID'),
    });
    const verified = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return NextResponse.json({ error: 'LINE verification failed' }, { status: 401 });
    const identity = (await verified.json()) as LineResult;
    if (!identity.sub) return NextResponse.json({ error: 'LINE identity unavailable' }, { status: 401 });

    const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: patient, error } = await db.from('patients')
      .select('id, name, kana, phone, line_user_id')
      .eq('line_user_id', identity.sub)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Patient lookup unavailable' }, { status: 503 });
    if (!patient) return NextResponse.json({ error: 'MyCare patient not linked' }, { status: 403 });

    const laravelUrl = new URL(required('MYCARE_LARAVEL_INTERNAL_BASE_URL'));
    const secret = required('MYCARE_BOOKING_HANDOFF_TOKEN');
    if (laravelUrl.protocol !== 'https:' || laravelUrl.username || laravelUrl.password
      || laravelUrl.search || laravelUrl.hash || secret.length < 32) {
      throw new Error('Invalid Laravel server configuration');
    }

    const response = await fetch(new URL('/api/internal/mycare/booking-tickets', laravelUrl.origin), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        name: patient.name,
        kana: patient.kana,
        phone: patient.phone,
        // LINE subject is verified above and bound to this Supabase patient.
        line_user_id: identity.sub,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Reservation handoff unavailable' }, { status: 503 });
    const result = (await response.json()) as { entry_url?: string; expires_in_seconds?: number };
    if (!result.entry_url) throw new Error('Missing handoff URL');
    const target = new URL(result.entry_url);
    // Only a one-time 256-bit ticket issued for the configured Laravel origin
    // may be handed to the browser. No query, fragment, or alternate path.
    if (
      target.origin !== laravelUrl.origin ||
      !/^\/mycare\/reserve\/entry\/[a-f0-9]{64}$/.test(target.pathname) ||
      target.search !== '' ||
      target.hash !== '' ||
      target.username !== '' ||
      target.password !== '' ||
      result.expires_in_seconds !== 300
    ) {
      throw new Error('Invalid handoff URL');
    }
    return NextResponse.json({ entryUrl: target.toString(), expiresInSeconds: 300 }, {
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch {
    return NextResponse.json({ error: 'Reservation handoff unavailable' }, { status: 503 });
  }
}
