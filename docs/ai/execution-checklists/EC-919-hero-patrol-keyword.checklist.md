# EC-919 — Hero Patrol keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-881-hero-patrol-keyword.md
**Layer:** Game Engine + Card Data
**Risk Tier:** MEDIUM — gameplay rules (two new hero conditions, a setup-parser line form) plus card data and derived feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3269 (the reserve) and the WP-881 draft SPEC.
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green (6853 / 0 at draft). `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors unchanged (`heroAbility.setup.ts`): `KEYWORD_PATTERN` `:152`, `ATTACK_RESTRICTION_CLAUSE_PATTERN` `:512`, `parseAbilityText` `:1209`, `collectUnmatchedKeywordSlugs` `:3184`, `splitFeastThenTransformLine` `:3719`, `buildHeroAbilityHooks` `:4650`, Heist consume block `:4792`.
- [ ] Anchors unchanged elsewhere: `evaluateCondition` `:131` / `describeFailedCondition` `:904` / `SEQUENCE_GATE` `:1067` (`heroConditions.evaluate.ts`); `WAIT_AND_SEE` `deferredConditionalGrants.ts:79`; `isCountableConditionalClause` `:1000` / `recordConditionalClause` `:1109` / `countSynergyConditions` `:1494` / `detectHollowHeroHook` `:1542` (`heroEffects.execute.ts`); marker append `apply-hero-ability-markers.mjs:441`; ledger `KNOWN_CONDITIONS` `:183` / hook loop `:610`.
- [ ] Re-grep `usable only to fight` across `data/cards/*.json` → only `mdns` Seal the Rift.
- [ ] Scope lock: the target file set is exactly §Files to Produce below; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

**Conditions**
- `{type:'patrolSpaceEmpty', value:<CitySpaceName>}` / `{type:'patrolSpaceOccupied', value:<CitySpaceName>}`, written only via the exported `PATROL_SPACE_EMPTY_CONDITION_TYPE` / `PATROL_SPACE_OCCUPIED_CONDITION_TYPE` (`heroConditions.evaluate.ts`) in parser, evaluator, describer, Synergy code and ledger.
- Index = `CITY_SPACE_NAMES.indexOf(value)`. Unknown value, non-array `G.city`, or index `>= G.city.length` → **both false**. Else empty ⇔ `G.city[index] === null`, occupied ⇔ `!== null`.
- Describe: empty-fail `"there's a card in the <Space>"` / occupied-fail `"nothing is in the <Space>"` / missing → `"there is no <Space> in the City"`.
- Not in `WAIT_AND_SEE_CONDITION_TYPES`, not in `SEQUENCE_GATE_CONDITION_TYPES`; excluded from `countSynergyConditions`.
- A hook whose Patrol condition fails on this play is NOT a countable Synergy clause: at `isCountableConditionalClause`, require every Patrol-type condition to pass `evaluateCondition` directly (never via `findFailedCondition`, which returns the first failure). Axe of the Slayer: with instinct 1 assembled / 0 misses; without, 1 miss (either Streets state). Up to 3 blocked log lines without instinct is accepted (D-24832).

**Parser**
- Patrol line = optional `[hc:X]`/`[team:X]` gate prefix, then a leading `[keyword:Patrol <target>]`. Consumed at its own line index; `previousLineHook = null` after.
- Named target `the Sewers|Bank|Rooftops|Streets|Bridge` → split at `If it's not,` (straight or curly `'`); empty body = after `If it's empty,`; trailing curated markers are stripped BEFORE the split and appended to the **empty** branch (the `$`-anchored restriction clause would swallow them). Each branch = `parseAbilityText(<gate prefix> + <body>)` + its Patrol condition appended after gate conditions; `onPlay`.
- A branch that resolves nothing records the line's `collectUnmatchedKeywordSlugs` slug (`patrol-the-*`) as its unresolved marker.
- Other target → one hook: gate conditions (+ `conditional`) only, no effects, the slug as unresolved marker.
- `PATROL_BOTH_CARDS = { 'mdns/elsa-bloodstone/axe-of-the-slayer' }`: its "Instead, you get both." line → (gate ∧ occupied) → empty branch body; (gate ∧ empty) → occupied branch body.
- `ATTACK_RESTRICTION_CLAUSE_PATTERN = /,?\s*usable only (?:against|to fight) (.+?)\.?$/i`.

**Markers, ledger**
- Card Map (12 tokens, `apply-hero-ability-markers.mjs` NOT modified; lift the Blade Hunt High and Low ability-0 `_deferred` entry):
  - mdns `blade-daywalker/hunt-high-and-low`[0] `[keyword:reveal-top-may-ko]`; `blade-daywalker/where-monsters-lurk`[0] `[keyword:draw:1]`
  - mdns `wong-master-of-the-mystic-arts/bridge-between-dimensions`[0] `[keyword:draw:1]`; `…/seal-the-rift`[0] `[keyword:draw:2]`
  - ssw2 `agent-venom/big-slimeportunity`[1] `[keyword:draw:1]`; `captain-and-the-devil-the/feeding-grounds`[0] `[keyword:optional-ko-hand-discard]`
  - ssw2 `dr-punisher-soldier-supreme/sweep-the-streets-of-trash`[0] `[keyword:draw:1]`; `elsa-bloodstone/monster-hunter`[0] `[keyword:rescue:1]`
  - ssw2 `spider-gwen/fateful-bridge`[0] `[keyword:reveal:2]`; `spider-gwen/save-the-day`[0] `[keyword:rescue:1]` then `[keyword:attack-per-count:victory-bystanders:1:2]`
  - ssw2 `time-traveling-jean-grey/bridge-to-a-better-future`[0] `[keyword:next-hand-extra-draw:1]`
- `KNOWN_CONDITIONS['patrol'] = 'patrolSpaceEmpty'`, classified BY HOOK (`condition` only when a hero's hooks carry a Patrol condition, else `unsupported` — Corvus Glaive, Beast), checked BEFORE `statusForMechanic`'s by-name return (`:404`).
- Restriction widen amends D-24652 §4 (Seal the Rift); rewrite the `heroAbility.setup.ts:509-510` comment.
- `mechanic-provenance.json`: `patrol → WP-881 / D-24832`. `live-verify.json`: `pending` rows `mdns/wong-master-of-the-mystic-arts|patrol`, `mdns/elsa-bloodstone|patrol`.

## Guardrails
- No Patrol line grants anything ungated. Assert Axe of the Slayer no longer gives both +2s without instinct, and Seek the Empty Mind gives nothing.
- Read emptiness per hook as it resolves; never cache per card or per turn.
- Do not touch `HERO_KEYWORDS`, handlers, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` or any count pin; do not touch `board/boardKeywords.*` (D-2502 is a different mechanic).
- The `:2058` fail-closed test migrates (Seal the Rift now restricted under `patrolSpaceOccupied`); no other existing assertion is edited to go green.
- Marker edits change only `abilities[i]` text. Regenerate and commit every derived feed; re-pin the dashboard `totalObs`. Revert `lagn-v1.json` CRLF churn.
- Patrol hooks use the loop's omit-when-empty construction (`:4859-4900`); a hook with ≥1 condition carries `conditional` once; every hook is its own `parseAbilityText` result (no shared arrays / condition objects across hooks or instances, D-13502 — asserted for Axe of the Slayer).
- `heroPatrol.test.ts` builds hooks with `buildHeroAbilityHooks` from the regenerated card data, never hand-written hooks.
- No villain / bystander Patrol, no UIState field, no client work.
- Moves and effects never throw. No `.reduce()` for branching.

## Required `// why:` Comments
- Evaluate cases: rules v23 ~L1772-1780; a removed space (D-24764) fails both; Locations are not in `G.city` (~L2486).
- Not wait-and-see: "becomes empty later in the turn, it's too late".
- Synergy exclusion + failed-Patrol clause rule: board state, not a built synergy (D-24598 sibling); the Axe cross hooks would otherwise log a guaranteed miss.
- Patrol line consume: the Heist / WP-859 split precedents; AND-only conditions are why a two-branch line is two hooks.
- Trailing markers → empty branch.
- Other-target / unmodelled branches: honest hollows, grants dropped (D-24570 sibling).
- `PATROL_BOTH_CARDS`: the cross-hook shape gives both branches under the gate.
- Restriction widen: Seal the Rift's printed "to fight" wording.

## Files to Produce
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/hero/heroPatrol.test.ts` — **new**
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — **modified**
- `data/cards/mdns.json`, `data/cards/ssw2.json` — **regenerated**
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**; `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` — **only if their gates flag**
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **`totalObs` re-pin**
- `docs/ai/DECISIONS.md` (D-24832), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Markers idempotent; `--validate` 0.
- [ ] Eight gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`, `sim:coverage`, `ledger:numbers`); `patrol-*` runtime hits only on honest-hollow lines.
- [ ] Engine suite passes; `pnpm -r --no-bail test` → 0 fail; dashboard `typecheck` → 0; core oracles unchanged.
- [ ] Ledger JSON: `patrol` = `unsupported` for ssw2 Corvus Glaive and Beast, `condition` for mdns Wong.
- [ ] D-24832 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match.

## Common Failure Smells
- Axe of the Slayer still gives +2 / +2 → the Patrol block runs after the generic parse, or the occupied branch lost its condition.
- Bridge Between Dimensions still hollow with the Bridge empty → marker missing, or the trailing marker went to no branch.
- Seal the Rift's +5 is spendable on the Mastermind → the restriction pattern still reads only "against".
- Both branches fire in a 3-space City → the length check is missing.
- The Synergy Rate logs a miss on every two-branch play, or Axe logs a miss with instinct → Patrol types not excluded, or a failed-Patrol hook still counts as a clause.
- Corvus Glaive / Beast read `condition` in the ledger → `patrol` classified by name, not by hook.
- A Patrol branch fires late after a fight empties the space → the type was added to `WAIT_AND_SEE`.
