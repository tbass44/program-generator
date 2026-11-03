-- ============================================================
-- Split rental due date and actual return date (2026-11-03)
-- ============================================================
-- 前提：20261012_add_rental_period_columns.sql が適用済み
-- rental_due_at    : 返却予定日（レンタル中・希望も登録可能）
-- rental_returned_at: 実返却日（返却済みのみ使用）
--
-- 既存データ移行：
-- 1. レンタル希望／レンタル中の rental_returned_at はこれまで返却予定日だった。
--    予定日へコピー後に、実返却日をNULLに戻す。
-- 2. レンタル終了の rental_returned_at は触らない。
--    過去に「予定日」が混じっていた可能性があるため、実際の返却日は手動確認する。
-- 3. レンタル終了済みの予定日を推測して埋めない。
-- 4. 既に適用済みでも安全に再実行できるよう、NULLだけを補完する。
-- ============================================================

begin;

alter table public.patient_product_recommendations
  add column if not exists rental_due_at timestamptz;

create index if not exists idx_patient_product_recommendations_rental_due_at
  on public.patient_product_recommendations (rental_due_at);

update public.patient_product_recommendations
set rental_due_at = rental_returned_at
where status in ('rental_requested', 'renting')
  and rental_due_at is null
  and rental_returned_at is not null;

update public.patient_product_recommendations
set rental_returned_at = null
where status in ('rental_requested', 'renting')
  and rental_returned_at is not null;

commit;

-- 確認（必要なときにSQL Editorで実行）
-- select id, status, rental_started_at, rental_due_at, rental_returned_at
-- from public.patient_product_recommendations
-- where status in ('rental_requested', 'renting', 'rental_returned')
-- order by updated_at desc;
