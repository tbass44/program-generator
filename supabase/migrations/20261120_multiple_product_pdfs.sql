-- Multiple product brochures, one row per PDF. Public product brochures only.
create table if not exists public.product_pdf_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  pdf_url text not null,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (product_id, pdf_url)
);
create index if not exists idx_product_pdf_documents_product_created
  on public.product_pdf_documents (product_id, created_at, id);
alter table public.product_pdf_documents enable row level security;

-- Admin and patient APIs use server-side service role after verifying access.
-- Do not grant browser users direct table access.
revoke all on table public.product_pdf_documents from anon, authenticated;

-- Preserve already uploaded PDFs; copy each legacy URL into a separate document.
-- Existing products.pdf_url is intentionally not dropped at this stage.
insert into public.product_pdf_documents (product_id, title, pdf_url, storage_path)
select p.id, '商品資料', p.pdf_url,
       case
         when p.pdf_url like '%/storage/v1/object/public/product-documents/' || p.id::text || '/%'
         then p.id::text || '/' || split_part(p.pdf_url, '/' || p.id::text || '/', 2)
         else null
       end
from public.products p
where p.pdf_url is not null and p.pdf_url <> ''
on conflict (product_id, pdf_url) do nothing;
