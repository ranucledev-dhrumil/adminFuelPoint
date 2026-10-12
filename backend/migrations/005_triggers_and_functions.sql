-- Up Migration
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_groups_updated_at
BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workers_updated_at
BEFORE UPDATE ON workers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Down Migration
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
DROP FUNCTION IF EXISTS prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS trg_workers_updated_at ON workers;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
DROP FUNCTION IF EXISTS set_updated_at();
