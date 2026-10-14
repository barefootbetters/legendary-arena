# WP-812 — The Hall of Legends says "Outcome not recorded" or "Ended early", not "Draw", when a finished match was not a tie (Server + legends-board)

**Status:** Draft 2026-10-14 — **BLOCKED on WP-811** (execute only after WP-811 / EC-848 has merged)
**Primary Layer:** Server (`apps/server`, the `/result-lagn` route and one pure helper) + App (`apps/legends-board`, one pure display helper)
**Dependencies:**
- **WP-811 / D-24719** (drafted #2786; not executed). It makes reaped matches readable from `bgio.replay_artifacts` and introduces the unknown-outcome cases this packet labels: `VERDICT_NOT_RECORDED` (an unswept pre-046 artifact) and a stored `{}` (a re-execution that no longer reproduces `replay_hash`).
- WP-406 / D-24216 (the result-LAGN producer and `toLagnResult`), WP-407 / D-24217 (the Hall of Legends match view, a pure result-LAGN consumer), WP-408 / D-24218 (the LAGN download), WP-367 / D-24159 (the deck-exhaustion `tie` outcome), WP-502 / D-24306 ("End Game": an abandoned match is stored as `'tie'` flagged `endedEarly`).

**User-Visible Surface:** `legends.legendary-arena.com/#/match/<matchId>` (the outcome line of the WP-407 match view).
**Lane:** Standard (two-session). Two apps (`apps/server` + `apps/legends-board`), so lightweight-lane criterion 1 fails.

> Baseline: `origin/main` at `6b982ff9` (includes #2789 (WP-811 / EC-848 doc amendments) and #2793 (wiki), both docs only; #2788, docs only; #2787, the WP-812 / EC-849 / D-24720 reserve; and #2786, the WP-811 draft). The scaffold counts were observed at `2802b902`; the two later commits touch no code.

---

## Goal

**Today the Hall of Legends labels every finished match without a `result` block "Draw".**

- LAGN has no tie outcome, so `toLagnResult` omits the optional `result` block for any non-decisive verdict.
- legends-board `formatOutcome` was written for the deck-exhaustion tie (D-24159) and labels any outcome-less document "Draw".
- That already mislabels a match the players **ended early**: the engine stores it as `{ outcome: 'tie', endedEarly: true }` (D-24306), and the arena-client calls it "Match ended early" (`EndgameActions.vue:~93`), while the Hall of Legends calls it "Draw".
- WP-811 adds a third case: a finished match whose verdict is not known (an unswept legacy artifact, or one whose re-execution no longer reproduces its hash). Those would read "Draw" too, which may be false.

**After this session:**
1. `GET /api/match/:matchId/result-lagn` adds one optional envelope field beside `lagn`: `resultOmittedReason: 'tie' | 'ended-early' | 'unknown'`. It is present **only** when `lagn.result` is omitted. A decisive match's body stays exactly `{ lagn }`.
2. legends-board shows **"Draw"** only for `'tie'`, **"Ended early"** for `'ended-early'`, and **"Outcome not recorded"** for `'unknown'` or a missing reason. Victory and Defeat are unchanged.
3. The LAGN document, its version, the download, and every other route are unchanged.

## User-Visible Impact

On `legends.legendary-arena.com/#/match/<id>`, a match whose outcome the server does not know reads "Outcome not recorded", and a match the players abandoned reads "Ended early", instead of "Draw". A real deck-exhaustion tie still reads "Draw"; wins and losses read as before.

---

## Assumes

1. **WP-811 has merged** (`VERDICT_NOT_RECORDED` exported from `matchLagn.logic.ts`, the artifact fallback in `readMatchGameover`, and WP-811's no-seam route test "a legacy artifact → 200 + valid + no `result`" in `matchLagn.routes.test.ts`). If not, this packet is BLOCKED.
2. **Server mapping** (`apps/server/src/match/matchLagn.logic.ts`, anchors at baseline; WP-811 shifts them):
   - `:~328-331` `StoredGameover { outcome?: string; reason?: string }` (no `endedEarly` field yet).
   - The engine's `EndgameResult` (`packages/game-engine/src/endgame/endgame.types.ts:~19`, `:~40`) is `{ outcome: 'heroes-win' | 'scheme-wins' | 'tie'; reason; endedEarly? }`. `evaluateEndgame` (`endgame.evaluate.ts:~41-49`) returns `{ outcome: 'tie', reason: 'The players ended the match early.', endedEarly: true }` first when the match was ended early, and `endIf` (`game.ts:~510`) stores it as `metadata.gameover` (so WP-811's capture copy and sweep carry it to the artifact).
   - `:~381-391` `toLagnResult`: `heroes-win` → `victory`, `scheme-wins` → `defeat`, anything else (incl. `tie`, `{}`, `null`) → `undefined`.
3. **Route** (`matchLagn.routes.ts`): the `/result-lagn` handler (`:~215-313`) reads `gameover` (non-null past the D-24169 gate, `:~243-248`), calls `toLagnResult(gameover)` (`:~260`), validates once, then sets `koaContext.body = { lagn }` (`:~307`). The `/lagn` route (registered `:~148`) is separate and untouched.
4. **Route tests** (`matchLagn.routes.test.ts`): the seam's `gameover` option is `StoredGameover | null` (`:~107`, `options.gameover ?? null`); the decisive test asserts `Object.keys(body)` is `['lagn']` (`:~291`); the tie test (`:~373-393`) asserts only that `result` is absent.
5. **Client** (`apps/legends-board/src/panels/matchResultDisplay.ts`): `formatOutcome(result)` (`:~65-75`) returns Victory / Defeat / else Draw; `parseResultLagn` (`:~128-142`) reads `body.lagn` only. `matchResultDisplay.test.ts` pins "Draw" for an absent result at `:~49-51`, `:~123-136` and `:~138-143`.
6. **No other consumer reads the envelope:** `matchResultDownload.ts:~67-68` returns `body.lagn` only, so the downloaded file never carries the new field; `matchResultClient.ts` passes the whole body to `parseResultLagn`. `MatchResultPanel.vue:~68-72` renders `view.outcomeLabel` with the `is-draw` (secondary-text) class for any non-decisive view, which suits "Ended early" and "Outcome not recorded" too, so the `.vue` file needs no edit.
7. **Baseline:** `pnpm -r build` → 0. At `78195370` (and `2802b902`, docs only): `pnpm --filter @legendary-arena/server test` → **1767** tests, 0 fail, 207 skipped; `pnpm --filter @legendary-arena/legends-board test` → **135** tests, 0 fail; `pnpm --filter @legendary-arena/legends-board typecheck` → 0. After WP-811 the server count is 1790 (1791 if WP-811's AC 8 applied); re-record the server baseline at execution.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24720 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- WP-811 Context, "Operator decision": it ships the server fix with the "Draw" gap recorded in D-24719 and defers this client fix.
- `docs/ai/DECISIONS.md`: D-24159 (`tie`), D-24306 (ended early = `tie` + `endedEarly`), D-24216 (producer; omit `result` rather than guess), D-24217 (pure result-LAGN consumer; the identity boundary), D-24218 (the one-way download), D-24719 (once WP-811 lands).
- `.claude/skills/legendary-server/SKILL.md` (the server wires and projects; it never decides outcomes: the engine's stored verdict is mapped, not re-derived).

**Why an envelope field, not a LAGN contract change (the scope decision):**
- **A LAGN `draw` outcome (or a `result_status` field)** is the portable answer, so a downloaded file could tell a tie from unknown. It needs a version bump. 1.7.0 is already claimed by WP-808 / WP-810 (drafted, not executed), so this would be 1.8.0 or a renumber of both. It also needs a version gate, a `lagn-v1.json` regeneration, a `LAGN_VERSION` writer flip shared with the loadout emitter, and the public `lagn-spec` snapshot. All of that to fix one label. Rejected for now; revisit when a LAGN consumer outside the Hall of Legends needs the distinction.
- **Client-only: label every outcome-less result "Outcome not recorded".** It is never false, but a real tie loses its "Draw". Rejected: the operator asked to keep "Draw" for a real tie.
- **Keep "Draw".** Can publish a false outcome. Rejected (the bug).
- **`404` for an unknown verdict.** WP-811 rejected it: legacy matches would lose their whole view.
- **Fold an ended-early match into `'unknown'`.** The pre-flight's first suggested fix. Rejected: the outcome is known (the players ended it), so "Outcome not recorded" would be a different wrong label; the arena-client already says "Match ended early".
- **An always-present `outcomeStatus` field.** It duplicates `lagn.result.outcome` for decisive matches and changes every decisive body. Rejected: a present-only-when-omitted reason keeps decisive bodies byte-identical (`Object.keys(body)` stays `['lagn']`).

**What the download still cannot say.** The WP-408 download saves `body.lagn` only. A downloaded document without `result` stays ambiguous between a tie, an early end and an unknown outcome, as it is today. That is an omission, not a false claim, and D-24720 records it as the LAGN-level follow-up above.

**Deploy order is safe either way.** The server deploys through the `la-deploy` gate after CI; legends-board deploys to Cloudflare Pages. Old client + new server shows today's behavior (the new field is ignored). New client + old server shows "Outcome not recorded" for a tie or an ended-early match during the gap: less specific, never false.

**One WP, not two.** The server half (one helper + the envelope) and the client half (one helper) are each a few lines, and neither is useful alone. Splitting would add a session and a PR for no isolation benefit. They touch no shared code and the client is safe against either server version.

**Draft scaffold (observed 2026-10-14 at `2802b902`, before WP-811; patch kept in the drafting session scratchpad, not committed):**
- Server suite 1767 → **1774**, 0 fail, 207 skipped (+5 logic tests, +2 route tests; the tie route test strengthened).
- legends-board 135 → **138**, 0 fail (+2 `formatOutcome`, +1 `parseResultLagn`; the decisive test gains the required second argument and a precedence assertion (`formatOutcome({ outcome: 'victory' }, 'ended-early')` → Victory); the two "Draw" tests gain a `'tie'` reason as **input** and are retitled, their expected label unchanged; only the malformed-body test changes its **expected** label, from "Draw" to "Outcome not recorded", because the label intentionally changed). `vue-tsc --noEmit` → 0; `vite build` → 0.
- Twelve mutants, each killed (AC 7). Five of them (the last five in AC 7) came from the copilot check and survived an earlier scaffold; the engine-built verdicts, the ended-early route test and the precedence pins were added for them.
- Not scaffoldable before WP-811: the strengthened WP-811 no-seam legacy-artifact route test (Scope C).

### Interplay

- **WP-811 / D-24719.** WP-811 replaces the `/result-lagn` catalog row whole; this packet replaces the post-WP-811 row whole again. D-24719 names this packet as its follow-up.
- **#2779 / D-24717 (open; result-LAGN refuses an operator match).** It edits the same route handler (above the gates), edits `matchLagn.logic.ts`, adds 3 route tests, and replaces the same `api-endpoints.md` row whole. If it is on `main` at execution: the code merge is textual (the new lines sit at the end of the handler); the server baseline includes its tests; and the `/result-lagn` row is rebuilt **from the row on `main` at execution**, keeping WP-811's and D-24717's text and adding this packet's.
- **WP-810 / D-24716 (drafted, BLOCKED on WP-808).** Its `/replay-lagn` route is a separate handler; it re-derives its own outcome and is not touched here. If WP-810 later wants the same tie/unknown distinction, the LAGN-level option above is the place.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. All in-game randomness goes through boardgame.io's seeded `random` (the `ctx.random` family). No `Math.random`, clocks or I/O in engine code.
- `G` stays JSON-serializable. Only `Game.setup()` may throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24720) before coding. One WP per session.

**Packet-specific:**
- **No LAGN change.** `packages/**` is not edited; `lagn_version`, the `lagn` document and its validation are unchanged. The field never appears inside `lagn`.
- **No engine read or re-derivation in production code.** Only the logic test imports the engine `.` surface (`engineVerdictFor`). The reason is a pure mapping of the stored verdict the route already holds; no new query, no new carve-out.
- **Decisive bodies are unchanged:** `{ lagn }` exactly when `lagn.result` is present.
- **Only `/result-lagn` changes.** `/lagn`, `/seat-identities`, status codes, error bodies, auth and `Cache-Control` are unchanged.
- **The client defaults to unknown.** Only the exact string `'tie'` yields "Draw" and only `'ended-early'` yields "Ended early".
- **`endedEarly` wins over `outcome`.** A `'tie'` verdict flagged `endedEarly: true` is `'ended-early'`, never `'tie'`.
- **The download is unchanged** (`matchResultDownload.ts` is not edited).
- **01.5 not invoked.** Every file is in the allowlist by name.

## Locked Values

- **Wire field:** `resultOmittedReason`, values `'tie' | 'ended-early' | 'unknown'`, on the `/result-lagn` 200 envelope beside `lagn`.
- **Server type + helper** (`matchLagn.logic.ts`):
  - `StoredGameover` gains `readonly endedEarly?: boolean;` (JSDoc: true when the players ended the match early, WP-502 / D-24306).
  - `export type ResultOmittedReason = 'tie' | 'ended-early' | 'unknown';` (after `toLagnResult`)
  - `export function toResultOmittedReason(gameover: StoredGameover): ResultOmittedReason | undefined` returns `undefined` when `toLagnResult(gameover) !== undefined`; else `'ended-early'` when `gameover.endedEarly === true`; else `'tie'` when `gameover.outcome === 'tie'`; else `'unknown'`. It **calls** `toLagnResult`, so the reason is present exactly when `result` is absent.
- **Route** (`/result-lagn` only): `const resultOmittedReason = toResultOmittedReason(gameover);` beside `toLagnResult`; on 200, `{ lagn }` when it is `undefined`, else `{ lagn, resultOmittedReason }`.
- **Client** (`matchResultDisplay.ts`):
  - `export type ResultOmittedReason = 'tie' | 'ended-early' | 'unknown'` (a client-local mirror; legends-board does not import `apps/server`).
  - `formatOutcome(result: LAGN['result'], resultOmittedReason: ResultOmittedReason | undefined)` (the second parameter is **required**, so no call site silently keeps the old behavior): `victory` → `{ label: 'Victory', isDecisive: true }`; `defeat` → `{ label: 'Defeat', isDecisive: true }`; `'tie'` → `{ label: 'Draw', isDecisive: false }`; `'ended-early'` → `{ label: 'Ended early', isDecisive: false }`; otherwise `{ label: 'Outcome not recorded', isDecisive: false }`.
  - `parseResultLagn` reads `resultOmittedReason` from the envelope (`body`), never from `lagn`.
  - `MatchResultView.outcomeLabel` doc: `'Victory'` | `'Defeat'` | `'Draw'` | `'Ended early'` | `'Outcome not recorded'`.
- **Doc lines:**
  - **`api-endpoints.md`:** the `GET /api/match/:matchId/result-lagn` row (as left by WP-811) replaced **whole** (D-11804). Response column: `200 → { lagn: LAGN, resultOmittedReason?: 'tie' | 'ended-early' | 'unknown' }`, with "`resultOmittedReason` is present only when `lagn.result` is omitted: `'tie'` for a deck-exhaustion tie (D-24159), `'ended-early'` for a match the players ended early (D-24306), `'unknown'` for a finished match whose verdict is not recorded or not reproducible (WP-811); a decisive match's body is exactly `{ lagn }`". The "`{ lagn }` is a single top-level key" sentence is replaced by that one. Notes gain: "The WP-407 view reads `resultOmittedReason` to label a tie "Draw", an early end "Ended early" and an unknown outcome "Outcome not recorded"; the WP-408 download saves `lagn` only (WP-812 / D-24720)." Authorizing WP gains `WP-812 / D-24720`. Status `Wired`, Auth `guest`. Footer `*Last updated: WP-812 …*` line.
  - **`docs/ops/RUNBOOK-legends-match-result-live-verify.md`:** "(Victory / Defeat / Draw)" (`:~125`) becomes "(Victory / Defeat / Draw / Ended early / Outcome not recorded)".

---

## Scope (In)

- **A) Server helper** (`matchLagn.logic.ts`): `StoredGameover.endedEarly`, `ResultOmittedReason`, `toResultOmittedReason` per Locked Values, with JSDoc and `// why:` comments (LAGN has no tie outcome; the envelope disambiguates; calling `toLagnResult` keeps the pairing exact; `endedEarly` is checked before the tie because the engine stores an early end as `'tie'`).
- **B) Route** (`matchLagn.routes.ts`): import and call the helper; the conditional 200 body with a `// why:` (beside, never inside, `lagn`; decisive body unchanged); the handler's header comment names the field.
- **C) Server tests:**
  - `matchLagn.logic.test.ts` (+5): a module-private `engineVerdictFor(counterName)` builds the verdict with the engine's own `evaluateEndgame` from a counters-only state (it reads only `G.counters`; `evaluateEndgame`, `ENDGAME_CONDITIONS`, `EndgameResult`, `LegendaryGameState` come from the engine `.` surface), typed as `StoredGameover`. Tests: decisive → `undefined`; the engine's `FINAL_TURN_TIE` verdict and `{ outcome: 'tie' }` → `'tie'`; the engine's `MATCH_ENDED_EARLY` verdict and `{ outcome: 'tie', endedEarly: true }` (no `reason`) → `'ended-early'`; `{}`, an unrecognized outcome and a `reason`-only verdict → `'unknown'`; the pairing invariant over seven verdicts, including `{ outcome: 'heroes-win', endedEarly: true }` (reason present ⇔ `toLagnResult` is `undefined`).
  - `matchLagn.routes.test.ts` (+2, 2 strengthened): the tie test also asserts `Object.keys(body)` is `['lagn', 'resultOmittedReason']` and the value `'tie'`; new: seam `gameover: { outcome: 'tie', reason: 'The players ended the match early.', endedEarly: true }` → 200, valid, no `result`, `body.resultOmittedReason === 'ended-early'`; new: seam `gameover: {}` → 200, valid, no `result`, `'resultOmittedReason' in body.lagn === false`, `body.resultOmittedReason === 'unknown'`; WP-811's **no-seam** legacy-artifact test also asserts `body.resultOmittedReason === 'unknown'` (the real `VERDICT_NOT_RECORDED` path).
- **D) Client** (`matchResultDisplay.ts`): the type, `formatOutcome`, `parseResultLagn` and their JSDoc per Locked Values; the `// why:` states that only an explicit tie may claim "Draw".
- **E) Client tests** (`matchResultDisplay.test.ts`, +3, 4 changed): the decisive test passes `undefined` as the second argument and gains the precedence assertion `formatOutcome({ outcome: 'victory' }, 'ended-early')` → Victory; "absent result + `'tie'`" → Draw (input gains the reason; retitled); new: `'ended-early'` → "Ended early"; new: `'unknown'` and `undefined` → "Outcome not recorded" (non-decisive); the AC-3 parse body gains `resultOmittedReason: 'tie'` (still Draw; retitled); the malformed-body test's expected label changes from "Draw" to "Outcome not recorded"; new: a parse body with `resultOmittedReason: 'unknown'` beside `lagn` → "Outcome not recorded", and in the same test an unrecognized reason (`'abandoned'`) → "Outcome not recorded", never "Draw".
- **F) Docs:** `api-endpoints.md` row + footer; the runbook line.

## Out of Scope

- **Any LAGN contract change** (`packages/lagn-spec`, `lagn_version`, `lagn-v1.json`, the public snapshot). The LAGN-level tie/unknown distinction is the recorded follow-up.
- **The download** (`matchResultDownload.ts`) and the downloaded file's content.
- **`MatchResultPanel.vue`** (the non-decisive class already fits).
- **`/lagn`, `/seat-identities`, `/replay-lagn`** and the arena-client.
- **WP-811's server logic** (readers, capture, sweep) beyond strengthening its one legacy-artifact route test.
- **`loss_condition`** and any richer outcome detail.
- **00.2:** the field is an API envelope field documented in `api-endpoints.md`, not a LAGN wire name.

## Files Expected to Change

- `apps/server/src/match/matchLagn.logic.ts` — modified
- `apps/server/src/match/matchLagn.logic.test.ts` — modified (+5 tests)
- `apps/server/src/match/matchLagn.routes.ts` — modified
- `apps/server/src/match/matchLagn.routes.test.ts` — modified (+2 tests, 2 strengthened)
- `apps/legends-board/src/panels/matchResultDisplay.ts` — modified
- `apps/legends-board/src/panels/matchResultDisplay.test.ts` — modified (+3 tests, 4 changed)
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ops/RUNBOOK-legends-match-result-live-verify.md` — modified
- Governance: `docs/ai/DECISIONS.md` (D-24720), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

Six code and test files plus two docs and five governance files, in two apps. No new file.

## Contract

- The Locked Values.
- `toResultOmittedReason(gameover)`: `undefined` ⇔ `toLagnResult(gameover) !== undefined`; otherwise `'ended-early'` ⇔ `gameover.endedEarly === true`; otherwise `'tie'` ⇔ `gameover.outcome === 'tie'`; otherwise `'unknown'`.
- `/result-lagn` 200 body: `{ lagn }` when `lagn.result` is present; `{ lagn, resultOmittedReason }` when it is omitted. Errors unchanged.
- legends-board label: Victory / Defeat from `lagn.result`; "Draw" only for `'tie'`; "Ended early" only for `'ended-early'`; "Outcome not recorded" otherwise.
- Precedence, server and client: a decisive verdict / `result` always wins over `endedEarly` and over any reason.

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness: the public record never states an outcome it does not know), §18 (Replayability & Spectation: the Hall of Legends match view), §12a (Data Portability: the download is unchanged), §7 (Strict Layer Separation), §8 (Deterministic engine; untouched), NG-1 (untouched).
**Conflict assertion:** none.
- §3: removes a possibly false "Draw" from a public match record (an unknown verdict, or a match the players abandoned).
- §7: the server maps a stored engine verdict (no re-derivation); the client renders a label from a projection (no rule logic); `apps/legends-board` still imports nothing from `apps/server`.
**Non-Goal proximity:** not crossed. Nothing scored, purchased or ranked reads the field.
**Determinism:** unchanged. No engine code, hash, replay or PRNG surface is touched.

## Funding Surface Gate

§20 **N/A**: one outcome label on the Hall of Legends match view and an API envelope field; no funding channel, purchase, subscription or donation affordance (WP-097 §F; the §20.1 surfaces are absent).

## API Catalog

§21 **applies:** the `/result-lagn` row is replaced whole (response shape gains the optional envelope field; Notes, Authorizing WP) and a footer line is added (Scope F). Status `Wired` and Auth `guest` are unchanged and inside the closed sets.

---

## Acceptance Criteria

1. **Tie.** A finished match whose verdict is `{ outcome: 'tie' }` returns `200 { lagn, resultOmittedReason: 'tie' }` with no `lagn.result` (strengthened route test).
2. **Unknown.** A finished match whose verdict is `{}` returns `200 { lagn, resultOmittedReason: 'unknown' }`, the field absent from `lagn` (new route test); WP-811's no-seam legacy-artifact route test returns `resultOmittedReason: 'unknown'` (strengthened).
3. **Ended early.** The engine's own ended-early verdict maps to `'ended-early'`, never `'tie'` (logic test, built with `evaluateEndgame`); the route returns `resultOmittedReason: 'ended-early'` for it (route test); legends-board labels it "Ended early" (client test).
4. **Decisive unchanged.** A `heroes-win` / `scheme-wins` match returns exactly `{ lagn }` (existing `Object.keys(body)` assertion stays green; logic tests).
5. **Pairing and precedence.** `toResultOmittedReason` is defined exactly when `toLagnResult` is `undefined` (logic test over seven verdicts, one decisive with `endedEarly`); a decisive `result` beats any reason on the client.
6. **Labels.** `formatOutcome` gives Victory / Defeat for a decisive `result`, "Draw" only for `'tie'`, "Ended early" only for `'ended-early'`, and "Outcome not recorded" for `'unknown'` and for a missing reason; `parseResultLagn` reads the reason from the envelope beside `lagn` (client tests).
7. **Mutants** (each restored; all observed at draft): client always "Draw" → 3 fail; route drops the reason → 3 fail; helper returns `tie` for every unknown verdict → 2 fail; route puts the reason inside `lagn` → 3 fail; client reads the reason from `lagn` → 1 fail; helper ignores `endedEarly` → 2 fail; client labels `'ended-early'` "Draw" → 1 fail; route passes only `{ outcome }` to the helper (drops the flag) → 1 fail; helper checks `endedEarly` before the decisive mapping → 1 fail; helper keys on the engine's reason text instead of the flag → 1 fail; client checks the reason before `result` → 1 fail; client treats any unrecognized reason as a tie → 1 fail.
8. **Build, types and tests.** `pnpm -r build` → 0. Server suite = the execution baseline **+7**, 0 fail. legends-board 135 → **138**, 0 fail; `pnpm --filter @legendary-arena/legends-board typecheck` → 0. `pnpm -r --no-bail test` → 0 fail.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/server test` → baseline + 7 tests, 0 fail, 207 skipped.
3. `pnpm --filter @legendary-arena/legends-board test` → 138 tests, 0 fail; `pnpm --filter @legendary-arena/legends-board typecheck` → 0.
4. Mutants (AC 7), each restored.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git status --porcelain --untracked-files=all` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn from the build.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24720 Active. It records:
  - the ambiguity (LAGN `result` is optional and has no tie; a tie and an unknown verdict both omit it) and how WP-811 made unknown reachable
  - the envelope field, its three values, present-only-when-omitted, decisive bodies unchanged
  - the ended-early case: the engine stores an abandoned match as `'tie'` + `endedEarly` (D-24306), so `endedEarly` wins over the outcome string; found at pre-flight
  - the client rule: "Draw" only for `'tie'`; "Ended early" only for `'ended-early'`; "Outcome not recorded" for `'unknown'` or a missing reason (deploy-order safe)
  - D-24217 widened: the view reads one non-identity envelope field beside `lagn`; the identity boundary is unchanged
  - the download stays `lagn`-only, so a downloaded outcome-less document remains ambiguous
  - the rejected alternatives (LAGN `draw` / `result_status` at 1.8.0, client-only label, keep "Draw", `404`, ended-early folded into unknown, always-present status) and the LAGN-level follow-up trigger
- [ ] D-24719's follow-up item marked done (one line pointing at D-24720).
- [ ] `docs/ai/STATUS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-849:` then `SPEC:`), with a `Tests-changed:` trailer for `matchResultDisplay.test.ts` (the decisive test gains the required second argument and a precedence assertion (`formatOutcome({ outcome: 'victory' }, 'ended-early')` → Victory); the two "Draw" tests gain a `'tie'` reason as **input** and are retitled, their expected label unchanged; only the malformed-body test changes its **expected** label, from "Draw" to "Outcome not recorded", because the label intentionally changed) and `matchLagn.routes.test.ts` (the tie test and WP-811's legacy-artifact test strengthened with envelope assertions).
- [ ] **D-24026 live-verify (post-merge, after both deploys; `GET /version` `gitSha` = the merge commit and the legends-board Pages deploy for it):**
  1. A decisive match: `GET https://api.legendary-arena.com/api/match/<id>/result-lagn` body keys are exactly `["lagn"]`; legends-board shows Victory or Defeat.
  Steps 2–4 use read-only prod SQL. Prod DB reads were blocked for the WP-811 drafting session, so hand the queries to Jeff unless your session can run them.
  2. An unknown-outcome match: `SELECT match_id FROM bgio.replay_artifacts WHERE gameover = '{}'::jsonb OR gameover IS NULL LIMIT 1`. Its `/result-lagn` returns `resultOmittedReason: "unknown"`, and `legends.legendary-arena.com/#/match/<id>` shows "Outcome not recorded". If no such row exists, record that and rely on AC 2. (Once WP-811's sweep has drained, only `'{}'` rows remain; there may be none.)
  3. A tie: `SELECT match_id FROM bgio.replay_artifacts WHERE gameover->>'outcome' = 'tie' AND gameover->>'endedEarly' IS DISTINCT FROM 'true' LIMIT 1`. If found, `resultOmittedReason: "tie"` and the view shows "Draw"; if none exists, record that the tie path is pinned by AC 1 and AC 6 only.
  4. An ended-early match. Primary path, no DB: start a fresh guest match, end it with "End Game", and read its `/result-lagn` and match view (the live row serves it for about an hour). Fallback: `SELECT match_id FROM bgio.replay_artifacts WHERE gameover->>'endedEarly' = 'true' LIMIT 1`. `resultOmittedReason: "ended-early"` and the view shows "Ended early".
  5. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24720 — result-lagn-unknown-outcome-label.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- **§1 Structure:** every required section present; 7 Out-of-Scope exclusions; 8 binary ACs.
- **§2 Constraints:** the engine-wide block is verbatim; session protocol, packet constraints ("01.5 not invoked", no LAGN change, no engine read in production code) and Locked Values present.
- **§3 Assumes:** 7 items cited to file:line, re-verified at HEAD by the pre-flight and lint reviewers; a false item → BLOCKED (item 1 is WP-811 merged).
- **§4 Context:** D-24159 / D-24306 / D-24216 / D-24217 / D-24218 / D-24719, the server skill. 00.2 is **N/A**: it inventories card data, tables, the match-setup envelope and LAGN wire names, not HTTP response envelopes; `resultOmittedReason` is an API envelope field documented in `api-endpoints.md` (Out of Scope).
- **§5 Output completeness:** 6 code/test files + 2 docs + 5 governance, each marked modified; no new file; the two-app reason stated ("One WP, not two").
- **§6 Naming:** `resultOmittedReason`, `ResultOmittedReason`, `toResultOmittedReason`, `engineVerdictFor`; full words; canonical names untouched.
- **§7 Dependencies:** no new package; the logic test uses the engine `.` surface (allowed for `apps/server`). WP-811 is the open dependency (BLOCKED by design).
- **§8 Architecture:** the server maps a stored verdict (no re-derivation, no new read, no carve-out); legends-board imports nothing from `apps/server`.
- **§9 Windows:** only `pnpm`, `git` and SQL; no shell-specific syntax.
- **§10 Env vars:** no new variable.
- **§11 Auth:** N/A — `/result-lagn` stays `guest`.
- **§12 Tests:** `node:test`, `.test.ts`, fake seams, no `boardgame.io/testing`.
- **§13 Verification:** exact commands with counts; the allowlist check uses `git status --porcelain --untracked-files=all`.
- **§14 ACs:** 8, binary, each tied to a named test, mutant or count (server +7, client 138, 12 mutants).
- **§15 DoD:** STATUS, DECISIONS (D-24720 + the D-24719 pointer), WORK_INDEX, EC_INDEX, mindmap + counts, two-commit topology with an exact `Tests-changed:` trailer. **§15.1:** surface declared; live-verify has four observable checks, step 4 needs no DB.
- **§16 Code style:** 00.6 cited; `// why:` locations enumerated in EC-849; the required second parameter is a drift guard.
- **§17 Vision:** §3, §7, §8, §12a, §18, NG-1; no conflict; determinism line present.
- **§18 Prose-vs-grep:** N/A — no grep-based gate.
- **§19 Bridge staleness:** baseline `6b982ff9` is the `origin/main` tip at commit (the two commits after the scaffold run are docs-only).
- **§20 Funding surface:** N/A, with the §20.1 reason.
- **§21 API catalog:** applies; the `/result-lagn` row replaced whole from the row on `main` at execution, Status `Wired` / Auth `guest` in the closed sets, Authorizing WP gains `WP-812 / D-24720`, footer line.

**Verdict: PASS (21 / 21 resolved)**, independent lint subagent, one round; its optional nits (the §2 wording, the baseline line, the `/lagn` anchor, the EC's roadmap-counts step and verbatim client signature) applied.

## Gate Record

**Pre-flight (01.4), round 1** (independent subagent, scaffold re-applied: 1767 → 1772 / 0 fail, legends-board 135 → 137, three mutants reproduced): **NOT READY**.
- **PS-1:** the engine stores a match the players ended early as `{ outcome: 'tie', endedEarly: true }` (D-24306); the draft would have labelled it "Draw". Fixed with a third value, `'ended-early'` → "Ended early" (the reviewer's alternative; folding it into `'unknown'` was rejected because the outcome is known).
- RS applied: the decisive-test edit disclosed; an ended-early live-verify step; baseline refreshed. RS-4 (a scored tie loses `result.score`) is pre-existing and out of scope.

**Pre-flight, round 2:** **READY TO EXECUTE** (conditional on WP-811), no PS items; three wording nits applied.

**Copilot (01.7), round 1:** **RISK → HOLD**, six findings, all applied with no allowlist change:
1. The ended-early test passed for a reason-keyed mutant and never touched the engine. Now built with the engine's `evaluateEndgame` (`engineVerdictFor`), plus a no-`reason` case.
2. Nothing pinned ended-early at the route. Added a route test (route +2).
3. Precedence was unpinned. Added a decisive-with-`endedEarly` pairing entry and a client Victory-beats-reason assertion; the Contract states it.
4. The #2779 interplay was understated (it also replaces the catalog row and adds 3 tests). The row is now rebuilt from `main`; the EC baseline names "+3".
5. The `Tests-changed:` wording was inaccurate. Reworded exactly (only the malformed-body test changes its expected label).
6. Live-verify SQL needs Jeff; step 4 leads with a no-DB "End Game" path.

**Pre-flight, round 3** (after the copilot edits): one PS (the EC banned engine imports outright). Fixed to production code only → **READY TO EXECUTE**.

**Copilot, round 2:** **RISK → HOLD**, one finding: the client could call an unrecognized reason "Draw" (mutant H survived). One assertion added; mutant H observed failing (1 fail) → **CONFIRM**. Mutants E (route re-derives inline), F (snake_case flag) and G (any `reason` string is a tie) were killed.

**Lint (00.3):** **PASS (21 / 21)**, one round.

**Scaffold at close** (`2802b902`): server 1767 → 1774 / 0 fail / 207 skipped; legends-board 135 → 138 / 0 fail; `vue-tsc` 0; twelve AC 7 mutants each killed.
