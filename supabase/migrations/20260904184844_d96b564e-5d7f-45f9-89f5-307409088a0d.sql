REVOKE EXECUTE ON FUNCTION public.refund_sale_items(uuid, text, text, boolean, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refund_sale(uuid, text, text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.refund_sale_items(uuid, text, text, boolean, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_sale(uuid, text, text, boolean) TO authenticated, service_role;