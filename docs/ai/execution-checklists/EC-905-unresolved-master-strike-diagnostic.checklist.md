# EC-905 — A Master Strike with no resolver is flagged as a hollow effect; the effect index lists every Master Strike (Execution Checklist)

**Source:** docs/ai/work-packets/WP-867-unresolved-master-strike-diagnostic.md
**Risk Tier:** MEDIUM — a locked contract union (`HollowEffectRecord.cardType`) and the hashed `G.messages` log for every match
whose Mastermind has no strike resolver; no gameplay state, no new `G` field, no auth, money, persistence or server surface
**Layer:** Game Engine (strike dispatcher fall-through + one contract union) + coverage feed (effect-index Master Strike rows)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-867 / EC-905 / D-24810 reservation (#3182) is on `main`.
- [ ] `pnpm -r build`, then `pnpm -r --no-bail test`, exit 0; record the counts (game-engine 6335 / 0 at draft).
- [ ] Re-read at HEAD: the `mastermindStrikeHandler` chain (11 branches / 12 ids at draft, the Red Skull branch covering two; 12
      / 13 if WP-864 has landed: note which), its
      terminal emission and `buildGenericStrikeEffects`; `resolveCurrentPlayer`; `HollowEffectRecord`; `recordHollowEffect`;
      `readMastermindTactics` / `normalizeTactic` / `buildIndex` in `scripts/build-effect-implementation-index.mjs`.

## Locked Values (do not re-derive; verify at HEAD)
- **Contract:** `HollowEffectRecord.cardType: 'hero' | 'villain' | 'henchman' | 'mastermind'` (appended last) + its JSDoc.
  Nothing else in `hollowEffect.types.ts` changes (`EffectTrace.scope` untouched).
- **Constants** (`mastermindHandlers.ts`): `MASTER_STRIKE_HOLLOW_MECHANIC = 'master-strike'`; `MASTER_STRIKE_TRIGGER: RuleTriggerName
  = 'onMastermindStrikeRevealed'` (type-only import).
- **Turn:** `resolveStrikeTurn(context: unknown): number` returns `context.ctx.turn` if it is a finite number, else `0`; structural
  narrow like `resolveCurrentPlayer`, no `RevealContext` import.
- **Arm:** terminal `else` on the existing chain → `recordHollowEffect(gameState, { cardId: gameState.mastermind.baseCardId,
  cardType: 'mastermind', timing: MASTER_STRIKE_TRIGGER, mechanic: MASTER_STRIKE_HOLLOW_MECHANIC, reason: 'no-handler', turn:
  resolveStrikeTurn(strikeContext) })`. The existing arms, the `mastermindStrikeResolved` emission and the returned generic
  effects stay byte-identical. Log order at an unresolved strike: the hollow line, then "Mastermind strike revealed — strike count
  incremented.".
- **Overlay** `scripts/coverage/strike-provenance.json`: `{ schemaVersion: 1, _comment, strikes: {…} }`, keys sorted,
  `${setAbbr}-mastermind-${mastermindSlug}-master-strike`. Handler prefix `packages/game-engine/src/rules/mastermindHandlers.ts#`.
  Rows (extId: status / function / wp / decision):
  - `ca75-mastermind-arnim-zola-master-strike`: executable / `resolveArnimZolaStrike` / WP-821 / D-24754
  - `ca75-mastermind-baron-heinrich-zemo-master-strike`: executable / `resolveBaronZemoStrike` / WP-818 / D-24752
  - `co2e-mastermind-doctor-doom-master-strike`: executable / `resolveDoctorDoomStrike` / WP-388 / D-24192
  - `co2e-mastermind-doctor-octopus-master-strike`: executable / `resolveDoctorOctopusStrike` / WP-397 / D-24200
  - `co2e-mastermind-loki-master-strike`: executable / `resolveLokiStrike` / WP-398 / D-24201
  - `co2e-mastermind-magneto-master-strike`: executable / `resolveCo2eMagnetoStrike` / WP-388 / D-24192
  - `co2e-mastermind-red-skull-master-strike`: executable / `resolveRedSkullStrike` / WP-577 / D-24386
  - `core-mastermind-dr-doom-master-strike`: executable / `resolveCoreDoomStrike` / WP-538 / D-24347
  - `core-mastermind-loki-master-strike`: executable / `resolveCoreLokiStrike` / WP-537 / D-24346
  - `core-mastermind-magneto-master-strike`: executable / `resolveMagnetoStrike` / WP-476 / D-24284
  - `core-mastermind-red-skull-master-strike`: executable / `resolveRedSkullStrike` / WP-577 / D-24386
  - `wwhk-mastermind-general-thunderbolt-ross-master-strike`: **deferred** / `resolveGeneralRossStrike` / WP-669 / D-24483
  - `chmp-mastermind-fin-fang-foom-master-strike`: executable / `resolveFinFangFoomStrike` / WP-864 / D-24807, **only if** that
    arm is on `main`.
- **Parity test:** asserts the overlay has ≥ 12 keys, then `checkedCount === 12` (13 with the WP-864 row) for the `executable` /
  `deferred` rows it ran through the real handler. **Log-order case:** handler effects → `applyRuleEffects`; the last two
  `G.messages` are the hollow line, then the strike-count line. **Filter case** (`uiState.filter.test.ts`): a `mastermind` record
  survives `filterUIStateForAudience` for player and spectator.
- **Index rows:** exported `readMastermindStrikes(provenance, tacticEntries)` → one row per `setData.masterminds` entry with non-empty `slug` and `name`, via
  ``normalizeTactic(extId, `${mastermind.name} Master Strike`, setAbbr, 'master-strike', provenance[extId])``. An orphan overlay
  key is a `TransformFailure` (full sentence; the class stays private, tested via `assert.throws` + regex). wp / decision = the WP
  and decision that made the strike resolve in full, stated in `_comment`. A strike extId in the `tacticEntries` extId set is
  a `TransformFailure` (tested with a synthetic tactic `core-mastermind-magneto-master-strike`) (both feeds are `scope: 'mastermind'`, so `buildCards` would merge them silently). Expected summary: `byScope.mastermind` 456 → 567, `totalEntries` 2064 → 2175.

## Guardrails
- The flag goes through `recordHollowEffect` only: no direct `G.diagnostics` push, no bespoke second log line, no UIState field.
- Hollow means "no arm reached" (D-24033): General Ross and any arm that no-ops on the board are never flagged.
- `G.diagnostics` is never read as gameplay input; no move, rule, `endIf`, bot or scoring path reads the new record.
- STOP if the sentinel `finalStateHash` / messages oracle, `PRE_WP080_HASH`, `sim:runtime-observed:check` or `sim:coverage --check`
  moves, or if any per-Mastermind strike test changes.
- Test edits are limited to the three sanctioned RS-4 product-change edits; they assert the new records exactly plus
  `hollowEffects.length >= 1`, never "≥ 0"; the degenerate no-game asserts stay `[]`.
- New tests use the synthetic id `'test/no-strike-resolver'`, never a real unresolved Mastermind (WP-864 order-independence).
- No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`; handlers never throw. Never `git stash`.

## Required `// why:` Comments
- `mastermindHandlers.ts`: the terminal `else` (WP-867 / D-24810: no arm reached = hollow, D-24033; record + standard line through
  the one seam); the rewritten "takes no branch" comment; `resolveStrikeTurn` (D-24704 turn forwarding; stub → 0; third copy
  kept local because `readTurnNumber` / `readRevealContextTurn` are module-private);
  `MASTER_STRIKE_TRIGGER` typed against `RuleTriggerName`.
- `hollowEffect.types.ts`: the `'mastermind'` member (WP-867 / D-24810).
- Index builder: the strike feed reuses `normalizeTactic` (WP-507 pattern; absent = `unmarked`, never fabricated); the orphan check;
  the strike/tactic extId-collision guard (same-scope ids merge silently in `buildCards`).
- The three edited tests: why the mock Mastermind now records a strike hollow (WP-867). The parity test: its test-only
  `node:fs` reads of the overlay and card data (paths from `import.meta.url`, four levels up).

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts`, `packages/game-engine/src/diagnostics/hollowEffect.types.ts`: modified.
- `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts`: new (the seven RS-4 cases, incl. parity + log order).
- `packages/game-engine/src/ui/uiState.filter.test.ts`: one added `mastermind` projection case; no existing case changes.
- `packages/game-engine/src/rules/mastermindHandlers.test.ts`, `src/simulation/simulation.captureMoves.test.ts`,
  `src/simulation/sweep.runner.test.ts`: modified (sanctioned edits only).
- `scripts/coverage/strike-provenance.json` (new), `scripts/build-effect-implementation-index.mjs`,
  `scripts/build-effect-implementation-index.test.ts` (modified), `data/metadata/effect-implementation-index.json` (generated).
- `docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md`: the union line. `wiki/master-strike.md` (~106), `wiki/debug-effects.md` (source
  list + feed description): docs only.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24810), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0; arena-client and dashboard `typecheck` 0. Engine delta recorded (≥ +6);
      other package counts unchanged.
- [ ] `pnpm effect-index` changed only the index; `effect-index:check`, `effect-index:test`, `sim:runtime-observed:check`,
      `sim:coverage --check`, dashboard `prebuild:effect-index`, `wiki:lint` 0. Exact summary counts recorded.
- [ ] Revert proofs observed and restored: no `else` arm → RS-4 test 1 fails; a non-resolved row flipped to `executable` → parity
      fails.
- [ ] Govern-close checks 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` is inside `## Files to Produce`.
- [ ] D-24810 → Active, covering every clause of the WP's Reserved Decision. STATUS updated; WORK_INDEX checked; EC_INDEX Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] If WP-864 had not landed, the Fin Fang Foom overlay row is recorded as a follow-up in `docs/ai/STATUS.md`.
- [ ] Live-on-surface (D-24026): a strike for a Mastermind with no arm logs the red `master-strike` line and the hollow panel shows a
      `mastermind` row; `/debug/effects` lists the strike rows. Or operator-pending in STATUS.

## Common Failure Smells
- A resolved Mastermind's strike now logs "Unhandled effect": the `else` was attached to an inner `if`, or a standalone `if` was
  used instead of extending the chain.
- `turn` is always 0 in a live match: the narrow reads `ctx.turnNumber` or the top-level context, not `context.ctx.turn`.
- Duplicate `master-strike` entries under one extId: the strike/tactic collision guard is missing (`buildCards` merges same-scope
  ids silently).
- The parity test passes with an empty overlay: it never read the file, or it filters rows by a misspelled status.
