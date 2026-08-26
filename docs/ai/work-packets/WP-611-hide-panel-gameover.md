# WP-611 — Hide Deck Probability Panel at Game-Over

**Status:** Ready
**Primary Layer:** `apps/arena-client` (one computed + a test)
**Dependencies:** WP-607 / EC-642 / D-24418 (the `DeckProbabilityPanel.vue`), WP-610 / D-24421 (the placement fix that surfaced this)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `3c2d133f` (EC-645: Deck Probability Panel placement fix, #1659).

---

## Session Context

Follow-on to WP-610: with the panel now visible, it also lingers on the
**victory / game-over screen**, where expanding "Deck odds" shows only the
villain-deck rows (the viewer's draw pool is empty, and the Next-hand section
already self-hides). The panel is a **live-play aid** — once the match is over
there is no next hand and no more draws to advise, and the endgame report card
is the surface that matters. It should hide entirely.

---

## Goal

Once the match is over (`UIState.gameOver` present), the whole
`DeckProbabilityPanel` adds no DOM. Mid-match behaviour is unchanged.

---

## User-Visible Impact

The "Deck odds" panel disappears when the match ends, leaving the endgame
report card uncluttered. No mid-match change.

---

## Assumes

- WP-607 on `main`: `DeckProbabilityPanel.vue` with a `hasData` computed
  (`villainSummary !== null || ownDeckComposition !== undefined`) gating the
  `v-if` on the root `<section>`; it reads `snapshot` from `useUiStateStore`.
- `UIState.gameOver?: UIGameOverState` is present exactly when the match is over
  (the signal `EndgameActions.vue` uses); barrel-exported as `UIGameOverState`.
- `pnpm -r build` 0; arena-client `typecheck` + `test` green on `3c2d133f`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — the
  `hasData` computed (the only logic edit) + the root-`section` `v-if`.
- `apps/arena-client/src/components/play/EndgameActions.vue` — reads
  `UIState.gameOver !== undefined` as the match-over signal (the precedent).
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — the
  `snapshotWith` helper + panel tests (a `gameOver` override + a hide test).
- `packages/game-engine/src/ui/uiState.types.ts` — `UIGameOverState` (`outcome`,
  `reason` required; rest optional).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; a `// why:`
  on the match-over guard (why a live-play aid hides at game-over).

**Packet-specific:**
- **One computed + the `hasData` guard.** Add `isMatchOver` (`snapshot.gameOver
  !== undefined`) and make `hasData` `!isMatchOver && (villain || ownDeck)`. No
  template, style, projection, or engine change.
- **Client-only; reads the existing projection.** No engine / `G` / `ctx` /
  filter change — `gameOver` is already projected + barrel-exported.
- **A jsdom test is required** (unlike WP-610, this IS jsdom-observable): a
  would-render snapshot + `gameOver` present → the panel root is absent.

**Locked values:** match-over signal = `snapshot.gameOver !== undefined`.

---

## Scope (In)

### A) `DeckProbabilityPanel.vue` (**modified**)
- An `isMatchOver` computed (`snapshot.value?.gameOver !== undefined`) + `hasData`
  becomes `!isMatchOver.value && (villainSummary !== null || ownDeckComposition
  !== undefined)`, with a `// why:`.

### B) `DeckProbabilityPanel.test.ts` (**modified**)
- `snapshotWith` gains a `gameOver?: UIGameOverState` override; a new test:
  would-render data (villain + ownDeck) + `gameOver` → the panel root
  (`[data-testid="deck-probability-panel"]`) does not exist.

---

## Out of Scope

- **No change to mid-match rendering** — villain / own-deck / Next-hand sections
  are untouched when the match is live.
- **No engine / projection / filter change** — `gameOver` is already projected.
- **No new "match over" styling or endgame affordance** — this only hides.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — `isMatchOver` guard on `hasData`
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **modified** — `gameOver` override + hide test

No other **code** files may be modified. (The `EC-646:` implementation commit
touches exactly these 2; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync, card-data, or
monetization. A visibility guard on a read-only client aid. No engine / `G` /
`ctx` / hash surface.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `isMatchOver` = `snapshot.gameOver !== undefined`; `hasData` is false when
  the match is over even if villain/own-deck data is present.
- [ ] A jsdom test asserts the panel root is absent with would-render data +
  `gameOver` present; the existing mid-match tests are unchanged and pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; suite green.
- [ ] The `EC-646:` implementation diff is exactly the 2 code files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: all exit 0 / pass (+1 test)

Select-String -Path "apps\arena-client\src\components\play\DeckProbabilityPanel.vue" -Pattern "isMatchOver"
# Expected: the guard is present

git diff --name-only
# Expected (implementation commit): only DeckProbabilityPanel.vue + .test.ts.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a real deployed match, the "Deck odds" panel is gone on the game-over screen
  and present mid-match.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24422 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-611 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (always-apply + one-computed lock; locked signal). §3 Assumes — PASS. §4
  Context — PASS (cites the `gameOver` signal + the `EndgameActions` precedent).
- §5 Files — PASS (2 code files; governance is the separate SPEC commit). §6
  Naming — PASS. §7 Deps — PASS (none; `UIGameOverState` already barrel-exported).
  §8 Boundaries — PASS (client read-only). §9 Windows — PASS. §10/§11 — N/A.
- §12 Tests — PASS (jsdom hide test added; existing tests unchanged). §13 Commands
  — PASS. §14 Acceptance — PASS (4 binary items). §15/§15.1 — PASS (surface +
  D-24026 live-on-surface).
- §16 Code style — PASS (`// why:` on the guard). §17 Vision — N/A + no-hash note.
  §18 Prose-vs-grep — PASS (presence grep for `isMatchOver`). §19 — N/A. §20
  Funding / §21 API — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`3c2d133f`):** `hasData` gates
  the root `<section>` `v-if`; `UIState.gameOver?: UIGameOverState` is projected
  and barrel-exported; `EndgameActions.vue` uses the same `gameOver` signal. No
  collision.
- **PS items (blocking): none.** Trivial, self-contained, jsdom-testable.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** One computed + a guard + a test. The only
judgement is the signal: `gameOver` is the canonical match-over marker already
used by `EndgameActions.vue`, so no new state or heuristic is introduced. No
hidden coupling. Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24422 (reserved; Drafted 2026-08-26, not yet landed)** — The Deck
  Probability Panel is a **live-play aid** and hides entirely once the match is
  over (`UIState.gameOver` present — the `EndgameActions.vue` signal): there is no
  next hand or draw to advise and the endgame report card owns that surface. Prior
  behaviour (WP-607) kept it on the victory screen showing only villain-deck rows.
  Client-only `hasData` guard; no engine / projection / hash surface.

---

## See Also

- [WP-607](WP-607-deck-probability-panel-mvp.md) / D-24418 — the panel this guards
- [WP-610](WP-610-deck-panel-placement-fix.md) / D-24421 — the placement fix that surfaced the game-over lingering
- `apps/arena-client/src/components/play/EndgameActions.vue` — the `gameOver` signal precedent
