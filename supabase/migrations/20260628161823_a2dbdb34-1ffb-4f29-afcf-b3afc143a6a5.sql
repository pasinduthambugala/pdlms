
-- Add new cart statuses for explicit approval checkpoints
ALTER TYPE public.cart_status ADD VALUE IF NOT EXISTS 'retrieval_approved';
ALTER TYPE public.cart_status ADD VALUE IF NOT EXISTS 'return_approved';

-- Purchase orders: support file attachments
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Allow registration_date to be set by user (already exists)
-- No-op if column already there.
