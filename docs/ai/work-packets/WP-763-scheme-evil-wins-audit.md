# WP-763 — Scheme Evil Wins fidelity: stop false twist-7 losses, printed twist thresholds, Villain-Deck runout (Game Engine + Arena Client)

**Status:** Draft 2026-09-25
**Primary Layer:** Game Engine (scheme config + loss rules + UIState projection) + Arena Client (one danger-meter label)
**Dependencies:**
- WP-508..515 / D-24315..D-24320: `resourceLossCondition` and the scheme-loss counters.
- WP-557 / 558 / 562 / D-24366 / D-24371: danger meter, `SchemeLossKind`, `schemeLossProgress` projection.
- D-24178: MVP twist threshold.
- WP-367: deck-exhaustion final-turn tie.

**User-Visible Surface:** `play.legendary-arena.com`. When a match ends, and what the danger meter shows, change on 192 schemes.
**Lane:** Standard (two-session). It touches endgame loss rules, scheme config, a UIState enum and a client label. It affects competitive and gauntlet outcomes.
**Unblocks:** WP-764 (Midnight Massacre), which consumes the multi-pile / `villainDeck` loss condition added here.

> Baseline: `origin/main` at `ff5dd7c3` plus the reserve commit (#2376).

---

## Goal

Only the 8 core schemes have a modelled Evil Wins condition. Every other scheme (192 of 200) loses on the engine's generic **"7 twists"** stand-in (`MVP_SCHEME_TWIST_THRESHOLD = 7`, `rules/schemeLossProgress.ts:85`), whatever its card prints. A live solo match on `mdns/midnight-massacre` ended "twist threshold reached" at twist 7. That scheme's printed Evil Wins is *"When the Hero Deck or Villain Deck runs out."*

The audit, run on 2026-09-25 by an independent subagent, found:

| Problem | Count |
|---|---|
| Can lose falsely at twist 7 | 144 |
| Lose at 7 where the card prints 8–11 | 14 |
| Can never lose (6 or fewer twists in the deck) | 25 |

All three problem sets are ranked gauntlet legs. The full audit is recorded under §Audit and in D-24595.

After this session:

1. **Printed twist thresholds.** Every scheme whose printed Evil Wins is a twist count ("Twist N: Evil Wins") loses at exactly its printed **N**.
2. **Deck and stack runout.** Every scheme whose printed Evil Wins is (or includes) the **Hero Deck, Villain Deck or Wound Stack running out** loses on that runout. A new `villainDeck` pile kind and a multi-pile "any of these runs out" form make this possible.
3. **Interim rule for everything else.** Every remaining scheme (per-scheme counters the engine doesn't model yet) uses the operator-chosen interim rule: **Evil Wins when the last Scheme Twist in that scheme's Villain Deck is revealed**. This replaces the flat 7.
   - The danger meter labels this condition **approximate**.
   - Compound schemes ("3 Villains per player escaped **or** the Villain Deck runs out") keep the deck-runout loss **and** the last-twist fallback for the unmodelled half.

## User-Visible Impact

- **No false losses at twist 7.** A match on an unmodelled scheme can no longer end at twist 7 when the card has more twists.
- **Correct twist losses.** Twist-count schemes lose at the printed number, e.g. Symbiotic Absorption at 11, The Time Heist at 10.
- **Deck runout loses instead of tying.** Deck-runout schemes like Midnight Massacre and Halve All Life lose when the deck runs out, instead of drawing through a final turn to a tie.
- **Low-twist schemes can lose.** The 25 schemes that could never lose (≤ 6 twists) now can, at their last twist or their printed N.
- **Honest meter.** Players see "Twists (approximate)" on schemes whose real condition isn't modelled yet.

---

## Operator Decision (2026-09-25)

Jeff chose **"last twist in the deck"** as the interim Evil Wins rule for schemes whose printed condition is an unmodelled per-scheme counter. The danger meter labels it approximate.

The rejected alternatives:
- **No twist loss.** Unfair free wins would inflate ranked scores.
- **Pull those schemes from ranked.** It shrinks the catalog.

Modelling the per-scheme counters (escaped-villain counts, tokens on the scheme, KO-pile counts, etc.) is a named follow-up **series**, not this packet.

---

## Audit (locked; source for §Locked Values)

The full 200-row table was produced by the audit subagent at `%TEMP%\claude\scheme-audit\scheme-evil-wins-audit.md`. It is reproduced in D-24595 at execution. The two sets this packet configures are fixed here.

**A — printed twist count** (threshold = printed N). The core entries are unchanged.

| N | Schemes |
|---|---|
| 6 | anni/sneak-attack-the-heroes-homes, ca75/unbreakable-enigma-code-the, vnom/paralyzing-venom, xmen/horror-of-horrors |
| 7 | 2099/pull-reality-into-cyberspace, bkwd/corrupt-the-spy-agencies, co2e/portals-to-the-dark-dimension, ff04/invincible-force-field, ff04/pull-reality-into-the-negative-zone, msp1/invade-asgard, pttr/weave-a-web-of-lies, ssw1/dark-alliance, wwhk/mutating-gamma-rays |
| 8 | co2e/unleash-the-power-of-the-cosmic-cube, msp1/unleash-the-power-of-the-cosmic-cube, cvwr/avengers-vs-x-men, mgtg/inescapable-kyln-space-prison, rvlt/korvac-saga-the, ssw2/god-emperor-of-battleworld-the, ssw2/secret-wars, wpnx/condition-logan-into-weapon-x |
| 9 | anni/pulse-waves-from-the-negative-zone, wwhk/world-war-hulk |
| 10 | msis/the-time-heist, rlmk/tornado-of-terrigen-mists, shld/hail-hydra |
| 11 | vnom/symbiotic-absorption |

- `ssw2/god-emperor-of-battleworld-the` prints "(If any Mastermind still lives)". v1 treats it as plain twist 8, a named gap.
- Twist 7 schemes are configured explicitly even though 7 was already the old default. This way the fallback change can never move them.

**D-pure — Evil Wins only on a standard pile running out** (suppresses the twist proxy):

| Pile | Schemes |
|---|---|
| Hero Deck | ca75/go-back-in-time-to-slay-heroes-ancestors, co2e/super-hero-civil-war, cvwr/epic-super-hero-civil-war, dead/deadpool-kills-the-marvel-universe, msp1/super-hero-civil-war, wpnx/go-after-heroes-loved-ones |
| Wound Stack | msp1/radioactive-palladium-poisoning, ssw1/pan-dimensional-plague, wwhk/fall-of-the-hulks |
| Wound Stack or Villain Deck | bkpt/poison-lakes-with-nanite-microbots, co2e/the-legacy-virus, xmen/anti-mutant-hatred, xmen/televised-deathtraps-of-mojoworld |
| Hero Deck or Villain Deck | mdns/midnight-massacre, msis/halve-all-life-in-the-universe |

**D-compound — "unmodelled counter, or a standard pile runs out"** (pile loss **plus** the last-twist fallback):

- **Escaped-villain count, or Villain Deck:**
  - antm/trap-heroes-in-the-microverse
  - bkwd/train-black-widows-in-the-red-room
  - co2e/negative-zone-prison-outbreak
  - dstr/war-for-the-dream-dimension
  - rlmk/devolve-with-xerogen-crystals
  - rvlt/earthquake-drains-the-ocean
  - smhc/scavenge-alien-weaponry
  - wtif/marvel-zombies
  - wwhk/gladiator-pits-of-sakaar
  - pttr/clone-saga-the
  - pttr/splice-humans-with-spider-dna
  - vnom/invasion-of-the-venom-symbiotes
- **Tokens or cards, or Villain Deck:**
  - bkpt/plunder-wakandas-vibranium
  - co2e/bank-robbery-hostage-crisis
  - co2e/enshrouded-identity
  - cosm/annihilation-conquest
  - dstr/cursed-pages-of-the-darkhold-tome
  - mdns/sire-vampires-at-the-blood-bank
  - msmc/control-the-mutant-messiah
  - msmc/open-rifts-to-future-timelines
- **Counter, or Villain Deck or Hero Deck:** msmc/reveal-the-heroes-evil-clones, msmc/unleash-an-anti-mutant-bioweapon
- **Counter, or Hero Deck:** 2099/befoul-earth-into-a-polluted-wasteland, dkcy/detonate-the-helicarrier
- **Counter, or Wound Stack:** vnom/maximum-carnage

**Excluded** (fall back to the last-twist rule unchanged; named follow-ups):
- **Non-standard piles:** chmp/clash-of-the-monsters-unleashed (Monster Pit), chmp/divide-and-conquer (all Hero Decks), noir/five-families-of-crime (multiple Villain Decks), rvlt/secret-hydra-corruption (Officer stack), wwhk/shoot-hulk-into-space (Hulk Deck), gotg/unite-the-shards (Shards supply).
- **"Good Wins" schemes:** the `vill` set, plus fear-itself, last-stand-at-avengers-tower and traitor-the.
- **The 8 core configured schemes:** unchanged.

---

## Assumes

1. **Threshold resolution.** `resolveTwistLossThreshold` (`rules/schemeLossProgress.ts:100-117`) resolves `lossThresholdByPlayerCount` → `lossThreshold` → `MVP_SCHEME_TWIST_THRESHOLD = 7` (L85, imported by `schemeLossProgress.test.ts:15`). `isTwistLossSuppressed` (L125-132) is true iff the scheme config has a `resourceLossCondition`.
1a. **Twist cards at runtime.** `G.villainDeckCardTypes` values equal to `'scheme-twist'` are written only at setup (`villainDeck.setup.ts:274`). The one runtime write (`schemeTwistResolvers.ts:695`) writes `'villain'`. Counting `'scheme-twist'` values therefore yields the number of twists shuffled in.
1b. **PAR anchors.** `scripts/extract-par-anchors.mjs:48` counts twists by matching the literal "twist count incremented" emitted by `buildGenericTwistEffects` (`schemeHandlers.ts:39-96`).
1c. **Pile setup size.** `schemeLossPileSetupSize` is a single number. The sentinel `legacy-virus-the` hash depends on it. `resolveSchemeLossKind` (`schemeLossProgress.ts:~267`) maps the pile with a ternary (`pile === 'heroDeck' ? 'hero-deck' : 'wound-stack'`). `computeMenace` is at :338. The UIState filter spreads `progress` (`uiState.filter.ts:557`).
2. **The twist proxy.** It lives at `rules/schemeHandlers.ts:40-95` (`predictedTwistCount >= threshold` unless suppressed). Unconfigured schemes hit the "counter increment only" fallback at `schemeHandlers.ts:163-170`.
3. **Scheme config.**
   - `rules/schemeTwistConfigs.ts:32-207`: exactly 8 core entries.
   - `SchemeTwistConfig` (`rules/schemeTwistConfig.types.ts:~79-110`) has a **required** `resolverId: SchemeTwistResolverId` (union at :64-72), optional `lossThreshold`, `lossThresholdByPlayerCount` and `resourceLossCondition`.
   - `SchemeResourceLossCondition` kinds: `escaped-pile-count`, `pile-depleted` (with `pile: 'heroDeck' | 'wounds'`), `escaped-converted-count` (:39-56).
   - The resolver registry is at `rules/schemeTwistResolvers.ts:823-831`.
4. **Pile-depletion loss.**
   - `applyPileDepletionResourceLoss` (`rules/schemeResourceLoss.ts:196-224`) and `remainingPileCount` (:170-183) run per move from `game.ts:781`, after `latchFinalTurnIfDeckExhausted` (`game.ts:774`, `endgame/finalTurn.logic.ts:36-58`).
   - `evaluateEndgame` checks `schemeLoss` before the deck-out tie (D-24319).
   - There is **no** `villainDeck` pile; `G.villainDeck.deck` holds the Villain Deck.
5. **Twists in the deck.**
   - `villainDeck/villainDeck.setup.ts:265-268` shuffles the scheme's `villainDeckTwistCount` twists (default 8 when absent, :132).
   - It is never used as a loss threshold.
   - WP-562 captures a depletion-pile setup size at `buildInitialGameState.ts:~596` (`resolveSchemeLossPileSetupSize`).
6. **Danger meter and loss kinds.**
   - The projection lives in `rules/schemeLossProgress.ts:154-317`.
   - `SchemeLossKind` (:54-61) = `hero-deck | wound-stack | escaped-pile | escaped-bystander | escaped-killbot | escaped-skrull | twists`, with a canonical drift-checked array.
   - UIState fields (`ui/uiState.types.ts:~875-900`): `menace`, `menaceTier`, `schemeLossProgress`, `schemeLossThreshold`, `schemeLossKind`, `schemeTwistThreshold`.
   - Client labels come from `apps/arena-client/src/vfx/menaceDisplay.ts` (`menaceKindLabel`) and render in `components/play/DangerMeter.vue:80-89`. Copy never lives in `packages/` (D-24367 §2).
7. **Determinism baselines.** The core sentinel replay and all 128 PAR seed scenarios use only core schemes, which are unchanged.
8. **Build and tests.** `pnpm -r build` exits 0. The engine and arena-client suites are green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md`:
  - D-24178 (MVP threshold; scoped to core);
  - D-24315..D-24320 (resource loss, suppression, precedence);
  - D-24366;
  - D-24371 §1/§3/§5/§6 (§6 said the 7-twist fallback "remains correct for genuinely unconfigured schemes"; this audit shows otherwise, so D-24595 supersedes it for non-core schemes).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — this WP widens an engine→client enum.
- `.claude/rules/architecture.md` §UIState Projection Integrity, and `.claude/rules/code-style.md` §Drift Detection. `SchemeLossKind` has a canonical array, so union and array are updated in lockstep.
- `docs/legendary-universal-rules-v23.md` (Evil Wins, deck exhaustion).
- User memory:
  - `project_resource_loss_scheme_fidelity_epic` (twist count as doom clock);
  - `reference_hashed_g_field_dual_repin`;
  - `project_danger_meter_menace_signal_arc`;
  - `reference_uistate_filter_whitelist_drops_fields`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc, `// why:`, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. No randomness is added.
- Layers: engine rules, config and UIState, plus exactly one client label file. No server change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24595) before coding. One WP per session.

**Packet-specific:**
- **Fallback threshold.** The fallback applies to a scheme with no config entry, and to the twist half of a compound entry.
  - It is **derived at read time** by counting `G.villainDeckCardTypes` values equal to `'scheme-twist'`. If the count is 0 (test mocks, or a scheme missing from the registry), it is 8, mirroring the `villainDeck.setup.ts` default. **No new G field.**
  - `MVP_SCHEME_TWIST_THRESHOLD` is deleted and replaced by `DEFAULT_SCHEME_TWIST_COUNT = 8`, with its test import updated.
  - A core entry that relied on the old default (core Portals, 7 twists in the deck) derives the same value (7). The executor asserts every core threshold is unchanged.
  - The core schemes' explicit thresholds are untouched.
- **Counter-only resolver.**
  - Add `'counter-only'` to `SchemeTwistResolverId`, backed by a registered **pure no-op** resolver, so twist-count entries can be configured without a twist effect.
  - The no-op emits no `pushLog`, no notable event, and no `SchemeTwistResolverKey` change.
  - The required `resolverId` field stays required. This is a contract widen, not a relaxation.
  - A configured scheme no longer emits the "[Scheme Twist] No resolver configured…" line. The generic "…twist count incremented…" line from `buildGenericTwistEffects` still emits, so PAR anchor extraction is unaffected.
- **Multi-pile loss.**
  - `type SchemeLossPile = 'heroDeck' | 'wounds' | 'villainDeck'`. `pile-depleted` becomes the exclusive union `{ kind; pile: SchemeLossPile; piles?: never } | { kind; piles: readonly SchemeLossPile[]; pile?: never }`. Core entries keep the single-`pile` form.
  - `villainDeck` reads `G.villainDeck.deck.length`, and `remainingPileCount` handles it.
  - **Setup size:** `schemeLossPileSetupSize` is unchanged for `heroDeck` / `wounds`, which keeps the sentinel byte-identical. Add `schemeLossVillainDeckSetupSize?: number` to `G`, written omit-when-absent and **only** when the condition includes `'villainDeck'`. Never derive the Villain Deck size from the `villainDeckCardTypes` key count, which `:695` mutates at runtime.
  - `resolveSchemeLossKind` becomes an **exhaustive switch** (`heroDeck` → `hero-deck`, `wounds` → `wound-stack`, `villainDeck` → `villain-deck`). No ternary.
  - **One selector.** Kind, threshold and progress all come from one `selectActiveLossCondition(gameState)` helper, so `computeMenace` can never pair one condition's numerator with another's denominator.
- **Compound schemes.**
  - Add an optional config flag `twistFallbackWithResourceLoss?: true`. When present, the twist proxy stays **active** at the fallback (last-twist) threshold **even though** a `resourceLossCondition` is declared.
  - Without the flag, D-24315 suppression is unchanged.
  - D-compound entries set the flag; D-pure entries do not.
- **Loss-meter kinds.**
  - `SchemeLossKind` gains `'villain-deck'` and `'twists-fallback'`, updated in the union and the canonical array together. A drift pin covers the new `SchemeLossPile` values.
  - `twists-fallback` is the kind whenever the active condition is the last-twist fallback, meaning an unconfigured scheme or the twist half of a compound scheme.
  - For multi-pile or compound schemes, the meter reports the condition with the **highest normalised progress** (ties go to the pile condition).
  - The client adds labels for both new kinds in `menaceDisplay.ts`. `twists-fallback` reads **"Twists (approximate)"**.
- **Endgame precedence.** When a Villain Deck runout both latches the final turn and triggers `schemeLoss` in the same `onMove`, the result is a **scheme loss**, not a tie, per D-24319. This needs an explicit test.
- **Determinism.**
  - Core schemes are byte-identical (sentinel + PAR seeds are core only), so no re-pin is expected.
  - Non-core replays recorded before WP-763 may end differently. This is recorded in D-24595.
  - Published non-core gauntlet scores are not recomputed.

## Locked Values

- The §Audit tables (A thresholds, D-pure piles, D-compound piles) are the configuration, verbatim.
- New resolver id: `'counter-only'`.
- New type `SchemeLossPile = 'heroDeck' | 'wounds' | 'villainDeck'`.
- `pile-depleted` becomes the exclusive union `{ kind; pile: SchemeLossPile; piles?: never } | { kind; piles: readonly SchemeLossPile[]; pile?: never }`.
- New flag: `twistFallbackWithResourceLoss?: true`.
- New `SchemeLossKind` values: `'villain-deck'`, `'twists-fallback'`.
- Client label: `twists-fallback` → `Twists (approximate)`; `villain-deck` → `Villain Deck`, following the `hero-deck` label pattern.

---

## Scope (In)

- **A) Config types.** `rules/schemeTwistConfig.types.ts`:
  - resolver union adds `counter-only`;
  - `pile-depleted` adds `villainDeck` and `piles?`;
  - config adds `twistFallbackWithResourceLoss?`.
- **B) Resolver registry.** `rules/schemeTwistResolvers.ts`: the `counter-only` no-op resolver and its registration.
- **C) Config entries.** `rules/schemeTwistConfigs.ts` gets the §Audit entries:
  - 27 A-entries with `lossThreshold: N`;
  - 15 D-pure entries;
  - 25 D-compound entries.

  Every §Audit entry (A, D-pure and D-compound) uses `resolverId: 'counter-only'`.
- **D) Loss rules.**
  - `rules/schemeLossProgress.ts`: fallback threshold, suppression with the compound flag, new kinds, and max-progress selection.
  - `rules/schemeResourceLoss.ts`: the `villainDeck` pile and the `piles` form.
  - `rules/schemeHandlers.ts`: threshold source.
  - `setup/buildInitialGameState.ts`: write `schemeLossVillainDeckSetupSize`, omit-when-absent and only when the condition includes `'villainDeck'`. The fallback twist count is derived at read time and is never captured.
- **E) UIState.** Only the enum widens, so `schemeLossKind` needs no new field. Confirm the filter passes `schemeLossKind` through unchanged.
- **F) Client.** `apps/arena-client/src/vfx/menaceDisplay.ts` gets labels for the two new kinds, plus its test.
- **G) Tests.**
  - An A-scheme loses at its printed N and not before.
  - A D-pure scheme loses on its pile and ignores twists, including a Villain Deck runout beating the final-turn tie.
  - A D-compound scheme loses on either its pile or its last twist.
  - An unconfigured scheme loses at its deck twist count; a scheme with ≤ 6 twists can now lose.
  - The meter kind and progress are correct for each case.
  - Core schemes are unchanged.
  - The canonical-array drift test passes.

## Out of Scope

- **Per-scheme counters** (escaped-villain counts per player, tokens on the scheme or Mastermind, KO-pile counts, carried-away cards, Good Wins). These form a follow-up **WP series**, one family per packet.
- **Twist effects** for any scheme. Midnight Massacre's twist is WP-764.
- The non-standard piles and the Good-Wins set listed as Excluded under §Audit.
- **PAR keys dropping the set prefix** (`apps/server/src/replay/matchCapture.logic.ts:101-105`), which scores co2e/msp1 reprints against core PAR. This is a separate server fix, flagged separately.
- Recomputing past scores, gauntlet config changes, and any server change.

## Files Expected to Change

- `packages/game-engine/src/rules/schemeTwistConfig.types.ts` — modified (resolver union, `SchemeLossPile`, exclusive `pile` / `piles` union, compound flag)
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` (+ test) — modified (`counter-only` no-op)
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` (+ test) — modified (67 §Audit entries)
- `packages/game-engine/src/rules/schemeLossProgress.ts` (+ test) — modified (derived fallback, `selectActiveLossCondition`, exhaustive kind switch, new kinds; test pins updated for the 7 → derived fallback)
- `packages/game-engine/src/rules/schemeResourceLoss.ts` (+ test) — modified (`villainDeck` pile, `piles` form)
- `packages/game-engine/src/rules/schemeHandlers.ts` (+ test) — modified (threshold source; the 7-threshold test pins become the derived value)
- `packages/game-engine/src/types.ts` — modified (`schemeLossVillainDeckSetupSize?`)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified (Villain Deck setup-size capture)
- `packages/game-engine/src/setup/buildInitialGameState.lossPileCapture.test.ts` — modified
- `packages/game-engine/src/ui/uiState.build.progress.test.ts` — modified (value-only: the fallback threshold 7 → the derived deck count; the kind `twists` → `twists-fallback` on unconfigured-scheme fixtures)
- `packages/game-engine/src/ui/uiState.filter.test.ts` — modified (value-only menace tier)
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — modified (precedence test)
- `apps/arena-client/src/vfx/menaceDisplay.ts` (+ `menaceDisplay.test.ts`) — modified (`SCHEME_LOSS_NOUNS` gets both new kinds; this is the only client `Record<SchemeLossKind, …>`)
- Governance: `docs/ai/DECISIONS.md` (D-24595, with the audit table), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is about 15 code and test files. Most of the size is in the configuration table.

## Contract

- The locked config table and kinds above.
- WP-764 consumes `piles: ['heroDeck', 'villainDeck']` for Midnight Massacre. WP-763 already declares that entry with `resolverId: 'counter-only'`; WP-764 swaps in its own resolver id and adds nothing else.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23 / §24 (competitive integrity: ranked legs stop ending on a rule the card doesn't have), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** core schemes are byte-identical. For non-core replays, the rules change is recorded in D-24595.

## Funding Surface Gate

§20 **N/A**: gameplay rules plus a meter label.

## API Catalog

§21 **N/A**: no endpoint and no `apps/server` surface.

---

## Acceptance Criteria

1. **Printed-N schemes.** Each §Audit A scheme reaches Evil Wins at exactly its printed N; for example `vnom/symbiotic-absorption` at 11 and `anni/sneak-attack-the-heroes-homes` at 6. No A scheme reaches it at twist N−1.
2. **D-pure schemes.** A D-pure scheme never loses on twists. It loses when its pile runs out, and a Villain Deck runout ends in a **scheme loss**, not a tie. `mdns/midnight-massacre` loses on Hero Deck or Villain Deck runout and never at twist 7.
3. **D-compound schemes.** A D-compound scheme loses on its pile **or** on its last twist, whichever comes first.
4. **Unconfigured schemes.** An unconfigured scheme loses at its deck twist count (e.g. 10 twists → 10), never at 7 unless its deck holds 7. A ≤ 6-twist unconfigured scheme can now lose.
5. **Danger meter.** `schemeLossKind` is `twists-fallback` for approximate conditions and `villain-deck` for a Villain Deck pile. Compound schemes report the higher-progress condition. The client renders "Twists (approximate)".
6. **Core unchanged.** The 8 core schemes behave byte-identically. The `finalStateHash` and PAR seed oracles are unchanged.
7. **Suites.** `pnpm -r build` exits 0. The engine and arena-client suites pass, the arena-client typecheck exits 0, and `pnpm -r --no-bail test` reports 0 failures. The `SchemeLossKind` drift test passes.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm --filter @legendary-arena/arena-client typecheck` → 0, and `pnpm --filter @legendary-arena/arena-client test` → all pass.
4. `pnpm -r --no-bail test` → 0 fail.
5. `pnpm sim:coverage --check && pnpm sim:runtime-observed:check` → 0.
6. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24595 appended Active. It carries the audit table and the operator decision, and supersedes D-24371 §6 for non-core schemes.
- [ ] STATUS updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-800:` then `SPEC:`).
- [ ] **D-24026 live-verify** (post-merge): a live match on a non-core twist-count scheme (e.g. Symbiotic Absorption) does not end at twist 7, and the danger meter shows the printed threshold. A Midnight Massacre match does not end on twists. Record as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24595 — scheme-evil-wins-audit.** It locks:
- the fallback-to-deck-twist-count rule (the operator decision);
- the `counter-only` resolver;
- the `villainDeck` pile and the multi-pile form;
- the compound flag;
- the two new loss kinds and the max-progress selection;
- the audit table;
- the excluded list;
- supersession of D-24371 §6 for non-core schemes;
- the replay-compat note.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + session protocol.
- **§3:** Assumes verified by the audit subagent (file:line throughout).
- **§4:** decisions and rules cited.
- **§5:** about 15 files, justified.
- **§6:** canonical names.
- **§7:** dependencies WP-508..515, WP-557/558/562 (✅).
- **§8:** layers declared.
- **§9:** pnpm only.
- **§10–11:** N/A.
- **§12:** `node:test`.
- **§13:** exact commands.
- **§14:** 7 binary ACs.
- **§15:** STATUS, DECISIONS, indexes, live-verify.
- **§16:** 00.6.
- **§17:** satisfied.
- **§18–21:** N/A, justified.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, with an observed scaffold).** All anchors verified. The §Audit lists were re-derived by script (27 / 15 / 25, and 10 printed texts spot-checked).

Scaffold: the derived fallback, `counter-only`, the `villainDeck` pile and setup size, both kinds, and 2 entries.
- Engine: **4231 → 4221 pass / 10 fail, with no hash or replay failures**. The failures are 7-threshold and kind pins in `schemeHandlers.test.ts` ×3, `schemeLossProgress.test.ts` ×4, `uiState.build.progress.test.ts` ×3 and `uiState.filter.test.ts` ×1.
- Client: `vue-tsc` breaks only at `menaceDisplay.ts:31`.
- The scaffold was reverted.

Fixes applied:
- **PS-1:** two test files added to the allowlist.
- **PS-2:** the fallback is derived from `villainDeckCardTypes`, with no G field; the constant is renamed.
- **PS-3:** `schemeLossVillainDeckSetupSize?`, omit-when-absent.
- **PS-4:** exclusive `pile` / `piles` union.
- **PS-5:** exhaustive kind switch.
- **PS-6:** a single `selectActiveLossCondition`; `counter-only` is a pure no-op.
- **Lint:** §3 line refs and assumes; §4 ARCHITECTURE; §5 per-file descriptions.

**Scope verdict: READY TO EXECUTE.**

**Copilot (01.7), round 1: RISK → SUSPEND** on #4, #6, #12, #25, #26 and #30. All are resolved by PS-1..6. After the fixes: **RISK (documented)**. Residual risk: non-core replay and score drift, recorded in D-24595.

**Final CONFIRM (independent subagent, round 2).** All PS-1..6 fixes were confirmed. Four text defects were fixed in this revision: the stale capture wording in Scope D, the Locked Values union shape, the `resolverId` scope, and a nonexistent ARCHITECTURE section, plus a line-reference nit. No design change. **CONFIRM.**
