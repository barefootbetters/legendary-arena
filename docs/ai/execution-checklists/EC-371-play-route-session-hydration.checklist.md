# EC-371 — Play-Route Session Hydration (On-Gameover Submit Fix) + Restore the My-Scores View

**WP:** WP-341 · **Layer:** Client (`apps/arena-client/**`) · **Reserves:** D-24129
**Baseline:** `origin/main` @ `49d96741` (2026-07-09)
**Authority:** subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.

---

## Locked values (do not re-derive)

| Item | Value |
|---|---|
| `shouldHydrateSession('live')` | **`true`** (WP-341 — hydrate the play route in the background) |
| `isGuardedRoute('live')` | **`false`** (unchanged — guests still play/spectate; no block, no redirect) |
| Hydrating routes | `me`, `admin-billing`, `lobby`, **`live`** |
| Guarded routes | `me`, `admin-billing` (unchanged) |
| Non-hydrating routes | `login`, `profile`, `shared-loadout`, `fixture`, `play-fixture` (`live` removed) |
| MyProfilePage refs restored | `competitiveScores`, `scoresLoading`, `scoresError` |
| MyProfilePage import restored | `fetchMyScores`, `type MyCompetitiveScore` from `../lib/api/competitionApi` |

---

## Guardrails

- **G1** — `shouldHydrateSession` change is additive: `|| route === 'live'`. Do **not** touch
  `isGuardedRoute` (adding `live` there would block/redirect guests off the play page — wrong).
- **G2** — `MyProfilePage.vue` restore is **byte-identical** to WP-339's script (commit
  `9342758c`). Do not re-design the section; only re-add the lost `<script>` bindings so the
  already-present `<template>` resolves. A `// why:` on the refs notes the #597 revert-recovery.
- **G3** — Client-only. No `apps/server`, `packages/**`, migration, or `functions/` change.
- **G4** — `routeAuthPolicy.test.ts` must assert BOTH `shouldHydrateSession('live') === true`
  and `isGuardedRoute('live') === false`, and drop `live` from the non-hydrating set.

---

## Steps

1. [x] `routeAuthPolicy.ts` — `shouldHydrateSession` returns `... || route === 'live'`; doc
   comment explains the WP-341 fix (same class as the PR #547 lobby fix). `isGuardedRoute` untouched.
2. [x] `routeAuthPolicy.test.ts` — remove `live` from `NON_AUTH_ROUTES`; add `isGuardedRoute('live') === false`,
   `shouldHydrateSession('live') === true`, and `live` in the hydrate-superset loop.
3. [x] `MyProfilePage.vue` — restore the import, the three refs, `loadScores`, the `onMounted`
   call (`void loadScores();`), and the return entries (`competitiveScores`/`scoresLoading`/`scoresError`).
4. [x] `pnpm --filter @legendary-arena/arena-client typecheck` → PASS (was **red on `main`**).
5. [x] `pnpm --filter @legendary-arena/arena-client test` → green (**762/762**; +2 routeAuthPolicy asserts).
6. [x] `pnpm -r build` → 0.
7. [ ] Governance: WP-341, this EC, WORK_INDEX row, EC_INDEX row, STATUS entry, DECISIONS D-24129.
8. [ ] Commit `EC-371:` (impl) + `SPEC:` (close); open PR.

---

## §21 API Catalog — **Not triggered** (client-only; no endpoint or catalogued-function change).

## Completion Rule

Done only when steps 1–8 are satisfied, the arc's typecheck is green (main's red cleared), and
D-24129 is Active. Live-verify (D-24026) is deploy-dependent: sign in on `play.legendary-arena.com`,
finish a match, confirm the score submits (not the guest prompt) and appears under "My Scores".
