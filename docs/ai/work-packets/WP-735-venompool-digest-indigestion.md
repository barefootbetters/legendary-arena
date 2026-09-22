# WP-735 — Venompool "Digest N / Indigestion" Victory-Pile branch (`digest-indigestion` keyword; Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:** D-21602 (the deferral this closes), WP-021/022/023 (hero-keyword union + parser + executor substrate), WP-675 / D-24490 (`count-scaled-choose` — the `coalesce…`/compound-descriptor vnom precedent), WP-658 / D-24469 (`SUPPORTED_TRANSFORM_BASES` — the per-card allowlist-gated un-hollowing precedent), WP-535 / D-24345 + WP-592 / D-24401 (`copy-powers` / `steal-abilities` — the reentrant `executeHeroEffects` precedent), WP-216 / D-21601 (`[keyword:rescue:N]` marker) + D-24551 (`[keyword:draw:N]` marker)
**Lane:** Standard (two-session). NOT lightweight-lane eligible: adds a new `HeroKeyword`, extends a contract file (`heroAbility.types.ts`), and adds a new mechanic category (a Victory-Pile-count branch) — "any ambiguity resolves against eligibility" (01.0a).

> Baseline: `origin/main` at commit `4827cdd6` + the `SPEC: reserve WP-735 / EC-772 / D-24555` ledger commit (`2bc60679`).

---

## Goal

After this session, `@legendary-arena/game-engine` recognizes a new hero keyword `digest-indigestion`. For the four allowlisted Venomverse cards, playing the card reads the player's Victory-Pile card **count** and runs the printed branch: if the count meets the card's `Digest N` threshold it runs the Digest branch's effects, otherwise it runs the Indigestion branch's effects (mutually exclusive, per the Venomverse rulebook); when the card's trailing `[hc:X]:/[team:X][team:X]: Instead, … both` upgrade condition holds, it runs **both** branches. The Digest / Indigestion / upgrade lines of an allowlisted card are fused at setup time into one hook carrying a compound `digest-indigestion` effect descriptor; the branch effects reuse the shipped `attack` / `recruit` / `draw:N` / `rescue:N` executors via a reentrant dispatch. Cards outside the allowlist keep their honest parse-unrecognized hollows.

---

## User-Visible Impact

In a live match, playing **Digest That Chimichanga** (and its three Core-4 siblings) now resolves its full printed ability instead of a partial one. Today the `+2[icon:attack]` fires ungated and the `Indigestion: "Rescue" a Bystander` clause does nothing (~14 hollow hits per game in a real 2p Venompool match, engine-logged `[blocked] Unhandled effect observed: … "indigestion" … parse-unrecognized`). After this WP: with fewer than 2 cards in the Victory Pile the player rescues a Bystander; with 2+ they get +2 Attack; and a Strength-deck player gets both — the card as printed.

---

## Assumes

- **D-21602 landed** — the `[keyword:Excessive Violence]` / `[keyword:Indigestion]` timing-prefix deferral. Six family rows are documented in the `_deferred` block of `scripts/convert-cards/inputs/hero-ability-markers.json`, but of the four cards this WP resolves ONLY `venompool/digest-that-chimichanga` (idx 1, the Indigestion line) has a `_deferred` row — `carnage/carnivore`, `venom/devouring-drool`, and `venomized-dr-strange/cauldron-of-the-cosmos` are absent from the marker map entirely, and their Digest-line hollows are runtime-observed only. This WP adds **3 net-new** branch-marker apply rows and updates/removes the **single** `_deferred` row it resolves.
- **The hero-keyword substrate exists** — the `HeroKeyword` union + `HERO_KEYWORDS` array (`rules/heroKeywords.ts`, currently 62 entries); the executor's `HANDLED_KEYWORDS` (46), `HERO_EFFECT_HANDLERS` (46), `NO_MAGNITUDE_KEYWORDS` (27), and the computed `MVP_KEYWORDS` union (`hero/heroEffects.execute.ts`); union↔array and handler-map↔`HANDLED_KEYWORDS` bidirectional drift tests.
- **`HeroEffectDescriptor` is the extensible flat descriptor** (`rules/heroAbility.types.ts`) — each keyword adds its own optional fields (e.g. `revealRules?`, `countScaledChoiceOptions?`, `revealCriterion?`); a `digest-indigestion` effect adds `digestThreshold?` / `digestEffects?` / `indigestionEffects?` / `bothCondition?` the same way.
- **The per-card allowlist-gated resolution pattern exists** — `buildHeroAbilityHooks` (`setup/heroAbility.setup.ts` ~line 2867) threads `SUPPORTED_TRANSFORM_BASES` / `TELEPORT_ON_DISCARD_CARDS` / `X_GENE_CARDS` (canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys) into `parseAbilityText` so a mechanic resolves only for allowlisted cards and every other card keeps an honest unresolved marker.
- **The multi-line fusion pattern exists** — `coalesceCountScaledChooseOne(cardEntry.abilities)` (`setup/heroAbility.setup.ts` ~line 2897) joins a card's multi-line "Choose one:" group into one synthetic line **before** the per-line parse, returning a new array (the source `abilities` used for display is untouched). `digest-indigestion` fusion mirrors this.
- **The condition machinery exists** — Step 1a (`[hc:X]` → `{ type:'heroClassMatch', value }`) and Step 1b (`[team:X]` → `{ type:'requiresTeam', value }`) in `parseAbilityText`; `evaluateCondition` (`hero/heroConditions.evaluate.ts`) evaluates both against `playerZones.inPlay` with self-exclusion. The `bothCondition` reuses these verbatim.
- **The reentrant executor exists** — `executeHeroEffects` (`hero/heroEffects.execute.ts` ~line 655) is re-entered from `heroEffectCopyPowers` (~4056) and `heroEffectStealAbilities` (~4239); `executeSingleEffect` (~4878) dispatches one `HeroEffectDescriptor` to `HERO_EFFECT_HANDLERS[keyword]`. The branch dispatch reuses `executeSingleEffect` per branch effect.
- **The Victory-Pile zone exists** — `G.playerZones[playerID].victory` (`state/zones.types.ts` line 51), a `CardExtId[]`; its length is the Digest count. Read directly as `.victory.length` (the `bystandersInVictoryAtLeast` precedent, `heroConditions.evaluate.ts`). No dedicated accessor and none added.
- **The branch-effect markers are already legal** — `[keyword:rescue:N]` (WP-216/D-21601) and `[keyword:draw:N]` (D-24551) are already in `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs` line 105) and already parse to `rescue` / `draw` effects. `[icon:attack]` / `[icon:recruit]` already parse to flat `attack` / `recruit` effects.
- **The marker pipeline exists** — `apply-hero-ability-markers.mjs` reads `inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`; multi-token-per-line is supported (WP-667 / D-24543). `vnom` is non-`co2e`, so it regenerates normally (`co2e` is the only hand-edited set excluded from `cards:check`).
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all green on baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/REFERENCE/00.2-data-requirements.md` — card-data field-name canon (`abilities[]`, `ext_id`, `slug`); marker edits touch only `abilities[i]` text.
- `scripts/convert-cards/inputs/keywords-full.json` — glossary ids **54 (Digest)** and **55 (Indigestion)**: the exact Venomverse semantics. Digest N = "use this ability only if you have at least N cards in your Victory Pile" (a READ-ONLY count, nothing removed, all card types count, once per play). Indigestion = "if you don't have enough cards … use Indigestion instead"; "you cannot choose to use the Indigestion ability instead" when Digest is available (mutual exclusivity). Model these verbatim — do NOT reinterpret.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read `buildHeroAbilityHooks` (~2838), the allowlist threading (~2908-2924: `SUPPORTED_TRANSFORM_BASES` / `TELEPORT_ON_DISCARD_CARDS` / `X_GENE_CARDS`), `coalesceCountScaledChooseOne` (~2897, the fusion precedent), `parseAbilityText` (~646), the `KEYWORD_PATTERN` scan (~124, confirm `[keyword:Digest 2]` — space form — does NOT match it), Step 1a/1b condition building (~780-864), and the count-scaled dedicated-token patterns (`COUNT_SCALED_PATTERN` ~192, `OPTIONAL_KO_REWARD_PATTERN` ~225) as the shape template for a new `DIGEST_PATTERN`.
- `packages/game-engine/src/rules/heroAbility.types.ts` — `HeroEffectDescriptor` (~108-178) and `HeroCondition` (~94-97): add the four `digest-*` optional fields the same way `revealRules?` / `countScaledChoiceOptions?` are added.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `executeHeroEffects` (~655), `runHookEffects` (~578), `executeSingleEffect` (~4878), `heroEffectRescue` (~1425, `effect.magnitude ?? 1`, moves bystanders to `playerZones.victory`), `heroEffectDraw` (~1304), `heroEffectCopyPowers` (~4020) + `heroEffectStealAbilities` (~4200) for the reentrant precedent, and the registration sets `HANDLED_KEYWORDS` (~108), `NO_MAGNITUDE_KEYWORDS` (~377), `MVP_KEYWORDS` (~334), `HERO_EFFECT_HANDLERS` (~4727).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — `evaluateCondition` (~40), `heroClassMatch` (~52) / `requiresTeam` (~73), `bystandersInVictoryAtLeast` (~253) as the `.victory.length` read precedent.
- `docs/ai/DECISIONS.md` — D-21602 (the deferral), D-24490 (`count-scaled-choose`), D-24469 (`SUPPORTED_TRANSFORM_BASES`), D-24345/D-24401 (reentrant copy/steal). D-24555 is reserved in `docs/ai/NUMBER-LEDGER.md` and lands Active in `DECISIONS.md` at execution (not present there at draft time).
- User memory: `reference_hero_ability_marker_curated_map` (markers come from the curated map, not auto-detect), `reference_sim_coverage_baseline_gate_distinct` (a new keyword grows the hook universe → run `sim:coverage --check`, regen the distinct baseline if flagged), `reference_hashed_g_field_dual_repin` (the honest re-pin discipline if a pin unexpectedly shifts).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets, no "show only the changed section."
- ESM only, Node v22+, `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words (Rule 4), a `// why:` on every non-obvious constant / choice (Rule 6), no `.reduce()` in effect application (Rule 7/8), one screen per function (Rule 2), JSDoc on every function.

**Packet-specific:**
- Architecture (`.claude/rules/architecture.md`): moves/effects **never throw** — an out-of-allowlist or malformed digest card safe-skips (leaves an unresolved marker), never throws; the branch read is `G.playerZones[playerID].victory.length` (runtime-only) and is **never persisted**; zones store `CardExtId` strings only.
- **Digest is a READ-ONLY count.** The handler reads `.victory.length` and NEVER removes, reorders, or mutates the Victory Pile. A test MUST assert the Victory Pile is byte-identical before and after the branch read.
- **Mutual exclusivity (faithful to glossary id 55).** With no `bothCondition` met, exactly ONE branch runs: Digest iff `count >= threshold`, else Indigestion. The Indigestion branch MUST NOT run when the threshold is met. A card with no Indigestion line (cauldron) runs nothing below threshold — never a phantom effect.
- **The `both` upgrade runs both branches.** When `bothCondition` is present AND `evaluateCondition` is true, run `digestEffects` then `indigestionEffects` (printed order), regardless of count. A test MUST assert both branches fire under a met upgrade condition.
- **Allowlist-gated (the transform/x-gene precedent).** Resolution fires ONLY for the four `DIGEST_INDIGESTION_CARDS` keys. Every other Digest/Indigestion card (play-to-the-crowd, hungry-for-action, insatiable-hunger, the whole Excessive Violence family) keeps its honest parse-unrecognized hollow — do NOT resolve them.
- **`digest-indigestion` lockstep.** Added to the `HeroKeyword` union AND `HERO_KEYWORDS` (62→63); the handler to `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS` (46→47); AND to `NO_MAGNITUDE_KEYWORDS` (the wrapper carries no top-level magnitude — the branch magnitudes ride the inline `[icon:*]` / `[keyword:draw:N]` / `[keyword:rescue:N]` markers; a missed entry silently drops the effect at the magnitude pre-gate).
- **Fusion consumes the source tokens.** For an allowlisted card, the fused hook is the ONLY hook produced from the Digest/Indigestion/upgrade lines — the `[keyword:Digest N]` and `[keyword:Indigestion]` tokens are consumed (no leftover unresolved marker, no duplicate `attack`/`rescue` hook, no inert conditional hollow from the "both" line).
- **No client change.** The printed `[keyword:Digest N]` / `[keyword:Indigestion]` display tokens stay in the card text and render through the existing `AbilityText.vue` path unchanged; no `UIState` field, no arena-client surface, no pending choice (every Core-4 branch auto-resolves).
- Marker edits touch only `abilities[i]` text — no other card field.

**Session protocol:** if any Digest card's printed branch does not reduce to a shipped `attack`/`recruit`/`draw`/`rescue` effect, STOP and surface it — it belongs in the deferred set, not force-fit.

**Locked contract values:** the four cards + their thresholds and branches are in `## Contract`.

---

## Scope (In)

- New `digest-indigestion` `HeroKeyword` (union + array) — `rules/heroKeywords.ts`.
- Four new optional fields on `HeroEffectDescriptor` — `digestThreshold?: number`, `digestEffects?: HeroEffectDescriptor[]`, `indigestionEffects?: HeroEffectDescriptor[]`, `bothCondition?: HeroCondition` — `rules/heroAbility.types.ts`.
- Setup-time fusion — `setup/heroAbility.setup.ts`: a `DIGEST_PATTERN` (`/\[keyword:Digest (\d+)\]/`, space form) to read the threshold; a `DIGEST_INDIGESTION_CARDS` allowlist (the four canonical keys); a `coalesceDigestIndigestion`-style fusion (mirroring `coalesceCountScaledChooseOne`) that, for an allowlisted card, parses the Digest line's inline effects as `digestEffects`, the Indigestion line's inline effects as `indigestionEffects`, the upgrade line's `[hc:X]`/`[team:X][team:X]` as `bothCondition`, and emits ONE `digest-indigestion` hook — consuming the source tokens.
- New `heroEffectDigestIndigestion` executor + registration in `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` — `hero/heroEffects.execute.ts`. Reads `G.playerZones[playerID].victory.length`, evaluates `bothCondition` via `evaluateCondition`, dispatches the selected branch's effects through `executeSingleEffect`.
- Drift-test updates (keyword count 62→63; handler count 46→47; expected-array + registration) across the four drift test files; branch-behavior tests.
- Card-data markers via the curated map — `inputs/hero-ability-markers.json`: append `[keyword:draw:2]` to `carnage/carnivore` Digest line (idx 0), `[keyword:draw:1]` to `venomized-dr-strange/cauldron-of-the-cosmos` Digest line (idx 0), `[keyword:rescue:1]` to `venompool/digest-that-chimichanga` Indigestion line (idx 1) — **3 net-new apply rows**; and update/remove the **single** existing `_deferred` row (`digest-that-chimichanga` idx 1) this WP resolves. The other three resolved cards were never in `_deferred` — their Digest hollows are runtime-observed and drop from `runtime-observed-hollows.json` on regen (AC #8), not from a `_deferred` edit.
- Regenerated `data/cards/vnom.json` + the derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`); `sim:coverage` baseline only if `sim:coverage --check` flags the new keyword.

## Out of Scope

- **The three harder Digest cards stay deferred (honest hollows):** `vnom/play-to-the-crowd` (Digest branch is a new "Bystanders-in-Victory-Pile per 2" count-source), `vnom/venom-rocket/hungry-for-action` (Digest branch is an optional discard-then-draw), `vnom/venom/insatiable-hunger` (both branches are interactive KO-with-reward picks). Their `[keyword:Digest N]` markers remain unresolved.
- **The entire Excessive Violence family stays deferred** — `[keyword:Excessive Violence]` is a fight-timed, once-per-turn, opt-in-overspend mechanic with a played-this-turn ledger (shared with Carnage/Venom); it is a distinct `onFight` timing window and belongs in its own future WP. This WP adds no `onFight` behavior.
- No pending choice / resolve move / bgio move / `UIState` field / arena-client surface — every Core-4 branch auto-resolves synchronously.
- No new count-source, no new reveal/KO machinery, no change to `AbilityText.vue` or any display token.
- No scoring / PAR / leaderboard / RNG / identity / multiplayer-sync / monetization surface.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `digest-indigestion` in union + array (62→63)
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — four `digest-*` optional descriptor fields
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `DIGEST_PATTERN` + `DIGEST_INDIGESTION_CARDS` allowlist + the fusion pass + `parseAbilityText` threading
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectDigestIndigestion` + registration in `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift (TWO sites: the map-count assertion ~line 105 AND the X-Gene "stays N" assertion ~line 7125 — bump both 46→47) + bidirectional `HANDLED_KEYWORDS` set + branch-behavior tests (threshold-met, threshold-unmet, both-condition, single-branch no-op, Victory-Pile-unchanged, missing-`digestThreshold` safe-skip, fused-hook JSON-roundtrip)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — `HERO_KEYWORDS.length` 62→63 (~line 67) + message text
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — `HERO_KEYWORDS.length` 62→63 (~line 626) + the order-sensitive expected-array parity `deepStrictEqual` (~line 631); do NOT touch the **dynamic** `uniqueKeywords.size === HERO_KEYWORDS.length` self-comparison (~line 656) — it must not be hardcoded to 63
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — `HERO_KEYWORDS.length` 62→63 (~line 1430, the "X-Gene is not a keyword" test) + message text; a fusion/parse test (allowlisted card fuses to one `digest-indigestion` hook; a non-allowlisted digest card stays hollow)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 3 **net-new** branch-marker apply rows (carnivore draw:2, cauldron draw:1, digest-that-chimichanga rescue:1) + update/remove the **single** existing `_deferred` row (`digest-that-chimichanga` idx1); the other three resolved cards were never `_deferred`
- `data/cards/vnom.json` — **modified (regenerated)** — appended branch markers
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **modified (regenerated)**
- (conditional) `scripts/coverage/*coverage-baseline*` — only if `sim:coverage --check` flags the new keyword

(No `finalStateHash` re-pin expected: all four cards are `vnom` (non-core) and no committed sentinel / PRE_WP080 replay plays them; the handler reads existing zone state and adds no new G field. VERIFY empirically; if a pin shifts, dual re-pin honestly per `reference_hashed_g_field_dual_repin` — never edit a pin to force green.)

---

## Contract

- Keyword label `digest-indigestion`; the compound `HeroEffectDescriptor` carries `digestThreshold: number`, `digestEffects: HeroEffectDescriptor[]`, `indigestionEffects?: HeroEffectDescriptor[]` (absent for a single-branch card), `bothCondition?: HeroCondition` (absent when the card has no upgrade line). Top-level `magnitude` unused (in `NO_MAGNITUDE_KEYWORDS`).
- Handler `heroEffectDigestIndigestion(G, ctx, playerID, cardId, effect)`: **safe-skip first** — if `effect.digestThreshold === undefined` or `effect.digestEffects === undefined`, return a no-op (never evaluate `count >= undefined` → `NaN`; use explicit TS narrowing, not a possibly-undefined comparison). Otherwise `count = G.playerZones[playerID].victory.length`; if `effect.bothCondition` present and `evaluateCondition(G, playerID, effect.bothCondition, cardId)` → run `digestEffects` then `indigestionEffects` (printed order); elif `count >= effect.digestThreshold` → run `digestEffects`; else → run `indigestionEffects ?? []`. Each branch effect dispatched via `executeSingleEffect`. Never mutates the Victory Pile; never throws.
- **Both-branch faithfulness (primary source = the printed card).** The upgrade line reads verbatim `[hc:strength]: Instead, you get both.` (`digest-that-chimichanga` idx 2) / `[hc:instinct]: Instead, you get both.` (`devouring-drool` idx 2). "Instead … both" **overrides the Digest threshold gate** — when the class condition holds the player gets both abilities regardless of Victory-Pile count (the standard Legendary "Instead" override; the printed line is the source — there is no separate glossary entry for the per-card upgrade). The branch-select `// why:` MUST cite this printed wording so the "regardless of count" reading is locked to the print, not inferred.
- The four allowlisted cards (`DIGEST_INDIGESTION_CARDS`), with the branch each line reduces to:

| Card key (`{set}/{hero}/{card}`) | Digest N | Digest branch | Indigestion branch | Both-condition |
|---|---|---|---|---|
| `vnom/venompool/digest-that-chimichanga` | 2 | `+2 attack` (`[icon:attack]`, idx 0) | `rescue 1` (`[keyword:rescue:1]`, idx 1) | `[hc:strength]` (idx 2) |
| `vnom/carnage/carnivore` | 4 | `draw 2` (`[keyword:draw:2]`, idx 0) | `+2 recruit` (`[icon:recruit]`, idx 1) | — |
| `vnom/venom/devouring-drool` | 3 | `+2 attack` (`[icon:attack]`, idx 0) | `+2 recruit` (`[icon:recruit]`, idx 1) | `[hc:instinct]` (idx 2) |
| `vnom/venomized-dr-strange/cauldron-of-the-cosmos` | 2 | `draw 1` (`[keyword:draw:1]`, idx 0) | — (no Indigestion line) | — |

- Card marker appends: `carnage/carnivore` idx 0 gains `[keyword:draw:2]`; `venomized-dr-strange/cauldron-of-the-cosmos` idx 0 gains `[keyword:draw:1]`; `venompool/digest-that-chimichanga` idx 1 gains `[keyword:rescue:1]`. The printed `[keyword:Digest N]` / `[keyword:Indigestion]` display tokens are already present (from card conversion) and are NOT re-authored.

---

## Acceptance Criteria

1. `digest-indigestion` is in the `HeroKeyword` union and `HERO_KEYWORDS` (count 62→63, order matched); `heroEffectDigestIndigestion` is in `HERO_EFFECT_HANDLERS` (46→47) + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`; the three numeric `HERO_KEYWORDS.length` assertions + the expected-array parity + both `HERO_EFFECT_HANDLERS` count assertions + the bidirectional handler-set test all pass (and the dynamic `uniqueKeywords.size === HERO_KEYWORDS.length` check stays dynamic).
2. For an allowlisted card, `buildHeroAbilityHooks` produces exactly ONE `digest-indigestion` hook from the Digest/Indigestion/upgrade lines (no leftover `attack`/`rescue`/`draw` hook, no unresolved `Indigestion` marker, no inert conditional hook from the "both" line).
3. `digest-that-chimichanga` with `victory.length >= 2` grants +2 Attack and does NOT rescue; with `< 2` rescues one Bystander and grants no Attack; with `[hc:strength]` satisfied grants +2 Attack AND rescues, regardless of count.
4. `carnivore` (Digest 4 / Indigestion +2 recruit) draws 2 when `victory.length >= 4`, else grants +2 Recruit; `devouring-drool` (Digest 3) mirrors with the `[hc:instinct]` both-branch; `cauldron-of-the-cosmos` (Digest 2, single-branch) draws 1 at `>= 2` and does NOTHING below (no phantom effect).
5. The handler reads `victory.length` and leaves `G.playerZones[playerID].victory` byte-identical (a before/after equality assertion).
6. A non-allowlisted Digest card (e.g. `vnom/play-to-the-crowd`) still produces a parse-unrecognized hollow for its `[keyword:Digest N]` / `[keyword:Indigestion]` — the allowlist gate holds.
7. `data/cards/vnom.json` carries the three appended branch markers (`carnivore` draw:2, `cauldron` draw:1, `digest-that-chimichanga` rescue:1); `apply-hero-ability-markers.mjs` is idempotent (re-run 0 updates).
8. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0; the four cards read `digest-indigestion` / `executable` in the hero mechanic ledger; the resolved cards no longer appear in `runtime-observed-hollows.json` for the digest/indigestion mechanic.
9. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0; `finalStateHash` unchanged (or dual-re-pinned honestly with provenance if it moved).
10. A fused `digest-indigestion` hook survives `JSON.parse(JSON.stringify(hook))` byte-identically — proving the newly self-recursive `digestEffects` / `indigestionEffects` nesting stays plain data (no functions/Maps, acyclic), safe for the JSON-serialized `G.heroAbilityHooks` (D-24095).
11. A `digest-indigestion` effect with `digestThreshold === undefined` (or `digestEffects === undefined`) safe-skips as a no-op — never `count >= undefined` — leaving G unchanged.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass (+ fusion + branch tests).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 3 lines"; re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0.
4. `grep "digest-indigestion" docs/ai/coverage/hero-mechanic-ledger.csv` → the four cards `executable`.
5. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); confirm `finalStateHash` fixtures unchanged (or re-pinned with one-line provenance); revert any `lagn-v1.json` CRLF-only churn.

---

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data / content semantics), §8 / §22 (determinism).

**Conflict assertion:** No conflict — this WP makes an already-shipped card resolve its printed ability faithfully (Venomverse rulebook Digest/Indigestion, glossary ids 54/55). It adds no new content and changes no rule text.

**Non-Goal proximity check:** None of NG-1..7 is crossed — no pay-to-win surface (the branch is determined solely by game state), no cosmetic-for-outcome, no monetization or persuasive surface. The mechanic is available to every player who plays the card.

**Determinism preservation:** The branch is a pure read of `G.playerZones[playerID].victory.length` plus a `for`-loop dispatch of already-parsed effects — `ctx`-free, no `Math.random`, no new persisted state, replay-faithful (Vision §22). No new G field; the sentinel/PRE_WP080 hashes are expected byte-unchanged (all four cards non-core), verified empirically at execution.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1 (structure):** `## Goal`, `## Assumes`, `## Context (Read First)`, `## Scope (In)`, `## Out of Scope`, `## Files Expected to Change`, `## Non-Negotiable Constraints`, `## Acceptance Criteria`, `## Verification Steps`, `## Definition of Done` all present and non-empty; `## Out of Scope` excludes three related Digest cards + the whole Excessive Violence family.
- **§2 (constraints):** Engine-wide block requires full file contents, forbids diffs/snippets, states ESM/Node v22, references `00.6-code-style.md`; packet-specific + session-protocol + locked-values present; no contradiction with the body.
- **§3 (assumes):** every dependency file/state listed with the shape it must have (substrate counts, allowlist pattern, fusion precedent, zone path, marker legality).
- **§4 (context):** specific docs + sections — `00.2` (card data), glossary ids, `DECISIONS.md` entries, ARCHITECTURE via `.claude/rules` cited in constraints; no vague references.
- **§5 (files):** every file marked new/modified with a one-line change; bounded to the engine + card-data allowlist; no ambiguous output language.
- **§6 (naming):** `ext_id` / `abilities[]` / canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys match `00.2`; no setup-payload fields touched.
- **§7 (dependencies):** no new npm dependency; `node:test` only.
- **§8 (boundaries):** Game Engine + Card Data only; no server/DB/client/RNG; effects never throw; `G` stays JSON-serializable (the descriptor fields are plain data); no boardgame.io import in pure helpers.
- **§9 (Windows):** commands are `pnpm` / `node`; no bash-only assumptions.
- **§10 (env):** N/A — no environment variables introduced.
- **§11 (auth):** N/A — no authentication surface.
- **§12 (tests):** `node:test` + `node:assert`; no boardgame.io import; no network/DB; deterministic.
- **§13 (verification):** exact `pnpm` commands with expected output.
- **§14 (acceptance):** 9 binary, observable, file/function-specific criteria aligned to scope.
- **§15 (DoD):** STATUS.md / DECISIONS.md / WORK_INDEX.md updates + scope-boundary check present; `**User-Visible Surface:** play.legendary-arena.com` + `## User-Visible Impact` present; live-on-surface (D-24026) item present.
- **§16 (code style):** the fusion helper and handler are single-purpose, JSDoc'd, `// why:`-commented, no abbreviations, no `.reduce()` in effect application, no premature abstraction (the fusion follows the `coalesceCountScaledChooseOne` precedent, not a new one-off).
- **§17 (vision):** triggered (card semantics + determinism) — `## Vision Alignment` present with clause numbers + determinism line.
- **§18 (prose-vs-grep):** the only grep Verification Step targets `digest-indigestion` (a permitted new token), not a forbidden token; no forbidden-token prose.
- **§19 (bridge staleness):** N/A — no repo-state-summarizing artifact; baseline SHA cited.
- **§20 (funding):** N/A — no funding surface, no user-visible funding copy, no funding channel referenced (engine + card-data behavior only).
- **§21 (API catalog):** N/A — no HTTP endpoint and no `apps/server/src/**` library function added or modified.

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

Run as an independent gate subagent against live code on this branch (synced to `origin/main`). All twelve mechanic-level claims verified TRUE against source: `HERO_KEYWORDS` = 62 / `HERO_EFFECT_HANDLERS` = 46 with the exact drift sites (`heroKeywords.test.ts:67`, `rules/heroAbility.setup.test.ts:626` + parity `:631` + dynamic `:656`, `setup/heroAbility.setup.test.ts:1430`, `heroEffects.execute.test.ts:105` + `:7125`); `HeroEffectDescriptor` is the extensible flat contract; the `SUPPORTED_TRANSFORM_BASES`/`X_GENE_CARDS` allowlist threading (`setup/heroAbility.setup.ts:2908-2924`) and the non-mutating `coalesceCountScaledChooseOne` (`:2250`/`:2897`, returns a new array) are exactly as claimed; `KEYWORD_PATTERN` (`:124`) cannot match the `[keyword:Digest 2]` space form; `executeHeroEffects` is reentrant (`:655`, re-entered by copy-powers/steal-abilities); `heroEffectRescue` grows the same `playerZones.victory` pile Digest reads (count read-once → no ordering subtlety); `G.playerZones[pid].victory.length` is the count path; `[keyword:rescue:N]`/`[keyword:draw:N]` already in `VALID_TOKEN_PATTERN`; all four Core-4 ability arrays match the Contract table exactly; and the drift/registration site list is COMPLETE (feeds auto-derive from `HERO_KEYWORDS`; no hardcoded keyword list missed) — the WP-731 PS-1 site-class (`setup/heroAbility.setup.test.ts`) is already in the allowlist.

**PS-1 (blocking, FIXED):** the WP/EC claimed all four resolved cards had `_deferred` rows to update — false. Only `venompool/digest-that-chimichanga` idx1 is in `_deferred`; `carnivore`/`devouring-drool`/`cauldron-of-the-cosmos` are absent from the marker map (their Digest hollows are runtime-observed only), so those are net-new apply rows. Corrected across WP §Assumes / §Scope / §Files (both bullets) / AC#1 and EC Before-Starting / Files-to-Produce — scope-lock now consistent.

**PS-2 (blocking, FIXED):** a residual stale copy of the PS-1 premise survived in WP §Files (the `hero-ability-markers.json` bullet). Corrected to match §Scope + EC.

**RS-1 (addressed):** the fusion must receive the canonical `{setAbbr}/{heroSlug}/{cardSlug}` key (thread it like `SUPPORTED_TRANSFORM_BASES`, or run inside `buildHeroAbilityHooks`), not the count-scaled coalescer's bare-`abilities` signature; keep it non-mutating. Added as an EC guardrail.

**RS-2 (addressed):** there are **three** numeric `HERO_KEYWORDS.length` sites + the order-sensitive expected-array parity (`:631`) — the dynamic `uniqueKeywords.size === HERO_KEYWORDS.length` (`:656`) must stay dynamic. Corrected in AC#1, WP §Files, EC Lockstep + Files-to-Produce.

**Verdict: READY TO EXECUTE** (after the PS-1/PS-2 scope-lock corrections).

## Copilot (01.7)

Run as an independent gate subagent (30-mode audit) against the WP + EC + pre-flight report. First pass returned **RISK / HOLD** on three scope-neutral early locks (modes 5 / 19 / 26), all fixed in-place:

- **#5 (safe-skip):** `digestThreshold?` is type-optional but semantically required; the handler now safe-skips (no-op) when `digestThreshold`/`digestEffects` is `undefined` rather than evaluating `count >= undefined` (→ `NaN` → a silent wrong-branch). Locked in the Contract, an EC guardrail, a Required `// why:`, and AC #11 + a test.
- **#19 (JSON-roundtrip):** `digestEffects`/`indigestionEffects` make `HeroEffectDescriptor` self-recursive for the first time, and the fused hook lives in the JSON-serialized `G.heroAbilityHooks` (D-24095) — AC #10 + an EC guardrail + a test now assert a fused hook survives `JSON.parse(JSON.stringify(hook))` byte-identically (plain data, acyclic).
- **#26 (both-branch faithfulness):** the "both runs regardless of count" reading is now anchored to the verbatim printed upgrade line (`Instead, you get both.`) as the primary source, in the Contract, the EC Both-upgrade guardrail, and the branch-select `// why:` — not inferred.

**Re-run verdict: PASS** (CONFIRM). All 30 modes resolve to PASS; the three HOLD items closed by construction. The earlier PASS findings (exhaustive drift-site map, airtight allowlist gate, read-only VP invariant, determinism / no-re-pin) intact. Session-prompt + commit authorized.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only (+ regenerated data/feeds).
- [ ] `docs/ai/STATUS.md` updated with what changed; D-24555 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Digest That Chimichanga with < 2 Victory-Pile cards rescues a Bystander, with 2+ grants +2 Attack, and (Strength deck) does both — verified against the deployed `/api/version` gitSha. Inherently post-deploy; recorded as a follow-up STATUS-flip, not a merge blocker.
