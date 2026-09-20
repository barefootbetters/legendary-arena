# WP-710 — Synergy Realization: play-order sequence teacher (Server + a Runtime-Safe engine predicate)

**Status:** Draft 2026-09-20 (EC-747; **D-24533** reserved)
**Layer:** Server (the teacher: a read over the D-24119 faithful replay, surfaced on
the coach report) + Game Engine (a **pure, read-only** Runtime-Safe condition
predicate — no recording, no `G` mutation, no chokepoint change). **Lane:** Standard
two-session (cross-layer; adds a server computation + an engine export).
**Baseline:** `origin/main` @ `1bbe8845` · **User-Visible Surface:** the coach report
**payload** served by `GET /api/me/scores/:replayHash/coach` (the deterministic
`CoachReport.sequenceTips` field). **Option B scope (operator decision):** v1 ships
the server + engine plumbing; the **client render** of the tips on the coach panel
(`EndgameCoachPanel.vue` + `coachApi.ts`) is a **named follow-up WP**, so v1's
D-24026 live-verify checks the served JSON, not the on-screen render.
**Design of record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` §3.3 (the sequence
teacher) + §6 (server-layer over the replay). Phase 2b, following WP-709. Phase 3
co-op cross-seat cooperation stays deferred.

## Goal

Turn a same-turn **sequencing** miss into one gentle, forward coaching line. When a
player's Hero card carried a conditional clause gated on **another hero of a class /
team / keyword being in play** (`heroClassMatch` / `requiresTeam` / `requiresKeyword`)
that came up empty **only because an unconditional enabling hero was played later the
same turn**, the coach offers one *opportunity* tip. The verified flagship, from the
operator's real 2p Red Skull match (turn 36.2): Marvelous Strength (`[hc:strength]`
gate) came up empty, then Perfect Teamwork (a strength Hero, unconditional on play)
was played later the same turn — so the tip is *"Next time, play Perfect Teamwork
before Marvelous Strength — you'd have landed the strength bonus."* It teaches
sequencing skill, never scolds a miss, and — the load-bearing correctness rule — only
fires when the reorder is a **net gain**, never when it would merely move the whiff to
another card. Nothing changes the game, the score, or any hash.

## Assumes

- **The faithful replay pipeline exists (D-24119 on `main`).**
  `reduceMatchToFinalState(artifact): MatchReplayResult`
  (`apps/server/src/replay/matchReplay.logic.ts:223`) re-executes a completed match's
  persisted `{ initialState, log }` through boardgame.io's own reducer, folding only
  player `MAKE_MOVE` inputs. The reducer is a pure `(state, action) => state`, so a
  **prefix** of the log reproduces the state at any point — the hook a per-play
  capture uses. `readReplayArtifactByHash` (exported) fetches the raw
  `{ initialState, log }` blob (the reduced-only `reduceReplayByHash` returns
  `MatchReplayResult` without the log).
- **A `playCard` is recoverable from the log — as a positional args array.** Each
  entry is `{ action:{ type:'MAKE_MOVE', payload:{ type, args, playerID } }, turn,
  phase }`. A hero play is `payload.type === 'playCard'`; its card is
  **`payload.args[0].cardId`** (args is a positional array — `matchReplay.logic.test.ts`
  builds `args:[{…}]`), its seat `payload.playerID`, its turn the entry's `turn`, in
  log order.
- **The whiff / deferred distinction is drawn (WP-295/D-24082, WP-568/D-24377).** At
  the `evaluateAllConditions` chokepoint a failed condition takes a hard `blocked`
  (`condition-failed`) branch, **unless** `isWaitAndSeeCondition` is true (the four
  numeric thresholds in `WAIT_AND_SEE_CONDITION_TYPES` — `recruitMadeThisTurnAtLeast`,
  `distinctHeroClassesAtLeast`, `cardsDrawnThisTurnAtLeast`, the repeatable-defeat
  type), which `recordDeferredConditionalGrant`s and **retro-fires** later the same
  turn. Confirmed: the four wait-and-see types auto-rescue, so a reorder cannot land
  them — they are excluded, and so are they from the WP-708 whiff tally.
- **The reorder-fixable gates read `inPlay` and are RNG-independent.**
  `heroClassMatch` / `[hc:X]`, `requiresTeam` / `[team:X]`, `requiresKeyword`
  (`hero/heroConditions.evaluate.ts`) scan the acting seat's `inPlay` for another
  qualifying card (the triggering card self-excluded). They are on-play (not deferred)
  and depend only on the played-card set, so a same-turn reorder is a deterministic
  `inPlay`-set question, not a re-simulation. `firstHeroPlayedThisTurn` and
  `playedThisTurn` are **excluded** from v1 (see Context — they are "play earliest" /
  raw-count gates, not "assemble a class-mate", so the "play X before C" model does
  not fit them).
- **Class/team membership can involve runtime grant maps.** `heroClassMatch` reads
  `cardHasClassWhenPlayed` → `G.cardSizeChangingClasses`; `requiresTeam` reads
  `cardCountsAsTeamMember` → `G.cardCopiedTeams`. Both are **runtime-mutated during
  play** (`hero/heroEffects.execute.ts`), not setup-static, and are **not** captured
  per-play. v1 therefore scopes size-changing / copy-powers interactions **out** (see
  Context / Out of Scope) — the predicate reads setup-static traits + hooks, and a
  card whose class/team match would depend on a runtime grant is treated
  conservatively (never a wrong tip).
- **The server may import the engine Runtime-Safe surface.** `evaluateCondition` is
  already on the `.` barrel (`packages/game-engine/src/index.ts:286`); a new pure
  predicate + a closed gate array re-exported there keeps the engine the sole
  authority on condition semantics (D-20105).
- **The coach report is server-computed, persisted, and served (WP-594).**
  `generateOrGetCoachReport` (`apps/server/src/coach/coach.logic.ts`) reduces the
  replay, builds `CoachMatchSummary` (the model **input**, discarded after
  `modelClient.generate`), gets a `CoachReport { headline, heroFit, purchases,
  suggestions }`, and **persists + serves the `CoachReport`** (`coachReport.persistence.ts`
  `JSON.stringify(report)` → jsonb; `GET /api/me/scores/:replayHash/coach` returns
  `result.report`). The cache-hit path returns the stored `CoachReport` **without
  rebuilding the summary** — so anything the client must see lives on `CoachReport`,
  never on `CoachMatchSummary`.

## Context (Read First)

**Why a server read + a pure engine predicate, not a re-simulation.** A feasibility
investigation of the replay + condition machinery settled the design doc's open
question, and a real 2p Red Skull / Midtown match (operator-supplied, 2026-09-20)
validated it and sharpened the correctness rule:

1. **No per-play whiff record survives a match** (only the WP-708/709 hash-excluded
   per-player aggregate). So the teacher **re-runs the replay** and reads the real
   per-play `inPlay` — it cannot cheaply read a stored whiff.
2. **A reorder-satisfiability check answers the question — an N! re-simulation is a
   determinism trap.** The class/team/keyword gates read `inPlay` at play time and are
   RNG-independent, so "would a legal same-turn reorder have assembled clause K?" is a
   set question over the captured card sets. A reordered re-run would consume the alea
   PRNG in a different order and diverge on any reveal/shuffle — unfaithful and
   unnecessary.
3. **The net-gain rule (the correctness fix the real match forced).** The naive check
   "does the turn's full played-set satisfy K?" is **wrong**: in the real match, turn
   33.2 played Absorb Energies (ranged, whiffed) then Repulsor Rays (ranged, landed
   *because* Absorb Energies was now in play). "Play Repulsor before Absorb" would just
   **move the whiff to Repulsor** — a net-zero swap of two mutually-enabling
   conditional class-mates. So the teacher fires **only** when the enabler is an
   **unconditional** hero (no on-play snapshot-gate clause of its own) of the required
   class/team/keyword, played later the same turn — moving it earlier is pure upside.
   The real match's turn 19.2 is illustrative (Legendary Commander whiffed "needs another
   shield Hero" with unconditional shield Heroes played later) — but the **tested
   flagship** (AC-4) is the cleaner turn-36.2 `heroClassMatch` case (Marvelous Strength /
   Perfect Teamwork), which avoids the teamless-basic-SHIELD and inline-`[team]`-gate
   subtleties Legendary Commander carries.
4. **Fidelity + scope (PS-3 / PS-B).** Because `heroClassMatch` / `requiresTeam` can
   read the runtime grant maps (Size-Changing → `cardSizeChangingClasses`; Copy-Powers →
   `cardCopiedTeams`), and those are neither setup-static nor captured per-play, a
   grant-free predicate can only *under-count* real matches. A false whiff is therefore
   possible if a size-changing / copy-powers card in the played card's captured `inPlay`
   silently satisfied the gate in the real match. To stay faithful ("never a wrong
   tip"), the predicate returns **`unsupported`** (the teacher skips the whiff entirely)
   whenever **the played card OR any card in the candidate `inPlay` set** carries a
   size-changing (`HeroAbilityHook.sizeChangingClasses`) or copy-powers hook — not just
   when C or the enabler is one. This is cleanly detectable from setup-static hooks. The
   result is conservative (a rare missed tip), never wrong.
5. **The engine change is a pure read predicate only** — no chokepoint change, no `G`
   mutation, no `G.diagnostics` write, so no hash/determinism exposure. This honors the
   design's "server-layer, never engine [recording]" while keeping condition semantics
   in one place (D-20105).

**The teacher algorithm (v1).** In `coach.logic.ts`, after (and folded with) the
replay read:

1. `reduceMatchCapturingHeroPlays(artifact): CapturedHeroPlay[]` — a single-pass
   D-24119 fold capturing, after each applied `playCard`, `{ seat, turn, cardId, inPlay:
   readonly CardExtId[] }` (the real `inPlay` at that play; `payload.args[0].cardId`).
   It also returns the final state so the caller folds once (RS-3).
2. Group hero plays by `(seat, turn)` in log order.
3. For each hero play of card `C` at position `i`: read `C`'s hooks from
   `finalState.heroAbilityHooks`. For each hook whose failing condition `K` is a
   **class/team/keyword gate** (`SEQUENCE_GATE_CONDITION_TYPES`) and where `C` is not
   size-changing/copy-powers-dependent, and `heroConditionHoldsForInPlay(K, C, C.inPlay,
   cardData)` is **false** (the engine predicate reproduces the real whiff), it is a
   candidate whiff.
4. **Net-gain reorder check:** scan the same seat/turn plays **after** `C` for an
   **unconditional** hero `E` (no on-play snapshot-gate clause) that satisfies `K`
   (`heroConditionHoldsForInPlay(K, C, [E], cardData)` true). If found, "play `E` before
   `C`" is a net-gain reorder.
5. Emit **at most one** tip per seat (the first teachable whiff in log order —
   deterministic; `computeSequenceTips` carries no value map, so no value tiebreak), in
   the opportunity voice. Attach a deterministic `sequenceTips: readonly string[]` to
   the **`CoachReport`**, computed in
   `coach.logic.ts` and merged onto the model report before `writeCoachReport` (so it
   persists in the jsonb blob and the cache-hit path serves it — deterministic, not
   model-authored).

**Determinism.** The teacher is a pure function of the persisted replay + registry
card data; no `ctx.random`, no wall-clock, no writes to game state. The engine
predicate is a pure read. No engine behavior, no hash, no fixture, no card-data.

**A lighter alternative considered (flag for review).** The engine could record a
compact per-whiff `{ seat, turn, cardId, conditionType }` on the hash-excluded
`G.diagnostics` at the chokepoint (consistent with WP-708/709), letting the server
skip the capture fold. It is cheaper but **crosses the design's "server-layer, never
engine" line** and re-introduces an engine write. This WP takes the design-faithful
server-read path; the lighter split is a one-line scope change at review.

## Scope (In)

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — export a pure
  Runtime-Safe predicate
  `heroConditionHoldsForInPlay(condition, playedCardId, candidateInPlayIds, cardData): 'holds' | 'fails' | 'unsupported'`
  that reuses `evaluateCondition`'s semantics for the class/team/keyword gates over a
  caller-supplied `inPlay` set + setup-static card data, self-excluding `playedCardId`.
  It returns **`unsupported`** (the teacher skips the whiff/enabler check) when the
  played card **or any card in `candidateInPlayIds`** carries a size-changing
  (`sizeChangingClasses`) or copy-powers hook — the grant maps are uncaptured, so a
  match could be silently satisfied. No `G` mutation; no `boardgame.io`.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — a closed
  `SEQUENCE_GATE_CONDITION_TYPES = ['heroClassMatch','requiresTeam','requiresKeyword']`
  readonly array with **two runtime drift assertions** (RS-1): disjoint from
  `WAIT_AND_SEE_CONDITION_TYPES`, and every member has an `evaluateCondition` case.
- `packages/game-engine/src/index.ts` — re-export the predicate + the array on the `.`
  Runtime-Safe surface.
- `apps/server/src/replay/matchReplay.logic.ts` — add
  `reduceMatchCapturingHeroPlays(artifact): { finalState; heroPlays: CapturedHeroPlay[] }`
  (a pure D-24119 capture fold, `payload.args[0].cardId`); `reduceMatchToFinalState`
  byte-unchanged.
- `apps/server/src/coach/sequenceTeacher.logic.ts` (**new**) —
  `computeSequenceTips(heroPlays, finalState, resolveCardName): readonly string[]`, the
  pure teacher per the algorithm above (net-gain, one tip per seat, class/team/keyword
  gates only, deferred + size-changing/copy-powers excluded).
- `apps/server/src/coach/coach.types.ts` — add `readonly sequenceTips?: readonly string[]`
  to **`CoachReport`** (optional so the model-client boundary is untouched; `coach.logic.ts`
  always sets it, default `[]`).
- `apps/server/src/coach/coach.logic.ts` — add `readReplayArtifactByHash` to the
  injectable `CoachLogic` seam; in `generateOrGetCoachReport`, fetch the artifact, run
  `reduceMatchCapturingHeroPlays` + `computeSequenceTips`, and merge
  `{ ...report, sequenceTips }` before `writeCoachReport` (both the fresh and — via the
  stored blob — the cache path then carry the tips).
- Tests (engine + server): the predicate vs the live `evaluateCondition` on shared
  inputs (class/team/keyword, self-exclusion) + the two drift assertions; the capture
  fold (real reducer-shape log → ordered per-play `{seat,turn,cardId,inPlay}`); the
  teacher (net-gain tip naming "play E before C"; **no** tip for a mutually-enabling
  conditional pair; no tip when no unconditional enabler exists; no tip for a
  deferred/numeric clause; no tip for a size-changing/copy-powers card; one-tip-per-seat
  cap; opportunity copy-lint); `coach.logic.ts` threads `sequenceTips` onto the served +
  cached `CoachReport` (the DB-free seam test updated for the new seam member).

## Out of Scope

- **Any reordered re-simulation** (reducer or sim harness). v1 answers reorderability by
  set-satisfiability over captured `inPlay` — a re-sim is a determinism trap (Context §2).
- **Numeric-threshold / wait-and-see clauses** (`recruitMadeThisTurnAtLeast`,
  `distinctHeroClassesAtLeast`, `cardsDrawnThisTurnAtLeast`, the repeatable-defeat type) —
  they auto-rescue via `deferredConditionalGrants`.
- **`firstHeroPlayedThisTurn` and `playedThisTurn`** — a "play earliest" gate and a raw
  inPlay-count gate; the "play E before C" model does not fit them (PS-4). Deferred.
- **Size-changing / Copy-Powers class/team matches** — the runtime grant maps
  (`cardSizeChangingClasses` / `cardCopiedTeams`) are not captured per-play; v1 treats
  such cards conservatively (never a wrong tip) and does not teach or use them as
  enablers. A follow-up can capture the maps per-play.
- **Mutually-enabling conditional pairs** — a reorder there is net-zero (Context §3); the
  teacher never suggests one (the enabler must be unconditional).
- **Model-authored phrasing** — `sequenceTips` are deterministic strings, carried
  verbatim; the model's `suggestions` are separate.
- **The client render of the tips (Option B).** v1 produces `CoachReport.sequenceTips`
  server-side (verified via the coach API). Rendering an "Opportunities" block on the
  coach panel (`apps/arena-client/src/**/EndgameCoachPanel.vue` + `coachApi.ts`'s
  `CoachReport` interface + a client test) is a **named follow-up WP** — the field
  reaches the client verbatim (JSON keeps unknown keys) but is not displayed in v1.
- **Cross-seat / co-op cooperation** (Phase 3), villain / scheme conditional effects, and
  any change to `finalScore` / PAR / grade or any engine behavior / hash / fixture /
  card-data.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/hero/heroConditions.evaluate.ts` | export pure `heroConditionHoldsForInPlay` + closed `SEQUENCE_GATE_CONDITION_TYPES` (two runtime drift assertions) |
| `packages/game-engine/src/index.ts` | re-export the predicate + the array on the `.` Runtime-Safe surface |
| `apps/server/src/replay/matchReplay.logic.ts` | add `reduceMatchCapturingHeroPlays` (pure D-24119 capture fold, returns finalState + heroPlays); `reduceMatchToFinalState` unchanged |
| `apps/server/src/coach/sequenceTeacher.logic.ts` | **new** — `computeSequenceTips` (net-gain teacher) |
| `apps/server/src/coach/coach.types.ts` | `+ sequenceTips?: readonly string[]` on `CoachReport` |
| `apps/server/src/coach/coach.logic.ts` | add `readReplayArtifactByHash` to the `CoachLogic` seam; compute + merge tips onto the `CoachReport` before persist |
| `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` | predicate vs live evaluator + the two gate-array drift assertions |
| `apps/server/src/replay/matchReplay.logic.test.ts` | capture fold: per-play `inPlay` from a real reducer-shape log |
| `apps/server/src/coach/sequenceTeacher.logic.test.ts` | **new** — teacher: net-gain tip / mutual-enabling no-tip / no-enabler no-tip / deferred-excluded / size-changing-excluded / one-per-seat / copy-lint |
| `apps/server/src/coach/coach.logic.test.ts` | the `CoachLogic` seam gains `readReplayArtifactByHash`; assert the served + cached `CoachReport` carries `sequenceTips` |

Governance (land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24533 Active), `NUMBER-LEDGER.md` (mark landed), `STATUS.md`,
`docs/ai/REFERENCE/api-endpoints.md` (iff the coach endpoint's response-schema row
records the `CoachReport` shape — `sequenceTips` is additive).

## Contract

- **`heroConditionHoldsForInPlay(condition, playedCardId, candidateInPlayIds, cardData): 'holds' | 'fails' | 'unsupported'`**
  — pure; reuses `evaluateCondition` semantics for the class/team/keyword gates over a
  supplied `inPlay` id set + setup-static card data; self-excludes `playedCardId`;
  returns `unsupported` when the played card or any `candidateInPlayIds` card carries a
  size-changing/copy-powers hook. Never throws on well-formed input.
- **`SEQUENCE_GATE_CONDITION_TYPES = ['heroClassMatch','requiresTeam','requiresKeyword']`**
  — closed; runtime-pinned disjoint from `WAIT_AND_SEE_CONDITION_TYPES` and each member
  has an `evaluateCondition` case.
- **`reduceMatchCapturingHeroPlays(artifact): { finalState; heroPlays: readonly CapturedHeroPlay[] }`**
  — pure server read over `{ initialState, log }`; each hero play
  `{ seat, turn, cardId, inPlay }` captured after that `playCard` applied
  (`payload.args[0].cardId`). `reduceMatchToFinalState` byte-unchanged.
- **`computeSequenceTips(heroPlays, finalState, resolveCardName): readonly string[]`** —
  pure; at most one net-gain opportunity tip per seat (the first teachable whiff in log
  order — no value map, so no value tiebreak); empty when none. Opportunity voice — none
  of `whiff` / `failed` / `error` / `missed` / `wasted`.
- **`CoachReport.sequenceTips?: readonly string[]`** — additive optional; `coach.logic.ts`
  always sets it (default `[]`), persisted in the jsonb blob and served on both the fresh
  and cache-hit paths.

## Non-Negotiable Constraints

- **Net-gain, never net-zero (correctness).** A tip fires only when an **unconditional**
  same-class/team/keyword hero was played later the same turn — never a mutually-enabling
  conditional pair (Context §3). Pinned by AC-5.
- **Opportunity, never error ledger (design §3.3).** The tip is forward; the surface shows
  **none** of `whiff` / `failed` / `error` / `missed` / `wasted` (copy-lint AC).
- **Server-layer; the engine stays pure (D-20105).** The engine change is a read-only
  predicate + a closed array — no chokepoint change, no `G` mutation, no `G.diagnostics`
  write, no `boardgame.io` in the predicate. The server never re-implements condition
  semantics — it calls the predicate.
- **No engine behavior / hash / determinism change.** `finalStateHash` / `PRE_WP080_HASH`
  untouched; no fixture, no card-data.
- **Faithful, not re-simulated.** Reorderability is set-satisfiability over the captured
  real `inPlay` sets; the predicate returns `unsupported` (teacher skips the whiff)
  whenever the played card **or any card in its captured `inPlay`** is
  size-changing/copy-powers (uncaptured grant maps) — scoped out rather than guessed.
  Never a wrong tip.
- **On the correct type.** `sequenceTips` lives on the persisted/served `CoachReport`,
  never on the discarded `CoachMatchSummary` (PS-1).
- **Off-ranking, display-only** — the tips never enter `finalScore` / PAR / grade (NG-1).
- **Engine-wide standing rules.** `.claude/rules/code-style.md` +
  `docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the D-24119
  capture read, the net-gain rule, the size-changing scope-out, the one-tip cap);
  ESM-only `node:` built-ins; `.test.ts` on `node:test`; no `.reduce()` in the teacher.

## Vision Alignment

- **§1 Rules Authenticity / skill growth** — teaches the play-order skill the game
  already rewards, the deepest and least-visible synergy layer.
- **§3 Player Trust & Fairness** — deterministic, seat-symmetric, opportunity-framed;
  never fires without a real net-gain reorder, so it never misinforms.
- **NG-1 no pay-to-win** — pure skill coaching, never a score/ranking term.
- **Determinism (§8/§22)** — pure over the persisted replay; the engine predicate is a
  read; no hash exposure.

## Acceptance Criteria

1. `heroConditionHoldsForInPlay` reproduces `evaluateCondition`'s `holds`/`fails` for
   `heroClassMatch` / `requiresTeam` / `requiresKeyword` over a supplied `inPlay` set
   (with self-exclusion) — asserted against the live evaluator on shared inputs (no
   re-implementation drift) — and returns `unsupported` when the played card or any
   `inPlay` card carries a size-changing/copy-powers hook.
2. `SEQUENCE_GATE_CONDITION_TYPES` is closed and runtime-pinned: disjoint from
   `WAIT_AND_SEE_CONDITION_TYPES`, and every member has a real `evaluateCondition` case
   (asserted at runtime by crafting an input that makes each member return `holds` — the
   `default` arm can only return `fails`; not a bare `satisfies`).
3. `reduceMatchCapturingHeroPlays` returns, for a real reducer-shape `{ initialState,
   log }`, the ordered per-`playCard` `{ seat, turn, cardId, inPlay }` (via
   `payload.args[0].cardId`); `reduceMatchToFinalState`'s output is byte-unchanged for
   the same artifact.
4. The teacher emits a tip naming "play E before C" when C's class/team/keyword clause
   failed at its play position and an **unconditional** enabler E of the required
   class/team/keyword was played later the same turn — asserted on a crafted sequence
   modeled on the real match's **turn-36.2 Perfect-Teamwork-before-Marvelous-Strength**
   shape (`[hc:strength]` gate, unconditional strength enabler played later).
5. The teacher emits **no** tip when: the only later enabler is itself a conditional
   class-mate (a **mutually-enabling** pair — net-zero, the real match's turn-33.2
   Absorb/Repulsor shape); no later same-class/team enabler exists; the failing
   condition is wait-and-see/deferred; or the played card **or any card in its captured
   `inPlay`** is a size-changing/copy-powers card (predicate `unsupported`).
6. At most one tip per seat.
7. **Copy-lint:** the emitted tips contain none of `whiff` / `failed` / `error` /
   `missed` / `wasted`.
8. `CoachReport.sequenceTips` carries the computed tips on **both** the fresh-generate
   and the cache-hit served report (default `[]` when none) — asserted through
   `coach.logic.ts` with a stubbed persistence seam.
9. No engine hash/behavior change — full engine suite green, sentinel `finalStateHash`
   + `PRE_WP080_HASH` byte-identical, no fixture churn.
10. Control / non-vacuity: stubbing `computeSequenceTips` to `[]` fails AC-4/AC-8;
    restore.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `test` → green (predicate +
   drift assertions; sentinel hashes byte-identical — no engine runtime change).
2. `pnpm --filter @legendary-arena/server build` + `test` → green (capture fold +
   teacher + coach.logic seam).
3. Control-stub `computeSequenceTips` → AC-4/AC-8 FAIL (non-vacuous); restore.
4. `pnpm -r build` 0; `git diff --name-only` = the allowlist + governance.
5. **Live-verify (operator-pending, post-deploy, D-24026 — Option B: payload, not
   render):** fetch `GET /api/me/scores/:replayHash/coach` for the real Red Skull /
   Midtown match; the returned `CoachReport.sequenceTips` contains one
   "play Perfect Teamwork before Marvelous Strength" opportunity tip (turn 36.2) and
   **no** tip for the turn-33.2 mutually-enabling ranged/tech pairs. (The on-screen
   render is the named follow-up WP. Target a **freshly-generated** report — a report
   cached before this ships returns `sequenceTips` `undefined`; clear the cache or use a
   new match.)

## Definition of Done

- [ ] All ACs met; engine + server suites green (pass deltas recorded).
- [ ] Sentinel + `PRE_WP080` hashes byte-identical; no fixture / card-data churn.
- [ ] Net-gain rule proven (mutual-enabling pair → no tip; unconditional enabler → tip).
- [ ] Copy-lint green (opportunity voice).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0.
- [ ] D-24533 flipped Active; WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `📝`→`✅`;
      `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS close-out; `api-endpoints.md`
      updated iff the coach response row records the `CoachReport` shape.
- [ ] Two-commit topology (EC-747 impl + SPEC close).
- [ ] Live-verify (Option B) performed or explicitly operator-pending: the coach API
      response carries the turn-36.2 tip and none for the mutually-enabling pairs.

## Reserved Decision (lands at execution)

**D-24533** — Synergy Realization Phase 2b: a server-layer play-order **sequence
teacher** over the D-24119 faithful replay. Locks: (1) server-layer — the teacher reads
the replay (`reduceMatchCapturingHeroPlays`, a pure capture fold) + a **pure Runtime-Safe
engine predicate** (`heroConditionHoldsForInPlay`); the engine gains **no** recorder, `G`
mutation, or `G.diagnostics` field, and stays the sole authority on condition semantics
(D-20105); (2) teaches only hard-blocked **class/team/keyword** gates (`heroClassMatch` /
`requiresTeam` / `requiresKeyword`) — `firstHeroPlayedThisTurn` / `playedThisTurn` and the
wait-and-see numeric thresholds are excluded; (3) the **net-gain rule** — a tip fires only
when an **unconditional** same-class/team/keyword hero was played later the same turn;
never a mutually-enabling conditional pair (a net-zero whiff swap); (4) reorderability is a
**set-satisfiability** check over the captured real `inPlay`, never a reordered
re-simulation; the predicate returns `unsupported` (teacher skips the whiff) whenever
the played card **or any card in its captured `inPlay`** is size-changing/copy-powers
(runtime grant maps uncaptured) so a tip is never wrong, only conservative; (5) the
deterministic `sequenceTips` live on the persisted/served **`CoachReport`** (never the
discarded `CoachMatchSummary`); at most one per seat; opportunity-voice copy-lint;
display-only, off-ranking (NG-1); no engine behavior / hash / fixture / card-data change.
**Option B scope:** v1 is server + engine plumbing; the client render of the tips is a
named follow-up WP (the field reaches the client verbatim but is not displayed in v1).
The lighter alternative (an engine per-whiff `G.diagnostics` recorder) is recorded and
not taken. Entry lands at WP-710 execution. See DECISIONS.md and
`DESIGN-SYNERGY-REALIZATION.md` §3.3.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all sections; ≥ 2 Out-of-Scope exclusions).
- **§2 Non-Negotiable Constraints** — PASS (net-gain + opportunity voice + server/engine-pure
  + no-hash + faithful/scoped + correct-type + off-ranking + standing rules).
- **§3 Assumes** — PASS (each cites its locking WP/D + exact paths/signatures; the log-shape
  and grant-map facts corrected).
- **§4 Context** — PASS (the feasibility decision, the net-gain correctness rule from the real
  match, the fidelity scope-out, the algorithm, the lighter alternative).
- **§5 Files** — PASS (closed allowlist incl. `coach.logic.ts` + `coach.logic.test.ts` +
  `CoachReport`; governance called out).
- **§6 Naming Consistency** — PASS (`evaluateCondition`, `isWaitAndSeeCondition`,
  `WAIT_AND_SEE_CONDITION_TYPES`, `reduceMatchToFinalState`, `readReplayArtifactByHash`,
  `CoachReport`, `coachReport.persistence`, `cardHasClassWhenPlayed`,
  `cardCountsAsTeamMember` — verified on `origin/main`).
- **§7 Dependency Discipline** — PASS (hard-deps on `main`: D-24119 replay, WP-295, WP-568,
  WP-566, WP-594, WP-708/709).
- **§8 Architectural Boundaries** — PASS (server reads the replay + a pure engine predicate;
  engine read-only; no `boardgame.io` in the predicate; D-24119 server-only; no client
  re-computation).
- **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — the coach endpoint's Legendary-Pass
  gate is unchanged (additive response field).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-stub; predicate-vs-live
  cross-check; net-gain + mutual-enabling cases; copy-lint; drift assertions; real
  reducer-shape log).
- **§13 Commands & Verification** — PASS (runnable steps + live-verify with a real match shape).
- **§14 Acceptance Criteria Quality** — PASS (10 testable, non-vacuous ACs incl. the net-gain
  negative case).
- **§15 Definition of Done** — PASS (binary gates incl. hash identity + two-commit).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the capture read + net-gain +
  scope-out + cap; no `.reduce()`).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22).
- **§18 Prose-vs-Grep Discipline** — PASS.
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `1bbe8845`).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; the coach endpoint's
  Legendary-Pass gate is pre-existing and unchanged).
- **§21 API Catalog Update** — CONDITIONAL: `sequenceTips` is additive within the existing
  `GET /api/me/scores/:replayHash/coach` `CoachReport` response; update `api-endpoints.md`'s
  response-schema note for that row at execution if the catalog records the shape.

**Pre-flight verdict:** READY TO EXECUTE (see Gate Verdicts).
**Copilot check verdict:** (see Gate Verdicts.)

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent, **three** passes).
  Pass 1 → NOT READY (PS-1 `sequenceTips` on the discarded `CoachMatchSummary`; PS-2 no
  log access + missing `readReplayArtifactByHash` seam / `coach.logic.test.ts`; PS-3
  grant-map fidelity; PS-4 `firstHeroPlayedThisTurn`/`playedThisTurn` mis-gated; PS-5
  `payload.args.cardId` wrong shape). Pass 2 → NOT READY (PS-A the Legendary-Commander
  flagship isn't a taught gate for the teacher; PS-B grant-map scope-out must cover the
  whole `inPlay` set; PS-C the promised surface was unwired). All folded, and a real-match
  correctness fix (the **net-gain** rule — never teach a mutually-enabling pair) added.
  Pass 3 (post Option-B revision) → **READY TO EXECUTE**, verified against real card data
  (Marvelous Strength `[hc:strength]` is a real gate; Perfect Teamwork is an unconditional
  strength enabler; copy-powers is the sole non-setup-static grant, so the whole-inPlay
  scope-out makes a false whiff impossible), with 4 non-blocking RS nits folded (tested-
  flagship note, cache-fresh live-verify, AC-2 runtime-assertion technique, drop the
  aspirational value-tiebreak). Baseline drifted `1bbe8845`→`dd433d45` (EC-741 rulings
  only; no seam touched).
- **Copilot (01.7): PASS / CONFIRM** (independent subagent). Every load-bearing claim
  verified against real code (log shape `payload.args[0].cardId`, `readReplayArtifactByHash`
  raw blob, `CoachReport` persist/serve + cache-hit path, size-changing/copy-powers
  setup-static detectability, the three gates RNG-independent, `evaluateCondition` default
  arm `false` making the AC-2 runtime pin sound). Determinism/persistence/layer-boundary/
  net-gain/off-ranking/allowlist all PASS; the engine touch is a pure predicate never
  taking `G`, so no re-pin owed. Two scope-neutral RISK nits folded: precise "unconditional
  E" definition (no `SEQUENCE_GATE_CONDITION_TYPES` condition; `playedThisTurn` unproduced,
  `firstHeroPlayedThisTurn` net-safe) + the disjointness pin must import the canonical
  `WAIT_AND_SEE_CONDITION_TYPES`. No pre-flight re-run warranted.
