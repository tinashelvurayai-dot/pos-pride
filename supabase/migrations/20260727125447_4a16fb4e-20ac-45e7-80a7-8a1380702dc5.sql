
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.flag_out_of_stock(_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.stock
    SET available = false, updated_at = now()
    WHERE variant_id = _variant_id;
  INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (auth.uid(), 'flag_out_of_stock', jsonb_build_object('variant_id', _variant_id));
END;
$$;

REVOKE ALL ON FUNCTION public.flag_out_of_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_out_of_stock(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_variant_available(_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.stock
    SET available = true, updated_at = now()
    WHERE variant_id = _variant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_variant_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_variant_available(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_available()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  WITH upd AS (
    UPDATE public.stock SET available = true, updated_at = now()
      WHERE available = false
      RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_all_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_available() TO authenticated;
