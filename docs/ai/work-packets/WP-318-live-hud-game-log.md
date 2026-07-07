# WP-318 — Game Log Panel in the Live Play HUD

**User-Visible Surface:** play.legendary-arena.com (the in-match board). After
this packet a player sees a persistent, scrollable **Game Log** during a live
match — every engine log line, including the WP-316 villain-deck effect
narration (`Fight effect: … (hero)`, `Ambush effect: …`, `Escape effect: …`) and
the WP-317 composable grant lines (`… gained +N attack.`). Previously these were
projected to `UIState.log` but had **no on-screen home during play** — `GameLogPanel`
was mounted only in the replay inspector and the pre-plan notification, never in
`PlayDesktop` / `PlayMobile`.

## Goal

Mount the existing, tested `GameLogPanel.vue` in the live play pages
(`PlayDesktop.vue` + `PlayMobile.vue`), fed by `snapshot.log`, so the durable
game log is visible during a match. Client-only, read-only, no engine change, no
`finalStateHash` impact.

## Context (the miss this closes)

WP-316 shipped the Fight/Ambush/Escape per-target narration to `G.messages` →
`UIState.log`, and its D-24026 "live-verify" was recorded from a prod diagnostic
whose `uiStateSnapshot.log` contained the new lines. But that only confirmed the
**engine + projection** — the arena-client never rendered `UIState.log` in the
live HUD (`GameLogPanel` is used only by `ReplayInspector.vue` and
`PrePlanNotification.vue`). So WP-316 + WP-317's narration was invisible during
play. This packet gives it a visible home. (Operator report, 2026-07-07, match
`VvNJEjQUPJ5`: "I don't see any announcement of a villain fight/ambush effect.")

## Assumes

- `GameLogPanel.vue` (`apps/arena-client/src/components/log/`) renders a
  `readonly string[]` `log` prop verbatim (append-only, index-keyed) — already
  tested (`GameLogPanel.test.ts`).
- `UIState.log` is projected as `snapshot.log` and is available in both play
  pages' template scope (`storeToRefs(useUiStateStore()).snapshot`).
- `PlayDesktop.vue` / `PlayMobile.vue` are `defineComponent({ components, setup })`
  pages (EC-132 §2 SFC whitelist / D-6512).
- `vue-tsc --noEmit`, the arena-client test suite, and `vite build` pass on
  baseline (`origin/main` @ current).

## Scope (In)

- **`PlayDesktop.vue`** — import + register `GameLogPanel`; render it inside the
  `boardVisible` block (outside the `viewer !== null` gate so a spectator sees it
  too), before the `preplan-affordance` slot, in a `play-desktop__log` section
  with a "Game Log" heading, bound `:log="snapshot.log"`.
- **`PlayMobile.vue`** — same, at the bottom of `<main>` in a `play-mobile__log`
  column section.
- **Tests** — assert each page renders the log section + `GameLogPanel`, and that
  a snapshot whose `log` carries a `Fight effect:` / `Ambush effect:` / `gained
  +N attack.` line surfaces those lines verbatim.

## Out of Scope

- **Any engine / `UIState` / projection change** — the log is already projected;
  this is pure client mounting.
- **The center-screen `NotableEventOverlay`** — naming the specific hero in the
  transient popup is WP-319 (it enriches the hashed `notableEvents`; separate).
- **Log filtering, search, collapse/expand, autoscroll-to-bottom, styling
  beyond a minimal heading + the panel's own scroll** — cosmetic follow-ups.
- **`ReplayInspector` / `PrePlanNotification`** — their existing `GameLogPanel`
  usage is untouched.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/pages/PlayDesktop.vue` | **Modified** — mount `GameLogPanel` in the board |
| `apps/arena-client/src/pages/PlayMobile.vue` | **Modified** — mount `GameLogPanel` in `<main>` |
| `apps/arena-client/src/pages/PlayDesktop.test.ts` | **Modified** — assert the log renders |
| `apps/arena-client/src/pages/PlayMobile.test.ts` | **Modified** — assert the log renders |
| `docs/ai/DECISIONS.md` | **Modified** — D-24104 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-318 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-348 row |

No other files may be modified.

## Non-Negotiable Constraints

- Read-only: the client never authors or interprets log content (D-20002) — it
  renders `snapshot.log` verbatim through the existing leaf component.
- `defineComponent({ components })` registration (no `<script setup>` on these
  pages); no new dependency; no engine import beyond the existing UIState types.
- No `finalStateHash` / determinism impact (client-only render; `G.messages` is
  hash-excluded per D-24081 regardless).
- The log section is outside the `viewer !== null` gate on desktop so spectators
  and rewound-autoplay frames still see the log.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / the game explains itself), §11
  (UI consumes read-only projections). **Conflict assertion:** `No conflict.` The
  panel renders an engine-authored projection read-only; no gameplay/outcome
  change. **Non-Goal proximity:** none of NG-1..7 crossed. **Determinism:** N/A —
  client render only.

## Acceptance Criteria

1. `PlayDesktop` renders `[data-testid="play-desktop-log"]` + a `GameLogPanel`
   during the play phase (and for a spectator frame).
2. `PlayMobile` renders `[data-testid="play-mobile-log"]` + a `GameLogPanel`.
3. A snapshot whose `log` includes a `Fight effect:` / `Ambush effect:` / `gained
   +N attack.` line surfaces those lines verbatim in the HUD log (asserted).
4. `vue-tsc --noEmit` clean; arena-client test suite green; `vite build` succeeds.
5. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
cd apps/arena-client
npm run typecheck        # vue-tsc --noEmit → clean
npm run test             # arena-client suite → 0 fail
npm run build            # vite build → succeeds
cd ../..
git diff --name-only     # only the files in ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `vue-tsc` clean; arena-client `test` + `build` green
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, a live match shows the persistent Game Log with the
      Fight/Ambush/Escape effect lines and the Empowered/Berserk grant lines;
      until then STATUS.md records the test evidence + the deferred observation.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24104 Active;
      `WORK_INDEX.md` WP-318 `[x]`; `EC_INDEX.md` EC-348 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | Sections present; Out of Scope has ≥2 exclusions; single layer (arena-client) |
| 2 | ✅ PASS | Client layer only; renders an engine projection read-only; no cross-layer/engine edit |
| 3 | ✅ PASS | §Assumes lists GameLogPanel, snapshot.log, the SFC-authoring rule, the green baseline |
| 4 | ✅ N/A | No determinism surface — client render; G.messages hash-excluded (D-24081) |
| 5 | ✅ N/A | No persistence surface |
| 6 | ✅ N/A | No contract-file / union change |
| 7 | ✅ N/A | No canonical array |
| 8 | ✅ N/A | No move/phase |
| 9 | ✅ PASS | Naming: full words; data-testids follow the `play-*-log` convention |
| 10 | ✅ N/A | No `.reduce()` introduced |
| 11 | ✅ PASS | `// why:` on both mounts (read-only projection, spectator visibility) |
| 12 | ✅ PASS | No error path — pure render; empty log handled by the panel's own empty-state |
| 13 | ✅ PASS | `.test.ts`; node:test; vue-sfc-loader register; non-vacuous testid + text assertions |
| 14 | ✅ PASS | §Files ↔ EC §Files to Produce align (4 client + 4 governance) |
| 15 | ✅ PASS | No invented mechanic — mounts an existing component over an existing projection |
| 16 | ✅ PASS | Reuses `GameLogPanel` (no duplication); no new abstraction |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict |
| 18 | ✅ PASS | Verification uses typecheck/test/build + `git diff --name-only`; no forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP endpoint / server-import surface |

**Verdict: 21/21 resolved (10 PASS, 11 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Lightweight lane (single layer arena-client; 2 code + 2
test files; additive; no contract; no determinism/hash impact; narrow UX
surface). The one risk — an engine change sneaking in — is foreclosed: the log is
already projected to `snapshot.log`; this only mounts an existing tested leaf
component. Directly closes the WP-316 visibility gap surfaced on 2026-07-07.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (client renders an engine projection read-only), no
monetization/identity/RNG, no new contract, no hash impact. Mounts a pre-existing
tested component. No BLOCK modes.
