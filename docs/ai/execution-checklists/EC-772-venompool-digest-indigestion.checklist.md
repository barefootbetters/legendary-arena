# EC-772 — Venompool "Digest N / Indigestion" Victory-Pile branch (Execution Checklist)

**Source:** docs/ai/work-packets/WP-735-venompool-digest-indigestion.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `4827cdd6` (or later, incl. the WP-735 reserve commit `2bc60679`); working tree clean, synced.
- [ ] D-21602 landed (Digest/Indigestion + Excessive Violence timing-prefix deferral; 6 rows in `hero-ability-markers.json` `_deferred`, of which only `venompool/digest-that-chimichanga` idx1 is among the four this WP resolves — `carnage/carnivore` / `venom/devouring-drool` / `venomized-dr-strange/cauldron-of-the-cosmos` are ABSENT from the marker map, their Digest hollows runtime-observed only).
- [ ] Hero substrate: `HeroKeyword` union + `HERO_KEYWORDS` (62); `HANDLED_KEYWORDS` (46) + `HERO_EFFECT_HANDLERS` (46) + `NO_MAGNITUDE_KEYWORDS` (27) + computed `MVP_KEYWORDS`; bidirectional drift tests.
- [ ] `HeroEffectDescriptor` extensible flat type (`rules/heroAbility.types.ts`); `HeroCondition` `{ type, value }`.
- [ ] Allowlist-gated resolution precedent in `buildHeroAbilityHooks` (`SUPPORTED_TRANSFORM_BASES` / `TELEPORT_ON_DISCARD_CARDS` / `X_GENE_CARDS`, ~2908-2924) + the `coalesceCountScaledChooseOne` line-fusion (~2897).
- [ ] Reentrant `executeHeroEffects` (~655) re-entered by `heroEffectCopyPowers` / `heroEffectStealAbilities`; `executeSingleEffect` (~4878) dispatches one descriptor.
- [ ] Victory-Pile zone `G.playerZones[playerID].victory` (`state/zones.types.ts:51`); count = `.victory.length` (`bystandersInVictoryAtLeast` precedent).
- [ ] `[keyword:rescue:N]` + `[keyword:draw:N]` already in `VALID_TOKEN_PATTERN` (no apply-script change) and already parse to rescue/draw; `[icon:attack]`/`[icon:recruit]` → flat attack/recruit.
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/vnom.json` and feeds). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New keyword: `'digest-indigestion'` (single wrapper, NO top-level magnitude → in `NO_MAGNITUDE_KEYWORDS`).
- Descriptor fields: `digestThreshold: number`, `digestEffects: HeroEffectDescriptor[]`, `indigestionEffects?: HeroEffectDescriptor[]`, `bothCondition?: HeroCondition`.
- Allowlist `DIGEST_INDIGESTION_CARDS` (canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys) — exactly these four:
  - `vnom/venompool/digest-that-chimichanga` — Digest **2** → +2 attack (idx0); Indigestion → rescue 1 (idx1); both = `[hc:strength]` (idx2).
  - `vnom/carnage/carnivore` — Digest **4** → draw 2 (idx0); Indigestion → +2 recruit (idx1); no both.
  - `vnom/venom/devouring-drool` — Digest **3** → +2 attack (idx0); Indigestion → +2 recruit (idx1); both = `[hc:instinct]` (idx2).
  - `vnom/venomized-dr-strange/cauldron-of-the-cosmos` — Digest **2** → draw 1 (idx0); no Indigestion; no both.
- `DIGEST_PATTERN = /\[keyword:Digest (\d+)\]/` (space form; captures threshold; the printed display token stays as-is, not re-authored).
- Branch markers to APPEND via the curated map: `carnage/carnivore` idx0 `[keyword:draw:2]`; `venomized-dr-strange/cauldron-of-the-cosmos` idx0 `[keyword:draw:1]`; `venompool/digest-that-chimichanga` idx1 `[keyword:rescue:1]`.
- Drift counts: `HERO_KEYWORDS` 62→**63**; `HERO_EFFECT_HANDLERS` 46→**47** — READ the current baseline count at execution (concurrent WPs move it; do NOT trust a number written here).

## Guardrails
- **Digest = READ-ONLY count.** Handler reads `.victory.length`; NEVER removes/reorders/mutates the Victory Pile. Assert the pile is byte-identical before/after.
- **Mutual exclusivity (glossary id 55).** No both-condition met → exactly ONE branch: Digest iff `count >= threshold`, else Indigestion. Indigestion MUST NOT fire when the threshold is met. Single-branch card (cauldron) below threshold → NOTHING (no phantom effect).
- **Both-upgrade (faithful to the print).** `bothCondition` present AND `evaluateCondition` true → run `digestEffects` then `indigestionEffects` (printed order), **regardless of count** — the printed `Instead, you get both.` OVERRIDES the Digest threshold gate (standard Legendary "Instead" override; the printed upgrade line is the primary source). The branch-select `// why:` cites this verbatim wording. Test it fires both below threshold.
- **Safe-skip a malformed effect.** If `digestThreshold === undefined` or `digestEffects === undefined`, the handler returns a no-op — NEVER `count >= undefined` (→ `NaN` → silently runs Indigestion). Explicit TS narrowing, not a possibly-undefined comparison. Test the safe-skip.
- **First self-recursive descriptor.** `digestEffects`/`indigestionEffects` nest `HeroEffectDescriptor[]` inside `HeroEffectDescriptor` for the first time. The fused hook lives in the JSON-serialized `G.heroAbilityHooks` (D-24095), so it MUST stay plain data (no functions/Maps, acyclic). Assert a fused hook survives `JSON.parse(JSON.stringify(hook))` byte-identically.
- **Allowlist-gated.** Resolve ONLY the four keys. play-to-the-crowd / hungry-for-action / insatiable-hunger / the whole Excessive Violence family stay parse-unrecognized hollows — do NOT resolve. Test a non-allowlisted digest card stays hollow.
- **Fusion consumes source tokens.** The fused hook is the ONLY hook from the Digest/Indigestion/upgrade lines — no leftover `[keyword:Indigestion]` unresolved marker, no duplicate attack/rescue/draw hook, no inert conditional hook from the "both" line. The card's display `abilities[]` (used elsewhere) is NOT mutated by the coalescer.
- **Lockstep.** `'digest-indigestion'` in union AND `HERO_KEYWORDS`; handler in `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`; AND in `NO_MAGNITUDE_KEYWORDS` (a missed entry drops the effect at the magnitude pre-gate). Bump the **three** numeric `HERO_KEYWORDS.length==62` sites (`rules/heroKeywords.test.ts` ~67, `rules/heroAbility.setup.test.ts` ~626, `setup/heroAbility.setup.test.ts` ~1430) + the order-sensitive expected-array parity `deepStrictEqual` (`rules/heroAbility.setup.test.ts` ~631) + both `=== 46` handler-count sites (`hero/heroEffects.execute.test.ts` ~105, ~7125). Do NOT hardcode the **dynamic** `uniqueKeywords.size === HERO_KEYWORDS.length` self-comparison (`rules/heroAbility.setup.test.ts` ~656) — it self-adjusts. Update the stale it()-title / message text at each bumped site, not just the number.
- **Fusion needs the card key.** `coalesceDigestIndigestion` (or the fusion pass) MUST receive the canonical `{setAbbr}/{heroSlug}/{cardSlug}` key — allowlist-gate it either by threading the key like `SUPPORTED_TRANSFORM_BASES` (~2908-2924) or by running the fusion inside `buildHeroAbilityHooks` where the key is already computed. Do NOT copy `coalesceCountScaledChooseOne`'s bare-`abilities` signature verbatim (it has no card key). Keep the coalescer non-mutating (return a new array; leave the display `abilities[]` untouched).
- Effects never throw; a malformed/out-of-allowlist digest card safe-skips (unresolved marker). No `.reduce()` in the branch dispatch (use `for...of`).
- **No client change** — printed `[keyword:Digest N]`/`[keyword:Indigestion]` tokens stay, render via `AbilityText.vue` unchanged; no `UIState` field, no pending choice, no arena-client surface.
- Marker edits touch only `abilities[i]`. After the card-data change REGEN + commit all four derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF churn.
- **Coverage cascade:** new keyword grows the hook universe → run `sim:coverage --check`; regen the baseline with `--update-baseline` ONLY if it flags this keyword (distinct baseline, per `reference_sim_coverage_baseline_gate_distinct`). Never re-baseline to hide an unrelated shift.
- **Determinism:** all four cards `vnom` (non-core), no committed sentinel/PRE_WP080 replay plays them, no new G field → `finalStateHash` expected unchanged. If a pin moves, investigate WHY, then dual re-pin HONESTLY (record-game-fixture sentinel + PRE_WP080_HASH, per `reference_hashed_g_field_dual_repin`) — never hand-edit a pin to force green.

## Required `// why:` Comments
- `heroKeywords.ts` entry: D-24555 — the Victory-Pile Digest/Indigestion branch (Venomverse; glossary ids 54/55).
- `heroAbility.types.ts` `digest*` fields: D-24555 — compound branch descriptor; threshold + both branch effect-lists + optional upgrade condition.
- `DIGEST_INDIGESTION_CARDS` allowlist: D-24555 — resolve only these four; every other digest card keeps an honest unresolved marker (the transform/x-gene precedent).
- `DIGEST_PATTERN`: the printed `[keyword:Digest N]` space-form token `KEYWORD_PATTERN` cannot match; dedicated pattern reads the threshold, display token unchanged.
- `heroEffectDigestIndigestion` branch select: D-24555 — Digest is a read-only VP-count threshold; Indigestion is the mutually-exclusive fallback (glossary id 55); the printed `Instead, you get both.` overrides the gate → both branches run regardless of count.
- `heroEffectDigestIndigestion` safe-skip: a `digest-indigestion` effect without `digestThreshold`/`digestEffects` is malformed → no-op; never `count >= undefined`.
- `NO_MAGNITUDE_KEYWORDS` inclusion: the wrapper carries no magnitude — branch magnitudes ride the inline markers; a missed entry drops it at the pre-gate.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array (63)
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — four `digest-*` descriptor fields
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `DIGEST_PATTERN` + `DIGEST_INDIGESTION_CARDS` + fusion pass + `parseAbilityText` threading
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectDigestIndigestion` + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift (TWO sites: ~line 105 map-count AND ~line 7125 X-Gene "stays N") + bidirectional set + branch tests (threshold-met/unmet, both below threshold, single-branch no-op, VP-unchanged, missing-`digestThreshold` safe-skip, fused-hook JSON-roundtrip)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — count 62→63 + message
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — count 62→63 (~626) + expected-array parity (~631); leave the dynamic `uniqueKeywords.size === HERO_KEYWORDS.length` (~656) untouched
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — count 62→63 (~line 1430) + message + a fusion test (allowlisted → one hook; non-allowlisted → hollow)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 3 **net-new** branch-marker apply rows (carnivore draw:2, cauldron draw:1, digest-that-chimichanga rescue:1) + update/remove the **single** existing `_deferred` row (`digest-that-chimichanga` idx1); the other 3 resolved cards were never `_deferred`
- `data/cards/vnom.json` — **modified (regenerated)** — appended branch markers
- derived feeds for `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**
- (conditional) `sim:coverage` baseline — only if `sim:coverage --check` flags the new keyword

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (+ fusion + branch tests)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` all 0
- [ ] `grep "digest-indigestion" docs/ai/coverage/hero-mechanic-ledger.csv` → the four cards `executable`; resolved cards drop from `runtime-observed-hollows.json`
- [ ] `finalStateHash` fixtures unchanged (or dual-re-pinned honestly with provenance)
- [ ] Live-on-surface verification (D-24026, surface = `play.legendary-arena.com`): a live match — Digest That Chimichanga rescues below 2 VP-cards, +2 Attack at 2+, both on a Strength deck — post-deploy STATUS-flip
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24555 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-735 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- Indigestion fires even at/above threshold → the branch select ran both arms; it must be exclusive unless `bothCondition` is met.
- `+2 attack` fires with no threshold check → the fusion did not consume the Digest line; the old ungated `[icon:attack]` hook is still emitted alongside the fused hook.
- `[keyword:Indigestion]` still logs a parse-unrecognized hollow → the fusion didn't consume the token (allowlist not threaded, or the second line not folded).
- A non-allowlisted digest card resolved → the allowlist gate is missing; only the four keys resolve.
- cauldron grants a phantom effect below threshold → single-branch cards must run NOTHING below threshold (no `indigestionEffects`).
- Victory Pile shrank/reordered after play → the handler mutated `.victory` instead of only reading `.length`.
- A count-assertion message reads stale (e.g. `heroKeywords.test.ts:67` "…after WP-731 no-more-draws (62)") → update the message text alongside the count bump, not just the number.
- Drift test red → keyword in union not array (or vice versa), handler count mismatch, or a missed `NO_MAGNITUDE_KEYWORDS` entry (the effect then silently drops).
- `sim:coverage --check` red → the new keyword grew the hook universe; regen the baseline (only if it flags this keyword) — do NOT re-baseline to hide an unrelated shift.
- `finalStateHash` re-pin needed unexpectedly → investigate (a fixture that plays a Core-4 card?); dual re-pin honestly, never edit a pin to force green.
