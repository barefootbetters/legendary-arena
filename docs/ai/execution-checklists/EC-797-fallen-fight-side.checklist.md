# EC-797 — The Fallen fight-side (Execution Checklist)

**Source:** docs/ai/work-packets/WP-760-fallen-fight-side.md
**Layer:** Game Engine + Card Data (+ one Arena Client copy fix)

## Before Starting
- [ ] WP-750 is merged: City Fight gating reads `UICityCard.fightCost`. If not, STOP. A Blood Frenzy cost would leave a dead Fight button.
- [ ] WP-757 is merged: the `mdns/fallen` `ambush` marker rows are present.
- [ ] `resolveFightCost(G, villainCardId)` has exactly three production callers: `fightVillain`, `ai.legalMoves` and `uiState.build`.
- [ ] `computeFinalScores` victory-pile branch order is unchanged.
- [ ] `PendingKoDiscardChoice` and the "(Maniacal Tyrant)" log are at `koDiscardChoice.resolve.ts:~161`.
- [ ] If WP-748 has landed, its bystander term is present in `resolveFightCost`. Compose additively.
- [ ] `pnpm -r build` → 0 and the suites are green. Re-read the primitive drift count.

## Locked Values (do not re-derive)
- `resolveFightCost(G, villainCardId, fightingPlayerId?: string)`. Omitting the player means a Blood Frenzy term of 0.
  - `fightVillain` passes `ctx.currentPlayer`.
  - `ai.legalMoves` passes `activePlayer`.
  - `uiState.build` passes `ctx.currentPlayer`.
- Blood Frenzy term = `countDistinctVictoryPointValues(G, player)` when `G.villainBloodFrenzy?.[id] === true`. Use explicit `if`, not ternary chains.
- `victoryPointValueForCard(G, playerId, cardId)` mirrors `computeFinalScores` in this order:
  1. dynamic villain, then printed, then `VP_VILLAIN`
  2. henchman: printed, then `VP_HENCHMAN`
  3. bystander: `VP_BYSTANDER`
  4. defeated tactic: `cardVictoryPoints[mastermind.baseCardId] ?? VP_TACTIC`
  5. Undercover card (`zones.undercover`): `VP_UNDERCOVER`
  6. otherwise `null`

  Distinct count = the size of the set of non-null values (negative and zero values count).
- `G.villainBloodFrenzy?: Record<CardExtId, true>` is omit-when-empty. It is built by `setup/buildVillainBloodFrenzy.ts` from `[keyword:Blood Frenzy]`, one entry per copy id. `BoardKeyword` is NOT widened.
- Primitives: `'reveal-top-draw-if-cost-lte'` and `'ko-up-to-from-discard-current'`, each with a `:N` magnitude.
- Markers under `mdns/fallen`:
  - `atrocity.fight ["captureBystander"]`
  - `patriarch.fight ["reveal-top-draw-if-cost-lte:3"]`
  - `salom-sorceress-supreme.fight ["ko-up-to-from-discard-current:2"]`
- `PendingKoDiscardChoice.sourceCardId?: CardExtId`. When it is present, the log names the card via `G.cardDisplayData`; otherwise it reads `Maniacal Tyrant` (explicit `if`).
- Client header in `PendingKoDiscardChoicePrompt.vue`: `KO up to {{ maxCount }} card{{ maxCount === 1 ? '' : 's' }} from your discard pile`.
- Provenance and subsystem:
  - both primitives → `{ wp: 'WP-760', decision: 'D-24589' }` in `mechanic-provenance.json`
  - `subsystem-coverage.json` `cards`: `mdns-villain-fallen-metarchus` and `mdns-villain-fallen-salom-sorceress-supreme` → `{ subsystem: 'economy:fight-cost-modifier', wp: 'WP-760', decision: 'D-24589' }`. Documentation-only; their ledger rows stay `executable`.

## Guardrails
- The cost term lives ONLY in `resolveFightCost`, so the fight gate, the bot and the projection always agree.
- Do NOT refactor `computeFinalScores` (duplicate first). The parity test pins the mirror against `villainVP + henchmanVP + bystanderVP + tacticVP + undercoverVP`, using a pile that includes a tactic and an Undercover card.
- `villainBloodFrenzy` is assigned onto `G` only when non-empty, keeping the hash oracles byte-stable.
- Patriarch:
  - an empty deck reshuffles the discard via `shuffleContext`; if both are empty, it's a no-op;
  - a Wound reads cost 0;
  - it moves to hand if cost ≤ N, otherwise stays on top with a log line;
  - it is not subject to the draw lock.
- Salomé: an empty discard is a no-op. Otherwise park with `sourceCardId` and return `{ pending: true }`. The Maniacal Tyrant entry stays byte-identical because `sourceCardId` is omitted there. Never store display text in `G`.
- Salomé's Escape (Ascend) stays inert. Do not start an additional-Mastermind model.
- Engine only, plus the one client header edit. Moves and effects never throw. No `.reduce()`.

## Required `// why:` Comments
- The optional `fightingPlayerId`: Blood Frenzy reads the fighter's Victory Pile, and only the active player can fight, so the projection shows the active player's cost to every audience.
- The `victoryPointValueForCard` mirror: duplicated from scoring on purpose; the parity test pins it.
- `villainBloodFrenzy` omit-when-empty, and not a `BoardKeyword` (Blood Frenzy isn't City-structural).
- Patriarch: Wound = 0 (D-24583), the empty-deck reshuffle (D-24285), no draw lock (WP-731 precedent).
- The `sourceCardId` fallback keeps the Maniacal Tyrant log unchanged.
- The client header is source-neutral because two cards now park this choice.
- Atrocity via `captureBystander` on Fight = rescue (D-18506).

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified**
- `setup/buildVillainBloodFrenzy.ts` + test — **new**
- `setup/buildInitialGameState.ts` — **modified**
- `economy/bloodFrenzy.logic.ts` + test — **new**
- `economy/economy.resolve.ts`, `moves/fightVillain.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.build.ts`, each with its test — **modified**
- `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `moves/koDiscardChoice.resolve.ts`, each with its test — **modified**
- `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` + test — **modified**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`, `scripts/coverage/subsystem-coverage.json` — **modified**
- `data/cards/mdns.json` + the derived feeds — **regenerated**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Engine suite passes. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Markers idempotent. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:villains:check`, `sim:runtime-observed:check` and `sim:coverage --check` all → 0.
- [ ] `finalStateHash` unchanged, or dual-re-pinned honestly.
- [ ] D-24589 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- Metarchus cost is correct in the engine but the tile is clickable at 3 → WP-750 isn't in, or `uiState.build` didn't pass the player.
- Bot FAULT fighting Metarchus → `ai.legalMoves` didn't pass the player, so its cost disagrees with the move.
- The hash oracle moved on a core replay → `villainBloodFrenzy` became always-present.
- The distinct count is too high → it counted `null` (no-value cards) or duplicates.
- The Maniacal Tyrant log changed → `sourceCardId` was written on its entry.
- Salomé's prompt says "Maniacal Tyrant" → the client header wasn't made source-neutral.
- Patriarch never draws a Wound → cost was read as undefined instead of 0.
