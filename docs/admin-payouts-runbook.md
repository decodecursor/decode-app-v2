# Admin Payouts — V1 Manual SQL Runbook

**Audience:** First-Wednesday batch operator (admin role).
**Locked:** Slice 7B Q2 path (b) — manual SQL invocation as the V1 admin payout path. Admin login flow logged for post-V1.
**Why manual:** the auth-gated HTTP endpoints (`/api/admin/payouts/create` + `/api/admin/payouts/[id]/mark-paid`) are real-money endpoints that need an admin JWT to exercise. No admin login UI exists yet (item 32). For V1 we invoke the same logic directly from Supabase SQL Editor against the service-role connection, which has full DML access. Same code path as the HTTP endpoints; just no auth gate (the SQL Editor connection is itself the gate — only DECODE staff have access).
**Risk:** runbook bypass — under operational pressure an operator could fall back to ad-hoc SQL outside this runbook, which becomes the de facto pattern. Mitigation: this doc is the single source for the steps; deviations should be flagged + logged.

---

## Cadence

Every Wednesday morning, UAE timezone. The cycle covers the prior Monday → Sunday window (per Phase 1 decision #3 — manual payouts, admin clicks "Pay" on Wednesdays).

---

## Step-by-step

### 1. Identify ambassadors with unbatched payments

Run in Supabase SQL Editor. Returns one row per ambassador who has any completed listing payment OR completed wish payment that is not yet attached to a payout (`payout_id IS NULL`).

```sql
SELECT
  mp.id            AS model_id,
  mp.first_name,
  mp.last_name,
  mp.slug,
  -- Unbatched listing payments (real money, status = 'completed', payout_id NULL)
  COALESCE((
    SELECT COUNT(*) FROM model_listing_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
  ), 0) AS unbatched_listings,
  COALESCE((
    SELECT SUM(net_amount) FROM model_listing_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
  ), 0) AS unbatched_listings_net,
  -- Unbatched wish payments
  COALESCE((
    SELECT COUNT(*) FROM model_wish_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
  ), 0) AS unbatched_wishes,
  COALESCE((
    SELECT SUM(net_amount) FROM model_wish_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
  ), 0) AS unbatched_wishes_net,
  -- Currency check (mixed-currency ambassadors will fail the RPC; surface them upfront)
  ARRAY(
    SELECT DISTINCT currency FROM model_listing_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
    UNION
    SELECT DISTINCT currency FROM model_wish_payments
    WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
  ) AS unbatched_currencies,
  -- Primary bank account presence (RPC will RAISE no_data_found if missing)
  EXISTS(
    SELECT 1 FROM user_bank_accounts uba
    WHERE uba.user_id = mp.user_id AND uba.is_primary = true
  ) AS has_primary_bank
FROM model_profiles mp
WHERE EXISTS(
  SELECT 1 FROM model_listing_payments
  WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
) OR EXISTS(
  SELECT 1 FROM model_wish_payments
  WHERE model_id = mp.id AND status = 'completed' AND payout_id IS NULL
)
ORDER BY mp.first_name;
```

**Read the output:**
- `unbatched_currencies` should be a single-element array (e.g. `{AED}`). Multiple currencies → fix manually before running step 2 (the RPC will RAISE `data_exception`).
- `has_primary_bank` must be `true`. False → ambassador hasn't completed bank-entry; skip them this Wednesday + flag separately. The RPC will RAISE `no_data_found` if you try.
- Capture the `model_id` for each green-light ambassador.

### 2. Create the payout batch (one ambassador at a time)

For each green-light ambassador from step 1, run:

```sql
SELECT * FROM create_payout_batch('<model_id_uuid>'::uuid);
```

Replace `<model_id_uuid>` with the UUID from step 1. The function:
- Atomically attaches all unbatched payments to a new `model_payouts` row
- Returns 1 row with `payout_id`, `payout_reference` (e.g. `P-554-5822`), `listings_count`, `wishes_count`, `gross_total`, `platform_fee_total`, `net_total`, `currency`
- Returns 0 rows if no unbatched payments exist (no harm)
- RAISEs on missing primary bank or mixed currencies (caller never sees a partial state — fix the underlying issue, then retry)

**Capture the returned `payout_reference`** — that's the human-readable reference for the wire transfer + ambassador-facing receipts.

### 3. Verify the payout row

```sql
SELECT id, payout_reference, status, listings_count, wishes_count,
       gross_total, platform_fee_total, net_total, currency,
       bank_name, bank_last4, created_at
FROM model_payouts
WHERE id = '<payout_id_from_step_2>'::uuid;
```

Status should be `pending`. The ambassador's `/model/payouts` page will now show this row with a yellow "Pending" badge.

### 4. Execute the wire transfer

This is the off-platform action — operator initiates the transfer to the ambassador's bank account using the `bank_name` + `bank_last4` from step 3 + the `payout_reference` as the wire reference.

**Wait for the wire to land** in the ambassador's account before step 5. Bank settlement varies (usually same-day for local UAE, 1–2 business days for international PayPal). Don't mark-paid until the money actually moved.

### 5. Mark the payout as paid

```sql
UPDATE model_payouts
SET status = 'paid', paid_at = NOW(), updated_at = NOW()
WHERE id = '<payout_id>'::uuid AND status IN ('pending', 'processing');
```

The `AND status IN (...)` clause is the same concurrency guard the HTTP endpoint uses — prevents double-marking if a parallel admin already flipped it.

**Notification fire:** the HTTP endpoint at `/api/admin/payouts/[id]/mark-paid` fires placeholder Resend email + AUTHKey WhatsApp on mark-paid via the `notification-stubs` callsite. **The SQL UPDATE in step 5 does NOT fire those notifications** — it's a pure DB write. If you want notifications fired:
- Option A — accept that V1 admin notifications are operator-driven (manual email/WhatsApp from the operator, no platform-side fire). Ambassadors see the "Paid" badge on their payouts page either way.
- Option B — once admin login flow ships post-V1, switch to the HTTP endpoint and notifications fire automatically.

For V1 with 1–2 ambassadors per Wednesday, Option A is fine. Document in your operator log that you sent the manual notification.

### 6. Verify the ambassador-facing view flipped

Open `app.welovedecode.com/model/payouts` while logged in as the ambassador (or use the Supabase Auth Impersonate feature in the dashboard). The status badge should be `#34d399 "Paid"` and the statement page (`/model/payouts/<reference>`) should show the green `PAID` pill in the hero.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `42P01: relation "create_payout_batch" does not exist` | Migration not applied | Confirm `20260425_slice6b_create_payout_batch.sql` ran on this project |
| RAISE `no_data_found` from RPC | Ambassador has no `is_primary=true` bank account | Ask ambassador to add one via Settings → Bank Account, then retry |
| RAISE `data_exception` from RPC | Mixed currencies in unbatched payments | Surface to ambassador; manually move the off-currency payments to a separate batch via direct SQL (NOT in this runbook — escalate) |
| Status flip from step 5 returns 0 rows updated | Concurrent mark-paid already happened | Verify status via step 3; no action needed |

---

## Operator log template

For each Wednesday batch, capture:

```
Date:                YYYY-MM-DD
Operator:            <name>
Ambassadors batched: <count>
Per ambassador:
  - Name + slug
  - payout_reference
  - net_total + currency
  - bank_name + last4
  - Wire initiated at: HH:MM UTC
  - Wire confirmed at: HH:MM UTC
  - Mark-paid run at: HH:MM UTC
  - Notification sent: Y/N + channel(s)
Skipped:
  - Name + slug + reason (no primary bank / mixed currencies / etc.)
```

---

## Post-V1 deprecation path

When the admin login flow ships (item 32 path A, post-V1):
1. Admin signs in via `/admin/auth` (route TBD).
2. Admin dashboard at `/admin/payouts` lists ambassadors with unbatched payments (calls the same step-1 query server-side).
3. Click "Create batch" → POSTs to `/api/admin/payouts/create` → same RPC, auth-gated, audit-logged.
4. Click "Mark paid" → PATCHes `/api/admin/payouts/[id]/mark-paid` → same UPDATE, fires notifications.
5. This runbook gets archived.

---

## References

- RPC source: `supabase/migrations/20260425_slice6b_create_payout_batch.sql` (+ hotfix `20260425_slice6b_fix_create_payout_batch_currency_collision.sql`)
- HTTP endpoints (auth-gated, currently un-exercised): `app/api/admin/payouts/create/route.ts` + `app/api/admin/payouts/[id]/mark-paid/route.ts`
- Hardening backlog item 32 — admin login flow (post-V1)
- Slice 7A pre-flight Q2 lock (path b) — `_features/ambassador/DECODE_PROJECT_STATE.md` 7A closeout block
