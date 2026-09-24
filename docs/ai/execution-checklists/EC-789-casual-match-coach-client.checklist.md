# EC-789 — AI Coach panel on unscored matches + guest prompt copy (Arena Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-752-casual-match-coach-client.md
**Layer:** Arena Client (`apps/arena-client/src/**`)
**Status:** Pending — **BLOCKED on WP-751** (needs `GET /api/me/matches/:matchId/coach`)

## Before Starting
- [ ] WP-751 is Done on `main`, and its route is in `api-endpoints.md`.
- [ ] Set up a fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (expect exit 0).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0. Record the arena-client test baseline.
- [ ] Read these files:
  - `EndgameSummary.vue` (coach mount ~L625, guest prompt ~L637, recap div ~L674–728)
  - `EndgameCoachPanel.vue`
  - `useEndgameCoach.ts` and its test
  - `coachApi.ts` and its test
  - `PlayViewport.vue` (`isGuestResult` L255, the banner copy, `<PlayDesktop>` matchId forward L440) and its test
  - `PlayDesktop.vue:751`, `PlayMobile.vue:507`
  - `useCompetitiveSubmitOnGameover.ts` L102–135 (`ended-early` L105; `ineligible` L135)
- [ ] Scope lock: the 12 files in Files to Produce, plus govern-close. Any other edit → STOP.

## Locked Values (do not re-derive)
- **Eligibility helper.** `export function computeCasualCoachMatchId(matchId: string, submissionStatus: SubmissionStatus): string | null`, exported from `PlayViewport.vue`.
  - Returns `matchId` iff `matchId !== ''` && `submissionStatus === 'ineligible'`.
  - No `isEndedEarly` input: since #2312 an early end (guests included) is `'ended-early'`, never `ineligible`.
  - Otherwise returns `null`.
- **Coach target.** `export type CoachTarget = { kind: 'replay'; replayHash: string } | { kind: 'match'; matchId: string }`.
  - `useEndgameCoach(target: Readonly<Ref<CoachTarget | null>>, deps)`.
  - `EndgameCoachDependencies` gains a required `fetchCoachReportForMatch`.
  - `replayHash` wins when both are set.
- **Fetcher.** `fetchCoachReportForMatch(token, matchId)` calls `GET /api/me/matches/${encodeURIComponent(matchId)}/coach`, with the same parsing and errors as `fetchCoachReport`.
- **Props.** `EndgameCoachPanel` `replayHash`/`matchId` and `EndgameSummary` `casualCoachMatchId` all follow the pattern `String as () => string | null, default: null`.
  - The casual panel is a **sibling after** the recap div. It renders only when `!competitiveScore && casualCoachMatchId !== null`.
- **Banner (exact, replaces whatever is current; one string literal on one line, because the verification grep is line-scoped):** "This match isn’t part of a ranked gauntlet, so it isn’t scored to the leaderboard. The score report card is available on ranked-gauntlet loadouts."
- **Guest prompt (exact):**
  - Headline: "Sign in to save your results"
  - Detail: "You played this match as a guest, so it wasn’t saved. Signed-in matches keep your results, ranked-gauntlet loadouts earn a full score report card, and Legendary Pass holders get AI coaching on every match played to the end."
  - aria-label: "sign in to save your results"
  - CTA unchanged.

## Guardrails
- **Scored path unchanged.** The panel with a `replayHash` still calls `/api/me/scores/:replayHash/coach`.
- **The casual panel never shows for** guest, `failed`, `submitting`, `submitted`, `ended-early`, or scored matches.
  - Truth table covers all 8 `SubmissionStatus` members; `ended-early` → `null`.
- **Do not touch** the `'ended-early'` banner or status (#2312).
- **Casual coaching is requested only after submit settles as `ineligible`.** This is D-24576's cache-order rule.
- **Guest copy promises only future signed-in matches** (D-24120).
- **No visual redesign**, and **no server edits** (WP-751 owns the server).

## Required `// why:` Comments
- `computeCasualCoachMatchId`:
  - `ineligible` is the only permanent, non-scoring status.
  - It honors the D-24576 cache order.
  - Early ends, including guests', are `'ended-early'` and so excluded by the status alone (D-24306, #2312).
- `CoachTarget`: an unscored match has no `replayHash` on the client (D-24576).
- Guest copy: it promises only future signed-in matches (D-24120).

## Files to Produce
- `apps/arena-client/src/lib/api/coachApi.ts` — **modified** — `fetchCoachReportForMatch`
- `apps/arena-client/src/lib/api/coachApi.test.ts` — **modified** — matchId URL + parsing/errors
- `apps/arena-client/src/composables/useEndgameCoach.ts` — **modified** — `CoachTarget` + dep
- `apps/arena-client/src/composables/useEndgameCoach.test.ts` — **modified** — call-site migration + routing
- `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` — **modified** — `matchId` prop, cast removed
- `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` — **modified** — match vs replay route, precedence
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — casual sibling mount + guest copy/aria
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — casual show/hide + guest copy
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — helper export + banner + forward to both
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — truth table
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — forward prop
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — forward prop
- Govern-close (`SPEC:`): STATUS, WORK_INDEX, EC_INDEX, `docs/05-ROADMAP-MINDMAP.md`, `wiki/scoring.md` (casual row → shipped)

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0, and the suite is green. Record baseline → new counts in the commit body.
- [ ] Verification greps pass:
  - the new fetcher is present
  - the new banner appears exactly once
  - the old guest copy appears zero times
- [ ] `git diff --name-only` for `EC-789:` lists exactly the 12 files.
- [ ] Live check (D-24026), after WP-751 and WP-752 deploy:
  - a Pass holder's casual match shows the coach, with no score or grade
  - a guest sees the new prompt
  - record both in STATUS
- [ ] Governance:
  - STATUS
  - DECISIONS: confirm D-24576 is Active (no new entry)
  - WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
  - `wiki/scoring.md` casual row, with wiki gates

## Common Failure Smells (Optional)
- **Casual panel shows on an early end.** The helper matched something broader than `=== 'ineligible'` (e.g. "not scored"); `ended-early` must map to `null`.
- **Casual panel missing on mobile.** PlayMobile never received the prop (D-16501 forwards `matchId` to desktop only).
- **The scored panel hits the match route.** Target precedence is wrong.
- **`useEndgameCoach` tests stop fetching.** Call sites still pass a bare string ref, so `target.kind` is undefined.
- **The casual panel vanishes when `scores` is absent.** It was nested inside the recap div.
