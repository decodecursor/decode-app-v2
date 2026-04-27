-- ============================================================================
-- Slice 8 · user_bank_accounts schema migration
-- ============================================================================
-- Brings the existing user_bank_accounts table to spec §5.2 target state for
-- the ambassador-side Payout Method card. Per partner-locked Q1=D, IBAN
-- stays plaintext for V1 — encryption + legacy retrofit deferred to a
-- combined post-V1 security hardening slice (hardening item 39).
--
-- Scope:
--   1. Add iban_last4 text column + backfill from existing iban_number
--   2. Delete yannijohnson 7B smoke-test row (per Q8=A cleanup)
--   3. Drop orphan iban column (NULL on all rows, zero code references)
--   4. Tighten nullability on is_primary / is_verified / status / iban_last4
--   5. ADD CONSTRAINT one_primary_per_user UNIQUE (user_id, is_primary)
--
-- Pre-flight verification (run 2026-04-27):
--   - 4 rows live in production (3 auctions-side users + 1 yannijohnson test)
--   - All 4 rows have is_primary=true, distinct user_ids → UNIQUE constraint
--     adds cleanly without dedup
--   - No row has multiple is_primary=true entries (verified via GROUP BY HAVING)
--   - RLS already enabled with 4 owner-only policies (auth.uid()=user_id);
--     no policy changes needed in this slice
--   - iban orphan column NULL on all rows; grep confirmed zero code refs
--
-- Out of scope (locked decisions or post-V1):
--   - pgcrypto encryption of iban_number (Q1=D — V1 plaintext, item 39 logged)
--   - Legacy /api/user/bank-account/route.ts retrofit (Q6=B + item 39)
--   - Verification UI (admin manual SQL, post-V1)
--   - Deletion endpoint (V1 = edit only; existing RLS DELETE policy left as
--     fallback for legacy auctions-side delete behavior)
-- ============================================================================

-- 1. Add iban_last4 column (nullable initially, tighten to NOT NULL after backfill)
ALTER TABLE user_bank_accounts
  ADD COLUMN IF NOT EXISTS iban_last4 text;

-- 2. Backfill iban_last4 for existing 4 rows.
--    Strip whitespace before slicing — 2 of 4 existing rows have spaces in
--    iban_number ("AE83 0..." style) per Slice 8 pre-flight.
UPDATE user_bank_accounts
SET iban_last4 = right(replace(iban_number, ' ', ''), 4)
WHERE iban_last4 IS NULL
  AND iban_number IS NOT NULL
  AND length(replace(iban_number, ' ', '')) >= 4;

-- 3. Delete yannijohnson 7B smoke-test row (per locked Q8=A cleanup).
--    Was added during 7B prep to satisfy create_payout_batch's primary-bank
--    check; Yanni's user row stays, just the test bank account row goes.
--    Hardcoded UUID is safe — partner-confirmed during pre-flight that this
--    is the smoke-test row and not real production data.
DELETE FROM user_bank_accounts
WHERE id = '06aeda18-925e-4212-9a38-08b692f91620';

-- 4. Drop orphan iban column (Q8=A). NULL on all rows pre-deletion + zero
--    code references per grep. Was likely an aborted earlier-migration relic.
ALTER TABLE user_bank_accounts
  DROP COLUMN IF EXISTS iban;

-- 5. Tighten nullability per spec §5.2.
ALTER TABLE user_bank_accounts
  ALTER COLUMN is_primary SET NOT NULL,
  ALTER COLUMN is_primary SET DEFAULT true,
  ALTER COLUMN is_verified SET NOT NULL,
  ALTER COLUMN is_verified SET DEFAULT false,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN iban_last4 SET NOT NULL;

-- 6. Add UNIQUE constraint to enforce one primary bank per user.
--    Existing partial INDEX idx_user_bank_accounts_primary stays (functional
--    index on is_primary=true); the UNIQUE constraint adds the guarantee at
--    schema level. Pre-flight dedup check confirmed zero violations.
ALTER TABLE user_bank_accounts
  ADD CONSTRAINT one_primary_per_user UNIQUE (user_id, is_primary);

-- 7. Verification queries (commented — uncomment to run):
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name='user_bank_accounts' ORDER BY ordinal_position;
--
-- SELECT id, bank_name, iban_last4, is_primary, status FROM user_bank_accounts
-- ORDER BY created_at DESC;
