# WP-904 — Infiltrate the Conspiracy's "+3 Attack if 4 Bystanders and/or Undercover Heroes in your Victory Pile" gate (Game Engine + card data)

**Status:** Draft 2026-11-19 (EC-942; D-24861 reserved, #3451) — pre-flight READY TO EXECUTE; copilot RISK→HOLD (two scope-neutral fixes folded, verdict stands); 00.3 PASS
**Layer:** Game Engine (one condition-marker keyword, a new on-play Victory-Pile count condition, its evaluate + describe + count helper) + card data (one curated marker, one `VALID_TOKEN_PATTERN` arm, regenerated `bkwd.json`)
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules on one bkwd hero line (an ungated grant becomes conditional, lowering a phantom score), a new engine condition type, card data and derived feeds; `finalStateHash` sentinels byte-identical (no core card prints this line); no auth, money, persistence, server or client surface
**Hard-deps:** WP-745 / D-24568 (origin; the unmarked-"If <condition>, you get +N" marker→condition sweep — this is its follow-up H) ✅, WP-653 / D-24464 (`bystandersInVictoryAtLeast` = Savior's present-state Victory-Pile count, the sibling the new condition widens) ✅, WP-678 / D-24494 (the `zones.undercover` tracker: a Hero sent Undercover lives in `victory` AND in `undercover`) ✅, WP-901 / D-24858 (Undercover-your-hero — the reason Heroes now actually reach the Victory Pile, and the reason this line's phantom grant became visible) ✅

## Goal

Make Black Widow's **Infiltrate the Conspiracy** (`bkwd`, cost 7) line 1 do what it prints. Today the line —

> "You get +3[icon:attack] if you have at least 4 Bystanders and/or Undercover Heroes in your Victory Pile."

carries no marker, so `buildHeroAbilityHooks` reads only the `+3[icon:attack]` (Step 2b) and grants it **on every play**, ignoring the printed condition. After this WP a curated marker gates the +3 on a new on-play condition that counts Bystanders **plus** Undercover Heroes in the player's Victory Pile and fires the +3 only at ≥ 4. The +3 does not vanish; it becomes conditional.

## User-Visible Impact

`play.legendary-arena.com`: playing Infiltrate the Conspiracy no longer grants a free +3 Attack. The +3 is granted only when the acting player holds at least 4 Bystanders and/or Undercover Heroes in their Victory Pile; otherwise the card gives only its printed 4+ base Attack. The coach's "ability did not apply" line reads "it needs 4 Bystanders and/or Undercover Heroes in your Victory Pile — you have N." Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` at or after the WP-904 reserve merge (#3451), on top of `fe8f44bf4`. Capture `git rev-parse origin/main` at execution and cite it.
- **Parse today** (observed at `fe8f44bf4` via `buildHeroAbilityHooks` on committed `data/cards/bkwd.json`, `heroes[0].cards[3]`): Infiltrate the Conspiracy
  - line 0 → `{ keywords: ['undercover-your-hero'], effects: [{ type: 'undercover-your-hero' }], conditions: [] }` (WP-901, landed).
  - line 1 → `{ keywords: ['attack'], effects: [{ type: 'attack', magnitude: 3 }], conditions: [] }` — **an ungated +3 Attack** (the bug).
- `HeroCondition { type: string; value: string; … }` (`rules/heroAbility.types.ts`) — `type` is an **open string**, not a closed union, so a new condition type needs no union or drift-array update (contrast `HeroKeyword`).
- `bystandersInVictoryAtLeast` (`hero/heroConditions.evaluate.ts`): `evaluateCondition` scans `playerZones.victory` for `BYSTANDER_EXT_ID` or an id starting `bystander-villain-deck-`; `describeFailedCondition` calls the private `countBystandersInVictory(G, playerID)`. The condition is **not** in `WAIT_AND_SEE_CONDITION_TYPES`, `PLAY_HISTORY_CONDITION_TYPES`, `ORDER_SAFE_ENABLER_CONDITION_TYPES`, or `matchReadsConditionType` — a present-state read evaluated on play.
- The `bystanders-threshold` parser arm (`setup/heroAbility.setup.ts`, WP-745): a condition-marker keyword (**not** a `HeroKeyword`, not in `HERO_KEYWORDS`) matched in the per-token loop; `keywordMatch[2]` is its `:N`; it pushes `{ type: 'bystandersInVictoryAtLeast', value: N }` and is consumed before the unresolved-marker fallback (no hollow).
- A Hero sent Undercover (WP-678 `sendCardUndercover` / WP-901 `moveCardUndercover`) is appended to `playerZones.undercover` and moved into `playerZones.victory`; the tracker is **append-only** (Unleash from Undercover is not implemented — no removal site). `BYSTANDER_EXT_ID` is exported from `setup/pilesInit.js`; bystander ids never appear in `undercover`.
- `data/cards/bkwd.json` is GENERATED; markers come from `scripts/convert-cards/inputs/hero-ability-markers.json` via `apply-hero-ability-markers.mjs`, whose `VALID_TOKEN_PATTERN` (D-21601 closed set) must list every token and whose `assertValidToken` message enumerates the locked forms.

## Context (Read First)

- **Rules (primary text).** `docs/legendary-universal-rules-v23.md`:
  - §Undercover (~L2043-2047): "Some cards say things like 'You may send one of your other Heroes Undercover.' This means 'Put that Hero into your Victory Pile. It's worth 1 Victory Point.'" So an Undercover Hero **is** a card in the Victory Pile.
  - Savior (~L1845-1846): "Use this ability if you have at least 3 Bystanders in your Victory Pile." The present-state Victory-Pile count the sibling condition models; Infiltrate's clause is the same shape, widened to "Bystanders **and/or** Undercover Heroes" at threshold 4.
  - Ability ordering (~L2607): "Do each of a card's abilities, one at a time, in the order listed." — the basis of the design fork below.
- **Count semantics (settled).** "Bystanders and/or Undercover Heroes in your Victory Pile" = every Victory-Pile card that is a Bystander (`BYSTANDER_EXT_ID` or a rescued `bystander-villain-deck-*`, the `bystandersInVictoryAtLeast` scan) **or** an Undercover Hero (a Victory-Pile card that is also in `playerZones.undercover`). The count is `victory ∩ (bystanders ∪ undercover)`; a Bystander and an Undercover Hero are disjoint id spaces, so no card double-counts. Counting by **membership in `victory`** (not `undercover.length`) is Unleash-proof: a Hero later Unleashed out of the Victory Pile leaves `victory` and stops counting even if the append-only tracker still holds its id.
- **DESIGN FORK — ordering of line 0 → line 1 (RECOMMENDED: Reading A; confirm at review).** Infiltrate line 0 "You may send one of your Heroes Undercover" parks a declinable `PendingUndercoverChoice` that resolves **after** commit (WP-901). Line 1's +3 Attack is a static on-play grant evaluated **at play-commit**, while line 0's choice is still parked. The rules resolve abilities top-to-bottom, so a strictly faithful reading would count the Hero line 0 is about to send; the engine cannot see a choice that resolves later without deferring the grant.
  - **Reading A (recommended, drafted):** evaluate the count **on play, present-state** — the same-play parked Undercover send is **not** counted. Precedent-consistent: D-24568 §1 (amended) classifies a condition whose input is a present-state zone read (not a turn-event accumulator) as on-play, and the sibling `bystandersInVictoryAtLeast` (Savior, and Black Widow's own `covert-operation` / `humanitys-final-hope` `bystanders-threshold:4` lines) evaluates on play. Minimal surface; determinism-simple; the only divergence is the narrow boundary where the player holds exactly 3 going into the play **and** line 0 sends the 4th.
  - **Reading B (rules-exact, not drafted):** defer line 1's +3 and re-evaluate the count after `resolveUndercoverChoice` runs (the `resolveDeferredHeroGrants` / wait-and-see machinery, D-24476 / D-24792). Materially larger — a new same-card cross-line deferred linkage into the determinism-sensitive pending-choice subsystem.
  - **Verdict:** drafted as **Reading A** for precedent consistency and minimal determinism surface; the divergence is a single-card, boundary-only +3. If the operator prefers the strictly-faithful Reading B, the executing session (01.0b) re-scopes to the deferred-grant path before implementing — this WP's Scope/Files assume Reading A.
- **Marker, not a text arm.** Unlike D-24746 (a bare `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN` text gate), the fix is a **curated marker** (`hero-ability-markers.json` → `apply-hero-ability-markers.mjs`), the `bystanders-threshold` precedent (WP-745): the condition is card-specific and the printed literal ("at least 4 … Victory Pile") is shared verbatim with the bystanders-only Savior clause, so a text pattern on the literal alone cannot tell "Bystanders" from "Bystanders and/or Undercover Heroes" apart. A dedicated marker keyword names the widened count unambiguously.
- **Bare line stays descriptive.** The `+3[icon:attack]` grant (Step 2b) stays on the hook; the appended `[keyword:bystanders-or-undercover-threshold:4]` adds only the gating condition (the `bystanders-threshold` arm's behaviour). No bare-token suppression is involved (line 1 carries no other keyword).
- **Phantom-grant family.** This is the same unmarked-conditional-attack family as D-24746 ("played at least N other cards"), D-24471 (condition-icon suppression), D-24486 (negative-magnitude icons) and D-24605 (adversary-stat icons): an unmarked conditional line Step 2b reads as an ungated grant. WP-901's landing (Heroes now reach the Victory Pile) made the over-grant visible, but the +3 has applied unconditionally since the card shipped.
- **Hash safety.** No new `G` key. The condition is pushed into `G.heroAbilityHooks` at `Game.setup`, only for Infiltrate's hook, and only when that card is in the loadout. The `finalStateHash` sentinels (core Black Widow + Captain America) carry no card printing this line, so no sentinel match ever builds this hook or writes the condition — sentinels serialize byte-identically. A moved sentinel is a STOP. In-flight matches keep their old hooks (built at setup); replays of pre-WP-904 Infiltrate matches re-execute to a lower Attack total (the phantom +3 is removed) — a faithful correction, scoped like every WP-745 gate (D-24616 §5: stored `competitive_scores` rows stay frozen).
- **Governance to scan before coding.** `docs/ai/DECISIONS.md` D-24568, D-24746, D-24471, D-24486, D-24605, D-24464, D-24494, D-24858, D-24616, D-24372, D-24026. `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup (§5.1 `[keyword:X]` token types) — the new marker. `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, Principle #1, §Persistence Boundary; `.claude/rules/architecture.md`. `docs/ai/REFERENCE/00.6-code-style.md` for every file.

## Scope (In)

- **Marker** (`hero-ability-markers.json`, in the **`bkwd` set block**): append
  `{ "heroSlug": "black-widow", "cardSlug": "infiltrate-the-conspiracy", "abilityIndex": 1, "markupToken": "[keyword:bystanders-or-undercover-threshold:4]" }`
  next to the existing Infiltrate `abilityIndex: 0` `[keyword:undercover-your-hero]` entry (NOT the `apocalyptic-black-widow` block, which also carries a `bystanders-threshold:4` entry). `apply-hero-ability-markers.mjs`: `VALID_TOKEN_PATTERN` gains `^\[keyword:bystanders-or-undercover-threshold:[1-9]\d*\]$` (next to the `bystanders-threshold` arm) and `assertValidToken`'s locked-forms message lists it. Regenerate `bkwd.json` (zero-diff on a second run).
- **Parser** (`setup/heroAbility.setup.ts`, **two edits in this file**):
  1. A new condition-marker arm `normalizedKeyword === 'bystanders-or-undercover-threshold'`, placed next to the `bystanders-threshold` arm (L2178) and before the unresolved-marker fallback. Reads `keywordMatch[2]` (the `:N`; absent → no push, the `:N` guard) and pushes `{ type: 'bystandersOrUndercoverInVictoryAtLeast', value: N }`. The keyword is **not** a `HeroKeyword` (no `HERO_KEYWORDS`, no length pin, no handler) — a condition marker, the `bystanders-threshold` precedent.
  2. Add `'bystanders-or-undercover-threshold'` to the exported `HERO_PARSER_RECOGNIZED_MARKER_NAMES` list (next to `'bystanders-threshold'` at L471). Without it the coverage probe (`scripts/hero-effect-coverage.mjs`, `isParserRecognizedForHero`) records a **false hollow** for bkwd Black Widow that flows into the regenerated `sim:runtime-observed` / `ledger:heroes` / coverage feeds — contradicting the "no hollow" claim. The two edits are mutually guarded: the data-driven pin at `heroAbility.setup.test.ts:2025` auto-generates a passing "reaches its parser arm" case once both the list entry and the arm exist, and FAILS loudly if the name is listed but the arm is unreachable.
- **Condition** (`hero/heroConditions.evaluate.ts`):
  - `evaluateCondition` case `bystandersOrUndercoverInVictoryAtLeast` → `countBystandersOrUndercoverInVictory(G, playerID) >= parseInt(value, 10)` (NaN threshold → false).
  - `describeFailedCondition` case (the switch at L1248, beside the `bystandersInVictoryAtLeast` case at L1326) → `it needs ${value} Bystanders and/or Undercover Heroes in your Victory Pile — you have ${count}`.
  - A new private `countBystandersOrUndercoverInVictory(G, playerID)`: scan `playerZones.victory`; a card counts if it is a Bystander (`BYSTANDER_EXT_ID` or `startsWith('bystander-villain-deck-')`) **or** is in `new Set(playerZones.undercover ?? [])`. `for...of`, no `.reduce()`.
  - **Not** added to `WAIT_AND_SEE_CONDITION_TYPES`, `PLAY_HISTORY_CONDITION_TYPES`, `ORDER_SAFE_ENABLER_CONDITION_TYPES`, or `matchReadsConditionType` (on-play present-state, mirrors `bystandersInVictoryAtLeast`).
- **Derived feeds / coverage.** Regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`, and the dashboard `prebuild:coverage`; commit only real diffs (the gate's ungating changes Infiltrate's observed behaviour). Add one pending `live-verify.json` row for Infiltrate line 1 (D-24026). No new keyword, so **no** `mechanic-provenance.json` row.
- **Tests** (new `hero/infiltrateVictoryPileGate.test.ts`, hooks parsed from committed `bkwd.json`): parse — Infiltrate line 1 carries `{ type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }` and keeps `effects: [{ type: 'attack', magnitude: 3 }]`, with no bare ungated grant and no unresolved marker; evaluate — 3 bystanders → false; 4 bystanders → true; 3 bystanders + 1 Undercover Hero → true; 4 Undercover Heroes → true; a Victory-Pile card neither a Bystander nor Undercover → not counted; an `undercover` tracker id **absent from `victory`** (Unleash-robustness) → not counted; NaN/garbage threshold → false; describe — the exact message with the running count. A regression asserting the hook no longer grants an unconditional attack (contrast the pre-WP-904 parse).

## Out of Scope

- **Reading B (deferred re-evaluation after the Undercover resolve).** Documented as the fork above; not drafted. If chosen, re-scope at 01.0b.
- Line 0's Undercover mechanic (WP-901, shipped) and any change to `resolveUndercoverChoice`, `PendingUndercoverChoice`, or the Undercover client prompt.
- Unleash from Undercover (removal from the Victory Pile); the `bystandersInVictoryAtLeast` (Savior / bystanders-threshold) condition and any card using it.
- Any new `HeroKeyword`, `HERO_KEYWORDS` entry, handler, `CORE_MOVE_NAMES`, `G` field, phase or stage; client, server, registry or persistence changes.

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — one `bkwd` entry (Infiltrate abilityIndex 1).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN` arm + `assertValidToken` locked-forms message.
- `data/cards/bkwd.json` — **modified (generated)** — the appended marker on Infiltrate line 1; never hand-edited.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — TWO edits: (1) the new condition-marker arm; (2) `'bystanders-or-undercover-threshold'` added to `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (declared L431; insert next to the `'bystanders-threshold'` entry at L471) so the coverage probe records no false hollow.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — `evaluateCondition` + `describeFailedCondition` cases + `countBystandersOrUndercoverInVictory`.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `docs/ai/coverage/live-verify.json` (one pending row); dashboard data copies (gitignored `apps/dashboard/src/data/*`, not committed); `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Tests: `packages/game-engine/src/hero/infiltrateVictoryPileGate.test.ts` (new); `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` (only if a condition-enumeration or describe-parity pin needs the new case).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24861), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/post-mortems/` (01.6 if a new-contract trigger fires — a new condition type is a candidate).

## Non-Negotiable Constraints

- Full file contents for every modified file — no diffs, no snippets; ESM only; Node v22+; human-style code (`00.6-code-style.md`).
- Determinism: no randomness, clocks or I/O; `evaluateCondition` reads `G` and returns a boolean, never mutates; `for...of`, no `.reduce()`; no nested ternaries.
- `G` stays JSON; **no new `G` key**. `finalStateHash` sentinels serialize byte-identically — **no re-pin**. A moved sentinel is a STOP.
- The count reads `victory ∩ (bystanders ∪ undercover)` by **membership in `victory`** (Unleash-proof), never `undercover.length`.
- Card data via the marker source + reproducible regen; never hand-edit `bkwd.json`. No per-card special-casing in the parser or evaluator (the condition is keyword-driven, not a card id check).
- Reading A is drafted; the parked same-play Undercover send is not counted. Switching to Reading B requires re-scoping at 01.0b (new files, new gates).

**Session protocol:** STOP and report if: Infiltrate line 1 still parses to an ungated attack after the marker; a sentinel or `finalStateHash` moves; the `bkwd.json` regen is not zero-diff on a second run; the operator chooses Reading B (re-scope).

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- Marker keyword `bystanders-or-undercover-threshold` (a condition marker, not a `HeroKeyword`); token `[keyword:bystanders-or-undercover-threshold:N]`; `VALID_TOKEN_PATTERN` arm `^\[keyword:bystanders-or-undercover-threshold:[1-9]\d*\]$`; a member of `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (so the coverage probe sees it as parser-recognized, not a hollow).
- Condition type `bystandersOrUndercoverInVictoryAtLeast` (`HeroCondition.type` open string): on-play, present-state; met iff `count(victory ∩ (bystanders ∪ undercover)) >= N`. Not a wait-and-see, play-history, order-safe-enabler, or match-read condition.
- `countBystandersOrUndercoverInVictory(G, playerID): number` (private to `heroConditions.evaluate.ts`).
- Infiltrate line 1 hook after this WP: `{ effects: [{ type: 'attack', magnitude: 3 }], conditions: [{ type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }], keywords: ['attack'] }`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine).
- **No conflict:** a printed conditional that is silently unconditional today becomes conditional as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — removing a phantom free +3 Attack cannot be bought.
- **Determinism preservation:** no randomness; no new `G` key; sentinels byte-identical. Replays of pre-WP-904 Infiltrate matches re-execute to a lower (correct) Attack total; stored `competitive_scores` rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A — no funding, nav or account surface; a single in-game attack grant becomes conditional.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Infiltrate line 1 parses to `effects: [{ type: 'attack', magnitude: 3 }]` **with** `conditions: [{ type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }]`; no ungated attack, no unresolved marker.
2. The condition is met iff the acting player holds ≥ 4 cards in their Victory Pile that are Bystanders and/or Undercover Heroes, counted by membership in `victory`; a Bystander and an Undercover Hero never double-count; a tracker id no longer in `victory` does not count; a non-qualifying Victory-Pile card does not count.
3. The grant is evaluated on play (present-state); the same-play parked Undercover send from line 0 is not counted (Reading A).
4. `describeFailedCondition` returns `it needs 4 Bystanders and/or Undercover Heroes in your Victory Pile — you have N`.
5. The condition is absent from `WAIT_AND_SEE_CONDITION_TYPES`, `PLAY_HISTORY_CONDITION_TYPES`, `ORDER_SAFE_ENABLER_CONDITION_TYPES`, and `matchReadsConditionType`.
6. `cards:check` reproduces `bkwd.json`; a second `apply-hero-ability-markers.mjs` run is zero-diff; every card-derived feed `:check` exits 0.
7. `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` sentinels unchanged with no pin edited.

## Verification Steps

- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `bkwd.json` changes; a second run is zero-diff.
- `pnpm -r build` — 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each 0 (plus `sim:coverage --update-baseline` only if its check fails).
- `pnpm -r --no-bail test` — 0 fail, per-package totals recorded (record the engine delta; expect roughly +8 engine tests in the new file).
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` — each 0.
- At close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `node scripts/check-number-ledger.mjs --check` — 0.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail.
- [ ] Feeds regenerated, every `:check` green; one pending live-verify row present.
- [ ] `finalStateHash` sentinels byte-unchanged (no pin edited).
- [ ] **Live-on-surface (D-24026):** an operator match **created after the deploy** with bkwd Black Widow: Infiltrate the Conspiracy played below 4 Bystanders/Undercover Heroes grants no +3 Attack, and at ≥ 4 grants it. The pending `live-verify.json` row (or a STATUS note) **explicitly records the accepted Reading-A boundary**: with exactly 3 qualifying cards going in, line 0's send of a 4th does NOT retroactively grant the +3 (the on-play count is read before the parked send resolves) — so the gap is documented, not latent. Confirmed live in its own `SPEC:` PR, or operator-pending in `STATUS.md` with the row.
- [ ] `STATUS.md`; D-24861 → Active; `WORK_INDEX.md` `[x]` + `[live-verify: pending]`; `EC_INDEX.md` Done; mindmap ✅ + `roadmap:counts:write`; NUMBER-LEDGER LANDED; 01.6 post-mortem if the new-contract trigger fires.
- [ ] No files outside `## Files Expected to Change` modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24861 — Infiltrate the Conspiracy's unmarked "+N Attack if you have at least N Bystanders and/or Undercover Heroes in your Victory Pile" gates through a curated marker `[keyword:bystanders-or-undercover-threshold:N]` → a new on-play condition `bystandersOrUndercoverInVictoryAtLeast`, the Savior/`bystandersInVictoryAtLeast` present-state precedent (D-24464) widened to also count Undercover Heroes (`victory ∩ undercover`, by membership — Unleash-proof). The count is evaluated **on play, present-state** (Reading A): the same-play Undercover send parked by the card's line 0 is not counted, because a static on-play grant cannot read a choice that resolves after commit, and D-24568 §1 classifies a present-state zone read as on-play (the strictly-faithful top-to-bottom Reading B, deferring the grant past `resolveUndercoverChoice`, is the documented alternative — not drafted). Extends the unmarked-conditional-attack phantom-grant family (D-24746, D-24471, D-24486, D-24605); WP-745 follow-up H; made visible by WP-901 / D-24858.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent, 2026-11-19):** NOT READY — one blocking item, no scope-category change. PS-1: the new condition-marker name `bystanders-or-undercover-threshold` was named in the parser arm but not in the exported `HERO_PARSER_RECOGNIZED_MARKER_NAMES` list (`heroAbility.setup.ts:431`, the `bystanders-threshold` mirror at L471); without it `scripts/hero-effect-coverage.mjs` (`isParserRecognizedForHero`) records a **false hollow** for bkwd Black Widow that corrupts the regenerated `sim:runtime-observed` / `ledger:heroes` / coverage feeds. Folded as a second edit to `heroAbility.setup.ts` across WP §Scope/Parser, §Files, §Contract and EC §Locked Values / §Files to Produce, with the mutual-guard note (`heroAbility.setup.test.ts:2025` auto-covers the name). RS-1 (hard-confirm whether a condition-enumeration / describe-parity pin in `heroConditions.evaluate.test.ts` must gain the case) and RS-2 (the marker goes in the `bkwd` set block, not `apocalyptic-black-widow`) folded. All other technical claims verified accurate at HEAD: the parser arm (L2178) + `keywordMatch[2]`, the `bystandersInVictoryAtLeast` evaluate/describe, the append-only `undercover` tracker, the marker pipeline, dependencies landed, and sentinel safety (the printed line / token matches `bkwd.json` only; no core card).
- **Pre-flight round 2 (independent subagent):** **READY TO EXECUTE** — PS-1 fully resolved in all five sections; the mutual-guard claim verified in source (the `for (const markerName of HERO_PARSER_RECOGNIZED_MARKER_NAMES)` loop at `heroAbility.setup.test.ts:2025`); RS-1 / RS-2 addressed; all four cited line numbers (431, 471, 2178, 2025) accurate; no regression. (A later one-line cosmetic reword of the §Files line-number annotation — "declared L431; insert next to the entry at L471" — does not change scope, contract or files and leaves the verdict standing.)

- **Copilot check (independent subagent, 2026-11-19):** RISK → HOLD, two scope-neutral fixes folded, verdict then stands with no pre-flight re-run (scope unchanged). (#27/#15) the EC and WP named a non-existent `describeCondition`; the describe switch is `describeFailedCondition` (`heroConditions.evaluate.ts:1248`, the `bystandersInVictoryAtLeast` case at L1326) — renamed in all seven sites and the placement pinned. (#18/#26) the accepted Reading-A boundary (hold exactly 3 qualifying; line 0 sends the 4th → the +3 does not apply) was prose-only; the pending `live-verify.json` row now records it explicitly so the fidelity gap is documented, not latent. Verified against source: the sibling `bystandersInVictoryAtLeast` + `countBystandersInVictory`, the `bystanders-threshold` arm, `HERO_PARSER_RECOGNIZED_MARKER_NAMES` + its data-driven pin, `VALID_TOKEN_PATTERN`, and the Infiltrate `abilityIndex: 0` row all exist as described; the design fork is defensible (keep Reading A as default, override preserved); determinism, hash-safety and count-semantics (no off-by-one, no double-count, Unleash-robust) are sound; `matchReadsConditionType` correctly omitted (no lazy flag write). No `DECISIONS` / code-category / rules change triggered (`HeroCondition.type` is an open `string`).

## Lint Gate Self-Review (00.3)

Run as an independent subagent 2026-11-19. Round 1: FAIL on §15.2 only — the EC Risk Tier line was not byte-identical to the WP's (two reason-text divergences: "lowering a phantom score" and "(no core card prints this line)"). Fixed by making the EC line character-identical to WP line 6. Round 2: **PASS** — §15.2 verified byte-for-byte (both 315 chars, shell-equal); §1 structure, §5 Files (the second `heroAbility.setup.ts` edit reflected), §2 / §14 / §15 no regression; §4 / §6 / §17 / §20 / §21 clean; §11 (auth), §18 (prose-vs-grep), §19 (bridge-staleness) justified N/A.

- **§1 structure:** all 10 sections present and non-empty; Out of Scope names Reading B, the line-0 Undercover mechanic, Unleash-from-Undercover, and new `HeroKeyword` / `G` key / phase / client. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md`; packet-specific determinism / no-new-`G`-key / membership-count / sentinel-no-re-pin / Reading-A constraints; session protocol (four STOP triggers); locked values → EC. **PASS.**
- **§3 Assumes:** baseline at/after the WP-904 reserve; observed Infiltrate line-1 parse; `HeroCondition.type` open string; `bystandersInVictoryAtLeast` evaluate/describe + non-membership in the wait-and-see / play-history / order-safe / match-read sets; the `bystanders-threshold` parser arm + `keywordMatch[2]`; the append-only `undercover` tracker; `BYSTANDER_EXT_ID`; the marker pipeline; hard-deps WP-745 / 653 / 678 / 901 all ✅. **PASS.**
- **§4 Context:** rules v23 §Undercover / Savior / ability-ordering with line refs; the settled count semantics; the design fork; marker-not-text-arm; phantom-grant family; hash safety; 00.2 §5; ARCHITECTURE §Rule Execution Pipeline / Principle #1 / §Persistence Boundary; DECISIONS scan list; 00.6. **PASS.**
- **§5 files:** every file with role and marker; `heroAbility.setup.ts` two edits; `heroConditions.evaluate.test.ts` hard-confirm; generated/provenance feeds; no `mechanic-provenance.json` row (no new keyword). **PASS.**
- **§6 naming:** full words (`bystandersOrUndercoverInVictoryAtLeast`, `countBystandersOrUndercoverInVictory`); data slugs verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; Game Engine layer only; determinism explicit; no server / registry / DB / client edge. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks parsed from committed `bkwd.json`; no network, DB or `boardgame.io` import. **PASS.**
- **§13 verification:** exact commands with expected exits; zero-diff regen re-run; engine delta recorded. **PASS.**
- **§14 / §15:** 7 binary criteria; DoD names STATUS / DECISIONS (D-24861) / WORK_INDEX / EC_INDEX / mindmap / NUMBER-LEDGER / 01.6 + the scope-boundary diff; D-24026 live check on a post-deploy match; Risk Tier MEDIUM in WP and EC, byte-identical (§15.2). **PASS.**
- **§16 code-style:** `for...of`, no `.reduce()`, no nested ternaries; `// why:` locations listed in the EC; the count helper membership-based. **PASS.**
- **§17 Vision:** clauses §1 / §2 / §8, no-conflict line, NG-1 line, determinism line (replays re-execute to the corrected total, `competitive_scores` frozen per D-24616 §5). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** baseline SHA only. **N/A.** **§20 funding:** N/A with the statement. **§21 API catalog:** N/A (no endpoint or `apps/server` library function). **PASS.**

Copilot's two scope-neutral fixes (the `describeFailedCondition` rename and the Reading-A boundary live-verify note) are folded above and in §Verification / DoD; no lint section changed as a result (§5 Files and §15 DoD still PASS).
