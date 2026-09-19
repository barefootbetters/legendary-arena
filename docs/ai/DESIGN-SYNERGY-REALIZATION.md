# Design: Synergy Realization — Rewarding Assembled Card Effects

> **Status:** RATIFIED (framing accepted 2026-09-19). Phase 1 scoped as
> **WP-708 / EC-745 / D-24531**. Subordinate to `docs/ai/ARCHITECTURE.md`,
> `docs/01-VISION.md`, and `.claude/rules/*.md`.
> **Extends** the effect-execution / diagnostics spine (WP-257/D-24034 hollow
> channel, WP-488/D-24294 `EffectTrace`, WP-706/D-24528 `EffectTrace.resolution`)
> and the competitive-scoring surface (`DESIGN-RANKING.md`, `parScoring.types.ts`,
> WP-616/D-24427 per-seat split) by deriving a **player-facing skill signal** —
> how much of the synergy a player's conditional clauses offered did they assemble.
> **Date:** 2026-09-19
> **Framing decision (operator, 2026-09-19):** *synergy-first, cooperation as a
> later phase.* Base Legendary is **semi-cooperative** (a shared Scheme clock, but
> a competitive Victory-Point race), so Phase 1 measures the player's own
> assembled synergy honestly and does **not** dress a sum of independent seats up
> as "teamwork." The metric celebrates what was assembled and teaches with a
> single forward suggestion; it never scores a "miss."

---

## 1. The product goal

Legendary rewards **synergy**: most Hero cards carry a base effect that always
fires plus a **conditional clause** that pays off only when a condition holds —
`[hc:tech]: draw a card`, "if you have another Avenger, +2 Attack", "for each
X-Men you played this turn". Assembling those clauses — drafting a coherent team,
sequencing plays so conditions are live — is the skill ceiling of the game.

**What already exists (per-play signals, 2026-09):** the engine is not silent
about effects. WP-295/D-24082 logs a condition that came up empty ("ability did
not activate — a play condition … was not met", a structured `blocked` outcome);
WP-409/D-24221 projects a **per-play** count of hero effects that fired
(`UIState.game.lastPlayEffectsFired`, the audio combo cue); WP-706/D-24528 traces
the computed magnitude + counted inputs of count-scaled effects on the
hash-excluded `EffectTrace`. **What is missing** is a **per-match aggregate** a
player reads at the end: nothing rolls those per-play signals into "you assembled
7 of the 12 synergy clauses your cards offered," and nothing surfaces it on the
report card.

**The goal** is that end-of-match aggregate — a derived, display-only **Synergy
Realization** signal that celebrates the clauses a player landed and teaches,
gently, how to land more. It is a retention / skill-growth feature, not a
judgment. The governing principle, load-bearing for every section below:

> **Celebrate what was assembled. Teach with one forward verb. Never score a
> miss.**

This is a **product / skill-feedback** concern, distinct from the three effect
surfaces that already exist (§4).

---

## 2. Two vocabularies — never mix them

The engine's internal words and the player-facing words are **different sets, and
the player-facing surface never borrows the engine's.**

| Layer | Vocabulary |
|---|---|
| **Engine / diagnostics (internal)** | `fired`, `condition-failed`, `deferred`, `hollow` — the existing `EffectTraceStatus` / `EffectExecutionReason` unions; `conditionalClauses.{played,assembled}` counters. Precise, neutral. |
| **Player / coach (surfaced)** | *assembled*, *synergy landed*, *set up*, *next time try…* — celebratory or forward-looking. **Never** *whiff*, *failed*, *error*, *missed*, or *wasted*. |

The engine keeps calling a false-condition effect `condition-failed` in its
telemetry — correct internally. The player is **never** shown that word or its
spirit. This split is an **invariant** (§7), enforced by a copy-lint acceptance
criterion (§12), not authoring discipline.

---

## 3. The metric, phased

Three layers of feedback, shipped in order. Each is display-only and off-ranking
(§7).

### 3.1 The unit: the conditional clause

A **played Hero effect that carries at least one condition** (the closed set in
`heroConditions.evaluate.ts`: `heroClassMatch` / `[hc:X]`, `requiresTeam` /
`[team:X]`, `requiresKeyword`, `playedThisTurn`, the numeric thresholds). An
unconditional effect has no synergy decision and never enters the count.

### 3.2 Phase 1 — Synergy Rate (personal) + Table Total — **WP-708**

**Synergy Rate**, the player-facing headline:

```
Synergy Rate = conditional clauses assembled (condition met) / conditional clauses played
```

Surfaced as celebration — *"You assembled 7 of 12 synergy clauses."* Same-seat.
Deliberately **not** "Team-Up Rate" (§ framing). **Table Total** = the sum of
every seat's assembled count, shown as a neutral shared number, labelled a
**total**, not a cooperation score (a sum of independent seats does not measure
cooperation).

The instrument (see §5): a per-player `{played, assembled}` counter on the
hash-excluded `G.diagnostics`, incremented at the `evaluateAllConditions`
chokepoint, read into a display-only field on `PlayerScoringContribution`. Near-
free; rides the WP-295 condition-failed branch + the WP-616 per-seat scoring split.

### 3.3 Phase 2 — Realized Value % + the sequence teacher

**Realized Value %** weights a big assembled clause over a small one. Cost is now
**much lower than first estimated**: WP-706/D-24528 already captures the realized
`computedValue` + `count` + `countedInputs` for count-scaled effects on the
`EffectTrace.resolution` sub-record. What remains is the *ceiling* (the max the
clause could have offered) and rolling it into a per-match %. **The sequence
teacher** — framed as *opportunity, never error ledger* — offers one forward line
("Next time, play Strength before Shifting Illusions — you'd have landed the +3")
when a legal re-ordering of the same turn's plays would have assembled a clause
that came up empty. The engine already separates a hard `blocked` gate from a
wait-and-see `deferred` (`deferredConditionalGrants`), so "came up empty" and
"not yet met" are distinct. Runs over the faithful replay pipeline
(`reduceMatchToFinalState`, D-24119).

### 3.4 Phase 3 — genuine cross-seat cooperation (co-op scoped)

Cross-seat enablement ("you set Hawkeye up") and a **co-op-only**, celebration-
only HQ-courtesy signal. **Explicitly not v1.** In competitive VP play, taking
the HQ card that completes your engine — or denying an opponent — is legitimate
skill, not antisocial, so HQ-courtesy signals ship, if ever, only in cooperative
modes, framed as a bonus for generosity, never a competitive penalty.

---

## 4. Where this sits relative to the three existing effect surfaces

| Surface | Concern | This metric's relation |
|---|---|---|
| [Card Effect System](../../wiki/card-effect-system.md) | **Mechanism** — how printed text becomes a deterministic state change | measures the outcome of that mechanism |
| [Effect Rulings](../../wiki/effect-rulings.md) | **Correctness** — is a resolution *right* | orthogonal; assumes correctness |
| [Play Diagnostics](../../wiki/play-diagnostics.md) | **Operator freeze-debugging** — why did *this seat* wedge | shares the raw `outcome`/`EffectTrace` signal; different audience |
| **Synergy Realization (this doc)** | **Play quality / skill** — how much synergy the player assembled | the new, fourth concern |

---

## 5. The instrument (what exists vs what is new)

**Already ships — this WP aggregates, it does not detect:**

- **The condition chokepoint.** `heroEffects.execute.ts` runs
  `evaluateAllConditions` per hook; on false it takes the WP-295/D-24082
  `continue` branch (already logs a `blocked` `LogEntry`), on true it fires.
- **Per-play fired count** (WP-409/D-24221 `lastPlayEffectsFired`), the hollow
  separation (`G.diagnostics.hollowEffects`, D-24034), the structured
  `LogEntry {outcome, card}` (D-24253), and the `EffectTrace.resolution`
  realized-value record (WP-706/D-24528).
- **The display-only per-seat report-card split** `PlayerScoringContribution`
  (WP-616/D-24427) → `CoachPlayerLine` (WP-622) → `EndgameSummary.vue`.

**The one new piece (Phase 1):** none of the above is a **per-match** conditional-
clause tally. `lastPlayEffectsFired` is a per-play transient total; `EffectTrace`
records fired dispatches, not condition-failed ones; the `blocked` log is reaped.
So Phase 1 adds a per-player `{played, assembled}` counter pair on the
hash-excluded `G.diagnostics.conditionalClauses`, incremented at the chokepoint
(both branches, hollow-excluded), via a lazy recorder sibling to
`recordHollowEffect`. **No** new `EffectTraceStatus` member (that union is
`fired | no-op | no-handler | secondary-site`; the whiff concept already exists in
`EffectExecutionReason: 'condition-failed'`). Runtime-only, hash-excluded — no
replay/`finalStateHash` re-pin.

---

## 6. Where the signal lives (layering)

1. **Engine (hash-excluded diagnostics).** Accumulate `{played, assembled}` on
   `G.diagnostics.conditionalClauses` at the chokepoint. Hash-excluded (WP-257/
   D-24034 — `G.diagnostics` is the one part of `G` `computeStateHash` omits) →
   **no re-pin**.
2. **Engine scoring (end-of-game).** `deriveScoringInputs` reads the counters
   into display-only fields on `PlayerScoringContribution`. Never enters
   `finalScore`.
3. **Server / coach.** `buildCoachMatchSummary` carries them onto
   `CoachPlayerLine`; the coach speaks in the celebrate-then-forward voice (§2).
4. **Client.** `EndgameSummary.vue` renders the Table Total, then the seat's
   Synergy Rate, in that order (§12).

Phase 2's sequence teacher and Phase 3's cross-seat derivation are **server-layer**
reads over the faithful replay pipeline — never in the engine, never in the client.

---

## 7. Invariants to preserve

- **Two vocabularies, never mixed (§2)** — copy-lint enforced.
- **Off-ranking, always.** Synergy Realization and every future cooperation
  signal are display-only; never `finalScore` / PAR / grade. A future "generous
  teammate" recognition may be a **cosmetic** badge; never Victory Points
  (NG-1; no skill-stat-to-ranking leakage).
- **NG-1, no pay-to-win** — same cards played the same way → same Synergy Rate.
- **Determinism / persistence** — runtime-only, hash-excluded, counts-only; no
  snapshot/persistence-boundary violation; no hash re-pin.
- **Layer boundary** — engine records/derives; server carries; client renders; no
  client condition re-evaluation (D-20105).
- **Drift pins.** Phase 1 changes no drift-pinned closed set (only a hash-excluded
  `G.diagnostics` field + display-only scoring fields). A later phase that adds an
  `EffectTraceStatus` member follows the standard discipline (union +
  `EFFECT_TRACE_STATUSES` array + `DECISIONS.md`, runtime drift assertion,
  D-24372).

---

## 8. Scope decisions

- **Hero effects only, v1** — synergy conditions live on the hero path; villain /
  scheme effects are overwhelmingly unconditional.
- **Multi-clause cards** count as one clause (assembled iff all conditions pass;
  `evaluateAllConditions` is AND with short-circuit). No per-condition scoring v1.
- **Unassemblable clauses** — strict v1 (a clause the player could not have
  assembled still counts toward `played`); because the surface is celebratory (no
  penalty), a strict denominator never reads as blame. Revisit on playtest.
- **Intentional non-assembly** (declining an optional KO, etc.) flows through the
  pending-choice paths, not the condition chokepoint — naturally excluded.
- **Competitive HQ play is skill, not antisocial** — the metric must never
  discourage it; this is why HQ-courtesy (§3.4) is co-op-only.

---

## 9. Counter-pressure (the honest case against)

- **Synergy Rate can mislead without Realized Value** — one `+1 Recruit` and one
  `+6 Attack` both count as one. Phase 1 is legible but shallow; Phase 2 is the
  honest metric (and WP-706 already did most of its groundwork). Ship Phase 1 to
  learn whether players engage.
- **Any feedback can feel like judgment** — the §2 vocabulary split and the
  celebrate-first copy order (§12) are the mitigation, and they are AC, not advice.
- **Hollow inclusion would blame players for our backlog** — the
  hollow-XOR-`condition-failed` exclusion is load-bearing and tested (§12 AC-4).
- **The Table Total is a weak cooperation signal** — shipped as a *total*, not a
  cooperation score, so it does not overclaim before Phase 3.

---

## 10. Documentation plan (the ewiki page)

An ewiki page is warranted (a genuine fourth concern, §4) **but not before Phase 1
ships** — ewiki pages are `status: canonical` with a `source:` list describing
*built* systems. So: (1) this design doc now; (2) WP-708 → ship; (3) a new
"Synergy Realization" ewiki page once on `main`, cross-linked from Play
Diagnostics, Card Effect System, and the report-card / coach surface, with its
internal vocabulary anchored on `EffectExecutionReason` / `EffectTraceStatus`.

---

## 11. Ratification status

- **Framing ratified** 2026-09-19 (synergy-first, cooperation deferred).
- **Phase 1 scoped** as WP-708 / EC-745, reserving **D-24531** (display-only
  Synergy Realization scoring field + the `G.diagnostics.conditionalClauses`
  counter). D-24531 lands Active at execution.
- Phase 2 (Realized Value % over WP-706's `EffectTrace.resolution` + sequence
  teacher) and Phase 3 (co-op cross-seat cooperation) are dependent, later WPs.
- The scoring field is display-only, confirmed against `DESIGN-RANKING.md` (never
  `finalScore` / PAR).

---

## 12. Acceptance criteria for Phase 1 (WP-708)

1. At the `evaluateAllConditions` chokepoint, a conditional hook whose condition
   passes increments both `played` and `assembled`; a hook whose condition fails
   increments `played` only; an unconditional hook increments neither. Asserted on
   `G.diagnostics` after a real play (reward-integrity non-vacuity).
2. Per-player counters accumulate on `G.diagnostics.conditionalClauses`,
   hash-excluded; `finalStateHash` / `PRE_WP080` byte-identical (no re-pin).
3. `PlayerScoringContribution` carries the two synergy fields; `finalScore`/grade
   unchanged for every fixture.
4. A hollow (unimplemented-mechanic) conditional hook is excluded from both counts
   (known-hollow fixture).
5. `EndgameSummary.vue` renders the Table Total then the seat's *"assembled N of
   M synergy clauses"* line; no rate when `played === 0`.
6. **Copy-lint:** surfaced player/coach strings contain none of
   `whiff` / `failed` / `error` / `missed` / `wasted`.
7. Control / non-vacuity: stubbing the counter recorder fails AC-1 and AC-5.

---

## 13. Recommendation (one line)

Ship Phase 1 (WP-708) — a near-free per-match Synergy Rate + Table Total on the
report card built on already-shipped signals; then Phase 2 (Realized Value %,
mostly groundwork-done by WP-706) and Phase 3 (co-op cooperation), each gated on
Phase 1 showing players engage.

---

## References

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — `evaluateAllConditions`, `findFailedCondition`, `describeFailedCondition` (WP-566/D-24375)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the condition chokepoint + WP-295 `continue` branch
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — `GameDiagnostics`, `EffectExecutionReason` (`condition-failed`/`isHollowReason`, D-24033), `EffectTraceStatus` (D-24294)
- `packages/game-engine/src/scoring/parScoring.{types,logic}.ts` — `PlayerScoringContribution`, `deriveScoringInputs`
- `apps/server/src/coach/coach*.ts` — `CoachPlayerLine`, `buildCoachMatchSummary`
- `apps/server/src/replay/matchReplay.logic.ts` — `reduceMatchToFinalState` (D-24119, Phase 2)
- WP-295/D-24082, WP-409/D-24221, WP-616/D-24427, WP-622/D-24433, WP-488/D-24294, WP-706/D-24528 — the shipped signals this builds on
- [Card Effect System](../../wiki/card-effect-system.md), [Effect Rulings](../../wiki/effect-rulings.md), [Play Diagnostics](../../wiki/play-diagnostics.md) — sibling surfaces
