
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.compute_cart_disposal_date() SET search_path = public;
ALTER FUNCTION public.enforce_cart_capacity() SET search_path = public;
ALTER FUNCTION public.audit_trigger() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_department() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_active() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_cart_disposal_date() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cart_capacity() FROM PUBLIC, anon, authenticated;
