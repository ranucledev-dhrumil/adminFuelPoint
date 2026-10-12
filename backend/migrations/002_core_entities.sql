-- Up Migration
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_groups_discount_percent CHECK (discount_percent BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX idx_groups_name ON groups (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_groups_default ON groups (is_default) WHERE is_default = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_groups_active ON groups (active) WHERE deleted_at IS NULL;

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Super Admin',
  location TEXT,
  initials VARCHAR(3) NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_admin_users_email UNIQUE (email)
);

CREATE UNIQUE INDEX idx_admin_users_phone ON admin_users (phone) WHERE phone IS NOT NULL;

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  vehicle TEXT,
  qr_token TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  status customer_status NOT NULL DEFAULT 'active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_customers_qr_token UNIQUE (qr_token)
);

CREATE UNIQUE INDEX idx_customers_phone ON customers (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_customers_email ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_customers_qr_token ON customers (qr_token);
CREATE INDEX idx_customers_group_status ON customers (group_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_registered_at ON customers (registered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_last_activity ON customers (last_activity_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  shift worker_shift NOT NULL,
  status worker_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_workers_phone ON workers (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_workers_email ON workers (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_workers_status_shift ON workers (status, shift) WHERE deleted_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
