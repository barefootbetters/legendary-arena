# WP-379 — Wound "Healing" Ability (KO all Wounds from hand)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation
**Dependencies:** WP-017 (KO, Wounds & Bystander Capture — `WOUND_EXT_ID`, `G.wounds`, `G.ko`, `koCard`), WP-018 (turn economy), WP-014A (non-core internally-gated move pattern)
**User-Visible Surface:** **none — infrastructure** (engine rule + new move; no client control ships in this WP)

> Baseline: `origin/main` at commit `dbc69b01` (WP-378 + EC-407 governance close).

---

## Session Context

WP-017 established `WOUND_EXT_ID = 'pile-wound'`, the shared `G.wounds` supply pile, the `G.ko` pile, and the `koCard(koPile, cardId)` append helper; WP-018 established the `G.turnEconomy` accumulate/spend model; WP-014A established the non-core, internally-stage-gated move pattern (validate args → stage gate → block-all pending-choice guards → mutate `G`) that `fightVillain` / `recruitHero` / `fightMastermind` all follow. This packet adds the universal Wound Healing ability on top of those primitives without modifying any of their contracts.

---

## Goal

After this session `@legendary-arena/game-engine` exposes a new `healWounds` move that lets the active player use the printed Wound "Healing" ability — *"If you don't recruit or fight anything on your turn, you may KO all the Wounds from your hand."* The move KOs every `WOUND_EXT_ID` card in the current player's hand into `G.ko`, but only when the player has not recruited or fought this turn. Once a player heals, the same turn's `fightVillain`, `recruitHero`, and `fightMastermind` become no-ops (the reverse lock). Two new deterministic per-turn boolean flags on `LegendaryGameState` (`hasActedThisTurn`, `hasHealedThisTurn`) carry this mutual-exclusion state; both reset at the start of every player turn. No client control, AI/simulation integration, or Enraging-Wound variant ships here.

---

## User-Visible Impact

**None — infrastructure. No user-observable change; this packet's payoff is** a correct engine implementation of the Wound Healing rule (the move, its gating, and the mutual lock) plus the deterministic turn-action state a future **"Heal Wounds" client-affordance WP** will surface as a button on play.legendary-arena.com. A human player cannot perceive this change until that follow-up client WP wires the move to the play UI; this WP deliberately stops at the engine boundary, mirroring the WP-282 (undercover engine-first, UI-second) precedent.

---

## Assumes

- WP-017 complete. Specifically:
  - `packages/game-engine/src/setup/pilesInit.ts` exports `WOUND_EXT_ID` = `'pile-wound'` (WP-017)
  - `packages/game-engine/src/board/ko.logic.ts` exports `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]` (WP-017)
  - `LegendaryGameState` in `packages/game-engine/src/types.ts` declares `ko: CardExtId[]` (line ~874) and the optional per-turn flags `hasDrawnThisTurn?: boolean` / `villainRevealedThisTurn?: boolean` (WP-017/WP-018)
- WP-018 complete: `G.turnEconomy` exists; `G.currentStage` holds the active `TurnStage`.
- `packages/game-engine/src/moves/fightVillain.ts`, `recruitHero.ts`, and `fightMastermind.ts` each follow the non-core internally-gated move pattern (stage gate `G.currentStage !== 'main'` + block-all `hasPending*` guard cluster + Step-3 mutation).
- `packages/game-engine/src/game.ts` registers every state-mutating move long-form as `{ move, client: false }` (D-10008) and resets per-turn flags in the `play` phase `turn.onBegin`.
- `packages/game-engine/src/game.test.ts` pins the exact move-name set + count (drift test).
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §The Move Validation Contract` and `§The Turn Stage Cycle` — the validate-args → stage-gate → mutate order every move must follow, and that `G.currentStage` (never `ctx`) owns the stage. `healWounds` must obey both.
- `docs/ai/ARCHITECTURE.md §Zone & Pile Structure` and `§Persistence Boundaries` — zones store `CardExtId` strings only; `G` is runtime-only and must stay JSON-serializable. The two new flags are plain booleans (serializable).
- `packages/game-engine/src/moves/fightVillain.ts`, `recruitHero.ts`, `fightMastermind.ts` — read all three entirely before modifying. Each gets one reverse-lock guard line and one `G.hasActedThisTurn = true` assignment; nothing else in them changes.
- `packages/game-engine/src/game.ts` — read the `moves` bag (move registration form) and the `play` phase `turn.onBegin` (where `hasDrawnThisTurn` / `villainRevealedThisTurn` reset). `healWounds` registers alongside the others; the two new flags reset beside the existing ones.
- `packages/game-engine/src/setup/pilesInit.ts` and `packages/game-engine/src/board/ko.logic.ts` — confirm `WOUND_EXT_ID` and `koCard` signatures verbatim before use.
- `packages/game-engine/src/types.ts` — the `LegendaryGameState` interface; the two new optional flags follow the exact `?: boolean` shape of `hasDrawnThisTurn`.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — the initial-state literal (`hasDrawnThisTurn: false` etc.); add the two new flags = `false` beside them.
- `docs/ai/REFERENCE/00.2-data-requirements.md §Zones & Piles` — confirm the canonical `wounds` / `ko` pile naming and that Wounds are represented purely as `WOUND_EXT_ID` strings in zones (never card objects).
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable constraints: no DB queries in moves; moves are deterministic; moves never throw.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 7/8 (no `.reduce()` in zone ops; explicit `for...of`), Rule 9 (`node:` prefix), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — scan D-24008 / D-24019 / D-24139 (the block-all pending-choice guard precedents `healWounds` mirrors) and the reserved D-24179 / D-24180 at the tail of this WP.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (this packet uses **no** randomness)
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Persistence Boundaries
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Wounds in hand are identified **only** by `cardId === WOUND_EXT_ID` (imported from `pilesInit.ts`) — never a string literal `'pile-wound'`.
- KO destination is `G.ko` via `koCard` — Healing never returns Wounds to `G.wounds` and never discards them. Healing permanently removes them.
- `healWounds` follows the exact non-core move order: validate/stage gate → block-all `hasPending*` guard cluster → `hasActedThisTurn` precondition → mutate. It creates **no** pending-choice state of its own (healing is synchronous).
- The two flags gate structurally, not by economy: `hasActedThisTurn` is set by `fightVillain` / `recruitHero` / `fightMastermind` on successful commit — **a 0-cost fight or recruit still counts as acting** (per the printed rule "recruit or fight anything"), so the flag must not be derived from `spentAttack` / `spentRecruit`.
- No zone-op `.reduce()` — partition the hand with an explicit `for...of` loop.
- `fightVillain.ts` / `recruitHero.ts` / `fightMastermind.ts` receive **only** the reverse-lock guard line + the `hasActedThisTurn = true` assignment — no other behavioral change.
- Every `// why:` comment discipline from 00.6 applies; the reverse-lock guard and the healing precondition each need a `// why:` citing the rule + D-24179/D-24180.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human before proceeding — never guess or invent field names, type shapes, or file paths.

**Locked contract values (do not re-derive):**
- **Wound ext_id:** `WOUND_EXT_ID = 'pile-wound'` (import from `packages/game-engine/src/setup/pilesInit.ts`)
- **KO helper:** `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]` (from `board/ko.logic.ts`)
- **TurnStage gate value:** `'main'` (from `TURN_STAGES`; `'start'` | `'main'` | `'cleanup'`)
- **PlayerZones keys:** `deck` | `hand` | `discard` | `inPlay` | `victory` | `faceDownCards`
- **New G flags:** `hasActedThisTurn?: boolean`, `hasHealedThisTurn?: boolean` (optional, mirror `hasDrawnThisTurn?`)
- **Move name:** `healWounds` (camelCase; registered `{ move: healWounds, client: false }` per D-10008)

---

## Debuggability & Diagnostics

- The Healing behavior is fully reproducible from identical setup + identical ordered moves; it uses no RNG.
- The move's effect is externally observable: `G.playerZones[player].hand` shrinks by the Wound count, `G.ko` grows by the same count, and `G.hasHealedThisTurn` flips to `true`.
- One human-readable line is appended to `G.messages` via `pushLog` on a successful heal (KO count + player) to support replay inspection — no `notableEvent` (center-screen overlay) is emitted; that is a client-affordance concern deferred to the follow-up WP.
- Invariants after execution: `G` remains JSON-serializable; every card removed from hand appears exactly once in `G.ko`; no Wound is ever duplicated or stranded.

---

## Scope (In)

### A) `healWounds` move — `packages/game-engine/src/moves/healWounds.ts` (**new**)

- `healWounds({ G, ctx }: MoveContext): void` — the move.
  - **Step 2 (stage gate):** `if (G.currentStage !== 'main') return;` — Healing is a main-window action (mirrors `fightVillain`/`recruitHero`). Add a `// why:` comment.
  - **Block-all guards:** the identical `hasPending*` cluster used by `fightVillain` (KO-hero D-24008, optional-KO-reward D-24019, victory-pile-pick D-24067, draw-or-empowered D-24069, return-zero-cost-discard D-24139 — and any others present in `fightVillain` at execution time). Each returns silently. Copy the cluster verbatim from `fightVillain.ts` so it cannot drift.
  - **Healing precondition:** `if (G.hasActedThisTurn === true) return;` — with a `// why:` citing the rule and D-24179 (you may not heal after recruiting or fighting).
  - **Wound scan:** iterate `G.playerZones[ctx.currentPlayer]!.hand` with an explicit `for...of` loop, building `remainingHand` (non-Wound `CardExtId`s) and counting `woundsToKo` (entries `=== WOUND_EXT_ID`). No `.reduce()`, no `.filter()` for the partition.
  - **Empty guard:** `if (woundsToKo === 0) return;` — deterministic no-op when the hand holds no Wounds. Add a `// why:`.
  - **Step 3 (mutate):** append each KO'd Wound to `G.ko` via `koCard` (one call per Wound, all `WOUND_EXT_ID`); assign `remainingHand` back to the player's `hand`; set `G.hasHealedThisTurn = true`; `pushLog(G, ...)` a single deterministic line naming the player and the KO count.
- `hasHealedThisTurn(G: LegendaryGameState): boolean` — exported predicate returning `G.hasHealedThisTurn === true`, mirroring the `hasPendingKoHeroChoice(G)` helper shape. Imported by the three fight/recruit moves for the reverse lock.
- Add a module-header JSDoc; every function gets a JSDoc.

### B) `LegendaryGameState` flags — `packages/game-engine/src/types.ts` (**modified**)

- Add two optional booleans beside `hasDrawnThisTurn?`:
  - `hasActedThisTurn?: boolean` — set true by `fightVillain`/`recruitHero`/`fightMastermind` on successful commit; gates Healing. JSDoc: reset each player turn; not derived from economy so a 0-cost action still counts.
  - `hasHealedThisTurn?: boolean` — set true by `healWounds`; reverse-locks the three fight/recruit moves. JSDoc: reset each player turn.

### C) Setup init — `packages/game-engine/src/setup/buildInitialGameState.ts` (**modified**)

- Initialize both flags to `false` in the initial-state literal, beside `hasDrawnThisTurn: false`.

### D) Registration + per-turn reset — `packages/game-engine/src/game.ts` (**modified**)

- Register `healWounds: { move: healWounds, client: false }` in the `moves` bag (import from `./moves/healWounds.js`). Add a `// why:` (server-only per D-10008; the move mutates real `G` absent on `UIState`).
- In the `play` phase `turn.onBegin`, reset `G.hasActedThisTurn = false;` and `G.hasHealedThisTurn = false;` beside the existing `G.hasDrawnThisTurn = false;`. Add a `// why:` (the once-per-turn mutual-exclusion allowance refreshes each turn).

### E) Reverse lock — `fightVillain.ts`, `recruitHero.ts`, `fightMastermind.ts` (**modified**)

- In each, import `hasHealedThisTurn` from `./healWounds.js` and add, at the end of the existing block-all guard cluster (before any mutation): `if (hasHealedThisTurn(G)) return;` with a `// why:` citing the rule + D-24180 (cannot fight/recruit after Healing).
- In each Step-3 mutation block, set `G.hasActedThisTurn = true;` at the point of successful commit, with a `// why:` citing D-24180.

### F) Move-set drift test — `packages/game-engine/src/game.test.ts` (**modified**)

- Add `healWounds` to the alphabetically-sorted expected move-name array **and** to the human-readable `it(...)` description string (insert between `fightVillain` and `playCard`). Update the asserted count. Add nothing else.

### G) Tests — `packages/game-engine/src/moves/healWounds.test.ts` (**new**)

Add `node:test` tests using `makeMockCtx` from `src/test/mockCtx.ts` (never `boardgame.io/testing`):
- Heals: hand with 2 Wounds + 2 heroes, stage `main`, `hasActedThisTurn` unset → hand keeps the 2 heroes, `G.ko` gains 2 `WOUND_EXT_ID`, `hasHealedThisTurn === true`.
- No-op when hand holds zero Wounds (returns void, no mutation).
- No-op when `G.currentStage !== 'main'`.
- Precondition: `hasActedThisTurn === true` → heal is a no-op (Wounds remain in hand).
- Precondition: a pending choice active (e.g. set the KO-hero pending field) → heal is a no-op.
- Reverse lock: after a successful heal, `fightVillain` / `recruitHero` / `fightMastermind` on a legal target are no-ops (target unmoved, economy unchanged).
- `hasActedThisTurn` gate: after a successful `fightVillain` (or `recruitHero`), `healWounds` is a no-op.
- `JSON.stringify(G)` succeeds after every heal.
- Determinism: two identical heal sequences produce identical `G.ko` ordering.
- Confirms `healWounds.ts` imports no `boardgame.io/testing` and contains no `throw`.

---

## Out of Scope

- **No client / UI control.** No "Heal Wounds" button, no `UIState` projection field, no arena-client change — that is the deferred follow-up client WP.
- **No AI / simulation integration.** `healWounds` is **not** added to `SIMULATION_MOVE_NAMES` / `ai.legalMoves.ts` / the simulation `MOVE_MAP`s, so bot behavior, PAR baselines, and balance-sweep outputs are unchanged. Teaching the bot to heal is a separate WP.
- **No `notableEvent` emission** — the center-screen overlay is a client concern for the follow-up WP.
- **No "Wounds can't be played" fix** — `playCard`'s handling of a Wound in hand is unchanged; that is a distinct rule and its own follow-up (a played Wound leaving the hand simply becomes un-healable, which is acceptable existing behavior).
- **No Enraging-Wound "Healing" variants** — those carry unique per-card KO conditions (rules v23 §"Enraging Wounds") and are a future data/keyword WP, not this universal-Wound move.
- No changes to `fightVillain` / `recruitHero` / `fightMastermind` beyond the two lines named in Scope E.
- No database, network, or filesystem access in any helper. No server changes.
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless explicitly listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/moves/healWounds.ts` — **new** — the `healWounds` move + `hasHealedThisTurn` predicate
- `packages/game-engine/src/moves/healWounds.test.ts` — **new** — `node:test` coverage
- `packages/game-engine/src/types.ts` — **modified** — add `hasActedThisTurn?` + `hasHealedThisTurn?` to `LegendaryGameState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — init both new flags to `false`
- `packages/game-engine/src/game.ts` — **modified** — register `healWounds`; reset both flags in `play` `turn.onBegin`
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — reverse-lock guard + set `hasActedThisTurn`
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** — reverse-lock guard + set `hasActedThisTurn`
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — reverse-lock guard + set `hasActedThisTurn`
- `packages/game-engine/src/game.test.ts` — **modified** — move-set drift test (add `healWounds`, bump count)

**Conditional (determinism re-pin — only if the new G flags change a pinned hash):** the sentinel/golden replay fixtures under `packages/game-engine/src/test/fixtures/` and any pinned `finalStateHash` — **regenerated via the canonical `scripts/record-game-fixture.mjs` (or equivalent) re-record path, never hand-edited.** If the affected hashes exclude these per-turn flags (as messages/logMeta are excluded), no fixture changes and this line is inert. The executor confirms which case holds by running the suite (see Acceptance Criteria). Any fixture file touched this way is reported in the govern-close even though it is regenerated, not authored.

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §8 (determinism), §22 (deterministic, replay-faithful scoring/replay), §1/§2 (faithful card rules — the printed Wound Healing ability).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` Implementing the printed Healing ability makes the engine *more* faithful to the physical game (§1/§2).

**Non-Goal proximity check:** none of NG-1..7 are crossed — Healing is a core solitaire/co-op rule with no monetization, no pay-to-win, no PvP interaction surface.

**Determinism preservation:** the two new flags are deterministic — `false` at every turn start (`onBegin`), set only by deterministic move commits, read never written by projection. `healWounds` uses no `ctx.random.*`. Replay re-execution reproduces the flags and `G.ko` byte-identically; any pinned-hash change is purely the mechanical consequence of `G` shape growing (identical to the existing `hasDrawnThisTurn` flag class) and is re-pinned via the canonical record tool, never hand-edited (Vision §22).

## Funding Surface Gate

N/A — this WP touches no funding surface: no global-nav / registry-viewer / profile funding affordance, no tournament funding channel, and no user-visible "donate/support" copy (it is an engine move with no UI).

## API Catalog

N/A — no HTTP endpoint added, modified, or removed, and no `apps/server/src/**` `Library-only` function added or changed. This is a `packages/game-engine` move only.

---

## Acceptance Criteria

All items are binary pass/fail.

### Move behavior
- [ ] `healWounds.ts` exports `healWounds` and `hasHealedThisTurn`; contains no `throw` and no `boardgame.io/testing` import (confirmed with `Select-String`).
- [ ] A heal from `main` stage with `hasActedThisTurn` unset and N≥1 Wounds in hand removes exactly N `WOUND_EXT_ID` from `hand`, appends exactly N to `G.ko`, leaves all non-Wound cards in `hand`, and sets `G.hasHealedThisTurn = true`.
- [ ] `healWounds` is a no-op (no `G` mutation) when: hand has 0 Wounds; OR `G.currentStage !== 'main'`; OR `G.hasActedThisTurn === true`; OR any `hasPending*` block-all guard is active.

### Mutual exclusion
- [ ] After a successful `healWounds`, `fightVillain` / `recruitHero` / `fightMastermind` on an otherwise-legal target are no-ops (city/HQ/tactic unchanged, `G.turnEconomy` unchanged).
- [ ] After a successful `fightVillain` (0-cost target included) or `recruitHero`, `healWounds` is a no-op.
- [ ] `fightVillain`, `recruitHero`, `fightMastermind` each set `G.hasActedThisTurn = true` on successful commit and are otherwise behaviorally unchanged.

### State + registration
- [ ] `LegendaryGameState` declares `hasActedThisTurn?: boolean` and `hasHealedThisTurn?: boolean`; `buildInitialGameState` sets both to `false`.
- [ ] `LegendaryGame.moves.healWounds` is registered as `{ move: healWounds, client: false }`; the `play` `turn.onBegin` resets both flags to `false`.
- [ ] `game.test.ts` move-set drift test lists `healWounds` and asserts the updated count; the suite passes.

### Tests + determinism
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files).
- [ ] `JSON.stringify(G)` succeeds after every heal (integration assertion).
- [ ] Sentinel/golden replay verification passes: either unchanged, or re-pinned via the canonical record tool and re-verified — **never hand-edited**.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`), except regenerated sentinel/golden fixtures per the conditional clause.

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm the move never throws
Select-String -Path "packages\game-engine\src\moves\healWounds.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm no boardgame.io/testing import in the new files
Select-String -Path "packages\game-engine\src\moves\healWounds.ts","packages\game-engine\src\moves\healWounds.test.ts" -Pattern "boardgame.io/testing"
# Expected: no output

# Step 5 — confirm no Math.random anywhere in the engine src
Select-String -Path "packages\game-engine\src" -Pattern "Math\.random" -Recurse
# Expected: no output

# Step 6 — confirm the Wound ext_id is imported, not string-literalled, in the move
Select-String -Path "packages\game-engine\src\moves\healWounds.ts" -Pattern "'pile-wound'"
# Expected: no output (WOUND_EXT_ID is imported from pilesInit)

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change (plus regenerated fixtures per the conditional clause)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item. Reading the code is not sufficient.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `none — infrastructure`):** `docs/ai/STATUS.md` states plainly **"No user-observable change — infrastructure only"**, naming the payoff (engine Healing rule + turn-action state that unlocks the follow-up client Heal-Wounds WP). Green tests + merge are sufficient for this infrastructure WP; there is no live-surface control to click.
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files).
- [ ] No `throw` in `healWounds.ts`; no `Math.random` in any new or modified file; `WOUND_EXT_ID` imported (no `'pile-wound'` literal) — all confirmed with `Select-String`.
- [ ] `fightVillain.ts` / `recruitHero.ts` / `fightMastermind.ts` changed by exactly the two named lines each; no other behavioral edit (confirmed with `git diff`).
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`), except regenerated sentinel/golden fixtures per the conditional clause.
- [ ] `docs/ai/STATUS.md` updated — the engine now implements the Wound Healing ability + mutual-exclusion turn-action state.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24179 (Healing move) and D-24180 (turn-action mutual-exclusion state) as Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-379 checked off with today's date.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All 10 required sections present; `Out of Scope` lists ≥2 adjacent-but-excluded items (client affordance, AI/sim integration, playCard wound-block, Enraging Wounds).
- **§2 Constraints** — PASS. Engine-wide (full-file, no diffs, ESM/Node22, references 00.6) + packet-specific + session protocol + locked contract values present.
- **§3 Assumes** — PASS. WP-017/018/014A named with exact exports (`WOUND_EXT_ID`, `koCard`, the per-turn-flag pattern) + green baseline.
- **§4 Context (Read First)** — PASS. Specific ARCHITECTURE §sections + `00.2 §Zones & Piles` (Wounds are card data) + `00.6` + exact source files.
- **§5 Files** — PASS. 9 files, all `new`/`modified` + a conditional regenerated-fixtures line. >8 is intrinsic (the reverse-lock touches three existing moves + state init + drift test), not scope creep — noted in Context/Scope.
- **§6 Naming** — PASS. `WOUND_EXT_ID`, `ext_id`, canonical `MatchSetupConfig`/zone names untouched; `healWounds` camelCase.
- **§7 Dependency discipline** — PASS. No new npm dependency; no forbidden package reachable.
- **§8 Architectural boundaries** — PASS. Engine-only; no DB/network/fs in moves/helpers; uses no `ctx.random.*`; `G` JSON-serializable; no `.reduce()` in the zone op.
- **§9 Windows** — PASS. Verification uses `pwsh` `Select-String`.
- **§10 Env vars** — N/A. This WP introduces no environment variable (pure engine move).
- **§11 Auth** — N/A. No authentication surface (an engine move, not an endpoint).
- **§12 Tests** — PASS. `node:test` + `makeMockCtx`; no `boardgame.io/testing`; JSON-roundtrip + determinism assertions.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output.
- **§14 Acceptance criteria** — PASS. ~14 binary, observable, specific items grouped by sub-task.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope-boundary check; `User-Visible Surface` declared `none — infrastructure`; §15.1 infra-STATUS statement required.
- **§16 Code style** — PASS. Explicit `for...of` (no `.reduce()`/`.filter()` in the zone op), no nested ternaries, no abbreviations, JSDoc on every function, `// why:` on non-obvious decisions, named imports only. (Full-sentence-error rule is vacuous — moves never throw.)
- **§17 Vision Alignment** — PASS (triggered: determinism §8/§22 + card semantics §1/§2). Section present with clause numbers, no-conflict assertion, NG-1..7 check, and the determinism-preservation line.
- **§18 Prose-vs-grep** — PASS. The literal-scoped greps (`Math\.random`, `boardgame.io/testing`, `'pile-wound'`) target source files, not this WP; the WP's mention of `'pile-wound'` in Locked Values is out of every grep's file scope. Executor discipline: keep the literal out of `healWounds.ts` (import `WOUND_EXT_ID`).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No global-nav/registry-viewer/profile funding affordance, no tournament funding channel, no user-visible donate/support copy — this is an engine move with no UI.
- **§21 API Catalog** — N/A. No HTTP endpoint added/modified/removed and no `apps/server/src/**` `Library-only` function touched.

**Lint verdict: PASS (all 21 resolved; 5 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-07-14).**

- **Sequencing / dependencies:** WP-017 ✅, WP-018 ✅, WP-014A ✅ — all landed on `main`; the primitives (`WOUND_EXT_ID`, `G.wounds`, `G.ko`, `koCard`, `G.turnEconomy`, `G.currentStage`, the block-all guard cluster) are present and verified by direct source read.
- **Green baseline:** `main @ dbc69b01`; engine build exits 0 and the full engine suite is green — **1927 pass / 0 fail / 449 suites** (measured this drafting session).
- **Scope lock:** the `Files Expected to Change` allowlist is closed (9 files + conditional regenerated fixtures); `git diff --name-only` is a DoD gate.
- **Contract fidelity:** the two new flags mirror the existing optional `hasDrawnThisTurn?: boolean` shape exactly; move registration mirrors the `{ move, client: false }` D-10008 form; the reverse-lock predicate mirrors the `hasPending*(G)` helper shape.
- **RS-1 (clarification, non-blocking):** the exact sentinel/golden re-pin path is resolved at execution with the game-engine skill loaded — either the pinned hash is unaffected (flags excluded) or it is re-pinned via the canonical record tool (never hand-edited), per the WP-282 / WP-200 precedent. The AC accepts both outcomes.
- **RS-2 (clarification, non-blocking):** the block-all `hasPending*` cluster is copied **verbatim from `fightVillain.ts` at execution time** so it cannot drift if the cluster has grown since draft.
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-14).** The pre-flight READY verdict stands. All 30 issues scan to PASS. The one area needing executor care is determinism (#2): adding two hashed `G` fields may shift a pinned sentinel/golden hash — the WP prevents drift explicitly (canonical record tool, never hand-edit, WP-282 precedent), so it is a documented PASS rather than a RISK. No finding would cause architectural or determinism damage if executed as written.

Selected findings (non-clean-PASS notes; all others clean PASS):
- **#1 / #9 / #16 / #29 (layer boundary)** — PASS. Engine-only; the client "Heal Wounds" control + `UIState` projection are explicitly deferred; `game.ts` change is registration + flag-reset only (no orchestration creep).
- **#2 / #8 / #23 (determinism)** — PASS. No `ctx.random.*`/`Math.random`; flags deterministic and reset per turn; explicit `for...of` over the hand (order-stable); sentinel re-pin discipline named.
- **#4 / #5 (contract drift / optional fields)** — PASS. `game.test.ts` move-set drift test bumped in the same allowlist; optional flags follow the established `exactOptionalPropertyTypes`-safe `?: boolean` pattern.
- **#7 / #19 / #24 (persistence / serialization)** — PASS. New fields are plain booleans; JSON-roundtrip asserted; nothing persisted.
- **#12 (scope creep)** — PASS. Closed allowlist + `git diff --name-only` gate + "no other files may be modified."
- **#22 (silent vs loud)** — PASS. `healWounds` returns `void` on every blocked/invalid path (moves never throw); consistent with the three sibling moves.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24179 (reserved; Drafted 2026-07-14, not yet landed)** — The universal Wound "Healing" ability is a dedicated `healWounds` move that KOs every `WOUND_EXT_ID` card from the current player's hand into `G.ko` (permanent removal, never back to `G.wounds` and never to discard). It follows the non-core move contract: `main`-stage gate + the block-all `hasPending*` guard cluster + a `hasActedThisTurn` precondition, then mutate. It creates no pending-choice state (healing is synchronous) and emits a `G.messages` line but no `notableEvent`. Wounds are identified by `WOUND_EXT_ID` only.
- **D-24180 (reserved; Drafted 2026-07-14, not yet landed)** — Turn-action mutual exclusion is carried by two optional boolean `LegendaryGameState` flags, `hasActedThisTurn` and `hasHealedThisTurn`, both reset in the `play` phase `turn.onBegin`. `hasActedThisTurn` is set by `fightVillain` / `recruitHero` / `fightMastermind` on successful commit and gates `healWounds`; `hasHealedThisTurn` is set by `healWounds` and reverse-locks those three moves. The flags are structural, **not** derived from `G.turnEconomy` — a 0-cost fight or recruit still counts as "acting" per the printed rule "recruit or fight anything."

---

## See Also

- [WP-282](WP-282-undercover-face-down-zone.md) — engine-first, UI-second precedent for a new-move mechanic
- [WP-017](WP-017-ko-wounds-bystanders-minimal-mvp.md) — `WOUND_EXT_ID`, `G.wounds`, `G.ko`, `koCard`
- `docs/legendary-universal-rules-v23.md §Healing Wounds` — the printed rule text this WP implements
- [D-24008 / D-24019 / D-24139](../DECISIONS.md) — block-all pending-choice guard precedents `healWounds` mirrors
