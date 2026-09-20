# WP-718 — Synergy Realization: Table Cooperation client render (Arena Client)

**Status:** Done 2026-09-20 (EC-755; no new D — invariants locked by D-24540; **Lightweight
Lane**, single session). **Layer:** Arena Client only (a read-only render of an
already-served coach-report field). **Baseline:** `origin/main` @ `90b9a575` ·
**User-Visible Surface:** `play.legendary-arena.com` — the endgame coach panel
(`EndgameCoachPanel.vue`), a new "Table Cooperation" block. The deferred client-render
half of WP-717/D-24540 (mirrors the WP-710 → WP-713 split).

## Goal

Show the player the co-op recognition WP-717 already computes. WP-717 ships the
deterministic `CoachReport.tableCooperation` server-side but renders nothing; this WP
renders it in the endgame coach panel as a **"Table Cooperation"** block — one line per
recognition, verbatim, leading the report with the shared-win team framing (e.g. *"Your
table stopped Red Skull together — a shared victory."* + the standout co-op roles). When
the field is absent/empty (a pre-WP-717 cached report) the block is hidden. Nothing
changes the game, the score, or any hash.

## Context (Read First)

WP-717 was scoped server-only (Option B): produce `CoachReport.tableCooperation`, verify
via the coach API, defer the on-screen render. In practice that left the entire P3 payoff
invisible — a live match's coach showed no Table Cooperation block (operator report,
2026-09-20). This WP is the display half: a pure, additive render mirroring the WP-713
`sequenceTips` "Opportunities" block exactly. The client renders the server strings
verbatim; it composes nothing and re-evaluates no game state (D-20105). Placed first in
the coach report (after the model headline) so the shared-win framing leads.

## Scope (In)

- `apps/arena-client/src/lib/api/coachApi.ts` — add `readonly tableCooperation?: readonly
  string[]` to the client's own `CoachReport` mirror (additive optional; no server-type
  import, per the file header).
- `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` — a "Table Cooperation"
  block (`v-for` over `report.report.tableCooperation`, mirroring the Opportunities block)
  shown only when the array is non-empty; `data-testid="arena-hud-coach-table-cooperation"`,
  reusing `.coach-report-block` / `.coach-report-label` / `.coach-report-tips`.
- `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` — render one `<li>` per
  line when present; hidden on empty array; hidden when omitted (pre-WP-717 shape).

## Out of Scope

- Any engine / server / UIState / persistence / hash change (the field is already served).
- New coach content or re-computation (verbatim render; D-20105).
- Restyling beyond the added block; the model `headline`/`heroFit`/`purchases`/`suggestions`
  and the WP-713 Opportunities block are untouched.
- A copy-lint on the rendered block — the two-vocabulary copy is enforced at the source
  (WP-717's `computeTableCooperation` + its server tests); the client renders verbatim.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/arena-client/src/lib/api/coachApi.ts` | `+ tableCooperation?: readonly string[]` on the client `CoachReport` mirror |
| `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` | the guarded "Table Cooperation" block |
| `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` | render / hidden-empty / hidden-omitted |

Governance (same session, lightweight lane): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `STATUS.md`. No `api-endpoints.md` change
(WP-717 already recorded `tableCooperation` on the coach response shape; the client render
does not change the API). No `DECISIONS.md` (invariants locked by D-24540).

## Acceptance Criteria

1. The client `CoachReport` carries `tableCooperation?: readonly string[]`; `vue-tsc --noEmit` clean.
2. When `tableCooperation` is non-empty, the panel renders a "Table Cooperation" block with
   one `<li>` per line (verbatim), under `data-testid="arena-hud-coach-table-cooperation"`.
3. The block is absent when `tableCooperation` is an empty array AND when omitted (pre-WP-717 shape).
4. `git diff --name-only` is confined to the three `apps/arena-client/**` files + governance.

## Verification Steps

1. `pnpm --filter @legendary-arena/arena-client test` → green (render / hidden cases).
2. `pnpm -r build` (rebuilds the engine dist the client typechecks against) + `vue-tsc --noEmit` → clean.
3. `pnpm -r build` 0; `git diff --name-only` = the allowlist + governance.
4. **Live-verify (operator-pending, post-deploy, D-24026):** open "Get AI coaching" on the
   real 2p Red Skull match; the coach panel leads with the Table Cooperation block
   ("stopped Red Skull together" + Player 2 carried combat/synergy/rescue + the combined
   total). Freshly-generated report (a pre-WP-717 cached report has no field).

## Definition of Done

- [x] All ACs met; arena-client suite green (11/11 coach panel, +3; 1864/0 full); `vue-tsc` clean.
- [x] `git diff --name-only` = the 3 arena-client files + governance (no engine/server).
- [x] `pnpm -r build` 0.
- [x] Lightweight-lane two-commit topology (`EC-755:` impl + `SPEC:` close); WORK_INDEX `[x]`;
      EC_INDEX `Done`; roadmap `✅`; `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS.
- [ ] Live-verify (D-24026) performed or explicitly operator-pending.

## Lightweight Lane Eligibility (confirmed at govern-close)

- Single layer, single app (arena-client). ✓
- 3 code/test files, no runtime-wiring file. ✓
- No `01.6` trigger (no new contract/abstraction/builder/category). ✓
- No new contract file. ✓
- No D-entry (invariants locked by D-24540). ✓
- Surface = UX render of a served field; no scoring / PAR / identity / RNG / determinism. ✓
- **Empirical (confirmed):** strictly additive (a new guarded block + an optional mirror
  field); zero determinism/persistence/hash impact; the file budget holds at the final
  `git diff --name-only`. ✓

## Scaffold / Verification Result (empirical independence)

Implemented and ran the affected suite: `EndgameCoachPanel.test.ts` 11/11 (+3: render /
hidden-empty / hidden-omitted); full arena-client 1864/0; `vue-tsc --noEmit` clean **after
`pnpm -r build`** (a stale engine dist first surfaced pre-existing `EndgameSummary.vue`
`synergyContributions` errors from the parallel WP-715/#2196 engine change — a build-order
artifact, not this WP; resolved by rebuilding the dist). Strictly additive; no existing
test changed.

## Lint Gate Self-Review (00.3)

All applicable sections PASS/N-A: structure, non-negotiable constraints (verbatim render,
client-only, additive, off-ranking display), assumes (WP-717 served field + the WP-713
render precedent), files (3-file allowlist), naming (`CoachReport`, `tableCooperation`,
`EndgameCoachPanel`, `.coach-report-tips` — verified), dependency discipline (WP-717 ✅
#2197), architectural boundaries (arena-client only; no server import; no re-computation,
D-20105), test quality (`node:test` via the app runner; render + both hidden cases), DoD,
code style, vision (§1/§3, NG-1). §20 funding N/A. §21 API N/A (WP-717 recorded the field).
