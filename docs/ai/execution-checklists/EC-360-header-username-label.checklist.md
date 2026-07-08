# EC-360 — Header Username Label (play) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-330-header-username-label.md
**Layer:** arena-client only (`useAuthNav.ts` composable + its test). **Lane:** Lightweight (single session; wires an already-shipped fetch into an already-rendered label).

## Before Starting
- [ ] On a fresh branch off `main`, clean, synced.
- [ ] Confirm `fetchOwnerProfile` in `apps/arena-client/src/lib/api/ownerProfileApi.ts` returns `{ ok: true, value: OwnerProfileView }` (with `displayName` / `handleCanonical`) and never throws (WP-305 / D-24089).
- [ ] Confirm `Header.vue` renders `{{ displayLabel }}` in the signed-in branch and `useAuthNav` still exposes `displayLabel: Ref<string>` (WP-175).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- Fallback chain (D-24116): `displayName.trim()` (when non-empty) → `@${handleCanonical}` (when non-null/non-empty) → `'My account'`. **No email rung** — the owner profile omits `email` (D-24089); `display_name` is NOT NULL.
- Fetch **once** per signed-in session (single in-flight + loaded guard); reset the label to `'My account'` and clear the guard on sign-out.
- The fetch is **non-blocking** (label starts at `'My account'`) and **silent-failing** (any non-ok result leaves the fallback).

## Guardrails
- No import of `apps/server/**`, registry runtime, or `boardgame.io` in the composable or its test.
- Consume the existing `fetchOwnerProfile` — no new endpoint, fetch, or profile type; no `api-endpoints.md` change; no server/engine diff.
- No `Header.vue` production change (the reactive label flows through the existing binding). If it must change, self-demote out of the lightweight lane.
- `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` compliance.

## Required `// why:` Comments
- On `resolveDisplayLabel` / the no-email rung (why: owner profile omits email per D-24089; `display_name` NOT NULL, so displayName always wins; handle + fallback are defensive).
- On the fetch-once guard and the non-blocking/silent-fallback watch (why: WP-330).
- Replace the stale WP-175 Amendment 1 comment (it asserts a limitation WP-305 removed).

## Files to Produce
- `apps/arena-client/src/composables/useAuthNav.ts` [`resolveDisplayLabel` + fetch wiring].
- `apps/arena-client/src/composables/useAuthNav.test.ts` [fallback-chain + fetch-once + silent-fallback coverage].
- Governance: `DECISIONS.md` (D-24116), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` / `test` / `build` all 0 (suite rises by the new cases).
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24116 Active) / WORK_INDEX (WP-330 `[x]`) / EC_INDEX (EC-360 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (a signed-in header shows the player's name, not "My account").

## Common Failure Smells
- Blocking the header render on the fetch (it must render "My account" first).
- Surfacing a console/UI error on a non-ok fetch (must be silent).
- Re-fetching on every reactive tick (guard must hold it to once per session).
- Re-adding the email rung (the owner profile has no email field — D-24089).
- Trying to assert the live label in jsdom without stubbing `fetch` (the test stubs `globalThis.fetch`).
