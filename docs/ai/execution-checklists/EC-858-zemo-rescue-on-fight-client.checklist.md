# EC-858 — Baron Zemo rescue on a fight, client control (Execution Checklist)

**Source:** docs/ai/work-packets/WP-820-zemo-rescue-on-fight-client.md
**Layer:** App: arena-client

## Before Starting
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Re-run pre-flight (01.4) now: this packet was drafted BLOCKED on WP-819.
- [ ] WP-819 is merged: `UITurnEconomyState.rescueOnFightAvailable` exists in the built engine dist and `fightVillain` honours `payToRescueBystander`. If not, STOP.
- [ ] `CityRow.vue` still has `gateForCell`, `showEvFight`, `onFightEV` and the `play-city-villain-ev` button; `useCardCostGating.ts` still has `attackForTarget` and `canFightWithExcessiveViolence`.
- [ ] Note whether WP-817 has executed (`UICityCard.fightDiscardCosts` exists).
- [ ] `pnpm -r build` → 0; arena-client `typecheck` → 0 and `test` → 0 fail; record the test total.

## Locked Values (do not re-derive; verbatim from the WP)
**`composables/useCardCostGating.ts`:**
- `export const RESCUE_ON_FIGHT_RECRUIT_COST = 2;` (`// why:` mirrors the engine constant of the same name, WP-819; the client doesn't import engine internals.)
- `export function canFightAndRescue(cost: number | null, economy: UITurnEconomyState, target?: AttackTargetName): boolean`:
  1. `economy.rescueOnFightAvailable !== true` → `false`;
  2. `cost === null` → `false`;
  3. `economy.recruitSpendableAsAttack === true` → `attackForTarget(economy, target) >= cost + RESCUE_ON_FIGHT_RECRUIT_COST`;
  4. else `attackForTarget(economy, target) >= cost && economy.availableRecruit >= RESCUE_ON_FIGHT_RECRUIT_COST`.
- `useCardCostGating(economy)` also returns `canFightAndRescue: (cost, target) => canFightAndRescue(cost, economy, target)`.

**`components/play/CityRow.vue`:**
- `showRescueFight(cell)`: `cell.kind === 'slot' && cell.card !== null && gateForCell(cell).allowed && useCardCostGating(props.economy).canFightAndRescue(cell.card.fightCost, citySpaceNameForIndex(cell.cityIndex))`. If WP-817 has executed: `&& cell.card.fightDiscardCosts === undefined`.
- `onFightRescue(cityIndex)`: `props.submitMove('fightVillain', { cityIndex, payToRescueBystander: true })`.
- The template button, placed after the EV button and built the same way:
  - `v-if="showRescueFight(cell)"`, `type="button"`, `class="city-space__rescue-fight"`, `data-testid="play-city-villain-rescue"`, `:data-city-index="cell.cityIndex"`;
  - `title="Fight this Villain and pay 2 Recruit to rescue a Bystander (Baron Zemo)."`;
  - `@click="onFightRescue(cell.cityIndex)"`;
  - children: label `<span class="city-space__rescue-fight-label">Fight + Rescue</span>` and cost badge `<span class="city-space__rescue-fight-cost">2 Recruit</span>`.
- Scoped styles `.city-space__rescue-fight` / `-label` / `-cost` in the EV button's shape, coloured with the existing brand token `var(--la-color-recruit)` (`apps/arena-client/public/brand-tokens.local.css` ~L216 / ~L299, loaded in `index.html` ~L51); no new token.
- `setup()` returns `showRescueFight` and `onFightRescue`.

## Guardrails
- Additive only: `onFight`, `showEvFight`, `onFightEV` and the normal Fight button are unchanged (T6).
- The client sends intent; it never decides an outcome.
- No engine file, no new design token, no new composable file.
- No nested ternaries; JSDoc on every new function.

## Required `// why:` Comments
- `RESCUE_ON_FIGHT_RECRUIT_COST`: mirrors the WP-819 engine constant; the client doesn't import engine internals.
- `canFightAndRescue`'s conversion branch: under recruit-as-attack the fight can spend Recruit, so it needs `cost + 2` (D-24753); the engine stays the authority.
- `showRescueFight`: shown only from the engine cue + the Fight gate (WP-738 / D-24561 precedent).
- The WP-817 clause (if present): the Primus discard chooser must not be bypassed.

## Files to Produce
- `apps/arena-client/src/composables/useCardCostGating.ts` — **modified**; `useCardCostGating.test.ts` — **modified** (additions only)
- `apps/arena-client/src/components/play/CityRow.vue` — **modified**; `CityRow.test.ts` — **modified** (additions only)
- `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T6 and T6b pass (T7 too when WP-817 has executed). arena-client `typecheck` → 0, `test` → 0 fail. `pnpm -r build` → 0.
- [ ] Revert proofs observed (cue check dropped; conversion branch dropped; intent without `payToRescueBystander`).
- [ ] STATUS updated (the WP-819 + WP-820 live-verify, operator-pending). DECISIONS: no new entry (D-24753 via WP-819). WORK_INDEX `[x]` with date. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-858:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy, operator-seated, STATUS-flip.

## Common Failure Smells
- The button shows in a non-Zemo match → the cue check was skipped.
- The button shows but the engine logs `could not pay` under recruit-as-attack → the conversion branch is missing.
- The normal Fight starts paying → `onFight` was edited instead of adding `onFightRescue`.
- Clicking Fight + Rescue on Primus does nothing → the WP-817 clause was skipped after WP-817 executed (a request without `discardCardId` returns silently).
