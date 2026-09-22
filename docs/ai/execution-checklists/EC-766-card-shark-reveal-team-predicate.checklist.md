# EC-766 — Card Shark reveal-rule team/hero-class predicate + X-Gene grammar (Execution Checklist)

**Source:** docs/ai/work-packets/WP-729-card-shark-reveal-team-predicate.md
**Layer:** Game Engine (reveal-rule grammar + setup parser + condition message) + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `34694804` (or later); working tree clean, synced. Reserve line WP-729/EC-766/D-24550 already on `main` (PR #2219).
- [ ] Parameterized reveal-rule grammar landed (D-24024/D-24286): `RevealPredicate { kind, threshold? }` + `RevealPredicateKind` union + `REVEAL_PREDICATE_KINDS` array + drift test (`rules/revealRule.ts` ~26–46, `rules/revealRule.test.ts`); `REVEAL_RULE_PATTERN` (`setup/heroAbility.setup.ts` ~276); `parseRevealPredicateToken` (~2592); `heroEffectReveal`→`applyRevealRules`→`revealPredicateMatches(G,predicate,cost)` (`hero/heroEffects.execute.ts` ~1522/1640/1720); `describeRevealPredicate` (`hero/revealLog.ts` ~49).
- [ ] **Leave-on-top disposition confirmed** (`hero/heroEffects.execute.ts` ~1598): `applyRevealRules` removes a card only on `draw`/`ko`; an unmatched card stays on top. This is the faithful home; `investigate` (non-match → bottom, ~4290) is the wrong home.
- [ ] WP-659/D-24470 landed: `lineHas*` suppression of a co-located `[team:X]`/`[hc:X]` at Step 1a/1b (`setup/heroAbility.setup.ts` ~705/~835).
- [ ] WP-564/D-24373 landed: `investigateCardMatchesCriteria` (`hero/heroEffects.execute.ts` ~4384) — the trait-projection model for the matcher.
- [ ] WP-179/D-24074 landed: printed team/class on `G.cardTraits[id]` (`normalizeTraitSlug` slugs).
- [ ] WP-723/D-24544 landed: the X-Gene `heroClassInDiscardPile` failed-condition message (`hero/heroConditions.evaluate.ts` ~719) — the Part-B string.
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/{core,dead,pttr,ssw2}.json` and derived feeds). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New `RevealPredicateKind` members: `'team'`, `'hero-class'` (added to the union AND `REVEAL_PREDICATE_KINDS` AND the `revealRule.test.ts` drift assertion AND D-24550 — together).
- New `RevealPredicate` field: `traitValue?: string` (the `normalizeTraitSlug` slug; used by the two trait kinds only).
- Marker grammar: `[keyword:reveal:team-<slug>:draw]` / `[keyword:reveal:hc-<slug>:draw]`. `hc`→`hero-class` at parse (D-24281 convention). Multiple tokens on one line = multiple first-match-wins rules (inclusive OR).
- Matcher: `team` matches iff the peeked card's projected teams include `traitValue`; `hero-class` iff projected `heroClass`/`heroClass2` equals `traitValue` — via the `investigateCardMatchesCriteria` projection. Predicate value is **never** a hardcoded literal.
- Non-match disposition: **leave on top** — unchanged. Moving a non-match off the top is a FAIL.
- Suppression flag `lineHasRevealTraitCriterion`: true only on a `[keyword:reveal:…]` line carrying a trait predicate; it suppresses that line's co-located `[team:X]`/`[hc:X]` from Step 1a/1b. Do not suppress elsewhere.
- Apply rows (idx confirmed at scaffold): `core/gambit/card-shark` idx 0 → `[keyword:reveal:team-x-men:draw]`; `dead/hydra-half-wit` idx 0 → `[keyword:reveal:team-hydra:draw][keyword:reveal:team-shield:draw]`; `pttr/crescent-moon-darts` idx 0 → `[keyword:reveal:hc-instinct:draw][keyword:reveal:hc-tech:draw]`; `ssw2/balanced-attack` idx 0 → `[keyword:reveal:hc-tech:draw][keyword:reveal:hc-strength:draw]`.
- `VALID_TOKEN_PATTERN` gains the trait-predicate reveal alternative only (`^\[keyword:reveal:(team|hc)-[a-z][a-z0-9-]*:draw\]$` or equivalent) — a closed-set extension (D-21601 lineage).
- Drift counts UNCHANGED except `REVEAL_PREDICATE_KINDS`: `RevealActionKind`, `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS` all unchanged.
- **Part B:** article-aware message — `instinct` → "an instinct"; strength/covert/tech/ranged keep "a". No condition/behavior change, no new field, no re-pin.
- Deferred (Honest-Partial): `co2e` Card Shark 2e ("otherwise discard/put back" = `choose-discard-or-return`), any gated (`[hc:X]:`/`[keyword:X]:`) reveal, any Fight/villain reveal.

## Guardrails
- Route the four cards through the reveal-rule handler (leave-on-top), **NOT** `investigate` (non-match → bottom). Faithful non-match disposition is non-negotiable.
- Canonical-array lockstep: `RevealPredicateKind` union ↔ `REVEAL_PREDICATE_KINDS` array ↔ `revealRule.test.ts` drift assertion ↔ D-24550, edited together. Never one without the others.
- The matcher **reads** `G.cardTraits` and never mutates `G`. No `.reduce()` — explicit `for...of`. Parser/matcher never throw; an unknown predicate warns to `G.messages` and does not match (the existing D-24024 posture).
- Suppression is scoped to `lineHasRevealTraitCriterion`; do not broaden it. A cost-only reveal line (`[keyword:reveal:2]`) is byte-unaffected.
- Marker edits touch only `abilities[i]` text of the four resolved cards. `VALID_TOKEN_PATTERN` gains ONE alternative (trait-predicate reveal); no other apply-script change.
- After the card-data change, REGEN + commit all four derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed) + refresh the `sim:coverage` baseline if the hook universe grew (`--update-baseline`, then `--check` green); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF build churn before commit.
- **Determinism:** `core/gambit/card-shark` is CORE — running Card Shark in a committed sentinel/fixture may move `finalStateHash`. If it moves, confirm it is Card Shark's reveal (not a regression) and re-pin the affected fixture with a `// why:` note. Never hand-edit a hash/snapshot to force green. The three siblings are non-core.
- **Part B is copy-only:** change the article, nothing else; keep the condition's true/false behavior byte-identical.

## Required `// why:` Comments
- `RevealPredicateKind` `'team'`/`'hero-class'` additions + array: D-24550 — reveal-rule trait predicate; the faithful home for "reveal top, if [team/hc:X] draw it" (leave-on-top), not investigate.
- `parseRevealPredicateToken` trait branches: D-24550/D-24281 — `hc`→`hero-class`, `normalizeTraitSlug`, mirroring the villain `reveal-or-wound:<team|hc>:<value>` convention.
- `lineHasRevealTraitCriterion` suppression: D-24550 — the inline `[team:X]`/`[hc:X]` on a reveal line is the reveal CRITERION, not a `requiresTeam`/`heroClassMatch` play-gate (the reveal-from-hand / D-24470 precedent).
- `revealPredicateMatches` trait branch: D-24550 — reuse the `investigateCardMatchesCriteria` trait projection over `G.cardTraits`.
- `VALID_TOKEN_PATTERN` extension: D-24550 — the first parameterized trait-predicate reveal token (closed-set extension, D-21601 lineage).
- Part B article branch: WP-723/D-24544 copy fix — vowel-initial hero class ("instinct") takes "an".

## Files to Produce
- `packages/game-engine/src/rules/revealRule.ts` — **modified** — `RevealPredicateKind` + `REVEAL_PREDICATE_KINDS` + `RevealPredicate.traitValue`
- `packages/game-engine/src/rules/revealRule.test.ts` — **modified** — drift/parity for the two new kinds
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `parseRevealPredicateToken` trait branches + `lineHasRevealTraitCriterion` suppression
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — parse + suppression tests
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `revealPredicateMatches` trait branches + `topCardId` threading
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — matcher + leave-on-top disposition tests
- `packages/game-engine/src/hero/revealLog.ts` — **modified** — `describeRevealPredicate` team/hero-class rendering
- `packages/game-engine/src/hero/revealLog.test.ts` — **modified (if present)** — describe wording (else fold into an execute test)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN` trait-predicate reveal alternative
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 4 apply rows (core/dead/pttr/ssw2)
- `data/cards/core.json`, `data/cards/dead.json`, `data/cards/pttr.json`, `data/cards/ssw2.json` — **modified (regenerated)** — appended markers
- derived feeds `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**; `sim:coverage` baseline if hook-universe grew
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified (Part B)** — article-aware message (~719)
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified (Part B)** — "an instinct"/"a strength" assertions

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (drift + parse + suppression + matcher + disposition + Part-B grammar; `RevealActionKind`/`HERO_KEYWORDS`/`HERO_EFFECT_HANDLERS` unchanged, `REVEAL_PREDICATE_KINDS` +2)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all 0
- [ ] `finalStateHash` outcome recorded: unchanged, or re-pinned with the Card-Shark reason (CORE) — never hand-edited
- [ ] `grep` the four cards → `reveal`/`draw` `executable` in `hero-mechanic-ledger.csv`; deferred variants (co2e/gated/Fight) still listed where applicable in `runtime-observed-hollows.json`
- [ ] Live-on-surface verification — REQUIRED post-merge (surface = `play.legendary-arena.com`, D-24026): Card Shark reveals + draws on an X-Men Hero (non-match stays on top), no "needs another x-men Hero" line; an instinct-class X-Gene failed condition reads "an instinct card"
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24550 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-729 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- Card Shark still logs "needs another x-men Hero this turn" → the `lineHasRevealTraitCriterion` suppression didn't fire; the parser still emitted `requiresTeam`.
- A non-matching reveal ends up on the bottom of the deck → the card was wrongly routed through `investigate`, or the reveal handler's leave-on-top path was altered. Faithful behavior is leave-on-top.
- `revealRule.test.ts` drift red → the union, the array, and the drift assertion weren't updated together.
- `VALID_TOKEN_PATTERN` rejects the marker at apply time → the trait-predicate alternative wasn't added (or the token shape doesn't match `REVEAL_RULE_PATTERN`'s `predicate:action` capture).
- `:check` gate red → a derived feed wasn't regenerated after the marker edit (regen ALL four; refresh the `sim:coverage` baseline if the hook universe grew).
- Cost-only reveal cards (`[keyword:reveal:2]`) changed behavior → the suppression or matcher leaked beyond the trait predicate; cost reveals must be byte-identical.
- Part B: "a instinct" persists, or a consonant class flipped to "an" → the article test is wrong or the branch keys on the wrong condition.
