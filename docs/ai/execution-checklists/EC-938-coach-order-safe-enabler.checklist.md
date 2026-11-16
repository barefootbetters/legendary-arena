# EC-938 — The coach's play-order tip never moves an order-dependent card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-900-coach-order-safe-enabler.md
**Risk Tier:** LOW — a paid-feature advice text narrows (fewer tips, never different ones); no `G` write, gameplay rule, hash, card data, client, auth, money or persistence change; reports already cached keep their tips
**Layer:** Server (sequence teacher) + one Runtime-Safe engine export

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reserve PR #3424 merged; `pnpm -r build`, then `pnpm -r --no-bail test` exit 0 (record the engine and server counts).
- [ ] Re-read at HEAD every anchor in WP `## Assumes`: teacher ~45-66 / ~186-210, `WAIT_AND_SEE_CONDITION_TYPES` (13
      members), `PLAY_HISTORY_CONDITION_TYPES` (4), `SEQUENCE_GATE_CONDITION_TYPES` (3), `index.ts` ~314-324.
- [ ] The eleven test cards in WP `## Assumes` parse to the listed hooks at HEAD. A difference is a STOP.

## Locked Values (do not re-derive; verify at HEAD)
- **New module:** `packages/game-engine/src/hero/orderSafeEnabler.ts`; imports `WAIT_AND_SEE_CONDITION_TYPES` from
  `./deferredConditionalGrants.js` and types (`HeroAbilityHook`, `HeroEffectDescriptor`, `HeroCondition` as needed)
  from `../rules/heroAbility.types.js`; nothing else.
- **Allowlist:** `export const ORDER_SAFE_ENABLER_CONDITION_TYPES: readonly string[] = [...WAIT_AND_SEE_CONDITION_TYPES,
  'firstHeroPlayedThisTurn']`.
- **Predicate:** `export function isOrderSafeEnablerHook(hook: HeroAbilityHook): boolean` returns `false` when any
  `hook.conditions` type is not in the allowlist, `(hook.primitiveEffects ?? []).length > 0`, or any `hook.effects` entry
  fails the module-private recursive `isOrderSafeEffect(effect)`; else `true`. `hook.timing` is ignored (JSDoc says so).
- **`isOrderSafeEffect` is `false` when:** `countSource !== undefined`; a `countScaledChoiceOptions` entry has
  `kind === 'count-scaled'`; `bothCondition` exists with a type not in the allowlist; an
  `attackRestriction.widenToMastermindWhen` entry has a type not in the allowlist; `digestThreshold !== undefined`;
  `empoweredClass !== undefined`; `(empoweredClasses ?? []).length > 0`; `(sunlightEffects ?? []).length > 0` or
  `(moonlightEffects ?? []).length > 0`; `rewardComposition !== undefined`; `nonGreyHeroKoAttack !== undefined`; `type === 'no-more-draws'`; or any entry of `digestEffects`, `indigestionEffects`, `excessiveViolenceEffects`,
  `heistEffects` fails it. Else `true`. Split: `effectReadsResolveTimeState(effect)` (count, Digest, Empowered, day / night,
  reward composition, deck-KO count, `no-more-draws`), `effectHasUnsafeCondition(effect)` (`bothCondition`,
  `widenToMastermindWhen`), `nestedEffectsAreOrderSafe(effect)` (the four arrays); each <= ~30 lines with JSDoc.
- **Classification tables (module-private):** `EFFECT_FIELD_ORDER_SAFETY: Record<keyof Required<HeroEffectDescriptor>,
  'safe' | 'rejected' | 'recursed'>` and `HOOK_FIELD_ORDER_SAFETY: Record<keyof Required<HeroAbilityHook>, ...>`; every
  field rejected or recursed above is marked so; all others `'safe'`. The keyset test may read them through one named
  export `ORDER_SAFETY_FIELD_TABLES` from the module, never re-exported from `index.ts`.
- **Barrel:** both exported from `packages/game-engine/src/index.ts` in a new `export { … } from "./hero/orderSafeEnabler.js";`
  beside the `heroConditions.evaluate.js` block.
- **Server:** `isUnconditionalEnabler` → `isOrderSafeEnabler(finalState, cardId)`, `false` when any
  `getHooksForCard(finalState.heroAbilityHooks, cardId)` hook fails `isOrderSafeEnablerHook`; no heroAbilityHooks → `true`
  (unchanged). `findUnconditionalEnabler` → `findOrderSafeEnabler` (rename only). Whiff detection unchanged.
- **Server test cards (first copy `#0`, class = the card's `hc`, team = the hero's `team`):** no tip for
  `ca75/winter-soldier/kgb-training`, `vill/dr-octopus/eighth-times-a-charm`, `ff04/invisible-woman/four-of-a-kind`,
  `mdns/blade-daywalker/hunt-high-and-low`, `ca75/captain-america-falcon/winged-salvation`, `core/deadpool/oddball`,
  `xmen/legion/bend-steel`, `vnom/venom/devouring-drool`, `vnom/venompool/shenanigans`; one tip for `core/thor/surge-of-power` and
  `dkcy/elektra/first-strike`. Each case sets `cardDisplayData[<id>#0] = { name: <displayName> }`; each no-tip case also re-runs with the
  real card's hooks removed and asserts exactly one tip (in-file control).
- **AC 3 fixtures:** baseline (no conditions, one flat `attack`) plus exactly one rejecting field; nested fixtures use an
  otherwise-clean outer effect. The `false` cases are a test-local record keyed by field name; the keyset test asserts every
  `'rejected'` / `'recursed'` table key has an entry. `type` is `'safe'`; `no-more-draws` is a keyword-keyed case outside it.
- **Residual probe:** a throwaway script (not committed, deleted after) applies `isOrderSafeEnablerHook` to every hero
  card's first-copy hooks (`buildHeroAbilityHooks` per hero over `data/cards`) and counts effect `type` by passing card;
  record keyword + card count in the `EC-938:` body and D-24857.
- **Drift pin:** an explicit 14-literal array in the test (the 13 wait-and-see literals in array order, then
  `'firstHeroPlayedThisTurn'`), never `[...WAIT_AND_SEE_CONDITION_TYPES, …]`.
- **Test data path:** `join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards', `${abbr}.json`)`
  (the `hero/firstCardPlayed.test.ts` reader); the registry reader is `{ listCards: () => [], getSet }`.

## Guardrails
- The engine module is pure: no `boardgame.io`, registry, I/O or `G`; no `evaluateCondition` case, wait-and-see member or hash changes.
- The server keeps no condition-type or count-source literal for the enabler rule.
- The 13 existing `computeSequenceTips` tests pass unedited; no assertion weakened or skipped.
- Every real-card case asserts the card's hooks carry the expected condition type or structure before asserting no tip.
- Tip wording, the whiff side and `coach.logic.ts` are untouched.
- A moved hash pin or golden is a STOP.

## Required `// why:` Comments
- `// why: WP-900 / D-24857` on: the allowlist (why each family is order-safe), the predicate's primitive rejection, each
  `isOrderSafeEffect` rejection family and its recursion, the server `isOrderSafeEnabler` (replacing the stale `playedThisTurn` sentence), and the test file's
  real-data reader.

## Files to Produce
- `packages/game-engine/src/hero/orderSafeEnabler.ts` — new
- `packages/game-engine/src/hero/orderSafeEnabler.test.ts` — new
- `packages/game-engine/src/index.ts` — modified (exports)
- `apps/server/src/coach/sequenceTeacher.logic.ts` — modified
- `apps/server/src/coach/sequenceTeacher.logic.test.ts` — modified (new cases only)
- Governance: DECISIONS (D-24857), STATUS, WORK_INDEX, EC_INDEX, the roadmap mindmap, NUMBER-LEDGER, the 01.6 post-mortem,
  `live-verify.json` only if a row is recorded

## After Completing
- [ ] WP Acceptance Criteria 1-8 hold, including the revert proof (AC 7); command tails recorded in the `EC-938:` body.
- [ ] `SPEC:` close: D-24857 Active, STATUS entry, WORK_INDEX `[x]` + live-verify token, EC_INDEX Done, mindmap ✅ +
      `roadmap:counts:write` + `roadmap:counts:check`, NUMBER-LEDGER LANDED, 01.6 post-mortem.
- [ ] Live-verify run, or `n/a` proposed to Jeff with the reason.

## Common Failure Smells
- A no-tip case still tips: the server still checks `SEQUENCE_GATE_CONDITION_TYPES`, or a hook loop returns early on the first safe hook.
- A control yields no tip: the whiff card's gate class differs from the real card's `hc`, or `cardTraits` lacks the real card id.
- `orderSafeEnabler.ts` reads `undefined` for the wait-and-see array: it was placed in `heroConditions.evaluate.ts` (import cycle).
- A case passes vacuously: the real card's hooks changed and the structure assertion was skipped.
