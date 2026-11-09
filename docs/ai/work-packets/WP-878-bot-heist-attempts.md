# WP-878 — Bots attempt a Heist when the card-count odds favor it (Game Engine simulation / bot policy)

**Status:** Draft 2026-11-08 (EC-916; D-24826 reserved)
**Layer:** Game Engine, simulation / bot-policy files only (`packages/game-engine/src/simulation/**`), plus a header-comment
refresh in `moves/attemptHeist.ts`. No rules, move, UIState, client or server code changes. The server bot drivers
(`apps/server/src/autoplay/autoplay.mjs`, `apps/server/src/bot-ally/botAllyDriver.mjs`) pick the change up unmodified
through `getLegalMoves` and the competent policy.
**User-Visible Surface:** play.legendary-arena.com (bot allies and autoplay bots in matches whose loadout includes Ant-Man and the Wasp Heist Hero decks)
**Risk Tier:** MEDIUM — bot behavior and bot-driven simulation output for loadouts with an `amwp` Heist Hero; no rules, UIState, auth, money, persistence, client or server code
**Hard-deps:** WP-865 / D-24808 (Heist: `attemptHeist`, `isHeistAvailable`, `heistCount`, `heistRevealedVictoryPoints`) ✅,
WP-876 / D-24823 (all ten Heist lines fire; bot answers for the X-Con move and the Anthem shuffle) ✅, WP-757 / D-24587
(the precedent for a non-core move that `getLegalMoves` emits and both simulation `MOVE_MAP`s dispatch) ✅, D-24591 (the
autoplay spend filter excludes loop-driven moves instead of allow-listing spend moves) ✅

## Goal

Today no bot ever attempts a Heist: `getLegalMoves` never emits `attemptHeist`, so a bot that readies a Heist card just
loses the payoff. After this WP a bot (simulation, PAR, server autoplay and bot ally) attempts a Heist when the odds favor
it. The bot looks at the cards still in the Villain Deck as a set (which cards, never their order and never the top card)
and attempts only when more of them would lose to its Heist Count than would beat it, that is when a win is more likely
than a Wound. It attempts after its hand is played out, so every Heist card in hand is readied first, and before plain
fights and recruits, so a Heist that draws cards still gets those cards played. It never attempts a Heist whose only
readied card is X-Con Security Van, because its bot answer declines that card's move, so a won Heist would gain nothing.

## User-Visible Impact

- In a match whose loadout includes the Scott Lang, Cat Burglar, Wasp, Ant-Man or Ant Army Hero decks, a bot (bot ally or
  autoplay) that readies a Heist card now attempts a Heist on turns where the odds favor it. The game log shows `Player N attempts a Heist: Heist Count C against <card> (V VP).` followed by the shipped
  worked / sideways / caught line, and the bot's decision log shows `[Bot] Chose: attemptHeist (score 175)`.
- **Observed today, operator match `mjw8byyMwLY`** (cited in WP-876 §User-Visible Impact, files
  `C:\pcloud\matches\chmp\FinFangFoom-MidtownBankRobbery-{LOG,DIAGNOSTICS,GAME}-2p-bishop.*`, since replaced by the
  `bo4ZSQLBuQU` copies): Player 1, a bot, readied Petty Larceny on turns 8, 10 and 14 (log 8.2.6, 10.2.5, 14.2.3) and
  never attempted a Heist, so its +2 Recruit never fired.
- A human player's Heist is unchanged: the Attempt Heist button, the move, its legality and its outcomes are untouched.

## Assumes

- **Baseline:** `origin/main` at `fab672cc` (WP-876 merged as #3244; the reserve #3245 for WP-878 / EC-916 / D-24826;
  WP-877, which touches none of this WP's files). Code citations were verified at `799463b4`; none of the cited files changed since.
  D-24825 is held by open PR #3239 and is not used here.
- **Rule:** Universal Rulebook v23 p.26–27 (`docs/legendary-universal-rules-v23.md` ~l.1506–1522, ~l.1546–1556): once per
  turn, if you played any Heroes with Heist abilities, you *may* attempt a Heist; higher than the revealed card's VP uses
  every Heist effect, tied does nothing, lower gains a Wound; "You don't have to go on a Heist. Weigh it carefully!"; a
  Heist card played after the one attempt is too late.
- **Policy decision (Jeff, 2026-11-08, this drafting session):** of four options put to him (card-count odds; always
  attempt; attempt only when the bot cannot lose; peek at the hidden top card), Jeff chose **card-count odds**: the bot
  counts the cards still in the Villain Deck, ignoring their order, and attempts when P(win) > P(lose). It never reads the
  top card. This WP implements that choice; it does not re-open it.
- **Shipped Heist surface (verified at `799463b4`, `packages/game-engine/src/moves/attemptHeist.ts`):**
  - `heistCount(G, playerId)` (~l.47): distinct non-zero printed costs over hand plus `playedCardIdsStillInPlay`.
  - `heistRevealedVictoryPoints(G, cardId)` (~l.77): printed VP for villain / henchman (scoring fallback when absent),
    1 for a Bystander, 0 for a Scheme Twist, a Master Strike or an unclassified card.
  - `isHeistAvailable(G, playerId)` (~l.107): `main` stage, no choice open, a readied crew, no attempt yet this turn, a
    non-empty Villain Deck. The single legality predicate of the move and of `economy.heistAvailable`.
  - `attemptHeist` (~l.158): non-core move registered `{ move: attemptHeist, client: false }` (`game.ts` ~l.613), no
    arguments, never throws. Its header (~l.15) says "getLegalMoves never emits the move, so bots never Heist."
  - `getHooksForCard(hooks, cardId)` (`rules/heroAbility.types.ts` ~l.437) and the crew walk in `fireHeistPlays`
    (`hero/heroEffects.execute.ts` ~l.7405–7436), which `hasBotHeistPayoff` mirrors. X-Con Security Van fuses to exactly
    one inner effect, `heist-move-villain-ko-hero` (`setup/heistFusion.test.ts` ~l.54–56); every other allowlisted Heist
    card carries an unconditional payoff.
- **Bot answers already shipped (WP-876 / D-24823 §7):** `selectDefaultMoveVillainArgs` declines the X-Con variant
  (`simulation/ai.legalMoves.ts` ~l.365–372); `chooseByKind` leaves the Villain Deck for the Anthem shuffle
  (`simulation/ai.seatChoice.ts` `chooseByKind` ~l.110, the arm ~l.131–136); the `ko-hero`, rescue and draw paths already have bot answers. Both comments
  say "Never reached while bots do not attempt a Heist (D-24823 §7)".
- **Bot plumbing (verified at `799463b4`):**
  - `getLegalMoves` (`simulation/ai.legalMoves.ts` ~l.468) returns early on every parked choice, then enumerates the main-
    stage steps 1–4b (play, recruit, fight, fortifier fight, Mastermind, exorcise), 5 reveal, 6 advance, 7 end turn, in the
    order RS-13 locks. Step 4b (`exorciseHauntedHero`, WP-757) was appended after step 4 so steps 1–4 kept their order.
  - `SIMULATION_MOVE_NAMES` (~l.120–257) lists every move `getLegalMoves` can emit; `simulation.moveDispatch.drift.test.ts`
    asserts each one is a key of both `MOVE_MAP`s (`simulation.runner.ts` ~l.343, exported keys ~l.438;
    `par.aggregator.ts` ~l.499, exported keys ~l.579). A missing key hangs the per-turn loop (WP-289 / D-24073).
  - The competent policy (`simulation/ai.competent.ts`) scores each legal move (`scoreOneMove` ~l.371): fight Mastermind
    1500, fight Villain 100 (+500 Bystander, +800 slot 4), reveal 400, play a card 200 (201 for a first-Hero card, -1 for a
    Wound), recruit 50, exorcise 75, advance 10, end turn 5; an unknown move name scores 0. The highest score wins, ties
    broken by the seeded RNG.
  - The random policy (`ai.random.ts`) picks uniformly among legal moves.
  - Server autoplay plays the hand (`playHandCards`), then offers the policy every non-loop-driven, non-`resolve…` legal
    move (`selectSpendMoves`, `autoplay/botLoopProgress.mjs` ~l.90–125, D-24591), so `attemptHeist` reaches the policy with
    no server edit. The bot-ally driver calls `getLegalMoves` and the policy per step (`bot-ally/botAllyDriver.mjs` ~l.290,
    ~l.321).
  - The simulation loops reset `turnEconomy` per turn with `resetTurnEconomy()` (`simulation.runner.ts` ~l.931,
    `par.aggregator.ts` ~l.970), which drops `heistCrewCards` and the one-attempt latch, so the once-per-turn rule holds
    in the loops exactly as in `game.ts` (~l.1144). `onBeginParity.ts` needs no change.
- **Prior card-counting prohibition (superseded for this gate only):** `createCompetentHeuristicPolicy`'s docstring
  (`simulation/ai.competent.ts` ~l.530–535) lists "Exact card counting or hidden-state inference" under "Forbidden
  behaviors (permanent, not just at MVP)", and WP-049 says it twice (Heuristic 4, ~l.152: track coarse deck state, no exact card counting; §A.4,
  ~l.274: "No exact card counting"). The WP-049 post-mortem (`01.6-WP-049`, ~l.188) records "T2 policy does not consult
  deck composition" as the behavior at that time; it is historical, and neither completed file is edited. Jeff's 2026-11-08 choice of card-count odds supersedes both for the Heist gate only (D-24826 §5). The count
  lives in `getLegalMoves` (`simulation/ai.heist.ts`), which already reads `G`; the policy itself still never reads raw
  `G` and never counts cards for any other decision. It infers no hidden state: the deck's order and top card stay unread.
- **Stale "bots never Heist" comments outside the simulation folder:** `game.ts` ~l.608–612 (the `attemptHeist`
  registration comment: "not emitted by getLegalMoves, so bots never attempt a Heist") and `game.test.ts` ~l.278 (the
  move-list pin comment: "absent from bot / simulation / fixture dispatch"). Both become comment-only edits in this WP.
- **Fixture posture (re-checked at `799463b4`):** `git grep` for `scott-lang-cat-burglar`, `amwp/ant-army`, `amwp/wasp`
  and `amwp/ant-man` outside card data and docs finds only unit tests, `scripts/runtime-observed-hollows.mjs` and
  `content/themes/ultron-age.json` (~l.14–15: a themed loadout with `amwp/ant-man` and `amwp/wasp`; no sim, PAR or hash pin
  reads themes, and a bot game on that theme differs by design). The one
  replay sentinel (`test/fixtures/games/sentinel-core-doom-2p.replay.json`), the hash oracles and the PAR fixtures use no
  `amwp` Hero.

## Context (Read First)

### Why the gate lives in `getLegalMoves`

`getLegalMoves` is the bot's move menu, not a human legality oracle: it already leaves out legal moves a bot should never
pick (it never offers to play a Wound; under The Unbreakable Enigma Code it offers the Mastermind fight only once the bot
has seen the whole code, `chooseBotEnigmaGuess`). Putting the Heist odds test there means every bot policy (competent,
random, autoplay, bot ally) attempts only under Jeff's rule, and every emitted `attemptHeist` is one the move accepts,
because the test begins with `isHeistAvailable` (the D-24364 mirror rule: a move precondition ships with its enumeration
mirror).

### What "card-count odds" reads

The bot reads `G.villainDeck.deck` only as a set: one counting loop over every card that tallies win / tie / lose against
its Heist Count. The tally is the same for any order of the deck, so the top card has no special weight. That set is
public in principle: a player who tracks the setup composition and every card revealed, KO'd or shuffled in knows exactly
which cards remain. A human would have to track it by hand; the bot tracks it perfectly. Jeff accepted that when he chose
this option over "always attempt" and "only when it can't lose". The test is
`winCount > loseCount`; ties count as neither, so a deck where every card ties never draws an attempt.

This is exact card counting, which the competent policy's docstring and WP-049 §A.4 forbid. Jeff's choice supersedes that
prohibition for this gate only; D-24826 §5 records it and `ai.competent.ts` gains a one-line carve-out in its docstring.

The random policy (`ai.random.ts`) picks uniformly among legal moves, so it may attempt a Heist before playing its whole
hand. That is by design (it is the passive baseline); the play-the-hand-first ordering below is the competent policy's.

### Why score 175

The bot must play its whole hand before attempting (a Heist card played after the attempt is too late, rules ~l.1516–1519)
and should attempt before plain spends (a Heist that draws cards then has those cards played). 175 sits below every
playable card (200) and above a plain fight (100), exorcise (75), recruit (50), advance (10) and end turn (5). Fights with
a Bystander or slot-4 bonus (600 and up) and the Mastermind fight (1500) still go first. That is harmless: they spend
Attack, and the Heist stays available until the bot advances out of `main`, which scores 10. A drawn Heist card played
after the attempt is too late by rule; the shipped `blocked` line already says so.

### X-Con Security Van alone

X-Con Security Van's Heist ability is a move-a-Villain choice the bot declines (D-24823 §7, load-bearing for termination).
A won Heist whose only readied cards are X-Con Security Van therefore gains the bot nothing, while a lost one costs a
Wound. `hasBotHeistPayoff` returns false for that crew, so the bot does not attempt. Any other readied card (including a
second card alongside X-Con) restores the payoff. This follows from the shipped bot answer; it is not a second policy.

### Determinism and pins

Only boards with a readied `amwp` Heist card can change: elsewhere `isHeistAvailable` is false, step 4c emits nothing, and
`getLegalMoves` output, the policy's choices and the seeded RNG draws are byte-identical. So:

- **Cannot move (a move is a STOP):** the core replay sentinel, `finalStateHash` / hash-oracle pins, PAR fixtures and pins,
  `sim:coverage --check` (it builds hooks statically and runs no bot).
- **Can move, on purpose:** `sim:runtime-observed` (`docs/ai/coverage/runtime-observed-hollows.json`). Its `amwp` board
  includes `amwp/ant-army` (Up the Ante, Revolutionary Anthem) and `amwp/ant-man` (Tiny little Risk), and its 8
  competent-bot games now attempt Heists and
  diverge. The script runs each board in isolation (its own `sweepSetupMatrix` call and seed), so only the `amwp` board can
  move. Regenerate it; the moved observations must be explainable by the `amwp` board. If it moves, the dashboard
  in-play baseline (`apps/dashboard/src/data/in-play-hollow-baseline.json`, `build:in-play-baseline`) and the
  `useInPlayCoverage.test.ts` pin may move with it (the `reference_inplay_totalobs_pin_stale_on_feed_regen` path:
  `prebuild:coverage` first).
- **Not pinned, will differ:** a PAR computed after this WP for a loadout with an `amwp` Heist Hero, a sweep, or a
  `sim:coop-winrate` run over one. Stored PAR and `competitive_scores` rows are not recomputed.

### Lane

Two-session standard lane. Not lightweight: it touches bot-driven simulation output (PAR / determinism surfaces, 01.0a
§Lightweight criterion 6).

## Scope (In)

1. **New `simulation/ai.heist.ts`** (pure; no `boardgame.io` import; reads `G`, never mutates it):
   - `interface HeistOdds { readonly winCount: number; readonly tieCount: number; readonly loseCount: number }`.
   - `countHeistOdds(G, playerId): HeistOdds`: `count = heistCount(G, playerId)`; for each `cardId` of
     `G.villainDeck.deck` (a `for...of`, no `.reduce()`): `victoryPoints = heistRevealedVictoryPoints(G, cardId)`;
     `count > victoryPoints` adds a win, `count === victoryPoints` a tie, else a lose. Empty or absent deck: all zero.
   - `hasBotHeistPayoff(G): boolean`: walks the crew exactly as `fireHeistPlays` does (`hero/heroEffects.execute.ts`
     ~l.7415–7430): `for (const cardId of G.turnEconomy.heistCrewCards ?? [])`, then `for (const hook of
     getHooksForCard(G.heroAbilityHooks ?? [], cardId))`, then `for (const effect of hook.effects ?? [])` skipping any
     `effect.type !== 'heist'`, then `for (const innerEffect of effect.heistEffects ?? [])`. True as soon as one
     `innerEffect.type !== 'heist-move-villain-ko-hero'`; false otherwise (an empty crew, or X-Con copies only).
   - `shouldBotAttemptHeist(G, playerId): boolean`: `isHeistAvailable(G, playerId) && hasBotHeistPayoff(G) &&
     odds.winCount > odds.loseCount`, as an explicit `if` chain.
2. **`simulation/ai.legalMoves.ts`:**
   - Append `'attemptHeist'` to `SIMULATION_MOVE_NAMES` with a `// why:` (WP-878 / D-24826).
   - New step **4c**, after 4b and before 5: `if (stage === 'main' && shouldBotAttemptHeist(gameState, activePlayer))`
     push `{ name: 'attemptHeist', args: {} }`. Add the 4b line (missing today) and the 4c line to the header's
     enumeration list.
   - Refresh the `selectDefaultMoveVillainArgs` comment: the X-Con decline is now reached (bots attempt Heists, D-24826),
     and it stays load-bearing.
3. **`simulation/ai.competent.ts`:** `SCORE_ATTEMPT_HEIST = 175` with a `// why:` (the ordering in §Context) and a
   `scoreOneMove` arm `if (move.name === 'attemptHeist') return SCORE_ATTEMPT_HEIST;`. Its "Forbidden behaviors" docstring
   line "Exact card counting or hidden-state inference." gains the carve-out: the Heist gate's set count in
   `getLegalMoves` (D-24826) is the one exception; the policy still never reads raw `G`.
4. **`simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`:** a `MOVE_MAP` entry
   `attemptHeist: (context) => attemptHeist(context as never)` with a `// why:` (the WP-757 comment shape) and the import.
5. **Comment refreshes only:** `simulation/ai.seatChoice.ts` (the shuffle answer is now reached); `moves/attemptHeist.ts`
   header (getLegalMoves emits the move when `shouldBotAttemptHeist` passes, D-24826; humans unchanged); `game.ts` ~l.608–612
   (the `attemptHeist` registration comment; the registration itself is untouched); `game.test.ts` ~l.278 (the move-list
   pin comment; the asserted list is untouched).
6. **Tests:**
   - New `simulation/ai.heist.test.ts`: odds tally (a hand-built `G`: Heist Count 2 against a deck of Twist 0, Bystander 1,
     henchman 1, villain 2, villain 4 → win 3, tie 1, lose 1); the deck reversed gives the same tally and decision;
     **no peeking:** a deck whose top card would lose but whose odds favor → true, and a deck whose top card would win but
     whose odds do not → false; ties alone → false; X-Con-only crew → false, X-Con plus Petty Larceny → true; each
     `isHeistAvailable` failure (wrong stage, choice open, empty crew, latch set, empty deck) → false; **no mutation:** a
     `structuredClone(G)` taken before calling `countHeistOdds`, `hasBotHeistPayoff` and `shouldBotAttemptHeist` deep-equals
     `G` afterwards.
   - `simulation/ai.legalMoves.test.ts`: `attemptHeist` is emitted exactly once, after every 4b entry and before
     `advanceStage`, when `shouldBotAttemptHeist` is true; not emitted when false or outside `main`; **guard parity:** the
     emitted move, run through the `attemptHeist` move with a mock context, sets `hasAttemptedHeistThisTurn` (it commits),
     and after it `getLegalMoves` no longer emits it. **Newly reached answers:** an X-Con Security Van + Petty Larceny crew
     with a winning deck and a City holding a Villain and an empty space, run through the `attemptHeist` move with a
     runner-shaped context (`{ G, playerID, ctx: { phase, turn, currentPlayer, numPlayers }, events: { setPhase, endTurn },
     random: { Shuffle } }`, the `SimulationMoveContext` shape, `simulation.runner.ts` ~l.178–197; the runner's `MOVE_MAP`
     is module-private and gains no export), parks the X-Con choice; `getLegalMoves` then yields the X-Con decline, and
     `resolveMoveVillainChoice` with those args empties the queue. The drift test proves the `MOVE_MAP` entry exists.
   - `simulation/ai.competent.test.ts`: with `playCard`, `attemptHeist`, a plain `fightVillain`, `recruitHero`,
     `exorciseHauntedHero` and `advanceStage` legal, the policy picks `playCard`; without `playCard` it picks `attemptHeist`;
     a Mastermind fight still beats it.
   - `simulation/simulation.moveDispatch.drift.test.ts`: an explicit block asserting `attemptHeist` is in
     `SIMULATION_MOVE_NAMES` and both `MOVE_MAP` key sets (the WP-757 block shape).
7. **Regenerated feed (only if it moves):** `pnpm sim:runtime-observed` → `docs/ai/coverage/runtime-observed-hollows.json`;
   then dashboard `prebuild:coverage` / `build:in-play-baseline` and the `useInPlayCoverage.test.ts` pin only if they move.
8. **Termination evidence (not committed):** a throwaway scratchpad probe over the compiled `dist`
   (`simulateOneGameAndCaptureMoves`, `simulation.runner.ts` ~l.1349, + `createCompetentHeuristicPolicy`; sentinel core,
   heroes `amwp/scott-lang-cat-burglar`, `amwp/ant-army`, `amwp/wasp`, `amwp/ant-man`, `core/black-widow`, 8 seeds,
   1 player). Its result (`CapturedGameResult`, ~l.1261–1273) carries the move list and `endgameReached`, not the final `G`
   or the game log, so the probe records only what the move list shows: games run; `attemptHeist` moves;
   `resolveMoveVillainChoice` `{ decline: true }` moves (each one a won Heist that parked the X-Con choice);
   `resolveSeatChoice` moves right after an `attemptHeist` or a `resolveMoveVillainChoice` (an upper bound on Anthem
   shuffle answers); and `endgameReached` for every game. Zero is allowed for the X-Con and Anthem counts, but it is
   stated. Won / tied / lost splits are not required. Its output goes into D-24826 §Execution notes.

## Out of Scope

- Any change to the Heist rule, `attemptHeist`, `isHeistAvailable`, `heistCount`, UIState, the client or the server. The
  server bot drivers change behavior only through `getLegalMoves` and the policy.
- A payoff-weighted expected-value rule, a smarter X-Con answer (moving a Villain, then KOing a starter), Anthem shuffling,
  or logging the odds in the bot's decision log. Each is a later refinement with its own D-entry.
- Enemy and scheme Heist (Ghost Chasers, Safeguard Dark Secrets), not yet implemented.
- `test/fixtures/runFixture.ts`'s `MOVE_MAP` (no fixture scripts a Heist) and `replay/replay.execute.ts`'s `MOVE_MAP`
  (its subset map already skips `attemptHeist` and every `resolve…` move for any recorded game, including bot games
  recorded by `scripts/record-game-fixture.mjs`; no fixture records an `amwp` Heist; a separate concern).
- Server autoplay playing cards a Heist drew after its hand phase (`playHandCards` runs once per turn; pre-existing for
  every mid-spend draw).

## Files Expected to Change

Engine (`packages/game-engine/src/`):
- `simulation/ai.heist.ts` (**new**)
- `simulation/ai.heist.test.ts` (**new**)
- `simulation/ai.legalMoves.ts`
- `simulation/ai.legalMoves.test.ts`
- `simulation/ai.competent.ts`
- `simulation/ai.competent.test.ts`
- `simulation/ai.seatChoice.ts` (comment only)
- `simulation/simulation.runner.ts`
- `simulation/par.aggregator.ts`
- `simulation/simulation.moveDispatch.drift.test.ts`
- `moves/attemptHeist.ts` (header comment only)
- `game.ts` (the `attemptHeist` registration comment only)
- `game.test.ts` (the move-list pin comment only)

Generated (only if it moves):
- `docs/ai/coverage/runtime-observed-hollows.json`
- `apps/dashboard/src/data/in-play-hollow-baseline.json`
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (pin literal only, only if its generated input moved)

Governance close:
- `docs/ai/DECISIONS.md` (D-24826), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`

`packages/game-engine/src/index.ts` is NOT modified (`ai.heist.ts` is internal to the simulation layer).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code
  (`docs/ai/REFERENCE/00.6-code-style.md`).
- **No peeking:** nothing in this WP reads `villainDeck.deck[0]` or any single deck index; the odds come from one counting
  loop over the whole deck. A test pins it (deck reversal; losing-top / winning-top cases).
- **Determinism:** no randomness, clock or I/O in `ai.heist.ts`; the policy's existing seeded RNG is the only tie-breaker.
  On every board without a readied Heist card, `getLegalMoves` output and every bot choice are byte-identical.
- **Guard parity (D-24364):** every emitted `attemptHeist` passes `isHeistAvailable` at emission; `ai.heist.ts` calls it
  rather than re-implementing it.
- Moves and helpers never throw. No `.reduce()`, no nested ternaries, JSDoc on every function, `is/has/can` booleans.
- The core sentinel, hash-oracle, PAR and `sim:coverage` pins must not move; a moved pin is a STOP, never a re-pin.
- No `CORE_MOVE_NAMES`, `MOVE_ALLOWED_STAGES` or `LOG_OUTCOMES` change, and no `game.ts` behavior or registration change
  (its one comment refresh is in scope).

**Session protocol:** STOP and report if any core sentinel / `finalStateHash` / PAR / `sim:coverage` pin moves, if the
termination probe finds a game that does not end, if `sim:runtime-observed` reports `gamesNotTerminated > 0`
(`scripts/runtime-observed-hollows.mjs` ~l.446; a bot that eats Heist Wounds could stretch an `amwp` game toward its 50-turn
cap), if `sim:runtime-observed` moves for a board without an `amwp` Hero, or if
a test passes only by editing a pin other than the generated-feed pins listed above.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- **Engine (simulation layer):** `HeistOdds`, `countHeistOdds(G, playerId)`, `hasBotHeistPayoff(G)`,
  `shouldBotAttemptHeist(G, playerId)` in `simulation/ai.heist.ts`; `getLegalMoves` step 4c; `'attemptHeist'` in
  `SIMULATION_MOVE_NAMES`; `SCORE_ATTEMPT_HEIST = 175`.
- The policy (card-count odds, P(win) > P(lose), never the top card, attempt after the hand) is locked in D-24826.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §8 (Deterministic Game Engine), §22 (Deterministic & Reproducible
Evaluation), §26.

- **No conflict:** the bot takes an optional, rule-legal action ("You don't have to go on a Heist. Weigh it carefully!")
  using only information a human can track; it never sees the hidden top card.
- **§26:** PAR computed after this WP for an `amwp` Heist loadout differs. Stored PAR baselines and `competitive_scores`
  rows are not recomputed, so any recalibration is a new PAR version, never a retroactive adjustment.
- **Non-Goal proximity:** none of NG-1..8 crossed: bot behavior only; nothing bought, gated, timed or socially weighted.
- **Determinism preservation:** the rule is a pure function of `G`; no new randomness; non-`amwp` boards byte-identical.
  Bot-driven results for `amwp` Heist loadouts change by design (§Context, Determinism and pins).

## Funding Surface Gate

N/A. No funding, pricing, navigation or account surface.

## API Catalog Update

N/A. No HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. **Odds:** `countHeistOdds` returns the tally in Scope 6 for the hand-built deck, and the same tally for the reversed
   deck.
2. **No peeking:** `shouldBotAttemptHeist` is true for a deck whose top card beats the Heist Count but whose odds favor the
   bot, and false for a deck whose top card loses to it but whose odds do not.
3. **Ties and payoff:** a deck of only tying cards → false; a crew of only X-Con Security Van → false; X-Con plus Petty
   Larceny → true (odds favoring).
4. **Availability:** each `isHeistAvailable` failure → false (wrong stage, choice open, empty crew, latch set, empty deck).
5. **Enumeration:** when `shouldBotAttemptHeist` is true, `getLegalMoves` emits exactly one `{ name: 'attemptHeist',
   args: {} }`, after every step-4b entry and before `advanceStage`; when false, none; boards without a readied Heist card
   enumerate exactly what they did before (an existing `getLegalMoves` test passes unedited).
6. **Guard parity:** the emitted move commits (the latch is set) and is not emitted again that turn.
7. **Policy order:** the competent policy plays a playable card over `attemptHeist`, takes `attemptHeist` over a plain
   fight, a recruit, an exorcise and advance, and still takes a Mastermind fight over it.
8. **Dispatch:** `attemptHeist` is in `SIMULATION_MOVE_NAMES` and both `MOVE_MAP` key sets (drift test).
9. **Termination:** the Scope 8 probe shows `endgameReached` for every game, at least one `attemptHeist` move, and states
   the X-Con decline count and the Anthem shuffle upper bound.
10. **Pins:** the core sentinel, hash-oracle, PAR and `sim:coverage` pins are unchanged; `sim:runtime-observed` moves only
    as explained by the `amwp` board.
11. **Builds and tests:** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package; no existing test weakened or
    skipped.

## Verification Steps

1. `pnpm -r build`, then `pnpm -r --no-bail test` (0 fail everywhere). Record each package's count.
2. `pnpm sim:coverage --check` (0, unchanged). `pnpm sim:runtime-observed`, then `pnpm sim:runtime-observed:check` (0);
   diff the artifact and confirm the moved observations come from the `amwp` board.
3. If the artifact moved: `pnpm --filter @legendary-arena/dashboard prebuild:coverage`, `pnpm --filter @legendary-arena/dashboard build:in-play-baseline`,
   then `pnpm --filter @legendary-arena/dashboard test:coverage` (0).
4. Run the Scope 8 probe; paste games / `attemptHeist` moves / X-Con declines / Anthem upper bound and the all-ended line into the PR and D-24826.
5. `pnpm ledger:numbers:check`, `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`,
   `pnpm workindex:executed:check`: 0.
6. `git diff --name-only origin/main` ⊆ Files Expected to Change.
7. **D-24026** (after deploy, a NEW bot-ally match on play.legendary-arena.com whose loadout includes the Scott Lang, Cat
   Burglar and Ant Army Hero decks; use the operator setters (`reference_operator_match_live_verify_recipe`) to put Heist
   cards in the bot seat's hand rather than waiting for it to recruit them): on a turn where the bot readies a Heist
   card and the odds favor it, the log shows `Player N attempts a Heist …` and its outcome line, and the bot's decision
   log shows `attemptHeist (score 175)`; the bot never stalls on the X-Con or Anthem choices.

## Definition of Done

- All Acceptance Criteria hold, with the Verification Steps' commands and output tails pasted in the PR.
- Two-commit topology: `EC-916:` implementation; a `SPEC:` close with D-24826 Active, a dated STATUS entry, WORK_INDEX
  `[x]`, EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`, NUMBER-LEDGER LANDED.
- Live-on-surface (D-24026): Verification Step 7 confirmed in a match created after the deploy, log lines as evidence;
  until then recorded operator-pending in `STATUS.md` (no `live-verify.json` row: its schema keys card abilities, and this is bot behavior).
- No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

**D-24826 — Bots attempt a Heist when the card-count odds favor it.** Amends D-24808 §2 / §7 ("not emitted by
`getLegalMoves`", "Bots never attempt a Heist") and closes the D-24823 §7 follow-up.

1. **Policy (Jeff, 2026-11-08).** A bot attempts a Heist only when, over the cards still in the Villain Deck taken as a set,
   more would lose to its Heist Count than would beat it (`winCount > loseCount`; ties count as neither). It never reads
   the top card or the deck's order. Rejected: always attempt (about one Wound in four at Heist Count 1), attempt only when
   it cannot lose (leaves most payoffs unused), peek at the top card (uses hidden information).
2. **Gate.** `shouldBotAttemptHeist` (`simulation/ai.heist.ts`) = `isHeistAvailable` and a payoff and the odds; `getLegalMoves`
   step 4c emits `attemptHeist` only then, so every bot policy honors the rule and every emitted move commits (D-24364).
3. **Payoff.** A crew whose only readied cards are X-Con Security Van has no bot payoff (its bot answer declines), so the
   bot does not attempt.
4. **Timing.** The competent policy scores `attemptHeist` 175: after every playable card, before plain fights, recruits,
   exorcises and advancing; bonus fights and the Mastermind fight still come first.
5. **Information.** The deck as a set is public in principle (setup composition plus every reveal); the bot tracks it
   perfectly where a human tracks it by hand. Accepted by the policy choice. This supersedes WP-049 (Heuristic 4 ~l.152 and §A.4
   ~l.274; its post-mortem's "does not consult deck composition" line is historical) and the `ai.competent.ts` "exact card
   counting" prohibition for the Heist gate only: the count lives in `getLegalMoves`, the
   policy still never reads raw `G`, and no other bot decision counts cards. The deck's order and top card stay unread.
6. **Consequences.** Non-`amwp` boards are byte-identical; `sim:runtime-observed` moves for the `amwp` board; PAR, sweeps and
   win-rate runs over `amwp` Heist loadouts differ from before; stored PAR and `competitive_scores` rows are not recomputed.

## Pre-flight (01.4) and Copilot (01.7)

**Pre-flight (01.4): READY TO EXECUTE** (2026-11-08, one independent subagent, five rounds at `fab672cc` + the WIP draft).

- **Round 1: NOT READY.**
  - PS-1: the card-count gate conflicted with the `ai.competent.ts` "Exact card counting" prohibition and with WP-049. Resolved: the Assumes bullet, §Context, the Scope 3 docstring carve-out and D-24826 §5 now record the supersession, for this gate only.
  - PS-2: stale "bots never Heist" comments in `game.ts` / `game.test.ts` sat outside scope. Resolved: they are comment-only scope items.
  - RS-1..8 folded: line refs; the 4b header line; the `fireHeistPlays` walk; `amwp/ant-man` and the `gamesNotTerminated` STOP; "loadout includes" wording; the replay note; a rebase onto `fab672cc`; the random-policy note.
- **Round 2: READY.** RS-9 (the User-Visible Surface wording) folded.
- **Round 3: NOT READY.** PS-1: the runner `MOVE_MAP` is module-private, so the X-Con test now drives the move with a runner-shaped `SimulationMoveContext`, and the runner gains no export. RS-1: the probe uses `simulateOneGameAndCaptureMoves`.
- **Round 4: READY.**
- **Round 5: READY**, re-confirmed after the copilot probe-wording fix.

The Empirical Scaffold does not apply: no validation is tightened.

**Copilot (01.7): PASS** (2026-11-08, one independent subagent, three rounds).

- **Round 1: RISK / HOLD**, five findings, all folded:
  - F1 (#30/#26): the fixture posture names `content/themes/ultron-age.json`.
  - F2 (#11): the termination evidence counts the newly reached X-Con and Anthem bot answers, and a guard-parity test drives the X-Con decline.
  - F3 (#12): the Scope 6 competent test lists exorcise and advance, matching AC7.
  - F4 (#3/#17): a `structuredClone` no-mutation test.
  - F5 (#20): WP-049 Heuristic 4 (~l.152) is cited beside §A.4, and the post-mortem line is marked historical.
- **Round 2: RISK / HOLD**, one finding (#8/#11): `CapturedGameResult` carries no final `G` or log, so the probe now records move-list counts only.
- **Round 3: PASS.** No findings across the 30 failure modes.

The policy itself (card-count odds) was Jeff's decision and was not reviewed. The X-Con-only exclusion and the score 175 were reviewed and confirmed: X-Con fuses to exactly one inner effect, and nothing emitted scores between 100 and 200.

## Lint Gate Self-Review (00.3)

Run by one independent subagent, three rounds.

- **Round 1:** four FAILs, all folded:
  - §3: `getHooksForCard` and the `fireHeistPlays` walk were missing from Assumes.
  - §15.2: the Risk Tier lines were not byte-identical.
  - §16: the abbreviation `vp` is renamed `victoryPoints`.
  - §17: §26 and the NG-1..8 line added.
- **Round 2:** all resolved.
- **Round 3:** re-confirmed after the probe-wording fix.

| § | Verdict | Note |
|---|---|---|
| §1 Structure | PASS | All required sections are present and non-empty; Out of Scope has five exclusions. |
| §2 Constraints | PASS | Full files, ESM, Node v22+, 00.6. Packet-specific: no peeking, determinism, D-24364 parity. STOP protocol; points to the EC Locked Values. |
| §3 Assumes | PASS | `getHooksForCard`, the `fireHeistPlays` walk and the X-Con fusion are listed; the fixture posture names `content/themes/ultron-age.json`. |
| §4 Context | PASS | Rules v23 ranges; D-24808 / D-24823 §7 / D-24364 / D-24587 / D-24591 / D-24073; WP-049 Heuristic 4 and §A.4; the post-mortem line. |
| §5 Files | PASS | Every referenced file is listed; the exclusions are explicit. |
| §6 Naming | PASS | `heistCrewCards`, `hasAttemptedHeistThisTurn`, `heistRevealedVictoryPoints`, `heist-shuffle-villain-deck` and the log lines match HEAD. |
| §7 Dependencies | PASS | No new packages. |
| §8 Architecture | PASS | Engine simulation layer only; the policy never reads raw `G`; the server drivers are unmodified; the runner `MOVE_MAP` gains no export. |
| §9 Windows | PASS | `pnpm` / `git` only. |
| §10 Env vars | N/A | None read or added. |
| §11 Auth | N/A | No auth surface. |
| §12 Tests | PASS | `node:test`; the runner-shaped context matches `SimulationMoveContext`; a `structuredClone` no-mutation test; no boardgame.io, network or DB. |
| §13 Verification | PASS | Every named script exists at HEAD with an expected exit; the probe entry point `simulateOneGameAndCaptureMoves` is exported. |
| §14 Acceptance | PASS | 11 binary criteria; AC7 aligned with Scope 6 and the EC; AC9 holds the move-list counts. |
| §15 / §15.1 | PASS | The DoD covers STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap, the ledger and the scope-diff check; D-24026 is Verification Step 7. |
| §15.2 Risk tier | PASS | `MEDIUM — …`, byte-identical in the WP and the EC. |
| §16 Code style | PASS | `victoryPoints`; `for...of`, no `.reduce()`, no nested ternaries, an explicit `if` chain, JSDoc and `// why:` sites. |
| §17 Vision | PASS | §1, §8, §22, §26; a no-conflict line, a §26 line, an NG-1..8 line and a determinism line. |
| §18 Prose-vs-grep | N/A | No literal-grep Verification Step on forbidden tokens. |
| §19 Bridge-vs-HEAD | N/A | Commit-time rule; the spot-check is clean at `fab672cc` (no cited file changed since `799463b4`). |
| §20 Funding | N/A | No funding, pricing, navigation or account surface. |
| §21 API catalog | N/A | No HTTP endpoint or `apps/server/src/**` library function. |

**All resolved: yes.**
