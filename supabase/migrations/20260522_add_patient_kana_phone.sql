-- ============================================================
-- 患者管理CRUD用カラム追加
-- ============================================================
-- 目的：
-- 管理側の患者一覧・検索・新規登録・編集で使う基本項目として、
-- patients にフリガナと電話番号を追加する。
--
-- kana：
--   患者名のフリガナ。管理画面の検索・一覧表示に使う。
--
-- phone：
--   電話番号。患者一覧・詳細・連絡先確認に使う。
-- ============================================================

alter table patients
  add column if not exists kana text,
  add column if not exists phone text;

-- 検索・一覧表示で使うためのインデックス。
create index if not exists idx_patients_kana
on patients(kana);

create index if not exists idx_patients_phone
on patients(phone);
