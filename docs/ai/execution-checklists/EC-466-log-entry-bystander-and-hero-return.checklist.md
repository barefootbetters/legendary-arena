# EC-466 — Narrate the City-Entry Bystander Attach + the Captured-Hero Return-on-Defeat (Execution Checklist)

> **Status:** PROPOSED (WP-431 / EC-466 / D-24252).
> **Source WP:** [WP-431](../work-packets/WP-431-log-entry-bystander-and-hero-return.md).
> **Lane:** Lightweight (2 source + 2 test files, additive, log-only).

**Layer:** Game Engine (`packages/game-engine/src/villainDeck/` + `packages/game-engine/src/moves/`)

## Scope (read first)
IN scope: append one `G.messages` line on the MVP city-entry bystander attach (D-18504),
and one line per captured hero returned to the defeating player's discard on villain
defeat (WP-214). OUT of scope: the faithfulness of the entry-attach count itself, the
notableEvents/overlay surface, escaped-villain release logging, any non-log change.

## Before Starting
- [ ] `git rev-parse origin/main` recorded (baseline `529687d6`)
- [ ] Reviewed `villainDeck.reveal.ts` city-entry branch (the `attachBystanderToVillain` call + existing `pushLog` lines) and `bystanders.logic.attachBystanderToVillain` (takes `bystandersPile[0]`; no-op on empty)
- [ ] Reviewed `fightVillain.ts` Step 3c (`awardAttachedHeroes`) + `heroCapture.awardAttachedHeroes` (moves `G.villainAttachedHeroes[v]` to discard, then DELETES the entry)
- [ ] Confirmed `pushLog` + `formatCardRef` are already imported in both source files
- [ ] `pnpm --filter @legendary-arena/game-engine build` runs (build-before-test)

## Locked Values (do not re-derive)
- Entry line (villainDeck.reveal.ts): read the to-be-attached bystander as `G.piles.bystanders[0]` BEFORE the attach mutates the pile; `null` when the pile is empty → NO line
- Entry line text: `` `${formatCardRef(...bystander)} captured by ${formatCardRef(...villain)} on entering the City.` ``
- Hero-return (fightVillain.ts): snapshot `[...(G.villainAttachedHeroes?.[cardId] ?? [])]` BEFORE `awardAttachedHeroes` (which deletes the entry); one `pushLog` per hero
- Hero-return text: `` `Player ${ctx.currentPlayer} gained ${formatCardRef(...hero)} from ${formatCardRef(...villain)} into their discard pile.` ``
- `formatCardRef` renders `Name (extId)` — tests assert on SUBSTRINGS, not exact strings

## Guardrails
- `G.messages` is **hash-excluded (D-24081)** → NO `finalStateHash` re-pin; the full engine suite stays green with no golden/sentinel hash change
- Log-only: no move-validation / zone / economy / turn-flow change; moves still never throw
- Deterministic content only (append-order ids); no `ctx.random`, time, or I/O
- No new cross-layer import; both files stay in the Game Engine layer

## Required `// why:` Comments
- entry snapshot — why read the pile top before the attach (attach mutates the pile)
- entry `pushLog` — the D-18504 rule + D-24081 hash-exclusion + the off-by-one it fixes
- hero-list snapshot — why capture before `awardAttachedHeroes` (it deletes the entry)
- hero `pushLog` — WP-214 "Gain that Hero" + D-24081

## Files to Produce
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — snapshot + guarded `pushLog`
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — snapshot + guarded per-hero `pushLog`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — +2 tests
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — +2 tests + `villainAttachedHeroes` mock option
- `docs/ai/DECISIONS.md` — **modified** — **D-24252** lands Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-431 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-466 row
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-431 / EC-466 / D-24252
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-431 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Engine suite green (2073/2073, +4 new); NO `finalStateHash` re-pin in the diff
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide (no downstream log consumer breaks)
- [ ] `git diff` shows NO change to any golden fixture / sentinel hash / generated artifact (re-`git checkout` any lagn-spec line-ending churn)
- [ ] D-24252 Active; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-466:`

## Common Failure Smells
- The entry line names the wrong bystander → read `G.piles.bystanders[0]` AFTER the attach (pile already shifted); must snapshot BEFORE
- The hero line never appears → `awardAttachedHeroes` deleted the mapping before you read it; snapshot BEFORE the call
- Test asserts exact strings and fails → `formatCardRef` adds ` (extId)`; assert on substrings
- Engine golden/hash test fails → something touched the reducer/hash path (these edits must be `G.messages`-only)
- Engine tests crash on import → stale dist (build first)
