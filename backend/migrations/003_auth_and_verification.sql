-- Up Migration
CREATE TABLE admin_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_pw_reset_user ON admin_password_reset_tokens (admin_user_id, expires_at DESC);
CREATE INDEX idx_admin_pw_reset_token ON admin_password_reset_tokens (token_hash);

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel otp_channel NOT NULL,
  destination TEXT NOT NULL,
  actor_type otp_actor_type,
  actor_id UUID,
  code_hash TEXT NOT NULL,
  purpose otp_purpose NOT NULL,
  request_ip INET,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_otp_attempts CHECK (attempts >= 0),
  CONSTRAINT chk_otp_actor CHECK ((actor_type IS NULL) = (actor_id IS NULL))
);

CREATE INDEX idx_otp_destination_created ON otp_codes (channel, destination, created_at DESC);
CREATE INDEX idx_otp_request_ip_created ON otp_codes (request_ip, created_at DESC) WHERE request_ip IS NOT NULL;
CREATE INDEX idx_otp_expires ON otp_codes (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  worker_id UUID REFERENCES workers(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
  CONSTRAINT chk_refresh_tokens_actor CHECK (num_nonnulls(admin_user_id, customer_id, worker_id) = 1)
);

CREATE INDEX idx_refresh_tokens_admin ON refresh_tokens (admin_user_id) WHERE revoked_at IS NULL AND admin_user_id IS NOT NULL;
CREATE INDEX idx_refresh_tokens_customer ON refresh_tokens (customer_id) WHERE revoked_at IS NULL AND customer_id IS NOT NULL;
CREATE INDEX idx_refresh_tokens_worker ON refresh_tokens (worker_id) WHERE revoked_at IS NULL AND worker_id IS NOT NULL;
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS admin_password_reset_tokens CASCADE;
