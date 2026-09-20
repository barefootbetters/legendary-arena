# WP-717 — Synergy Realization: Table Cooperation recognition (Server)

**Status:** Draft 2026-09-20 (EC-754; **D-24540** reserved)
**Layer:** Server only (a pure derivation over the coach match summary, surfaced on the
coach report). **Lane:** Standard two-session (server-only, but adds a coach-surface
contract field + a derivation module — not lightweight-lane trivial). **Baseline:**
`origin/main` @ `02fa5cae` · **User-Visible Surface:** the coach report **payload**
served by `GET /api/me/scores/:replayHash/coach` (the deterministic
`CoachReport.tableCooperation` field). **Client render** of the recognition on the
coach panel is a **named follow-up WP** (Option-B, mirroring WP-710 → WP-713). **Design
of record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` §3.4 (Phase 3 — co-op cross-seat
cooperation). Phase 3, following the Phase-2b sequence teacher.

## Goal

Celebrate how the table **cooperated to win**. Every multi-seat Legendary match is
**cooperative** — all seats share one outcome (`heroes-win` / `scheme-wins` / `tie`) vs
the Scheme + Mastermind, and the per-seat Victory Points are a *contribution* measure,
not a competitive race (the endgame already states "contribution only, no winner/loser
between teammates"). WP-708/709 shipped a weak, additive **Table Total**; Phase 3 upgrades
it into a genuine, celebration-only **Table Cooperation** recognition: the shared victory
framed as a team achievement, plus each seat's standout co-op role (who carried the
combat, who assembled the most synergy, who carried the rescue) read from the per-seat
contribution counts the coach summary already holds. It is deterministic, off-ranking,
never a score, and never frames teammates as opponents. Nothing changes the game, the
score, or any hash.

## Assumes

- **The game is cooperative by construction (on `main`).** `evaluateEndgame`
  (`packages/game-engine/src/endgame/endgame.evaluate.ts`) returns a single shared
  `EndgameOutcome` (`'heroes-win' | 'scheme-wins' | 'tie'`) set as one `ctx.gameover` for
  the whole table (`game.ts` `endIf`); the server labels every multi-seat match
  `'cooperative'`, "never `'competitive'`" (`apps/server/src/match/matchLagn.logic.ts`
  `variantForSeatCount`). So a co-op cross-seat recognition is buildable now — **not**
  blocked on a co-op mode, and celebrating a teammate's help never celebrates helping a
  rival (there are no rivals).
- **The coach summary already carries the per-seat contributions (WP-616/622, on `main`).**
  `buildCoachMatchSummary` (`apps/server/src/coach/coachSummary.logic.ts`) builds a
  `CoachMatchSummary` with `outcome`, a `team: { victoryPoints, bystandersRescued }`
  total, and `perPlayer: CoachPlayerLine[]`, each line carrying `label`, `victoryPoints`,
  `bystandersRescued`, `villainsDefeated`, `henchmenDefeated`, `mastermindTacticsDefeated`,
  and the WP-708/709 synergy fields (`conditionalClauses{Played,Assembled,Potential,Realized}Value`)
  (`apps/server/src/coach/coach.types.ts`). This is exactly the cross-seat data a Table
  Cooperation recognition needs — no engine change, no replay read.
- **The coach report is server-computed, persisted, and served (WP-594; the
  `sequenceTips` precedent, WP-710/713).** `generateOrGetCoachReport`
  (`apps/server/src/coach/coach.logic.ts`) builds the summary, calls the model, then (as
  of WP-710) computes a deterministic `sequenceTips` and merges `{ ...report,
  sequenceTips }` onto the **`CoachReport`** before `writeCoachReport` — so it persists in
  the jsonb blob and the cache-hit path serves it. `CoachReport.sequenceTips?: readonly
  string[]` is the additive-optional pattern this WP mirrors for `tableCooperation`.
- **`CoachReport` is the served/cached blob, `CoachMatchSummary` is the discarded model
  input.** Anything the client must see lives on `CoachReport` (WP-710 PS-1).

## Context (Read First)

**Why now / why this shape.** The design (§3.4) scoped Phase 3 as "genuine cross-seat
cooperation," and §9 flagged the Table Total as "a *weak* cooperation signal — shipped as
a total, not a cooperation score, so it does not overclaim before Phase 3." Reconnaissance
(2026-09-20) established the game is fully cooperative (shared outcome; multi-seat =
`'cooperative'`), so the honest Phase-3 v1 is to upgrade the weak Table Total into a
proper co-op **team-achievement** recognition **from the data the coach summary already
holds** — without inventing an attribution model the engine can't measure.

**What v1 recognizes (deterministic, from the summary):**

1. **The shared outcome as a team result** — `heroes-win` → the table stopped the
   Mastermind together; `scheme-wins` → the Scheme won this round, framed as a regroup,
   never blame; `tie` → the deck ran out with the threat held off. Co-op voice.
2. **Each seat's standout co-op role**, derived from `perPlayer`: the top combat seat
   (max `villainsDefeated + henchmenDefeated + mastermindTacticsDefeated`), the top
   synergy seat (max `conditionalClausesAssembled`, tie-broken by realized value), the
   top rescue seat (max `bystandersRescued`). Ties and single-seat / solo matches degrade
   gracefully (no role line when the field is zero across the table).
3. **The combined table achievement** — the `team` totals framed as a shared result
   ("Together your table rescued N bystanders and defeated M villains").

**Explicitly deferred (named follow-ups, out of v1).** (a) The **client render** of the
recognition on the coach panel (Option-B; mirrors WP-710 → WP-713). (b) **Explicit
cross-seat gift/assist attribution** — Paibok's `give-hq-hero-each-player` and the
cross-seat-benefit keyword family (`reveal-from-hand`, `random-acts`) are real but are
transient log/effect events (a villain-Fight side-effect emits no clean per-seat move), so
attributing them needs a bounded replay-log feasibility pass that should not gate the
celebration core — it is the immediate follow-up, not v1. (c) **HQ-courtesy** ("you left a
card for a teammate") — no per-seat "wanted"/interest signal exists to infer intent
(design §3.4 "if ever").

**Determinism + layer.** `computeTableCooperation` is a pure function of the already-built
`CoachMatchSummary`; no `ctx.random`, no I/O, no `G` read, no engine change. Server-layer
only (engine records/derives → server carries → client renders; D-20105). Display-only,
never `finalScore` / PAR / grade.

**Two vocabularies, both enforced.** The recognition is celebration voice — none of
`whiff` / `failed` / `error` / `missed` / `wasted` (the WP-708/709/710 copy-lint) — AND,
because seats are teammates, none of the **player-vs-player** vocabulary: no `opponent` /
`beat` / `versus`-a-player / `winner` / `loser` between seats. This co-op framing is the
game's own design, not a stretch: `EndgameSummary.vue` already states "contribution only,
no winner/loser between teammates" and `EndgameSummary.test.ts` asserts the recap excludes
`winner`/`loser` — the intra-match analogue of Vision §23(b)'s ban on player-vs-player
comparison (which literally governs cross-run comparison). Hero-vs-villain "vs" is fine
(`feedback_pvp_terminology_scope`); seat-vs-seat is not. The copy-lint uses **word-boundary**
matching so `defeated` does not self-trip `beat`.

## Scope (In)

- `apps/server/src/coach/coach.types.ts` — add `readonly tableCooperation?: readonly
  string[]` to **`CoachReport`** (additive optional, mirrors `sequenceTips`; the
  model-client boundary is untouched; `coach.logic.ts` always sets it, default `[]`).
- `apps/server/src/coach/tableCooperation.logic.ts` (**new**) —
  `computeTableCooperation(summary): readonly string[]`, the pure deterministic
  recognition: shared-outcome team framing + standout co-op roles from `perPlayer` +
  combined `team` totals. Co-op + celebration voice; no `.reduce()` for the role scans
  (explicit `for...of`). Solo / single-seat / all-zero degrade to a minimal line or `[]`.
- `apps/server/src/coach/coach.logic.ts` — compute `tableCooperation` from the already-built
  `summary` and merge `{ ...report, sequenceTips, tableCooperation }` before
  `writeCoachReport` (both the fresh and — via the stored blob — the cache path carry it).
- Tests (server): the recognition (each outcome's team framing; role detection incl. ties,
  solo, and all-zero degradation; the combined-total line; **co-op + celebration copy-lint**
  — none of the defeatist words AND none of the player-vs-player words); `coach.logic.ts`
  threads `tableCooperation` onto the served + cached `CoachReport` (the DB-free seam test
  extended).

## Out of Scope

- **Any engine / `G` / hash / persistence change.** Pure server derivation over the summary.
- **The client render of the recognition (Option-B)** — a named follow-up WP (the field
  reaches the client verbatim but is not displayed in v1).
- **Explicit cross-seat gift/assist attribution** (Paibok `give-hq-hero-each-player` + the
  cross-seat-benefit keyword family) — a replay-log read; the immediate follow-up.
- **HQ-courtesy** ("left a card for a teammate") — no per-seat interest signal; design "if ever".
- **Any score / PAR / grade / Victory-Point effect** (display-only, NG-1); a future
  cosmetic "generous teammate" badge is a separate, later decision (never VP).
- **Model-authored phrasing** — `tableCooperation` is deterministic strings, carried
  verbatim; the model's `headline`/`suggestions` are separate.
- **Villain / scheme effects, competitive framing** (there is no competitive variant).

## Files Expected to Change

| File | Change |
|---|---|
| `apps/server/src/coach/coach.types.ts` | `+ tableCooperation?: readonly string[]` on `CoachReport` |
| `apps/server/src/coach/tableCooperation.logic.ts` | **new** — `computeTableCooperation(summary)` (pure recognition) |
| `apps/server/src/coach/coach.logic.ts` | compute + merge `tableCooperation` onto the `CoachReport` before persist |
| `apps/server/src/coach/tableCooperation.logic.test.ts` | **new** — outcome framing / role detection (ties/solo/all-zero) / combined total / co-op + celebration copy-lint |
| `apps/server/src/coach/coach.logic.test.ts` | assert the served + cached `CoachReport` carries `tableCooperation` |

Governance (land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24540 Active), `NUMBER-LEDGER.md` (mark landed), `STATUS.md`,
`docs/ai/REFERENCE/api-endpoints.md` (the coach response-schema row records the
`CoachReport` shape — `tableCooperation` is additive, per D-11804).

## Contract

- **`computeTableCooperation(summary: CoachMatchSummary): readonly string[]`** — pure;
  reads `summary.outcome`, `summary.team`, `summary.perPlayer` only; returns the
  deterministic co-op recognition lines (empty or a single minimal line for a solo /
  all-zero match). Never throws on a well-formed summary. No `.reduce()` in the role scans.
- **`CoachReport.tableCooperation?: readonly string[]`** — additive optional;
  `coach.logic.ts` always sets it (default `[]`), persisted in the jsonb blob and served on
  both the fresh and cache-hit paths. Never model-authored.

## Non-Negotiable Constraints

- **Cooperative framing, never player-vs-player.** Seats are teammates; the recognition
  never uses `opponent` / `beat` / `versus`-a-player / `winner` / `loser` between seats —
  the game's own co-op rule (`EndgameSummary` "no winner/loser between teammates", asserted
  by its recap test), the intra-match analogue of Vision §23(b). (Hero-vs-villain "vs" is
  allowed — `feedback_pvp_terminology_scope`.) Word-boundary copy-lint (so `defeated` ≠ `beat`).
- **Celebration, never error ledger (two-vocabulary).** None of `whiff` / `failed` /
  `error` / `missed` / `wasted`; `scheme-wins` is a regroup, never blame. Copy-lint AC.
- **Server-layer, deterministic.** Pure over the summary; no engine change, no `G`/`ctx`
  read, no `ctx.random`, no I/O, no model authorship. The engine stays the authority on
  outcomes (D-20105).
- **Off-ranking, display-only** — never `finalScore` / PAR / grade / Victory Points (NG-1).
  Same cards played the same way → same recognition.
- **On the correct type.** `tableCooperation` on the persisted/served `CoachReport`, never
  the discarded `CoachMatchSummary` (WP-710 PS-1).
- **No hash / determinism / persistence surface.** Runtime-read-only of a derived summary;
  no fixture, no card-data, no `finalStateHash` exposure.
- **Engine-wide standing rules.** `.claude/rules/code-style.md` + `00.6` (human-style,
  JSDoc, `// why:` on the role-scan tie-breaks + the co-op framing choice); ESM-only
  `node:` built-ins; `.test.ts` on `node:test`; no `.reduce()` in the role scans.

## Vision Alignment

- **§1 Rules Authenticity** — reflects the game's genuine semi-cooperative structure (a
  shared win vs the Mastermind), which the competitive-looking VP total under-states.
- **§3 Player Trust & Fairness** — celebration-only, seat-symmetric, deterministic; frames
  teammates as teammates (the co-op no-winner/loser rule; the spirit of §23b), never
  overclaims attribution it cannot measure.
- **NG-1 no pay-to-win** — display-only recognition, never a score/ranking/VP term.
- **Determinism (§8/§22)** — a pure read of a derived summary; no hash exposure.

## Acceptance Criteria

1. `computeTableCooperation` returns a team-framed line for each outcome: `heroes-win`
   (stopped the Mastermind together), `scheme-wins` (regroup framing, no blame), `tie`
   (threat held / deck ran out) — asserted per outcome.
2. It names the standout co-op roles from `perPlayer`: top combat (max
   `villainsDefeated + henchmenDefeated + mastermindTacticsDefeated`), top synergy (max
   `conditionalClausesAssembled`, tie-broken by realized value), top rescue (max
   `bystandersRescued`) — asserted on a crafted 2–3 seat summary, and each role line is
   omitted when its metric is zero across the table. **Deterministic tie-break:** every
   role scan is `for...of` first-max-wins over `perPlayer` order (`>`, not `>=`), so a
   residual tie (including a synergy realized-value tie and a full cross-table tie)
   resolves to the first seat and still emits exactly one role line — asserted on an
   exact-tie 2-seat summary.
3. It emits the combined `team` total as a shared achievement line.
4. Solo / single-seat and all-zero summaries degrade gracefully (a minimal line or `[]`,
   never a crash, never an empty "role" line).
5. **Copy-lint (both vocabularies):** the emitted lines contain none of `whiff` /
   `failed` / `error` / `missed` / `wasted`, AND none of `opponent` / `beat` / `versus`
   (as a player relation) / `winner` / `loser` between seats.
6. `CoachReport.tableCooperation` carries the recognition on **both** the fresh-generate and
   the cache-hit served report (default `[]` when a solo/all-zero match yields none) —
   asserted through `coach.logic.ts` with a stubbed persistence seam.
7. No engine/hash/persistence change — server suite green; no fixture / card-data churn.
8. Control / non-vacuity: stubbing `computeTableCooperation` to `[]` fails AC-1/AC-6; restore.

## Verification Steps

1. `pnpm --filter @legendary-arena/server test` → green (recognition + coach.logic seam).
2. Control-stub `computeTableCooperation` → AC-1/AC-6 FAIL (non-vacuous); restore.
3. `pnpm -r build` 0; `git diff --name-only` = the allowlist + governance.
4. **Live-verify (operator-pending, post-deploy, D-24026 — payload, not render):** fetch
   `GET /api/me/scores/:replayHash/coach` for a real multi-seat co-op match; the returned
   `CoachReport.tableCooperation` frames the shared outcome as a team achievement and names
   the standout co-op roles. (The on-screen render is the named follow-up WP. Target a
   freshly-generated report — a report cached before this ships returns `tableCooperation`
   `undefined`.)

## Definition of Done

- [ ] All ACs met; server suite green (pass delta recorded).
- [ ] No engine/hash/persistence change; no fixture / card-data churn.
- [ ] Both copy-lint vocabularies green (celebration + no player-vs-player).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0.
- [ ] D-24540 flipped Active; WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `📝`→`✅`;
      `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS close-out; `api-endpoints.md`
      updated (the coach response row records the `CoachReport` shape; `tableCooperation`
      additive, D-11804).
- [ ] Two-commit topology (EC-754 impl + SPEC close).
- [ ] Live-verify (payload) performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24540** — Synergy Realization Phase 3 v1: a server-layer, celebration-only **Table
Cooperation** recognition on the `CoachReport`. Locks: (1) server-only — a pure derivation
`computeTableCooperation(summary)` over the already-built `CoachMatchSummary` (outcome +
team + per-seat contributions); no engine change, no `G` mutation, no hash surface, not
model-authored; (2) co-op is the base ruleset (shared outcome; multi-seat =
`'cooperative'`, never `'competitive'`), so no co-op-mode gate is needed and celebrating a
teammate's help never celebrates helping a rival; (3) display-only, off-ranking (NG-1),
never Victory Points; (4) two enforced vocabularies — celebration (no
whiff/failed/error/missed/wasted) AND cooperative (no player-vs-player opponent/beat/
versus-a-player/winner/loser between seats, Vision §23b); (5) deterministic strings on the
persisted/served `CoachReport` (never the discarded `CoachMatchSummary`); the client render,
explicit cross-seat gift/assist attribution, and HQ-courtesy are named follow-ups. Entry
lands at WP-717 execution. See DECISIONS.md and `DESIGN-SYNERGY-REALIZATION.md` §3.4.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all sections; ≥ 2 Out-of-Scope exclusions).
- **§2 Non-Negotiable Constraints** — PASS (co-op framing + celebration + server/deterministic
  + off-ranking + correct-type + no-hash + standing rules).
- **§3 Assumes** — PASS (each cites its locking WP/D + exact paths: co-op outcome, the coach
  summary contributions, the `sequenceTips` merge precedent).
- **§4 Context** — PASS (why-now, the deterministic recognition, the deferred follow-ups, the
  two-vocabulary rule).
- **§5 Files** — PASS (closed 5-file allowlist incl. `coach.logic.ts` + `coach.logic.test.ts`;
  governance called out).
- **§6 Naming Consistency** — PASS (`CoachReport`, `CoachMatchSummary`, `CoachPlayerLine`,
  `buildCoachMatchSummary`, `generateOrGetCoachReport`, `writeCoachReport`, `sequenceTips`,
  `villainsDefeated`/`henchmenDefeated`/`mastermindTacticsDefeated`/`conditionalClausesAssembled`
  — verified on `origin/main` @ `02fa5cae`).
- **§7 Dependency Discipline** — PASS (hard-deps on `main`: WP-594 coach, WP-616/622 per-seat
  split, WP-708/709 synergy fields, WP-710/713 the `sequenceTips` + coach-seam precedent).
- **§8 Architectural Boundaries** — PASS (server-layer pure derivation; no engine/`G`/hash;
  no client; engine stays the outcome authority — D-20105).
- **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — the coach endpoint's Legendary-Pass
  gate is unchanged (additive response field).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-stub; per-outcome + role +
  degradation cases; both copy-lint vocabularies; seam flow).
- **§13 Commands & Verification** — PASS (runnable steps + live-verify with a real co-op match).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs incl. the §23b copy-lint).
- **§15 Definition of Done** — PASS (binary gates + two-commit).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the tie-breaks + co-op framing;
  no `.reduce()` in the role scans).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22, §23b co-op framing).
- **§18 Prose-vs-Grep Discipline** — PASS.
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `02fa5cae`).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; the coach endpoint's
  Legendary-Pass gate is pre-existing and unchanged).
- **§21 API Catalog Update** — CONDITIONAL: `tableCooperation` is additive within the existing
  `GET /api/me/scores/:replayHash/coach` `CoachReport` response; update `api-endpoints.md`'s
  response-schema note for that row at execution (D-11804).

**Pre-flight verdict:** READY TO EXECUTE (see Gate Verdicts).
**Copilot check verdict:** PASS after 2 HOLD folds (see Gate Verdicts).

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent). No blocking PS-items.
  Every load-bearing claim verified against real code on `origin/main` @ `02fa5cae`: the
  game is cooperative (`endgame.types.ts:19` one shared `EndgameOutcome`;
  `matchLagn.logic.ts:233` `variantForSeatCount` never `'competitive'`); the
  `CoachMatchSummary` carries `outcome` + `team` + every named `CoachPlayerLine`
  contribution field and `coachSummary.logic.ts` populates them (roles non-vacuous, no
  summary change needed); the merge point is clean (`coach.logic.ts:140` `summary` in
  scope, `{ ...report, sequenceTips }` at 167-168 to mirror); `sequenceTips?` is the
  additive-optional precedent; the 5-file allowlist is complete (persistence
  `JSON.stringify`s the whole report + the route returns it verbatim, so no persistence/
  route change; the DB-free `coach.logic.test.ts` seam already asserts `sequenceTips` on
  fresh + cache paths); server-only, no determinism surface; ACs testable + non-vacuous;
  deferring client render + gift attribution mirrors WP-710→713 (v1 is not too thin). Three
  non-blocking RS nits, all folded: (1) copy-lint should use **word-boundary** matching
  (`defeated` ≠ `beat`) — folded into WP + EC; (2) §23(b) literally governs cross-run
  comparison — re-cited to the actual co-op precedent (`EndgameSummary` "no winner/loser
  between teammates" + its recap test) as the intra-match analogue — folded into WP + EC;
  (3) reserve D-24540 at execution to avoid the D-collision race — already reserve-first in
  the ledger. The only post-verdict edits were the RS folds (no scope/contract/allowlist
  change), so no pre-flight re-run is warranted.
- **Copilot (01.7): PASS after 2 HOLD folds** (independent subagent). Every load-bearing
  claim re-verified TRUE against `origin/main` @ `02fa5cae` (the co-op outcome + variant;
  the summary fields + their population in `coachSummary.logic.ts`; the `coach.logic.ts`
  merge point; the `sequenceTips` additive-optional precedent; whole-report blob
  persist/serve so no persistence/route change; the DB-free seam test asserting
  `sequenceTips` on fresh + cache; the co-op precedent `EndgameSummary.vue:612` +
  `EndgameSummary.test.ts:705` `.includes`-scan — which is exactly why the word-boundary
  upgrade is the right RS fold). Layer/determinism/persistence/NG-1 all PASS; deferring
  gift attribution judged defensible (it would add a replay-log read beyond a pure summary
  derivation; v1 delivers 2 of the 3 picked elements — shared-threat clears + team
  achievement — and names the third as an immediate follow-up, mirroring WP-710→713). Two
  scope-neutral HOLD nits, both folded (no re-run — scope/contract/allowlist unchanged):
  (1) specify the residual role-scan tie-break (first-max-wins over `perPlayer` order; a
  full tie still emits exactly one role line) + a tie test — folded into EC Locked Values +
  WP AC-2; (2) clarify the absolute `vs`/`versus` ban applies to the emitted lines (which
  never use "vs"), distinct from the broader hero-vs-villain-allowed rule — folded into EC
  copy-lint. No BLOCK, no mandatory governance follow-up. Pre-flight READY confirmed;
  session-prompt generation authorized.
