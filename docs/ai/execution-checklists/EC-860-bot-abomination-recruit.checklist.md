# EC-860 — Competent Bot Abomination Recruit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-822-bot-abomination-recruit.md
**Layer:** Game Engine (`ui/` projection + `simulation/` bot policy)

## Before Starting
- [ ] `printedHeroAttack` is exported and `mastermindAbominationBonus` reads `G.cardAbomination?.[G.mastermind?.baseCardId]` (`economy/abomination.logic.ts` ~L46 / ~L102).
- [ ] `UIMastermindState` ends with `fightCost?` / `isHaunting?` (`ui/uiState.types.ts` ~L724-761); the build's mastermind object is at `uiState.build.ts` ~L983-1007; the filter pass-throughs are at `uiState.filter.ts` ~L615-622.
- [ ] `scoreRecruitHero(_move)` returns `SCORE_RECRUIT_BASE` (`simulation/ai.competent.ts` ~L262), called at ~L379.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine test total.
- [ ] After `pnpm -r build` exits 0, capture the baseline: run `pnpm sim:coop-winrate` and the Zola measure (WP Verification 6: 1p + 2p, seeds `wp822-zola-v1::0..29`) and save both outputs to the scratchpad, using an untracked scratch script, never a file under `scripts/`.

## Locked Values (do not re-derive)
- `export function mastermindAbominationHqAttack(G: LegendaryGameState): (number | null)[] | undefined`: `baseCardId = G.mastermind?.baseCardId`; `undefined` → `undefined`; `kind = G.cardAbomination?.[baseCardId]`; not `'ultimate-abomination'` and not `'double-highest-abomination'` → `undefined`; else a new array with one entry per `G.hq ?? []` slot in order: `null` for a `null` / `undefined` slot, else `printedHeroAttack(G, heroId)`. Built with a `for…of` loop.
- `UIMastermindState` gains `abominationHqAttack?: (number | null)[];`, after `isHaunting?`.
- Build: add `import { mastermindAbominationHqAttack } from '../economy/abomination.logic.js';`. Compute `const abominationHqAttack = mastermindAbominationHqAttack(gameState);` just before `const mastermind = {`. In the object, after the `isHaunting` spread, add `...(abominationHqAttack !== undefined ? { abominationHqAttack } : {})`.
- Filter: `...(uiState.mastermind.abominationHqAttack !== undefined ? { abominationHqAttack: [...uiState.mastermind.abominationHqAttack] } : {})` after the `isHaunting` pass-through, every audience.
- `const ABOMINATION_RECRUIT_BONUS_CAP = SCORE_EXORCISE_BASE - SCORE_RECRUIT_BASE - 1;`
- `function scoreRecruitHero(move: LegalMove, view: UIState): number`: `printedAttacks = view.mastermind.abominationHqAttack`; `undefined` → `SCORE_RECRUIT_BASE`; `hqIndex = (move.args as { hqIndex?: number } | null | undefined)?.hqIndex`; not a number → `SCORE_RECRUIT_BASE`; `printedAttack = printedAttacks[hqIndex]`; `null` / `undefined` → `SCORE_RECRUIT_BASE`; else `SCORE_RECRUIT_BASE + Math.min(Math.max(printedAttack, 0), ABOMINATION_RECRUIT_BONUS_CAP)`. `scoreOneMove` passes `view`: `return scoreRecruitHero(move, view);`.

## Guardrails
- One printed-Attack read: `mastermindAbominationHqAttack` uses `printedHeroAttack` and the same kind check as `mastermindAbominationBonus`.
- Omit-when-absent: off-kind the key is absent from the built and the filtered UIState (never `undefined`, never `[]`).
- All five UIState steps; a field built but not filtered is the EC-206 drop.
- Score-only bot change: no new move, no `getLegalMoves` change, no new policy state, the random policy untouched.
- No `G` mutation, no new randomness, no client file, no data file.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- `mastermindAbominationHqAttack`: the inputs to the mastermind-family term (rules v23 L888-890, L905-917), read once beside the cost (D-24755).
- The `UIMastermindState` field: WP-822 / D-24755; public, index-aligned with `hq.slots`, omit-when-absent, the EC-206 filter trap.
- The filter pass-through: public for every audience; copied.
- `ABOMINATION_RECRUIT_BONUS_CAP`: a recruit never outranks an exorcise or a fight (WP-049 ordering).
- `scoreRecruitHero`: lowering the Abomination term is the counter to Zola / Maximus; the bot reads only printed, public numbers (no hidden state).

## Files to Produce
- `packages/game-engine/src/economy/abomination.logic.ts` + test — **modified**
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** (one optional field)
- `packages/game-engine/src/ui/uiState.build.ts` + test, `ui/uiState.filter.ts` + test — **modified**
- `packages/game-engine/src/simulation/ai.competent.ts` + test — **modified**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T11 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` → 0; `git diff --stat -- data/` empty.
- [ ] `pnpm sim:coop-winrate` identical before / after; the same-session Zola measure (WP Verification 6, seeds `wp822-zola-v1::0..29`, 1p + 2p) recorded in STATUS; an after-count below baseline is reported, not tuned. Rebuild the engine before each after-run, then `grep -c abominationHqAttack` must report ≥ 1 in both `dist/ui/uiState.filter.js` and `dist/simulation/ai.competent.js`; differing aggregates are informational.
- [ ] Revert proofs observed (no filter pass-through; `[]` off-kind; no clamp; field ignored in scoring).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24755 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-860:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen. In a `ca75/arnim-zola` autoplay match on `play.legendary-arena.com` (gitSha checked):
  - the export carries `mastermind.abominationHqAttack`;
  - the `[autoplay] … spending → recruitHero` line names the highest affordable slot (a tie passes);
  - a non-Abomination export lacks the key.

## Common Failure Smells
- The sim bot still recruits at random under Zola → the filter pass-through is missing (the prototype hit exactly this).
- Every match's UIState gained a key → off-kind returned `[]` or `undefined` was spread as a key.
- The bot recruits instead of exorcising or fighting → the clamp is missing or wrong.
- `sim:runtime-observed` or a PAR pin moved → the bonus leaked into non-Abomination matches.
- A Double Highest Mastermind gets no bonus → the kind check copied only `'ultimate-abomination'`.
- The after-run `dist` lacks `abominationHqAttack` → stale `dist`; rebuild. (Identical Zola aggregates alone are not a smell.)
- Later fights and plays differ in a Zola match → expected: a broken recruit tie skips a tie-break draw (D-24755); not a defect.
