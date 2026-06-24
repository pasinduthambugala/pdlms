-- supabase/seed.sql
-- Insert initial departments
INSERT INTO departments (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Finance');

-- Insert carts (use the Finance department id)
INSERT INTO carts (id, cart_number, department_id, status, created_at, updated_at) VALUES
  ('22222222-2222-2222-2222-222222222222', 'TL-CART-F-001', '11111111-1111-1111-1111-111111111111', 'Stored', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'TL-CART-F-002', '11111111-1111-1111-1111-111111111111', 'Disposed', now(), now());

-- Insert documents (link to carts)
INSERT INTO documents (id, document_name, document_number, retention_period_days, cart_id, file_number, file_name, created_at, updated_at) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Annual Financial Report 2023', 'DOC-FIN-2024-001', 2555, '22222222-2222-2222-2222-222222222222', 'FIN-2023-001', 'Annual Reports', now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'Q4 2023 Balance Sheet', 'DOC-FIN-2024-002', 1825, '22222222-2222-2222-2222-222222222222', 'FIN-2023-002', 'Quarterly Reports', now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'Tax Returns 2022', 'DOC-FIN-2023-055', 730, '33333333-3333-3333-3333-333333333333', 'FIN-2022-055', 'Tax Documents', now(), now()),
  ('77777777-7777-7777-7777-777777777777', 'Petty Cash Vouchers Mar 2024', 'DOC-FIN-2024-003', 1095, '22222222-2222-2222-2222-222222222222', NULL, NULL, now(), now());
