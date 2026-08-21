# WP-578 — Surface the Competitive Score on the Endgame Screen

**Status:** Draft 2026-08-21 — awaiting execution. **Reserves WP-578 / EC-613 / D-24387.** Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21) — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` — after an authenticated player finishes a ranked/casual match, the endgame panel now shows the competitive score the server just recorded (the same `finalScore` the leaderboards rank on), instead of only the outcome + in-game VP total. D-24026 live-verification applies.
**Primary Layer:** App (`apps/arena-client`) only — no engine, persistence, or hash surface.
**Dependencies:** WP-338/WP-339 (`useCompetitiveSubmitOnGameover` + `submitCompetitiveScore` — the one-shot gameover submit that already returns the score record); D-6701 (the deferred `par` projection, whose premise this WP confirms rather than overturns). All landed. Baseline `origin/main` at draft: `3dd6fbc9`.

---

## Goal

Show the player their competitive score on the endgame screen. Today the score is computed server-side on replay ingest (`parScoring.logic.ts`) and stored in `legendary.competitive_scores`, but it never reaches the player: `buildParBreakdown` (`ui/uiState.build.ts`) hard-returns `undefined` under D-6701, so `UIGameOverState.par` is always omitted and `EndgameSummary.vue` renders only the outcome, reason, and in-game VP total ("Final scores recorded (N players)"). A winner has to open `/api/me/scores` or their profile to learn their number. The submit path already hands the client the answer: `submitCompetitiveScore` returns `record: MyCompetitiveScore` (carrying `rawScore` + `finalScore`), but `useCompetitiveSubmitOnGameover` discards the record and keeps only a status flag. This WP surfaces that record in `EndgameSummary`.

## User-Visible Impact

An authenticated player who finishes a match sees, on the endgame panel, their competitive **final score** (the PAR-relative, lower-is-better value the leaderboards rank on) and raw score, with a plain-language label, once the automatic gameover submit completes. A guest — who never submits — sees the existing outcome + VP summary unchanged, with no score and no error. A pending or failed submit degrades to a "score pending" affordance, never a crash. No engine, persistence, scoring, or determinism change; the client only *displays* what the server already computed. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The submit client already returns the score record (rawScore + finalScore)
grep -q "record: MyCompetitiveScore" apps/arena-client/src/lib/api/competitionApi.ts && grep -q "readonly finalScore: number" apps/arena-client/src/lib/api/competitionApi.ts && echo "A_OK"
# Expected: A_OK

# B. The composable currently DISCARDS the record (returns only submissionStatus; the
#    field this WP adds does not exist yet). The negative grep targets the NEW field name,
#    not the word "record" (which appears in JSDoc) — see the WP-576 grep-self-trip lesson.
grep -q "return { submissionStatus }" apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts && ! grep -q "submittedScore" apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts && echo "B_OK"
# Expected: B_OK

# C. The par projection is still deferred (D-6701 premise intact — engine has no score at gameover)
grep -q "buildParBreakdown" packages/game-engine/src/ui/uiState.build.ts && echo "C_OK"
# Expected: C_OK

# D. PlayViewport is the sole composable host and renders PlayDesktop/PlayMobile (which render
#    EndgameSummary) — the live-route wiring path this WP threads the score along
grep -q "useCompetitiveSubmitOnGameover" apps/arena-client/src/pages/PlayViewport.vue && grep -qE "PlayDesktop|PlayMobile" apps/arena-client/src/pages/PlayViewport.vue && grep -q "name: 'EndgameSummary'" apps/arena-client/src/components/hud/EndgameSummary.vue && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §"Architectural Principles #2" (UI consumes read-only projections) and the UIState projection section — this WP does **not** add a projection field; it consumes a server API response the client already holds.
- `docs/ai/DECISIONS.md` — scan **D-6701** (the deferred `par` block; its premise is that the engine has no `ReplayResult` at gameover, which this WP *confirms*), **D-24387** (this WP's decision).
- `apps/arena-client/src/lib/api/competitionApi.ts` — `submitCompetitiveScore(authToken, matchId)` returns `SubmitScoreResult` with `record: MyCompetitiveScore | null` (present only on HTTP 200). `MyCompetitiveScore` carries `rawScore`, `finalScore`, `scenarioKey`, `createdAt` (no separate `parScore` field — `parScore = rawScore − finalScore` is derivable, but this WP renders `rawScore` + `finalScore` directly and does not re-derive).
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — fires the POST once per match on the `gameOver` marker; guests set `submissionStatus = 'guest'` and never POST; on 200 it sets `'submitted'`/`'already'` and **discards `result.record`**. Returns `{ submissionStatus }`.
- `apps/arena-client/src/pages/PlayViewport.vue` — the **sole invoker** of `useCompetitiveSubmitOnGameover` (line ≈161) and the live-route root (`App.vue` renders `<PlayViewport :match-id>` on the `live` route; `<ArenaHud>` is a **dev `fixture`-route sibling**, not on the live surface and not reachable from the composable). PlayViewport is the established `01.5` host for the shared composables (`useComboVfx`, adaptive music, bot-ally, deploy-check) and discriminates into `<PlayDesktop>` / `<PlayMobile>`.
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — renders the outcome / reason / "Final scores recorded (N players)" block; its header comment notes `par` is absent under D-6701. Rendered inside `PlayDesktop.vue` / `PlayMobile.vue` (children of PlayViewport). **`ArenaHud.vue` also mounts it, but only on the dev `fixture` route — it is NOT part of the live wiring path and is out of scope.**
- `docs/01-VISION.md` §20–26 (scoring / skill measurement) — surfacing the score to the player serves the skill-measurement goal; it changes no scoring math.

## Scope (In)

- **`apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts`** — additively expose the returned record: add a `submittedScore: Ref<MyCompetitiveScore | null>` to the composable's return, set it from `result.record` on HTTP 200 (`null` otherwise — guest, error, network, `par_not_published`). The one-shot submit trigger, `submissionStatus`, and guest/early-end skips are unchanged.
- **`apps/arena-client/src/components/hud/EndgameSummary.vue`** — accept an optional `competitiveScore` prop (`MyCompetitiveScore | null`). When present, render the competitive **final score** (labelled as the ranked, lower-is-better value) and raw score in plain language; when `null`/absent, render the existing outcome + VP summary unchanged. Raw marker text is never shown (no `gameText`/`abilityText` here). Route no value through `AbilityText.vue` — these are numbers.
- **`apps/arena-client/src/pages/PlayViewport.vue`** — the composable host: surface `submittedScore` from `useCompetitiveSubmitOnGameover` (it already destructures `submissionStatus` here) and pass it into `<PlayDesktop>` / `<PlayMobile>` as a prop. This is same-layer runtime wiring per `01.5`, on the file that already hosts the shared play-surface composables.
- **`apps/arena-client/src/pages/PlayDesktop.vue`** and **`apps/arena-client/src/pages/PlayMobile.vue`** — accept the score prop from PlayViewport and pass it to `<EndgameSummary>`. (`ArenaHud.vue` is NOT touched — it is the dev `fixture`-route mount, off the live surface.)
- **`apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts`** — assert `submittedScore` is set to the record on HTTP 200, and stays `null` for guest / non-200 / network-failure paths.
- **`apps/arena-client/src/components/hud/EndgameSummary.test.ts`** — assert the competitive score renders when the prop is present and is omitted (existing summary unchanged) when the prop is `null`.

## Out of Scope

- **Populating `UIState.par` / touching the engine.** D-6701's premise stands — the engine has no `ReplayResult` at gameover, so `buildParBreakdown` stays returning `undefined`. This WP reads a server API response, not a projection. No engine file changes.
- **Changing the submit trigger or its endpoint.** `useCompetitiveSubmitOnGameover` still POSTs once on `gameOver`; `submitCompetitiveScore` and `/api/competition/scores` are unchanged. No new fetch is added — the record is already in the submit result.
- **Recomputing any score client-side.** `rawScore` / `finalScore` are rendered as returned; the client never runs `parScoring.logic.ts` math.
- **Leaderboard / profile / handle display.** That is WP-579; this WP touches only the endgame panel.
- **Persistence, snapshots, hash oracles.** None are touched.

---

## Files Expected to Change

- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **modified** (expose `submittedScore` from the record)
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** (optional `competitiveScore` prop + render)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (composable host: surface `submittedScore`, prop it to PlayDesktop/PlayMobile; `01.5` wiring)
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** (accept the prop, pass to EndgameSummary; `01.5` wiring)
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** (accept the prop, pass to EndgameSummary; `01.5` wiring)
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — **modified** (record-surfaced / null-path assertions)
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** (render-when-present / omit-when-absent)
- `docs/ai/DECISIONS.md` — **modified** (land D-24387)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-578 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

App-only, single layer; the mount-point files are same-layer `01.5` runtime wiring, enumerated in the EC allowlist. Standard two-session lane (the scoring/leaderboard surface is excluded from the lightweight lane).

## Contract (Locked by D-24387)

- **Server-derived, client-displayed.** The endgame score is a read-only presentation of the `record` the server returned from the one-shot gameover submit. The client renders `rawScore` and `finalScore` verbatim and never recomputes them. D-6701 stays in force: `UIGameOverState.par` is **not** populated in `buildUIState`.
- **`finalScore` is the headline.** The ranked, PAR-relative, lower-is-better value is labelled as the competitive score; `rawScore` is shown as supporting detail.
- **Graceful absence.** Guests (`submissionStatus = 'guest'`, no POST), network failures (`status: 0`), `par_not_published`, and any non-200 leave `submittedScore` `null`; `EndgameSummary` then renders the existing outcome + VP summary with no score and no error. Casual/unranked matches still submit and still show the score (`is_ranked_eligible` is orthogonal to display).
- **Additive prop.** `EndgameSummary`'s new prop is optional; existing mounts that do not pass it render unchanged.

### Determinism / persistence

No determinism or persistence surface. This is a client-only display of an existing API response — no `G` field, no projection field, no `ctx.random`, no snapshot, no move. `finalStateHash` / `PRE_WP080` are untouched (no engine change). If any engine file appears in the diff, **STOP**.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names (`submittedScore`, `competitiveScore`), a `// why:` on the record-exposure explaining it feeds the endgame panel, no premature abstraction (the render block lives inline in `EndgameSummary`). ESM, Node v22+. `apps/arena-client` typecheck (`vue-tsc`) is gated. **Output discipline (engine-wide):** the executing session emits **full file contents** for every modified file — no diffs, no snippets, no "show only the changed section."

---

## Acceptance Criteria

1. `useCompetitiveSubmitOnGameover` returns `submittedScore` (a `Ref<MyCompetitiveScore | null>`) set to `result.record` on HTTP 200 and `null` on guest / non-200 / network-failure / `par_not_published`; the submit still fires at most once per match.
2. `EndgameSummary.vue` renders the competitive `finalScore` (labelled as the ranked, lower-is-better score) and `rawScore` when the `competitiveScore` prop is present.
3. When the prop is `null`/absent, `EndgameSummary` renders the pre-existing outcome + VP summary byte-for-byte unchanged (no score, no error).
4. The `submittedScore` value is threaded along the live-route path — `PlayViewport` (composable host) → `PlayDesktop` / `PlayMobile` → `EndgameSummary`'s prop. `ArenaHud.vue` (the dev `fixture`-route mount) is not modified.
5. No engine / persistence file is modified; no `UIState` field is added; `buildParBreakdown` still returns `undefined`.
6. `apps/arena-client` typecheck (`vue-tsc --noEmit`) exits 0; composable + EndgameSummary tests green; `pnpm -r --no-bail test` shows no new failures.

## Verification Steps

```bash
# 1. Composable now exposes the record; the submit trigger is unchanged
grep -nE "submittedScore|result\.record" apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts

# 2. EndgameSummary takes the optional prop and renders the score
grep -nE "competitiveScore|finalScore|rawScore" apps/arena-client/src/components/hud/EndgameSummary.vue

# 3. No engine / projection change leaked in
git diff --name-only | grep -E '^packages/game-engine' ; echo "expect none"

# 4. Typecheck + suites
pnpm --filter @legendary-arena/arena-client typecheck 2>&1 | tail -3
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -3
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: arena-client typecheck 0; composable + EndgameSummary tests green; no new failures

# 5. Live (post-deploy; D-24026): play.legendary-arena.com — finish a ranked match while
#    signed in; the endgame panel shows the competitive final score. A guest sees the
#    unchanged summary. Record in STATUS.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] `submittedScore` exposed from the record; guest/error paths leave it `null`; submit still one-shot
- [ ] `EndgameSummary` shows the score when present and is byte-unchanged when absent
- [ ] No engine / persistence / hash surface touched; `buildParBreakdown` still returns `undefined`
- [ ] `apps/arena-client` typecheck 0; composable + EndgameSummary tests green; `pnpm -r` otherwise no new failures
- [ ] `docs/ai/STATUS.md` Done entry names WP-578 and records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24387 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-578 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-613:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed on the deployed endgame panel (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (after draft-time correction, 2026-08-21)

Independent gate review verified the factual claims (`submitCompetitiveScore` returns `record: MyCompetitiveScore` with `rawScore` + `finalScore`; `useCompetitiveSubmitOnGameover` discards it; `buildParBreakdown` returns `undefined` — no fabricated symbols; app-only) and surfaced three defects that were **corrected in this draft**: (1) precondition B's `! grep "record"` self-tripped on JSDoc — **re-scoped** to the new field name (`submittedScore`), the WP-576 grep-self-trip lesson; (2) `PlayViewport.vue` — the **sole invoker** of the composable (≈line 161) and the only possible source of `submittedScore` — was missing from the allowlist — **added** as the `01.5` composable host; (3) `ArenaHud.vue` was named as the wiring target but is the dev `fixture`-route sibling, unreachable from the composable and off the live surface — **removed**; the wiring path and AC-4 are corrected to `PlayViewport → PlayDesktop/PlayMobile → EndgameSummary`. With these corrections the scope is locked.

### Copilot (`01.7`) — verdict: **PASS** (after draft-time correction, 2026-08-21)

Layer boundary (app-only; no engine import) — clean. Determinism (no `G`/projection field; `buildParBreakdown` stays `undefined`; hash untouched) — clean, verified at `uiState.build.ts`. Fail-soft (guest/pending/failed → unchanged summary, no throw) — clean. The initial BLOCK was on the incomplete/wrong allowlist (missing PlayViewport, unreachable ArenaHud) — **resolved** by correcting the allowlist to `{PlayViewport, PlayDesktop, PlayMobile, EndgameSummary, composable, +tests}` and citing PlayViewport as the established `01.5` host.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (2026-08-21)

§1 structure PASS (house `## Contract` substitutes for `## Non-Negotiable Constraints`, per WP-576/577). §2 output-discipline clause **added** (full files, no diffs). §3 Assumes PASS (A–D, B re-scoped). §5 Files PASS (allowlist corrected). §14 AC PASS (AC-4 corrected to the real render path). §15/§15.1 DoD PASS (STATUS + DECISIONS + indices + mindmap + D-24026). §17 Vision present (§20–26; determinism line). §20 / §21 N/A justified. No ❌ FAIL triggers.

---

## Vision Alignment

**Clauses touched:** §20–26 (scoring / skill measurement — the score becomes visible to the player who earned it), §3/§22 (determinism — no scoring math or replay behaviour changes; the client only displays a server-computed value). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it surfaces the existing competitive score without altering how it is computed, ranked, or stored. **Non-Goal proximity:** none of NG-1..NG-8 — no pay-gating, no player-interaction terms, no monetization; the score is shown to the player free. **Determinism preservation:** no engine, RNG, replay, or persistence change — the display reads an API response; `finalStateHash` / `PRE_WP080` untouched.

## Funding Surface Gate

**N/A** — an endgame display of an existing competitive score; no §20.1 funding surface, no funding copy, no funding channel. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint is added, modified, or removed, and no `apps/server/src/**` library function changes. The client consumes the existing `POST /api/competition/scores` response shape unchanged; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.

## Decision (reserved, lands at execution)

**D-24387 — surface-competitive-score-on-endgame.** Reserved in `NUMBER-LEDGER.md` at draft; the `DECISIONS.md` entry lands **Active** when the WP executes. Records: the score is server-derived and therefore surfaced client-side (D-6701 premise intact, `par` stays unpopulated); the endgame score is a read-only display of the server's computed `record`, never recomputed; guests / pending / failed submits degrade gracefully; casual/unranked still shows the score; no engine/persistence/hash change.
