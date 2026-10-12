-- Up Migration
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE customer_status AS ENUM ('active', 'inactive');
CREATE TYPE worker_shift AS ENUM ('Morning', 'Evening', 'Night');
CREATE TYPE worker_status AS ENUM ('active', 'offline', 'suspended');
CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE fuel_type AS ENUM ('Petrol', 'Diesel', 'CNG');
CREATE TYPE notification_type AS ENUM ('registration', 'worker');
CREATE TYPE otp_channel AS ENUM ('sms', 'email');
CREATE TYPE otp_actor_type AS ENUM ('customer', 'worker');
CREATE TYPE otp_purpose AS ENUM ('login', 'register');

-- Down Migration
DROP TYPE IF EXISTS otp_purpose;
DROP TYPE IF EXISTS otp_actor_type;
DROP TYPE IF EXISTS otp_channel;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS fuel_type;
DROP TYPE IF EXISTS transaction_status;
DROP TYPE IF EXISTS worker_status;
DROP TYPE IF EXISTS worker_shift;
DROP TYPE IF EXISTS customer_status;
