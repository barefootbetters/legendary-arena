# WP-616 — Per-Player Team-Contribution Attribution (scoring foundation)

**Status:** Ready
**Primary Layer:** Game Engine (scoring — `packages/game-engine/src/scoring/**`)
**Dependencies:** WP-588 / D-24397 (the `perPlayer[]` per-player contribution split this extends), WP-048 (`ScoreBreakdown` / `ScoringInputs`)
**User-Visible Surface:** none — infrastructure (a projection a future badge / endgame surface consumes)

> Baseline: `origin/main` at commit `497f2e77`.

---

## Session Context

The `wiki/awards-and-badges.md` design's last un-built idea is recognizing *"the
player who… recruited the hero that let someone else land the killing blow"* — an
**"enabled an ally"** attribution. Investigated against the engine:

**The literal, causal version is not buildable.** `LogEntry` carries no structured
`playerId` (just `text` / `outcome` / `card`), there is no cross-player causal
event stream, and base Legendary has sparse *direct* cross-player mechanics — so
"A's play caused B's win" is not something the engine records or could robustly
define. Chasing it would be a research-grade instrumentation effort, not a WP.

**What IS buildable, and serves the same goal:** per-player **team-contribution**
attribution. `deriveScoringInputs` already builds `perPlayer[]` (each seat's
`victoryPoints` + `bystandersRescued`) by walking that player's victory pile
(WP-588). Extending that walk with per-player **defeat counts** — the mastermind
tactics, villains, and henchmen in each seat's victory pile — captures *who
carried the table's offensive work*, the tractable heart of cooperative
recognition. This packet is that **data foundation**; a future badge (e.g. "The
Vanguard — defeated the most of the mastermind's tactics") consumes it.

---

## Goal

`PlayerScoringContribution` gains three per-player defeat counts —
`mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated` — populated
from each seat's victory pile in the existing `deriveScoringInputs` walk.
Display-only / projection; the score is unchanged.

---

## User-Visible Impact

None yet — infrastructure. The payoff is the per-seat contribution data a future
cross-player-recognition badge (and, optionally, the endgame report card) reads;
it is dark until a consumer WP lands.

---

## Assumes

- WP-588 on `main`: `deriveScoringInputs` builds `perPlayer: PlayerScoringContribution[]`
  by iterating `finalScoreSummary.players` and walking `gameState.playerZones[id].victory`
  (counting bystanders via `isBystanderCard`); `PlayerScoringContribution` =
  `{ playerId, victoryPoints, bystandersRescued }`.
- `computeFinalScores` already classifies victory-pile cards by type (villain /
  henchman / mastermind-tactic / bystander) to compute per-player VP — the same
  classification the new counts reuse (single source of truth; do not re-derive
  a parallel classifier).
- `PlayerScoringContribution` is a **display-only projection** derived from
  terminal `G` — no new `G` field, no hash surface (`finalStateHash` /
  `PRE_WP080_HASH` byte-identical, per the WP-588 precedent).
- `ScoreBreakdown.perPlayer` persists to `competitive_scores.score_breakdown`
  (jsonb) — additive fields need **no migration**.
- `pnpm -r build` 0; engine suite green on `497f2e77` (incl. both hash oracles).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/scoring/parScoring.types.ts` — `PlayerScoringContribution`
  (a **contract file**; adding fields requires this WP's `DECISIONS.md` D-24427 per
  code-style §Contract Files).
- `packages/game-engine/src/scoring/parScoring.logic.ts` — the `perPlayer` build
  loop (~L97-110) + the deep-copy site (~L388-405) that must copy the new fields.
- `packages/game-engine/src/scoring/scoring.logic.ts` — `computeFinalScores` + the
  victory-pile card-type classification to reuse for the counts.
- `docs/ai/DECISIONS.md` D-24397 (the WP-588 per-player split this extends);
  `.claude/skills/legendary-game-engine/SKILL.md`.
- `wiki/awards-and-badges.md` — the "enabled an ally" design (and why the causal form is deferred).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; JSDoc per field; `for...of` (no branching `.reduce()`).

**Packet-specific:**
- **Projection-only, hash-neutral.** Derived from terminal `G` in the existing
  scoring pass — NO new `G` field, no `ctx` change; both hash oracles stay
  byte-identical (the WP-588 precedent). The score is unchanged (`computeRawScore`
  / `computeParScore` / grades untouched).
- **Reuse the existing classification.** Count villains / henchmen / mastermind
  tactics using the SAME per-type predicates/logic `computeFinalScores` already
  applies to the victory pile — never a parallel classifier that could drift from
  the VP computation.
- **Contract discipline.** `parScoring.types.ts` is a contract file; the field
  additions are additive-optional-free (required numbers, defaulting to 0 per
  player) and land with **D-24427** (architecture-reviewed per code-style).
- **No migration.** `perPlayer` rides `score_breakdown` jsonb — additive.

**Locked values (do not re-derive):**
- New `PlayerScoringContribution` fields (all `readonly number`):
  `mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated`.
- Populated in the SAME `deriveScoringInputs` per-player victory-pile walk; 0 when
  a seat defeated none.

---

## Scope (In)

### A) `parScoring.types.ts` (**modified**)
- Add the three `readonly number` fields to `PlayerScoringContribution`, JSDoc'd
  (per-seat count of that card type in the player's victory pile).

### B) `parScoring.logic.ts` (**modified**)
- In the `perPlayer` loop, count each victory-pile card by type (reusing the
  existing classification) into the three counts; push them on the contribution.
- In the deep-copy site, copy the three new fields.

### C) Tests (**modified** — the existing per-player scoring test)
- A multi-player terminal state with known victory-pile contents asserts each
  seat's `mastermindTacticsDefeated` / `villainsDefeated` / `henchmenDefeated`;
  a seat that defeated none reads 0; both hash oracles unchanged.

---

## Out of Scope

- **No badge** — the consumer (a "team contribution" / "Vanguard" recognition
  badge) is a follow-on server WP.
- **No literal causal "A enabled B" attribution** — infeasible (no `LogEntry`
  playerId, no cross-player causal instrumentation); recorded as deferred.
- **No "who landed the final blow" flag** — needs turn-order attribution the
  victory pile does not carry.
- **No client / endgame-report display change** — surfacing the counts is a later
  arena-client WP.
- **No score / PAR / grade change** — the counts are display-only.
- **No migration, no new `G` field.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.types.ts` — **modified** — 3 fields on `PlayerScoringContribution`
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** — populate + deep-copy the counts
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** — per-player defeat-count assertions

No other **code** files may be modified. (The `EC-651:` implementation commit
touches exactly these 3; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Recognition infrastructure, not power (§24). No scoring/PAR/leaderboard math
changes — the counts are a **display-only projection** over terminal `G`, so **no
state-hash surface** (both oracles byte-identical, the WP-588 precedent). Serves
the cooperative-recognition thesis by capturing per-seat contribution honestly.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; `PlayerScoringContribution` is an engine type, not a
server library surface.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `PlayerScoringContribution` gains `mastermindTacticsDefeated`,
  `villainsDefeated`, `henchmenDefeated` (all `readonly number`).
- [ ] `deriveScoringInputs` populates each from the seat's victory pile using the
  existing card-type classification; a seat with none reads 0; the deep-copy site
  copies them.
- [ ] Both hash oracles (`finalStateHash`, `PRE_WP080_HASH`) byte-identical; the
  score / PAR / grade are unchanged.
- [ ] `pnpm -r build` 0; engine suite green; the `EC-651:` diff is exactly the 3 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test   # incl. the hash oracles
# Expected: exits 0 / all pass (+ the per-player defeat-count assertions)

Select-String -Path "packages\game-engine\src\scoring\parScoring.types.ts" -Pattern "mastermindTacticsDefeated|villainsDefeated|henchmenDefeated"
# Expected: the three fields on PlayerScoringContribution

git diff --name-only
# Expected (implementation commit): only the 3 scoring files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification: N/A** — surface = none (infrastructure). The
  consumer badge / endgame display is a follow-on WP.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine suite green; both hash oracles byte-identical.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24427 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-616 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (projection-only/hash-neutral, reuse-classification, contract discipline; locked
  values). §3 Assumes — PASS. §4 Context — PASS (cites the WP-588 loop + the
  classification SoT + the contract-file rule). §5 Files — PASS (3 code files;
  governance separate). §6 Naming — PASS (canonical `00.2`-style field names).
  §7 Deps — PASS (none; no migration). §8 Boundaries — PASS (engine scoring;
  no server/registry/UI touch). §9 Windows — PASS. §10 — N/A. §11 Persistence —
  PASS (display-only projection over terminal G; no new G field; jsonb-additive).
  §12 Tests — PASS (per-player counts + hash-oracle guard). §13 — PASS. §14
  Acceptance — PASS (4 binary). §15/§15.1 — PASS (surface = none, DoD N/A stated).
  §16 — PASS. §17 Vision — PASS + hash note. §18 Prose-vs-grep — PASS. §19 — N/A.
  §20 Funding / §21 API — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`497f2e77`):** `deriveScoringInputs`
  builds `perPlayer[]` by walking `playerZones[id].victory`; `PlayerScoringContribution`
  is `{ playerId, victoryPoints, bystandersRescued }`; `computeFinalScores`
  classifies victory-pile cards by type for VP (the classification to reuse);
  `perPlayer` is a hash-neutral display split (WP-588 comment). No name collision.
- **Contract note:** `parScoring.types.ts` is a contract file — the field additions
  land with D-24427 (architecture-reviewed), additive, no migration.
- **PS items (blocking): none.** The one open detail — the exact victory-pile
  per-type predicate — is resolved at execution by reusing `computeFinalScores`'
  classification (do NOT author a parallel one).

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** The extension mirrors the WP-588 per-player walk
exactly, one more count per card type, reusing the score's own classification so
the counts can't drift from VP. Projection-only (no hash surface). The honest
scope call — literal causal "A enabled B" is infeasible; per-player contribution is
the buildable foundation — is documented in Session Context + Out-of-Scope so a
future consumer WP (or a redirect to the causal problem) is unambiguous.
Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24427 (reserved; Drafted 2026-08-26)** — Extend `PlayerScoringContribution`
  (the WP-588 / D-24397 per-player split) with three per-seat defeat counts —
  `mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated` — populated in
  the existing `deriveScoringInputs` victory-pile walk using `computeFinalScores`'
  own card-type classification (single source of truth). A **display-only
  projection** over terminal `G`: no new `G` field, no hash surface (both oracles
  byte-identical), no score / PAR / grade change; additive on the `score_breakdown`
  jsonb (no migration). This is the tractable **foundation** for the design's
  "enabled an ally" recognition (a future consumer badge reads it). The **literal
  causal** attribution — "A's play caused B's win" — is recorded as **deferred /
  infeasible**: `LogEntry` carries no structured `playerId`, there is no
  cross-player causal event stream, and base Legendary's direct cross-player
  mechanics are too sparse to define it robustly.

---

## See Also

- WP-588 / D-24397 — the per-player `perPlayer[]` contribution split this extends
- `wiki/awards-and-badges.md` — the "enabled an ally" design (and the causal-form deferral)
- WP-613 / WP-614 / WP-615 — the badge lanes a future consumer of these counts would join
