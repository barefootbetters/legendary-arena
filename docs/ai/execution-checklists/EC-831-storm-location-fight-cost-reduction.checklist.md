# EC-831 — Storm fight-cost reduction (WP-794)

**WP:** WP-794 · **Reserves:** D-24663 · **Layer:** Game Engine

Authoritative execution contract for WP-794. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-794 disagree, WP-794 wins. Compliance is binary.

## Before Starting

- [ ] `origin/main` clean and synced. WP-790 / D-24652, WP-489 / D-24295, WP-750 / D-24574 and D-24486 / D-24623
      are all on main.
- [ ] Read the HEAD value of every drift pin and bump from the OBSERVED value, not the value written here:
      `HERO_KEYWORDS.length` (three files: `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
      `setup/heroAbility.setup.test.ts` ~L1464) and `Object.keys(HERO_EFFECT_HANDLERS).length` (two asserts).
      WP-795 moves them too.
- [ ] `pnpm -r build`, then record the engine before-count. Run `cards:check`, the ledger and the mechanics regen
      only after a build; they read `dist`.
- [ ] Confirm the sentinel fixture still never plays Storm (`sentinel-core-doom-2p.replay.json` heroDeckIds).

## Locked Values

- Keyword `fight-cost-reduction`. It carries a magnitude (the amount), so it is NOT in `NO_MAGNITUDE_KEYWORDS`. It
  is in `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS`.
- Descriptor field: `fightCostReductionTarget?: AttackTargetName`; `magnitude` = the amount.
- Type: `FightCostReduction { target: AttackTargetName; amount: number; sourceCardId: CardExtId }`. Lazy field:
  `TurnEconomy.fightCostReductions?: FightCostReduction[]`.
- Helpers: `addFightCostReduction(economy, target, amount, sourceCardId)` and `getFightCostReduction(economy,
  target)`, both exported from `index.ts`.
- Post-gate text: `abilityText.slice(leadingGatePrefixLength).trim()`.
- The City and Mastermind regexes are in that order. Each is ONE line; copy it exactly:

  ```text
  /^Any Villain you fight (?:on|in) the (Sewers|Bank|Rooftops|Streets|Bridge) this turn gets -(\d+)\[icon:attack\]\.?$/i
  /^The Mastermind gets -(\d+)\[icon:attack\] this turn\.?$/i
  ```
- Step 4c pushes to `effects` and `uniqueKeywords` directly, never through `keywords` / `magnitudes`.
- The 5 lines:
  - core Lightning Bolt (rooftops 2);
  - core Tidal Wave idx0 (bridge 2) and idx1 (mastermind 2, `[hc:ranged]`);
  - cvwr Lightning Strike (rooftops 1, a split-card face);
  - dkcy Forge Dirty Work (sewers 2, `[hc:tech]`).
- Log, City form: `Player ${playerID}'s ${cardRef}: Villains you fight ${preposition} the ${SpaceLabel} this turn
  get -${N} attack.` `preposition` = `in` for sewers, else `on`.
- Log, Mastermind form: `Player ${playerID}'s ${cardRef}: the Mastermind gets -${N} attack this turn.`
- `resolveFightCost` = `max(0, today's sum - cityReduction)`, where `cityIndex = G.city?.indexOf(id) ?? -1` (the
  Dark Portal precedent). The reduction is 0 when the index is < 0, the name is undefined, or `G.turnEconomy` is
  undefined. Patrol is still added by the move after the floor.
- `resolveMastermindFightCost` = `max(0, base + portalBonus - mastermindReduction)`, with 0 when `G.turnEconomy` is
  undefined. The existing `makeG` / `makeMastermindG` partial-G tests must pass unedited.
- Drift at draft: `HERO_KEYWORDS` 75 → 76, handlers 58 → 59.

## Guardrails

1. Only the two resolvers read the field, through `getFightCostReduction`. No move, bot or projection reads
   `fightCostReductions`.
2. Lazy: absent until played; carried by `carryConversionFlag` only when present (a copied array); dropped by
   `resetTurnEconomy`; never in `REDACTED_ECONOMY`.
3. The parser fails closed. D-24486's negative-icon suppression stays. The effect comes from Step 4c only, placed
   after Step 4a and before Step 4b.
4. The Villain's space is read at fight time (`G.city?.indexOf(id) ?? -1`), never stored at play time.
5. Printed-attack readers (Pure Fury targets, D-24605 "N or less", `uiState.build` `attackValue`) are untouched.
6. No `.reduce()` in the sum; an explicit `for...of`.
7. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged. Never re-pin.
8. Existing tests: only the mandated drift pins. Anything else is STOP-and-report.

## Required Comments (`// why:`)

- The reduction term in each resolver: the single authority, so move, bot and projection agree.
- The 0 floor, and Patrol added after it.
- The lazy field in `carryConversionFlag`.
- Step 4c: the clause recognizer, kept separate from the D-24486 icon suppression.
- Fight-time space read: covers Villains that enter or move later this turn.

## Files to Produce

Exactly the WP-794 §Files Expected to Change allowlist. The generated artifacts change only on a real gate diff.

## After Completing

- Revert proofs 5/5: parse, handler, City term, Mastermind term, floor.
- Run `pnpm ledger:heroes:check`, `pnpm mechanics:metadata:check` and `pnpm sim:runtime-observed:check`; all are
  expected UNCHANGED. Run `pnpm effect-index`.
- Run `pnpm sim:coverage --update-baseline`. It is expected: `noEffect` drops for core, cvwr and dkcy. `--check`
  passes on a drop and won't force it. Name the per-set deltas in the commit body.
- Run `pnpm cards:check`.
- Land D-24663 in DECISIONS.md (the six points). Update STATUS. Flip the WORK_INDEX row and EC_INDEX → Done. Mindmap
  📝 → ✅, then `pnpm roadmap:counts:write` and `roadmap:counts:check`.
- D-24026 live-verify (operator): Lightning Bolt with a Rooftops Villain.

## Common Failure Smells

- Adding `fight-cost-reduction` to `NO_MAGNITUDE_KEYWORDS`. It has a magnitude; keep it out.
- Matching the regex against the raw line, so the `[hc:ranged]:` prefix defeats the Mastermind form.
- Storing the City index at play time, so a later-entering Rooftops Villain misses the reduction.
- A test asserts Tidal Wave idx1 is `gate-only`. That is STOP-and-report, not an edit.
- `runtime-observed-hollows.json` or the dashboard totalObs pin changes. Both are expected UNCHANGED (the sweep
  plays none of these heroes), so a diff means a leak: STOP. The `sim:coverage` baseline IS expected to change:
  `noEffect` drops for core, cvwr and dkcy. Update it and explain it.
- Expecting a `fight-cost-reduction` ledger row. There is none, because the lines carry no `[keyword:X]` token.
