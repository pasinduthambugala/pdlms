-- Add box tracking columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS box_count integer,
  ADD COLUMN IF NOT EXISTS unit_price numeric;

-- View: department inventory (stored carts count per department)
CREATE OR REPLACE VIEW public.department_inventory AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  COALESCE(COUNT(c.id) FILTER (WHERE c.status IN ('stored','pending_retrieval_approval','retrieval_approved','retrieved','pending_return_approval','return_approved')), 0)::int AS total_boxes,
  MAX(c.updated_at) AS last_updated
FROM public.departments d
LEFT JOIN public.carts c ON c.department_id = d.id
GROUP BY d.id, d.name;

GRANT SELECT ON public.department_inventory TO authenticated;
GRANT SELECT ON public.department_inventory TO service_role;

-- View: department cost report
CREATE OR REPLACE VIEW public.department_cost_report AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  COALESCE(SUM(a.amount) FILTER (WHERE po.po_type = 'storage'), 0)::numeric AS storage_cost,
  COALESCE(SUM(a.amount) FILTER (WHERE po.po_type = 'transport'), 0)::numeric AS transport_cost,
  COALESCE(SUM(a.amount) FILTER (WHERE po.po_type = 'urgent_retrieval'), 0)::numeric AS urgent_cost,
  COALESCE(SUM(a.amount), 0)::numeric AS grand_total
FROM public.departments d
LEFT JOIN public.cost_allocations a ON a.department_id = d.id
LEFT JOIN public.purchase_orders po ON po.id = a.purchase_order_id
GROUP BY d.id, d.name;

GRANT SELECT ON public.department_cost_report TO authenticated;
GRANT SELECT ON public.department_cost_report TO service_role;