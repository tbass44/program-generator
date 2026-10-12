-- ============================================================
-- Add rental period columns to patient_product_recommendations
-- ============================================================
-- 目的：
-- これまでレンタル履歴では created_at / updated_at を開始日・返却日相当として表示していたが、
-- 実運用ではレンタル開始日・返却日を個別に管理したい。
-- そのため、patient_product_recommendations にレンタル専用の日付カラムを追加する。
-- ============================================================

alter table patient_product_recommendations
  add column if not exists rental_started_at timestamptz,
  add column if not exists rental_returned_at timestamptz;

create index if not exists idx_patient_product_recommendations_rental_started_at
  on patient_product_recommendations(rental_started_at desc);

create index if not exists idx_patient_product_recommendations_rental_returned_at
  on patient_product_recommendations(rental_returned_at desc);

-- 既存のレンタル履歴は、初期値として作成日をレンタル開始日に入れる。
-- 返却済みのものは、更新日を返却日相当に入れる。
update patient_product_recommendations
set rental_started_at = coalesce(rental_started_at, created_at)
where status in ('rental_requested', 'renting', 'rental_returned')
  and rental_started_at is null;

update patient_product_recommendations
set rental_returned_at = coalesce(rental_returned_at, updated_at)
where status = 'rental_returned'
  and rental_returned_at is null;
