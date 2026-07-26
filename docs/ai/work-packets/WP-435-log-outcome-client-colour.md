# WP-435 — Colour-Code the Game Log by Outcome (Client Render + a11y + Export)

> **WP-B.3b** — the client-colour slice of the structured log-outcome design
> (D-24253). B.3a (WP-434) made the engine author a `LogEntry.outcome`; this makes it
> **visible**. Heuristic retirement is WP-B.3c.

## Goal

Render each game-log line in the arena-client HUD coloured by its authored
`LogEntry.outcome` — green for `applied`, amber for `partial`, red for `blocked`,
unstyled for `neutral` — reusing the design system's existing theme-aware tokens so
it works in light and dark. Colour is **never the only signal**: each non-`neutral`
line also carries a decorative glyph and a screen-reader-only outcome word. The
plain-text export gains a matching leading tag. No engine change (the outcome is
already on every record from B.3a); no motion.

## Assumes

- **WP-434 / D-24253 (WP-B.3a) — merged (#1030).** `UIState.log` is `LogEntry[]`
  (`{ text, outcome }`); `LogOutcome` / `LOG_OUTCOMES` are exported from
  `@legendary-arena/game-engine`. This WP consumes that outcome; it does not author it.
- `GameLogPanel.vue` renders `entry.text` on two `<li>` sites (compact + modal) and
  `gameLogExport.ts` (`buildGameLogText`) joins `entry.text` — both from WP-434.
- The design tokens `--la-color-success` / `--la-color-warning` / `--la-color-error`
  exist and are **theme-aware** (`apps/arena-client/public/brand-tokens.local.css`
  defines light + dark values); `base.css` already aliases
  `--color-par-positive` = success and `--color-par-negative` = error.
- Baseline `origin/main` @ `89cd8ad0`.

## Context (Read First)

D-24253 §10 scoped B.3b as "client colour + a11y + export." B.3a deliberately shipped
the log **visually unchanged** (records flowed to the client, which rendered only
`.text`) to de-risk the wide type migration; B.3b is the additive, visible half. The
design's §Fork E is binding: **colour cannot be the only signal** (colour-blind +
screen-reader users need a glyph + text), and the render must be **static** — no
animation — per the reduced-motion posture (`wiki/visual-effects.md`; the log is
information, not juice). The plain-text export stays a diffable transcript.

## Scope (In)

- **New pure helper `log/logOutcomeDisplay.ts`** — maps a `LogOutcome` to its display
  triple: `{ className, glyph, label }` (e.g. `applied` → `game-log__line--applied`,
  `✓`, `applied`). `neutral` → `{ className: '', glyph: '', label: '' }` (unstyled, no
  glyph). Pure, no Vue import, unit-testable (the `gameLogScroll` / `gameLogExport`
  precedent). `log/logOutcomeDisplay.test.ts`.
- **`GameLogPanel.vue`** — on **both** `<li>` render sites (compact + modal): bind the
  per-outcome class, prepend the decorative glyph (`aria-hidden="true"`) and a
  visually-hidden outcome word (`<span class="sr-only">`), then `entry.text`. Add the
  outcome-class CSS mapping to the tokens (`applied` → `--color-par-positive`,
  `partial` → `--color-par-partial`, `blocked` → `--color-par-negative`; `neutral`
  inherits `--color-foreground`). No transition/animation on log lines.
  `GameLogPanel.test.ts` asserts class + glyph + sr-only per outcome and that
  `neutral` is unstyled.
- **`styles/base.css`** — add the one missing semantic alias
  `--color-par-partial: var(--la-color-warning)` (mirrors the existing
  `--color-par-positive` / `--color-par-negative` aliases; keeps the mapping in the
  semantic layer, not raw brand tokens). Add an `.sr-only` utility if one does not
  already exist.
- **`gameLogExport.ts`** — `buildGameLogText` prepends a leading tag for non-`neutral`
  lines: `[applied] ` / `[partial] ` / `[blocked] ` before `entry.text`; `neutral`
  lines stay untagged. Keeps the export plain-text, greppable, and mirroring the
  on-screen signal. `gameLogExport.test.ts`.

## Out of Scope

- **Any engine / `G` / `UIState` change** — the outcome is already authored (B.3a).
- **`effectProvenance` retirement** — WP-B.3c.
- **New or changed `LOG_OUTCOMES` values, or re-classifying which lines get which
  outcome** — that is engine-side (B.3a); this WP only *renders* the existing values.
- **Animation / motion / transitions** on the log — static colour only.
- **The replay inspector's colouring** — `ReplayInspector` feeds the same
  `GameLogPanel`, so it inherits the colour for free; no separate work, and no new
  replay-inspector-specific styling is added here.
- Server, registry, persistence, determinism (none touched — client render only).

## Files Expected to Change

- `apps/arena-client/src/components/log/logOutcomeDisplay.ts` **(new)** · `…/logOutcomeDisplay.test.ts` **(new)**
- `apps/arena-client/src/components/log/GameLogPanel.vue` · `…/GameLogPanel.test.ts`
- `apps/arena-client/src/components/log/gameLogExport.ts` · `…/gameLogExport.test.ts`
- `apps/arena-client/src/styles/base.css` [add `--color-par-partial` alias + `.sr-only` if missing]
- **governance:** `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `STATUS.md`, `docs/ai/DECISIONS.md` (annotate D-24253 with the B.3b landing).

Single layer (arena-client). Any file outside this list is STOP-and-escalate.

## Contract

- **Outcome → display triple** (locked in EC-470):
  | outcome | class | colour token | glyph | sr-only label |
  |---|---|---|---|---|
  | `applied` | `game-log__line--applied` | `--color-par-positive` (success/green) | `✓` | "applied" |
  | `partial` | `game-log__line--partial` | `--color-par-partial` (warning/amber) | `⚠` | "partial" |
  | `blocked` | `game-log__line--blocked` | `--color-par-negative` (error/red) | `✕` | "blocked" |
  | `neutral` | (none) | `--color-foreground` (default) | (none) | (none) |
- **Export tag:** non-`neutral` lines prefixed `[{outcome}] ` in `buildGameLogText`; `neutral` untagged.
- Colour is never the only signal (glyph `aria-hidden`, sr-only word carries it); static render (no motion).

## Acceptance Criteria

1. Each `<li>` (compact **and** modal) carries the outcome class, the decorative glyph
   (`aria-hidden`), the sr-only outcome word, and `entry.text`; `neutral` lines are
   unstyled with no glyph/label.
2. The outcome classes resolve to the theme-aware tokens in both light and dark (no
   hard-coded hex in the component).
3. No CSS transition/animation on log lines (reduced-motion safe by construction).
4. `buildGameLogText` prefixes non-`neutral` lines with `[{outcome}] `; `neutral`
   untagged; the export stays plain text.
5. `logOutcomeDisplay` is backed by a keyed `Record<LogOutcome, …>` (no index
   signature / no catch-all), so a new `LOG_OUTCOMES` member is a **compile error**
   until a row is added; its test asserts a **literal expected-triple map per
   `LogOutcome`** (not a `toBeDefined()` iterate), so a missing row fails the test — the
   drift guard is real, not a tautology.
6. arena-client `test` + `typecheck` 0; `pnpm -r build` 0. No engine/other-package change.

## Verification Steps

1. `pnpm -r build && pnpm --filter arena-client test` — green; `typecheck` 0.
2. Run the arena-client; `?fixture=mid-turn&play=1` — log lines show their colour +
   glyph; a `neutral` line is plain. **Dark mode:** arena-client v1 does **not** toggle
   theme and its dark tokens key on `html[data-theme="dark"]`, NOT
   `prefers-color-scheme` — so `resize_window colorScheme` proves nothing. Verify dark
   by setting `document.documentElement.dataset.theme = 'dark'` (or confirm the class
   resolves to `--color-par-partial` → `--la-color-warning`, which carries both light
   and dark values by construction).
3. Copy/Save the log — non-`neutral` lines carry the `[outcome]` tag.
4. `git diff --name-only` = the allowlist.

## Definition of Done

- All AC met; arena-client suite + typecheck + build green.
- Governance closed: WORK_INDEX `[x]`, EC_INDEX Done, mindmap B.3b node `✅` +
  `roadmap:counts:write`, STATUS entry, D-24253 annotated with the B.3b landing.
- `User-Visible Surface = play.legendary-arena.com` — **D-24026 REQUIRED** (this IS
  the visible change: the log is now colour-coded). Live-verify post-deploy.

## Lint Gate Self-Review (00.3 — 21 sections)

1. **Scope closed** — PASS (arena-client only; allowlist is the boundary).
2. **Layer boundary** — PASS (App layer; consumes the engine's `LogOutcome`, no engine/server/registry edit).
3. **Determinism** — N/A (client render; no `G`/RNG/hash surface).
4. **Persistence** — N/A.
5. **Contract files** — N/A (no `.types.ts`/`.validate.ts`/`.gating.ts`; `logOutcomeDisplay.ts` is a client display helper, not an engine contract).
6. **Naming** — PASS (`logOutcomeDisplay`, full words).
7. **Canonical arrays** — N/A (consumes `LOG_OUTCOMES`; the helper's test iterates it so a new value forces an update — no new canonical array introduced).
8. **Moves never throw** — N/A.
9. **Phase/turn `// why:`** — N/A.
10. **`.reduce()` ban** — PASS.
11. **Error messages** — N/A (no new error paths).
12. **Comments explain why** — PASS (glyph-not-colour-alone + reduced-motion rationale required, EC-470).
13. **Test extension** — PASS (`.test.ts`).
14. **`makeMockCtx`** — N/A (client component tests).
15. **Field-name fidelity** — PASS (`outcome` per `LogEntry`; no rename).
16. **Vision alignment** — PASS (§14 observability / accessibility; colour-blind + screen-reader inclusive).
17. **No invented mechanics** — PASS (render only; no new mechanic/counter).
18. **DECISIONS reference** — PASS (implements D-24253 §Fork E; annotates it at execution; no new D — the mapping is a render detail the design already ruled).
19. **API catalog (D-11804)** — N/A (no HTTP endpoint / server library fn).
20. **Mindmap node** — PASS (B.3b node added; counts written).
21. **User-visible surface / D-24026** — PASS (**REQUIRED** — this is the visible colour change; live-verify declared).

All 21 resolved (PASS or justified N/A).

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE** (independent subagent, 2026-07-26). Verified WP-434 is on `main`
(the contract + barrel exports), both `<li>` render sites exist, the theme-aware
tokens exist while `--color-par-partial` / `.sr-only` are genuinely absent (so this WP
adds them), `buildGameLogText` already takes `LogEntry[]`, and no test outside the
allowlist breaks (every existing log entry — incl. `three-turn-sample.json` — is
`neutral`, which stays untagged/unstyled).

## Copilot Check Verdict (01.7)

**PASS** (independent subagent, 2026-07-26), after an initial **RISK/HOLD** on three
scope-neutral gaps, all fixed in-place: (1) the drift guard is now locked to a keyed
`Record<LogOutcome, …>` (no catch-all → a new value is a compile error, not a
tautology); (2) the dark-mode verify was driving `prefers-color-scheme` but
arena-client keys dark on `data-theme` — corrected to set `data-theme="dark"`; (3) the
modal `<li>` gets a test hook so "both render sites" cannot be half-satisfied. a11y
(glyph `aria-hidden` + sr-only word), no-engine-re-derivation, token theming, and the
no-motion prohibition all passed clean.
