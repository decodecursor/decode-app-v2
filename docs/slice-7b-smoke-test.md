# Slice 7B Smoke Test — End-to-End Notification Verification

**Goal:** confirm Stripe Sandbox payment → webhook → payout batch → mark-paid → Resend email + AUTHKey WhatsApp fire correctly with all 5 variables substituted.
**Time budget:** ~10 minutes.
**Pre-condition:** Vercel deploy of `310e651` (or later) is live with `AUTHKEY_WID_PAYOUT_PAID=32755` set in production env.

---

## Auth shape — important context

The production mark-paid endpoint (`PATCH /api/admin/payouts/[id]/mark-paid`) uses **Supabase SSR cookie auth** via `requireAdmin` (cookies → `auth.getUser` → `users.role='Admin'` check). No curl-only path bypasses that gate — per locked decision #2.

**For this smoke test, partner locked the temporary `/api/smoke-test-mark-paid` endpoint** (Slice 7B `afb4266`). Service-role-bearer-gated, hard-deleted at Slice 7C kickoff. Calls the same `markPayoutAsPaid()` helper as the production endpoint, so the notification fire path being tested is the real one.

The runbook's Step 5 (`UPDATE model_payouts SET status='paid' …`) **does NOT fire notifications** — it's a pure DB write. Use it for the operator-driven Wednesday batch (per locked Q2 2b), but not for this smoke test.

---

## Pre-flight checks (90 seconds)

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
-- 1. Confirm admin user exists with email + phone (replace email below)
SELECT u.id, u.email, u.phone, u.role
FROM public.users u
WHERE u.email = 'partner-admin-email@welovedecode.com'  -- ← edit
  AND u.role = 'Admin';
-- Expected: 1 row with non-null email AND phone (E.164, e.g. +491701234567)
-- If phone is null, no WhatsApp will fire — partner adds via Settings or direct UPDATE.

-- 2. Confirm Vercel env reached the function
SELECT current_setting('server_version_num');  -- (sanity that SQL Editor is alive)

-- 3. Confirm AUTHKey + Resend env vars are set on Vercel — check
--    Vercel dashboard → Project → Settings → Environment Variables for:
--      AUTHKEY_API_KEY (existing, Slice 1.5)
--      AUTHKEY_WID_PAYOUT_PAID = 32755 (NEW, Slice 7B)
--      RESEND_API_KEY (existing, send-magic-link)
```

---

## Step A — Set up a testable payout (3 min)

### A.1 — Identify (or create) a test payment

If a recent test payment already exists with `status='completed'` and `payout_id IS NULL`, skip to A.2.

Otherwise create one via Stripe Sandbox:
1. Pick a live ambassador listing with a payment link. Visit `https://app.welovedecode.com/pay/<token>` in a separate incognito tab.
2. Pay with Stripe test card: `4242 4242 4242 4242`, any future expiry, any 3-digit CVC, any ZIP.
3. Wait for the confirmation page to render (means the Stripe webhook fired and `model_listing_payments` row landed).

### A.2 — Verify the test payment landed

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
-- Find the unbatched test payment (replace ambassador slug)
SELECT mlp.id AS payment_id,
       mlp.payment_reference,
       mlp.gross_amount, mlp.platform_fee, mlp.net_amount, mlp.currency,
       mlp.status, mlp.payout_id, mlp.created_at,
       mp.id AS model_id,
       mp.first_name, mp.slug
FROM model_listing_payments mlp
JOIN model_profiles mp ON mp.id = mlp.model_id
WHERE mp.slug = 'yannijohnson'  -- ← edit to your test ambassador
  AND mlp.status = 'completed'
  AND mlp.payout_id IS NULL
ORDER BY mlp.created_at DESC
LIMIT 5;
-- Expected: ≥1 row. Capture model_id (UUID) for A.3.
```

### A.3 — Create the payout batch

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
-- Replace <MODEL_ID> with the UUID from A.2
SELECT *
FROM create_payout_batch('<MODEL_ID>'::uuid);
-- Expected: 1 row returned with payout_id (UUID), payout_reference (P-XXX-XXXX),
--   listings_count, wishes_count, gross_total, platform_fee_total, net_total, currency.
-- Capture payout_id for Step C.
```

If the RPC RAISEs:
- `no_data_found` → ambassador has no `is_primary=true` row in `user_bank_accounts`. Add one via Supabase Studio (any non-null bank_name + bank_last4 will do for the smoke test).
- `data_exception` → unbatched payments span multiple currencies; should not happen on a single test payment.

### A.4 — Verify the payout row is pending

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
SELECT id, payout_reference, status, net_total, currency, paid_at
FROM model_payouts
WHERE id = '<PAYOUT_ID>'::uuid;
-- Expected: status='pending', paid_at=null.
```

---

## Step B — Get the service-role key (60 seconds)

The smoke-test endpoint authenticates against `process.env.SUPABASE_SERVICE_ROLE_KEY` (the same secret already wired into Vercel for backend Supabase admin access — this is the **secret service_role key**, NOT the public anon key).

Where to find it:
1. Open Supabase dashboard → your project → **Project Settings** (gear icon, bottom-left) → **API** (left sidebar).
2. Scroll to "Project API keys".
3. Copy the **`service_role` `secret`** value (the row with the warning "This key has the ability to bypass Row Level Security. Never share it publicly.").
4. **Do NOT paste the `anon` `public` key** — that one is harmless but won't authenticate this endpoint.

Save it for Step C — call it `$SUPABASE_SERVICE_ROLE_KEY`. Use it inline in the curl, OR `export` it in your shell first:

```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Don't paste it into chat / share / commit — it has full DB write access.

---

## Step C — Mark-paid via curl (30 seconds)

🟨 **PASTE TO YOUR TERMINAL** (replace `<PAYOUT_ID>`; key from $SUPABASE_SERVICE_ROLE_KEY env or pasted inline)

```bash
PAYOUT_ID="<UUID-from-A.3>"

curl -i -X POST \
  "https://app.welovedecode.com/api/smoke-test-mark-paid" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"payout_id\":\"${PAYOUT_ID}\"}"
```

Expected response:

```
HTTP/2 200
content-type: application/json
…

{"success":true,"payout_id":"<UUID>","status":"paid","paid_at":"2026-04-26T…","smoke_test":true}
```

If you see:
- **HTTP 401 `{"error":"Unauthorized"}`** → bearer token mismatched. Verify you copied the **service_role secret**, not the anon key. Trim any whitespace.
- **HTTP 400 `{"error":"payout_id required"}`** → JSON body missing or malformed; verify Content-Type header + JSON quoting.
- **HTTP 404 `{"error":"Payout not found"}`** → wrong UUID. Re-check A.4.
- **HTTP 409 `{"error":"Cannot mark-paid from status 'paid'"}`** → already-marked-paid (idempotent guard). Re-run from A.1 with a fresh payout.
- **HTTP 500 `{"error":"SUPABASE_SERVICE_ROLE_KEY env not configured"}`** → Vercel env not set in the deployment that's serving the request. Check Vercel dashboard.

---

## Step D — Verify notifications fired (3 min)

### D.1 — Email (Resend)

Check the admin's inbox. Subject: `Your DECODE payout just landed`. Body sample:

> WeLoveDecode
>
> Hi {first_name}, your payout of {amount} {currency} just landed in your bank account.
>
> [View statement] (links to `https://app.welovedecode.com/model/payouts/<UUID>`)
>
> Reference: P-XXX-XXXX

If no email lands within 60s:
- Check Vercel function logs (Production → Logs) for `[ambassador-notif:email]` entries.
- `payout_paid sent` → success-side; check spam folder.
- `RESEND_API_KEY unset` → env var missing.
- `payout_paid resend failed` → API error captured; inspect `error` field.

### D.2 — WhatsApp (AUTHKey)

Check the admin's phone. WhatsApp message body:

> Hi {first_name}, your DECODE payout of {amount} {currency} just landed in your bank account. Reference: {payout_reference}. Thank you for being part of DECODE.

Variable substitution check (read carefully):
- `{first_name}` is the admin user's `first_name` from `model_profiles` (or 'there' if missing).
- `{amount}` should be 2-decimal grouped (e.g. `1,760.00`) NOT raw (`1760`).
- `{currency}` should be uppercase 3-letter code (e.g. `AED`).
- `{payout_reference}` should match the SQL-returned `P-XXX-XXXX`.
- The 5th variable `payout_date` per partner spec is included if your AUTHKey-submitted template uses `{{5}}` — body shape may show it as "26 April 2026" or omit if your final template body collapsed back to 4 vars. Compare against the body Meta approved.

### D.3 — Database log (whatsapp_messages)

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
SELECT id, status, template_wid, template_data, authkey_message_id,
       provider_response, error_message, sent_at, failed_at
FROM whatsapp_messages
WHERE template_wid = '32755'
ORDER BY created_at DESC
LIMIT 3;
-- Expected: 1 row with status='sent', sent_at filled, authkey_message_id non-null.
-- template_data shows the 5-key bodyValues object: {1: <name>, 2: <amount>, …}
-- provider_response captures Meta's "Submitted Successfully" envelope.
```

If `status='failed'`: `error_message` + `provider_response` show what AUTHKey/Meta rejected. Most common: invalid phone format (must be E.164) or expired Meta template approval.

### D.4 — Database confirmation (model_payouts)

🟩 **PASTE TO SUPABASE SQL EDITOR**

```sql
SELECT id, payout_reference, status, paid_at
FROM model_payouts
WHERE id = '<PAYOUT_ID>'::uuid;
-- Expected: status='paid', paid_at = the timestamp from curl response.
```

### D.5 — Ambassador-facing UI sanity (optional, ~1 min)

In the same incognito browser session, navigate to `https://app.welovedecode.com/model/payouts`. The status badge for the test payout should read `Paid` in green (`#34d399`). Click the row → statement page hero shows the green `PAID` pill.

---

## Pass criteria

All of the following must be true:
- [ ] curl returned HTTP 200 with `success:true` (Step C)
- [ ] Admin email inbox has the Resend "Your DECODE payout just landed" email (D.1)
- [ ] Admin phone has the AUTHKey WhatsApp message with all variables substituted correctly (D.2)
- [ ] `whatsapp_messages` row exists with `status='sent'`, `template_wid='32755'`, `authkey_message_id` non-null (D.3)
- [ ] `model_payouts` row shows `status='paid'` with `paid_at` timestamp (D.4)

If any line fails, the failing artifact in D.1/D.2/D.3 typically identifies the root cause. Surface to me with the failing artifact + Vercel function log excerpt; I'll diagnose and patch.

---

## After smoke test passes

- Slice 7C opens immediately per partner cue.
- This doc is git-tracked for re-runs (e.g. after env-var changes or wid revisions).
- The test payout row in `model_payouts` can be cleaned up with:
  ```sql
  -- OPTIONAL: revert the test payout (un-link payments + delete payout row)
  UPDATE model_listing_payments SET payout_id = NULL WHERE payout_id = '<PAYOUT_ID>'::uuid;
  UPDATE model_wish_payments SET payout_id = NULL WHERE payout_id = '<PAYOUT_ID>'::uuid;
  DELETE FROM model_payouts WHERE id = '<PAYOUT_ID>'::uuid;
  ```
  Skip the cleanup if the test payment was real-money (you'd be unbatching a legitimate payout). For Stripe Sandbox test payments only.

---

## Cleanup at Slice 7C open

The `/api/smoke-test-mark-paid` endpoint shipped in Slice 7B (commit `afb4266`) is **temporary**. First task at Slice 7C kickoff: hard-delete the endpoint per `docs/slice-7c-cleanup.md`. Verification: `grep -rn "smoke-test-mark-paid" .` returns zero hits. The shared helper (`lib/ambassador/mark-payout-paid.ts`) and the production endpoint (`/api/admin/payouts/[id]/mark-paid`) STAY — they're real surfaces.
