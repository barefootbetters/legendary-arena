# WP-685 — Play-Surface Spatial Rebuild (`<PlayDesktop>` → fixed 1280×720 authoring-grid board)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; presentation only (CSS + template restructure). **Zero engine / registry / server / determinism / persistence footprint** (consumes the existing read-only `UIState` projection; no `G`, no new `UIState` field, no `finalStateHash` surface).
**User-Visible Surface:** `play.legendary-arena.com` — the desktop play surface (`<PlayDesktop>`). Directly observable in a real match / the `?fixture=` play route.

> Baseline: re-baseline to current `origin/main` at execution and cite `git rev-parse origin/main` in the execution session.

---

## Session Context

WP-129 established the `<PlayViewport>` → `<PlayDesktop>` / `<PlayMobile>` split and the D-12909 767px mobile breakpoint; WP-430 / D-24251 added fluid desktop scaling (1600px cap + `clamp()` card/gutter tokens) *on top of* the vertical stack; **D-24502** (landed 2026-09-09) ratifies the spatial-board rebuild this packet implements, prospectively superseding D-24251's desktop model.

---

## Goal

After this session, `<PlayDesktop>` is a **fixed-geometry spatial board authored at a 1280×720 grid**, not a fluid vertical flex stack. The board lays its zones into named grid regions — an adversary band (Mastermind + Scheme + shared supply/KO/escaped), the City battle-line, the H.Q. shop, and the player cockpit — with the opponent panels and game log moved into a **right rail**. The whole board is authored to a **1280×720 grid and scaled up** (1.00× at 1280, ~1.07× at 1366, 1.50× at 1920; letterbox toward 0.90× below 1280) so it holds at the smallest supported desktop viewport at 1:1 and grows without rewrapping. The hand and in-play rows become **horizontally-scrolling wells bound to the full `handCards` / `inPlayCards` arrays** (never sliced to a fixed count); playing a card lands it in the in-play well. This implements the eight D-24502 geometry locks (lock 8, projection-bound twist/tactics denominators, already shipped separately). No engine change, no `UIState` field, no new dependency. The D-12909 767px mobile split and `<PlayMobile>` are **not touched**.

---

## User-Visible Impact

On the game surface: a player on a **1280×720** effective viewport (e.g. a 1080p monitor at 150% browser zoom — the resolution that horizontal-scrolls and packs past the fold on the current fluid stack) sees the **whole board fit at 1:1 with no page scroll**. A player on a 1920 monitor sees the *same* board scaled 1.5× larger, not a different wrapped layout. The board reads like a real Legendary mat — fixed regions in the physical arrangement — with the opponent panels and game log in a slim right rail rather than stacked into the main column. Hands larger than six cards (draw effects, extra turns) **scroll horizontally inside the hand well** instead of wrapping into other zones. This resolves the sub-1366px failure documented on the ewiki [Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/) page (the Rev 1–4 `play-mat-redesign` mocks are its non-normative design record).

---

## Assumes

- `apps/arena-client/src/pages/PlayDesktop.vue` (WP-129 / D-12901 / D-12902) renders `.play-desktop` as a `display: flex; flex-direction: column` stack of rows (info-row, top-row, city, hq, player-zone) with the WP-430 / D-24251 `max-width: 1600px; margin-inline: auto` cap. This is the container rebuilt into a fixed grid.
- `apps/arena-client/src/styles/base.css` (WP-007a / WP-430) holds the `:root` size-token layer (`--play-max-width`, `--play-gutter`, `--card-width-*`); its "no raw hex" rule is **color-only**, so new **size** tokens (the authoring-grid width/height + scale) are permitted here.
- `apps/arena-client/src/styles/playmat-slots.css` (WP-666 / EC-703) is the global frosted-panel "layout mat" layer, loaded by `<PlayViewport>`, that styles the zone boxes over the skin background. It is re-anchored to the new grid regions.
- `apps/arena-client/src/components/play/HandRow.vue` and `PlayedCardsRow.vue` render the projected `handCards` / `inPlayCards` (with their `*Display` maps). The executor MUST confirm their current rendering (whether any `slice` caps the count) and make each an in-zone horizontally-scrolling well bound to the **full** array.
- `apps/arena-client/src/components/play/CityRow.vue` renders the five City spaces + Villain Deck in the locked visual order; occupied spaces must keep their place-name label.
- `apps/arena-client/src/components/play/OpponentPanel.vue` and `apps/arena-client/src/components/log/GameLogPanel.vue` exist and are moved (as-is) into the right rail — no change to their internals.
- `apps/arena-client/src/composables/useViewport.ts` (D-12909) owns `BREAKPOINT_MOBILE_MAX_PX = 767`. Read for context ONLY and **NOT modified** — this rebuild is the desktop side above 768px; the mobile split is untouched.
- `docs/ai/DECISIONS.md` **D-24502** is on `main` (the ratified geometry this WP implements). The twist/tactics denominator fix (D-24502 lock 8) already shipped separately and is not part of this WP.
- `pnpm -r build` exits 0 and `pnpm --filter arena-client typecheck` (vue-tsc) passes on the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24502** (the eight geometry locks this WP implements, verbatim), **D-24251** (the fluid model this supersedes on the desktop side — mark it superseded at execution), **D-12909** (the 767 split, unchanged), **D-12901 / D-12902** (zone placement / opponents-top-edge — the rebuild keeps the same *zones*, in a fixed spatial arrangement).
- `apps/arena-client/src/pages/PlayDesktop.vue` — read the whole template + `<style scoped>` before rebuilding; note the current row structure and which child components mount where.
- `apps/arena-client/src/styles/base.css` — the `:root` size-token home; add the authoring-grid + scale tokens here.
- `apps/arena-client/src/styles/playmat-slots.css` — the frosted-panel selectors to re-anchor to the new grid regions.
- `apps/arena-client/src/components/play/{HandRow,PlayedCardsRow,CityRow}.vue` — the zone leaves this WP changes; read their current array binding and CSS first.
- `apps/arena-client/src/composables/useViewport.ts` — read ONLY, to confirm the D-12909 767 split is the sole breakpoint and this WP does not touch it.
- `docs/ai/DESIGN-BOARD-LAYOUT.md` §3.1 — the desktop wireframe + the **locked City column order** (2026-05-03 reviewer lock): `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`, and the note that villain *advance direction* (Villain-Deck → … → escape off Bridge) is the **reverse** of the column order — label the two separately so nobody swaps Streets and Rooftops.
- `wiki/responsive-viewport-targets.md` + the `ewiki/responsive-viewport-targets/play-mat-redesign01..04.jpg` mocks — the **non-normative** design record (Rev 4 is the lock mock). Descriptive input only; D-24502 is the authority.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` / `/* why: */` comments), Rule 14 (canonical field names).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only; Node v22+; Vue 3 SFCs; any test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Implements D-24502 exactly.** The eight geometry locks are the contract; do not re-derive or "improve" them. Lock 8 (projection-bound denominators) already shipped — do not re-touch `SchemeTile` / `TopHudBar`.
- **Additive to D-12909, never a change to it.** `useViewport.ts`, `BREAKPOINT_MOBILE_MAX_PX = 767`, and the entire `<PlayMobile>` layout are **out of scope and unmodified**. If any edit touches the 767 breakpoint or the mobile surface, STOP — that is a different WP.
- **Pure presentation.** No `G` read/write, no `ctx`, no new `UIState` field, no persistence, no `finalStateHash` sentinel. No runtime `@legendary-arena/registry`, `game-engine` (beyond the existing type-only imports), `server`, `pg`, or `boardgame.io` import is added.
- **Scale-to-fit, never reflow.** The board is authored at the 1280×720 grid and scaled by a transform / scale factor; zones do not rewrap or rearrange across the resolution ladder. No content is clipped; no horizontal *page* scrollbar at any supported width (in-zone hand/in-play scroll is expected and allowed — the status must read "no page scroll", not "no scroll").
- **Full-array binding.** The hand and in-play wells bind the **entire** `handCards` / `inPlayCards` arrays. `slice(0, 6)` (or any fixed-count cap) is forbidden — Legendary hands routinely exceed six. Overflow scrolls horizontally inside the well with a `+N`/peek affordance; cards never shrink below a readable name + cost.
- **Locked City order, names kept when occupied.** Visual L→R: `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`; an occupied space still shows its place-name.
- **Undo and Heal Wound are OUT of scope** (D-24502 §Out of scope). Do not add either control in this WP.

**Session protocol:** if any locked value or the current binding of a zone leaf is unclear, stop and confirm against the source — never guess a field name or invent a slice.

**Locked contract values (from D-24502 — do not re-derive):**
- **Authoring grid:** `1280 × 720` at scale `1.00×`. `1366×768` → `~1.07×` (or a wider gutter); `1920×1080` → `1.50×`. Below `1280`, letterbox toward `0.90×`, then the D-12909 `<PlayMobile>` composer at `≤767px`.
- **Right rail** owns the opponent panels + game log; the shared board + cockpit keep the center.
- **City visual order:** `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck` (advance direction is the reverse).
- **Cockpit:** hand + in-play bind the full projected arrays, in-zone horizontal scroll + `+N` peek, never `slice(0,6)`; click-to-play lands a card in the in-play well until cleanup; the empty in-play well shows a dashed target, disabled off-turn / off-`main`. Draw-6 is cleanup size, not a hand cap.
- **Transform Deck** stays HQ-adjacent (overflow rail right of the H.Q.) and hides when empty (WP-664, unchanged behavior — re-anchored into the new grid).
- **Unchanged:** `BREAKPOINT_MOBILE_MAX_PX = 767` (D-12909), `useViewport.ts`, `<PlayMobile>`, the skin assets, the *zones themselves* (only their spatial arrangement changes).

> **Design-review note.** The **anchors are locked** by D-24502: the 1280×720 authoring grid, the 1.00/1.07/1.50 scale ladder, the right-rail placement, the locked City order, full-array well binding, click-to-play landing, HQ-adjacent Transform Deck. The **exact grid track sizes, the scale-implementation mechanism (a `transform: scale()` on the board vs. a fluid grid that resolves to the same result), and the precise `clamp()`/gap curves** are the operator-tunable knob, refined live against `## Verification Steps` — they do not change the acceptance criteria, which are geometry/behavior observations, not specific pixel counts.

---

## Scope (In)

### A) Authoring-grid + scale tokens (`apps/arena-client/src/styles/base.css`, **modified**)
- Under `:root`, add the authoring-grid size tokens (grid width `1280px`, height `720px`, and the scale-ladder support the implementation needs), each with a `/* why: */` citing D-24502. Size values only — no color, no raw hex.

### B) Board grid + scale + rail (`apps/arena-client/src/pages/PlayDesktop.vue`, **modified**)
- Rebuild the template from the flex-column stack into named grid regions: HUD, adversary band (Mastermind + Scheme + shared supply/KO/escaped), City battle-line, H.Q. shop (+ Transform Deck rail), player cockpit (played + hand + economy + your piles), and a **right rail** holding the opponent panels + game log. The same child components mount; only their placement changes.
- Apply the authoring-grid + scale-to-fit mechanism and the resolution-ladder media policy (1.00/1.07/1.50, letterbox below 1280). Each `// why:` / `/* why: */` cites D-24502.
- The `<PlayMobile>` discriminator (D-12909) is untouched; this file only owns the desktop branch.

### C) Cockpit wells (`HandRow.vue`, `PlayedCardsRow.vue`, **modified**)
- Bind the **full** `handCards` / `inPlayCards` arrays (remove any fixed-count slice if present). Make each an in-zone horizontally-scrolling well with a `+N`/peek affordance and a readable minimum card size. The in-play well shows a dashed "play here" target when empty (disabled off-turn / off-`main`).

### D) Frosted-panel re-anchor (`apps/arena-client/src/styles/playmat-slots.css`, **modified**)
- Re-point the frosted-panel selectors to the new grid regions so every zone still reads as a labeled slot floating over the skin, and the text-protection mask still covers the HUD / turn bar / log (WP-666 behavior preserved).

### E) City occupied place-names (`apps/arena-client/src/components/play/CityRow.vue`, **modified**)
- Ensure an occupied City space keeps its place-name label (in the locked order), not only the empty-slot placeholder.

### F) Tests (`*.test.ts` for the changed files, **modified/new**)
- Update `PlayDesktop.test.ts` for the new region structure (assert the zones render and the right rail holds opponents + log). Update / add `HandRow.test.ts` / `PlayedCardsRow.test.ts` to assert **the full array renders** (a >6-card hand renders all its cards; no slice) and the empty in-play well shows the disabled target. Update `CityRow.test.ts` to assert an occupied space keeps its place-name.

---

## Out of Scope

- **The D-12909 767px breakpoint, `useViewport.ts`, and the entire `<PlayMobile>` layout** — untouched. Mobile portrait is not this mat scaled; it stays its own composer.
- **Undo** — a new cross-layer feature (D-24502 §Out of scope); its own decision + WP.
- **The Heal Wound turn-bar control** — a conditional surface of the shipped `healWounds` (D-24502 §Out of scope); its own follow-on.
- **The pending-choice host refactor** (collapsing the ~19 prompt siblings) — a separate maintainability WP.
- **A tablet composer** (768–1279 band) — a separate WP.
- **The twist/tactics denominator fix** — already shipped (D-24502 lock 8); do not re-touch `SchemeTile` / `TopHudBar`.
- **Any engine / registry / server change** — no `G`, no `UIState` field, no persistence, no `finalStateHash` re-pin, no HTTP endpoint.
- Refactors / cleanups not listed in Scope (In).

---

## Files Expected to Change

**Arena-client (App layer):**
- `apps/arena-client/src/styles/base.css` — **modified** — authoring-grid + scale size tokens under `:root`.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — the flex-stack → fixed grid regions + right rail + scale-to-fit + resolution-ladder media policy.
- `apps/arena-client/src/styles/playmat-slots.css` — **modified** — frosted-panel selectors re-anchored to the new regions; text-protection mask preserved.
- `apps/arena-client/src/components/play/HandRow.vue` — **modified** — full-array scrolling well.
- `apps/arena-client/src/components/play/PlayedCardsRow.vue` — **modified** — full-array in-play well + empty dashed target.
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — occupied place-names.
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — new region structure + right-rail assertions.
- `apps/arena-client/src/components/play/HandRow.test.ts` — **modified/new** — >6-card hand renders all cards, no slice.
- `apps/arena-client/src/components/play/PlayedCardsRow.test.ts` — **modified/new** — full array + empty-well target.
- `apps/arena-client/src/components/play/CityRow.test.ts` — **modified** — occupied place-name assertion.

`apps/arena-client/src/composables/useViewport.ts`, every `<PlayMobile>` file, `SchemeTile.vue` / `TopHudBar.vue` (lock 8, already done), all skin assets, and `packages/**` / `apps/server/**` are **NOT** in scope. This WP declares **no** `01.5` runtime-wiring file — all targets are existing styled/tested surfaces. If the executor finds the rebuild needs a small extracted component (e.g. a `PlayRail` wrapper) to keep `PlayDesktop.vue` under a reasonable size, that is an allowlist amendment recorded in the EC, still App-layer, still no new contract.

---

## Contract

- **Authoring grid:** the board is authored at `1280×720` and scaled to the viewport; zones occupy fixed named grid regions and never rewrap. `1.00×` at 1280, `~1.07×` at 1366, `1.50×` at 1920; letterbox toward `0.90×` below 1280, then `<PlayMobile>` at ≤767.
- **Right rail:** opponent panels + game log render in a rail beside the shared board / cockpit, not in the main column.
- **City order (locked):** `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`; occupied spaces keep place-names.
- **Cockpit wells:** hand + in-play bind the full `handCards` / `inPlayCards`; in-zone horizontal scroll; no `slice`. Click-to-play lands a card in the in-play well until cleanup; empty in-play well shows a disabled dashed target off-turn / off-`main`.
- **Invariant:** the mobile side of D-12909 (`≤767px → <PlayMobile>`) is byte-unchanged; no token/structure this WP adds is consumed by `<PlayMobile>`.

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility / readability across screen sizes — the rebuild makes the board fit the smallest supported desktop viewport at 1:1). **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` — a fit-to-floor board improves readability and comfort; no internationalization change. **Non-Goal proximity check:** none of **NG-1..7** are crossed — a layout/readability change with **no monetization, no paid surface, no pay-to-win** vector. **Determinism preservation:** **N/A / preserved** — pure presentation over the existing read-only projection; no scoring, replay, RNG, or simulation surface is touched, and there is no engine state (Vision §22).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy is added or proposed (client presentation only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the change is client-side presentation with zero network surface.

---

## Acceptance Criteria

All items are binary pass/fail; the geometry items are observable in a browser at the stated viewport (the `?fixture=` play route).

### Geometry (D-24502 locks 1–3, 7)
- [ ] At an effective **1280×720** viewport, the whole board renders with **no horizontal page scroll** and nothing clipped (the status pill reads "no page scroll").
- [ ] At **1920×1080** the *same* region layout renders scaled up (~1.5×), zones **not** rewrapped or rearranged; at **1366×768** it holds without page scroll.
- [ ] The opponent panels **and** the game log render in the **right rail**, not in the main board column.
- [ ] The City spaces render in the locked L→R order `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`, and an **occupied** space shows its place-name.
- [ ] The Transform Deck renders HQ-adjacent and is **hidden when the transform deck is empty**.

### Cockpit (D-24502 locks 4–6)
- [ ] A hand of **more than six** cards renders **every** card (asserted in `HandRow.test.ts`); overflow scrolls horizontally **inside the hand well** without wrapping into another zone. No `slice(` appears in `HandRow.vue` / `PlayedCardsRow.vue` (confirmed with `Select-String`).
- [ ] The in-play well renders the full `inPlayCards`; when empty it shows a dashed "play here" target that is **disabled** off-turn / off-`main`.

### Boundary + gates
- [ ] At **≤767px** the surface still renders `<PlayMobile>` unchanged (`git diff --name-only` shows `useViewport.ts` and every `<PlayMobile>` file **absent**).
- [ ] `SchemeTile.vue` / `TopHudBar.vue` are **not** modified (lock 8 already shipped; confirmed with `git diff --name-only`).
- [ ] `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` (plus any EC-recorded allowlist amendment) were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build + typecheck everything
pnpm -r build
pnpm --filter arena-client typecheck
# Expected: both exit 0.

# Step 2 — arena-client suite green (tests updated for the new structure)
pnpm --filter arena-client test
# Expected: all pass; the hand/in-play/city/PlayDesktop tests assert the new behavior.

# Step 3 — no fixed-count slice on the wells; lock-8 files untouched
Select-String -Path "apps\arena-client\src\components\play\HandRow.vue","apps\arena-client\src\components\play\PlayedCardsRow.vue" -Pattern "slice\("
# Expected: no output (full-array binding).
git diff --name-only
# Expected: only the Files Expected to Change (+ any EC-recorded amendment).
# NO composables/useViewport.ts, NO PlayMobile*, NO SchemeTile.vue, NO TopHudBar.vue,
# NO packages/**, NO apps/server/**.

# Step 4 — LIVE (D-24026, REQUIRED): run the dev server and resize-verify
# Open <PlayDesktop> via the ?fixture=mid-turn&play=1 dev route and, at
# 1280x720 / 1366x768 / 1920x1080, confirm each geometry Acceptance Criterion:
# fits at 1280x720 with no page scroll, scales up (not rewraps) at 1920, right
# rail holds opponents+log, City names on occupied spaces, hand of >6 scrolls
# in-zone. Confirm <=767 still renders <PlayMobile>. Capture a 1280x720 screenshot
# (Tex's viewport — the case this WP fixes) as the primary evidence.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; arena-client suite green.
- [ ] No files outside `## Files Expected to Change` (+ EC-recorded amendment) were modified.
- [ ] `docs/ai/STATUS.md` updated — the desktop play surface is a fixed 1280×720 spatial board that fits the smallest supported viewport at 1:1 and scales up.
- [ ] `docs/ai/DECISIONS.md` — **D-24502** flipped to reflect the shipped implementation, and **D-24251** annotated as **superseded on the desktop side** by the landed rebuild (the prospective supersession in D-24502 is now realized).
- [ ] `wiki/responsive-viewport-targets.md` — the *Fluid desktop scaling* section is updated so the ewiki page and the code no longer disagree (the fixed-grid board is now the shipped desktop model).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-685 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-685 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = `play.legendary-arena.com`** ⇒ **D-24026 live-on-surface verification is REQUIRED** — the geometry Acceptance Criteria are confirmed in a real browser at the stated viewports (the **1280×720** screenshot — Tex's screen — is the primary evidence), not by green tests + merge alone.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (D-12909/mobile, Undo, Heal Wound, pending-choice host, tablet composer, denominator fix, engine/registry/server).
- **§2 Constraints** — PASS. Engine-wide (full file contents, ESM/Vue 3, 00.6) + packet-specific (implements-D-24502-exactly, additive-to-D-12909, pure presentation, scale-not-reflow, full-array binding, locked City order, Undo/Heal out) + session protocol + locked values from D-24502.
- **§3 Assumes** — PASS. PlayDesktop.vue stack, base.css token layer, playmat-slots.css, the zone leaves, useViewport.ts read-only, D-24502 on main, green baseline — each cites its source WP/decision.
- **§4 Context (Read First)** — PASS. D-24502/24251/12909/12901/12902 + PlayDesktop.vue + base.css + playmat-slots.css + the zone leaves + useViewport.ts read-only + DESIGN-BOARD-LAYOUT §3.1 + the ewiki page/mocks (non-normative) + 00.6. No `00.2` reference: no card-data / setup-field change.
- **§5 Files** — PASS. 10 App-layer surfaces (6 source + 4 test), bounded; no `01.5` wiring file; each marked modified/new; useViewport.ts / PlayMobile / SchemeTile / TopHudBar / packages explicitly excluded; a possible `PlayRail` extraction pre-authorized as an EC-recorded amendment (App-layer, no contract).
- **§6 Naming** — PASS. Full-word tokens/regions; no 00.2 canonical field touched (no data shape).
- **§7 Dependency discipline** — PASS. **No new dependency** — plain CSS grid/transform + media queries; container queries / CSS frameworks not used.
- **§8 Architectural boundaries** — PASS. App layer only; consumes the read-only `UIState`; no runtime engine/registry/server/`boardgame.io` import added; no `G` read/write; no `UIState` field.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `git diff --name-only` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Component tests DO fire here (jsdom mounts the SFCs and asserts rendered structure / full-array rendering / disabled target — not layout pixels): `HandRow`/`PlayedCardsRow`/`CityRow`/`PlayDesktop` tests updated. Layout-pixel behavior (scale/fit) is verified live per D-24026 (§15.1).
- **§13 Verification** — PASS. `pnpm` build/typecheck/test + `Select-String` (no `slice(`) + `git diff` scope gate + the REQUIRED D-24026 live resize check at 1280/1366/1920 with expected observations.
- **§14 Acceptance criteria** — PASS. Binary, observable items tied to D-24502 locks 1–7 (fit at 1280, scale-up not rewrap, right rail, City order + occupied names, Transform hide-empty, full-array hand, in-play target, mobile intact, lock-8 files untouched, gates, scope).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS(D-24502 realized + D-24251 superseded)/ewiki/WORK_INDEX/mindmap + scope check. `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 D-24026 live-on-surface verification **REQUIRED** and present (1280×720 screenshot as evidence).
- **§16 Code style** — PASS. `// why:` / `/* why: */` on the non-obvious grid/scale anchors, each citing D-24502; full-word names; no clever control flow.
- **§17 Vision Alignment** — PASS. §17.1 accessibility trigger addressed: `## Vision Alignment` cites §17, asserts No conflict, confirms NG-1..7 uncrossed, states determinism N/A/preserved.
- **§18 Prose-vs-grep** — PASS. The one verification grep (`slice(`) is source-file-scoped to the two well components, not a forbidden-token grep over prose.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy.
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; client presentation only.

**Lint verdict: PASS (all 21 resolved; §10/§11/§19/§20/§21 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-09-10).**

- **Sequencing / dependencies:** WP-129 (`<PlayDesktop>` + the D-12909 split), WP-430 / D-24251 (the base.css token layer + the current cap), WP-666 (playmat-slots.css frosted layer), WP-128 (the `UIState` projections the board consumes), and **D-24502** (the ratified geometry) are all on `main`. The twist/tactics denominator fix (lock 8) has shipped. No engine dependency; a pure App-layer presentation rebuild.
- **Green baseline:** re-confirm `origin/main` at execution.
- **Scope lock:** a bounded App-layer allowlist (6 source + 4 test); no `01.5` wiring file; `git diff --name-only` is a DoD gate that explicitly excludes `useViewport.ts`, `<PlayMobile>`, `SchemeTile`/`TopHudBar`, `packages/**`, and `apps/server/**`. A single `PlayRail` extraction is pre-authorized as an EC amendment (App-layer, no contract), so the one plausible allowlist growth does not surprise execution.
- **Empirical scaffold — N/A (declared).** This is **not** a validation-tightening WP (no parser, guard, schema, or type-narrowing that could newly-reject previously-valid input) — it is presentation restructure. The risk it *does* carry (a template rebuild breaking the mounted-structure tests) is covered by updating those tests in-scope (§F) and the full suite run in `## Verification Steps`.
- **Contract fidelity:** the anchors are locked by D-24502 (1280×720 grid, 1.00/1.07/1.50 ladder, right rail, City order, full-array wells, click-to-play landing, HQ-adjacent Transform Deck); the exact track sizes / scale mechanism / gap curves are the operator-tunable knob, refined live — not an ambiguity.
- **RS-1 (clarification, non-blocking):** the scale mechanism (a `transform: scale()` on a fixed 1280×720 board vs. a fluid grid resolving to the same fit) is an implementation choice left to execution; both satisfy the acceptance criteria (geometry/behavior, not a specific mechanism). Pick one and note it in the EC.
- **RS-2 (clarification, non-blocking):** whether `PlayDesktop.vue` stays one file or extracts a `PlayRail` is left to execution size judgment; pre-authorized as an EC amendment.
- **PS items (blocking):** none.

## Copilot Check (01.7)

**Overall judgment: PASS (2026-09-10).** Self-audit against the 30 failure modes; the load-bearing ones:

- **Scope realism** — the largest risk is scope *size*, not boundary crossing: a full `PlayDesktop.vue` template rebuild is a big single-file change. Mitigated by (a) keeping the same child components (only their placement changes), (b) the pre-authorized `PlayRail` extraction, and (c) tests updated in-scope. Not split into sub-WPs because the geometry is one atomic change — a half-built grid (rail without regions, or wells without the grid) is a broken intermediate, not a shippable increment.
- **Contract source** — the WP implements an **already-landed** decision (D-24502), so there is no reserved-decision drift risk; the locks are quoted from a merged entry, not invented here.
- **Boundary** — App-layer only; no engine/registry/server/`boardgame.io`/`G`/`UIState` surface; the `UIState` fields consumed all exist (WP-128). Verified against the constraint list.
- **Test reality** — component structure tests fire under jsdom (the WP asserts rendered structure + full-array rendering, not layout pixels); the scale/fit is live-verified per D-24026, matching WP-430's precedent for this surface.
- **Lock-8 collision** — explicitly excludes `SchemeTile`/`TopHudBar` (the denominator fix already shipped), preventing a double-touch.

**Disposition: CONFIRM** — no BLOCK survived; the two RISK-tier notes (scope size, scale mechanism) are folded into the WP as the tunable knob + the pre-authorized amendment + the RS clarifications. Execution authorized.

---

## See Also

- **D-24502** — the eight geometry locks this WP implements (the authority).
- **D-24251** — the fluid desktop model this rebuild supersedes on the desktop side.
- **D-12909** — the 767 mobile split this WP builds above and leaves unchanged.
- **D-12901 / D-12902** — the zones (kept) whose spatial arrangement this WP fixes.
- `docs/ai/DESIGN-BOARD-LAYOUT.md` §3.1 — the desktop wireframe + locked City order.
- ewiki [Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/) + the `play-mat-redesign01..04` mocks — the non-normative design record (Rev 4 = lock mock).
