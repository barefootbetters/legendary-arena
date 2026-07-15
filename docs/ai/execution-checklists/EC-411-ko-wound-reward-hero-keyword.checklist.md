# EC-411 — `ko-wound-reward` Hero Keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-382-ko-wound-reward-hero-keyword.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `f7cfe14a` (or later); working tree clean, synced.
- [ ] WP-248 / D-24019 landed: `optional-ko-reward` keyword + parser token + executor reward-dispatch (`executeSingleEffect(...{ type: rewardType, magnitude })`).
- [ ] WP-017: `WOUND_EXT_ID='pile-wound'` (`pilesInit.ts`), `koCard` (`board/ko.logic.ts`), `moveCardFromZone` (`moves/zoneOps.ts`).
- [ ] Hero substrate: `HeroKeyword` union + `HERO_KEYWORDS` (`rules/heroKeywords.ts`); `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` + `NO_MAGNITUDE_KEYWORDS` + `executeSingleEffect` + `heroEffectDraw` (`hero/heroEffects.execute.ts`); parity drift tests.
- [ ] Marker pipeline: `apply-hero-ability-markers.mjs` (+`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json`.
- [ ] `pnpm -r build` 0; engine test + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/*.json` and derived artifacts). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New keyword: `'ko-wound-reward'`.
- Wound ext_id: `WOUND_EXT_ID = 'pile-wound'` — **import it**, never the literal.
- Reward vocabulary (this WP): `KO_WOUND_REWARD_SEEDED_REWARDS = {'draw','attack','recruit'}`.
- Marker token: `[keyword:ko-wound-reward:<rewardType>:<magnitude>]`.
- Reward dispatch: `executeSingleEffect(G, ctx, playerID, sourceCardId, { type: rewardType, magnitude })`.
- KO order: hand first, else discard; neither → no-op (D-24017 log).

## Guardrails
- Auto-resolve IMMEDIATELY in the executor — do NOT park a `Pending*`, add a resolve move, a `UIState` projection, or a client prompt.
- KO target filtered to `WOUND_EXT_ID` only — a Hero in hand must NEVER be KO'd (test it).
- Reuse `executeSingleEffect` for the reward — do NOT re-implement draw/attack/recruit.
- `'ko-wound-reward'` goes in BOTH the union AND `HERO_KEYWORDS`; the handler in BOTH `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`; NOT in `NO_MAGNITUDE_KEYWORDS` (it carries the reward magnitude).
- Effects never throw; unknown/unseeded reward → `pushLog` + return (no KO). Empty-zone → `pushLog` + return.
- No `.reduce()` in the zone scan/removal — explicit `for...of` / `moveCardFromZone`.
- Marker edits touch only `abilities[i]` text — no other card field. After ANY card-data change, REGEN + commit all three derived artifacts (mechanics:metadata / ledger:heroes / runtime-observed); a stale artifact fails its `:check`.
- **Sim-outcome cascade:** marking these cards changes what the balance sweep does (they now KO+reward), so `runtime-observed-hollows.json` regenerates. If the sentinel replay plays a marked card its `finalStateHash` re-pins via the canonical record tool — NEVER hand-edit; investigate WHY first.

## Required `// why:` Comments
- `heroKeywords.ts` entry: D-24183 — Wound-restricted auto-resolving variant of optional-ko-reward.
- executor Wound scan / KO: hand-first, WOUND_EXT_ID filter (never a Hero); D-24017 no-op on empty.
- executor reward dispatch: reuse executeSingleEffect (no re-impl).
- `NO_MAGNITUDE_KEYWORDS` omission: the keyword carries the reward magnitude.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — handler + seeded set + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler tests
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — parser token + extraction
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 9 marker rows (draw ×2, attack ×5, recruit ×2)
- `data/cards/{core,dstr,cvwr,3dtc,msp1,mdns,ff04,msis}.json` — **modified (regenerated)** — appended tokens
- derived artifacts for `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**
- (conditional) sentinel/golden fixtures — **regenerated** only if a recorded game plays a marked card

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes
- [ ] `apply-hero-ability-markers.mjs --validate` clean; `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` all 0
- [ ] `Select-String heroEffects.execute.ts "'pile-wound'"` → no NEW literal (WOUND_EXT_ID imported)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): Healing Factor with a Wound in hand KOs it + draws a card
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24183 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-382 checked off with date
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/artifacts)

## Common Failure Smells
- A Hero got KO'd → the Wound filter is missing (must be `WOUND_EXT_ID` only).
- `:check` gate red → a derived artifact wasn't regenerated after the marker edit (regen ALL three).
- Sentinel hash shifted → a recorded game plays a marked card; re-record, do NOT hand-edit.
- Reward didn't fire → the executor parked instead of dispatching, or the rewardType wasn't seeded / passed to `executeSingleEffect`.
- Drift test red → keyword added to the union but not the array (or handler map vs HANDLED_KEYWORDS mismatch).
