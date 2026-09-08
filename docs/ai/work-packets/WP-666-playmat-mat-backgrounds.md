# WP-666 — Playmat Mat Backgrounds (Activate the Skin Selector)

**Status:** Ready
**Primary Layer:** Client UI — Play surface (`apps/arena-client/src/prefs/`, `apps/arena-client/src/composables/`, `apps/arena-client/src/components/play/`, `apps/arena-client/src/pages/PlayViewport.vue`)
**Dependencies:** WP-130 / EC-133 (the shipped-but-inert skin selector — store, manifest, applier, `<SkinSelector>`, D-13001..D-13005) ✅; WP-129 (HUD-bar slot, D-12907) ✅
**User-Visible Surface:** play.legendary-arena.com — the play board paints the selected skin's mat art behind the board, with a legibility scrim. NOT `none — infrastructure`; D-24026 live-verification applies.

---

## Session Context

WP-130 shipped the playmat skin selector end-to-end — the Pinia store, the
`localStorage` round-trip, the closed-set schema, the HUD-bar `🎨 Skin: <name> ▼`
control, and `useSkinApplier` toggling a `skin-<name>` class on the
`<PlayViewport>` root. It is **live and inert**: selecting a skin swaps the class
and persists the choice, but nothing downstream paints. Three concrete gaps,
each verified on `main` HEAD at draft time:

1. The bundled `board-background.png` / `card-frame.png` under
   `src/assets/skins/*/` are **79-byte placeholder stubs** — no real art was ever
   dropped in.
2. **Nothing consumes the skin's visuals.** The manifest exposes
   `boardBackgroundUrl` / `cardFrameUrl` and each `theme.css` defines
   `--skin-board-background` / `--skin-card-frame`, but a repo-wide grep finds
   **zero consumers** — no element reads any of them.
3. **There is no paint surface.** `.play-viewport` is `display: contents` (not a
   rendering box), and neither `<PlayDesktop>` nor `<PlayMobile>` paints a board
   background, so even a populated CSS variable would render nothing.

D-13002 already declared "board background image" to be **in** a skin's scope —
it simply shipped dormant. This packet activates it: a real full-bleed paint
layer behind the play board driven by the manifest, a legibility scrim so the
busy mat art never eats card readability, CDN-hosted mat assets so heavy JPGs
stay out of the client bundle, and an expanded curated **named-mat set** so the
selector offers more than three abstract options. Adding an actual mat is then an
operator asset-drop (upload art → add a manifest entry), mirroring the
notable-event SFX asset pipeline — code wires the manifest; art production is
out-of-band.

Art posture (locked with Jeff at draft): **ship the mechanism now with
first-party / abstract art the project owns outright; licensed Marvel / Upper
Deck mat scans are a gated drop-in, added per-mat only once the IP sign-off
clears.** The manifest carries the seam (`licensed` + `attribution`) but ships no
licensed asset in this packet.

---

## Goal

After this packet, selecting a skin in the `🎨` HUD control visibly repaints the
play board: the chosen mat's background art fills the play surface behind the
board, a scrim keeps every zone and card legible in both light and dark, and the
selector lists human-readable mat names. Mat art loads by URL
(`images.legendary-arena.com`) with a bundled fallback, so the client bundle
does not carry full-size mat images. The bundled set expands past the WP-130
three-skin lock to a curated named-mat set, with a documented, code-ready seam
for licensed mats to be added later without further engine or wiring work.
Selection NEVER affects engine state, `UIState`, replay determinism, or any
audience-filtered field — it remains client-local presentation exactly as WP-130
established.

---

## Assumes

- WP-130 / EC-133 executed and on `main` (baseline `git rev-parse origin/main` =
  `2d3e0f09` at draft). Specifically, all of the following exist and are the
  edit targets: `apps/arena-client/src/prefs/skinManifest.ts` (with the
  `SkinManifestEntry` shape + `SkinName` derived from its keys),
  `apps/arena-client/src/prefs/playmatSchema.ts` (closed set derived from
  `Object.keys(skinManifest)`), `apps/arena-client/src/prefs/playmatStore.ts`,
  `apps/arena-client/src/composables/useSkinApplier.ts`,
  `apps/arena-client/src/components/play/SkinSelector.vue`, and the three
  `apps/arena-client/src/assets/skins/{classic,comic,minimal}/theme.css`.
- `apps/arena-client/src/pages/PlayViewport.vue` invokes `useSkinApplier(viewportRoot)`
  and is the sole engine→client-independent skin host (it renders both
  `<PlayDesktop>` and `<PlayMobile>`). `.play-viewport` is `display: contents`.
- D-13001 (bundled-at-MVP discovery), D-13002 (skin scope = background + theme +
  card-frame), D-13003 (set locked at classic/comic/minimal), D-13005 (fallback
  to `'classic'`) are on `main` as recorded. This packet **supersedes** D-13001
  and D-13003 and **activates** D-13002's dormant background element via
  D-24477..D-24479; it does not rewrite the immutable prior entries.
- Card / mat images are hosted at `https://images.legendary-arena.com/` with
  hyphenated paths (per root `CLAUDE.md`, External Data). R2→CDN publishing of a
  mat asset is an operator step, not part of this code packet.
- `pnpm -r build` exits 0 and `pnpm --filter arena-client typecheck` exits 0 on
  `main` HEAD; `pnpm --filter arena-client test` baseline is green.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `.claude/rules/architecture.md §Layer Boundary` + `docs/ai/ARCHITECTURE.md
  §Layer Boundary (Authoritative)` — the skin is arena-client presentation only;
  it must not touch engine state, `UIState`, persistence, or determinism.
- `apps/arena-client/src/composables/useSkinApplier.ts` — read in full. This
  packet extends `applySkinToElement` to also set `--skin-board-image` (and the
  scrim var) from the resolved manifest entry, preserving the D-13005
  unconditional `'classic'` fallback path exactly.
- `apps/arena-client/src/prefs/skinManifest.ts` — read in full. The `SkinName`
  type derives from the manifest keys; the schema's closed set derives from the
  same keys (`playmatSchema.ts`). Adding entries updates both automatically — the
  drift test in `playmatSchema.test.ts` enforces it.
- `apps/arena-client/src/pages/PlayViewport.vue` — read in full. The new
  `<PlaymatBackground>` mounts here, at the shared viewport root, so it covers
  both `<PlayDesktop>` and `<PlayMobile>` from one host (the WP-556 `<VfxOverlay>`
  single-host precedent).
- `apps/arena-client/src/components/play/VfxOverlay.vue` — the existing
  fixed, full-bleed, `pointer-events: none` overlay precedent. `<PlaymatBackground>`
  is its mirror-image: fixed and full-bleed but painted **behind** the board
  (negative/low `z-index`) rather than above it.
- `apps/wiki-viewer/content/play-mats.md` — the mat catalogue. Reference only:
  it enumerates the real layout / art mats and states the IP posture ("Mat art is
  a skin; zone semantics live in the engine"; "Reproducing or selling mat art —
  official or fan — is a licensing question"). Do NOT bundle any mat scan from
  here in this packet.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:` comments), Rule 11 (full-sentence diagnostics), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` in client code.
- Never persist `G`, `ctx`, or any runtime engine state; never read `G.` /
  `UIState.` / `useUiStateStore` from skin code.
- ESM only, Node v22+; `node:` prefix on Node built-ins; `.test.ts` only.
- Human-style code per `00.6-code-style.md`.
- Full file contents for every new or modified file — no diffs or snippets.
- Stop and ask (do not guess) on any item the WP + EC leave genuinely ambiguous.

**Packet-specific:**
- The skin remains **client-local presentation only** (WP-130 lock, unchanged):
  no `UIState` / `G` effect, no server persistence, no socket transport, no
  influence on `computeStateHash` or replay determinism.
- The background paint layer is **decorative and inert to input**:
  `pointer-events: none`, `aria-hidden="true"`, painted **behind** the board
  (never intercepts a click, never covers a zone). It must never change the
  board's flow layout — it is a fixed full-bleed layer, not a flow element, so
  `.play-viewport`'s `display: contents` stays untouched.
- The scrim is **mandatory and always painted** over the mat image. A mat with no
  scrim is a FAIL — card/zone legibility over busy art is the whole point.
- `--skin-board-image` is set by `useSkinApplier` from the resolved manifest
  entry (supports both bundled and CDN URLs, D-24479); it is NOT hard-coded
  per-skin in `theme.css`. `theme.css` owns the scrim + palette only.
- Image resolution failure degrades exactly as D-13005 defines: fall back to
  `'classic'`, one `console.warn`. No new failure taxonomy, no image preloading /
  network probing / decode-retry / HEAD-check (still explicitly out of scope).
- The manifest stays the **single source of truth** for `SkinName`; the schema
  closed set stays derived from `Object.keys(skinManifest)`. Hand-duplicating the
  union is forbidden (the drift test enforces it).
- **No licensed mat asset ships in this packet.** Any manifest entry marked
  `licensed: true` MUST NOT reference a committed or CDN-published Marvel / UD
  scan in this WP; the field is a forward seam only.
- 01.5 NOT INVOKED for engine state (no engine touch). The one same-layer
  runtime-wiring edit is mounting `<PlaymatBackground>` in `PlayViewport.vue`.

**Locked contract values (do not paraphrase):**
- **Background CSS variable:** `--skin-board-image` (set by `useSkinApplier` to
  `url("<resolved manifest URL>")` or `none`).
- **Scrim CSS variable:** `--skin-board-scrim` (per-skin, defined in `theme.css`;
  a CSS `<color>` painted as a flat overlay above the image, below the board).
- **Paint layer class:** `playmat-background` (the fixed full-bleed leaf).
- **Default / fallback skin:** `'classic'` (unchanged, D-13003 / D-13005).
- **Selector label source:** `SkinManifestEntry.displayLabel` (human-readable),
  NOT the raw `SkinName` key.
- **CDN host for mat art:** `https://images.legendary-arena.com/` (hyphenated paths).

**The three `--skin-board-*` variables are distinct, non-overlapping roles (RS-1
disambiguation — do not collapse or confuse them):**
- `--skin-board-background` (pre-existing, WP-130) — the flat palette **ground
  colour**, painted as the base layer; it is what shows for an image-less skin.
- `--skin-board-image` (new) — the mat **image** painted over the ground; set by
  `useSkinApplier` from `boardBackgroundUrl`; `none` when the URL is `null`.
- `--skin-board-scrim` (new) — the legibility **overlay** painted above the image
  and below the board.
Paint order back→front: `--skin-board-background` → `--skin-board-image` →
`--skin-board-scrim` → board content.

**Shipped-art lock (RS-2):** every entry in this packet's pinned set uses a
**bundled, committed, first-party** image or `null` — NO entry depends on a CDN
publish to satisfy live-verification, so execution never stalls on an operator
art-drop. The CDN path (D-24479) is exercised by the mechanism but reserved for
**future** licensed/large mats. The live-verify `url(...)` proof MUST use a real
committed raster (a project-generated abstract image), never a CSS gradient
substituted for `--skin-board-image`.

---

## Scope (In)

### A) Background paint layer + scrim

- **`apps/arena-client/src/components/play/PlaymatBackground.vue`** — new — a
  fixed, full-viewport, `pointer-events: none`, `aria-hidden="true"` leaf that
  paints `background-image: var(--skin-board-image)` (`background-size: cover;
  background-position: center`) with a flat scrim overlay
  (`var(--skin-board-scrim)`) above the image and below the board. Sits at a low
  `z-index` so all board content renders over it. When `--skin-board-image`
  resolves to `none` (the `'classic'` default may intentionally carry no image),
  the layer paints only the scrim/palette ground — never a broken-image box.
- **`apps/arena-client/src/pages/PlayViewport.vue`** — modified — render
  `<PlaymatBackground />` once at the shared viewport root (the `<VfxOverlay>`
  single-host precedent), so it covers both play surfaces.

### B) Manifest wiring (`useSkinApplier` sets the image variable)

- **`apps/arena-client/src/composables/useSkinApplier.ts`** — modified —
  in `applySkinToElement`, after the class is applied, set
  `root.style.setProperty('--skin-board-image', …)` from the resolved manifest
  entry's `boardBackgroundUrl` — `url("<resolved URL>")` when it is non-null, else
  the CSS keyword `none`. The D-13005 fallback path (missing entry → `'classic'`,
  one `console.warn`) is preserved verbatim; the variable set happens only on the
  success branch, after the class swap.

### C) Manifest extension + curated named-mat set

- **`apps/arena-client/src/prefs/skinManifest.ts`** — modified — **repurpose the
  existing `boardBackgroundUrl` field** (do NOT add a parallel image field):
  widen its type from `string` to `string | null` so it carries a bundled URL, a
  CDN URL, or `null` for an image-less palette-only ground (`classic` /
  `minimal`). Add `displayLabel: string` (selector text) and the forward seam
  `licensed?: boolean` + `attribution?: string`. The legacy `cardFrameUrl` /
  `themeCssUrl` / `cssClassName` fields are unchanged. Expand the manifest past the
  three WP-130 entries to the **pinned curated named-mat set of five** first-party
  / abstract backgrounds the project owns outright (the exact keys, labels, and
  per-entry image disposition are locked in EC-703 §Locked Values — the executor
  does NOT re-derive them; Jeff may revise the set at the review pause point via a
  follow-up SPEC). `SkinName` and the schema closed set update automatically from
  the keys. Every bundled/CDN image MUST be **project-generated or project-owned**
  art — never a web-sourced or scraped image, and never a Marvel / Upper Deck scan.
- **`apps/arena-client/src/assets/skins/<skin>/theme.css`** (the three existing +
  the two new named-mat dirs) — modified/new — add `--skin-board-scrim` (and keep
  the existing palette variables). The image URL is NOT set here.
- **Board image assets** — bundled first-party/abstract art for the entries whose
  locked disposition is `bundled` (per EC §Locked Values). Entries whose
  disposition is `null` carry no image (a palette-only ground — `classic` /
  `minimal`). At least one non-`classic` skin MUST paint a real, visibly-distinct
  background so live-verification proves the pipe end-to-end. (Producing any later
  **licensed** mat is an operator asset-drop behind the IP sign-off, out of this
  packet's code scope — see Out of Scope.)

### D) Selector shows human-readable names

- **`apps/arena-client/src/components/play/SkinSelector.vue`** — modified —
  render `SkinManifestEntry.displayLabel` in the button and the overlay list
  instead of the raw `SkinName` key. Behavior (open / select / Escape / backdrop,
  empty-state chip) is unchanged.

### E) Tests

Add / extend `node:test` (`.test.ts`) coverage:
- `PlaymatBackground.test.ts` — new — renders the fixed layer; the scrim element
  is always present; the layer is `aria-hidden` and `pointer-events: none`; with
  no image variable it still renders (no broken-image).
- `useSkinApplier.test.ts` — extended — asserts `--skin-board-image` is set on the
  root from the manifest entry, and that the D-13005 fallback still sets the
  `'classic'` image (or `none`) with the single `console.warn`.
- `playmatSchema.test.ts` — the manifest↔closed-set drift test still passes with
  the expanded set (N = 5 entries), and `displayLabel`/`boardBackgroundUrl` are
  present on every entry.
- `SkinSelector.test.ts` — extended — the button/list render `displayLabel`, not
  the raw key.

### F) Decisions

Land at execution, in numeric order:
- **D-24477** — activate D-13002's board-background element: real
  `<PlaymatBackground>` paint layer + mandatory `--skin-board-scrim`. Cite that
  D-13002 already scoped the background image; this makes it real.
- **D-24478** — supersede D-13003's three-skin lock with a curated named-mat set;
  record the art posture (first-party/abstract ships now; licensed mats are a
  gated per-mat drop-in via the `licensed`/`attribution` seam) and the NG-1 note
  (mats are cosmetic — even a future premium mat is not pay-to-win).
- **D-24479** — supersede D-13001's bundled-only discovery: mat art loads by CDN
  URL (`images.legendary-arena.com`) with a bundled fallback; the repurposed
  `boardBackgroundUrl` on the manifest entry carries either. Add forward-pointer lines under the prior
  entries (the immutable text is NOT rewritten), each with the correct
  relationship: under **D-13001** "Superseded by D-24479" (bundled-only → CDN +
  bundled); under **D-13002** "Activated by D-24477" (the background element it
  scoped is now realized — NOT a supersession); under **D-13003** "Superseded by
  D-24478" (three-skin lock → curated named-mat set).

---

## Out of Scope

- No engine, registry, server, or persistence modifications. No `UIState` field
  add (this is not a projection change — the skin never travels through the
  engine→client boundary).
- No R2 / CDN publishing infrastructure or upload tooling — publishing a mat
  asset is an operator step (the notable-event SFX asset-drop precedent).
- No production of the full curated mat-art set, and **no licensed Marvel / UD
  mat scan** committed or referenced. The `licensed` seam ships unused.
- No `card-frame` image rendering — `--skin-card-frame` stays a palette variable;
  wrapping every rendered card in a skinned frame is a separate future WP.
- No animation / transition on skin swap (instant, per WP-130 / D-13002 posture).
- No server-side persistence of the selection (D-13004 unchanged), no socket
  transport, no replay-relative skin (replays render in the viewer's skin).
- No monetization / purchase surface. The set-expansion seam does not add a store,
  an unlock, or a premium tier (a future premium-mat WP would trigger the §20
  funding-surface gate explicitly).
- No refactor of `<PlayDesktop>` / `<PlayMobile>` layout beyond the board
  rendering over the new fixed background layer.

---

## Files Expected to Change

The exact list below is the allowlist; the pinned five-entry set (EC §Locked
Values) makes it enumerable. `<ext>` is the executor's chosen raster format for
the first-party art (`.png` or `.webp`), consistent across the bundled entries.

**New (7):**
- `apps/arena-client/src/components/play/PlaymatBackground.vue`
- `apps/arena-client/src/components/play/PlaymatBackground.test.ts`
- `apps/arena-client/src/assets/skins/midtown/board-background.<ext>` — new named mat art
- `apps/arena-client/src/assets/skins/midtown/theme.css` — new (`--skin-board-scrim` + palette)
- `apps/arena-client/src/assets/skins/cosmic/board-background.<ext>` — new named mat art
- `apps/arena-client/src/assets/skins/cosmic/theme.css` — new (`--skin-board-scrim` + palette)
- `apps/arena-client/src/assets/skins/comic/board-background.<ext>` — real art replacing the placeholder stub (if the executor changes the extension; else this is a Modified byte-replace)

**Modified (8):**
- `apps/arena-client/src/prefs/skinManifest.ts` — extended entry shape + the pinned five-entry set
- `apps/arena-client/src/composables/useSkinApplier.ts` — set `--skin-board-image`
- `apps/arena-client/src/composables/useSkinApplier.test.ts` — assert the variable
- `apps/arena-client/src/prefs/playmatSchema.test.ts` — drift test at the five entries
- `apps/arena-client/src/components/play/SkinSelector.vue` — render `displayLabel`
- `apps/arena-client/src/components/play/SkinSelector.test.ts` — label assertions
- `apps/arena-client/src/pages/PlayViewport.vue` — mount `<PlaymatBackground>`
- `apps/arena-client/src/assets/skins/{classic,comic,minimal}/theme.css` — add `--skin-board-scrim`

**Governance:**
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24477..D-24479 + the three
  forward-pointer lines), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

**Total projected:** ~15–17 files. No other files may be modified.

---

## Acceptance Criteria

### A — Paint layer + scrim
- [ ] `<PlaymatBackground>` renders once at the `PlayViewport` root, fixed and
      full-bleed, `pointer-events: none`, `aria-hidden="true"`, behind all board content.
- [ ] The scrim is always painted over the image; a non-`classic` skin with a real
      image keeps every board zone and hand card legible.
- [ ] With `--skin-board-image: none`, the layer renders the scrim/palette ground —
      no broken-image box, no layout shift.

### B — Manifest wiring
- [ ] `useSkinApplier` sets `--skin-board-image` on the `<PlayViewport>` root from
      the resolved manifest entry; changing the active skin repaints within one Vue tick.
- [ ] The D-13005 fallback is intact: an unresolvable skin falls back to `'classic'`
      with exactly one `console.warn`, and the image variable follows the fallback.

### C — Set + labels
- [ ] `skinManifest` carries more than three entries; `SkinName` and the schema
      closed set derive from the keys with no hand-duplicated union (drift test green).
- [ ] Every entry has `displayLabel` and `boardBackgroundUrl` (URL or `null`); the
      selector renders `displayLabel`, not the raw key.
- [ ] At least one bundled/CDN entry paints a real, visibly-distinct background.
- [ ] No entry marked `licensed: true` references a committed or CDN Marvel/UD asset.

### D — Layer boundary + determinism
- [ ] No engine/registry/server/persistence file modified (verified by `git diff`).
- [ ] No `G.` / `UIState.` / `useUiStateStore` / socket / `boardgame.io` reference in
      skin code (verified by `Select-String`).
- [ ] No new `UIState` field; `computeStateHash` untouched; N/A determinism at the engine layer.

### E — Decisions + tests
- [ ] D-24477..D-24479 inserted in numeric order with rationale + rejected
      alternatives + the supersession pointers under D-13001/13002/13003.
- [ ] `pnpm --filter arena-client test` exits 0; baseline grows (≥6 new assertions
      across `PlaymatBackground` + `useSkinApplier` + `SkinSelector`).
- [ ] `pnpm --filter arena-client typecheck` exits 0.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build + typecheck + tests
pnpm -r build
pnpm --filter arena-client typecheck    # vue-tsc --noEmit; exits 0
pnpm --filter arena-client test         # exits 0, baseline grows

# Step 2 — no engine/game-state coupling in skin code
Select-String -Path "apps\arena-client\src\prefs","apps\arena-client\src\composables\useSkinApplier.ts","apps\arena-client\src\components\play\PlaymatBackground.vue","apps\arena-client\src\components\play\SkinSelector.vue" -Pattern "useUiStateStore|UIState\.|(^|[^A-Za-z])G\.|boardgame\.io|submitMove" -Recurse
# Expected: no output

# Step 3 — no licensed asset referenced
Select-String -Path "apps\arena-client\src\prefs\skinManifest.ts" -Pattern "licensed:\s*true" 
# Then manually confirm no such entry points at a committed/CDN Marvel/UD scan.

# Step 4 — scope-locked layers untouched
git diff --name-only packages/ apps/server apps/registry-viewer apps/replay-producer
# Expected: no output

# Step 5 — LIVE on surface (D-24026): after deploy, on play.legendary-arena.com,
# open a match, click 🎨, pick a non-classic mat.
# Expected: the board background repaints to that mat's art; cards/zones stay legible;
# reload persists the choice (localStorage). Capture a screenshot for STATUS.
```

---

## Vision Alignment

§3 (Player Trust & Fairness): preserved — skin selection has zero engine-state
effect; replay determinism untouched (no `UIState` field, no hash surface).
§4 (Faithful Multiplayer Experience): aligned — the background is visual chrome;
cooperative posture and zone semantics are unchanged (the engine still owns the
board). §11 (Stateless Client Philosophy): aligned — skin stays client-local,
never round-trips to the server. §14 (Explicit Decisions): D-24477..D-24479
surface every choice and record the supersession of D-13001 / D-13003.
NG-1 (no pay-to-win): **not crossed** — mats are cosmetic; even a future premium
mat cannot buy a game outcome. This packet introduces no purchase surface.
**§20 Funding Surface Gate: N/A** with justification — no funding affordance is
added; the `licensed`/set-expansion seam is a wiring convenience, not a store.
A future premium-mat WP would trigger §20 explicitly. **§21 API Catalog: N/A**
(no `apps/server/**` touched). **Determinism preservation:** N/A at the engine
layer (no engine touch); replay/skin separation preserved from WP-130.

---

## Lint Gate Self-Review

Ran the `00.3-prompt-lint-checklist.md` gate against this WP (independent
reviewer, 2026-09-07). **All 21 sections PASS or are N/A with justification.**
Key dispositions: §8 (Architectural Boundaries) PASS — client-only, no
engine/registry/server/persistence, no `G`/`UIState`/socket, verified by a scoped
grep step. §10 (Env) / §11 (Auth) N/A — no env var, no auth surface. §17 (Vision)
PASS — NG-1 "not crossed" (cosmetic, no pay-to-win), determinism-preservation
line present. §20 (Funding Surface) N/A-justified — no funding affordance; the
`licensed`/set-expansion seam is a wiring convenience, and a future premium-mat WP
would trigger §20 explicitly (does not trip the "propose-future-funding-while-N/A"
row — monetization is deferred, not proposed here). §21 (API Catalog) N/A — no
`apps/server/**` touched (Verification Step 4 asserts it). §18 (prose-vs-grep) —
the executor keeps the `// why:` comments from spelling out `boardgame.io` /
`UIState.` / `G.` verbatim so Verification Step 2's literal grep does not self-trip
(carried into EC §Common Failure Smells).

Pre-flight (`01.4`): **READY** (all load-bearing codebase claims verified true —
79-byte stubs, zero variable consumers, `.play-viewport` `display:contents`,
D-13005 shape; PS-1..3 index rows added, RS-1 `boardBackgroundUrl`-repurpose +
RS-2 bundled-art lock applied). Copilot (`01.7`): **RISK→resolved** — the three
scope-neutral fixes (EC governance-file allowlist, pinned five-entry set, D-13002
"Activated not Superseded") applied in-place.

---

## Definition of Done

- [ ] All §Acceptance Criteria pass.
- [ ] `pnpm -r build`, `pnpm --filter arena-client typecheck`, and
      `pnpm --filter arena-client test` all exit 0.
- [ ] D-24477..D-24479 inserted; supersession pointers added under D-13001/13002/13003.
- [ ] STATUS.md `### WP-666 / EC-703 Executed` block, incl. the live-on-surface
      screenshot evidence (D-24026 — surface is NOT infrastructure-only).
- [ ] WORK_INDEX.md WP-666 row flipped `[x]` with date; EC_INDEX.md EC-703 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝`→`✅`; `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] 01.6 post-mortem OPTIONAL — additive client presentation on the established
      WP-130 skin subsystem; no new long-lived cross-cutting abstraction.
- [ ] `EC-703:` implementation commit + `SPEC:` governance-close commit (two-commit topology).
