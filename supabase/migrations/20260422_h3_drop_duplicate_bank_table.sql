-- Slice H3: drop duplicate singular user_bank_account table
-- user_bank_accounts (plural) is the canonical table: 3 rows, 18 columns,
-- referenced by model_payouts.bank_account_id, used by 17+ files.
-- user_bank_account (singular) is 0 rows, 0 code refs, 10-col stub,
-- no inbound FKs, no triggers, no view refs. 4 RLS policies exist on it
-- but will cascade-drop with the table (standard Postgres behavior).

BEGIN;
DROP TABLE public.user_bank_account;
COMMIT;
