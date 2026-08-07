# WP-505 — Captured Cards Under Villains & Mastermind (Engine Projection + Client Render)

**Status:** Draft — not yet executed (see `WORK_INDEX.md` for status authority).
**Primary Layer:** Game Engine (UIState projection) + App (arena-client render) — cross-layer, additive.
**Dependencies:** WP-214 / EC-246 (`attachedHeroes` projection + audience-filter passthrough), WP-154 (`mastermind.attachedBystanders` projection), WP-128 / D-12805 / D-12806 (audience-filter redaction matrix + the city-villain-bystander safe-skip this WP reverses).

---

## Session Context

> The play board tracks three kinds of captured card in `G` today, and the
> engine already populates all three at runtime. What is missing is the
> **display** of them under the adversary that holds them:
>
> 1. **Villain captures a Hero from the HQ** (`G.villainAttachedHeroes`) — the
>    hero is **face up** (its identity is public). Projected as
>    `UICityCard.attachedHeroes: string[]` by WP-214 and it survives the
>    audience filter — but **no client surface renders it** (`CityRow.vue`
>    ignores the field). WP-214 explicitly deferred "arena-client UI rendering
>    of attached heroes" to a separate UI WP that was never drafted; this WP is
>    that deferred UI work.
> 2. **Villain/henchman captures a Bystander** (`G.attachedBystanders`) — the
>    bystander is **face down** (identity hidden). Projected **nowhere**:
>    `buildUIState` deliberately does NOT flatten `G.attachedBystanders`
>    (D-12805 Interpretation B / D-12806 safe-skip), so a city villain sitting
>    on a captured bystander is invisible to every player.
> 3. **Mastermind captures a Bystander** via Master Strike
>    (`G.mastermind.attachedBystanders`, D-15401) — **face down**. Projected as
>    `mastermind.attachedBystanders: UIDisplayEntry[]` (WP-154) and rendered as
>    a text `<li>` list in `MastermindTile.vue`.

---

## Goal

After this packet, a player looking at the play board can **see what each city
villain and the mastermind is holding**:

1. **Face-up captured Heroes** render as small card art stacked under their city
   villain (you can see *which* hero was taken from the HQ).
2. **Face-down captured Bystanders** render as a **count-only badge** ("N
   captured") on the city villain — the count is public, the identity stays
   hidden, matching the face-down tabletop state.
3. The **mastermind's** captured bystanders render as the same count-only badge,
   replacing the current text list.

The engine adds two additive, public `UICityCard` fields to make (1) and (2)
renderable; the mastermind badge (3) is client-only (the projection already
exists).

---

## Assumes

> Verify before writing a line. If any item is false, this packet is **BLOCKED**.

- **WP-214 / EC-246 complete.** `UICityCard.attachedHeroes: string[]` is
  projected in `uiState.build.ts` (per-city-space, from
  `G.villainAttachedHeroes[space]`) and passed through `deepCopyCitySpaces` in
  `uiState.filter.ts` (`attachedHeroes: [...space.attachedHeroes]`).
- **WP-154 / D-15401 complete (executed 2026-05-16).**
  `UIMastermindState.attachedBystanders: UIDisplayEntry[]` is projected from
  `G.mastermind.attachedBystanders` (a real, runtime-populated field —
  `mastermindHandlers.ts` captures a bystander onto it per D-15401) and passed
  through the mastermind rebuild in `uiState.filter.ts`. `MastermindTile.vue`
  renders it as an `<li>` text list today.
- **`G.attachedBystanders: Record<CardExtId, CardExtId[]>`** (top-level on
  `LegendaryGameState`, `types.ts`) is maintained by `bystanders.logic.ts` and
  **keyed by the villain/henchman zone-instance ext_id** — the same key the
  city projection loop uses (`space`), so `G.attachedBystanders[space]` is the
  correct lookup. Primary runtime population site: `villainDeck.reveal.ts`
  (a bystander revealed from the villain deck attaches to the frontmost city
  villain); also the `captureBystander` villain effect
  (`villainEffects.execute.ts`) and `schemeTwistResolvers.ts`.
- **The Board-Visible Field Rule** (`.claude/rules/architecture.md §UIState
  Projection Integrity`) governs adding any client-visible `UIState` field:
  declare on the type → populate in `buildUIState` → **pass through**
  `filterUIStateForAudience` → add an audience-filter test → verify in the Play
  Diagnostics `uiStateSnapshot`. A field that reaches populate but not filter is
  silently dropped (the EC-206 / PR #1165 failure mode).
- **Enforcement reality (correcting a common mis-assumption).** Making the two
  new fields **required** is enforced *only* by **arena-client `vue-tsc`** — a
  `UICityCard` literal missing a required field fails `typecheck` there.
  **game-engine tests do NOT enforce it**: `packages/game-engine/tsconfig.json`
  excludes `src/**/*.test.ts`, and the `tsx` test runner strips types, so a
  `satisfies UICityCard` in a `.test.ts` is never checked. The game-engine drift
  guard is instead the **runtime `Object.keys(fixture).sort()` assertion** in
  `uiState.types.drift.test.ts` — which is **already stale**: it still pins the
  four pre-WP-214 keys (`display`, `extId`, `keywords`, `type`) and omits WP-214's
  `attachedHeroes` / `fightCost`. This WP MUST update that assertion (see Scope).
- **`resolveDisplay(extId, gameState)`** in `uiState.build.ts` returns a
  `UICardDisplay` for any ext_id from `G.cardDisplayData` — the same helper used
  for `UICityCard.display` and HQ `slotDisplay`.
- **The arena-client has no generic ext_id → image resolver.** Display payloads
  reach the client only when the engine projects them inline per zone-slot
  (`display`, `slotDisplay`, `handDisplay`). `matchCardImageUrls` is a flat
  prefetch list, not a lookup. Therefore face-up captured heroes need a
  projected display payload — the ext_id array alone cannot render art.

---

## Context

Why now: captured cards are a live, visible part of the tabletop board state
that the digital board currently hides. A villain sitting on a captured hero or
a stack of bystanders is a meaningful threat signal (the fight reward, the
escape stakes) that players cannot currently see. WP-214 shipped the engine
half of the hero case and deferred the render; the bystander case was never
projected at all. This WP closes both and the mastermind display in one arc
(operator decision, 2026-08-06: full engine + city + mastermind scope, face-down
bystanders shown count-only).

Single cross-layer WP (not split): the engine surface is two additive
projection fields and the client surface is two components; splitting would risk
re-deferring the render exactly as WP-214 did. The layer boundary is respected —
the engine only adds read-only projections; the client only consumes them.

## Scope

### In

1. **Engine — two new `UICityCard` fields** (`packages/game-engine/src/ui/`):
   - `attachedHeroDisplay: UICardDisplay[]` — face-up captured-hero display
     payloads, **index-aligned** with the existing `attachedHeroes: string[]`
     (mirrors the HQ `slots` / `slotDisplay` parallel-array pattern). Populated
     via `resolveDisplay(heroExtId, gameState)` per attached hero. Public
     (visible to all audiences).
   - `attachedBystanderCount: number` — count of face-down bystanders captured
     under this city villain, from `G.attachedBystanders[space]?.length ?? 0`.
     **Count only** — never the ext_ids or display (face-down = identity
     hidden). Public.
   - Both added through the 5-step Board-Visible Field contract: declared on the
     `UICityCard` type, populated in `buildUIState`, passed through
     `deepCopyCitySpaces` in `filterUIStateForAudience`, covered by an
     audience-filter test, and verified in the Play Diagnostics `uiStateSnapshot`.
   - **Comment correction (purge the false half, preserve the valid half).**
     The mastermind-projection comments in `uiState.build.ts` (~678–685),
     `uiState.types.ts` (~437–446), and `MastermindTile.vue` (~16, ~150) carry
     two distinct claims:
     - **FALSE (correct/remove):** "`G.mastermind.attachedBystanders` does not
       exist / engine has no source today / ships as `[]`." This has been false
       since WP-154 / D-15401 wired the field; correct it wherever it appears in
       the files this WP touches.
     - **STILL VALID (preserve, reworded):** "never flatten `G.attachedBystanders`
       (city-villain captures) onto the **mastermind** tile." That architectural
       prohibition holds — city-villain bystanders now render as a **count on the
       city card** (per D-24311), and are still **never** projected onto the
       mastermind. Rework the comment to say exactly that; do NOT delete the
       prohibition.

2. **Client — city render** (`apps/arena-client/src/components/play/CityRow.vue`
   and the `CardTile`/city cell surface):
   - Render `cell.card.attachedHeroDisplay` as small face-up card art stacked
     under the villain tile (identity visible).
   - Render an `attachedBystanderCount` badge ("N captured", `aria-label`) on the
     villain tile when `> 0`; nothing when `0`.

3. **Client — mastermind render**
   (`apps/arena-client/src/components/play/MastermindTile.vue`):
   - Replace the captured-bystander `<li>` text list with the same count-only
     badge driven by `mastermind.attachedBystanders.length`.

4. **Fixture backfill + drift guard (enumerated — no "(bounded)").**
   `attachedHeroDisplay` and `attachedBystanderCount` are **required** fields on
   `UICityCard`. Per the enforcement reality in §Assumes, two distinct guards
   must be satisfied:
   - **arena-client `vue-tsc`** — every `UICityCard`-literal site must be
     backfilled. The exact set (verified 2026-08-06 by an `attachedHeroes`
     probe + the `satisfies UIState` binding in `fixtures/uiState/typed.ts`):
     `src/components/play/CityRow.test.ts`, `src/composables/useCityRow.test.ts`,
     `src/preplan/mutationDetector.test.ts`, and the three JSON fixtures bound by
     `typed.ts` — `src/fixtures/uiState/mid-turn.json`, `endgame-loss.json`, and
     `endgame-win.json` (every non-null city space in each).
   - **game-engine runtime drift test** — `uiState.types.drift.test.ts` MUST be
     updated (this is **mandatory, not "if needed"**): backfill its `UICityCard`
     fixture and change the `Object.keys(fixture).sort()` assertion from the
     stale 4-key set to the full **8-key** set: `attachedBystanderCount`,
     `attachedHeroDisplay`, `attachedHeroes`, `display`, `extId`, `fightCost`,
     `keywords`, `type`. (This also repairs the WP-214 staleness while here.)

   These two fields are **required** (not optional) — a deliberate choice: unlike
   the optional additive fields (`matchCardImageUrls?`, `slotDisplay?`) that were
   made optional to *avoid* fixture backfill, a city tile always has a
   (possibly-empty) capture state, so the field is always present. The cost is
   the enumerated backfill above (`project_arena_client_uistate_backfill_recurrence`).

5. **Governance.** `D-24311` (reverse the D-12806 city-villain-bystander
   safe-skip; lock the two new public `UICityCard` fields), WORK_INDEX flip,
   EC_INDEX status, mindmap glyph, STATUS.md.

### Out (Deferred)

- **Face-up bystander art / bystander identity reveal.** Bystanders stay
  count-only by design (face down). If a future feature wants to reveal a
  specific captured bystander (e.g. a rescue animation naming it), that widens
  the projection then — not here.
- **Reducing the mastermind projection to count-only.** The existing
  `mastermind.attachedBystanders: UIDisplayEntry[]` projection is left intact
  (only the render changes). No engine change on the mastermind side.
- **Capture / rescue VFX** (the transient pull-away / sparkle animations) — that
  is the `visual-effects.md` juice layer (Surface 1b), a separate concern from
  this persistent board-state display.
- **Escaped-pile captured-card display.** Escape carries captured cards away via
  a log-only path with no notable event (D-20001); out of scope.

---

## Locked Contract Values

| Item | Value | Source |
|------|-------|--------|
| New city field (heroes) | `attachedHeroDisplay: UICardDisplay[]` | This WP |
| Hero display alignment | Index-aligned with `attachedHeroes: string[]` (same length, same order) | Mirrors HQ `slots`/`slotDisplay` |
| Hero display source | `resolveDisplay(heroExtId, gameState)` per attached hero | `uiState.build.ts` |
| New city field (bystanders) | `attachedBystanderCount: number` | This WP |
| Bystander projection | **Count only** — `G.attachedBystanders[space]?.length ?? 0`; never ext_ids/display | Face-down semantics (D-24311) |
| Both new fields' audience | Public — survive the filter for all audiences (board state, not private) | D-24311 |
| Mastermind engine change | **None** — render `mastermind.attachedBystanders.length` client-side | WP-154 projection reused |
| Bystander badge copy | "N captured" (count-only), with `aria-label` | This WP |
| Field-add contract | 5-step Board-Visible Field Rule (type→build→filter→filter-test→diagnostics) | `.claude/rules/architecture.md` |

## Files Expected to Change

> Estimated; may vary ±2 during execution.

### Engine (`packages/game-engine/`)

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/ui/uiState.types.ts` | Modify | Add `attachedHeroDisplay` + `attachedBystanderCount` to `UICityCard`; rewrite stale "do NOT flatten" comment |
| 2 | `src/ui/uiState.build.ts` | Modify | Populate both fields in the city projection; rewrite the safe-skip comment |
| 3 | `src/ui/uiState.filter.ts` | Modify | Pass both fields through `deepCopyCitySpaces` |
| 4 | `src/ui/uiState.build.test.ts` | Modify | Assert both fields projected (hero display index-aligned; bystander count) |
| 5 | `src/ui/uiState.filter.test.ts` | Modify | Assert both fields survive the audience filter for all audiences |
| 6 | `src/ui/uiState.types.drift.test.ts` | Modify (**mandatory**) | Backfill the `UICityCard` fixture; update `Object.keys` assertion to the full 8-key set (repairs WP-214 staleness) |

### Client (`apps/arena-client/`)

| # | File | Action | Purpose |
|---|------|--------|---------|
| 7 | `src/components/play/CityRow.vue` | Modify | Render face-up hero art + bystander count badge under city villains |
| 8 | `src/components/play/CityRow.test.ts` | Modify | Cover hero art + badge rendering + backfilled fixtures |
| 9 | `src/components/play/MastermindTile.vue` | Modify | Swap bystander `<li>` list for count-only badge |
| 10 | `src/components/play/MastermindTile.test.ts` | Modify | Cover the count badge |
| 11 | `src/composables/useCityRow.test.ts` | Modify | Backfill the two required `UICityCard` fields |
| 12 | `src/preplan/mutationDetector.test.ts` | Modify | Backfill the two required `UICityCard` fields |
| 13 | `src/fixtures/uiState/mid-turn.json` | Modify | Backfill non-null city spaces (`satisfies UIState` via `typed.ts`) |
| 14 | `src/fixtures/uiState/endgame-loss.json` | Modify | Backfill non-null city spaces |
| 15 | `src/fixtures/uiState/endgame-win.json` | Modify | Backfill non-null city spaces (if any) |

### Governance

| # | File | Action | Purpose |
|---|------|--------|---------|
| 16 | `docs/ai/DECISIONS.md` | Modify | Land D-24311 |
| 17 | `docs/ai/work-packets/WORK_INDEX.md` | Modify | Status flip |
| 18 | `docs/ai/execution-checklists/EC_INDEX.md` | Modify | Status flip |
| 19 | `docs/05-ROADMAP-MINDMAP.md` | Modify | Glyph flip + `roadmap:counts:write` |
| 20 | `docs/ai/STATUS.md` | Modify | Status entry |

## Acceptance Criteria

1. `UICityCard.attachedHeroDisplay` is projected index-aligned with
   `attachedHeroes` — same length, same order — with each entry the
   `resolveDisplay` payload for that hero.
2. `UICityCard.attachedBystanderCount` equals
   `G.attachedBystanders[space]?.length ?? 0` for each city villain; it is a
   count only (no ext_ids or display leak).
3. Both new fields **survive `filterUIStateForAudience`** for owner, opponent,
   and spectator audiences (asserted by test) — they are public board state.
4. Both new fields appear in the Play Diagnostics `uiStateSnapshot`.
5. A city villain holding captured heroes renders those heroes as face-up card
   art beneath its tile in `CityRow.vue`.
6. A city villain holding `N > 0` captured bystanders renders an "N captured"
   badge; `N = 0` renders nothing.
7. The mastermind tile renders its captured-bystander count as the same
   count-only badge (no text `<li>` list), driven by
   `mastermind.attachedBystanders.length`.
8. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client
   typecheck` exits 0 — the arena-client `vue-tsc` pass is the *only* compile-time
   enforcer of the required-field backfill, so a green typecheck proves every
   enumerated `UICityCard`-literal site (§Scope-In #4) was updated.
9. `uiState.types.drift.test.ts` asserts the `UICityCard` `Object.keys` set is
   exactly the 8-key set (§Scope-In #4), and the game-engine suite is green — the
   runtime drift guard (not typecheck) is what pins game-engine fixture shape.
10. Engine + arena-client test suites green; net-new tests cover AC 1–3, 5–7, 9.
11. Live-on-surface: on a real match, a captured hero shows as art and captured
    bystanders show as a count badge under the holding villain/mastermind.

## Verification Steps

1. `pnpm -r build && pnpm -r --no-bail test` — engine + client green.
2. `pnpm --filter @legendary-arena/arena-client typecheck` — 0 errors (proves
   fixtures backfilled).
3. Play-fixture dev route (`?fixture=…&play=1`) with a captured-hero and
   captured-bystander state: confirm hero art + count badges render under the
   city villain and the mastermind.
4. Export Play Diagnostics; confirm `attachedHeroDisplay` +
   `attachedBystanderCount` present in `uiStateSnapshot`.

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Engine + arena-client suites green; net-new tests present
- [ ] `pnpm -r build` + arena-client `typecheck` exit 0
- [ ] D-24311 landed in DECISIONS.md
- [ ] WORK_INDEX.md + EC_INDEX.md status flipped with date
- [ ] Mindmap glyph flipped; `roadmap:counts:check` exits 0
- [ ] STATUS.md updated
- [ ] Live-on-surface verification recorded (D-24026)
- [ ] Replay fixture re-pinned only if a hash shifts (projection is
      hash-excluded — none expected; verify)

---

## Lint Gate Self-Review

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | Goal, Assumes, Context, Scope (In/Out), Files, Locked Values, Acceptance Criteria, Verification, Definition of Done all present. |
| §2 Constraints | PASS | Locked Contract Values table + the Board-Visible Field 5-step contract; code style enforced by `.claude/rules/*` at execution. |
| §3 Prerequisites | PASS | WP-214, WP-154, WP-128/D-12805/D-12806 listed with the exact shapes/behaviours relied on. |
| §4 Context | PASS | Context explains why now + the WP-214 deferral it completes. Layer boundary: engine adds read-only projections, client consumes; enforced via `legendary-game-engine` SKILL at execution. |
| §5 Output Completeness | PASS | 20 files with action + purpose. |
| §6 Naming | PASS | `attachedHeroDisplay`, `attachedBystanderCount`, `UICityCard`, `UICardDisplay`, `attachedHeroes`, `attachedBystanders` match canonical names. |
| §7 Dependencies | PASS | No new npm deps. |
| §8 Architectural Boundaries | PASS | Engine change is additive UIState projection (`packages/game-engine/src/ui/`); client change consumes it (`apps/arena-client`). No new engine→app or app→registry runtime edge. Cross-layer respected per Context. |
| §9 Windows | N/A | No shell scripts produced. |
| §10 Env Vars | N/A | None. |
| §11 Auth | N/A | Does not touch auth. |
| §12 Test Quality | PASS | `node:test` engine + arena-client `.test.ts`; audience-filter tests non-vacuous (assert survival per audience). |
| §13 Verification | PASS | Binary, surface-observable; build + typecheck + live-on-surface explicit. |
| §14 Acceptance Criteria | PASS | 11 binary items. |
| §15 Definition of Done | PASS | Includes AC, DECISIONS, WORK_INDEX, EC_INDEX, mindmap, STATUS, live-on-surface, replay re-pin. |
| §16 Code Style | PASS | Explicit control flow; parallel-array pattern mirrors existing HQ slotDisplay; `// why:` at the count projection + filter passthrough. |
| §17 Vision Alignment | PASS | Improves board legibility (product quality). Determinism untouched — projection is hash-excluded. NG-1..7 not crossed. |
| §18 Prose-vs-Grep | PASS | No count-bounded grep gates in Verification that collide with prose. |
| §19 Bridge Staleness | N/A | No repo-state-summarizing artifact. |
| §20 Funding Surface | N/A | No funding surface. |
| §21 API Catalog | N/A | No HTTP endpoints added/modified. |

**Result: 21/21 resolved (15 PASS, 6 N/A).**
