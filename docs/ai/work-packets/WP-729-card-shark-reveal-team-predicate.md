# WP-729 — Card Shark reveal-rule team/hero-class predicate + X-Gene article grammar (Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine (reveal-rule grammar + setup parser + card data)
**Dependencies:** WP-479 / D-24286 + D-24024 (the parameterized reveal-rule grammar — `RevealPredicate` / `REVEAL_PREDICATE_KINDS` / `REVEAL_RULE_PATTERN` / `revealPredicateMatches` / `applyRevealRules`), WP-659 / D-24470 (the `lineHas*` co-located-`[team:X]`/`[hc:X]` suppression precedent), WP-564 / D-24373 (`investigateCardMatchesCriteria` — the trait-projection pattern the matcher reuses), WP-179 / D-24074 (printed-class + team traits on `G.cardTraits`), WP-723 / D-24544 (the shipped X-Gene message this WP's grammar half corrects)
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard two-session (a new reveal predicate kind is a canonical-array + contract change on `revealRule.ts` — a code category, `01.6`-adjacent — and Part A touches a CORE card's determinism surface; not lightweight).

> Baseline: `origin/main` at commit `34694804` (reserve WP-729 / EC-766 / D-24550), fetched 2026-09-21. Reserve line landed on `main` via the reserve-first SPEC PR #2219.

---

## Goal

After this session, `@legendary-arena/game-engine` resolves the printed "**Reveal the top card of your deck. If it's an [team/hero-class:X] Hero, draw it.**" ability faithfully on the tractable onPlay-hero family, by adding **team** and **hero-class** predicate kinds to the existing parameterized reveal-rule grammar. This is the **faithful home** for these cards: the reveal-rule handler leaves a non-matching revealed card **on top of the deck** — exactly the printed behavior — whereas the `investigate` keyword (the alternative the origin brief floated) sends a non-match to the **bottom**, a deck-order change the printed card does not perform. The WP also bundles a **one-line article-grammar fix** to the X-Gene failed-condition game-log message shipped in WP-723 (`"a instinct"` → `"an instinct"`).

Part A un-hollows Gambit's **Card Shark** (`core/gambit/card-shark`) plus three same-shape onPlay siblings — **HYDRA Half-Wit** (`dead/hydra-half-wit`), **Crescent Moon Darts** (`pttr/crescent-moon-darts`), **Balanced Attack** (`ssw2/balanced-attack`) — by marking each with a parameterized `[keyword:reveal:<team|hc>-<slug>:draw]` token and teaching the reveal-rule predicate to match the peeked card's **traits** (not just its cost). Part B corrects the X-Gene article grammar.

---

## User-Visible Impact

**Part A.** A player who plays **Card Shark** now actually reveals the top card of their deck and draws it if it is an X-Men Hero (leaving a non-match on top); today the card does nothing beyond its printed +2 Attack, and it worse-than-nothing *mis-reports* "did not activate — it needs another x-men Hero played this turn" (the spurious `requiresTeam` gate). The three siblings likewise begin drawing on a matching reveal. Where today all four are silent mis-parses, the behavior is now faithful to the printed card.

**Part B.** The X-Gene failed-condition game-log line reads "…it needs **an instinct** card in your discard pile" instead of the ungrammatical "**a instinct**". No behavior change — copy only.

---

## Assumes

- **The parameterized reveal-rule grammar exists** (D-24024, forward-compat; wired for cost predicates by WP-479/D-24286): `RevealPredicate { kind, threshold? }` + the closed `RevealPredicateKind` union + `REVEAL_PREDICATE_KINDS` canonical array + drift test (`rules/revealRule.ts` ~26–46, `rules/revealRule.test.ts`); `REVEAL_RULE_PATTERN` `/\[keyword:reveal:([a-z][a-z0-9-]*):([a-z][a-z0-9+-]*)(?::(continue))?\]/g` (`setup/heroAbility.setup.ts` ~276); `parseRevealPredicateToken` (~2592, cost-only today); `heroEffectReveal` → `applyRevealRules` → `revealPredicateMatches(G, predicate, cost)` (`hero/heroEffects.execute.ts` ~1522/1640/1720); `describeRevealPredicate` (`hero/revealLog.ts` ~49). No card uses the parameterized `[keyword:reveal:<pred>:<action>]` data form yet — Card Shark is the first (existing reveal markers are the legacy `[keyword:reveal:N]` shorthand).
- **Non-match disposition is leave-on-top** (`hero/heroEffects.execute.ts` ~1598): `applyRevealRules` removes a card only on a `draw`/`ko` action; an unmatched card stays on top (the `peekOffset` advances over it). This is the faithful Card Shark behavior and the reason the reveal-rule family — not `investigate` (non-match → bottom, `hero/heroEffects.execute.ts` ~4290) — is the correct home.
- **WP-659 / D-24470 complete:** `reveal-from-hand` established the `lineHas*` allow-list that **suppresses** a co-located `[team:X]`/`[hc:X]` from Step 1a/1b so it is NOT emitted as a `requiresTeam` / `heroClassMatch` play-gate (`setup/heroAbility.setup.ts` ~705/~835). Card Shark's inline `[team:x-men]` is the reveal **criterion**, not a play-gate — the same suppression class (auto-memory `reference_inline_team_token_spurious_requiresteam_gate`; Psychic Link / Pure Fury precedent).
- **WP-564 / D-24373 complete:** `investigateCardMatchesCriteria` (`hero/heroEffects.execute.ts` ~4384) projects a card's team / hero-class from `G.cardTraits` and matches an `InvestigateCriterion { kind:'team'|'hero-class', … }`. Part A's `revealPredicateMatches` reuses this projection for the trait predicates.
- **WP-179 / D-24074 complete:** printed team / class live on `G.cardTraits[id]` (`normalizeTraitSlug`-normalized slugs).
- **WP-723 / D-24544 complete:** the X-Gene `heroClassInDiscardPile` condition + its `describeFailedCondition` message (`hero/heroConditions.evaluate.ts` ~719) is on `main` — the string Part B corrects.
- The curated marker pipeline exists: `apply-hero-ability-markers.mjs` (+ its `VALID_TOKEN_PATTERN`, ~105) reads `inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`. Reveal markers (`[keyword:reveal:2]`, `[keyword:reveal-cost-attack]`) ship this way today.
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on `34694804`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Both defects surfaced in one live 1p Magneto / "Portals to the Dark Dimension" match (X-23 + Wolverine + Gambit) on the deployed build. Card Shark logged (10.2.2) "did not activate — it needs another x-men Hero played this turn" and then (10.2.3+) revealed/drew nothing; the X-Gene failed-condition line rendered "a instinct card" (13.2.5, 15.2.6). They are unrelated pre-existing bugs bundled only because both surfaced in the same X-Men-loadout playtest and both are small; Part B is cleanly isolated and can be split into its own SPEC if Part A grows.

**Card Shark is two defects in one card.** `core/gambit/card-shark` (hc `ranged`) carries `"Reveal the top card of your deck. If it's an [team:x-men] Hero, draw it."` with **no** `[keyword:…]` effect marker:
1. **Spurious `requiresTeam` gate.** Step 1b reads the inline `[team:x-men]` as a "play another X-Men Hero this turn" synergy gate (the log's "needs another x-men Hero played this turn"). It is actually the reveal **criterion**.
2. **Hollow effect.** Even past the gate, no marker implements "reveal top, if X-Men draw it." (It is not flagged in `runtime-observed-hollows.json` because the `[team:x-men]` produces a recognized `conditional`-shaped parse; it is a silent mis-parse.)

**Mechanism decision (recorded in D-24550): a reveal-rule trait predicate, NOT `investigate`.** The origin brief floated routing Card Shark through `investigate` (lookCount 1, criterion `[team:x-men]`). Reading the code shows that is **unfaithful**: the `investigate` handler puts a non-matching looked-at card on the **bottom** of the deck (`hero/heroEffects.execute.ts` ~4290), whereas core Card Shark ("…draw it." with no "otherwise" clause) leaves a non-match **on top**. Card Shark is structurally identical to its existing cost-based reveal siblings (`[keyword:reveal:2]` = "reveal top, if cost ≤ 2 draw it"), which use the reveal-rule grammar and correctly leave non-matches on top. Card Shark just needs a **team**/**hero-class** predicate where those use a **cost** predicate. Rejected alternatives:
- **`investigate` lookCount 1** — wrong non-match disposition (bottom vs top); making it faithful would require a new leave-on-top `investigate` variant, more invasive than a reveal predicate and muddying the `investigate` contract.
- **A dedicated `reveal-top-draw` HeroKeyword** (the `reveal-from-hand` shape) — a new `HERO_KEYWORDS` + `HERO_EFFECT_HANDLERS` surface duplicating reveal-rule's existing reveal-top-then-act machinery. More drift for no gain.

**The trait predicate mirrors the shipped villain `reveal-or-wound:<team|hc>:<value>` convention (D-24281):** `hc-<slug>` → `{ kind:'hero-class', … }`, `team-<slug>` → `{ kind:'team', … }`, slug `normalizeTraitSlug`-normalized and matched against `G.cardTraits`. A two-criterion card ("[team:hydra] or [team:shield]") is marked with **two** `[keyword:reveal:…:draw]` tokens (`REVEAL_RULE_PATTERN` is global; first-match-wins, both draw) — no new inclusive-OR grammar needed.

Read before writing:

- `data/cards/core.json` (gambit/card-shark ~591–604) + `data/metadata/keywords-full.json`.
- `packages/game-engine/src/rules/revealRule.ts` — `RevealPredicateKind` union + `REVEAL_PREDICATE_KINDS` array (~26–42), `RevealPredicate` interface (~74), and `rules/revealRule.test.ts` drift test.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `REVEAL_RULE_PATTERN` (~276), `parseRevealPredicateToken` (~2592), the Step 1b `requiresTeam` emission + its `lineHas*` suppression guard (~835), and the reveal-from-hand `tryResolveRevealFromHandCriterion` / `lineHasRevealFromHand` precedent (~705/~2458).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectReveal` (~1522), `applyRevealRules` (~1640) + the leave-on-top disposition (~1598), `revealPredicateMatches` (~1720), and `investigateCardMatchesCriteria` (~4384, the trait-projection model).
- `packages/game-engine/src/hero/revealLog.ts` — `describeRevealPredicate` (~49).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (~719) — the X-Gene grammar line (Part B).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` (~105, D-21601 closed set) + `inputs/hero-ability-markers.json` (the reveal-marker apply-row precedent).
- `docs/ai/work-packets/WP-564-*` + auto-memories `project_investigate_keyword_wp564`, `reference_inline_team_token_spurious_requiresteam_gate`, `reference_hero_ability_marker_curated_map`.

---

## Non-Negotiable Constraints

- Follow `docs/ai/REFERENCE/00.6-code-style.md`: full-word names (Rule 4); `// why:` on every non-obvious constant / choice (Rule 6); no `.reduce()` in the trait projection — explicit `for...of` (Rule 7/8); ESM + `node:` imports (Rule 13); JSDoc on the new predicate branch / matcher / describe cases.
- Architecture (`.claude/rules/architecture.md`): reveal-rule parsing + matching is pure engine; no I/O, no `Math.random()`; `revealPredicateMatches` **reads** `G.cardTraits` and never mutates `G`; zones hold `CardExtId` strings only (traits resolved via `G.cardTraits`, never stored card objects). No layer crossing.
- **Canonical-array lockstep (code-style §Drift Detection, D-24024):** adding `'team'` and `'hero-class'` to `RevealPredicateKind` requires updating the union, the `REVEAL_PREDICATE_KINDS` array, the `revealRule.test.ts` drift assertion, AND a DECISIONS entry (D-24550) **together**. Never one without the others.
- **Faithful non-match disposition is leave-on-top.** Part A MUST route these cards through the reveal-rule handler (non-match stays on top), NOT `investigate` (non-match → bottom). A change that moves a non-matching revealed card off the top is a FAIL.
- The `requiresTeam` / `heroClassMatch` suppression fires **only** on a reveal line whose `[keyword:reveal:…]` token carries a trait predicate matching the co-located `[team:X]`/`[hc:X]`; do not suppress on any other line (the `lineHasRevealFromHand` precedent — a scoped `lineHas*` flag).
- The predicate value is read from the marker token slug (`normalizeTraitSlug`), matched against printed `G.cardTraits`; never a hardcoded literal.
- Marker edits touch only the `abilities[i]` text of the four resolved cards — no other card field. `VALID_TOKEN_PATTERN` gains the trait-predicate reveal alternative **only** (a closed-set extension noted in-comment, D-21601 lineage); no other apply-script change.
- **Part B is copy-only:** an article-aware `'a'`/`'an'` choice on the existing message; no condition/behavior change, no new field, no re-pin.

---

## Scope

### In — Part A (Card Shark reveal-rule team/hero-class predicate)

- **`rules/revealRule.ts`:** add `'team'` and `'hero-class'` to the `RevealPredicateKind` union + `REVEAL_PREDICATE_KINDS` array; add a trait-value field to `RevealPredicate` (e.g. `traitValue?: string`) carrying the normalized slug for the two trait kinds. Update the `revealRule.test.ts` drift/parity assertion.
- **`setup/heroAbility.setup.ts`:** extend `parseRevealPredicateToken` to parse `team-<slug>` → `{ kind:'team', traitValue }` and `hc-<slug>` → `{ kind:'hero-class', traitValue }` (`normalizeTraitSlug`; `hc`→`hero-class`, the D-24281 convention). Add a `lineHasRevealTraitCriterion` `lineHas*` flag (a `[keyword:reveal:…]` line carrying a trait predicate) and consult it in the Step 1b `requiresTeam` / Step 1a `heroClassMatch` guards so the co-located `[team:X]`/`[hc:X]` reveal criterion is suppressed (the reveal-from-hand precedent).
- **`hero/heroEffects.execute.ts`:** thread the peeked `topCardId` into `revealPredicateMatches` (currently `(G, predicate, cost)`); add `team` / `hero-class` branches that project the card's traits via the `investigateCardMatchesCriteria` model and match `predicate.traitValue`. `applyRevealRules` already holds `topCardId` — pass it. No disposition change (leave-on-top preserved).
- **`hero/revealLog.ts`:** `describeRevealPredicate` renders the `team` / `hero-class` predicates for the reveal-outcome log line (e.g. "an X-Men card" / "an Instinct card").
- **`apply-hero-ability-markers.mjs`:** extend `VALID_TOKEN_PATTERN` with the trait-predicate reveal alternative (`^\[keyword:reveal:(team|hc)-[a-z][a-z0-9-]*:draw\]$` or equivalent) — a closed-set extension with a `// why:` note.
- **`inputs/hero-ability-markers.json`:** apply rows — `core/gambit/card-shark` idx 0 → `[keyword:reveal:team-x-men:draw]`; `dead/hydra-half-wit` idx 0 → `[keyword:reveal:team-hydra:draw][keyword:reveal:team-shield:draw]`; `pttr/crescent-moon-darts` idx 0 → `[keyword:reveal:hc-instinct:draw][keyword:reveal:hc-tech:draw]`; `ssw2/balanced-attack` idx 0 → `[keyword:reveal:hc-tech:draw][keyword:reveal:hc-strength:draw]` (exact ability indices confirmed at scaffold).
- **Tests (new):** drift parity (`revealRule.test.ts`); predicate parse + suppression (`heroAbility.setup.test.ts`); matcher + **leave-on-top disposition** end-to-end for a matching and a non-matching reveal (`heroEffects.execute.test.ts`); describe wording (`revealLog.test.ts` if present).
- **Regenerated** `data/cards/{core,dead,pttr,ssw2}.json` + the four card-derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`); `sim:coverage` baseline refreshed if the hook universe grows.

### In — Part B (X-Gene article grammar, bundled)

- **`hero/heroConditions.evaluate.ts`** (~719): article-aware wording for the discard-pile class message — `` `it needs a${/^[aeiou]/i.test(condition.value) ? 'n' : ''} ${condition.value} card in your discard pile` `` (or an explicit `'an'`/`'a'` branch), so `instinct` → "an instinct" and strength/covert/tech/ranged keep "a".
- **`hero/heroConditions.evaluate.test.ts`:** a test asserting the "an instinct" wording for the vowel-initial class (and a consonant-initial class still reads "a").

### Out

- No `investigate` change; no new `HeroKeyword` / `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` / `RevealActionKind` edit (only `RevealPredicateKind` grows). `draw` already exists.
- **Honest-Partial — deferred cards** (same `[keyword:reveal:…]` family, but out of this WP's tractable set): the `co2e/…` Card Shark 2e ("…draw it. Otherwise, discard it or put it back." — a `choose-discard-or-return` disposition), any gated (`[hc:X]:` / `[keyword:X]:` prefix) reveal, and any Fight/villain reveal. They stay hollow, resolved by a follow-up once the predicate exists.
- No pending choice / resolve move / bgio move / `UIState` field / arena-client surface (the reveal auto-resolves; `draw` is synchronous).
- No scoring / PAR / RNG-config / persistence / identity surface. Part B is copy-only.

---

## Files Expected to Change

**Part A**
- `packages/game-engine/src/rules/revealRule.ts` — `RevealPredicateKind` + `REVEAL_PREDICATE_KINDS` + `RevealPredicate.traitValue`
- `packages/game-engine/src/rules/revealRule.test.ts` — drift/parity for the two new kinds
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `parseRevealPredicateToken` trait branches + `lineHasRevealTraitCriterion` suppression
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — parse + suppression tests
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `revealPredicateMatches` trait branches + `topCardId` threading
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — matcher + leave-on-top disposition tests
- `packages/game-engine/src/hero/revealLog.ts` — `describeRevealPredicate` team/hero-class rendering
- `packages/game-engine/src/hero/revealLog.test.ts` — describe wording (if the file exists; else fold into an execute test)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` trait-predicate reveal alternative
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 4 apply rows (core/dead/pttr/ssw2)
- `data/cards/core.json`, `data/cards/dead.json`, `data/cards/pttr.json`, `data/cards/ssw2.json` — regenerated (appended markers)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated (+ `sim:coverage` baseline if hook-universe grows)

**Part B**
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — article-aware wording (~719)
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — "an instinct" / "a strength" assertions

(Determinism: `core/gambit/card-shark` is a **CORE** card, so if a committed sentinel/fixture plays it, `finalStateHash` may move — verify empirically and re-pin honestly per `reference_hashed_g_field_dual_repin`. The three siblings are non-core, like X-23. Part B adds no hashed field.)

---

## Contract

- New `RevealPredicateKind` members `'team'` and `'hero-class'`; `RevealPredicate` gains `traitValue?: string`. A `team` predicate matches iff the peeked card's projected teams include `traitValue`; a `hero-class` predicate matches iff its projected `heroClass`/`heroClass2` equals `traitValue` (the `investigateCardMatchesCriteria` projection).
- Marker grammar: `[keyword:reveal:team-<slug>:draw]` / `[keyword:reveal:hc-<slug>:draw]` (parameterized `REVEAL_RULE_PATTERN`; `hc`→`hero-class` at parse). Multiple tokens on one line = multiple first-match-wins rules (inclusive OR by construction).
- Non-match disposition is **unchanged**: an unmatched reveal stays on top of the deck.
- Resolved cards (idx confirmed at scaffold): `core/gambit/card-shark` (`team:x-men`), `dead/hydra-half-wit` (`team:hydra`+`team:shield`), `pttr/crescent-moon-darts` (`hc:instinct`+`hc:tech`), `ssw2/balanced-attack` (`hc:tech`+`hc:strength`).
- Part B: the X-Gene `heroClassInDiscardPile` failed-condition message becomes article-correct; the condition semantics are unchanged.

---

## Acceptance Criteria

1. Playing **Card Shark** reveals the top card of the acting player's deck; if it is an X-Men Hero the card is drawn, otherwise it **stays on top** (asserted deck-order equality) — never sent to the bottom.
2. **Card Shark no longer emits a `requiresTeam` gate:** the parser suppresses the co-located `[team:x-men]` (a synthetic parse test asserts no `requiresTeam` condition and a reveal descriptor with a `team` predicate `traitValue:'x-men'`). The live "needs another x-men Hero" log line no longer fires.
3. The three siblings (`dead/hydra-half-wit`, `pttr/crescent-moon-darts`, `ssw2/balanced-attack`) each draw on a matching reveal (either criterion) and leave a non-match on top; their inline `[team:X]`/`[hc:X]` tokens are suppressed from the play-gate.
4. `REVEAL_PREDICATE_KINDS` and `RevealPredicateKind` both carry `'team'` + `'hero-class'`; the `revealRule.test.ts` drift assertion passes; no other canonical array/union changes (`RevealActionKind`, `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS` unchanged).
5. The reveal-outcome log line for a matching reveal names the criterion ("an X-Men card" / "an Instinct card"), routed through the display path (no raw marker syntax shown).
6. Deferred cards stay hollow: the `co2e` Card Shark 2e and any gated/Fight reveal variants are unchanged and still listed where applicable in `runtime-observed-hollows.json`.
7. **Part B:** the X-Gene failed-condition message reads "an instinct card in your discard pile" for `instinct`; a consonant-initial class ("a strength card") is unchanged; the condition's true/false behavior is byte-identical.
8. `data/cards/{core,dead,pttr,ssw2}.json` carry the appended markers; `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0; the four cards show `reveal`/`draw` `executable` in the hero mechanic ledger.
9. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0. `finalStateHash` verified: unchanged, or re-pinned honestly with the reason recorded if a committed sentinel plays Card Shark.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass (drift + parse + suppression + matcher + disposition + Part-B grammar tests).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 4 lines" (or the exact count); re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check` → all 0; `pnpm sim:coverage --check` → 0 (regen with `--update-baseline` first if the hook universe grew — auto-memory `reference_sim_coverage_baseline_gate_distinct`).
4. `pnpm -r build && pnpm -r --no-bail test` → repo-green (build before test; stale `dist` fakes failures).
5. Determinism: run the sentinel/replay tests; if `finalStateHash` moved, confirm it is Card Shark's CORE reveal (not an unrelated regression) and re-pin the affected fixture with a `// why:` note — never hand-edit to force green.
6. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); revert any `lagn-v1.json` CRLF build churn.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only.
- [ ] D-24550 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Card Shark reveals the top card and draws it on an X-Men Hero (leaving a non-match on top), with no "needs another x-men Hero" line; and an X-Gene failed condition on an instinct-class card reads "an instinct card". Verified against the deployed `/api/version` gitSha; recorded as a follow-up STATUS-flip, not a merge blocker.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2/§10 (card content semantics — faithful implementation of a printed ability, including the deck-order-preserving non-match disposition), §3/§8 (determinism — the reveal reads hashed `G` deck + `G.cardTraits`; `draw` shuffles via `ctx.random`; no `Math.random`).
- **How honored:** the mechanic is implemented in its faithful home (reveal-rule, leave-on-top) rather than an approximation that changes deck order (`investigate`, bottom); the Honest-Partial deferral keeps the hollow signal truthful for the unmodeled variants; no pay-to-win surface (NG-1) — a reveal predicate is gameplay, not a purchasable advantage.

## §20 Funding Surface — N/A

This WP touches none of the §20.1 trigger surfaces: it is a card-semantics reveal-rule/parser change plus a game-log copy fix in the Game Engine, with no monetization, entitlement, checkout, pricing, Legendary Pass, or revenue-reporting surface. No funding-gate content is required.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1–3 (identity / status / layer):** `## Goal`, `## Assumes`, `## Context (Read First)` present; `**User-Visible Surface:**` + `## User-Visible Impact` present. Layer = Game Engine (reveal-rule grammar + parser + condition message) + Card Data.
- **§4 (scope closed):** `## Scope (In Part A / In Part B / Out)` is a closed enumeration; the allowlist matches EC-766 `Files to Produce`.
- **§5 (output completeness):** `## Files Expected to Change` lists every touched file incl. regenerated feeds, split by part.
- **§6 (naming):** `RevealPredicateKind`, `traitValue`, `lineHasRevealTraitCriterion`, `revealPredicateMatches` — full words; card field names (`heroClass`, `heroClass2`, `abilities`) match 00.2.
- **§7 (dependencies):** WP-479/D-24286+D-24024, WP-659/D-24470, WP-564/D-24373, WP-179/D-24074, WP-723/D-24544 all landed on `34694804` (verified — the reveal-rule grammar + leave-on-top disposition, the `lineHas*` suppression, `investigateCardMatchesCriteria`, `G.cardTraits`, and the X-Gene message all present).
- **§8 (architecture):** pure engine parser + matcher + log-copy; no I/O; reads `G`, never mutates in the matcher; no layer crossing.
- **§9–10 (Windows / env):** no shell, no env vars.
- **§11 (auth):** N/A — no endpoint / auth surface.
- **§12 (tests):** `node:test`, `.test.ts`, `makeMockCtx`; new drift + parse + suppression + disposition + grammar tests fail loudly on regression; the disposition test asserts leave-on-top for the right reason.
- **§13–15 (verification / AC / DoD):** present and testable; §15 D-24026 live-verify item present.
- **§16 (code style):** explicit `for...of` trait projection, no `.reduce()`; small matcher branch; `// why:` on the new predicate kinds, the suppression flag, the trait projection, and the `VALID_TOKEN_PATTERN` closed-set extension.
- **§17 (Vision):** triggered (card semantics + determinism) → `## Vision Alignment` present.
- **§18 (prose-vs-grep):** verification uses runnable commands (§Verification Steps), not prose claims.
- **§19 (bridge-vs-HEAD):** baseline `34694804` cited; no stale-bridge artifacts.
- **§20 (funding):** `## §20 Funding Surface — N/A` with justification present.
- **§21 (API catalog / D-11804):** N/A — no HTTP endpoint or `apps/server` library-surface change.

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

- **Dependencies complete on `main`:** verified at `34694804` — the parameterized reveal-rule grammar (`RevealPredicate`/`REVEAL_PREDICATE_KINDS`/`REVEAL_RULE_PATTERN`/`revealPredicateMatches`/`applyRevealRules`), the leave-on-top non-match disposition, the `lineHas*` co-located-token suppression (reveal-from-hand), `investigateCardMatchesCriteria` trait projection, `G.cardTraits`, the curated reveal-marker apply pipeline, and the WP-723 X-Gene message.
- **Cited authority/contracts on `main`:** D-24024 / D-24286 (reveal-rule grammar), D-24470 (suppression), D-24373 (investigate matcher), D-24281 (the `<team|hc>:<value>` predicate convention), D-24544 (X-Gene message) all present; the four sibling card texts confirmed as onPlay hero abilities (`hc` field, single ability, no "otherwise" clause).
- **Scope locked:** the allowlist is closed (Part A: 7 engine files incl. tests + apply script + curated map + 4 regenerated card files + 4 feeds; Part B: 2 files); one new canonical-array kind pair; no `HeroKeyword`/handler drift; no client.
- **Validation-tightening?** No — Part A is additive card-semantics resolution (a new predicate kind + markers); it does not make previously-accepted input newly-rejected. Existing cost-reveal cards parse byte-identically. The scaffold-first empirical gate is therefore not mandatory, but the executor MUST run the engine suite and the apply-idempotency + `:check` gates before govern-close, and confirm the `finalStateHash` outcome empirically (CORE card).
- **Ambiguities resolved:** the mechanism fork (reveal-rule predicate vs investigate vs dedicated keyword) is decided and recorded in D-24550, confirmed with the operator; the card family (Card Shark + 3 same-shape siblings) is locked with the Honest-Partial deferral set enumerated.

**Verdict: READY TO EXECUTE.**

## Copilot (01.7) — self-review

- **Reward integrity:** no test/gate is weakened; the disposition test asserts the card leaves a non-match **on top** (the faithful behavior), so the four cards fire *for the right reason*; the deferred variants stay hollow (the honest signal), not silenced.
- **Faithfulness over convenience:** the mechanism was chosen on a fidelity basis (leave-on-top) against the origin brief's `investigate` steer, because `investigate` would change deck order — the reward-integrity "faithful behavior over the easy path" posture.
- **Honest-Partial:** the deferral (co2e 2e "otherwise" disposition, gated, Fight/villain) is documented with a concrete reason (a different disposition / gate the predicate alone does not cover).
- **Determinism:** the matcher reads hashed `G.cardTraits` + deck, adds no hashed field; CORE Card Shark may move `finalStateHash` → verify empirically and re-pin honestly (the WP does not pre-assert "unchanged").
- **Layer/contract:** the one contract change (a `RevealPredicateKind` pair) is recorded in D-24550 with the canonical-array lockstep; no cross-layer wiring; Part B is copy-only.
- **Bundling:** Part B is trivial and cleanly isolated from Part A (different file, no shared surface); if Part A grows under scaffold, Part B splits to its own SPEC (noted in Context).

**Verdict: PASS.**
