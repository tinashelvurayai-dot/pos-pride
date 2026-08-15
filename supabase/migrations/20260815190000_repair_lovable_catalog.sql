-- Repair the existing Lovable Cloud catalog without creating a new project.
-- The catalog seed is intentionally idempotent: it can be applied repeatedly.
DO $$
DECLARE
  variant_row RECORD;
BEGIN
  FOR variant_row IN SELECT id FROM public.product_variants LOOP
    INSERT INTO public.stock (variant_id, quantity, low_stock_alert_level)
    VALUES (variant_row.id, 40, 10)
    ON CONFLICT (variant_id) DO UPDATE SET quantity = 40;
  END LOOP;
END $$;

-- Keep all existing products active so previously seeded catalog entries remain visible.
UPDATE public.products SET active = true WHERE active IS DISTINCT FROM true;
UPDATE public.stock SET quantity = 40 WHERE quantity IS DISTINCT FROM 40;
