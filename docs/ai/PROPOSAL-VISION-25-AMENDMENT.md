# PROPOSAL — VISION §25 Amendment: Recognize Seasoned Players (Anti-Bot, Not Anti-Veteran)

**Status:** ✅ **RATIFIED 2026-04-26** — applied to live docs:
- VISION.md §25 replaced with revised text (§2 of this proposal)
- DECISIONS.md: D-0006 inserted, D-0005 clarifying note appended
- DECISIONS_INDEX.md: D-0005 + D-0006 added to Meta-Principles table
- WORK_INDEX.md WP-105 placeholder updated to reference D-0006
- PROPOSAL-BADGES.md updated per §6.3 (Tier 1 expanded to 10 badges; schema includes `qualifying_window_start`)

This file is retained as the historical proposal record. Do not edit the proposal text below; raise a new proposal if revisiting.

---

**Date:** 2026-04-26
**Amends:** `docs/01-VISION.md` §25 ("Skill Over Repetition")
**Related amendment precedent:** D-0005 (which similarly amended §23 by adding a clarifying decision rather than rewriting prose only)
**Affects:** `DECISIONS.md` (new D-0006 + clarifying note on D-0005); `docs/ai/PROPOSAL-BADGES.md` §2 + §3 (Tier 1 expands to include Veteran badges); `docs/ai/DESIGN-RANKING.md` (no change — rankings still volume-forbidden)

---

## 1. Why this amendment

The directive driving this amendment, recorded verbatim:

> *"Revise the vision, must pay respect and reward and encourage seasoned players, they have invested huge amount of time in the game and will be recognized. The how long or how often is to discourage someone writing bots to gamify the system."*

§25's current language reads naturally as anti-veteran when it was written as anti-bot. The clause text *"never how long or how often it was played"* was crafted to forbid grind-as-ranking-input — a real risk during the DESIGN-RANKING.md draft that triggered D-0005. The same words, read literally, also forbid recognizing the long-time community member who has played well across hundreds of scenarios over multiple years. That second reading is unintended and contrary to the project's growth posture: seasoned players are exactly the constituency Legendary Arena wants to honor.

The fix is to make the anti-bot purpose **explicit** in the clause, then **narrow the prohibition to ranking inputs** while opening a **bot-resistant recognition path** for non-ranking honors (badges, profile milestones, veteran tiers). The existing carve-out already gestures at this distinction but is too narrow because it explicitly excludes title-awarding. Veteran badges *are* title-awarding by construction; they need first-class authorization, not a side-door.

Bot-resistance is the new discriminator. A criterion is permitted if a script optimizing for it would still have to produce a long, distributed history of high-quality play that materially benefits the community. A criterion is forbidden if it can be satisfied by repetitive low-quality play or by a single binge.

---

## 2. Revised §25 (drop-in text)

> Replaces `docs/01-VISION.md` §25 in its entirety. Numbering and surrounding sections unchanged. Mark the change with a footnote pointer to D-0006 (drafted in §3 below) the same way §23(b) carries `See D-0005 for the decision record authorizing surface (b).`

```
#### 25. Skill Over Repetition (Anti-Bot, Not Anti-Veteran)

This system exists to:
- Reward strategic mastery
- Expose meaningful differences in player decision-making
- Encourage experimentation with hero teams and approaches
- Honor seasoned players whose sustained, high-quality play has
  contributed to Legendary Arena over months and years

It must never reward:
- Bot scripts, automation, or alt-account farming
- Repetitive low-quality play of the same scenario for cumulative-count credit
- Exploit-driven optimization

The intent of this clause is anti-bot and anti-farm, not anti-veteran.
A player who has invested years in Legendary Arena and accumulated
demonstrably high-quality play across many scenarios is exactly the
kind of player this system exists to recognize. The language *"how
long or how often"* below targets bots gamifying the system, not the
veteran whose long history of skilled play is itself the achievement.

Legendary Arena measures **how well** a game was played as the
primary axis. **Sustained quality over time** is recognized as a
secondary axis when — and only when — every contributing run has
independently met a quality floor.

This applies to every competitive surface, including §23(b)
asynchronous comparison, under three distinct rules:

(a) Rankings — volume input forbidden. Seasonal ladders, year-end
    honors, archive standings, and any other competitive ranking
    surface MUST use quality-normalized inputs only — best-N-runs,
    average PAR delta, per-attempt efficiency, or equivalent.
    Cumulative counts of wins, sessions, or attempts alone are
    NOT valid ranking inputs. (This rule is unchanged from the
    pre-amendment §25 and is reinforced by D-0005.)

(b) Recognition — volume permitted under bot-resistance constraints.
    Veteran-recognition badges, profile milestones, and similar
    non-competitive honors MAY count qualifying runs, provided ALL
    of the following hold:

    - **Quality floor.** Each contributing run independently passes
      a quality predicate (e.g., sub-PAR final score, zero villain
      escapes, zero Master Strikes resolved, all bystanders rescued,
      or a scenario-specific equivalent declared in the badge's
      criteria). Runs that fail the floor do not count toward the
      threshold.
    - **Distinct-scenario breadth.** Thresholds are stated in
      distinct `ScenarioKey`s (per parScoring.types.ts), not in
      repeats of the same scenario. The same scenario beaten 1,000
      times advances the badge by exactly one.
    - **Real-time elapsed window.** The badge is issued only after a
      stated minimum wall-clock window has passed since the player's
      first qualifying run. A binge-in-a-day cannot satisfy a
      veteran badge regardless of run count.
    - **No feed into rankings.** Recognition badges issued under this
      clause do not feed any ranking, ladder, or honors computation.
      They live on the profile surface; rankings are governed by (a).

(c) Telemetry — display only. Volume statistics — total runs
    completed, hours played, lifetime scenario coverage — may be
    recorded and displayed as non-ranking, non-recognition profile
    data. They never feed rankings (governed by (a)) and they do not
    by themselves issue badges (governed by (b)).

Bot-resistance is the test that distinguishes (a) from (b). A
criterion is permitted under (b) if a bot script optimizing for it
would still have to produce a long, distributed history of
high-quality play that materially benefits the community. A
criterion is forbidden under (b) if it can be satisfied by
repetitive low-quality play, by a single binge, or by farming the
same scenario.

Repetition alone is worthless. Repetition layered on quality,
sustained over years across many scenarios, is exactly what veteran
recognition rewards.

See D-0006 for the decision record authorizing rule (b).
```

---

## 3. Draft D-0006 (DECISIONS.md entry)

> Slot: meta-principles cluster (D-0001..D-0005). Next sequential number is **D-0006**. Format mirrors D-0005.

### D-0006 — Veteran Recognition Authorized; Bot-Resistance Is the Discriminator

**Decision:** Vision §25 is amended to authorize **non-ranking veteran recognition** (badges, profile milestones, "seasoned player" honors) that may count qualifying runs over time, provided each contributing run independently meets a quality floor, the threshold counts distinct scenarios, and a real-time elapsed window has passed since the player's first qualifying run. The §25 prohibition on volume-as-ranking-input is unchanged; only the recognition surface is opened.

Under this decision:

- A run that fails the quality floor does not count toward any veteran threshold; quality is the gate, time is the surface.
- Veteran badges are issued by the existing Tier 1 issuance path defined in D-1004 (rule-driven, post-INSERT projection over `legendary.competitive_scores` + `ScoreBreakdown`). No new trust surface is introduced.
- Veteran badges never feed rankings, ladders, or year-end honors. The DESIGN-RANKING.md framework is unaffected — its inputs remain quality-normalized per §25(a).
- The carve-out language in D-0005 referring to "title-awarding computation" is read narrowly: "title-awarding" means **competitive** titles (Player of the Year, leaderboard placements, archive honors), not recognition badges that satisfy §25(b). See §4 of this proposal for the clarifying note appended to D-0005.

**Scope:**

- Authorizes veteran-recognition badges, "seasoned player" tiers on the player profile, milestone markers tied to sustained quality, and similar non-competitive honors.
- Does **not** authorize any volume input to a ranking computation. Cumulative-count rankings remain forbidden by §25(a) and D-0005.
- Does **not** authorize any badge that can be earned by farming a single scenario, by binge play in a short window, or by low-quality repetition.
- Does **not** alter §22, §23(b), §24, or §26 — PAR scoring, replay verification, asynchronous-comparison surface, and PAR calibration are unchanged.

**Rationale:**

1. **Recognition gap in original §25.** §25's anti-grind language was written to defeat bot-driven ranking inputs and was correctly tight on that axis. The same language read literally also denies recognition to long-tenured high-quality players, which is contrary to the project's growth posture and to the intent recorded in this proposal's source directive. Veteran recognition is a legitimate growth surface that the original clause unintentionally closed.
2. **Bot-resistance is the right test, not absence-of-volume.** The risk §25 was guarding against is bots gamifying a system by accumulating count-based credit. The real defense is not "no volume ever" — it's "every counted run must be hard for a bot to fake." A quality floor (sub-PAR, zero escapes, etc.) makes each run cost something a bot has to actually achieve. A distinct-scenario requirement raises the breadth cost. A real-time window raises the wall-clock cost. The combination approaches the cost of a real player playing well, which is the intended threshold.
3. **The existing telemetry carve-out is too narrow.** §25's pre-amendment carve-out permits volume display but excludes "title-awarding" computations. Veteran badges are title-awarding by construction; they cannot ride on the carve-out without violating it. A first-class authorization is the honest path.
4. **No new trust surface is required.** Tier 1 badge issuance under D-1004 already projects deterministically over immutable `legendary.competitive_scores` rows. A veteran-tier badge is the same projection with a different predicate (multi-row aggregate over the same player's history). Trust, immutability, and replay-verification properties are inherited unchanged.
5. **DESIGN-RANKING.md is unaffected.** Rankings remain volume-forbidden. The amendment opens only the recognition surface. The two surfaces (ranking and recognition) are now formally distinct in §25 (rules (a) vs (b)).

**How to apply:**

- A WP that proposes a recognition badge using volume signals is **admissible** only if it specifies (i) the per-run quality predicate, (ii) the distinct-scenario count threshold, (iii) the real-time elapsed window, and (iv) explicit non-feed-into-rankings text.
- A WP that proposes a ranking surface using volume signals must be **rejected** under §25(a) and D-0005 — the amendment does not change this.
- A WP that proposes a recognition badge satisfiable by farming a single scenario, by binge play, or by low-quality repetition must be **rejected** as a §25(b) bot-resistance failure.
- WP-105 may include veteran-tier badges in its first slice; see PROPOSAL-BADGES.md §3 update notes (referenced in §6 of this proposal).

**Implementation surface:**

- No engine change required. Veteran badge predicates are pure aggregations over `legendary.competitive_scores` rows that already pass §22/§24/D-5301/D-5302 trust gates.
- No new persistence surface beyond `legendary.player_badges` (defined in D-1004's implementation notes).
- New required column in the badge issuance contract: `qualifying_window_start timestamptz NOT NULL` (the timestamp of the player's earliest qualifying run that contributes to this badge), so the real-time elapsed window is auditable and replayable from the row alone. This is additive to D-1004's column list and should be incorporated when WP-105 is drafted.

**Revisiting:** This decision may be revisited only by a new `DECISIONS.md` entry that (a) identifies a concrete veteran-recognition format that bot-resistance constraints fail to protect, and (b) proposes a tighter discriminator. Removing veteran recognition entirely is admissible only with vision-level justification (since this decision restores recognition that the original §25 unintentionally denied).

**Introduced:** 2026-04-26 — vision amendment in response to a directive that §25's anti-grind language was being read as anti-veteran when it was authored as anti-bot.

**Reinforces:** §25 (revised), §22 (replay verification), §24 (deterministic state hashing), D-5301 (Server is enforcer, not calculator), D-5302 (Competitive records immutable), D-1004 (Tier 1 issuance path).

**Status:** Draft (proposed 2026-04-26). On acceptance: Active.

---

## 4. Clarifying note to append to D-0005

> Append to D-0005's *"How to apply"* section. Does not modify the existing decision text; only clarifies how it composes with D-0006.

```
**Clarifying note (added with D-0006, 2026-04-26):**
The phrase "title-awarding computation" in this decision refers to
**competitive titles** — leaderboard placements, year-end honors,
seasonal-ladder positions, archive standings — not to recognition
badges that satisfy the bot-resistance constraints of §25(b). Veteran
recognition badges issued under §25(b) and D-0006 do not violate this
decision's anti-volume rule, because their inputs (each qualifying
run) are themselves quality-gated and the badge does not feed any
ranking. See D-0006.
```

---

## 5. Concrete veteran badges that satisfy §25(b)

> These join the six gameplay-only badges in PROPOSAL-BADGES.md §3 as a Tier 1 sub-slice. They reuse the same issuance path; no new trust surface.

### V-1. Seasoned Defender

- **Predicate:** count of distinct `ScenarioKey`s for which this player has at least one row with `breakdown.finalScore < 0` AND `breakdown.penaltyBreakdown['villainEscape'] === 0` is `>= 25`, AND the player's earliest such qualifying row is at least **6 months** before the current timestamp.
- **Quality floor:** sub-PAR completion with zero escapes (per-row predicate, replay-verified).
- **Breadth:** 25 distinct scenarios.
- **Real-time window:** ≥6 months from first qualifying run.
- **Bot resistance:** a bot would have to achieve sub-PAR with zero escapes across 25 distinct scenario compositions, sustained over half a year. The cost approximates a real skilled player.
- **Card tie-in:** TBD; verify against registry.

### V-2. Decade Legend

- **Predicate:** count of distinct `ScenarioKey`s with `finalScore < 0` is `>= 50`, earliest qualifying row at least **24 months** before issuance.
- **Quality floor:** sub-PAR (any qualifying-row predicate).
- **Breadth:** 50 distinct scenarios.
- **Real-time window:** ≥24 months.
- **Card tie-in:** TBD; candidate is a long-tenured Hero with thematic fit.

### V-3. Hall of Sustained Mastery

- **Predicate:** the player has at least one `finalScore < 0` row in each of at least **12 distinct calendar months** (UTC), spanning at least **18 months** between the earliest and latest qualifying month.
- **Quality floor:** sub-PAR, monthly cadence.
- **Bot resistance:** the cadence requirement (a row in each of 12 distinct months) and the spread requirement (≥18 months between bookends) defeat a single-binge bot. A bot would have to operate continuously for 18+ months at quality, which is the desired threshold for "veteran."
- **Card tie-in:** TBD.

### V-4. Crossroads of the Multiverse

- **Predicate:** at least one sub-PAR row in scenarios using **at least 5 distinct Masterminds** AND **at least 5 distinct Schemes** AND **at least 8 distinct Villain Groups** (parsed from `ScenarioKey`'s slugs per parScoring.types.ts:30 format), with earliest qualifying row at least **9 months** before issuance.
- **Quality floor:** sub-PAR per row.
- **Bot resistance:** breadth across three independent content axes (Mastermind / Scheme / Villains) + 9-month window.
- **Card tie-in:** TBD; candidate a multiverse-themed card.

### What this slice deliberately does **not** include

- ❌ "Played 100 games" — pure volume, no quality floor. Forbidden by §25(a/b) and D-0006.
- ❌ "1,000 lifetime VP" — pure volume.
- ❌ "Played every weekend for 6 months" — cadence without quality floor; a bot wins.
- ❌ "Most games played in a season" — competitive ranking by volume; forbidden by §25(a).

The four veteran badges above are the minimum convincing demonstration that the §25 amendment opens a real recognition surface without re-opening the anti-grind risk it was written to close.

---

## 6. Required follow-up updates if this proposal is accepted

These are described, not pre-applied:

### 6.1 `docs/01-VISION.md`
Replace §25 with the §2 text above. Numbering of §26 onward unchanged.

### 6.2 `DECISIONS.md`
- Add **D-0006** under the meta-principles cluster (after D-0005), using §3 above.
- Append the clarifying note from §4 to D-0005's "How to apply" section.
- Update `DECISIONS_INDEX.md` accordingly.

### 6.3 `docs/ai/PROPOSAL-BADGES.md`
- §2 (D-1004 draft): amend the **anti-volume binding** subsection to reference §25(a) for rankings and §25(b) for recognition. Volume is no longer flatly forbidden — it is forbidden under (a) and constrained under (b).
- §2 implementation notes: add `qualifying_window_start timestamptz NOT NULL` to the `legendary.player_badges` column list, with a `// why:` comment referencing D-0006.
- §3 criteria sketch: add the four veteran badges from §5 above as a Tier 1 sub-slice. Total Tier 1 badge count rises from 6 to 10 (still well within WP-105's file budget — they share the issuance code path).

### 6.4 `docs/ai/DESIGN-RANKING.md`
No change. Rankings remain volume-forbidden under §25(a). The amendment does not affect the ranking framework.

### 6.5 `WORK_INDEX.md`
WP-105 placeholder note: the issuer-model resolution (D-1004) and the recognition authorization (D-0006) together unblock WP-105 drafting. Replace the unresolved-issuer-model note accordingly.

---

## 7. Open questions for review

1. **D-0006 numbering.** Confirm D-0006 is the correct next-sequential slot in the meta-principles cluster.
2. **§25 numbering letters.** Proposal uses (a) Rankings / (b) Recognition / (c) Telemetry. Acceptable, or prefer different lettering or a numbered list? §23 used (a)/(b); using the same convention here matches.
3. **Real-time window thresholds.** Proposal uses 6 / 24 / 18 / 9 months for V-1..V-4. These are sketch values intended to demonstrate the principle; the actual values should be product-tuned. Confirm whether to ratify these values now or defer to WP-105 with a "values may shift in WP-105 draft" note.
4. **Calendar-month cadence (V-3).** Proposal uses UTC calendar months. Confirm UTC (which matches the database's `timestamptz` semantics) rather than per-player-locale months.
5. **First-qualifying-run timestamp source.** `legendary.competitive_scores.created_at` (from D-5305) is the natural anchor for the "earliest qualifying row" lookup. Confirm — alternative would be a denormalized `qualifying_window_start` written at badge issuance time only. The proposal's column-add note in §6.3 takes the second path for auditability; confirm.
6. **Veteran badge revocation.** If a player's earliest qualifying run is later invalidated (e.g., a replay corruption is discovered post-hoc), does the veteran badge re-validate automatically against the next-earliest qualifying run, or get revoked? Lean toward "re-validates automatically" so honest players aren't penalized for upstream issues; confirm.

---

## 8. If approved

1. Apply §6.1 and §6.2 to live docs.
2. Update PROPOSAL-BADGES.md per §6.3 (this can be done in the same review pass or as a follow-up; the live D-1004 entry will need the §6.3 amendments too if D-1004 is being merged in the same pass).
3. WP-105 drafting proceeds with both D-1004 and D-0006 in hand and the expanded 10-badge first slice.
