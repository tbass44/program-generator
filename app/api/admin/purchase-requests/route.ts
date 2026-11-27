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
  purchase_request_admin_note: string | null;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** List active purchase requests visible only to verified MyCare administrators. */
export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const reviewFilter = url.searchParams.get('review') ?? 'pending';
    const pageText = url.searchParams.get('page') ?? '1';
    if ((reviewFilter !== 'pending' && reviewFilter !== 'reviewed') ||
        !/^[1-9][0-9]*$/.test(pageText) || Number(pageText) > 100000) {
      return NextResponse.json({ error: 'Invalid review filter or page number' }, { status: 400 });
    }
    const page = Number(pageText);
    const pageSize = 20;
    const search = (url.searchParams.get('search') ?? '').trim();
    if (search.length > 80) {
      return NextResponse.json({ error: 'Search term too long' }, { status: 400 });
    }

    // Resolve matching IDs before filtering recommendations. Searching only a single
    // page would hide matching requests on older pages.
    let searchFilter: string | null = null;
    if (search) {
      const escapedSearch = search.replace(/[\\%_]/g, (value) => `\\${value}`);
      const searchPattern = `%${escapedSearch}%`;
      const [matchingPatients, matchingProducts] = await Promise.all([
        supabase.from('patients').select('id').ilike('name', searchPattern).limit(1001),
        supabase.from('products').select('id').ilike('name', searchPattern).limit(1001),
      ]);
      if (matchingPatients.error || matchingProducts.error) {
        return NextResponse.json({ error: 'Failed to search patients or products' }, { status: 500 });
      }
      if ((matchingPatients.data ?? []).length > 1000 || (matchingProducts.data ?? []).length > 1000) {
        return NextResponse.json({ error: 'Too many search matches; use a more specific term' }, { status: 422 });
      }
      const patientIds = (matchingPatients.data ?? []).map((item) => item.id);
      const productIds = (matchingProducts.data ?? []).map((item) => item.id);
      const parts: string[] = [];
      if (patientIds.length) parts.push(`patient_id.in.(${patientIds.join(',')})`);
      if (productIds.length) parts.push(`product_id.in.(${productIds.join(',')})`);
      searchFilter = parts.join(',');
      if (!searchFilter) {
        return NextResponse.json({
          page, pageSize, total: 0, pendingCount: 0, reviewedCount: 0,
          filteredCount: 0, requests: [], search,
        });
      }
    }

    const makeBaseQuery = () => {
      let query = supabase
        .from('patient_product_recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'purchase_requested');
      if (searchFilter) query = query.or(searchFilter);
      return query;
    };

    const [pendingCountResult, reviewedCountResult] = await Promise.all([
      makeBaseQuery().is('purchase_request_reviewed_at', null),
      makeBaseQuery().not('purchase_request_reviewed_at', 'is', null),
    ]);
    if (pendingCountResult.error || reviewedCountResult.error) {
      return NextResponse.json({ error: 'Failed to count purchase requests' }, { status: 500 });
    }
    const pendingCount = pendingCountResult.count ?? 0;
    const reviewedCount = reviewedCountResult.count ?? 0;
    const filteredCount = reviewFilter === 'pending' ? pendingCount : reviewedCount;
    // Avoid asking PostgREST for ranges beyond the collection.
    if ((page - 1) * pageSize >= filteredCount && filteredCount > 0) {
      return NextResponse.json({
        page, pageSize, total: pendingCount + reviewedCount,
        pendingCount, reviewedCount, filteredCount, requests: [], search,
      });
    }

    let listQuery = supabase
      .from('patient_product_recommendations')
      .select('id, patient_id, product_id, program_id, updated_at, purchase_request_reviewed_at, purchase_request_admin_note')
      .eq('status', 'purchase_requested');
    if (searchFilter) listQuery = listQuery.or(searchFilter);
    listQuery = reviewFilter === 'pending'
      ? listQuery.is('purchase_request_reviewed_at', null)
      : listQuery.not('purchase_request_reviewed_at', 'is', null);
    const { data: requests, error: requestsError } = await listQuery
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
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
      total: pendingCount + reviewedCount,
      pendingCount,
      reviewedCount,
      filteredCount,
      page,
      pageSize,
      search,
      requests: rows.map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        patientName: patients.get(row.patient_id) ?? '患者情報なし',
        productName: row.product_id ? products.get(row.product_id) ?? '商品情報なし' : '商品情報なし',
        updatedAt: row.updated_at,
        reviewedAt: row.purchase_request_reviewed_at,
        adminNote: row.purchase_request_admin_note ?? '',
      })),
    });
  } catch (error) {
    console.error('Admin purchase requests failed:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
