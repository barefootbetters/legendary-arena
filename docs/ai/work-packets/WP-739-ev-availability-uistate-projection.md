# WP-739 — Project `economy.excessiveViolenceAvailable` onto UIState (Engine)

**Status:** Ready
**Primary Layer:** Game Engine / UIState projection
**User-Visible Surface:** `play.legendary-arena.com` (consumed by WP-738; no rendered change in this WP)
**Dependencies:** WP-736 / D-24556 (the `G.turnEconomy.excessiveViolencePlayedCards` ledger + `excessiveViolenceUsedThisTurn` flag this reads), WP-581 / D-24390 (`recruitSpendableAsAttack` — the exact active-player-only omit-when-absent economy-projection precedent), WP-128 / D-12803 (the `filterUIStateForAudience` redaction matrix + `REDACTED_ECONOMY`)
**Lane:** Standard (two-session). NOT lightweight-eligible: the built-projection **keyset drift pin** (`code-style.md` WP-563 / D-24372 — the only drift protection an omit-when-absent optional field has) + the audience-filter test push the allowlist to 5 files. Small and strictly additive, but the drift-pin requirement takes it out of the ≤4-file lane.

> Baseline: `origin/main` at the `SPEC: reserve WP-739 … WP-738` ledger commit (on top of WP-736 #2258 + the D-24026 disposition #2261).

---

## Goal

After this session, the engine's client-visible `UIState` carries a new active-player-only boolean `economy.excessiveViolenceAvailable`, true exactly when the current player could fight "using Excessive Violence" — i.e. they have enrolled at least one Excessive Violence card this turn AND have not yet used EV this turn. It is projected read-only through the two-stage `playerView` pipeline (build → audience-filter), omit-when-absent (present only when true), and redacted from every non-active audience. It surfaces *whether* EV is available, never the ledger's card identities. This is the single signal the WP-738 client affordance needs to offer "Fight using Excessive Violence" only when it would do something.

---

## User-Visible Impact

None in this WP by itself — it adds a projection field, not a rendered element. The visible payoff lands in WP-738, which reads this field to show/enable the fight-with-EV control. (Shipping the projection first, client second, mirrors the Dark Portal WP-728→WP-727 and split-hero WP-724→WP-725 engine-then-client pairing.)

---

## Assumes

- **WP-736 shipped** — `G.turnEconomy` carries the omit-when-off `excessiveViolencePlayedCards?: CardExtId[]` ledger (appended at play by `heroEffectExcessiveViolence`) and `excessiveViolenceUsedThisTurn?: boolean` (set at the first EV fight). Both are dropped every turn by `resetTurnEconomy`. This WP only READS them.
- **The economy projection pattern exists** — `buildUIState` (`ui/uiState.build.ts` ~918-940, the "Project economy" block) builds `economy` and conditionally spreads `recruitSpendableAsAttack` (present only when the flag is set); `filterUIStateForAudience` (`ui/uiState.filter.ts`) rebuilds the active player's economy field-by-field (~413-428) with the same conditional pass-through, and hands every other audience `REDACTED_ECONOMY` (~43) which omits the cue flags.
- **`UITurnEconomyState`** (`ui/uiState.types.ts` ~723-736) is the extensible economy projection type; `recruitSpendableAsAttack?: boolean` is the additive-optional precedent.
- **The Board-Visible Field Rule (5 steps)** is the governing contract (`.claude/rules/architecture.md §UIState Projection Integrity`): a client-visible field must be declared (type), populated (build), passed through (filter), audience-filter-tested, and confirmed in the Play-Diagnostics `uiStateSnapshot`. A field that reaches build but not the filter whitelist is silently dropped (the EC-206 failure).
- `pnpm --filter @legendary-arena/game-engine build && … test` green on baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/ui/uiState.types.ts` — `UITurnEconomyState` (~723); add the field beside `recruitSpendableAsAttack?` with the same JSDoc shape (active-player-only, omit-when-absent, cite WP-739/D-24560).
- `packages/game-engine/src/ui/uiState.build.ts` — the "Project economy" block (~918-940); add the conditional spread computed from `gameState.turnEconomy`.
- `packages/game-engine/src/ui/uiState.filter.ts` — the active-player economy rebuild (~413-428) + `REDACTED_ECONOMY` (~43); mirror the `recruitSpendableAsAttack` pass-through exactly.
- `packages/game-engine/src/ui/uiState.filter.test.ts` (or the audience-filter test file) — the recruitSpendableAsAttack audience test is the template.
- `packages/game-engine/src/economy/economy.types.ts` — `TurnEconomy.excessiveViolencePlayedCards?` / `excessiveViolenceUsedThisTurn?` (the source fields).
- `.claude/rules/architecture.md §UIState Projection Integrity` + `.claude/skills/legendary-persistence` — the 5-step contract and the "UI consumes read-only projections" boundary.
- User memory: `project_arena_client_uistate_backfill_recurrence` + `reference_uistate_filter_whitelist_drops_fields` (the pass-through-or-silently-dropped failure mode).

---

## Non-Negotiable Constraints

- Full file contents for every changed file; ESM, Node v22, `node:` imports; human-style code (`00.6`); `// why:` on the projection (cite WP-739/D-24560).
- **Read-only projection.** This WP reads `G.turnEconomy` and writes only to the derived `UIState`; it never mutates `G`, `ctx`, or the ledger. `playerView` output is not hashed → no `finalStateHash`/PRE_WP080 impact (assert none moves; expected byte-unchanged).
- **Omit-when-absent.** The field is spread in ONLY when true (never `excessiveViolenceAvailable: false` or `: undefined`). A turn where EV is unavailable serializes with the key absent, byte-identical to today's economy block.
- **Active-player-only.** The field is passed through only in the active player's economy rebuild in `filterUIStateForAudience`; `REDACTED_ECONOMY` (non-active players + spectators) never carries it. A non-active audience MUST NOT see whether another player has EV available.
- **Whether, not what.** The projection is a single boolean — it never exposes `excessiveViolencePlayedCards` contents (no `CardExtId` leaks into UIState).
- **The 5-step contract is binding.** Miss the filter pass-through (step 3) and the field is silently dropped for every audience (the EC-206 / D-12803 failure). The audience-filter test (step 4) and the Play-Diagnostics check (step 5) are required, not optional.
- No new pending choice, no client change in this WP, no move change, no `G` field.

---

## Scope (In)

- `ui/uiState.types.ts` — add `excessiveViolenceAvailable?: boolean` to `UITurnEconomyState`.
- `ui/uiState.build.ts` — populate it: `...(evAvailable ? { excessiveViolenceAvailable: true as const } : {})`, where `evAvailable = (gameState.turnEconomy.excessiveViolencePlayedCards?.length ?? 0) > 0 && gameState.turnEconomy.excessiveViolenceUsedThisTurn !== true`.
- `ui/uiState.filter.ts` — pass it through in the active-player economy rebuild (conditional spread, mirroring `recruitSpendableAsAttack`); `REDACTED_ECONOMY` unchanged (does not carry it).
- Audience-filter test — assert the field survives for the active/owner audience when set, is absent when EV is unavailable, and is redacted (absent) for non-active players + spectators.
- **Built-projection keyset drift pin** (`ui/uiState.types.drift.test.ts`) — mirror the `recruitSpendableAsAttack` pin (~:765): materialize `G.turnEconomy.excessiveViolencePlayedCards = ['…']` so the field projects `true`, run `buildUIState`, and assert `Object.keys(result.economy).sort()` includes `excessiveViolenceAvailable`; assert an empty ledger projects the key ABSENT. This is the **only** drift protection an omit-when-absent optional field has (`code-style.md` WP-563 / D-24372) — a `satisfies`/literal pin can never catch it, and the existing keyset pins don't cover it (neither of their fixtures enrols an EV card, so they stay green — no re-pin). This also hosts AC#2's build-side present/absent assertion.

## Out of Scope

- The client affordance (WP-738) — this WP renders nothing.
- Any change to the EV mechanic, the fight moves, or `G.turnEconomy`.
- Exposing the ledger contents, the enrolled-card count, or the once-per-turn flag directly — only the derived boolean.
- Scoring / PAR / identity / persistence surface.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `excessiveViolenceAvailable?: boolean` on `UITurnEconomyState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — conditional-spread population
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — active-player pass-through
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — audience-filter test (owner sees it / redacted for others / absent when unavailable)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — the built-projection keyset drift pin + AC#2's build-side present/absent assertion (materialize the EV ledger, run `buildUIState`, assert the economy keyset)

(5-file allowlist. No `finalStateHash` re-pin: `playerView` is not hashed; the field is omit-when-absent; neither existing drift fixture enrols an EV card. VERIFY none moves.)

---

## Contract

- `UITurnEconomyState.excessiveViolenceAvailable?: boolean` — read-only projection, present (as `true`) only when the ACTIVE player has `≥1` enrolled EV card this turn AND has not yet used EV; absent otherwise and for every non-active audience.
- Computation (in `buildUIState`): `evAvailable = (gameState.turnEconomy.excessiveViolencePlayedCards?.length ?? 0) > 0 && gameState.turnEconomy.excessiveViolenceUsedThisTurn !== true`.
- Redaction: passed through only in `filterUIStateForAudience`'s active-player economy branch; `REDACTED_ECONOMY` never carries it.

---

## Acceptance Criteria

1. `UITurnEconomyState` declares `excessiveViolenceAvailable?: boolean` with WP-739/D-24560 JSDoc; TypeScript build clean.
2. `buildUIState` sets `economy.excessiveViolenceAvailable === true` when the active player has enrolled ≥1 EV card this turn and has not used EV; the key is ABSENT (not `false`/`undefined`) otherwise — asserted via a real `buildUIState` call in `uiState.types.drift.test.ts` (a materialized-ledger case and an empty-ledger case).
3. `filterUIStateForAudience` passes the field through for the active player only; it is ABSENT for non-active players and spectators (a redaction test asserts both directions).
4. A turn with no EV card played, and a turn where EV was already used, both project the field absent.
5. The Play-Diagnostics `uiStateSnapshot` shows `economy.excessiveViolenceAvailable` when set (the field flows through the whole pipeline, not dropped at the filter).
6. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0; `finalStateHash` unchanged (playerView is not hashed).
7. `uiState.types.drift.test.ts` carries a keyset drift pin on the BUILT economy projection (mirroring `recruitSpendableAsAttack` ~:765): with the EV ledger materialized, `Object.keys(economy)` includes `excessiveViolenceAvailable`; the existing drift keyset pins stay green (their fixtures enrol no EV card). Per `code-style.md` WP-563 / D-24372 this is the only drift protection the omit-when-absent field has.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `… test` → all pass (+ the new audience test).
2. Grep the audience test asserts owner-visible + non-active-redacted + absent-when-unavailable.
3. Confirm `finalStateHash` fixtures unchanged (playerView not hashed); revert any `lagn-v1.json` CRLF churn.

---

## Vision Alignment

**Clauses touched:** §2 (engine owns truth; UI consumes read-only projections), §8/§22 (determinism).
**Conflict assertion:** none — a read-only projection of existing runtime state, no new content, no rule change.
**Non-Goal check:** no pay-to-win / cosmetic-for-outcome / monetization surface; the field is a UX-availability cue derived solely from game state.
**Determinism:** `playerView` is not hashed; the field is omit-when-absent → non-EV turns byte-identical; no `G`/`ctx` mutation.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved. §1 structure present; §2 constraints (full files, ESM, read-only, 5-step contract); §3 assumes (WP-736 ledger, the economy-projection pattern, the Board-Visible Field Rule); §4 context (exact files/lines, the rules doc, memories); §5 files (4-file allowlist); §6 naming (`excessiveViolenceAvailable`, `UITurnEconomyState`, matches existing); §7 no new deps; §8 boundaries (Game Engine UIState only; read-only; no `G` mutation); §9 pnpm commands; §10/§11 N/A (no env/auth); §12 `node:test`; §13 verification commands; §14 six binary AC; §15 DoD (STATUS/DECISIONS/indices + surface line); §16 code style (mirror recruitSpendableAsAttack, no premature abstraction); §17 triggered (determinism + projection) — Vision Alignment present; §18 no forbidden-token prose (grep targets the new field name); §19 baseline SHA cited; §20 N/A funding; §21 N/A (no HTTP endpoint / server library fn). **Verdict: PASS/justified-N/A.**

## Pre-flight (01.4)

Independent gate subagent, verified against live source. All six load-bearing claims TRUE: the `recruitSpendableAsAttack` precedent is exact (`uiState.types.ts:737`, `build.ts:939-941`, `filter.ts:425-427` active-player pass-through + `REDACTED_ECONOMY:43-50` omit); the source fields exist (`economy.types.ts:88`/`:100`, carried by `carryConversionFlag`, dropped by `resetTurnEconomy`); the 5-step Board-Visible Field contract is real and mapped; `playerView` (`game.ts:476`) is the projection boundary and is NOT part of `finalStateHash`/`PRE_WP080_HASH` → the no-re-pin claim holds. **RS-1 + RS-2 folded in:** the build-side AC#2 assertion + the built-projection keyset drift pin now live in `uiState.types.drift.test.ts` (added to the allowlist, 4→5 files), so the executor won't blow the `git diff` DoD reaching for a test home outside scope. **Verdict: READY TO EXECUTE.**

## Copilot (01.7)

Independent gate subagent (30-mode). Engine-side projection near-clean: omit-when-absent locked (`as const` spread + `JSON.stringify` absence), active-player redaction tested both directions, whether-not-what (no `CardExtId` leak), full 5-step contract, read-only/no-hash. **One HOLD (folded in):** the missing built-projection keyset drift pin — per `code-style.md` WP-563 / D-24372 the only drift protection an omit-when-absent optional field has, and the original 4-file allowlist locked the executor out of `uiState.types.drift.test.ts`. Now added to §Scope/§Files/AC#7 + the allowlist (the gate confirmed the existing pins won't false-red, corroborating "no re-pin"). **Verdict: RISK → PASS after the HOLD (applied).**

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the 4-file allowlist.
- [ ] `docs/ai/STATUS.md` updated; D-24560 Active in `DECISIONS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] **D-24026 live-verify:** N/A for this WP in isolation (renders nothing) — the availability cue is verified end-to-end by WP-738. This WP's correctness is the audience-filter test + the diagnostics snapshot showing the field.
