# EC-543 — Escaped-Pile Carry-Away + Midtown Resource Loss (Execution Checklist)

**Source:** docs/ai/work-packets/WP-508-escaped-pile-carry-away-midtown-loss.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-200 / D-24178 landed on `main` (scheme-twist config framework +
      `SchemeTwistConfig` + `SCHEME_TWIST_CONFIGS` + twist-proxy in
      `schemeHandlers.ts`).
- [ ] WP-153 landed on `main` (`G.escapedPile` exists, projected to
      `UIState.city.escapedPile`).
- [ ] Baseline is `origin/main`; capture the SHA and confirm it advanced past
      the WP-508 draft baseline `1dfc78a9`.
- [ ] EXACT target file set = the twelve files (11 planned + escape-wound.integration.test.ts, lockstep fixture correction) in `Files to Produce` below. Any
      edit outside this set is a FAIL — surface as a blocker, do not improvise.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record baseline
      pass count).

## Locked Values (do not re-derive)
- `SchemeResourceLossCondition = { kind: 'escaped-pile-count'; cardType:
  RevealedCardType; threshold: number }` (data-only; no functions).
- Midtown condition: `cardType: 'bystander'`, `threshold: 8`, scheme
  `core/midtown-bank-robbery`.
- Card-type slugs are hyphenated: `'bystander'`, `'villain'` (never underscores)
  — derived from the canonical `RevealedCardType` in
  `villainDeck/villainDeck.types.ts`.
- Scheme-loss counter key: `ENDGAME_CONDITIONS.SCHEME_LOSS` (`'schemeLoss'`) —
  import the constant; set to `1` (idempotent, `evaluateEndgame` checks `>= 1`),
  never a raw string.
- Renamed symbols: `resolveEscapedBystanders` → `carryEscapedBystandersToPile`;
  result type `ResolveEscapedBystandersResult` → `CarryEscapedBystandersResult`;
  both re-exported from `packages/game-engine/src/index.ts` (must update in
  lockstep).
- Carry-away destination: `G.escapedPile` (append to end). NEVER
  `G.piles.bystanders`.
- `ESCAPED_VILLAINS`, `ESCAPE_LIMIT`, `schemeTwistCount`, and `evaluateEndgame`
  are OUT OF SCOPE — do not modify.

## Guardrails
- Both new helpers are pure (no `boardgame.io`/registry import, no I/O, no
  `ctx.random.*`) and never throw on any input.
- `applyEscapedPileResourceLoss` is a no-op when the active scheme has no
  `resourceLossCondition`; idempotent when `SCHEME_LOSS` is already `1`.
- Twist-proxy suppression fires ONLY when the active scheme declares a
  `resourceLossCondition`; twist-loss schemes (Portals, Cosmic Cube) keep their
  twist-threshold loss unchanged. `schemeTwistCount` still increments every twist.
- Gate the suppression in the **dispatcher** (`schemeTwistHandler`, which holds
  `config`): pass `suppressTwistLoss = config?.resourceLossCondition != null` into
  `buildGenericTwistEffects`; do NOT re-fetch the config inside the helper (C-2).
- Call `applyEscapedPileResourceLoss` at the **end** of the escape branch — after
  `executeVillainAbilities('onEscape')`, `koAttachedHeroesOnEscape`, and the
  Mystique escape→twist path — not right after the carry-away (C-3).
- The count loop uses `for...of`, never `.reduce()`; classify via
  `G.villainDeckCardTypes[extId]`.
- `carryEscapedBystandersToPile` still deletes the escaped villain's
  `attachedBystanders` mapping entry (no leak); only the destination changes.
- No new `LegendaryGameState` field.
- Hash oracles (`finalStateHash`, `PRE_WP080_HASH`) MUST stay byte-identical.
  Any drift → STOP and diagnose; never blind-re-pin.

## Required `// why:` Comments
- `bystanders.logic.ts` carry-away: why the destination is the escaped pile, not
  supply (D-24314 / Universal Rules v23 escape handling).
- `schemeResourceLoss.ts` `applyEscapedPileResourceLoss`: why `SCHEME_LOSS` is
  set here (escape path) rather than read in `evaluateEndgame` (counter-only
  invariant).
- `schemeHandlers.ts` proxy gate: why the twist `SCHEME_LOSS` push is suppressed
  when `resourceLossCondition` is present (D-24315).

## Files to Produce
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts` — **modified** — `+ SchemeResourceLossCondition`; `+ resourceLossCondition?` field.
- `packages/game-engine/src/rules/schemeResourceLoss.ts` — **new** — `countEscapedPileByType` + `applyEscapedPileResourceLoss`.
- `packages/game-engine/src/board/bystanders.logic.ts` — **modified** — replace `resolveEscapedBystanders` → `carryEscapedBystandersToPile`; rename result type → `CarryEscapedBystandersResult`.
- `packages/game-engine/src/index.ts` — **modified** — update the two barrel re-exports (value line 168, type line 173) to the renamed symbols (else `pnpm -r build` fails — PS-1).
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — escape branch calls carry-away helper; rewrite the `bystandersPile`-referencing supply-return log guard in lockstep; call `applyEscapedPileResourceLoss` at the **end** of the escape branch.
- `packages/game-engine/src/rules/schemeHandlers.ts` — **modified** — suppress twist-proxy when `resourceLossCondition` present.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** — add `resourceLossCondition` to Midtown.
- `packages/game-engine/src/rules/schemeResourceLoss.test.ts` — **new** — count / threshold / no-op / idempotent + an in-file `evaluateEndgame` composition assertion (scheme-wins at 8, null at 7 — AC-6).
- `packages/game-engine/src/board/bystanders.logic.test.ts` — **modified** — carry-away destination assertions.
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **modified** — proxy suppressed for resource vs kept for twist-loss.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — escape carries bystanders + sets `SCHEME_LOSS` at threshold.
- `packages/game-engine/src/board/escape-wound.integration.test.ts` — **modified** — **inline amendment (12th file)**: it asserted the old return-to-supply behaviour; corrected in lockstep to assert carry-into-escaped-pile.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record pass delta).
- [ ] Control-stub check performed for BOTH helpers (assertions proven non-vacuous), then restored.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical; `pnpm sim:runtime-observed:check` current (no regeneration).
- [ ] `pnpm -r build` exits 0.
- [ ] `git diff --name-only` = the twelve-file allowlist + governance only.
- [ ] Live-on-surface verification (D-24026) performed or explicitly operator-pending (Midtown match past twist 8; loss only at 8 escaped Bystanders).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` updated — D-24314 + D-24315 flipped Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Midtown ends at twist 8 with an empty escaped pile → proxy suppression not
  wired (the `resourceLossCondition` gate in `schemeHandlers.ts` is missing).
- Bystander supply grows on escape → carry-away still returning to
  `G.piles.bystanders` (destination not switched).
- `pnpm -r build` fails on missing exports → the `index.ts` barrel re-exports
  (line 168 value, line 173 type) were not updated to the renamed symbols (PS-1).
- A `// why:` comment in `villain/villainEffects.execute.test.ts` (~L1798–1803)
  names `resolveEscapedBystanders` + old "released to supply" semantics. It is
  comment-only (no import) and that file is **not** in the allowlist — leave it
  untouched (editing it is an allowlist FAIL); a separate cleanup is tracked.
- `finalStateHash` drift on a non-Midtown fixture → an escape path touched a
  fixture with captured bystanders; investigate before any re-pin.
