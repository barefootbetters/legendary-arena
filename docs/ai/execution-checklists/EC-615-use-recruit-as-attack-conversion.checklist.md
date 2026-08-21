# EC-615 — "Use Recruit as Attack" Conversion, God of Thunder (Execution Checklist)

**Source:** docs/ai/work-packets/WP-580-use-recruit-as-attack-conversion.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data (`data/cards/core.json` via regen)

## Before Starting
- [ ] Preconditions A–D in WP-580 all pass (no marker today; economy silos + resets; fight spends attack only; hero-keyword array exists)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 (baseline)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline)
- [ ] Capture the baseline `finalStateHash` + `PRE_WP080_HASH` before any edit (to compare after)

## Locked Values (do not re-derive)
- Marker + keyword: `[keyword:recruit-as-attack]` on God of Thunder; keyword slug `recruit-as-attack`.
- Scope: core `core/thor/god-of-thunder` ONLY; one-directional Recruit→Attack; whole-turn. msp1 / cvwr / co2e / xmen variants DEFERRED.
- Spend order: **Attack first, then convertible Recruit.**
- Combined figure = Attack + Recruit (when the flag is set), used IDENTICALLY by the Fight move guard, `ai.legalMoves.ts`, and `ui/uiState.build.ts`.
- Flag is turn-scoped on `G.turnEconomy`, set onPlay, CLEARED by `resetTurnEconomy`, **lazily materialized** (absent when unset).

## Guardrails
- Register `recruit-as-attack` in the `HeroKeyword` union, the `HERO_KEYWORDS` array, AND `HANDLED_KEYWORDS` (lockstep with its `HERO_EFFECT_HANDLERS` entry — the bidirectional keys↔`HANDLED_KEYWORDS` test); extend the drift pin as a RUNTIME assertion (D-24372), never a bare `satisfies`.
- Add the marker in the UPSTREAM source / marker pass and REGENERATE `data/cards/core.json`; never hand-edit generated JSON alone. Regenerate the hero-mechanic ledger AND the effect-implementation-index (REQUIRED — the index reads the hero ledger as a source) + add the provenance row IN LOCKSTEP.
- The flag must SURVIVE every `TurnEconomy` rebuild: `spendAttack` / `spendRecruit` / `addResources` reconstruct `TurnEconomy` from an explicit 6-field literal (not a spread), so each must carry the flag forward or a later same-turn spend silently drops it (play order is player-chosen).
- Build the optional flag by CONDITIONAL SPREAD (truly absent when unset) — `exactOptionalPropertyTypes: true` is on; never assign from a possibly-`undefined` source.
- Determinism: prefer the LAZY flag so both hash oracles stay byte-unchanged; if always-present, DUAL re-pin `finalStateHash` + `PRE_WP080_HASH` and record the reason. If an oracle moves unexpectedly, STOP.
- The flag NEVER persists across turns and is NOT a snapshot field (snapshots stay counts-only).
- Moves never throw — an unaffordable Fight (even with conversion) is a silent return.
- The bot affordability projection MUST mirror the move guard exactly (legalMoves↔move-guard invariant) or the bot faults / under-fights.
- `for...of`, never `.reduce()`, in economy ops; no `Math.random`/`Date.now` — `ctx.random.*` only.
- Enrolling the keyword must NOT re-introduce a false "applied" for a genuinely hollow line elsewhere.

## Required `// why:` Comments
- On the turn flag: whole-turn semantics + why it is lazily materialized (hash-oracle stability).
- On the attack-first spend order in the Fight moves.
- On the drift-pin extension: why union + array must move together.
- On any hash-oracle re-pin line (if the always-present path is taken).

## Files to Produce
- `data/cards/core.json` — **modified** — God of Thunder `[keyword:recruit-as-attack]` (via regen)
- `scripts/convert-cards/inputs/**` or the marker pass — **modified** — upstream marker source (confirm the exact stage)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **modified** — regenerated (`pnpm ledger:heroes`)
- `data/metadata/effect-implementation-index.json` — **modified (REQUIRED)** — regenerated (`pnpm effect-index`; the index reads the hero ledger as a source)
- `scripts/coverage/mechanic-provenance.json` — **modified** — `{ wp, decision }` row for `recruit-as-attack`
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array + runtime drift pin
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** — turn flag + combined-available + spend order
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — onPlay handler + hollow-detector enrollment
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — combined affordability + spend order
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — same
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot affordability mirror
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — economy projection reflects combined available
- `packages/game-engine/src/**/*.test.ts` — **modified** — economy / fight / parse / drift / hollow / bot / hash-oracle tests

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; economy / fight / parse / drift / hollow / bot / hash-oracle tests green
- [ ] `pnpm ledger:heroes && pnpm effect-index` regenerated; `ledger:heroes:check` AND `effect-index:check` exit 0
- [ ] `finalStateHash` + `PRE_WP080_HASH` byte-unchanged (lazy flag) OR re-pinned with a recorded reason
- [ ] `pnpm -r --no-bail test` — no new failures
- [ ] Live-on-surface (D-24026): play God of Thunder in a real match and fund a Fight from Recruit; the play surface's available attack reflects the conversion
- [ ] `docs/ai/STATUS.md` updated (names WP-580; hash-oracle outcome; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24389 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-580 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- A hash oracle moved → the flag is always-present, not lazy; either switch to lazy or dual-re-pin with a recorded reason.
- The bot ignores the Fight after God of Thunder → `ai.legalMoves.ts` does not mirror the combined figure.
- The ability still shows as a no-op in diagnostics → the keyword was not enrolled in the hollow detector.
- A stale `effect-implementation-index.json` reads green locally but trips CI → the second-order index regen was skipped.
