-- ============================================================
-- Add rental_returned to patient product recommendation status
-- ============================================================
-- 背景：
-- 患者詳細のレンタル履歴で、返却済み・終了済みのレンタルも過去履歴として残すため、
-- patient_product_recommendations.status に rental_returned を追加する。
--
-- 注意：
-- PostgreSQL enum は既存値をそのまま update できないため、
-- DB本体にはこの ALTER TYPE を1回流す必要がある。
-- ============================================================

alter type patient_product_status add value if not exists 'rental_returned';
