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

Copilot's Riot-portfolio references (League of Legends, 2XKO, Wild Rift,
VALORANT, Teamfight Tactics, Legends of Runeterra, Riot R&D) are recorded
below as research inputs. They are not adopted as a mode taxonomy or a visual
skin.

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

### Reference games (Copilot pattern study)

Copilot did not recommend copying one title. It recommended a mixture of
Riot portfolio patterns. Those titles are research inputs, not product
requirements. The table records the claimed lesson, what transfers to
Legendary Arena, what does not, and where it lands on this page, so a later
WP can cite "Wild Rift's disclosure, not League's mode grid" without
re-arguing it. None of it borrows Riot art or chrome.

| Source | Claimed lesson (Copilot) | What transfers | What does not transfer | Reconciled use on this page |
|---|---|---|---|---|
| League of Legends | Distinct play intentions (ranked, ARAM, normals, limited modes) instead of one long setup page; temporary modes as a controlled experiment surface | One intention per entry point. Fight, Watch, import, and diagnostics do not share one scroll. | League's mode grid (Ranked / ARAM / Normal / Labs) as the lobby layout. Campaign and Ranked are not live intentions here. | Four intentions: Fight · Watch · Resume · Workshop. Add a mode only when two real intentions need separating. |
| 2XKO | Lead with the fantasy and the contest; explain configuration after. Bold arena presentation. | The first impression is the encounter, not the form. The primary action sits on the composition (Mastermind vs heroes). | A ranked ladder climb as the reason the product exists. 2XKO's end of active development is the caution, not the aesthetic. | Cinematic landing + featured table (priority 1). Ranking is a score against PAR after play, not a lobby headline. |
| Wild Rift | Progressive disclosure on a small screen: do → party → loadout → review → enter. Thumb-level primary actions; sheets instead of a wall of fields. | One decision per screen. LAGN upload, pasted JSON, ms delay, and policy names leave the player path. | Mobile-MOBA chrome, copied bottom navigation, or a five-step wizard that still asks engineer questions. | The reconciled flow below (Intention → Challenge → Roster → Table → Brief), at every viewport ([Responsive Viewport Targets](responsive-viewport-targets.md)). |
| VALORANT | Interface discipline: strong type, limited palette, one dominant action, information that reads at a glance | Mission-brief density. Colour as state, not decoration. One maroon primary action. | Tactical-shooter aesthetic, angular militarized framing, or a six-colour palette invented beside the token system. | The battle brief as the signature screen (priority 2). Copilot's state meanings mapped onto existing tokens (divergence table above). |
| Teamfight Tactics | Visible journey plus personality; ranked performance as a path, not a dashboard | Evidence of play without turning the lobby into a stats sheet. Warmth is allowed. | Initiate → Legend tier names, cups, and trials before the core fight is sticky. Hidden MMR-style weights. | Lightweight standing on `legends` (WP-143) + [Awards and Badges](awards-and-badges.md) (priority 7). No grind track; the vision forbids hidden scoring factors. |
| Legends of Runeterra | Cards are the primary object; collection, deck-builder, and in-match need different densities | The three-density card model. Keyword icons, fixed stat positions, printed text kept apart from modifiers. | Building the full card system before the home screen has a single portrait. | Challenge card first; the other densities wait for real Heroes / Loadouts destinations. |
| Riot R&D | Wide incubation funnel, then fewer high-impact bets; a stable live core kept apart from the experimental layer | Stable core vs experimental edge (see *Stable core, experimental edge* below). | Treating Ranked, seasons, or Labs as the next scheduled product line. Copying Riot's org model. | Scaffold-then-spec: observe the featured-table entrance before formalizing a broader visual system. |

**The mixture Copilot proposed:** structure from League, energy from 2XKO,
mobile clarity from Wild Rift, competitive precision from VALORANT,
personality from TFT, card presentation from Runeterra, discipline from Riot
R&D.

**The mixture this page keeps:** Riot for *discipline* (one decision per
screen, one primary action, colour as state). Legendary Arena's own canon
for *meaning* (Mastermind + Scheme as the story; the lobby as the table
sitting down). See the design principle below.

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

### Stable core, experimental edge

Riot's R&D office describes
[incubation as a wide funnel](https://www.riotgames.com/en/r-and-d-office/incubation-exploration-with-a-plan)
narrowed to the few ideas that earn a prototype. The studio has since
[refocused on fewer, higher-impact projects](https://www.riotgames.com/en/news/2024-player-update).
Carried over to the lobby:

- **Core.** What every player depends on, and what must not move under
  them: creating a table, cooperative play, turn flow, the Mastermind fight,
  card resolution, and rejoining.
- **Edge.** Draft formats, alternate Schemes, gauntlet and tournament
  experiments, spectator presentation, and bot stances. Copilot's name for
  this space is **Arena Labs**: a labeled area, so an experiment never
  silently changes the rules of a scored table.

Arena Labs is a label, not a scheduled surface. It matters once a second
experiment exists that needs separating from the core. Until then,
gauntlets and seed challenges already cover the edge.

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

- **The 2XKO claim is verified.** On 2026-08-20 Riot
  [announced](https://www.riotgames.com/en/news/2xko-active-development-ends-december-2026)
  that active 2XKO development ends in December 2026. The servers stay up.
  Riot's stated reason is retention: not enough players "stick with the game
  to get to a path toward sustainability." That was despite reliable netcode,
  a ranked ladder, regular content, and a free-to-play door. The *fact of the
  announcement* is verified against Riot's own post; any cause analysis past
  Riot's statement is reported, not verified. Both reviews draw the same
  lesson from it: don't lead with ranked infrastructure. That lesson is
  product-level and says nothing about lobby chrome.
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
- Riot Games, [2XKO Active Development Will End in December 2026](https://www.riotgames.com/en/news/2xko-active-development-ends-december-2026) (2026-08-20)
- Riot Games, [Incubation: Exploration With a Plan](https://www.riotgames.com/en/r-and-d-office/incubation-exploration-with-a-plan) (R&D Office, 2020-06-18; R&D lifecycle, not a lobby spec)
- Riot Games, [Changes at Riot and the Road Ahead](https://www.riotgames.com/en/news/2024-player-update) (2024-01-22; fewer, higher-impact projects)
- [Branding](branding.md) — token mapping for Copilot's colour-state list
- [Responsive Viewport Targets](responsive-viewport-targets.md) — the Wild Rift lesson (one decision per screen) held to this project's breakpoints
