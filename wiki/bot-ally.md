---
title: Bot Ally
type: System
tags:
  - bot-ally
  - co-op
  - solo-play
  - layer-server
  - arena-client
related:
  - scoring.md
  - guest-accounts.md
  - play-board.md
  - tournament-calendar.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\bot-ally.md (this page — https://ewiki.legendary-arena.com/bot-ally/)
  - ../apps/arena-client/src/lobby/LobbyView.vue
  - ../apps/arena-client/src/components/BotAllyStallBanner.vue
  - ../apps/arena-client/src/composables/useBotAllyStatus.ts
  - ../apps/server/src/bot-ally/botAllyRoutes.mjs
  - ../apps/server/src/bot-ally/botAllyDriver.mjs
  - ../apps/server/src/competition/competition.logic.ts
  - ../docs/ai/DESIGN-SOLO-BOT-ALLY.md
  - ../docs/ai/work-packets/WP-375-solo-bot-ally-driver-server.md
  - ../docs/ai/work-packets/WP-376-solo-bot-ally-lobby-client.md
  - ../docs/ai/work-packets/WP-377-ranked-eligibility-seat-count-guard.md
  - ../docs/ai/work-packets/WP-414-bot-ally-stall-surface-and-revival.md
  - ../docs/ai/work-packets/WP-415-bot-ally-stall-banner-client.md
  - ../docs/ai/work-packets/WP-419-bot-ally-liveness-and-strand.md
  - ../docs/ai/work-packets/WP-742-coach-bot-ally-seat-marker.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-25
---

# Bot Ally

## Summary

A **bot ally** lets you play a full cooperative game of Legendary on your own.
You take one seat, and computer-controlled teammates fill the others. They take
their own turns and fight the Mastermind alongside you. It is a teammate, never
an opponent: every seat wins or loses together.

## Mechanics

### Starting a game

In the lobby on `play.legendary-arena.com`, set up your scheme, Mastermind and
player count as usual, then open the **Play with a bot ally** section:

| Control | What it does |
|---|---|
| **Bot allies (1 or more, leaving a seat for you)** | How many bots join. At least one seat is always left for you. |
| **Bot ally skill** | **Competent (heuristic)**, the default, plays to win. **Random** picks among its legal moves at random. |
| **Play with a bot ally** | Creates the match and seats you. |

- **Seats:** a bot-ally table has 2 to 5 seats. You always sit in the first
  seat, and the bots take the seats after you.
- **Starting:** the bots ready up on their own. The game starts as soon as
  you ready up.
- **Names:** bots appear as **Bot Ally 1**, **Bot Ally 2** and so on.
- **Play Again:** rebuilds the same table, with the same number of bots at the
  same skill.
- **Sign-in:** you need to be signed in to start a bot-ally game.

### How the bot plays

- **Its own turns:** when a bot's turn comes, it plays straight through. It
  plays cards, recruits, fights and ends its turn. There is no artificial
  "thinking" pause, so its turns resolve quickly.
- **No peeking:** the bot sees exactly what a player in its seat would see. It
  cannot look at your hand or at any other hidden card.
- **Choices on its own turn:** when a card asks the bot to choose, it takes the
  game's standard default choice. Examples are KO-ing a Hero or taking an
  optional reward.
- **Choices on your turn:** some effects make *every other player* respond
  during your turn. Examples are Loki's Vanishing Illusions ("each other
  player KOs a Villain from their Victory Pile") and Dr. Doom's Monarch's
  Decree. The bot answers its part right away with the default choice, and
  your turn carries on. It never answers for you.
- **Waiting on you:** if the bot's own move asks *you* to respond, it pauses
  its turn until you answer, then picks up where it left off.

### Scoring and rankings

- **Never ranked:** a bot-ally game never counts toward the ranked
  leaderboard.
- **Ranked-gauntlet loadout:** the game is still scored as **Casual** and
  shows on your end screen. The bot's seat is labelled **Player N (Bot)**, and
  the AI Coach knows which seat was the bot.
- **Casual setup:** the game is unscored, like any casual game.

[Scoring](scoring.md) covers what each kind of match earns.

### If the bot gets stuck

- **Recovery first:** the bot retries a stuck move and falls back to ending
  its turn before it gives up.
- **If it still can't continue:** the game is stopped and a bar appears
  across the top of the board. It reads: *"The bot ally could not finish its
  turn, so the match was stopped. You can start a new match with a bot
  ally."*
- **Return to lobby:** the bar's button takes you back to the lobby to start
  a new game.
- **Server updates:** if the server restarts during an update, your game
  picks back up when it comes back. Your bot ally keeps playing, and you don't
  need to do anything.

### Stepping away

The bot waits patiently on your turn. If nothing happens in the game for about
**20 minutes**, the bot ally stops and the game ends as abandoned. Any move you
make resets that clock, so a long think is never a problem.

## Interactions

- **[Scoring](scoring.md):**
  - A bot seat makes a ranked-gauntlet score Casual.
  - A bot seat is labelled **Player N (Bot)** on the score report.
- **[Guest Accounts](guest-accounts.md):**
  - Host-added guest seats reuse the bot ally's way of joining a seat without
    an account.
  - The bot-ally host seat itself needs a signed-in account.
- **[Play Board](play-board.md):** the stall bar sits across the top of the
  play board on both phone and desktop layouts.
- **[Tournament Calendar](tournament-calendar.md):** tables can include a bot
  ally, so open-play hours still work with a single human present.
- **Watch Bot Play:** a separate lobby mode where *every* seat is a bot and
  you only watch, with an adjustable delay between moves. The bot ally is the
  mode where you play.

## Edge Cases

- **Bot count and seats:**
  - The bot count must leave at least one seat for you.
  - The lobby rejects a count that doesn't fit the player count, and says so.
  - A bot-ally table needs at least 2 seats.
- **No think-time:** a bot's turn can flash by. Follow along in the game log.
- **Shared responses:** when an effect makes several players respond, the
  effect finishes only once *everyone* has answered. Until you answer your
  part, the table waits on you, even if the bot has already answered its own.
- **Repeated restarts:** each game can be revived after a server restart a
  limited number of times. A game that keeps failing to get going is stopped
  with the "could not finish its turn" message rather than left frozen.
  Finishing one bot turn clears the count.
- **Very long games:** the bot ally stops after 400 of its own turns. No real
  game gets close.

## References

- **UI:**
  - [LobbyView.vue](../apps/arena-client/src/lobby/LobbyView.vue) — the
    **Play with a bot ally** section, its bot-count and skill controls, and
    the seat-count checks.
  - [BotAllyStallBanner.vue](../apps/arena-client/src/components/BotAllyStallBanner.vue)
    — the stall bar and its **Return to lobby** button.
  - [useBotAllyStatus.ts](../apps/arena-client/src/composables/useBotAllyStatus.ts)
    — the client status poll that shows the bar.
- **Server:**
  - [botAllyRoutes.mjs](../apps/server/src/bot-ally/botAllyRoutes.mjs) —
    `POST /api/match/create-with-bot` (signed-in only, 2–5 seats, bots in
    seats 1…N), plus restart revival.
  - [botAllyDriver.mjs](../apps/server/src/bot-ally/botAllyDriver.mjs) — the
    bot's turn loop, audience-filtered view, recovery steps, the 20-minute
    idle stop and the 400-turn cap.
  - [competition.logic.ts](../apps/server/src/competition/competition.logic.ts)
    — ranked eligibility; any bot seat makes the match Casual.
  - [botAllySeatChoice.test.ts](../apps/server/src/bot-ally/botAllySeatChoice.test.ts)
    — the bot answering a seat choice on your turn, and waiting on yours.
- **Design and work packets:**
  - [DESIGN-SOLO-BOT-ALLY.md](../docs/ai/DESIGN-SOLO-BOT-ALLY.md) — design
    ("Casual history yes, ranked never").
  - [WP-375](../docs/ai/work-packets/WP-375-solo-bot-ally-driver-server.md) —
    server driver.
  - [WP-376](../docs/ai/work-packets/WP-376-solo-bot-ally-lobby-client.md) —
    lobby.
  - [WP-377](../docs/ai/work-packets/WP-377-ranked-eligibility-seat-count-guard.md)
    — ranked guard.
  - [WP-414](../docs/ai/work-packets/WP-414-bot-ally-stall-surface-and-revival.md),
    [WP-415](../docs/ai/work-packets/WP-415-bot-ally-stall-banner-client.md) and
    [WP-419](../docs/ai/work-packets/WP-419-bot-ally-liveness-and-strand.md) —
    stall surface, banner and liveness.
  - [WP-742](../docs/ai/work-packets/WP-742-coach-bot-ally-seat-marker.md) —
    coach bot-seat marker.
- **[DECISIONS.md](../docs/ai/DECISIONS.md):**
  - D-24170 — bot-ally model.
  - D-24120 — bots have no account row.
  - D-24230 / D-24233 — revival cap and reset.
  - D-24593 — seat choices on your turn.
