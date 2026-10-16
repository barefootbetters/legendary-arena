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
  - par-simulation-calibration.md
  - sound-effects.md
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
  - ../docs/ai/work-packets/WP-802-operator-board-inspection.md
  - ../docs/ai/work-packets/WP-804-operator-panel-client.md
  - ../packages/game-engine/src/ui/operatorView.build.ts
  - ../apps/server/src/operator/operatorMatch.routes.ts
  - ../apps/arena-client/src/pages/PlayViewport.vue
last-reviewed: 2026-10-13
---

## Summary

Verifying a card fix on `play.legendary-arena.com` today means playing whole
games by hand and hoping the board reaches the state the fix is about, then
reading a log that can't see half the table. This page argues for an
operator-only debug panel on play that shows every zone, can set up an edge
case directly, and shows what the bot weighed. It's modelled on the
[Herbs vs. Ailments debug panel design](https://ewiki.herbs-vs-ailments.com/design/herbs-vs-ailments-debug-panel/)
and adapted to a turn-based, hidden-information, server-authoritative game.
It started as a proposal. D-24689 turned it into a four-step arc. The first
two steps are merged: the server and engine half is live-verified, and the
client panel is waiting on its live-verify. The third step is done too: the six
setter moves (WP-806, D-24713) and the Tweakpane pane that submits them
(WP-807), with one live-verify covering both. See [Build status](#build-status).

## Mechanics

### Build status

As of 2026-10-16, checked against `main` (`c488d7e9`):

| Step | What | Status |
|---|---|---|
| WP-802 / EC-839 / D-24689 | Operator match: only an admin can create it, it's unlisted and never scored, and an admin HTTP route reads the whole board, Wounds by zone and the bot's recent decisions | **Done 2026-10-11. Live-verified in production** on operator match `3pNYCKHKJCE` (all eight WP-802 live steps) |
| D-24697 | The bot decisions use the turn number the board and game log show | Done (#2728) |
| WP-804 / EC-841 | The operator panel on play: an admin-only "Operator match" checkbox in the lobby's bot-ally section, a read-only reveal-all board panel, a "not scored" badge every seat sees, no score submit at game over, and two downloads (operator snapshot, UIState fixture) | **Done 2026-10-12, merged 2026-10-13** ([PR #2735](https://github.com/barefootbetters/legendary-arena/pull/2735), `9cfd635d`). **Live-verify pending**: the seven WP-804 §Verification steps, run as `jefferyjjensen` after deploy. No new dependency, no Tweakpane |
| WP-806 / EC-843 / D-24713 | Follow-on 2, engine half: six operator-match-only setter moves (supply count with the `G.operatorSetAside` zone, deck top for the villain and hero decks, reveal a Scheme Twist or Master Strike now, move a card over a closed route table including a hero into the HQ, add Recruit or Attack, force an escape), each logged "Operator:" and absent from bot and simulation dispatch | **Done 2026-10-13.** No user-observable change on its own; live-verify via WP-807 |
| WP-807 / EC-844 | Follow-on 2, client half: a **Tweakpane** control pane inside the WP-804 panel that submits the six setters | **Done 2026-10-16.** A lazy `OperatorSetterPane` chunk with six folders (Supply, Villain deck, Hero deck, Move a card, Turn economy, Escape), enabled on the admin's own turn in `main`. **Live-verify pending**: WP-807 §Verification 1–9 after deploy, covering WP-806 too |
| Follow-on 3 (no WP yet) | Jump to turn N of any match: a read-only board rebuilt by replay, labelled "played on build X, replayed on build Y" | Designed in D-24689 §8. Needs its own DECISIONS carve-out |

With WP-804 deployed, an admin ticks "Operator match" in the lobby instead
of creating one with `Invoke-RestMethod` and a pasted admin token, and reads
the board in the panel instead of as raw JSON. With WP-807 deployed, the
panel's Setters pane (Tweakpane, its own lazy chunk) stages a board on the
admin's own turn instead of playing until the right cards line up.

### What exists today (verified against code, 2026-10-11)

Each of these tools works. Before WP-802, none of them could show a live
board's hidden zones, set a board up, or explain a bot choice. The last
bullet, the operator match, now covers the first and third of those for an
admin. Setting a board up is still missing.

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
- **The operator match (WP-802, added 2026-10-11).** An admin creates an
  unlisted, never-scored bot-ally match through
  `POST /api/admin/operator-match/create-with-bot`. `Game.setup()` writes
  `G.isDebugMatch = true` for it. `GET /api/admin/operator-match/:matchId/board`
  ([`operatorMatch.routes.ts`](../apps/server/src/operator/operatorMatch.routes.ts))
  returns the engine's reveal-all projection
  ([`operatorView.build.ts`](../packages/game-engine/src/ui/operatorView.build.ts)):
  every seat's zones, deck order, Wounds by zone, supply counts and counters.
  It also returns the bot's recent decisions, held in server memory. It refuses
  any match that isn't an operator match (409). The client panel that shows
  all this is WP-804.

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
"Player 1 KO'd 0 card(s)." The log can't say whether that 0 was an empty
discard pile or a choice. It was a choice. D-24688 found that the bot's
default for this KO-from-discard prompt was "KO nothing", left over from
D-24510, so the tactic did nothing for a bot ally even with Wounds and
starting cards in its discard (`xGw-94HDhBj` at 23.2.14, `sDBnFxiigDL` at
35.2.14). Finding that meant reading the bot's code after the games. A
candidate view would have shown "KO nothing" being picked over a discard
full of Wounds at the moment it happened.

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

### What it looks like (mockup)

![Mockup of the operator panel beside the play mat in a two-player bot-ally operator match, turn 7. The play mat on the left carries a red OPERATOR · NOT SCORED badge, and its game log shows two amber lines, Operator: Wound supply set to 0 (was 24) and Operator: Ymir, Frost Giant King, with its card id, moved to the top of the Villain Deck. The panel on the right has the WP-804 header buttons Operator board, Refresh, Download operator snapshot and Download as fixture. Its read-only column lists both seats' hand, deck top first, discard, in play, victory and Wounds by zone, with the hand and discard Wound counts highlighted; the villain deck, hero deck and Mastermind tactics top first with Ymir on top; the supply counts with Wounds at 0 and a Set aside line of 24 Wounds; the stage, counters and recent effect traces; and the bot's decisions newest first, each with its turn, seat, forced or policy, move, legal-move count and scored alternatives. A Tweakpane Setters pane holds the six WP-807 folders, Supply, Villain deck, Hero deck, Move a card, Turn economy and Escape, with Escape disabled because the Bridge is empty. A dashed note walks through setting up D-24686 in one turn.](/why-play-needs-a-debug-panel/operator-panel-mockup.svg "width=96%")

*Illustrative mockup, not a screenshot. The read-only column follows
`OperatorBoardPanel.vue` (WP-804) and the `OperatorView` fields. The Setters
pane follows WP-807's folder order, binding labels and button titles, and the
bot lines use the competent policy's `[Bot] Chose:` / `[Bot] Over:`
`decisionLog` format. The board is staged as the D-24686 setup: Wound supply
emptied, Ymir moved to the top of the villain deck, and a Wound being moved into
the bot's discard pile to set up a D-24684 tie. The "Operator:" log lines
are the exact strings WP-806 writes in
[`operatorSetters.ts`](../packages/game-engine/src/moves/operatorSetters.ts).
Hand-authored SVG:
[operator-panel-mockup.svg](../ewiki/why-play-needs-a-debug-panel/operator-panel-mockup.svg).*

### What the panel shows (read-only, WP-804)

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
- **The bot's decisions:** for each bot decision, the turn, the seat, the
  move chosen, up to two scored alternatives from the policy's own
  `decisionLog`, the legal-move count, and whether the move was forced
  (D-24689 §5). That covers the Stack the Deck put-back and the "KO'd 0"
  cases. A forced singleton, the D-24688 class, shows as forced with one legal
  move. A full scored list of every legal move would need an engine change to
  `ai.competent.ts`, and D-24689 decided it isn't needed.

### What it lets an operator do

D-24689 §7 fixed the order of setters 1–4, which removes the most replaying
given the incidents above. Item 5 is follow-on 3, and item 6 ships with
WP-804.

1. **Set a supply pile count.** For example, empty the Wound supply, which
   is all D-24686 needed. A decrease moves the cards to a set-aside zone that
   no rule reads. Nothing is destroyed.
2. **Move a villain-deck card to the top.** The card must already be in the
   villain deck, so Ymir comes out on the turn wanted.
3. **Reveal the next Scheme Twist or Master Strike now.** One already in
   the villain deck moves to the top and is revealed through the normal
   reveal path.
4. **Move a card already in the match from one zone to another,** through
   the zone and gain helpers. For example, a Wound from the supply into the
   bot's discard to set up a most-Wounds tie. A setter never names a card
   outside the match's loaded composition.
5. **Jump to turn N of any match:** a read-only board, rebuilt by replay
   and stopped at move N (follow-on 3).
6. **Copy the state as a fixture:** WP-804's "Download as fixture" saves the
   current play-surface UIState in the shape of
   [`src/fixtures/uiState/*.json`](../apps/arena-client/src/fixtures/uiState/mid-turn.json),
   so a board found live can be opened with the dev fixture route and turned
   into a test ([Complete-Game Fixtures](complete-game-fixtures.md),
   [Testing](testing.md)). Its "Download operator snapshot" saves the board
   and bot decisions as JSON.

### The shape it takes (D-24689)

- **Creation (built).** `POST /api/admin/operator-match/create-with-bot` is
  `admin-session-required` (a Hanko session plus `is_admin = TRUE`, per the
  Auth values in
  [`api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md)). It is the
  only path that sets `isDebugMatch?: boolean` on the creation payload
  `MatchConfiguration`, next to `finalBlow`. The flag is never in the loadout
  envelope, the LAGN document or the nine-field composition. Every public
  create path refuses a payload that carries it (400). `Game.setup()` writes
  `G.isDebugMatch = true` only for a strict `true`, so it can't be turned on
  mid-match, and normal matches stay byte-identical.
- **Reads are an admin HTTP route (built).** The board route builds the
  reveal-all view server-side with the engine's `buildOperatorView`. It is not
  a new `playerView` audience, because spectators are unauthenticated and a
  reveal-all audience there couldn't be admin-gated. The player audiences in
  [`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts)
  are unchanged.
- **The client panel (WP-804).** A Vue 3 component that `PlayViewport.vue`
  loads with `defineAsyncComponent`, only in an operator match for an admin,
  so normal play never downloads it. It refreshes the board from the route.
- **Setters are engine moves (follow-on 2).** Each one follows the Move
  Validation Contract: validate the arguments, return silently unless
  `G.isDebugMatch === true`, mutate `G` through the zone helpers, and return
  `void`. Because they're ordinary moves, they're in the `bgio` move log, so
  the D-24119 replay re-executes them faithfully. Their controls sit in a
  Tweakpane pane, loaded lazily inside the WP-804 panel.

### Guardrails

Each of these already exists as a rule somewhere. The panel would have to
fit them, not bend them.

- **Operator only.** Creating a debug match, and every debug read or write,
  needs `admin-session-required`. The engine-side check is the setup flag in
  `G`. A crafted move in a normal match finds no flag and does nothing.
- **Never competitive.** A debug match is never ranked, never
  leaderboard-eligible, and never counted toward PAR, a gauntlet or a seed
  challenge ([Leaderboard](leaderboard.md), [Scoring](scoring.md)). Built:
  `submitCompetitiveScoreImpl` rejects an operator match with the permanent
  reason `debug_match` before any score, badge or row is written, next to
  `ended_early` (D-24306) in
  [`competition.types.ts`](../apps/server/src/competition/competition.types.ts).
  Bot-ally games are already never ranked ([Bot Ally](bot-ally.md)). An
  operator match goes further: it isn't scored at all, not even as Casual.
  WP-804 makes the client skip the submit instead of showing the 422 as a
  failed submit.
- **Everything is marked and logged.** `UIState.isDebugMatch` reaches every
  audience, so every seat and every diagnostics export shows it's an operator
  match, and WP-804 shows every seat a "not scored" badge. Every setter is a
  move in the replay log and writes a game-log line that starts "Operator:"
  (for example "Operator: Wound supply set to 0"). A debug match can't be
  mistaken for real play, and a diagnostics export from one says what was
  changed.
- **Determinism holds.** Setters are deterministic functions of their
  arguments. "Force the next card" reorders what's already in the deck. It
  doesn't re-roll, and it never uses `ctx.random` or `Math.random`. The same
  setup plus the same moves, debug moves included, replays to the same game.
- **The engine owns truth.** The panel sends intents. It never edits a
  client copy of the state, and the client runs no rules
  ([architecture rules](../.claude/rules/architecture.md)).
- **No change to what's persisted.** `G` stays runtime-only, and nothing new
  goes into a `legendary.*` table. Fixtures and snapshots are client-side
  downloads, like the diagnostics report. The live board read is a fifth use
  of the framework-store exemption, next to D-24119, D-24153, D-24169 and
  D-24187: an admin route may read a match's live `state`, only to test
  `G.isDebugMatch` and then project it (D-24689 §4). Jump to turn N reads the
  `initialState + log` of *any* match, so it needs its own carve-out entry. It
  can't ride on D-24119's or D-24689's wording.
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
  KO pick show up as candidates with scores, so "the bot chose badly" and
  "the effect is broken" can be told apart while the game is on. D-24688's
  "KO nothing" default would have shown up the first time it fired.
- **Turning a live bug into a test.** Copy the board as a fixture at the
  moment it went wrong.

### Ideas from the 2026-10-13 design session, reconciled

On 2026-10-13 Jeff worked through a Tweakpane testing panel in a phone chat.
It produced 19 idea briefs, now drafts in his desk inbox (the private
corporate-memory repo, `inbox/legendary-arena/`). The chat didn't have the
repo in front of it, so a few briefs assume work that's already done or rules
that are already settled. This table places each idea. It decides nothing. A
WP and a DECISIONS entry own any build.

**Already true, no work needed:**

- **Seeded randomness.** The briefs make this the keystone task. It's an
  existing invariant: all randomness goes through `ctx.random.*`, and
  `Math.random()` is forbidden in the engine. The sentinel `finalStateHash`
  and the D-24119 score-verification replay depend on it.
- **Monte Carlo PAR.** [PAR Simulation Calibration](par-simulation-calibration.md)
  (WP-036 / WP-049) already plays a scenario hundreds to thousands of times
  with the competent bot and sets PAR at the 55th percentile. The ideas below
  are extensions of it, not a new engine.
- **A live log during play.** The game log panel is live, the hollow-effects
  panel is live, and Download diagnostics works at any point in a match.
  WP-804's panel adds each turn's effect traces and the bot's decisions,
  refreshed from the board route.

**Where each idea lands:**

| Idea | Where it fits | Status |
|---|---|---|
| Hero / villain deck control: put a chosen card on top, summon a hero to the HQ | Setter 2 (villain deck) and setter 4 (zone to zone). The hero deck needs the setter-2 pattern too, and an HQ placement needs a rule for the card it displaces | Done in WP-806: setter 2 covers both decks, and the displaced HQ card goes to the hero-deck bottom (D-24713 §4) |
| Select a S.H.I.E.L.D. Officer, Sidekick, Wound or Bystander | Setter 1 (pile count) and setter 4. Choosing which card comes next only matters where a pile holds different cards. Where every copy is the same card, the count covers it | Follow-on 2 |
| Floating pane with collapsible folders | How Tweakpane mounts inside the WP-804 panel (D-24689 §6) | Follow-on 2 |
| Console commands: KO a card, draw a card | Setter 4 through the existing KO and draw helpers | Follow-on 2 candidate |
| Console commands: `add recruit 5`, `add attack 3`, trigger a villain escape | New setter kinds. §7's conservation rule covers cards, and recruit and attack are counters, so they need a ruling that extends §7 | Done in WP-806 (D-24713 §2) |
| A command console next to the knobs | An input surface over the same setter moves, so every new idea is one more command rather than one more button | Follow-on 2 or later |
| Rewind with branching (rewind to turn N, make a different choice, play on) | Follow-on 3 is read-only and never written back. bgio's `loadState` / `previewState` are client-side and can't move a server-authoritative match. A branch that fits every rule: create a *new* operator match from the same setup and seed, and replay the first N moves as real moves. Determinism makes that exact | Open Question 8 |
| Gate the panel with `#debug` in the URL, or a dev build flag | D-24689 gates on an admin session plus an operator match, on the normal production deployment. A URL hash can show the panel, but it can't authorize anything | A convenience at most, never the gate |
| Luck dial (favorable / neutral / difficult) | A reorder-only setter fits §7 ("reorder, never re-roll") inside an operator match | Follow-on 2 or later |
| Draw-luck rating on the report card | A player-facing scoring feature, not the panel. It ties to [Scoring](scoring.md) and PAR's spread | Separate packet |
| April Fool's prank mode: secretly rig luck for one friend | Conflicts with "everything is marked." An operator match shows every seat a "not scored" badge, so it can't be secret | Open Question 9 |
| PAR extremes (speed-run best case, impossible worst case), outlier-fair rating | Extends the PAR simulation pipeline. The fairness question (don't grade a doomed hand as a blown game) belongs on the scoring side | Separate packet |
| Max-score / min-rounds integrity watchdog | Score verification already replays every submitted match (D-24119). A ceiling from simulation would be a new check there, not a panel control | Separate packet |
| Scoreboard entry test from the panel | Operator matches are never scored (D-24689 §3), so this can't run from the panel. The Server DB Tests in CI and a crafted terminal replay submitted by match id already cover the write path | Use existing test paths |
| Effects tuner (visual, audio, music, escalation near a loss) | Client-only: it changes no game state, so it doesn't need an operator match. It tunes the existing feel layer ([Sound Effects](sound-effects.md)) and could run on the dev fixture route | Open Question 10 |
| Latency monitor, per-hop sparklines | Client-only. The browser can time Cloudflare and the game server directly, but Postgres only through a server health route | Open Question 10 |
| Whose turn it is + per-player connection status | boardgame.io's per-seat match metadata already carries `isConnected`, and the client tracks its own connection (WP-311). Fits the disconnect / reconnect posture (D-11601..D-11605) | Separate packet |

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
  LAGN setup. `isDebugMatch` lives on the creation payload
  (`MatchConfiguration`), not in the loadout envelope, the LAGN document or
  the composition (D-24689 §1).
- [PAR Simulation Calibration](par-simulation-calibration.md) and
  [Sound Effects](sound-effects.md): the 2026-10-13 ideas below touch both.
  The Monte Carlo PAR pipeline already exists. An effects tuner would tune
  the existing feel layer.

## Edge Cases

- **Boards the rules can't reach.** A setter that writes state directly can
  build a position no real game produces, such as more Wounds than the
  supply ever held, and a bug found there may not be real. Herbs vs.
  Ailments rejected partial state patches for this reason. Setters should
  prefer the real paths (gain a Wound through the gain helper, reveal through
  the reveal path) over raw writes, and the setter log shows which board was
  constructed.
- **Setting state during a pending choice.** A setter fired while a block-all
  pending choice is open could strand it. Decided: setters are refused while
  any pending choice is open (D-24689 §7).
- **Setting state while the bot is moving.** In a bot-ally match the bot acts
  between the operator's moves. Setters landing mid-bot-turn would race the
  bot loop. Decided: setters run only on the operator's own turn, in the
  `main` stage (D-24689 §7).
- **The bot's decision record is per instance.** It lives in process memory
  (capped at 50 per match and 20 matches), so a restart loses it. During a
  deploy overlap the board route can land on the instance that isn't driving
  the bot and show an empty list (D-24689 §5).
- **The operator sees every hand.** Play in a debug match isn't
  representative play. That's fine for verifying an effect, and it's one
  more reason the match is never scored.
- **Replay across builds.** Jumping to turn N re-runs a stored log on the
  current server. If the engine changed between the match and the replay,
  the replay may not match what happened. Decided: record the server build
  at match creation and label the result "played on build X, replayed on
  build Y" (or "build unknown") rather than refusing (D-24689 §8).
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
   Answered: D-24689 §4 (an admin HTTP route, under a fifth carve-out).
2. **Jump to turn N on the right engine.** D-24119's replay runs on the
   current server. Does a mid-match stop need the match's build, recorded in
   `buildProvenance`, and does it refuse when the build differs? Check D-24119
   before relying on it for old matches.
   Answered: D-24689 §8 (record the build at creation; label, don't refuse).
3. **Which setters come first?** This page orders them by the incidents.
   A WP should confirm the list and the order, and whether "place a card"
   is limited to cards already loaded at setup. The engine never queries the
   registry after setup, so a card outside the match's composition has no
   data to stand on.
   Answered: D-24689 §7 (order, conservation, move rules).
4. **Bot candidates, live or logged?** Show them only in the panel, or also
   record them in a debug match's diagnostics so a bot decision can be read
   afterwards?
   Answered: D-24689 §5 (live, from server memory, via the board route).
5. **UI library.** Herbs vs. Ailments names Tweakpane as the shared
   debug-panel UI for both games. The arena-client is Vue 3, with PrimeVue on
   the dashboard. Whether play takes Tweakpane, and how it mounts beside the
   play mat, is open.
   Answered: D-24689 §6 (a lazy Vue panel; Tweakpane for the setters).
6. **The debug flag's name and home.** It goes in the extensible match-setup
   envelope. The exact field, its default, and its drift tests need a
   DECISIONS entry.
   Answered: D-24689 §1 (`isDebugMatch` on the creation payload, not the
   loadout envelope).
7. **Economy and event setters.** The console ideas `add recruit N`,
   `add attack N` and "trigger a villain escape" don't move a card, so §7's
   conservation rule doesn't cover them. Does follow-on 2 add them, under what
   log line, and does an escape go through the normal escape path?
   Answered: D-24713 §2 (1–20 Recruit or Attack this turn, and a forced escape
   through `resolveVillainEscape`, each with an "Operator:" log line).
8. **Branching rewind.** Is "fork a new operator match from the same setup
   and seed, replaying the first N moves as real moves" the branch model? It
   needs no new persistence read beyond follow-on 3's carve-out, and every
   branch is a normal, replayable operator match.
9. **Prank mode.** The badge every seat sees is a guardrail (D-24689 §1).
   A secret per-player rig would need a ruling to hide it from the target
   player. Is that wanted at all, and does it stay unscored?
10. **Client-only tools.** The effects tuner and the latency monitor change no
    game state. Do they belong in the operator panel, or behind a separate
    admin-only client gate on any match or the fixture route? And does the
    latency view need a server health route to time Postgres?

## References

- [Herbs vs. Ailments: debug panel and development principles](https://ewiki.herbs-vs-ailments.com/design/herbs-vs-ailments-debug-panel/)
  (the structural model; behind Cloudflare Access)
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md): D-24026 (live
  verification is the Definition of Done), D-24684 (Ymir chooser; PASS
  `ZVUtr7aaCom`, partial `MHZt0mnJyn6`), D-24685 (Cosmic Cube twist 8; PASS
  `Cq_czI1TQH0`), D-24686 (empty-supply log line; live-verify pending),
  D-24119 / D-24095 (faithful replay and the framework-store exemption),
  D-24146 (ranked eligibility), D-24306 (`ended_early`), D-24688 (the bot's
  "KO nothing" default for Maniacal Tyrant, carried over from D-24510),
  D-24689 (the operator match and the arc's rulings), D-24697 (bot decisions
  on the display turn)
- [WP-802](../docs/ai/work-packets/WP-802-operator-board-inspection.md):
  operator match, never scored, reveal-all board read (done, live-verified)
- [WP-804](../docs/ai/work-packets/WP-804-operator-panel-client.md):
  the operator panel on play
  ([PR #2735](https://github.com/barefootbetters/legendary-arena/pull/2735))
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
