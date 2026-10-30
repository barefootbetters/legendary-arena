# EC-895 — Hero Feast ("You may [keyword:Feast]" — KO the top card of your deck): Miek and No-Name (Execution Checklist)

**Source:** docs/ai/work-packets/WP-857-wwhk-feast.md
**Layer:** Game Engine (handler-bearing hero keyword reusing a shipped handler + parser allowlist)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `5dc5fae8` (WP-857 reserve #3107).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0 (record the count).
- [ ] Read the models: `heroEffectRevealTopMayKo` and its registry / `HANDLED_KEYWORDS` / `NO_MAGNITUDE_KEYWORDS`
      entries (WP-754); the `transform` parser arm + `SUPPORTED_TRANSFORM_BASES` lookup; `BY_HOOK_KEYWORDS`
      in `scripts/hero-mechanic-ledger.mjs`; auto-memory `reference_hero_keyword_lockstep_sites`.
- [ ] Read the CURRENT pin values (`HERO_KEYWORDS` 87, handlers 69 at drafting). If another keyword WP
      landed, bump from the HEAD value by one — the intent governs, not the drafted literal.
- [ ] Jeff's RS-1 answer (reveal before the choice) at the go.

## Locked Values (do not re-derive; verify at HEAD)
- **Keyword:** `'feast'` appended to the `HeroKeyword` union and the end of `HERO_KEYWORDS`
  (`rules/heroKeywords.ts`). No magnitude.
- **Handler:** `HERO_EFFECT_HANDLERS` entry `feast: heroEffectRevealTopMayKo` (same function, body
  unchanged); `'feast'` added to `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`.
- **Allowlist:** `const FEAST_CARDS: ReadonlySet<string>` in `setup/heroAbility.setup.ts`, exactly
  `wwhk/miek-the-unhived/devouring-frenzy`, `wwhk/miek-the-unhived/metamorphosis`,
  `wwhk/miek-the-unhived/hive-king-miek`, `wwhk/no-name-brood-queen/appetite-for-destruction`,
  `wwhk/no-name-brood-queen/bursting-with-life`.
- **Parser arm:** `parseAbilityText` options gain `feastSupported?: boolean` = `FEAST_CARDS.has(<canonical
  key>)` at the call site beside `transformSupported`. `normalizedKeyword === 'feast'` arm beside the `transform`
  arm, BEFORE `isValidHeroKeyword`: `feastSupported` → `keywords.push('feast')`; else
  `unresolvedMarkers.push('feast')`. No effect-builder edit (falls through to `effects.push({ type: keyword })`).
- **Ledger:** `BY_HOOK_KEYWORDS` gains `'feast'`.
- **Pins (in place):** three `HERO_KEYWORDS.length` pins 87 → 88 (`rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts` + `'feast'` appended to `expectedKeywords`,
  `setup/heroAbility.setup.test.ts`); two `HERO_EFFECT_HANDLERS` count pins 69 → 70
  (`hero/heroEffects.execute.test.ts`); messages name WP-857 / D-24793.
- **Tests:** new `hero/feast.test.ts`, one `describe`, +8 (the WP Scope cases 1–8), hooks parsed from the
  committed `wwhk.json`; engine 6075 → 6083 at `5dc5fae8`.

## Guardrails
- No new handler body, pending queue, move, `CORE_MOVE_NAMES` entry, `G` field, UIState field or client change.
- No card-data change; never hand-edit `data/cards/*.json`.
- World-Spanning Hunger and The Void Unchained stay unresolved (Honest-Partial Invariant); no other card
  joins `FEAST_CARDS`.
- Villain / henchman / Mastermind Feast untouched.
- A sentinel / `finalStateHash` moving is a STOP, never a re-pin.
- Moves never throw; no `.reduce()`; RUNTIME pins (D-24372).

## Required `// why:` Comments
- The `'feast'` keyword entry and the `HERO_EFFECT_HANDLERS` entry: Feast = KO the top card of your deck;
  it reuses the KO-or-keep reveal (WP-857 / D-24793, RS-1 reveal-before-choose).
- `FEAST_CARDS` and the parser arm: why the allowlist (World-Spanning Hunger / The Void Unchained other text
  unmodeled), checked before `isValidHeroKeyword`.
- The `NO_MAGNITUDE_KEYWORDS` entry (a magnitude-less keyword is otherwise dropped before its handler).
- `BY_HOOK_KEYWORDS` entry (the five covered cards resolve it; the other two do not).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`,
  `setup/heroAbility.setup.ts` — modified.
- `scripts/hero-mechanic-ledger.mjs` — modified.
- Tests: `hero/feast.test.ts` (new); `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
  `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts` (pins only).
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json` (`feast`),
  `live-verify.json` (pending `wwhk/miek-the-unhived|feast`, `wwhk/no-name-brood-queen|feast`), dashboard data
  copies + `useInPlayCoverage.test.ts` only if it moves.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24793), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine (+8) + dashboard `test` 0; sentinels byte-unchanged (no pin literal edited
      beyond the five keyword / handler pins).
- [ ] Ledger: `feast` `executable` on the Miek and No-Name rows, `unsupported` on the Sentry row; World-Spanning
      Hunger / The Void Unchained hooks keep their unresolved `feast` marker.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; then 0: `cards:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check`.
- [ ] D-24793 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`
      + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) confirmed, or operator-pending in STATUS with the `live-verify.json` rows.

## Common Failure Smells
- Playing Metamorphosis parks nothing — `'feast'` missing from `NO_MAGNITUDE_KEYWORDS` (registered, never reached).
- World-Spanning Hunger now prompts — the generic `isValidHeroKeyword` push ran before the `feast` arm.
- Ledger Sentry row reads `executable` — `BY_HOOK_KEYWORDS` lacks `'feast'`.
- Handler parity test fails — `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS` out of step.
