# EC-069 — Arena HUD & Scoreboard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-062-arena-hud-scoreboard.md
**Layer:** Client UI (`apps/arena-client/src/components/hud/`)

> **EC numbering note:** `EC-062`, `EC-063`, and `EC-064` were never
> issued. `EC-065`–`EC-068` are historically bound (WP-065 vue-sfc-
> loader, WP-066 registry-viewer data toggle, WP-061 client bootstrap,
> WP-067 UIState PAR projection). Following the EC-061 → EC-067 and
> EC-066 → EC-068 retargeting precedent, WP-062 uses **EC-069** —
> the next free slot. Commits for WP-062 use the `EC-069:` prefix.

## Before Starting
- [ ] WP-061 complete (commit `2e68530`): `apps/arena-client/` SPA
      exists; `useUiStateStore()` exposes exactly `snapshot: UIState |
      null` + `setSnapshot(next)`; three typed fixtures load via
      `loadUiStateFixture`; `<BootstrapProbe />` mounts under jsdom
- [ ] WP-065 complete (commit `bc23913`): `@legendary-arena/vue-sfc-
      loader/register` resolvable under `node --import`
- [ ] WP-067 complete (commit `1d709e5`): `UIState.progress` required;
      `UIGameOverState.par?` optional; `buildParBreakdown` safe-skip
      body (D-6701); filter passthrough at `uiState.filter.ts:137`
- [ ] WP-048 complete (commit `2587bbb`): `ScenarioScoringConfig` /
      `ScoreBreakdown` types exist (consumed transitively via
      `UIParBreakdown` — no direct import from HUD)
- [ ] Repo baseline green: `pnpm -r build` and `pnpm -r test` exit 0;
      442 tests passing (3 + 409 + 11 + 6 + 13); 0 failures
- [ ] `git status --short` shows zero uncommitted governance edits
      (P6-34)

## Locked Values (do not re-derive)
- EC prefix: `EC-069:` on every commit for this WP
- UIState top-level keys: `game`, `players`, `city`, `hq`,
  `mastermind`, `scheme`, `economy`, `log`, `progress`, `gameOver?`
- `progress` is REQUIRED (not optional); present on every UIState
  including `phase === 'lobby'`
- UIProgressCounters fields: `bystandersRescued`, `escapedVillains`
- UIMastermindState fields: `id`, `tacticsRemaining`,
  `tacticsDefeated`
- UISchemeState fields: `id`, `twistCount`
- UIGameOverState fields: `outcome`, `reason`, `scores?`, `par?`
- UIParBreakdown fields: `rawScore`, `parScore`, `finalScore`,
  `scoringConfigVersion`
- D-6701: `gameOver.par` is ABSENT (not present-as-undefined) at
  runtime today — `buildParBreakdown` returns `undefined`
  unconditionally
- UIPlayerState core fields (seven, rendered in `PlayerPanel`):
  `playerId`, `deckCount`, `handCount`, `discardCount`, `inPlayCount`,
  `victoryCount`, `woundCount`. `handCards?` is optional.
- Phase names: `'lobby' | 'setup' | 'play' | 'end'`
- TurnStage values: `'start' | 'main' | 'cleanup'`
- Literal leaf-name `aria-label`s (verbatim, no paraphrasing):
  `bystandersRescued`, `escapedVillains`, `twistCount`,
  `tacticsRemaining`, `tacticsDefeated`, `outcome`, `reason`,
  `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`
- `data-emphasis="primary"` appears exactly once in
  `SharedScoreboard.vue` (on `bystandersRescued`);
  `data-emphasis="secondary"` appears on every other counter
- Canonical test-script composition (inherited from WP-061, D-6517):
  `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
- jsdom-setup import path from `src/components/hud/*.test.ts`:
  `'../../testing/jsdom-setup'` (two levels up — P6-32)

## Guardrails
- **Engine import is type-only** under `apps/arena-client/src/
  components/hud/`: `import type { UIState, UIPlayerState,
  UIMastermindState, UISchemeState, UIGameOverState,
  UIProgressCounters, UIParBreakdown } from
  '@legendary-arena/game-engine'`. Zero runtime engine imports, zero
  `@legendary-arena/registry` imports, zero `boardgame.io` imports.
- **Container/presenter split is exact:** `ArenaHud.vue` is the
  SOLE importer of `useUiStateStore`. Every other HUD file that
  references the store is a contract violation. Confirm with
  `Select-String -Path apps\arena-client\src\components\hud
  -Pattern "useUiStateStore" -Recurse` — exactly one match, in
  `ArenaHud.vue`.
- **`ArenaHud.vue` uses `defineComponent({ setup() { return {...} }
  })` form**, not `<script setup>` sugar (D-6512 / P6-30). The six
  props-only subcomponents may use `<script setup>` freely.
- **No client-side arithmetic on game values.** No summing,
  subtracting, averaging, counting, or combining of any two numeric
  UIState fields. `.reduce()` is banned; so is a hand-written loop
  or a `+` between two projected numbers inside a `computed`.
- **`<SharedScoreboard />` does NOT gate on phase.** `progress` is
  required on every UIState; lobby renders zeros, not em-dashes.
- **`<ParDeltaReadout />` renders em-dash when `!('par' in
  gameOver)`** — the dominant runtime case under D-6701. Zero is a
  valid engine value and renders as `0`, NOT em-dash. Tests assert
  the absent form, not `par === undefined`.
- **Every `mount()`-using test file imports jsdom-setup on line 1**:
  `import '../../testing/jsdom-setup';` (two levels up — P6-32).
- **Do not modify WP-061 outputs** (`stores/uiState.ts`, `main.ts`,
  `fixtures/**`) or WP-067 outputs (`packages/game-engine/src/ui/**`,
  `packages/game-engine/src/scoring/**`). `base.css` is the one WP-061
  artifact WP-062 intentionally modifies (token addition only; do not
  rename or remove the WP-061 tokens).
- **No wall-clock or RNG**: no `Math.random`, `Date.now`,
  `performance.now` anywhere under
  `apps/arena-client/src/components/hud/`.
- **`data-emphasis` attribute contract**: emphasized counters use
  `data-emphasis="primary"`; penalty counters use
  `data-emphasis="secondary"`. Tests assert attribute presence, NOT
  CSS class names.
- **Fixtures are consumed, not mutated.** WP-062 may add new
  committed JSON fixtures following the `satisfies UIState` pattern
  (D-6514); it does NOT edit the three WP-061 bootstrap fixtures
  (`mid-turn`, `endgame-win`, `endgame-loss`).
- **Scope lock is binary.** Any file touched outside the allowlist
  is a violation, not a minor deviation (P6-27). Stop and escalate
  via pre-flight amendment.
- **Failure semantics (fail-loud-for-required / fail-soft-for-
  optional):** access to REQUIRED UIState fields (e.g.,
  `snapshot.progress.*`, every `UIPlayerState` core field,
  `snapshot.game.*`, `snapshot.scheme.*`, `snapshot.mastermind.*`)
  is intentionally NOT defensively guarded — a missing required key
  is a fixture or contract violation and a loud `TypeError` is the
  correct failure mode (caught upstream by the WP-067 drift test +
  `satisfies UIState` in fixture typing). OPTIONAL fields
  (`snapshot.gameOver?`, `snapshot.gameOver.par?`,
  `snapshot.players[i].handCards?`, `snapshot.gameOver.scores?`)
  MUST be guarded with `'key' in parent` or `?.` before access per
  the D-6701 safe-skip rules.
- **Deep-immutability test (aliasing defense):**
  `ArenaHud.test.ts` MUST include an assertion, for each fixture
  variant it mounts, that `JSON.stringify(snapshot)` is identical
  before and after the render cycle (including any reactive
  interactions the test exercises). One `assert.strictEqual` on
  stringified snapshots per fixture is sufficient — no new helpers,
  no new test file.
- **Player-array ordering test (determinism defense):**
  `PlayerPanelList.test.ts` (or `ArenaHud.test.ts` if more natural)
  MUST include one assertion that the rendered `PlayerPanel`
  instances appear in the same order as the input
  `UIState.players[]` array, compared by `playerId`. Use
  `findAllComponents({ name: 'PlayerPanel' }).map(c =>
  c.props('player').playerId)` or an equivalent attribute-based
  read. One assertion, already-listed file.

## Required `// why:` Comments
- `ArenaHud.vue`: single-store-consumer pattern (container/presenter
  split)
- `ArenaHud.vue`: `defineComponent` form per D-6512 / P6-30
- `TurnPhaseBanner.vue`: `aria-live="polite"` choice for phase/stage
  changes
- `SharedScoreboard.vue`: bystanders-rescued `data-emphasis="primary"`
  tying to Vision §Heroic Values in Scoring
- `SharedScoreboard.vue`: `data-emphasis` attribute contract
  (styling keys off the attribute; tests assert attribute, not
  class)
- `SharedScoreboard.vue`: literal leaf-name aria-label rule binds to
  the WP-067 drift test
- `ParDeltaReadout.vue`: no client-side math; em-dash vs zero is
  load-bearing (zero is a valid engine value; `par` absent ≠
  `finalScore === 0`)
- `ParDeltaReadout.vue`: D-6701 safe-skip citation — HUD ships
  against the absent case; payload-wiring WP requires zero HUD edits
- `EndgameSummary.vue`: four literal leaf-name aria-labels bind to
  the WP-067 drift test
- `hudColors.ts`: color-blind-safe palette; icon differentiator
  mandatory because color alone is never the sole signal
- Each new `base.css` token: numeric contrast ratio comment, format
  `/* 7.2:1 on --color-background */`, documented source in
  DECISIONS.md

## Files to Produce
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new** —
  sole store consumer; `defineComponent` form
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` —
  **new** — props-only banner
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` —
  **new** — five counters, five literal leaf-name aria-labels
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` —
  **new** — D-6701-aware em-dash vs `finalScore` rendering
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` —
  **new** — `v-for` over `UIPlayerState[]`
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new** —
  seven zone-count fields
- `apps/arena-client/src/components/hud/EndgameSummary.vue` —
  **new** — outcome/reason + four-field PAR breakdown when present
- `apps/arena-client/src/components/hud/hudColors.ts` — **new** —
  color-blind-safe palette helper
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **new**
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/PlayerPanelList.test.ts` —
  **new** — player-array-ordering assertion (determinism defense)
- `apps/arena-client/src/App.vue` — **modified** — mount
  `<ArenaHud />`
- `apps/arena-client/src/styles/base.css` — **modified** — add five
  HUD color tokens with numeric contrast-ratio comments under both
  light and dark `prefers-color-scheme` blocks (D-6515)
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (contrast-ratio sources;
  literal leaf-name aria-label rule; no client-side arithmetic rule;
  D-6701 em-dash-vs-zero rule; bystanders-rescued emphasis rule)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip
  EC-069 to Done with today's date)

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r test` exits 0 with repo-wide count ≥ 442 (new HUD
      tests add; no prior suites regress)
- [ ] `Select-String` confirms zero runtime engine/registry/
      `boardgame.io` imports under `apps/arena-client/src/components/
      hud/`
- [ ] `Select-String` confirms zero `Math.random` / `Date.now` /
      `performance.now` under `apps/arena-client/src/components/
      hud/`
- [ ] `Select-String` confirms `useUiStateStore` matches EXACTLY ONCE
      under `apps/arena-client/src/components/hud/` (in
      `ArenaHud.vue` only)
- [ ] `Select-String` confirms pre-WP-067 draft names
      (`schemeTwists`, `mastermindTacticsRemaining`,
      `mastermindTacticsDefeated`, `parBaseline`) are ABSENT under
      `apps/arena-client/src/components/hud/`
- [ ] `Select-String` confirms literal leaf-name aria-labels
      (`bystandersRescued`, `escapedVillains`, `twistCount`,
      `tacticsRemaining`, `tacticsDefeated`, `finalScore`) present
      with at least one match each
- [ ] `data-emphasis="primary"` appears exactly once in
      `SharedScoreboard.vue`
- [ ] `git diff --name-only packages/game-engine/ packages/registry/
      apps/server/ apps/registry-viewer/ packages/vue-sfc-loader/`
      returns no output
- [ ] `git diff --name-only apps/arena-client/src/stores/
      apps/arena-client/src/fixtures/ apps/arena-client/src/main.ts`
      returns no output (WP-061 artifacts untouched)
- [ ] `docs/ai/STATUS.md` / `DECISIONS.md` / `WORK_INDEX.md` /
      `EC_INDEX.md` updated per DoD
- [ ] **01.6 post-mortem is MANDATORY** — two triggering criteria
      apply (new long-lived abstraction = HUD component tree; new
      contract consumption = `UIProgressCounters` /
      `UIParBreakdown`). Run post-mortem (step 4) BEFORE commit
      (step 6) per P6-35.
- [ ] Pre-commit review (step 5) runs in a **separate gatekeeper
      session**, not in-session. (WP-067 precedent — in-session
      pre-commit review is a procedural deviation.)

## Common Failure Smells
- `TypeError: Cannot read properties of undefined (reading
  'bystandersRescued')` at `SharedScoreboard.vue` → passing
  `snapshot.progress` from a fixture that pre-dates WP-067; rebuild
  the fixture with the `progress` key or regenerate typed re-exports
- Test fails with "`par` is undefined" → test used `gameOver.par
  === undefined` instead of `!('par' in gameOver)`; the two differ
  under `Object.keys` iteration (D-6701 §1)
- `SharedScoreboard.vue` hides counters in lobby → component gated on
  `phase === 'play'`; remove the gate — `progress` is required on
  every UIState
- Subcomponent test imports `useUiStateStore` to mount → prop
  contract is wrong; the subcomponent should take its UIState slice
  as a prop, not read the store
- `_ctx.snapshot is undefined` at runtime in `ArenaHud.vue` →
  component used `<script setup>` instead of `defineComponent({
  setup() { return { … } } })` (D-6512 / P6-30)
- Production build fails to resolve `vue-sfc-loader` → package is
  declared as a runtime `dependency` instead of `devDependency`
  (D-6501 anti-production-bundle rule)
- Grep for `boardgame.io` matches comments → verification pattern
  must be `from ['"]boardgame\.io` (import-line-specific), not bare
  `boardgame.io` (P6-31 comment-matching trap — see WP-031 precedent)
- HUD token contrast claims "AA compliant" with no number → every
  token in `base.css` added by this WP must carry a numeric ratio
  comment; a hand-wave is a DoD failure
- Pre-flight prints READY with uncommitted governance edits →
  P6-34 violation; commit pre-flight edits under a `SPEC:` prefix
  first, then print READY with the SPEC hash as the new base
