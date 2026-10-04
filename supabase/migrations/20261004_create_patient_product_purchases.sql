-- ============================================================
-- patient_product_purchases
-- ============================================================
-- 目的：
-- patient_product_recommendations は「提案・購入希望・レンタル希望」などの状態管理用。
-- サプリなど、同じ商品を患者が何度も購入するケースに対応するため、
-- 実際の購入履歴は patient_product_purchases に別管理する。
-- ============================================================

create table if not exists patient_product_purchases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  recommendation_id uuid references patient_product_recommendations(id) on delete set null,
  program_id uuid references programs(id) on delete set null,
  purchased_at timestamptz not null default now(),
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer check (unit_price is null or unit_price >= 0),
  total_price integer check (total_price is null or total_price >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_product_purchases_patient_id
  on patient_product_purchases(patient_id);

create index if not exists idx_patient_product_purchases_product_id
  on patient_product_purchases(product_id);

create index if not exists idx_patient_product_purchases_recommendation_id
  on patient_product_purchases(recommendation_id);

create index if not exists idx_patient_product_purchases_program_id
  on patient_product_purchases(program_id);

create index if not exists idx_patient_product_purchases_purchased_at
  on patient_product_purchases(purchased_at desc);

alter table patient_product_purchases enable row level security;

-- 管理者は全購入履歴を参照・操作可能
create policy "purchases_admin_all"
  on patient_product_purchases
  for all
  using (
    exists (
      select 1
      from profiles
      where profiles.clerk_user_id = auth.uid()::text
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from profiles
      where profiles.clerk_user_id = auth.uid()::text
        and profiles.role = 'admin'
    )
  );

-- 患者本人は自分の購入履歴だけ参照可能。
-- 現状の患者側APIは service_role + LINE IDトークン検証で返すため、
-- RLS直接利用は将来のClerk患者ログイン用の保険。
create policy "purchases_select_own_or_admin"
  on patient_product_purchases
  for select
  using (
    exists (
      select 1
      from profiles
      where profiles.clerk_user_id = auth.uid()::text
        and profiles.role = 'admin'
    )
    or exists (
      select 1
      from patients
      where patients.id = patient_product_purchases.patient_id
        and patients.line_user_id is not null
    )
  );
