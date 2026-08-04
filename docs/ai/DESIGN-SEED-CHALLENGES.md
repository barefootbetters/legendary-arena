# Seed Challenges (Shared-Seed Fairness) for Legendary Arena

> **Status:** Design specification — **not yet executable as a Work Packet.**
> This document captures a design worked out in an operator session
> (2026-08-04). It locks the concept and the data/behaviour shape so a future
> drafting session can decompose it into Work Packets against a fixed
> specification. Landing it requires new plumbing (a caller-specified match
> seed, a persisted seed identity, a curated-seed source) that does not exist
> in the codebase yet.
>
> **Authority:** Subordinate to `docs/ai/ARCHITECTURE.md` and
> `docs/01-VISION.md`. If any statement below conflicts with either, the
> higher authority wins. This document **makes no ratified decisions** and
> reserves **no** `D-NNNN` or `WP-NNN` numbers — those are allocated when the
> feature is drafted for execution.
>
> **Vision authorization:** A seed challenge is a **§23(b) asynchronous
> competitive-comparison surface** authorized by Vision §23 and Decision
> **D-0005** (Asynchronous PvP Comparison Authorized; Live PvP Combat
> Forbidden). A **shared seed is not a shared match** — see §2. Players still
> never share game state or act inside each other's matches; competition
> exists only at the aggregate/after-the-fact layer. If anything below reads
> as sanctioning real-time, turn-based, or shared-match play, the reading is
> wrong and the Vision wins.
>
> **Relationship to `docs/ai/DESIGN-RANKING.md`:** that design aggregates
> PAR-normalized scores *across different scenarios* (breadth of mastery).
> This design ranks *identical-board* runs against each other (depth of
> decision skill on one puzzle). They are sibling comparison surfaces under
> the same D-0005 authority, not substitutes.

---

## 1. Executive Summary

A raw leaderboard partly ranks the shuffle, not the player. Because each
match today draws its own random board, one lucky villain-deck order can
flatter a weak player and one cruel order can sink a strong one. A **seed
challenge** removes that variance: every entrant plays the **identical seeded
board** — same villain-deck order, same setup, same draws and reshuffles — so
the only thing that varies between entrants is their decisions. The
leaderboard for that challenge is then a clean measurement of play skill.

The design has three parts:

1. **Shared-seed play** — publish a challenge as a fully-pinned board *plus a
   fixed seed*; everyone who plays it solves the same puzzle.
2. **Daily / weekly / all-time boards** — a fresh challenge each day (midnight
   reset), a weekly view that rewards consistency across the week's seeds, and
   an all-time archive.
3. **Seed vetting** — before a seed is published, a simulation plays it many
   times and measures the win rate; only seeds that are *winnable but
   demanding* (a target band, roughly 40–60% for the calibration bot) are
   published. Auto-loss (~0%) and trivial (~100%) seeds are discarded
   **upfront**, so no challenge ever needs to be voided after the fact.

The determinism foundation this depends on already exists and is total: all
randomness routes through `ctx.random.*`, and the replay pipeline already
reconstructs a finished match from its persisted seed. A fixed seed fully
reproduces a board *today*. What is missing is the ability to *choose* the
seed at match creation, a place to record which seed a score was played on,
and the curation + board machinery on top. §7 maps built-vs-missing in detail.

---

## 2. Why "shared seed" ≠ "shared match" (read this first)

This distinction is load-bearing for governance and for anyone implementing
the feature.

- A **shared match** would mean two players acting inside one game state — a
  single `G`, turns interleaved. That is live/shared PvP and is **forbidden**
  (Vision §23, D-0005: "Players never share game state or act inside each
  other's matches").
- A **shared seed** means each entrant plays their **own independent match**
  that merely happens to be seeded identically. There is one `G` per entrant,
  never shared. The seed is an *input to setup*, not a channel between
  players. Comparison happens only afterward, at the leaderboard layer, over
  independently played, replay-verified runs — exactly the D-0005 shape.

So a seed challenge is the *same* async-comparison model as
`DESIGN-RANKING.md`; it just fixes one more input (the seed) so the compared
runs share a board. Everything D-0005 requires still holds: no shared state,
quality-normalized ranking (§25 — a seed board ranks by FinalScore, never by
volume of attempts), replay-verified inputs (§24).

---

## 3. Terminology (binding within this document)

- **Seed** — the PRNG seed that determines every shuffle and draw in a match.
  Today it is `plugins.random.data.seed`, minted by boardgame.io as a
  `Date.now()` string at match creation (§7).
- **Challenge** — a **published, fully-pinned board** *plus* a fixed seed. A
  seed alone is not a challenge (see §4): the same seed produces a different
  puzzle under a different loadout, so the loadout must be pinned too.
- **Challenge board** — the leaderboard for one challenge: all entrants who
  played that challenge, ranked by FinalScore (lower is better).
- **Daily / weekly / all-time** — time-scoped views over challenge boards
  (§5).
- **Vetting** — the pre-publication simulation that decides whether a
  candidate (loadout + seed) is fit to become a challenge (§6).
- **Calibration bot** — the competent heuristic AI policy used for vetting
  (`ai.competent.ts`), the same policy family PAR calibration uses.

---

## 4. What a challenge actually is

A seed only means something **paired with a pinned loadout**. The same seed
under Dr. Doom / Midtown Bank Robbery is a completely different board than
under Magneto / Legacy Virus. So a challenge pins the full composition and
the seed together:

- Scheme, Mastermind, villain groups, henchman groups, and the supply-stack
  counts (bystanders / wounds / officers / sidekicks) — the locked 9-field
  `MatchSetupConfig` composition.
- Player count (a 1-player board and a 3-player board seeded the same are
  still different puzzles — they draw different setup counts).
- The seed.

### The hero question (a genuine design fork)

How much of the *hero* side a challenge pins is a real choice, because it
changes what skill the board measures:

- **Fully-pinned (including heroes).** Everyone plays the identical deck from
  the identical opening. This is the *purest* fairness — two entrants differ
  only in the moves they choose. Recommended for the flagship **daily
  challenge**, because "same puzzle, best solver wins" is the whole pitch.
- **Scenario + seed pinned, heroes free.** The adversary board is identical,
  but each entrant brings their own hero team. This also tests deck
  construction, not just in-match decisions. It is a legitimate *variant*
  board, but it reintroduces a source of variance (team choice) that the
  daily challenge is specifically trying to strip out.

**Recommendation:** fully-pinned for the daily flagship; offer the
free-hero variant as a separate, clearly-labelled board if desired. This
mirrors the existing open-vs-fixed division split on the gauntlet boards
(`DESIGN-RANKING.md` / gauntlet fixed-hero-pool division) — same instinct,
one notch stricter.

---

## 5. Board structure — daily / weekly / all-time

Three time-scoped views, all built on challenge boards:

- **Daily.** One published challenge per day; its board resets/rotates at a
  fixed UTC boundary (midnight). The engagement engine: a fresh identical
  puzzle every day that friends race head-to-head. Come-back-daily is the
  retention driver, and a daily board where everyone faced the same cards is
  the most defensible "who's actually best today" surface the game can offer.
- **Weekly.** An aggregate over the week's daily seeds that **rewards
  consistency** — e.g. the sum (or best-N) of an entrant's daily FinalScores
  across the seven seeds. This must stay **quality-normalized** (D-0005 / §25):
  it aggregates *scores*, never *counts of attempts*. "Played all seven" is
  not a ranking input; "how well you played all seven" is.
- **All-time.** A cumulative archive of challenge performance — the long
  climb for serious competitors, again score-based, never volume-based.

Each tier is legitimate **because** its inputs are same-seed: a daily board
compares identical boards directly; the weekly compares seven identical-board
results per entrant; the all-time is the archive of those. No PAR
normalization is *required* to make same-seed comparison fair (that is the
point — the board variance PAR exists to correct is simply absent). See §6 for
why PAR still matters for *vetting*, and §7(d) for the read-path implication.

---

## 6. Seed vetting — publish only fit seeds

A shared seed is only fair if the board is actually winnable. A seed rigged by
the shuffle into an auto-loss fails everyone equally, but it is a terrible
challenge; a trivial seed is a non-contest. Both are filtered **before
publication**, not voided after:

1. **Simulate the candidate.** Play the (loadout + seed) many times with the
   calibration bot and record the outcome distribution.
2. **Measure the win rate** and the failure modes. Discard seeds that are
   auto-losses (~0% — often a turn-0 scheme-loss board), discard trivial seeds
   (~100%), and **keep the middle band** (target roughly 40–60% for the
   calibration policy — the exact band is a tuning parameter, not a locked
   value).
3. **Publish from the curated pool only.** A challenge is drawn from vetted
   seeds, so every live board is provably beatable and worth playing.

This is deliberately the **same machinery** as PAR simulation calibration
(`par-simulation-calibration.md`) — Monte-Carlo win-rate over the sim harness
with the competent heuristic policy — aimed at a different question ("is this
one board a good contest?" vs "what is a competent score on this scenario?").

**Caveat to record honestly:** the win-rate band measures the *bot's*
competence on the board, which is a proxy for human difficulty, exactly as
PAR's 55th-percentile baseline is. It is a good filter for "unwinnable" and
"trivial"; it is not a claim about the human skill ceiling. Calibrate the band
against the chosen bot policy and treat it as tunable.

---

## 7. What's built vs. what's missing

The load-bearing section for whoever drafts the WPs. Grounded in the current
code seams.

### Built and reusable (do not rebuild)

- **Total determinism.** Every shuffle/draw routes through `ctx.random.*`
  (setup shuffles in `packages/game-engine/src/setup/*`, villain/mastermind
  setup, per-turn draws and reshuffles). A fixed seed fully determines the
  board; this is an existing invariant with drift tests.
- **Replay rehydrates from the seed.** The faithful-replay pipeline
  (`apps/server/src/replay/matchReplay.logic.ts`) reconstructs a finished
  match by re-executing its persisted `initialState + log` — which carries
  `plugins.random.data.seed` — through boardgame.io's own reducer.
- **The verified-scoring → row → snapshot → board pipeline.**
  `competition.logic.ts` (submit-by-matchId, replay verify, server-side
  score), `leaderboards/leaderboard.logic.ts` (public read layer),
  `legends/legends.publisher.ts` (R2 snapshot publisher), and the
  `apps/legends-board` SPA. A seed board consumes the *same* FinalScore.
- **The simulation harness.** `packages/game-engine/src/simulation/` —
  `runCoopWinRate` / `runSimulation`, the competent heuristic policy
  (`ai.competent.ts`), and `coopOutcome.ts`'s `byCategory` breakdown (which
  already separates turn-0 auto-loss from inconclusive/trivial). This is ~80%
  of the vetting tool.

### Missing (the actual build)

a. **Caller-specified seed at match creation.** boardgame.io 0.50.2 has *no*
   create-time seed API — the seed comes only from the static `game.seed`
   property or the `Date.now()` default. The clean approach is a **custom
   random plugin** replacing boardgame.io's `RandomPlugin`, whose `setup`
   reads the seed from the match's `setupData` (which *is* threaded into
   `InitializeGame`) instead of `game.seed`. The seed rides on the
   match-setup **envelope** *alongside* the locked 9-field composition (the
   9-field composition lock is not touched), and is injected at the create
   proxy (`apps/server/src/match/matchGate.routes.ts`). The seed is also
   currently stripped from `playerView` and must be surfaced for verification.

b. **A persisted seed identity.** `competitive_scores` has no seed column.
   Add a `seed_key` (additive, nullable, derived server-side at submission
   from the reduced final state — the same pattern as the `team_key` /
   `outcome` / `player_count` additive columns). This is what lets scores be
   grouped into a challenge board.

c. **Time-window grouping.** Every current leaderboard query is all-time
   (orders by `final_score ASC, created_at ASC`, no time predicate). Daily /
   weekly views need `created_at` (or a challenge-date) bucketing plus
   board-name conventions in the publisher/manifest.

d. **A PAR-free (or seed-PAR) ranking path.** Same-seed head-to-head does not
   *need* PAR — the board variance PAR corrects is absent. But the current
   read layer hard-gates on `checkParPublished`, so a seed board needs either
   a PAR-free ranking path or per-seed PAR entries.

e. **A curated-seed source.** There is no notion of "today's seed" anywhere —
   no generator, schedule, or vetted pool. Entirely greenfield.

f. **A vetting harness entry.** To play *one* seed N times you hold the setup
   seed fixed and vary the *bot decision seed* across trials (clean under the
   two-domain seed design — shuffle seed and decision seed are separate). No
   current wrapper exposes that combination; it is a small new harness on top
   of `simulateOneCoopGame` / `runCoopWinRate`, plus the band filter.

---

## 8. Deferred: rough slice ordering (non-binding)

Not Work Packets — a sketch of buildable order for the future drafting
session. Numbers, decisions, and dependencies are allocated then.

1. **Seed-injection plumbing** — custom random plugin + create-proxy wiring +
   surface the seed for verification.
2. **Seed persistence** — `seed_key` additive column + derive at submission.
3. **Vetting harness + curated pool** — fixed-setup-seed/varying-decision-seed
   runner, band filter, a stored vetted-seed pool.
4. **Daily/weekly/all-time boards** — seed-scoped read/aggregation, PAR-free
   ranking path, publisher board-name conventions, seed-rotation source.
5. **Client challenge UI** — surface today's challenge, launch a seeded match,
   render the challenge board (the `WeeklyPanel.vue` shell already exists).

---

## 9. Open design questions

- **Hero pinning for the daily flagship** — fully-pinned vs scenario+seed
  (recommended fully-pinned in §4; confirm at draft time).
- **Weekly aggregation function** — sum-of-daily vs best-N-of-seven; both are
  quality-normalized, they reward slightly different consistency profiles.
- **Vetting band + trial count** — the 40–60% target and how many trials per
  candidate; tune against the chosen bot policy.
- **PAR-free vs seed-PAR ranking** (§7d) — cheapest correct read path.
- **Seed-rotation cadence and pool refill** — how far ahead to vet, how to
  rotate, and whether daily seeds are announced or surprise.
- **Anti-cheat surface** — a published seed is knowable in advance; confirm
  the replay-verification path (which already re-executes server-side and
  never trusts a client number) is sufficient, or whether same-seed play
  needs any additional guard.

---

## References

- `docs/01-VISION.md` §23–§26 — cooperative model; §23(b) async comparison;
  §25 quality-normalization (no volume-based ranking)
- `docs/ai/DECISIONS.md` D-0005 — Asynchronous PvP Comparison Authorized;
  Live PvP Combat Forbidden (the authority for any comparison surface)
- `docs/ai/DESIGN-RANKING.md` — sibling comparison surface (cross-scenario
  breadth); this document is the same model with the seed fixed
- `docs/12-SCORING-REFERENCE.md` + `docs/ai/ARCHITECTURE.md` — the FinalScore
  a seed board consumes; the persistence boundary a `seed_key` column lives in
- `packages/game-engine/src/simulation/` — the vetting harness
  (`runCoopWinRate`, `ai.competent.ts`, `coopOutcome.ts`)
- `apps/server/src/replay/matchReplay.logic.ts`,
  `apps/server/src/competition/competition.logic.ts`,
  `apps/server/src/leaderboards/leaderboard.logic.ts`,
  `apps/server/src/legends/legends.publisher.ts` — the scoring→board pipeline
- `apps/server/src/match/matchGate.routes.ts` — the create proxy where a seed
  would be injected
- `wiki/seed-challenges.md` — the descriptive ewiki companion to this design
