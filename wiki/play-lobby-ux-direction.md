---
title: Play Lobby UX Direction
type: Guide
tags:
  - phase-lobby
  - arena-client
  - ux
  - design-system
  - research
related:
  - branding.md
  - design-system-overview.md
  - leaderboard.md
  - awards-and-badges.md
  - seed-challenges.md
  - scoring.md
  - vision.md
  - guest-accounts.md
  - lagn-v1.md
  - play-board.md
  - responsive-viewport-targets.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\play-lobby-ux-direction.md (this page — https://ewiki.legendary-arena.com/play-lobby-ux-direction/)
  - ../apps/arena-client/src/lobby/LobbyView.vue
  - ../apps/arena-client/src/lobby/playerCountRequirements.ts
  - ../docs/01-VISION.md
  - ../docs/ai/work-packets/WP-011-match-creation-lobby-flow.md
  - ../docs/ai/work-packets/WP-092-lobby-loadout-intake.md
  - ../docs/ai/work-packets/WP-326-lobby-join-list-filter.md
  - ../docs/ai/work-packets/WP-371-lobby-player-count-composition-gate.md
  - ../docs/ai/work-packets/WP-376-solo-bot-ally-lobby-client.md
  - ../docs/ai/work-packets/WP-635-battle-plan-api.md
  - ../docs/ai/work-packets/WP-637-battle-plan-client-panel.md
  - ../docs/ai/work-packets/WP-029-spectator-permissions-view-models.md
  - ../docs/ai/work-packets/WP-143-legends-attract-board.md
last-reviewed: 2026-09-28
---

# Play Lobby UX Direction

## Summary

The lobby at `play.legendary-arena.com` works as an operator test bench, not
as a front door into the game. Two outside design reviews came in on
2026-09-28: one from Copilot (a Riot-portfolio pattern study plus a phased
roadmap) and one from Grok (a critique of that study, anchored in this game's
own brand and setup ritual). This page records both, checks their claims
against the code, and sets out where they agree, where they disagree, and one
reconciled direction. **Nothing here is a decision.** An item takes effect
only when a Work Packet adopts it, and the design calls behind it go in
[DECISIONS.md](../docs/ai/DECISIONS.md).

## Mechanics

### What the lobby is today (verified against code)

`LobbyView.vue` renders one long page with these sections, top to bottom:

| Section (heading in code) | What it exposes | Governing WP |
|---|---|---|
| `Legendary Arena — Lobby` / **Player identity** | Display-name field | [WP-011](../docs/ai/work-packets/WP-011-match-creation-lobby-flow.md) |
| **Watch Bot Play** | Player count, **AI Policy** (`Competent (heuristic)` / `Random`), **Delay between moves (ms)** (default `800`) → `POST /api/match/autoplay` | autoplay route |
| **Play with a bot ally** | Bot-ally count, **Bot ally skill** (same two policies) | [WP-376](../docs/ai/work-packets/WP-376-solo-bot-ally-lobby-client.md) |
| Create from loadout JSON | File upload, paste JSON, grey **Load sample loadout (test)** button (fetches `/loadout-test.json`) | [WP-092](../docs/ai/work-packets/WP-092-lobby-loadout-intake.md) |
| **Create match** | Manual setup fields; composition warnings | [WP-371](../docs/ai/work-packets/WP-371-lobby-player-count-composition-gate.md) |
| **Join existing match** | Match ID / invite link; open-match list; empty state `No open matches right now — create one above.` | [WP-326](../docs/ai/work-packets/WP-326-lobby-join-list-filter.md) |

Validation text comes from `playerCountRequirements.ts` and speaks in counts:
*"A 2-player match needs 2 villain groups — this loadout has 0."* Both
reviews quote this string accurately.

The marketing home (`www`) opens on a dark, art-led hero with a single
maroon **Play now**. The lobby is cream and form-first, and in effect it
looks like a separate product. Both reviews treat that mismatch as the core
problem.

### Where the two reviews agree

- **Replace the first impression, not the engine.** One cinematic landing
  with a single primary action (**Enter Arena**). The engine, persistence,
  and server stay as they are.
- **Progressive disclosure.** One decision per screen. Raw JSON, match IDs,
  millisecond delays, and heuristic policy names come off the player path.
- **Keep every current control under a new name, Arena Workshop.** The
  current lobby is a good operator console. Nothing is deleted.
- **A mission/battle brief** between setup and the board is the signature
  screen.
- **Modern mythic, not parchment.** Dark navy field, stone and metal
  surfaces, spare gold, and maroon kept for the primary action only.
- **Build the core experience before the ranked shell.** Both reviews cite
  2XKO as a cautionary tale: competitive infrastructure doesn't make up for
  a thin core loop.

### Where they diverge — and the reconciled read

| Topic | Copilot | Grok | Reconciled read |
|---|---|---|---|
| **Center of gravity** | Mode taxonomy (Riot structure) | The *encounter*: Mastermind + Scheme as story | **Grok.** Legendary setup is a narrative: this Mastermind runs this Scheme, these villains follow, these heroes are the answer. The flow should put the encounter first. |
| **Top-level intentions** | Quick Battle / Campaign / Ranked / Custom / Watch | Fight / Watch / Resume / Workshop | **Grok's four.** Campaign doesn't exist yet. Ranked is a result of play (see next row), not a mode. Add modes once two real intentions need separating. |
| **Ranking** | Rank ladder (Initiate → Legend → Mastermind Slayer); hide raw MMR and "internal weights" | Show evidence of play quality; skip tier names until the core fight is sticky | **Grok, plus a correction to Copilot.** Ranking here is a score against PAR on a deterministic board ([Scoring](scoring.md), [Leaderboard](leaderboard.md)), not MMR matchmaking. The vision explicitly says *no hidden scoring factors* ([01-VISION.md](../docs/01-VISION.md)). Hiding the weights would contradict the product's own integrity promise, so Copilot's "hide internal weights" advice does not transfer. |
| **Seasons / dailies** | Q4 seasons, weekly challenges, season rewards | No daily-login loops or "come back tomorrow" framing | **Split.** The vision rules out *grind incentives or repetition rewards*. It does not rule out rotating featured challenges ([Seed Challenges](seed-challenges.md), gauntlets) or a season/Pass commercial wrapper ([Monetization Model](monetization-model.md)). Featured challenge = yes. Streak and login rewards = no. |
| **Card design system** | Three card densities (collection / deck-builder / in-match) up front | Start with one *challenge card*; the rest waits for real Heroes/Loadouts destinations | **Grok's order, Copilot's model.** The three-density model is right, but build it card by card as destinations exist. |
| **Colour semantics** | Six-state palette (gold / crimson / blue / purple / green / grey) | Reuse existing brand tokens | **Both.** Keep Copilot's state meanings but map them onto tokens that already exist ([Branding](branding.md): `--la-color-gold`, `--la-color-cta`, `--la-color-success` / `-error` / `-warning`, `--la-color-blue-bright`). Add a token only where no mapping exists (e.g. Mastermind purple). |
| **Bots** | "AI teammates" as a Labs item | Bots as named seats with a stance; Watch as a public table and the cheapest tutorial | **Grok.** Bot allies already ship (WP-375/376). This is presentation work, not new R&D. |
| **Roadmap shape** | 9 phases over 4 quarters | 7 ordered, visible-without-engine changes | **Grok's order.** Copilot's first three (home, guided create, brief) match Grok's first two. Everything after that is contingent on how players use them. |

### Reconciled player flow

```
1. Intention   Fight · Watch · Resume · Workshop
2. Challenge   Mastermind portrait · Scheme name · "why this is dangerous" · player count
3. Roster      five hero slots, pre-filled, swap allowed
4. Table       humans, named bot allies, or both
5. Brief       the setup read aloud + seats + one maroon  ENTER ARENA
```

The default path takes **one click**: a legal featured table, with
Mastermind, Scheme, and five heroes already chosen, straight to **Enter
Arena**. LAGN upload, pasted JSON, manual setup, AI policy, and delay all
live in Workshop.

### Validation copy — counts → consequences

Grok's example sets the register: say what is missing in the game's own
terms.

| Today (`playerCountRequirements.ts`) | Player-path phrasing (illustrative) |
|---|---|
| `A 2-player match needs 2 villain groups — this loadout has 0.` | *Two heroes at the table means two villain groups in the deck — pick one more.* |
| henchmen-count mismatch | *This scheme still needs a henchman group before the city can open.* |
| hero-count mismatch | *Five heroes answer the call — one slot is still empty.* |

Workshop keeps the precise count strings, because they are the test-bench
diagnostics.

### Reconciled priority order

| # | Change | Why it wins |
|---|---|---|
| 1 | Dark cinematic landing + one **Enter Arena** on a legal featured table | Ends the form-first first impression |
| 2 | Battle brief between setup and board | Turns configuration into a mission |
| 3 | Move LAGN, JSON, ms delay, and policy names into **Arena Workshop** | Keeps testers; protects players |
| 4 | Named bot seats + **Watch** as a public table | Solo and spectator feel like the game |
| 5 | Resume / featured / empty-state rewrite | Removes the "nobody's here" lobby |
| 6 | Loadout import as a **preview** (Mastermind, Scheme, groups, heroes, readiness row) before **Create table** | Makes import trustworthy |
| 7 | Lightweight standing: Masterminds defeated, cleanest table, heroes steered, tables finished | Progress without a treadmill |

Deferred by both: League-style mode grid, Ranked Arena as a headline,
parchment/comic chrome, daily quests or gacha language, and 15 card frames
before the home screen has a single portrait.

### Design principle (Grok)

> The lobby is the moment the table sits down, reads the scheme out loud,
> and agrees who is covering which threat. If a control does not help that
> moment, it belongs in Workshop.

Use Riot for *discipline*: one decision per screen, one primary action, and
colour as state. Use the game's own canon for *meaning*.

## Interactions

- **[Battle Plan](../docs/ai/work-packets/WP-635-battle-plan-api.md)**
  (WP-635/637). The reviews use "Battle Plan" loosely. What ships is a
  **player-authored, three-phase free-text document** (`pre_battle` /
  `battle_adjustments` / `post_battle`) in an overlay panel, not a
  setup-summary screen. The brief proposed here would be an
  **engine-derived setup read-out** (Mastermind + Always Leads, Scheme +
  twist count, city/escape threat, hero lineup, seats) with the existing
  `pre_battle` phase embedded as the team's shared plan.
- **Bot allies** (WP-375/376, liveness WPs 414–426). Only two policies exist
  today: `competent` and `random`. Grok's "Steady / Aggressive / Teaching"
  stances are presentation over `competent`, except **Teaching**, which
  would need new explain-the-move behaviour.
- **Watch** — the autoplay route and spectator view models
  ([WP-029](../docs/ai/work-packets/WP-029-spectator-permissions-view-models.md)).
- **Featured table** — natural sources are a [Seed Challenge](seed-challenges.md)
  or a gauntlet config (see [Leaderboard](leaderboard.md)). Both are
  deterministic and legal by construction.
- **Standing** — `legends.legendary-arena.com`
  ([WP-143](../docs/ai/work-packets/WP-143-legends-attract-board.md)), linked
  from the lobby as "your record." Grok's evidence-of-play standing lines up
  with [Awards and Badges](awards-and-badges.md) (reward cooperation,
  un-farmable table badges), which argues the same position on its own.
- **Loadout preview** — [LAGN v1](lagn-v1.md) parse via WP-092 intake.
- **Identity** — [Guest Accounts](guest-accounts.md) govern who can sit
  down without signing in.
- **Look** — [Branding](branding.md) tokens and
  [Design System Overview](design-system-overview.md). Layout targets:
  [Responsive Viewport Targets](responsive-viewport-targets.md).

## Edge Cases

- **Unverified external claims.** Copilot attributes to Riot an announcement
  that active 2XKO development ends at the end of 2026, citing low
  retention. It was not verified for this page. Treat it as reported, not as
  fact. The design lesson stands either way.
- **Copilot's source links are omitted on purpose.** Copilot cited documents
  from a non-project SharePoint tenant. They are not repo artifacts and are
  not reproduced here. The repo WPs cited above are the canonical copies of
  WP-011 and WP-019.
- **Rewording validation strings is a deliberate behaviour change.**
  `LobbyView.test.ts` and `playerCountRequirements.test.ts` pin the current
  count-based text. A WP that adds player-path phrasing has to add new
  strings (and tests) alongside Workshop's, not quietly re-pin the old ones.
- **"Featured" must stay legal at every player count.** A featured table
  fixed for one player count can trip the WP-371 composition gate when a
  second human sits down. The featured source has to carry
  per-player-count composition, or lock the count.
- **Workshop visibility is unresolved.** A public Workshop keeps the test
  bench reachable for power users. A gated one protects first-time players
  but can strand curators who upload LAGN files. See Open Questions.

## Open Questions

- Which of the seven priorities become Work Packets, and in what order?
  Nothing here is scheduled.
- Is **Arena Workshop** public (a secondary link) or gated (signed-in /
  admin)? That is a product call for DECISIONS.md.
- What supplies the featured table: a seed challenge, the current
  gauntlet's config, or a hand-curated rotation?
- Do bot "stances" map 1:1 onto policies, or does **Teaching** justify a
  new policy?
- Does the brief need a new `UIState` or pre-match projection? If it reads
  engine-derived setup data client-side, the
  [Board-Visible Field Rule](../.claude/rules/architecture.md) applies to
  any field added.

## References

- [LobbyView.vue](../apps/arena-client/src/lobby/LobbyView.vue) — current lobby
- [playerCountRequirements.ts](../apps/arena-client/src/lobby/playerCountRequirements.ts) — composition warning text
- [01-VISION.md](../docs/01-VISION.md) — "No hidden scoring factors", "No grind incentives or repetition rewards", NG-2 (no gacha)
- [WP-011 — Match Creation Lobby Flow](../docs/ai/work-packets/WP-011-match-creation-lobby-flow.md)
- [WP-029 — Spectator Permissions View Models](../docs/ai/work-packets/WP-029-spectator-permissions-view-models.md)
- [WP-092 — Lobby Loadout Intake](../docs/ai/work-packets/WP-092-lobby-loadout-intake.md)
- [WP-143 — Legends Attract Board](../docs/ai/work-packets/WP-143-legends-attract-board.md)
- [WP-326 — Lobby Join List Filter](../docs/ai/work-packets/WP-326-lobby-join-list-filter.md)
- [WP-371 — Lobby Player-Count Composition Gate](../docs/ai/work-packets/WP-371-lobby-player-count-composition-gate.md)
- [WP-376 — Solo Bot Ally Lobby Client](../docs/ai/work-packets/WP-376-solo-bot-ally-lobby-client.md)
- [WP-635 — Battle Plan API](../docs/ai/work-packets/WP-635-battle-plan-api.md)
- [WP-637 — Battle Plan Client Panel](../docs/ai/work-packets/WP-637-battle-plan-client-panel.md)
- External design reviews: Copilot and Grok, 2026-09-28 (operator-supplied; not repo artifacts)
