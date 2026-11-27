import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RecommendationRow = {
  id: string;
  patient_id: string;
  product_id: string | null;
  program_id: string | null;
  updated_at: string;
  purchase_request_reviewed_at: string | null;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** List active purchase requests visible only to verified MyCare administrators. */
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_user_id', userId)
      .maybeSingle<{ id: string; role: string }>();
    if (profileError) {
      return NextResponse.json({ error: 'Failed to verify administrator' }, { status: 500 });
    }
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Fetch count separately so the screen never implies the first 30 are all requests.
    const { data: requests, error: requestsError, count } = await supabase
      .from('patient_product_recommendations')
      .select('id, patient_id, product_id, program_id, updated_at, purchase_request_reviewed_at', { count: 'exact' })
      .eq('status', 'purchase_requested')
      .order('updated_at', { ascending: false })
      .limit(30);
    if (requestsError) {
      return NextResponse.json({ error: 'Failed to fetch purchase requests' }, { status: 500 });
    }

    const rows = (requests ?? []) as RecommendationRow[];
    const patientIds = Array.from(new Set(rows.map((row) => row.patient_id)));
    const productIds = Array.from(new Set(rows.map((row) => row.product_id).filter((id): id is string => Boolean(id))));

    const [patientsResult, productsResult] = await Promise.all([
      patientIds.length
        ? supabase.from('patients').select('id, name').in('id', patientIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? supabase.from('products').select('id, name').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (patientsResult.error || productsResult.error) {
      return NextResponse.json({ error: 'Failed to fetch product or patient names' }, { status: 500 });
    }

    const patients = new Map((patientsResult.data ?? []).map((row) => [row.id, row.name]));
    const products = new Map((productsResult.data ?? []).map((row) => [row.id, row.name]));
    return NextResponse.json({
      total: count ?? rows.length,
      requests: rows.map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        patientName: patients.get(row.patient_id) ?? '患者情報なし',
        productName: row.product_id ? products.get(row.product_id) ?? '商品情報なし' : '商品情報なし',
        updatedAt: row.updated_at,
        reviewedAt: row.purchase_request_reviewed_at,
      })),
    });
  } catch (error) {
    console.error('Admin purchase requests failed:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
