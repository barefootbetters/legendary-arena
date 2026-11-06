# EC-900 — Size-Changing granted or removed during play: an HQ grant overlay read by the recruit price (Execution Checklist)

**Source:** docs/ai/work-packets/WP-862-size-changing-runtime-grants.md
**Risk Tier:** MEDIUM — gameplay pricing logic and new `G` state; no auth, money, persistence or server surface
**Layer:** Game Engine (HQ grant overlay, recruit price, villain primitive, hero keyword, two tactics, two seat-choice kinds) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] D-24801 (#3155), D-24802 (#3159) and the WP-862 / EC-900 / D-24804 reservation (#3163) on `main`.
- [ ] `pnpm -r build`, then game-engine, arena-client and dashboard `test` exit 0; record the counts (6269 / 2546 / 594 at draft).
- [ ] Re-probe Pym Particles (`antm/ant-man/pym-particles`) abilityIndex 1 (second line): `keywords: ['size-changing']`,
      `sizeChangingClasses: ['tech']`.
- [ ] Re-read at HEAD: the primitive list + its length pins in `villainAbility.types.test.ts` (38), the three `HERO_KEYWORDS`
      lengths (92), both `HERO_EFFECT_HANDLERS` counts (71), the `resolveSeatChoice` chain point, `endOfTurnCleanup` step numbering.

## Locked Values (do not re-derive; verify at HEAD)
- **Overlay:** `G.hqSizeChangingGrants?: HqSizeChangingGrant[]`; `HqSizeChangingGrant { cardId: CardExtId; classes: string[];
  replacesPrinted: boolean; expiresAtEndOfTurn: boolean }`; lazy at the first grant, deleted when empty; keyed by the copy-unique
  instance id.
- **Read (RS-1):** `getHqCardSizeChanging(G, cardId)` = printed `getSizeChangingClasses` / `getMicroscopicSizeChangingClasses`; when
  `G.hq` contains `cardId`, each grant for it in order: replace → classes = grant's, icons = []; add → union (no repeats).
  `hqCardHasSizeChanging` = either list non-empty. `resolveRecruitCost` (signature unchanged) prices through it.
  `applySizeChangingDiscount`, `resolveFightPrice`, `hasSizeChanging` unchanged.
- **Kinds:** `'size-changing-grant'` (`SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND`), `'size-changing-class-pick'`
  (`SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND`), in `hero/sizeChangingGrant.logic.ts`.
- **Contract:** `PendingSeatChoice.sizeChangingGrant?: { classes: string[]; replacesPrinted: boolean; sourceCardId: CardExtId }`
  (grant kind only); `SeatChoiceOption.heroClass?: string`.
- **Class order (local constant):** slugs `strength, instinct, covert, tech, ranged`; words `Strength, Instinct, Covert, Tech,
  Ranged`; lists "A", "A and B", "A, B and C". Never `HERO_CLASSES` order. Overlay / option class values are only these slugs; the
  writer and the apply ignore any other value.
- **Pick (RS-3):** eligible = non-null HQ cards (if-none: `hqCardHasSizeChanging` false); 0 → `blocked` "No Hero in the HQ can gain
  Size-Changing (<source>)."; 1 → apply now; ≥2 → `parkSeatChoice(G, undefined, choice, playerID)` + `neutral` "Player N chooses a
  Hero in the HQ to gain Size-Changing (<source>)."; options not-Haunted first, then `offPlayCardStats` cost descending, then lower
  slot; each `cardId`; `defaultOptionIndex: 0`. `G.pendingSeatChoice !== undefined` blocks only the park: `blocked` "Player N could
  not choose a Hero to gain Size-Changing — another choice is open (<source>)."
- **Labels:** `<Hero> gains Size-Changing <Classes> this turn`; replace `<Hero> loses its Size-Changing and gains Size-Changing
  <Classes> this turn`; class pick `<Hero> gains Size-Changing <Class>`.
- **Logs (RS-7):** `Player N gave <Hero> Size-Changing <Classes> this turn (<source>).`; replace `Player N made <Hero> lose its
  Size-Changing and gain Size-Changing <Classes> this turn (<source>).`; SRB `<Hero> gains Size-Changing <Class> while it stays in
  the HQ (Shrinking Research Budget).`; stale `<Hero> is no longer in the HQ, so it gains nothing (<source>).` (`blocked`). Source
  name via `resolveCardName`.
- **Lifetimes (RS-2):** this-turn `expiresAtEndOfTurn: true`, SRB `false`; Step 8 keeps only non-expiring grants whose card is in `G.hq`.
- **SRB (RS-4):** slot order; classes = distinct non-empty `offPlayCardTraits` `heroClass` / `heroClass2` in class order; 0 →
  `blocked` line, 1 → grant now, 2 → deferred; first deferred parks the class pick (`cardId` + `heroClass`, default 0); chain =
  fresh scan from slot 0 for the lowest-slot non-null card with no Size-Changing and two classes (only the seat is read BEFORE
  the apply). Source = `SHRINKING_RESEARCH_BUDGET_TACTIC_ID`, a string literal defined once in `hero/sizeChangingGrant.logic.ts`;
  `tacticHandlers.ts` imports it. No class → `blocked` "<Hero> has no Hero Class, so it gains nothing (Shrinking Research
  Budget)."; timeout: no further pick, no line. Open seat choice: single-class grants apply, picks dropped (one `blocked`).
- **Villain:** primitive `'hq-hero-gains-size-changing'` appended last (drift list + every length pin 38 → 39); descriptor
  `sizeChangingGrantMode?: 'if-none' | 'add' | 'replace'`, `sizeChangingGrantClasses?: readonly HeroClass[]` (not in
  `descriptorKey`); grammar exactly 3 parts; markers (fight): antm `ultrons-legacy/ultron-pym` `if-none:tech`, amwp
  `cross-technologies/shrinksperiments` `replace:tech`, chmp `monsters-unleashed/sporr` `add:tech+ranged`. Keyword-less: the
  executor records no result (no generic `Fight effect:` line, `fightResolved` unchanged); the handler self-narrates and returns
  `{ targets: [] }`. Villain / tactic lines carry the `Fight effect: ` prefix; Pym Particles lines do not.
- **Hero:** keyword `'hq-hero-gains-size-changing-tech'` appended last; `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`; handler
  `heroEffectHqHeroGainsSizeChangingTech` (`['tech']`, `'if-none'`); marker `{ "heroSlug": "ant-man", "cardSlug":
  "pym-particles", "abilityIndex": 1, "markupToken": "[keyword:hq-hero-gains-size-changing-tech]" }` (antm);
  `VALID_TOKEN_PATTERN` arm `^\[keyword:hq-hero-gains-size-changing-tech\]$` + error message.
- **RS-6 target hook:** `{ timing: 'onPlay', keywords: ['hq-hero-gains-size-changing-tech'], effects: [{ type:
  'hq-hero-gains-size-changing-tech' }] }` — suppress at Step 1a (`[hc:]` routing) AND Step 2 (`size-changing` keyword); no
  conditions, no unresolved markers.
- **Tactics:** `chmp-mastermind-fin-fang-foom-alien-dragon-technology` → `resolveAlienDragonTechnology` (all five, add, this turn);
  `amwp-mastermind-darren-cross-shrinking-research-budget` → `resolveShrinkingResearchBudget` (RS-4).
- **UI:** `matchHasSizeChangingCard` also true while `G.hqSizeChangingGrants !== undefined`.
- **Pins / provenance (sanctioned product-change edits, each citing WP-862 / D-24804):** `villainAbility.types.test.ts` length
  38 → 39, last-entry assert → `hq-hero-gains-size-changing`, WP-837 T1 `slice(34)` → `slice(34, 38)`; `HERO_KEYWORDS.length`
  92 → 93 at three sites + `expectedKeywords` (`rules/heroAbility.setup.test.ts`) appended; `HERO_EFFECT_HANDLERS` 71 → 72 ×2.
  `mechanic-provenance.json` `hq-hero-gains-size-changing-tech` / `hq-hero-gains-size-changing` → `{ "wp": "WP-862", "decision":
  "D-24804" }`; `tactic-provenance.json` both tactic ids → `{ "status": "executable", "handler":
  "packages/game-engine/src/rules/tacticHandlers.ts#<resolver>", "wp": "WP-862", "decision": "D-24804" }`.

## Guardrails
- Reuse the WP-684 seat choice: no new queue, move, `CoreMoveName`, UIState field or client file.
- Chain only at the live-move chain point in `resolveSeatChoice`, never inside a ctx-free apply; readers run before the apply.
- One grant writer (`addHqSizeChangingGrant`); every price read goes through `getHqCardSizeChanging` — no second copy of RS-1.
- Every apply re-checks that its card is still in `G.hq` (other resolve moves can change the HQ while a pick is open).
- No sentinel moves; `replay.execute.ts` untouched; `G.fightSizeChanging` and the setup maps never written after setup.
- Import cycles: imported bindings read only inside function bodies; kind constants are string literals.
- Moves never throw; no `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`; never edit a test to pass; never `git stash`.

## Required `// why:` Comments
- The overlay type and field (a removable per-instance fact, never the setup maps; lazy / omit-when-empty for hash stability).
- The in-HQ check in `getHqCardSizeChanging`; `matchHasSizeChangingCard`'s grant arm; the add dedupe (RS-1).
- Cleanup Step 8 (RS-2) and SRB's persistent lifetime (D-24804); the open-choice guard (WP-860 RS-1); the single-eligible
  immediate grant; Haunted-last ordering; the local class order.
- The RS-6 suppression (descriptive tokens) at both steps; the new primitive, keyword and marker arms (WP-862 / D-24804).

## Files to Produce
- `packages/game-engine/src/types.ts`, `hero/sizeChanging.logic.ts`, `moves/endOfTurnCleanup.logic.ts`,
  `moves/seatChoice.resolve.ts`, `ui/uiState.build.ts`, `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`,
  `villain/villainEffects.execute.ts`, `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `setup/heroAbility.setup.ts`,
  `rules/tacticHandlers.ts` — modified; `hero/sizeChangingGrant.logic.ts` — new.
- `scripts/convert-cards/apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `apply-hero-ability-markers.mjs`,
  `inputs/hero-ability-markers.json`; `data/cards/{antm,amwp,chmp}.json`.
- Generated / provenance: hero + villain ledgers `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`, `tactic-provenance.json`,
  `live-verify.json`, dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Tests: `hero/sizeChangingGrant.test.ts` (new; the WP Scope cases), `rules/villainAbility.types.test.ts`,
  `rules/{heroKeywords,heroAbility.setup}.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`, any
  test pinning Pym Particles' old line-2 parse.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24804), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client, dashboard `test` 0; sentinels byte-unchanged (no `finalStateHash` or golden-hash
      pin edited; only the sanctioned pins above change).
- [ ] Provenance + tactic-provenance + pending live-verify rows added BEFORE the ledgers; regenerated, then 0: `cards:check`,
      `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`,
      `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24804 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy; or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- Price never drops / a card off the HQ still discounted — a reader bypassed `getHqCardSizeChanging` or its in-HQ check.
- A price stays low next turn — cleanup Step 8 is missing, or it keeps expired grants.
- Pym Particles is still 2 cheaper — the RS-6 suppression missed the Step 1a routing or the Step 2 keyword.
- `recruitCosts` absent in a Sporr match with no Size-Changing Hero — `matchHasSizeChangingCard` lacks the grant arm.
- A bot freezes on the pick — an option with no `cardId`, or `defaultOptionIndex` out of range.
