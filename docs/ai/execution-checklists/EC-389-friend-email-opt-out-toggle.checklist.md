# EC-389 — Friend-Email Opt-Out Toggle (WP-359)

**Pairs with:** WP-359 · **Reserves:** D-24151 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-11
**Layer:** App (`apps/arena-client`). No server, no engine, no migration.

## Before Starting
- [ ] Baseline `origin/main` after **WP-357 merged** (`friendRequestEmails` on `GET`/`PATCH /api/me/profile`).
- [ ] No DB needed (client). `pnpm --filter @legendary-arena/arena-client typecheck` + `test`; `pnpm -r build`.

## Locked Values
- Client `OwnerProfileView.friendRequestEmails: boolean` + `OwnerProfilePatch.friendRequestEmails?: boolean` (inline mirror of WP-357; no server import).
- `MyProfilePage.vue`: `formFriendRequestEmails = ref(true)`, seeded from `loaded.friendRequestEmails`, included in the existing `updateOwnerProfile` PATCH, rendered as a checkbox (`data-testid="my-profile-friend-request-emails"`) next to the visibility controls. Default `true` on load.

## Guardrails
- [ ] Rides the existing owner-profile fetch/save — **no new endpoint call, no new composable**.
- [ ] No engine/registry-runtime/server/`pg`/`boardgame.io` import; field mirrored inline (no server-type import).
- [ ] No `accountId` surfaced; §23(b) neutral copy.

## Files to Produce
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` (view + patch mirror)
- `apps/arena-client/src/pages/MyProfilePage.vue` (ref + seed + save + checkbox + setup return)
- `apps/arena-client/src/pages/MyProfilePage.test.ts` (checkbox reflects loaded value; toggle+save sends `friendRequestEmails`)

## After Completing
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0.
- [ ] D-24151 → Active; WORK_INDEX WP-359 `[x]`; EC_INDEX EC-389 row; STATUS entry; wiki + mindmap (WP-359 📝 → ✅).
- [ ] D-24026 live-verify operator-pending on deploy (uncheck + save → reload shows unchecked → no email fires with WP-357 live).

## Common Failure Smells
- Importing the server type instead of mirroring inline.
- A second API call instead of the existing PATCH.
- Wrong default (must be `true` on load).
