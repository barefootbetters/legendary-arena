# EC-514 — Reveal Remainder: Interactive "Put the Rest Back in Any Order" (Execution Checklist)

**Source:** docs/ai/work-packets/WP-479-reveal-remainder-reorder.md
**Layer:** Game Engine + arena-client (cross-layer; engine-then-client order)

## Before Starting
- [ ] On `origin/main` ≥ WP-478 (#1134) merged; D-24286 reserved in the ledger.
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (record baseline counts).
- [ ] `pnpm --filter @legendary-arena/arena-client test typecheck` exit 0.
- [ ] Re-read the WP-470 scry-KO + WP-476 discard-to-N pending-choice files as the template (queue + resolve move + block-all guard + UIState projection + D-24011 filter + bot/sim default + client prompt).

## Locked Values (do not re-derive)
- Trigger: a bare `[keyword:reveal-reorder]` **modifier marker** (a `RECOGNIZED_NON_KEYWORD_MARKERS` entry + a presence check, mirroring `reveal-count` — **NOT** a `HeroKeyword`; `HERO_KEYWORDS` / `rules/heroKeywords.ts` UNCHANGED) → `HeroEffectDescriptor.reorderRemainder = true`. Marker is **hand-appended to `data/cards/core.json`** (that line is hand-authored, like its `reveal-count`; NOT generated from `hero-ability-markers.json`). The Amazing Spider-Man ONLY.
- Loop exit: convert `heroEffectReveal`'s terminal `if (peekOffset >= deck.length) return;` (after the WP-478 reshuffle) to a **`break`** so the post-loop park runs on the deck-exhausted path too.
- Park condition: after the `heroEffectReveal` peek loop, when `reorderRemainder` AND the remainder count (`peekOffset`, clamped to `deck.length`) is **≥ 2**. Remainder = `deck.slice(0, peekOffset)` (the revealed-but-not-drawn cards, already on top, in current order). 0 or 1 → auto-skip (no park).
- Pending type: `PendingReorderChoice { choiceType: 'reorder-deck-top'; playerID; cardIds: CardExtId[] }` on `G.pendingReorderChoices` (FIFO).
- Resolve: `resolveReorderChoice({ G, playerID }, { orderedCardIds })` — accept ONLY a permutation (same multiset + length) of the front entry's `cardIds`; rewrite the top-N of the deck to `orderedCardIds`, leave cards below untouched, front-pop. Any invalid state → silent no-op.
- Bot/sim default: **identity order** (the parked `cardIds` unchanged).
- `reveal-reorder` is a modifier marker, NOT a keyword — `HERO_KEYWORDS` is UNCHANGED (no union/array/drift edit).

## Guardrails
- **Moves never throw.** `resolveReorderChoice` validation-phase silent-returns on wrong playerID / non-permutation / wrong length / empty queue; queue byte-identical on no-op so the client resubmits.
- **Determinism:** the reorder is a PURE permutation — no `ctx.random`, no I/O, no `Math.random`. The bot/sim identity default keeps par/replay faithful (only the extra park→resolve move pair differs).
- **Block-all is mandatory + complete.** Thread `hasPendingReorderChoice` into EVERY guard site alongside the existing three pending predicates (game.ts advanceStage/endTurn, coreMoves.impl, dodgeCard, fightMastermind, fightVillain, recruitHero, healWounds, playFromUndercover, villainDeck.reveal, ai.legalMoves). A parked choice at main stage that isn't guarded lets the player skip it → hard-freeze / desync.
- **Ship pending + projection + prompt together** — a block-all pending state WITHOUT its UIState projection + client prompt hard-freezes the client (`project_pending_choice_no_ux_freeze`).
- **Sim registration is UNCONDITIONAL** — `resolveReorderChoice` in `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs (runner + par.aggregator) + `*_MOVE_NAMES` + the drift test, or the sim loop hangs the first time a reveal parks a reorder. Add to `replay.execute`/`runFixture` MOVE_MAPs ONLY if a committed replay/fixture dispatches it (the re-pin reveals this).
- **New hashed `G` field → DUAL re-pin.** `pendingReorderChoices` shifts BOTH `finalStateHash` (regen via `scripts/record-game-fixture.mjs`) AND the `PRE_WP080_HASH` sentinel where a fixture hits the path (`reference_hashed_g_field_dual_repin`) — do not hand-edit either; regenerate + note.
- **Hand-append the card marker to `data/cards/core.json`** (that line is hand-authored, like its `reveal-count`; `hero-ability-markers.json` has no entry and `apply-hero-ability-markers.mjs` would throw on the token) — verify only the Amazing Spider-Man line changed.
- **Terminal exit is `break`, not `return`.** The post-loop park must be reachable from the deck-exhausted exit — a fully-expensive ≥2 remainder with an empty discard must still park.
- **Engine decides / client projects** — no gameplay logic in the Vue prompt; it submits `orderedCardIds` and the engine validates.
- **Current player only** — reveal is a current-player effect; the park writes `playerID: currentPlayer`. No non-current complication (unlike WP-476's multi-player strike).
- **(Optional hardening — copilot #2)** `resolveReorderChoice` MAY additionally assert `deck.slice(0, N)` still equals the parked `cardIds` multiset before rewriting (defense against a future block-all regression that let the deck top drift). Not required — the verified-complete block-all already guarantees it — but cheap to add.

## Required `// why:` Comments
- The park site in `heroEffectReveal`: why the remainder is `deck.slice(0, peekOffset)` (the loop leaves non-drawn revealed cards on top; `peekOffset` counts them) and why `< 2` auto-skips (nothing to order). Cite D-24286.
- `resolveReorderChoice`: why only a permutation is accepted (the player reorders, never adds/removes) and why an invalid submission is a silent no-op (moves never throw).
- The bot/sim resolve: why identity order is the deterministic default (par/replay faithfulness — the reorder is cosmetic to the engine's outcome).
- The `game.ts` move registration + each block-all guard add: cite the pending-choice block-all pattern.

## Files to Produce
- `packages/game-engine/src/rules/heroAbility.types.ts` — `reorderRemainder?` flag.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `reveal-reorder` in `RECOGNIZED_NON_KEYWORD_MARKERS` + presence check → `reorderRemainder` (the `reveal-count` pattern; NO `heroKeywords.ts` change).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — modifier-marker parse test.
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ test) — terminal `return`→`break`; park the reorder after the loop.
- `packages/game-engine/src/types.ts` — `PendingReorderChoice` + `G.pendingReorderChoices`.
- `packages/game-engine/src/moves/reorderChoice.resolve.ts` — **new** (resolve + `hasPendingReorderChoice`) (+ test).
- `packages/game-engine/src/game.ts` (+ `game.test.ts` move-set/count +1) — registration + advanceStage guard.
- `packages/game-engine/src/moves/{coreMoves.impl,dodgeCard,fightMastermind,fightVillain,recruitHero,healWounds,playFromUndercover}.ts` + `villainDeck/villainDeck.reveal.ts` — block-all guard.
- `packages/game-engine/src/ui/{uiState.build,uiState.types,uiState.filter}.ts` — projection + private filter.
- `packages/game-engine/src/simulation/{ai.legalMoves,simulation.runner,par.aggregator}.ts` — identity default + MOVE_MAPs + `*_MOVE_NAMES`.
- `packages/game-engine/src/{replay/replay.execute,../test/fixtures/runFixture}.ts` — MOVE_MAP add ONLY if dispatched.
- `data/cards/core.json` — **hand-edit** — append `[keyword:reveal-reorder]` to The Amazing Spider-Man's ability line (NOT script-generated; verify only that line changed).
- `apps/arena-client/src/components/play/PendingReorderChoicePrompt.vue` — **new**.
- `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue`, `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts` — client wiring.
- `docs/ai/DECISIONS.md` — land D-24286.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` exit 0; arena-client `test`/`typecheck` exit 0; `pnpm -r build` exit 0.
- [ ] `sim:runtime-observed:check` returns (no sim hang); drift test green; `game.test.ts` move-set/count +1.
- [ ] Fixture `finalStateHash` + `PRE_WP080_HASH` sentinel unchanged OR regenerated-with-note (dual re-pin).
- [ ] `data/cards/core.json` shows only the Amazing Spider-Man line changed (hand-edited; NOT script-generated).
- [ ] `docs/ai/DECISIONS.md` D-24286 landed Active.
- [ ] WORK_INDEX `[x]` + date; EC_INDEX EC-514 → Done; MINDMAP node ✅ + `roadmap:counts:write` + `:check` green.
- [ ] Live-on-surface (D-24026, operator-pending): play The Amazing Spider-Man with ≥2 non-drawn revealed cards → the reorder prompt appears.

## Common Failure Smells
- The reveal parks a reorder but the End-Turn button still works → a guard site was missed (block-all incomplete).
- The sim hangs / `sim:runtime-observed:check` never returns → `resolveReorderChoice` not registered unconditionally in the sim MOVE_MAPs.
- `resolveReorderChoice` accepts a submission that drops or duplicates a card → permutation check too loose (must be same multiset AND length).
- A remainder of 1 still parks a choice → the `< 2` auto-skip guard is wrong.
- A fully-expensive ≥2 remainder with an empty discard does NOT park → the terminal exhaustion exit is still a `return` (must be `break` so post-loop park runs).
- The build throws on `[keyword:reveal-reorder]` → it was added to `hero-ability-markers.json` / run through `apply-hero-ability-markers.mjs` (unknown token) instead of hand-appended to `core.json`; or it was added as a `HeroKeyword` instead of a `RECOGNIZED_NON_KEYWORD_MARKERS` modifier.
- `data/cards/core.json` shows churn on other cards → a stray edit; only the Amazing Spider-Man line changes.
- Only `finalStateHash` re-pinned, `PRE_WP080_HASH` left stale (or vice versa) → the dual re-pin was half-done for the new `G` field.
- The Vue prompt reorders client-side and sends the deck → it must send only `orderedCardIds` and let the engine rewrite the deck top.
