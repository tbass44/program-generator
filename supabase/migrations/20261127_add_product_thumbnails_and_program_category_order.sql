-- Applied in Supabase: product thumbnail image and per-program category display order.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS product_category_order text[] NOT NULL
  DEFAULT ARRAY['physical_sleep','exercise','nutrition','skincare']::text[];

COMMENT ON COLUMN public.products.thumbnail_url
  IS 'Optional direct HTTPS image URL for patient product card';

COMMENT ON COLUMN public.programs.product_category_order
  IS 'Display order for proposed product categories in this program';
