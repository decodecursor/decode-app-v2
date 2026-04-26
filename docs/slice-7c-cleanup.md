# Slice 7C — Cleanup Checklist

**Purpose:** track temporary code shipped during Slice 7B that must be hard-deleted at the start of Slice 7C, before any new feature work lands.

**Trigger:** Slice 7C opening commit. First task is to walk this checklist + delete + grep-verify, before any other work begins.

---

## Files / surfaces to delete

| Item | Path | Reason | Verification after delete |
|---|---|---|---|
| Smoke-test mark-paid endpoint | `app/api/smoke-test-mark-paid/route.ts` (+ containing directory) | Service-role-bearer-gated wrapper that lets the Slice 7B end-to-end notification smoke test bypass admin cookie auth. Production has no business invoking this. | `grep -rn "smoke-test-mark-paid" .` returns zero hits |
| Smoke-test runbook | `docs/slice-7b-smoke-test.md` | Slice-7B-specific procedure; no longer relevant after smoke test completes. Keep ONLY if partner wants the runbook as a re-runnable historical artifact. | Decision in 7C kickoff: delete or archive. |

## Code to leave in place (NOT for deletion)

| Item | Path | Why kept |
|---|---|---|
| `markPayoutAsPaid()` helper | `lib/ambassador/mark-payout-paid.ts` | Genuine refactor — makes the production endpoint thinner. Stays. |
| Production mark-paid endpoint | `app/api/admin/payouts/[id]/mark-paid/route.ts` | Real V1 surface. Stays. |
| Resend payout-paid email + AUTHKey WhatsApp wire | `lib/ambassador/notification-stubs.ts` + `lib/ambassador/email-templates.ts` | Real V1 notification path. Stays. |

---

## Procedure for 7C kickoff

1. `git checkout -b slice-7c` (or whatever branch shape partner uses)
2. `rm -r "app/api/smoke-test-mark-paid"`
3. Decide on `docs/slice-7b-smoke-test.md`: delete OR move to `docs/archive/`. (Recommend keep in `docs/` as historical procedure — re-runnable if Slice 7C remediation work needs another smoke-test pass.)
4. `grep -rn "smoke-test-mark-paid" .` — must return zero hits.
5. `npm run typecheck` — must pass clean.
6. Commit: `CHORE: Slice 7C kickoff — remove temporary smoke-test endpoint`.
7. Push + verify Vercel redeploy doesn't expose the endpoint at `/api/smoke-test-mark-paid`.

---

## Post-deletion sanity

After deletion + redeploy, this curl should return 404:

```bash
curl -i -X POST "https://app.welovedecode.com/api/smoke-test-mark-paid" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payout_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `HTTP 404` (Next.js default not-found page or `app/not-found.tsx` if visiting in browser).
