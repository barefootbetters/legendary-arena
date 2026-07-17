# EC-416 — Scenario Preview Deep-Link: Carry Player Count (Execution Checklist)

**Source:** docs/ai/work-packets/WP-387-scenario-preview-player-count.md
**Layer:** Client — registry-viewer + legends-board

## Before Starting
- [ ] Fresh `claude/*` worktree off current `origin/main`; `git status` clean; record the sha into WP §Baseline
- [ ] `pnpm install` + both app builds exit 0 BEFORE any suite
- [ ] WORK_INDEX confirms WP-114 ✅, WP-372 ✅, WP-345 ✅; else BLOCKED
- [ ] Baseline `registry-viewer` + `legends-board` build / typecheck / test all green
- [ ] **Scope lock:** exactly the 8 files in Files to Produce; any edit outside is a FAIL — surface first

## Locked Values (do not re-derive)
- Param name **`playerCount`**, integer **1..5** (D-24165 range); `parsePlayerCountFromUrl(search): number | null` — absent / non-integer / out-of-range / `?playerCount=` → `null`; **never throws**, never defaults inside the parser
- **Absent = byte-identical to today:** preview `playerCount` = `DEFAULT_PLAYER_COUNT` (2); editor draft unseeded; `buildChallengeUrl` without the 4th arg = the current two-key URL exactly
- **The value target is the EDITOR draft, not the preview** — the WP-372 required-count readout is driven by `useLoadoutDraft` `getPlayerCountSetup(draft.playerCount)`; seed it via `setPlayerCount(urlCount)` at `App.vue` mount (after `loadoutDraftApi.value = useLoadoutDraft(reg)`, `:350`). The preview composable update is for header consistency only.
- `parsePlayerCountFromUrl` is a **new SEPARATE** parser — `parseSetupUrl` returns `Partial<SetupCompositionInput>` (composition only); `playerCount` is envelope, so it does NOT join the composition parser (its type + return byte-unchanged); `serializeSetupToUrl` byte-unchanged
- `buildChallengeUrl` signature: `(setAbbr, schemeSlug, mastermindSlug, playerCount?)` — append `&playerCount=<n>` only when provided, via the existing `URLSearchParams` (order: schemeId, mastermindId, then playerCount)
- Board source: `GauntletBoardPanel.vue` per-leg links carry `activePlayerCount` (WP-385); `GauntletIndexPanel.vue` unclaimed-CTA link is NOT touched (omits the param → default)

## Guardrails
- No new npm dependency; no server/engine/preplan import; no `pg`; no server API call; no auth; no cookies/localStorage
- No `?lagn=` change, no snapshot/publisher change, no arena-client change
- Legends board stays zero-API (dist grep clean); registry viewer gains no `/api/me/*` call
- `parseSetupUrl` + `serializeSetupToUrl` byte-unchanged (their tests pass unmodified)
- `buildChallengeUrl` no-arg output pinned by a drift test (byte-identical to current)
- App/client packages MUST gate `typecheck` (vue-tsc) Before + After for BOTH registry-viewer and legends-board

## Required `// why:` Comments
- `parsePlayerCountFromUrl`: why a separate parser (envelope vs composition type contract); the 1..5 clamp source (D-24165)
- `App.vue` seed site: why the EDITOR draft (not the preview) is the slot-sizing target, and why seeding at mount is promote-path-independent
- `buildChallengeUrl` optional param: why the index CTA omits it (no routed count → default)

## Files to Produce
- `apps/registry-viewer/src/lib/setupUrlParams.ts` — **modified** — `parsePlayerCountFromUrl`
- `apps/registry-viewer/src/lib/setupUrlParams.test.ts` — **modified** — parser matrix; composition parser unaffected
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — **modified** — preview `playerCount` from URL
- `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` — **modified** — present / absent
- `apps/registry-viewer/src/App.vue` — **modified** — seed editor draft `setPlayerCount` at mount
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — `buildChallengeUrl` optional `playerCount`
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — with / without count (pinned strings)
- `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **modified** — pass `activePlayerCount`

## After Completing
- [ ] `registry-viewer` build / `typecheck` (vue-tsc) / test all exit 0
- [ ] `legends-board` build / `typecheck` (vue-tsc) / test all exit 0
- [ ] Zero-API grep on `apps/legends-board/dist/assets/*.js` — no `onrender` / `api.legendary-arena`
- [ ] `git diff --name-only` = exactly the 8 files (+ governance)
- [ ] Dev-smoke: `?schemeId&mastermindId&playerCount=4` → builder shows 4-player required counts; no-param → default
- [ ] Live-on-surface (D-24026) recorded (operator-pending on deploy acceptable)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-416 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-387 node + `pnpm roadmap:counts:write` (do NOT skip)

## Common Failure Smells
- Required-count readout still shows 2-player on a `?playerCount=4` link → the EDITOR draft was not seeded (only the preview changed)
- `parseSetupUrl` tests fail → the player-count parse leaked into the composition parser (must be a separate function)
- `buildChallengeUrl` no-arg drift test fails → the optional param path changed the two-key URL
- A `/api/me/*` or auth import appears in the registry viewer → Shape B leaked into Shape A
