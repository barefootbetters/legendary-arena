# WP-752 — AI Coach panel on unscored matches + guest prompt copy (Arena Client)

**Status:** Draft 2026-09-23 (EC-789; implements D-24576 client-side, landed by WP-751)
**Primary Layer:** Arena Client (`apps/arena-client/src/**`)
**Dependencies:** **WP-751** (the matchId coach route) — this WP is **BLOCKED until WP-751 is Done**. Also WP-594/595 (coach + panel) ✅, WP-465 (submission statuses) ✅, WP-636 (guest recap) ✅.
**User-Visible Surface:** play.legendary-arena.com
**Baseline:** `origin/main` @ `fbdbea57` (+ the #2309 reservation)

---

## Goal

- **Pass holders** who finish a casual match get the AI Coach on the end screen.
- **Players without the Pass** see what the Pass would add.
- **Guests** learn what signing in gets them on future matches.

---

## User-Visible Impact

1. **Signed-in, unscored, normally finished matches** show the AI Coach panel after the
   result recap.
   - Pass holders get the "Get coaching" button, which calls WP-751's matchId route.
   - Everyone else sees the existing Legendary Pass teaser.
2. **The unscored-match (`ineligible`) banner** stops implying the coach needs a gauntlet
   loadout. It reads: "…The score report card is available on ranked-gauntlet loadouts."
3. **The guest in-card prompt** says what signing in actually gets on future matches:
   saved results, the score report card on ranked-gauntlet loadouts, and AI coaching
   with the Legendary Pass.

Scored matches are unchanged.

---

## Assumes

Verified at `fbdbea57` by the WP-752 pre-flight:

- **Coach panel.** `EndgameCoachPanel.vue` takes a `replayHash` prop and drives
  `useEndgameCoach(replayHash, deps)`.
  - The composable (`useEndgameCoach.ts:73`) reads the Pass from `/api/me/entitlements`.
  - It fetches via `fetchCoachReport` → `GET /api/me/scores/:replayHash/coach`
    (`coachApi.ts:94–103`).
  - `EndgameCoachDependencies` is at `useEndgameCoach.ts:46–55`.
  - The panel passes deps at `EndgameCoachPanel.vue:27–31`, with an `as Ref` cast.
- **`useEndgameCoach.test.ts`.** About 9 call sites pass `ref('replay-1')` (L49–141).
  `vue-tsc` checks test files too (`tsconfig` includes `src/**/*`, with
  `exactOptionalPropertyTypes`).
- **End-of-match summary (`EndgameSummary.vue`).**
  - The coach panel mounts only when
    `v-if="competitiveScore && competitiveScore.replayHash"` (~L625).
  - The guest prompt shows when `v-if="showGuestSignIn && !competitiveScore"` (~L637–652).
    Its `aria-label` is "sign in to save your score" (L640).
  - The recap lives inside `<div v-if="hasScores && gameOver.scores">` (~L674–728).
  - Props: `gameOver`, `competitiveScore`, `showGuestSignIn`, `seatIdentities`.
  - Mounted at `PlayDesktop.vue:751` and `PlayMobile.vue:507`.
- **`PlayViewport.vue`.**
  - Holds `matchId` and `submissionStatus`.
  - Forwards `matchId` to **PlayDesktop only** (L418–431; D-16501).
  - Already has `isEndedEarly` (L303–305) and `isGuestResult` (L246).
  - Its test file is `pages/PlayViewport.test.ts`.
- **Where `ineligible` comes from (`useCompetitiveSubmitOnGameover`).** It is set only at
  L95–98 (an early end) and L120–128 (`par_not_published`).
  - The early-end check runs **before** the guest check. A guest who ends early therefore
    gets `ineligible`, not `guest`, and the `isEndedEarly` condition is what keeps them
    out of the casual panel.
- **SFC named exports are testable.** Named exports from a `.vue` file work in tests
  through vue-sfc-loader (`VfxOverlay.vue:151` `buildBurstOptions`, imported in
  `VfxOverlay.test.ts:10`).
- **No test pins the copy being replaced.** None asserts the current guest copy or the
  `ineligible` string.
- **The `ineligible` banner text is whatever `main` holds at execution.** Open PR #2308
  may or may not have landed; this WP replaces the string either way.
- **ewiki #2310 is merged**, so the `wiki/scoring.md` "Which end-of-match view you get"
  table exists for the govern-close edit. If #2310 still isn't merged at govern-close,
  merge it first. Never hand-author the table in the `SPEC:` commit.
- **Baseline.** arena-client `pnpm --filter @legendary-arena/arena-client typecheck` exits
  0 and the suite is green. The executor records the counts.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- WP-751 (the route; D-24576, including its cache-order rule).
- Source files:
  - `apps/arena-client/src/components/hud/{EndgameSummary,EndgameCoachPanel}.vue`, plus
    their tests
  - `composables/useEndgameCoach.ts`, plus its test
  - `lib/api/coachApi.ts`, plus its test
  - `pages/{PlayViewport,PlayDesktop,PlayMobile}.vue`, plus `PlayViewport.test.ts`
- `docs/ai/DECISIONS.md`: D-24403, D-24404, D-16501, D-24120, D-24306.

**Why one `casualCoachMatchId` prop.** The rule needs `submissionStatus`, which only
`PlayViewport` holds. It computes the rule once and passes the result down; the children
only render it.

**Why only `ineligible`.**
- **`failed`** mixes transient and permanent errors, so the match might still score.
- **`submitting`** hasn't settled yet.
- **`ineligible` is permanent and non-scoring.** Showing the casual panel only then also
  honors D-24576's cache-order rule: casual coaching is requested only after submit has
  settled as permanently unscored, so a casual report can never be cached for a match
  that is about to be scored.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious choices,
  no branching `.reduce()`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Env:** no new variables.

**Packet-specific:**
- **Scored path unchanged.** When `competitiveScore` exists, the panel still keys by
  `replayHash`.
- **Casual panel gate.**
  - It renders only when `competitiveScore` is null **and** `casualCoachMatchId` is
    non-null.
  - It is a **sibling after** the recap `div`, not nested inside it.
  - It reuses the panel's existing scoped styles and aria labelling.
- **Guest copy promises future signed-in matches only** (D-24120). The copy is locked
  (see Contract).
- **No server edits.** WP-751 owns the server.

---

## Scope (In)

### A) `lib/api/coachApi.ts` (**modified**)
- New `fetchCoachReportForMatch(token, matchId)` →
  `GET /api/me/matches/${encodeURIComponent(matchId)}/coach`, with the same parsing and
  typed errors as `fetchCoachReport`.

### B) `composables/useEndgameCoach.ts` (**modified**)
- New exported type
  `CoachTarget = { kind: 'replay'; replayHash: string } | { kind: 'match'; matchId: string }`.
- The first parameter becomes `Readonly<Ref<CoachTarget | null>>`.
- `EndgameCoachDependencies` gains a **required** `fetchCoachReportForMatch`, shaped like
  `fetchCoachReport` but taking `matchId`.
- A `replay` target calls `fetchCoachReport`; a `match` target calls
  `fetchCoachReportForMatch`.
- Pass logic is unchanged.

### C) `components/hud/EndgameCoachPanel.vue` (**modified**)
- Props: `replayHash` and `matchId`, both typed `String as () => string | null` with
  `default: null`.
- It builds a `computed<CoachTarget | null>`. `replayHash` wins when both are set.
- It passes the real `fetchCoachReportForMatch` in deps.
- The `as Ref` cast is removed. Render logic is unchanged.

### D) `components/hud/EndgameSummary.vue` (**modified**)
- New prop `casualCoachMatchId`, typed `String as () => string | null` with
  `default: null`.
- Mounts `<EndgameCoachPanel :match-id="casualCoachMatchId">` when
  `!competitiveScore && casualCoachMatchId !== null`, as a sibling after the recap `div`.
- Guest prompt: the headline, detail and `aria-label` all change to the Contract text.

### E) `pages/PlayViewport.vue` (**modified**)
- **Named export**
  `computeCasualCoachMatchId(matchId: string, submissionStatus: SubmissionStatus, isEndedEarly: boolean): string | null`,
  per the Contract rule, with a `// why:`.
- Computed from `matchId`, `submissionStatus` and the existing `isEndedEarly`.
- Passed to both PlayDesktop and PlayMobile.
- The `ineligible` message is replaced with the Contract text, whatever it currently says.

### F) `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` (**modified**)
- Accept `casualCoachMatchId` and forward it to `EndgameSummary`.

### G) Tests (**modified**)
- **`lib/api/coachApi.test.ts`**
  - `fetchCoachReportForMatch` hits the matchId URL (encoded) and parses and errors the
    same way as `fetchCoachReport`.
- **`composables/useEndgameCoach.test.ts`**
  - Existing call sites move to `ref({ kind: 'replay', replayHash: 'replay-1' })`.
  - `makeDeps` adds `fetchCoachReportForMatch`.
  - New: a `match` target routes to `fetchCoachReportForMatch`, and a `replay` target
    still routes to `fetchCoachReport`.
- **`components/hud/EndgameCoachPanel.test.ts`**
  - The `matchId` prop fetches via the match route.
  - The `replayHash` prop is unchanged, and wins when both props are set.
- **`components/hud/EndgameSummary.test.ts`**
  - The casual panel shows when `casualCoachMatchId` is set and there is no score.
  - It is hidden when there is a score, and when `casualCoachMatchId` is null.
  - The new guest headline, detail and aria-label render.
- **`pages/PlayViewport.test.ts`**: the `computeCasualCoachMatchId` truth table.
  - `ineligible` + not ended early → the id.
  - `ineligible` + ended early → `null`.
  - `guest`, `failed`, `submitted`, `already`, `submitting` and `idle` → `null`.
  - An empty `matchId` → `null`.

---

## Out of Scope

- The server route and casual coaching logic (WP-751).
- New casual report-card numbers (no score, grade or PAR).
- The recap's content (WP-715/636 unchanged).
- Guest coaching, and any retroactive claim of a guest match.
- **Existing issue, not fixed here:** an early-ended ranked-gauntlet match also maps to
  `ineligible`, so its banner wrongly says "isn't part of a ranked gauntlet". This needs
  a separate follow-up (an early-end-specific message).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/coachApi.ts` — **modified** — `fetchCoachReportForMatch`
- `apps/arena-client/src/lib/api/coachApi.test.ts` — **modified** — matchId fetcher tests
- `apps/arena-client/src/composables/useEndgameCoach.ts` — **modified** — `CoachTarget` + dep
- `apps/arena-client/src/composables/useEndgameCoach.test.ts` — **modified** — call-site migration + target routing
- `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` — **modified** — `matchId` prop
- `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` — **modified** — match vs replay route
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — casual mount + guest copy
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — casual show/hide + guest copy
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — `computeCasualCoachMatchId` + banner + forward
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — truth table
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — forward prop
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — forward prop

These 12 files are the whole `EC-789:` commit; no other files may be modified in it.

The govern-close `SPEC:` commit edits:
- STATUS, WORK_INDEX, EC_INDEX and `docs/05-ROADMAP-MINDMAP.md`
- `wiki/scoring.md`: in the "Which end-of-match view you get" table, the casual row's AI
  Coach cell changes from "❌ today → ✅ planned" to "✅". The planned paragraph becomes
  shipped. Wiki gates must pass.

---

## Contract

- **`computeCasualCoachMatchId`**
  - Returns `matchId` when `matchId !== ''` && `submissionStatus === 'ineligible'` &&
    `isEndedEarly === false`.
  - Otherwise returns `null`.
- **`CoachTarget`** = `{ kind: 'replay'; replayHash: string } | { kind: 'match'; matchId: string }`.
  `replayHash` wins when both are present.
- **`ineligible` banner (exact):** "This match isn’t part of a ranked gauntlet, so it isn’t
  scored to the leaderboard. The score report card is available on ranked-gauntlet
  loadouts."
- **Guest prompt (exact):**
  - Headline: "Sign in to save your results"
  - Detail: "You played this match as a guest, so it wasn’t saved. Signed-in matches keep
    your results, ranked-gauntlet loadouts earn a full score report card, and Legendary
    Pass holders get AI coaching on every match played to the end."
  - `aria-label`: "sign in to save your results"
  - CTA unchanged ("Sign in" → `?route=login`).

---

## Vision Alignment

- **Vision clauses touched:**
  - §3: trust — honest copy about what each state gets
  - §17: accessibility — the aria-label is updated to match
  - §19: AI analysis support — the coach reaches more matches
  - NG-1
  - Financial Sustainability: the Pass is visible and useful on more matches, and the
    guest copy works as a sign-up hook
- **Conflict assertion:** No conflict — this WP preserves all touched clauses.
- **Non-Goal proximity:** NG-1..7 not crossed.
  - The teaser is the existing, non-urgent component (NG-6).
  - The guest copy states plainly what signing in and the Pass provide, with no
    scarcity, countdown or guilt framing (NG-6, NG-7).
  - No new price or purchase flow.
- **Determinism:** client-only; no engine, RNG or replay change.

## Funding Surface Gate

**N/A.** This expands where the existing Legendary Pass teaser is shown and names the
Pass in the guest copy. It adds no funding affordance to global nav, the registry or the
profile, no tournament-funding channel, and no donate/support copy (§20.1). Authority:
WP-097 / D-9701 / D-9801.

## API Catalog

N/A — no endpoint added or changed; this WP consumes WP-751's catalogued route.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] A signed-in, `ineligible`, normally finished match shows the AI Coach panel.
  - A Pass holder fetches coaching via the matchId route.
  - A player without the Pass sees the teaser.
- [ ] Guest, `failed`, ended-early and scored matches show no casual panel, and the scored
  panel is unchanged.
- [ ] The banner, guest headline, detail and aria-label render the exact Contract copy.
- [ ] The `replayHash` path still calls `/api/me/scores/:replayHash/coach`.
- [ ] The `computeCasualCoachMatchId` truth table passes.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0, the suite is green
  (counts recorded), and the `EC-789:` diff equals the 12 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exit 0; new casual-panel / copy / truth-table cases pass

Select-String -Path "apps\arena-client\src\lib\api\coachApi.ts" -Pattern "/api/me/matches/"
# Expected: the new fetcher

Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "The score report card is available on ranked-gauntlet loadouts"
# Expected: one match (the new banner)

Select-String -Path "apps\arena-client\src\components\hud\EndgameSummary.vue" -Pattern "competitive grade and track your results"
# Expected: zero matches (the old guest copy is gone)

git diff --name-only
# Expected (implementation commit): exactly the 12 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com, after WP-751 and this
  WP deploy:**
  - A Pass holder finishes a casual match, sees the AI Coach panel, and gets coaching
    with no score or grade.
  - A guest sees the new prompt.
  - Both results are recorded in STATUS.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md`: no new entry. Confirm D-24576 is Active (landed by WP-751).
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are in the `EC-789:` commit.
- [ ] `WORK_INDEX.md` has WP-752 `[x]`, and `EC_INDEX.md` has EC-789 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node moves from `📝` to `✅`, then run
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] `wiki/scoring.md` casual row updated to shipped; wiki gates pass.

---

## Reserved Decision

None of its own; this WP implements the client half of **D-24576** (landed by WP-751).

---

## Lint Gate Self-Review (00.3)

Independent reviewer, two rounds.

**Round 1: FAIL on §3, §5, §13, §15, §17, §20, and the EC.**
- §3: it assumed the unmerged #2308.
- §5: two test files were missing, and a conditional new folder was proposed.
- §13: a vacuous zero-match grep.
- §15: no DECISIONS checkbox.
- §17: NG coverage stopped at NG-1, and the copy overclaimed "every finished match".
- §20: the form was wrong.
- EC: the typecheck command and the mindmap line were missing.
- All applied.

**Round 2: all PASS or N/A except §3.** ewiki #2310 was unmerged, and the WORK_INDEX row
still assumed #2308. Both were fixed: #2310 is now in Assumes with a "merge first, never
hand-author" rule, and the row wording is neutral. The optional banner-single-line lock and
the §19 gloss were also applied.

## Pre-Flight Verdict (01.4)

**Round 1: NOT READY**, on four text-only PS items:
- PS-1: `useEndgameCoach.test.ts` was missing from the allowlist.
- PS-2: the `fetchCoachReportForMatch` dependency was unspecified.
- PS-3: it assumed #2308.
- PS-4: the helper location wasn't locked. It is now a named export from `PlayViewport.vue`,
  tested in `PlayViewport.test.ts`, following the `VfxOverlay` precedent.

RS-1..RS-6 were applied:
- the casual panel is a sibling after the recap div
- `CoachTarget` + `Readonly<Ref>`
- the aria-label
- "every match played to the end"
- the prop pattern
- `coachApi.test.ts`

**Round 2: READY once WP-751 is Done.** Every cited line was re-verified. The truth table
covers all 7 `SubmissionStatus` members.

## Copilot Check (01.7)

**Round 2: 30/30 PASS, no RISK**, with CONFIRM conditional on the §3 Assumes fix. That fix
is now applied.

---

## See Also

- WP-751 (the server side)
- WP-594/595 (coach and panel)
- WP-636 (guest recap)
- WP-715 (the all-matches recap)
- ewiki `scoring.md` "Which end-of-match view you get" (#2310)
