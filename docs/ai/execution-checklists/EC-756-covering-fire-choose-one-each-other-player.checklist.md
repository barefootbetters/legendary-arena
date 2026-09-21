# EC-756 — Covering Fire choose-one each-other-player (WP-719)

**WP:** WP-719 · **Reserves:** D-24541 · **Layers:** Game Engine + Arena Client

Authoritative execution contract for WP-719. Subordinate to ARCHITECTURE.md and
`.claude/rules/*`. Compliance is binary.

## Before Starting

- [ ] `origin/main` clean + synced; WP-286/D-24069, WP-476/D-24284, WP-676/D-24492,
      WP-702/D-24521 all ✅ on main.
- [ ] Read the current HEAD value of every drift pin (they drift as siblings merge):
      `HERO_KEYWORDS.length`, `Object.keys(HERO_EFFECT_HANDLERS).length`, the `game.test.ts`
      move count/array. Bump from the OBSERVED value, not the value written here.
- [ ] Engine `dist` built before any `cards:check` / ledger / mechanics regen (they read dist).

## Locked Values

- Keyword: `covering-fire` (single-segment, no magnitude). Marker token: `[keyword:covering-fire]`.
- Move: `resolveCoveringFireChoice({ choice: 'draw' | 'discard' })`, `client: false`.
- Pending: `G.pendingCoveringFireChoices?: PendingCoveringFireChoice[]`,
  `PendingCoveringFireChoice = { playerID: string; sourceCardId: CardExtId }`. Lazy-init at park.
- UIState: `UIPendingCoveringFireChoice = { playerID: string; otherPlayerCount: number }`,
  chooser-redacted (audience.playerId === playerID).
- Magnitude drawn / discarded per other seat: **1**.
- Drift baselines at draft: `HERO_KEYWORDS` 59→60, `HERO_EFFECT_HANDLERS` 43→44, moves 41→42.
- Both printings: `core/hawkeye/covering-fire` idx0 + `msp1/hawkeye/covering-fire` idx0.

## Guardrails

1. The choice is ACTIVE-player-scoped (park for `playerID`). Non-active seats NEVER choose —
   the discard branch auto-picks via `selectDefaultSmashDiscardTarget` (D-24284). Never park a
   per-seat choice.
2. Both branches iterate `Object.keys(G.playerZones).sort()` and **skip the active player**.
3. hand→discard MUST route through `discardFromHand(G, seat, cardId)` (the chokepoint that fires
   WP-498 return-on-discard) — never a raw `zoneOps.moveCardFromZone`.
4. `covering-fire` ∈ `NO_MAGNITUDE_KEYWORDS` (else the magnitude pre-gate drops the park) AND
   ∈ `HANDLED_KEYWORDS` (it has a handler; keeps the `HANDLED_KEYWORDS`↔`HERO_EFFECT_HANDLERS`
   bidirectional drift test green).
5. The block-all guard is replicated per action-move (NOT centralized): `game.ts`,
   `coreMoves.impl.ts` ×3, `fightVillain`, `fightMastermind`, `recruitHero`, `recruitOfficer`,
   `dodgeCard`, `healWounds`, `villainDeck.reveal`, + `ai.legalMoves` short-circuit.
6. Sim-dispatch three-site lockstep: `SIMULATION_MOVE_NAMES` + `simulation.runner` MOVE_MAP +
   `par.aggregator` MOVE_MAP (all three, or the drift test reds / a sim hangs). Bot default: `'draw'`.
7. UIState five-step contract: type + build + **filter pass-through** + audience test + Play
   Diagnostics snapshot. A field that reaches build but not filter is silently dropped.
8. Client `UiMoveName` union MUST gain `'resolveCoveringFireChoice'` (vue-tsc lockstep).
9. Determinism: no new hashed field beyond the runtime-only pending queue; sentinel is core-2p-Doom
   (never plays Hawkeye) → NO `finalStateHash` re-pin. `[hc:tech]` gate semantics unchanged.

## Required Comments (`// why:`)

- Each `context.random`/reshuffle use in the draw branch. Each block-all guard site. The lazy-init
  park. The D-24284 auto-discard rationale. The seat-iteration skip-active line.

## Files to Produce

Exactly the allowlist in WP-719 §Files Expected to Change. `game.test.ts` +
`heroEffects.execute.test.ts` + `heroKeywords.test.ts` + `heroAbility.setup.test.ts` are in the
allowlist up front (mandated drift edits). `simulation.runner.ts` + `par.aggregator.ts` are in
the allowlist up front (the recurring sim-dispatch omission).

## After Completing

- Bump `HERO_KEYWORDS`/`HERO_EFFECT_HANDLERS`/move-count drift assertions to 60/44/42.
- Regenerate (in order): `pnpm ledger:heroes` → `pnpm mechanics:metadata` → `pnpm effect-index`;
  `pnpm cards:check` reproducible; `pnpm sim:runtime-observed:check` green.
- Land D-24541 in DECISIONS.md; flip WORK_INDEX + EC_INDEX rows; mindmap node 📝→✅ +
  `pnpm roadmap:counts:write`.
- D-24026 live-verify (operator).

## Common Failure Smells

- Bot picks `'discard'` (bad default: a downside to teammates) — must be `'draw'`.
- The apply script rejects `[keyword:covering-fire]` (extend `VALID_TOKEN_PATTERN`).
- Forgetting the audience-filter pass-through → blank prompt (silently dropped field).
- Forgetting a MOVE_MAP entry → sim hang on a parked choice.
- `sim:coverage` shows unrelated per-count WARNs — leave the coverage baseline alone (do NOT
  absorb the pre-existing drift; the gate is non-regression and green).
