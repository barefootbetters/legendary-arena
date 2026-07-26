# EC-470 — Colour-Code the Game Log by Outcome (Client Render + a11y + Export) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-435-log-outcome-client-colour.md
**Layer:** arena-client only (log panel render + a pure display helper + export tag + one base.css token alias). No engine/server/registry change.
**Lane:** Standard, two-session. **WP-B.3b** of the D-24253 decomposition. Makes B.3a's authored `LogEntry.outcome` visible; B.3c retires the `effectProvenance` heuristic.

## Before Starting
- [ ] Worktree off `main`, clean, synced; baseline `origin/main` @ `89cd8ad0` recorded.
- [ ] Confirm WP-434 is on `main`: `UIState.log` is `LogEntry[]` and `LogOutcome`/`LOG_OUTCOMES` import from `@legendary-arena/game-engine`. `GameLogPanel.vue` renders `entry.text` on TWO `<li>` sites (compact + modal).
- [ ] Confirm the theme-aware tokens exist: `--la-color-success`/`-warning`/`-error` (light+dark in `public/brand-tokens.local.css`); `base.css` already aliases `--color-par-positive`/`--color-par-negative`.
- [ ] Target file set = WP-435 `## Files Expected to Change`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- **Outcome → display triple** (the ONLY mapping):
  | outcome | class | colour var | glyph (aria-hidden) | sr-only label |
  |---|---|---|---|---|
  | `applied` | `game-log__line--applied` | `--color-par-positive` | `✓` | `applied` |
  | `partial` | `game-log__line--partial` | `--color-par-partial` | `⚠` | `partial` |
  | `blocked` | `game-log__line--blocked` | `--color-par-negative` | `✕` | `blocked` |
  | `neutral` | `''` (none) | `--color-foreground` (inherited) | `''` (none) | `''` (none) |
- **New token alias (base.css):** `--color-par-partial: var(--la-color-warning);` (mirrors the existing positive/negative aliases — do NOT reference the raw `--la-color-*` from the component).
- **Export tag (`buildGameLogText`):** non-`neutral` → `` `[${outcome}] ${entry.text}` ``; `neutral` → `entry.text` unchanged. Still joined by `\n`, still a trailing `\n`.
- Helper API: `logOutcomeDisplay(outcome: LogOutcome): { className: string; glyph: string; label: string }` — pure, no Vue import. **Back it with a keyed `const DISPLAY: Record<LogOutcome, { className; glyph; label }>` — NO index signature, NO catch-all `default`.** A new `LOG_OUTCOMES` member then fails to typecheck at the `Record` until a row is added (a `switch` is acceptable ONLY with an `assertNever(outcome)` default and no fallback return). The test asserts against a **literal expected-triple map keyed per `LogOutcome`** (not a `toBeDefined()` iterate) — a new value with no row must fail the assertion, not pass silently.

## Guardrails
- **Colour is NEVER the only signal** — every non-`neutral` line renders the glyph (`aria-hidden="true"`, decorative) AND an sr-only outcome word; a colour-blind or screen-reader user gets the outcome without seeing colour.
- **Static only** — NO CSS `transition`/`animation`/`@keyframes` on log lines (reduced-motion posture; the log is information). Do not add motion "polish".
- **Theme via tokens** — the outcome classes resolve to `--color-*` vars only; NO hard-coded hex in `GameLogPanel.vue` (the tokens carry light/dark).
- **Both render sites** — the compact `<li>` AND the modal `<li>` get identical treatment; a divergence is a bug. The compact `<li>` has `data-testid="game-log-line"` but the modal `<li>` has **none** — add a `data-testid` to the modal `<li>` (or scope via the `game-log-modal-viewport` container) and assert class + glyph + sr-only on **both** lists, so "both sites" cannot be half-satisfied by testing only the compact one.
- **Render only** — do NOT touch the engine, `UIState`, `effectProvenance`, or the outcome *values*; this WP reads `entry.outcome`, it never authors or reclassifies it.
- `logOutcomeDisplay.ts` stays pure (no Vue/DOM); no `.reduce()`.

## Required `// why:` Comments
- `logOutcomeDisplay.ts`: why a glyph + sr-only label accompany the colour (colour-blind + screen-reader — colour is not the only signal; design §Fork E).
- The `neutral` empty-triple `DISPLAY` row: why neutral is unstyled (it is the dominant narration case; colouring it would drown the signal).
- `GameLogPanel.vue`: why the glyph is `aria-hidden` and the label is `sr-only` (avoid double-announcing; the visible glyph is decorative).
- `base.css`: why `--color-par-partial` aliases `--la-color-warning` (semantic layer, mirrors positive/negative — keeps brand tokens out of components).
- Any log-line CSS: why NO transition (reduced-motion — static information surface).

## Files to Produce
- **New:** `log/logOutcomeDisplay.ts` · `log/logOutcomeDisplay.test.ts` [iterates all 4 `LOG_OUTCOMES` → a new value forces an update].
- `log/GameLogPanel.vue` [class + glyph + sr-only on BOTH `<li>`; outcome-class CSS → tokens] · `log/GameLogPanel.test.ts` [class/glyph/sr-only per outcome; neutral unstyled].
- `log/gameLogExport.ts` [`[outcome]` tag policy] · `log/gameLogExport.test.ts`.
- `styles/base.css` [`--color-par-partial` alias; `.sr-only` utility if absent].
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `STATUS.md`, `docs/ai/DECISIONS.md` (annotate D-24253 with the B.3b landing).

## After Completing
- [ ] `pnpm --filter arena-client test` 0 fail + `typecheck` 0; `pnpm -r build` 0; `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24253 B.3b annotated) / WORK_INDEX (`[x]`) / EC_INDEX (Done); mindmap B.3b node `📝 → ✅` + `roadmap:counts:write`.
- [ ] `User-Visible Surface = play.legendary-arena.com` → **D-24026 REQUIRED** (the log is now colour-coded). Live-verify on deploy: a match log shows green/amber/red lines with glyphs, neutral plain, and the export carries `[outcome]` tags. **Dark:** arena-client v1 does not toggle theme (dark keys on `html[data-theme="dark"]`, not `prefers-color-scheme`) — verify by setting `data-theme="dark"`, not a `colorScheme` emulation; the tokens carry dark values by construction.

## Common Failure Smells
- Colouring `neutral` (it must stay unstyled) — every line coloured = no signal.
- Colour with no glyph / no sr-only → colour-blind + screen-reader users get nothing (the whole point of §Fork E).
- Hard-coded hex in the component instead of the `--color-*` tokens → breaks dark mode.
- A `transition`/`animation` on log lines → violates the reduced-motion posture.
- Styling only the compact `<li>` and forgetting the modal one (or vice-versa).
- Re-deriving or re-classifying the outcome on the client → that is engine-side (B.3a); read `entry.outcome` as given.
