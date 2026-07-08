# WP-330 — Header Username Label (play)

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client`)
**Dependencies:** WP-175 (auth-nav `displayLabel` stub), WP-305 (owner-profile identity fields on `GET /api/me/profile`), WP-104 (owner profile endpoint), WP-101 (handle claim)
**User-Visible Surface:** play.legendary-arena.com

> Pick exactly one. A signed-in player sees their own name where the header
> currently reads "My account" — a real, observable change on the deployed
> play surface, so the D-24026 live-verify gate applies (not `none — infrastructure`).

---

## Session Context

WP-175 built the auth-aware header nav with a `displayLabel` ref **hardcoded to
"My account"** (WP-175 Amendment 1) explicitly pending the server returning
identity fields; WP-305 (Done 2026-07-04, D-24089) then added `displayName` +
`handleCanonical` to `GET /api/me/profile` and the client `fetchOwnerProfile`
already parses them — this packet only wires that **already-shipped** fetch into
`useAuthNav` to replace the hardcoded label. No server or contract work remains.

---

## Goal

After this packet, the signed-in play header shows the player's own
`displayName` (falling back to `@handleCanonical`, then `"My account"`) instead
of the static `"My account"` string. `useAuthNav()` fetches the owner profile
**once** on the signed-in transition via the existing
`fetchOwnerProfile()` (WP-305), resolves a label through a pure fallback chain,
and updates the reactive `displayLabel` that `Header.vue` already renders. The
fetch is non-blocking (the header renders "My account" until it resolves) and
silent-failing (any non-ok result leaves the fallback in place).

---

## User-Visible Impact

A signed-in player at play.legendary-arena.com sees **their own name** in the
header auth area (the `<span>` that currently always reads "My account", to the
left of the "My profile" link). A player who has claimed a handle but somehow
has an empty display name sees `@theirhandle`; a transient profile-fetch failure
falls back to "My account" (today's behavior). Signed-out and bootstrapping
states are unchanged.

---

## Assumes

- WP-305 complete. Specifically:
  - `apps/arena-client/src/lib/api/ownerProfileApi.ts` exports
    `fetchOwnerProfile(...)` returning a never-throwing result whose success
    value is `OwnerProfileView` with `displayName: string` and
    `handleCanonical: string | null` (D-24089).
- WP-175 complete. Specifically:
  - `apps/arena-client/src/composables/useAuthNav.ts` exports `useAuthNav()`
    returning `{ isSignedIn, isBootstrapping, displayLabel, signOut }`.
  - `apps/arena-client/src/components/branding/Header.vue` renders
    `{{ displayLabel }}` in the signed-in branch (currently line 53).
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the arena-client
  may not import `apps/server/**` or registry runtime; it consumes owner data
  only over HTTP via the existing `fetchOwnerProfile` wrapper. This packet adds
  no new cross-layer edge.
- `apps/arena-client/src/composables/useAuthNav.ts` — read entirely. Note the
  module-scoped memoized Hanko handle (`cachedHankoHandle`), the
  `provide/inject('isAuthBootstrapping', ...)` fail-safe default (D-17501), and
  the WP-175 Amendment 1 comment on the hardcoded label — that comment is
  **stale after WP-305** and must be replaced, not preserved.
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — read `fetchOwnerProfile`'s
  signature and the `OwnerProfileView` shape (`displayName`, `handleCanonical`),
  and confirm it returns a discriminated result and never throws.
- `apps/arena-client/src/components/branding/Header.vue` — how `isSignedIn`,
  `isBootstrapping`, and `displayLabel` are consumed (the label is a plain
  `<span>`; no template change is required here).
- `apps/arena-client/src/composables/useAuthNav.test.ts` — the three existing
  tests to update (bootstrapping / signed-out / signed-in).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:` comments), Rule 11 (full-sentence errors), Rule 14 (field names
  match the data contract — `displayName` / `handleCanonical` verbatim).

---

## Non-Negotiable Constraints

**Client-wide (always apply — do not remove):**
- No import from `apps/server/**`, `packages/registry/**` runtime, or
  `boardgame.io` in `useAuthNav.ts` or its test.
- ESM only, Node v22+; `node:test` / `node:assert` for tests; `.test.ts` only.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` compliance
  (arena-client tsconfig) — no inline ternary returning `T | undefined` for an
  optional, no unchecked index access.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Consume the existing `fetchOwnerProfile`** — do NOT add a new endpoint, a
  new `fetch`, or a duplicate profile type. The owner profile shape is a locked
  WP-104/WP-305 contract; this packet only reads two of its fields.
- **Fetch exactly once per signed-in transition.** Guard a single in-flight
  request; do not re-fetch on every reactive tick; do not poll.
- **Non-blocking.** `displayLabel` starts at `'My account'` and is updated only
  when the fetch resolves ok. The header must never wait on the fetch.
- **Silent fallback.** `fetchOwnerProfile` never throws; on any non-ok result
  (auth, 404, infra, network) leave `displayLabel` at `'My account'` — no
  console error, no user-facing error surface.
- **Reset on sign-out.** When `isSignedIn` goes false, set
  `displayLabel.value = 'My account'` so a subsequent different sign-in cannot
  show a stale name.
- **Label fallback chain (locked by D-24116):**
  `displayName` (trimmed, non-empty) → `@${handleCanonical}` (when
  `handleCanonical` is non-null) → `'My account'`.
  The **email-local-part rung named in WP-175 Amendment 1 is DROPPED**:
  `GET /api/me/profile` deliberately omits `email` (D-24089 — `OwnerProfileView`
  excludes private account fields), and `players.display_name` is `NOT NULL`, so
  `displayName` is always present; the handle and "My account" rungs are purely
  defensive. A `// why:` comment must record this.
- **Post-unmount safety.** A fetch that resolves after the composable's consumer
  unmounts must not throw or warn.

**Session protocol:**
- If any field name, return shape, or reactivity assumption is unclear, stop and
  ask before proceeding — never guess.

---

## Reserves

- **D-24116** — Header username label-resolution contract: fetch-once on the
  signed-in transition; the `displayName → @handleCanonical → "My account"`
  fallback chain; no email rung (owner profile omits email per D-24089);
  non-blocking render; silent fallback on fetch failure; reset to "My account"
  on sign-out.

---

## Scope (In)

### A) `apps/arena-client/src/composables/useAuthNav.ts` — modified
- Add a pure helper `resolveDisplayLabel(view: OwnerProfileView): string`:
  - return `view.displayName.trim()` when that is non-empty;
  - else return `` `@${view.handleCanonical}` `` when `handleCanonical` is
    non-null (and non-empty after trim);
  - else return `'My account'`.
  - `// why:` comment: the email rung from WP-175 Amendment 1 is intentionally
    absent because the owner profile omits email (D-24089) and `display_name` is
    `NOT NULL`, so `displayName` always wins; the later rungs are defensive.
- Replace the hardcoded `displayLabel = ref('My account')` with a reactive
  label that:
  - defaults to `ref('My account')`;
  - on the transition to signed-in-and-not-bootstrapping, calls
    `fetchOwnerProfile()` exactly once (single in-flight guard) and, on
    `{ ok: true }`, sets `displayLabel.value = resolveDisplayLabel(result.value)`;
    on any non-ok result leaves the fallback in place;
  - on sign-out (`isSignedIn` → false), resets `displayLabel.value = 'My account'`
    and clears the in-flight/loaded guard so a later different sign-in re-fetches.
  - Use a `watch` on the `isSignedIn` / `isBootstrapping` state (or an equivalent
    explicit effect), not a fetch at module scope; the fetch is per-composable.
  - Remove the stale WP-175 Amendment 1 comment and replace it with a `// why:`
    describing the non-blocking, fetch-once, silent-fallback behavior and citing
    WP-330 / D-24116.

### B) Tests — `apps/arena-client/src/composables/useAuthNav.test.ts` — modified
Update the existing three tests and add coverage (mock `fetchOwnerProfile`):
- bootstrapping state → `displayLabel` is `'My account'` (unchanged).
- signed-out state → `displayLabel` is `'My account'` (unchanged).
- signed-in, `fetchOwnerProfile` resolves `{ ok: true, value: { displayName:
  'Nova', handleCanonical: 'nova' , ... } }` → after the fetch settles,
  `displayLabel` is `'Nova'`.
- signed-in, `displayName` empty/whitespace + `handleCanonical: 'nova'` →
  `displayLabel` is `'@nova'`.
- signed-in, `fetchOwnerProfile` resolves a non-ok result → `displayLabel` stays
  `'My account'`.
- `fetchOwnerProfile` is called **at most once** across repeated reactive ticks
  in a single signed-in session (spy call-count assertion).
- Unit-test `resolveDisplayLabel` directly for the three rungs.

---

## Out of Scope

- **No server change** — WP-305 already shipped `displayName` / `handleCanonical`
  on `GET /api/me/profile`; this packet adds no field, endpoint, or route and
  does not touch `apps/server/**` or `api-endpoints.md`.
- **No `www` / marketing-site change** — surfacing the username on
  www.legendary-arena.com reverses D-24084 and is tracked as a separate packet
  (the Phase 3 auth-aware-www work); it is NOT this packet.
- **No avatar, badges, or team affiliations in the header** — label text only.
- **No new profile fetch or type** — consume the existing `fetchOwnerProfile` /
  `OwnerProfileView`; do not duplicate either.
- **No `MyProfilePage.vue` change** — display-name editing already shipped in
  WP-305.
- **No `Header.vue` production change** unless the scaffold proves the reactive
  label cannot flow through the existing `{{ displayLabel }}` binding (if it must
  change, self-demote out of the lightweight lane — see Lane note).
- Refactors or "while I'm here" cleanups beyond the stale-comment replacement.

---

## Files Expected to Change

- `apps/arena-client/src/composables/useAuthNav.ts` — **modified** — wire
  `fetchOwnerProfile` + `resolveDisplayLabel` into `displayLabel`.
- `apps/arena-client/src/composables/useAuthNav.test.ts` — **modified** —
  fallback-chain + fetch-once + silent-fallback coverage.
- `docs/ai/DECISIONS.md` — **modified** — add D-24116 (Active on execution).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — status row.
- `docs/ai/STATUS.md` — **modified** — session entry.
- `docs/ai/execution-checklists/EC_INDEX.md` + the EC file — **modified/new** —
  only if the lightweight lane is NOT taken (see Lane note).

No other files may be modified.

---

## Acceptance Criteria

### A) `useAuthNav.ts`
- [ ] Exports/holds a pure `resolveDisplayLabel(view)` implementing exactly the
      `displayName → @handleCanonical → 'My account'` chain; no email rung.
- [ ] `displayLabel` defaults to `'My account'` and is updated only from a
      resolved `{ ok: true }` `fetchOwnerProfile` result.
- [ ] `fetchOwnerProfile` is invoked at most once per signed-in session
      (single in-flight guard).
- [ ] Sign-out resets `displayLabel` to `'My account'` and clears the guard.
- [ ] No import of `apps/server/**`, registry runtime, or `boardgame.io`
      (confirmed with `Select-String`).
- [ ] The stale WP-175 Amendment 1 comment is gone; a new `// why:` records the
      no-email-rung + non-blocking + silent-fallback rationale.

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] Signed-in-with-displayName, empty-displayName-with-handle, and non-ok-result
      cases all assert the correct label.
- [ ] Fetch-once call-count assertion passes.
- [ ] `resolveDisplayLabel` unit test covers all three rungs.
- [ ] Test uses `node:test` / `node:assert`; no `boardgame.io` import.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — typecheck after all changes
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0, no vue-tsc errors

# Step 2 — run all arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing, 0 failing (count rises by the new cases)

# Step 3 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 4 — confirm no server/engine import in the composable
Select-String -Path "apps\arena-client\src\composables\useAuthNav.ts" -Pattern "apps/server|boardgame.io|@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = play.legendary-arena.com, D-24026):**
      after deploy, a signed-in player's header shows their `displayName` (not
      "My account"), confirmed live with observable evidence (screenshot or the
      deploy-confirmed commit SHA serving the change). Green tests are necessary
      but do NOT satisfy this item.
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` / `test` / `build`
      all exit 0.
- [ ] `docs/ai/STATUS.md` updated with the session entry.
- [ ] `docs/ai/DECISIONS.md` updated — D-24116 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated — WP-330 status row.

---

## Lane note (D-24028 — Lightweight Lane eligibility)

**Lightweight-lane-eligible.** Single layer (arena-client), two code/test files
plus governance, strictly wiring an **already-shipped** fetch
(`fetchOwnerProfile`, WP-305) into an **already-rendered** reactive label
(`displayLabel`, WP-175); no new endpoint, no contract change, no cross-layer
import, no `.sql`, no api-catalog row. The fallback chain was pre-specified in
WP-175 Amendment 1. May be drafted and executed in a single session; a separate
EC-360 is optional and may be skipped per `01.0a §Lightweight Lane`.

**Self-demote** to the standard two-session lane (and write EC-360) if the
scaffold shows `Header.vue` must change to carry the reactive label, or if the
signed-in fetch cannot be made single-in-flight without touching `App.vue`'s
auth bootstrap.
