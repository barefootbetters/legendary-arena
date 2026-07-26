# WP-430 — Fluid Desktop Responsive Scaling for the Play Surface

**Status:** Ready — design approved by the operator 2026-07-25; promoted to FULL (EC-465 authored, session prompt written, pre-flight READY, copilot PASS). Executable per EC-465.
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; pure CSS / presentation. **Zero engine / registry / server / determinism / persistence footprint** (no `G`, no `UIState` field, no `finalStateHash` surface).
**User-Visible Surface:** `play.legendary-arena.com` — the desktop play surface (`<PlayDesktop>`). The change is directly observable on a wide monitor.

> Baseline: `origin/main` at commit `43a5fcf8` (PR #1020 — WP-428 transport-diagnostics execution merged). Re-baseline to current `origin/main` at execution.

---

## Goal

After this session, the desktop play surface (`<PlayDesktop>`) **scales fluidly
across the desktop resolution ladder and stops sprawling on ultra-wide / 4K
monitors.** Two things change, both pure CSS: (1) the `.play-desktop` container
gains a **centered max-width cap** (`--play-max-width: 1600px`, `margin-inline:
auto`) so beyond the cap the board gains **margin, not oversized cards**; (2)
card tiles and the container gutter become **fluid** (`clamp()`-driven size
tokens) so the surface scales smoothly between a **1366px comfortable desktop
floor** and the cap, with **checkpoint media queries at 1440 / 1920 / 2560px**
for targeted gutter/spacing tuning (not new layouts). This is **additive to the
existing D-12909 `max-width: 767px` mobile/desktop split** — `useViewport.ts`,
the 767 breakpoint, and the entire `<PlayMobile>` portrait layout are **not
touched**. No engine change, no `UIState` field, no new dependency.

---

## User-Visible Impact

On the game surface: a player on a 2560-wide (or larger) monitor sees the play
board **centered with comfortable margins** and card art at a readable-but-not-
ballooned size, instead of the current behavior where `.play-desktop` (a plain
flex column with no `max-width`) **stretches edge-to-edge** and the fixed
60/90/120px card tiles leave large dead gaps. A player on a 1366-wide laptop sees
the board **hold without horizontal scroll**. Between those anchors the surface
**scales continuously** rather than snapping. This closes the "fluid desktop
scaling + ultra-wide max-width cap" **open question** documented on the ewiki
[Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/)
page (whose *Open question* section this WP is the proposed answer to).

---

## Assumes

- `apps/arena-client/src/styles/base.css` (WP-007a) exists, is imported once in
  `apps/arena-client/src/main.ts`, and holds the `:root` token-alias layer
  (`--color-foreground` etc. mapping to the brand tokens). It carries **no raw
  hex** (that is a WP-009 audit failure) — but its color-only rule does not
  forbid **size** tokens (`px` / `clamp()` lengths), which is where the new
  play-area sizing tokens live. It is the single stylesheet imported through
  `main.ts` (the sibling `brand-tokens.css` is also global, loaded via
  `index.html`) and is the correct home for the size tokens.
- `apps/arena-client/src/pages/PlayDesktop.vue` (WP-129 / D-12909) renders
  `.play-desktop` as the desktop-surface root — a `display: flex; flex-direction:
  column` container with **no `max-width` and no horizontal centering** today, so
  it stretches to the full viewport width. This is the container the cap applies
  to. Its `<style scoped>` block is where the container rule + checkpoint media
  queries land.
- `apps/arena-client/src/components/play/CardTile.vue` (WP-100 era) sizes the
  three card variants with **fixed** widths: `.card-tile--sm { width: 60px }`,
  `.card-tile--md { width: 90px }`, `.card-tile--lg { width: 120px }` (each with
  `aspect-ratio: 5 / 7`). These fixed widths are what the fluid tokens replace;
  the aspect-ratio is unchanged, so height follows width automatically.
- `apps/arena-client/src/composables/useViewport.ts` (D-12909) owns
  `BREAKPOINT_MOBILE_MAX_PX = 767` and the `<PlayDesktop>` / `<PlayMobile>`
  discriminator. It is **read for context only and NOT modified** — this WP adds
  desktop-side fluid scaling *above* the 767 breakpoint and never crosses it.
- The arena-client skins (`assets/skins/*/theme.css`) scope their variables to a
  `.skin-*` class on the `<PlayViewport>` root; they define board/card **colors**,
  not layout widths, and are **not touched**.
- `pnpm -r build` exits 0 and `pnpm --filter arena-client typecheck` (vue-tsc)
  passes on the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/styles/base.css` — the global stylesheet to extend with
  the play-area sizing tokens under `:root`; note its "no raw hex" discipline
  (color-only — size tokens are permitted).
- `apps/arena-client/src/pages/PlayDesktop.vue` — the `<style scoped>` block where
  the `.play-desktop` max-width cap + centering + gutter and the 1440/1920/2560
  checkpoint media queries land.
- `apps/arena-client/src/components/play/CardTile.vue` — the `.card-tile--sm/md/lg`
  fixed-width rules to convert to the fluid `--card-width-*` tokens.
- `apps/arena-client/src/composables/useViewport.ts` — read ONLY, to confirm the
  D-12909 767 split is the sole breakpoint and that this WP does not touch it.
- `docs/ai/DECISIONS.md` — **D-12909** (the viewport breakpoint this WP builds
  above, unchanged), **D-12901 / D-12902** (the desktop zone placement this WP
  preserves), and the reserved **D-24251** at the tail of this WP.
- `docs/ai/DESIGN-BOARD-LAYOUT.md` §1 (open layout questions) and §3.1 (the
  1280×800–1920×1080 desktop wireframe) — the draft wireframe this WP operates
  within; the fluid model is the answer to its §1 "how does the layout adapt at
  wider viewports" open question.
- `wiki/responsive-viewport-targets.md` — the ewiki page whose *Open question*
  section this WP proposes to resolve; its open-question text is updated to cite
  WP-430 / D-24251 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. **No** diffs, **no** snippets, **no** "show only the changed section."
- ESM only; Node v22+; Vue 3 SFCs; any test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Additive to D-12909, never a change to it.** `useViewport.ts`, the
  `BREAKPOINT_MOBILE_MAX_PX = 767` constant, and the `<PlayMobile>` layout are
  **out of scope and unmodified**. If any edit touches the 767 breakpoint or the
  mobile surface, STOP — that is a different WP.
- **Pure CSS presentation.** No `G` read/write, no `ctx`, no `UIState` field, no
  persistence, no `finalStateHash` sentinel. No runtime `@legendary-arena/registry`,
  `game-engine`, `server`, `pg`, or `boardgame.io` import is added.
- **No raw hex added** anywhere (base.css "no raw hex" rule / WP-009 audit). The
  new tokens are **size** values (`px` / `vw` / `clamp()`), never colors.
- **Cap centers, never crops.** The `--play-max-width` cap uses `margin-inline:
  auto` on `.play-desktop`; it does not use `overflow: hidden` or clip content.
  At any width from the 1366 floor up, the surface must never produce a horizontal
  page scrollbar.
- **Card aspect-ratio is preserved.** Only the `width` of the card tiles changes
  (via the tokens); the `aspect-ratio: 5 / 7` stays, so height derives from width.
  Card sizes **never shrink below** their current fixed values (60/90/120px is the
  `clamp()` floor).
- **No new dependency, no CSS framework, no container queries.** The fluid model
  is plain `clamp()` size tokens + standard `min-width` media queries. Container
  queries and any CSS-in-JS are deliberately excluded (`## Out of Scope`).

**Session protocol:** if any locked value or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **Container cap:** `--play-max-width: 1600px`; `.play-desktop` gets `max-width:
  var(--play-max-width); margin-inline: auto;`.
- **Gutter:** `--play-gutter: clamp(16px, 2vw, 40px)`; applied as
  `.play-desktop { padding-inline: var(--play-gutter); }`.
- **Fluid card tokens** (floor = the current fixed width; grows toward the cap):
  - `--card-width-sm: clamp(60px, 4.4vw, 76px)`
  - `--card-width-md: clamp(90px, 6.6vw, 112px)`
  - `--card-width-lg: clamp(120px, 8.8vw, 150px)`
- **Desktop comfortable floor:** `1366px` — the design anchor the surface must
  hold at with no horizontal scroll (below 768px the D-12909 split already routes
  to `<PlayMobile>`).
- **Checkpoint media queries:** `@media (min-width: 1440px)`, `(min-width:
  1920px)`, `(min-width: 2560px)` — for **gutter/spacing tuning only**, not new
  layouts.
- **Unchanged:** `BREAKPOINT_MOBILE_MAX_PX = 767` (D-12909), `useViewport.ts`,
  `<PlayMobile>`, the skin `theme.css` files, the D-12901/D-12902 zone placement.
- **Reserved decision:** **D-24251** (the fluid-desktop scaling model; land Active
  at execution).

> **Design-review note.** The **anchor values are locked**: cap `1600px`, floor
> `1366px`, the three checkpoint breakpoints, and the "card floor = current fixed
> size" invariant. The **exact `clamp()` curves** for `--play-gutter` and
> `--card-width-*` are the operator-tunable knob — the values above are the
> proposed starting point, refined live against the `## Verification Steps`
> resize check during execution. This knob does not change the acceptance
> criteria, which are width-behavior observations, not specific pixel counts.

---

## Scope (In)

### A) Play-area sizing tokens (`apps/arena-client/src/styles/base.css`, **modified**)
- Under the existing `:root` block, add the six size tokens: `--play-max-width`,
  `--play-gutter`, `--card-width-sm`, `--card-width-md`, `--card-width-lg` (the
  locked values above), each with a `/* why: */` explaining the anchor (cap,
  gutter, floor-preserving fluid card widths). No color token, no raw hex.

### B) Container cap + checkpoints (`apps/arena-client/src/pages/PlayDesktop.vue`, **modified**)
- In `<style scoped>`, add to `.play-desktop`: `max-width: var(--play-max-width);
  margin-inline: auto; padding-inline: var(--play-gutter);` (keeps the existing
  flex-column rules).
- Add the three checkpoint media queries (`min-width: 1440 / 1920 / 2560`) that
  adjust the gutter / inter-zone gap for those tiers only — a `/* why: */` on each
  noting it is spacing tuning, not a layout change.

### C) Fluid card widths (`apps/arena-client/src/components/play/CardTile.vue`, **modified**)
- Replace the fixed `.card-tile--sm { width: 60px }` / `--md { width: 90px }` /
  `--lg { width: 120px }` with `width: var(--card-width-sm | md | lg)`. The
  `aspect-ratio: 5 / 7` and every other card-tile rule are unchanged.

---

## Out of Scope

- **The D-12909 `max-width: 767px` breakpoint, `useViewport.ts`, and the entire
  `<PlayMobile>` portrait layout** — untouched. This WP adds desktop-side scaling
  above 768px only.
- **A mobile / portrait responsive overhaul** — the `<PlayMobile>` surface and its
  375×667–414×896 design range are a separate WP.
- **Per-zone layout re-architecture** — this caps and scales the existing
  `<PlayDesktop>` arrangement; it does **not** move, add, or remove zones (the
  D-12901 Mastermind-top-left / D-12902 opponents-top-edge placement is preserved).
- **Skin / theme changes** — the `.skin-*` `theme.css` files (colors) are not
  touched.
- **CSS container queries or any CSS framework / CSS-in-JS** — the model is plain
  `clamp()` tokens + `min-width` media queries.
- **The prompt-component card thumbnails** (`__card-image`, hard-coded
  `max-width: 60px` in `DiscardToPlayPrompt.vue`, `OptionalKoRewardPrompt.vue`,
  etc.) — these are independent `<img>` thumbnails, **not** `.card-tile`
  instances, so they do not consume `--card-width-*` and are deliberately left
  un-scaled. A known, acknowledged minor visual inconsistency, not a miss (call
  it out in the D-24026 evidence so it is not read as a regression).
- **Any engine / registry / server change** — no `G`, no `UIState` field, no
  persistence, no `finalStateHash` re-pin, no HTTP endpoint.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

**Arena-client styling (App layer):**
- `apps/arena-client/src/styles/base.css` — **modified** — six play-area size
  tokens under `:root` (`--play-max-width`, `--play-gutter`, `--card-width-sm/md/lg`),
  each with a `// why:`-style CSS comment; no color / hex change.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — `.play-desktop`
  gains `max-width` + `margin-inline: auto` + `padding-inline` (the cap +
  centering + gutter); three `min-width: 1440/1920/2560` checkpoint media queries
  for spacing tuning.
- `apps/arena-client/src/components/play/CardTile.vue` — **modified** — the three
  fixed `.card-tile--{sm,md,lg}` widths become `var(--card-width-{sm,md,lg})`;
  aspect-ratio and all other rules unchanged.

`apps/arena-client/src/composables/useViewport.ts` is **NOT** in scope (the
D-12909 767 split is untouched). No `packages/**`, no `apps/server/**`, no skin
`theme.css`, and no `<PlayMobile>` file may be modified. This WP declares **no**
`01.5` runtime-wiring file — all three targets are existing styled files whose
CSS this edits. No test file is produced (pure CSS layout is not unit-testable
under jsdom, which has no layout engine — see `## Verification Steps`, which
verifies live per D-24026).

---

## Contract

- **Global size tokens** (`:root`, base.css): `--play-max-width: 1600px`;
  `--play-gutter: clamp(16px, 2vw, 40px)`; `--card-width-sm: clamp(60px, 4.4vw,
  76px)`; `--card-width-md: clamp(90px, 6.6vw, 112px)`; `--card-width-lg:
  clamp(120px, 8.8vw, 150px)`. (The `clamp()` curves are the proposed starting
  values — see the design-review note above; the cap `1600px` and the card floors
  `60/90/120px` are locked.)
- **`.play-desktop`** (PlayDesktop.vue, scoped): `max-width: var(--play-max-width);
  margin-inline: auto; padding-inline: var(--play-gutter);` layered on the existing
  flex-column rules. Three checkpoint media queries at `min-width` 1440 / 1920 /
  2560 adjust spacing only.
- **`.card-tile--{sm,md,lg}`** (CardTile.vue, scoped): `width:
  var(--card-width-{sm,md,lg})`; `aspect-ratio: 5 / 7` preserved.
- **Invariant:** the mobile side of D-12909 (`≤ 767px → <PlayMobile>`) is
  byte-unchanged; no token this WP adds is consumed by `<PlayMobile>`.

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility / readability across screen
sizes). **Conflict assertion:** `No conflict: this WP preserves all touched
clauses.` — fluid scaling and the ultra-wide cap improve readability and layout
comfort across desktop sizes; there is no internationalization change. **Non-Goal
proximity check:** none of **NG-1..7** are crossed — this is a layout/readability
change with **no monetization, no paid surface, no pay-to-win** vector.
**Determinism preservation:** **N/A / preserved** — pure CSS presentation; no
scoring, replay, RNG, or simulation surface is touched, and there is no engine
state, so replay-faithfulness is unaffected (Vision §22).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy is added or proposed
(the WP edits three CSS surfaces on the play client only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
change is client-side CSS with zero network surface.

---

## Acceptance Criteria

All items are binary pass/fail and observable in a browser at the stated width.

- [ ] At viewport width **2560px**, the `.play-desktop` play area is **capped at
      1600px and horizontally centered** (equal left/right margin), not stretched
      edge-to-edge.
- [ ] At viewport width **1920px**, the play area renders within the cap with the
      1920 checkpoint's gutter, and no content is clipped.
- [ ] At viewport width **1366px** (the desktop floor), the surface holds with
      **no horizontal page scrollbar**.
- [ ] Card tiles **scale up** from their floor sizes as the viewport widens
      (a `--lg` tile is 120px at the floor and larger — up to 150px — near the
      cap) and **never render smaller than** 60/90/120px for sm/md/lg.
- [ ] The card `aspect-ratio: 5 / 7` is preserved at every width (tiles are not
      distorted).
- [ ] At viewport width **≤ 767px** the surface still renders `<PlayMobile>`
      unchanged (the D-12909 split is intact; `git diff --name-only` shows
      `useViewport.ts` and every `<PlayMobile>` file **absent**).
- [ ] The six `--play-max-width` / `--play-gutter` / `--card-width-*` tokens exist
      in `base.css` under `:root`; `.play-desktop` consumes `--play-max-width` +
      `--play-gutter`; `.card-tile--{sm,md,lg}` consume `--card-width-*`.
- [ ] `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client
      test` passes (unchanged count — no test added/removed); `pnpm -r build`
      exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff
      --name-only` shows exactly the three CSS surfaces + governance).

---

## Verification Steps

```pwsh
# Step 1 — build + typecheck everything
pnpm -r build
pnpm --filter arena-client typecheck
# Expected: both exit 0.

# Step 2 — arena-client suite unchanged (this is a CSS-only WP; no test churn)
pnpm --filter arena-client test
# Expected: all pass, same count as baseline (no test file added or removed).

# Step 3 — the tokens exist and are consumed
Select-String -Path "apps\arena-client\src\styles\base.css" -Pattern "--play-max-width|--play-gutter|--card-width-"
Select-String -Path "apps\arena-client\src\pages\PlayDesktop.vue" -Pattern "var\(--play-max-width\)|margin-inline|min-width: 1440px|min-width: 1920px|min-width: 2560px"
Select-String -Path "apps\arena-client\src\components\play\CardTile.vue" -Pattern "var\(--card-width-"
# Expected: the token declarations, the container cap + three checkpoints, and the
# card-width consumers are all present.

# Step 4 — D-12909 untouched, scope locked
git diff --name-only
# Expected: only apps/arena-client/src/styles/base.css,
# apps/arena-client/src/pages/PlayDesktop.vue,
# apps/arena-client/src/components/play/CardTile.vue (+ governance).
# NO composables/useViewport.ts, NO PlayMobile*, NO packages/**, NO theme.css.

# Step 5 — LIVE (D-24026, REQUIRED): run the dev server and resize-verify
# Open <PlayDesktop> (e.g. the ?fixture=mid-turn dev route) and, using the
# browser at 2560 / 1920 / 1440 / 1366 / 375 widths, confirm each Acceptance
# Criterion: capped+centered at 2560, no horizontal scroll at 1366, tiles scale
# between floor and cap, mobile intact at 375. Capture a 2560-width screenshot.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes with an unchanged test count.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the desktop play surface now scales fluidly
      and caps at 1600px on ultra-wide monitors.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24251** as Active (the
      fluid-desktop scaling model).
- [ ] `wiki/responsive-viewport-targets.md` — the *Open question* section is
      updated to reflect the shipped model (cite WP-430 / D-24251); the ewiki page
      and the code no longer disagree.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-430 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-430 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = `play.legendary-arena.com`** ⇒ **D-24026 live-on-surface
> verification is REQUIRED** — Acceptance Criteria 1–6 are confirmed in a real
> browser at the stated widths (the 2560-width capped-and-centered screenshot is
> the evidence), not by green tests + merge alone.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (the D-12909 breakpoint/mobile layout, a mobile overhaul, zone re-architecture, skins, container queries, engine/registry/server).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Vue 3, 00.6) + packet-specific (additive-to-D-12909, pure CSS, no raw hex, cap-centers-never-crops, aspect-ratio preserved, no new dep/framework/container-query) + session protocol + locked values.
- **§3 Assumes** — PASS. base.css token layer, `.play-desktop` no-max-width today, the CardTile fixed widths, `useViewport.ts` read-only, skins colors-not-layout, green baseline — each cites its source WP/decision.
- **§4 Context (Read First)** — PASS. Specific files (base.css, PlayDesktop.vue, CardTile.vue, useViewport.ts read-only) + D-12909/D-12901/D-12902 + DESIGN-BOARD-LAYOUT.md §1/§3.1 + the ewiki page. No `00.2` reference: no card-data / setup-field change (a CSS-only WP).
- **§5 Files** — PASS. 3 CSS surfaces, bounded, no `01.5` wiring file; each marked modified with a one-line description; useViewport.ts + PlayMobile + packages explicitly excluded. No test file (jsdom has no layout engine — stated).
- **§6 Naming** — PASS. `--play-max-width`, `--play-gutter`, `--card-width-sm/md/lg`; full words, no abbreviations; no 00.2 canonical field is touched (no data shape).
- **§7 Dependency discipline** — PASS. **No new dependency** — plain CSS `clamp()` + media queries; container queries / CSS frameworks explicitly rejected.
- **§8 Architectural boundaries** — PASS. App (frontend) layer only; components contain no game logic; no runtime engine/registry/server/`boardgame.io` import added; no `G` read/write.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `git diff --name-only` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — N/A (declared). Pure CSS layout is not unit-testable under jsdom (no layout engine); verified live per D-24026 (§15.1). No test file is added or removed.
- **§13 Verification** — PASS. Exact `pnpm` build/typecheck/test commands + `Select-String` token checks + `git diff` scope gate + the REQUIRED D-24026 live resize check with expected observations.
- **§14 Acceptance criteria** — PASS. 9 binary, observable items tied to width behavior (cap+center at 2560, no h-scroll at 1366, tiles scale from floor, aspect-ratio, mobile intact, tokens present/consumed, gates, scope).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/ewiki/WORK_INDEX/mindmap + scope check. `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 D-24026 live-on-surface verification **REQUIRED** and present.
- **§16 Code style** — PASS. CSS only — no functions, no abstraction, no control flow; `/* why: */` comments on the non-obvious token anchors and each checkpoint; full-word token names.
- **§17 Vision Alignment** — PASS. §17.1 accessibility trigger addressed: `## Vision Alignment` cites §17, asserts No conflict, confirms NG-1..7 uncrossed, and states determinism N/A/preserved (pure CSS).
- **§18 Prose-vs-grep** — PASS. Verification greps are source-file-scoped for CSS token names (`--play-max-width` etc.), not forbidden-token greps over prose.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy (three CSS surfaces on the play client only).
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; the change is client-side CSS with zero network surface.

**Lint verdict: PASS (all 21 resolved; §10/§11/§12/§19/§20/§21 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

> Recorded at FULL promotion (2026-07-25, after operator design sign-off); the
> executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-25).**

- **Sequencing / dependencies:** WP-129 (viewport split + `<PlayDesktop>`),
  WP-007a (`base.css` token layer), and the WP-100-era `CardTile` size classes
  are all on `main`. No engine dependency; a pure client CSS extension.
- **Green baseline:** `origin/main @ 43a5fcf8`.
- **Scope lock:** closed 3-file CSS allowlist; no `01.5` wiring file; `git diff
  --name-only` is a DoD gate that explicitly excludes `useViewport.ts`,
  `<PlayMobile>`, `packages/**`, and the skin `theme.css`.
- **Empirical scaffold — N/A (declared).** This is **not** a validation-tightening
  WP (no parser, guard, schema, or type-narrowing that could newly-reject
  previously-valid input) — it is pure CSS, so the `01.4 §Empirical Scaffold`
  requirement does not fire. The copilot audit confirmed the change cannot break
  the suite (the sole card-tile test asserts class *presence*, not width —
  `CardTile.test.ts:127-146` — and jsdom has no layout engine), so the test count
  is unchanged by construction.
- **Contract fidelity:** the anchors are locked (cap 1600, floor 1366,
  checkpoints, floor-preserving card widths); the `clamp()` curves are the
  operator-approved tunable knob, not an ambiguity.
- **RS-1 (clarification, non-blocking):** the prompt-component `__card-image`
  thumbnails (`max-width: 60px`) do not participate in the fluid scaling —
  deliberately out of scope (documented in `## Out of Scope`); named here so the
  live check does not read it as a miss.
- **PS items (blocking):** none.

## Copilot Check (01.7)

> Recorded at FULL promotion; the executing session may re-run.

**Overall judgment: PASS → CONFIRM (2026-07-25).** Recorded from an independent,
read-only, adversarial subagent audit that verified every WP claim against the
actual arena-client source (not the WP prose):

- **base.css** — `:root` at `base.css:25-43`, imported at `main.ts:7`; the "no
  raw hex" rule is color-only, so `px` / `clamp()` size tokens are clean (wording
  tightened: `brand-tokens.css` is also global via `index.html`).
- **`.play-desktop`** — genuinely **uncapped** today (`PlayDesktop.vue:730-739`,
  no `max-width` / `margin-inline`); it is the surface root and nothing above it
  (`PlayViewport` uses `display: contents`; `AppShell` / `<main>` are full-width)
  caps it — so the 1600 cap centers it. The sticky `TurnActionBar` caps/centers
  *with* content (intended).
- **CardTile** — `.card-tile--sm/md/lg` = `60/90/120px` with `aspect-ratio: 5 / 7`
  (`CardTile.vue:120,129-139`); **no other component or test sets `.card-tile`
  widths** — the prompt thumbnails style `__card-image`, not `.card-tile`, so the
  **3-file allowlist is complete** (no 4th file forced).
- **useViewport 767** is the **sole** breakpoint; there is **no pre-existing
  `min-width` media query** on the play surface (only unrelated `max-width: 40rem`
  pages), so the 1440/1920/2560 checkpoints collide with nothing and the change
  need not touch `useViewport.ts` or `<PlayMobile>`.
- **Tests** — `CardTile.test.ts:127-146` asserts class presence only; test count
  unchanged. **Layer boundary** — pure App-layer CSS, no `G`/`UIState`/engine/
  registry involvement.

**Disposition: CONFIRM** — no BLOCK/RISK survived verification; the three minor
notes are folded into the WP (base.css wording, the thumbnail out-of-scope
acknowledgment, and the sticky-bar screenshot call-out). Execution authorized.

---

## Reserved Decisions (land at execution)

- **D-24251 (reserved; Drafted 2026-07-25, not yet landed)** — The desktop play
  surface (`<PlayDesktop>`) adopts a **fluid scaling model, additive to the
  D-12909 `max-width: 767px` mobile/desktop split** (which is unchanged). (1)
  **Centered max-width cap.** `.play-desktop` gains `max-width: 1600px` +
  `margin-inline: auto`, so beyond 1600px the board gains margin, not oversized
  cards — resolving the "no cap → the surface stretches on ultra-wide / 4K"
  gap. (2) **Fluid sizing between a 1366 floor and the cap.** A `--play-gutter`
  and three `--card-width-*` tokens use `clamp()` so the gutter and card tiles
  scale continuously; the card `clamp()` **floor equals the current fixed size**
  (60/90/120px), so tiles only ever grow, never shrink, and `aspect-ratio: 5 / 7`
  is preserved. (3) **Checkpoint media queries at 1440 / 1920 / 2560px** tune
  gutter/spacing for those tiers — **not new layouts** (the D-12901/D-12902 zone
  placement is preserved). (4) **1366px is the comfortable desktop floor** the
  surface must hold at with no horizontal scroll; below 768px the D-12909 split
  already routes to `<PlayMobile>`. **Rejected alternatives:** (a) *no cap /
  full-bleed* — the current behavior; produces dead gaps and ballooned art on
  wide monitors; (b) *changing the 767 breakpoint or reworking `<PlayMobile>`* —
  out of scope; the mobile surface is a separate concern; (c) *CSS container
  queries* — heavier and unnecessary here (the play surface is the viewport-level
  container), so plain viewport media queries + `clamp()` are used. **Boundary:**
  App layer only — pure CSS presentation; no `G`/`ctx`, no `UIState` field, no
  persistence, zero engine/determinism/replay footprint, no `finalStateHash`
  re-pin. **The exact `clamp()` curves are operator-tunable within these locked
  anchors** (cap 1600, floor 1366, the three checkpoints, floor-preserving card
  widths).

---

## See Also

- **D-12909** — the `max-width: 767px` mobile/desktop viewport split this WP
  builds above and leaves unchanged (`composables/useViewport.ts`).
- **D-12901 / D-12902** — the desktop zone placement (`<PlayDesktop>`) this WP
  preserves.
- `docs/ai/DESIGN-BOARD-LAYOUT.md` §1 (open layout questions) / §3.1 (desktop
  wireframe) — the draft wireframe this WP operates within.
- ewiki [Responsive Viewport Targets](https://ewiki.legendary-arena.com/responsive-viewport-targets/)
  — the page whose *Open question* section this WP proposes to resolve.
