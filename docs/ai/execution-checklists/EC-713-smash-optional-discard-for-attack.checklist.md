# EC-713 — Smash: optional discard-for-attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-676-smash-optional-discard-for-attack.md
**Layer:** Game Engine + Arena Client (cross-layer pending choice)

## Before Starting
- [ ] Scope lock: the exact target file set is `## Files to Produce` below — any edit
      outside it is a FAIL; surface it as a blocker, do not improvise.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] Confirm `optional-ko-reward` is present as the park/resolve/prompt model
      (`heroEffects.execute.ts` `heroEffectOptionalKoReward`, `moves/optionalKoReward.resolve.ts`,
      `components/play/OptionalKoRewardPrompt.vue`).

## Locked Values (do not re-derive)
- Marker form `[keyword:smash:N]`, `N` ∈ {1,2,3,4,5} — slug is letters/hyphens only
  (parser `KEYWORD_PATTERN` `[a-zA-Z][a-zA-Z-]*`); magnitude rides the `:N` colon-segment.
- The inert current form being replaced is `[keyword:Smash N]` (capital-S, space — does not
  parse). All Smash cards are in `data/cards/wwhk.json`; no other set.
- Two Smash instances = **two separate `abilities[]` entries** (two hooks → two pending
  entries). Two identical `[keyword:smash:2]` tokens on ONE line collapse to one via the
  parser `uniqueKeywords` dedup — forbidden for multi-Smash cards. Hurl Trucks keeps its two
  entries.
- `smash` carries a magnitude → **NOT** in `NO_MAGNITUDE_KEYWORDS`.
- `PendingSmashDiscard { playerID, magnitude }`; FIFO queue `pendingSmashDiscards?` on
  `LegendaryGameState`.
- Resolve grant: `resolveSmashDiscard({ cardId })` → move `cardId` hand→discard via `zoneOps`,
  add exactly `magnitude` to `G.turnEconomy.attack`, pop front. `{ decline: true }` → pop
  front, grant 0. Illegal with no parked choice or `cardId` not in hand (silent `void`).
- Move is server-only: `resolveSmashDiscard: { move, client: false }`.
- Bot default `selectDefaultSmashDiscardTarget`: lowest-`cost` hand card (CardExtId asc
  tie-break); decline only when hand empty.
- Sim dispatch (drift-pinned, WP-286/D-24073): `resolveSmashDiscard` goes in
  `SIMULATION_MOVE_NAMES` (`ai.legalMoves.ts`) AND as a `MOVE_MAP` key in BOTH
  `simulation.runner.ts` and `par.aggregator.ts` — else `simulation.moveDispatch.drift.test.ts`
  reds and a wwhk sim hangs. The drift test itself needs no edit (generic superset).
- Marker normalisation targets ONLY `[keyword:Smash N]` (with magnitude); leave the two bare
  magnitude-less `[keyword:Smash]` verb tokens (conditional-KO clauses) as honest unresolved
  markers — do not lowercase them into spurious `smash` hooks.
- Drift pins: `HERO_KEYWORDS` length 44→45; `HERO_EFFECT_HANDLERS` count 30→31 — both RUNTIME
  assertions (D-24372), not `satisfies`.

## Guardrails
- Lockstep: `HeroKeyword` union AND `HERO_KEYWORDS` array change together; update both pins.
- Block-all pending choice ships WITH its UIState projection AND client prompt — a parked
  choice without a projection/renderer freezes the game. Five-step Board-Visible Field
  contract (type → build → filter pass-through → audience test → diagnostics snapshot),
  active-player-scoped.
- Client submits intent only; the engine computes the attack grant. Move never throws.
- Card data is GENERATED — edit the marker SOURCE + regen; `cards:check` must reproduce
  `wwhk.json` byte-identically. Never hand-edit `data/cards/wwhk.json`.
- New `pendingSmashDiscards?` is optional and absent by default → no `finalStateHash` re-pin.
  If a sentinel hash moves, STOP and investigate — a non-wwhk game must not change.
- Errors that a drift/typecheck gate surfaces are fixed in the test/source, never with
  `any` / `@ts-ignore` / a widened production type.

## Required `// why:` Comments
- `heroEffects.execute.ts` — why `smash` is excluded from `NO_MAGNITUDE_KEYWORDS` (carries a
  real +N magnitude through the pre-gate).
- `game.ts` — why the `hasPendingSmashDiscard` block-all guard is required (freeze prevention).
- `heroEffectSmash` — why an empty hand parks nothing (nothing to discard → no choice).
- `smashDiscard.resolve.ts` — why the decline arm grants 0 (the rule's "you may").

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — modified — `smash` union + array.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — `HANDLED_KEYWORDS`,
  `HERO_EFFECT_HANDLERS`, `heroEffectSmash`, `selectDefaultSmashDiscardTarget`.
- `packages/game-engine/src/types.ts` — modified — `PendingSmashDiscard` + queue field.
- `packages/game-engine/src/moves/smashDiscard.resolve.ts` — new — resolve + predicate.
- `packages/game-engine/src/game.ts` — modified — import + move entry + block-all guard.
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` + `index.ts` — modified —
  `UIPendingSmashDiscard` projection (five-step).
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified — bot short-circuit +
  `resolveSmashDiscard` in `SIMULATION_MOVE_NAMES`.
- `packages/game-engine/src/simulation/simulation.runner.ts` + `par.aggregator.ts` — modified —
  `resolveSmashDiscard` `MOVE_MAP` entry in BOTH (the drift-pinned dual-dispatch invariant).
- `apps/arena-client/src/components/play/SmashDiscardPrompt.vue` — new — prompt.
- `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue`,
  `composables/useTurnActions.ts`, `components/play/uiMoveName.types.ts`,
  `diagnostics/effectProvenance.ts` — modified — client wiring.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified — `smash:N` token arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified — wwhk Smash markers.
- `data/cards/wwhk.json` + `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` +
  `data/metadata/{effect-implementation-index,card-mechanics}.json` +
  `docs/ai/coverage/runtime-observed-hollows.json` +
  `scripts/coverage/mechanic-provenance.json` — modified (generated / provenance row).
- Paired `*.test.ts` for each engine/client source above — new/modified.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `effect-index:check` +
      `sim:runtime-observed:check` exit 0 (`smash` row `executable`)
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin), confirmed by a clean run
- [ ] Live-on-surface verification (D-24026): a real play.legendary-arena.com match plays a
      Smash card, the prompt appears, the discard grants +N attack
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` D-24492 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Playing Hurl Trucks grants +2 not +4, or prompts once — the two Smash entries collapsed
  into one (uniqueKeywords dedup); they must be two `abilities[]` entries.
- Game freezes on a Smash card with no prompt — the block-all guard shipped without the
  UIState projection or the client renderer (five-step contract incomplete).
- A sentinel `finalStateHash` moved — a non-optional field or a non-wwhk edit leaked in.
- `cards:check` diff — `wwhk.json` was hand-edited instead of regenerated from the marker.
