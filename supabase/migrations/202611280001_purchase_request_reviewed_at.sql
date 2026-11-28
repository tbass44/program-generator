-- Administrator acknowledgment is separate from ordering or payment.
ALTER TABLE public.patient_product_recommendations
  ADD COLUMN IF NOT EXISTS purchase_request_reviewed_at timestamptz NULL;
COMMENT ON COLUMN public.patient_product_recommendations.purchase_request_reviewed_at IS
  'When an administrator acknowledged the current purchase request; null means not reviewed';
