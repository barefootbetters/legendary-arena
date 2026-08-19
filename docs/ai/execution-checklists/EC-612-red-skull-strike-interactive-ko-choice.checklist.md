# EC-612 — Red Skull Master Strike: Interactive KO Choice for the Active Player (Execution Checklist)

**Source:** docs/ai/work-packets/WP-577-red-skull-strike-interactive-ko-choice.md
**Layer:** Game Engine (`packages/game-engine`) strike resolver + reused `ko-hero` interactive cluster + Arena Client prompt — cross-layer, standard lane.

## Scope (read first)
IN: make Red Skull's Master Strike interactive for the ACTIVE player (the D-24284 split) by reusing the shipped `ko-hero` pending choice, hand-scoped; allies auto-pick lowest-cost hand Hero; bot current player auto-resolves byte-identically to the old pick. OUT: non-active-player interactivity (needs `activePlayers` restructuring — later WP), any other mastermind, Red Skull bookkeeping, the co2e epic face.

## Before Starting (Hard Gate — STOP if any fails)
- [ ] `grep -q "function resolveRedSkullStrike" …/mastermindHandlers.ts && grep -q "selectRedSkullKoTarget" …/mastermindHandlers.ts` → OK (auto-pick resolver present, no player context)
- [ ] `grep -q "resolveKoHeroChoice" …/moves/koHeroChoice.resolve.ts && grep -q "PendingKoHeroChoice" …/types.ts && test -f apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.vue` → OK (reusable cluster present)
- [ ] No committed complete-game replay fixture references `red-skull` (sentinel is `core/dr-doom`) → hash surfaces unaffected
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green on a clean tree (record engine baseline)

## Locked Values (do not re-derive)
- **The D-24284 split** — non-current players auto-KO lowest-cost hand Hero (existing `selectRedSkullKoTarget`, UNCHANGED); the current player PARKS a hand-scoped `ko-hero` choice when `countKoableHandHeroes ≥ 2`, auto-KOs when exactly 1 (forced), no-ops at 0. Mirrors `villainEffectGiveHqHeroEachPlayer` (WP-532).
- **Hand-only** — Red Skull is "KO a Hero from their hand." The parked choice restricts eligibility to `hand`. Add an ADDITIVE optional marker to `PendingKoHeroChoice` (`zones?: readonly ('hand'|'discard'|'inPlay')[]` OR `handOnly?: true`); absent ⇒ existing all-zone behaviour (villain `ko-hero` UNCHANGED).
- **Byte-identical bot pick** — the bot default for a hand-scoped `ko-hero` choice MUST KO the same card the old `selectRedSkullKoTarget` did: lowest recruit cost, tie → lowest hand index. So `selectDefaultKoTarget` (or its hand-scoped branch) reproduces the old pick.
- **Reuse only** — the existing `resolveKoHeroChoice` move (no new move → no `game.test.ts` move-count change), the existing `PendingKoHeroChoice` kind, the existing `UIPendingKoHeroChoice` projection, the existing `PendingKoHeroChoicePrompt.vue`. NO new move / pending kind / UIState field / prompt component.
- **Thread the current player** — `resolveRedSkullStrike(gameState, currentPlayerId)`; the dispatcher passes it exactly as it already does for Magneto / core Dr. Doom.
- DECISIONS reservation: **D-24386** (supersedes the interactive half of D-24188).

## Guardrails
- Red Skull bookkeeping — bystander capture (D-15401 / WP-574), `masterStrikeCount`, WP-200 emission — BYTE-UNCHANGED.
- No new move, pending-choice kind, canonical-array entry, UIState field, or prompt component — reuse the shipped `ko-hero` cluster.
- `finalStateHash` / `PRE_WP080` byte-unchanged (no committed fixture reaches Red Skull) — verify, do NOT pre-pin.
- Moves never throw; a hand-scoped resolve with a bad zone / stale card is a silent no-op leaving the queue byte-identical (the block-all guard guarantees a valid hand target still exists).
- No `ctx.random`, no I/O, no new persistent shape.
- The additive `PendingKoHeroChoice` marker must NOT change villain `ko-hero` behaviour (absent = all zones).

## Required `// why:` Comments
- On the Red Skull current-player park: the printed "KO a Hero from their hand" is an owning-player choice (WP-577 / D-24386), the D-24284 split — active parks, allies auto; supersedes the D-24188 auto-pick.
- On the hand-scope marker: why hand-only (Red Skull's printed zone) and why additive (villain `ko-hero` spans hand/discard/inPlay unchanged).
- On the bot default hand-scope: why byte-identical to `selectRedSkullKoTarget` (sim + hash stability).

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — `resolveRedSkullStrike` parks for the current player (D-24284 split); dispatcher threads the current player
- `packages/game-engine/src/types.ts` — **modified** — `PendingKoHeroChoice` additive hand-scope marker
- `packages/game-engine/src/moves/koHeroChoice.resolve.ts` (+ eligible/default helpers) — **modified** — respect hand-scope in resolve + bot default
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — hand-scoped eligible list (no new field)
- `packages/game-engine/src/rules/ai.legalMoves.ts` — **modified** — bot default hand-scope (byte-identical)
- Engine tests (`mastermindHandlers`, `koHeroChoice.resolve`, `ai.legalMoves`) — **modified**
- `apps/arena-client/.../PendingKoHeroChoicePrompt.*` (test/fixture) — **modified** — Red-Skull hand-only render + dispatch
- `docs/ai/DECISIONS.md` (D-24386 → Active; annotate D-24188) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (`📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "resolveRedSkullStrike\(gameState, " …/mastermindHandlers.ts` → threads current player; the current-player park present
- [ ] `grep -c "resolveKoHeroChoice" packages/game-engine/src/game.ts` unchanged (no new move); `game.test.ts` move-count UNCHANGED
- [ ] Engine + arena-client build/test exit 0; `vue-tsc` clean
- [ ] Hash oracles unchanged (or re-pinned with a note only on a real fixture diff); bot pick byte-identical (a Red-Skull sim, if run, is stable)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP `✅` + counts; D-24386 landed (Active) + D-24188 annotated superseded
- [ ] Commit prefix `EC-612:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Both players still auto-KO / no prompt → the current-player park branch wasn't added, or the dispatcher didn't thread the current player
- The prompt offers discard/inPlay Heroes → the hand-scope marker wasn't applied to the eligible build / resolve
- A Red-Skull sim's hash shifted → the bot default doesn't reproduce `selectRedSkullKoTarget` (must be lowest-cost hand, tie → lowest index)
- `game.test.ts` move-count failed → a NEW move was added instead of reusing `resolveKoHeroChoice`
- Villain `ko-hero` behaviour changed → the hand-scope marker isn't truly additive-optional (absent must mean all zones)
- Ally KO changed → non-current players must stay on the unchanged `selectRedSkullKoTarget` auto-pick
