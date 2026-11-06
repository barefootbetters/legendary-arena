# WP-865 — Heist: a once-per-turn "Attempt a Heist" action, and Heist lines stop granting at play (Game Engine + UIState + arena-client)

**Status:** Draft 2026-11-05 (EC-903; D-24808 reserved)
**Layer:** Game Engine (hook parser, effect executor, a new move, turn economy, UIState projection) + arena-client (one button) + curated card-data markers. One WP, the WP-858 Ritual Artifact shape.
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic, a new move and new turn-economy state on G; no auth, money, persistence or server surface
**Hard-deps:** WP-736 / D-24556 (the Excessive Violence fused enrol-at-play hook and its move-time driver, the pattern this WP copies) ✅, WP-739 / D-24560 (the `excessiveViolenceAvailable` economy projection) ✅, WP-858 / D-24794 (the `useRitualArtifact` player-initiated move with a client button) ✅, WP-216 / EC-248 (curated `hero-ability-markers.json` + `apply-hero-ability-markers.mjs`) ✅

## Goal

Ten Ant-Man and the Wasp (`amwp`) hero cards carry a **Heist** ability. The engine has no Heist rule, so each line does the
wrong thing today:

- Six lines pay out every time the card is played, with no Heist at all:
  - Petty Larceny +2 Recruit
  - Shocking Support +2 Attack
  - Infiltrate +3 Attack
  - The Big Score +4 Attack
  - Putting a Crew Together +1 Attack
  - Revolutionary Anthem +2 Attack
- Four lines do nothing: Anything for Cassie, Tiny little Risk, Up the Ante and X-Con Security Van.

After this WP:

- Playing a Heist card **readies** it for a Heist and grants nothing.
- Once per turn, while the player has readied at least one card, an **Attempt Heist** button appears. Pressing it:
  - counts the different non-zero printed costs among the Heroes they have this turn, meaning hand plus cards in play (the
    Heist Count);
  - reveals the top card of the Villain Deck and compares the Heist Count with that card's printed VP.
- **Higher:** every readied card's Heist ability fires.
- **Tied:** nothing happens.
- **Lower:** the player gains a Wound.

## User-Visible Impact

- Six cards fire their Heist ability on a successful Heist:
  - Petty Larceny (+2 Recruit)
  - Anything for Cassie (rescue a Bystander)
  - Shocking Support (+2 Attack)
  - Infiltrate (+3 Attack)
  - Tiny little Risk (draw two)
  - Up the Ante (draw a card)
- The other four Heist lines (The Big Score, Putting a Crew Together, X-Con Security Van, Revolutionary Anthem's Heist line) stop
  over-granting. They log as honest hollows until a follow-up models their extra clauses.
- **Observed today** (operator match `vZXSkk4xJNC`, build `2ba56150`):
  - Infiltrate granted +3 Attack on all 6 plays (log 4.2.6, 6.2.13, 8.2.2, 10.2.11, 12.2.9, 16.2.7).
  - On turn 16 that +3 was the margin for the third 12-Attack Fin Fang Foom fight: 38 Attack total, 36 needed.

## Assumes

- **Baseline:** `origin/main` at `adbe8c14` plus the reserve PR #3171 (WP-865 / EC-903 / D-24808). The parse probe ran at
  `3129d29f`. `260af872` (D-24806) touches `amwp.json`, the hook parser and the marker map, but no Heist line; the probe re-run
  at `260af872` matches.
- **Rule:** the Heist rule is Universal Rulebook v23 p.26–27 (`docs/legendary-universal-rules-v23.md` ~l.1504–1522,
  `docs/Marvel Legendary Universal Rules v23.txt` ~l.1531–1538; summary in `data/metadata/keywords-full.json` key `heist`):
  - Once per turn, if you played any Heroes with Heist abilities, you may attempt a Heist.
  - Heist Count = the number of different non-zero costs among your Heroes this turn.
  - Reveal the top card of the Villain Deck and check its printed VP:
    - higher: use all Heist effects;
    - tied: no effects;
    - lower: gain a Wound.
  - Printed cost; equal costs count once; optional; one attempt per turn, whatever the outcome; Heist cards played after the
    attempt are too late.
- **The ten lines**, all in `data/cards/amwp.json`, at their `abilityIndex`:
  - `scott-lang-cat-burglar`:
    - `petty-larceny` 0, "Heist: You get +2[icon:recruit]."
    - `anything-for-cassie` 1, "Heist: Rescue a Bystander."
    - `shocking-support` 0, "Heist: You get +2[icon:attack]."
    - `x-con-security-van` 0
    - `putting-a-crew-together` 0
    - `the-big-score` 0
  - `wasp/infiltrate` 2, "Heist: You get +3[icon:attack]."
  - `ant-man/tiny-little-risk` 1, "[keyword:Heist]: Draw two cards."
  - `ant-army`:
    - `up-the-ante` 0, "[keyword:Heist]: Draw a card."
    - `revolutionary-anthem` 2
- **Observed parse at `3129d29f`** (scratch probe over `buildHeroAbilityHooks`):
  - **Payout at play:**
    - Petty Larceny `recruit 2`
    - Shocking Support `attack 2`
    - Infiltrate line 2 `attack 3`
    - Putting a Crew Together `attack 1`
    - The Big Score `attack 4`
    - Revolutionary Anthem line 2 `attack 2` + unresolved `heist`
  - **Empty or hollow:**
    - Anything for Cassie line 1 is empty.
    - X-Con Security Van is empty.
    - Tiny little Risk line 1 and Up the Ante carry only an unresolved `heist`.
- **Excessive Violence precedent** (WP-736 / D-24556):
  - `EXCESSIVE_VIOLENCE_CARDS` allowlist and `EXCESSIVE_VIOLENCE_PATTERN` (`setup/heroAbility.setup.ts` ~l.831–852);
  - `buildExcessiveViolenceFusion` (~l.4432) and its call with consumed-line skip (~l.4636);
  - `heroEffectExcessiveViolence`, which enrols only (`hero/heroEffects.execute.ts` ~l.7116);
  - `fireExcessiveViolencePlays` (~l.7160);
  - `enrollExcessiveViolenceCard` and the same-turn carry (`economy/economy.logic.ts` ~l.486–540);
  - the `excessiveViolenceEffects` field (`rules/heroAbility.types.ts` ~l.223–231).
  - `executeHeroEffects` does not filter hooks by timing, so the fused hook runs at play, where it only enrols.
- **Ritual Artifact precedent** (WP-858 / D-24794):
  - the `useRitualArtifact` registration comment in `game.ts` ~l.598–603: non-core, internally stage-gated, `client: false`, not
    emitted by `getLegalMoves`;
  - `moves/ritualArtifact.ts`;
  - the client button and props in `apps/arena-client/src/components/play/PlayedCardsRow.vue`, `uiMoveName.types.ts` and
    `pages/{PlayDesktop,PlayMobile}.vue`.
- **Existing helpers:**
  - `playedCardIdsStillInPlay(G, inPlay)` (`hero/splitCard.logic.ts:280`; the Heist Count pool, with the hand). The broader
    `playedCardIdsThisTurn` (~l.227) also counts Out of Time and returned cards; it is NOT the Heist Count source.
  - `G.cardStats[id].cost` (printed cost; `economy/economy.types.ts:281`);
  - `G.villainDeck.deck[0]` is the top card (`villainDeck/villainDeck.types.ts:60`);
  - `G.villainDeckCardTypes` (`RevealedCardType`);
  - `G.cardVictoryPoints` (printed VP, villains and henchmen; `types.ts:3022`, built by `setup/buildCardVictoryPoints.ts`);
  - `VP_BYSTANDER`, `VP_VILLAIN` and `VP_HENCHMAN` (all 1; `scoring/scoring.types.ts:24–30`). `G.cardVictoryPoints` omits
    cards whose printed VP does not normalize (e.g. "2+", "3*"), and scoring falls back to these constants for them.
  - `gainWoundWithOutcome(G, playerID)` (`board/wounds.logic.ts:125`) returns `'gained'`, `'no-wound'` or
    `'diving-block-pending'`. The `heroEffectGainWoundEach` caller (`hero/heroEffects.execute.ts` ~l.6470–6487) shows the
    per-outcome logging and the `woundsDrawn` bump.
  - The ritual availability gate (`moves/ritualArtifact.ts` ~l.185–186): `main` stage and `!hasAnyPendingChoice(G)`.
  - `LOG_OUTCOMES` = neutral / applied / partial / blocked / threat.
  - Also used in the body: `executeSingleEffect` (`hero/heroEffects.execute.ts` ~l.7489); `parseAbilityText` and
    `KEYWORD_PATTERN` (`setup/heroAbility.setup.ts` ~l.1179, l.152); `hasAnyPendingChoice` (`moves/phaseCard.ts:82`); the local
    `MoveContext` type (`moves/ritualArtifact.ts:44`; unexported, so `attemptHeist.ts` redeclares its own copy, as every move file does); `REDACTED_ECONOMY` (`ui/uiState.filter.ts:46`); the test models
    `hero/playedOtherCardsThreshold.test.ts` (the D-24746 `getSet` stub) and `hero/amwpWaspSizeChanging.test.ts`.
- **The `excessiveViolenceAvailable` precedent** (WP-739; `ui/uiState.types.ts` ~l.888–898, `uiState.build.ts` ~l.1188,
  `uiState.filter.ts` ~l.529–533): active-player-only, omitted when false.
- **Parallel WPs:**
  - WP-866 (#3173, hero-next-hand-extra-draw) covers Infiltrate line 1. It edits the same `amwp` marker array and bumps the same
    `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` count pins.
  - The Demolish WP-864 does not touch `amwp`.
  - Whichever lands second rebases, re-runs the regen chain, and reads the pin values current at HEAD rather than the literals
    quoted here. Never hand-merge a generated file.

## Context (Read First)

**Why now.** Live match `vZXSkk4xJNC` showed Infiltrate's +3 decide a Mastermind fight. Every Heist card in the set is wrong in
one direction or the other, and the first-card WP-861 just put Wasp into rotation.

**Why the Excessive Violence shape.** Heist is the same rule shape as Excessive Violence: "use all X abilities of the Heroes you
played this turn" once a later, once-per-turn condition is met. WP-736 already solved that:

- a per-card allowlist fuses the line into one hook whose wrapper descriptor carries the inner effects;
- the hook enrols the card at play;
- a driver fires the enrolled inner effects later.

Heist reuses all three pieces. The only new part is the trigger: Excessive Violence fires inside the fight move, while Heist
needs its own player action. That action copies `useRitualArtifact`: a non-core, stage-gated, server-only move that bots never
use, with one client button.

**Honest-Partial Invariant.** Only cards whose whole Heist ability maps to an existing executor join the allowlist. Four lines do
more than that:

- **The Big Score:** "If the card revealed … is a Master Strike, KO it and put a card from the Bystander Deck on top."
- **Revolutionary Anthem:** "If … a Scheme Twist, you get another +2 … and you may shuffle that deck."
- **Putting a Crew Together:** "+1 for each different cost card you have" counts every card you have (hand and play, per the
  "you have" ruling), with zero costs included. That is a different scope from the Heist Count, and no count source models it.
- **X-Con Security Van:** move a Villain to an empty city space, then KO a Hero.

These four lose today's play-time payout and become an honest `heist` hollow, so they never pay out unconditionally. This WP does
not ship a half-modelled version.

**Interpretation locked in D-24808.** The Heist Count reads "different non-zero costs you have among all your Heroes this turn"
as the rulebook term of art "Your Heroes / Heroes You Have": rules v23 ~l.3439–3450 define it as the cards in your hand plus the
cards you have played this turn and that are still in play. D-24529 already overturned a play-only reading of the same phrase.
So the pool is the active player's hand plus `playedCardIdsStillInPlay(G, inPlay)` (`hero/splitCard.logic.ts:280`, the
`countDistinctHeroClassesYouHave` pool). Cards that moved to the deck, discard or KO pile do not count. The trigger is separate:
"if you have played any Heroes with Heist abilities" keys on readied cards. The revealed card's
printed VP is:

- villain: `G.cardVictoryPoints[id] ?? VP_VILLAIN`; henchman: `G.cardVictoryPoints[id] ?? VP_HENCHMAN`. This is the same
  fallback scoring uses for a printed value that does not normalize, such as "2+".
- bystander: `VP_BYSTANDER`;
- Scheme Twist, Master Strike and every other type: 0, since none prints VP.

Only allowlisted cards ready a Heist. A turn with only non-allowlisted Heist cards never offers an attempt, which costs nothing,
because those lines fire nothing. A Heist card played after the turn's attempt is too late (rule p.27): it is not readied, and it
logs the "too late" line.

The revealed card stays on top of the Villain Deck. The rule only reveals it, and two of the deferred lines read it as "the card
revealed". With an empty Villain Deck there is nothing to reveal, so the attempt is unavailable. Readied Heist abilities fire in
readying (play) order, a deterministic stand-in for "in any order".

**One WP, not a split.** The Excessive Violence arc shipped as three WPs (engine 736, projection 739, client 738). WP-858 shipped
engine, projection and button together. Splitting here would leave a window where Heist cards neither pay out nor offer a
button, an under-grant regression on a live surface. One WP ships the fix whole.

**Out-of-rule surfaces:**

- Villains with "Fight: [keyword:Heist]: …" (Ghost Chasers: Sonny Burch's Goons, Anitolov, Sonny Burch) and the scheme Safeguard
  Dark Secrets are out of scope (Out of Scope). Fighting such an Enemy does not ready a Heist under this WP.
- Bots never attempt a Heist, the `phaseCard` / `useRitualArtifact` precedent. They play Heist cards and gain nothing from the
  Heist line. That is exactly the faithful no-attempt outcome, and smaller than today's over-grant.

**Test-authoring notes:**

- Parse tests read the committed `data/cards/amwp.json` through a `getSet` stub (the D-24746 `playedOtherCardsThreshold.test.ts`
  pattern).
- Move tests build `G` with the minimal test builder plus the turn economy, `cardStats`, `villainDeck` and `villainDeckCardTypes`
  they need.
- Use `makeMockCtx`; never import `boardgame.io/testing`.

**Read first:**

- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (UIState projection, D-12803), §Layer Boundary (Authoritative) and
  §Card Data Flow: Registry into Game Engine; `.claude/rules/architecture.md` §Layer Boundary.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 / §5.1 (`[keyword:X]` tokens).
- `docs/03-DATA-PIPELINE.md` §1 (the marker stage).
- `docs/ai/REFERENCE/00.6-code-style.md`.
- `docs/ai/DECISIONS.md`: scan D-24556, D-24560, D-24794, D-24529, D-12803, D-24372, D-24673, D-24616, D-24746 and D-24026.

## Scope (In)

1. **Keyword + descriptor:**
   - `'heist'` joins the `HeroKeyword` union and `HERO_KEYWORDS` (`rules/heroKeywords.ts`), with the drift test.
   - `HeroEffectDescriptor` gains `heistEffects?: HeroEffectDescriptor[]` for a `'heist'` wrapper (`rules/heroAbility.types.ts`,
     D-24808, the `excessiveViolenceEffects` precedent).
   - No new `HeroAbilityTiming`: the fused hook keeps `onPlay`, its true enrolment moment.
2. **Parser** (`setup/heroAbility.setup.ts`):
   - `HEIST_LINE_PATTERN = /^\s*(?:\[keyword:Heist\]|Heist):/i` identifies a Heist line.
   - `HEIST_CARDS` allowlist: the six EC canonical keys.
   - `buildHeistFusion(cardId, abilityLine)` is modelled on `buildExcessiveViolenceFusion`. It strips the `HEIST_LINE_PATTERN`
     prefix, then parses the remainder with `parseAbilityText`, and returns ONE hook
     `{ timing: 'onPlay', keywords: ['heist'], effects: [{ type: 'heist', heistEffects }] }`.
     - **Why strip:** unlike the spaced EV token, `[keyword:Heist]` matches `KEYWORD_PATTERN` (~l.152). Once `'heist'` is a
       HeroKeyword, it would otherwise become a nested `{ type: 'heist' }` inner effect that re-enrols the card at fire time.
       `heistEffects` must never contain a `'heist'` descriptor.
     - **Where it is emitted:** inside the per-line loop at the Heist line's own index, NOT prepended before the loop the way EV
       is. Hook order then follows line order, and `hero/amwpWaspSizeChanging.test.ts` (whose `firstLineHook` takes the first
       `infiltrate#` hook) keeps passing unedited. The same applies to the non-allowlisted hollow below.
     - **No widen-fusion:** emitting either hook sets `previousLineHook = null` (the WP-790 rule, ~l.4672), so a later line
       cannot fuse into the Heist hook.
   - **Every other Heist line** (any hero, not allowlisted) is consumed into a hook `{ timing: 'onPlay', keywords: [],
     unresolvedMarkers: ['heist'] }`, never its inner effects. This stops the play-time payout of The Big Score, Putting a Crew
     Together and Revolutionary Anthem, and keeps X-Con Security Van an honest hollow.
3. **Curated markers** (`scripts/convert-cards/inputs/hero-ability-markers.json`, appended to the `amwp` array):
   - `anything-for-cassie` 1 `[keyword:rescue:1]`. Its D-21602 "Heist timing" entry is removed from the `_deferred` array,
     together with the `tiny-little-risk` D-22501 entry (~l.2918). The apply script ignores `_deferred`, so this is curation
     hygiene only.
   - `tiny-little-risk` 1 `[keyword:draw:2]`.
   - `up-the-ante` 0 `[keyword:draw:1]`.
   - Then run `node scripts/convert-cards/apply-hero-ability-markers.mjs` to regenerate `data/cards/amwp.json`.
4. **Executor** (`hero/heroEffects.execute.ts`):
   - `heroEffectHeist` enrols only, the `heroEffectExcessiveViolence` copy. It safe-skips an undefined `heistEffects`.
     - Normally it appends the card to `G.turnEconomy.heistCrewCards` and logs the locked "readied" line `applied`.
     - When `hasAttemptedHeistThisTurn` is already set, it does not enrol and logs the locked "too late" line `blocked`.
   - `fireHeistPlays(G, ctx, playerID)` fires each enrolled card's `heistEffects` through `executeSingleEffect`, in enrolment
     order. It returns the number of cards that fired at least one effect.
   - `'heist'` joins `HANDLED_KEYWORDS` (~l.153/298; `MVP_KEYWORDS` spreads it) and `NO_MAGNITUDE_KEYWORDS` (~l.558/688),
     both beside `'excessive-violence'`, plus the handler table (~l.7386). Without `NO_MAGNITUDE_KEYWORDS`, the magnitude pre-gate
     drops the magnitude-less `heist` descriptor and the card is never readied.
5. **Turn economy** (`economy/economy.types.ts`, `economy/economy.logic.ts`):
   - `heistCrewCards?: CardExtId[]` and `hasAttemptedHeistThisTurn?: boolean` are lazily materialized and omitted when unset.
   - An `enrollHeistCard` helper.
   - Both fields join the same-turn carry beside the Excessive Violence ledger, and both reset with the turn economy.
6. **Move** (`moves/attemptHeist.ts`, new):
   - **Validation:** `attemptHeist({ G, playerID, ...context }: MoveContext): void` takes no args (the
     `useRitualArtifact` shape, `moves/ritualArtifact.ts` ~l.252). The player is `context.ctx.currentPlayer`. It is internally
     gated to the `main` stage with the `useRitualArtifact` gates.
   - **Context forwarding:** the move forwards `context` to `fireHeistPlays`, so inner draws reshuffle through `ctx.random`
     exactly as at play (`heroEffectDraw` → `drawFromPlayerDeck`). The move's own count / reveal / compare logic uses no
     randomness.
   - **Import cycle:** `attemptHeist.ts` joins the runtime import cycle the way `ritualArtifact.ts` does (~l.22–24): it imports
     `heroEffects.execute`, and `uiState.build.ts` imports it. Imported bindings are read only inside function bodies; no
     top-level constant is built from them.
   - **Silent no-op** when any of these holds:
     - the stage is not `main`;
     - a choice is open (`hasAnyPendingChoice(G)`, the ritual gate);
     - `heistCrewCards` is empty or absent;
     - `hasAttemptedHeistThisTurn` is set;
     - `G.villainDeck.deck` is empty.
   - **Body:**
     1. Set `hasAttemptedHeistThisTurn`.
     2. Compute the Heist Count with `heistCount(G, playerID)`: distinct `cardStats[id].cost > 0` over the active player's
        hand plus `playedCardIdsStillInPlay(G, inPlay)`. An id with no `cardStats` entry contributes nothing.
     3. Read the top card and its printed VP with `heistRevealedVictoryPoints(G, cardId)`, by the D-24808 rule. A top card
        with no `villainDeckCardTypes` entry reads as 0 VP. Both helpers stay silent and never throw.
     4. Log the locked attempt line.
     5. Resolve:
        - **Higher:** `fireHeistPlays` plus the success line `applied`.
        - **Tied:** the tie line `blocked`.
        - **Lower:** `gainWoundWithOutcome`, then the caught line variant for its outcome (`'gained'`, `'no-wound'`,
          `'diving-block-pending'`) `blocked`. A `'gained'` or `'diving-block-pending'` Wound bumps `turnEconomy.woundsDrawn`;
          `'no-wound'` does not (the `heroEffectGainWound` convention, ~l.2091–2100). A `'diving-block-pending'` Wound is
          never logged as gained (D-24673).
   - **Locked:** no zone moves the revealed card. The move's own count / reveal / compare logic uses no `ctx.random`; inner
     effects may reshuffle through the forwarded context.
   - **Exports:** `heistCount`, `heistRevealedVictoryPoints` and `isHeistAvailable(G, playerID)` (the predicate the move
     validates and the projection reads).
7. **Registration** (`game.ts`): `attemptHeist: { move: attemptHeist, client: false }` with the `useRitualArtifact`-style
   `// why:` comment. It is not in `CORE_MOVE_NAMES` and not emitted by `getLegalMoves`.
8. **UIState** (the five-step contract, D-12803):
   - Two fields on `economy`: `heistAvailable?: true` (= `isHeistAvailable`) and `heistCount?: number` (the current Heist
     Count, present only with `heistAvailable`).
   - Declared in `ui/uiState.types.ts`, built in `ui/uiState.build.ts`, and passed through `ui/uiState.filter.ts`
     (active-player-only, absent from `REDACTED_ECONOMY`, omitted when unset).
   - A filter test asserts the active player sees both fields and other audiences see neither.
   - A built-projection keyset pin in `ui/uiState.types.drift.test.ts` covers both optional fields (the WP-739 / D-24372
     precedent, ~l.881). A runtime assertion, not a `satisfies`.
   - The executor confirms in Play Diagnostics that `uiStateSnapshot` carries them.
9. **Client:**
   - `'attemptHeist'` joins `apps/arena-client/src/components/play/uiMoveName.types.ts`.
   - `PlayedCardsRow.vue` renders an `Attempt Heist (Heist Count N)` button while `heistAvailable` is set, and dispatches
     `attemptHeist` with no args.
   - `PlayDesktop.vue` and `PlayMobile.vue` pass the two props, the ritual-options wiring precedent.
10. **Tests** (the EC Locked list): engine parse + move + projection + registration + drift, and client button.
11. **Regen + feeds:**
    - `pnpm ledger:heroes`, then `pnpm effect-index`, then `pnpm mechanics:metadata`.
    - `pnpm sim:runtime-observed` (the `heist` hollow entry moves).
    - `pnpm sim:coverage --update-baseline`.
    - The dashboard copies, plus `docs/ai/coverage/live-verify.json` pending rows for the six allowlisted cards.

## Out of Scope

- The four non-allowlisted Heist lines' payloads:
  - The Big Score: Master Strike KO and Bystander on top.
  - Revolutionary Anthem: Scheme Twist bonus and optional shuffle.
  - Putting a Crew Together: its count source.
  - X-Con Security Van: move a Villain, then KO a Hero.
  These stay honest hollows; a follow-up WP models them.
- Villain Fight-time Heist (Ghost Chasers) and the Safeguard Dark Secrets scheme ability, including "fought any Enemies with
  Heist abilities" as a Heist trigger.
- Bots attempting a Heist (`getLegalMoves` / bot policy), and a notable-event VFX beat for a Heist.
- Infiltrate line 1 (its next-hand extra draw) and Anything for Cassie line 0 (Wound return): other sessions or follow-ups.
- Any `HeroAbilityTiming`, `LOG_OUTCOMES`, `CORE_MOVE_NAMES` or `MatchSetupConfig` change. Hand-editing `data/cards/*.json`.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts`: modified (`'heist'`).
- `packages/game-engine/src/rules/heroAbility.types.ts`: modified (`heistEffects?`, D-24808).
- `packages/game-engine/src/setup/heroAbility.setup.ts`: modified (pattern, allowlist, fusion, non-allowlisted hollow).
- `packages/game-engine/src/hero/heroEffects.execute.ts`: modified (enrol handler, `fireHeistPlays`, executed-keyword set).
- `packages/game-engine/src/economy/{economy.types,economy.logic}.ts`: modified (two fields, enrol helper, carry).
- `packages/game-engine/src/moves/attemptHeist.ts`: **new**.
- `packages/game-engine/src/game.ts`: modified (registration; 01.5 runtime wiring).
- `packages/game-engine/src/index.ts`: **not modified**. Neither `useRitualArtifact` nor `ritualArtifactOptions` is exported;
  the client reads the projection and dispatches by move name.
- `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts`: modified (two fields).
- `apps/arena-client/src/components/play/{uiMoveName.types.ts,PlayedCardsRow.vue}` and
  `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue`: modified.
- `scripts/convert-cards/inputs/hero-ability-markers.json`: modified. `data/cards/amwp.json`: generated.
- `scripts/hero-mechanic-ledger.mjs`: modified. `'heist'` joins `BY_HOOK_KEYWORDS` (~l.174, the EV precedent ~l.151–158), so
  the ledger classifies each card by its own hook. Without it, the by-name `MVP_KEYWORDS` check would mark the `amwp/ant-army`
  Heist row executable, including Revolutionary Anthem's hollow.
- **Generated:**
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`
  - `data/metadata/effect-implementation-index.json`
  - `data/metadata/card-mechanics.json`
  - `docs/ai/coverage/runtime-observed-hollows.json`
  - `scripts/coverage/hero-effect-coverage.baseline.json`
  - `scripts/coverage/mechanic-provenance.json` (if the regen rewrites it)
  - `docs/ai/coverage/live-verify.json`
  - the `apps/dashboard/src/data/*` copies the regen rewrites
  - `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (the in-play pin, only if it moves)
- **Engine tests:**
  - **new:** `moves/attemptHeist.test.ts`, `setup/heistFusion.test.ts`;
  - **modified:** `game.test.ts`, `economy/economy.logic.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts`
    (the new keyset pin);
  - **count and drift pins that move with a new keyword, handler or move:**
    - `rules/heroKeywords.test.ts` (~l.68): the `HERO_KEYWORDS` count.
    - `rules/heroAbility.setup.test.ts` (~l.596–700): the ordered `HERO_KEYWORDS` drift list and its length.
    - `setup/heroAbility.setup.test.ts` (~l.1604): `HERO_KEYWORDS.length`.
    - `hero/heroEffects.execute.test.ts` (~l.152, ~l.8119): the `HERO_EFFECT_HANDLERS` length.
    - `moves/recruitSidekick.test.ts` (~l.358): the registered `moveNames.length`.
    - `game.test.ts` (~l.240, ~l.278–279): the "exactly N moves" count and the ordered move-name list (`attemptHeist` sorts
      after `advanceStage`).

    Each moves by exactly +1 for this WP's addition; that is an intentional product change, stated in the commit.
- **Client tests:** `apps/arena-client/src/components/play/PlayedCardsRow.test.ts`, `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.test.ts`.
- **Governance at close:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24808), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code
  (`docs/ai/REFERENCE/00.6-code-style.md`).
- **Moves:**
  - The move returns void and never throws.
  - The move's own count / reveal / compare logic uses no `ctx.random.*`. Inner effects may reshuffle through the forwarded
    context.
  - No clock, I/O or registry access in the move or the executor.
  - `G` holds only `CardExtId` strings and plain flags.
- **Gameplay unchanged** outside the ten Heist lines and the three markers. Every other card's hooks are byte-identical, so the
  core sentinel / `finalStateHash` and PAR pins must not move. A moved pin is a STOP, never a re-pin.
- The revealed card never leaves the top of the Villain Deck. The Heist never shuffles, draws or reorders that deck.
- Exactly one attempt per turn. The latch is set before resolution, so a mid-resolution re-entry is impossible.
- **Honest-Partial:** only the six allowlisted cards fire inner effects. Every other Heist line yields no effect, only a `heist`
  unresolved marker.
- **UIState:** both fields pass the five-step contract. Opponents never see `heistCount` (active-player-only, the
  `excessiveViolenceAvailable` disposition).
- **Code style:** no `.reduce()` in the executor or the move; no nested ternaries; JSDoc on every function; full-sentence log
  and error text.
- `data/cards/amwp.json` changes only through `apply-hero-ability-markers.mjs`. `pnpm cards:check` stays 0.

**Session protocol:** STOP and report if the HEAD re-probe of the ten lines differs from Assumes, if any core sentinel /
`finalStateHash` / PAR pin moves, or if a test passes only by editing a pin other than the listed +1 count pins.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- **Engine:**
  - the `attemptHeist` move (no args);
  - `UIState.economy.heistAvailable?: true` and `heistCount?: number`;
  - `TurnEconomy.heistCrewCards?` and `hasAttemptedHeistThisTurn?`;
  - `HeroEffectDescriptor.heistEffects?`;
  - the `'heist'` HeroKeyword;
  - the six-card `HEIST_CARDS` allowlist.
- **Client:** the `'attemptHeist'` UiMoveName and the PlayedCardsRow button.
- Every rule interpretation is locked in D-24808.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).

- **No conflict:** ten printed abilities that over-fire or do nothing today resolve under the published Heist rule.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; these are printed hero abilities, and nothing is bought.
- **Determinism preservation:**
  - The move reads the deck top and never shuffles.
  - The new fields are plain data, lazy, and absent in matches without Heist cards, so the core sentinels are byte-identical.
  - Seed-PAR is scheme-keyed and hero-agnostic.
  - Replays of earlier `amwp` matches that played a Heist card diverge on re-execution; stored `competitive_scores` rows stay
    frozen (D-24616 §5).
  - In-flight matches keep their setup-built hooks; a NEW match is needed to see the change.

## Funding Surface Gate

N/A. One gameplay button; no funding, pricing, navigation or account surface.

## API Catalog Update

N/A. No HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. **Allowlisted cards readied, not paid:** each of the six allowlisted cards parses (from committed data) to exactly one `heist`
   hook carrying the locked inner effects, and no play-time grant. Playing one logs the "readied" line and changes no resource.
2. **The other four are honest hollows:** The Big Score, Putting a Crew Together, X-Con Security Van and Revolutionary Anthem's
   Heist line each parse to a hook with no effects and `unresolvedMarkers: ['heist']`, and grant nothing at play.
   Revolutionary Anthem's Antics line is unchanged.
3. **Outcomes:**
   - **Higher:** Heist Count above the revealed card's VP fires every readied card's inner effects in readying order. The
     revealed card is still `villainDeck.deck[0]`.
   - **Tied:** no effect and no Wound.
   - **Lower:** the player gains exactly one Wound and no effect fires.
4. **Heist Count:** counts distinct non-zero printed costs over hand plus the cards played this turn that are still in play.
   - Two cost-6 cards count once.
   - 0-cost S.H.I.E.L.D. starters do not count.
   - A hand card's cost counts.
   - A played card that has since left play does not count.
   - An id with no `cardStats` entry contributes nothing.
5. **Revealed-card VP:**
   - villain = `cardVictoryPoints` ?? `VP_VILLAIN`;
   - henchman = `cardVictoryPoints` ?? `VP_HENCHMAN`;
   - bystander = `VP_BYSTANDER`;
   - Scheme Twist and Master Strike = 0.
6. **No-ops:** each of these is a silent no-op that leaves `G` unchanged:
   - a second attempt in the same turn;
   - an attempt with nothing readied;
   - an attempt with an empty Villain Deck;
   - an attempt outside `main`;
   - an attempt while a choice is open.

   A Heist card played after the attempt is not readied and logs the "too late" line.
6a. **No token leak:** playing an allowlisted card through `executeHeroEffects` readies it (proves the magnitude pre-gate keeps
    it). Its `heistEffects` deep-equal the locked inner effects and contain no `'heist'` descriptor.
6b. **Wound outcomes:** a lost Heist with an empty Wound supply logs the no-wound variant and gains nothing. A Diving Block
    pending Wound is not logged as gained.
7. **UIState:** the active player sees `heistAvailable: true` and `heistCount` exactly while `isHeistAvailable` holds. Opponents
   and spectators never see them.
8. **Client:** the button renders only with `heistAvailable`, shows the Heist Count, and dispatches `attemptHeist`.
9. **Builds and tests:** `pnpm -r build` 0. `pnpm -r --no-bail test` shows 0 fail in every package. No existing test is
   weakened or skipped, and no pin literal is edited except the listed +1 count pins.

## Verification Steps

1. `pnpm -r build`, then `pnpm -r --no-bail test`, then `pnpm --filter @legendary-arena/arena-client typecheck` (0). Record each package's count; engine and arena-client grow by the new tests.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate`, `pnpm cards:check` and
   `pnpm cards:count-markers:check`: 0.
3. In this order:
   1. `pnpm ledger:heroes`
   2. `pnpm effect-index`
   3. `pnpm mechanics:metadata`
   4. `pnpm sim:runtime-observed`
   5. `pnpm sim:coverage --update-baseline`

   Then each `:check` (`ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
   `sim:coverage --check`): 0.
4. Dashboard: `pnpm --filter dashboard prebuild:coverage`, then `test:coverage`: 0.
5. `pnpm ledger:numbers:check`, `pnpm roadmap:counts:check`, `pnpm workindex:rows:check` and `pnpm workindex:executed:check`: 0.
6. `git diff --name-only origin/main` ⊆ Files Expected to Change.
7. **D-24026** (after deploy, NEW match with Wasp + Scott Lang, Cat Burglar on play.legendary-arena.com):
   - Infiltrate played alone grants only its printed 1 Attack and shows Attempt Heist.
   - A won Heist adds +3.
   - A lost Heist gains a Wound.
   - The button disappears after one attempt.

## Definition of Done

- All Acceptance Criteria hold, with the Verification Steps' commands and output tails pasted in the PR.
- Two-commit topology:
  - `EC-903:` implementation;
  - a `SPEC:` close with D-24808 Active, a dated STATUS entry, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ +
    `pnpm roadmap:counts:write`, and NUMBER-LEDGER LANDED.
- Live-on-surface (D-24026): Verification Step 7 confirmed on play.legendary-arena.com in a match created after the deploy
  (`isMatchOlderThanServer: false`), with log lines as evidence. Until the operator runs it, it is recorded operator-pending in
  `STATUS.md` with the six `live-verify.json` rows.
- No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

**D-24808 — Heist.**

1. **Enrol now, fire later.** A Heist line fuses into one enrol-at-play `heist` hook (the D-24556 Excessive Violence shape). The
   inner effects fire only from the `attemptHeist` move, on a successful attempt.
2. **The move.** `attemptHeist` is a non-core, `main`-stage, server-only move, not in `getLegalMoves` (the D-24794 precedent).
   It is blocked while a choice is open. It allows one attempt per turn; the latch is set before resolution. A Heist card played
   after the attempt is too late and is not readied.
3. **Heist Count.** Distinct non-zero printed costs over the "Heroes you have" pool: hand plus `playedCardIdsStillInPlay`
   (rules v23 ~l.3439–3450, D-24529). Ids without a `cardStats` entry contribute nothing.
4. **Revealed-card VP.** Villain and henchman: printed VP from `cardVictoryPoints`, else the scoring fallback `VP_VILLAIN` /
   `VP_HENCHMAN`. Bystander: `VP_BYSTANDER`. Every other type, and a card with no `villainDeckCardTypes` entry: 0. The card stays
   on top. An empty Villain Deck makes the Heist unavailable.
   - **Accepted residual:** a printed VP that `normalizePrintedVictoryPoints` rejects falls back to the scoring constant (1).
     That covers six mgtg cards printing `-1` and five printing `1*`, `2+`, `3+` or `3*`. On a revealed `-1` card, a Heist
     Count of 1 therefore ties instead of succeeding. Parsing the raw values would need a new setup-built map, which is out of
     scope.
5. **Outcomes.** Higher fires every readied card's Heist ability in readying order. Tied does nothing. Lower gains one Wound
   through `gainWoundWithOutcome`, logged per outcome; a Diving Block pending Wound is not logged as gained.
6. **Allowlist.** Six allowlisted cards. The parser strips the Heist prefix so no nested `heist` descriptor exists, and the hook
   is emitted at the line's own index. Every other Heist line is an honest `heist` hollow with no play-time payout (the
   Honest-Partial Invariant), and it does not ready a Heist. The four deferred lines and Enemy/scheme Heist are follow-ups.
7. **Visibility.** `heistAvailable` / `heistCount` are active-player-only economy projections. Bots never attempt a Heist.

## Pre-flight (01.4) and Copilot (01.7)

**Pre-flight (01.4): READY TO EXECUTE** (2026-11-05, an independent subagent, four passes; pass 3 re-confirmed the result
after the copilot fixes, its PS-9 wording fix is folded in, and pass 4 re-confirmed it after the 00.3 lint fixes).

- **Pass 1: NOT READY**, six blocking items, all folded in:
  - PS-1: the `[keyword:Heist]` token leaked into `heistEffects`; the prefix is now stripped.
  - PS-2: `NO_MAGNITUDE_KEYWORDS`, not `MVP_KEYWORDS`.
  - PS-3: four count/drift pin files were missing.
  - PS-4: the fused hook is emitted at its line index, so `amwpWaspSizeChanging.test.ts` stays green.
  - PS-5: `BY_HOOK_KEYWORDS` in the hero ledger.
  - PS-6: the reserve merge is an execution precondition.
  - Ten clarifying items folded in as well: the open-choice gate, wound outcomes, the VP fallback, too-late cards, the keyset pin,
    WP-866, `index.ts`, the constant location and `_deferred` hygiene, and the Putting a Crew Together reason.
- **Pass 2: READY**, after three more text fixes:
  - PS-7: the `game.test.ts` move pins, and AC-9's wording.
  - PS-8: `woundsDrawn` follows `heroEffectGainWound`.
  - RS-11/12: the baseline note, and no widen-fusion.
- **Verified** against code at HEAD:
  - the rule text;
  - the ten lines and their indices;
  - the observed parse (probe re-run at `260af872`);
  - every helper;
  - no PAR, sentinel or coverage fixture contains `amwp` Heist heroes; `sim:runtime-observed` does sweep them, which is
    allowlisted regen.

**Copilot (01.7): PASS** (2026-11-05, an independent subagent, two passes).

- **Pass 1: RISK / HOLD**, five items, all folded in:
  - F1: the Heist Count pool became "Heroes you have" = hand + `playedCardIdsStillInPlay` (rules ~l.3439, D-24529; it had read
    played-only).
  - F2: the move takes the `MoveContext` signature and forwards the context so inner draws can reshuffle; the no-random rule
    covers only the move's own logic.
  - F3: the import-cycle guardrail.
  - F4: missing-entry handling.
  - F5: the VP-fallback residual.
- **Pass 2: PASS / CONFIRM.** Its one-word Assumes fix (the helper name) is folded in.
- **Pre-flight pass 3 re-confirmed READY** after these edits. After the 00.3 lint fixes, pre-flight pass 4 READY and a copilot
  re-confirm PASS; the lint re-check is clean (21/21).

## Lint Gate Self-Review (00.3)

Independent subagent, 2026-11-05. The first pass had seven FAILs, now fixed:

- §2: constraints lacked the full-file / ESM / 00.6 line, session protocol and locked-values pointer.
- §3: Assumes lacked `executeSingleEffect`, `parseAbilityText` / `KEYWORD_PATTERN`, `hasAnyPendingChoice`, `MoveContext`,
  `REDACTED_ECONOMY` and the two model tests.
- §4: Context lacked ARCHITECTURE / 00.2 §5 / 03-DATA-PIPELINE / 00.6 / the DECISIONS scan list.
- §13: no arena-client `typecheck`; the EC lacked `roadmap:counts:check`.
- §15: the DoD lacked the scope-boundary check and a live-confirmed D-24026 item.
- §15.2: no Risk Tier line in WP or EC.
- §16.3: `heistAttemptedThisTurn` renamed `hasAttemptedHeistThisTurn`.

Result after the fixes:

- **§1 structure:** all template sections present. Out of Scope names the four deferred payloads, Enemy/scheme Heist, bots and
  VFX, Infiltrate line 1 / Cassie line 0, and timing / outcome / core-move / setup changes plus hand-edited card data. **PASS.**
- **§2 constraints:** full-file output, no diffs or snippets, ESM, Node v22+, `00.6-code-style.md` cited. Packet-specific: no
  randomness in the move's own logic, the revealed card stays on top, one latched attempt, Honest-Partial, five-step UIState,
  pipeline-only card data. Session protocol present; locked values → EC. **PASS.**
- **§3 Assumes:** baseline + reserve #3171, the rule text and the ten lines, the observed parse, the EV and Ritual precedents,
  every helper and test model with its location, the WP-866 parallel rule. **PASS.**
- **§4 Context:** why now, why the EV shape, Honest-Partial, the D-24808 interpretation, one WP not a split, test-authoring
  notes, ARCHITECTURE §Principles #2 / §Layer Boundary / §Card Data Flow, 00.2 §5 / §5.1, 03-DATA-PIPELINE §1, 00.6 and the
  DECISIONS scan list. **PASS.**
- **§5 files:** engine, client, data, generated, test and close files, each tagged with its role; past ~8 only through regen,
  pins and governance, and the split is argued against in Context. **PASS.**
- **§6 naming:** no 00.2 or setup field touched; every cited path exists at HEAD. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency. The engine decides; the projection goes through the filter whitelist; the
  client dispatches by name; `index.ts` is unchanged. **PASS.**
- **§9:** `pnpm` / `node` / `git` only. **PASS.** **§10 / §11:** no env var, no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, `makeMockCtx`, committed data through a `getSet` stub, no `boardgame.io` import, no
  network or DB. No deck construction, so the golden test is N/A. **PASS.**
- **§13 verification:** exact commands with exits, including arena-client `typecheck`, the regen chain and its `:check`s, and
  the D-24026 live steps. **PASS.**
- **§14:** 11 binary criteria tied to hooks, outcomes, counts, fields and the button. **PASS.**
- **§15 / §15.1 / §15.2:** the DoD names STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the ledger, plus the
  scope-boundary diff check and a D-24026 live item on a post-deploy match. `**Risk Tier:** MEDIUM`, mirrored verbatim in the
  EC. **PASS.**
- **§16 code style:** no `.reduce()` or nested ternaries; JSDoc on every function; boolean fields `has…`; `// why:` locations
  locked in the EC; the move never throws. **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, a no-conflict line, an NG-1 line and a determinism line (deck top read only, lazy
  fields, core sentinels byte-identical). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** commit-time rule. **N/A.**
- **§20 funding / §21 API catalog:** N/A, with the statements above. **PASS.**
