-- ============================================================
-- program-generator MVP database schema
-- ============================================================
-- このファイルの目的：
-- 整体院向けの患者管理・改善プログラム管理アプリで使う
-- Supabase PostgreSQL のテーブル、型、RLS、インデックスを定義する。
--
-- MVPで扱う主な機能：
-- - 管理者 / 患者ユーザーの判別
-- - 患者管理
-- - 改善プログラム管理
-- - 商品マスタ管理
-- - 患者ごとの商品提案管理
-- - 通院履歴
-- - 回数券 / サブスクなどのプラン管理
-- - 購入履歴
-- - レンタル履歴
--
-- 認証について：
-- - アプリ側の認証は Clerk を使う想定
-- - Clerk の userId を profiles.clerk_user_id に保存する
-- - Supabase RLS では auth.jwt()->>'sub' を Clerk userId として扱う
-- - 実運用では Clerk と Supabase JWT連携の設定が必要
--
-- 注意：
-- - まずはMVP用の初期スキーマ
-- - AI生成、LINE送信、PDF生成、決済はこの時点では含めない
-- - 管理者の初回 profiles 作成は、Supabase SQL Editor または service role 経由で行う想定
-- ============================================================

-- UUID生成に使う拡張機能。
-- gen_random_uuid() を使えるようにする。
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================
-- ENUMは、決まった値だけを保存したい項目に使う。
-- 例：role は admin / patient 以外を入れない。
--
-- do $$ begin ... exception when duplicate_object ... end $$;
-- としているのは、同じSQLを再実行してもエラーになりにくくするため。
-- ============================================================

-- ユーザーの役割。
-- admin：管理側を使う人
-- patient：患者側画面を見る人
-- ※MVPでは admin がほぼ全操作、patient は自分の情報閲覧が中心。
do $$ begin
  create type user_role as enum ('admin', 'patient');
exception
  when duplicate_object then null;
end $$;

-- 商品カテゴリ。
-- UI上の表示名とは分けて、DBでは英語の固定値で保存する。
-- physical_sleep：物理療法（睡眠）
-- nutrition：栄養療法
-- exercise：運動療法
-- skincare：スキンケア
do $$ begin
  create type product_category as enum (
    'physical_sleep',
    'nutrition',
    'exercise',
    'skincare'
  );
exception
  when duplicate_object then null;
end $$;

-- 商品マスタの状態。
-- active：提案候補として使う
-- inactive：廃番・一時停止・現在は提案しない
--
-- これは患者ごとの提案状態ではなく、商品そのものの有効/無効。
do $$ begin
  create type product_master_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

-- 改善プログラムの作成方法。
-- MVPでは manual を使う。
-- ai は将来のAI生成機能用に残す。
do $$ begin
  create type program_create_mode as enum ('manual', 'ai');
exception
  when duplicate_object then null;
end $$;

-- 患者ごとの商品提案ステータス。
-- 商品マスタの active/inactive とは別。
--
-- recommended：提案中
-- rental_requested：レンタル希望
-- renting：レンタル中
-- purchase_requested：購入希望
do $$ begin
  create type patient_product_status as enum (
    'recommended',
    'rental_requested',
    'renting',
    'purchase_requested'
  );
exception
  when duplicate_object then null;
end $$;

-- プラン種別。
-- ticket：回数券
-- subscription：月額などのサブスク
do $$ begin
  create type plan_type as enum ('ticket', 'subscription');
exception
  when duplicate_object then null;
end $$;

-- プランの状態。
-- active：利用中
-- expired：期限切れ
-- cancelled：解約・停止
do $$ begin
  create type plan_status as enum ('active', 'expired', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- レンタルの状態。
-- rental_requested：レンタル希望
-- renting：レンタル中
-- returned：返却済み
-- cancelled：キャンセル
-- reserved：予約済み・取り置き用
do $$ begin
  create type rental_status as enum (
    'reserved',
    'rental_requested',
    'renting',
    'returned',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- 2. TABLES
-- ============================================================
-- MVPで必要なテーブルを作成する。
-- 基本方針：
-- - id は uuid
-- - created_at / updated_at を持つ
-- - 患者に紐づくデータは patient_id を持つ
-- - 患者データは RLS で本人と管理者だけ見えるようにする
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
-- Clerkユーザーとアプリ内ユーザー権限を紐づけるテーブル。
--
-- clerk_user_id：Clerk側の userId
-- role：admin / patient
--
-- 注意：
-- patients.user_id は、この profiles.id を参照する。
-- 患者本人ログインを使う場合、患者ごとに profile を作る。
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  role user_role not null default 'patient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------
-- 患者の基本情報。
--
-- user_id：患者本人の profiles.id
--         患者ログインをまだ作らない場合は null でもよい。
-- name：患者名
-- memo：管理者用メモ
-- ------------------------------------------------------------
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
-- 商品マスタ。
-- 商品そのものを登録・管理するテーブル。
--
-- category：商品カテゴリ
-- target_concerns：対象の悩み
-- recommendation_template：提案理由テンプレート
-- inventory_count：在庫数。レンタル品や院内在庫の管理に使う。
-- status：商品マスタとして有効か無効か
-- ------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category product_category not null,
  description text,
  target_concerns text,
  recommendation_template text,
  price integer not null default 0 check (price >= 0),
  inventory_count integer not null default 0 check (inventory_count >= 0),
  product_url text,
  status product_master_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- programs
-- ------------------------------------------------------------
-- 患者ごとの改善プログラム。
-- MVPでは手動入力がメイン。
--
-- create_mode：manual / ai
-- memo：状態メモ
-- summary：状態まとめ
-- short_term_program：短期プログラム。主に3カ月想定。
-- long_term_program：長期プログラム
-- today_task：今日やること
-- program_text：LINE送信用などにまとめた全文を保存したい場合に使う
-- ------------------------------------------------------------
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  create_mode program_create_mode not null default 'manual',
  memo text,
  summary text,
  short_term_program text,
  long_term_program text,
  today_task text,
  program_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- patient_product_recommendations
-- ------------------------------------------------------------
-- 患者ごとの商品提案管理。
--
-- 例：
-- 山田さんにヘルスウェーブを提案中
-- 佐藤さんが枕レンタル希望
-- 田中さんがナノカル購入希望
--
-- product_id は商品マスタへの参照。
-- program_id は、どの改善プログラムに関連した提案かを紐づける。
-- ------------------------------------------------------------
create table if not exists patient_product_recommendations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  program_id uuid references programs(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  category product_category not null,
  reason text,
  status patient_product_status not null default 'recommended',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- visits
-- ------------------------------------------------------------
-- 通院履歴。
--
-- visit_date：来院日
-- note：施術メモ、簡易カルテ、申し送りなど
-- ------------------------------------------------------------
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- plans
-- ------------------------------------------------------------
-- 患者ごとのプラン管理。
-- 回数券・サブスクをまとめて扱う。
--
-- type：ticket / subscription
-- total_count：回数券の総回数。サブスクでは null でもよい。
-- remaining_count：残り回数。サブスクでは null でもよい。
-- start_date / end_date：契約期間や有効期限
-- ------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  type plan_type not null,
  name text not null,
  total_count integer check (total_count is null or total_count >= 0),
  remaining_count integer check (remaining_count is null or remaining_count >= 0),
  start_date date,
  end_date date,
  status plan_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ticket_usages
-- ------------------------------------------------------------
-- 回数券の利用履歴。
--
-- plan_id：対象の回数券プラン
-- used_at：利用日時
-- note：利用時メモ
-- ------------------------------------------------------------
create table if not exists ticket_usages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  used_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- purchases
-- ------------------------------------------------------------
-- 商品購入履歴。
--
-- product_id：商品マスタへの参照。削除された場合に備えて null 許可。
-- product_name：購入時の商品名を残すためのスナップショット。
-- price：購入時価格を残す。
-- ------------------------------------------------------------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  price integer check (price is null or price >= 0),
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- rentals
-- ------------------------------------------------------------
-- レンタル履歴。
--
-- product_id：商品マスタへの参照
-- item_name：貸し出した商品の名前をスナップショットとして残す
-- start_date / end_date：レンタル開始日・返却予定日または返却日
-- status：レンタル希望 / レンタル中 / 返却済みなど
-- ------------------------------------------------------------
create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  item_name text not null,
  start_date date,
  end_date date,
  status rental_status not null default 'rental_requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. updated_at 自動更新
-- ============================================================
-- updated_at を持つテーブルは、UPDATE時に自動で now() にする。
-- アプリ側で毎回 updated_at を入れ忘れてもよいようにする。
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 各テーブルに updated_at 更新トリガーを設定。
-- drop trigger if exists を入れているので、SQLを再実行しても作り直せる。
drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

drop trigger if exists set_patients_updated_at on patients;
create trigger set_patients_updated_at
before update on patients
for each row execute function set_updated_at();

drop trigger if exists set_products_updated_at on products;
create trigger set_products_updated_at
before update on products
for each row execute function set_updated_at();

drop trigger if exists set_programs_updated_at on programs;
create trigger set_programs_updated_at
before update on programs
for each row execute function set_updated_at();

drop trigger if exists set_patient_product_recommendations_updated_at on patient_product_recommendations;
create trigger set_patient_product_recommendations_updated_at
before update on patient_product_recommendations
for each row execute function set_updated_at();

drop trigger if exists set_visits_updated_at on visits;
create trigger set_visits_updated_at
before update on visits
for each row execute function set_updated_at();

drop trigger if exists set_plans_updated_at on plans;
create trigger set_plans_updated_at
before update on plans
for each row execute function set_updated_at();

drop trigger if exists set_rentals_updated_at on rentals;
create trigger set_rentals_updated_at
before update on rentals
for each row execute function set_updated_at();

-- ============================================================
-- 4. RLS helper functions
-- ============================================================
-- RLSポリシーを読みやすくするための補助関数。
--
-- current_clerk_user_id()
--   現在ログインしている Clerk userId を JWT から取り出す。
--
-- current_profile_id()
--   Clerk userId から profiles.id を取得する。
--
-- is_admin()
--   現在のユーザーが admin か判定する。
--
-- is_patient_owner(patient_id)
--   対象患者データが現在ユーザー本人のものか判定する。
-- ============================================================

create or replace function current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from profiles
  where clerk_user_id = current_clerk_user_id()
  limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where clerk_user_id = current_clerk_user_id()
      and role = 'admin'
  );
$$;

create or replace function is_patient_owner(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from patients
    where id = target_patient_id
      and user_id = current_profile_id()
  );
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
-- Supabaseでは、RLSを有効化しないとポリシーが効かない。
-- 患者データを扱うため、基本的に全テーブルでRLSを有効にする。
-- ============================================================

alter table profiles enable row level security;
alter table patients enable row level security;
alter table products enable row level security;
alter table programs enable row level security;
alter table patient_product_recommendations enable row level security;
alter table visits enable row level security;
alter table plans enable row level security;
alter table ticket_usages enable row level security;
alter table purchases enable row level security;
alter table rentals enable row level security;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
-- 基本方針：
-- - admin は管理対象データを操作できる
-- - patient は自分に紐づくデータだけ閲覧できる
-- - MVPでは patient 側からの書き込みは原則なし
-- - 商品マスタは active 商品のみ患者側から閲覧可能
-- ============================================================

-- ------------------------------------------------------------
-- profiles policies
-- ------------------------------------------------------------
-- 自分のprofile、またはadminなら参照できる。
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin"
on profiles for select
using (
  clerk_user_id = current_clerk_user_id()
  or is_admin()
);

-- profiles の作成・更新・削除は admin のみ。
-- 初回adminだけはSQL Editorまたはservice roleで作る想定。
drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all"
on profiles for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- patients policies
-- ------------------------------------------------------------
-- 患者本人は自分の患者情報だけ参照できる。
-- admin は全患者を参照できる。
drop policy if exists "patients_select_own_or_admin" on patients;
create policy "patients_select_own_or_admin"
on patients for select
using (
  is_admin()
  or user_id = current_profile_id()
);

-- 患者情報の作成・更新・削除は admin のみ。
drop policy if exists "patients_admin_all" on patients;
create policy "patients_admin_all"
on patients for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- products policies
-- ------------------------------------------------------------
-- 患者側には active の商品だけ見せる。
-- admin は active / inactive すべて見える。
drop policy if exists "products_select_active_or_admin" on products;
create policy "products_select_active_or_admin"
on products for select
using (
  is_admin()
  or status = 'active'
);

-- 商品マスタの作成・更新・削除は admin のみ。
drop policy if exists "products_admin_all" on products;
create policy "products_admin_all"
on products for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- programs policies
-- ------------------------------------------------------------
-- 患者本人は自分の改善プログラムだけ見える。
-- admin は全患者の改善プログラムを扱える。
drop policy if exists "programs_select_own_or_admin" on programs;
create policy "programs_select_own_or_admin"
on programs for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "programs_admin_all" on programs;
create policy "programs_admin_all"
on programs for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- patient_product_recommendations policies
-- ------------------------------------------------------------
-- 患者本人は自分への商品提案だけ見える。
-- admin は全患者の商品提案を扱える。
drop policy if exists "recommendations_select_own_or_admin" on patient_product_recommendations;
create policy "recommendations_select_own_or_admin"
on patient_product_recommendations for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "recommendations_admin_all" on patient_product_recommendations;
create policy "recommendations_admin_all"
on patient_product_recommendations for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- visits policies
-- ------------------------------------------------------------
-- 患者本人は自分の通院履歴だけ見える。
drop policy if exists "visits_select_own_or_admin" on visits;
create policy "visits_select_own_or_admin"
on visits for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "visits_admin_all" on visits;
create policy "visits_admin_all"
on visits for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- plans policies
-- ------------------------------------------------------------
-- 患者本人は自分の回数券・サブスク情報だけ見える。
drop policy if exists "plans_select_own_or_admin" on plans;
create policy "plans_select_own_or_admin"
on plans for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "plans_admin_all" on plans;
create policy "plans_admin_all"
on plans for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- ticket_usages policies
-- ------------------------------------------------------------
-- ticket_usages は plan_id 経由で患者を判定する。
-- 患者本人は自分のプランに紐づく利用履歴だけ見える。
drop policy if exists "ticket_usages_select_own_or_admin" on ticket_usages;
create policy "ticket_usages_select_own_or_admin"
on ticket_usages for select
using (
  is_admin()
  or exists (
    select 1
    from plans
    where plans.id = ticket_usages.plan_id
      and is_patient_owner(plans.patient_id)
  )
);

drop policy if exists "ticket_usages_admin_all" on ticket_usages;
create policy "ticket_usages_admin_all"
on ticket_usages for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- purchases policies
-- ------------------------------------------------------------
-- 患者本人は自分の購入履歴だけ見える。
drop policy if exists "purchases_select_own_or_admin" on purchases;
create policy "purchases_select_own_or_admin"
on purchases for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "purchases_admin_all" on purchases;
create policy "purchases_admin_all"
on purchases for all
using (is_admin())
with check (is_admin());

-- ------------------------------------------------------------
-- rentals policies
-- ------------------------------------------------------------
-- 患者本人は自分のレンタル履歴だけ見える。
drop policy if exists "rentals_select_own_or_admin" on rentals;
create policy "rentals_select_own_or_admin"
on rentals for select
using (
  is_admin()
  or is_patient_owner(patient_id)
);

drop policy if exists "rentals_admin_all" on rentals;
create policy "rentals_admin_all"
on rentals for all
using (is_admin())
with check (is_admin());

-- ============================================================
-- 7. INDEXES
-- ============================================================
-- 検索・一覧表示・紐づき取得を速くするためのインデックス。
-- MVPでも患者IDやステータスで絞ることが多いので作っておく。
-- ============================================================

-- profiles
create index if not exists idx_profiles_clerk_user_id on profiles(clerk_user_id);
create index if not exists idx_profiles_role on profiles(role);

-- patients
create index if not exists idx_patients_user_id on patients(user_id);
create index if not exists idx_patients_created_at on patients(created_at desc);

-- products
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_status on products(status);
create index if not exists idx_products_inventory_count on products(inventory_count);

-- programs
create index if not exists idx_programs_patient_id on programs(patient_id);
create index if not exists idx_programs_created_at on programs(created_at desc);

-- patient_product_recommendations
create index if not exists idx_recommendations_patient_id on patient_product_recommendations(patient_id);
create index if not exists idx_recommendations_program_id on patient_product_recommendations(program_id);
create index if not exists idx_recommendations_product_id on patient_product_recommendations(product_id);
create index if not exists idx_recommendations_status on patient_product_recommendations(status);

-- visits
create index if not exists idx_visits_patient_id on visits(patient_id);
create index if not exists idx_visits_visit_date on visits(visit_date desc);

-- plans / ticket usages
create index if not exists idx_plans_patient_id on plans(patient_id);
create index if not exists idx_plans_status on plans(status);
create index if not exists idx_ticket_usages_plan_id on ticket_usages(plan_id);

-- purchases / rentals
create index if not exists idx_purchases_patient_id on purchases(patient_id);
create index if not exists idx_rentals_patient_id on rentals(patient_id);
create index if not exists idx_rentals_status on rentals(status);

-- ============================================================
-- 8. 初期データ作成メモ
-- ============================================================
-- このSQLでは初期adminユーザーは作成しない。
-- 理由：Clerkの実際の userId が環境ごとに違うため。
--
-- Clerkでログイン後、対象ユーザーの Clerk userId を確認して、
-- Supabase SQL Editor で以下のように作成する想定。
--
-- insert into profiles (clerk_user_id, role)
-- values ('user_xxxxxxxxxxxxxxxxx', 'admin');
--
-- 患者ログインを作る場合は、患者用Clerk userIdで profiles を作成し、
-- patients.user_id にその profiles.id を紐づける。
-- ============================================================
