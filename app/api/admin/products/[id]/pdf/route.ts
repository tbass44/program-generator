import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const BUCKET = 'product-documents';
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase configuration missing');
  return createClient(url, key);
}

async function requireAdmin() {
  const { userId } = auth();
  if (!userId) return { error: 'Not signed in', status: 401 } as const;
  const db = storageClient();
  const { data, error } = await db.from('profiles')
    .select('role').eq('clerk_user_id', userId).maybeSingle<{ role: string }>();
  if (error) return { error: 'Failed to verify admin', status: 500 } as const;
  if (!data || data.role !== 'admin') return { error: 'Admin role required', status: 403 } as const;
  return { db } as const;
}

async function getExisting(db: ReturnType<typeof storageClient>, id: string) {
  return db.from('products').select('pdf_url').eq('id', id)
    .maybeSingle<{ pdf_url: string | null }>();
}

function ownedStoragePath(url: string | null, id: string) {
  if (!url) return null;
  const prefix = storageClient().storage.from(BUCKET).getPublicUrl(`${id}/`).data.publicUrl;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  if (!/^[0-9a-f-]+\.pdf$/i.test(path)) return null;
  return `${id}/${path}`;
}

// Only public product brochures should be stored here; never upload patient records.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdmin();
    if (!('db' in access) || !access.db)
      return NextResponse.json({ error: access.error }, { status: access.status });
    const id = params.id;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });

    const { data: existing, error: readError } = await getExisting(access.db, id);
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_PDF_BYTES ||
        file.type !== 'application/pdf') {
      return NextResponse.json({ error: '10MB以下のPDFファイルを選択してください' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
      return NextResponse.json({ error: 'PDFファイルの内容が正しくありません' }, { status: 400 });
    }

    const path = `${id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await access.db.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const pdfUrl = access.db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await access.db.from('products').update({ pdf_url: pdfUrl }).eq('id', id);
    if (saveError) {
      await access.db.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }
    const previousPath = ownedStoragePath(existing.pdf_url, id);
    if (previousPath) {
      // Best effort: do not roll back a valid replacement if old-file cleanup fails.
      const { error } = await access.db.storage.from(BUCKET).remove([previousPath]);
      if (error) console.error('Old product PDF cleanup failed', error);
    }
    return NextResponse.json({ pdfUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'PDFの登録に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdmin();
    if (!('db' in access) || !access.db)
      return NextResponse.json({ error: access.error }, { status: access.status });
    const id = params.id;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    const { data: existing, error: readError } = await getExisting(access.db, id);
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const { error: saveError } = await access.db.from('products').update({ pdf_url: null }).eq('id', id);
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
    const previousPath = ownedStoragePath(existing.pdf_url, id);
    if (previousPath) {
      const { error } = await access.db.storage.from(BUCKET).remove([previousPath]);
      if (error) console.error('Product PDF cleanup failed', error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'PDFの削除に失敗しました' }, { status: 500 });
  }
}
