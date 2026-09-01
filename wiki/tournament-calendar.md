---
title: Tournament Calendar
type: Guide
tags:
  - tournament
  - organized-play
  - calendar
  - monetization
  - governance
related:
  - monetization-model.md
  - leaderboard.md
  - seed-challenges.md
  - profile-login.md
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\tournament-calendar.md (this page — https://ewiki.legendary-arena.com/tournament-calendar/)
  - C:\pcloud\matches\Core\tournament-calendar-and-play-times.md (source draft)
  - ../docs/TOURNAMENT-FUNDING.md
  - ../docs/01-VISION.md
status: draft
last-reviewed: 2026-09-01
---

# Tournament Calendar

## Summary

The organized-play plan for Legendary Arena: a set of recurring, year-round
**open-play windows** so that "Join" is never empty at a known hour, plus a
**13-week seasonal tournament schedule** (Season 1 — Foundation) whose standing
is earned by playing the weekly scenario well, never bought. This page is a
**draft plan** — it describes the calendar and cites where each rule is
governed; it defines no policy. The fairness posture (open play and competitive
standing are free; only host office hours may charge) is owned by
[Monetization Model](monetization-model.md) and `docs/01-VISION.md`; the
organizer-side funding contract is owned by
[`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md).

## Mechanics

### Design constraints

The calendar is shaped by what the game actually is, not by a generic booking
tool:

- Legendary Arena is **cooperative vs. a mastermind**. A "tournament" is a
  shared scenario + loadout scored by the session — not a 1v1 bracket unless one
  is added later.
- **Standing comes from sessions played well.** The calendar must not become a
  grind window or a paid gate. Standing is measured on the published scenario,
  not on hours logged.
- Tables **can include a bot ally**, so open-play hours still work with a single
  human present.
- `play.legendary-arena.com` already exposes Create / Join / Watch-bot. The
  calendar's only job is to make **Join** non-empty at predictable hours.
- Seasons are **13-week quarters** so the arena shares a clock with the
  Strategy Guide's 52-week cadence.
- The scheduling block is **90 minutes** (setup + one scored game + brief
  recap). Two scored games are not stacked in one block.
- Times are published in **America/Los_Angeles (PT)** and **UTC**, with local
  conversion shown on the surface that renders the grid.

### Event types

One event type per listing, named consistently across every surface (site, ICS,
Discord, YouTube description).

| Code | Name | Length | Primary goal | Paid? | Who hosts |
| --- | --- | --- | --- | --- | --- |
| `OPEN` | Open table | 90 min | Play | No | Anyone; bot fills empty seats |
| `TEACH` | First session | 90 min | Play + learn | No | Operator or designated guide |
| `WEEKLY` | Weekly scenario | 90 min | Standing | No | Operator publishes loadout the prior Monday |
| `CUP` | Cup match | 90 min | Standing | No | Swiss or group, published pairing |
| `FINAL` | Championship table | 120 min | Standing | No | Featured loadout, spectate on |
| `HOST` | Rules / strategy hour | 45 min | Coaching | Optional Stripe | Operator only |

`HOST` is the **only** event type that may attach a paid gate, and it is
office-hours teaching — never a scored session. This is the fairness line the
[Monetization Model](monetization-model.md) draws: *a paid strategy hour is
teaching, not standing.* Open play and every scored event (`OPEN`, `TEACH`,
`WEEKLY`, `CUP`, `FINAL`) are free.

### Recurring play times (year-round)

Three daily-ish windows so the Americas, Europe/Africa, and Asia-Pacific each get
a prime block. The plan **starts small** — one window per region on weekdays, all
three on weekends — and adds density only when Join queues actually fill.

All times below are **PT**. Add 7 hours for UTC in PDT season (UTC−7), 8 hours in
PST (UTC−8). DST flips on the second Sunday in March and the first Sunday in
November.

| Local day (PT) | Window | PT | UTC (PDT) | Intended region | Default type |
| --- | --- | --- | --- | --- | --- |
| Mon | Asia morning | 04:00–05:30 | 11:00–12:30 | East Asia / Oceania evening | OPEN |
| Tue | Europe evening | 11:00–12:30 | 18:00–19:30 | EU / UK / Africa | OPEN |
| Wed | Americas evening | 18:00–19:30 | 01:00–02:30 Thu | US / Canada / LatAm | WEEKLY |
| Thu | Europe evening | 11:00–12:30 | 18:00–19:30 | EU / UK | TEACH (first Thu) or OPEN |
| Fri | Americas evening | 18:00–19:30 | 01:00–02:30 Sat | Americas | OPEN |
| Sat | Asia | 04:00–05:30 | 11:00–12:30 | APAC | WEEKLY |
| Sat | Europe | 11:00–12:30 | 18:00–19:30 | EU | CUP (in cup weeks) or OPEN |
| Sat | Americas | 18:00–19:30 | 01:00–02:30 Sun | Americas | WEEKLY |
| Sun | Asia | 04:00–05:30 | 11:00–12:30 | APAC | OPEN |
| Sun | Europe | 11:00–12:30 | 18:00–19:30 | EU | OPEN |
| Sun | Americas | 16:00–17:30 | 23:00–00:30 Mon | Americas (earlier) | TEACH |

How the grid resolves in practice:

- One `WEEKLY` loadout per calendar week, used at every WEEKLY slot that week,
  published the prior Monday 12:00 PT (LAGN + mastermind + scheme).
- The first Thursday of each month is `TEACH` rather than OPEN.
- No scored event on December 24–26 or January 1 — OPEN only, or dark.
- If the play client is not ready for live humans, the same grid runs as
  **Watch-bot play** plus a published replay; CUP dates that cannot be hosted are
  not advertised.

**Why these hours** (season-dependent): 04:00 PT ≈ 20:00–21:00 JST /
21:00–22:00 AEST (evening APAC); 11:00 PT ≈ 19:00 BST / 20:00 CEST (evening
Europe); 18:00 PT is evening US West and still reachable for US East (21:00 ET).
A fourth window is not added until two of these three regularly fill.

### Season 1 — Foundation (2026-09-14 → 2026-12-13)

13 weeks. Standing is written by `WEEKLY` + `CUP` sessions only; `OPEN` and
`TEACH` do not write season rank. One published scenario per week; mastery is
measured on that scenario, not on hours logged.

**Phase A — Open tables (weeks 1–4).** Purpose: make Join non-empty. No
elimination.

| Week | Dates (PT) | Weekly scenario focus | Notes |
| --- | --- | --- | --- |
| 1 | Sep 14–20 | First-session loadout (starter box legal) | TEACH emphasis; bot ally on |
| 2 | Sep 21–27 | Same starter + one extra hero group | Publish mistakes from week 1 |
| 3 | Sep 28–Oct 4 | Second official loadout | First WEEKLY that counts for standing |
| 4 | Oct 5–11 | Repeat week-3 loadout | "Revisit, refine" |

**Foundation Cup I — Sat Oct 10.** Europe 11:00 PT + Americas 18:00 PT. Swiss,
3 rounds if ≥8 tables, else one scored table per window. Same loadout as week 4.

**Phase B — Scenario season (weeks 5–10).** One new official loadout each week;
CUP every other Saturday.

| Week | Dates | CUP? |
| --- | --- | --- |
| 5 | Oct 12–18 | — |
| 6 | Oct 19–25 | Foundation Cup II — Sat Oct 24 |
| 7 | Oct 26–Nov 1 | — |
| 8 | Nov 2–8 | Foundation Cup III — Sat Nov 7 |
| 9 | Nov 9–15 | — |
| 10 | Nov 16–22 | Foundation Cup IV — Sat Nov 21 |

Loadout names stay scenario-first when available; until then they are listed as
`S1W5` … `S1W10` in the registry.

**Phase C — Championship (weeks 11–13).**

| Date | Event | Windows (PT) |
| --- | --- | --- |
| Nov 23–29 | Championship preview loadout (WEEKLY only, no CUP) | Standard grid |
| Sat Dec 5 | Semifinal tables | 04:00 / 11:00 / 18:00 |
| Sat Dec 12 | Season 1 Championship | 11:00 Europe + 18:00 Americas (120 min `FINAL`) |
| Sun Dec 13 | Rest / OPEN only | Standard Sunday grid |

Qualification for Dec 5 draws on standing accumulated across the weeks 3–10
`WEEKLY` slots plus Cup points. The **standing calculation itself is owned by the
scoring / standing system** ([Scoring](scoring.md), [Leaderboard](leaderboard.md))
— this page names the qualifying inputs but defines no formula. Standing comes
from *sessions played well*, never buy-in and never hours.

**Season 2** opens Mon Jan 4, 2027 (13 weeks). Dec 14 – Jan 3 is off-season
`OPEN` only.

At a glance:

```
Sep 14    Season 1 opens
Oct 10    Foundation Cup I
Oct 24    Foundation Cup II
Nov  7    Foundation Cup III
Nov 21    Foundation Cup IV
Dec  5    Semifinals
Dec 12    Championship
Dec 13    Season 1 closes
Jan  4    Season 2 opens
```

### How a window runs

A visitor sees the grid and the next few named events (not a 52-row dump); each
event is an ICS row plus a play deep link with the week's LAGN preloaded. Around
the start of a window an operator (or a bot) creates the match so Join is not
empty, and Watch-bot / spectate is available if no humans show. After the window,
standing updates on the standing surface — the calendar surface does not scrape
play. The scored events keep no gear CTA as their primary goal
([Video Commerce](video-commerce.md) governs in-stream selling).

### Owning the schedule layer

The intended source of truth is a data file in the marketing/wiki repo (planned
as `data/play-calendar.yaml`), built into a public `/play-times/` grid and a
`/calendar.ics` feed — not a rented calendar service. Each row carries an `id`,
`type`, `start` (ISO-8601 UTC), `duration_min`, `region`, `loadout_id`,
`play_url`, and `status` (`scheduled` / `live` / `completed` / `cancelled`).
While the play client is dark, the same rows publish with `status: preview` and
Watch-bot runs at those hours so the clock is real on day one of live play.

The booking-tool split: `OPEN` / `WEEKLY` / `CUP` / `FINAL` are create/join on
play (no external booking layer); only `HOST` — office hours — would ever use a
Calendly-style booking + Stripe step.

## Interactions

- **[Monetization Model](monetization-model.md)** — owns the fairness posture
  this calendar applies: open play and competitive standing are always free, and
  `HOST` is the only Stripe-eligible event type (teaching, not standing). The
  monetization page's *Organized play & tournaments* section links here.
- **[`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md)** — the
  organizer-side, non-profit, no-margin community-funding contract (D-9701). Any
  contribution channel that covers a cup's incremental infrastructure cost is
  governed there, not here; this page schedules events, it does not raise money.
- **[Scoring](scoring.md)** and **[Leaderboard](leaderboard.md)** — own the
  standing/qualification formula the Championship draws on. This page names the
  qualifying windows (weeks 3–10 `WEEKLY` + Cup points) but not the math.
- **[Seed Challenges](seed-challenges.md)** — the shared-scenario idea a
  `WEEKLY`/`CUP` loadout leans on (every entrant plays a comparable scenario);
  note a shared *seed* is not the same as a shared *match*.
- **[Profile Login](profile-login.md)** — the identity surface a returning
  player joins through; basic identity stays free (Monetization Guardrail #2).

## Edge Cases

- **DST flips move the UTC column, not the PT column.** The grid is authored in
  PT; the UTC offsets shift by an hour across the March / November flips, so the
  ICS feed and any published UTC times must be regenerated after each flip.
- **Holiday dark days.** No scored event runs on December 24–26 or January 1 —
  those windows are `OPEN` only, or dark. The off-season (Dec 14 – Jan 3) is
  `OPEN` only with no standing written.
- **Dark-client preview mode.** If live human play is not ready, advertised CUP
  and FINAL dates that cannot be hosted must not be published; the grid runs as
  Watch-bot with `status: preview` instead.
- **Standing formula is not defined here.** This page deliberately stops at
  "sessions played well." Anyone implementing qualification reads
  [Scoring](scoring.md) / [Leaderboard](leaderboard.md), not this page.
- **This is a draft plan, not a shipped schedule.** Dates, loadouts, and window
  density are hypotheses to tune against real Join volume; treat any date here as
  provisional until the schedule data file exists and is published.

## Open Questions

- **Live-play readiness.** The whole scored calendar assumes the play client can
  host live human tables at the listed hours. Until then the plan is Watch-bot +
  published replays in `preview` status. Confirm client readiness before
  advertising any `CUP` / `FINAL` date.
- **Schedule data file.** `data/play-calendar.yaml` (+ `/play-times/` and
  `/calendar.ics`) is proposed, not built. A future WP owns wiring the source of
  truth and the ICS/deep-link generation.
- **1v1 bracket.** The game is cooperative; a competitive bracket format is out
  of scope unless a later design decision adds one. Nothing here presumes it.
- **`HOST` booking surface.** Whether to build (or clone) a Calendly-style
  booking + Stripe step for office hours is deferred; it would serve only `HOST`.
- **Cancellation semantics.** What happens when a scheduled event is cancelled
  (platform outage, operator unavailable, announced maintenance) — whether it
  affects standing, counts as missed participation, or is simply marked
  `cancelled` — is undefined here. It is an operations decision (a DECISIONS
  entry / the source plan), not a rule this descriptive page may set.
- **Region-expansion threshold.** "A fourth window is not added until two of the
  three regularly fill" is qualitative; the numeric participation trigger that
  would make it enforceable is undefined and would live with Operations.

## References

- [Monetization Model](monetization-model.md) — fairness posture (open play +
  standing free; `HOST` is the only paid, teaching-only event type)
- [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) — organizer-side
  community-funding contract (non-profit, no margin; D-9701)
- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability
  (revenue streams; Non-Goals NG‑1…NG‑7 the calendar stays inside)
- [Scoring](scoring.md) / [Leaderboard](leaderboard.md) — standing and
  championship-qualification math (owned there, not here)
- `C:\pcloud\matches\Core\tournament-calendar-and-play-times.md` — the source
  draft this page is derived from; informed in part by Nate Herk's "own the
  booking layer, don't rent Calendly" framing (2026-08-28,
  `https://www.youtube.com/watch?v=PYjbeY8sGLs`)
</content>
</invoke>
