# WP-753 — Reveal-three assign (draw one / discard one / KO one) hero keyword (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-25 (EC-790; D-24580 reserved)
**Layer:** Game Engine (keywords + handlers + pending choice + resolve move + UIState) + Arena Client (choice prompt)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** D-24512 (Ruthless Dictator scry-3 — snapshot + one-card-per-call disposition slots, the `ko`/`discard`/`top` template) ✅, D-24521 (reveal-top-dispose hero keyword — the handler-bearing HeroKeyword + pending queue + resolve move + prompt recipe) ✅, D-24285 (reveal reshuffles / tops up the deck from the discard mid-reveal) ✅, D-24518 (parked pending-choice queues dropped at the winning turn's end, relocated by WP-732) ✅, D-24552 (Shenanigans draw lock, `turnEconomy.drawsLocked`) ✅

## Goal

Implement the printed hero ability **"Reveal the top three cards of your deck. Draw one of them,
discard one, and KO one."** so it stops silently doing nothing. The active player reveals their
deck's top three cards and assigns exactly one to each disposition (draw into hand / discard / KO).
Crystal of Kadavus's second line, **"[team:venomverse][team:venomverse]: Do this ability again."**,
repeats the whole reveal-and-assign on a fresh top three once the first is assigned.

## User-Visible Impact

`play.legendary-arena.com` — playing Crystal of Kadavus (vnom) or Interplanetary Visitor (3dtc,
dims) reveals the top three cards of the player's deck and prompts them to choose which one to
draw, which to discard and which to KO; the game waits for the choice (block-all), exactly like
Red Skull's Ruthless Dictator prompt. With the Venomverse synergy met, Crystal of Kadavus prompts
a second time on the next three cards. Today both cards grant only their printed attack; the
ability line does nothing (operator-observed live, match `ZIXtvedI6la`, 2026-09-24: Crystal played
turns 22 and 24 with no reveal, no choice, no log line). Live-on-surface is operator-pending (D-24026).

## Assumes

Verified at `origin/main` `04a6d0ab` (the D-24580 reserve):

- **`packages/game-engine/src/types.ts`** carries `RuthlessDictatorDisposition = 'ko'|'discard'|'top'`
  (L590) + `PendingRuthlessDictatorChoice { choiceType; playerID; revealedCardIds; availableDispositions }`
  (L613–622) + the lazy FIFO `pendingRuthlessDictatorChoices?` (L1771) — the shape model for the new
  `PendingRevealThreeAssign`. The Ruthless Dictator types stay UNCHANGED (contract lock); the new type
  is a sibling, not a generalisation.
- **`packages/game-engine/src/moves/ruthlessDictatorChoice.resolve.ts`** is the resolve model: args
  `{ cardId, disposition }`, one card per call, validate front entry's `playerID`, `cardId ∈
  revealedCardIds`, `disposition ∈ availableDispositions`; apply; splice card + slot; front-pop when
  empty. "Exactly one of each" = slot consumption. Never throws.
- **`packages/game-engine/src/rules/tacticHandlers.ts`** `resolveRuthlessDictator` (L1136–1177) parks
  `min(3, deck.length)` cards with `availableDispositions = PRIORITY.slice(0, lookCount)` and does NOT
  reshuffle (a "look"). The new ability says **"Reveal"**, so it follows D-24285 instead.
- **`packages/game-engine/src/moves/drawCards.logic.ts`** `reshuffleDiscardIntoDeck(playerZones,
  shuffleContext)` (L120) APPENDS the shuffled discard beneath any cards still in the deck — the
  D-24285 top-up primitive (tests 17b/17c in `heroEffects.execute.test.ts`).
- **`packages/game-engine/src/moves/zoneOps.ts`** `moveCardFromZone(from, to, cardId)` (L54) — the
  deck→hand / deck→discard move; **`board/ko.logic.ts`** `koCard` (L24) for the KO pile.
- **`heroEffectRevealTopDisposeKo`** (`heroEffects.execute.ts` L2868, D-24558) is the precedent for
  the again-handler: it scans the queue newest-first and mutates the entry a previous ability of the
  SAME card just parked ("executeHeroEffects runs a card's abilities in order", L2851).
- **Resolve-move randomness:** the Ruthless Dictator resolve destructures only `{ G, playerID }`
  (`ruthlessDictatorChoice.resolve.ts` L98–99); a resolve that reshuffles destructures
  `{ G, playerID, ...context }` and passes `context as unknown as ShuffleProvider`
  (`doOver.resolve.ts` L131 precedent). The sim `MOVE_MAP` contexts carry `random`
  (`simulation.runner.ts` L274/L484).
- **Draw accounting:** `G.turnEconomy.cardsDrawn` is incremented only in `heroEffectDraw` (L1367) and
  feeds the wait-and-see `cardsDrawnThisTurnAtLeast` gate (`deferredConditionalGrants.ts` L71).
- **`packages/game-engine/src/hero/heroEffects.execute.ts`** — `HANDLED_KEYWORDS` (L110),
  `NO_MAGNITUDE_KEYWORDS` (L396), `HERO_EFFECT_HANDLERS` (L5058), handler signature `(G, ctx,
  playerID, cardId, effect) => void` (L1328); `heroEffectRevealTopDispose` (L2783) +
  `parkRevealTopDispose` are the hero-side park model. **Sibling abilities of one card run
  synchronously after a block-all park (no continuation — D-24521 §6).**
- **`packages/game-engine/src/rules/heroKeywords.ts`** — `HeroKeyword` union + `HERO_KEYWORDS` array.
  **RUNTIME drift pins at HEAD: `HERO_KEYWORDS` = 65** — `rules/heroKeywords.test.ts` L64–69;
  `rules/heroAbility.setup.test.ts` L629 (count) + its ORDERED `expectedKeywords` array (L612–625,
  `deepStrictEqual`); `setup/heroAbility.setup.test.ts` L1430 (count). **`HERO_EFFECT_HANDLERS` = 49**
  (`heroEffects.execute.test.ts` L112 + L7132). **`game.test.ts` moves = 43** (L213).
  `simulation/simulation.moveDispatch.drift.test.ts` is a superset check (no count) — no edit.
  Both new keywords are handler-bearing and are NOT members of the frozen `REVEAL_KEYWORDS` family
  (`revealRule.ts` L117–119; the reveal-top-dispose precedent).
- **`packages/game-engine/src/setup/heroAbility.setup.ts`** parses `[team:venomverse][team:venomverse]:`
  on a SEPARATE `abilities[]` entry into `requiresTeam` condition(s) on that entry's hook only.
  **WP-741 / D-24563 (doubled-icon `requiredMatches`) is Ready but NOT executed**: today ONE other
  Venomverse card in play satisfies the gate; when WP-741 lands it tightens to two with no change
  here. Not a hard dep.
- **`packages/game-engine/src/endgame/mastermindVictory.logic.ts`** `dropAllPendingPlayerChoices`
  (L89) — since WP-732 a vanquish does NOT drop pending choices; the drop runs in
  `promoteMastermindVictoryIfPending` at the winning turn's end (L60, doc L70–80; D-24518 as
  relocated by WP-732). The new queue enrolls there, and in `ALL_PENDING_FIELDS` of
  `endgame/mastermindVictory.logic.test.ts` (L120–131).
- **Block-all guard sites** = every `hasPendingRevealTopDispose` call site (`game.ts` ~L193,
  `coreMoves.impl.ts` ×3, `dodgeCard`, `fightMastermind`, `fightVillain`, `healWounds`, `recruitHero`,
  `recruitOfficer`, `villainDeck/villainDeck.reveal.ts`) + the bot short-circuit in `ai.legalMoves.ts`.
- **Card data is GENERATED:** markers are authored in
  `scripts/convert-cards/inputs/hero-ability-markers.json` (entry shape `{ heroSlug, cardSlug,
  abilityIndex, markupToken }`) and applied by `apply-hero-ability-markers.mjs` (token arms in
  `VALID_TOKEN_PATTERN` ~L95; the token is appended to the line end, L346); `data/cards/*.json` is
  never hand-edited. The parser's Step 1b emits `requiresTeam` regardless of other keywords on the
  line (`heroAbility.setup.ts` L906–930) — the Hypnotic Charm `[hc:instinct]: …
  [keyword:reveal-top-dispose-others]` shape (`core.json` L587). **`dims` is a new top-level key** in
  `hero-ability-markers.json`; dims Howard comes from `inputs/patches/dims.patch.json` L54–67, so
  the marker stage must run after the patch overlay (verify with `--validate`).
- **Runtime-observed sweep** already plays `3dtc/howard-the-duck`, `dims/howard-the-duck` and
  `vnom/venomized-dr-strange` (`runtime-observed-hollows.json` L6), so `totalObs` will likely move
  (WP-702 moved it 2965→2968) → the dashboard in-play pin re-pins.
- **The three cards** (all ability text unmarked today):
  - `vnom/venomized-dr-strange/crystal-of-kadavus` — ranged, Venomverse, cost 8, 4 attack;
    `abilities[0]` = the reveal-three line, `abilities[1]` = `[team:venomverse][team:venomverse]: Do this ability again.`
  - `3dtc/howard-the-duck/interplanetary-visitor` and `dims/howard-the-duck/interplanetary-visitor` —
    tech, unaffiliated, cost 7, 4 attack; `abilities[0]` = the reveal-three line.

If any is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-24512 (Ruthless Dictator disposition slots), D-24521 (reveal-top-dispose
  keyword recipe + the synchronous-sibling limitation §6), D-24285 (reveal top-up), D-24518
  (winning-turn drop, relocated by WP-732), D-24552 (draw lock), D-24372 (RUNTIME drift pins), D-24563 (doubled icons, pending).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + Principle #2; `.claude/rules/architecture.md`
  §UIState Projection Integrity (five-step Board-Visible Field contract).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical names (`CardExtId`, zone names).
- `WP-702-reveal-top-discard-or-keep.md` + `EC-739` — the file-for-file precedent (61 files).

**Why a sibling type, not a generalised Ruthless Dictator.** The dispositions differ (`draw` vs
`top`), the reveal rule differs (Reveal tops up; Look does not), and Crystal needs a repeat counter.
`PendingRuthlessDictatorChoice` is a shipped contract (D-24512); widening it would re-open WP-695 and
its prompt. Duplicate-first per code-style §Abstraction (this is the second scry-and-assign; a third
would justify a shared primitive).

**Why a repeat counter, not a second queued choice.** A card's sibling abilities run synchronously
after the first park (D-24521 §6). Parking a second choice from `abilities[1]` would snapshot the
SAME three cards before the player assigns the first set. Instead `abilities[1]` bumps a
`remainingRepeats` counter on the entry `abilities[0]` just parked; when that entry's cards are all
assigned, the resolve move reveals a fresh top three and re-parks with the counter decremented.

## Scope (In)

- **Two keywords (both NO_MAGNITUDE):**
  - `reveal-three-assign` — on `abilities[0]` of all three cards. Handler `heroEffectRevealThreeAssign`:
    if the active player's deck holds fewer than 3 cards, top up via `reshuffleDiscardIntoDeck`
    (ctx as `ShuffleProvider`; D-24285); snapshot `revealed = deck.slice(0, min(3, deck.length))`
    (do NOT remove); park `{ playerID, sourceCardId: cardId, revealedCardIds: revealed,
    availableDispositions: ['draw','discard','ko'], remainingRepeats: 0 }`. All three dispositions
    are ALWAYS offered; the entry completes when `revealedCardIds` is empty, so with 1–2 cards the
    player chooses which dispositions to use ("do as much as you can", rules-v23 L3328). Zero cards
    (deck + discard empty) → logged no-op, no park. **If a `PendingRevealThreeAssign` for the active
    player is already queued, the handler does NOT snapshot; it increments the LAST such entry's
    `remainingRepeats`** (a queued reveal is a deferred repeat — the same mechanism as
    `reveal-three-assign-again`; avoids a duplicate snapshot when Steal Abilities re-fires two
    reveal-three cards in one synchronous run, `heroEffects.execute.ts` L4284→L4322, D-24521 §6).
  - `reveal-three-assign-again` — on Crystal's `abilities[1]`, alongside its existing
    `[team:venomverse][team:venomverse]` gate tokens (the gate is the entry's own `requiresTeam`
    condition — no gate code). Handler `heroEffectRevealThreeAssignAgain`: find the LAST queued
    entry with `playerID === active` and `sourceCardId === cardId` and increment its
    `remainingRepeats`; if none exists (the first reveal found no cards), run
    `heroEffectRevealThreeAssign` for a fresh reveal.
- **Keyword registration:** union + `HERO_KEYWORDS` (65→67), `HANDLED_KEYWORDS` +
  `HERO_EFFECT_HANDLERS` (49→51), both in `NO_MAGNITUDE_KEYWORDS`.
- **Pending type + queue (types.ts):** `RevealThreeAssignDisposition = 'draw'|'discard'|'ko'`;
  `PendingRevealThreeAssign { choiceType: 'reveal-three-assign'; playerID: string; sourceCardId:
  CardExtId; revealedCardIds: CardExtId[]; availableDispositions: RevealThreeAssignDisposition[];
  remainingRepeats: number }`; `G.pendingRevealThreeAssign?: PendingRevealThreeAssign[]`, lazily
  initialised at the park site, never in `Game.setup`.
- **Resolve move `moves/revealThreeAssign.resolve.ts`:** `resolveRevealThreeAssign({ cardId,
  disposition })` + `hasPendingRevealThreeAssign(G)`. Validate the front entry (`front.playerID === playerID` — the submitting seat — and
  `front.choiceType === 'reveal-three-assign'`, the Ruthless Dictator precedent), `cardId ∈
  revealedCardIds`, `disposition ∈ availableDispositions`, and `cardId ∈
  deck` NOW (stale → splice the card and the SUBMITTED disposition's slot with a neutral "already
  moved" log, never loop).
  Apply: `draw` → `moveCardFromZone(deck, hand, cardId)` and `turnEconomy.cardsDrawn += 1` (a
  printed "Draw" counts, like `heroEffectDraw`), EXCEPT when `turnEconomy.drawsLocked` → leave the
  card in the deck with a `[blocked]` "can't draw" log (D-24552), no count; `discard` →
  `moveCardFromZone(deck, discard, cardId)`; `ko` → `moveCardFromZone(deck, [], cardId)` + `koCard`.
  Splice card + slot. When `revealedCardIds` empties — after an applied OR a stale-drop step (unused
  slots are discarded with the entry): if `remainingRepeats > 0`, re-reveal via the top-up +
  snapshot steps ONLY — never by calling `heroEffectRevealThreeAssign`, whose already-queued bump
  would hit the emptied front and freeze an empty prompt (the move destructures `{ G, playerID,
  ...context }` for the `ShuffleProvider`) — and
  replace the front with a fresh entry (`remainingRepeats − 1`); an empty re-reveal front-pops;
  else front-pop. Server-only (`client: false`); silent `void` otherwise.
- **Block-all guard:** `hasPendingRevealThreeAssign(G)` at every `hasPendingRevealTopDispose` site
  + the bot short-circuit.
- **Winning-turn drop (D-24518 / WP-732):** `pendingRevealThreeAssign` joins
  `dropAllPendingPlayerChoices` + `ALL_PENDING_FIELDS` in `mastermindVictory.logic.test.ts`.
- **UIState five-step:** UIState field `pendingRevealThreeAssign?: UIPendingRevealThreeAssign`;
  `UIRevealThreeAssignCard { cardId; display: UICardDisplay }` + `UIPendingRevealThreeAssign
  { choiceType; playerID; sourceCard: UIRevealThreeAssignCard; revealedCards; availableDispositions;
  remainingRepeats }` (uiState.types.ts), built from the FRONT entry with display resolved
  (uiState.build.ts), chooser-only pass-through (uiState.filter.ts, the Ruthless Dictator audience),
  re-export (index.ts), audience-filter test, diagnostics snapshot.
- **Client prompt `PendingRevealThreeAssignPrompt.vue`** (model on `PendingRuthlessDictatorChoicePrompt.vue`):
  heading names the source card; lists each revealed card with one button per remaining disposition
  (Draw / Discard / KO); shows "then again on the next three" when `remainingRepeats > 0`; submits
  `resolveRevealThreeAssign`. Wired into `PlayDesktop.vue`, `PlayMobile.vue`, `TurnActionBar.vue`,
  `useTurnActions.ts`, `uiMoveName.types.ts`, `diagnostics/effectProvenance.ts`.
- **Bot / sim:** `selectDefaultRevealThreeAssignment(G, entry)` lives in
  `revealThreeAssign.resolve.ts` (the `selectDefaultRevealTopDisposition` precedent); the
  `ai.legalMoves.ts` short-circuit (beside the Ruthless Dictator one, ~L657) emits
  `resolveRevealThreeAssign`; `SIMULATION_MOVE_NAMES` (in `ai.legalMoves.ts`) + a `MOVE_MAP` key in
  BOTH `simulation.runner.ts` and `par.aggregator.ts`. `apps/server/src/autoplay/botLoopProgress.test.ts`
  (L54–84, "the FULL set" of resolve short-circuits) gains `resolveRevealThreeAssign`.
- **Card data (GENERATED):** token arms `[keyword:reveal-three-assign]` +
  `[keyword:reveal-three-assign-again]` in `apply-hero-ability-markers.mjs`; four markers (three
  `abilities[0]` + Crystal `abilities[1]`); regenerate `vnom`, `3dtc`, `dims`.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:coverage`
  (hero-hook WPs run `sim:coverage --check`; `--update-baseline` if it moves), `sim:runtime-observed`
  (+ the dashboard in-play coverage pin if `totalObs` shifts); `mechanic-provenance.json` rows.
- **Tests:** parser (marked lines → hooks; Crystal's `abilities[1]` gated by `requiresTeam`);
  handler (3-card park; top-up from discard with a short deck; 2-card entry offers all three
  dispositions and completes after two assignments; empty → no park; a second reveal-three handler
  in one synchronous run → one entry with `remainingRepeats: 1`); again-handler (bumps `remainingRepeats` on the just-parked entry; fresh reveal
  when none); resolve (each disposition; a realized `draw` increments `turnEconomy.cardsDrawn` by 1
  while a draw-locked `draw` and a stale drop leave it unchanged; a `cardsDrawnThisTurnAtLeast`
  wait-and-see grant fires on the move after a resolve-draw crosses its threshold; draw-lock leaves the card; stale card drop; repeat re-reveal
  after the last assignment; front-pop; illegal → `void`); block-all; winning-turn drop; UIState
  audience filter; client prompt; drift pins.

## Out of Scope

- **Near-sibling wordings** (different disposition sets, a follow-up that can reuse this primitive):
  `vill` Stealthy Predator (draw/discard/top), `wtif` Break the Absolute Point in Time and `wwhk`
  Gamma Ray Experiment (draw/KO/top), `cvwr` Dual Existence + Squawk Back, `nmut` Earthling Choices,
  `bkwd` Amulets of the Tiger God, `anni` Reprogram Doombot Legions, `xmen` Subtle Attunement.
- **Non-hero same-shape text** — masterminds (`wwhk` M.O.D.O.K. "Designed Only For K.O.-ing",
  `wpnx` Sabretooth, `msp1` Ruthless Dictator, `co2e` Ruthless Command), villains (`wtif` Zombie
  Doctor Strange / Zombie Wong), bystanders (`wwhk` Triage Nurse, `xmen` Cypher).
- **The WP-741 doubled-icon count** — Crystal's gate needs two other Venomverse cards only after
  WP-741 executes; this WP does not change condition counting.
- **Changing `PendingRuthlessDictatorChoice` or its prompt** — contract-locked (D-24512).
- **Public-vs-private reveal** — the choice is chooser-only in UIState (the Ruthless Dictator
  audience); showing the revealed cards to other seats is a separate UX decision.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords (union + array).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — registrations; the two handlers.
- `packages/game-engine/src/types.ts` — **modified** — disposition / pending types + queue field.
- `packages/game-engine/src/moves/revealThreeAssign.resolve.ts` — **new** — resolve + predicate +
  `selectDefaultRevealThreeAssignment`.
- `packages/game-engine/src/game.ts` — **modified** — import + move entry (server-only) + block-all guard.
- `packages/game-engine/src/moves/{coreMoves.impl,fightVillain,fightMastermind,recruitHero,
  recruitOfficer,healWounds,dodgeCard}.ts` + `villainDeck/villainDeck.reveal.ts` — **modified** — guard.
- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` + `.test.ts` — **modified** —
  winning-turn drop enrollment + `ALL_PENDING_FIELDS`.
- `packages/game-engine/src/rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` (count +
  ordered `expectedKeywords`), `setup/heroAbility.setup.test.ts` (L1430 count) — **modified** — keyword pins.
- `apps/server/src/autoplay/botLoopProgress.test.ts` — **modified** — the resolve short-circuit set.
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` + `packages/game-engine/src/index.ts`
  (re-export) — **modified** — five-step.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` + `simulation.runner.ts` + `par.aggregator.ts`
  — **modified** — short-circuit + `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s.
- `apps/arena-client/src/components/play/PendingRevealThreeAssignPrompt.vue` — **new** — the prompt.
- `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue`,
  `components/play/TurnActionBar.vue`, `composables/useTurnActions.ts`,
  `components/play/uiMoveName.types.ts`, `diagnostics/effectProvenance.ts` — **modified** — wiring.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — two token arms.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — four markers.
- `data/cards/{vnom,3dtc,dims}.json` — **modified (generated)**.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json`, `scripts/coverage/hero-effect-coverage.baseline.json`
  (if `sim:coverage` shifts), `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (if
  `totalObs` shifts — expected) — **modified (generated / provenance)**.
- Paired `*.test.ts` for each engine/client source above (incl. `game.test.ts`, `heroKeywords.test.ts`,
  `heroAbility.setup.test.ts`, `heroEffects.execute.test.ts`, `endgame/mastermindVictory.logic.test.ts`,
  `uiState.filter.test.ts`, the new prompt test; `simulation.moveDispatch.drift.test.ts` runs unchanged) — **new/modified**.

- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — govern-close
  (`SPEC:` commit).

> ~30 hand-edited files — one WP because a block-all pending choice without its client prompt
> freezes the game (the WP-695 / WP-702 precedent). Exact allowlist in the EC.

## Non-Negotiable Constraints

- Full file contents for every new/modified file — no diffs, snippets, or partial sections; ESM;
  Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: the top-up reshuffle uses `ctx.random` via `reshuffleDiscardIntoDeck`; no
  `Math.random()`; moves never throw; zone moves via `zoneOps`.
- `G` stores `CardExtId` strings only.
- Both keywords carry no magnitude → both in `NO_MAGNITUDE_KEYWORDS`.
- Union + `HERO_KEYWORDS` change in lockstep; RUNTIME drift pins (D-24372).
- The block-all choice ships WITH its UIState projection AND client prompt (five-step).
- The queue enrolls in `dropAllPendingPlayerChoices` (the D-24518 winning-turn drop, relocated by WP-732).
- The resolve move is server-only; the client submits intent only.
- Card data via marker SOURCE + regen; `cards:check` byte-reproducible; never hand-edit.
- `PendingRuthlessDictatorChoice`, `resolveRuthlessDictatorChoice` and its prompt are NOT modified.

**Session protocol:** if Crystal's `[team:venomverse][team:venomverse]` tokens and the new
`[keyword:reveal-three-assign-again]` token cannot share `abilities[1]` without the parser dropping
the gate, STOP and raise it — do not move the gate or hand-edit card data.

## Contract

- `PendingRevealThreeAssign { choiceType:'reveal-three-assign'; playerID; sourceCardId;
  revealedCardIds; availableDispositions: RevealThreeAssignDisposition[]; remainingRepeats }`;
  `RevealThreeAssignDisposition = 'draw'|'discard'|'ko'`; queue `G.pendingRevealThreeAssign?`.
- `heroEffectRevealThreeAssign(G, ctx, playerID, cardId, effect)` — if an entry for the player is
  already queued, bump its `remainingRepeats`; else top up (<3), snapshot up to 3, park with all
  three dispositions; 0 → no-op.
- `heroEffectRevealThreeAssignAgain(G, ctx, playerID, cardId, effect)` — bump `remainingRepeats` on
  the last entry for (`playerID`, `cardId`); none → fresh reveal.
- `resolveRevealThreeAssign({ cardId, disposition })` — as Scope; repeat re-reveal on empty.
- `selectDefaultRevealThreeAssignment(G, entry)` → `{ cardId, disposition }` (bot/sim; Locked Values).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §10, §22 (deterministic, replay-faithful).
- **No conflict:** a printed ability resolves as the card reads.
- **Non-Goal proximity:** none of NG-1..NG-7 crossed — a printed hero ability; nothing bought, gated, or timed.
- **Determinism preservation:** the top-up reshuffle uses `ctx.random`; the assignment is a recorded
  move. `pendingRevealThreeAssign?` is optional and absent for any game that never plays these
  cards, so the core `finalStateHash` sentinels (no vnom/3dtc/dims cards) serialize byte-identically
  → **no re-pin** (verify). The regen changes three cards' parsed abilities (intended).

## Funding Surface Gate

N/A — no funding surface; a hero card ability only.

## API Catalog Update

N/A — no `apps/server` endpoint or library function; `resolveRevealThreeAssign` is an engine move.

## Acceptance Criteria

1. Playing Interplanetary Visitor with ≥3 cards in deck parks a `PendingRevealThreeAssign` with the
   top three and `['draw','discard','ko']`; other moves are blocked until it resolves.
2. With 1–2 cards in deck and a non-empty discard, the handler tops up from the discard (D-24285)
   before snapshotting; with deck + discard totalling 2, the entry has 2 cards, offers all three
   dispositions, and completes after any two assignments; with none, nothing parks (logged).
3. `resolveRevealThreeAssign` moves the chosen card deck→hand (`draw`), deck→discard (`discard`),
   deck→KO pile (`ko`); each disposition is usable once; the entry front-pops when empty.
4. With `drawsLocked`, `draw` leaves the card in the deck and logs a `[blocked]` line; the slot is consumed.
5. Crystal of Kadavus with another Venomverse Hero in play parks one entry with `remainingRepeats: 1`;
   after its third assignment a fresh top three is revealed and parked (`remainingRepeats: 0`);
   without the Venomverse Hero, only one reveal happens.
6. `resolveRevealThreeAssign` is a silent `void` with no parked choice, a wrong player, a card not
   in the snapshot, or a spent disposition; a card no longer in the deck is dropped with its slot.
7. `UIPendingRevealThreeAssign` is present for the chooser only, survives
   `filterUIStateForAudience`, and appears in the diagnostics `uiStateSnapshot`.
8. `PendingRevealThreeAssignPrompt.vue` renders the three cards with Draw / Discard / KO and submits
   `resolveRevealThreeAssign`; the client never mutates a zone.
9. A parked `PendingRevealThreeAssign` is cleared by `promoteMastermindVictoryIfPending` at the
   winning turn's end (D-24518 as relocated by WP-732); `ALL_PENDING_FIELDS` includes it.
10. `HERO_KEYWORDS` 65→67, `HERO_EFFECT_HANDLERS` 49→51, `game.test.ts` moves 43→44 — RUNTIME pins;
    the sim move-dispatch drift test passes.
11. `cards:check` reproduces vnom/3dtc/dims; `ledger:heroes` shows both keywords `executable`.
12. Engine + arena-client suites green; arena-client `typecheck` 0; `pnpm -r build` 0;
    `finalStateHash` sentinels unchanged (no re-pin).

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` + `test` — exit 0.
- `pnpm --filter @legendary-arena/arena-client typecheck` + `test` — exit 0.
- `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then
  `pnpm ledger:heroes:check && pnpm effect-index:check` — exit 0; both keyword rows `executable`.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate` then `pnpm cards:check` —
  vnom/3dtc/dims reproduce byte-identically.
- `pnpm --filter @legendary-arena/dashboard test` — green (in-play pin re-pinned if `totalObs` moved).
- `pnpm --filter @legendary-arena/server test` — green (`botLoopProgress.test.ts`).
- `pnpm sim:coverage --check` and `pnpm sim:runtime-observed:check` — exit 0 (regenerate + commit
  honestly if they shift, including the dashboard in-play pin).
- No `finalStateHash` re-pin: covered by the engine `test` run above (no `finalStateHash` / `PRE_WP080_HASH` literal edited).
- `pnpm roadmap:counts:check` — exit 0.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client suites green; `typecheck` 0; `pnpm -r build` 0.
- [ ] Card data + coverage artifacts regenerated and their `:check` gates green.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match plays Crystal of Kadavus (and, with a Venomverse
      Hero in play, sees the second prompt); the choices resolve as assigned.
- [ ] `docs/ai/STATUS.md` updated; write D-24580 (Active) in `DECISIONS.md`; `WORK_INDEX.md` checked off;
      `05-ROADMAP-MINDMAP.md` node ✅ + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24580 — "Reveal the top three … draw one, discard one, KO one" as the `reveal-three-assign`
handler-bearing HeroKeyword with its own `PendingRevealThreeAssign` queue + `resolveRevealThreeAssign`
move (a sibling of Ruthless Dictator, not a generalisation); Reveal tops up per D-24285; dispositions
all three always offered (a short reveal completes when its cards run out, the player choosing
which dispositions to use); a second reveal while one is queued bumps its repeat counter; the draw
lock blocks `draw`; Crystal of Kadavus's
"Do this ability again" is `reveal-three-assign-again` bumping a `remainingRepeats` counter that the
resolve move re-reveals from (not a second synchronous park); a realized `draw` counts toward
`cardsDrawn`; chooser-only UIState; near-sibling wordings out of scope. **Short-reveal rationale:**
the rulebook's "do as much as you can" (rules-v23 L3328) does not fix WHICH dispositions survive a
short reveal; letting the player choose avoids forcing a lone Wound into hand and keeps the choice
with the player (Ruthless Dictator's KO-first truncation reflects a tactic's punitive intent, not a
hero's). Operator rules call, reversible at execution by restoring printed-order truncation.

## Lint Gate Self-Review (00.3)

Independent reviewer (subagent), after pre-flight READY + copilot PASS; four optional tightenings applied.

- **§1 structure / §2 constraints:** all sections; Out of Scope excludes ≥2 (near-sibling wordings;
  non-hero same-shape text; WP-741 doubled-icon count; Ruthless Dictator contract; public reveal);
  full-files/determinism/session-protocol + `## Contract`. **PASS.**
- **§3 Assumes / §4 Context:** every dependency file + line + decision cited (verified at `04a6d0ab`);
  ARCHITECTURE §Layer Boundary + rules §UIState + 00.2. **PASS.**
- **§5 files:** every file new/modified with role; ~30-file count justified (block-all needs its
  prompt, WP-695/702 precedent); exact allowlist in EC-790. **PASS.**
- **§6 naming:** `CardExtId`, `playerID`, zone names per 00.2. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dep; engine decides / client renders; move server-only. **PASS.**
- **§9/§10/§11:** `pnpm` only; no env var; no auth surface. **PASS / N/A.**
- **§12 tests:** `node:test`; no boardgame.io import in helpers; deterministic. **PASS.**
- **§13/§14/§15:** exact `pnpm` commands; 12 observable criteria; DoD has STATUS/DECISIONS/
  WORK_INDEX + scope boundary + D-24026 live item. **PASS.**
- **§16 code-style:** sibling type, not a premature generalisation (second scry-and-assign);
  explicit control flow; `// why:` on NO_MAGNITUDE, Reveal top-up, again-counter, draw-lock,
  stale drop, block-all guard, winning-turn drop. **PASS.**
- **§17 Vision:** clause numbers (§1/§2/§10/§22), no-conflict, NG line, determinism line. **PASS.**
- **§18/§20/§21:** no literal-grep verification; funding N/A (hero ability only); API N/A (engine
  move, no `apps/server` surface). **PASS.**

## Pre-Flight Verdict (01.4)

Independent reviewer, three rounds. **Round 1: NOT READY** on four text items — PS-1 (a second
`HERO_KEYWORDS` pin file + the ordered `expectedKeywords` array), PS-2 (AC-9 stale: since WP-732 the
drop runs at the winning turn's end, not at vanquish), PS-3 (paths for the dashboard in-play pin and
the `sim:coverage` baseline), PS-4 (UIState field name unlocked); RS items applied (again-handler
precedent, resolve `ShuffleProvider`, `koCard` location, `cardsDrawn` accounting, bot selector home,
server `botLoopProgress` pin, REVEAL_KEYWORDS non-membership, marker `--validate`). **Round 2 and the
post-copilot re-runs: READY TO EXECUTE**, no blocking items; EC at 100 content lines.

## Copilot Check (01.7)

**Round 1: RISK (HOLD)** — #18 Steal Abilities re-fires two reveal-three cards in one synchronous run
(duplicate snapshot) → an already-queued entry is bumped instead; #26 short-reveal truncation vs
rules-v23 L3328 "do as much as you can" → all three dispositions always offered (operator rules call,
reversible, recorded in D-24580); #11 `cardsDrawn` invariant tests added; #30 DoD wording + date.
**Round 2: RISK** — the repeat re-reveal must not call the handler (its bump would hit the emptied
front) → locked to the top-up + snapshot steps only; empty check after applied OR stale steps; bot KOs
junk first. **Round 3: PASS (CONFIRM).** Accepted limitation: a sibling reveal from a DIFFERENT queue in
the same synchronous run can still snapshot the same deck top (the general D-24521 §6 limitation).
