# WP-538 — Core Dr. Doom Master Strike (6-card gate + reveal-[hc:tech]-or-interactive-put-2-on-top)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (a Core Dr. Doom match — the Master Strike now forces the put-2-on-deck penalty, interactively for the current player; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) + Arena Client (`apps/arena-client`) — **cross-layer** (the interactive penalty needs a UIState projection + client prompt).
**Dependencies:** WP-024 (Master Strike execution); WP-476 / D-24284 (the **interactive Master-Strike pending-choice** precedent — Magneto discard-to-4: current player parks, non-current auto); WP-242 / D-24007 (pending-choice infrastructure); **WP-537** (core Loki strike — shares the `mastermindStrikeHandler` dispatch surface; land WP-537 first to avoid a merge collision on that file).

---

## Goal

After this session, a Core **Dr. Doom** match resolves Doom's printed Master Strike — *"Each player with exactly 6 cards in hand reveals a `[hc:tech]` Hero or puts 2 cards from their hand on top of their deck."* Today `core/dr-doom` takes **no branch** in `mastermindStrikeHandler` and the Strike is inert (2026-08-13 Core mastermind-coverage audit). This WP adds a `MASTERMIND_CORE_DR_DOOM` constant + dispatch branch + a `resolveCoreDoomStrike` resolver that, per player (sorted): applies the **exactly-6-cards** gate; if the 6-card hand holds a `[hc:tech]` Hero → reveal (kept), no penalty; else the player **puts 2 cards from hand on top of their deck** — resolved **interactively** for the current player (a new put-2-on-top pending-choice, selection order = top order) and **deterministically** (cheapest-2) for non-current / bot players, exactly mirroring WP-476's Magneto discard-to-4 split. Because no existing pending-choice puts cards *on top of the deck* (Magneto discards, Doc Ock shuffles), this introduces a new `PendingPutCardsOnDeckChoice` and ships its projection + prompt together (the no-UX-freeze invariant). Locked by D-24347.

## User-Visible Impact

A player in a Core Dr. Doom match, holding exactly 6 cards and no Tech Hero when a Master Strike fires, is prompted (if it is their turn) to choose 2 cards to place on top of their deck; other players have their 2 cheapest auto-placed. Previously the Strike did nothing. No change to any other mastermind or public/monetization surface — a faithfulness fix to one mastermind's printed text. D-24026 live-verification applies (the prompt + put-on-top observed in a deployed Doom match).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. core/dr-doom takes no strike branch today
grep -q "MASTERMIND_CORE_DR_DOOM\|'core/dr-doom'" packages/game-engine/src/rules/mastermindHandlers.ts && echo "EXISTS" || echo "ABSENT"
# Expected: ABSENT (STOP + inspect if EXISTS)

# B. The interactive Master-Strike precedent (WP-476 Magneto) is on main
grep -q "resolveMagnetoStrike" packages/game-engine/src/rules/mastermindHandlers.ts && grep -q "pendingDiscardChoices" packages/game-engine/src/rules/mastermindHandlers.ts && test -f packages/game-engine/src/moves/discardChoice.resolve.ts && test -f apps/arena-client/src/components/play/PendingDiscardChoicePrompt.vue && echo "B_OK"
# Expected: B_OK

# C. The pending-choice wiring surfaces to mirror all exist
test -f packages/game-engine/src/types.ts && test -f packages/game-engine/src/simulation/ai.legalMoves.ts && test -f packages/game-engine/src/ui/uiState.build.ts && test -f packages/game-engine/src/ui/uiState.filter.ts && test -f packages/game-engine/src/ui/uiState.types.ts && test -f apps/arena-client/src/pages/PlayDesktop.vue && test -f apps/arena-client/src/pages/PlayMobile.vue && echo "C_OK"
# Expected: C_OK

# D. WP-537 landed first (shared dispatch file). If WP-537 is not yet on main, this WP is BLOCKED — land it first.
grep -q "MASTERMIND_CORE_LOKI" packages/game-engine/src/rules/mastermindHandlers.ts && echo "WP537_ON_MAIN" || echo "WP537_MISSING"
# Expected: WP537_ON_MAIN (else STOP — resolve the ordering to avoid a dispatch-file collision)

# E. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "E_OK"
# Expected: E_OK
```

If B or C fails, the pending-choice infrastructure is not on `main` as assumed — STOP and reconcile.

---

## Context (Read First)

- `resolveMagnetoStrike` (`mastermindHandlers.ts`, WP-476 / D-24284) — the **exact structural template**. It loops players sorted; the reveal escape (`playerHasXMenHeroInHand`) skips a player; then for the CURRENT player (`resolveCurrentPlayer(strikeContext)`) it **parks** a `pendingDiscardChoices` entry (lazy-init the queue at the park site, never in `Game.setup`), and for non-current players it auto-picks deterministically (`selectDiscardToLimitCards`). `resolveCoreDoomStrike` mirrors this exactly, swapping: the **exactly-6 gate**, the `heroClass==='tech'` reveal check, and the terminal action **put-2-on-top-of-deck** in place of discard-to-limit.
- **No existing pending-choice puts cards on top of the deck** — Magneto discards (`pendingDiscardChoices`), Doc Ock shuffles, the reorder-choice reorders the deck top after a reveal. So a **new** `PendingPutCardsOnDeckChoice` (`{ choiceType: 'put-cards-on-deck'; playerID; count: 2 }`) + `pendingPutCardsOnDeckChoices?` queue + `hasPendingPutCardsOnDeckChoice` + a `putCardsOnDeckChoice.resolve.ts` move are required. Selection order = deck-top order (first selected ends up on top).
- **The pending-choice touch-point set** (mirror `pendingDiscardChoices` end-to-end — see the WP-476 file map): `types.ts` (type + state field), `moves/putCardsOnDeckChoice.resolve.ts` (new resolve move + `hasPending…`), `moves/coreMoves.impl.ts` (register), `game.ts` (move registration + block-all wiring), the **block-all guards** on every action move (`dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `healWounds.ts`, `playFromUndercover.ts`, `recruitHero.ts`, and the play/other action moves that already guard `hasPendingDiscardChoice`), `simulation/ai.legalMoves.ts` (offer/short-circuit the resolve move), `simulation/par.aggregator.ts` + `simulation/simulation.runner.ts` (bot resolution), `ui/uiState.build.ts` + `ui/uiState.types.ts` + `ui/uiState.filter.ts` (project the pending choice to the chooser — **the filter whitelist must pass it through per audience**, the known drop-at-filter failure mode), `villainDeck.reveal.ts` (the strike reveal path already invokes the handler). Client: a new `PendingPutCardsOnDeckChoicePrompt.vue` + `useTurnActions.ts` guard + `TurnActionBar.vue` gate + mount in `PlayDesktop.vue` + `PlayMobile.vue`.
- **Bot / non-current auto-pick:** `selectDiscardToLimitCards`-style deterministic cheapest-2 (Wounds sort cheapest and go first; keep the expensive Heroes) — the `resolveMagnetoStrike` non-current precedent.
- Class read: `gameState.cardTraits?.[cardExtId]?.heroClass` (`[hc:tech]` → `'tech'`).
- `.claude/rules/architecture.md §UIState Projection Integrity` — the 5-step board-visible-field contract; the pending-choice projection is dropped silently if `filterUIStateForAudience` is not updated (the shipped EC-206 failure mode). `project_pending_choice_no_ux_freeze` — ship engine block-all + UIState projection + client prompt **together** or a human chooser hard-freezes.
- Master Strikes are keyed by mastermind selection, not a card marker; **no** `data/cards` / marker / ledger / effect-index change.

---

## Scope (In)

**Engine (`packages/game-engine`):**
- `rules/mastermindHandlers.ts` — `MASTERMIND_CORE_DR_DOOM = 'core/dr-doom'` (+ `// why:` vs `co2e/doctor-doom`), a dispatch branch passing `resolveCurrentPlayer(strikeContext)` (mirror the Magneto branch), and `resolveCoreDoomStrike(gameState, currentPlayer)`: per player sorted → exactly-6 gate → `heroClass==='tech'` reveal escape → else park the interactive choice for the current player / auto cheapest-2 put-on-top for others.
- `types.ts` — `PendingPutCardsOnDeckChoice` type + `pendingPutCardsOnDeckChoices?: PendingPutCardsOnDeckChoice[]` on `LegendaryGameState` (optional, lazy-init — never seeded in `buildInitialGameState`).
- `moves/putCardsOnDeckChoice.resolve.ts` — **new** resolve move (validate the 2 chosen cards are in the chooser's hand; move them to deck top in selection order; clear the queue entry) + `hasPendingPutCardsOnDeckChoice(G)`; moves never throw (silent return on invalid args / wrong player / not-in-hand).
- `moves/coreMoves.impl.ts` + `game.ts` — register the new resolve move; wire the block-all so the pending choice gates other action moves.
- Block-all guards: add `hasPendingPutCardsOnDeckChoice` to the same guard sites that already check `hasPendingDiscardChoice` (`dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `healWounds.ts`, `playFromUndercover.ts`, `recruitHero.ts`, + the play move).
- `simulation/ai.legalMoves.ts` — offer only the resolve move while the choice is pending (short-circuit); `simulation/par.aggregator.ts` + `simulation/simulation.runner.ts` — resolve it deterministically for bot seats.
- `ui/uiState.types.ts` + `ui/uiState.build.ts` + `ui/uiState.filter.ts` — project the pending choice to its chooser (build the field, declare the type, **pass it through the audience filter** for the owning player).
- `rules/mastermindHandlers.test.ts` + `moves/putCardsOnDeckChoice.resolve.test.ts` + the drift/move-count test in `game.test.ts` (new move raises the registered-move count) + `ui/uiState.filter.test.ts` (audience pass-through) + `ai.legalMoves` test — the pending-choice test surface WP-476 established.

**Arena Client (`apps/arena-client`):**
- `components/play/PendingPutCardsOnDeckChoicePrompt.vue` — **new** prompt (pick 2 cards from hand, ordered) mirroring `PendingDiscardChoicePrompt.vue`; mounted in `pages/PlayDesktop.vue` + `pages/PlayMobile.vue`.
- `composables/useTurnActions.ts` + `components/play/TurnActionBar.vue` — add the `hasPendingPutCardsOnDeck` guard to the action-gating parity set (append-last positional discipline — the `useTurnActions` gotcha).

## Out of Scope

- `co2e/doctor-doom` (different printed text — its `resolveDoctorDoomStrike` is untouched), and every other mastermind.
- **Dr. Doom's tactic Fight abilities** (Dark Technology / Monarch's Decree / Secrets of Time Travel / Treasures of Latveria) — `tacticHandlers.ts`, a separate arc.
- **Core Loki's Master Strike** — the paired WP-537 (auto). WP-538 is Doom-only.
- **Auto-resolving the current player's penalty** — the operator ruling (2026-08-13) is interactive-for-current, per the Magneto precedent; do not collapse it to auto.
- Any `data/cards` / marker / effect-index / mechanic-ledger change — strikes are mastermind-selection-keyed.
- A generic/reusable "select N cards" pending-choice abstraction — build the put-on-top choice concretely (abstract on the third copy, D-24029 posture).

---

## Files Expected to Change

**Engine (new):**
- `packages/game-engine/src/moves/putCardsOnDeckChoice.resolve.ts` — **new** (resolve move + `hasPendingPutCardsOnDeckChoice`)
- `packages/game-engine/src/moves/putCardsOnDeckChoice.resolve.test.ts` — **new**

**Engine (modified):**
- `packages/game-engine/src/rules/mastermindHandlers.ts` — constant + dispatch branch + `resolveCoreDoomStrike`
- `packages/game-engine/src/types.ts` — `PendingPutCardsOnDeckChoice` + state field
- `packages/game-engine/src/moves/coreMoves.impl.ts` — register the resolve move
- `packages/game-engine/src/game.ts` — move registration + block-all wiring
- `packages/game-engine/src/moves/{dodgeCard,fightMastermind,fightVillain,healWounds,playFromUndercover,recruitHero}.ts` — add the block-all guard (+ the play move)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — short-circuit to the resolve move
- `packages/game-engine/src/simulation/par.aggregator.ts` + `simulation/simulation.runner.ts` — bot resolution
- `packages/game-engine/src/ui/uiState.types.ts` + `ui/uiState.build.ts` + `ui/uiState.filter.ts` — pending-choice projection (+ filter pass-through)
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` + `game.test.ts` (move-count) + `ui/uiState.filter.test.ts` + `simulation/ai.legalMoves` test — coverage

**Arena Client (new / modified):**
- `apps/arena-client/src/components/play/PendingPutCardsOnDeckChoicePrompt.vue` — **new**
- `apps/arena-client/src/pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — mount the prompt
- `apps/arena-client/src/composables/useTurnActions.ts` + `components/play/TurnActionBar.vue` — pending guard

**Governance:** `docs/ai/DECISIONS.md` (D-24347) · `docs/ai/STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (node `📝` → `✅` + `roadmap:counts:write`).

Cross-layer (Game Engine + Arena Client); standard two-session lane. The engine block-all + UIState projection + the client prompt are one indivisible deliverable (ship-together, or a human chooser hard-freezes — `project_pending_choice_no_ux_freeze`).

---

## Contract (Locked by D-24347)

- **Gate:** the Strike affects only players with **exactly 6 cards** in hand at strike time.
- **Reveal escape:** a gated player holding a `heroClass==='tech'` Hero reveals it (keeps it), no penalty.
- **Penalty:** otherwise the player **puts 2 cards from hand on top of their deck**, selection order = top order. **Current player interactive** (`PendingPutCardsOnDeckChoice`), **non-current / bot auto** (deterministic cheapest-2) — the WP-476 single-current-player-scoped split.
- **New pending-choice** `put-cards-on-deck` ships with its block-all guards, `ai.legalMoves` short-circuit, bot resolver, UIState projection (through the audience filter), and client prompt — together.
- Keyed by mastermind selection `core/dr-doom`; distinct from `co2e/doctor-doom`.

### Determinism / persistence

Deterministic: no `ctx.random`. The new `pendingPutCardsOnDeckChoices` field is gameplay-affecting → **hashed**, but **lazy-materialized** at the park site (never seeded in `buildInitialGameState`), so no committed fixture (empty-registry `PRE_WP080`, the `core/dr-doom` sentinel) creates the key → **no `finalStateHash`/`PRE_WP080` re-pin expected** (the `lastPlayEffectsFired`/WP-497 `handSizeOverrides` hygiene — [reference_hashed_g_field_dual_repin]). Verify at execution and re-pin with a note only on a real diff. Moves never throw.

### Code-style / output discipline

Human-style per `00.6-code-style.md`; `for...of`; full-sentence logs + error/empty messages; `// why:` on the new constant, the lazy-init park site, and the filter pass-through. ESM, Node v22+. Full file contents in session output.

---

## Acceptance Criteria

1. `MASTERMIND_CORE_DR_DOOM = 'core/dr-doom'` + dispatch branch route `core/dr-doom` to `resolveCoreDoomStrike(gameState, resolveCurrentPlayer(strikeContext))`.
2. `resolveCoreDoomStrike` applies the exactly-6-cards gate (players with ≠6 are untouched), the `heroClass==='tech'` reveal escape (hero kept, no penalty), and the put-2-on-top penalty otherwise.
3. The **current** player's penalty parks a `PendingPutCardsOnDeckChoice` (`count: 2`, lazy-init queue); **non-current / bot** players get the 2 deterministic cheapest cards put on top; both leave the deck top in the intended order.
4. `putCardsOnDeckChoice.resolve.ts` validates the 2 chosen cards are in the chooser's hand, moves them to deck top in selection order, clears the entry, and returns silently on invalid args / wrong player / not-in-hand (never throws). `hasPendingPutCardsOnDeckChoice` gates every action move that already gates `hasPendingDiscardChoice`.
5. `ai.legalMoves` offers only the resolve move while pending; the bot resolver (`par.aggregator` / `simulation.runner`) resolves it deterministically; no bot fault.
6. The pending choice is built in `uiState.build`, typed in `uiState.types`, and **passes through `filterUIStateForAudience` to its owning player** (asserted by a filter test — the field is not dropped at the whitelist).
7. `PendingPutCardsOnDeckChoicePrompt.vue` renders for the current chooser and is mounted in `PlayDesktop` + `PlayMobile`; `useTurnActions`/`TurnActionBar` gate other actions while pending; no hard-freeze.
8. The registered-move count test in `game.test.ts` reflects the new move; the new resolver / resolve-move / filter / legalMoves cases pass.
9. `pnpm --filter @legendary-arena/game-engine build` + `test`, `pnpm --filter @legendary-arena/arena-client test` (+ `vue-tsc`), and `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).
10. No `data/cards` / marker / effect-index / mechanic-ledger change; no `ctx.random`; the new `G` field is optional + lazy-init (absent on a fresh state).

---

## Verification Steps

```bash
# 1. Constant + resolver + new pending type/field
grep -nE "MASTERMIND_CORE_DR_DOOM|resolveCoreDoomStrike" packages/game-engine/src/rules/mastermindHandlers.ts
grep -nE "PendingPutCardsOnDeckChoice|pendingPutCardsOnDeckChoices" packages/game-engine/src/types.ts

# 2. Block-all guard added everywhere hasPendingDiscardChoice is checked
grep -rl "hasPendingDiscardChoice" packages/game-engine/src/moves | while read f; do grep -L "hasPendingPutCardsOnDeckChoice" "$f"; done
# Expected: NO output (every discard-guarded move also guards the new choice)

# 3. Filter pass-through (the drop-at-whitelist failure mode)
grep -n "pendingPutCardsOnDeck" packages/game-engine/src/ui/uiState.filter.ts
# Expected: a pass-through line for the owning audience

# 4. No forbidden surfaces
git diff --name-only | grep -E '^(data/cards|data/metadata|docs/ai/coverage)' ; echo "hits above (expect none)"
grep -c "ctx.random" packages/game-engine/src/rules/mastermindHandlers.ts packages/game-engine/src/moves/putCardsOnDeckChoice.resolve.ts

# 5. Engine + client tests + hashes
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: all exit 0; no finalStateHash / PRE_WP080 change (or a noted re-pin only on a real fixture diff)

# 6. Live (post-deploy; D-24026): a Core Dr. Doom match — with exactly 6 cards
#    and no Tech Hero, the current player is prompted to place 2 cards on top of
#    their deck (others auto); the game log + deck-top reflect it. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed (incl. WP-537 on main)
- [ ] All 10 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] The 6-card gate + Tech-Hero reveal escape + interactive/auto put-2-on-top all resolve; the current player is prompted, others auto; no hard-freeze
- [ ] The new pending-choice ships engine block-all + `ai.legalMoves` + bot resolver + UIState projection (through the filter) + client prompt **together**
- [ ] The `G` field is optional + lazy-init; no `data/cards` / marker / ledger / index change; no `ctx.random`; hashes unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] Engine + arena-client build/test/typecheck green; `pnpm -r` green
- [ ] `docs/ai/STATUS.md` Done entry names WP-538 + Doom's Master Strike, D-24026 live-verify operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24347 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX flipped; `docs/05-ROADMAP-MINDMAP.md` WP-538 node `📝` → `✅`, `roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-573:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: the prompt + put-on-top observed in a deployed Core Doom match (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: `resolveMagnetoStrike` + `pendingDiscardChoices` + `discardChoice.resolve.ts` + `PendingDiscardChoicePrompt.vue` are on `main` (the full interactive-strike precedent, WP-476); the pending-choice wiring surfaces (`types.ts`, `ai.legalMoves.ts`, `uiState.{build,filter,types}.ts`, `PlayDesktop`/`PlayMobile`) all exist; `core/dr-doom` is hollow today (2026-08-13 audit). The change clones the Magneto discard-choice pattern with a put-on-top terminal and a new pending type. **Empirical Scaffold N/A** — additive interactive effect, no existing-fixture-tightening. **Mutation Boundary** — deterministic; the new field is lazy-init/optional so no fresh-state fixture materializes it (no re-pin expected). **Ordering PS-item folded:** WP-538 shares `mastermindHandlers.ts` with WP-537 — precondition D forces WP-537 onto `main` first, so the two never collide on that file.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13, after one RISK round)

Layer boundary (engine + arena-client only; no server/registry edge; App→engine via the runtime-safe surface), determinism (no `ctx.random`; lazy-init hashed field → no re-pin), contract fidelity (6-card gate + Tech reveal escape + interactive-for-current / auto-for-others, faithful to print and to the Magneto precedent), the **UIState projection integrity** rule (build + type + **filter pass-through** all in scope + an AC + a `// why:` — the EC-206 drop-at-filter failure mode is explicitly guarded), and the no-UX-freeze invariant (engine block-all + projection + prompt shipped together) all clear. RISK folded: the block-all guard must be added to **every** move that guards `hasPendingDiscardChoice` (a missed guard lets a human act around the pending choice) — locked as AC-4 + Verification-2 (the grep that fails if any discard-guarded move lacks the new guard) + an EC failure smell.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS. **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–E incl. the WP-537 ordering gate). **§4 Context** — PASS (the Magneto template, the new-pending-type rationale, the full touch-point set, the UIState-integrity + no-freeze rules; 00.2 N/A). **§5 Files** — PASS (closed cross-layer allowlist; bundling justified — ship-together). **§6 Naming** — PASS (`PendingPutCardsOnDeckChoice`, `resolveCoreDoomStrike`, `heroClass`/`tech`). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine + arena-client; no server/registry runtime edge). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A (inherits play-session gate). **§12 Test Quality** — PASS (`node:test` + vue-tsc; filter + legalMoves + resolve-move + move-count coverage). **§13 Verification** — PASS. **§14 AC** — PASS (10 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24347 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements the printed Master Strike), §22 (determinism — no RNG; lazy-init hashed field). **Conflict assertion:** `No conflict: this WP preserves all touched clauses`. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** deterministic mutation; the new field is optional + lazy-init → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine + client gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
