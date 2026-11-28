-- Staff-only memo for a product purchase request. No patient-facing exposure.
ALTER TABLE public.patient_product_recommendations
  ADD COLUMN IF NOT EXISTS purchase_request_admin_note text NULL;
COMMENT ON COLUMN public.patient_product_recommendations.purchase_request_admin_note IS
  'Private administrative memo about a patient purchase request; not shown to patients';
