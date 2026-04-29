# EC-118 — UIState Card Display Projection (Execution Checklist)

**Source:** [docs/ai/work-packets/WP-111-uistate-card-display-projection.md](../work-packets/WP-111-uistate-card-display-projection.md)
**Layer:** Game Engine (`packages/game-engine/**`)
**Status:** DRAFT — pre-flight 2026-04-29 PS-1..PS-10 applied to WP-111 + EC-118 in-place; ready for re-verdict per [preflight-wp111-uistate-card-display-projection.md](../invocations/preflight-wp111-uistate-card-display-projection.md) §Authorized Next Step.

> *Slot retargeted from EC-111 to EC-118 (2026-04-28). EC-111 is occupied by `EC-111-replay-storage-loader.checklist.md` (WP-103, retargeted 2026-04-25); EC-117 by `EC-117-public-profile-page.checklist.md` (WP-102, retargeted 2026-04-28). Follows the EC-103 → EC-111 / EC-101 → EC-114 / EC-109 → EC-115 / EC-102 → EC-117 precedent.*

**Execution Authority:** Authoritative execution checklist for WP-111. Implementation must satisfy every clause exactly. If EC and WP conflict on design, **WP-111 wins**. EC-118 is subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.

## Before Starting (STOP / GO Gate)
- [ ] WP-089 / WP-018 / WP-014A / WP-014B / WP-100 / WP-113 merged on `main` (`buildUIState`, `G.cardStats` + `parseCardStatValue`, `G.villainDeckCardTypes`, `G.cardKeywords`, `G.mastermind.baseCardId`, registry wiring).
- [x] WP-111 Q1 RESOLVED — mastermind branch lives in `mastermind.setup.ts:165–245` (NOT `economy.logic.ts`); base-card key = `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}`; source field = `MastermindCard.vAttack`. Recorded in WP-111 §Open Questions Q1.
- [x] WP-111 Q2 RESOLVED — `flattenSet()` emits only `hero | mastermind | villain | scheme`; bystander / scheme-twist / mastermind-strike / wound / officer / sidekick / mastermind tactics deferred (no per-card display data); henchmen require `getSet(...).henchmen[*]` walk (NOT in `FlatCard`).
- [x] WP-111 Q3 RESOLVED — written consumer audit recorded inline in WP-111 §Open Questions Q3. `apps/arena-client/src/components/play/HQRow.vue` + `HQRow.test.ts` are the only `hq.slots` consumers; breaking-change form would require off-allowlist edits; **fallback parallel-array form selected** (`slotDisplay?` added; `slots` UNCHANGED).
- [x] WP-111 Q4 RESOLVED — `imageUrl` empty-string passthrough confirmed acceptable; no type-signature change; no placeholder URL constant.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline `570/126/0` as of 2026-04-29).
- [ ] No parallel session is editing `packages/game-engine/src/{ui,setup,types.ts}/**`.

## Locked Values (do not re-derive)
- `UICardDisplay` shape — exactly four fields: `extId: string`, `name: string`, `imageUrl: string`, `cost: number | null`. No `team` / `class` / `setName` / `cardType` / `attack` / `recruit` / `keywords`.
- `UIHQCard` shape — exactly two fields: `extId: string`, `display: UICardDisplay`.
- **Source-field map** (verbatim, verified 2026-04-29 against `packages/registry/src/{shared,types/index}.ts`, `packages/game-engine/src/economy/economy.logic.ts`, `packages/game-engine/src/mastermind/mastermind.setup.ts`):
  - **Heroes** — read via `registry.listCards()` filtered to `cardType === 'hero'` and matched `setAbbr` / hero-deck slug (mirror `filterHeroCardsByDeckSlug`). `FlatCard.name` → `name`; `FlatCard.imageUrl` → `imageUrl` (hyphens, never underscores); `FlatCard.cost` (`string | number | undefined`) → `parseCostNullable` → `cost`.
  - **Villains** — read via `registry.getSet(setAbbr).villains[i].cards[j]` (mirror `findVillainGroupCards`); matching `FlatCard` (key `{setAbbr}-villain-{groupSlug}-{cardSlug}`) supplies `name` / `imageUrl`; SetData entry supplies `vAttack`. `parseCostNullable(vAttack)` → `cost`.
  - **Henchmen** — read via `registry.getSet(setAbbr).henchmen[i]` only (henchmen are NOT in `FlatCard`; `flattenSet()` does not emit them). Group-level `name` / `imageUrl` / `vAttack` apply to all 10 virtual copies (`henchman-{groupSlug}-00` … `-09`). `parseCostNullable(group.vAttack)` → `cost`.
  - **Mastermind** — base card walked via `registry.getSet(setAbbr).masterminds[i].cards[j]` (mirror `mastermind.setup.ts:findMastermindCards`); matching `FlatCard` (key `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}` — equals `G.mastermind.baseCardId`) supplies `name` / `imageUrl`; SetData entry supplies `vAttack`. `parseCostNullable(vAttack)` → `cost`. Tactic cards NOT projected (UIState exposes counts only).
- **Cost null-check semantics** (PS-4 lock): `parseCostNullable(value: string | number | null | undefined): number | null` is a single-line guard `return value === null || value === undefined ? null : parseCardStatValue(value);` defined at the top of `buildCardDisplayData.ts`. NOT a parallel parser — single conditional around the canonical `parseCardStatValue`. Distinguishes `null/undefined → null` ("no cost") from `0 → 0` ("free").
- `G.cardDisplayData` key: `CardExtId` — same join key as `G.cardStats` and `G.villainDeckCardTypes`. Type signature: `Readonly<Record<CardExtId, UICardDisplay>>` on builder return and `LegendaryGameState.cardDisplayData`.
- **Mastermind display join** (PS-5 lock): projection looks up `gameState.mastermind.baseCardId` (NOT `gameState.mastermind.id`, which is the qualified group id like `"core/dr-doom"`). `UIMastermindState.id` continues to expose the qualified group id only — no new `baseCardId` field surfaced to UI; projection performs the lookup internally.
- **Projection paths — additive only** (PS-6 fallback locked):
  - `UICityCard.display` (additive).
  - `UIHQState.slots: (string | null)[]` UNCHANGED.
  - `UIHQState.slotDisplay?: (UIHQCard | null)[]` added; length matches `slots`; `null` positions align by index.
  - `UIPlayerState.handCards?: string[]` UNCHANGED (already optional).
  - `UIPlayerState.handDisplay?: UICardDisplay[]` added; length matches `handCards` when both present; redacted alongside `handCards` by audience filter.
  - `UIMastermindState.display` (additive); existing `id` / `tacticsRemaining` / `tacticsDefeated` preserved.
- **Card types projected this packet:** `hero`, `villain`, `henchman`, `mastermind` (base card only). Deferred: `bystander`, `scheme-twist`, `mastermind-strike`, `scheme`, `wound`, `officer`, `sidekick`, `mastermind tactic`.
- **Placeholder constant (single source):** `UNKNOWN_DISPLAY_PLACEHOLDER = { extId, name: '<unknown>', imageUrl: '', cost: null }` exported from `uiState.build.ts`. Inline the literal nowhere else. **Pure render fallback — no `G` mutation.**
- **Determinism contract:** identical registry + identical config ⇒ byte-identical `G.cardDisplayData`; `JSON.stringify` round-trips byte-equal; no `Math.random`, no `Date.now`, no I/O introduced anywhere.

## Guardrails
1. **Registry boundary preserved.** No `from '@legendary-arena/registry'` import in any file under `packages/game-engine/src/{moves,rules,ui}/**`. Registry read only from setup-time files (`buildCardDisplayData.ts`, mirroring `buildCardStats.ts`'s pattern).
2. **Presentation vs. gameplay separation.** `G.cardDisplayData` is read only from `uiState.build.ts`. No move / rule / validator may consume `G.cardDisplayData` or `UIState.*.display` for cost / fight-cost / attack / recruit gating — `G.cardStats` remains the gameplay source of truth.
3. **Snapshot immutability.** `G.cardDisplayData` is built once in `Game.setup()` and never mutated thereafter; tests assert structural equality across a sequence of moves.
4. **Privacy symmetry.** Whenever `filterUIStateForAudience` redacts an opponent's `handCards`, the corresponding `handDisplay` MUST be omitted (conditional assignment; do NOT assign `undefined` literally per WP-029 D-2902 `exactOptionalPropertyTypes`). City `display`, HQ `slotDisplay`, and Mastermind `display` are public and never redacted.
5. **Placeholder centralization.** The literal `<unknown>` (and the placeholder shape) appears exactly once — at the `UNKNOWN_DISPLAY_PLACEHOLDER` declaration in `uiState.build.ts`. Grep enforced.
6. **No `.reduce()` for branching logic.** `buildCardDisplayData` walks the registry with explicit `for...of` mirroring `buildCardStats`. No new randomness / clocks / I/O.
7. **Additive type extension only — no breaking changes.** Existing fields preserved on `UICityCard` / `UIHQState` / `UIPlayerState` / `UIMastermindState`; only new fields added. `UIHQState.slots: (string | null)[]` is preserved verbatim per PS-6 fallback (Q3 written audit).
8. **Scope lock — exactly 9 files modified.** If a 10th file appears necessary, STOP and escalate.
9. **Projection-purity contract preserved (PS-8 — WP-028 D-2801).** `buildUIState` MUST NOT mutate `G.messages` or any other `G` field. The diagnostic surface for missing display entries is the **setup-time completeness sweep** in `buildInitialGameState.ts:161–182` (mirroring the four existing builder-guard messages, WP-113 D-10014 pattern). The projection-time `UNKNOWN_DISPLAY_PLACEHOLDER` fallback is a pure render path. Grep enforced (no `messages.push` / `messages =` / `messages[` writes inside `uiState.build.ts`).
10. **Aliasing prevention (PS-8 + WP-028 `cardKeywords` post-mortem precedent).** Every projection-time read of `G.cardDisplayData[extId]` MUST return a fresh shallow copy (`{...G.cardDisplayData[extId]}`) at the projection boundary, not a direct reference. Aliasing test asserts mutating a returned `display` object does not change `G.cardDisplayData[extId]`.
11. **Cost wrapper, not parallel parser (PS-4).** `parseCostNullable` is a single-line guard around the canonical `parseCardStatValue`. The canonical parser remains the only widener-handler for non-null values. No second parser definition.
12. **Single-message setup-time logging.** The setup-time completeness sweep emits at most one consolidated diagnostic per `buildInitialGameState` call (aggregate missing CardExtIds; do not log per-card). Aligned with WP-113 D-10014 single-detection-seam pattern.

## Required `// why:` Comments
- `uiState.types.ts` — on `UIHQState.slotDisplay?` parallel-array design (cite Q3 written audit + PS-6; positional-alignment invariant); on `UIPlayerState.handDisplay?` parallel-array design (backwards-compat; opt-in display); on `UIHQState.slots` retention (preserved verbatim — fallback locked per PS-6).
- `buildCardDisplayData.ts` — on the setup-snapshot pattern (cite WP-014B + WP-018 + WP-025 sibling-snapshot precedent); on `parseCostNullable` wrapper rationale (cite PS-4 — `parseCardStatValue` returns `0` for null/undefined; wrapper preserves UX distinction; NOT a parallel parser); on the runtime guard (cite layer-boundary precedent — mirrors `buildCardStats:170–172`); on the `registry: unknown` choice (cite `buildCardStats` precedent — engine setup files cannot import `CardRegistry` from `@legendary-arena/registry`).
- `buildInitialGameState.ts` — on the sibling-snapshot wiring (placement parallel to `buildCardStats`); on the new `isCardDisplayDataRegistryReader` guard message (mirrors the four existing builder guards); on the setup-time completeness sweep (cite WP-113 D-10014 pattern + PS-8 — diagnostic surface relocation from projection time).
- `types.ts` — on the `Readonly<...>` documentational signal at `LegendaryGameState.cardDisplayData`; sibling-snapshot citation (WP-014B / WP-018 / WP-025).
- `uiState.build.ts` — on the `UNKNOWN_DISPLAY_PLACEHOLDER` pure-render-fallback trade-off (cite WP-028 D-2801 + PS-8 — setup-time diagnostic surface preserves projection purity); on the `handDisplay` length-equals-`handCards` invariant; on the `slotDisplay` length-equals-`slots` invariant; on every spread-copy site (cite WP-028 `cardKeywords` aliasing post-mortem).
- `uiState.filter.ts` — on the privacy-symmetry constraint (leaking display ≡ leaking CardExtId); on the conditional-assignment pattern for `handDisplay` (cite WP-029 D-2902 `exactOptionalPropertyTypes` precedent).

## Files to Produce (9 — locked)
- `packages/game-engine/src/setup/buildCardDisplayData.ts` — **new** — setup-time registry-to-G snapshot builder (mirrors `buildCardStats`); includes `parseCostNullable` wrapper, runtime guard, `for...of` walks for heroes / villains / henchmen / mastermind base card.
- `packages/game-engine/src/setup/buildCardDisplayData.test.ts` — **new** — `node:test` coverage (cost parsing including `0 ≠ null` distinction, henchman 10-copy expansion, mastermind base-card-only, layer-boundary guard, determinism, JSON round-trip, drift sanity).
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — introduce `UICardDisplay` / `UIHQCard`; extend `UICityCard` (add `display`); extend `UIHQState` (add `slotDisplay?`; `slots` UNCHANGED); extend `UIPlayerState` (add `handDisplay?`; `handCards?` UNCHANGED); extend `UIMastermindState` (add `display`).
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — wire builder; add `isCardDisplayDataRegistryReader` guard message at lines 161–182; add setup-time completeness sweep emitting one consolidated diagnostic if any expected extId is missing from `cardDisplayData`.
- `packages/game-engine/src/types.ts` — **modified** — add `cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>` to `LegendaryGameState`.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — surface display through projection (City `display`, HQ `slotDisplay` parallel array, hand `handDisplay`, Mastermind `display` via `baseCardId`); spread-copy at every projection-time read; export `UNKNOWN_DISPLAY_PLACEHOLDER`. **No `G.messages` mutation.**
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — redact `handDisplay` alongside `handCards` via conditional assignment (mirrors existing `handCards` pattern); pass-through City / HQ / Mastermind display fields with shallow copies.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — drift assertions on `UICardDisplay` / `UIHQCard` field sets; `UIHQState` retains `slots` AND has new optional `slotDisplay`; `UIPlayerState` retains `handCards` AND has new optional `handDisplay`.
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — projection completeness, redaction symmetry, determinism, no-placeholder-for-valid-setups, **PS-8 projection-purity test (G.messages unchanged after buildUIState)**, **PS-8 setup-time-diagnostic test**, aliasing prevention test.
- Governance at session close: `STATUS.md` block; `DECISIONS.md` six new D-NNNN entries (sibling-snapshot rationale; `handDisplay` parallel-array; `slotDisplay` parallel-array + Q3 audit cite; `parseCostNullable` cost-null semantics; `UNKNOWN_DISPLAY_PLACEHOLDER` setup-time-diagnostic + projection-purity rationale citing D-2801; deferred-card-types scope); `WORK_INDEX.md` WP-111 `[ ]` → `[x]`; `EC_INDEX.md` EC-118 Draft → Done; `03.1-DATA-SOURCES.md §Setup-Time Derived Data` adds `G.cardDisplayData` row.

## After Completing
- [ ] All WP-111 §Acceptance Criteria + §Verification Steps + §Definition of Done items pass; `pnpm -r build` exits 0; engine build/test green.
- [ ] `Select-String -Path @("packages\game-engine\src\moves","packages\game-engine\src\rules","packages\game-engine\src\ui") -Pattern "@legendary-arena/registry" -Recurse` returns no match (registry boundary).
- [ ] `Select-String -Path "packages\game-engine\src\setup\buildCardDisplayData.ts" -Pattern "@legendary-arena/registry"` returns no match (engine setup file uses local structural reader, mirrors `buildCardStats` precedent).
- [ ] `Select-String -Path @("packages\game-engine\src\moves","packages\game-engine\src\rules","packages\game-engine\src\ui\uiState.filter.ts","packages\game-engine\src\ui\uiState.types.ts") -Pattern "cardDisplayData" -Recurse` returns no match (presentation/gameplay separation: gameplay reads `G.cardStats` only; `uiState.build.ts` is the sole `src/ui/**` consumer of `G.cardDisplayData`).
- [ ] `Select-String -Path "packages\game-engine\src\setup\buildCardDisplayData.ts" -Pattern "Math\.random|Date\.now|\.reduce\("` returns no match.
- [ ] `Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "messages\.push|messages\s*=\s|messages\["` returns no match (**PS-8 projection-purity gate**: `buildUIState` does not mutate `G.messages`; existing `[...gameState.messages]` shallow copy is read-only and excluded by these patterns).
- [ ] `Select-String -Path "packages\game-engine\src" -Pattern "<unknown>" -Recurse` returns exactly one match (the `UNKNOWN_DISPLAY_PLACEHOLDER` constant declaration in `uiState.build.ts`).
- [ ] `Select-String -Path "packages\game-engine\src\ui\uiState.types.ts" -Pattern "slots:\s*\(string\s*\|\s*null\)\[\]"` returns exactly one match (PS-6 fallback: `UIHQState.slots` shape preserved verbatim).
- [ ] `git diff --name-only packages/registry/ apps/server/ apps/arena-client/ apps/registry-viewer/ packages/preplan/` is empty.
- [ ] `git diff --name-only` lists only the 9 files in §Files to Produce.
- [ ] `STATUS.md` `### WP-111 / EC-118 Executed` block; `WORK_INDEX.md` WP-111 row `[x]` with date + Commit A SHA; `EC_INDEX.md` EC-118 row `Done {YYYY-MM-DD}`; `03.1-DATA-SOURCES.md` adds `G.cardDisplayData` row.
- [ ] Commit A prefix `EC-118:` (NOT `EC-111:` — collides with replay-storage EC; NOT `WP-111:` — commit-msg hook rejects per P6-36); Commit B prefix `SPEC:`; Vision trailer `Vision: §1, §2, §3, §10, §11, §22` on Commit A.

## Common Failure Smells
- `UICardDisplay` carries any field beyond the locked four → scope creep, separate WP required.
- Move file / rule hook reads `G.cardDisplayData` or `UIState.*.display` for gating → presentation/gameplay separation violated; gameplay reads `G.cardStats` only.
- `<unknown>` literal appears outside the `UNKNOWN_DISPLAY_PLACEHOLDER` declaration → centralization guardrail violated.
- `UIHQState.slots` widened to `(UIHQCard | null)[]` → PS-6 fallback violated (Q3 audit blocked the breaking change). The locked form is `slots: (string | null)[]` UNCHANGED + `slotDisplay?: (UIHQCard | null)[]` parallel.
- `handDisplay.length !== handCards.length` (or `slotDisplay.length !== slots.length`) on the same projection → length-invariant violated.
- `handCards` redacted but `handDisplay` populated → privacy-symmetry violated.
- `buildUIState` writes to `G.messages` → **PS-8 / D-2801 projection-purity contract violated** (Session Abort Condition; one of the highest-priority guardrails). Diagnostic surface MUST be at setup time, not projection time.
- `parseCardStatValue(card.cost)` called directly with raw registry value (skipping `parseCostNullable`) → null-distinction lost; `0` and `null` collapse to `0`.
- `parseCostNullable` re-implements parsing logic instead of guarding around `parseCardStatValue` → parallel parser introduced (PS-4 / Guardrail #11 violated).
- `FlatCard.vAttack` referenced anywhere → contract drift; `FlatCard` does not carry `vAttack`. Walk `getSet(...)` instead.
- Henchmen sourced from `registry.listCards()` → `flattenSet()` does not emit henchmen; the walk MUST go through `getSet(setAbbr).henchmen[*]`.
- Mastermind display lookup uses `gameState.mastermind.id` (qualified group id) instead of `gameState.mastermind.baseCardId` → ext_id mismatch; `cardDisplayData` is keyed by base-card id.
- Returned `UICardDisplay` object is a direct reference to `G.cardDisplayData[extId]` (not a shallow copy) → aliasing bug; mutating returned object mutates `G`. WP-028 `cardKeywords` post-mortem precedent.
- A 10th file appears in `git diff --name-only` → Session Abort Condition.
