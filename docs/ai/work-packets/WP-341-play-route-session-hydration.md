# WP-341 — Play-Route Session Hydration (On-Gameover Submit Fix) + Restore the My-Scores View

**Status:** Done (executed 2026-07-09)
**Primary Layer:** Client (`apps/arena-client/**`)
**Dependencies:** WP-339/D-24127 (the on-gameover submit + My-Scores view being fixed), WP-160 (auth store), PR #547 (the lobby-hydration precedent this mirrors)
**EC:** EC-371
**Baseline:** `origin/main` at `49d96741` (2026-07-09)
**User-Visible Surface:** `play.legendary-arena.com` (D-24026 live-verify post-deploy)
**Reserves:** D-24129

---

## Goal

Fix two live defects in WP-339's arena-client competitive integration, both found via
Jeff's live test (2026-07-09, "when the game ends I get a popup — *sign in to submit your
score to the leaderboard*"):

1. **A signed-in player's score is never submitted on gameover.** `useAuthNav` /
   `shouldHydrateSession` only hydrate the cached broker session on the `me`,
   `admin-billing`, and `lobby` routes — **not `live`** (the play/match page). But the play
   page is exactly where a match reaches gameover, and WP-339's
   `useCompetitiveSubmitOnGameover` reads `useAuthStore().token` to decide whether to submit.
   So on the play page the token is `null` for *everyone*, and every finished match shows the
   guest message and never submits — even for a signed-in player. This is the identical class
   of bug PR #547 fixed for the lobby.

2. **`MyProfilePage.vue` is broken on `main` (arena-client typecheck red).** A per-block
   merge conflict when **#597 (EC-362)** — an older branch — merged 2 hours after WP-339
   (#617) kept WP-339's "Competitive Scores" `<template>` section but reverted its `<script>`
   (the `fetchMyScores` import, the `competitiveScores`/`scoresLoading`/`scoresError` refs,
   `loadScores`, the `onMounted` call, and the `setup()` return entries). The template
   references undefined bindings → `vue-tsc` fails and the section renders broken. Discovered
   while fixing (1).

---

## Fix

1. **`routeAuthPolicy.ts` — `shouldHydrateSession` gains `'live'`.**
   `return isGuardedRoute(route) || route === 'lobby' || route === 'live';`. Like the lobby,
   `live` hydrates the cached broker session **in the background** but is **NOT** guarded
   (`isGuardedRoute('live')` stays `false`) — a guest can still play/spectate; nothing blocks
   render or redirects to login. App.vue's existing hydration block (already gated on
   `shouldHydrateSession`) then runs for the play route with no other change. A signed-in
   player's token is present by the time the match ends, so the submission fires; a guest's
   token stays `null`, so the guest prompt is still correct.

2. **`MyProfilePage.vue` — restore the WP-339 My-Scores script** (import, the three refs,
   `loadScores`, the `onMounted` call, the return entries) so the template's bindings resolve.
   Byte-identical to WP-339's script; a `// why:` on the refs notes the #597 revert-recovery.

---

## Files Expected to Change

- `apps/arena-client/src/auth/routeAuthPolicy.ts` — **modified** — add `'live'`
- `apps/arena-client/src/auth/routeAuthPolicy.test.ts` — **modified** — `live` hydrates + not-guarded
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — restore the My-Scores script
- `docs/ai/work-packets/WP-341-play-route-session-hydration.md` — **new** — this file
- `docs/ai/execution-checklists/EC-371-play-route-session-hydration.checklist.md` — **new**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified** — D-24129

No server/engine change; no migration; no `functions/` change; §21 not triggered (client-only,
no endpoint/catalog change).

---

## Acceptance Criteria

- [ ] `shouldHydrateSession('live') === true` and `isGuardedRoute('live') === false` (a signed-in
      player's token hydrates on the play page; a guest still plays/spectates un-redirected).
- [ ] `routeAuthPolicy.test.ts` asserts both (and `live` is removed from the non-hydrating set).
- [ ] `MyProfilePage.vue` `setup()` again declares + returns `competitiveScores` /
      `scoresLoading` / `scoresError`, imports `fetchMyScores`, defines `loadScores`, and calls
      it on mount — the "Competitive Scores" template bindings resolve.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` passes (was **red on `main`**);
      `... test` passes; `pnpm -r build` 0.
- [ ] No server/engine change; no files outside the allowlist.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # PASS (was red on main from the #597 revert)
pnpm --filter @legendary-arena/arena-client test        # green (+ the two new routeAuthPolicy asserts)
pnpm -r build                                            # exits 0

Select-String -Path "apps\arena-client\src\auth\routeAuthPolicy.ts" -Pattern "route === 'live'"   # >=1
git diff --name-only apps/server packages/              # no output (client-only)
```

**Live-verify (D-24026, post-deploy):** on `play.legendary-arena.com`, **sign in**, finish a
match, and confirm the on-gameover status now shows "Submitting…" → "Score submitted to the
leaderboard" (not the guest prompt), and the score appears under "My Scores".

---

## Vision Alignment

**§22/§24** — makes the intended replay-verified competitive submission actually reachable for
an authenticated player (it was unreachable). No integrity change: the server still reduces +
hash-verifies + scores; the client only supplies the authenticated intent. Determinism: N/A
(client). Funding: N/A (a bug fix to an existing auth-gated flow).

## API Catalog Update (§21) — **Not triggered** (client-only; no endpoint/catalogued-function change).

## Lint Gate Self-Review (00.3) — PASS

Bounded 3-file client fix + governance; engine-wide + packet constraints met; `node:test`;
determinism N/A; §17 §22/§24 cited; §21 justified-N/A; User-Visible Surface = `play.legendary-arena.com`.

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated — names the fix (signed-in players' scores now submit on
      gameover; `MyProfilePage` typecheck-red from #597 restored) + the deploy-dependent live-verify
- [ ] `docs/ai/DECISIONS.md` — D-24129 (play route hydrates the broker session, non-guarded;
      + the #597 My-Scores revert-recovery) Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-341 checked off with date
- [ ] No files outside `## Files Expected to Change`
