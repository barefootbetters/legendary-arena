# EC-817 — Penumbra: play both sides of a Divided Card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-780-penumbra-play-both-sides.md
**Layer:** Game Engine + card data

## Before Starting
- [ ] D-24618 (#2446, merged `9dff9dba`) is on your base: Penumbra's hook carries `unresolvedMarkers: ['rule:divided-card']`.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline count).
- [ ] Read the CURRENT `HERO_KEYWORDS` length and `HERO_EFFECT_HANDLERS` count pins; bump from those, not from any number in this EC.
- [ ] Check whether the split-face discard-cost WP (#2443) is on `main`; record which WP §Context branch applies.
- [ ] Re-verify the data premise: no split face's ability text says "this card"; Penumbra is the only "play both sides" card. Else STOP.
- [ ] EXACT target file set = `## Files to Produce`; any other file is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- HeroKeyword `'play-both-sides'`: appended last to the union and `HERO_KEYWORDS`; joins `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`; timing `onPlay`.
- Marker map entry (cvwr): `{ "heroSlug": "cloak-dagger", "cardSlug": "penumbra", "abilityIndex": 0, "markupToken": "[keyword:play-both-sides]" }`.
- `TurnEconomy.isPlayBothSidesActive?: true` is set by the handler (idempotent). `TurnEconomy.bothSidesPlayedCardIds?: CardExtId[]` holds face-a entry ids in play order.
- Both fields are lazy, carried by `carryConversionFlag`, and dropped by `resetTurnEconomy` (no new reset code).
- Writers: `enablePlayBothSides(economy)` and `markBothSidesPlayed(economy, cardId)` in `economy.logic.ts`.
  - They are pure rebuilds with `...carryConversionFlag`, and the append builds a new array (mirror `enrollExcessiveViolenceCard`).
  - Callers assign `G.turnEconomy = …`. No direct field write, no `push`.
- `playedCardIdsThisTurn(G, inPlay)` in `hero/splitCard.logic.ts` reads `G.turnEconomy?.bothSidesPlayedCardIds` and replaces each listed entry in place with `[faceA, faceB]`. With no `turnEconomy`, no marker, or a null pair, it returns a fresh copy of `inPlay`.
- Log lines (exact; all four use outcome `'neutral'`):
  - `Player N played <faceA label, empty clause>.` with `card = faceA`. This is the only `PLAYED_LINE` match.
  - `Penumbra: both sides of <faceA label> play as two different cards.` with `card = faceA`.
  - `Player N resolved side a: <label+economy>.` with `card = faceA`.
  - `Player N resolved side b: <label+economy>.` with `card = faceB`.
- `playBothSplitFaces(G, context, playerID, cardId): boolean` in `moves/splitFaceChoice.resolve.ts` runs the WP sequence exactly:
  0. If `playerZones` is missing, return `true` before any mutation (a silent no-op). If `pair === null`, return `false` so `playCard` falls through to the existing park path (never lose the card).
  1. Append `faceA` (a face-b id normalises to face a), then log the played line and the Penumbra line.
  2. Grant face a, log it, fire face a.
  3. Mark the entry in `bothSidesPlayedCardIds`.
  4. Grant face b, log it, fire face b.
  5. Set `lastPlayEffectsFired = a + b`.
- `playCard` branch: when `isSplitCardInstance && G.turnEconomy.isPlayBothSidesActive === true && playBothSplitFaces(...)`, return. Otherwise use the existing park path unchanged.
- The D-24618 Penumbra fixtures (`hero/ruleTokenHollow.test.ts` and `heroEffects.execute.test.ts` ~L4977) stay as `[rule:X]`-only detector fixtures, retitled as the **pre-marker** line. AC-1 is the as-generated pin; say so in the commit body.
- The expanded and unexpanded read-site lists are exactly WP §Locked Contract Values.
  - Rule: rules-facing Hero trait / count reads expand; target, physical and VP reads do not.
  - The Electromagnetic Bubble target list (`tacticHandlers` ~L1203) and Blood Frenzy (`bloodFrenzy.logic.ts`) stay physical.
- Pins to bump (read current values): 3 `HERO_KEYWORDS` length pins, 2 `HERO_EFFECT_HANDLERS` count pins (WP §Assumes).

## Guardrails
- One physical card = one `inPlay` entry. Never push face b into `inPlay`.
- The marker is recorded BETWEEN the faces (after face a fires, before face b fires). Face a never sees face b.
- Self-exclusion stays `playedCardId === triggeringCardId`. Face b fires with its face-b id.
- Absent/empty marker → every read byte-identical; sentinel `finalStateHash` NOT re-pinned; no new top-level `G` field.
- Physical reads (UI counts, snapshots, invariants, cleanup, KO / Copy Powers targets, scoring) are NOT converted.
- Card data changes only via the marker map + apply script; never hand-edit `data/cards/cvwr.json`.
- Moves never throw; `for...of` only; no `.reduce()`; full file contents in edits; functions ≤30 lines per 00.6.
- Tests: `node:test` + `node:assert`, `makeMockCtx`; no `boardgame.io` import, no network/DB.
- Zone-ambiguous read site (not on either list) → STOP and ask; never guess.

## Required `// why:` Comments
- `playedCardIdsThisTurn`: cite Penumbra "as if they were two different cards"; one physical entry, expanded only for "played this turn" reads.
- `playBothSplitFaces` marker placement: why between the faces (sequential play; face a cannot see face b).
- Face-a normalisation: why a played face-b id becomes one face-a entry.
- `playCard` branch: why Penumbra skips the choose-a-side park (rules v23 p.49 overridden by the card).
- Each converted call site: a rules-facing Hero trait / count read, so a both-sides card counts as both faces.

## Files to Produce
- `rules/heroKeywords.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` — **modified** (lockstep + pins)
- `setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` — **modified** (parse `play-both-sides`)
- `hero/heroEffects.execute.ts` + `hero/heroEffects.execute.test.ts` — **modified** (handler, sets, count pin)
- `economy/economy.types.ts`, `economy/economy.logic.ts` (+ `economy.logic.test.ts`) — **modified**
- `hero/splitCard.logic.ts` + `.test.ts`, `moves/splitFaceChoice.resolve.ts` + `.test.ts` — **modified**
- `moves/coreMoves.impl.ts` — **modified** (playCard branch; `01.5` runtime wiring)
- `hero/{heroConditions.evaluate,heroCountSource.resolve}.ts`, `rules/tacticHandlers.ts` (~L613 only),
  `villain/villainEffects.execute.ts`, `moves/villainDefeatRequirement.logic.ts` — **modified** (expanded reads)
- Sibling `*.test.ts` of those read-site files — **modified** (family tests incl. AC-7c; list them in the summary)
- `hero/penumbraPlayBothSides.test.ts` — **new** (AC-1..AC-9 end-to-end)
- `hero/ruleTokenHollow.test.ts` — **modified** (retitle the Penumbra fixture as the pre-marker line)
- (paths above are under `packages/game-engine/src/`)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified**: add `^\[keyword:play-both-sides\]$` to `VALID_TOKEN_PATTERN`, with a `// why:` citing D-24619. The D-21601 allowlist rejects the token otherwise.
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `data/cards/cvwr.json` — **modified**
- Derived (regenerate only on a real diff): `data/metadata/{card-mechanics,effect-implementation-index}.json`,
  `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `docs/ai/coverage/runtime-observed-hollows.json` + `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pin
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `wiki/split-card.md` — **modified**

## After Completing
- [ ] `pnpm -r build` and `pnpm -r --no-bail test` 0 failures; engine before/after counts recorded.
- [ ] AC-7 revert proof run once and reported: card C's draw and the count of 4 fail on raw `inPlay`. Face b's assertion is NOT the proof.
- [ ] `cards:check`, `sim:coverage --check`, `sim:runtime-observed:check`, `ledger:heroes:check`, `effect-index:check`,
      `mechanics:metadata:check`, `ledger:numbers:check`, `roadmap:counts:check` exit 0.
- [ ] Runtime-observed: no diff, or a diff confined to the cvwr board, attributed in the commit body, then
      regenerated once with the dashboard pin re-pinned to the fresh values.
- [ ] Sentinel `finalStateHash` / replay fixtures unchanged.
- [ ] `git status --porcelain` ⊆ Files to Produce (revert line-ending-only build churn).
- [ ] D-24619 → Active; STATUS entry; WORK_INDEX `[x]`; EC_INDEX EC-817 Done; mindmap `📝`→`✅`; `roadmap:counts:write`.
- [ ] `wiki/split-card.md` gains a Penumbra section.
- [ ] Live-on-surface (D-24026): Penumbra then a Cloak & Dagger split card shows no picker and both faces land;
      record the matchId in STATUS.

## Common Failure Smells
- Picker still appears after Penumbra → the flag was lost in an `addResources` rebuild (`carryConversionFlag` miss).
- Penumbra still a `rule:divided-card` hollow → the marker was not applied or not parsed (a parse-time D-24618 Step 4b outcome).
- Penumbra parses but the picker still appears, with no hollow → the keyword is missing from `NO_MAGNITUDE_KEYWORDS`, so the handler is safe-skipped and the flag is never set.
- Bubble offers a face-b id, or Blood Frenzy VP ≠ `computeFinalScores` → a physical read was expanded.
- Cleanup discards two cards / duplicate-id invariant trips → face b was pushed into `inPlay`.
- Face a's superpower fires off face b → the marker was recorded before face a fired.
- Sentinel hash moved → a field was seeded at setup or the helper is not identity on an absent marker.
