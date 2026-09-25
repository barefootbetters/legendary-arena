# EC-794 — Haunt keyword engine (Execution Checklist)

**Source:** docs/ai/work-packets/WP-757-haunt-keyword-engine.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline `origin/main` ≥ `d09d0946`; worktree clean and synced.
- [ ] Every WP-757 Assumes anchor still holds:
  - HQ 5-tuple + index-preserving `refillHqSlot`;
  - `recruitHero` order, heal lock and `hasActedThisTurn`;
  - `collectEligibleHqIndices`, `getEligibleGiveHqHeroCards`, `buildDefeatWithBystanderTargets`;
  - reveal push → escape → `onAmbush`;
  - primitive parity 25 and selector union;
  - the inline escape branch `villainDeck.reveal.ts:294-448` (no shared helper) and `buildPureFuryTargets` (`heroEffects.execute.ts:~4261`);
  - the lockstep sites;
  - `ai.competent` scores.
- [ ] `pnpm -r build` → 0; engine suite green; the card/feed gates green. RE-READ every drift count now.

## Locked Values (do not re-derive)
- `type HqHaunter = { kind: 'villain'; cardId: CardExtId } | { kind: 'mastermind' }`
- `G.hqHaunters?: (HqHaunter | null)[]` — length 5, index-aligned, created on the first haunt ONLY.
- Move `exorciseHauntedHero({ hqIndex, outcome: 'ko' | 'gain', recipientPlayerId? })`, registered `client: false`.
- Exorcise order:
  1. args
  2. cost = `cardStats[heroId].cost`
  3. stage `main`
  4. recruitHero's block-all guards
  5. `hasHealedThisTurn`
  6. spend + `hasActedThisTurn = true`
  7. outcome (`'ko'` → `G.ko`; `'gain'` → recipient's discard)
  8. clear haunter
  9. refill
  10. release
- Primitive `'haunt-hq-hero'`. Selector union widened append-only with `'leftmost' | 'cost-lte-3'`; the `capture-hq-hero` parser still rejects them.
- Selector semantics:
  - `rightmost` = highest unhaunted non-null index;
  - `leftmost` = lowest;
  - `cost-lte-3` = lowest-index with `cardStats` cost ≤ 3.
- Markers under `mdns/fallen`:
  - `metarchus.ambush ["haunt-hq-hero:rightmost"]` (keep its `fight`);
  - `atrocity.ambush ["haunt-hq-hero:leftmost"]`;
  - `patriarch.ambush ["haunt-hq-hero:cost-lte-3"]`.
- `mechanic-provenance.json`: `"haunt-hq-hero": { "wp": "WP-757", "decision": "D-24587" }`.
- UIState:
  - `UIHQHaunter = { kind: 'villain'; extId; display: UICardDisplay } | { kind: 'mastermind' }` (exported from `index.ts`);
  - `hq.haunters?`;
  - `mastermind.isHaunting?: true`.
  - Both public, both omit-when-absent.
- Bot:
  - exorcise intents (`outcome: 'gain'`, self) go after the `fightMastermind` step, `hqIndex` ascending;
  - `SCORE_EXORCISE_BASE = 75`.

## Guardrails
- Omit-when-absent `hqHaunters`: never seeded, never written empty → hash oracles stay byte-stable.
- Do NOT edit the existing HQ removal sites. Index-keyed state lets the refill inherit the haunter.
- Recruit block goes in exactly four places:
  1. `recruitHero`;
  2. `collectEligibleHqIndices`;
  3. `getEligibleGiveHqHeroCards` / `selectDefaultGiveHqHeroCard` — ONLY when the entry has `filter`;
  4. the `ai.legalMoves` recruit intents.
- Extract the escape branch of `performVillainReveal` (`villainDeck.reveal.ts:294-448`) MECHANICALLY into the exported `resolveVillainEscape(G, context: RevealContext, implementationMap: ImplementationMap, escapedCardId)`. The existing reveal tests must pass unchanged.
- `enterCityIgnoringAmbush(G, context: RevealContext, implementationMap: ImplementationMap, cardId) (`context` = `RevealContext`; the move passes `DEFAULT_IMPLEMENTATION_MAP`)` lives in `villainDeck/villainDeck.enterCity.ts`. It pushes the card to space 0 and calls `resolveVillainEscape` for any card pushed out. That gives full parity, including escape→Scheme-Twist. It never fires `onAmbush` and never copies Secret Invasion.
- `fightMastermind`, BOTH free-defeat builders (`buildDefeatWithBystanderTargets` and `buildPureFuryTargets`) and the bot intents all use the one predicate `isMastermindHaunting`.
- The Ambush handler nulls the Villain's City space when it haunts. When no slot is eligible, the Villain stays and a log line is written. The handler writes exactly one `pushLog` line, with no double narration. The `ambushResolved` `citySpace` 0 fallback is accepted and asserted.
- UIState five-step, in order: types → build (embed `display`) → filter pass-through → audience test → diagnostics snapshot.
- Engine only. Do not touch `apps/server/src/autoplay/*` (it is a separate follow-up).

## Required `// why:` Comments
- `hqHaunters` field: D-24587. Per-slot and omit-when-absent (hash stability); index-keyed so refills inherit the haunter.
- Each recruit-block site: rulebook — you can't recruit a Haunted Hero, including for free; "gain" and put-bottom stay allowed (hence the `filter` gate).
- `enterCityIgnoringAmbush`: exorcise is not a reveal, and escape keeps reveal parity.
- Heal lock + `hasActedThisTurn`: exorcise spends like a recruit.
- `cost-lte-3`: deterministic v1 of "an unhaunted Hero" — a named fidelity gap (D-24587).
- `fightMastermind` + free-defeat exclusion: the Mastermind can't be fought while haunting.
- The `mastermind` haunter kind ships before its producer (WP-758) so the contract never reopens.
- `SCORE_EXORCISE_BASE = 75`: an exorcise frees a Hero and unlocks a fight, so it ranks above recruit and below fight.

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified**
- `board/haunt.logic.ts` + test — **new**
- `moves/exorciseHauntedHero.ts` + test — **new**
- `moves/recruitHero.ts`, `rules/tacticHandlers.ts`, `moves/giveHqHeroChoice.resolve.ts`, `moves/fightMastermind.ts`, `moves/defeatChoice.resolve.ts`, `hero/heroEffects.execute.ts` (+ each test) — **modified**
- `villainDeck/villainDeck.reveal.ts` (+ test) — **modified** (mechanical `resolveVillainEscape` extraction)
- `villainDeck/villainDeck.enterCity.ts` + test — **new**
- `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts` (+ each test) — **modified**
- `invariants/gameRules.checks.ts` + `invariants.test.ts` — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + audience-filter test — **modified**
- `game.ts`, `game.test.ts`, `index.ts` — **modified**
- `simulation/ai.legalMoves.ts` (+ test), `simulation/ai.competent.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts` — **modified**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/mdns.json` + the feeds (effect-index, card-mechanics, villain ledger json/csv, runtime-observed; the sim:coverage baseline only if flagged) — **regenerated**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0; engine suite passes; `pnpm -r --no-bail test` → 0 fail.
- [ ] `apply-effect-markers.mjs` is idempotent. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:villains:check`, `sim:runtime-observed:check` and `sim:coverage --check` all → 0.
- [ ] `finalStateHash` unchanged, or honestly dual-re-pinned.
- [ ] D-24587 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] `git diff --name-only` ⊆ Files to Produce. Two-commit topology.
- [ ] Live-verify (D-24026) on a human-driven match: a post-deploy STATUS-flip, shared with WP-759.

## Common Failure Smells
- A haunted Villain is still fightable → the Ambush handler didn't null its City space.
- Invariant red / Villain duplicated → it was recorded as a haunter without leaving the City.
- The exorcised Villain fires its Ambush → the entry went through the reveal pipeline.
- A pushed-out Villain escapes silently → Secret Invasion's handling was copied instead of calling `resolveVillainEscape`.
- Existing reveal tests fail → the extraction wasn't mechanical.
- Pure Fury defeats a haunting Zarathos → `buildPureFuryTargets` is missing the predicate.
- Dark Technology offers a haunted Hero → the `filter`-gated exclusion in `giveHqHeroChoice.resolve.ts` is missing.
- Bot FAULT or turn-cap on a Fallen seed → a haunted recruit intent was offered, or the exorcise guard and the intents disagree.
- The client shows a hyphenated id → the haunter `display` wasn't embedded.
- A hash oracle moved → `hqHaunters` became always-present.
