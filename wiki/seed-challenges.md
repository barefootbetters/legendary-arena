---
title: Seed Challenges
type: System
tags:
  - leaderboard
  - determinism
  - scoring
  - simulation
  - vision
related:
  - leaderboard.md
  - scoring.md
  - par-simulation-calibration.md
  - villain-deck.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\seed-challenges.md (this page — https://ewiki.legendary-arena.com/seed-challenges/)
  - ../docs/ai/DESIGN-SEED-CHALLENGES.md
  - ../docs/ai/DESIGN-RANKING.md
  - ../docs/ai/DECISIONS.md
  - ../docs/01-VISION.md
  - ../packages/game-engine/src/simulation/coopWinRate.ts
  - ../packages/game-engine/src/simulation/ai.competent.ts
  - ../apps/server/src/replay/matchReplay.logic.ts
  - ../apps/server/src/match/matchGate.routes.ts
last-reviewed: 2026-08-04
---

# Seed Challenges

> **Proposed system — not yet built.** This page describes a design captured
> in [`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md). None
> of it exists in `main` yet, and no `WP` or `DECISIONS` entry has been
> ratified. It is documented here (marked `draft`) so the concept is
> discoverable alongside the surfaces it touches. The design decisions live in
> the design doc; this page only describes them.

## Summary

A **seed challenge** is a proposed competitive [Leaderboard](leaderboard.md)
surface on which every entrant plays the **identical deterministic board** —
the challenge fixes both the game setup and the RNG seed, so participants face
the same villain-deck order, card reveals, and draws. Rankings therefore
reflect player decisions rather than board variance.

It reuses the engine's existing determinism and the
verified-[Scoring](scoring.md) pipeline. Before publication, candidate boards
are screened with the same simulation framework used by
[PAR Simulation Calibration](par-simulation-calibration.md), so that only fair,
winnable, and non-trivial boards go live.

## Mechanics

### Shared seed removes board variance

The engine's random events are deterministic and derive from the persisted
match seed (`plugins.random.data.seed`;
[`matchReplay.logic.ts`](../apps/server/src/replay/matchReplay.logic.ts) already
reconstructs a finished match from it). A fixed seed therefore reproduces the
same board, draw order, and reveal sequence across independent matches. A seed
challenge exploits this by publishing a fixed challenge configuration: every
entrant plays an independent match generated from the same definition and so
faces the same board — the board variance a raw leaderboard would otherwise mix
into the ranking is simply absent.

> **A shared seed is not a shared match.** Every entrant receives an
> independent match instance (one `G` per entrant, never shared); the system
> never creates a shared game or a synchronized session between competitors,
> and comparison happens only afterward at the leaderboard layer. This is the
> [`DESIGN-RANKING.md`](../docs/ai/DESIGN-RANKING.md) async-comparison model
> with one extra input (the seed) fixed, and it stays inside the Vision §23(b)
> / D-0005 authorization for asynchronous comparison. It is **not** live or
> shared-match PvP, which remains forbidden.

### A challenge is a loadout plus a seed

A seed alone is not an identity — the same seed under a different
Scheme / Mastermind / villains produces a different puzzle. The design gives a
challenge a formal identity tuple, `(version, playerCount, setupConfig, seed)`,
where `setupConfig` is the full [Scheme](scheme.md), Mastermind, villain and
henchman groups and supply counts, and `version` binds the reproducibility
pins (the immutable `scoringConfigVersion` and the engine determinism version);
see [`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md) §4. How
much of the hero side is pinned is an open fork (see
[Open Questions](#open-questions)): the design recommends a fully-pinned board
(identical decks) for the flagship daily challenge, with a free-hero variant
as an option.

### Daily / weekly / all-time views

The design proposes three time-scoped views over challenge boards: a **daily**
challenge that rotates at a fixed UTC boundary, a **weekly** view that
aggregates the week's daily seeds to reward consistency, and an **all-time**
archive. Each aggregate stays score-based, never volume-based — per D-0005 and
Vision §25, counts of attempts are not valid ranking inputs.

### Seed vetting before publication

A shared seed is only fair if the board is actually winnable, so the design
screens candidates **before** publishing rather than voiding boards after the
fact. A candidate (loadout + seed) is simulated many times with the competent
heuristic policy ([`ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)),
and its outcome distribution
([`coopWinRate.ts`](../packages/game-engine/src/simulation/coopWinRate.ts)'s
`byCategory` separates auto-loss from trivial and inconclusive results). Seeds
that are auto-losses or trivial are discarded; those in a
winnable-but-demanding band are kept. This is the same Monte-Carlo win-rate
machinery [PAR Simulation Calibration](par-simulation-calibration.md) uses,
aimed at a different question.

The design also proposes screening the *opening*: because this engine has no
always-available cheap recruit (`recruitHero` pulls only from the HQ; the
Officer / Sidekick piles are effect-granted), an all-expensive opening HQ can
strand a player. Since the seed fixes the hero-deck shuffle, a candidate can be
screened for an affordable opening HQ (e.g. enough low-cost heroes in the first
few refills) as a *curation* criterion, with no rules change — see
[`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md) §6.

## Interactions

- **[Leaderboard](leaderboard.md).** A seed challenge is a proposed board type
  beside the PAR-scored scenario and gauntlet boards. It reuses the same
  capture → submit → verify → score → snapshot → publish pipeline; the
  difference is that its entrants are grouped by a shared seed and ranked on an
  identical board rather than PAR-normalized across different boards.
- **[Scoring](scoring.md).** A seeded match is scored *identically* to any
  other — the seed changes the board, not the FinalScore formula. Because the
  board is shared, same-seed ranking needs no PAR normalization to be fair
  (the variance PAR corrects is absent).
- **[PAR Simulation Calibration](par-simulation-calibration.md).** Seed
  vetting is the same simulation harness and win-rate method, repurposed from
  "what is a competent score on this scenario?" to "is this one board a good
  contest?".
- **[Villain Deck](villain-deck.md).** The villain-deck order is the largest
  single source of board luck a shared seed pins down — the reveal sequence is
  identical for every entrant on a challenge.

## Edge Cases

- **Challenge identity is the full tuple, not the seed.** Publishing "a seed"
  without fixing the composition, player count, and version pins would let
  entrants play different boards under one label — identity is
  `(version, playerCount, setupConfig, seed)` (design doc §4), never the seed
  alone.
- **Validity depends on the engine and scoring version (determinism
  dependency).** A challenge is reproducible only while the engine replays its
  seed identically and its `scoringConfigVersion` is unchanged. An engine
  change that shifts the deterministic state hash, or a scoring-config change,
  makes a previously published challenge replay or score differently — its
  historical comparability breaks until remediated. A published challenge
  therefore has to bind both versions, as the PAR artifacts already do.
- **The vetting band measures bot competence, not the human ceiling.** The
  win-rate band is a proxy (as PAR's baseline is) — good for filtering
  unwinnable and trivial boards, not a statement about how hard the board is
  for a strong human. It is a tunable calibration parameter, and win rate alone
  does not prove a board is decision-sensitive (design doc §6).
- **A published seed is knowable in advance — verification is the source of
  truth.** Because entrants can learn the seed, integrity rests entirely on the
  existing server-side replay verification: the server re-executes the match,
  recomputes its state hash, and scores server-side, never trusting a
  client-supplied score or board state (D-5301). This is the same trust root
  the PAR-scored boards use; see the competitive-integrity discussion in
  [`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md) §2.
- **Not yet built.** No caller-specified seed exists at match creation today
  (boardgame.io mints a `Date.now()` seed and exposes no create-time seed
  API), `competitive_scores` has no seed column, and there is no curated-seed
  source. See [Open Questions](#open-questions) and the design doc's
  built-vs-missing section.

## Open Questions

Each item is unresolved until the design is drafted for execution; see
[`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md) §9.

- **Board scope** — fully-pinned challenge definitions vs partially-
  configurable (free-hero) definitions for the daily flagship.
- **Weekly aggregation** — sum-of-daily vs best-N-of-seven.
- **Vetting band and trial count** — the target win-rate window, how many
  simulated trials per candidate, and whether to measure decision-sensitivity.
- **Opening-HQ fairness** — screen published seeds for an affordable opening (a
  curation criterion) vs a game-wide setup rule that smooths openings (an
  invented mechanic diverging from physical Legendary); decide after the sim
  quantifies how much opening-HQ cost affects win rate.
- **Ranking model** — direct verified-score comparison (recommended) vs
  per-seed normalization, given the current read layer gates on published PAR.
- **Challenge versioning and expiry** — how a published challenge binds its
  engine/determinism version and `scoringConfigVersion`, and what happens to
  historical boards when either changes.
- **Seed rotation** — how far ahead to vet, rotation cadence, and whether the
  daily seed is announced or a surprise.
- **Plumbing** — the custom random plugin, the create-proxy seed injection
  ([`matchGate.routes.ts`](../apps/server/src/match/matchGate.routes.ts)), the
  additive `seed_key` column, and the curated-seed source, none of which exist
  yet.

## References

- [`DESIGN-SEED-CHALLENGES.md`](../docs/ai/DESIGN-SEED-CHALLENGES.md) — the
  authoritative design this page describes
- [`DESIGN-RANKING.md`](../docs/ai/DESIGN-RANKING.md) — the sibling
  cross-scenario comparison surface
- [DECISIONS.md D-0005](../docs/ai/DECISIONS.md) — Asynchronous PvP Comparison
  Authorized; Live PvP Combat Forbidden
- [`docs/01-VISION.md`](../docs/01-VISION.md) §23–§26 — cooperative model,
  async comparison, quality-normalization
- [Scoring](scoring.md), [Leaderboard](leaderboard.md),
  [PAR Simulation Calibration](par-simulation-calibration.md) — the surfaces
  this system reuses
- [`coopWinRate.ts`](../packages/game-engine/src/simulation/coopWinRate.ts),
  [`ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)
  — the simulation harness seed vetting would reuse
- [`matchReplay.logic.ts`](../apps/server/src/replay/matchReplay.logic.ts) —
  the faithful-replay path that rehydrates a match from its persisted seed
