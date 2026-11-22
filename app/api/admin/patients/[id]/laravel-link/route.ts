import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const numericId = /^[1-9][0-9]{0,18}$/;
type LinkBody = { laravelUserId?: unknown; expectedName?: unknown; confirmed?: unknown };
type LaravelPatient = { id: string; name: string | null; kana: string | null; phone: string | null };

function env(key: string) {
  const value = process.env[key];
  if (!value) throw new Error('Missing service configuration');
  return value;
}

async function authorize(patientId: string) {
  const { userId } = auth();
  if (!userId) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!uuid.test(patientId)) return { ok: false as const, response: NextResponse.json({ error: 'Invalid ID' }, { status: 400 }) };

  const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: profile, error: permissionError } = await db.from('profiles')
    .select('role').eq('clerk_user_id', userId).maybeSingle();
  if (permissionError) return { ok: false as const, response: NextResponse.json({ error: 'Permission lookup failed' }, { status: 503 }) };
  if (profile?.role !== 'admin') return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const { data: patient, error: patientError } = await db.from('patients')
    .select('id, name, kana, phone, line_user_id').eq('id', patientId).maybeSingle();
  if (patientError) return { ok: false as const, response: NextResponse.json({ error: 'Patient lookup failed' }, { status: 503 }) };
  if (!patient) return { ok: false as const, response: NextResponse.json({ error: 'Patient not found' }, { status: 404 }) };
  return { ok: true as const, db, patient, userId };
}

async function lookupLaravel(id: string): Promise<LaravelPatient | null> {
  const url = new URL(env('MYCARE_LARAVEL_INTERNAL_BASE_URL'));
  const token = env('MYCARE_LARAVEL_PATIENT_LOOKUP_TOKEN');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || token.length < 32) {
    throw new Error('Invalid Laravel service configuration');
  }
  const response = await fetch(new URL('/api/internal/mycare/patients/' + id, url.origin), {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Laravel lookup failed');
  const data = (await response.json()) as { patient?: LaravelPatient };
  if (data.patient?.id !== id) throw new Error('Patient ID mismatch');
  return data.patient;
}

const fields = 'id, patient_id, external_user_id, link_status, verified_at';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await authorize(params.id);
    if (!admin.ok) return admin.response;
    const { data, error } = await admin.db.from('patient_external_ids')
      .select(fields).eq('patient_id', params.id).eq('source_system', 'chirothird')
      .eq('link_status', 'verified').maybeSingle();
    if (error) return NextResponse.json({ error: 'Mapping table unavailable' }, { status: 503 });
    return NextResponse.json({ link: data ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Link service unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await authorize(params.id);
    if (!admin.ok) return admin.response;
    const body = (await request.json()) as LinkBody;
    if (body.confirmed === false && typeof body.laravelUserId === 'string' && numericId.test(body.laravelUserId)) {
      const preview = await lookupLaravel(body.laravelUserId);
      if (!preview) return NextResponse.json({ error: 'Laravel patient not found' }, { status: 404 });
      return NextResponse.json({ preview }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (typeof body.laravelUserId !== 'string' || !numericId.test(body.laravelUserId)
      || typeof body.expectedName !== 'string' || !body.expectedName.trim()
      || body.confirmed !== true) {
      return NextResponse.json({ error: 'Patient ID, name and explicit confirmation required' }, { status: 400 });
    }
    if (!admin.patient.line_user_id) return NextResponse.json({ error: 'MyCare LINE link required' }, { status: 409 });

    const id = body.laravelUserId;
    const laravel = await lookupLaravel(id);
    if (!laravel || laravel.name !== body.expectedName.trim()) {
      return NextResponse.json({ error: 'Patient identity changed; recheck before linking' }, { status: 409 });
    }

    const { data: existing, error: checkError } = await admin.db.from('patient_external_ids')
      .select('id').eq('source_system', 'chirothird').eq('link_status', 'verified')
      .or('patient_id.eq.' + params.id + ',external_user_id.eq.' + id).limit(1);
    if (checkError) return NextResponse.json({ error: 'Mapping verification unavailable' }, { status: 503 });
    if (existing?.length) return NextResponse.json({ error: 'Already mapped' }, { status: 409 });

    const { data, error } = await admin.db.from('patient_external_ids').insert({
      patient_id: params.id,
      source_system: 'chirothird',
      external_user_id: id,
      link_status: 'verified',
      verification_method: 'admin_manual',
      verified_by_clerk_user_id: admin.userId,
    }).select(fields).single();
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'Already mapped' : 'Save failed' }, { status: error.code === '23505' ? 409 : 503 });
    return NextResponse.json({ link: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Link confirmation unavailable' }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await authorize(params.id);
    if (!admin.ok) return admin.response;
    const body = (await request.json()) as { confirmRevoke?: unknown };
    if (body.confirmRevoke !== true) return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
    const now = new Date().toISOString();
    const { data, error } = await admin.db.from('patient_external_ids')
      .update({ link_status: 'revoked', revoked_at: now, updated_at: now })
      .eq('patient_id', params.id).eq('source_system', 'chirothird')
      .eq('link_status', 'verified').select('id');
    if (error) return NextResponse.json({ error: 'Revoke failed' }, { status: 503 });
    if (!data?.length) return NextResponse.json({ error: 'No mapping' }, { status: 404 });
    return NextResponse.json({ revoked: true });
  } catch {
    return NextResponse.json({ error: 'Revocation unavailable' }, { status: 503 });
  }
}
