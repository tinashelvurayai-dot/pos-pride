
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.create_stock_for_variant() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_sale() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
