
-- =========================================================================
-- PDLMS SCHEMA
-- =========================================================================

CREATE TYPE public.app_role AS ENUM ('super_admin','employee','dept_head','office_services');
CREATE TYPE public.cart_status AS ENUM (
  'draft','pending_approval','approved','stored',
  'pending_retrieval_approval','retrieved',
  'pending_return_approval','disposed','rejected'
);
CREATE TYPE public.retrieval_type AS ENUM ('normal','urgent');
CREATE TYPE public.po_type AS ENUM ('storage','transport','urgent_retrieval');
CREATE TYPE public.approval_action AS ENUM (
  'submit','approve','reject',
  'retrieval_request','retrieval_approved','retrieval_rejected',
  'return_request','return_approved','return_rejected',
  'mark_stored','mark_retrieved','dispose'
);

-- ---------- departments ----------
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------- user_roles ----------
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---------- security definer helpers ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_active, false) FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------- carts ----------
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_number text NOT NULL UNIQUE,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  status public.cart_status NOT NULL DEFAULT 'draft',
  retention_days integer NOT NULL CHECK (retention_days > 0),
  disposal_date date,
  retrieval_type public.retrieval_type,
  rejection_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  stored_at timestamptz,
  retrieved_at timestamptz,
  disposal_alert_sent boolean NOT NULL DEFAULT false,
  storage_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_carts_dept ON public.carts(department_id);
CREATE INDEX idx_carts_status ON public.carts(status);
CREATE INDEX idx_carts_disposal ON public.carts(disposal_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- ---------- documents ----------
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_number text NOT NULL UNIQUE,
  retention_period integer NOT NULL CHECK (retention_period > 0),
  file_number text,
  file_name text,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_cart ON public.documents(cart_id);
CREATE INDEX idx_documents_dept ON public.documents(department_id);
CREATE INDEX idx_documents_name ON public.documents(document_name);
CREATE INDEX idx_documents_number ON public.documents(document_number);
CREATE INDEX idx_documents_file ON public.documents(file_number, file_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ---------- cart_approvals (history/comments) ----------
CREATE TABLE public.cart_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  action public.approval_action NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_approvals_cart ON public.cart_approvals(cart_id);
GRANT SELECT, INSERT ON public.cart_approvals TO authenticated;
GRANT ALL ON public.cart_approvals TO service_role;
ALTER TABLE public.cart_approvals ENABLE ROW LEVEL SECURITY;

-- ---------- purchase_orders ----------
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  po_type public.po_type NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  period_start date,
  period_end date,
  description text,
  -- For storage POs: owning dept. For urgent: requesting dept. For transport: NULL (pro-rated).
  department_id uuid REFERENCES public.departments(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- ---------- cost_allocations ----------
CREATE TABLE public.cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  cart_count integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_alloc_dept ON public.cost_allocations(department_id);
CREATE INDEX idx_cost_alloc_po ON public.cost_allocations(purchase_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_allocations TO authenticated;
GRANT ALL ON public.cost_allocations TO service_role;
ALTER TABLE public.cost_allocations ENABLE ROW LEVEL SECURITY;

-- ---------- notifications (log of emails/alerts) ----------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  recipient text,
  department_id uuid REFERENCES public.departments(id),
  subject text,
  body text,
  payload jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------- audit_log ----------
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_table ON public.audit_log(table_name, record_id);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLICIES
-- =========================================================================

-- departments: all active users can read; super_admin manages.
CREATE POLICY "deps select all" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "deps super admin insert" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "deps super admin update" ON public.departments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "deps super admin delete" ON public.departments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- profiles
CREATE POLICY "profiles select own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'super_admin')
         OR (public.has_role(auth.uid(),'dept_head') AND department_id = public.current_user_department()));
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own basic" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- user_roles: read own or admin; admin manages.
CREATE POLICY "roles select own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- carts: dept-scoped; super_admin sees all.
CREATE POLICY "carts select dept" ON public.carts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR department_id = public.current_user_department());
CREATE POLICY "carts insert dept" ON public.carts FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_active() AND
              (public.has_role(auth.uid(),'super_admin')
               OR department_id = public.current_user_department()));
CREATE POLICY "carts update dept" ON public.carts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR department_id = public.current_user_department());
CREATE POLICY "carts delete dept" ON public.carts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR (department_id = public.current_user_department() AND status = 'draft'));

-- documents: dept-scoped
CREATE POLICY "docs select dept" ON public.documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR department_id = public.current_user_department());
CREATE POLICY "docs insert dept" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_active() AND
              (public.has_role(auth.uid(),'super_admin')
               OR department_id = public.current_user_department()));
CREATE POLICY "docs update dept" ON public.documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR department_id = public.current_user_department());
CREATE POLICY "docs delete dept" ON public.documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR department_id = public.current_user_department());

-- cart_approvals: visible to dept; insert by active users.
CREATE POLICY "approvals select dept" ON public.cart_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR EXISTS (
    SELECT 1 FROM public.carts c WHERE c.id = cart_id AND
      (c.department_id = public.current_user_department())
  ));
CREATE POLICY "approvals insert active" ON public.cart_approvals FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.current_user_is_active());

-- purchase_orders: office_services & super_admin manage; dept_head reads own dept allocations.
CREATE POLICY "po select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR public.has_role(auth.uid(),'office_services')
         OR (public.has_role(auth.uid(),'dept_head')
             AND (department_id IS NULL OR department_id = public.current_user_department())));
CREATE POLICY "po manage" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));
CREATE POLICY "po update" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));
CREATE POLICY "po delete" ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));

-- cost_allocations
CREATE POLICY "alloc select dept" ON public.cost_allocations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR public.has_role(auth.uid(),'office_services')
         OR (public.has_role(auth.uid(),'dept_head') AND department_id = public.current_user_department()));
CREATE POLICY "alloc manage" ON public.cost_allocations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));
CREATE POLICY "alloc update" ON public.cost_allocations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));
CREATE POLICY "alloc delete" ON public.cost_allocations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office_services'));

-- notifications: admin/office_services read
CREATE POLICY "notif select" ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')
         OR public.has_role(auth.uid(),'office_services')
         OR (department_id IS NOT NULL AND department_id = public.current_user_department()));

-- audit_log: admin only
CREATE POLICY "audit select admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "audit insert any" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- =========================================================================
-- TRIGGERS / BUSINESS RULES
-- =========================================================================

-- Update updated_at columns
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_carts BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-compute disposal_date from retention_days
CREATE OR REPLACE FUNCTION public.compute_cart_disposal_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.disposal_date IS NULL OR (TG_OP='UPDATE' AND NEW.retention_days <> OLD.retention_days) THEN
    NEW.disposal_date := (COALESCE(NEW.created_at, now())::date + NEW.retention_days);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER carts_disposal BEFORE INSERT OR UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.compute_cart_disposal_date();

-- Enforce max 60 documents per cart
CREATE OR REPLACE FUNCTION public.enforce_cart_capacity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE c integer;
BEGIN
  SELECT count(*) INTO c FROM public.documents WHERE cart_id = NEW.cart_id;
  IF c >= 60 THEN
    RAISE EXCEPTION 'Cart capacity exceeded: a cart may contain at most 60 documents';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER docs_capacity BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cart_capacity();

-- New-user handler: create profile; first user becomes super_admin & active
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    user_count = 0
  );
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic audit logger
CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, table_name, record_id, action, details)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER audit_carts AFTER INSERT OR UPDATE OR DELETE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_pos AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Seed a default department so super admin has something to assign
INSERT INTO public.departments (name) VALUES ('General') ON CONFLICT DO NOTHING;
