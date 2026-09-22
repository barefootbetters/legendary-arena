# Session Prompt — WP-739 / EC-776: Project `economy.excessiveViolenceAvailable` onto UIState

**WP:** docs/ai/work-packets/WP-739-ev-availability-uistate-projection.md
**EC:** docs/ai/execution-checklists/EC-776-ev-availability-uistate-projection.checklist.md (authoritative)
**Reserves:** D-24560 (lands Active at govern-close). **Status:** READY TO EXECUTE (pre-flight READY; copilot PASS after the drift-pin HOLD).

> Committed via `git add -f` (session-*.md is gitignored). First half of the paired client-EV arc; WP-738 (the client affordance) consumes this field and is BLOCKED until it lands on `main`.

## Invocation intent

Add a read-only, active-player-only, omit-when-absent UIState field `economy.excessiveViolenceAvailable` = true iff the current player has enrolled ≥1 Excessive Violence card this turn AND has not yet used EV — so the WP-738 client can offer "Fight using Excessive Violence" only when it would do something. An EXACT mirror of the shipped `recruitSpendableAsAttack` projection (WP-581/D-24390). Engine UIState only; renders nothing itself.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md §UIState Projection Integrity` (the 5-step Board-Visible Field Rule)
3. `.claude/rules/code-style.md` (WP-563 / D-24372 — omit-when-absent optional fields need a keyset pin on a BUILT projection)
4. WP-739 (design) → EC-776 (execution contract)
5. Source anchors (verified by pre-flight): `ui/uiState.types.ts:737` (`recruitSpendableAsAttack?` precedent), `ui/uiState.build.ts:918-941` (economy block + conditional spread), `ui/uiState.filter.ts:410-431` (active-player rebuild `:425-427` + `REDACTED_ECONOMY:43-50`), `ui/uiState.types.drift.test.ts:765` (the keyset pin to mirror), `economy/types.ts` (`excessiveViolencePlayedCards?`/`excessiveViolenceUsedThisTurn?`)
6. User memory: `reference_uistate_filter_whitelist_drops_fields`, `project_arena_client_uistate_backfill_recurrence`

## Pre-execution checks

- Baseline `origin/main` clean + synced; WP-736 + the WP-739 reserve on main.
- `pnpm --filter @legendary-arena/game-engine build && … test` green.

## Execution rules (operationalizing WP-739 + EC-776 — no new scope)

- **Type:** add `excessiveViolenceAvailable?: boolean` to `UITurnEconomyState` (JSDoc: active-player-only, omit-when-absent, WP-739/D-24560, whether-not-what).
- **Build:** `...(evAvailable ? { excessiveViolenceAvailable: true as const } : {})` where `evAvailable = (gameState.turnEconomy.excessiveViolencePlayedCards?.length ?? 0) > 0 && gameState.turnEconomy.excessiveViolenceUsedThisTurn !== true`.
- **Filter:** pass it through in the ACTIVE-player economy rebuild only (mirror `recruitSpendableAsAttack`); `REDACTED_ECONOMY` unchanged (never carries it).
- **Tests (5-file allowlist):** the audience-filter test (owner-visible when set / redacted for non-active + spectators / absent when unavailable) in `uiState.filter.test.ts`; the **built-projection keyset drift pin** + AC#2 build-side present/absent assertion in `uiState.types.drift.test.ts` (materialize the EV ledger → run `buildUIState` → assert `Object.keys(economy)` includes the field; empty ledger → absent). The existing drift pins stay green (no fixture enrols EV) → no re-pin.
- **Guardrails:** read-only (never mutate `G`/ledger); omit-when-absent (never `false`/`undefined`); active-player-only; whether-not-what (no `CardExtId` in UIState); miss the filter pass-through → silently dropped (EC-206).
- **Determinism:** `playerView` is not hashed → `finalStateHash`/`PRE_WP080` expected byte-unchanged (VERIFY). No client change, no move change, no `G` field.

## SAFE-KNOBS scope

N/A.

## Session task

Execute WP-739 per EC-776: field + build + filter + audience test + drift pin. Lane per executor (standard or lightweight — note it is 5 files). Two-commit topology: `EC-776:` impl, then `SPEC:` govern-close (land D-24560 Active; WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, `roadmap:counts:write`, `ledger:numbers:check`; STATUS.md). One PR. **D-24026:** N/A for this WP in isolation (renders nothing) — the cue is verified end-to-end by WP-738.

## Post-merge close ritual (REQUIRED)

After merge: `node scripts/prune-empty-claude-branch.mjs --verify-current` (expect `VERIFY PASS`) → `git branch -D <branch>` + `git push origin --delete <branch>` → `--report` from canonical (silent). **Then unblock WP-738** (its hard dep is now on main).

## Scope restriction

Restates/operationalizes WP-739 + EC-776 only. No new scope/files/contract/locked-values/forbidden-patterns.
