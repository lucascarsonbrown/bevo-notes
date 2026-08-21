-- Bevo Notes v4 Migration — browser-only inference, no billing
-- Run in Supabase SQL Editor after v1, v2 and v3.
--
-- Context: all AI now runs in the user's browser via WebLLM. There are no
-- external LLM API calls and therefore no per-user inference cost, so the
-- subscription tiers that existed to cap that cost are removed.

-- ============================================
-- NOTES: store the structured document, not just rendered HTML
-- ============================================

-- Notes are generated as JSON and rendered to HTML deterministically. Keeping
-- the JSON makes notes re-renderable without regenerating them, and is a much
-- better source for local embedding than scraping HTML back apart.
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS notes_json JSONB;

-- ============================================
-- USERS: drop Stripe and subscription state
-- ============================================

ALTER TABLE users
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS subscription_current_period_end,
  DROP COLUMN IF EXISTS subscription_tier;

DROP INDEX IF EXISTS idx_users_stripe_customer_id;
DROP INDEX IF EXISTS idx_users_stripe_subscription_id;
