---
title: Why Play Needs a Debug Panel
type: Guide
tags:
  - diagnostics
  - tooling
  - debug-panel
  - live-verify
  - arena-client
  - proposal
related:
  - play-diagnostics.md
  - debug-effects.md
  - dashboard.md
  - play-board.md
  - bot-ally.md
  - complete-game-fixtures.md
  - reward-integrity.md
  - leaderboard.md
  - scoring.md
  - lagn-v1.md
  - wounds.md
  - testing.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\why-play-needs-a-debug-panel.md (this page — https://ewiki.legendary-arena.com/why-play-needs-a-debug-panel/)
  - ../apps/arena-client/src/diagnostics/diagnostics.ts
  - ../apps/arena-client/src/components/DiagnosticExportButton.vue
  - ../apps/arena-client/src/components/GameLogDownloadButton.vue
  - ../apps/arena-client/src/components/ViewLoadoutButton.vue
  - ../apps/arena-client/src/App.vue
  - ../apps/arena-client/src/fixtures/uiState/mid-turn.json
  - ../apps/dashboard/src/layouts/AppLayout.vue
  - ../docs/ai/coverage/live-verify.json
  - ../apps/server/src/replay/matchReplay.logic.ts
  - ../apps/server/src/autoplay/playbackController.mjs
  - ../apps/server/src/bot-ally/botAllyDriver.mjs
  - ../apps/server/src/competition/competition.types.ts
  - ../packages/game-engine/src/simulation/ai.competent.ts
  - ../packages/game-engine/src/simulation/ai.types.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../packages/registry/src/setupContract/setupContract.schema.ts
  - ../docs/ai/REFERENCE/api-endpoints.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/DECISIONS.md
  - ../.claude/rules/architecture.md
last-reviewed: 2026-10-11
---

## Summary

Verifying a card fix on `play.legendary-arena.com` today means playing whole
games by hand and hoping the board reaches the state the fix is about, then
reading a log that can't see half the table. This page argues for an
operator-only debug panel on play that shows every zone, can set up an edge
case directly, and shows what the bot weighed. It's modelled on the
[Herbs vs. Ailments debug panel design](https://ewiki.herbs-vs-ailments.com/design/herbs-vs-ailments-debug-panel/)
and adapted to a turn-based, hidden-information, server-authoritative game.
It's a proposal. A WP and a DECISIONS entry would own any build.

## Mechanics

### What exists today (verified against code, 2026-10-11)

Each of these tools works. None of them can show a live board's hidden
zones, set a board up, or explain a bot choice.

- **Play Diagnostics export** ([Play Diagnostics](play-diagnostics.md)).
  The play surface has three export controls, at the bottom left of the
  play viewport:
  - **Download diagnostics**
    ([`DiagnosticExportButton.vue`](../apps/arena-client/src/components/DiagnosticExportButton.vue))
    writes `legendary-arena-diagnostics-<match>-<ts>.json`. The report
    ([`diagnostics.ts`](../apps/arena-client/src/diagnostics/diagnostics.ts))
    holds `uiStateSnapshot` (the player's audience-filtered UIState at export
    time), `effectTraces` (the engine's per-dispatch handler, status and params
    records, lifted from that snapshot), the derived `effectProvenance`,
    `matchSetup`, `transport`, `buildProvenance` (client and server build) and
    the captured console `entries`.
  - **Download game log**
    ([`GameLogDownloadButton.vue`](../apps/arena-client/src/components/GameLogDownloadButton.vue))
    writes `legendary-arena-game-log-<match>-<ts>.txt` at game over. During
    play, the log panel's Save button does the same.
  - **View loadout**
    ([`ViewLoadoutButton.vue`](../apps/arena-client/src/components/ViewLoadoutButton.vue))
    fetches the match's Tier-1 [LAGN](lagn-v1.md) from
    `GET /api/match/:matchId/lagn` and opens it in the Registry Viewer. That's
    the setup only.

  All three describe one seat's view. The snapshot is filtered for that seat,
  so other players' hands and every deck's order are redacted by design
  ([Play Board](play-board.md)). And the snapshot is one moment: it isn't
  the moment the card fired.
- **The dev fixture route.** `/?fixture=mid-turn&play=1` renders the play
  mat from a checked-in UIState fixture with no server. `selectRoute` in
  [`App.vue`](../apps/arena-client/src/App.vue) returns `'play-fixture'`,
  and the fixtures live in
  [`src/fixtures/uiState/`](../apps/arena-client/src/fixtures/uiState/mid-turn.json)
  (`mid-turn`, `final-turn`, `endgame-win`, `endgame-loss`,
  `diving-block-wound`). It's good for checking layout. Because it's a static
  projection, no move can be played on it.
- **The operator dashboard** ([Dashboard](dashboard.md)). `/coverage`,
  `/debug/effects` ([Debug Effects](debug-effects.md)) and `/pipeline`
  answer whether each card's effect is implemented and whether it has been
  seen working. The hand-kept
  [`live-verify.json`](../docs/ai/coverage/live-verify.json) record (the
  D-24026 gate: "done" means seen working on play) stores each card's
  verdict as `verified`, `partial` or `pending`, with the match id as
  evidence. The dashboard reads the results. It can't help produce them.
- **Faithful server replay.**
  [`matchReplay.logic.ts`](../apps/server/src/replay/matchReplay.logic.ts)
  re-executes a completed match from the `bgio` record's `initialState` plus
  its move log to rebuild the final `G`. That's the D-24119 carve-out to the
  persistence boundary, used for score verification. It runs inside the
  server and returns the end state only.
- **Watch Bot Play rewind.**
  [`playbackController.mjs`](../apps/server/src/autoplay/playbackController.mjs)
  (WP-163) keeps up to 100 derived snapshots per autoplay match so a viewer
  can step back. The rewind is visual only, never persisted, and available
  only in autoplay matches. It's the nearest thing to a turn scrubber in the
  repo today.

### The evidence: four gaps from the 2026-10-10/11 live-verify sessions

**1. Hidden zones can't be seen.** D-24684 changed Ymir, Frost Giant King's
"Choose a player" to pick the player with the most Wounds in **hand +
discard**. In 2p bot-ally match `MHZt0mnJyn6` (build `19be0fc`), the bot
fought Ymir and Player 0's single Wound was KO'd. That's correct only if the
bot held no Wounds in its hand or discard, since ties go to the fighter. The
log never shows the bot's hand or discard, so the record went to `partial`
("Not confirmed: that the bot had 0 Wounds in hand + discard"). The public
per-player `woundCount` doesn't settle it either. `countWounds` in
[`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts) counts
every zone, the deck included, and the chooser scans only hand + discard. A
clean PASS took another full game, `ZVUtr7aaCom`, where Player 0 fought Ymir
and 8 Wounds came off the bot.

**2. A past board can't be revisited.** The natural next step after (1) was
to replay `MHZt0mnJyn6` up to the fight and read the bot's zones. That was
refused, because reading the production `bgio` record needs production
database credentials, which an operator session doesn't hold (and shouldn't).
The D-24119 replay code exists, but only inside the server, only to the end
of the match, and with no admin-gated way to ask it for "the board at move
N." No operator-safe way exists today to inspect a past match at turn N.

**3. Edge-case boards can't be set up.** D-24686 fixed the reveal-or-Wound
log line for when the Wound supply is empty. Verifying it needs an empty
Wound supply. The loadout contract won't build one, and it's right not to:
`woundsCount` must be at least `SUPPORT_COUNT_MINIMUMS.woundsCount` (30) "so
the supply pile does not run dry during play"
([`setupContract.schema.ts`](../packages/registry/src/setupContract/setupContract.schema.ts)).
So the only route is to play Unleash the Power of the Cosmic Cube, whose
twists deal Wounds, and hope. Earlier games `sDBnFxiigDL` and `ZVUtr7aaCom`
did run the supply out. Jeff's next three Cosmic Cube games (including
`mAmjZ9Cm9L9` and `xGw-94HDhBj`) never did, and `Cq_czI1TQH0` ended with 20
Wounds still in the supply. D-24686's live-verify is still `pending`. Ymir
was the same story: getting Ymir to come out of the villain deck *and* be
fought by the right seat took several Midtown Bank Robbery games, including
the losses `DspC4Hv11a4` and `FP0wk_t0QpP`.

**4. Bot intent can't be seen.** The bot's policy is
`decideTurn(playerView, legalMoves)`
([`ai.types.ts`](../packages/game-engine/src/simulation/ai.types.ts)). The
competent heuristic
([`ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts))
scores every legal move and takes the highest, with seeded tie-breaks, but
the scored pairs are "not surfaced outside the policy." So the operator sees
only outcomes: which card the bot put back with Stack the Deck, or Loki's
Maniacal Tyrant ("KO up to four cards from your discard pile") logging
"KO'd 0." Whether that 0 was an empty discard pile or a choice can't be
told from the log.

### What it costs today

Counting only what the record shows:

| Verification | Games played after the fix | Result |
|---|---|---|
| D-24684 Ymir chooser | `DspC4Hv11a4` and `FP0wk_t0QpP` (Ymir not fought by the right seat), `MHZt0mnJyn6` (partial), `ZVUtr7aaCom` (pass) | 4 full 2p games for one PASS |
| D-24686 empty-supply log line | 3 Cosmic Cube games, the supply never ran out | Still `pending` |

Each row is a full game played by hand to a win or a loss, then a log read
and a record commit. No per-game time was recorded, so this page doesn't
put a minute count on it. The shape is plain anyway. The fix is one PR, and
verifying it takes several games because nothing can be set up and nothing
hidden can be seen. That multiplies with every card on the
[live-verify record](../docs/ai/coverage/live-verify.json) still at
`partial` or `pending`.

### The Herbs vs. Ailments model, and what changes here

The Herbs vs. Ailments design page states the goal well: **get to the
interesting state fast.** Its panel controls send intents through the same
code paths real play uses, never a second copy of the rules. It's gated in
two places, the client build and the server. Its presets are a seed plus a
list of intents, or a whole saved state, never a partial state patch, so a
preset can't build a board the rules couldn't. Bookmarks and replay
controls jump to a tick by re-running the log. It names Tweakpane as the
debug-panel UI shared by both of Jeff's games.

Four things differ for Legendary Arena:

- **No clock.** It's turn-based, so there are no pause, step or speed
  controls. The unit of "step" is a move.
- **Hidden information is the main blindness.** Herbs vs. Ailments shows the
  whole board to everyone. Here the engine's `playerView` redacts other
  hands and every deck's order for each seat. A reveal-all view is the first
  thing the panel needs, and it's the one most able to leak.
- **The gate is "debug match," not "dev build."** All four incidents
  happened on production play, against the production engine and bot,
  because D-24026 counts only what's seen on play. A panel compiled out of
  production builds wouldn't have helped. So the gate is an admin-created
  debug match on the normal deployment.
- **The intent is a boardgame.io move.** Clients already submit intents and
  the engine decides
  ([architecture rules](../.claude/rules/architecture.md), Engine Owns
  Truth). A setter is just another move, validated like every other.

### What the panel would show (read-only)

- **Every zone of every seat:** hand, deck in order, discard, in play,
  victory pile. Wounds split by zone, so "hand + discard" can be read
  directly.
- **Shared piles:** Wound, Bystander, S.H.I.E.L.D. Officer and Sidekick
  supply counts. The villain deck's next few cards in order. The
  Mastermind's remaining tactics, the KO pile and the escaped pile. The
  scheme's twist count.
- **The engine's own state for this move:** the current stage, any open
  pending choice, and this turn's `effectTraces`, which are already
  projected for the diagnostics export.
- **The bot's candidates:** each legal move with its heuristic score, and
  the move chosen. This also covers the Stack the Deck put-back and the
  "KO'd 0" cases.

### What it would let an operator do

These are in the order that removes the most replaying, based on the
incidents above:

1. **Set a supply pile count.** For example, empty the Wound supply, which
   is all D-24686 needed.
2. **Force the next villain-deck card.** Move a card already in the villain
   deck to the top, so Ymir comes out on the turn wanted.
3. **Trigger a scheme twist or a Master Strike now,** through the same
   resolver the villain-deck reveal uses.
4. **Place a card in a zone,** for example a Wound into the bot's discard to
   set up a most-Wounds tie.
5. **Jump to turn N of a past match:** a read-only board, rebuilt by the
   faithful replay and stopped at move N.
6. **Copy the state as a fixture:** export the current projection in the
   shape of
   [`src/fixtures/uiState/*.json`](../apps/arena-client/src/fixtures/uiState/mid-turn.json),
   so a board found live can be opened with the dev fixture route and turned
   into a test ([Complete-Game Fixtures](complete-game-fixtures.md),
   [Testing](testing.md)).

### The shape it would take

This is a sketch so the guardrails below have something concrete to apply
to. It isn't a build plan.

- **Creation.** A server route behind `admin-session-required` (a Hanko
  session plus `is_admin = TRUE`, per the Auth values in
  [`api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md)) creates a
  match whose setup envelope carries a debug flag. The envelope is
  extensible, and the nine locked composition fields don't change. The flag
  is fixed at `Game.setup()` and lands in `G`, so it can't be turned on
  mid-match.
- **Setters are engine moves.** Each one follows the Move Validation
  Contract: validate the arguments, return silently unless the match was set
  up as a debug match, mutate `G` through the zone helpers, and return
  `void`. Because they're ordinary moves, they're in the `bgio` move log, so
  the D-24119 replay re-executes them faithfully.
- **Reads are an operator projection.** The reveal-all view is a separate
  audience from the player audiences in
  [`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts).
  The players' whitelist stays exactly as it is.
- **The client panel** mounts only in a debug match for an admin session,
  and is loaded on demand so normal play doesn't download it.

### Guardrails

Each of these already exists as a rule somewhere. The panel would have to
fit them, not bend them.

- **Operator only.** Creating a debug match, and every debug read or write,
  needs `admin-session-required`. The engine-side check is the setup flag in
  `G`. A crafted move in a normal match finds no flag and does nothing.
- **Never competitive.** A debug match is never ranked, never
  leaderboard-eligible, and never counted toward PAR, a gauntlet or a seed
  challenge ([Leaderboard](leaderboard.md), [Scoring](scoring.md)). Score
  submission already has permanent-ineligibility reasons. `ended_early`
  (D-24306) is the closest match in
  [`competition.types.ts`](../apps/server/src/competition/competition.types.ts),
  and a debug match would be refused the same way. Bot-ally games are
  already never ranked ([Bot Ally](bot-ally.md)). A debug match should go
  further and not be scored at all, not even as Casual.
- **Everything is marked and logged.** The debug flag is visible in the
  match's setup. Every setter is a move in the replay log and writes a plain
  line to the game log ("Debug: Wound supply set to 0"), so a debug match
  can't be mistaken for real play and a diagnostics export from one says
  what was changed.
- **Determinism holds.** Setters are deterministic functions of their
  arguments. "Force the next card" reorders what's already in the deck. It
  doesn't re-roll, and it never uses `ctx.random` or `Math.random`. The same
  setup plus the same moves, debug moves included, replays to the same game.
- **The engine owns truth.** The panel sends intents. It never edits a
  client copy of the state, and the client runs no rules
  ([architecture rules](../.claude/rules/architecture.md)).
- **No change to what's persisted.** `G` stays runtime-only, and nothing new
  goes into a `legendary.*` table. Fixtures and snapshots are client-side
  downloads, like the diagnostics report. Reading a *past* match (jump to
  turn N) goes through the `bgio` record, which is a fifth use of the
  framework-store exemption next to D-24119, D-24153, D-24169 and D-24187.
  That needs its own DECISIONS entry. It can't ride on D-24119's wording.
- **No pay-to-win surface.** It's a tool for operators, not a product
  feature, so no purchase can reach it ([Reward Integrity](reward-integrity.md)).

### What it would unblock

- **D-24684 (Ymir chooser).** One game: open the panel at the fight and read
  both seats' hand + discard Wounds. The PARTIAL on `MHZt0mnJyn6` would have
  been a PASS, or jump-to-turn on that match would have settled it after
  the fact.
- **D-24686 (empty Wound supply).** Set the Wound supply to 0, force Ymir to
  the top of the villain deck, and play one turn. It's still `pending` today.
- **Getting a villain to the right seat.** Force the next villain-deck card,
  instead of playing Midtown games until it shows up.
- **The bot's choices.** Stack the Deck put-backs and Maniacal Tyrant's
  "KO'd 0" show up as candidates with scores, so "the bot chose badly" and
  "the effect is broken" can be told apart.
- **Turning a live bug into a test.** Copy the board as a fixture at the
  moment it went wrong.

## Interactions

- [Play Diagnostics](play-diagnostics.md): the panel extends the same
  report. A diagnostics export from a debug match would carry the debug flag
  and the setter log.
- [Debug Effects](debug-effects.md) and [Dashboard](dashboard.md): the
  dashboard says which cards still need live verification. The panel is how
  an operator produces that verification in one game instead of several.
- [Play Board](play-board.md): the operator projection sits beside the
  player audiences. The board-visible field rule's five steps (declare,
  build, pass through the filter, test the audience, check the diagnostics
  snapshot) still apply to any field added to the player audiences.
- [Bot Ally](bot-ally.md): debug matches would mostly be bot-ally matches.
  Showing candidates means exposing the scores the competent policy already
  computes, without changing how it picks.
- [Complete-Game Fixtures](complete-game-fixtures.md) and
  [Testing](testing.md): fixtures copied from the panel feed the dev route
  and the test suites.
- [Wounds](wounds.md): the Wound supply is the first pile the setters would
  touch.
- [LAGN Specification](lagn-v1.md): a debug match's loadout is still a normal
  LAGN setup. The debug flag lives in the setup envelope, not in the
  composition.

## Edge Cases

- **Boards the rules can't reach.** A setter that writes state directly can
  build a position no real game produces, such as more Wounds than the
  supply ever held, and a bug found there may not be real. Herbs vs.
  Ailments rejected partial state patches for this reason. Setters should
  prefer the real paths (gain a Wound through the gain helper, reveal through
  the reveal path) over raw writes, and the setter log shows which board was
  constructed.
- **Setting state during a pending choice.** A setter fired while a block-all
  pending choice is open could strand it. Setters probably need to be
  refused while any pending choice is open.
- **Setting state while the bot is moving.** In a bot-ally match the bot acts
  between the operator's moves. Setters landing mid-bot-turn would race the
  bot loop, so they likely belong on the operator's own turn only, or behind
  a bot pause.
- **The operator sees every hand.** Play in a debug match isn't
  representative play. That's fine for verifying an effect, and it's one
  more reason the match is never scored.
- **Replay across builds.** Jumping to turn N re-runs a stored log on the
  current server. If the engine changed between the match and the replay,
  the replay may not match what happened. See Open Questions.
- **Diagnostics `.json` vs LAGN.** The diagnostics export is a plain
  `.json` report, not a `.lagn.json` document. LAGN's three tiers are setup,
  card catalog and replay log, with no board-state tier. A "state snapshot" export would be a UIState fixture, not
  LAGN, unless a WP adds a tier for it.

## Open Questions

1. **How do the reads travel?** The options are a separate admin-only
   spectator connection that gets the operator projection through
   `playerView`, or an admin HTTP route that builds it server-side. The
   choice decides whether a DECISIONS carve-out is needed for live reads as
   well as for replays.
2. **Jump to turn N on the right engine.** D-24119's replay runs on the
   current server. Does a mid-match stop need the match's build, recorded in
   `buildProvenance`, and does it refuse when the build differs? Check D-24119
   before relying on it for old matches.
3. **Which setters come first?** This page orders them by the incidents.
   A WP should confirm the list and the order, and whether "place a card"
   is limited to cards already loaded at setup. The engine never queries the
   registry after setup, so a card outside the match's composition has no
   data to stand on.
4. **Bot candidates, live or logged?** Show them only in the panel, or also
   record them in a debug match's diagnostics so a bot decision can be read
   afterwards?
5. **UI library.** Herbs vs. Ailments names Tweakpane as the shared
   debug-panel UI for both games. The arena-client is Vue 3, with PrimeVue on
   the dashboard. Whether play takes Tweakpane, and how it mounts beside the
   play mat, is open.
6. **The debug flag's name and home.** It goes in the extensible match-setup
   envelope. The exact field, its default, and its drift tests need a
   DECISIONS entry.

## References

- [Herbs vs. Ailments: debug panel and development principles](https://ewiki.herbs-vs-ailments.com/design/herbs-vs-ailments-debug-panel/)
  (the structural model; behind Cloudflare Access)
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md): D-24026 (live
  verification is the Definition of Done), D-24684 (Ymir chooser; PASS
  `ZVUtr7aaCom`, partial `MHZt0mnJyn6`), D-24685 (Cosmic Cube twist 8; PASS
  `Cq_czI1TQH0`), D-24686 (empty-supply log line; live-verify pending),
  D-24119 / D-24095 (faithful replay and the framework-store exemption),
  D-24146 (ranked eligibility), D-24306 (`ended_early`)
- [`docs/ai/coverage/live-verify.json`](../docs/ai/coverage/live-verify.json):
  the per-card live-verify record
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) and
  [`.claude/rules/architecture.md`](../.claude/rules/architecture.md):
  determinism, the engine owns truth, UIState projection integrity, the
  persistence boundary, the Move Validation Contract
- [`docs/ai/REFERENCE/api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md):
  the `admin-session-required` auth tier
- [`apps/arena-client/src/diagnostics/diagnostics.ts`](../apps/arena-client/src/diagnostics/diagnostics.ts):
  the diagnostics report
- [`apps/arena-client/src/App.vue`](../apps/arena-client/src/App.vue): the
  `play-fixture` route
- [`apps/server/src/replay/matchReplay.logic.ts`](../apps/server/src/replay/matchReplay.logic.ts):
  faithful replay
- [`apps/server/src/autoplay/playbackController.mjs`](../apps/server/src/autoplay/playbackController.mjs):
  the Watch Bot Play rewind buffer
- [`packages/game-engine/src/simulation/ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts):
  the bot's scored candidates
- [`packages/registry/src/setupContract/setupContract.schema.ts`](../packages/registry/src/setupContract/setupContract.schema.ts):
  the `woundsCount` minimum
- [`apps/server/src/competition/competition.types.ts`](../apps/server/src/competition/competition.types.ts):
  score-submission rejection reasons
