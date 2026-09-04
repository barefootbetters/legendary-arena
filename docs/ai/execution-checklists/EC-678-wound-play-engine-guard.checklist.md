# EC-678 — Wound Not-Playable Engine Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-643-wound-play-engine-guard.md
**Layer:** Game Engine (`packages/game-engine`) — the `playCard` move + the simulation `getLegalMoves` enumeration

## Before Starting
- [ ] Baseline: `origin/main` @ `dc682506` (or later); working tree clean, synced.
- [ ] WP-379 landed: `healWounds` (`moves/healWounds.ts`) KOs Wounds **from the hand only**; `WOUND_EXT_ID = 'pile-wound'` lives in `setup/pilesInit.ts`. A Wound in `inPlay` is unreachable by Healing — the bug this closes.
- [ ] WP-383 landed: `playCard` already carries a card-specific PRE-COMMIT precondition (the discard-to-play cost check, D-24185) after the `playerZones` null-check, before the hand removal. The new Wound guard is a second precondition of the same class, ahead of it.
- [ ] WP-555 landed: `ai.legalMoves.ts`'s `playCard` loop already `continue`s past an unpayable discard-to-play card (D-24364). The Wound `continue` is the same shape, at the top of the loop.
- [ ] `pnpm -r build` 0; game-engine suite green on `dc682506`.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. Anything outside is a FAIL; surface as a blocker. The determinism oracles are expected UNCHANGED and are deliberately NOT in the allowlist.

## Locked Values (do not re-derive)
- Wound ext_id: `WOUND_EXT_ID = 'pile-wound'` — **imported** from `../setup/pilesInit.js` in BOTH files; never re-declare the literal.
- `playCard` guard: `if (args.cardId === WOUND_EXT_ID) { return; }` — in Step 3, AFTER the `playerZones` null-check, BEFORE the existing `getDiscardToPlayCost` discard-to-play precondition.
- `getLegalMoves` skip: `if (cardId === WOUND_EXT_ID) { continue; }` — at the TOP of the `playCard intents` loop body (`for (const cardId of zones.hand)`), BEFORE the discard-to-play cost read.

## Guardrails
- The guard is a **card-specific PRE-COMMIT precondition** (D-24185 class): a silent `void` return with NO commit — the Wound stays in hand, no economy is granted, no onPlay pass fires — BEFORE the `moveCardFromZone` hand removal. It is NOT a pending-choice/block-all guard (those fire after commit) and NOT a stage gate.
- Moves never throw — the guard is a plain `return`; the enumeration skip is a plain `continue`.
- **Adds NO G field** — reads `args.cardId` / the loop `cardId` only. No hash surface changes.
- Both files import `WOUND_EXT_ID` from `../setup/pilesInit.js` (a pure helper, no boardgame.io import). Do NOT hardcode `'pile-wound'`.
- **NOT a new move** — `playCard` is already registered; do NOT touch `game.ts` move registration or the `game.test.ts` move-set drift pin.
- **NO client change** — PR #1785 already disables the Wound tile; `apps/arena-client` is untouched.
- **HASH RE-PIN NOT EXPECTED** (the material contrast with WP-642): no G field, and the guard rejects a move no recorded/seeded game plays. `finalStateHash` (`sentinel-core-doom-2p.replay.json`) + `PRE_WP080_HASH` (`replay/replay.execute.test.ts`) are expected **byte-identical**; the suite passes against the existing pins. If either MOVES, that is a real trajectory shift — investigate, then re-pin the moved oracle to the CAPTURED value with a `// why:` (inline amendment) — NEVER alter logic to chase a hash. Do NOT pre-emptively edit any hash pin.
- `sim:runtime-observed:check` must stay **current** (the bot sweep's trajectories are unshifted — the bot policy already down-weighted Wounds; this only removes them from enumeration). If it goes stale, `pnpm sim:runtime-observed` regenerates the artifact and the diff is committed as an inline amendment with a `// why:`.
- The Seed PAR (`docs/12`) is difficulty-driven + write-once (`generate-seed-par.mjs` reads `data/difficulty-ratings/…`, NOT sim trajectories) — a `getLegalMoves` change cannot stale it; do NOT regenerate it.
- Engine tests: `node:test`; no `boardgame.io/testing`; `makeMockCtx` / the file's local `makeMoveContext` + `makeG` builders.

## Required `// why:` Comments
- `coreMoves.impl.ts` Wound guard: a Wound has no play path (wiki/wounds.md); silent void, no commit, the D-24185 class; without it a raw socket message strands the Wound beyond `healWounds`' hand reach; the `getLegalMoves` enumeration is kept in lockstep.
- `ai.legalMoves.ts` Wound `continue`: a Wound is unplayable — enumerating it wedges the turn (the `getLegalMoves`↔move-guard divergence class); mirrors the discard-to-play skip below it.

## Files to Produce
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — import `WOUND_EXT_ID` + the `playCard` pre-commit Wound rejection
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — import `WOUND_EXT_ID` + the `playCard`-loop Wound `continue`
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **modified** — playCard-Wound no-op (hand/inPlay/turnEconomy unchanged, no "played" log line) + a non-Wound in the same hand still plays
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — getLegalMoves omits playCard for a Wound (alone, and among other hand cards which are still offered in order)
- `wiki/wounds.md` — **modified** — engine-guard note in `§Edge Cases → Wounds can't be played` + two source-frontmatter paths

> The `playCard` test lives in `coreMoves.integration.test.ts` (`describe('playCard', …)`), NOT a `coreMoves.impl.test.ts` (which does not exist); the `getLegalMoves` test lives in `ai.legalMoves.test.ts`. Confirmed at draft. A path correction is the only permitted inline allowlist amendment class here.

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — `finalStateHash` + `PRE_WP080_HASH` **byte-identical** (NO re-pin); the 2 new playCard tests + the 2 new getLegalMoves tests green
- [ ] `pnpm sim:runtime-observed:check` → `OK: … artifact is current.`
- [ ] `Select-String coreMoves.impl.ts "args.cardId === WOUND_EXT_ID"` → 1; `Select-String ai.legalMoves.ts "cardId === WOUND_EXT_ID"` → 1
- [ ] `docs/ai/STATUS.md` updated (engine now forbids playing a Wound at the reducer)
- [ ] `docs/ai/DECISIONS.md` — land D-24455 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-643 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ governance close)
- [ ] No D-24026 live-verify (no user-visible surface; the visible fix shipped in PR #1785)

## Common Failure Smells
- `finalStateHash` or `PRE_WP080_HASH` shifted → a seeded game's trajectory moved; do NOT reflexively re-pin — a Wound-play in a recorded fixture would be a pre-existing data anomaly. Investigate first; only capture-and-re-pin a genuinely-moved oracle with a `// why:`.
- `sim:runtime-observed:check` went stale → a bot sweep game changed trajectory (a game where the policy WOULD have picked the Wound now skips it); regenerate with `pnpm sim:runtime-observed` and commit the diff as an inline amendment — expected only if such a game exists (it did not at draft).
- Guard placed AFTER the hand removal → the Wound is already gone from hand; the guard must return BEFORE `moveCardFromZone`.
- Hardcoded `'pile-wound'` instead of importing `WOUND_EXT_ID` → drift the constant exists to prevent; import it.
- The `getLegalMoves` skip omitted (only the move guard added) → the bot enumerates a Wound-play the reducer refuses, re-picks it, and wedges the turn — the exact divergence class this WP closes; BOTH edits must land together.
- Touched `game.ts` / `game.test.ts` move-set drift pin → no new move was added; `playCard` is already registered. Out of scope.
- A blanket "no playCard" regression → the guard must be Wound-SPECIFIC (`=== WOUND_EXT_ID`); the "a non-Wound still plays" test guards against this.
