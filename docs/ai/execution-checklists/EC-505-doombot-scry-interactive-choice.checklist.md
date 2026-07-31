# EC-505 — Interactive Doombot Scry-KO Choice (Execution Checklist)

**Source:** docs/ai/work-packets/WP-470-doombot-scry-interactive-choice.md
**Layer:** Game Engine + Arena Client (single feature; engine-then-client order)

## Before Starting
- [ ] On `origin/main` ≥ `371345d5`.
- [ ] `pnpm -r build` + game-engine test + arena-client test green.
- [ ] Re-read the WP-242/243 KO-a-Hero pattern: `moves/koHeroChoice.resolve.ts`,
      `game.ts` guard sites, `ui/uiState.{build,filter,types}.ts`,
      `components/play/PendingKoHeroChoicePrompt.vue`. **Mirror it for `scry-ko`.**

## Locked Values (do not re-derive)
- Pending shape: `PendingScryKoChoice { choiceType: 'scry-ko'; playerID: string;
  revealedCardIds: CardExtId[] }` on `G.pendingScryKoChoices` (FIFO). Runtime-only.
- Parker branch (in `villainEffectScryKoOwnDeck`): deck 0 → no-op; 1 → **auto-KO
  (unchanged)**; ≥2 → push a `PendingScryKoChoice` with the top 2 ext_ids, KO nothing yet.
- `selectScryKoTarget` is UNCHANGED — it becomes the bot/sim default pick (byte-identical
  to today's auto-resolve; determinism preserved).
- Resolve move `resolveScryKoChoice({ G, playerID }, { cardId })` — front-only; validate
  `playerID` + `choiceType === 'scry-ko'` + `cardId ∈ front.revealedCardIds`; KO `cardId`
  from the deck (leave the other on top); front-pop. Register `{ move, client: false }`.
  Silent no-op (queue intact) on any invalid state; NEVER throws.
- `hasPendingScryKoChoice(G)` = `(G.pendingScryKoChoices?.length ?? 0) > 0` — added to
  the COMPLETE set of `hasPendingKoHeroChoice(` guard sites (grep-parity): `game.ts`,
  `moves/coreMoves.impl.ts` (×3), `moves/dodgeCard.ts`, `moves/fightMastermind.ts`,
  `moves/fightVillain.ts`, `moves/recruitHero.ts`, `moves/healWounds.ts`,
  `moves/playFromUndercover.ts`, `villainDeck/villainDeck.reveal.ts`, `simulation/ai.legalMoves.ts`.
- Move registration: `resolveScryKoChoice` is NOT in `CORE_MOVE_NAMES` (mirrors
  `resolveKoHeroChoice`); it IS added to `SIMULATION_MOVE_NAMES` (`simulation/ai.types.ts`)
  + both sim `MOVE_MAP`s (`simulation.runner.ts` + `par.aggregator.ts`) — else the sim
  per-turn loop HANGS — asserted by `simulation.moveDispatch.drift.test.ts`; and to BOTH
  `game.test.ts` move-list literals (the description string + the array) + the count
  (sorts between `resolveReturnZeroCostDiscard` and `resolveVictoryPileCardPick`).
- `selectScryKoTarget` is module-private today — `export` it for the bot/sim default.
- `UIPendingScryKoChoice` must be re-exported from `packages/game-engine/src/index.ts`
  (else the client `import type` fails vue-tsc — the D-16502 barrel trap).
- Client prompt mounts in BOTH `pages/PlayDesktop.vue` and `pages/PlayMobile.vue` (where
  the KO-hero prompt lives) — NOT `PlayViewport.vue`.
- `PendingScryKoChoice` stores `revealedCardIds` (a snapshot, unlike `PendingKoHeroChoice`
  per D-24007) — justified: block-all freezes the deck top and KO-by-ext_id is outcome-
  identical. Preserve that reasoning.
- **Persisted-log replay disposition (D-24119/D-24187):** see WP §Verification 5 — before
  landing, confirm no accepted competitive score / replay match fought a Doombot pre-WP-470
  (plausibly empty); if any exists STOP and specify a version-gate.

## Guardrails
- **Ship the trio together:** the block-all guard + the UIState projection + the client
  prompt. A pending state without them hard-freezes the client
  (`project_pending_choice_no_ux_freeze`). Do NOT land the engine park without its guard
  and projection.
- Determinism: bots/sims MUST resolve via `selectScryKoTarget` (same card as WP-447 auto).
  `ai.legalMoves` + `simulation.runner` + `par.aggregator` drain the scry queue exactly as
  they drain `pendingKoHeroChoices`. No `ctx.random`, no I/O, no `.reduce()`.
- Moves never throw; validate → mutate → void; queue byte-identical on no-op (resubmit).
- `G.pendingScryKoChoices` is runtime-only — never persisted; snapshots stay counts-only.
- Do NOT touch `selectScryKoTarget` or the 0/1-card branches.
- The UIState revealed cards are PRIVATE to the choosing player (WP-249/D-24020 filter).
- New move ⇒ update `game.test.ts` move-set + count AND the `CORE_MOVE_NAMES` drift test
  (if `resolveScryKoChoice` joins it; else mirror how `resolveKoHeroChoice` is registered).

## Required `// why:` Comments
- `G.pendingScryKoChoices` / `PendingScryKoChoice`: runtime-only pending-choice queue,
  mirrors `pendingKoHeroChoices`; cite D-24282.
- The parker ≥2 branch: why it parks instead of auto-KO (interactive agency; the 1-card
  branch still auto-resolves — nothing to choose).
- The bot/sim resolution via `selectScryKoTarget`: why determinism is preserved (same card
  as the WP-447 auto-resolve; only live human play gets the prompt).
- Each block-all guard addition: why an unresolved scry choice blocks all actions.

## Files to Produce
**Engine:** `types.ts` (pending shape + G field); `villain/villainEffects.execute.{ts,test.ts}`
(parker ≥2 branch + `export selectScryKoTarget`); `moves/scryKoChoice.resolve.{ts,test.ts}`
(**new** move + `hasPendingScryKoChoice`); `game.{ts,test.ts}` (register `{move,client:false}`
+ end-turn/advanceStage guard + BOTH move-list literals + count); the 8 other guard sites
(`moves/coreMoves.impl.ts`, `dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`,
`recruitHero.ts`, `healWounds.ts`, `playFromUndercover.ts`, `villainDeck/villainDeck.reveal.ts`);
`ui/uiState.{types,build,filter}.ts` + `uiState.build.test.ts` + `uiState.types.drift.test.ts`
+ `uiState.filter.test.ts`; `index.ts` (barrel re-export of `UIPendingScryKoChoice`);
`simulation/ai.legalMoves.ts` + `ai.types.ts` (`SIMULATION_MOVE_NAMES`) + `simulation.runner.ts`
+ `par.aggregator.ts` + `simulation.moveDispatch.drift.test.ts` (+ sim tests).
**Client:** `components/play/PendingScryKoChoicePrompt.vue` (**new**);
`composables/useTurnActions.ts`; `components/play/uiMoveName.types.ts`;
`pages/PlayDesktop.vue` **and** `pages/PlayMobile.vue` (mount — both surfaces) (+ tests).

## After Completing
- [ ] `pnpm -r build` + game-engine test + arena-client test/typecheck exit 0.
- [ ] `game.test.ts` move-set/count updated for `resolveScryKoChoice`.
- [ ] Replay/fixture `finalStateHash` regenerated-with-note (re-pin LIKELY — bots fighting
      a Doombot now park→resolve). Confirm the KO'd card is unchanged (selectScryKoTarget).
- [ ] `docs/ai/DECISIONS.md` — D-24282 landed (Active).
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md` `✅` +
      `roadmap:counts:write` / `:check` exits 0.
- [ ] Live-on-surface (D-24026): fight a Doombot with ≥2 deck cards → the prompt appears.

## Common Failure Smells
- The prompt never appears but the client freezes on a Doombot fight → the projection or
  the client prompt was skipped (the pending state shipped without its UX).
- A bot game diverges / par shifts unexpectedly → the bot isn't resolving via
  `selectScryKoTarget` (determinism broken).
- The player can still play cards / end the turn while the prompt is up → a
  `hasPendingScryKoChoice` guard site was missed.
- The KO'd card differs from the old auto-resolve in a fixture → the bot default isn't
  `selectScryKoTarget`.
- `game.test.ts` move-count unchanged → the new move wasn't registered/asserted.
