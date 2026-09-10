# WP-688 — Play-Surface Fit-to-Floor (`<PlayDesktop>` fits the 1280×720 authoring floor with no page scroll)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; presentation only (CSS + a small measure-and-scale composable). **Zero engine / registry / server / determinism / persistence footprint** (consumes the existing read-only `UIState` projection; no `G`, no new `UIState` field, no `finalStateHash` surface).
**User-Visible Surface:** `play.legendary-arena.com` — the desktop play surface (`<PlayDesktop>`). Directly observable in a real match / the `?fixture=mid-turn&play=1` play route.

> Baseline: re-baseline to current `origin/main` at execution and cite `git rev-parse origin/main` in the execution session.

---

## Session Context

WP-685 / EC-722 (#1985) landed the **spatial STRUCTURE** that D-24502 ratifies — the two-column grid, the right rail (opponents + game log), the horizontally-scrolling full-array hand/in-play wells, and the adversary-band / HQ / cockpit regroup — all live on `main`. But the live D-24026 check (#1987) found the board is still **~1360px tall and vertically scrolls at an effective 1280×720** (Tex's viewport: a 1080p monitor at 150% browser zoom). Root cause, recorded on the ewiki *Implementation status* section: the real components are **~2× the height of the Rev-4 mock's compact tiles** — `CardTile` sizes (`--card-width-sm/md/lg` floors 60/90/120px, aspect 5/7 → tall) plus per-zone label + gap spacing sum to ~1360px in the main column. **D-24502 lock 1 (the fit) is the one open piece.** This WP closes it.

---

## Goal

After this session, `<PlayDesktop>` **fits the 1280×720 authoring floor with no page scroll** — the board the player sees on an effective 1280×720 viewport renders whole, nothing clipped, and does not vertically (or horizontally) scroll the page. The fit is achieved by **board-scoped compaction** of the card tiles and per-zone spacing — a `.play-desktop`-scoped override of the `--card-width-*` / gutter / gap tokens that leaves the **shared** size tokens and the **entire `<PlayMobile>` / `useViewport` D-12909 surface byte-unchanged** — combined as needed with a **scale-to-fit stage** (D-24502's literal mechanism: the board is authored at the 1280-floor and scaled to the viewport), tuned live so the board fits readably at 1280×720 and **scales up (never rewraps)** on wider screens. Everything WP-685 shipped (rail, full-array wells, regroup, occupied City names, HQ-adjacent Transform Deck, projection-bound denominators) is preserved. This realizes D-24502 lock 1 and, with it, the whole D-24502 ruling; D-24251 is annotated superseded on the desktop side. No engine change, no `UIState` field, no new dependency, no `SchemeTile` / `TopHudBar` / `useViewport` / `<PlayMobile>` touch.

---

## User-Visible Impact

A player on an effective **1280×720** viewport (a 1080p monitor at 150% browser zoom — Tex's screen, the documented failure) sees the **whole board at 1:1-ish with no page scroll**, readable (card names + costs legible). A player on a 1920×1080 monitor sees the *same* region layout **scaled up**, not a different wrapped layout and not a tall scrolling column. This is the last piece of the D-24502 rebuild: WP-685 made the board read like a real Legendary mat (fixed regions, right rail, scrolling wells); WP-688 makes that mat actually **fit the smallest supported desktop viewport**. Resolves the sub-1366 failure documented on the ewiki [Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/) *Implementation status* section.

---

## Assumes

- WP-685 / EC-722 is on `main`: `apps/arena-client/src/pages/PlayDesktop.vue` already renders `.play-desktop__grid` (a `minmax(0,1fr) var(--play-rail-width)` two-column grid), `.play-desktop__rail` (opponents + game log), the adversary band / HQ zone / cockpit regroup, and the full-array `HandRow` / `PlayedCardsRow` wells. This WP tunes that structure to fit; it does not rebuild it.
- `apps/arena-client/src/styles/base.css` holds the `:root` size-token layer (`--card-width-sm/md/lg`, `--play-gutter`, `--play-rail-width`, `--play-max-width`); its "no raw hex" rule is **color-only**, so new/overridden **size** tokens are permitted. These tokens are consumed by `CardTile.vue` (`width: var(--card-width-*)`) on **every** surface, so they MUST NOT be shrunk globally — the compaction is scoped to `.play-desktop`.
- `apps/arena-client/src/components/play/CardTile.vue` sizes each tile by `width: var(--card-width-{sm|md|lg})` with `aspect-ratio: 5/7`. The board zones use: City / SharedDecks / your-deck-discard / Transform / Mastermind-thralls = `sm`; HQ / Hand / Played / Mastermind / Scheme = `md`. CardTile is read-only here — compaction is achieved by overriding the tokens it reads, scoped to the desktop board, so no other surface (including `<PlayMobile>`) changes.
- `apps/arena-client/src/styles/playmat-slots.css` (WP-666) is the global frosted-panel "layout mat" layer; per-zone panel padding / label spacing live here and contribute to the main-column height.
- `apps/arena-client/src/composables/useViewport.ts` (D-12909) owns `BREAKPOINT_MOBILE_MAX_PX = 767`. Read for context ONLY and **NOT modified** — the fit is the desktop side above 768px; the mobile split is untouched.
- `docs/ai/DECISIONS.md` **D-24502** (lock 1 — the fit) and **D-24251** (the fluid model) are on `main`. **D-24505** is reserved in `NUMBER-LEDGER.md` for this WP and lands at execution.
- `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) passes on the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24502** lock 1 (the authoring grid + scale ladder this WP realizes), **D-24251** (the fluid model this completes the supersession of on the desktop side — annotate at execution), **D-12909** (the 767 split, unchanged).
- `apps/arena-client/src/pages/PlayDesktop.vue` — read the whole `<template>` + `<style scoped>`; note the WP-685 grid / rail / adversary-band / cockpit structure this WP tunes.
- `apps/arena-client/src/styles/base.css` — the `:root` size-token home (read the WP-430 `--card-width-*` clamp tokens + their floors) and the `.play-desktop` compaction-override site.
- `apps/arena-client/src/components/play/CardTile.vue` — read the `card-tile--{sm|md|lg}` width bindings + the 5/7 aspect; confirm it is token-driven (so a scoped token override compacts it without a component edit).
- `apps/arena-client/src/styles/playmat-slots.css` — the frosted-panel padding/label selectors whose spacing this WP tightens for the board.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — note it is `position: sticky; bottom: 0; z-index: 100`; if a `transform`-based scale stage is used, confirm the sticky bar still reads correctly (a transform ancestor becomes the containing block for `position: fixed`, not `sticky`; with the board fitting there is no scroll for sticky to fight).
- `apps/arena-client/src/composables/useViewport.ts` — read ONLY, to confirm the D-12909 767 split is untouched.
- `wiki/responsive-viewport-targets.md` *Implementation status* section — the recorded state (structure shipped, fit open) + the Rev-4 mock (non-normative). D-24502 is the authority.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` / `/* why: */` comments).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only; Node v22+; Vue 3 SFCs; any test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Fit the 1280×720 floor with NO page scroll.** At an effective 1280×720 viewport the whole board renders, nothing clipped, and the page scrolls in neither axis. In-zone scroll (the hand / in-play wells, the rail's own overflow) is expected and allowed — the status reads "no page scroll", not "no scroll".
- **Scale up, never rewrap.** On wider / taller screens the board grows (larger cards / gaps); zones never rewrap or rearrange into a different layout. A 1920 screen shows the *same* region arrangement, larger.
- **Board-scoped compaction only — `<PlayMobile>` and the shared tokens are byte-unchanged.** The `--card-width-*` / gutter / spacing compaction is scoped to `.play-desktop` (a CSS-variable override that cascades only to the desktop board's descendants). The `:root` shared token *values* consumed by other surfaces MUST NOT be shrunk. `useViewport.ts`, `BREAKPOINT_MOBILE_MAX_PX = 767`, and every `<PlayMobile>` file are **out of scope and unmodified** — if any edit reaches them, STOP (that is a D-12909 violation and a different WP).
- **Readable floor (D-24502 lock 4).** Compaction + scale must not shrink cards below a readable name + cost at 1280×720. The lever is "author the board generously and scale the whole composition" (scale stage) and/or "compact the tokens to a readable floor" — not "shrink the tokens until nothing is legible". Live verification confirms legibility.
- **Pure presentation.** No `G` read/write, no `ctx`, no new `UIState` field, no persistence, no `finalStateHash` sentinel. No runtime `@legendary-arena/registry`, `game-engine` (beyond existing type-only imports), `server`, `pg`, or `boardgame.io` import is added. A scale-to-fit composable reads only DOM geometry (`getBoundingClientRect` / `ResizeObserver` / `window.innerHeight`), never game state.
- **Preserve everything WP-685 shipped.** The grid, right rail (opponents + log), full-array wells, adversary-band / HQ / cockpit regroup, occupied City place-names, HQ-adjacent Transform Deck, and projection-bound denominators all keep working. Do not re-touch `SchemeTile.vue` / `TopHudBar.vue` (D-24502 lock 8 already shipped).
- **Undo and Heal Wound are OUT of scope** (D-24502 §Out of scope). Do not add either control.

**Session protocol:** the fit mechanism (how much compaction vs. how much scale; whether the scale stage needs a JS measure-and-scale composable or resolves via CSS) is the **operator-tunable knob per D-24502**, decided and tuned **live** against `## Verification Steps`. The acceptance criteria are geometry/behavior observations (fit, no page scroll, scale-up-not-rewrap, legible), not specific pixel/scale counts. If any locked value or a zone's current binding is unclear, stop and confirm against the source — never guess.

**Locked contract values (from D-24502 — do not re-derive):**
- **Authoring floor:** the board is authored/tuned to fit **1280×720** at the smallest supported desktop width; it **scales up** on wider screens (toward a ~1.5× cap on a 1920-wide screen) and **letterboxes / down-scales toward a low floor** just below 1280 before the D-12909 `<PlayMobile>` composer takes over at `≤767px`.
- **Scale-ladder realization note:** D-24502 lock 1's exact ladder (1.00× at 1280, ~1.07× at 1366, 1.50× at 1920) was illustrative against the ~720px-natural Rev-4 mock. With the real ~2× content the fit is **height-bound first**, so the realized scale lands **~0.75× at 1280** (after moderate compaction) and grows toward the 1.5× cap on 1080p — this honors "scale up, never rewrap" and the 1280-fit, which are the binding intent, while the exact per-width scale numbers are fit-driven. Record this in D-24505.
- **Unchanged:** `BREAKPOINT_MOBILE_MAX_PX = 767` (D-12909), `useViewport.ts`, `<PlayMobile>`, the skin assets, the shared `:root` token values, every WP-685 structural zone (grid, rail, wells, regroup, City order, Transform Deck) — only their *size/scale* is tuned.

---

## Scope (In)

### A) Authoring-floor + scale tokens (`apps/arena-client/src/styles/base.css`, **modified**)
- Under `:root`, add the authoring-floor + scale support tokens the implementation needs (e.g. the authoring-floor width, and the scale band bounds), each with a `/* why: */` citing D-24502 lock 1. Size values only — no color, no raw hex. Do **not** shrink the shared `--card-width-*` values here.

### B) Board-scoped compaction + fit (`apps/arena-client/src/pages/PlayDesktop.vue`, **modified**)
- In the `<style scoped>`, add a `.play-desktop`-scoped override of `--card-width-sm/md/lg` (and gutter/gap spacing) to compact the board's cards and inter-zone spacing so the main-column natural height drops substantially (target ~820–950px) — readable floor preserved. The override cascades only to the desktop board's descendants; the `:root` values other surfaces read are untouched. `/* why: */` cites D-24502 (board is denser than the shared D-12909 mobile tokens).
- Apply the **scale-to-fit** mechanism so any residual height (and width) fits 1280×720 with no page scroll and scales up on wider screens. If a measure-and-scale composable is used (see §C), wire it here (bind the computed scale to a CSS var on an authored stage; reserve only the scaled height so the page does not scroll). Each `// why:` / `/* why: */` cites D-24502 lock 1. The `<PlayMobile>` discriminator (D-12909) is untouched; this file only owns the desktop branch.

### C) Scale-to-fit composable (`apps/arena-client/src/composables/useScaleToFit.ts` + `.test.ts`, **new — pre-authorized, created only if the scale stage uses JS measurement**)
- A small presentation-only composable that measures the authored board's natural size vs. the available viewport and returns a clamped scale factor (within the tuned band), plus a `ResizeObserver` / resize listener to recompute. Reads DOM geometry only — no game state, no store, no engine import. Mirrors the `useViewport.ts` single-responsibility posture. Its `.test.ts` asserts the clamp math (fits when content > viewport; caps the scale-up; floors the scale-down) against injected dimensions. If the fit is achieved **without** JS (pure CSS compaction + a CSS-resolved scale), these two files are NOT created and that is recorded in the EC.

### D) Frosted-panel spacing (`apps/arena-client/src/styles/playmat-slots.css`, **modified — conditional**)
- Tighten the board's per-zone frosted-panel padding / label spacing if the token compaction in §B is not sufficient to reach the target height. The text-protection mask and the WP-666 frosted-panel behavior are preserved. If §B alone suffices, this file is not touched and that is recorded in the EC.

### E) Tests (`apps/arena-client/src/pages/PlayDesktop.test.ts`, **modified**)
- Update/extend the page test for the fit wiring: assert the authored stage / scale-var hook renders (structure intact), and — if the `useScaleToFit` composable is used — that the page mounts it. Keep the WP-685 structural assertions green (grid, rail holds opponents + log). Layout-pixel behavior (the actual fit/scale) is verified **live** per D-24026 (jsdom has no layout engine).

---

## Out of Scope

- **The D-12909 767px breakpoint, `useViewport.ts`, and the entire `<PlayMobile>` layout** — untouched.
- **The WP-685 structure itself** — the grid, rail, wells, regroup, City order, Transform Deck are shipped; this WP tunes their size/scale to fit, it does not rebuild or rearrange them.
- **The shared `:root` `--card-width-*` token values** — not shrunk globally (other surfaces consume them); compaction is `.play-desktop`-scoped only.
- **`SchemeTile.vue` / `TopHudBar.vue`** — D-24502 lock 8 already shipped; do not re-touch.
- **`CardTile.vue`** — read-only; compaction is via the tokens it reads, not a component edit (a per-surface CardTile edit would leak into `<PlayMobile>`).
- **Undo** and **the Heal Wound turn-bar control** — D-24502 §Out of scope; their own follow-ons.
- **A tablet composer** (768–1279 band) — a separate WP.
- **Any engine / registry / server change** — no `G`, no `UIState` field, no persistence, no `finalStateHash` re-pin, no HTTP endpoint.
- Refactors / cleanups not listed in Scope (In).

---

## Files Expected to Change

**Arena-client (App layer):**
- `apps/arena-client/src/styles/base.css` — **modified** — authoring-floor + scale support tokens under `:root` (no shared-token shrink).
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — `.play-desktop`-scoped compaction override + the scale-to-fit wiring + ladder/letterbox media policy.
- `apps/arena-client/src/composables/useScaleToFit.ts` — **new (conditional)** — measure-and-scale composable (only if the scale stage uses JS).
- `apps/arena-client/src/composables/useScaleToFit.test.ts` — **new (conditional)** — clamp-math unit test for the composable.
- `apps/arena-client/src/styles/playmat-slots.css` — **modified (conditional)** — board per-zone padding / label spacing tightened if token compaction is insufficient; frosted-panel + mask behavior preserved.
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — fit-wiring / structure-intact assertions.

Governance (not code): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24505 landed + D-24251 annotation), `docs/ai/work-packets/WORK_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `wiki/responsive-viewport-targets.md`, `docs/ai/NUMBER-LEDGER.md`.

`apps/arena-client/src/composables/useViewport.ts`, every `<PlayMobile>` file, `SchemeTile.vue` / `TopHudBar.vue`, `CardTile.vue`, all skin assets, and `packages/**` / `apps/server/**` are **NOT** in scope. This WP declares **no** `01.5` runtime-wiring file. The `useScaleToFit` composable + test and the `playmat-slots.css` edit are **conditional** (used only if the fit needs them); whichever conditional files are / are not produced is recorded in the EC at execution.

---

## Contract

- **Fit:** at an effective 1280×720 viewport the whole `<PlayDesktop>` board renders with **no page scroll** (neither axis) and nothing clipped; in-zone well / rail scroll is allowed.
- **Scale-up, never rewrap:** wider / taller screens render the **same** region arrangement scaled larger (toward ~1.5× at 1920); zones never rewrap or rearrange.
- **Board-scoped compaction:** the `--card-width-*` / spacing compaction is scoped to `.play-desktop`; the shared `:root` token values and every `<PlayMobile>` / `useViewport` file are byte-unchanged.
- **Preserved:** every WP-685 structural guarantee (grid, rail = opponents + log, full-array wells, adversary-band / HQ / cockpit regroup, occupied City place-names, HQ-adjacent Transform Deck, projection-bound denominators) still holds.
- **Invariant:** the mobile side of D-12909 (`≤767px → <PlayMobile>`) is byte-unchanged; no token/structure this WP adds is consumed by `<PlayMobile>`.

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility / readability across screen sizes — the fit makes the board usable at the smallest supported desktop viewport at last). **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` — fitting the floor improves readability and comfort; no internationalization change. **Non-Goal proximity check:** none of **NG-1..7** are crossed — a layout/readability change with **no monetization, no paid surface, no pay-to-win** vector. **Determinism preservation:** **N/A / preserved** — pure presentation over the existing read-only projection; no scoring, replay, RNG, or simulation surface is touched, and there is no engine state (Vision §22).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy is added or proposed (client presentation only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the change is client-side presentation with zero network surface.

---

## Acceptance Criteria

All items are binary pass/fail; the geometry items are observable in a browser at the stated viewport (the `?fixture=mid-turn&play=1` play route).

### Fit (D-24502 lock 1 — the open piece)
- [ ] At an effective **1280×720** viewport, the whole board renders with **no page scroll** in either axis and nothing clipped (the status reads "no page scroll"). This is the primary case this WP fixes — the 1280×720 screenshot is the evidence.
- [ ] Card names + costs are **readable** at 1280×720 (D-24502 lock 4 — the fit does not shrink cards below legibility).

### Scale-up (D-24502 lock 1)
- [ ] At **1920×1080** the *same* region layout renders **scaled up** (larger cards/gaps), zones **not** rewrapped or rearranged; at **1366×768** it holds without page scroll.

### Preserved WP-685 structure
- [ ] The opponent panels **and** the game log still render in the **right rail**, not the main column.
- [ ] A hand of **more than six** cards still renders every card and scrolls **in-zone** (no page scroll, no wrap into another zone); no `slice(` in `HandRow.vue` / `PlayedCardsRow.vue`.
- [ ] The City spaces still render in the locked L→R order `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`, occupied spaces keep their place-names; the Transform Deck renders HQ-adjacent and hides when empty.

### Boundary + gates
- [ ] At **≤767px** the surface still renders `<PlayMobile>` unchanged (`git diff --name-only` shows `useViewport.ts` and every `<PlayMobile>` file **absent**); `SchemeTile.vue` / `TopHudBar.vue` / `CardTile.vue` are **not** modified.
- [ ] The shared `:root` `--card-width-*` token **values** in `base.css` are not shrunk (compaction is `.play-desktop`-scoped).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` (plus the EC-recorded conditional files actually used) were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build + typecheck everything
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: both exit 0.

# Step 2 — arena-client suite green
pnpm --filter @legendary-arena/arena-client test
# Expected: all pass (structure-intact + any useScaleToFit clamp-math test).

# Step 3 — boundary gates
Select-String -Path "apps\arena-client\src\components\play\HandRow.vue","apps\arena-client\src\components\play\PlayedCardsRow.vue" -Pattern "slice\("
# Expected: no output (full-array binding preserved from WP-685).
git diff --name-only
# Expected: only the Files Expected to Change (+ the conditional files actually used).
# NO composables/useViewport.ts, NO PlayMobile*, NO SchemeTile.vue, NO TopHudBar.vue,
# NO CardTile.vue, NO packages/**, NO apps/server/**.

# Step 4 — LIVE (D-24026, REQUIRED): run the dev server and resize-verify
# Open <PlayDesktop> via ?fixture=mid-turn&play=1 and, at 1280x720 / 1366x768 /
# 1920x1080, confirm each Acceptance Criterion: FITS at 1280x720 with NO page
# scroll (either axis), card names/costs readable, scales UP (not rewraps) at
# 1920, right rail holds opponents+log, City names on occupied spaces, hand of
# >6 scrolls in-zone. Confirm <=767 still renders <PlayMobile>. Capture the
# 1280x720 screenshot (Tex's viewport — the case this WP fixes) as primary evidence.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; arena-client suite green.
- [ ] No files outside `## Files Expected to Change` (+ the conditional files actually used) were modified.
- [ ] `docs/ai/STATUS.md` updated — the desktop play surface now **fits** the 1280×720 floor with no page scroll and scales up (D-24502 lock 1 realized).
- [ ] `docs/ai/DECISIONS.md` — **D-24505** landed (the realized fit mechanism, per the reservation), and **D-24251** annotated **superseded on the desktop side** (the prospective D-24502 supersession is now fully realized — WP-685 structure + WP-688 fit). **D-24502** marked fully implemented.
- [ ] `wiki/responsive-viewport-targets.md` — the *Implementation status* section updated so it records the fit as shipped (Tex's sub-1366 failure now fixed).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-688 checked off with the date, **and WP-685's still-`[ ]` row reconciled** — WP-688 realizes WP-685's deferred lock 1, so WP-685 is now fully realized; close/annotate its row in the same pass (keeps the `workindex:executed:check` stale-row gate green).
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-688 node glyph `📝 → ✅` (and WP-685's node `📝 → ✅` in the same reconciliation), then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = `play.legendary-arena.com`** ⇒ **D-24026 live-on-surface verification is REQUIRED** — the fit Acceptance Criteria are confirmed in a real browser at the stated viewports (the **1280×720** screenshot — Tex's screen — is the primary evidence), not by green tests + merge alone.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (D-12909/mobile, WP-685 structure, shared tokens, SchemeTile/TopHudBar, CardTile, Undo/Heal, tablet, engine/registry/server).
- **§2 Constraints** — PASS. Engine-wide (full file contents, ESM/Vue 3, 00.6) + packet-specific (fit-no-page-scroll, scale-up-not-rewrap, board-scoped-compaction-only, readable-floor, pure-presentation, preserve-WP-685, Undo/Heal out) + session protocol (mechanism tunable live) + locked values from D-24502.
- **§3 Assumes** — PASS. WP-685 structure on main, base.css token layer, CardTile token-driven, playmat-slots.css, useViewport read-only, D-24502/D-24251 on main, D-24505 reserved, green baseline — each cites its source.
- **§4 Context (Read First)** — PASS. D-24502/24251/12909 + PlayDesktop.vue + base.css + CardTile.vue + playmat-slots.css + TurnActionBar.vue (sticky note) + useViewport.ts read-only + the ewiki status section (non-normative) + 00.6. No `00.2` reference: no card-data / setup-field change.
- **§5 Files** — PASS. 6 App-layer surfaces (2 always-modified source + 1 always-modified test + 3 conditional), bounded; no `01.5` wiring file; each marked modified/new/conditional; useViewport.ts / PlayMobile / SchemeTile / TopHudBar / CardTile / packages explicitly excluded.
- **§6 Naming** — PASS. Full-word tokens/composable (`useScaleToFit`); no 00.2 canonical field touched (no data shape).
- **§7 Dependency discipline** — PASS. **No new dependency** — plain CSS custom-property override + media queries + a DOM-geometry composable (`ResizeObserver`/`getBoundingClientRect`); no CSS framework, no layout library.
- **§8 Architectural boundaries** — PASS. App layer only; consumes the read-only `UIState`; the composable reads DOM geometry only; no runtime engine/registry/server/`boardgame.io` import added; no `G` read/write; no `UIState` field.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `git diff --name-only` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Component structure test fires under jsdom (structure-intact + composable clamp-math); layout-pixel fit/scale is verified live per D-24026 (§15.1), which jsdom cannot exercise (no layout engine) — matching WP-685 / WP-430 precedent for this surface.
- **§13 Verification** — PASS. `pnpm` build/typecheck/test + `Select-String` (no `slice(`) + `git diff` scope gate + the REQUIRED D-24026 live resize check at 1280/1366/1920 with expected observations.
- **§14 Acceptance criteria** — PASS. Binary, observable items tied to D-24502 lock 1 (fit at 1280, readable, scale-up not rewrap) + the preserved WP-685 structure + boundary gates (mobile intact, lock-8/CardTile untouched, shared tokens not shrunk, scope).
- **§15 Definition of Done** — PASS. STATUS / DECISIONS (D-24505 landed + D-24251 annotated + D-24502 fully implemented) / ewiki / WORK_INDEX / mindmap + scope check. `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 D-24026 live-on-surface verification **REQUIRED** and present (1280×720 screenshot as evidence).
- **§16 Code style** — PASS. `// why:` / `/* why: */` on the compaction-override + the scale/fit mechanism + each media query, citing D-24502; full-word names; no clever control flow.
- **§17 Vision Alignment** — PASS. §17.1 accessibility trigger addressed: `## Vision Alignment` cites §17, asserts No conflict, confirms NG-1..7 uncrossed, states determinism N/A/preserved.
- **§18 Prose-vs-grep** — PASS. The one verification grep (`slice(`) is source-file-scoped to the two well components, not a forbidden-token grep over prose.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy.
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; client presentation only.

**Lint verdict: PASS (all 21 resolved; §10/§11/§19/§20/§21 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-09-10).**

- **Sequencing / dependencies:** WP-685 / EC-722 (the spatial structure this WP fits) is on `main` (#1985); D-24502 (lock 1 — the fit) and D-24251 (the model being superseded) are on `main`; the `UIState` projections the board consumes all exist (WP-128). No engine dependency; a pure App-layer presentation tuning of an already-shipped structure.
- **Green baseline:** re-confirm `origin/main` + `pnpm -r build` / arena-client typecheck at execution.
- **Scope lock:** a bounded App-layer allowlist (2 always-modified source + 1 always-modified test + 3 conditional); no `01.5` wiring file; `git diff --name-only` is a DoD gate that explicitly excludes `useViewport.ts`, `<PlayMobile>`, `SchemeTile`/`TopHudBar`, `CardTile.vue`, the shared `:root` token values, `packages/**`, and `apps/server/**`.
- **Empirical scaffold — N/A (declared).** This is **not** a validation-tightening WP (no parser, guard, schema, or type-narrowing that could newly-reject previously-valid input) — it is presentation tuning. The only test risk (a structure assertion breaking if the page's DOM hook changes) is covered by updating `PlayDesktop.test.ts` in-scope (§E) and the full suite run in `## Verification Steps`.
- **Contract fidelity:** the anchors are locked by D-24502 (1280×720 floor, scale-up-not-rewrap); the exact compaction amount, scale mechanism (CSS-only vs. a JS measure-and-scale composable), and scale band are the operator-tunable knob refined live — not an ambiguity. The scale-ladder realization (height-binds-first, ~0.75× at 1280) is documented up front and recorded in D-24505.
- **RS-1 (clarification, non-blocking):** whether the fit needs the `useScaleToFit` JS composable or resolves via pure CSS compaction is decided live; both satisfy the geometry acceptance. The allowlist marks the composable + test + `playmat-slots.css` conditional, so either outcome stays in scope. The EC records which conditional files were used.
- **RS-2 (clarification, non-blocking):** the `transform`-scale-vs-sticky-TurnActionBar interaction (a transform ancestor is the containing block for `position: fixed`, not `sticky`) is flagged in Context; with the board fitting there is no page scroll for the sticky bar to fight, and live verification confirms the bar reads correctly.
- **PS items (blocking):** none.

## Copilot Check (01.7)

**Overall judgment: PASS (2026-09-10).** Self-audit against the 30 failure modes; the load-bearing ones:

- **Contract source** — the WP realizes an **already-landed** decision (D-24502 lock 1), so there is no reserved-decision drift risk; the locks are quoted from a merged entry. The follow-up framing is explicit (WP-685 shipped structure; this WP shipped the fit).
- **Boundary** — App-layer only; the single real hazard is the shared `--card-width-*` tokens leaking a shrink into `<PlayMobile>`. Mitigated structurally: compaction is a `.play-desktop`-scoped CSS-variable override (cascades only to the desktop board's descendants), CardTile.vue is explicitly not edited, and the shared-token-not-shrunk + `<PlayMobile>`-absent gates are Acceptance Criteria. Verified against the constraint list.
- **Test reality** — the fit/scale is a layout-pixel behavior jsdom cannot exercise (no layout engine); the WP correctly routes it to live D-24026 verification (matching WP-685 / WP-430 precedent) and keeps jsdom for structure-intact + composable clamp-math.
- **Scope realism** — small, bounded tuning of a shipped structure; the conditional files (composable/test, playmat-slots) prevent the one plausible allowlist surprise. Not split — the fit is one atomic observable outcome.
- **Lock-8 / CardTile collision** — explicitly excludes `SchemeTile`/`TopHudBar` (denominators shipped) and `CardTile.vue` (token-driven compaction instead of a component edit), preventing a cross-surface leak.

**Disposition: CONFIRM** — no BLOCK survived; the RISK-tier notes (shared-token leak, transform/sticky interaction, mechanism choice) are folded into the WP as the board-scoped-only constraint, the Context flag, and the tunable-knob + conditional-file RS clarifications. Execution authorized.

**Independent gate audit (2026-09-10):** a separate reviewer re-ran 01.4 / 01.7 / 00.3 against the WP + EC and the actual code — verdicts **READY / PASS / PASS, disposition PROCEED**. It confirmed the `.play-desktop`-scoped `--card-width-*` override inherits by computed-value cascade (so Vue `<style scoped>` `data-v-*` hashing does not block it) and that `<PlayMobile>` is a sibling subtree that cannot inherit it — no cross-surface leak. Two non-blocking hardening notes folded into the EC: pin `transform: scale()` `transform-origin: top center` (else the `margin-inline:auto` board clips at the top), and reconcile WP-685's still-`[ ]` WORK_INDEX row at execution (WP-688 realizes its deferred lock 1). Informational: the teleported `PileBrowseModal` / `CardReaderModal` keep the shared `:root` card size (full-size inspection) — intended.

---

## See Also

- **D-24502** — the eight geometry locks; lock 1 (the fit) is what this WP realizes (the authority).
- **D-24505** — the realized fit mechanism this WP records (reserved; lands at execution).
- **D-24251** — the fluid desktop model; its supersession (prospective in D-24502) is fully realized once this WP lands.
- **WP-685 / EC-722** — the spatial structure this WP fits (shipped #1985).
- **D-12909** — the 767 mobile split this WP builds above and leaves byte-unchanged.
- ewiki [Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/) *Implementation status* — the recorded "structure shipped, fit open" state this WP closes.
