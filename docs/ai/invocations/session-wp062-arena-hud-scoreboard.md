# Session Prompt — WP-062 Arena HUD & Scoreboard

**Work Packet:** [docs/ai/work-packets/WP-062-arena-hud-scoreboard.md](../work-packets/WP-062-arena-hud-scoreboard.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-069-arena-hud-scoreboard.checklist.md](../execution-checklists/EC-069-arena-hud-scoreboard.checklist.md)
**Commit prefix:** `EC-069:` (NOT `EC-062:`, `EC-063:`, `EC-064:` — all three slots are unused but EC-065–EC-068 are historically bound; per the EC-061 → EC-067 and EC-066 → EC-068 retargeting precedent, WP-062 uses EC-069, the next free slot)
**Pre-flight:** 2026-04-18 — READY TO EXECUTE (inline in WP-062 §Preflight; all four historical blockers RESOLVED)
**Copilot Check:** 2026-04-18 — CONFIRM, re-run after HOLD → FIX application (Issues 17, 22, 23 resolved by scope-neutral edits; 30/30 PASS). See [copilot-wp062-arena-hud-scoreboard.md](./copilot-wp062-arena-hud-scoreboard.md).
**WP Class:** Runtime Wiring — Client UI (new Vue 3 component tree under `apps/arena-client/src/components/hud/`)
**Primary layer:** Client UI (`apps/arena-client/`)

---

## Pre-Session Gates (Resolve Before Writing Any File)

These items were locked by the pre-flight + copilot check. Each is binary — if unresolved, STOP.

1. **EC slot confirmation (EC-069, not EC-062).** Triple cross-reference:
   - WP-062 §Preflight §EC Slot Lock (names EC-069 explicitly)
   - EC-069 header (cites EC-061→EC-067 and EC-066→EC-068 precedent)
   - This prompt line 5
   If anyone insists on `EC-062:`, STOP and re-run pre-flight.

2. **Governance edits committed (P6-34).** Before writing the first line of HUD code, run:
   ```pwsh
   git status --short
   ```
   The working tree must show **zero uncommitted modifications** to
   `docs/ai/work-packets/WP-062-arena-hud-scoreboard.md`,
   `docs/ai/execution-checklists/EC-069-arena-hud-scoreboard.checklist.md`,
   `docs/ai/execution-checklists/EC_INDEX.md`, and
   `docs/ai/invocations/copilot-wp062-arena-hud-scoreboard.md`.
   If any of those files are uncommitted, commit them first under a
   `SPEC:` prefix (e.g., `SPEC: WP-062 preflight rewrite + EC-069 draft + copilot check`),
   then start the WP-062 execution session with the SPEC hash as the new base.
   P6-34: pre-flight READY verdict is only valid when its governance
   edits are committed, not merely applied.

3. **Upstream dependencies verified green at execution-time commit base.**
   Confirm before coding:
   ```pwsh
   git log --oneline -10
   pnpm -r test
   ```
   - `1d709e5` (EC-068 — WP-067 UIState PAR projection) present on main
   - `2587bbb` (EC-048 — WP-048 PAR scoring) present on main
   - `2e68530` (EC-067 — WP-061 gameplay client bootstrap) present on main
   - `bc23913` (EC-065 — vue-sfc-loader) present on main
   - Repo-wide test count = **442** passing, 0 failures
     (3 registry + 409 game-engine + 11 vue-sfc-loader + 6 server + 13 arena-client).
   If the baseline diverges, STOP and ask.

4. **Code-category inheritance confirmed.**
   `apps/arena-client/src/components/hud/` is a new subdirectory under
   an already-classified app. It inherits the D-6511 Client App
   classification from [docs/ai/REFERENCE/02-CODE-CATEGORIES.md:44](../REFERENCE/02-CODE-CATEGORIES.md).
   No new PS-# / DECISIONS.md entry is required for this subdirectory.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md)
§Escalation and the P6-10 precedent (WP-030 / WP-065 / WP-061). This WP is purely
additive at the engine layer. Each of the four 01.5 trigger criteria is
enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-062? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type is modified. `UIState`, `UIPlayerState`, `UIMastermindState`, `UISchemeState`, `UIGameOverState`, `UIProgressCounters`, `UIParBreakdown` are consumed `import type` only. The `progress` promotion to required already shipped in EC-068 (WP-067). |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine setup orchestrator is touched. `apps/arena-client/` is an already-classified app; HUD files live under `src/components/hud/` only. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No existing test asserts against `apps/arena-client/src/components/hud/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies
without the allowance. Any file beyond the allowlist in §Files Expected
to Change is a scope violation per **P6-27**, not a minor additive
deviation — escalate to a pre-flight amendment rather than shipping it.

The one apparent exception (`apps/arena-client/src/styles/base.css`
modification) is **already on the allowlist** — it is a scope-included
modification, not an under-01.5 allowance. Verify by reading §Files
Expected to Change.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary invariants (client apps consume engine types only)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension, ESM-only, `node:` prefix, no abbreviations, literal-leaf-name aria-label rule
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (Authoritative); §Persistence Boundary; D-0301, D-0302
5. [docs/ai/execution-checklists/EC-069-arena-hud-scoreboard.checklist.md](../execution-checklists/EC-069-arena-hud-scoreboard.checklist.md) — **primary execution authority**
6. [docs/ai/work-packets/WP-062-arena-hud-scoreboard.md](../work-packets/WP-062-arena-hud-scoreboard.md) — authoritative WP specification
7. [docs/ai/session-context/session-context-wp062.md](../session-context/session-context-wp062.md) — WP-067 exit state + 7 chat-only intelligence items + P6-30/31/32 + P6-33/34/35 precedent log entries
8. [docs/ai/invocations/copilot-wp062-arena-hud-scoreboard.md](./copilot-wp062-arena-hud-scoreboard.md) — copilot check re-run CONFIRM disposition + three applied FIXes
9. [packages/game-engine/src/ui/uiState.types.ts](../../../packages/game-engine/src/ui/uiState.types.ts) — UIState, UIProgressCounters, UIParBreakdown, and all sub-type shapes the HUD consumes
10. [packages/game-engine/src/ui/uiState.types.drift.test.ts](../../../packages/game-engine/src/ui/uiState.types.drift.test.ts) — the drift test that pins all six new field names (WP-067)
11. [packages/game-engine/src/ui/uiState.build.ts](../../../packages/game-engine/src/ui/uiState.build.ts) — `buildParBreakdown` safe-skip body (D-6701) — read to understand why `gameOver.par` is absent at runtime today
12. [apps/arena-client/src/components/BootstrapProbe.vue](../../../apps/arena-client/src/components/BootstrapProbe.vue) — canonical `defineComponent({ setup() { return {...} } })` form (D-6512 / P6-30)
13. [apps/arena-client/src/stores/uiState.ts](../../../apps/arena-client/src/stores/uiState.ts) — the Pinia store shape (one state field, one action — frozen)
14. [apps/arena-client/src/testing/jsdom-setup.ts](../../../apps/arena-client/src/testing/jsdom-setup.ts) — jsdom helper; every `mount()`-using test must import this first

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `apps/arena-client/src/components/hud/` contains a
seven-file Vue 3 component tree + one color-palette helper + five
component test files, all of which:

1. Consume `UIState` through the Pinia store in `<ArenaHud />` **only**; all six subcomponents receive their UIState sub-slices as readonly props (container/presenter split enforced by grep).
2. Render the turn/phase/stage banner, a shared scoreboard of five counters (each with a literal leaf-name `aria-label`), a PAR delta readout that renders em-dash for the dominant D-6701 safe-skip case, per-player panels with the seven core zone-count fields, and an endgame summary that shows the four-field PAR breakdown when present.
3. Import no runtime engine / registry / `boardgame.io` code; type-only imports of `UIState` and sub-types.
4. Pass `pnpm --filter @legendary-arena/arena-client build`, `test`, and `typecheck` (all exit 0).
5. Add five HUD color tokens to `base.css` with numeric contrast-ratio comments, under both light and dark `prefers-color-scheme` blocks.
6. Pass the three copilot-check FIX assertions: deep-immutability snapshot comparison in `ArenaHud.test.ts`; player-array ordering assertion in `PlayerPanelList.test.ts`; fail-loud-for-required / fail-soft-for-optional guardrail respected throughout the component tree.

No networking. No card images. No routing beyond the existing single mount. No engine-side change.

---

## Locked Values (Do Not Re-Derive) — copied verbatim from EC-069

- **Commit prefix:** `EC-069:` on every commit for this WP
- **UIState top-level keys:** `game`, `players`, `city`, `hq`, `mastermind`, `scheme`, `economy`, `log`, `progress`, `gameOver?`
- **`progress` is REQUIRED** (not optional); present on every UIState, including `phase === 'lobby'` where both counters read 0
- **UIProgressCounters fields:** `bystandersRescued`, `escapedVillains`
- **UIMastermindState fields:** `id`, `tacticsRemaining`, `tacticsDefeated`
- **UISchemeState fields:** `id`, `twistCount`
- **UIGameOverState fields:** `outcome`, `reason`, `scores?`, `par?`
- **UIParBreakdown fields:** `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`
- **D-6701 runtime reality:** `gameOver.par` is ABSENT (not present-as-undefined) at runtime today — `buildParBreakdown` returns `undefined` unconditionally
- **UIPlayerState core fields (seven, rendered in `PlayerPanel`):** `playerId`, `deckCount`, `handCount`, `discardCount`, `inPlayCount`, `victoryCount`, `woundCount`. `handCards?` is optional.
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`
- **TurnStage values:** `'start' | 'main' | 'cleanup'`
- **Literal leaf-name `aria-label`s (verbatim, no paraphrasing):** `bystandersRescued`, `escapedVillains`, `twistCount`, `tacticsRemaining`, `tacticsDefeated`, `outcome`, `reason`, `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`, plus per-`UIPlayerState` core fields (`playerId`, `deckCount`, `handCount`, `discardCount`, `inPlayCount`, `victoryCount`, `woundCount`)
- **`data-emphasis="primary"`** appears exactly once in `SharedScoreboard.vue` (on `bystandersRescued`); **`data-emphasis="secondary"`** on every other counter
- **`data-testid` values on significant subtrees:** `arena-hud-banner`, `arena-hud-player-panel-list`, `arena-hud-player-panel`, `arena-hud-scoreboard`, `arena-hud-par-delta`, `arena-hud-endgame`
- **Canonical test-script composition** (inherited from WP-061, D-6517):
  `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
- **jsdom-setup import path from `src/components/hud/*.test.ts`:** `'../../testing/jsdom-setup'` (**two levels up** — P6-32)
- **Five new `base.css` tokens:** `--color-emphasis`, `--color-penalty`, `--color-active-player`, `--color-par-positive`, `--color-par-negative` — each with a numeric contrast-ratio comment of the form `/* 7.2:1 on --color-background */` under both light and dark `prefers-color-scheme` blocks

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- No runtime import of `@legendary-arena/game-engine` anywhere under `apps/arena-client/src/components/hud/` — `import type` only.
- No import of `@legendary-arena/registry` anywhere under `apps/arena-client/src/components/hud/`.
- No import of `boardgame.io` anywhere under `apps/arena-client/src/`.
- No `Math.random`, `Date.now`, or `performance.now` in any HUD file.
- Never mutate the `UIState` snapshot received from the store — treat as readonly in all components.
- ESM only; Node v22+. `node:` prefix on all Node built-in imports.
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output. No diffs. No "show only the changed section."
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs (N/A), no Jest, no Vitest, no Mocha, no `passport`, no `auth0`, no `clerk`, no `cross-env`. The **only** permitted test runner is `node:test`.

**Packet-specific — Container / Presenter (strict):**
- Only `ArenaHud.vue` imports `useUiStateStore`. Every subcomponent receives its UIState sub-slice **exclusively via props** and MUST NOT import the store module. A subcomponent that reads the store is a contract violation. Verification Step 7 enforces this with one grep.
- `ArenaHud.vue` uses the `defineComponent({ setup() { return { … } } })` form (D-6512 / P6-30) — `<script setup>` sugar is forbidden for this file because setup-scope template bindings are not exposed on `_ctx` under vue-sfc-loader's separate-compile pipeline. The six subcomponents (`TurnPhaseBanner`, `SharedScoreboard`, `ParDeltaReadout`, `PlayerPanelList`, `PlayerPanel`, `EndgameSummary`) may freely use `<script setup>` — props reach `_ctx` via `$props`.

**Packet-specific — Projection Fidelity:**
- No client-side arithmetic or aggregation whatsoever on game values: no HUD component may sum, subtract, normalize, smooth, average, count, or otherwise combine multiple UIState numeric fields. `.reduce()` is banned, but so is a hand-written loop or a `+` between two projected numbers in a `computed`. The only permitted "computation" is reading a single field and mapping it to a display string (including sign choice for PAR delta).
- Every user-visible number's `aria-label` is the **literal leaf** UIState field name, verbatim. Visible display text may be human-readable (`"Bystanders rescued: 4"`), but the `aria-label` is `"bystandersRescued"`.
- Five pre-WP-067 draft names MUST NOT appear anywhere in HUD source: `schemeTwists`, `mastermindTacticsRemaining`, `mastermindTacticsDefeated`, `parBaseline`. Verification Step 9b enforces this. The current names are `twistCount`, `tacticsRemaining`, `tacticsDefeated`, `parScore`.

**Packet-specific — D-6701 Safe-Skip Rendering Rules (load-bearing):**
- `<ParDeltaReadout />` renders em-dash (`—`) when `!('par' in gameOver)` OR `gameOver === undefined`. Zero is a valid engine value and renders as `0` with no arrow icon (neutral). Tests assert the absent form via `!('par' in gameOver)`, NOT `gameOver.par === undefined`.
- `<SharedScoreboard />` does NOT gate on `phase === 'play'`. `progress` is required on every UIState; at lobby both counters render zero (not em-dash, not hidden).
- The `void gameState; void ctx;` pattern is the documented approach for any HUD composable that holds a stable signature for a future-payload contract while currently returning a fixed value. Not a TS necessity — documents intent.

**Packet-specific — Failure Semantics (fail-loud-for-required / fail-soft-for-optional):**
- **REQUIRED** UIState paths are accessed WITHOUT defensive guards: `snapshot.progress.*`, every `UIPlayerState` core field (seven), `snapshot.game.*`, `snapshot.scheme.*`, `snapshot.mastermind.*`. A missing required key is a fixture or contract violation — a loud `TypeError` is the correct failure mode.
- **OPTIONAL** UIState paths MUST be guarded via `'key' in parent` or `?.` before access: `snapshot.gameOver?`, `snapshot.gameOver.par?`, `snapshot.gameOver.scores?`, `snapshot.players[i].handCards?`.

**Packet-specific — Style & Tokens:**
- `base.css` gains five HUD tokens under BOTH `prefers-color-scheme: light` AND `prefers-color-scheme: dark` blocks. Do NOT replace or rename the WP-061 tokens (`--color-foreground`, `--color-background`, `--color-focus-ring`). Each new token carries a numeric contrast-ratio comment cited from WebAIM contrast checker or equivalent; sources documented in DECISIONS.md.
- `data-emphasis="primary"|"secondary"` is **structural**, not stylistic. Tests assert attribute presence, not class or style tokens. Styling selectors key off the attribute.
- HUD uses no CSS framework beyond `base.css` tokens + component-scoped `<style>` blocks.
- Icon differentiator is mandatory on PAR arrows + active-player highlight — color is never the sole signal.

**Packet-specific — Testing:**
- Every `mount()`-using test file imports jsdom-setup as its **first line**: `import '../../testing/jsdom-setup';` (two levels up — P6-32). Load-bearing because Vue 3.5.x probes `SVGElement` at `app.mount()`.
- `ArenaHud.test.ts` is the **only** HUD test that sets up a Pinia store. All subcomponent tests mount with a plain props object.
- `ArenaHud.test.ts` includes a **deep-immutability assertion** per fixture variant (FIX for Issue 17): snapshot `JSON.stringify(uiState)` before mount; exercise reactive interactions the test uses; assert stringified form is identical after render. Use `assert.strictEqual` on stringified snapshots.
- `PlayerPanelList.test.ts` includes a **player-array ordering assertion** (FIX for Issue 23): `wrapper.findAllComponents({ name: 'PlayerPanel' }).map(c => c.props('player').playerId)` equals `props.players.map(p => p.playerId)`.
- Drift test: imports `UIState` as a type and assigns a full fixture to it via `satisfies UIState` — fails typecheck if any locked field is renamed or dropped upstream. Aligns with engine-side `uiState.types.drift.test.ts` (WP-067) so a rename breaks BOTH sides.

**Session protocol:**
- If any `UIState` field the HUD needs is unclear or apparently missing, STOP and ask — do not invent a client-side fallback.
- If any subcomponent would need to read from the store to render correctly, STOP — the prop contract is wrong or a field is missing from `UIState`.
- If a forced cascade outside the allowlist is discovered (P6-33 literal-constructor sweep returning a match outside the allowlist), STOP and escalate via `AskUserQuestion` with three named options: recommended path / stop-and-amend / unsafe-bypass. Do not silently proceed.

---

## Required `// why:` Comments (copied verbatim from EC-069)

- `ArenaHud.vue`: single-store-consumer pattern (container/presenter split)
- `ArenaHud.vue`: `defineComponent` authoring form per D-6512 / P6-30
- `TurnPhaseBanner.vue`: `aria-live="polite"` choice for phase/stage changes
- `SharedScoreboard.vue`: bystanders-rescued `data-emphasis="primary"` tying to Vision §Heroic Values in Scoring
- `SharedScoreboard.vue`: `data-emphasis` attribute contract (styling keys off the attribute; tests assert attribute, not class)
- `SharedScoreboard.vue`: literal leaf-name aria-label rule binds to the WP-067 drift test
- `ParDeltaReadout.vue`: no client-side math; em-dash vs zero is load-bearing (zero is a valid engine value; `par` absent ≠ `finalScore === 0`)
- `ParDeltaReadout.vue`: D-6701 safe-skip citation — HUD ships against the absent case; payload-wiring WP requires zero HUD edits
- `EndgameSummary.vue`: four literal leaf-name aria-labels bind to the WP-067 drift test
- `hudColors.ts`: color-blind-safe palette; icon differentiator mandatory because color alone is never the sole signal
- Each new `base.css` token: numeric contrast-ratio comment, format `/* 7.2:1 on --color-background */`, documented source in DECISIONS.md

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a "minor additive deviation."
STOP and escalate to a pre-flight amendment rather than shipping the extra file.

### New — `apps/arena-client/src/components/hud/`
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**. Sole store consumer; `defineComponent({ setup() { return {...} } })` form.
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**. Props-only banner; `aria-live="polite"` on phase/stage region.
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**. Props: `scheme`, `mastermind`, `progress`. Five counters, five literal leaf-name aria-labels, one `data-emphasis="primary"`, four `data-emphasis="secondary"`.
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**. Props: `phase`, `gameOver`. D-6701-aware em-dash rendering; no `live` prop.
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new**. Props: `players`, `activePlayerId`. Iterates with `:key="player.playerId"`.
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new**. Props: `player`, `isActive`. Seven zone-count fields with literal leaf-name aria-labels; `aria-current="true"` when active.
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**. Props: `gameOver`. Outcome + reason always rendered; four-field PAR breakdown rendered when `'par' in gameOver`; scores block rendered when `'scores' in gameOver`.
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**. Exports `playerColorStyles(playerId: string): { background: string; foreground: string; icon: string }`; fixed color-blind-safe palette; icon differentiator mandatory.

### New — HUD tests
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **new**. Only HUD test that sets up a Pinia store. Includes per-fixture-variant deep-immutability assertion (FIX for Issue 17).
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` — **new**.
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` — **new**. Asserts `[data-emphasis="primary"]` count = 1, `[data-emphasis="secondary"]` count = 4, all five literal leaf-name aria-labels present, lobby branch renders zeros.
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` — **new**. Four branch tests (end+par.finalScore=-3; end+!('par' in gameOver); play+gameOver=undefined; end+par.finalScore=0).
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` — **new**.
- `apps/arena-client/src/components/hud/PlayerPanelList.test.ts` — **new**. Includes player-array ordering assertion (FIX for Issue 23) + basic mount coverage.

### Modified — already-existing client files (scope-included, not under 01.5 allowance)
- `apps/arena-client/src/App.vue` — **modified**. Mount `<ArenaHud />` in place of (or alongside) the WP-061 `<BootstrapProbe />`.
- `apps/arena-client/src/styles/base.css` — **modified**. Add five HUD color tokens under BOTH `prefers-color-scheme: light` and `prefers-color-scheme: dark` blocks, each with numeric contrast-ratio comments. Do NOT rename or remove the three WP-061 tokens.

### Modified — conditional / governance
- `apps/arena-client/src/stores/uiState.ts` — **modified only if** this packet needs an additional read-side accessor WP-061 did not expose. WP-061's scope lock (one state field, one action, no getters) normally means this file is NOT modified. Any modification requires a DECISIONS.md entry.
- `docs/ai/STATUS.md` — **modified** per DoD.
- `docs/ai/DECISIONS.md` — **modified** per DoD (contrast-ratio sources; literal-leaf aria-label rule; no-client-side-math rule; D-6701 em-dash-vs-zero rule; bystanders-rescued emphasis rule; failure-semantics split).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** per DoD (WP-062 checked off with today's date and session-prompt link).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-069 from Draft to Done with today's date, matching the EC-067 format `Executed YYYY-MM-DD at commit <hash>`).

### Must remain UNTOUCHED
- `packages/game-engine/**` — all subdirectories (§C WP-067 edits are the current truth; WP-062 reads only)
- `packages/registry/**`
- `packages/vue-sfc-loader/**`
- `apps/server/**`
- `apps/registry-viewer/**`
- `apps/arena-client/src/main.ts` (WP-061 output)
- `apps/arena-client/src/fixtures/**` (WP-061 + WP-067 outputs)
- `apps/arena-client/src/testing/jsdom-setup.ts` (WP-061 output)
- `apps/arena-client/src/components/BootstrapProbe*` (WP-061 outputs)

Verification Step 11 (git diff) is the enforcement gate.

---

## Acceptance Criteria

### Layer Boundary
- [ ] No file under `apps/arena-client/src/components/hud/` imports `@legendary-arena/game-engine` at runtime (only `import type` permitted). Verified with `Select-String`.
- [ ] No file under `apps/arena-client/src/components/hud/` imports `@legendary-arena/registry`.
- [ ] No file under `apps/arena-client/src/` imports `boardgame.io`.
- [ ] No file under `apps/arena-client/src/components/hud/` mutates any prop it receives (manual code review + deep-immutability test).

### Container / Presenter Split
- [ ] Only `apps/arena-client/src/components/hud/ArenaHud.vue` imports `useUiStateStore` (grep: exactly one match, in `ArenaHud.vue`).
- [ ] Every subcomponent's render output depends only on its declared props — verified by code review + fixture-driven tests that mount subcomponents without a Pinia plugin.
- [ ] `ArenaHud.vue` uses `defineComponent({ setup() { return {...} } })` form — verified by code review (not `<script setup>` sugar).

### Projection Fidelity
- [ ] Every number rendered in the HUD traces directly to a single UIState field — no client-side arithmetic on game values (verified by `Select-String` for `+` operator inside `<script>` blocks of `.vue` files + code review).
- [ ] PAR delta renders em-dash when `!('par' in gameOver)`; zero is rendered when `gameOver.par.finalScore === 0`. Absent-vs-zero distinction is asserted in at least one test branch.
- [ ] Bystanders-rescued counter carries `data-emphasis="primary"` exactly once; all four penalty counters (`escapedVillains`, `twistCount`, `tacticsRemaining`, `tacticsDefeated`) carry `data-emphasis="secondary"` (asserted in tests).
- [ ] `<SharedScoreboard />` renders all five counters during `phase === 'lobby'` when both progress values are zero (no phase-based gating).

### Accessibility (SG-17)
- [ ] Every counter has an explicit `aria-label` equal to the literal leaf UIState field name — verbatim, no paraphrasing (`aria-label="bystandersRescued"`, `aria-label="twistCount"`, `aria-label="tacticsRemaining"`, `aria-label="tacticsDefeated"`, `aria-label="finalScore"`). Asserted in tests against exact strings.
- [ ] Active player indicator uses `aria-current="true"` and an icon, not color alone.
- [ ] All text passes WCAG AA contrast in both light and dark modes (confirmed via automated tooling or manual check documented in DECISIONS.md with numeric ratios).

### Determinism
- [ ] Given a fixture `UIState`, rendered visible text and `aria-label`-ed elements are stable across runs (snapshot test asserts textContent + a11y tree; NOT raw innerHTML).
- [ ] No HUD component reads `Date.now()`, `performance.now()`, `Math.random()`, or `window.location`.
- [ ] Player-panel render order matches `UIState.players[]` array order (asserted in `PlayerPanelList.test.ts`).
- [ ] `ArenaHud.test.ts` asserts deep-immutability (stringified snapshot identical before/after render cycle) for each fixture variant mounted.

### Failure Semantics
- [ ] Required UIState paths are accessed without defensive guards (code review).
- [ ] Optional UIState paths (`gameOver?`, `gameOver.par?`, `gameOver.scores?`, `handCards?`) are guarded via `'key' in parent` or `?.` (code review).

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] Every HUD component has at least one rendering test.
- [ ] No test imports `boardgame.io` or any engine runtime module.
- [ ] Repo-wide test count strictly greater than 442 (new HUD tests add; no prior suites regress).

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (verified with `git diff --name-only`).
- [ ] `packages/game-engine/**` is untouched.
- [ ] `apps/arena-client/src/main.ts`, `apps/arena-client/src/fixtures/**`, `apps/arena-client/src/testing/jsdom-setup.ts`, and `apps/arena-client/src/components/BootstrapProbe*` are untouched.

### Pre-WP-067 Name Absence
- [ ] Zero matches for `schemeTwists`, `mastermindTacticsRemaining`, `mastermindTacticsDefeated`, `parBaseline` anywhere under `apps/arena-client/src/components/hud/` (Verification Step 9b).

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — install and build
pnpm install
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 2 — typecheck
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 3 — confirm no engine runtime import under hud/
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 4 — confirm no wall-clock or RNG under hud/
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce in rendering
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no "team" vocabulary
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "\bteam\b" -Recurse
# Expected: no output (Legendary is cooperative, not team-based)

# Step 7 — confirm ONLY ArenaHud.vue imports the store
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "useUiStateStore" -Recurse
# Expected: matches only in ArenaHud.vue; any other file matching is a contract violation

# Step 8 — confirm data-emphasis attribute is used
Select-String -Path "apps/arena-client/src/components/hud/SharedScoreboard.vue" -Pattern "data-emphasis"
# Expected: at least five matches (primary + four secondary)

# Step 9 — confirm literal leaf-name aria-labels (no paraphrasing)
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "aria-label=`"bystandersRescued`"|aria-label=`"escapedVillains`"|aria-label=`"twistCount`"|aria-label=`"tacticsRemaining`"|aria-label=`"tacticsDefeated`"|aria-label=`"finalScore`"" -Recurse
# Expected: at least six matches across SharedScoreboard.vue + ParDeltaReadout.vue + EndgameSummary.vue

# Step 9b — confirm no pre-WP-067 draft names surface anywhere
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "schemeTwists|mastermindTacticsRemaining|mastermindTacticsDefeated|parBaseline" -Recurse
# Expected: no output

# Step 10 — confirm engine package untouched
git diff --name-only packages/game-engine/
# Expected: no output

# Step 11 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 12 — confirm no registry or boardgame.io import anywhere in apps/arena-client/src
Select-String -Path "apps/arena-client/src" -Pattern "@legendary-arena/registry|boardgame\.io" -Recurse
# Expected: no output

# Step 13 — confirm WP-061 / WP-067 artifacts untouched
git diff --name-only apps/arena-client/src/main.ts apps/arena-client/src/fixtures/ apps/arena-client/src/testing/ apps/arena-client/src/components/BootstrapProbe.vue apps/arena-client/src/components/BootstrapProbe.test.ts
# Expected: no output

# Step 14 — run the full test suite
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests pass; new HUD tests counted

# Step 15 — repo-wide baseline
pnpm -r test
# Expected: repo-wide count > 442; 0 failures; baseline 409 engine / 3 registry / 11 vue-sfc-loader / 6 server / 13+N arena-client

# Step 16 — confirm P6-33 literal-constructor sweep reveals no new cascade sites
Select-String -Path packages, apps -Pattern ": UIState\s*=\s*\{" -Recurse
# Expected: matches only at packages/game-engine/src/ui/uiState.filter.ts:137 (pre-existing); any new match outside that file is a forced cascade requiring escalation.
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) §When Post-Mortem Is Required.
Two triggering criteria apply to WP-062:

1. **New long-lived abstraction** — the seven-component HUD tree is the canonical structure every subsequent UI WP inherits. The container/presenter split established here is the pattern WP-063 (replay inspector), WP-064 (log panel), and every future spectator-HUD WP will copy.
2. **New contract consumption** — `UIProgressCounters` and `UIParBreakdown` are consumed for the first time on the client side. The D-6701 safe-skip em-dash pattern must be documented for the follow-up WP that wires the PAR payload.

**Per P6-35, 01.6 mandatoriness rules override any session-prompt "recommended" softening.** The post-mortem runs in the **same session** as execution (step 4 before step 6), immediately after acceptance criteria pass, **before** the commit step. An informal in-line summary is NOT a substitute — the formal 10-section 01.6 output must be produced.

Pre-commit review (step 5) is a **separate-session gatekeeper**, NOT in-session self-review (WP-067 procedural deviation — do not repeat).

---

## Definition of Done

- [ ] Pre-Session Gates #1 (EC slot EC-069), #2 (governance edits committed under SPEC prefix), #3 (upstream green), #4 (code-category inheritance noted) all resolved.
- [ ] All Acceptance Criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `pnpm -r test` exits 0 with repo-wide count ≥ 442 + new HUD test count; 0 failures.
- [ ] No runtime import of `@legendary-arena/game-engine`, `@legendary-arena/registry`, or `boardgame.io` in any HUD file.
- [ ] No `Math.random`, `Date.now`, or `performance.now` in any HUD file.
- [ ] No `team` vocabulary anywhere in HUD source.
- [ ] Only `ArenaHud.vue` imports `useUiStateStore` (container/presenter split enforced).
- [ ] `data-emphasis="primary"` appears exactly once in `SharedScoreboard.vue` (bystanders rescued); `data-emphasis="secondary"` on every other counter.
- [ ] `aria-label` values are literal leaf UIState field names (`bystandersRescued`, `escapedVillains`, `twistCount`, `tacticsRemaining`, `tacticsDefeated`, `finalScore` — NOT `schemeTwists`, NOT `parBaseline`).
- [ ] `base.css` contains five new HUD tokens under BOTH light and dark `prefers-color-scheme` blocks, each with numeric contrast-ratio comments.
- [ ] `ArenaHud.test.ts` includes per-fixture-variant deep-immutability assertion (FIX for Issue 17).
- [ ] `PlayerPanelList.test.ts` includes player-array ordering assertion (FIX for Issue 23).
- [ ] All required `// why:` comments present at the sites listed above.
- [ ] `packages/game-engine/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`, `apps/registry-viewer/**` untouched.
- [ ] `apps/arena-client/src/main.ts`, `fixtures/**`, `testing/**`, and `BootstrapProbe*` untouched (WP-061 / WP-067 outputs frozen).
- [ ] No files outside §Files Expected to Change were modified.
- [ ] `docs/ai/STATUS.md` updated — the arena client renders a full HUD driven by `UIState` fixtures; wiring to live match state remains open.
- [ ] `docs/ai/DECISIONS.md` updated — contrast-ratio sources, literal-leaf aria-label rule, no-client-side-math rule, D-6701 em-dash-vs-zero rule, bystanders-rescued emphasis rule, failure-semantics split.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-062 checked off with today's date and a note linking this session prompt.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-069 flipped from Draft to Done with today's date and the execution commit hash (format: `Executed YYYY-MM-DD at commit <hash>`).
- [ ] Commit uses the `EC-069:` prefix (NOT `EC-062:`).
- [ ] 01.6 post-mortem complete (MANDATORY per P6-35) — formal 10-section output, in-session, before commit.
- [ ] `### Runtime Wiring Allowance — NOT INVOKED` section above is accurate at execution time — verify no engine type, move, or phase hook was added during the session.

---

## Out of Scope (Explicit)

- Floating, draggable, or z-order-managed windows — permanently dropped (design decision — vision misalignment).
- Theming system (team colors, arena branding, skinnable CSS) — deferred.
- Spectator-specific HUD layout or permission filtering — future spectator-HUD WP (consumes WP-029 projection).
- Game log panel rendering — WP-064.
- Replay stepping or inspector controls — WP-063.
- Live networking / WebSocket wiring — future client-runtime WP + WP-032 integration.
- Real-time visual effects beyond a single CSS transition on counter change.
- Card image rendering, tooltips, or registry lookups.
- Live PAR-delta field during `phase === 'play'` — does not exist in the engine today; do not invent.
- Any engine-side change. `packages/game-engine/**` must not be modified.
- Modifications to WP-061 outputs (`main.ts`, `fixtures/**`, `testing/jsdom-setup.ts`, `BootstrapProbe*`).
- Refactors, cleanups, or "while I'm here" improvements.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful"
additions. If any required modification cannot be classified as within the
WP-062 allowlist + the NOT-INVOKED 01.5 scope lock, STOP and escalate
rather than force-fitting. P6-27 is active.

When finished: run the verification steps in order, capture output, run the
mandatory 01.6 post-mortem (formal 10-section output, same session, before
commit), then hand off to step 5 (pre-commit review) in a **separate
session** with the `EC-069:` commit prefix locked.
