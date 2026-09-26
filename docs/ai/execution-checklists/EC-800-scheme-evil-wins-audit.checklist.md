# EC-800 — Scheme Evil Wins fidelity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-763-scheme-evil-wins-audit.md
**Layer:** Game Engine (scheme config, loss rules, UIState enum) + Arena Client (one label file)

## Before Starting
- [ ] Baseline `origin/main` includes #2376. Run `pnpm install`, then `pnpm -r build` (expect 0). Engine and arena-client suites are green.
- [ ] Anchors are still where the WP says:
  - `resolveTwistLossThreshold` / `MVP_SCHEME_TWIST_THRESHOLD = 7`
  - `isTwistLossSuppressed`
  - the proxy at `schemeHandlers.ts:40-95`
  - the 8 core entries in `schemeTwistConfigs.ts`
  - the `pile-depleted` pile union
  - `remainingPileCount`
  - the `SchemeLossKind` union + canonical array
  - `menaceDisplay.ts` labels
- [ ] Re-read the WP §Audit tables. They are the configuration, verbatim.

## Locked Values (do not re-derive)
- **Fallback threshold** (unconfigured schemes, and the twist half of compound entries): derived at read time as the count of `G.villainDeckCardTypes` values `=== 'scheme-twist'`. If that count is 0, use `DEFAULT_SCHEME_TWIST_COUNT = 8`. **No new G field for this.** `MVP_SCHEME_TWIST_THRESHOLD` is deleted and renamed, and its test import updated. Every core threshold must stay unchanged; core Portals derives 7.
- **New resolver id** `'counter-only'`: a registered pure no-op. No `pushLog`, no notable event, no `SchemeTwistResolverKey` change. The generic "twist count incremented" line (PAR anchors) still emits.
- **`pile-depleted`:** `type SchemeLossPile = 'heroDeck'|'wounds'|'villainDeck'`. The condition is the exclusive union `{kind; pile: SchemeLossPile; piles?: never} | {kind; piles: readonly SchemeLossPile[]; pile?: never}`. `villainDeck` reads `G.villainDeck.deck.length`.
- **Setup size:** `schemeLossPileSetupSize` is unchanged. The new `schemeLossVillainDeckSetupSize?: number` is omit-when-absent and written only when the condition includes `villainDeck`. Never size the Villain Deck from the `villainDeckCardTypes` key count.
- **`resolveSchemeLossKind`:** exhaustive switch, no ternary. `villainDeck` → `villain-deck`.
- **One selector:** `selectActiveLossCondition(gameState)` supplies kind, threshold and progress together.
- **New flag** `twistFallbackWithResourceLoss?: true`. It keeps the proxy active at the fallback threshold alongside a resource condition. Set it on D-compound entries only.
- **`SchemeLossKind`:** add `'villain-deck'` and `'twists-fallback'` (union + canonical array). The meter reports the highest-normalised-progress condition; on a tie, the pile wins.
- **Client labels:** `twists-fallback` → `Twists (approximate)`; `villain-deck` → `Villain Deck`.
- **Config entries:** 27 A (`lossThreshold` N), 15 D-pure (piles), 25 D-compound (piles + flag), all `resolverId: 'counter-only'`, exactly per WP §Audit.

## Guardrails
- The 8 core schemes are byte-identical. Do not touch their entries or thresholds. The sentinel and PAR seed oracles must not move.
- The Excluded list (non-standard piles, Good-Wins schemes) gets no entry and uses the fallback rule.
- Precedence: a Villain Deck runout that both latches the final turn and trips `pile-depleted` in the same `onMove` ends in a **scheme loss**, not a tie. Assert it in a test.
- Canonical array and union always change together. The drift test is the proof.
- Client copy lives only in `menaceDisplay.ts`; no label strings in `packages/`.
- No twist effects and no per-scheme counters. Those are the follow-up series and WP-764.

## Required `// why:` Comments
- Fallback threshold: operator decision 2026-09-25 (D-24595). The flat 7 caused false losses on 144 schemes.
- `counter-only`: lets twist-count schemes be configured without inventing a twist effect.
- `villainDeck` pile + `piles` form: many printed conditions read "X or Y runs out".
- `twistFallbackWithResourceLoss`: compound schemes keep a doom clock for their unmodelled half.
- `twists-fallback` kind: the meter must tell players the condition is approximate.
- Each config block: cite D-24595 and the printed Evil Wins text for its category.

## Files to Produce
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts` — **modified**
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` + test — **modified**
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` + test — **modified**
- `packages/game-engine/src/rules/schemeLossProgress.ts` + test — **modified**
- `packages/game-engine/src/rules/schemeResourceLoss.ts` + test — **modified**
- `packages/game-engine/src/rules/schemeHandlers.ts` + test — **modified**
- `packages/game-engine/src/types.ts` — **modified** (`schemeLossVillainDeckSetupSize?`)
- `packages/game-engine/src/setup/buildInitialGameState.ts` + `buildInitialGameState.lossPileCapture.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.progress.test.ts`, `ui/uiState.filter.test.ts` — **modified** (value-only pin updates observed at the scaffold)
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified**
- `apps/arena-client/src/vfx/menaceDisplay.ts` + `menaceDisplay.test.ts` — **modified**
- `docs/ai/DECISIONS.md` (D-24595 with the audit table), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0.
- [ ] Engine suite passes.
- [ ] arena-client typecheck → 0 and suite passes.
- [ ] `pnpm -r --no-bail test` → 0 fail.
- [ ] `sim:coverage --check` and `sim:runtime-observed:check` → 0.
- [ ] Core oracles are unchanged.
- [ ] D-24595 is Active and supersedes D-24371 §6 for non-core schemes.
- [ ] STATUS updated; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) recorded as a post-deploy STATUS-flip.

## Common Failure Smells
- A core replay hash moved → a core entry or the core threshold path was altered.
- Midnight Massacre still ends at twist 7 → the fallback wasn't replaced, or the D-pure entry is missing.
- A Villain Deck meter labelled "Wounds" → `resolveSchemeLossKind` is still a ternary.
- The meter shows the wrong numerator or denominator pair → progress and threshold were computed outside `selectActiveLossCondition`.
- The sentinel hash moved → `schemeLossPileSetupSize` was repurposed instead of adding the separate Villain Deck field.
- A compound scheme never loses on twists → the flag wasn't honoured; suppression still wins.
- A deck runout ends in a tie → the `villainDeck` pile isn't read, or precedence is wrong.
- The meter shows "Twists" on an unmodelled scheme → the `twists-fallback` kind was never selected.
- Drift test red → union/array mismatch on `SchemeLossKind`.
