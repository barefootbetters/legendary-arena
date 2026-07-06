# EC-344 — Diagnostic Export: Card-Effect Provenance (Execution Checklist)

**Source:** docs/ai/work-packets/WP-314-diagnostic-effect-provenance.md
**Layer:** Client (`apps/arena-client` — diagnostics)

## Before Starting
- [ ] On `main`, clean, synced; baseline recorded.
- [ ] WP-228/246 export present: `apps/arena-client/src/diagnostics/diagnostics.ts` builds the export from a `uiStateSnapshot` + context; `hollowEffects` already rides the snapshot (WP-258).
- [ ] Confirm the registry card-text lookup the HUD already uses (for `abilityText`) — reuse it, add no new registry path.
- [ ] arena-client `test`+`typecheck` green on `main`.
- [ ] Lands cleanest AFTER WP-313 (so `pendingVictoryPileCardPick` is projected + surfaced) but has no hard dependency.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- `recentlyPlayedCards` cap = **N = 5** (locked const + `// why:`).
- `outcome` closed set = `{ resolved, hollow, awaitingChoice, conditionNotMet }`; `resolved` is the default (absence of a negative signal), NOT a positive engine confirmation (that is the deferred Option B).
- `awaitingPlayerInput.kind` closed set = `{ victoryPileCardPick, optionalKoReward, drawOrEmpowered, koHeroChoice }` (mirrors the projected `pending*` fields); `null` when none pending.
- Reserved decision: **D-24100**.

## Guardrails
- Client-only + read-only + PURE: `buildEffectProvenance(snapshot, resolveCardText)` derives from the UIState the client already holds + the registry; NO engine/`G`/server read, no new npm dep, no wall-clock.
- **Fail-soft:** a missing registry entry → `abilityText: null`; an unparseable log line → skip; the export MUST NOT throw or block (WP-246 robustness). No `.reduce()`; `for...of`.
- No new private data in the file — read only what is already in the (audience-filtered) exported snapshot; no redaction regression.
- No on-screen UI change (export payload only; `HollowEffectsPanel` already owns the on-screen hollow view).

## Required `// why:` Comments
- The N=5 cap (bounds export size on a long log).
- The fail-soft degrade (why a missing card → null, never a throw — the export must stay robust).
- `outcome: 'resolved'` is a default/inference, not a positive confirmation (cite the WP-314 scope note / D-24100).

## Files to Produce
- `apps/arena-client/src/diagnostics/effectProvenance.ts` [new — `buildEffectProvenance`] + `effectProvenance.test.ts` [new].
- `apps/arena-client/src/diagnostics/diagnostics.ts` [modify — attach `effectProvenance` + the context type].
- Governance: `docs/ai/DECISIONS.md` (D-24100), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] arena-client `test`+`typecheck`, `pnpm -r build` pass.
- [ ] `git diff --name-only | Select-String "packages/|apps/server"` → no output (client-only).
- [ ] `Select-String effectProvenance.ts "awaitingPlayerInput|recentlyPlayedCards"` → present.
- [ ] STATUS.md / DECISIONS.md (D-24100) / WORK_INDEX.md (WP-314 checked off) / EC_INDEX.md (EC-344 Done). Surface = diagnostics-only → no D-24026 live gate.

## Common Failure Smells
- The export throws on a card with no registry entry → fail-soft not honored (must degrade to null).
- `outcome` claims `resolved` for a card whose marker is in `hollowEffects` → the hollow cross-reference is wrong.
- Export size balloons on a 900-line log → the N=5 cap isn't applied.
- Any diff under `packages/` or `apps/server` → scope breach (client-only).
