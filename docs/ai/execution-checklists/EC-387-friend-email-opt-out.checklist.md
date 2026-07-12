# EC-387 — Friend-Request Email Opt-Out Preference (WP-357)

**Pairs with:** WP-357 · **Reserves:** D-24149 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-11
**Layer:** Server (`apps/server`, `data/migrations`). No client, no engine.

## Before Starting
- [ ] Baseline `origin/main` captured; WP-353 (`friendshipNotifications.logic.ts`), WP-104/305 (`ownerProfile.*`), migration 009 all on `main`.
- [ ] Next free migration = `031` (highest on disk = `030`).
- [ ] `TEST_DATABASE_URL` set + migrations applied (incl. `031`) before the DB-backed suites.

## Locked Values (do not re-derive)
- Column: `legendary.player_profiles.friend_request_emails boolean NOT NULL DEFAULT true` (migration 031, `ADD COLUMN IF NOT EXISTS`).
- View/patch field: `OwnerProfileView.friendRequestEmails: boolean` (→ **13** keys); `OwnerProfilePatch.friendRequestEmails?: boolean` (never `| null`).
- Default resolution: absent `player_profiles` row OR absent value → `true` (DB DEFAULT + `COALESCE(..., true)`).
- Opt-out effect: recipient `false` → **clean no-op** in `sendFriendNotification` (no send, **NO** `console.warn`).
- Governs **both** friend emails (received + accepted — both via `sendFriendNotification`).

## Guardrails
- [ ] WP-353 notify **signatures byte-identical** (`notifyFriendRequest{Received,Accepted}`, `FriendshipNotificationConfig`); the opt-out gate is internal, inside the existing `try` (a pref-read throw still hits the fail-open warn; never rejects).
- [ ] Preference read **folded into** the existing `resolveIdentities` round-trip via `LEFT JOIN legendary.player_profiles` + `COALESCE(pp.friend_request_emails, true)` — no second query, no N+1.
- [ ] `OwnerProfileView`/`OwnerProfilePatch` extended **additively**; visibility/display-name/links behavior byte-identical; the `Object.keys` drift test updated with `friendRequestEmails` (12 → 13).
- [ ] Written through the **existing** transactional `upsertOwnerProfile` (`validatedFields` branch → `friend_request_emails` in the INSERT + RETURNING); `ValidatedFieldValue.value` widened to `string | boolean`.
- [ ] No new endpoint (no `api-endpoints.md` §21 new-row — the `GET`/`PATCH /api/me/profile` rows gain the field: whole-row replace, D-11804). No cross-layer import.

## Required Comments (`// why:`)
- [ ] The opt-out **no-op-no-warn** branch (an opt-out is normal, not a failure — distinct from the D-24077 fail-open warns).
- [ ] The `COALESCE(..., true)` default-on rationale (absent row/value never silences everyone).

## Files to Produce
- `data/migrations/031_add_friend_request_emails_to_player_profiles.sql` (new)
- `apps/server/src/profile/ownerProfile.types.ts` (view + patch + drift docstring)
- `apps/server/src/profile/ownerProfile.logic.ts` (row type + SELECT + synth + compose + upsert validate/INSERT/RETURNING)
- `apps/server/src/friendships/friendshipNotifications.logic.ts` (LEFT JOIN + recipient gate)
- `apps/server/src/profile/ownerProfile.logic.test.ts` (drift 13-key + read/write pref)
- `apps/server/src/friendships/friendshipNotifications.logic.test.ts` (opted-out → no send/no warn; default-on sends)
- `docs/ai/REFERENCE/api-endpoints.md` (GET/PATCH /api/me/profile rows)

## After Completing
- [ ] `pnpm -r build` 0; full DB-wired server suite green (baseline + new); migration 031 applied to real Postgres.
- [ ] D-24149 → Active; WORK_INDEX WP-357 `[x]`; EC_INDEX EC-387 row; STATUS entry; wiki packet-#6-followon → executed; mindmap node.
- [ ] `api-endpoints.md` rows updated (D-11804); `00.3 §21` pass.
- [ ] D-24026 live-verify noted operator-pending on deploy (opt out → no email fires).

## Common Failure Smells
- Default that silences everyone (must be `DEFAULT true` + `COALESCE(..., true)`).
- Opt-out logged as a `console.warn` (it's a clean no-op).
- Widening only one of view/patch (both, + drift test).
- Forgetting the RETURNING column (the PATCH response would drop the field).
