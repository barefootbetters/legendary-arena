# EC-881 — co2e Crazed Rampage: Reveal Another Strength Hero or Gain a Wound (Execution Checklist)

**Source:** docs/ai/work-packets/WP-843-co2e-crazed-rampage-reveal-or-wound.md
**Layer:** Game Engine (+ card-data-derived feeds)

## Before Starting
- [ ] Re-baseline on `origin/main`. Re-confirm: `co2e.json` `hulk/crazed-rampage` ability 0 is exactly `Each player reveals another [hc:strength] Hero or gains a Wound.` with no marker, and no other hero line in `data/cards/*.json` matches `reveals? … or gains? a Wound`. If either differs, STOP and reconcile (the WP intent governs).
- [ ] Probe `buildHeroAbilityHooks` on that line: expect `conditions: [heroClassMatch strength]`, `unresolvedMarkers: ['gate-only']`, no `effects` (the bug).
- [ ] Read the CURRENT pin values (do not trust the WP's 83 / 65 if a hero-keyword WP landed since): the three `HERO_KEYWORDS.length` pins (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`), the two `Object.keys(HERO_EFFECT_HANDLERS).length` pins (`hero/heroEffects.execute.test.ts`).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0; record the baseline pass count.

## Locked Values (do not re-derive)
- Keyword / effect type: **`reveal-or-gain-wound-each`**. Marker: **`[keyword:reveal-or-gain-wound-each]`** (single segment, no magnitude). `VALID_TOKEN_PATTERN` branch: `^\[keyword:reveal-or-gain-wound-each\]$`.
- Curated entry, in the `co2e` list of `hero-ability-markers.json`: `{ "heroSlug": "hulk", "cardSlug": "crazed-rampage", "abilityIndex": 0, "markupToken": "[keyword:reveal-or-gain-wound-each]" }`.
- Effect descriptor: `{ type: 'reveal-or-gain-wound-each', revealCriterion }`, `revealCriterion` from the line's first `[hc:X]` / `[team:X]` via the reveal-from-hand resolver (Crazed Rampage → `{ kind: 'hero-class', heroClass: 'strength' }`).
- Six lockstep sites: (1) union + `HERO_KEYWORDS` append; (2) all three `HERO_KEYWORDS`-length pins +1 and the `rules/heroAbility.setup.test.ts` `expectedKeywords` order array appends the value last; (3) `HERO_EFFECT_HANDLERS` entry + both handler-count pins +1; (4) `HANDLED_KEYWORDS`; (5) **`NO_MAGNITUDE_KEYWORDS`** (miss it and the handler silently never runs); (6) the setup parser.
- Provenance key: `"reveal-or-gain-wound-each": { "wp": "WP-843", "decision": "D-24777" }` in `scripts/coverage/mechanic-provenance.json`.
- Every line passes `cardId` as the 4th `pushLog` argument (WP-438 attribution); a player list is the ids mapped to `Player {id}` and joined with `, ` → `Player 0, Player 1`.
- Log lines (outcome in brackets; `{card}` = `formatCardRef(G.cardDisplayData, cardId)`, `{req}` = the criterion's slug title-cased by a local hero-side helper (duplicate-first; never export `describeRevealRequirement` from the villain file), e.g. `Strength`):
  - ≥1 wounded, no Diving Block pending: `Each player without another {req} Hero gained a Wound ({card}): {Player 0, Player 1}.` [`applied`]
  - Diving Block pending: `Each player without another {req} Hero gains a Wound ({card}): {composeWoundOutcomeClause(gained, pending)}.` [`applied`]
  - only when NO player lacked a match: `Every player revealed another {req} Hero for {card}, so no one gained a Wound.` [`blocked`] — a player who lacked a match but met an empty supply gets only the empty-supply line (D-24686 class).
  - empty supply, per affected player: `Player {id} could not gain a Wound — the Wound supply is empty.` [`blocked`]

## Guardrails
- Reuse, don't fork: the reveal check is `playerCanRevealMatch(G, zones, isPlayingPlayer, cardId, criterion)`; the Wound is `gainWoundWithOutcome(G, playerId)`. No second reveal or wound helper.
- The criterion resolver accepts the new marker so `lineHasRevealFromHand` suppresses the Step 1a/1b gate; add no new suppression flag and leave the general extractor alone.
- The Step 2 `reveal-from-hand` branch and builder branch keep keying on their own keyword — a reveal-or-wound line must never also emit a `reveal-from-hand` draw (AC-1 asserts it).
- Seat order `Object.keys(G.playerZones).sort()`; only the playing player's `turnEconomy.woundsDrawn` bumps. No RNG, no new `G` field, `rules/heroAbility.types.ts` byte-unchanged.
- The handler never throws: missing criterion or missing zones → skip.
- Tests for AC-3..AC-6 and AC-10 dispatch through the exported `executeSingleEffect` (the `psychicLink.revealFromHand.test.ts` shape). Never export or call `heroEffectRevealOrGainWoundEach` directly — that bypasses the magnitude pre-gate the control run proves.
- The Step 2 branch sits beside the `reveal-from-hand` branch, BEFORE the generic `isValidHeroKeyword` push; the builder branch beside its `reveal-from-hand` sibling.
- No `G.notableEvents` push (`strikeBlocked` is villain-only). Seat order is the sorted-keys convention, not current-player-first (WP Design Rationale 5).
- `co2e.json` changes only through `apply-hero-ability-markers.mjs`; a re-run applies 0. Pins are runtime assertions (D-24372) — never `satisfies`, `any` or `@ts-ignore`.

## Required `// why:` Comments
- Parser: the reveal-from-hand resolver also reads this marker's criterion, so the co-located `[hc:X]` is a reveal criterion, not a play-gate (D-24777; the D-24470 / D-24530 family).
- Handler: auto-reveal is the D-24281 documented simplification (rules v23 L3196-3200 allow declining; deferred); `playerCanRevealMatch` is the D-24731 "another" scope; `gainWoundWithOutcome` keeps Diving Block / Flying Shield Block; `woundsDrawn` is the playing player's only.
- `VALID_TOKEN_PATTERN`: the new single-segment token (WP-843 / D-24777).

## Files to Produce
- Engine **modified**: `rules/heroKeywords.ts` + `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` (count + order array), `setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` (count only), `hero/heroEffects.execute.ts` + `hero/heroEffects.execute.test.ts`
- Engine **new**: `hero/crazedRampage.revealOrGainWound.test.ts` (AC-1..AC-6 + AC-10; AC-1 on a 1-copy synthetic registry; per-copy `#N` ids)
- Scripts **modified**: `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`
- Data **regenerated**: `data/cards/co2e.json` (one line); `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` (those with a real diff); `scripts/coverage/hero-effect-coverage.baseline.json` via `pnpm sim:coverage --update-baseline` (only delta: co2e `noEffect` −1)
- Governance: `docs/ai/DECISIONS.md` (D-24777 Active), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json` (live-verify record, or operator-pending)

## After Completing
- [ ] `pnpm -r build` 0; engine suite 0 fail (record delta); dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail.
- [ ] Marker pass: 1 new `co2e` marker, re-run 0. `cards:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `sim:runtime-observed:check`, `sim:coverage --check` all exit 0 (diffs are real, not CRLF).
- [ ] Control run: remove the keyword from `NO_MAGNITUDE_KEYWORDS` only → AC-3 fails (no Wound lands); restore.
- [ ] Hash oracles / sentinels unchanged; `git diff --name-only` = allowlist.
- [ ] Two commits: `EC-881:` implementation, `SPEC:` governance close (D-24777 Active, STATUS, indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED).
- [ ] D-24026 live-verify on play.legendary-arena.com recorded, or operator-pending.

## Common Failure Smells
- Still "needs another Strength Hero played this turn" → the resolver did not accept the marker, or the marker was not applied to `co2e.json`.
- Hook has the effect but nothing happens → `NO_MAGNITUDE_KEYWORDS` miss.
- A Psychic-Link-style draw fires on Crazed Rampage → the reveal-from-hand Step 2 / builder branch keyed on the shared criterion instead of its keyword.
- The playing player is never wounded → the resolving card counted as "another".
