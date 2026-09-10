# WP-694 — Multi-seat "each other player chooses" core mastermind tactics (Game Engine + Arena Client)

**Status:** Done 2026-09-10 (EC-731; D-24511 Active)
**Layer:** Game Engine + Arena Client
**Lane:** Standard two-session (mutates the determinism surface — engine game-state effect; parks a hashed pending-choice field)
**Baseline:** `origin/main` (WP-684 / D-24501 landed 2026-09-10)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:**
- **WP-497 / D-24300** (tactic-onFight framework — `tacticHandlers.ts` / `dispatchTacticOnFight`, wired as the final step of `defeatMastermindTacticCore`) ✅
- **WP-684 / D-24501** (non-active & simultaneous multi-seat pending-choice capability — `G.pendingSeatChoice`, `parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind`, per-seat UIState redaction, deterministic disconnect/timeout default) ✅

## Goal

Make the two remaining **"each other player chooses"** core mastermind tactics resolve
faithfully on defeat, implemented as per-tactic resolvers in `rules/tacticHandlers.ts`
that **park a WP-684 multi-seat `pendingSeatChoice`** (do NOT build new pending
infrastructure — reuse the shipped capability). Each addressed seat sees only its own
prompt (per-seat redaction), every addressed seat selects concurrently, turn progress is
blocked until all have submitted, and the selections apply atomically and
deterministically. Today both tactics fire nothing on defeat.

| Tactic | Mastermind | Printed Fight text | Resolution |
|---|---|---|---|
| Monarch's Decree | Dr. Doom | "Choose one: each other player draws a card OR each other player discards a card." | ACTIVE choose-one first (draw-vs-discard); **draw** branch is deterministic (each other player draws 1); **discard** branch is MULTI-SEAT (each other player chooses which card to discard) |
| Vanishing Illusions | Loki | "Each other player KOs a Villain from their Victory Pile." | MULTI-SEAT: each other player chooses which Victory-Pile Villain to KO; a seat with 0 Victory-Pile Villains no-ops |

## User-Visible Impact

On `play.legendary-arena.com`, defeating Dr. Doom's **Monarch's Decree** first prompts the
defeating player to choose draw-vs-discard; on "draw" every other player draws a card, on
"discard" every other player is simultaneously prompted to choose one card from their own
hand to discard. Defeating Loki's **Vanishing Illusions** simultaneously prompts every other
player to choose one Villain from their own Victory Pile to KO. Both tactics are inert today
(the arc's `defeatMastermindTacticCore` runs no tactic text for them). Validated by unit
tests + an arena-client heading test; the live human path is operator live-verify (D-24026).

## Assumes

- **WP-497 / D-24300** — `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext)`
  in `rules/tacticHandlers.ts`, keyed by the defeated tactic ext_id
  `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}`; unknown id → silent no-op. This
  WP adds two branches. Locked source: `tacticHandlers.ts`.
- **WP-684 / D-24501** — `G.pendingSeatChoice` (single open non-active/multi-seat choice),
  `parkSeatChoice(G, events, choice)` (sets the choice + admits addressed seats via the
  framework `setActivePlayers` stage-ride), `resolveSeatChoice` (per-seat submit; atomic
  apply when all submit), `applySeatChoiceByKind` (kind→apply dispatch), the block-all guard
  (`hasPendingSeatChoice`, already wired into `fightMastermind` and the action moves), the
  per-seat UIState projection (`ui/uiState.{types,build,filter}.ts`), and the deterministic
  disconnect/timeout default (`applySeatChoiceTimeoutDefault`). Locked source:
  `moves/seatChoice.resolve.ts`, `types.ts` (`PendingSeatChoice` / `SeatChoiceOption` /
  `PendingSeatChoicePrompt`).
- `resolveSeatChoice` is **already enrolled** in `SIMULATION_MOVE_NAMES` + both sim
  `MOVE_MAP`s, and `getLegalMoves` already short-circuits to it at `defaultOptionIndex`
  (`simulation/ai.legalMoves.ts`, `simulation/par.aggregator.ts`). Reusing that move means
  **no new sim-dispatch enrollment and no new bgio move registration** (baseline assertion —
  confirm at HEAD).
- `SeatChoiceOption` already carries an optional `cardId` (the exact zone instance) — reused
  here for the KO target (a Victory-Pile Villain) and the discard target (a hand card), so
  **no new `PendingSeatChoice`/`SeatChoiceOption`/`UIState` field is added** (the client
  submits by `optionIndex`; only `label` is projected). Confirm at HEAD.
- `defeatMastermindTacticCore(G, ctx, shuffleContext)` (`moves/fightMastermind.ts`) has
  **two** callers, both boardgame.io moves that own `events`: `fightMastermind` (the normal
  fight) and `defeatChoice.resolve.ts` (Silent Sniper's free `defeat-with-bystander`). Both
  must thread `events` so a parked multi-seat choice can admit non-active seats.
- Card texts + slugs (`data/cards/core.json`): Dr. Doom mastermind slug `dr-doom`, tactic
  slug `monarchs-decree` → `core-mastermind-dr-doom-monarchs-decree`; Loki mastermind slug
  `loki`, tactic slug `vanishing-illusions` → `core-mastermind-loki-vanishing-illusions`.
- Zone helpers: `discardFromHand(G, playerID, cardId)` (hand→discard, the enforced
  chokepoint — never raw `zoneOps`), `drawCardsIntoHand(playerZones, count, shuffleContext)`
  (reshuffle-aware draw), `koCard(koPile, cardId)` (append to `G.ko`),
  `moveCardFromZone` (victory→removed). A Villain in a Victory Pile is identified by the
  id-grammar `-villain-` infix (the `countVictoryPileGroupVillains` /
  `victoryPileHasOtherGroupVillain` precedent — derived from the ext_id, NOT a new hashed
  villain-group map; `bystander-…` / `-henchman-` / `-mastermind-` do not match). Confirm at HEAD.

## Context (Read First)

Per [[project_mastermind_tactic_fight_arc]], every un-implemented tactic's Fight ability is
inert. WP-691 took the three no-choice tactics; the **choose-one** tactics
(WP-692..695) need a player choice, and these two specifically need a choice from **each
other player** — the exact shape WP-684 built the multi-seat capability for. WP-682/WP-683
already consumed that capability for cards; this WP is the first **mastermind-tactic**
consumer. **Reuse, do not rebuild:** the block-all guard, the atomic multi-seat apply, the
per-seat redaction, the sim dispatch, and the disconnect posture all exist.

**"Each other player."** Both tactics target every seat **except** the defeating player
(`ctx.currentPlayer`). A tactic Fight is the defeating player's reward *against* the others.

**Why Monarch's chains.** Monarch's Decree is two steps: the ACTIVE player first makes an
active single-seat choice (draw-vs-discard); the "discard" branch then opens a **multi-seat**
choice for the other players. The chain must be parked from the live move context
(`resolveSeatChoice`), not from the ctx-free apply — admitting the non-active seats needs the
move's `events.setActivePlayers`, exactly as `chainRandomActsPassLeft` chains the pass after
the Random Acts wound choice (WP-683 precedent). The "draw" branch has no cross-seat choice,
so it applies deterministically inside the mode-choice apply and chains nothing.

**Why events must thread.** The tactic Fight fires inside `defeatMastermindTacticCore`, which
today receives only `{ random }`. Parking a multi-seat (or non-active) choice needs the
move's `events` (for the `setActivePlayers` stage-ride) and `ctx` (for `currentPlayer` and,
for the discard chain, the other-seat set). `events` threads from both move call sites; it is
**optional/guarded** (a unit/replay context without a live framework parks the choice on `G`
and resolves it directly, mirroring `parkSeatChoice`).

**Determinism (the re-pin question).** No new hashed `G` field is added — the resolvers reuse
`G.pendingSeatChoice` (already hashed by `computeStateHash` since WP-684). The tactics fire
**only** on defeat of these two specific ext_ids, and **no committed replay/sentinel fixture
defeats them** (mirrors WP-506's reasoning for Crushing Shockwave). So both hash oracles stay
byte-identical and **no re-pin is expected**. Verify both at execution; **STOP on any drift,
never blind-re-pin** ([[reference_hashed_g_field_dual_repin]]). The multi-seat apply is atomic
and iterates addressed seats in ascending id order (the WP-684 guarantee), so a resolution is
byte-identical regardless of submission order.

## Design Rationale

**Reuse the WP-684 capability; add only kinds.** The two tactics are new
`PendingSeatChoice.kind` discriminants routed through the existing `applySeatChoiceByKind`
dispatch, exactly as WP-683's Deadpool kinds were. No new pending field, no new move, no new
block-all guard, no new sim enrollment. The kinds: `monarchs-decree-mode` (active single-seat
draw-vs-discard), `monarchs-discard` (multi-seat), `vanishing-illusions-ko` (multi-seat).

**Pure builders/appliers live in their own module** (`moves/seatChoiceTactics.ts`), mirroring
`seatChoiceCards.ts`: it holds `buildMonarchsDecreeModeChoice`, `applyMonarchsDecreeMode`
(the deterministic each-other-draws branch), `buildMonarchsDiscardChoice`,
`applyMonarchsDiscard`, `buildVanishingIllusionsChoice`, `applyVanishingIllusionsKo`, and the
kind constants — **no boardgame.io import, no `parkSeatChoice` import**, so it never cycles
with `seatChoice.resolve.ts`. `seatChoice.resolve.ts` imports the appliers (to dispatch on
resolve) + the Monarch's-discard chain builder (to chain after the mode choice);
`tacticHandlers.ts` imports the mode/KO builders + `parkSeatChoice`. One direction only.
Confirm no import cycle at HEAD.

**Deterministic defaults (bot/sim + disconnect).** `monarchs-decree-mode` default = 0 (draw);
`monarchs-discard` default = 0 (first hand card); `vanishing-illusions-ko` default = 0 (first
Victory-Pile Villain, ascending). Each is always in range and RNG-free.

**Disconnect posture (D-24501, unchanged).** A play-phase disconnect PAUSES the match and the
choice is PRESERVED for the seat across the pause (D-11602); the governing-policy timeout
default resolves an absent seat to `defaultOptionIndex` via `applySeatChoiceTimeoutDefault`.
This WP invents no new posture.

## Scope (In)

- `packages/game-engine/src/rules/tacticHandlers.ts`:
  - `resolveMonarchsDecree(G, events, ctx, currentPlayer)` — park an ACTIVE single-seat
    `monarchs-decree-mode` choice addressed to `[currentPlayer]` (options: "Each other
    player draws a card" / "Each other player discards a card") via `parkSeatChoice`.
  - `resolveVanishingIllusions(G, events, ctx, currentPlayer)` — build the multi-seat
    `vanishing-illusions-ko` choice addressed to every OTHER seat holding ≥1 Victory-Pile
    Villain (one option per Villain), park via `parkSeatChoice`; if no other seat qualifies,
    park nothing and log a no-op.
  - Two `dispatchTacticOnFight` branches + tactic-id consts
    (`MONARCHS_DECREE_TACTIC_ID`, `VANISHING_ILLUSIONS_TACTIC_ID`); thread `events` (guarded)
    into `dispatchTacticOnFight`.
- `packages/game-engine/src/moves/seatChoiceTactics.ts` (**new**) — the pure builders +
  atomic appliers + kind constants (see Design Rationale). No boardgame.io / `parkSeatChoice`
  import.
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — extend `applySeatChoiceByKind` to
  dispatch the three new kinds; add the Monarch's-discard chain (capture the active seat's
  chosen option before clearing; when the mode was "discard", chain
  `chainMonarchsDiscard(G, ctx, events)` — build + park the multi-seat discard, mirroring
  `chainRandomActsPassLeft`).
- `packages/game-engine/src/moves/fightMastermind.ts` + `packages/game-engine/src/moves/defeatChoice.resolve.ts`
  — thread `events` through `defeatMastermindTacticCore` → `dispatchTacticOnFight` (both
  callers).
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — three `heading()`
  cases for the new kinds (option labels already flow through the projection).
- `scripts/coverage/tactic-provenance.json` — two `executable` rows (the two tactics) +
  regenerate the effect-implementation index.
- Tests: engine (both tactics: park shape, per-seat prompts, atomic multi-seat apply,
  each-other-draws, KO-from-victory, skip-self, empty-hand / no-villain no-op, disconnect
  default, active-only regression untouched); arena-client (three headings).

## Scope (Out)

- Any new pending-choice infrastructure, new bgio move, new `PendingSeatChoice`/`UIState`
  field, or new sim `MOVE_MAP` entry — all reused from WP-684.
- The other choose-one core tactics (WP-692/693/695) and the extra-turn tactic
  (Secrets of Time Travel, WP-696).
- Non-core masterminds' tactics; a data-driven tactic effect-marker vocabulary.
- Card-data changes (resolver-only; texts already present in `data/cards/core.json`).
- Reworking the active-only pending-choice path (strict-superset invariant, WP-684).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | `+ resolveMonarchsDecree`, `+ resolveVanishingIllusions`, tactic-id consts, two dispatch branches, `events` threaded |
| `packages/game-engine/src/moves/seatChoiceTactics.ts` | **new** — pure builders + atomic appliers + kind consts (no bgio / `parkSeatChoice` import) |
| `packages/game-engine/src/moves/seatChoice.resolve.ts` | `applySeatChoiceByKind` three new kinds + the Monarch's-discard chain hook |
| `packages/game-engine/src/moves/fightMastermind.ts` | thread `events` into `defeatMastermindTacticCore` → `dispatchTacticOnFight` |
| `packages/game-engine/src/moves/defeatChoice.resolve.ts` | thread `events` into its `defeatMastermindTacticCore` call |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | both tactics: dispatch, park, multi-seat apply, edges, skip-self |
| `packages/game-engine/src/moves/seatChoiceTactics.test.ts` | **new** — builder/applier unit tests |
| `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` | three `heading()` cases |
| `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts` | three heading assertions |
| `scripts/coverage/tactic-provenance.json` | two `executable` rows |

Governance (not counted in the code allowlist): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24511 flips Active at execution), `NUMBER-LEDGER.md`
(already reserved).

## Non-Negotiable Constraints

- **Reuse WP-684** — no new pending-choice field, no new bgio move, no new block-all guard,
  no new sim enrollment. New behavior enters only as `PendingSeatChoice.kind` discriminants +
  `applySeatChoiceByKind` branches.
- Moves never throw; `dispatchTacticOnFight` stays a silent no-op for any unhandled id.
- **Each OTHER player** — both resolvers skip `ctx.currentPlayer`.
- Multi-seat apply is **atomic** (all-or-nothing) and iterates addressed seats in ascending
  id order (byte-identical regardless of submission order — the WP-684 determinism guarantee).
- A seat with no eligible target is **not addressed** (Monarch's discard: empty hand;
  Vanishing Illusions: no Victory-Pile Villain) → that seat no-ops; if no other seat
  qualifies, nothing is parked.
- Hand→discard goes through `discardFromHand` (the enforced chokepoint), never raw `zoneOps`.
- KO moves the chosen Villain from that seat's Victory Pile to `G.ko` (`koCard`).
- Villain identification uses the ext_id `-villain-` infix (id-grammar precedent), **not** a
  new hashed villain-group map.
- Per-seat UIState redaction is the WP-684 projection unchanged — each seat sees only its own
  prompt; option `cardId`/`cityIndex` are never projected (client submits by `optionIndex`).
- `events` is optional/guarded — a unit/replay context without a live framework parks on `G`
  and resolves directly.
- Determinism: no `Math.random`, no wall-clock, no I/O; `ctx.random.Shuffle` only for the
  reshuffle inside the draw branch (comment it). No `.reduce()` in the apply/count loops. No
  boardgame.io import in `tacticHandlers.ts` / `seatChoiceTactics.ts` (`ctx`/`events` narrowed
  via structural types, as `dispatchTacticOnFight` already narrows `ctx`).

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable; full English names;
every function JSDoc'd; `// why:` on non-obvious constants and any `ctx.random.*`); ESM-only,
`node:`-prefixed built-ins, `.test.ts` on `node:test`, Node v22+. Work from full file
contents, not diffs.

## Contract

- `dispatchTacticOnFight(G, ctx, 'core-mastermind-dr-doom-monarchs-decree', shuffleContext, events)`
  → parks an active `monarchs-decree-mode` choice for `ctx.currentPlayer`. On "draw" (option 0)
  each other player draws 1 card; on "discard" (option 1) a multi-seat `monarchs-discard`
  choice opens for every other seat with ≥1 hand card, and each discards its chosen card
  atomically.
- `dispatchTacticOnFight(G, ctx, 'core-mastermind-loki-vanishing-illusions', shuffleContext, events)`
  → parks a multi-seat `vanishing-illusions-ko` choice for every other seat with ≥1
  Victory-Pile Villain; each seat's chosen Villain moves to `G.ko` atomically.
- `applySeatChoiceByKind` resolves `monarchs-decree-mode` / `monarchs-discard` /
  `vanishing-illusions-ko`; the shared `resolveSeatChoice` submit/atomic-apply/timeout paths
  are unchanged.

## Vision Alignment

- **§1 Rules Authenticity** — each tactic resolves exactly as printed, with each other player
  making their own choice.
- **§3 Player Trust & Fairness** — every seat's choice is its own (per-seat redaction);
  deterministic, replay-faithful; atomic apply.
- **§5 Multiplayer integrity** — server-authoritative cross-seat choices with the WP-684
  liveness posture; the engine decides, the client renders.
- **§17.2 Non-Goal proximity** — no pay-to-win, no client authority; determinism preserved
  (no new hashed field; no re-pin expected — see Context).

## Funding Surface Gate

N/A — no pricing, checkout, or account surface.

## API Catalog Update

N/A — no `apps/server` HTTP endpoint or `Library-only` export change (reuses the existing
`resolveSeatChoice` move; no new server surface).

## Acceptance Criteria

1. Defeating `core-mastermind-dr-doom-monarchs-decree` parks an active `monarchs-decree-mode`
   choice for the defeating player only.
2. Resolving Monarch's "draw" (option 0) makes **each other player** draw exactly one card
   (deterministic; reshuffle-aware); the defeating player draws nothing.
3. Resolving Monarch's "discard" (option 1) opens a multi-seat `monarchs-discard` choice for
   every other seat with ≥1 hand card; each seat's chosen card is discarded via
   `discardFromHand`; a seat with an empty hand is not addressed; the apply is atomic.
4. Defeating `core-mastermind-loki-vanishing-illusions` parks a multi-seat
   `vanishing-illusions-ko` choice for every other seat holding ≥1 Victory-Pile Villain; each
   seat's chosen Villain moves to `G.ko`; a seat with no Victory-Pile Villain no-ops;
   if no other seat qualifies nothing is parked.
5. Both resolvers skip `ctx.currentPlayer`; the multi-seat apply is byte-identical regardless
   of submission order (ascending-seat-order apply).
6. The disconnect/timeout default resolves an absent seat to `defaultOptionIndex`
   deterministically for each new kind.
7. Per-seat UIState redaction: a seat's projected prompt contains only its own options
   (no other seat's hand / Victory Pile leaks).
8. The arena-client `PendingSeatChoicePrompt` renders a distinct heading for each of the
   three new kinds.
9. An unknown/unimplemented tactic id remains a silent no-op; existing active-only pending
   choices are byte-identical.
10. Determinism: engine + arena-client suites green; sentinel `finalStateHash` +
    `PRE_WP080_HASH` byte-identical (no committed fixture defeats these tactics) — any drift
    STOPs execution.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the pass delta.
3. `pnpm --filter @legendary-arena/arena-client test` → the three headings green.
4. Control check: temporarily stub `applyMonarchsDiscard` / `applyVanishingIllusionsKo` to
   no-ops → the atomic-apply assertions FAIL (non-vacuous); restore.
5. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep + full run);
   `pnpm effect-index:check` current after regenerating tactic-provenance;
   `pnpm sim:runtime-observed:check` current.
6. `pnpm -r build` → 0.
7. `git diff --name-only` = the file allowlist + governance only.
8. **D-24026 live-verify (operator-pending, post-deploy):** on `play.legendary-arena.com`,
   defeat Monarch's Decree (both branches) and Vanishing Illusions in a 2+-seat match → each
   other player is prompted / draws, and the KO / discard lands.

## Definition of Done

- [x] All Acceptance Criteria met; engine + arena-client suites green (pass delta recorded).
- [x] Sentinel + `PRE_WP080` hashes byte-identical (or drift diagnosed + a deliberate,
      documented re-pin — not expected). No new hashed field (reuses `G.pendingSeatChoice`);
      full engine suite green (the sentinel `finalStateHash` + `PRE_WP080_HASH` oracles included).
- [x] `pnpm -r build` 0; `effect-index:check` + `sim:runtime-observed:check` current after
      regenerating tactic-provenance (runtime-observed content byte-identical — the two tactics
      are not sim-observed, so no dashboard in-play-coverage re-pin).
- [x] `git diff --name-only` matches the allowlist.
- [x] D-24511 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX → `Done`; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; `docs/ai/STATUS.md` close-out entry added.
- [x] Two-commit topology (EC-731 impl + SPEC close).
- [x] D-24026 live-verify operator-pending (post-deploy, multiplayer 2+-seat match).

## Reserved Decision (lands at execution)

**D-24511** — Multi-seat "each other player chooses" core mastermind tactics (Dr. Doom
Monarch's Decree, Loki Vanishing Illusions) implemented as per-tactic resolvers that park a
WP-684 `pendingSeatChoice` rather than new pending infrastructure. Monarch's Decree = an
active single-seat draw-vs-discard choice whose "discard" branch chains a simultaneous
multi-seat discard, and whose "draw" branch resolves deterministically (each other player
draws 1); Vanishing Illusions = a simultaneous multi-seat KO-a-Victory-Pile-Villain choice.
Both skip the defeating player, no-op a seat with no eligible target, apply atomically in
ascending seat order, reuse `SeatChoiceOption.cardId` (no new field), reuse `resolveSeatChoice`
(no new bgio move / sim entry), and inherit the D-24501 deterministic disconnect/timeout
posture. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections present, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine rules cited).
- **§3 Assumes** — PASS (each prerequisite cites its locking source; WP-497 + WP-684 are the
  hard deps; the reuse assertions are flagged as baseline).
- **§4 Context** — PASS (`## Context (Read First)` covers each-other-player, the Monarch's
  chain, events threading, and the re-pin question).
- **§5 Files Expected to Change** — PASS (closed allowlist + governance; one new module).
- **§6 Naming Consistency** — PASS (canonical `pendingSeatChoice`, `parkSeatChoice`,
  `applySeatChoiceByKind`, `discardFromHand`, `koCard`, tactic ext_id grammar).
- **§7 Dependency Discipline** — PASS (WP-497 + WP-684 landed on `main`; all deps ✅).
- **§8 Architectural Boundaries** — PASS (game-engine + arena-client; engine decides / client
  renders; no `boardgame.io`/registry import in the pure modules; `ctx`/`events` via
  structural types; no `.reduce()`; no import cycle — the new module holds no `parkSeatChoice`
  import).
- **§9 Windows Compatibility** — N/A (no shell/path-specific work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub step;
  arena-client heading test).
- **§13 Commands & Verification** — PASS (`## Verification Steps` runnable).
- **§14 Acceptance Criteria Quality** — PASS (10 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + two-commit
  topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the non-obvious consts + the
  reshuffle `ctx.random.Shuffle`).
- **§17 Vision Alignment** — PASS (§1/§3/§5/§17.2; determinism line present).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused in prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline cited; reuse claims flagged as
  HEAD-confirm baseline assertions).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; stated in the WP).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only` export change;
  stated in the WP).

Pre-flight verdict target: **READY TO EXECUTE** after HEAD-confirming the three reuse
baseline assertions (no new field / no new move+sim entry / villain id-grammar) and the
no-import-cycle placement of `seatChoiceTactics.ts`.
