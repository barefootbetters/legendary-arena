# WP-607 — Deck Probability Panel MVP (Phase-1 Card Counter)

**Status:** Ready
**Primary Layer:** App — `apps/arena-client` (play-surface UI). No engine change.
**Dependencies:** WP-606 / D-24417 (the `UIState` draw-pool composition projection — `UIPlayerState.deckComposition?` owner-only + `UIDecksState.villainDeckComposition?` public), WP-128 (the `UIState` board projection + audience filter), WP-228 (the fixed-position overlay idiom mounted once in `PlayViewport.vue`)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `07e2204c` (SPEC: reserve WP-607 / EC-642 / D-24418, #1650).

---

## Session Context

WP-606 shipped two `UIState` fields the client can already read (they flow
through the `@legendary-arena/game-engine` barrel with no re-declaration):
`UIPlayerState.deckComposition?` (the viewer's own order-stripped draw-deck
multiset, owner-only) and `UIDecksState.villainDeckComposition?` (the villain
deck's order-stripped undrawn multiset, public). **No client surface consumes
them yet** — they are dark data.

This packet lands the **Phase-1 MVP** of the
[Deck Probability Panel](../../../wiki/deck-probability-panel.md), per the
ewiki page's MVP-first phasing: **the plain card counter.** The star is the
shared **villain-deck** upcoming-risk breakdown — *how many Master Strikes,
Scheme Twists, and Bystanders are still out there, and the odds the next
reveal is one* — the "Clue detective notepad" for the villain deck. The
viewer's own draw-pool count/tally rides along. Later phases (hand
projection with Monte Carlo, pace/outlook, deck health) are follow-on WPs and
are **out of scope** here.

---

## Goal

After this session, a new collapsible `DeckProbabilityPanel.vue` is mounted
once in `PlayViewport.vue` (the fixed-position overlay idiom, mirroring
`HollowEffectsPanel.vue`), self-hiding when its data is absent. For the
viewing player it renders, from the WP-606 projection:

- **Villain deck — upcoming risk (primary).** `decks.villainDeckComposition`
  categorized **client-side by ext_id prefix** into the five `RevealedCardType`
  buckets — `master-strike-*` → Master Strike, `scheme-twist-*` → Scheme
  Twist, `bystander-villain-deck-*` → Bystander, `henchman-*` → Henchman, else
  Villain — each shown as **remaining count** and its **next-draw odds**
  (`count / villainDeckSize`).
- **Your draw pool (secondary).** The viewer's own `deckComposition` as a
  **count** (cards remaining to draw) plus a best-effort by-name tally
  (names resolved from the display already in the viewer's own snapshot;
  un-resolvable ext_ids grouped as "Unknown" — a documented MVP limit).

All computation lives in a pure, unit-tested `deckProbability.ts`. The panel
is **client-side advisory** — it computes only from the `UIState` projection,
never from `ctx.random`, and never feeds gameplay (D-24418, extending
D-24417).

---

## User-Visible Impact

A collapsible panel appears on the play surface. Collapsed, it is a small
toggle; expanded, it shows the villain deck's remaining make-up — e.g.
**"Master Strike: 2 left (14%) · Scheme Twist: 3 left (21%) · Bystander:
1 left (7%) · Villains: 8 left"** — and the viewer's own "cards left to draw"
count. It answers, at a glance, *what's likely coming out of the villain
deck next* and *how thin is my deck getting* — turning counts the player
would otherwise track in their head into a readout. No gameplay changes; it
is a read-only aid the player can collapse or ignore.

---

## Assumes

- WP-606 / D-24417 complete on `main`: `UIState.players[i].deckComposition?`
  (owner-only, redacted for non-owners — present exactly when `handCards` is)
  and `UIState.decks.villainDeckComposition?` (public) are populated, both the
  order-stripped sorted multiset. Both reach the client typed via the engine
  barrel (`packages/game-engine/src/index.ts` re-exports `UIPlayerState` /
  `UIDecksState`); `apps/arena-client` imports `UIState` types from
  `@legendary-arena/game-engine`, never re-declares them.
- The client reads the audience-filtered snapshot from the Pinia store
  `useUiStateStore` (`apps/arena-client/src/stores/uiState.ts`, `snapshot:
  UIState | null`), via `storeToRefs`.
- The viewer's own player is `players.find(p => p.handCards !== undefined)`
  (the redaction marker; `deckComposition` is redacted identically, so the
  same selector picks whose `deckComposition` is readable).
- The villain-deck synthetic ext_id grammar is stable
  (`packages/game-engine/src/villainDeck/villainDeck.setup.ts`): Master Strikes
  `master-strike-NN`, Scheme Twists `scheme-twist-{slug}-NN`, Bystanders
  `bystander-villain-deck-NN`, Henchmen `henchman-{group}-NN`, Villains
  `{set}-villain-{group}-{card}-NN`.
- `PlayViewport.vue` mounts fixed-position overlays once for both surfaces
  (the `DiagnosticExportButton` / `HollowEffectsPanel` idiom).
- `pnpm -r build` 0; arena-client `typecheck` (vue-tsc) + `test` green on
  `07e2204c`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/components/play/HollowEffectsPanel.vue` +
  `HollowEffectsPanel.test.ts` — the closest analog: a self-hiding (`v-if`),
  store-reading, fixed-position presentational overlay + its `node:test` /
  `@vue/test-utils` / jsdom / Pinia test. Mirror both.
- `apps/arena-client/src/components/play/YourDeckDiscardZone.vue` — the local
  `const isExpanded = ref(false)` collapse-toggle idiom to reuse.
- `apps/arena-client/src/pages/PlayViewport.vue` — the overlay mount block
  (`<DiagnosticExportButton/>` / `<HollowEffectsPanel/>` …) + the
  `components:` registration object. `<DeckProbabilityPanel/>` joins both.
- `apps/arena-client/src/components/play/woundIdentity.ts` — the colocated
  pure-helper precedent; `deckProbability.ts` lives beside the component.
- `packages/game-engine/src/villainDeck/villainDeck.types.ts` — the
  `RevealedCardType` union (`villain | henchman | bystander | scheme-twist |
  mastermind-strike`) the categorizer maps to.
- `packages/game-engine/src/ui/uiState.types.ts` — `deckComposition?` (line
  ~407) + `villainDeckComposition?` (line ~582) contracts (WP-606 / D-24417),
  and `UICardDisplay` (the 6-field locked display, no `cardType`).
- `wiki/deck-probability-panel.md` — the design + MVP phasing (Phase 1 = this).
- `.claude/rules/architecture.md` §Layer Boundary → Import Rules (the
  `apps/arena-client` row): the panel may import the runtime-safe engine
  surface, but this presentational component imports engine **types only**.
- `docs/ai/DECISIONS.md` — D-24417 (the projection this consumes); land the
  reserved D-24418 at execution.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+, `node:` prefix on built-ins, `.test.ts` tests. Full
  file contents for every new or modified file — no diffs, no snippets.
- No `boardgame.io`, no `@legendary-arena/game-engine` **runtime** import
  (type-only `import type` allowed), no engine/`G`/`ctx`/`ctx.random` touch,
  no store/game-state write.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-sentence
  errors, no abbreviations, `// why:` where non-obvious, no branching `.reduce()`).

**Packet-specific:**
- **Client-side advisory only.** All math is in `deckProbability.ts`,
  computed from the `UIState` projection; **never** `ctx.random`, never any
  engine/`boardgame.io`/registry runtime import, never a write back to game
  state. Read-only.
- **No engine, no `G`, no move, no projection change.** The two fields exist
  (WP-606); this WP only *renders* them. If the panel seems to need a new
  field (e.g. own-deck display names, face-up-top marker), that is a
  follow-on WP — do NOT edit engine code here.
- **Categorize by ext_id prefix, villain last.** `master-strike-` →
  `mastermind-strike`; `scheme-twist-` → `scheme-twist`;
  `bystander-villain-deck-` → `bystander`; `henchman-` → `henchman`; else →
  `villain` (the fallback). Order the checks so `villain` is last. The
  synthetic grammar's source of truth is
  `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — the categorizer
  `// why:` cites it so a future grammar edit is traceable to this consumer
  (the constants are not exported, so the test pins hand-written ext_ids).
- **Killbots caveat is documented, not fixed.** The Killbots scheme rewrites
  some `bystander-villain-deck-*` cards to *type* `villain` at setup
  (`G.convertedOrigins`, not projected), so a prefix reader miscounts those
  as Bystanders. This is an accepted, documented Phase-1 limitation
  (Killbots-only) — the fix (an engine type-projection) is a follow-on.
- **Own-player select via the redaction marker.** Read `deckComposition`
  from `players.find(p => p.handCards !== undefined)`; render the own-deck
  section only when that player and its `deckComposition` are present.
- **Self-hide, don't crash.** Both fields are optional; the panel renders
  nothing (or a graceful empty state) when a field is absent — no throw on
  `undefined`.
- **`AbilityText`/marker discipline** does not apply (the panel shows counts
  + resolved names, no `gameText`/`abilityText`).

**Session protocol:** if a field name, store shape, own-player selector, or
villain-deck ext_id grammar is unclear, STOP and read the cited file — never
guess or invent a field.

**Locked values (do not re-derive):**
- Component: `DeckProbabilityPanel.vue` in `components/play/`, mounted once in
  `PlayViewport.vue`.
- Pure helper: `deckProbability.ts` (colocated). Exports at least:
  `categorizeVillainCard(extId): RevealedCardType`,
  `summarizeVillainDeck(composition: string[]): Record<RevealedCardType, number>`
  (+ total), `nextDrawOdds(count: number, deckSize: number): number`
  (`deckSize === 0 → 0`), and `atLeastOneInNextN(count, deckSize, n): number`
  (hypergeometric `1 − C(deckSize−count, n) / C(deckSize, n)`, guarded).
- Prefix map: as in the categorize constraint above.

---

## Scope (In)

### A) `deckProbability.ts` (`apps/arena-client/src/components/play/deckProbability.ts`, **new**)
- Pure, no imports from engine runtime / `boardgame.io` / registry (types-only
  `import type { RevealedCardType }` from the engine barrel is fine).
- `categorizeVillainCard(extId)` — prefix match, villain fallback last.
- `summarizeVillainDeck(composition)` — count per `RevealedCardType` + total,
  using a `for...of` loop (no `.reduce()` with branching).
- `nextDrawOdds(count, deckSize)` — `count / deckSize`; `0` when `deckSize === 0`.
- `atLeastOneInNextN(count, deckSize, n)` — hypergeometric complement; guarded
  for `n >= deckSize` (→ `1` if `count > 0`) and `count === 0` (→ `0`).
- Every exported function has a JSDoc; `// why:` on the villain-fallback
  ordering and the Killbots caveat.

### B) `DeckProbabilityPanel.vue` (`apps/arena-client/src/components/play/DeckProbabilityPanel.vue`, **new**)
- Reads `snapshot` from `useUiStateStore` via `storeToRefs`; self-hides
  (`v-if`) when `snapshot` / the needed fields are absent.
- Collapsible via a local `const isExpanded = ref(false)`.
- **Villain section:** `summarizeVillainDeck(snapshot.decks.villainDeckComposition)`
  → one row per non-zero type: label, remaining count, `nextDrawOdds` as a
  percent. Total remaining shown.
- **Own-deck section:** the redaction-marker-selected player's
  `deckComposition` → total count + a best-effort by-name tally (names from a
  small `extId → name` map harvested from the viewer's own display arrays —
  `handDisplay` / `discardDisplay` / `inPlayDisplay` are `UICardDisplay[]`
  (name at `.name`); `victoryCards` is `UIDisplayEntry[]` (name nested at
  `.display.name`) — harvest both shapes; ext_ids with no harvested name
  grouped as "Unknown").
- `data-testid` hooks on the toggle, each villain-type row, and the own-deck
  total (test surface).
- Presentational only — no store writes, no engine import, no move dispatch.

### C) Mount (`apps/arena-client/src/pages/PlayViewport.vue`, **modified**)
- Register `DeckProbabilityPanel` in `components:` and add `<DeckProbabilityPanel/>`
  to the fixed-position overlay block (beside `HollowEffectsPanel`). This is
  the sole `01.5` runtime-wiring edit.

### D) Tests
- `deckProbability.test.ts` (**new**) — `categorizeVillainCard` for each prefix
  + the villain fallback + a Killbots-style `bystander-villain-deck-*`
  (asserts the documented miscount as Bystander, pinning the known limit);
  `summarizeVillainDeck` counts; `nextDrawOdds` incl. `deckSize 0`;
  `atLeastOneInNextN` incl. the `n >= deckSize` and `count 0` guards.
- `DeckProbabilityPanel.test.ts` (**new**) — seed `useUiStateStore().setSnapshot`
  with a `loadUiStateFixture('mid-turn')` spread + injected
  `decks.villainDeckComposition` and the viewer's `deckComposition`; assert the
  villain rows render with the right counts/odds and the own-deck total; assert
  the panel hides when the fields are absent.

---

## Out of Scope

- **No engine / `G` / projection change.** The fields are WP-606's; this WP
  renders them. Own-deck display names, a face-up-top marker, per-card
  cost/class breakdown all need a new projection → follow-on WPs.
- **No hand projection / Monte Carlo / pace-outlook / deck-health / trend** —
  Phases 2–4, separate WPs.
- **No Killbots type-correction** — documented as a Phase-1 miscount.
- **No new dependency**, no shared "collapsible panel" component (roll the
  local `ref` toggle).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/components/play/deckProbability.ts` — **new** — pure categorizer + odds
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **new** — the collapsible panel
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — register + mount (01.5 wiring)
- `apps/arena-client/src/components/play/deckProbability.test.ts` — **new** — util tests
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **new** — component test

No other files may be modified.

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, no identity, no multiplayer sync, no
card-data/content-semantics change, no monetization. A read-only client aid.

**Determinism note:** N/A — no engine/`G`/`ctx` touch, no hash surface. The
panel's probability math is client-local display arithmetic, never
`ctx.random`; the engine and both hash oracles are untouched.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

All items binary pass/fail.

- [ ] `categorizeVillainCard` maps each prefix to the correct `RevealedCardType`
  with `villain` as the fallback; a `bystander-villain-deck-*` id categorizes
  as `bystander` (the documented Killbots miscount is pinned).
- [ ] `summarizeVillainDeck` returns the correct per-type counts + total;
  `nextDrawOdds` returns `count/deckSize` and `0` for `deckSize 0`;
  `atLeastOneInNextN` is correct incl. the `n >= deckSize` and `count 0` guards.
- [ ] The panel renders the villain upcoming-risk rows (count + percent per
  non-zero type) and the viewer's own draw-pool total from a seeded snapshot,
  and **hides** (renders nothing) when `villainDeckComposition` /
  `deckComposition` are absent.
- [ ] The panel is collapsible (local `isExpanded`), reads only the store, and
  imports no engine runtime / `boardgame.io` / registry.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` (vue-tsc) 0;
  `pnpm --filter arena-client test` green.
- [ ] No files outside `## Files Expected to Change` (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build (engine dist must exist before arena-client typecheck)
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 3 — no engine-runtime import in the panel/util
Select-String -Path "apps\arena-client\src\components\play\DeckProbabilityPanel.vue","apps\arena-client\src\components\play\deckProbability.ts" -Pattern "from '@legendary-arena/game-engine'"
# Expected: only type-only imports (import type ...), no runtime import

# Step 4 — scope check
git diff --name-only
# Expected: only the 5 files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a **real deployed match**, the Deck Probability Panel shows
  the villain deck's remaining-per-type counts + next-draw odds and the
  viewer's own draw-pool count, and collapses/expands — observed on the
  deployed bundle (green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client suite green.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24418 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-607 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS** (the §2 Always-apply boilerplate + `00.6` reference + Session protocol were added after an initial §2 FAIL the gate flagged).

- §1 Structure — PASS (all sections; Out of Scope has 5 exclusions).
- §2 Constraints — PASS (Always-apply: full-file/no-diffs, ESM+Node v22+, `00.6`; packet-specific; session protocol; locked values).
- §3 Assumes — PASS (WP-606 field shapes, store/selector, ext_id grammar, baseline).
- §4 Context — PASS (specific files + line refs; `.claude/rules/architecture.md` Import Rules cited for the arena-client boundary).
- §5 Files — PASS (5 files, closed allowlist, bounded).
- §6 Naming — PASS (`deckComposition` / `villainDeckComposition` / `RevealedCardType` match source).
- §7 Dependencies — PASS (no new dep; node:test).
- §8 Boundaries — PASS (no engine/boardgame.io/registry runtime import; type-only).
- §9 Windows — PASS (pwsh + Select-String + backslash paths).
- §10 Env / §11 Auth — N/A (no env vars; no auth).
- §12 Tests — PASS (node:test + @vue/test-utils + jsdom; no boardgame.io; no net/DB).
- §13 Verification — PASS (exact `pnpm --filter arena-client` commands + expected output).
- §14 Acceptance — PASS (6 binary/observable items).
- §15 / §15.1 DoD — PASS (User-Visible Surface + live-on-surface D-24026; vue-tsc gated in WP + EC).
- §16 Code Style — PASS (JSDoc, `// why:`, for...of, no abbreviations).
- §17 Vision — N/A (read-only client aid; determinism note present).
- §18 Prose-vs-Grep — PASS (Step 3 grep returns only the expected type-only import).
- §19 Bridge-vs-HEAD — N/A (commit-time; baseline `07e2204c` filled).
- §20 Funding / §21 API Catalog — N/A (no funding surface; no HTTP endpoint or server lib fn).

**Lint verdict: PASS (all resolved; §2 boilerplate added after the gate's flag).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-25).**

- **Dependency verified on `main`:** WP-606's `deckComposition?` (uiState.types.ts:407) + `villainDeckComposition?` (:582) are landed (#1649) and survive the audience filter (owner-redacted :314-315; public :506-507), with drift + audience tests.
- **Barrel reachability:** `UIState`/`UIPlayerState`/`UIDecksState` + `RevealedCardType` are re-exported (index.ts:148,334-377); arena-client imports `UIState` types from the barrel already.
- **ext_id grammar confirmed** (villainDeck.setup.ts): `master-strike-NN`, `scheme-twist-{slug}-NN`, `bystander-villain-deck-NN`, `henchman-{group}-NN`, `{set}-villain-…`; `mastermind-strike` is the type name (prefix ≠ type — handled).
- **Killbots caveat is real** (villainDeck.setup.ts:302-313 rewrites the bystander-prefixed card to type `villain` via unprojected `convertedOrigins`) — the documented Phase-1 miscount is legitimate.
- **RS-1 (folded in):** `victoryCards` is `UIDisplayEntry[]` (name at `.display.name`) unlike the `*Display` arrays — Scope B now notes the dual shape.
- **PS items (blocking): none.**

---

## Copilot Check (01.7)

**Verdict: RISK (minor) → CONFIRM (2026-08-25).** Scope unchanged (5-file allowlist). Copilot verified the two things that could have sunk categorization:

- **No prefix collision possible** — villains are `{setAbbr}-villain-…`; no set abbr equals a reserved prefix, so villain-last fallback is sound.
- **Name-harvest is leak-free** — the own-deck total comes from `deckComposition.length`; names are a separate lookup over the viewer's **own** (owner-redacted) display arrays; un-harvestable → "Unknown". Spectator self-hides.

Two scope-neutral folds applied: the categorizer `// why:` now cites `villainDeck.setup.ts` as the ext_id-grammar source of truth (#29); and the EC's over-strong "layer violation" wording was softened — arena-client *may* import the runtime-safe engine surface (WP-090), this presentational helper simply needs types only (#1). Killbots miscount pinned by test. **Disposition: CONFIRM.**

---

## Reserved Decisions (land at execution)

- **D-24418 (reserved; Drafted 2026-08-25, not yet landed)** — The Deck
  Probability Panel is a **client-side advisory** surface: it computes draw
  odds purely from the WP-606 `UIState` projection, never from `ctx.random`,
  and never feeds gameplay (extends D-24417). Villain-deck cards are
  categorized **client-side by ext_id prefix** (`master-strike-` /
  `scheme-twist-` / `bystander-villain-deck-` / `henchman-` / else `villain`),
  the synthetic grammar being deterministic in `villainDeck.setup`, rather
  than via a new engine type-projection. The Killbots scheme's
  `bystander→villain` type override (`G.convertedOrigins`, not projected) is a
  **known, documented Phase-1 miscount**. Phase-1 MVP is the plain counter +
  upcoming-risk odds; hand projection (Monte Carlo), pace/outlook, and
  deck-health are follow-on phases (the ewiki panel page's phasing).

---

## See Also

- [WP-606](WP-606-uistate-draw-pool-composition.md) / D-24417 — the projection this consumes
- `wiki/deck-probability-panel.md` — the design + MVP-first phasing (Phase 1 = this WP)
- `apps/arena-client/src/components/play/HollowEffectsPanel.vue` — the self-hiding fixed-overlay pattern mirrored
