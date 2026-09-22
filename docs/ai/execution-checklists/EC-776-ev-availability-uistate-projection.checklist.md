# EC-776 — Project `economy.excessiveViolenceAvailable` onto UIState (Execution Checklist)

**Source:** docs/ai/work-packets/WP-739-ev-availability-uistate-projection.md
**Layer:** Game Engine (UIState projection)

## Before Starting
- [ ] Baseline: `origin/main` incl. WP-736 (#2258) + the WP-739 reserve; working tree clean, synced.
- [ ] WP-736 shipped: `G.turnEconomy.excessiveViolencePlayedCards?: CardExtId[]` + `excessiveViolenceUsedThisTurn?: boolean` exist, omit-when-off, dropped by `resetTurnEconomy`. This WP only READS them.
- [ ] The economy-projection pattern: `buildUIState` "Project economy" block (`ui/uiState.build.ts` ~918-940) conditionally spreads `recruitSpendableAsAttack`; `filterUIStateForAudience` active-player branch (`ui/uiState.filter.ts` ~413-428) passes it through; `REDACTED_ECONOMY` (~43) omits it.
- [ ] `UITurnEconomyState` (`ui/uiState.types.ts` ~723) — `recruitSpendableAsAttack?: boolean` is the additive-optional precedent.
- [ ] The Board-Visible Field Rule (5 steps) — `.claude/rules/architecture.md §UIState Projection Integrity`. A field that reaches build but not the filter whitelist is silently dropped (EC-206).
- [ ] `pnpm --filter @legendary-arena/game-engine build && … test` green.
- [ ] Scope lock — target files = `Files to Produce`. Anything else is a FAIL.

## Locked Values (do not re-derive)
- Field: `UITurnEconomyState.excessiveViolenceAvailable?: boolean` (active-player-only, omit-when-absent — present only as `true`).
- Computation (in `buildUIState`): `evAvailable = (gameState.turnEconomy.excessiveViolencePlayedCards?.length ?? 0) > 0 && gameState.turnEconomy.excessiveViolenceUsedThisTurn !== true`.
- Populate: `...(evAvailable ? { excessiveViolenceAvailable: true as const } : {})` in the economy literal.
- Filter: mirror the `recruitSpendableAsAttack` pass-through in the ACTIVE-player economy rebuild; `REDACTED_ECONOMY` unchanged.

## Guardrails
- **Read-only.** Read `G.turnEconomy`; write only the derived `UIState`. NEVER mutate `G`/`ctx`/the ledger. `playerView` is not hashed → `finalStateHash` expected byte-unchanged (assert).
- **Omit-when-absent.** Spread in ONLY when true — never `excessiveViolenceAvailable: false`/`undefined`. A non-EV turn's economy block serializes byte-identical to today.
- **Active-player-only.** Pass through ONLY in the active-player economy rebuild; `REDACTED_ECONOMY` never carries it. A non-active audience MUST NOT learn another player's EV availability. Test BOTH directions.
- **Whether, not what.** A single boolean — never expose `excessiveViolencePlayedCards` contents (no `CardExtId` in UIState).
- **5-step contract binding.** Miss the filter pass-through (step 3) → silently dropped for all audiences (EC-206 / D-12803). The audience-filter test (step 4) + the Play-Diagnostics `uiStateSnapshot` check (step 5) are required.
- **Built-projection keyset drift pin REQUIRED** (`ui/uiState.types.drift.test.ts`, mirror `recruitSpendableAsAttack` ~:765). Materialize `G.turnEconomy.excessiveViolencePlayedCards = ['…']`, run `buildUIState`, assert `Object.keys(economy).sort()` includes `excessiveViolenceAvailable`; assert an empty ledger projects the key ABSENT (this hosts AC#2's build-side present/absent check too). Per `code-style.md` WP-563 / D-24372 a `satisfies`/literal pin can NEVER catch an omit-when-absent optional field — the keyset pin on a REAL built projection is its only drift protection. The existing drift keyset pins stay green (no fixture enrols an EV card) → no re-pin.
- No client change, no move change, no `G` field, no pending choice.

## Required `// why:` Comments
- `uiState.types.ts` field: WP-739 / D-24560 — active-player-only availability cue for the WP-738 EV affordance; omit-when-absent; whether-not-what.
- `uiState.build.ts` computation: WP-739 / D-24560 — enrolled ≥1 EV card this turn AND not yet used.
- `uiState.filter.ts` pass-through: WP-739 / D-24560 — active-player-only whitelist entry (a field not passed through here is silently dropped — the EC-206 failure).

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — the field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — the conditional-spread population
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — the active-player pass-through
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — audience-filter test (owner-visible when set / redacted for non-active + spectators / absent when unavailable)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — built-projection keyset drift pin + AC#2 build-side present/absent assertion (mirror `recruitSpendableAsAttack` ~:765)

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (+ the audience test)
- [ ] `finalStateHash` fixtures unchanged (playerView not hashed); `lagn-v1.json` CRLF reverted
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24560 (Active)
- [ ] WORK_INDEX WP-739 `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` = the 4-file allowlist

## Common Failure Smells
- The field appears in `buildUIState` output but not in the client's received UIState → the filter pass-through (step 3) is missing; it was silently dropped.
- A spectator/non-active player sees `excessiveViolenceAvailable` → it leaked out of the active-player branch into `REDACTED_ECONOMY`.
- The key serializes as `false`/`undefined` on a non-EV turn → not omit-when-absent; use the conditional spread.
- `finalStateHash` moved → something mutated `G` (it must be read-only) — investigate, never re-pin to force green.
