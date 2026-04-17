WP-061 and WP-065 are complete (commits `2e68530`, `bc23913`). WP-067
(UIState projection of PAR scoring + progress counters) is drafted and
passed the 00.3 lint gate on 2026-04-17; its EC-068 is Draft. Key
context for WP-048:

- Repo test baseline: 409 passing (3 registry + 376 game-engine + 11
  vue-sfc-loader + 6 server + 13 arena-client). WP-048 must not
  regress any of these counts.
- WP-048 dependencies (WP-020, WP-027, WP-030) all ✅.
- WP-048 gates WP-067, which in turn gates WP-062 (Arena HUD). The
  sequenced UI-chain path is `WP-048 → WP-067 → WP-062`.

Pre-flight must-resolve items (new since the 2026-04-15 lint review;
surfaced during WP-061 execution audit of WP-062 on 2026-04-17):

1. **`MatchSetupConfig` 9-field lock vs `scoringConfig` wiring.**
   CLAUDE.md locks `MatchSetupConfig` to exactly 9 fields and forbids
   adding a 10th. But the scoring config must reach `G` somehow at
   match setup. WP-048 as drafted does NOT list
   `packages/game-engine/src/setup/buildInitialGameState.ts` in its
   Files Expected to Change, yet WP-067 assumes `G.activeScoringConfig`
   is populated there. Pick one at pre-flight:
   - (a) Add an optional third parameter to `buildInitialGameState`
     (`scoringConfig?: ScenarioScoringConfig`). No change to
     `MatchSetupConfig`. Cleanest; recommended.
   - (b) Server-layer population after `Game.setup()` finishes. Less
     clean; blurs the setup-only boundary.
   - (c) Amend the 9-field lock with a DECISIONS.md entry. Largest
     blast radius.
   Whichever you pick, record it in DECISIONS.md and amend WP-048's
   Files Expected to Change accordingly.

2. **Re-run 00.3 lint gate on WP-048 before execution.** WP-048's
   `✅ Reviewed` tag is from the 2026-04-15 Standardization Pass. That
   pass did NOT catch the "no UI projection" gap that WP-061 execution
   later surfaced (WP-048 §Out of Scope correctly says "No UI changes",
   but the prior review didn't flag the downstream consumer impact on
   WP-062). Prior review had at least one known blind spot; re-linting
   now with fresh context is cheap insurance.

3. **Confirm `G.activeScoringConfig` field ownership.** Related to #1:
   if pre-flight chooses option (a), WP-048 owns adding
   `activeScoringConfig?: ScenarioScoringConfig` to `LegendaryGameState`
   and threading it through `buildInitialGameState`. If deferred to
   WP-067, WP-048's scope is unchanged but WP-067 must pick up the
   field addition + setup wiring (currently WP-067 §C is conditional
   on this).

4. **Working tree state at session start.** Before executing WP-048,
   commit this session's governance work under `SPEC:` prefix
   (WP-067 draft, EC-068 draft, roadmap refresh, precedent-log entries
   P6-30/31/32). Starting WP-048 on a dirty working tree forces the
   executor to navigate precise staging again.

Downstream consumer constraints (load-bearing — renaming breaks WP-067
and cascades to WP-062):

- `ScoreBreakdown` field names expected by WP-067 / EC-068 Locked
  Values: `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`.
  Project these verbatim onto `UIParBreakdown` (WP-067 §A).
- `ScoringInputs.bystandersRescued` is the canonical counter name;
  WP-067 also uses it verbatim as `UIProgressCounters.bystandersRescued`.
- `ScenarioScoringConfig` must be exported from
  `packages/game-engine/src/index.ts` — WP-067 imports it as a type.
- Any rename during WP-048 execution requires amending EC-068's Locked
  Values at WP-067 pre-flight.

Architectural patterns still in effect (brief — full rationale in
DECISIONS.md):

- D-0301 — UI consumes projections only (WP-048 does not project, per
  its §Out of Scope; WP-067 does the projection downstream).
- Engine must never import `boardgame.io` in pure helpers; scoring
  types/logic stay pure (WP-048 §Non-Negotiable Constraints already
  reinforces this).
- WP-061 established the `apps/arena-client/` boundary: client imports
  engine types only (`import type`). WP-048 does not cross into that
  boundary but should not break `packages/game-engine/src/index.ts`
  re-exports that the client type-imports.

Files WP-048's executor will need to read before coding:

- `docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md`
  — the authoritative WP spec (including the Downstream consumer note
  added 2026-04-17 under §Out of Scope).
- `docs/ai/work-packets/WP-067-uistate-par-projection-and-progress-counters.md`
  — to see the exact field names and projection shape the downstream
  WP depends on.
- `docs/ai/execution-checklists/EC-068-uistate-par-projection-and-progress-counters.checklist.md`
  §Locked Values — the binding list of names WP-048 must produce.
- `packages/game-engine/src/scoring/scoring.types.ts` — existing VP
  types this WP extends.
- `packages/game-engine/src/scoring/scoring.logic.ts` —
  `computeFinalScores` (reused by `deriveScoringInputs`).
- `packages/game-engine/src/types.ts` — `LegendaryGameState` shape; see
  item #3 above.
- `docs/12-SCORING-REFERENCE.md` — PAR formula source of truth.
- `.claude/CLAUDE.md` §Data Contracts — the 9-field `MatchSetupConfig`
  lock cited in item #1.

Relevant precedent log entries (from `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`):

- P6-29 — execution-time empirical smoke test for version-sensitive
  external dependencies. Applies if WP-048 introduces any new npm
  dep whose behavior at the pinned version is uncertain (likely N/A
  — WP-048 as drafted introduces no new npm dep).
- P6-30, P6-31, P6-32 — UI-chain precedents from WP-061. None apply
  directly to WP-048 (engine-only), but WP-048's executor should be
  aware they exist so any WP-067/WP-062 handoff questions can be
  answered by pointing to them.

Steps completed for WP-061 (closed this session):
0: session-context-wp061.md (loaded at session start)
1: pre-flight (2026-04-17, READY TO EXECUTE)
2: session-wp061-gameplay-client-bootstrap.md (generated)
3: execution (2026-04-17, 13 new tests, 0 fail; 409 repo-wide, 0 fail)
4: post-mortem (clean; no fixes applied)
5: pre-commit review (2026-04-17, Safe to commit, procedural caveat
   recorded)
6: commit (`2e68530` EC-067: add apps/arena-client Vue 3 gameplay
   client bootstrap)
7: lessons learned (3 new precedent-log entries P6-30/31/32 in 01.4)
8: session-context-wp062.md (bridge into next UI-chain WP)

Run pre-flight for WP-048 next, resolving items #1–#4 above before
session-prompt generation.
