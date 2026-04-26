# Slice 7B Smoke Test — End-to-End Notification Verification

**Goal:** confirm Stripe Sandbox payment → webhook → payout batch → mark-paid → Resend email + AUTHKey WhatsApp fire correctly with all 5 variables substituted.
**Time budget:** ~10 minutes.
**Pre-condition:** Vercel deploy of `310e651` (or later) is live with `AUTHKEY_WID_PAYOUT_PAID=32755` set in production env.

---

## Auth shape — important context

The mark-paid endpoint (`/api/admin/payouts/[id]/mark-paid`) uses **Supabase SSR cookie auth**, not a service-role Bearer header. The `requireAdmin` helper (`lib/ambassador/admin-auth.ts`) calls `supabase.auth.getUser()` which reads `sb-*-auth-token` cookies, then SELECTs `public.users.role` to confirm `= 'Admin'`.

**There is no curl-only path** that bypasses this gate (per locked decision #2 — `?adminUserId` query-param gates are explicitly forbidden as client-spoofable). The realistic smoke-test path is:

1. Log in as an admin user through the same `/model/auth` magic-link UI any user uses.
2. Capture the resulting `sb-*` cookies from browser DevTools.
3. Use those cookies in the curl `-H "Cookie: ..."` header.

Important: if the admin signs up *fresh* via `/model/auth`, the route auto-creates them as `role='Model'`. The admin user must **already exist** in `public.users` with `role='Admin'` (set via Supabase Studio → Authentication → Users → the user's row → Edit → role column). Confirm before proceeding.

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

## Step B — Capture admin session cookies (2 min)

1. Open a **fresh incognito browser window** at `https://app.welovedecode.com/model/auth`.
2. Enter the admin email from pre-flight check 1.
3. Submit. Magic link is sent.
4. Open the email, click the magic link. Browser lands on `/model` (or `/model/setup` if first sign-in).
5. Open DevTools (F12) → Application tab → Cookies → `https://app.welovedecode.com`.
6. Find all cookies whose name **starts with `sb-`** (typically two: `sb-<project-ref>-auth-token` and `sb-<project-ref>-auth-token-code-verifier`).
7. For each cookie, copy `name=value` separated by `; ` into a single string. The result looks like:

   ```
   sb-abcdefghijkl-auth-token=base64-jwt-blob; sb-abcdefghijkl-auth-token-code-verifier=...
   ```

   Save this string for Step C — call it `$ADMIN_COOKIE`.

**Cookie shape gotcha:** the auth-token cookie value is a long base64 blob (often >2 KB). Copy the entire value verbatim — DevTools shows it truncated by default; click the cookie row → the right-side panel shows the full value.

---

## Step C — Mark-paid via curl (60 seconds)

🟨 **PASTE TO YOUR TERMINAL** (replace `<PAYOUT_ID>` and `<ADMIN_COOKIE>`)

```bash
PAYOUT_ID="<UUID-from-A.3>"
ADMIN_COOKIE="<the cookie string from B.7>"

curl -i -X PATCH \
  "https://app.welovedecode.com/api/admin/payouts/${PAYOUT_ID}/mark-paid" \
  -H "Cookie: ${ADMIN_COOKIE}"
```

Expected response:

```
HTTP/2 200
content-type: application/json
…

{"success":true,"payout_id":"<UUID>","status":"paid","paid_at":"2026-04-26T…"}
```

If you see:
- **HTTP 401 `{"error":"Unauthorized"}`** → cookies expired or mistyped. Re-do Step B.
- **HTTP 403 `{"error":"Forbidden"}`** → logged-in user is not `role='Admin'` in `public.users`. Confirm pre-flight check 1.
- **HTTP 404 `{"error":"Payout not found"}`** → wrong UUID. Re-check A.4.
- **HTTP 409 `{"error":"Cannot mark-paid from status 'paid'"}`** → already-marked-paid (idempotent guard). Re-run from A.1 with a fresh payout.

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

## Fallback if Step B (cookie capture) is too fiddly

If extracting cookies from DevTools is painful and partner wants a service-role-friendly path, ask me to ship a temporary `/api/admin/payouts/[id]/_smoke-test-mark-paid` endpoint that:
- Accepts `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY` instead of cookies
- Otherwise behaves identically to the production endpoint (same DB writes, same notification fires)
- Hard-deleted post-smoke-test in the same Slice 7C

That's a ~30 LOC patch + revert. Not in 7B scope, but trivial if needed.
