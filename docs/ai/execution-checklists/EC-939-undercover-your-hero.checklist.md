# EC-939 — "You may send one of your (other) Heroes Undercover": bkwd Black Widow and Red Guardian (Execution Checklist)

**Source:** docs/ai/work-packets/WP-901-undercover-your-hero.md
**Layer:** Game Engine (two handler-bearing keywords, widened Undercover choice, declinable resolve, bot default) + Arena Client (prompt) + card data
**Risk Tier:** MEDIUM — gameplay rules on three bkwd hero lines (a hollow starts working), a widened pending-choice contract with a declinable resolve, one client prompt, card data and derived feeds; finalStateHash sentinels byte-identical; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`; any edit outside it is a FAIL — surface it as an amendment.
- [ ] Baseline `origin/main` at or after `572ff95a7`; WP-678 / D-24494, WP-665 / D-24476, WP-856 / D-24792 Active.
- [ ] `pnpm -r build` then `pnpm -r --no-bail test` exit 0; record per-package totals (engine at draft: 7343 / 0, 1652 suites); `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] Re-observe the three parses at HEAD (WP §Assumes); a different parse is a STOP.
- [ ] **WP-899 check:** if WP-899 / D-24856 has landed, after an in-play send in `resolveUndercoverChoice` add
      `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, targetExtId)`, add `moves/undercover.resolve.ts#resolveUndercoverChoice: 1`
      to `LOCKED_LEFT_PLAY_RECORD_TABLE` (`hero/playedCardLeftPlay.test.ts`), test the record directly, and record the three edits
      (resolve call, table row, direct test) and the one extra file, `hero/playedCardLeftPlay.test.ts`, in an amendment; else leave it to WP-899.
- [ ] Read the current lockstep pins (at draft: three `HERO_KEYWORDS.length` = 101 in `rules/heroKeywords.test.ts`,
      `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`; the ordered `expectedKeywords` array (insert after
      `undercover-officer-stack`); two handler-count pins = 80 in `hero/heroEffects.execute.test.ts`) — +2 / +2 governs.

## Locked Values (do not re-derive; verify at HEAD)
- **Markers** (`hero-ability-markers.json` → `bkwd`, appended in this order):
  `{ "heroSlug": "black-widow", "cardSlug": "weave-a-web-of-spies", "abilityIndex": 1, "markupToken": "[keyword:undercover-your-other-hero]" }`,
  same keys with `"[keyword:draw-threshold:1]"`,
  `{ "heroSlug": "black-widow", "cardSlug": "infiltrate-the-conspiracy", "abilityIndex": 0, "markupToken": "[keyword:undercover-your-hero]" }`,
  `{ "heroSlug": "red-guardian", "cardSlug": "death-was-only-a-ruse", "abilityIndex": 2, "markupToken": "[keyword:undercover-your-other-hero]" }`.
  `VALID_TOKEN_PATTERN` arms `^\[keyword:undercover-your-hero\]$`, `^\[keyword:undercover-your-other-hero\]$`.
- **Keywords:** `'undercover-your-hero'`, `'undercover-your-other-hero'` after `'undercover-officer-stack'` in the union and
  `HERO_KEYWORDS`; both in `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`; `HERO_EFFECT_HANDLERS` → `heroEffectUndercoverYourHero`.
- **Hero test:** `cardId !== WOUND_EXT_ID && cardId !== BYSTANDER_EXT_ID`. "Other": `effect.type === 'undercover-your-other-hero'`
  leaves out in-play `cardId`.
- **Pending entry (your-hero):** `{ playerID, cardId, source: 'your-hero', eligibleTargets: <hand Heroes>,
  eligibleInPlayTargets: <in-play Heroes>, canDecline: true }`. 0 eligible → no park; log
  `Player ${playerID} had no other Hero to send Undercover for ${formatCardRef(...)}.` (`other` variant) /
  `Player ${playerID} had no Hero to send Undercover for ${formatCardRef(...)}.`
- **Resolve args:** `{ decline: true } | { targetExtId: CardExtId; zone?: 'hand' | 'inPlay' }` (XOR; both present →
  return, no pop); decline log
  `Player ${playerID} chose not to send a Hero Undercover.`; decline / `zone: 'inPlay'` refused unless the front is `'your-hero'`
  (`canDecline === true` / `eligibleInPlayTargets` holds it); `'your-hero'` only: a target not present in its zone →
  return, no pop. Hand-shield keeps today's path (snapshot check → send, no-op if gone → pop).
- **Send log (`'your-hero'` only):** `Player ${playerID} sent ${formatCardRef(G.cardDisplayData, targetExtId)} Undercover (into the Victory Pile, +1 VP).`
  `export function moveCardUndercover(G, playerID, cardId, fromZone): CardExtId[]` = `sendCardUndercover` minus its log;
  `sendCardUndercover` = `moveCardUndercover` + its UNCHANGED raw-id log (older Undercover replays keep their hashes).
- **Write rule:** `'your-hero'` entry always writes `canDecline: true` and `eligibleInPlayTargets` (possibly `[]`); a
  hand-shield entry writes neither; `canDecline` never `false`, read `=== true` (D-24600 `koHeroesOnly`). Same for the UI field.
- **Bot:** `selectDefaultUndercoverYourHeroTarget(front, { hand, inPlay })` — first `SHIELD_AGENT_EXT_ID` /
  `SHIELD_TROOPER_EXT_ID` in `eligibleInPlayTargets` still in `inPlay` (zone `'inPlay'`), else in `eligibleTargets` still in
  `hand` (zone `'hand'`), else `null` → `{ decline: true }` (never offers a move the resolve refuses).
- **UI:** `UIPendingUndercoverChoice` + `eligibleHand?` / `eligibleInPlay?` (`UIEligibleKoHeroCard[]`) + `canDecline?: boolean`,
  only for a `'your-hero'` front, built from snapshot ids still in their zone. Client `:key` = zone + index; heading `You may send one of your Heroes Undercover`; groups `From your hand` /
  `Played this turn`; decline button `Don't send`; testids `undercover-choice-card-<zone>-<cardId>`, `undercover-choice-decline`.
- **Parser:** line flag `lineHasUndercoverYourHeroMarker` (either marker on the line) → skip the bare `undercover` keyword.

## Guardrails
- No new move, `CORE_MOVE_NAMES` entry, `G` key, phase or stage; the hand-shield / officer-stack behaviour is unchanged.
- The keyword lockstep sites move together (union, `HERO_KEYWORDS`, three `HERO_KEYWORDS.length` pins + the ordered
  `expectedKeywords` array, handler registry + two handler-count pins, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`); a missing
  `NO_MAGNITUDE_KEYWORDS` entry silently never runs.
- New pending / UI fields are written only for `'your-hero'`; a sentinel or `finalStateHash` moving is a STOP, never a re-pin.
- Five-step Board-Visible rule for each new UI field; chooser-only.
- Moves never throw; no `.reduce()`; runtime pins, not `satisfies` (D-24372).
- `bkwd.json` regenerated from the marker map only; zero-diff re-run.

## Required `// why:` Comments
- The handler: "your Heroes" = hand + in play (rules v23 glossary); "other" leaves out the triggering copy; always park + decline
  (a strong Hero is a real cost, unlike D-24494's auto-send).
- The parser line flag (bare token descriptive when a source marker is present).
- The resolve: decline gate, zone gate, stale-target no-pop (`'your-hero'` only; hand-shield keeps today's pop).
- The bot default (rules: starters are the Undercover target); the `moveCardUndercover` split (hashed log kept byte-identical).
- The write rule on the optional fields (always / never, `=== true`).
- Each new optional contract field (D-24858).

## Files to Produce
- `packages/game-engine/src/{rules/heroKeywords,hero/heroEffects.execute,setup/heroAbility.setup,types,moves/undercover.resolve,ui/uiState.types,ui/uiState.build,ui/uiState.filter,simulation/ai.legalMoves}.ts` — modified (`index.ts` only if an export is needed).
- `apps/arena-client/src/components/play/UndercoverChoicePrompt.vue` — modified.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json` — modified; `data/cards/bkwd.json` — generated.
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json` (if moved), `mechanic-provenance.json`, `live-verify.json`
  (three pending rows), `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` (always; hash `495e9cc2` unchanged), dashboard copies, `useInPlayCoverage.test.ts` (if moved).
- Tests: `hero/undercoverYourHero.test.ts` (new); `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
  `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts` (pins); `moves/undercover.resolve.test.ts` (expected unchanged);
  only if WP-899 landed: `hero/playedCardLeftPlay.test.ts` (one `LOCKED_LEFT_PLAY_RECORD_TABLE` row); `ui/uiState.filter.test.ts`;
  `simulation/ai.legalMoves.test.ts` (optional); `UndercoverChoicePrompt.test.ts`.
- Close: `STATUS.md`, `DECISIONS.md` (D-24858), `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`,
  `docs/ai/post-mortems/` (01.6).

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail (per-package totals); arena-client `typecheck` 0; sentinels unchanged.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; then 0: `cards:check`, `ledger:heroes:check`,
      `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] `EC-939:` commit (code + data), then `SPEC:` close: D-24858 Active, STATUS, WORK_INDEX `[x]` + `[live-verify: pending]`,
      EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`; `roadmap:counts:check` → 0, NUMBER-LEDGER LANDED, 01.6 post-mortem.
- [ ] Live-on-surface (D-24026) in its own `SPEC:` PR after the deploy, or operator-pending in STATUS.

## Common Failure Smells
- Prompt never opens — keyword missing from `NO_MAGNITUDE_KEYWORDS`, or the bare `undercover` still the only keyword.
- Weave opens with no draw — the draw-threshold marker not on ability 1, or appended to the wrong index.
- Weave offered as its own target — "other" exclusion compares the wrong id.
- Turn frozen — the client lacks the decline / in-play buttons, or the resolve pops nothing on a valid pick.
- Sentinel or an old replay hash moved — a field written on a hand-shield entry, or `sendCardUndercover`'s log text changed.
- Second parked entry offers a card the first already sent — projection / bot not filtering by live zone.
