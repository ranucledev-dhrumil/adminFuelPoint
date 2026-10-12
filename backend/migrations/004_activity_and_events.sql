-- Up Migration
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  status transaction_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  litres NUMERIC(8,2),
  fuel_type fuel_type,
  failure_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_transactions_amount CHECK (amount > 0),
  CONSTRAINT chk_transactions_discount_percent CHECK (discount_percent BETWEEN 0 AND 100),
  CONSTRAINT chk_transactions_discount_amount CHECK (discount_amount >= 0),
  CONSTRAINT chk_transactions_discount_lte_amount CHECK (discount_amount <= amount),
  CONSTRAINT chk_transactions_litres CHECK (litres > 0 OR litres IS NULL)
);

CREATE INDEX idx_transactions_customer_submitted ON transactions (customer_id, submitted_at DESC);
CREATE INDEX idx_transactions_worker_submitted ON transactions (worker_id, submitted_at DESC);
CREATE INDEX idx_transactions_group_submitted ON transactions (group_id, submitted_at DESC);
CREATE INDEX idx_transactions_status_submitted ON transactions (status, submitted_at DESC);
CREATE INDEX idx_transactions_submitted_at ON transactions (submitted_at DESC);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_notifications_entity CHECK (NOT (customer_id IS NOT NULL AND worker_id IS NOT NULL))
);

CREATE INDEX idx_notifications_is_read_created ON notifications (is_read, created_at DESC);
CREATE INDEX idx_notifications_type_created ON notifications (type, created_at DESC);
CREATE INDEX idx_notifications_customer ON notifications (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_notifications_worker ON notifications (worker_id) WHERE worker_id IS NOT NULL;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_action_created ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_actor_created ON audit_logs (actor_type, actor_id, created_at DESC);
CREATE INDEX idx_audit_entity_created ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_reason ON audit_logs (reason, created_at DESC) WHERE reason IS NOT NULL;

-- Down Migration
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
