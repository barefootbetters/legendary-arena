# Ranking & Scoreboard System for Legendary Arena

> **Status:** Design specification — **not yet executable as a Work Packet.**
> Landing this design requires prerequisite infrastructure (persistent
> player identity, run history store, event/tournament model) that does
> not yet exist in the codebase. This document exists to lock the rules
> and data contracts so that once prerequisites land, the system can be
> decomposed into Work Packets against a fixed specification.
>
> **Authority:** This document is subordinate to `docs/ai/ARCHITECTURE.md`
> and `docs/01-VISION.md`. If any rule below conflicts with either, the
> higher authority wins. See §12 Decomposition.
>
> **Vision authorization:** This system is a **§23(b) asynchronous
> competitive-comparison surface**, authorized by Vision §23 and
> Decision **D-0005** (Asynchronous PvP Comparison Authorized; Live PvP
> Combat Forbidden). No part of this system may be read as sanctioning
> real-time or turn-based PvP combat, shared-match play, or
> volume-based ranking. If the spec below appears to permit any of
> those, the spec is wrong and the Vision wins.
>
> **Freeze rule:** No component of this system may be partially
> implemented, mocked, or approximated outside this specification. Any
> implementation must trace directly to an approved Work Packet derived
> from §12.

---

## 1. Executive Summary

This document defines the **Legendary Arena Hybrid Ranking System** — a
seasonal competitive **comparison** model with a permanent all-time
archive.

The system:

- Identifies top-performing players each season via async comparison of
  independently played scenario runs
- Rewards skill, consistency, and breadth of scenario mastery
- Prevents low-effort volume accumulation (farming)
- Maintains long-term prestige through permanent historical records

It is a **projection layer** over the existing scenario-scoring
infrastructure established by WP-048 (PAR Scenario Scoring) and WP-054
(Public Leaderboards). The ranking system does not define per-run
scoring; it aggregates PAR-normalized FinalScores into seasonal views.

The design draws from professional tennis and golf ranking models —
specifically the **"best N events"** structure used by the official
golf world rankings, which rewards quality × breadth rather than sheer
volume.

---

## 2. Terminology (Binding)

Terms in this section are used with precision throughout the document.
Loose or near-synonymous use is a spec violation.

- **Run** — a single, independently played, replay-verifiable game
  execution against a fixed scenario (Scheme + Mastermind + Villains)
  and hero composition. The **competitive primitive**. Players never
  share a run.
- **Qualifying run** — a run that satisfies every criterion in §5.1.
  Only qualifying runs contribute to ranking.
- **FinalScore** — the PAR-normalized per-run score defined by WP-048.
  Lower is better. This ranking system consumes FinalScore; it does
  not compute it.
- **Field** — the distribution of verified, published FinalScores on a
  given scenario at a given point in time. "Strength of field" refers
  to this distribution, never to a specific opponent.
- **Scenario entry** — a player's best FinalScore on a single unique
  scenario, used as one input to the seasonal aggregate.
- **Season** — a fixed calendar-year window (Jan 1 – Dec 31) during
  which qualifying runs may contribute to a live leaderboard.
- **Event** — a declared, time-boxed competitive format with defined
  advancement/finish semantics (Standard or Major). Events contribute
  to ranking as high-weight scenario entries (§6), not as an additive
  point pool.

**Words deliberately not used:** "match" (implies in-game player
interaction), "opponent" (implies synchronous contest), "win/loss"
(implies head-to-head outcome), "head-to-head" (forbidden under §23(b)).

---

## 3. Core Principles

1. **Performance-based** — rankings are earned through verified run
   quality, not reputation, prior-season status, or matchmaking rating.
2. **Quality-normalized** (D-0005 / §25) — seasonal metrics are derived
   from PAR deltas and quality-weighted aggregates. Cumulative counts
   of runs, sessions, or attempts alone are never valid ranking
   inputs.
3. **Breadth-aware** — the aggregate rewards scenario variety within a
   bounded counted-entries window; playing one scenario 100 times
   cannot outrank playing N scenarios well.
4. **Field-aware** — a scenario entry's contribution may be scaled by
   the density and strength of the field on that scenario (§5.4).
5. **Seasonal freshness** — each year is a clean competitive slate.
6. **Immutable history** — seasonal aggregates archive at season end;
   archive records never change in place.
7. **No retroactive adjustment** — scoring rule changes apply
   prospectively only. Past FinalScores are never recomputed.
8. **No volume-based reward** — no rule in this system may be
   redesigned later to reward "how often" a player runs; any such
   proposal is a §25 violation and must be rejected at intake.

**Litmus test for any future proposal:** any proposal that would
cause two players with identical Best-N scenario entries but different
total run counts to rank differently is invalid by definition. If a
proposed rule can produce that outcome, it violates this document and
Vision §25 regardless of how it is framed.

> **Terminology note.** This document uses **"immutable"** and **"no
> retroactive adjustment"** for the property that ranking inputs, once
> published, never change. The term **"determinism"** is reserved in
> this codebase for engine replay determinism (see
> `.claude/rules/architecture.md`) and must not be used for
> ranking-stability properties.

---

## 4. Architectural Placement

### 4.1 Layer Ownership

Ranking data is **persistence-layer state**. It is owned by the Server
layer and must never live in engine state (`G`), which is runtime-only
per `docs/ai/ARCHITECTURE.md` — *Persistence Boundaries*.

```
Game Engine (authoritative, run-scoped, runtime-only)
    |
    |  emits: run-complete event (scenario, hero composition, seed,
    |         run id, final game state, replay handle)
    v
Scenario Scoring Layer (WP-048) — PAR-normalized FinalScore
    |
    |  append-only verified leaderboard entries (WP-054)
    v
Ranking Aggregation Layer (this system) — Best-N projections,
event weighting, season archive
    |
    |  read-only aggregate views
    v
UI Layer (read-only rankings projection)
```

The ranking aggregation layer:

- **May** read replay-verified leaderboard entries from WP-048/054 and
  produce aggregate views
- **May** write aggregate snapshots and archive entries to the
  persistence store
- **Must NOT** write to `G`, `ctx`, or any engine state
- **Must NOT** be consulted by the engine during gameplay
- **Must NOT** influence engine randomness, seeding, or outcomes
- **Must NOT** request or query engine state; all inputs arrive as
  append-only events or verified leaderboard records
- **Must NOT** define or mutate per-run FinalScore; that is WP-048's
  authority

This keeps rankings fully orthogonal to gameplay: a failure in the
ranking layer can never affect run correctness or the scenario
leaderboard surface.

### 4.2 Relationship to Vision Goals

- **§3 (Player Trust & Fairness):** scoring changes apply prospectively
  only (§10.2); Major event status is declared before any run is
  seeded (§6.2).
- **§22 (Deterministic Evaluation):** this layer consumes, never
  recomputes, the per-run FinalScore.
- **§23(b) (Asynchronous PvP Comparison):** this entire system IS the
  §23(b) surface. See D-0005 for authorizing decision.
- **§24 (Replay-Verified Integrity):** only replay-verified runs
  (WP-053 gate) are eligible.
- **§25 (Skill Over Repetition):** aggregates are quality-normalized;
  volume-based inputs forbidden.
- **§26 (Simulation-Calibrated PAR):** PAR baselines are immutable
  inputs; refinements create new versions, never retroactive
  adjustments.

---

## 5. Prerequisites (Must Land Before Execution)

The ranking aggregation layer cannot be built until the following
infrastructure exists. Each is its own future Work Packet or Work
Packet sequence:

| Prerequisite | Why required |
|---|---|
| Persistent player identity (accounts, stable player IDs) | Rankings are per-player over time; ephemeral session IDs are insufficient |
| Run history persistence (run record: player, scenario, hero composition, seed, timestamps, replay handle, classification) | Rankings are derived from historical run outcomes |
| Run classification ("official competitive" vs "exhibition/practice") | Only official runs qualify (§6.1) |
| **WP-048 Scenario Scoring & Leaderboards** — complete and producing `LeaderboardEntry` records with `FinalScore` per run | This layer consumes WP-048 outputs; without it, there is nothing to aggregate |
| **WP-054 Public Leaderboards** — complete, providing the verified, published leaderboard view used as aggregation input | Only WP-054-verified entries are eligible per §6.1 |
| Event / tournament model (event entity, bracket or result linkage, declared event tier) | Events and Majors require a declaration artifact (§7) |
| Admin/operator surface for declaring Major events and resolving disputes | Operational policy requires auditable declarations (§11) |

Until these prerequisites are tracked as WPs in `WORK_INDEX.md` and
completed, the ranking aggregation layer remains a design-only
document.

---

## 6. Scoring Framework (Quality-Normalized, D-0005-Compliant)

> **Design commitment:** This layer does not define per-run scoring.
> Per-run scoring is authoritatively owned by WP-048 (`FinalScore`,
> PAR-normalized, lower is better). This section defines only how
> FinalScores aggregate into seasonal rankings.

### 6.1 Qualifying Runs

A run qualifies for seasonal ranking if **all** of the following are
true:

- Classification is "official competitive" (not exhibition, practice,
  or matchmaking-test)
- The scenario (Scheme + Mastermind + Villains) has a published PAR
  baseline per Vision §26
- The run is replay-verified per Vision §24 and the WP-053 verification
  gate
- The run is published to the WP-054 verified leaderboard (visibility
  `link` or `public` per D-5101 gate)
- The run was seeded within the current season window

Non-qualifying runs are persistable but do not contribute to any
seasonal aggregate. There is no concept of a "non-qualifying run" being
*worth zero* — it simply does not enter the aggregate at all. This
distinction matters: "0 points" implies a ledger entry; non-qualifying
implies no entry.

### 6.2 Per-Run Input

For each qualifying run, the ranking layer reads a single scalar:

- **FinalScore** (from WP-048's `LeaderboardEntry`) — PAR-normalized,
  replay-verified, immutable after publication

No other per-run data is consumed for scoring. Hero composition,
player count, and wallclock time do not enter the aggregate directly;
any effect they have on competitive quality is already folded into
FinalScore via PAR normalization (§26).

### 6.3 Per-Scenario Entry

For each player and each unique scenario they have qualifying runs on,
the layer derives a single **scenario entry**:

- Scenario entry value = the player's **best (lowest) FinalScore** on
  that scenario during the season

A player's repeated runs on the same scenario can only **improve**
their scenario entry for that scenario. They cannot produce additional
independent entries.

> **Why "best on scenario" and not "average on scenario"?** Golf-style
> best-N rankings consistently use best-on-event to reward mastery
> rather than attempt count. Averaging would penalize exploration.

### 6.4 Seasonal Aggregate (Best-N-Scenarios)

A player's seasonal aggregate is computed by:

1. Collecting all of the player's scenario entries (one per unique
   scenario, best-on-scenario)
2. Ranking those entries from best to worst (lowest FinalScore first)
3. Taking the **best N** entries
4. Summing their FinalScore-derived contributions

The value of **N** is a season-level parameter set before the season
begins (Open Question: §14). Once set, N is immutable for that
season per §3 Principle 7.

If a player has fewer than N unique scenario entries, unfilled slots
contribute a **replacement value** representing "no scenario run."

**Replacement-value constraints (all must hold):**

- Must be strictly **worse** than typical qualifying scenario entries
  for the season (design target: strictly worse than the 95th-percentile
  observed FinalScore across all qualifying entries; the exact formula
  is an Open Question in §14).
- Must never be zero, null, or any value that would treat empty slots
  as neutral. "Null as neutral" and "empty slots don't hurt you" are
  explicit failure modes this clause forbids.
- Must ensure that adding a new qualifying scenario can only improve
  aggregate position, never worsen it.
- Must ensure that a player with N qualifying scenario entries always
  outranks an otherwise-identical player with fewer than N, rewarding
  breadth per §3 Principle 3.

> **Why Best-N over cumulative sum?** Cumulative sum is D-0005-forbidden
> (volume-based). Best-N forces breadth × quality: the only ways to
> improve the aggregate are to (a) play new scenarios well, or (b)
> improve a counted scenario's best entry. Playing the same scenario
> 100 times can only affect one slot.

**Explicit prohibition.** No seasonal aggregate may be defined as a
simple sum, average, or time-series accumulation over all qualifying
runs. Any aggregate that monotonically increases with the count of
runs attempted is D-0005-forbidden and invalid by definition, even
if individual inputs are quality-normalized. The Best-N structure is
the only sanctioned aggregation pattern in this document.

### 6.5 Strength-of-Field Weighting (Optional Multiplier)

A scenario entry's contribution to the aggregate may be scaled by a
**field-strength factor** reflecting the density and quality of
verified submissions on that scenario. Sparse-field scenarios carry
less aggregate weight; dense-field scenarios with strong competition
carry more.

The specific field-strength formula is an Open Question (§14), but it
must satisfy:

- **Not volume-rewarding.** More of the *same player's* submissions on
  a scenario must not increase its field strength.
- **Snapshot at season end only.** Field strength is computed once, at
  season archive time, and may not be recomputed earlier,
  incrementally, mid-season, or retroactively. Live-updating field
  strength is a forbidden pattern because it creates instability in
  live rankings and operational pressure to "update multipliers
  weekly."
- **Bounded.** The multiplier must have a ceiling (e.g., 1.0× to
  1.5×) so a single heavily-played scenario cannot dominate the
  aggregate.

> **Why a multiplier, not an additive bonus?** Additive bonuses
> tempt volume gaming ("stack small bonuses"). A bounded multiplier on
> an already-quality-normalized score preserves the quality-first
> character of the aggregate.

---

## 7. Event-Based Contributions

Events are declared, time-boxed competitive formats. Their role in the
aggregate is to contribute **high-weight scenario entries**, not a
parallel additive point pool.

**Slot-consumption invariant.** Event contributions always consume
scenario-entry slots within the Best-N aggregate (§6.4). Events never
add independent slots, never increase N, and never sit alongside
Best-N as a separate additive pool. If an event finish would otherwise
displace a lower-ranked scenario entry, the event entry takes the
slot; the displaced entry falls out of the counted subset. This
invariant prevents events from quietly re-introducing volume effects
into the aggregate.

### 7.1 Standard Events

A Standard Event is an organized competition with brackets or defined
advancement rules. A player's event finish (Champion, Runner-up,
Semi-finalist) contributes to their seasonal aggregate as:

- **Champion** — contributes as a **floor-capped scenario entry**
  (equivalent to a top-percentile FinalScore on the event scenario,
  regardless of the raw FinalScore recorded)
- **Runner-up** — contributes as a lower floor-capped entry
- **Semi-finalist** — contributes as a qualifying entry with no floor

Specific floor-cap values and the percentile mapping are Open Questions
(§14). The framework is fixed; the parameters are not.

> **Why floor-caps instead of raw FinalScore?** An event run may
> produce a FinalScore that under-represents competitive accomplishment
> (e.g., winning a Major with a merely-decent score). Floor-capping
> rewards the finish, not the raw score, while staying on the
> quality-normalized substrate.

### 7.2 Major Legendary Arena Events

Major events are rare, high-prestige competitions. Their floor-cap
contributions are substantially stronger than Standard Events (design
target: Major Champion contribution ≈ top-1% scenario entry).

**Declaration requirements:**

- Major status must be declared by an authorized operator **before the
  event's first run is seeded**.
- The declaration is recorded as an immutable event record with
  timestamp, declaring operator, and operator authentication trail.
- Major status cannot be changed after declaration — neither promoted
  from Standard to Major, nor demoted from Major to Standard.
- The number of Majors per season should be limited (design target:
  2–4 per year) to preserve prestige. The exact cap is an operational
  policy decision, not a system rule (§11).
- A season in which *every* event is declared a Major is invalid and
  must be rejected at declaration time. This closes an operator-abuse
  vector without requiring a numeric cap in the system itself.

> **Why declaration-before-seeding?** Aligns with the field-strength
> snapshot anchor — both ranking-affecting properties of the run are
> frozen at the same deterministic moment.

---

## 8. Anti-Farming & Integrity Controls

Best-N aggregation (§6.4) structurally eliminates most farming vectors:
you cannot improve your aggregate by running a single scenario
repeatedly. The controls in this section close the remaining gaps.

### 8.1 Hard rules (system-enforced)

- **No contribution for exhibition/practice runs** (§6.1).
- **Automated or scripted run generation is prohibited.** Detection
  and enforcement is an operational concern; the ranking layer records
  flags but does not perform detection itself.
- **Scenario re-submission decay (optional field-strength guard):**
  if the field-strength multiplier (§6.5) is implemented, a single
  player's Nth submission on the same scenario within a rolling
  7-day window does not contribute to that scenario's field-strength
  count. The best-on-scenario entry (§6.3) is unaffected — a player
  can always improve their scenario entry — but cannot thereby inflate
  field-strength for themselves.
- **Scenario identity** is defined by the canonical scenario key
  (Scheme + Mastermind + Villain groups), never by display name or UI
  label.
- **Player identity** for all ranking purposes is the stable player
  ID, never display name, account alias, handle, or session
  identifier. This forecloses the class of exploits based on cosmetic
  identity changes.

> **Why the decay only touches field-strength, not the scenario
> entry?** Best-on-scenario (§6.3) naturally caps any single player's
> contribution from one scenario. The only vector left is inflating
> the *field* on that scenario via their own submissions, which the
> decay closes.

### 8.2 Open questions (deferred to operational policy)

The following are intentionally not specified here; they are
administrative policies to be set once live player behavior is
observable:

- Thresholds for flagging automated play
- Dispute-resolution timelines
- Whether the §8.1 scenario re-submission decay is needed at all
  (it may be redundant once §6.4 Best-N and §6.5 bounded multiplier
  are in place; a season of live data will tell)

---

## 9. Rankings & Resolution Rules

### 9.1 Live Season Rankings

At all times during the season, players are ranked by their current
**seasonal aggregate** (§6.4), lowest first (lower FinalScore sum is
better — consistent with PAR-normalized scoring).

The live aggregate is a **projection**, not a ledger. It is
recomputed from the current set of qualifying runs; it is not
accumulated. Adding a new qualifying run may improve a player's
aggregate; it never decreases any other player's aggregate directly.

### 9.2 Tie-Break Order

Applied sequentially until the tie is resolved:

1. **Common-scenario comparison** — across every scenario on which
   both tied players have qualifying entries, count how many each
   player leads (has the better FinalScore). The player with more
   leads wins the tie. If scenario counts differ, only the
   intersection is compared.
2. **Major event performance** — highest Major finish beats lower;
   ties broken by count at that finish level.
3. **Number of unique qualifying scenarios** — more scenario breadth
   wins (rewards §3 Principle 3: breadth-aware).
4. **Best single-scenario FinalScore** across the player's counted
   entries — lower wins.
5. **Account creation timestamp** — earlier account ranks higher.

> **Why no "head-to-head"?** Under §23(b), players do not play against
> each other. There is no head-to-head to appeal to. Common-scenario
> comparison (tie-break 1) is the async-correct equivalent: it asks
> "on the scenarios where both players competed, who more often
> produced the better run?"
>
> **Why a timestamp fallback?** The final tie-break must satisfy four
> properties simultaneously: **(a) deterministic** — same inputs, same
> result; **(b) non-skill-based** — skill criteria are exhausted by
> tie-breaks 1–4; **(c) non-gameable after the fact** — cannot be
> manipulated once the season is in progress; **(d) total-ordering** —
> guarantees termination. Account creation timestamp satisfies all
> four while having no relationship to competitive performance.

If two players share an account-creation second (astronomically
unlikely), they share the rank position; subsequent positions are
skipped (standard competitive ranking convention).

---

## 10. Year-End Honors & Legendary Archive

### 10.1 Year-End Honors

At the conclusion of each season:

- **Player of the Year** — final #1 ranking
- **Season Runner-Up** — final #2 ranking
- **Third Place** — final #3 ranking
- **Top 10 Finalists** — permanent record of the year's top 10

These honors are written to the Legendary Archive (§10.2) at season
end and are immutable thereafter.

### 10.2 Legendary Archive

The Legendary Archive is permanent and never reset. It records:

- Final seasonal rankings by year (full top-archive-N; exact size per
  §14)
- Champions and finalists of all Standard and Major events
- Player of the Year recipients
- Total Major titles per player
- Notable streaks and milestones (exact milestone set TBD during
  implementation)

Archive records are append-only. Correction of clerical errors (e.g.,
wrong name spelling) is permitted via an explicit amendment record
that preserves the original entry — never by silent edit.

**Archive immutability invariant:** Any mutation of an archive record
must produce a new record with a new identifier. No storage or
persistence mechanism may permit in-place edit of an existing archive
identifier. This invariant is enforced by the data-model WP in §13,
not by social policy.

---

## 11. Operational Policy

> **Scope note.** "Operational Policy" covers *player-facing competitive
> rules and their administration*. It is distinct from **project
> governance**, which refers to the authority hierarchy in
> `.claude/rules/architecture.md` (ARCHITECTURE.md → VISION.md →
> rules → WPs). Conflating the two has caused confusion in prior drafts.

### 11.1 Transparency

- All ranking rules must be publicly documented and versioned.
- Current aggregation parameters (N, field-strength formula, event
  floor-caps), tie-break order, and decay rules must be viewable by
  any player.

### 11.2 Change Control

- Scoring rule changes apply **prospectively only** from a published
  effective date.
- No retroactive recomputation of past FinalScores or past aggregates
  is ever permitted.
- Rule changes must be announced before their effective date.
  - **Minimum notice:** non-zero. A change is never permitted to take
    effect at or before the moment of its announcement.
  - **Design target:** ≥7 days' notice. Operational policy may refine
    the target but may never reduce the minimum below non-zero.

### 11.3 Dispute Resolution

- Disputes are resolved by authorized Legendary Arena operators.
- Dispute outcomes that alter an archived record must be written as
  amendments (§10.2), never as silent edits.
- Competitive integrity and transparency take precedence over
  convenience or appeal.

---

## 12. Out of Scope (Non-Blocking Future Work)

Compatible with but explicitly not part of initial launch:

- Hidden Elo-style rating for matchmaking (separate from public
  ranking; no crossover)
- "Most Improved Player" seasonal award
- Rookie of the Year recognition
- Hall of Legends (retired elite players)
- Team, faction, or cooperative co-op rankings (if introduced)
- Cross-season rolling averages (tennis-style 52-week system)

Each would be its own design delta, not an amendment to this document.

**Explicitly forbidden forever** (per D-0005): any form of real-time
or turn-based PvP combat, shared-match play, or volume-based ranking.
These are not "out of scope for now" — they are vision-level prohibited.

---

## 13. Decomposition Into Work Packets

Once prerequisites (§5) land, this design is expected to decompose
into the following WP sequence. Exact WP numbers and splits will be
assigned when they enter `WORK_INDEX.md`:

1. **Ranking aggregation data model** — season, scenario-entry,
   seasonal-aggregate, archive-entry schemas and validators; no
   scoring logic. Depends on WP-048/054 leaderboard contracts.
2. **Aggregation engine** — Best-N-Scenarios computation, field-strength
   weighting, qualifying-run filtering. Pure functions over
   replay-verified leaderboard entries.
3. **Event & Major declaration surface** — operator-facing declaration
   workflow with immutable audit trail.
4. **Event contribution integration** — floor-capped event entries
   layered into the aggregate.
5. **Live rankings projection** — read-only query surface for UI.
6. **Season reset & Legendary Archive** — end-of-season workflow and
   archive write.
7. **Operational policy surfaces** — admin tooling for disputes,
   flags, parameter publication.

Each WP must independently satisfy:

- Layer boundary rules (`.claude/rules/architecture.md`)
- Prompt Lint Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)
- Canonical WP template (`docs/ai/REFERENCE/00.1-*`)
- Vision Alignment block citing §23(b), §24, §25, §26 and D-0005

No WP in this sequence may be started before its predecessors in the
list land — each builds directly on the prior's contracts.

**No-retro-spec clause:** Once a WP derived from this specification is
accepted, this document must not be amended to accommodate that WP.
If implementation reveals a gap, the resolution is a new design delta
document with its own authority chain — never a silent edit to this
spec. This protects the specification from being "fixed" after
implementation errors.

---

## 14. Open Questions

Tracked here so they are not lost between now and implementation.
Each must be resolved (with a DECISIONS.md entry) before its
corresponding WP is ready for execution.

- **Best-N value (N)** — how many scenario entries count toward the
  aggregate? Design target: 10. Range to evaluate: 6–15. Affects WP-2.
- **Replacement value** — what does an unfilled slot contribute?
  Options: "worst observed FinalScore in the field × some factor,"
  fixed penalty, or null-with-minimum-slot-count requirement.
  Affects WP-2.
- **Field-strength formula** — specific bounded multiplier formula.
  Must satisfy §6.5 constraints (not volume-rewarding, snapshot at
  season end, bounded ceiling). Affects WP-2.
- **Event floor-cap values** — percentile mapping for Standard and
  Major Champion / Runner-up / Semi-finalist contributions.
  Affects WP-4.
- **Archive top-N size** — 10? 25? 100? (design target: 10 for named
  honors, 100 for archive listing.) Affects WP-6.
- **Major event cap per season** — 2? 3? 4? (design target: 2–4.)
  Affects WP-3.
- **Rule-change notice window** — 7 days? 14 days? 30 days?
  Affects WP-7.
- **Scenario re-submission decay necessity** — is §8.1's decay
  actually needed, or is it redundant given §6.4 Best-N +
  §6.5 bounded multiplier? Resolvable only with a live-data season.
- **Retirement / inactive-player handling** — do long-inactive players
  appear in live rankings with stale aggregates, or decay off?
  (current design: no decay — seasonal reset handles this naturally,
  since inactive players earn no new entries and drop in relative
  rank.)
- ~~**Tiebreak tie-three definition**~~ — **Resolved (recommended):**
  tie-break #3 counts **total unique qualifying scenarios** with at
  least one scenario entry (§6.3), not only the Best-N counted subset.
  Rationale: scenarios are a finite, content-bounded set, so counting
  them is breadth-based, not volume-based; rewarding exploration is
  vision-aligned with §3 Principle 3; and cherry-picking the counted
  subset could otherwise be gamed by a player who plays exactly N
  scenarios extremely well. May be overturned by a DECISIONS.md entry
  before the governing WP executes.

---

*Play well. Place high. Go legendary.*
