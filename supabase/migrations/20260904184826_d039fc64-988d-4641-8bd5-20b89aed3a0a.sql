ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS auto_approve_refunds boolean NOT NULL DEFAULT false;
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'refund',
  reason text,
  amount numeric NOT NULL DEFAULT 0,
  restocked boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read refunds" ON public.refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in create refunds" ON public.refunds FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  quantity integer NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refund_items TO authenticated;
GRANT ALL ON public.refund_items TO service_role;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read refund items" ON public.refund_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in create refund items" ON public.refund_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.stock_in_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES public.stock(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id),
  quantity integer NOT NULL,
  unit_buying_price numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_in_records TO authenticated;
GRANT ALL ON public.stock_in_records TO service_role;
ALTER TABLE public.stock_in_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read stock in" ON public.stock_in_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage stock in" ON public.stock_in_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE TABLE IF NOT EXISTS public.cashier_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code1 text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_accounts TO authenticated;
GRANT ALL ON public.cashier_accounts TO service_role;
ALTER TABLE public.cashier_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage cashier accounts" ON public.cashier_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Cashier reads own account" ON public.cashier_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER set_cashier_accounts_updated_at BEFORE UPDATE ON public.cashier_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.refund_sale_items(
  p_sale_id uuid,
  p_kind text DEFAULT 'refund',
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT true,
  p_items jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.sales%ROWTYPE;
  new_id uuid;
  auto_ok boolean;
  v_total numeric := 0;
  v_partial boolean := false;
  v_remaining numeric := 0;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF NOT public.has_role(auth.uid(), 'manager') THEN
    SELECT COALESCE(auto_approve_refunds, false) INTO auto_ok FROM public.app_settings WHERE id = true;
    IF NOT COALESCE(auto_ok, false) THEN
      RAISE EXCEPTION 'Refunds need manager approval. Ask your manager to switch on auto-approve refunds.';
    END IF;
  END IF;

  SELECT * INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF s.status IN ('refunded', 'voided') THEN
    RAISE EXCEPTION 'This sale was already %', s.status;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    v_partial := false;
  ELSE
    v_partial := true;
  END IF;

  INSERT INTO public.refunds (sale_id, kind, reason, amount, restocked, created_by)
  VALUES (p_sale_id, COALESCE(p_kind, 'refund'), p_reason, 0, COALESCE(p_restock, true), auth.uid())
  RETURNING id INTO new_id;

  IF NOT v_partial THEN
    FOR r IN
      SELECT si.id, si.variant_id, si.unit_price,
             si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM public.refund_items ri WHERE ri.sale_item_id = si.id), 0) AS qty
        FROM public.sale_items si
       WHERE si.sale_id = p_sale_id
    LOOP
      IF r.qty > 0 THEN
        INSERT INTO public.refund_items (refund_id, sale_item_id, variant_id, quantity, unit_price, amount)
        VALUES (new_id, r.id, r.variant_id, r.qty, r.unit_price, r.qty * r.unit_price);
        v_total := v_total + (r.qty * r.unit_price);
      END IF;
    END LOOP;
  ELSE
    FOR r IN
      SELECT si.id, si.variant_id, si.unit_price,
             (i->>'quantity')::int AS req,
             si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM public.refund_items ri WHERE ri.sale_item_id = si.id), 0) AS avail
        FROM jsonb_array_elements(p_items) i
        JOIN public.sale_items si ON si.id = (i->>'sale_item_id')::uuid AND si.sale_id = p_sale_id
    LOOP
      IF r.req IS NULL OR r.req <= 0 THEN CONTINUE; END IF;
      IF r.req > r.avail THEN
        RAISE EXCEPTION 'Only % of that item can still be refunded', r.avail;
      END IF;
      INSERT INTO public.refund_items (refund_id, sale_item_id, variant_id, quantity, unit_price, amount)
      VALUES (new_id, r.id, r.variant_id, r.req, r.unit_price, r.req * r.unit_price);
      v_total := v_total + (r.req * r.unit_price);
    END LOOP;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Nothing left to refund on this sale';
  END IF;

  UPDATE public.refunds SET amount = v_total WHERE id = new_id;

  IF COALESCE(p_restock, true) THEN
    UPDATE public.stock st
       SET quantity = st.quantity + ri.quantity,
           available = true,
           updated_at = now()
      FROM public.refund_items ri
     WHERE ri.refund_id = new_id AND st.variant_id = ri.variant_id;
  END IF;

  SELECT COALESCE(SUM(si.quantity), 0) - COALESCE((
           SELECT SUM(ri.quantity) FROM public.refund_items ri
            JOIN public.sale_items si2 ON si2.id = ri.sale_item_id
           WHERE si2.sale_id = p_sale_id), 0)
    INTO v_remaining
    FROM public.sale_items si
   WHERE si.sale_id = p_sale_id;

  UPDATE public.sales
     SET status = CASE
                    WHEN v_remaining > 0 THEN 'partially_refunded'
                    WHEN COALESCE(p_kind, 'refund') = 'void' THEN 'voided'
                    ELSE 'refunded'
                  END
   WHERE id = p_sale_id;

  RETURN new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.refund_sale(
  p_sale_id uuid,
  p_kind text DEFAULT 'refund',
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT true
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.refund_sale_items(p_sale_id, p_kind, p_reason, p_restock, NULL);
$function$;