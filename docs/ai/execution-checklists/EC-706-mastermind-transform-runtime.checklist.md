# EC-706 — Mastermind Transform runtime: flip primitive + second-face capture (General Ross) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-669-mastermind-transform-runtime.md
**Layer:** Game Engine (mastermind setup + strike-time flip runtime)

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm `mastermind.setup.ts` `findMastermindCards` still keeps only the FIRST non-tactic face (D-24193, the `else if (baseCard === null)` guard) and that `wwhk/general-thunderbolt-ross` in `data/cards/wwhk.json` still ships two non-tactic faces (General Ross `wwhk-mm-…`, Red Hulk `wwhk-me-…`) + tactics.
- [ ] Read the models: `MastermindState` (mastermind.types.ts); `buildMastermindState` + `findMastermindCards` (mastermind.setup.ts); `mastermindStrikeHandler` dispatch on `G.selection.mastermindId` (mastermindHandlers.ts:~1146); `buildCardDisplayData` mastermind loop (walks all `mastermind.cards` — the second face's display is ALREADY built, do not touch it); `defeatTopTactic` (the copy-then-override precedent, mastermind.logic.ts).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record baselines).

## Locked Values (do not re-derive)
- Allowlist: **`MASTERMIND_TRANSFORM_ALLOWLIST`** in `mastermind.setup.ts`, first entry **`wwhk/general-thunderbolt-ross`** ONLY (the SUPPORTED_TRANSFORM_BASES hero precedent).
- New `MastermindState` fields (OPTIONAL — the `hypnoThralls?`/`gameText?` precedent): **`alternateFaceId?: CardExtId`** (the inactive face) + **`faceGameText?: Record<CardExtId, readonly string[]>`** (per-face ability lines). Populated ONLY for an allowlisted mastermind; emit via CONDITIONAL SPREAD so they are ABSENT (not undefined) otherwise.
- Setup: `findMastermindCards` returns `secondFaceCard` (the second non-tactic face, or null). `buildMastermindState`, when `MASTERMIND_TRANSFORM_ALLOWLIST.has(mastermindId) && secondFaceCard !== null`, adds `cardStats[secondFaceId] = { …, fightCost: parseCardStatValue(secondFaceCard.vAttack), fightCostMode:'static' }` and sets `alternateFaceId` + `faceGameText = { [baseCardId]: gameText, [secondFaceId]: <its lines> }`.
- Flip: **`transformMastermind(mastermindState)`** in `mastermind.logic.ts` — copy-then-override, swap `baseCardId ↔ alternateFaceId`, `gameText = faceGameText[nextFace] ?? gameText ?? []`; no-op (returns input) when `alternateFaceId === undefined`.
- Strike: **`resolveGeneralRossStrike(gameState)`** in `mastermindHandlers.ts` + a dispatch branch `else if (mastermindId === MASTERMIND_GENERAL_ROSS)`. Rebind `gameState.mastermind = transformMastermind(...)`; log the flip `applied`, the ride-along `neutral` (honest-partial), and a `blocked` hollow when `alternateFaceId` is absent.

## Guardrails
- **The second face's cardDisplayData is ALREADY built** (buildCardDisplayData walks every `mastermind.cards`). Do NOT touch buildCardDisplayData. Only `cardStats` needs the second face added (in setup) — `buildCardStats` does not add masterminds.
- **Optional + allowlist-gated → NO hash re-pin.** A non-transform game (incl. the sentinel `core/dr-doom`) must be byte-identical. Confirm the `PRE_WP080_HASH` + sentinel `finalStateHash` pin tests pass UNCHANGED — if one moves, the conditional spread leaked an `undefined` key or the field was added unconditionally.
- **`transformMastermind` is copy-then-override** (`...mastermindState`) so a future MastermindState field survives a flip (the `defeatTopTactic` lesson).
- Handlers never throw; the strike resolver safe-skips (honest-hollow log) when the second face is absent.
- Card data is UNTOUCHED — the two faces already exist in `wwhk.json`; no marker, no regen. Do NOT run `ledger:heroes`/`effect-index` (mastermind faces are not in the hero ledger).

## Required `// why:` Comments
- The setup allowlist: why the second face is captured only for these masterminds (D-24193 drops it for Epic variants).
- The optional fields + conditional spread: why absent for non-transform masterminds (byte-identical, no re-pin).
- The flip's copy-then-override: why every unrelated field must survive.
- The strike resolver's honest-hollow branch: why a not-captured mastermind logs rather than silently no-ops.

## Files to Produce
- `mastermind/mastermind.types.ts`, `mastermind/mastermind.setup.ts`, `mastermind/mastermind.logic.ts`, `rules/mastermindHandlers.ts`.
- `mastermind/mastermind.setup.test.ts`, `mastermind/mastermind.logic.test.ts`, `rules/mastermindHandlers.test.ts`.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24483), `NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record count); `pnpm -r build` 0.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged (NO re-pin).
- [ ] **Control run:** drop `wwhk/general-thunderbolt-ross` from the allowlist; AC-1 fails (no capture), the strike falls to the AC-5 hollow. Restore. Record.
- [ ] `git diff --name-only` = ledger + the 7 engine files (no card-data, no derived artifacts).
- [ ] **D-24026 live-on-surface:** a real General Ross match flips to Red Hulk on a Master Strike — operator-pending.
- [ ] `docs/ai/STATUS.md`; `DECISIONS.md` D-24483 Active; `WORK_INDEX.md` + `EC_INDEX.md` rows; mindmap node + `pnpm roadmap:counts:write` / `roadmap:counts:check`.

## Common Failure Smells
- A hash pin moves → an unconditional field add or an `undefined`-valued key leaked past the conditional spread.
- The face never flips → the dispatch branch missing, or `alternateFaceId` never captured (allowlist / secondFaceCard).
- fightMastermind reads the wrong cost after a flip → the second face's `cardStats` entry was not added at setup.
- The play surface shows `<unknown>` after a flip → the second face's cardDisplayData was somehow not built (should be automatic — do not special-case it).
