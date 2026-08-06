ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name text;
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_id_key ON public.sales (client_id) WHERE client_id IS NOT NULL;