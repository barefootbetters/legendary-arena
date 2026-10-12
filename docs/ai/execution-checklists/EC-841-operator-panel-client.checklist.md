# EC-841 — Operator panel on the play surface: lobby option, reveal-all board panel, badge, no score submit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-804-operator-panel-client.md
**Layer:** App (`apps/arena-client` only)

## Before Starting
- [ ] `pnpm install`; `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0. Record counts (draft: arena-client 2299 / 0 on `30a27c1f`).
- [ ] Confirm on `main`:
  - D-24697 (#2728) is in: `recordIfOperatorMatch` stamps `turn` from `buildUIState(...).game.turn`;
  - nothing in `apps/arena-client/src` reads `isDebugMatch` or calls `/api/admin/operator-match`;
  - `SubmissionStatus` has no `'operator-match'`;
  - `PlayViewport.test.ts` `EXPECTED_BY_STATUS` has 9 rows.
  If any differs, STOP and report.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `export interface OperatorBotDecisionWire { turn: number; seat: string; isForced: boolean; move: { name: string; args: unknown }; decisionLog: readonly string[]; legalMoveCount: number }`
- `export interface OperatorBoardResponse { matchId: string; operatorView: OperatorView; botDecisions: readonly OperatorBotDecisionWire[] }`
- `fetchOperatorEligibility(authToken: string): Promise<boolean>`: true only on HTTP 200 with `isOperator === true`. Every other status, a thrown fetch or bad JSON gives false. Never throws.
- `createOperatorMatchWithBot(config: MatchConfiguration, seatCount: number, botCount: number, policy: 'competent' | 'random', authToken: string): Promise<{ matchId: string }>`: posts to `/api/admin/operator-match/create-with-bot` with the same body as `createMatchWithBot`; throws a full-sentence `Error` on non-2xx.
- `fetchOperatorBoard(matchId: string, authToken: string): Promise<{ ok: true; value: OperatorBoardResponse } | { ok: false; status: number; error: string }>`: path `/api/admin/operator-match/${encodeURIComponent(matchId)}/board`; never throws; a thrown fetch gives `status: 0`; non-2xx `error = body.error ?? body.reason ?? 'The operator board could not be loaded (HTTP <status>).'`.
- URLs via `buildApiUrl` (`VITE_API_BASE_URL`); `Authorization: Bearer <token>`.
- `useOperatorEligibility(isEnabled: Ref<boolean>)` → `{ isOperator: Ref<boolean> }`: probes when `isEnabled.value === true` and `useAuthStore().token` is non-null, re-probes when either changes, and resets to false when the token clears or `isEnabled` turns false; a generation counter drops stale responses. `LobbyView` passes `ref(true)`; `PlayViewport` passes `computed(() => snapshot.value?.isDebugMatch === true)`.
- `useOperatorBoard(matchId: string, isExpanded: Ref<boolean>)` → `{ board: Ref<OperatorBoardResponse | null>, errorMessage: Ref<string | null>, refreshNow(): Promise<void> }`; polls every `OPERATOR_BOARD_POLL_MS = 3000` while `isExpanded.value === true` and a token exists; a self-scheduling `setTimeout` chain with `.unref()` where present; stopped when collapsed and on unmount; a failed fetch keeps the last good `board` and sets `errorMessage`; a generation counter (incremented on every start, stop and `refreshNow`) drops stale responses, and `refreshNow` clears the pending timer and reschedules exactly one, so there is never more than one chain.
- `buildOperatorFileName(kind: 'operator' | 'fixture', matchId: string, capturedAtMs: number): string` → `legendary-arena-${kind}-${safeMatch}-${capturedAtMs}.json`; `safeMatch` replaces `/` and `\` with `-`, and is `no-match` when empty.
- Downloads via `downloadTextFile(…, 'application/json')`, `JSON.stringify(value, null, 2)`, `Date.now()` read once per click: snapshot body `{ matchId, capturedAtMs, operatorView, botDecisions }`; fixture body `useUiStateStore().snapshot`.
- Submit skip: `'operator-match'`; when `uiStateStore.snapshot?.isDebugMatch === true`, `submitOnce` latches `hasSubmitted = true` and `submittedForMatch = currentMatchId`, sets `'operator-match'` and returns, before the `endedEarly` and guest/token checks. `SUBMISSION_MESSAGES['operator-match'] = 'Operator match — not scored.'`; `.endgame-actions__status--operator-match` joins the neutral rule; `EXPECTED_BY_STATUS['operator-match'] = null`.
- Badge `<p class="operator-match-badge" data-testid="operator-match-badge">Operator match — not scored</p>` when `snapshot.isDebugMatch === true`, for every seat.
- `const OperatorBoardPanel = defineAsyncComponent(() => import('../components/play/OperatorBoardPanel.vue'))`, registered in `components`; `<OperatorBoardPanel v-if="isOperatorPanelVisible" :match-id="matchId" />`; `isOperatorPanelVisible = snapshot?.isDebugMatch === true && isOperator && matchId !== ''`.
- Test ids: `operator-board-panel`, `operator-board-toggle` (`aria-expanded`, expanded on mount), `operator-seats`, `operator-decks`, `operator-piles`, `operator-engine`, `operator-bot-decisions`, `operator-board-refresh`, `operator-download-snapshot`, `operator-download-fixture`, `operator-board-error`, `lobby-operator-match`.
- Card label `operatorView.cardDisplay[id]?.name ?? id`; last 10 `board.value.operatorView.board.effectTraces` as card name + status (never from `useUiStateStore`); no `errorComponent` on the async panel; decisions newest first, "Turn N" from the record's `turn` as-is.
- Lobby checkbox "Operator match (admin, not scored)", only when `isOperator`; checked → `createOperatorMatchWithBot`; every other step unchanged.

## Guardrails
- The client runs no rule and edits no state; the panel only renders the server projection.
- Operator types come from `@legendary-arena/game-engine` as **types only**; never `/setup`, never `registry` at runtime.
- No server, engine, `UIState`, move or persistence change. No new dependency, no Tweakpane, no UI library (D-24689 §6).
- The panel loads only via `defineAsyncComponent` with the PascalCase tag (AC 12 proves it stays out of the entry chunk).
- Names only, never card text; colors from `--la-color-*` tokens, never raw hex.
- SFCs use `defineComponent({ setup })` (D-6512); functions ~30 lines; no nested ternaries; full-sentence errors.
- Existing tests: only the WP §G change (the `EXPECTED_BY_STATUS` row + length 9 → 10); everything else is additions. Named in `Tests-changed:`.

## Required `// why:` Comments
- `fetchOperatorEligibility`: anything but 200 means "not an operator", silently; the server gate (D-15902) is the real protection.
- `useOperatorEligibility` callers: the play surface probes only in an operator match, so normal games never cost an admin lookup.
- `useOperatorBoard` poll gate: the reveal-all view travels only over the admin route (D-24689 §4), so it polls while open and never while collapsed.
- Decision turns: shown as-is because the server records the display turn (D-24697).
- The submit skip: an operator match is never scored (D-24689 §3); the client skips and latches, and the server stays authoritative.
- The lazy mount in `PlayViewport.vue`: normal play never downloads the panel (D-24689 §6).

## Files to Produce
- `apps/arena-client/src/lib/api/operatorMatchApi.ts`, `operatorMatchApi.test.ts` — **new**
- `apps/arena-client/src/composables/useOperatorEligibility.ts`, `useOperatorEligibility.test.ts`, `useOperatorBoard.ts`, `useOperatorBoard.test.ts` — **new**
- `apps/arena-client/src/components/play/OperatorBoardPanel.vue`, `OperatorBoardPanel.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue`, `PlayViewport.test.ts` — **modified**
- `apps/arena-client/src/components/play/EndgameActions.vue` — **modified** — style only
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts`, `useCompetitiveSubmitOnGameover.test.ts` — **modified**
- `apps/arena-client/src/lobby/LobbyView.vue`, `LobbyView.test.ts` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package; `pnpm --filter @legendary-arena/arena-client typecheck` 0; before / after counts recorded.
- [ ] `pnpm --filter @legendary-arena/arena-client build`; `operator-bot-decisions` appears in exactly one `dist/assets/*.js`, not the entry chunk `dist/index.html` loads.
- [ ] Revert proofs, each failing ≥ 1 new test: make eligibility true on 403; probe in a normal match (tested with a token set); drop the panel's `isOperator` gate (checked after `flushPromises()`); poll while collapsed; drop the generation counter (two chains after collapse → expand); drop the submit skip; drop the skip's latch (second game over without `isDebugMatch`); render the checkbox without eligibility; stop encoding the match id.
- [ ] PlayViewport presence and absence checks run after `flushPromises()`. Download tests use the `GameLogDownloadButton.test.ts` pattern; no ESM module mocking.
- [ ] `git status --porcelain` ⊆ Files to Produce (revert `lagn-v1.json` CRLF churn); `git diff origin/main -- '*.test.ts'` = additions + the §G row and count.
- [ ] Commit 1, `EC-841: …`: code + tests, with `Tests-changed:` (the §G row and count) and `Vision: §3, §7, §11, §14, §16, §17, §22, §23` trailers.
- [ ] Commit 2, `SPEC: WP-804 / EC-841 govern-close — …`: the eligibility row in `api-endpoints.md` replaced whole + footer; STATUS; DECISIONS.md: none (D-24689 §5/§6, D-24697); WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write` + `:check`; `pnpm ledger:numbers:check`.
- [ ] Neither subject contains a commit-msg Rule 1 token (case-insensitive WIP / fix stuff / misc / tmp / updates / changes / debug): write "operator match", never `isDebugMatch` or `debug_match`.
- [ ] Live (D-24026), after merge + deploy only: the seven WP §Verification live steps as `jefferyjjensen`. Govern-close says "live-verify pending"; a post-deploy STATUS commit records the matchId.

## Common Failure Smells
- Every normal game shows a 403 to `/api/admin/operator-match/eligibility` in devtools → the play surface probes without the `isDebugMatch` gate.
- The panel appears in a normal match for an admin → `isDebugMatch` was dropped from the panel gate.
- Bot turns don't match the log prefix → the client is adjusting `turn`; D-24697 already records the display turn.
- The entry chunk contains `operator-bot-decisions` → the panel was imported statically or with a kebab-case tag.
- Board requests continue while collapsed → the poll ignores `isExpanded`.
