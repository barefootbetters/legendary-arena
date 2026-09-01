# EC-667 — Widen optional-ko-reward KO Source to In-Play (Execution Checklist)

**Source:** docs/ai/work-packets/WP-632-optional-ko-reward-inplay-zone.md
**Layer:** Cross-cutting (Game Engine + Card Data + Arena Client)

## Before Starting
- [ ] WP-248/D-24019 + WP-249/D-24020 landed (the keyword framework + client prompt exist on `main`).
- [ ] Precondition greps A–E in the WP `## Assumes` all match.
- [ ] EXACT target file set = the WP `## Files Expected to Change` list; any edit outside it is a FAIL (surface as a blocker, do not improvise).
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline count).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (baseline).

## Locked Values (do not re-derive)
- KO source = `hand ∪ discard ∪ inPlay`; `inPlay` = `G.playerZones[pid].inPlay` (cards played this turn).
- Resolve KO payload zone union: `'hand' | 'discard' | 'inPlay'`.
- Park condition: `discard.length + hand.length + inPlay.length ≥ 1`.
- `selectDefaultOptionalKoTarget` order: discard→hand (lowest cost, discard-before-hand, then index) EXACTLY as D-24019; scan `inPlay` ONLY when discard AND hand are both empty; null only when all three empty.
- Reworded prose (all 9 lines): "…from your hand, discard pile, or a card you played this turn." Keyword marker token UNCHANGED.
- Affected cards: core{energy-drain,dangerous-rescue} · ssw1{phase-out,trust-me-im-a-doctor,feed-the-sharks} · ssw2{witness-the-end,bloodstone-pendant} · co2e{energy-drain,dangerous-rescue}.
- `UIPendingOptionalKoReward.eligibleInPlay: UIEligibleKoHeroCard[]` (element `zone` already admits `'inPlay'`).

## Guardrails
- Bot default MUST byte-preserve every existing pick — inPlay is a hand+discard-empty fallback ONLY (structural; discard→hand first, replace on strictly-lower cost). This is pick-preservation, NOT the hash-stability claim.
- Hash-stability is EMPIRICAL: widening the park to count `inPlay` makes it fire in one new reachable state — hand=∅ ∧ discard=∅ ∧ inPlay≠∅ (a within-turn full-discard reshuffle then an optional-ko-reward card played last). Moved-hash FORK: if a moved hash traces to THIS park, it is correct D-24442 behavior → re-pin authorized (record under D-24442); ANY OTHER movement = STOP-and-investigate.
- Reword prose in the CONVERTER SOURCES (coreset.js/sw1.js/sw2.js) then regenerate; edit co2e in `data/cards/co2e.json` directly (hand-authored, no source). Never hand-edit generated `core/ssw1/ssw2.json`.
- Reword ONLY the named `[keyword:optional-ko-reward:…]` ability lines. The phrase "hand or discard pile" also appears on OUT-OF-SCOPE lines in the same sources (ko-wound-reward Wound cards coreset.js ~508/1020, a ko-hero line ~637, sw2.js ~400 conditional-KO, co2e.json ~1370 unmarked) — a blind find-replace corrupts them. Do NOT touch them.
- `koSourceZoneLabel` (resolve.ts ~136): the third zone makes the ternary a CHAINED ternary — convert to `if/else if/else` (code-style).
- Executor: before finalizing, re-confirm NO fixture outside the allowlist constructs a `UIPendingOptionalKoReward` literal (grep `eligibleHand|eligibleDiscard|UIPendingOptionalKoReward`; today only the allowlisted build/filter tests + the prompt do).
- `eligibleInPlay` is chooser-private: build fresh (per-entry display spread), pass through the owner-only filter branch; opponents + spectators get it redacted (D-24020).
- Moves never throw; resolve stays a silent no-op on a stale/absent target (queue intact).
- No `.reduce()` in the zone/eligibility scans; `for...of` with descriptive names.
- No `[keyword:optional-ko-reward:*]` grammar change; reward atomicity (KO before reward) and FIFO unchanged.
- Layer flow data→engine→client only; the client consumes the projection (no engine runtime import added).

## Required `// why:` Comments
- `selectDefaultOptionalKoTarget` inPlay fallback: why the scan is discard→hand first and inPlay only when both empty (determinism — preserves every recorded bot pick; D-24442).
- `heroEffectOptionalKoReward` eligibleCount: why inPlay now counts (park must fire when only in-play has cards).
- resolve-move inPlay log label + zone resolve: why inPlay is a valid KO source now (D-24442 supersedes D-24019's "never inPlay").

## Files to Produce
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **modified** — zone union + inPlay resolve + log label
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — eligibleCount + OptionalKoTarget zone + fallback scan
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `eligibleInPlay`
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.build.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.ts` + `uiState.filter.test.ts` — **modified**
- `scripts/convert-cards/inputs/cards/{coreset,sw1,sw2}.js` — **modified** — prose reword (2/3/2 lines)
- `data/cards/{core,ssw1,ssw2}.json` — **regenerated**; `data/cards/co2e.json` — **modified** (2 lines)
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` + `.test.ts` — **modified** — in-play block
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24442 Active), `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (delta = new inPlay assertions only).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` + test exit 0.
- [ ] Card data regenerated via the FULL ordered pipeline (convert-cards-v15 → apply-card-counts → apply-hero-ability-markers → apply-effect-markers → apply-defeat-requirement-markers; co2e hand-edited, not regenerated); every card-data `:check` gate exits 0 (no unexpected diff beyond the reworded prose).
- [ ] `pnpm -r --no-bail test` green; `finalStateHash` byte-unchanged OR moved-and-re-pinned per the FORK (reshuffle-empty in-play park only); no other movement.
- [ ] `eligibleInPlay` appears in the Play Diagnostics `uiStateSnapshot` (Board-Visible Field Rule step 5).
- [ ] Live-on-surface (D-24026): an in-play KO works in a real match on `play.legendary-arena.com`; the reworded text shows on the card.
- [ ] `docs/ai/STATUS.md` updated (names WP-632).
- [ ] `docs/ai/DECISIONS.md` D-24442 → Active.
- [ ] `WORK_INDEX.md` `[x]` with date; `EC_INDEX.md` Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A pinned pick/hash moves and it does NOT trace to a reshuffle-empty in-play park → inPlay leaked into the PRIMARY bot scan (must be fallback-only) — a real regression; revert to fallback-only. (A move that DOES trace to the reshuffle-empty park is correct D-24442 behavior, not a smell — re-pin it.)
- Blank in-play list in the prompt → `eligibleInPlay` populated in build but dropped in the filter whitelist (the recurring UIState filter-drop failure mode).
- Card `:check` gate red → generated `core/ssw1/ssw2.json` hand-edited instead of regenerated, or the co2e prose diverged from the reworded phrase.
