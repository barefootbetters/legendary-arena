# EC-343 — Victory-Pile Villain-Pick UX (Execution Checklist)

**Source:** docs/ai/work-packets/WP-313-victory-pile-pick-ux.md
**Layer:** Game Engine UIState (projection) + Client (arena-client) — co-release

## Before Starting
- [ ] On `main`, clean, synced; baseline `git rev-parse origin/main` recorded.
- [ ] WP-285 engine present: `hasPendingVictoryPileCardPick`, `getEligibleVictoryVillains`, `resolveVictoryPileCardPick({cardId})` (registered `client:false` in `game.ts`), block-all guards, `PendingVictoryPileCardPick`.
- [ ] Confirm the villain printed-attack read path (`G.cardStats[cardId].fightCost`) is reachable from the `ui/` projection layer — else STOP (session protocol).
- [ ] engine `build`+`test` and arena-client `test`+`typecheck` green on `main`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Attack value = the picked villain's `fightCost` (printed attack; the `.attack` field is 0 for villains — WP-285).
- Eligibility = `getEligibleVictoryVillains(G, playerID)` (victory pile ∩ `villainDeckCardTypes === 'villain'`) — reuse it, do NOT re-implement.
- Projection field is **optional** (`pendingVictoryPileCardPick?:`) → NO arena-client fixture backfill; the new UI type MUST be re-exported from `packages/game-engine/src/index.ts` (client-imported).
- Chooser-redaction: field present ONLY for the chooser audience (keyed on `playerID`), mirroring `pendingDrawOrEmpowered`.
- Reserved decision: **D-24099**.

## Guardrails
- Engine change is confined to the READ-ONLY `ui/` projection + `index.ts` re-export. NO move / guard / park / resolve / attack-math / `game.ts` edit. The projection never mutates `G`.
- Client stays read-only: the prompt renders the projected eligible list + submits `resolveVictoryPileCardPick({cardId})`; it never computes attack or filters authoritatively.
- Prompt is NON-dismissible while pending; End Turn / Pass disabled via `hasPendingVictoryPileCardPick` (from the new UIState field) so the UI mirrors the engine block-all.
- No `.reduce()` in the projection loop; `for...of`. No new npm dep. Determinism unchanged (pure read-only projection; `finalStateHash` unaffected).

## Required `// why:` Comments
- Projection: the chooser-redaction key + the `fightCost`-as-attack read (cite WP-285 + D-24099).
- Client gate: End-Turn disabled while pending (mirror the engine block-all; cite D-24067 + D-24099).
- DECISIONS D-24099: projection + prompt = the missing WP-285 UX half; attack = fightCost; optional field.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` [modify — `UIPendingVictoryPileCardPick` + optional field] + `uiState.build.ts` [modify — projection] + `uiState.build.test.ts` [modify — tests] + `src/index.ts` [modify — re-export].
- `apps/arena-client/src/components/play/VictoryPileCardPickPrompt.vue` + `.test.ts` [new] + `uiMoveName.types.ts` [modify — add `'resolveVictoryPileCardPick'`] + `composables/useTurnActions.ts` (+ `.test.ts`) [modify — End-Turn gate] + `pages/PlayDesktop.vue` + `PlayMobile.vue` (+ `TurnActionBar.vue` if the gating host) [modify — mount + gate].
- Governance: `docs/ai/DECISIONS.md` (D-24099), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] engine `build`+`test`, arena-client `test`+`typecheck` (vue-tsc), `pnpm -r build` all pass.
- [ ] `git diff --name-only packages/game-engine | Select-String "moves/|game.ts|rules/"` → no output (engine gameplay unchanged).
- [ ] `Select-String uiMoveName.types.ts "resolveVictoryPileCardPick"` → present.
- [ ] Live-on-surface (D-24026): play The Ebony Blade with a villain in the victory pile → pick prompt → pick → gain Attack → continue (no freeze). Evidence + SHA.
- [ ] STATUS.md / DECISIONS.md (D-24099) / WORK_INDEX.md (WP-313 checked off) / EC_INDEX.md (EC-343 Done).

## Common Failure Smells
- vue-tsc red "UIPendingVictoryPileCardPick has no exported member" → forgot the `index.ts` re-export (recurring — arena-client imports the type).
- The prompt shows but End Turn still works → the gate isn't wired to the new field → the UI can desync from the engine block-all.
- Any diff under `packages/game-engine/src/moves/**` or `game.ts` → scope breach (engine change must be `ui/` + `index.ts` only).
- Projecting the field for non-choosers → redaction breach (leaks the chooser's pending state to other audiences).
