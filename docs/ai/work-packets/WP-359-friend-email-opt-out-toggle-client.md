# WP-359 — Owner Profile: Friend-Email Opt-Out Toggle (Arena Client)

**Status:** Draft 2026-07-11 · **BLOCKED on WP-357** (the server must expose `friendRequestEmails` on `OwnerProfileView`/`OwnerProfilePatch`; WP-357 is drafted, not executed). **Standard two-session lane** (client contract mirror + a user-visible surface). Pairs with **EC-389** (execution-prep). Reserves **D-24151** (lands at execution).
**Primary Layer:** App (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` (`?route=me` → a checkbox to turn friend-request emails off). **D-24026 live-verify APPLIES.**
**Dependencies:** **WP-357** (`OwnerProfileView.friendRequestEmails` + `OwnerProfilePatch.friendRequestEmails`) ⛔ *drafted, not executed*; WP-104 / WP-299 (`MyProfilePage.vue` owner-edit form + `ownerProfileApi.ts`) ✅.
**Baseline:** `origin/main` @ (capture at execution — **must be after WP-357 merged**).

---

## Goal

Give the player the toggle for the preference WP-357 stores: a checkbox on the owner profile (`?route=me`) that reads `friendRequestEmails` from `GET /api/me/profile` and saves it through the existing `PATCH /api/me/profile`. This is the small client follow-on WP-357 named. No new API call — it rides the existing owner-profile fetch + save path, alongside the display-name / about-me / visibility fields.

---

## User-Visible Impact

On `?route=me`, a labelled checkbox — "Email me when someone sends me a friend request" — reflects the current preference and, when unchecked and saved, stops the friend emails (the server enforces it, WP-357). Default is checked (on).

---

## Assumes

- **WP-357 exposes the field.** `GET /api/me/profile` returns `friendRequestEmails: boolean`; `PATCH /api/me/profile` accepts `friendRequestEmails?: boolean`. ⛔ *Not on `main` at draft time — BLOCKED until WP-357 lands.*
- **The owner-edit form seeds refs from the loaded view and saves via one PATCH.** `MyProfilePage.vue` holds `form*` refs (`formAvatarVisibility`, etc.) seeded from `loaded.*` in the load handler and passed together to `updateOwnerProfile({...})`. The new preference follows that exact shape. (Verified: `MyProfilePage.vue:229,293,323`.)
- **`ownerProfileApi.ts` mirrors the server shape inline (no server import).** `OwnerProfileView` / `OwnerProfilePatch` are structural mirrors; adding `friendRequestEmails` mirrors WP-357's server addition. (Verified: `apps/arena-client/src/lib/api/ownerProfileApi.ts`.)

If WP-357 is not merged, or any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/work-packets/WP-357-friend-email-opt-out.md` — the server field this toggle reads/writes.
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — the `OwnerProfileView`/`OwnerProfilePatch` mirror + `fetchOwnerProfile`/`updateOwnerProfile`.
- `apps/arena-client/src/pages/MyProfilePage.vue` — the edit form (ref-seed + single-PATCH save; the visibility toggles are the direct precedent).

---

## Non-Negotiable Constraints

- ESM; `defineComponent` (D-6512); `.test.ts` under the arena-client `node:test` harness; human-style code per `00.6`; JSDoc.
- **Layer isolation** — no engine/registry-runtime/server/`pg`/`boardgame.io` import; `friendRequestEmails` is mirrored inline on the client `OwnerProfileView`/`OwnerProfilePatch` (no server-type import).
- **Additive, rides the existing PATCH.** No new endpoint call, no new composable — one ref + one checkbox + one field in the existing `updateOwnerProfile` body. Default `true` on load when the field is present.
- **No PvP framing** (§23(b)); no `accountId` surfaced.

---

## Scope (In)

### A) `ownerProfileApi.ts` — add `friendRequestEmails: boolean` to `OwnerProfileView`; `friendRequestEmails?: boolean` to `OwnerProfilePatch` (inline mirror of WP-357).
### B) `MyProfilePage.vue` — `const formFriendRequestEmails = ref(true)`; seed it from `loaded.friendRequestEmails` in the load handler; include `friendRequestEmails: formFriendRequestEmails.value` in the `updateOwnerProfile({...})` PATCH; render a labelled checkbox bound to it (next to the visibility toggles).
### C) Tests — `MyProfilePage.test.ts` (extend): the checkbox reflects the loaded value; toggling + save sends `friendRequestEmails` in the PATCH. `ownerProfileApi.test.ts` (extend if it shape-checks the view): the field is present.

---

## Out of Scope

- **No server change** — WP-357 owns storage/enforcement.
- **No separate notifications-preferences page** — one checkbox on the existing edit form (a broader prefs surface is future).
- **No match-invite / block preferences** — unrelated.
- **No engine / gameplay touch.**

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — **modified** (mirror field)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** (ref + save + checkbox)
- `apps/arena-client/src/pages/MyProfilePage.test.ts` — **modified**
- (`apps/arena-client/src/lib/api/ownerProfileApi.test.ts` — **modified** if it shape-checks the view)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24151**) + `STATUS.md`. `EC_INDEX.md` + EC-389 at execution-prep.

**2–3 code/test files. Standard two-session lane** (user-visible; could qualify for the lightweight lane once WP-357 is merged and a scaffold run is possible — executor's call).

---

## Acceptance Criteria

1. `OwnerProfileView`/`OwnerProfilePatch` client mirrors carry `friendRequestEmails` (**AC-1**).
2. `MyProfilePage.vue` seeds the checkbox from the loaded value (default `true`) and includes `friendRequestEmails` in the `updateOwnerProfile` PATCH on save; no other form behavior changes (**AC-2**).
3. No engine/registry-runtime/server/`boardgame.io` import; no `accountId` surfaced (**AC-3**).
4. `pnpm --filter @legendary-arena/arena-client typecheck` 0; `test` green; `pnpm -r build` 0 (**AC-4**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # 0
pnpm --filter @legendary-arena/arena-client test        # MyProfilePage suite green
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue","apps\arena-client\src\lib\api\ownerProfileApi.ts" -Pattern "friendRequestEmails"
git diff --name-only   # only the allowlist
```

---

## Definition of Done

- [ ] **WP-357 Done on `main`** — verified before execution
- [ ] All acceptance criteria pass; checkbox reads + writes `friendRequestEmails` via the existing PATCH
- [ ] No cross-layer import; no `accountId`
- [ ] `arena-client` typecheck 0 + test green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24151** Active; `WORK_INDEX` (WP-359) + `STATUS.md` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On deployed `?route=me`: uncheck + save → reload shows unchecked → sending that account a friend request fires no email (with WP-357 live). Operator-pending on deploy.

---

## Vision Alignment

No scoring/PvP surface. NG-1 (free preference). §23(b) copy neutral. Determinism N/A (client form).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 small standard-lane client change; §8 App boundary (no engine import; inline mirror); §15.1 APPLIES; §21 N/A (no server endpoint added). §18 grep targets `friendRequestEmails`.

## Pre-Flight / Copilot (drafter self-review)

**Pre-flight (01.4): NOT READY — BLOCKED on WP-357.** The server field isn't on `main`. Merged as a `[ ]` placeholder (01.0a Blocking-drafts), reserving WP-359/EC-389/D-24151. Re-run to READY once WP-357 lands. No other blocker (the form pattern + `ownerProfileApi` are verified).

**Copilot (01.7): PASS (design).** Pinned: (a) importing the server type → **inline mirror**; (b) a second API call → **rides the existing PATCH**; (c) wrong default → **`true` on load**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24151**: the owner-profile friend-email opt-out toggle — a checkbox on `MyProfilePage.vue` (`?route=me`) reading/writing WP-357's `friendRequestEmails` through the existing `fetchOwnerProfile`/`updateOwnerProfile` path (inline client mirror; default on; no new endpoint/composable). Drafted 2026-07-11; not yet landed (BLOCKED on WP-357).
