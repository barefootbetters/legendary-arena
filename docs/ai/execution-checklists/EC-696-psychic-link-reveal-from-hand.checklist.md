# EC-696 — Psychic Link: Reveal-from-Hand → Draw (fix the spurious team gate) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-659-psychic-link-reveal-from-hand.md
**Layer:** Game Engine (+ card-data-derived feeds)

## Before Starting
- [ ] Re-baseline on `origin/main`; confirm the upstream mis-parse still stands: `scripts/convert-cards/inputs/cards/coreset.js` encodes Psychic Link with a **mid-sentence** `{ team: 4 }` (no leading `{team}:` gate), and `setup/heroAbility.setup.ts` Step 1b turns every `[team:X]` into a `requiresTeam` condition. If it differs, STOP: reconcile — the WP intent governs.
- [ ] Confirm the parser already suppresses mid-sentence `[hc:X]`/`[team:X]` on **size-changing / copy-powers / resolved-investigate** lines (Step 1a/1b) — the new reveal-from-hand suppression is the SAME pattern, not a rewrite of the general extractor.
- [ ] Confirm `InvestigateCriterion` (`rules/heroAbility.types.ts`) exports `{ kind: 'team' }` / `{ kind: 'hero-class' }` — reused as the reveal criterion (no new criterion type).
- [ ] Confirm the each-player seat order is `Object.keys(G.playerZones).sort()` (the `gain-wound-each` precedent) and that `heroEffectDraw` reshuffles through the single `ctx.random` envelope.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record the baseline pass count).

## Locked Values (do not re-derive)
- **Handler-bearing keyword lockstep TRIAD (all five edits move together — every prior handler keyword touched all three sites; a missed one fails a RUNTIME pin):**
  1. Add `reveal-from-hand` to the `HeroKeyword` union (`rules/heroKeywords.ts`) AND append `'reveal-from-hand'` to the `HERO_KEYWORDS` canonical array; **bump the count `38 → 39` in BOTH `HERO_KEYWORDS`-length pins** — `rules/heroKeywords.test.ts` (~L68, the `HERO_KEYWORDS.length === 38` assertion) AND `setup/heroAbility.setup.test.ts` (~L279, the drift assertion) — and append `'reveal-from-hand'` to the expected-order array in the drift assertion.
  2. Add `'reveal-from-hand'` to **`HANDLED_KEYWORDS`** (`hero/heroEffects.execute.ts` ~L90) — the bidirectional `deepStrictEqual(handlerKeys, HANDLED_KEYWORDS)` test (`heroEffects.execute.test.ts`) fails otherwise; `MVP_KEYWORDS` derives from it, so the ledger/hollow classification follows transitively.
  3. Register `reveal-from-hand: heroEffectRevealFromHand` in `HERO_EFFECT_HANDLERS` AND **bump the handler-count pin `24 → 25`** (`heroEffects.execute.test.ts`).
- Marker: **`[keyword:reveal-from-hand]`** — single-segment, no magnitude (the criterion is the co-located `[team:X]`/`[hc:X]` token the parser captures + suppresses).
- Effect descriptor: `{ type: 'reveal-from-hand', revealCriterion: InvestigateCriterion }`. **Arity (RS-1):** the printed "another X-Men Hero" is ONE criterion, so `revealCriterion` is **singular** (not the `investigateCriteria: InvestigateCriterion[]` array the reveal-top-of-deck path uses). If you reuse the `investigateCandidateMatches(criteria[], …)` helper, wrap the single criterion in a 1-element array at the call site; keep the descriptor field singular. Confirm the exact field name/arity at execution and keep it internally consistent.
- Behaviour: for each player in `Object.keys(G.playerZones).sort()`, if their **hand** holds ≥1 card matching `revealCriterion`, that player **draws 1**. Auto-reveal; **no** pending-choice park (D-24470).
- **"another" needs NO self-exclusion filter** — the played Psychic Link has already left the hand (it is in `inPlay`) before the effect runs, so any `team:x-men` card remaining in a player's hand qualifies. Do NOT add a triggering-card self-exclusion (that would wrongly suppress a second X-Men copy in hand).
- Card: `core/emma-frost/psychic-link`, ability index 0 (confirm; a cross-set grep of `scripts/convert-cards/inputs/cards/` for the printed text hits ONLY `coreset.js` — `core` is the sole in-scope set, but re-confirm at execution per the WP-656 co2e/nmut lesson).

## Guardrails
- **Marker-scoped suppression only.** Suppress the `[team:X]`/`[hc:X]` token from becoming a `requiresTeam`/`heroClassMatch` condition ONLY on a line carrying the reveal-from-hand marker (mirror the investigate `lineHasResolvedInvestigate` suppression). Do NOT change the general Step 1a/1b extraction — that broad fix is a separate WP.
- **No new `G` field.** The mechanic is a stateless hand-read + draw. Adding a `G` field would move both hash oracles (out of scope); if you think you need one, STOP.
- **Determinism:** `ctx.random.*` only (draw reshuffle); moves never throw; the handler safe-skips an empty/malformed hand or a no-match criterion (no throw).
- **Reveal is state-neutral:** the matched card STAYS in hand (reveal = show-and-keep). The only mutation is the draw. Do NOT move/discard/KO the revealed card.
- **The handler-bearing keyword lockstep triad** (union + `HERO_KEYWORDS`+count, `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`+count — see Locked Values) all move together; each is pinned by a **runtime** assertion (engine tests are not typechecked — D-24372). Add a NEGATIVE assertion that the old spurious `requiresTeam` gate is gone for the marked line.
- The `psychic-link` encoding is **regenerated by the pipeline, never hand-edited** (WP-633): a clean regen reproduces the committed `data/cards/*.json` byte-for-byte.
- Diamond Form is a HERO card family — regenerate the HERO feeds, not the villain ones: `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0 (run EVERY `:check` even where a feed shows no diff). Do NOT run `ledger:villains`. Confirm each diff is real (not LF/CRLF churn).

## Required `// why:` Comments
- The parser suppression: on a reveal-from-hand line the co-located `[team:X]`/`[hc:X]` is the reveal CRITERION, not a play-gate (mirrors the investigate/size-changing suppression); emit no condition for it.
- The handler: iterates players in `Object.keys(G.playerZones).sort()` seat order; each player holding a criterion match draws 1; reveal is state-neutral (card stays in hand); auto-reveal because the printed "may" is pure upside (D-24470).
- The auto-reveal decision (D-24470): why no pending-choice park (declining a pure-upside reveal is strictly dominated).

## Files to Produce
- `rules/heroKeywords.ts` — **modified** — add `reveal-from-hand` to the union + `HERO_KEYWORDS`.
- `rules/heroAbility.types.ts` — **modified** — the `reveal-from-hand` `HeroEffectDescriptor` variant (carrying the singular `revealCriterion`).
- `setup/heroAbility.setup.ts` — **modified** — marker recognition + token suppression + criterion capture + effect emission.
- `hero/heroEffects.execute.ts` — **modified** — `heroEffectRevealFromHand` + `HERO_EFFECT_HANDLERS` registry entry + `HANDLED_KEYWORDS` entry.
- `packages/game-engine/src/**/*.test.ts` — **modified/new** — AC-1..AC-6 coverage; **the lockstep-pin bumps** (`HERO_KEYWORDS` count `38→39` in BOTH `heroKeywords.test.ts` AND `heroAbility.setup.test.ts` + the order append, the `HANDLED_KEYWORDS ↔ handler-keys` bidirectional pin, the handler-count pin `24→25`); the negative-gate assertion; AC-4 must assert the emitted effect's `revealCriterion` **deep-equals** `{ kind: 'team', team: 'x-men' }` (not merely that an effect of that type exists — the descriptor field is optional-by-shape, so a type-only check can miss a dropped criterion).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) + `scripts/convert-cards/inputs/hero-ability-markers.json` (the curated entry) — **modified**.
- `data/cards/core.json` — **modified (regenerated)** — the re-encoded `psychic-link` line (+ other sets only if they carry the same text — confirm at execution).
- the regenerated HERO derived artifacts — **modified** — `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24470 Active), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record the pass count); `pnpm -r build` exits 0.
- [ ] Card-data regen reproduces the committed `data/cards/*.json`; `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0.
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regeneration, or a recorded, explained re-pin with before/after values if a draw reshuffle moves a sentinel).
- [ ] **Control run:** revert the handler (or the marker); AC-1/AC-3 tests fail (non-vacuous). Record the failure count.
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` match plays Psychic Link with an X-Men Hero in hand → draws a card, no "needs another x-men" block; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24470 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- Psychic Link still blocks with "needs another x-men Hero played this turn" → the marker suppression did not fire (the `[team:x-men]` still reached Step 1b), or the card-data marker was not applied.
- The card draws but the general parser was rewritten → a mid-sentence-token extractor change is out of scope; scope creep into other cards is a FAIL.
- A hash oracle moved → a `G` field was added (forbidden here) or a draw reshuffle perturbed a sentinel; investigate before re-pinning.
- `reveal-from-hand` added to the union but not `HERO_KEYWORDS` (or vice-versa) → the runtime drift test fails; add both.
