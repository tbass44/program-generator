-- Deployed to Supabase as migration add_recommendation_usage_guidance.
-- Patient-facing optional quantity / period, not a medically prescribed dose.
ALTER TABLE public.patient_product_recommendations
  ADD COLUMN IF NOT EXISTS usage_guidance text;

COMMENT ON COLUMN public.patient_product_recommendations.usage_guidance
  IS 'Optional patient-facing proposed quantity and period, e.g. 1か月に2個（目安）. Not a prescribed dose.';
