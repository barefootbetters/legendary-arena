# EC-758 — Rewardless `ko-wound` Hero Keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-721-rewardless-ko-wound-heal.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `0944c720` (or later); working tree clean, synced.
- [ ] WP-382 / D-24183 landed: `ko-wound-reward` keyword + parser token + `heroEffectKoWoundReward` (the KO-a-Wound-from-hand/discard primitive this reuses minus the reward dispatch).
- [ ] WP-017: `WOUND_EXT_ID='pile-wound'` (`pilesInit.ts`), `koCard` (`board/ko.logic.ts`), `moveCardFromZone` (`moves/zoneOps.ts`).
- [ ] Hero substrate: `HeroKeyword` union + `HERO_KEYWORDS` (`rules/heroKeywords.ts`); `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` + `NO_MAGNITUDE_KEYWORDS` (`hero/heroEffects.execute.ts`); the generic `KEYWORD_PATTERN` + `isValidHeroKeyword` scan + `{ type: keyword }` fallback (`setup/heroAbility.setup.ts`); parity drift tests.
- [ ] Marker pipeline: `apply-hero-ability-markers.mjs` (+`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json`.
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/*.json` and derived feeds). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New keyword: `'ko-wound'` (rewardless; distinct from `'ko-wound-reward'`).
- Wound ext_id: `WOUND_EXT_ID = 'pile-wound'` — **import it**, never the literal.
- Marker token: `[keyword:ko-wound]` (single segment, no magnitude, no reward).
- KO order: hand first, else discard; neither → no-op (D-24017 log).
- Target cards: `xmen/x-23/healing-factor-genome` (abilityIndex **1**), `cvwr/peter-parker/hot-bowl-of-soup` (abilityIndex **0**).
- Drift counts: `HERO_KEYWORDS` 59→**60**; `HERO_EFFECT_HANDLERS` 43→**44**.

## Guardrails
- Auto-resolve IMMEDIATELY in the executor — do NOT park a `Pending*`, add a resolve move, a `UIState` projection, or a client prompt (mirrors `ko-wound-reward`).
- KO target filtered to `WOUND_EXT_ID` only — a Hero in hand must NEVER be KO'd (test it).
- NO reward dispatch — this is the REWARDLESS variant; the handler ends after the KO + log. Do NOT call `executeSingleEffect`.
- `'ko-wound'` goes in BOTH the union AND `HERO_KEYWORDS`; the handler in BOTH `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`; AND in `NO_MAGNITUDE_KEYWORDS` (it carries no magnitude — the OPPOSITE of `ko-wound-reward`).
- NO dedicated parser branch — the bare `[keyword:ko-wound]` rides the generic `KEYWORD_PATTERN` + `isValidHeroKeyword` scan → `{ type: 'ko-wound' }` fallback. Adding a branch is a FAIL (dead code).
- Effects never throw; empty-zone → `pushLog` + return. No `.reduce()` — use `moveCardFromZone`.
- Marker edits touch only `abilities[i]` text. After the card-data change, REGEN + commit all four derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF build churn before commit.
- **Sim-outcome cascade:** marking these cards changes what the balance sweep does (they now KO a Wound), so `runtime-observed-hollows.json` regenerates. The sentinel replay is core-only and these cards are non-core → `finalStateHash` unchanged; if it moves, investigate WHY — never hand-edit.

## Required `// why:` Comments
- `heroKeywords.ts` entry: D-24542 — rewardless auto-resolving sibling of ko-wound-reward.
- executor Wound scan / KO: hand-first, `WOUND_EXT_ID` filter (never a Hero); D-24017 no-op on empty; NO reward dispatch.
- `NO_MAGNITUDE_KEYWORDS` inclusion: the keyword carries no reward magnitude (unlike ko-wound-reward).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — handler + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift 43→44 + behavior tests
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — count 59→60 + registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — expected-array + count 59→60
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 apply rows + remove 2 `_deferred` rows
- `data/cards/{xmen,cvwr}.json` — **modified (regenerated)** — appended token
- derived feeds for `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (3950→3957, +7: 5 behavior + 2 registration)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` all 0
- [ ] `grep "ko-wound," docs/ai/coverage/hero-mechanic-ledger.csv` → both cards `executable`
- [ ] Live-on-surface verification — REQUIRED post-merge (surface = `play.legendary-arena.com`, D-24026): Healing Factor Genome / Hot Bowl of Soup with a Wound in hand/discard KOs it
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24542 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-721 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- A Hero got KO'd → the Wound filter is missing (must be `WOUND_EXT_ID` only).
- A reward fired → this is the REWARDLESS variant; there must be NO `executeSingleEffect` call.
- `:check` gate red → a derived feed wasn't regenerated after the marker edit (regen ALL four).
- Drift test red → keyword added to the union but not the array, or the handler-map count/`HANDLED_KEYWORDS` mismatch, or a missed `NO_MAGNITUDE_KEYWORDS` entry (then the effect silently drops at the pre-gate).
- A new parser branch appeared → the generic scan already handles the bare token; the branch is dead code (remove it).
