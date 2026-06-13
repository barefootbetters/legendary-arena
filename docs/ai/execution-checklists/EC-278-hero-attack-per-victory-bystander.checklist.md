# EC-278 — Hero Keyword: Attack Per Victory-Pile Bystander (Execution Checklist)

**Source:** docs/ai/work-packets/WP-247-hero-attack-per-victory-bystander.md
**Layer:** Game Engine (`rules/heroKeywords.ts`, `setup/heroAbility.setup.ts`,
`hero/heroEffects.execute.ts` + 2 test files) + card-data tooling
(`scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json`,
`data/cards/core.json`)

> Use locked values from WP-247 verbatim. EC-278 is the operational order + gates +
> failure smells; if EC-278 and WP-247 conflict, WP-247 wins.

## Before Starting
- [ ] **WP-022 landed** — `executeHeroEffects` switch + `MVP_KEYWORDS` +
  `isValidMagnitude` + the `attack` case (`G.turnEconomy = addResources(..., m, 0)`)
  exist. Verify: `grep -nE "MVP_KEYWORDS|case 'attack'|addResources" packages/game-engine/src/hero/heroEffects.execute.ts`.
- [ ] **WP-021/216 landed** — closed `HERO_KEYWORDS` + parity drift test; the
  `KEYWORD_PATTERN` / `ICON_MAGNITUDE_PATTERN` parser in `setup/heroAbility.setup.ts`;
  `VALID_TOKEN_PATTERN` + `assertValidToken` in `apply-hero-ability-markers.mjs`.
- [ ] `BYSTANDER_EXT_ID = 'pile-bystander'` in `setup/pilesInit.ts`; villain-deck
  bystanders are `bystander-villain-deck-NN` (`villainDeck.setup.ts`).
- [ ] Read WP-247 §Goal, §Non-Negotiable Constraints, §Acceptance Criteria.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (anchor the
  engine test count).

## Locked Values (verbatim from WP-247 — do not re-derive)
- **New keyword:** `'attack-per-victory-bystander'` — appended to the `HeroKeyword`
  union AND `HERO_KEYWORDS` array, just before `'conditional'`.
- **Magnitude semantics:** `magnitude` = per-bystander attack rate (Covert Operation
  = `1`); standard non-negative-integer gate; NOT in `NO_MAGNITUDE_KEYWORDS`.
- **Executor grant:** `G.turnEconomy = addResources(G.turnEconomy, magnitude * bystanderCount, 0)`.
- **Bystander count:** entries in `G.playerZones[playerID].victory` where
  `extId === BYSTANDER_EXT_ID` OR `extId.startsWith('bystander-villain-deck-')`. Both count.
- **Icon-suppression:** when `'attack-per-victory-bystander'` is in the line's
  keywords, drop `'attack'` from keywords AND delete its `magnitudes` entry before the
  effect-builder loop.
- **Timing:** `onPlay`.
- **Marker:** `setAbbr: 'core'`, `heroSlug: 'black-widow'`, `cardSlug: 'covert-operation'`,
  `abilityIndex: 0`, `markupToken: '[keyword:attack-per-victory-bystander:1]'`.
- **Token-form regex addition:** `^\[keyword:attack-per-victory-bystander:[1-9]\d*\]$`.

## Guardrails

> **Inherit all WP-247 §Non-Negotiable Constraints verbatim** (full file contents,
> ESM/Node 22, no `Math.random`, no `.reduce()` in effect logic, 00.6 human-style).
> EC-278 lists only the execution-critical contracts + greps + failure detection.

- **Drift (HARD).** The keyword goes in BOTH the union and the array, same index;
  the parity drift test must pass. One without the other = HARD FAIL.
- **Icon-suppression (HARD).** Without dropping the icon-derived `attack` on the
  marked line, Covert Operation grants `N` flat + `N×count` = double-count. The
  parse test MUST prove keywords contain `attack-per-victory-bystander` and NOT
  `attack`, with a single effect.
- **Count spans both bystander forms (HARD).** `pile-bystander` AND
  `bystander-villain-deck-NN` both count; villain/henchman/tactic victory cards do NOT.
- **Registry boundary.** The executor reads only `G` — no `@legendary-arena/registry`
  import; bystander classification is ext_id string matching. Import only the
  `BYSTANDER_EXT_ID` constant from `setup/pilesInit.js`.
- **Effects never throw; `G` JSON-serializable.** Guard `playerZones` + `G.turnEconomy`
  before mutating.
- **Card data is REGENERATED, not hand-edited.** Run the apply script; confirm only
  the covert-operation line in `core.json` changed.
- **Mark ONLY covert-operation.** Do not touch the other "+N per count" lines.

## Required `// why:` Comments
- `heroKeywords.ts` — `// why: D-24016` on the new union/array entry.
- `heroAbility.setup.ts` — `// why:` the count-scaled keyword subsumes the printed
  attack icon (D-24016; mirrors D-21901) — so the flat `attack` is dropped.
- `heroEffects.execute.ts` — `// why:` magnitude is the per-bystander rate; the count
  spans both bystander ext_id forms (`pile-bystander` + `bystander-villain-deck-NN`).
- `apply-hero-ability-markers.mjs` — `// why: D-24016` on the token-form addition.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — icon-suppression.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — MVP set + case.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — executor tests.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — drift + parse-suppression.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token validation.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — marker entry.
- `data/cards/core.json` — **modified** — regenerated covert-operation line.
- `docs/ai/STATUS.md` — **modified** — `### WP-247 / EC-278 Executed` block.
- `docs/ai/DECISIONS.md` — **modified** — D-24016 Reserved → Active (byte-identical to §Verbatim Block).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-247 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-278 Pending → Done.

**Total: 12 files** (8 source/data + 4 governance), per WP-247 §Files Expected to Change.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; net-new drift +
  parse-suppression + executor (N / 0 / mixed-forms / non-bystander / m≠1) cases; no regress.
- [ ] Drift grep: `grep -c "attack-per-victory-bystander" packages/game-engine/src/rules/heroKeywords.ts` = 2.
- [ ] Re-run `node scripts/convert-cards/apply-hero-ability-markers.mjs`; `git diff --stat
  data/cards/core.json` shows ONLY the covert-operation line changed.
- [ ] Registry-boundary grep: `grep -n "@legendary-arena/registry" packages/game-engine/src/hero/heroEffects.execute.ts` = 0.
- [ ] Parse-suppression test asserts the marked line → keywords include
  `attack-per-victory-bystander`, exclude `attack`; single effect.
- [ ] `git diff --name-only` = exactly the 12 files.
- [ ] STATUS updated; DECISIONS D-24016 Active byte-identical; WORK_INDEX WP-247 `[x]`;
  EC_INDEX EC-278 → Done.

## Commit Discipline (`.githooks/commit-msg` — enforced)
- Code path → prefix `EC-278:` (`SPEC:` rejected for code, D-20801). ≥ 12 chars after prefix.
- Avoid forbidden subject words (`WIP`, `fix stuff`, `misc`, `tmp`, `updates`,
  `changes`, `debug`).
- Co-staging `EC_INDEX.md` under `EC-278:` triggers a non-blocking Rule 6 warning — proceed.
- The drafting commit `SPEC: draft WP-247 + EC-278 [D-24016]` is docs-only — `SPEC:` valid there.

## Common Failure Smells
- Covert Operation grants `N` flat + `N×count` → icon-suppression not applied (the
  `attack` keyword/magnitude not dropped on the marked line).
- Keyword added to the union but not the array (or vice versa) → drift test fails.
- Bystander count misses `bystander-villain-deck-NN` (only matched `pile-bystander`)
  → undercount; the live repro had 8 villain-deck + supply bystanders.
- `data/cards/core.json` hand-edited instead of regenerated → drift from the marker map;
  or the apply script run touches more than the covert-operation line.
- A registry import sneaks into the executor → layer-boundary HARD FAIL.
- The token form not added to `VALID_TOKEN_PATTERN` → the apply script loud-fails on
  the new marker.

## DECISIONS.md Verbatim Block (PS-1 Transcription)

> The D-24016 entry lands in `docs/ai/DECISIONS.md` at draft time as
> `Reserved (proposed)` and flips to `Active` at execution close, byte-identical to
> the block below. Status is the only field that changes.

**D-24016: Hero Keyword `attack-per-victory-bystander` (Count-Scaled Attack; Icon Subsumption)**

A new closed-union hero keyword `attack-per-victory-bystander` grants attack equal to
`magnitude × (count of bystanders in the active player's victory pile)` when the hero
card is played (`onPlay`). `magnitude` is the per-bystander rate (Black Widow's Covert
Operation = `1`, printed "+1 Attack for each Bystander in your Victory Pile"); it is a
non-negative integer under the standard `isValidMagnitude` gate. The bystander count
spans BOTH supply-rescued bystanders (`BYSTANDER_EXT_ID = 'pile-bystander'`) and
villain-deck bystanders (`bystander-villain-deck-NN`); villain/henchman/tactic victory
cards are excluded. Classification is by ext_id string in the executor — no registry
lookup. Because the printed text carries "+N[icon:attack]", the setup parser would
otherwise also emit a flat `attack` effect (Step 2b/3 icon mapping); to prevent a
double-count, the parser SUPPRESSES the `attack` keyword + its magnitude on any line
that also carries `attack-per-victory-bystander` — the explicit count-scaled keyword
subsumes the attack icon (mirrors the D-21901 reveal-cost-attack icon-subsumption
intent). The marker token form `[keyword:attack-per-victory-bystander:N]` (N ≥ 1) is
added to `apply-hero-ability-markers.mjs`'s `VALID_TOKEN_PATTERN`; only
`core/black-widow/covert-operation` is marked in this packet. The broader "+N per
count" family (heroes played this turn, empty city spaces, hero classes/colors you
have, KO-pile counts, negative/fractional rates, recruit/draw scaling) is deferred to
follow-up WPs, each its own keyword. Determinism preserved (pure function of `G` at
play time; no RNG/clock); re-pin the replay sentinel only if it diverges (no fixture
plays Covert Operation).

**Packet:** WP-247 (EC-278).
**Drafted:** 2026-06-13 (reserved). **Landed:** TBD (execution close — flips to Active).
**Status:** Reserved (proposed)
