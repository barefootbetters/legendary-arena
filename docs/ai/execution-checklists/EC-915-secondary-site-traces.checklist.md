# EC-915 — Deliberate-no-op villain primitives get a `secondary-site` trace at their bridge (Execution Checklist)

**Source:** docs/ai/work-packets/WP-877-secondary-site-traces.md
**Layer:** Game Engine only (`EffectTraceFireSite` union, one trace helper, five bridge call sites)
**Risk Tier:** LOW — inert, hash-excluded diagnostics; no gameplay, persistence, auth, money or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `24055308` with the reserve #3241 and the drafting PR merged (execution runs on a
      fresh branch, so the scope diff holds only execution files); `pnpm -r build && pnpm -r --no-bail test`
      exit 0; record every package's count and the game-engine `typecheck:tests` error count.
- [ ] Read the model: the Mystique secondary-site emission (`villainDeck/villainDeck.reveal.ts` ~l.756–772),
      `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` and `resolveVillainCardType` (`villain/villainEffects.execute.ts` ~l.848, ~l.478),
      `runVillainFightFireSiteBridges` (`moves/fightVillain.ts` ~l.925–998), the Ambush block (`villainDeck.reveal.ts` ~l.446–455).

## Locked Values (do not re-derive; verify at HEAD)
- `EFFECT_TRACE_FIRE_SITES` = `['villain-executor', 'hero-executor', 'hero-primitive', 'escape-scheme-twist',
  'villain-fight-bridge', 'villain-ambush-bridge']`; the union in the same order.
- Helper in `villain/villainEffects.execute.ts`: `export function recordVillainSecondarySiteTrace(G: LegendaryGameState,
  cardId: CardExtId, timing: VillainAbilityTiming, effect: 'play-villain-deck-cards' | 'reenter-sewers-if-villain-deck-top' |
  'stack-cards-enter-city-as-villains', handler: 'playTopVillainDeckCards' | 'reenterSewersOnVillainDeckReveal' |
  'enterStackCardsAsVillains', fireSite: 'villain-fight-bridge' | 'villain-ambush-bridge', params: Record<string, string |
  number | boolean>, turn: number): void`; `scope = resolveVillainCardType(G, cardId)`; `status = 'secondary-site'`;
  writes through `recordEffectTrace` only. Not re-exported from `index.ts`.
- Emissions (each immediately BEFORE the bridge call, inside its existing guard):
  - Fight play (after the `revealContext` build, immediately before `playTopVillainDeckCards`): `'onFight'`, `'play-villain-deck-cards'`, `'playTopVillainDeckCards'`, `'villain-fight-bridge'`,
    `{ magnitude: fightPlayCount }`, `readTurnNumber(ctx)`.
  - Fight reenter: `'onFight'`, `'reenter-sewers-if-villain-deck-top'`, `'reenterSewersOnVillainDeckReveal'`,
    `'villain-fight-bridge'`, `{}`, `readTurnNumber(ctx)`.
  - Fight stack: `'onFight'`, `'stack-cards-enter-city-as-villains'`, `'enterStackCardsAsVillains'`, `'villain-fight-bridge'`,
    `{ magnitude: fightStackEntry.count, stackVillainKind: fightStackEntry.kind }`, `readTurnNumber(ctx)`.
  - Ambush play: `'onAmbush'`, `'play-villain-deck-cards'`, `'playTopVillainDeckCards'`, `'villain-ambush-bridge'`,
    `{ magnitude: ambushPlayCount }`, `readRevealContextTurn(context)`.
  - Ambush stack: `'onAmbush'`, `'stack-cards-enter-city-as-villains'`, `'enterStackCardsAsVillains'`,
    `'villain-ambush-bridge'`, `{ magnitude: ambushStackEntry.count, stackVillainKind: ambushStackEntry.kind }`,
    `readRevealContextTurn(context)`.
- The `EffectTraceStatus` JSDoc names all five `no-op` primitives and the three bridged `secondary-site` primitives.
- Intentional test edits: `reenterSewers.test.ts` and `stackVillain.test.ts` "reads no-op, not fired" cases now expect two
  traces for the primitive: `no-op` / `villain-executor`, then `secondary-site` / `villain-fight-bridge`. The `stackVillain`
  case's no-hollow assertion stays.
- Drift test edits (`effectTrace.record.test.ts` ~l.112–137): expected list to six, two new `case` labels, title 4 → 6.
- New test file `villain/villainSecondarySiteTraces.test.ts`: one `describe`, exactly ten cases (WP Scope In 6), covering
  AC 2–8. The gated The Leader case uses the co2e `requireKind: 'hero-class', requireValue: 'strength'` shape; the Fight
  stack case uses a one-card stack and asserts `magnitude === 2` (marked count); the AC 6 case uses a synthetic
  henchman-classified card and holds the AC 9 invariant (G minus `diagnostics` deep-equal, messages unchanged, traces +1).
- If WP-874 (`charge`) merged first: the five-primitive counts become six, and `charge` goes under D-24824 §5 as a named, tracked exception.

## Guardrails
- Traces stay hash-excluded and inert: no move, rule, `endIf`, bot, scoring or PAR path reads them.
- Bridge behavior, log lines, narratives and event order are byte-identical; only `G.diagnostics.traces` gains entries.
- No hash, core sentinel or PAR pin moves (a moved pin is a STOP).
- The executor trace and `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` membership are unchanged.
- No secondary trace when a bridge does not run (play count 0, null lookup).
- Nothing throws; no `ctx.random`, clock or I/O; `params` holds only numbers and string literals.
- Engine only; no `boardgame.io` import added; `index.ts` unmodified.
- No `.reduce()`, no nested ternaries; JSDoc on the helper; full-sentence comments.

## Required `// why:` Comments
- The two new fire-site members (where the work ran; `effect` says what ran).
- Each of the five emissions: why it runs before the bridge (cause before consequence) and why it sits inside the guard.
- The helper: why `scope` reuses the executor's resolution, and the Mystique precedent.
- The `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` comment: the three bridged primitives also emit a secondary trace.
- Each edited test case: the intentional behavior change (WP-877 / D-24824).

## Files to Produce
- Engine (**modified**): `packages/game-engine/src/diagnostics/hollowEffect.types.ts`, `villain/villainEffects.execute.ts`,
  `moves/fightVillain.ts`, `villainDeck/villainDeck.reveal.ts`.
- Tests: **modified** `diagnostics/effectTrace.record.test.ts`, `villain/reenterSewers.test.ts`, `villain/stackVillain.test.ts`;
  **new** `villain/villainSecondarySiteTraces.test.ts`.
- Close: `docs/ai/DECISIONS.md` (D-24824; annotate D-24811 §3's "No secondary-site trace" sentence as superseded), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`,
  the WP file (execution amendment only).

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail everywhere; game-engine `typecheck:tests` adds no error in touched files.
- [ ] `git diff --name-only origin/main...HEAD` ⊆ Files to Produce.
- [ ] `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `roadmap:counts:check` 0.
- [ ] D-24824 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write`; ledger LANDED;
      D-24026 live check operator-pending in STATUS.
- [ ] Live (D-24026): WP Verification Step 5 confirmed on a post-deploy match (`isMatchOlderThanServer: false`), evidence
      in the PR; until then recorded operator-pending in STATUS.

## Common Failure Smells
- The drift test fails: the union and the array were updated in different orders.
- A behavior test's trace count jumps by one in an unlisted file: it filtered by `effect` and now sees the secondary trace.
  STOP and add it to scope as an intentional change, or narrow its filter to `fireSite: 'villain-executor'`.
- The secondary trace comes after the played cards' traces: the call sits after the bridge, not before.
- A gated The Leader logs a secondary trace: the call sits outside the `ambushPlayCount > 0` guard.
