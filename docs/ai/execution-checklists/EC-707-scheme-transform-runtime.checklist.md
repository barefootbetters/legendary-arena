# EC-707 — Scheme Transform runtime: flip primitive + second-face capture (Chthon) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-670-scheme-transform-runtime.md
**Layer:** Game Engine (scheme setup + a per-move flip check)

## Before Starting
- [ ] Re-baseline on `origin/main` (includes WP-669). Confirm `mdns/ritual-sacrifice-to-summon-chthon` and `mdns/great-old-one-chthon` (cardType `scheme-transform`) both exist in `data/cards/mdns.json`, and the base scheme text names the "5 Bystanders in the KO pile" flip trigger.
- [ ] Read the models: `SchemeState` (schemeState.types.ts); `buildSchemeGameText` + the `scheme: {...}` build (buildInitialGameState.ts:~638); `turn.onMove` (game.ts:~631, the per-move check cadence); the Bystander predicate (`heroConditions.evaluate.ts` — `BYSTANDER_EXT_ID` / `bystander-villain-deck-*`); the mastermind `transformMastermind` (the copy-then-override precedent).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record baselines).

## Locked Values (do not re-derive)
- Pairing: **`SCHEME_TRANSFORM_TARGETS: Record<string, { targetSchemeId, bystandersInKoToTransform }>`** in `scheme/schemeTransform.logic.ts`, first entry **`'mdns/ritual-sacrifice-to-summon-chthon' → { targetSchemeId: 'mdns/great-old-one-chthon', bystandersInKoToTransform: 5 }`** ONLY (the MASTERMIND_TRANSFORM_ALLOWLIST analog).
- New `SchemeState` fields (OPTIONAL — the `gameText?` precedent): **`transformTargetSchemeId?`** + **`transformTargetGameText?`** + **`hasTransformed?`**. Populated ONLY for an allowlisted scheme; emit via CONDITIONAL SPREAD in setup so ABSENT otherwise.
- Setup (`buildInitialGameState`, at the `scheme: {...}` build): `const t = SCHEME_TRANSFORM_TARGETS[config.schemeId]; const fields = t ? { transformTargetSchemeId: t.targetSchemeId, transformTargetGameText: buildSchemeGameText(t.targetSchemeId, registry), hasTransformed: false } : {};` then `scheme: { twistPile: [], gameText: buildSchemeGameText(config.schemeId, registry), ...fields }`.
- Flip: **`transformScheme(schemeState)`** — no-op if `transformTargetGameText === undefined` OR `hasTransformed === true`; else copy-then-override `{ ...schemeState, hasTransformed: true, gameText: transformTargetGameText }`.
- Per-move check: **`checkAndTransformScheme(gameState)`** — guard absent `scheme`/`selection`/`ko` (never throw); early-return if no `transformTargetSchemeId` or already `hasTransformed`; look up the target by `gameState.selection.schemeId`; count Bystanders in `gameState.ko`; at ≥ threshold rebind `gameState.scheme = transformScheme(...)` and `pushLog(..., 'threat')`. Wire it into `game.ts` `turn.onMove` alongside the existing per-move checks.

## Guardrails
- **The flip does NOT change `G.selection.schemeId`** — twist dispatch + loss config key on it; changing it would break them. The flip swaps `G.scheme.gameText` + sets `hasTransformed`, which is why the flip is observable with **no UIState projection change** (gameText is already projected).
- **OPTIONAL + allowlist-gated + guarded per-move check → NO hash re-pin.** A non-transform game (incl. the sentinel `core/legacy-virus-the`) must be byte-identical — the `onMove` check must do NO read/mutation for it (early return). Confirm the pin tests pass unchanged.
- **`checkAndTransformScheme` is a hook → never throws.** Guard `!scheme`, `!selection`, `!Array.isArray(ko)` (minimal test fixtures omit them — this bit twice during execution).
- **`transformScheme` is copy-then-override** so a future SchemeState field survives.
- Card data is UNTOUCHED (both scheme faces already exist in `mdns.json`). NO regen.

## Required `// why:` Comments
- The pairing map: why a hardcoded allowlist (separate prose-linked `schemes[]` entries, no structured link).
- The optional fields + conditional spread: absent for non-transform schemes (byte-identical, no re-pin).
- The onMove guard: why a hook must never throw + early-return for non-transform schemes.
- Not changing `G.selection.schemeId`: why (twist dispatch + loss config coupling).

## Files to Produce
- `scheme/schemeState.types.ts`, `scheme/schemeTransform.logic.ts` (new), `setup/buildInitialGameState.ts`, `game.ts`.
- `scheme/schemeTransform.logic.test.ts` (new) + a setup-capture test (`buildInitialGameState.shape.test.ts`).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24484), `NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record count); `pnpm -r build` 0.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged (NO re-pin).
- [ ] **Control run:** drop Chthon from `SCHEME_TRANSFORM_TARGETS`; setup skips the capture (AC-1 fails) + `checkAndTransformScheme` no-ops (AC-4 fails). Restore. Record.
- [ ] `git diff --name-only` = ledger + the engine files (no card-data, no derived artifacts).
- [ ] **D-24026 live-on-surface:** a real Chthon match awakens the Great Old One at 5 Bystanders KO'd — operator-pending.
- [ ] `STATUS.md`; `DECISIONS.md` D-24484 Active; `WORK_INDEX.md` + `EC_INDEX.md` rows; mindmap node + `pnpm roadmap:counts:write` / `roadmap:counts:check`.

## Common Failure Smells
- A hash pin moves → an unconditional field add, or the onMove check reads/mutates for a non-transform scheme.
- The scheme never awakens → the setup capture missing (allowlist / buildSchemeGameText), or the onMove wire missing, or the Bystander predicate wrong.
- A move throws / the game desyncs → `checkAndTransformScheme` did not guard an absent `scheme`/`ko`.
- Twist dispatch breaks after a flip → `G.selection.schemeId` was changed (it must not be).
