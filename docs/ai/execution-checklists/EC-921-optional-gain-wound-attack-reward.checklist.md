# EC-921 — Optional gain-a-Wound → Attack reward keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-883-optional-gain-wound-attack-reward.md
**Layer:** Game Engine + Card Data + arena-client (one heading)
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword, one seat-choice kind, a reward that follows Diving Block / Flying Shield Block outcomes) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3278 (the reserve) and the WP-883 draft SPEC.
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green (6884 / 0 at draft). `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors (`heroAbility.setup.ts`): `KO_WOUND_REWARD_PATTERN` `:322`, `KO_WOUND_REWARD_SEEDED_REWARDS` `:480`, Step 2f `:2240`, reward-icon suppression `:2591`, descriptor arm `:2812`, `DAY_NIGHT_UNMODELED_LINES` `:968` (Scalded `:972`).
- [ ] Anchors elsewhere: `heroEffects.execute.ts` `HANDLED_KEYWORDS` `:165` / `NO_MAGNITUDE_KEYWORDS` `:588` / `heroEffectRandomActs` `:4611` / `HERO_EFFECT_HANDLERS` `:7565`; `wounds.logic.ts` `gainWoundWithOutcome` `:125`; `divingBlock.logic.ts` `:186` / `:310` / `:360`; `flyingShieldBlock.logic.ts` `:154` / `:196` / `:301` / `:340` / `:368`; `seatChoice.resolve.ts` `applySeatChoiceByKind` `:600`; `ai.seatChoice.ts` `chooseByKind` `:110`; `types.ts` `:1543` / `:1788` / `:1805`; `PendingSeatChoicePrompt.vue` `heading()` `:88`.
- [ ] Read the CURRENT count pins (98 keywords / 77 handlers at draft); a keyword WP landing first moves them. The intent (+1 each) governs, not the literal.
- [ ] Re-grep `gain a Wound. If you do, you get` across `data/cards/*.json` → only co2e Hulk Smash! and mdns Scalded by Sunlight.
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

**Keyword + parser**
- `HeroKeyword` `'gain-wound-reward'` appended last (union + `HERO_KEYWORDS`); in `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS`; NOT in `NO_MAGNITUDE_KEYWORDS`.
- `GAIN_WOUND_REWARD_PATTERN = /\[keyword:gain-wound-reward:([a-z][a-z-]*):(\d+)\]/g`; `GAIN_WOUND_REWARD_SEEDED_REWARDS = { 'attack' }` (parser copy + logic-module copy). Descriptor `{ type: 'gain-wound-reward', magnitude: n, rewardType: 'attack' }` only when seeded and `n >= 1`.
- Reward-icon suppression on the line (D-24570 sibling): drop the plain `attack` keyword + magnitude.
- `DAY_NIGHT_UNMODELED_LINES` loses exactly `'mdns/morbius/scalded-by-sunlight:sunlight'` (8 → 7; fix the comment).
- Validator alternative `^\[keyword:gain-wound-reward:[a-z][a-z-]*:[1-9]\d*\]$` (+ error-message list).
- Card Map: `co2e/hulk/hulk-smash`[0] `[keyword:gain-wound-reward:attack:5]`; `mdns/morbius/scalded-by-sunlight`[0] `[keyword:gain-wound-reward:attack:2]`.

**Choice + reward (`hero/gainWoundReward.logic.ts`)**
- `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND = 'gain-wound-reward'`; option 0 `Gain a Wound: you get +N Attack`, option 1 `Don't gain a Wound`; `defaultOptionIndex` 1; one addressed seat; `parkSeatChoice(G, undefined, …)`.
- `GainWoundAttackReward { attack: number; sourceCardId: CardExtId }` on `PendingSeatChoice.gainWoundReward?`, `PendingDivingBlockWound.woundAttackReward?`, `PendingFlyingShieldBlockWound.woundAttackReward?` (never projected).
- Handler order: unseeded / magnitude < 1 → logged skip; empty supply → L2, no prompt; `G.pendingSeatChoice` open → L9; else park + L1.
- Apply: decline → L3. Gain → note the Flying Shield Block queue length, call `gainWoundWithOutcome`:
  - `'no-wound'` → L6, no reward;
  - otherwise `woundsDrawn += 1`;
  - `'diving-block-pending'` → tag the seat's last Diving Block entry, L5;
  - `'gained'` with a grown Flying Shield Block queue → tag its last entry, L5;
  - else grant now (L4).
- Grant = `addResources(G.turnEconomy, attack, 0)` + L4 / L7.
- Keep or forfeit:
  - Diving Block reveal on a tagged entry → L8. Decline → move the tag to the Flying Shield Block entry `checkFlyingShieldBlock` parked, else grant (L7).
  - Flying Shield Block reveal → L8. Final decline and `dropUninterceptableWounds` → grant (L7).
- Bot (playing seat):
  - `gain-wound-reward` → 0 iff `fightVillain` + `fightMastermind` legal-move count with `attack + N` exceeds the count without (open choice set aside), else 1.
  - `diving-block` / `flying-shield-block` → decline (1) on a tagged entry.
  - Autoplay / sim / PAR keep the default.
- Client heading `'Gain a Wound for extra Attack?'`.

**Log lines (verbatim; `{card}` = `formatCardRef(G.cardDisplayData, sourceCardId)`)**
- L1 `Player {p} may gain a Wound for +{N} Attack ({card}).` · L2 `Player {p}'s {card} did nothing — the Wound supply is empty.` · L3 `Player {p} chose not to gain a Wound ({card}).`
- L4 `Player {p} gained a Wound and got +{N} Attack ({card}).` · L5 `Player {p} would gain a Wound — +{N} Attack if they keep it ({card}).` · L6 `Player {p} could not gain a Wound — the Wound supply is empty, so no Attack ({card}).`
- L7 `Player {p} kept the Wound and got +{N} Attack ({card}).` · L8 `Player {p}'s Wound was prevented, so no +{N} Attack ({card}).` · L9 `Player {p}'s {card} could not offer its Wound choice — another choice is open.`

## Guardrails
- "If you do" is honest: never +N without a Wound actually gained and kept (no free grant at land, none on an empty supply, none after a reveal).
- The Wound goes through `gainWoundWithOutcome` only — never the bare `gainWound` helper.
- Untagged Diving Block / Flying Shield Block entries behave byte-identically; every existing interception test passes unedited.
- All six keyword lockstep sites move together (`reference_hero_keyword_lockstep_sites`); a magnitude keyword stays out of `NO_MAGNITUDE_KEYWORDS`.
- The only existing assertion edited is the `setup/heroAbility.setup.test.ts:1857` Scalded by Sunlight case (intentional change, say so in the `EC-921:` body), plus the count pins.
- `gainWoundReward.test.ts` builds hooks with `buildHeroAbilityHooks` from the regenerated card data, never hand-written hooks.
- No new move, no UIState field, no `game.ts` / `index.ts` edit; the four other "may gain a Wound" lines stay untouched.
- Moves and effects never throw. No `.reduce()` for branching. No `git stash`.

## Required `// why:` Comments
- Handler: why a prompt (a real trade, unlike D-24183's auto-resolve) and why the seat choice (D-24500 precedent, no new move / projection).
- Empty-supply no-prompt: rules v23 L3199-3201 / D-24779.
- Chokepoint + tag: the Wound lands first, the reveal resolves later (D-24673); "instead" means not gained, so the reward waits.
- The Flying Shield Block length check: `gainWoundWithOutcome` reports `'gained'` even when Flying Shield Block parked.
- Tag transfer on a declined Diving Block: the same Wound moves to Flying Shield Block (D-24760).
- Grant site: the recipient is the active player, so the active `turnEconomy` is correct.
- Bot answers: why gain only when a fight opens up; why decline a reveal on a Wound taken on purpose.
- `DAY_NIGHT_UNMODELED_LINES` removal (the D-24600 precedent); reward-icon suppression (D-24570).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` + `heroKeywords.test.ts`; `rules/heroAbility.setup.test.ts` (pin) — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `heroEffects.execute.test.ts` (pins) — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundReward.test.ts` — **new**
- `packages/game-engine/src/types.ts`, `moves/seatChoice.resolve.ts`, `moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts`, `simulation/ai.seatChoice.ts` + `ai.seatChoice.test.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — **modified**
- `data/cards/co2e.json`, `data/cards/mdns.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **only if their gates flag**
- `docs/ai/DECISIONS.md` (D-24834), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Markers idempotent; `--validate` 0.
- [ ] Eight gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`, `sim:coverage`, `ledger:numbers`).
- [ ] Engine suite passes; `pnpm -r --no-bail test` → 0 fail; arena-client + dashboard `typecheck` → 0; core `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] Ledger: `gain-wound-reward` = `executable` for `co2e/hulk` and `mdns/morbius`; `sunlight` hitCount before / after in the `EC-921:` body.
- [ ] D-24834 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match.

## Common Failure Smells
- Hulk Smash! still gives +5 with no prompt → the reward-icon suppression is missing, or the marker never reached `co2e.json`.
- The handler is registered but nothing happens → `gain-wound-reward` missing from `HANDLED_KEYWORDS`, or a magnitude dropped by the pre-gate.
- Gain then reveal Diving Block still yields +N → the grant fired at land instead of being tagged.
- A Flying Shield Block reveal by another seat leaves +N → the queue-length check is missing (`'gained'` was trusted).
- Scalded by Sunlight still logs a `sunlight` hollow → the `DAY_NIGHT_UNMODELED_LINES` entry is still present.
- A bot gains a Wound and then reveals Diving Block on it → the tagged-entry decline is missing.
