ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS patient_message text;
COMMENT ON COLUMN public.visits.patient_message IS 'Clinic-approved follow-up shown to linked patient in MyCare; internal note remains private.';
