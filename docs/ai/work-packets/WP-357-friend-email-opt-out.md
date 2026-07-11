# WP-357 — Friend-Request Email Opt-Out Preference (Server)

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: migration + an `OwnerProfileView`/`OwnerProfilePatch` contract field + a behavior change in the WP-353 notify boundary + catalog rows). Pairs with **EC-387** (authored at execution-prep). Reserves **D-24149** (lands at execution).
**Primary Layer:** Server (`apps/server`, `data/migrations`)
**User-Visible Surface:** none directly (server) — the `?route=me` toggle that flips the preference is a small **client follow-on**; the *effect* (fewer emails) is visible in inboxes. **D-24026 live-verify APPLIES** (opt out → confirm no email fires).
**Dependencies:** WP-353 (`friendshipNotifications.logic.ts` — the fail-open send boundary the check hooks into) ✅ **Done (PR #680)**; WP-104 / WP-305 (`OwnerProfileView` / `OwnerProfilePatch` + the transactional `upsertOwnerProfile` that writes `legendary.players` + `legendary.player_profiles`) ✅; migration 009 (`legendary.player_profiles` — the per-account preference home) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution). Highest migration on disk is `030`; next free is `031`.

---

## Goal

Let a player turn off friend-request emails. This closes the spam-vector risk WP-353 surfaced (an abuser spamming requests floods a victim's inbox) with a per-account preference: `friend_request_emails` on `legendary.player_profiles` (the existing per-account preference table, next to the visibility toggles), defaulting `true`. The WP-353 notify boundary reads the **recipient's** preference and, when it is off, degrades to a clean no-op (no email, no warn). The preference is read + written through the existing owner-profile surface (`GET`/`PATCH /api/me/profile`). This is the notification-opt-out follow-on the charter's abuse-controls work (packet #6) deferred.

---

## User-Visible Impact

A player who opts out (via the follow-on `?route=me` toggle, or the API today) stops receiving friend-request / request-accepted emails; everything else about friend requests is unchanged. A player who leaves it on (the default) is unaffected.

---

## Assumes

- **WP-353's send boundary is `sendFriendNotification`.** `friendshipNotifications.logic.ts` resolves the recipient + actor from `legendary.players` in one round-trip (`resolveIdentities`) and, if the sender + template id + recipient email are present, sends. The opt-out check is added there: skip the send when the **recipient's** `friend_request_emails` is `false`. Public signatures (`notifyFriendRequest{Received,Accepted}`, `FriendshipNotificationConfig`) are unchanged. (Verified: `apps/server/src/friendships/friendshipNotifications.logic.ts`.)
- **`legendary.player_profiles` is the per-account preference home.** It already carries `avatar_visibility` / `about_me_visibility` / `links_visibility` (migration 009), keyed on `player_id`, `ON DELETE CASCADE`, synthesized to defaults when the row is absent. `friend_request_emails` joins them. (Verified: `data/migrations/009_create_player_profiles_and_links.sql`.)
- **The owner profile read/write path is transactional and already touches both tables.** `getOwnerProfile` SELECTs `player_profiles` (synthesizing defaults when absent); `upsertOwnerProfile` runs `INSERT … ON CONFLICT (player_id) DO UPDATE` on `player_profiles` inside one `BEGIN/COMMIT` (with the WP-305 `players` display-name UPDATE). The new column is read there and written in the same upsert. (Verified: `apps/server/src/profile/ownerProfile.logic.ts`.)
- **`OwnerProfileView` is extended additively.** WP-305 already grew it 9→12 keys with a `DECISIONS.md` entry (D-24089); this adds one more (`friendRequestEmails`) the same way. (Verified: `ownerProfile.types.ts`.)
- **Migration numbering:** the next free migration is `031` (highest on disk is `030`). (Verified: `data/migrations/`.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer](../../../wiki/profile-login.md) — the charter; packet #6 explicitly deferred the notification opt-out to "a separate WP-353-dependent follow-up." This is it. WP-353's Risk section names the spam vector this closes.
- `apps/server/src/friendships/friendshipNotifications.logic.ts` (WP-353) — `resolveIdentities` + `sendFriendNotification` (where the recipient's preference is read + gated).
- `apps/server/src/profile/ownerProfile.logic.ts` + `ownerProfile.types.ts` (WP-104/305) — the read/write path + contract to extend additively.
- `data/migrations/009_create_player_profiles_and_links.sql` — the per-account preference table + its `player_id` FK / default-synthesis pattern.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the `GET`/`PATCH /api/me/profile` rows gain `friendRequestEmails`.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `node:` built-ins; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- No cross-layer import beyond the server set; no `boardgame.io`/engine/registry import.

**Packet-specific:**
- **Opt-out is recipient-scoped and default-on.** The gate reads the **recipient's** `friend_request_emails` (defaulting `true` when the `player_profiles` row or column value is absent — never accidentally silencing everyone). It governs **both** friend emails (received + accepted), since both flow through `sendFriendNotification`.
- **Opt-out is a clean no-op, not a warn.** When the recipient has opted out, the notify boundary returns without sending and **without** a `console.warn` (an opt-out is a normal outcome, not a failure) — distinct from the D-24077 fail-open warn paths, which stay for real failures.
- **WP-353 fail-open posture preserved.** The preference read happens inside the existing `try`; if the read itself throws, the boundary still degrades to the fail-open warn (never rejects). Public notify signatures unchanged.
- **Additive contract only.** `OwnerProfileView` gains one field; `OwnerProfilePatch` gains one optional field (`friendRequestEmails?: boolean`, never `| null` — the column is NOT NULL). Existing fields + the `Object.keys` drift test update together. The visibility toggles + display-name + links behavior are byte-identical.
- **Written through the existing transaction.** The `player_profiles` upsert sets `friend_request_emails` when the PATCH carries it; no new write path, no second round-trip.

**Session protocol:**
- If the `resolveIdentities` SELECT or the `upsertOwnerProfile` column list is unclear, stop and read `friendshipNotifications.logic.ts` / `ownerProfile.logic.ts` — do not invent the SQL.

---

## Scope (In)

### A) Migration `031_add_friend_request_emails_to_player_profiles.sql`
- `ALTER TABLE legendary.player_profiles ADD COLUMN IF NOT EXISTS friend_request_emails boolean NOT NULL DEFAULT true;` (idempotent; default `true` = existing accounts keep receiving emails).

### B) `ownerProfile.types.ts` (additive — D-24149)
- `OwnerProfileView` gains `friendRequestEmails: boolean`; `OwnerProfilePatch` gains `friendRequestEmails?: boolean`. Update the `Object.keys(...).sort()` drift assertion count.

### C) `ownerProfile.logic.ts`
- `getOwnerProfile`: SELECT `friend_request_emails` from `player_profiles`; synthesize `true` when the row is absent.
- `upsertOwnerProfile`: include `friend_request_emails` in the `INSERT … ON CONFLICT (player_id) DO UPDATE` column set when the PATCH carries `friendRequestEmails`.

### D) `friendshipNotifications.logic.ts` (recipient opt-out gate)
- Extend `resolveIdentities`' SELECT to `LEFT JOIN legendary.player_profiles pp ON pp.player_id = p.player_id` and select `COALESCE(pp.friend_request_emails, true) AS friend_request_emails`; add the flag to `ResolvedIdentity`.
- In `sendFriendNotification`, after resolving the recipient and before `sendTemplateEmail`: if `recipient.friendRequestEmails === false`, `return` (clean no-op, no warn).

### E) `api-endpoints.md` (D-11804, at execution)
- Update the `GET /api/me/profile` (response) + `PATCH /api/me/profile` (recognized fields) rows to include `friendRequestEmails`; whole-row replace.

### F) Tests
- `ownerProfile.logic.test.ts` (extend): default read is `true` (no profile row); a PATCH sets it `false` and it round-trips; the visibility/display-name behavior is unchanged; the `Object.keys` drift assertion covers the new key.
- `friendshipNotifications.logic.test.ts` (extend): a recipient with `friend_request_emails = false` → **no** `sendTemplateEmail` call and **no** warn; a recipient with `true` (or no profile row) → sends as before; a throw during the preference read → the existing fail-open warn still applies.

---

## Out of Scope

- **No client toggle** — the `?route=me` checkbox that flips the preference is a small **follow-on** on `apps/arena-client` (the field is exposed on the owner profile here; the UI reads/writes it later). No `arena-client` edit in this packet. (Note: WP-352 running/merged already owns the Friends UI; the toggle rides the owner-profile edit form, a separate small change.)
- **No new notification types / channels** — this governs the two existing WP-353 friend emails only; in-app notifications, digest emails, and a broader notification-preferences surface are future work.
- **No separate `notification_preferences` table** — one boolean lives on the existing `player_profiles` (duplicate-first; a dedicated prefs table is a future refactor if more toggles arrive).
- **No change to WP-353's notify signatures / fail-open contract** — the opt-out is an internal recipient-scoped gate; `notifyFriendRequest{Received,Accepted}` + `FriendshipNotificationConfig` are byte-identical.
- **No engine / `G` / RNG touch.**

---

## Files Expected to Change

- `data/migrations/031_add_friend_request_emails_to_player_profiles.sql` — **new**
- `apps/server/src/profile/ownerProfile.types.ts` — **modified** (additive field — D-24149)
- `apps/server/src/profile/ownerProfile.logic.ts` — **modified** (read + upsert the column)
- `apps/server/src/friendships/friendshipNotifications.logic.ts` — **modified** (recipient opt-out gate)
- `apps/server/src/profile/ownerProfile.logic.test.ts` — **modified**
- `apps/server/src/friendships/friendshipNotifications.logic.test.ts` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (`GET`/`PATCH /api/me/profile` rows)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24149**) + `STATUS.md` + `wiki/profile-login.md`. `EC_INDEX.md` + EC-387 at execution-prep.

**1 migration + 3 modified logic/types + 2 tests + catalog. Standard two-session lane.** No `server.mjs` (no new wiring — reuses the injected `pool` + the existing owner-profile route).

---

## Contract

- **New column:** `player_profiles.friend_request_emails boolean NOT NULL DEFAULT true`.
- **New view/patch field:** `OwnerProfileView.friendRequestEmails: boolean`; `OwnerProfilePatch.friendRequestEmails?: boolean` (never `| null`).
- **Locked Values:**

| Key | Value |
|---|---|
| Preference scope | **recipient**-scoped; governs **both** WP-353 friend emails (received + accepted) |
| Default | `true` (existing accounts + absent profile row + absent column value all resolve to `true` via the DEFAULT + `COALESCE`) |
| Opt-out effect | a `false` recipient → **clean no-op** in `sendFriendNotification` (no send, **no** `console.warn`) |
| Fail-open preserved | a throw during the preference read still hits the WP-353 fail-open warn; notify never rejects |
| Storage | one boolean on the existing `legendary.player_profiles` (no new table); read/written via `GET`/`PATCH /api/me/profile` |
| Contract | `OwnerProfileView`/`OwnerProfilePatch` additive; WP-353 notify signatures byte-identical |

---

## Acceptance Criteria

1. Migration `031` adds `friend_request_emails boolean NOT NULL DEFAULT true` (idempotent) (**AC-1**).
2. `GET /api/me/profile` returns `friendRequestEmails` (`true` by default, incl. when no `player_profiles` row exists); `PATCH` with `friendRequestEmails: false` persists it in the existing transaction and it round-trips; other owner-profile behavior byte-identical; the `Object.keys` drift test covers the new key (**AC-2**).
3. In `sendFriendNotification`, a recipient with `friend_request_emails = false` produces **no** `sendTemplateEmail` call and **no** `console.warn`; a recipient with `true`/absent sends as before (**AC-3**).
4. WP-353's fail-open posture is preserved (a preference-read throw → the existing warn; notify never rejects); `notifyFriendRequest{Received,Accepted}` + `FriendshipNotificationConfig` byte-identical (**AC-4**).
5. `api-endpoints.md` `GET`/`PATCH /api/me/profile` rows include `friendRequestEmails` (D-11804); `00.3 §21` passes (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (extended suites pass; DB-less skip parity; baseline otherwise unchanged) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server test   # ownerProfile + friendshipNotifications suites green
Select-String -Path "data\migrations\031_add_friend_request_emails_to_player_profiles.sql" -Pattern "friend_request_emails boolean NOT NULL DEFAULT true"
Select-String -Path "apps\server\src\friendships\friendshipNotifications.logic.ts" -Pattern "friend_request_emails|friendRequestEmails"
Select-String -Path "apps\server\src\profile\ownerProfile.types.ts" -Pattern "friendRequestEmails"
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `031` additive + idempotent; default `true`
- [ ] Owner profile reads + writes `friendRequestEmails` (default true; transactional upsert); drift assertion updated
- [ ] `sendFriendNotification` skips (clean no-op, no warn) for an opted-out recipient; WP-353 fail-open + signatures preserved
- [ ] `api-endpoints.md` `GET`/`PATCH /api/me/profile` rows updated (D-11804)
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24149** landed (Active); `WORK_INDEX` (WP-357) + `STATUS.md` + `wiki` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On a real DB with Brevo configured: opt a recipient out → send them a friend request → confirm **no** email fires (and the request itself still succeeds); opt back in → confirm the email fires. Operator-pending on deploy; proof is the suite + the DB smoke.

---

## Vision Alignment

**Vision clauses touched:** none of the scoring clauses. A notification preference on the social graph. **Conflict assertion:** No conflict — an opt-out control; no scoring/replay/RNG touch. **Non-Goal check:** NG-1 (not pay-to-win — a free preference). Business lens: an email opt-out is standard transactional-email hygiene (deliverability + trust), not anti-commercial — the marketing newsletter path (WP-293, double-opt-in) is separate and unaffected. **Determinism:** N/A — persistence + a read gate.

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (migration + contract field → not lightweight); §8 server boundary (no engine import; reuses WP-353/104 same-layer); §11 N/A (no new endpoint; the existing `/api/me/profile` auth is unchanged); §15.1 APPLIES (opt-out live check); §17 NG-1 + business-lens addressed, determinism N/A; §21 APPLIES (`GET`/`PATCH /api/me/profile` rows). §18 greps target identifiers, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-353 notify boundary, WP-104/305 owner profile, migration 009 prefs table). No blocker. Scope locked to migration + 3 logic/types + 2 tests + catalog. Contract field addition → standard lane. Not a validation-tightening of an existing input path (an additive preference), so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS.** Failure modes pinned: (a) a default that silences everyone → **`DEFAULT true` + `COALESCE(..., true)`, tested**; (b) an opt-out logged as a failure → **clean no-op, no warn (distinct from the fail-open warns)**; (c) breaking WP-353's fail-open/ signatures → **gate inside the existing `try`; signatures byte-identical**; (d) the preference governing only one of the two emails → **both flow through `sendFriendNotification`, one gate**; (e) an N+1 pref read → **folded into the existing `resolveIdentities` round-trip via LEFT JOIN**; (f) `OwnerProfileView` drift → **`Object.keys` assertion updated with the field**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24149**: the friend-request email opt-out (the WP-353-deferred notification preference). Locks: (1) storage as one boolean `friend_request_emails` on the existing `legendary.player_profiles` (migration 031, `DEFAULT true`; no new prefs table); (2) **recipient-scoped**, governing **both** WP-353 friend emails; (3) an opted-out recipient → **clean no-op** in `sendFriendNotification` (no send, no warn), with WP-353's fail-open warns preserved for real failures and the notify signatures byte-identical; (4) read/written additively via `OwnerProfileView`/`OwnerProfilePatch` (`friendRequestEmails`) through the existing transactional `upsertOwnerProfile`; (5) the pref read folded into the existing `resolveIdentities` round-trip (LEFT JOIN + `COALESCE`). The client `?route=me` toggle is a separate small follow-on. Drafted 2026-07-11; not yet landed.
