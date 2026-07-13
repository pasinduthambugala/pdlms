
-- 1) App-wide settings (single row) for provider email + last daily-send timestamp
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  provider_email text,
  last_daily_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read settings" ON public.app_settings;
CREATE POLICY "read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin write settings" ON public.app_settings;
CREATE POLICY "admin write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2) Department theme colors (null = default)
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS theme_color text;

-- Allow authenticated users to read all departments (needed for theme lookup)
DROP POLICY IF EXISTS "departments read all" ON public.departments;
CREATE POLICY "departments read all" ON public.departments FOR SELECT TO authenticated USING (true);

-- 3) Trigger to fire pg_net webhook when an urgent retrieval is approved
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_urgent_retrieval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text := 'https://project--b7f20078-ac1c-4d0d-8ef2-961176afac4e.lovable.app';
BEGIN
  IF NEW.status = 'retrieval_approved'
     AND NEW.retrieval_type = 'urgent'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := base_url || '/api/public/hooks/urgent-retrieval',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('cart_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_urgent_retrieval ON public.carts;
CREATE TRIGGER trg_notify_urgent_retrieval
  AFTER UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.notify_urgent_retrieval();
