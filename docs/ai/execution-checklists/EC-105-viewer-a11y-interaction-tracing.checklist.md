# EC-105 — Viewer A11y Interaction Tracing (Dev-Only) (Execution Checklist)

**Source:** Ad-hoc — direct follow-up to EC-104. No backing WP.
**Layer:** Registry Viewer (`apps/registry-viewer`) ONLY

## Execution Authority

This EC adds **dev-only interaction tracing** for the a11y-sensitive paths
that were touched or made keyboard-accessible in EC-103. It consumes the
infrastructure landed in EC-104 (`DEBUG_VIEWER`, `devLog`, `no-console`
lint rule) and adds **zero new infrastructure**. It:

- does NOT add new UI (no panels, sections, or visual elements)
- does NOT add new helpers (all logs route through existing `devLog`)
- does NOT change any event handler's runtime behavior
- does NOT alter production bundle output

Vite's DCE guarantees continue to apply: all tracing collapses to no-ops
in prod because `DEBUG_VIEWER` resolves to `false` there. **EC-105
re-verifies the DCE contract in its own prod bundle.**

## Execution Style

Narrow, log-only instrumentation. Most edits are single-line additions
inside existing event handlers. Handler signatures and behavior must not
change. No new files except the checklist itself.

---

## Before Starting (Preconditions — Blocking)

All of the following must be true before opening the execution session.
Each is a **pass/fail gate**.

- [ ] EC-104 has landed (commit `c240b08` — viewer debug surface +
      `DEBUG_VIEWER` gate)
- [ ] **WP-065 (Vue SFC Test Transform Pipeline) has landed.** EC-105 is
      Deferred in `EC_INDEX.md` precisely because the Vue SFC test
      harness must exist before we add tracing that ideally needs unit
      coverage on the handlers it touches. If WP-065 has not landed,
      STOP and re-check the roadmap.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` exits 0 errors
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] No stray `console.log` / `console.debug` / `console.info` /
      `console.trace` anywhere in `apps/registry-viewer/src/` outside
      `src/lib/devLog.ts` and `src/lib/debugMode.ts` (verify via
      `grep -rnE`). `console.warn` / `console.error` in `App.vue` and
      `themeClient.ts` are permitted by EC-104's `no-console` allow list.
- [ ] Working tree has no modified or staged files (pre-existing
      untracked items are OK)

---

## Baseline Reference (Informational — Not Blocking)

These are reference values for drift detection during verification. They
are NOT pass/fail gates on their own — the `≤` thresholds in §Locked
Values are.

- JS bundle: ≈183 KB raw / ≈58 KB gzip (EC-104 landing)
- CSS bundle: ≈26 KB raw / ≈4.8 KB gzip (EC-104 landing)
- Cosmetic lint warnings: ≈174 (non-a11y, non-`no-console`)

---

## Locked Values (Do Not Re-Derive)

### `devLog` category extension — exact shape

File: `apps/registry-viewer/src/lib/devLog.ts` (modified)

```ts
type Category = "registry" | "theme" | "filter" | "render" | "a11y";
```

**`"a11y"` is the ONLY new category added by EC-105.** Do not add any
others (`"interaction"`, `"keyboard"`, `"mouse"`, etc.). The `// why:`
comment on the union extension must cite EC-105.

### `a11y` event shape — exact shape

Every `devLog("a11y", …)` call must use one of these locked message
strings and field shapes:

```ts
// Backdrop / overlay / Esc close events
devLog("a11y", "close", {
  component: "GlossaryPanel" | "ImageLightbox" | "HealthPanel" | "CardDetail" | "ThemeDetail",
  source: "mouse" | "keyboard" | "programmatic",
  key?: "Enter" | "Space" | "Escape",
});

// Token / badge / entry activation events
devLog("a11y", "activate", {
  component: "CardDetail" | "GlossaryPanel",
  target: "token" | "entry" | "badge",
  source: "mouse" | "keyboard",
  key?: "Enter" | "Space",
  targetId?: string,   // the keyword / rule / entry identifier
});

// Resize handle activation (keyboard parity check)
devLog("a11y", "resize", {
  component: "CardDetail" | "GlossaryPanel" | "ThemeDetail",
  source: "keyboard",  // mouse drag is not traced — out of scope
  key: "Enter" | "Space",
});

// Cross-component navigation (ThemeDetail → App card view)
devLog("a11y", "navigate", {
  from: "ThemeDetail",
  to: "CardsView",
  targetType: "mastermind" | "scheme" | "villain" | "henchman" | "hero",
  targetId: string,
  source: "mouse" | "keyboard",
  key?: "Enter" | "Space",
});
```

**Forbidden field additions:**

- ❌ `timestamp` / `time` (devLog does not include timestamps — use
  browser console timestamps)
- ❌ `userAgent`, `viewport`, `pointerType`, or any browser
  fingerprinting
- ❌ Full event objects or DOM element references
- ❌ Card / theme / keyword payload contents

### Source-detection rule — exact shape

Where both mouse and keyboard paths exist on the same handler, detect
source with the plain-DOM check:

```ts
function traceSource(event: Event): "mouse" | "keyboard" {
  // why: PointerEvent with pointerType "mouse" or MouseEvent means
  // the activation came from a real pointer. KeyboardEvent means the
  // user pressed Enter / Space to activate a native <button>, which
  // browsers synthesize into a `click` event — detectable by the
  // `detail: 0` marker (synthetic clicks from the keyboard report
  // `event.detail === 0`).
  if (event instanceof KeyboardEvent) return "keyboard";
  if (event instanceof MouseEvent && event.detail === 0) return "keyboard";
  return "mouse";
}
```

This helper lives **inline inside `devLog.ts`** (not a new file) and is
exported alongside `devLog`. One definition, one source of truth. Do NOT
duplicate the check per component.

### DCE re-verification — hard gate

After the execution commit, `grep -rE "a11y|DEBUG_VIEWER|debugMode"
apps/registry-viewer/dist/` must still return zero matches. EC-104's
existing gate covers `DEBUG_VIEWER` and `debugMode`; EC-105 extends the
verification to `a11y`.

### Commit prefix

`EC-105:` (viewer files staged ⇒ hook requires EC-### prefix per
`01.3`). `SPEC:` / `INFRA:` / any subject containing forbidden words
(`debug`, `wip`, `misc`, `tmp`, `fix stuff`, `updates`, `changes`) will
be rejected by the commit-msg hook. If a subject naturally wants to say
"debug," substitute "diagnostic" / "observability" — see EC-104's
commit (`c240b08`) for precedent.

### Production bundle guarantees (hard gates)

- `grep -rE "a11y|DEBUG_VIEWER|debugMode|traceSource"
  apps/registry-viewer/dist/` returns **zero matches**
- Raw JS bundle grows by **≤ 2 KB** vs EC-104 baseline
- Raw CSS bundle unchanged (±0 KB — no style additions permitted)
- Total lint warning count stays **≤ 180**

---

## Guardrails (Non-Negotiable)

- **No new UI.** No panels, sections, toggles, or visual elements. This
  is log-only instrumentation.
- **No new files** other than the checklist itself. Every `devLog`
  import must come from `../lib/devLog` — do not create per-component
  trace helpers.
- **No handler behavior changes.** Adding a `devLog` call before or
  after existing logic is permitted; restructuring control flow is
  not. If a handler needs refactoring to add a trace, STOP and re-check
  scope.
- **No new categories** beyond `"a11y"`. Resist the urge to add
  `"interaction"`, `"keyboard"`, `"ui"`, etc.
- **No programmatic-source inference from context.** If a handler is
  always called programmatically (e.g., `glossary.close()` from the
  App-level Esc handler), use `source: "programmatic"` explicitly; do
  not try to detect it from event shape.
- **Esc handling is at App.vue, not per-component.** The existing
  `handleKeydown` function in `App.vue` (lines 183-201 at EC-104
  landing) dispatches Esc to lightbox / glossary. Trace the dispatch
  point once in `App.vue`, not in each target component.
- **No changes to `App.vue`'s `handleKeydown` behavior** other than
  adding one `devLog("a11y", "close", …)` call per branch.
- **Never run `eslint --fix`** — EC-104 commentary still applies; it
  will touch 170+ cosmetic warnings outside scope.
- **Never bypass hooks** (`--no-verify`, `--no-gpg-sign`).
- **Registry and theme clients are off-limits.** EC-104 already
  instruments them; EC-105 does not touch `registryClient.ts` or
  `themeClient.ts`.

---

## Required `// why:` Comments

- `src/lib/devLog.ts` on the `Category` union — cite EC-105 for the
  `"a11y"` addition
- `src/lib/devLog.ts` on the `traceSource` helper — cite the
  `detail === 0` synthetic-click heuristic
- Each component file at the first `devLog("a11y", …)` call site —
  one sentence explaining what parity the trace is observing (e.g.,
  "EC-105: confirms keyboard Enter/Space fires the same close path as
  mouse click")
- `App.vue` `handleKeydown` — one `// why:` on the `devLog("a11y",
  "close", { source: "keyboard", key: "Escape", … })` call explaining
  that Esc dispatch happens here, not in the target components

---

## Files to Produce

Exact files. Anything outside this list is out of scope.

- `apps/registry-viewer/src/lib/devLog.ts` — **modified** — extend
  Category union with `"a11y"`; add exported `traceSource(event)`
  helper per §Locked Values
- `apps/registry-viewer/src/components/CardDetail.vue` — **modified** —
  instrument: (a) `handleTokenClick(token)` at token/badge activation
  with `activate` + `traceSource`; (b) close-button `@click` with
  `close` + `source: "mouse"` (the `<button>` synthesizes keyboard
  clicks into this same handler, so use `traceSource(event)`); (c)
  resize handle `@keydown.enter.prevent` and `@keydown.space.prevent`
  with `resize` + key
- `apps/registry-viewer/src/components/GlossaryPanel.vue` —
  **modified** — instrument: (a) backdrop `@click="close"` and
  keyboard activation (the backdrop is a `<button>`) with `close` +
  `traceSource`; (b) `handleEntryClick(entry)` + keydown handlers with
  `activate` + `target: "entry"` + `targetId: entry.id`
- `apps/registry-viewer/src/components/ImageLightbox.vue` —
  **modified** — instrument `.backdrop-dismiss` and close-button with
  `close` + `traceSource`; zoom toggle is NOT traced (tracking every
  zoom click is noise)
- `apps/registry-viewer/src/components/HealthPanel.vue` —
  **modified** — instrument the overlay `@click.self` and
  `@keydown.enter/space.self` with `close` + `traceSource`; close
  button also traced with `close` + `traceSource`
- `apps/registry-viewer/src/components/ThemeDetail.vue` —
  **modified** — instrument: (a) close-button with `close` +
  `traceSource`; (b) each `emit('navigateToCard', …)` call site with
  `navigate` + `traceSource` (there are five: mastermind, scheme,
  villain, henchman, hero — all follow the same pattern)
- `apps/registry-viewer/src/App.vue` — **modified** — in
  `handleKeydown`, emit one `devLog("a11y", "close", {
  component: "ImageLightbox" | "GlossaryPanel", source: "keyboard",
  key: "Escape" })` per dispatch branch, immediately before the
  existing `close`/`closeLightbox` call
- `docs/ai/execution-checklists/EC-105-viewer-a11y-interaction-tracing.checklist.md`
  — **this file**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip
  EC-105 from `Deferred` to `Done` in the EC-105 execution commit;
  bump Last updated

---

## Out of Scope (Do NOT Expand)

- **Render-guard assertions** (e.g., warn if `allCards.length === 0`
  post-load) — deferred indefinitely per EC-104.
- **Performance metrics** (handler duration, paint timing, memory) —
  not this EC.
- **Replay or event recording** (reconstructing user sessions from a
  stored event stream) — explicit governance failure if added.
- **Health counters or analytics** (total clicks, keyboard vs mouse
  ratio, session summary) — not this EC.
- **Mouse-drag tracing on resize handles** — only keyboard activation
  of resize is traced. Mouse drag produces continuous events; tracing
  them would drown the console.
- **Zoom toggle tracing** in ImageLightbox — high-frequency, low-signal.
- **Tooltip hover tracing** — hover is not an a11y parity concern.
- **Registry / theme client instrumentation** — EC-104 owns those.
- **New devLog categories** beyond `"a11y"`.
- **HealthPanel UI expansion** (e.g., "Last a11y event" row) — the
  debug section is frozen as a JSON dump per EC-104.
- **Any engine, server, or cross-layer change.**

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies
pnpm install --frozen-lockfile

# 2. Typecheck — must exit 0, zero errors
pnpm --filter registry-viewer typecheck

# 3. Lint — must exit 0 errors; warnings ≤ 180
pnpm --filter registry-viewer lint

# 4. Build — must exit 0
pnpm --filter registry-viewer build

# 5. HARD GATE — DCE verification (prod bundle must not contain
#    a11y, DEBUG_VIEWER, debugMode, or traceSource symbols).
grep -rE "a11y|DEBUG_VIEWER|debugMode|traceSource" apps/registry-viewer/dist/ \
  && echo FAIL || echo OK
# expect: OK

# 6. Bundle size within tolerance (delta vs EC-104 baseline)
ls -la apps/registry-viewer/dist/assets/
# expect: index-*.js raw ≤ 185 KB; index-*.css raw ≤ 27 KB
```

### Manual DEV smoke test

```bash
pnpm --filter registry-viewer dev
```

- 7a. Visit `http://localhost:5173/?debug`. Open DevTools console.
- 7b. Open a card → click a tokenized keyword badge with the mouse.
      Expect: `[a11y] activate { component: "CardDetail", target:
      "token", source: "mouse", targetId: "…" }`
- 7c. Tab to the same badge → press Enter. Expect: same event with
      `source: "keyboard", key: "Enter"`.
- 7d. Press Space on the badge. Expect: `key: "Space"`.
- 7e. Open glossary (Ctrl+K) → click backdrop. Expect: `[a11y] close {
      component: "GlossaryPanel", source: "mouse" }`.
- 7f. Open glossary → press Esc. Expect: `[a11y] close { component:
      "GlossaryPanel", source: "keyboard", key: "Escape" }` emitted
      from `App.vue`'s `handleKeydown`.
- 7g. Click any cross-link in ThemeDetail. Expect: `[a11y] navigate {
      from: "ThemeDetail", to: "CardsView", targetType: "…",
      targetId: "…", source: "mouse" }`.
- 7h. Focus the resize handle on CardDetail → press Enter. Expect:
      `[a11y] resize { component: "CardDetail", source: "keyboard",
      key: "Enter" }`.

### Manual PROD smoke test (HARD GATE — the DCE payoff)

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- 8a. Visit `http://localhost:4173/?debug`. Open DevTools console.
- 8b. Perform any of steps 7b-7h. Expect: NO `[a11y]` events in the
      console. Diagnostics modal behavior is unchanged from EC-104.
- 8c. DevTools → Sources / Network → inspect `index-*.js`. Search for
      `a11y`, `traceSource`, `DEBUG_VIEWER`, `debugMode`.
      Expect: zero matches for all four.

If any step fails, STOP and fix before committing.

---

## After Completing

- [ ] Verification steps 1–6 all pass
- [ ] Manual DEV smoke (7a–7h) passes
- [ ] **Manual PROD smoke (8a–8c) passes — DCE verified**
- [ ] Prod bundle `grep` for `a11y|DEBUG_VIEWER|debugMode|traceSource`
      returns zero matches
- [ ] Bundle size within tolerance (JS ≤ 185 KB raw, CSS unchanged)
- [ ] Lint warning count ≤ 180
- [ ] No file outside §Files to Produce modified
- [ ] `EC_INDEX.md` has EC-105 flipped Deferred → Done + Last updated
      bumped (landed in the EC-105 execution commit, not a follow-up)
- [ ] Commit prefix `EC-105:`; hook passes without `--no-verify` or
      `--no-gpg-sign`
- [ ] All `// why:` comments from §Required Comments present

---

## Common Failure Smells

- **Adding a "ui" or "interaction" category** — scope creep. Only
  `"a11y"` is permitted by §Locked Values.
- **Inferring source from `pointerType`** — `traceSource` uses
  `detail === 0` as the synthetic-click marker. `PointerEvent.pointerType`
  varies across browsers and adds noise. Stick to the locked rule.
- **Per-component `traceSource` copies** — the helper lives once in
  `devLog.ts` and is imported. If two components have their own
  implementation, that's a governance failure.
- **Tracing mouse drag on resize handles** — the resize handle's drag
  path fires dozens of events; tracing them floods the console. Only
  keyboard Enter/Space activation is traced.
- **Expanding `App.vue`'s `handleKeydown`** beyond two `devLog` lines
  (one per dispatch branch) — if a new case lands in `handleKeydown`,
  it belongs to a different EC.
- **Forgetting the DCE re-grep** — the EC-104 grep looked for
  `DEBUG_VIEWER|debugMode` only. EC-105 adds `a11y` and `traceSource`
  to the pattern; verifying only the EC-104 pattern misses EC-105
  regressions.
- **Adding devLog calls that fire on every render / watch / mount** —
  `onMounted` logging is render-phase noise, not interaction tracing.
  Trace only user-initiated events.
- **Commit prefix containing forbidden words** — the commit-msg hook
  substring-matches `debug`, `wip`, `misc`, `tmp`, `updates`,
  `changes`. Use "diagnostic" / "observability" / "tracing" instead.
- **Forgetting to stage `EC_INDEX.md`** — commit will technically
  pass but EC-105 stays Deferred in the index. Must land in the same
  commit per §Files to Produce.
