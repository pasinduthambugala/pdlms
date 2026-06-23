-- Supabase Schema for DARMS (PDLMS)
-- Tables
CREATE TABLE departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    department_id uuid REFERENCES departments(id),
    role_id uuid REFERENCES roles(id),
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_number text NOT NULL,
    department_id uuid REFERENCES departments(id) NOT NULL,
    status text NOT NULL CHECK (status IN ('Draft','Pending Approval','Approved','Stored','Retrieved','Pending Return Approval','Disposed')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX unique_cart_number_per_department ON carts (department_id, cart_number);

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_name text NOT NULL,
    document_number text NOT NULL UNIQUE,
    retention_period_days integer NOT NULL,
    cart_id uuid REFERENCES carts(id),
    file_number text,
    file_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number text NOT NULL UNIQUE,
    department_id uuid REFERENCES departments(id) NOT NULL,
    category text NOT NULL CHECK (category IN ('Storage','Transport','Urgent Retrieval')),
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id),
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Super Admin (role name = 'Super Admin') bypasses all restrictions
CREATE POLICY super_admin_all ON users USING (auth.role() = 'Super Admin');
CREATE POLICY super_admin_all ON carts USING (auth.role() = 'Super Admin');
CREATE POLICY super_admin_all ON documents USING (auth.role() = 'Super Admin');
CREATE POLICY super_admin_all ON purchase_orders USING (auth.role() = 'Super Admin');
CREATE POLICY super_admin_all ON audit_logs USING (auth.role() = 'Super Admin');

-- Employees and Department Heads see only their department data
CREATE POLICY dept_user_policy ON users USING (
    auth.role() IN ('Employee','Department Head','Office Services') AND department_id = auth.uid()
);
CREATE POLICY dept_cart_policy ON carts USING (
    auth.role() IN ('Employee','Department Head','Office Services') AND department_id = (
        SELECT department_id FROM users WHERE id = auth.uid()
    )
);
CREATE POLICY dept_document_policy ON documents USING (
    auth.role() IN ('Employee','Department Head','Office Services') AND cart_id IN (
        SELECT id FROM carts WHERE department_id = (
            SELECT department_id FROM users WHERE id = auth.uid()
        )
    )
);
CREATE POLICY dept_po_policy ON purchase_orders USING (
    auth.role() = 'Office Services' OR (
        auth.role() IN ('Employee','Department Head') AND department_id = (
            SELECT department_id FROM users WHERE id = auth.uid()
        )
    )
);

-- Triggers for timestamps
CREATE FUNCTION update_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_before_update
BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_timestamp_before_update_doc
BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Function to calculate disposal date and schedule alerts
CREATE OR REPLACE FUNCTION schedule_disposal_alerts()
RETURNS void AS $$
BEGIN
    PERFORM pg_notify('disposal_alert', json_build_object('cart_id', id)::text)
    FROM carts c
    JOIN documents d ON d.cart_id = c.id
    WHERE c.status = 'Stored' AND (c.created_at + interval '1 day' * d.retention_period_days) <= (now() + interval '14 days')
    AND NOT EXISTS (
        SELECT 1 FROM audit_logs al WHERE al.resource_type = 'DisposalAlert' AND al.resource_id = c.id
    );
END;
$$ LANGUAGE plpgsql;

-- pg_cron job for daily 3:00 PM email notifications and disposal alerts
SELECT cron.schedule('daily_storage_email', '0 15 * * *', $$
    SELECT public.send_storage_emails();
$$);

SELECT cron.schedule('daily_disposal_alert', '0 15 * * *', $$
    SELECT schedule_disposal_alerts();
$$);

-- Edge Function placeholders (will be implemented in Supabase Functions)
-- public.send_storage_emails() will call the Edge Function to email third‑party provider.

-- Indexes for performance
CREATE INDEX idx_carts_department ON carts(department_id);
CREATE INDEX idx_documents_cart ON documents(cart_id);

-- Seed roles (run once)
INSERT INTO roles (name) VALUES ('Super Admin'), ('Employee'), ('Department Head'), ('Office Services');

-- End of schema
