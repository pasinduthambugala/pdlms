
CREATE OR REPLACE FUNCTION public.notify_urgent_retrieval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'retrieval_approved'
     AND NEW.retrieval_type = 'urgent'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := 'https://pdlms.lovable.app/api/public/hooks/urgent-retrieval',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('cart_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_urgent_retrieval() FROM PUBLIC, anon, authenticated;
