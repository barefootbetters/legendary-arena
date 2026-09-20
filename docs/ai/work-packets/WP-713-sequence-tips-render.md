# WP-713 — Synergy Realization: sequence-tips client render (Arena Client)

**Status:** Draft 2026-09-19 (EC-750; **D-24536** reserved)
**Layer:** Arena Client only (a read-only render of an already-served coach-report
field — no engine, server, UIState, persistence, or hash surface). **Lane:** Standard
two-session (drafted as a separate follow-up per operator request; **lightweight-lane
eligible** — single app, strictly additive, ≤ 4 files, no determinism/scoring/identity
— so the execution session MAY collapse to the single-session lane if the confirmed
criteria hold). **Baseline:** `origin/main` @ `89150ae0` · **User-Visible Surface:**
`play.legendary-arena.com` — the endgame coach panel (`EndgameCoachPanel.vue`), a new
forward "Opportunities" block. **Design of record:**
`docs/ai/DESIGN-SYNERGY-REALIZATION.md` §3.3. The deferred **Option-B client render**
half of WP-710/D-24533.

## Goal

Show the player the play-order coaching WP-710 already computes. WP-710 (Option B)
ships the deterministic `CoachReport.sequenceTips` field server-side but renders nothing;
this WP renders those tips in the endgame coach panel as a forward **"Opportunities"**
block — one line per tip, in the same celebrate/opportunity voice as the model's "Next
time" suggestions — so a player who sequenced a synergy sub-optimally sees, e.g., *"Next
time, play Perfect Teamwork before Marvelous Strength — you'd have landed its strength
synergy bonus."* The strings are rendered verbatim; the client composes no coaching text
and re-evaluates no condition. When the match produced no tips (the common case) the
block is hidden. Nothing changes the game, the score, or any hash.

## Assumes

- **WP-710 / D-24533 shipped `CoachReport.sequenceTips` (on `main`, #2185).** The
  server computes deterministic play-order tips and merges them onto the persisted +
  served `CoachReport` before `writeCoachReport`, so `GET /api/me/scores/:replayHash/coach`
  returns `{ report: { headline, heroFit, purchases, suggestions, sequenceTips? }, model,
  generatedAt }` on both the fresh and cache-hit paths (`api-endpoints.md` records the
  shape). `sequenceTips` is an additive optional field — a report cached before WP-710
  returns it `undefined`.
- **The client passes coach-report JSON through untyped, then reads it via a structural
  mirror.** `apps/arena-client/src/lib/api/coachApi.ts` declares its OWN `CoachReport`
  interface (the header forbids importing server-layer types); `fetchCoachReport`
  returns the parsed JSON. An unknown key already survives the fetch — this WP only
  adds the field to the client mirror and renders it.
- **The render surface + flow exist (WP-594).** `EndgameCoachPanel.vue`
  (`src/components/hud/`) renders the report via the `useEndgameCoach` composable
  (`src/composables/useEndgameCoach.ts`), which stores the `StoredCoachReport` in a
  `report` ref; the template reads `report.report.suggestions` in a `v-for` under a
  "Next time" label (lines 95-100). The new block mirrors that pattern reading
  `report.report.sequenceTips`.
- **No coach-panel copy-lint exists yet.** The only two-vocabulary assertion
  (`EndgameSummary.test.ts`) scans `[data-testid="arena-hud-per-player"]`, NOT the coach
  panel. This WP adds the banned-word assertion for the new opportunities block.

## Context (Read First)

**Why a separate WP.** WP-710 was scoped Option B by operator decision: ship the
server + engine plumbing first, verify the served `CoachReport.sequenceTips` via the
coach API, and defer the on-screen render to this named follow-up. The field already
reaches the client verbatim; this WP is the display half — small, additive, single-app.

**Why verbatim render, never client composition.** The tips are deterministic server
strings (D-20105 — the engine/server own condition semantics; the client re-evaluates
nothing). The client's job is presentation only: iterate the array, render each string,
hide the block when empty. This keeps the two-vocabulary invariant enforced at the
source (the server tip copy) and adds a client-side copy-lint as a second guard.

**Placement + voice.** The opportunities block sits inside the existing coach-report
block, after the model's "Next time" suggestions, under an "Opportunities" label,
styled like `.coach-report-tips`. It is forward/celebratory — the server strings already
avoid `whiff`/`failed`/`error`/`missed`/`wasted`; the added copy-lint holds the rendered
block to the same rule.

**Hidden-when-empty.** Most matches produce zero tips (a tip needs a real net-gain
reorder). The block renders only when `sequenceTips` is a non-empty array — mirroring
the WP-708/709 "hidden at zero" display pattern, and correctly hiding for pre-WP-710
cached reports where the field is `undefined`.

## Scope (In)

- `apps/arena-client/src/lib/api/coachApi.ts` — add `readonly sequenceTips?: readonly
  string[]` to the client's `CoachReport` interface (additive optional; structural
  mirror of the server field).
- `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` — render an
  "Opportunities" block (a `v-for` over `report.report.sequenceTips`, mirroring the
  existing `suggestions` block) shown only when the array is present and non-empty; a
  `data-testid="arena-hud-coach-opportunities"` hook + reuse of the `.coach-report-tips`
  styling.
- `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` — assert: the block
  renders one `<li>` per tip when `sequenceTips` is present; the block is absent when
  `sequenceTips` is empty AND when it is omitted (pre-WP-710 report shape); a copy-lint
  scanning the rendered opportunities block for none of
  `whiff`/`failed`/`error`/`missed`/`wasted`.

## Out of Scope

- **Any engine / server / UIState / persistence change.** The field is already served;
  this WP is client-render only. No `apps/server/**`, no `packages/**`.
- **New coach content or re-computation.** The client renders the server strings
  verbatim; it never composes tip text or re-evaluates a condition (D-20105).
- **Restyling the coach panel** beyond adding the opportunities block (reuse existing
  `.coach-report-*` styles).
- **Model-authored phrasing / the `suggestions` block** — untouched.
- **Cross-seat / co-op cooperation** (Phase 3), scoring / PAR / grade, or any funding /
  entitlement surface (the panel's Legendary-Pass gate is pre-existing and unchanged).

## Files Expected to Change

| File | Change |
|---|---|
| `apps/arena-client/src/lib/api/coachApi.ts` | `+ readonly sequenceTips?: readonly string[]` on the client `CoachReport` interface |
| `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` | render the "Opportunities" block (`v-for` over `report.report.sequenceTips`, shown only when non-empty; `data-testid` + reused styling) |
| `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` | tips-render / hidden-when-empty / hidden-when-omitted / copy-lint assertions |

Governance (land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24536 Active), `NUMBER-LEDGER.md` (mark landed), `STATUS.md`. No
`api-endpoints.md` change (no endpoint surface changes — the response shape was already
recorded by WP-710).

## Contract

- **Client `CoachReport.sequenceTips?: readonly string[]`** — additive optional; the
  structural mirror of the server field. Absent/empty ⇒ no block.
- **Endgame coach panel** — when `report.report.sequenceTips` is a non-empty array, an
  "Opportunities" block renders one `<li>` per tip, verbatim, under
  `data-testid="arena-hud-coach-opportunities"`; otherwise the block is not in the DOM.
  No other panel behavior changes.

## Non-Negotiable Constraints

- **Verbatim render, never client composition (D-20105).** The client iterates and
  displays the server strings; it composes no tip text and re-evaluates no condition.
- **Opportunity voice / two-vocabulary.** The rendered opportunities block shows none of
  `whiff`/`failed`/`error`/`missed`/`wasted` (a new client copy-lint, since none covers
  the coach panel today).
- **Hidden when empty/absent.** The block renders only for a non-empty `sequenceTips`
  array — correct for the no-tip common case and for pre-WP-710 cached reports where the
  field is `undefined`.
- **Client-only; additive.** No engine / server / UIState / persistence / hash surface;
  no change to `finalScore` / PAR / grade (NG-1, display-only).
- **App standing rules.** `.claude/rules/code-style.md` + `00.6-code-style.md`
  (human-style, `// why:` where non-obvious); `EndgameCoachPanel.vue` keeps its
  `defineComponent` form (per its existing vue-sfc-loader `// why` note); `.test.ts` on
  `node:test` via the app's `vue-sfc-loader/register` runner; `vue-tsc --noEmit` clean.

## Vision Alignment

- **§1 Rules Authenticity / skill growth** — surfaces the play-order coaching the engine
  already rewards, making the deepest synergy layer visible to the player.
- **§3 Player Trust & Fairness** — deterministic, seat-symmetric, opportunity-framed;
  renders only real net-gain tips the server produced.
- **NG-1 no pay-to-win** — pure skill coaching display, never a score/ranking term.

## Acceptance Criteria

1. The client `CoachReport` interface carries `sequenceTips?: readonly string[]`
   (additive optional) and `vue-tsc --noEmit` is clean.
2. When the fetched report's `sequenceTips` is a non-empty array, the panel renders an
   "Opportunities" block with one `<li>` per tip (verbatim), under
   `data-testid="arena-hud-coach-opportunities"` — asserted via a mounted-component test
   with a stubbed fetch returning a `sequenceTips` fixture.
3. The opportunities block is absent from the DOM when `sequenceTips` is an empty array
   AND when the field is omitted entirely (the pre-WP-710 report shape).
4. **Copy-lint:** the rendered opportunities block contains none of
   `whiff`/`failed`/`error`/`missed`/`wasted`.
5. No engine/server/UIState/persistence change — `git diff --name-only` is confined to
   the three `apps/arena-client/**` files + governance.

## Verification Steps

1. `pnpm --filter @legendary-arena/arena-client test` → green (render / hidden / copy-lint).
2. `pnpm --filter @legendary-arena/arena-client exec vue-tsc --noEmit` → clean.
3. `pnpm -r build` 0; `git diff --name-only` = the allowlist + governance.
4. **Live-verify (operator-pending, post-deploy, D-24026):** play (or open) the real 2p
   Red Skull / Midtown match's endgame; the coach panel shows an "Opportunities" line
   *"play Perfect Teamwork before Marvelous Strength …"* (turn 36.2) and no line for the
   turn-33.2 mutually-enabling pairs. Target a freshly-generated report (a report cached
   before WP-710 returns `sequenceTips` `undefined` → no block).

## Definition of Done

- [ ] All ACs met; arena-client suite green (pass delta recorded); `vue-tsc` clean.
- [ ] `git diff --name-only` = the three arena-client files + governance (no engine/server).
- [ ] `pnpm -r build` 0.
- [ ] D-24536 flipped Active; WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `📝`→`✅`;
      `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS close-out.
- [ ] Two-commit topology (EC-750 impl + SPEC close) — or the lightweight-lane
      single-PR two-commit topology if the executor confirms lane eligibility.
- [ ] Live-verify (D-24026) performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24536** — Synergy Realization: arena-client render of the WP-710/D-24533
`CoachReport.sequenceTips` as the endgame "Opportunities" block (the deferred Option-B
client-render half). Locks: (1) client-only — reads the already-served optional field,
no engine/server change, no condition re-evaluation on the client (D-20105); (2)
verbatim render — the client never composes tip text; (3) the block is hidden when the
field is absent/empty; (4) opportunity-voice copy-lint (a new client guard, since no
coach-panel copy-lint exists today); (5) display-only, off-ranking (NG-1). Entry lands
at WP-713 execution. See DECISIONS.md and `DESIGN-SYNERGY-REALIZATION.md` §3.3.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all sections; ≥ 2 Out-of-Scope exclusions).
- **§2 Non-Negotiable Constraints** — PASS (verbatim/no-recompute + opportunity voice +
  hidden-when-empty + client-only/additive + standing rules).
- **§3 Assumes** — PASS (each cites its locking WP/D + exact paths: WP-710 served field,
  the client `CoachReport` mirror, the render flow, the missing coach copy-lint).
- **§4 Context** — PASS (why-separate, verbatim-render rationale, placement/voice, hidden-when-empty).
- **§5 Files** — PASS (closed 3-file allowlist; governance called out; no engine/server).
- **§6 Naming Consistency** — PASS (`CoachReport`, `StoredCoachReport`, `fetchCoachReport`,
  `useEndgameCoach`, `EndgameCoachPanel`, `suggestions`, `.coach-report-tips`,
  `arena-hud-coach-report` — verified against the recon of `origin/main`).
- **§7 Dependency Discipline** — PASS (single hard-dep WP-710/D-24533 on `main`, #2185).
- **§8 Architectural Boundaries** — PASS (arena-client only; reads served JSON; no
  server/registry/engine import; no client condition re-evaluation, D-20105).
- **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — the panel's Legendary-Pass gate
  is pre-existing and unchanged (additive render only).
- **§12 Test Quality** — PASS (`node:test` via the app runner; render + both hidden cases
  + copy-lint; a fixture with `sequenceTips`).
- **§13 Commands & Verification** — PASS (runnable steps + live-verify with the real match).
- **§14 Acceptance Criteria Quality** — PASS (5 testable, non-vacuous ACs incl. both hidden cases).
- **§15 Definition of Done** — PASS (binary gates; two-commit / lightweight topology).
- **§16 Code Style** — PASS (human-style, `defineComponent` kept, `// why:` where non-obvious).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1).
- **§18 Prose-vs-Grep Discipline** — PASS.
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `89150ae0`).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; the panel's
  Legendary-Pass gate is pre-existing and unchanged).
- **§21 API Catalog Update** — N/A (no endpoint surface change; the coach response shape
  was recorded by WP-710).

**Pre-flight verdict:** READY TO EXECUTE (see Gate Verdicts).
**Copilot check verdict:** PASS / CONFIRM (see Gate Verdicts).

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent). No blocking PS-items.
  Every load-bearing claim verified against real code on `origin/main` @ `89150ae0`:
  WP-710 shipped the served `CoachReport.sequenceTips?` (`coach.types.ts:110-116`,
  `coach.logic.ts:167-170` merged before persist on both fresh + cache paths,
  `api-endpoints.md:301` records it); the client mirror `coachApi.ts:26-31` forbids
  server-type imports; `EndgameCoachPanel.vue:95-100` renders `suggestions` in the
  `v-for` to mirror; **no** coach-panel copy-lint exists (only `EndgameSummary.test.ts`
  scans `arena-hud-per-player`); the 3-file allowlist is correctly scoped
  (`coachApi.test.ts` `STORED` omits the optional field so `deepEqual` still passes — no
  edit needed; `useEndgameCoach.ts` is a pure `StoredCoachReport` passthrough — the
  optional field flows through with no edit); arena-client-only, determinism/hash N/A.
  Three non-blocking RS nits: (1) `:key="tip"` duplicate-key risk — kept, mirrors the
  existing `suggestions` block precedent; (2) the copy-lint fixture should use realistic
  tip prose so the scan isn't vacuously green — **folded** into EC Common Failure Smells;
  (3) live-verify needs a freshly-generated report — already flagged operator-pending.
  The only post-verdict edit was the RS-2 fold (additive EC guidance; no scope / contract
  / allowlist change), so no pre-flight re-run is warranted.
- **Copilot (01.7): PASS / CONFIRM** (independent subagent). All 30 modes scanned;
  clean PASS on boundary / determinism (N/A) / mutation (N/A) / persistence (N/A) /
  scope / extensibility / documentation / error-handling. Every load-bearing claim
  verified TRUE against `origin/main` @ `89150ae0` (WP-710's served optional field +
  cache-hit path + `api-endpoints.md` note; the client mirror forbidding server-type
  imports; the `suggestions` `v-for` to mirror; the absent coach-panel copy-lint;
  `coachApi.test.ts` `STORED` omits the field so `deepEqual` still passes;
  `useEndgameCoach.ts` pure passthrough; D-20105 correctly cited). Two minor RISK nits,
  both already handled and consistent with shipped precedent: the copy-lint scans an
  author-chosen fixture (real invariant enforced server-side; RS-2 realistic-prose fold
  addresses it) and `:key="tip"` (mirrors the existing `suggestions` block). No BLOCK, no
  mandatory governance follow-up, no pre-flight re-run warranted. Pre-flight READY
  CONFIRMED; session-prompt generation authorized.
