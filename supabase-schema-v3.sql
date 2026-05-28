-- Bevo Notes v3 Migration — Stripe + freemium model
-- Run in Supabase SQL Editor after v1 and v2 schemas

-- ============================================
-- USERS TABLE: add Stripe fields, drop API key fields
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE;

-- subscription_tier already exists from v1; ensure it has the right default
ALTER TABLE users
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- Drop old API key columns (data no longer needed — platform manages the key)
ALTER TABLE users
  DROP COLUMN IF EXISTS gemini_api_key_encrypted,
  DROP COLUMN IF EXISTS api_key_is_valid,
  DROP COLUMN IF EXISTS api_key_last_verified;

-- Index for Stripe webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
