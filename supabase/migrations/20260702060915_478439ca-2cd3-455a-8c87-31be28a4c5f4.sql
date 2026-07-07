
-- Job titles (custom "roles" shown at signup, distinct from app_role permissions enum)
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_titles TO anon, authenticated;
GRANT ALL ON public.job_titles TO service_role;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jt read all" ON public.job_titles FOR SELECT USING (true);
CREATE POLICY "jt admin insert" ON public.job_titles FOR INSERT WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "jt admin update" ON public.job_titles FOR UPDATE USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "jt admin delete" ON public.job_titles FOR DELETE USING (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.job_titles (name) VALUES ('Officer'),('Manager'),('Executive'),('Assistant')
ON CONFLICT (name) DO NOTHING;

-- Store the chosen job title on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;

-- Update handle_new_user to capture department name and job title from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_count integer;
  dept_uuid uuid;
  dept_meta text;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  dept_meta := NEW.raw_user_meta_data->>'department';
  IF dept_meta IS NOT NULL AND dept_meta <> '' THEN
    -- Accept either a UUID or a department name
    BEGIN
      dept_uuid := dept_meta::uuid;
    EXCEPTION WHEN others THEN
      SELECT id INTO dept_uuid FROM public.departments WHERE name = dept_meta LIMIT 1;
    END;
  END IF;
  INSERT INTO public.profiles (id, email, full_name, is_active, department_id, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    user_count = 0,
    dept_uuid,
    NEW.raw_user_meta_data->>'job_title'
  );
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $function$;

-- Grant Office Services role full access on core operational tables
DROP POLICY IF EXISTS "carts select dept" ON public.carts;
CREATE POLICY "carts select dept" ON public.carts FOR SELECT USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR department_id = public.current_user_department()
);
DROP POLICY IF EXISTS "carts insert dept" ON public.carts;
CREATE POLICY "carts insert dept" ON public.carts FOR INSERT WITH CHECK (
  public.current_user_is_active() AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
    OR department_id = public.current_user_department()
  )
);
DROP POLICY IF EXISTS "carts update dept" ON public.carts;
CREATE POLICY "carts update dept" ON public.carts FOR UPDATE USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR department_id = public.current_user_department()
);
DROP POLICY IF EXISTS "carts delete dept" ON public.carts;
CREATE POLICY "carts delete dept" ON public.carts FOR DELETE USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR (department_id = public.current_user_department() AND status = 'draft'::cart_status)
);

DROP POLICY IF EXISTS "docs select dept" ON public.documents;
CREATE POLICY "docs select dept" ON public.documents FOR SELECT USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR department_id = public.current_user_department()
);
DROP POLICY IF EXISTS "docs insert dept" ON public.documents;
CREATE POLICY "docs insert dept" ON public.documents FOR INSERT WITH CHECK (
  public.current_user_is_active() AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
    OR department_id = public.current_user_department()
  )
);
DROP POLICY IF EXISTS "docs update dept" ON public.documents;
CREATE POLICY "docs update dept" ON public.documents FOR UPDATE USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR department_id = public.current_user_department()
);
DROP POLICY IF EXISTS "docs delete dept" ON public.documents;
CREATE POLICY "docs delete dept" ON public.documents FOR DELETE USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR department_id = public.current_user_department()
);

DROP POLICY IF EXISTS "approvals select dept" ON public.cart_approvals;
CREATE POLICY "approvals select dept" ON public.cart_approvals FOR SELECT USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services')
  OR EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_approvals.cart_id AND c.department_id = public.current_user_department())
);

DROP POLICY IF EXISTS "profiles select own or admin" ON public.profiles;
CREATE POLICY "profiles select own or admin" ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'office_services')
  OR (public.has_role(auth.uid(),'dept_head') AND department_id = public.current_user_department())
);
