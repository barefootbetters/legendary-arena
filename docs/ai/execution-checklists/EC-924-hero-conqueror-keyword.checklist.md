# EC-924 — Hero Conqueror keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-886-hero-conqueror-keyword.md
**Layer:** Game Engine + Card Data
**Risk Tier:** MEDIUM — gameplay rules (one new hero condition, a setup-parser line form) plus card data and derived feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3293 (the reserve) and the WP-886 draft SPEC.
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green: `pnpm --filter @legendary-arena/game-engine test` → 6930 / 0 at draft. `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors unchanged (`heroAbility.setup.ts`): Patrol imports `:51-52`, `PATROL_LINE_PATTERN` `:909`, `collectUnmatchedKeywordSlugs` `:3283`, `buildPatrolBranchHook` `:4837`, `buildHeroAbilityHooks` `:4948`, Patrol consume block `:5106`.
- [ ] Anchors unchanged elsewhere: `PATROL_SPACE_OCCUPIED_CONDITION_TYPE` `:72` / `patrolSpaceIndex` `:91` / `evaluateCondition` `:186` / `describeFailedCondition` `:978` / Patrol describe cases `:1119-1122` (`heroConditions.evaluate.ts`); `isCountableConditionalClause` `:1017-1020` / `countSynergyConditions` `:1513` / `allPatrolConditionsPass` `:1543` (`heroEffects.execute.ts`); ledger `KNOWN_CONDITIONS` `:192` / `patrolStatusForHooks` `:332` / per-hook check `:601`.
- [ ] Re-grep `Conqueror` in `scripts/convert-cards/inputs/patches/{anni,asrd}.patch.json` and `data/cards/amwp.json`: the Card Map lines still read as WP §Assumes 5.
- [ ] Scope lock: the target file set is exactly §Files to Produce below; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

**Condition**
- `{type:'conquerorSpaceHasVillain', value:<CitySpaceName>}`, written only via the exported `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` (`heroConditions.evaluate.ts`, beside the Patrol pair) in parser, evaluator, describer, Synergy code and ledger.
- `index = patrolSpaceIndex(G, value)`; true ⇔ `index !== -1 && G.city[index] !== null`.
- Describe: missing space `"there is no <Space> in the City"`; else `"no Villain is in the <Space>"`, in a new `describeFailedConquerorCondition` (`describeFailedPatrolCondition` unchanged). Logs use the multi-hook phrase "… did not activate one of its abilities — …" (`heroEffects.execute.ts:1163`); tests assert the reason substring.
- Not in `WAIT_AND_SEE_CONDITION_TYPES`, not in `SEQUENCE_GATE_CONDITION_TYPES`; excluded from `countSynergyConditions`.
- `allPatrolConditionsPass` → `allCitySpaceConditionsPass` (one caller, `:1020`): also requires every Conqueror condition to pass `evaluateCondition` directly. Rock Solid after a Strength Hero: Sewers occupied → 1 assembled; empty → 0 / 0; occupied without a Strength Hero → 1 missed. Transparent Motives / Volstagg base with the space occupied → 0 played / 0 assembled. Extends D-24832's clause rule (say so in D-24837 and the `:1013-1016` comment).

**Parser**
- `CONQUEROR_LINE_PATTERN = /^\s*((?:\[(?:hc|team):[^\]]+\]\s*)*:?)\s*(Instead,\s*)?\[keyword:(Sewers|Bank|Rooftops|Streets|Bridge)\s+Conqueror\s+(\d+)\]\.?\s*$/i` (non-global). Checked after the Patrol blocks; consumed at its own line index; `previousLineHook = null` after.
- Base line → `` buildPatrolBranchHook(instance.extId, gatePrefix, 'You get +N[icon:attack].', CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value, `${value}-conqueror`) ``; `value` = group 3 lower-cased (a `CITY_SPACE_NAMES` member); builder reused unchanged.
- Instead line → base B = first same-space line with no gate and no "Instead,"; if found and N > B, body `You get +(N−B)[icon:attack].`; else an honest hollow in the `buildPatrolLineHooks` other-target shape (`:4874-4882`: `conditions` + `['conditional']` only when the gate parses to ≥1 condition, else `keywords: []`; no effects; marker `<value>-conqueror`).
- Lines with other text take the generic parse and stay hollow, recording: Put to the Torch 2 `['rooftops-conqueror']`, Stardust 0 `['focus']` (the D-24623 fallback skips unmatched slugs once `focus` is recorded), Dragonfang 0 `['thrown-artifact','sewers-conqueror']`. No parser change for them.

**Card data (13 lines; canonical `[keyword:<Space> Conqueror N]`)**
- `anni.patch.json`: Stardust 0 `[keyword:Focus] 4[icon:recruit] [icon:5] [keyword:Rooftops Conqueror 4]`; Rock Solid 0 `[hc:strength]: [keyword:Sewers Conqueror 1]`; Transparent Motives 0 `[keyword:Bank Conqueror 1]`; Put to the Torch 0 `[keyword:Bridge Conqueror 1]`, 1 `[keyword:Streets Conqueror 1]`, 2 `You may gain a Wound. If you do, you get [keyword:Rooftops Conqueror 4].`
- `asrd.patch.json`: Flying Stallion 0 `[keyword:Rooftops Conqueror 1]` (card + upstream; the patch had Streets); Ride of the Valkyries 0 `[keyword:Streets Conqueror 1]`; Usher to Valhalla 0 `[keyword:Bridge Conqueror 1]`; Volstagg 0 `[keyword:Bridge Conqueror 1]`, 1 `[hc:instinct]: Instead, [keyword:Bridge Conqueror 3]`. Villain lines untouched.
- `data/cards/amwp.json`: Steel Warrior 0 `[keyword:Streets Conqueror 1]`; Xolum 0 `[keyword:Bridge Conqueror 1]`.

**Ledger, records**
- `KNOWN_CONDITIONS['conqueror'] = CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` (dist import); classified BY HOOK via `conquerorStatusForHooks`, checked before `statusForMechanic`.
- `mechanic-provenance.json`: `conqueror → WP-886 / D-24837`. `live-verify.json`: `pending` rows `anni/super-skrull|conqueror`, `asrd/warriors-three-the|conqueror`.

## Guardrails
- No Conqueror line grants anything ungated by its space; Put to the Torch line 2 never grants +4.
- Read the space per hook as it resolves; never cache; never wait-and-see; never claw back.
- Do not touch `HERO_KEYWORDS`, handlers, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, any count pin, the `buildPatrolBranchHook` / `patrolSpaceIndex` bodies, or Patrol behavior (Axe of the Slayer Synergy expectations still pass unedited).
- `data/cards/anni.json` / `asrd.json` come from the pipeline, never hand edits; the `data/cards` content diff is exactly the 13 lines. Revert EOL-only churn in other sets and `lagn-v1.json`.
- No aliasing (D-13502): every hook is its own `parseAbilityText` result; assert Volstagg's two hooks and copies `#0` / `#1` share no `conditions` / `effects` array.
- Edit `scripts/hero-mechanic-ledger.mjs` with targeted edits only (it holds NUL-byte sort separators at `:613-614`); `git diff` shows no change there. Do not edit the amwp patch files (their `abilities` are inert, `apply-card-counts.mjs:313-345`).
- `heroConqueror.test.ts` builds hooks with `buildHeroAbilityHooks` from the committed card data, never hand-written hooks.
- No existing assertion is edited to go green. No UIState field, no villain-side Conqueror, no `gain-wound-reward` change.
- Moves and effects never throw. No `.reduce()` for branching.

## Required `// why:` Comments
- Evaluate case: rules v23 L1157-1159 (the hero "if"), L1481-1485 (a destroyed / removed space fails, D-24764); every `G.city` occupant is a Villain (WP §Assumes 4 writer list); not wait-and-see.
- Synergy exclusion and the clause-rule rename: board state, not a built synergy (D-24832 sibling).
- Conqueror consume block: the Patrol / Heist consume-at-own-index precedent; why the builder is reused; the Instead delta.
- The constant: why a type distinct from `patrolSpaceOccupied` (Firelord follow-up, ledger).

## Files to Produce
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/hero/heroConqueror.test.ts` — **new**
- `scripts/convert-cards/inputs/patches/anni.patch.json`, `scripts/convert-cards/inputs/patches/asrd.patch.json`, `data/cards/amwp.json` — **modified**; `data/cards/anni.json`, `data/cards/asrd.json` — **regenerated**
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — **modified**
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**; `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **only if their gates flag**
- `docs/ai/DECISIONS.md` (D-24837), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Pipeline re-run → no further `data/cards` change.
- [ ] Ten gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `ledger:villains`, `registry:validate`, `sim:runtime-observed`, `sim:coverage`, `ledger:numbers`); no `bridge-conqueror` / `streets-conqueror` / `bank-conqueror` runtime hits; before / after hitCounts in the `EC-924:` body.
- [ ] `pnpm --filter @legendary-arena/game-engine test` → 0 fail (new cases included); `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0; core `finalStateHash` unchanged.
- [ ] Ledger: `conqueror` = `condition` for the six heroes; zero `bridge` / `streets` / `rooftops` rows.
- [ ] D-24837 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `pnpm roadmap:counts:write` then `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match. Operator `pnpm metadata:upload` for the card viewer (pending in STATUS).

## Common Failure Smells
- Put to the Torch gives +4 on every play → line 2 matched the Conqueror pattern (the pattern lost its `^…$` anchors).
- Conqueror lines still hollow → the consume block runs after the generic parse, or the regex lost its backslashes.
- Volstagg gives +4 with instinct → the Instead line granted its printed 3 instead of the delta.
- A Conqueror card logs a Synergy miss with its space empty → the clause rule does not cover the new type.
- The Bridge bonus fires in a 3-space City → the evaluator skipped `patrolSpaceIndex`.
- Flying Stallion fires on the Streets → the patch line kept its old Streets text.
- `cards:check` fails → `anni.json` / `asrd.json` were hand-edited instead of regenerated.
