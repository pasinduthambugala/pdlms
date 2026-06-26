
ALTER TABLE public.documents ALTER COLUMN cart_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_cart_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE c integer;
BEGIN
  IF NEW.cart_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.cart_id IS NOT DISTINCT FROM NEW.cart_id THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO c FROM public.documents WHERE cart_id = NEW.cart_id;
  IF c >= 60 THEN
    RAISE EXCEPTION 'Cart capacity exceeded: a cart may contain at most 60 documents';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS docs_capacity ON public.documents;
CREATE TRIGGER docs_capacity
BEFORE INSERT OR UPDATE OF cart_id ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_cart_capacity();
