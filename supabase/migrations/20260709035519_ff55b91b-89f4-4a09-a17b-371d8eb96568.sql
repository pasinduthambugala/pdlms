
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_document_number_key;
ALTER TABLE public.documents ADD CONSTRAINT documents_dept_docnum_key UNIQUE (department_id, document_number);
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
