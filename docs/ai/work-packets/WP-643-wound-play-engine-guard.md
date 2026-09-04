# WP-643 — Wound Not-Playable Engine Guard (close the last "play a Wound" path at the reducer)

**Status:** Ready
**Primary Layer:** Game Engine (`packages/game-engine`) — the `playCard` move + the simulation `getLegalMoves` enumeration (its move-guard mirror)
**Dependencies:** WP-379 (the `healWounds` move + `WOUND_EXT_ID` Wound identity — Healing reads the **hand only**), WP-383 (the D-24185 card-specific pre-commit precondition class this mirrors), WP-555 (the discard-to-play `getLegalMoves`↔move-guard skip this mirrors)

**User-Visible Surface:** none — infrastructure (an engine correctness guard behind the already-shipped client fix PR #1785; no new player-visible affordance)

> Baseline: `origin/main` at commit `dc682506` (EC-676: Result-LAGN 1.5.0 Producer (WP-641), #1784).

---

## Session Context

A player reported "Heal Wounds is disabled once all my cards are in play."
The root cause: the hand row let a player **play** their Wound
(`hand → inPlay`), where the `healWounds` move — which scans the **hand
only** (`wiki/wounds.md §Healing reaches the HAND only`) — can no longer
reach it. PR #1785 fixed the **client** surface: `HandRow` now disables the
un-playable Wound tile so a player cannot initiate the play from the UI.

That fix is client-only. The **engine** still permits the play:

1. `packages/game-engine/src/moves/coreMoves.impl.ts` — `playCard` has **no
   Wound guard**. It removes `WOUND_EXT_ID` (`pile-wound`, from
   `setup/pilesInit.ts`) from the hand and calls `applyCardPlay`, moving it
   to `inPlay`. A raw socket message (or any non-UI caller) can still play a
   Wound, stranding it beyond `healWounds`' hand-only reach and (harmlessly
   but wrongly) granting its zero base economy + firing a no-op onPlay pass.
2. `packages/game-engine/src/simulation/ai.legalMoves.ts` (~line 561, the
   `playCard intents` loop) enumerates a `playCard` for **every** hand card
   including a Wound. So a bot can pick a Wound-play.

The documented invariant is unambiguous — `wiki/wounds.md`: Wounds "carry
no Attack or Recruit and **cannot be played**… there is no 'play a Wound'
path." This WP closes that path at the **reducer**, the engine-authoritative
layer, so the invariant holds for every caller, not just the UI.

---

## Goal

After this session, `playCard` rejects a Wound at the engine: a `playCard`
whose `cardId` is `WOUND_EXT_ID` returns `void` with **no commit** — the
Wound stays in hand, no base economy is granted, no onPlay pass fires,
before any zone removal — mirroring the WP-383 / D-24185 card-specific
pre-commit precondition class. In lockstep, the simulation `getLegalMoves`
`playCard` enumeration **skips** `WOUND_EXT_ID`, so the bot never enumerates
a move the precondition would silently reject — mirroring the discard-to-play
`continue` (WP-555 / D-24364) directly above it, and keeping bot
`legalMoves`↔move-guard in sync (the divergence class that has repeatedly
wedged bot turns — a re-picked, always-refused move that never changes the
legal set). No new mechanic, no new G state, no player-visible surface — an
engine correctness guard behind the shipped client fix.

---

## User-Visible Impact

None directly. The client already blocks the Wound tile (PR #1785); this WP
makes the engine enforce the same rule for non-UI callers (a raw socket
message, a bot). The player-facing benefit is indirect: the "Heal Wounds
disabled after all cards in play" trap cannot recur via the wire, and a bot
ally can never wedge its turn by trying to play a Wound.

---

## Assumes

- WP-379 complete: `healWounds` (`moves/healWounds.ts`) KOs Wounds **from the
  hand**; the Wound identity `WOUND_EXT_ID = 'pile-wound'` lives in
  `setup/pilesInit.ts`. Because Healing reaches only the hand, a Wound moved
  to `inPlay` is unreachable — the exact bug this closes.
- WP-383 complete: `playCard` (`moves/coreMoves.impl.ts`) already carries one
  card-specific PRE-COMMIT precondition — the discard-to-play cost check
  (D-24185) — placed after the `playerZones` null-check, before the hand
  removal, returning `void` with no commit. This WP adds a second precondition
  of the same class, ahead of it.
- WP-555 complete: `ai.legalMoves.ts`'s `playCard` loop already `continue`s
  past an unpayable discard-to-play card (D-24364), reading the cost from the
  single authority `getDiscardToPlayCost`. This WP adds a `continue` of the
  same shape for `WOUND_EXT_ID`, immediately above it.
- `WOUND_EXT_ID` is exported from `packages/game-engine/src/setup/pilesInit.ts`
  (a pure helper, no boardgame.io import) and is importable by both
  `moves/coreMoves.impl.ts` and `simulation/ai.legalMoves.ts` without a layer
  violation (both are engine-internal; `heroEffects.execute.ts` already imports
  it).
- `pnpm -r build` exits 0; the game-engine suite passes on `dc682506`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/moves/coreMoves.impl.ts` — read `playCard`
  (Step 1 validate → Step 2 stage gate → block-all pending cluster → Step 3
  mutate). The new guard goes in Step 3, **immediately after** the
  `playerZones` null-check and **before** the existing `getDiscardToPlayCost`
  discard-to-play precondition. Note `applyCardPlay` (the shared core) is what
  the play delegates to after the hand removal — the guard must return before
  `moveCardFromZone` removes the Wound from hand.
- `packages/game-engine/src/setup/pilesInit.ts` — `WOUND_EXT_ID = 'pile-wound'`
  (the import source).
- `packages/game-engine/src/moves/resolveDiscardToPlay.ts` — the D-24185
  precedent: `getDiscardToPlayCost` + the `playCard` precondition's shape
  (read the card, return `void` before any mutation). The Wound guard is the
  simpler sibling (a fixed-id equality, no cost arithmetic).
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — read the
  `playCard intents` loop (`for (const cardId of zones.hand)`, ~line 561) and
  the discard-to-play `continue` that already lives inside it (WP-555). The
  Wound `continue` goes at the **top** of the loop body, before the
  discard-to-play cost read.
- `packages/game-engine/src/moves/coreMoves.impl.test.ts` (or the existing
  `playCard` test file — confirm the exact path) — the `playCard` unit-test
  pattern for the Wound no-op assertion.
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` (confirm the
  exact path) — the `getLegalMoves` enumeration test pattern for the "no
  playCard for a Wound, other hand cards still offered" assertion.
- `wiki/wounds.md §Wounds can't be played` (Edge Cases) — the invariant this
  enforces; today it documents the rule with **no** engine-guard note. Add one
  sentence: the engine now enforces it at `playCard` (WP-643 / D-24455), so the
  rule holds for non-UI callers, not just the disabled client tile.
- `docs/ai/DECISIONS.md` — D-24185 (the discard-to-play pre-commit precondition
  class), D-24184 (the discard-to-play park), D-24364 (the discard-to-play
  `getLegalMoves` skip); land the reserved D-24455 at execution.
- `.claude/rules/architecture.md §Move Validation Contract` — a move MAY reject
  a play with a card-specific pre-commit precondition as part of Step 1/validation
  (D-24185); this is a validation-phase silent return, distinct from the
  pending-choice pattern.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here.
- Moves never throw — the guard is a plain early `return`.
- Never persist `G`/`ctx`; add no G field — the guard reads `args.cardId` only.
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no `.reduce()` in
  the move/enumeration.

**Packet-specific:**
- The guard is a **card-specific PRE-COMMIT precondition** (D-24185 class): a
  silent `void` return with **no commit** — the Wound stays in hand, no economy,
  no onPlay pass — placed **before** the `moveCardFromZone` hand removal. It is
  NOT a pending-choice/block-all guard (those fire after commit) and NOT a stage
  gate.
- Place the `playCard` guard **after** the `playerZones` null-check and
  **before** the existing discard-to-play precondition. (A Wound carries no
  discard-to-play cost, so order is behaviorally neutral, but "the card can
  never be played" is the more fundamental rejection and reads first.)
- The `getLegalMoves` skip is a `continue` at the **top** of the `playCard`
  loop body, before the discard-to-play cost read — mirroring the discard-to-play
  `continue` exactly (same loop, same `continue` idiom).
- Both files import `WOUND_EXT_ID` from `../setup/pilesInit.js` — never re-declare
  the string literal (the drift the `WOUND_EXT_ID` constant exists to prevent).
- This is a move-guard + enumeration change, **not** a new move — do NOT touch
  `game.ts`'s move registration or `game.test.ts`'s move-set drift pin (no new
  bgio move is added; `playCard` is already registered).
- **Determinism:** adds no G field, so no hash re-pin. The guard rejects a move
  no recorded/seeded game plays (a real recorded game never plays a Wound; the
  UI blocked it and the bot policy would rarely pick it), so `finalStateHash` /
  `PRE_WP080_HASH`, `sim:runtime-observed`, and the write-once difficulty-driven
  Seed PAR (`docs/12` — computed from authored difficulty ratings, NOT from bot
  trajectories) are all expected byte-unchanged. Verified empirically at draft
  (see Vision Alignment). If the engine suite or `sim:runtime-observed:check`
  DOES move, that is a real trajectory shift — capture it, re-pin the moved
  oracle to the captured value with a recorded `// why:`, and note it; NEVER
  alter logic to chase a hash.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **Wound ext_id:** `WOUND_EXT_ID = 'pile-wound'` (imported from `setup/pilesInit.js`).
- **`playCard` guard:** `if (args.cardId === WOUND_EXT_ID) { return; }` — after the
  `playerZones` null-check, before the discard-to-play precondition.
- **`getLegalMoves` skip:** `if (cardId === WOUND_EXT_ID) { continue; }` — top of the
  `playCard intents` loop body, before the discard-to-play cost read.

---

## Debuggability & Diagnostics

- The guard is deterministic and observable: a `playCard` on a Wound leaves the
  hand, `inPlay`, and `turnEconomy` byte-identical — verifiable by a unit test
  that plays `WOUND_EXT_ID` from a hand and asserts no state change.
- `getLegalMoves` for a hand containing a Wound plus a playable Hero returns a
  `playCard` for the Hero and **none** for the Wound — verifiable by a unit test.
- No new state; `G` stays JSON-serializable (unchanged).

---

## Scope (In)

### A) Engine — `playCard` Wound pre-commit precondition (`packages/game-engine/src/moves/coreMoves.impl.ts`, **modified**)
- Import `WOUND_EXT_ID` from `../setup/pilesInit.js`.
- In `playCard` Step 3, after the `playerZones` null-check and before the
  existing discard-to-play precondition, add
  `if (args.cardId === WOUND_EXT_ID) { return; }` with a `// why:` (a Wound has
  no play path per `wiki/wounds.md`; silent void, no commit, the D-24185 class;
  without it a raw socket message strands the Wound beyond `healWounds`' hand
  reach; the `getLegalMoves` enumeration is kept in lockstep).

### B) Engine — `getLegalMoves` Wound skip (`packages/game-engine/src/simulation/ai.legalMoves.ts`, **modified**)
- Import `WOUND_EXT_ID` from `../setup/pilesInit.js`.
- At the top of the `playCard intents` loop body (`for (const cardId of
  zones.hand)`), before the discard-to-play cost read, add
  `if (cardId === WOUND_EXT_ID) { continue; }` with a `// why:` mirroring the
  discard-to-play skip (a Wound is unplayable — enumerating it wedges the turn,
  the `getLegalMoves`↔move-guard divergence class).

### C) Engine tests
- The `playCard` unit-test file (`coreMoves.impl.test.ts` or the confirmed
  path) — **modified**: playing `WOUND_EXT_ID` from a hand is a no-op — the
  Wound stays in hand, `inPlay` stays empty, `turnEconomy` is unchanged, no
  onPlay pass runs; a non-Wound card in the same hand still plays normally
  (proves the guard is Wound-specific, not a blanket block).
- The `getLegalMoves` unit-test file (`ai.legalMoves.test.ts` or the confirmed
  path) — **modified**: `getLegalMoves` on a main-stage state whose hand holds a
  Wound plus a playable Hero returns a `playCard` for the Hero and **no**
  `playCard` for the Wound (the Wound is absent from the enumerated set).

### D) Docs / wiki (`wiki/wounds.md`, **modified**)
- In `§Edge Cases → Wounds can't be played`, add the engine-guard note: the
  engine now enforces the no-play rule at `playCard` (WP-643 / D-24455) — a
  reducer-level rejection of `WOUND_EXT_ID` — so the invariant holds for every
  caller (a raw socket message, a bot), not only the client-disabled tile
  (PR #1785). Keep it to one or two sentences; do not restructure the page.

---

## Out of Scope

- **No new mechanic, counter, scoring, or reward** — a correctness guard only.
- **No new G field / no new move** — `playCard` is unchanged in registration;
  `game.ts` / `game.test.ts` move-set drift pin untouched.
- **No client change** — PR #1785 already disables the Wound tile; this WP does
  not touch `apps/arena-client`.
- **No change to `healWounds`, `gainWound`, or the wounds supply/loss logic** —
  the Wound lifecycle is untouched; only the play path is closed.
- **No Enraging-Wound / play-time-cost Wound variants** — Wounds have no on-play
  interaction at all; there is nothing to add.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

**Engine — guard + enumeration:**
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — import `WOUND_EXT_ID` + the `playCard` pre-commit Wound rejection
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — import `WOUND_EXT_ID` + the `playCard`-loop Wound `continue`

**Engine — tests:**
- `packages/game-engine/src/moves/coreMoves.impl.test.ts` — **modified** — playCard-Wound no-op (hand/inPlay/turnEconomy unchanged) + a non-Wound still plays
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — getLegalMoves omits playCard for a Wound while still offering other hand cards

**Docs / wiki:**
- `wiki/wounds.md` — **modified** — engine-guard note in `§Edge Cases`

**Empirical (determinism — expected UNCHANGED, NOT re-pinned):**
- Hash oracles (`sentinel-core-doom-2p.replay.json` `finalStateHash`,
  `PRE_WP080_HASH` in `replay/replay.execute.test.ts`) and
  `docs/ai/coverage/runtime-observed-hollows.json` are expected byte-unchanged
  (no G field; no recorded/seeded game plays a Wound). They are NOT in the
  allowlist. If the engine suite or `sim:runtime-observed:check` DOES move,
  investigate first (a real trajectory shift), then re-pin the moved oracle to
  the captured value with a `// why:` as an inline EC amendment — never chase a
  hash by altering logic.

The exact test-file paths (C) are confirmed at execution against the repo; if
the `playCard` / `getLegalMoves` tests live in a differently-named file, the
allowlist entry is corrected inline (a file-path correction is the permitted
inline amendment class). `git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces directly: no
scoring/PAR/leaderboards change (the guard rejects a move; it does not alter a
score), no identity, no multiplayer sync, no card-data/content-semantics change,
no monetization. NG-1..7 preserved (no pay-to-win, no PvP — a Wound is a shared
game-component rule).

**Determinism note (load-bearing, EMPIRICALLY VERIFIED at draft):** the change
adds **no G field**, so there is no hash re-pin of the WP-080 dual-oracle class.
The guard rejects a move that no recorded or seeded game exercises, so the
seeded bot trajectories are unshifted. Scaffolded at draft on `dc682506`:
- `pnpm --filter @legendary-arena/game-engine test` → **2948 / 0** on the bare
  two-source scaffold (before the 4 new tests), then **2952 / 0** with the WP's
  4 tests added — both all-pass, including the `replay.hash`,
  `simulation.captureMoves`, `hashGameState`, and `replay.execute` PRE_WP080
  oracles, which stay byte-stable (no re-pin) in both runs.
- `pnpm sim:runtime-observed:check` → **current** (the bounded bot sweep's
  trajectories are unchanged; the artifact is not stale).
- The Seed PAR (`docs/12`) is **write-once and difficulty-driven** —
  `computeParScore(baseline)` over authored difficulty ratings, NOT derived from
  bot simulation trajectories — so a `getLegalMoves` change cannot stale it
  (`scripts/generate-seed-par.mjs` reads `data/difficulty-ratings/…`, not sim
  output).

So the task's a-priori "likely stales the hash oracles / PAR baselines / sweep"
concern does **not** materialize — recorded here as an observed result, not a
prediction. Stronger than empirical: the greedy bot policy already scored a
Wound-play at `SCORE_PLAY_WOUND = -1` (`simulation/ai.competent.ts`), strictly
below `SCORE_END_TURN_BASE = 5` and `SCORE_ADVANCE_STAGE_BASE = 10`, and a
lifecycle escape (`endTurn` / `advanceStage`) is always available in the main
stage — so the bot **never selected** a Wound-play even when the enumeration
offered one. Removing it from the enumeration therefore cannot shift any seeded
sweep trajectory (the trajectory is provably unchanged, not merely observed so).
Still, the AC + EC REQUIRE re-running the engine suite +
`sim:runtime-observed:check`; if either moves at execution, capture-and-re-pin
the moved oracle (never chase). The `getLegalMoves` skip is what keeps the bot
from wedging on a refused Wound-play (the `reference_bot_legalmoves_moveguard_divergence`
class) — the reason the enumeration and the guard MUST land together.

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy. An
engine correctness guard.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
guard is inside a boardgame.io move, reached over the state push, not the HTTP
surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine
- [ ] `playCard` with `args.cardId === WOUND_EXT_ID` is a no-op: the Wound stays
  in the player's hand, `inPlay` is unchanged, `turnEconomy` is unchanged, and
  no onPlay hero-effect pass runs (unit test).
- [ ] `playCard` with a non-Wound `cardId` still plays normally from the same
  hand (proves the guard is Wound-specific, not a blanket block).
- [ ] `getLegalMoves` on a main-stage state whose hand holds `WOUND_EXT_ID` plus
  a playable Hero returns a `playCard` for the Hero and **no** `playCard` for
  the Wound (unit test).
- [ ] Both `coreMoves.impl.ts` and `ai.legalMoves.ts` import `WOUND_EXT_ID` from
  `../setup/pilesInit.js` (no re-declared literal).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with **no hash
  re-pin** (`finalStateHash` + `PRE_WP080_HASH` byte-identical); if either
  moves, investigate before re-pinning.

### Determinism / build / scope
- [ ] `pnpm sim:runtime-observed:check` reports current (no artifact re-gen).
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
  (`git diff --name-only`), modulo an inline test-file-path correction.

---

## Verification Steps

```pwsh
# Step 1 — build everything (engine dist must exist for any dependent typecheck)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (guard no-op + enumeration skip + hash oracles unchanged)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; finalStateHash + PRE_WP080_HASH byte-identical (NO re-pin)

# Step 3 — bot sweep artifact freshness (trajectory-neutral)
pnpm sim:runtime-observed:check
# Expected: OK: runtime-observed hollows artifact is current.

# Step 4 — confirm the guard + skip landed with the shared constant
Select-String -Path "packages\game-engine\src\moves\coreMoves.impl.ts" -Pattern "args.cardId === WOUND_EXT_ID"
Select-String -Path "packages\game-engine\src\simulation\ai.legalMoves.ts" -Pattern "cardId === WOUND_EXT_ID"
# Expected: one match each

# Step 5 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; `finalStateHash`
  + `PRE_WP080_HASH` byte-identical (no re-pin); `pnpm sim:runtime-observed:check`
  current.
- [ ] No files outside `## Files Expected to Change` were modified
  (`git diff --name-only`).
- [ ] `wiki/wounds.md` documents the engine-side no-play guard.
- [ ] `docs/ai/STATUS.md` updated — the engine now forbids playing a Wound at
  the reducer (closing the last "play a Wound" path behind PR #1785).
- [ ] `docs/ai/DECISIONS.md` updated — land D-24455 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-643 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm
  roadmap:counts:write` refreshed.

> **No D-24026 live-verify line:** this WP has no user-visible surface (the
> client fix PR #1785 already shipped the visible behavior). The guard is
> engine-internal correctness, verifiable by the unit tests above; there is no
> deployed-bundle affordance to observe.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (new mechanic/G-field/move, client change, healWounds/gainWound/supply, Enraging-Wound variants).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-379 / WP-383 / WP-555 named with exact exports/paths + green baseline `dc682506`.
- **§4 Context (Read First)** — PASS. Specific files + the D-24185 precedent + the architecture Move Validation Contract. No `00.2` reference: the guard reads an existing zone id, adds no card-data/setup contract.
- **§5 Files** — PASS. 5 files (2 engine source + 2 engine tests + 1 wiki); the determinism oracles are explicitly declared UNCHANGED and deliberately NOT in the allowlist (contrast WP-642, where a re-pin WAS expected). Well under the ~8 rule of thumb; single-layer, additive.
- **§6 Naming** — PASS. `WOUND_EXT_ID`, `playCard`, `getLegalMoves`, `cardId`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency; imports an existing engine-internal constant.
- **§8 Architectural boundaries** — PASS. `setup/pilesInit.ts` is a pure helper (no boardgame.io import); `coreMoves.impl.ts` and `ai.legalMoves.ts` already import engine-internal modules; no cross-layer/upward import; the simulation layer already reads move-guard authorities (`getDiscardToPlayCost`) to stay in sync.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; no `boardgame.io/testing`; `makeMockCtx` convention.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the "build before test" stale-dist ordering is called out.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable; the no-op + the Wound-specificity + the enumeration skip pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = none — infrastructure`, so §15.1 live-on-surface (D-24026) is declared N/A with justification (the visible fix shipped in PR #1785).
- **§16 Code style** — PASS. Explicit early return / `continue`, `// why:` on each, no abbreviations, no `.reduce()`.
- **§17 Vision Alignment** — N/A (declared with justification) + the required determinism note: no G field, no hash re-pin; empirically verified byte-stable at draft (2948/0 + `sim:runtime-observed:check` current + Seed PAR is difficulty-driven not trajectory-derived).
- **§18 Prose-vs-grep** — PASS. Verification Step 4 greps the two source files for the literal guard expression (source-file scoped, not the WP); the WP prose that mentions the token is out of the grep's file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — an engine guard.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the guard is inside a boardgame.io move.

**Lint verdict: PASS (all 21 resolved; 8 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-09-04, first pass — no correction round needed).**
An independent pre-flight subagent verified all eight core claims against the
**applied** working-tree diff (not just the draft prose):
- `WOUND_EXT_ID` exported from the pure-helper `setup/pilesInit.ts` (no
  boardgame.io import) and imported by both consumers (`coreMoves.impl.ts:38`,
  `ai.legalMoves.ts:63`) — same layer, no violation (`heroEffects.execute.ts` is
  the existing precedent).
- The `playCard` guard sits after the `playerZones` null-check and before both
  the discard-to-play precondition and the `moveCardFromZone` hand removal /
  discard-to-play `pushLog` — so a Wound play emits no "played" line and no
  economy (the `messages.length === 0` assertion is the strong check).
- The `getLegalMoves` skip is at the top of the `main`-stage `playCard` loop,
  scoped to that enumeration only (recruit/fight loops unaffected).
- No new G field; `game.ts` / `game.test.ts` untouched (not a new move); the
  4 tests are non-tautological (each fails if the guard/skip is removed); scope
  matches the allowlist.
- **Determinism verified STRONGER than the draft claimed:** the greedy bot scores
  a Wound-play `-1` (`ai.competent.ts`), below end-turn (`5`) / advance-stage
  (`10`), so it never selected one even pre-change → the seeded trajectories are
  **provably** unshifted, and no recorded fixture's move log contains a Wound
  play, so the hash oracles are byte-identical by construction.
- **No PS (blocking) items, no RS (should-address) items.** Non-blocking notes:
  the WP §Scope(C)/§Files named a non-existent `coreMoves.impl.test.ts` — the
  authoritative EC-678 §Files-to-Produce already carries the correct
  `coreMoves.integration.test.ts` path and the edit landed there (the WP's own
  documented inline path-correction case); `playFromUndercover` is the only other
  play-a-card move but Wounds never reach the undercover-playable state, so
  `playCard` is the sole Wound-play vector (scope correct).

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-09-04).** An independent copilot audit of
the WP + EC + the applied diff returned every dimension `PASS`:
- **Determinism / hash surface** — PASS. No G field; neutrality gated on
  `sim:runtime-observed:check` + the byte-stable engine suite (the correct
  falsification test), with capture-and-commit prescribed if either moves.
- **Layer boundary** — PASS. Both consumers import the pure-helper constant; no
  cross-package/upward edge.
- **`getLegalMoves`↔move-guard sync** — PASS (exact mirror — both reject exactly
  `WOUND_EXT_ID`, closing the divergence class).
- **Move contract** — PASS (validation-phase pre-commit silent void, the D-24185
  class, correctly placed — not among the post-commit block-all guards).
- **Scope** — PASS (no creep; `game.ts`/`game.test.ts`/`arena-client`/`healWounds`
  untouched).
- **Test quality** — PASS (real, not tautological — verified each assertion fails
  without the fix).
- **Reward integrity** — PASS (no check weakened or pointed at an always-passing
  fixture).

Advisory notes folded in: the determinism neutrality is now stated as provable
(the `-1` bot score, above); the `turnEconomy` assertions in the no-op test are
non-load-bearing (a Wound is 0/0) but harmless belt-and-braces alongside the
load-bearing hand/inPlay/messages assertions; the 2948→2952 count is baseline vs
final (+4 tests), now framed explicitly in the determinism note.

**Disposition: CONFIRM** — execution authorized.

---

## Reserved Decisions (land at execution)

- **D-24455 (reserved; Drafted 2026-09-04, not yet landed)** — The engine
  forbids playing a Wound at the reducer, closing the last "play a Wound" path
  that the client-only PR #1785 left open. A Wound carries no Attack/Recruit and
  has no on-play path (`wiki/wounds.md`); its only interaction is the Healing
  ability used directly from hand (`healWounds`, WP-379, which reads the hand
  only). `playCard` gains a card-specific PRE-COMMIT precondition (the D-24185
  class, alongside the discard-to-play cost check): a `playCard` whose target is
  `WOUND_EXT_ID` returns `void` with NO commit — the Wound stays in hand, no
  base economy is granted, no onPlay pass fires — before any zone removal.
  Without it a raw socket message (or any non-UI caller) could move the Wound
  `hand → inPlay`, stranding it beyond `healWounds`' hand-only reach. The
  `getLegalMoves` `playCard` enumeration (`ai.legalMoves.ts`) is kept in
  lockstep, skipping `WOUND_EXT_ID` so the bot never enumerates a move the
  precondition would silently reject (the `getLegalMoves`↔move-guard divergence
  class that has repeatedly wedged bot turns). Determinism: adds no G field, so
  no hash re-pin; the guard rejects a move no recorded/seeded game plays, so
  `finalStateHash` / `PRE_WP080_HASH`, `sim:runtime-observed`, and the
  write-once difficulty-driven Seed PAR are byte-unchanged (empirically verified
  at draft: engine 2948/0, `sim:runtime-observed:check` current).

---

## See Also

- [WP-379](WP-379-wound-healing-ability.md) — the `healWounds` move (hand-only KO) + `WOUND_EXT_ID` identity; its own §Out-of-Scope named "the `playCard` wound-block" as deferred — this WP closes it
- [WP-383] — the D-24185 discard-to-play pre-commit precondition class this mirrors
- [WP-555] — the discard-to-play `getLegalMoves`↔move-guard skip this mirrors
- `wiki/wounds.md §Edge Cases` — the "Wounds can't be played" invariant this enforces at the engine
