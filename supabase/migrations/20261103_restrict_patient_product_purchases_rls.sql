-- ============================================================
-- Restrict patient_product_purchases RLS to authenticated admins
-- ============================================================
-- Problem with the 20261004 migration:
-- "purchases_select_own_or_admin" grants SELECT on all purchases
-- for patients having any line_user_id; it does NOT verify the viewer.
--
-- Patient-facing API routes verify LINE ID tokens on the server,
-- resolve the current patient's id from patients.line_user_id,
-- and use SUPABASE_SERVICE_ROLE_KEY to retrieve only their own rows.
-- Therefore, direct PostgREST SELECT for patients is not required.
--
-- Preserve the existing purchases_admin_all policy, removing only
-- the unsafe policy. Service-role API access is unaffected.
-- ============================================================

begin;

alter table public.patient_product_purchases enable row level security;

drop policy if exists "purchases_select_own_or_admin"
  on public.patient_product_purchases;

commit;

-- Verification (Supabase SQL Editor):
-- select policyname, cmd, roles, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'patient_product_purchases'
-- order by policyname;
--
-- "purchases_select_own_or_admin" should not appear.
-- "purchases_admin_all" should remain.
