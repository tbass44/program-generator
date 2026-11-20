-- Product brochures are publicly accessible files, not patient-specific documents.
alter table public.products add column if not exists pdf_url text;

-- Storage bucket for PDF brochures; upload/update/delete happens through the admin API
-- using the service role key after Clerk admin authorization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-documents', 'product-documents', true, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
