import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const BUCKET = 'product-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

type PdfDocument = {
  id: string;
  product_id: string;
  title: string;
  pdf_url: string;
  storage_path: string | null;
  created_at: string;
};

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase configuration is missing');
  return createClient(url, key);
}

async function requireAdmin() {
  const { userId } = auth();
  if (!userId) return { error: 'Not signed in', status: 401 } as const;
  const db = createDb();
  const { data, error } = await db.from('profiles').select('role')
    .eq('clerk_user_id', userId).maybeSingle<{ role: string }>();
  if (error) return { error: 'Failed to verify admin', status: 500 } as const;
  if (!data || data.role !== 'admin') return { error: 'Admin role required', status: 403 } as const;
  return { db } as const;
}

async function productExists(db: ReturnType<typeof createDb>, id: string) {
  return db.from('products').select('id').eq('id', id).maybeSingle<{ id: string }>();
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdmin();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    const { data, error } = await access.db.from('product_pdf_documents')
      .select('id, product_id, title, pdf_url, storage_path, created_at')
      .eq('product_id', params.id).order('created_at', { ascending: true })
      .returns<PdfDocument[]>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'PDF一覧を取得できませんでした' }, { status: 500 });
  }
}

// Each upload adds a document; it never replaces existing PDFs.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdmin();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const productId = params.id;
    if (!isUuid(productId)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    const { data: product, error: productError } = await productExists(access.db, productId);
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const form = await request.formData();
    const file = form.get('file');
    const suppliedTitle = form.get('title');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || file.type !== 'application/pdf')
      return NextResponse.json({ error: '10MB以下のPDFを選択してください' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
      return NextResponse.json({ error: 'PDF形式を確認できませんでした' }, { status: 400 });

    const title = typeof suppliedTitle === 'string' && suppliedTitle.trim()
      ? suppliedTitle.trim().slice(0, 100)
      : file.name.replace(/\.pdf$/i, '').slice(0, 100);
    const path = `${productId}/${randomUUID()}.pdf`;
    const { error: uploadError } = await access.db.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'application/pdf', cacheControl: '3600', upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const pdfUrl = access.db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { data: document, error: insertError } = await access.db.from('product_pdf_documents')
      .insert({ product_id: productId, title, pdf_url: pdfUrl, storage_path: path })
      .select('id, product_id, title, pdf_url, storage_path, created_at')
      .single<PdfDocument>();
    if (insertError) {
      await access.db.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'PDFのアップロードに失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdmin();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    const documentId = new URL(request.url).searchParams.get('documentId');
    if (!documentId || !isUuid(documentId))
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });

    const { data: document, error: selectError } = await access.db.from('product_pdf_documents')
      .select('id, product_id, title, pdf_url, storage_path, created_at')
      .eq('id', documentId).eq('product_id', params.id).maybeSingle<PdfDocument>();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!document) return NextResponse.json({ error: 'PDF not found' }, { status: 404 });

    const { error: deleteError } = await access.db.from('product_pdf_documents')
      .delete().eq('id', documentId).eq('product_id', params.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    // Prevent a deleted legacy PDF from reappearing through older patient screens.
    const { data: product } = await access.db.from('products').select('pdf_url')
      .eq('id', params.id).maybeSingle<{ pdf_url: string | null }>();
    if (product?.pdf_url === document.pdf_url) {
      const { error: clearError } = await access.db.from('products')
        .update({ pdf_url: null }).eq('id', params.id).eq('pdf_url', document.pdf_url);
      if (clearError) console.error('Legacy pdf_url cleanup failed', clearError);
    }

    // Storage cleanup is best effort. Never delete paths outside this product folder.
    if (document.storage_path?.startsWith(`${params.id}/`) &&
        /^[-a-f0-9]+\.pdf$/i.test(document.storage_path.slice(params.id.length + 1))) {
      const { error: removeError } = await access.db.storage.from(BUCKET).remove([document.storage_path]);
      if (removeError) console.error('PDF storage cleanup failed', removeError);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'PDFを削除できませんでした' }, { status: 500 });
  }
}
