# WP-100 — Interactive Gameplay Surface (Click-to-Play UI Scaffold)

**Status:** Ready (promoted 2026-04-26 — drafted 2026-04-26; 00.3 lint-gate self-review PASS; engine-source pre-review 2026-04-26 (Q2 + Q3 grounded against `coreMoves.types.ts`, `fightVillain.ts`, `recruitHero.ts`, `fightMastermind.ts`, `playerInit.ts`, `game.ts`); Q1 resolved via sibling WP-111-uistate-card-display-projection draft; pre-flight pending)
**Primary Layer:** Arena Client (`apps/arena-client/**`)
**Dependencies:** WP-089 (engine playerView wiring), WP-090 (live match client wiring), WP-062 (arena HUD scaffolds), WP-092 (lobby loadout intake)

---

## Session Context

WP-089 locked the `UIState` projection (including `handCards` for the viewing
player, `city`, `hq`, `mastermind`, and `economy.attack`/`economy.recruit`) and
WP-090 shipped the live boardgame.io client with `submitMove(name, ...args)` as
the single intent submission seam in `apps/arena-client/src/client/bgioClient.ts`;
this packet adds the first interactive components that consume that projection
and call `submitMove` so a human can click through a turn end-to-end.

---

## Goal

After this session, `apps/arena-client` exposes a minimal interactive gameplay
surface that lets the active player play a complete turn through the browser.
Specifically, the client renders the active player's hand as clickable card
tiles, renders the City row, the HQ row, and the Mastermind tile as clickable
targets, exposes `Draw`, `End Turn`, and per-card action buttons, and wires
every interaction through the existing `LiveClientHandle.submitMove(...)`
factory from WP-090. The six already-registered moves (`drawCards`, `playCard`,
`endTurn`, `fightVillain`, `recruitHero`, `fightMastermind`) each have exactly
one UI surface that emits them. No new engine work, no new server work, no new
moves — the client begins consuming the projection it could already see.

This WP delivers the smallest surface that turns the arena-client from a
spectator into a playable game. Card display fidelity (names, images, costs
sourced from the registry) is intentionally out of scope; this scaffold renders
`CardExtId` strings as text labels and is followed by a registry-projection WP
(see Open Questions) that supplies card display data.

---

## Assumes

- WP-089 complete. Specifically:
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState` with
    `handCards?: string[]` on `UIPlayerState`, `city: UICityState`,
    `hq: UIHQState`, `mastermind: UIMastermindState`, and
    `economy: UITurnEconomyState { attack: number; recruit: number }`
  - The server-side `playerView` filter populates `handCards` for the viewing
    player only (not for opponents)
- WP-090 complete. Specifically:
  - `apps/arena-client/src/client/bgioClient.ts` exports `createLiveClient(...)`
    returning `LiveClientHandle { start, stop, submitMove }`
  - `bgioClient.ts` is the **only** runtime importer of `@legendary-arena/game-engine`
    in `apps/arena-client/**` (grep-verified)
  - The Pinia `uiState` store updates on every server-pushed frame
- WP-062 complete. Specifically:
  - `ArenaHud.vue`, `PlayerPanel.vue`, `TurnPhaseBanner.vue`,
    `SharedScoreboard.vue`, `EndgameSummary.vue`, and `ParDeltaReadout.vue`
    exist and read from the Pinia `uiState` store
- WP-092 complete. Specifically:
  - `LobbyView.vue` creates / joins matches and routes into the live match
    view that hosts `ArenaHud`
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0
- arena-client test baseline at session start: **143 / 10 / 0** (143
  tests, 10 suites, 0 failed, 0 skipped — captured at HEAD `bceee60`
  on 2026-04-26 by pre-flight). Post-execution baseline must equal
  this count plus the new tests added by §Scope H (estimated +18 to
  +30 tests, +6 suites). A drop in pre-existing tests is a regression.
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013, codified in WP-041)
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — read the row for
  `apps/arena-client`. The arena-client may import UI framework code and the
  game-engine **types only**; the single sanctioned runtime import of
  `@legendary-arena/game-engine` lives in `bgioClient.ts` and this packet must
  not add a second runtime import site.
- `docs/ai/ARCHITECTURE.md §Architectural Principles` — re-read principle #2
  ("Engine Owns Truth") and #1 ("Determinism is Non-Negotiable"). The client
  submits intent only; it never computes outcomes, never short-circuits move
  validation, never applies local optimistic state.
- `apps/arena-client/src/client/bgioClient.ts` — read entirely. Every UI
  interaction must route through `LiveClientHandle.submitMove(name, ...args)`.
  Do not import `client.moves` directly. Do not bypass the handle.
- `apps/arena-client/src/stores/uiState.ts` — read entirely. The Pinia store
  is the only data source for components. Do not subscribe to the bgio client
  from components.
- `apps/arena-client/src/components/hud/ArenaHud.vue` and `PlayerPanel.vue` —
  read entirely. New interactive components must compose with the existing HUD
  layout, not replace it.
- `packages/game-engine/src/ui/uiState.types.ts` — read entirely. This is the
  exact shape the new components consume. Reference fields by name; never
  invent or rename them.
- `packages/game-engine/src/moves/coreMoves.types.ts` — read for the canonical
  payload shapes: `DrawCardsArgs { count: number }`,
  `PlayCardArgs { cardId: CardExtId }`, `EndTurnArgs = Record<string, never>`.
- `packages/game-engine/src/moves/fightVillain.ts`,
  `packages/game-engine/src/moves/recruitHero.ts`, and
  `packages/game-engine/src/moves/fightMastermind.ts` — read each move's
  argument type signature so the UI emits the correct payload shape. Do not
  re-derive payloads from memory.
- `packages/game-engine/src/game.ts` — the moves bag registered on
  `LegendaryGame` includes the six moves the UI surfaces (`drawCards`,
  `playCard`, `endTurn`, `fightVillain`, `recruitHero`, `fightMastermind`)
  plus internal engine moves (`advanceStage`, `revealVillainCard`) that
  are explicitly **out of UI scope**. The UI must not call any move name
  outside the six-name subset above. Confirm the six the UI emits match
  the names registered on the engine before writing any component.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 5 (every function has JSDoc), Rule 6 (`// why:` on
  non-obvious decisions), Rule 11 (full-sentence error messages), Rule 13
  (ESM only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm the canonical
  definition of `CardExtId` (the external card identifier flowing through
  `UIState.handCards`, `UIState.city`, `UIState.hq`, and
  `UIState.mastermind`). The UI must consume this exact identifier shape
  end-to-end; no parallel rename, abbreviation, or transformation is
  permitted.
- `docs/ai/DECISIONS.md` — scan for entries related to `playerView`,
  UIState projection, layer-boundary exceptions for arena-client, and any
  prior decisions about move-submission seams. The DoD requires this WP to
  log new decisions (drawCards count = 1, prop-drilled `submitMove`,
  CardExtId placeholder labels); confirm those decisions are not already
  recorded under a different framing.
- `docs/01-VISION.md §3, §4, §8, §10, §11, §17` — vision clauses
  governing player trust, multiplayer faithfulness, determinism, content
  as data, stateless client, and accessibility. The `## Vision Alignment`
  section below is the assertion that this packet does not regress any of
  them.
- `.claude/rules/architecture.md §Layer Boundary` — confirms the import
  restrictions enforced for `apps/arena-client`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- Never use `Math.random()` — UI presentation that needs a tie-breaking key
  uses array index, not randomness
- Never throw inside Vue component setup or event handlers — handle errors
  by surfacing a disabled state or a status message in the existing HUD log
- Never persist `G`, `ctx`, `UIState`, or any move payload to localStorage,
  sessionStorage, IndexedDB, or any other browser persistence — all state
  flows from the server frame into the Pinia store
- ESM only, Node v22+ — all new files use `import` / `export`, never `require`
- `node:` prefix on all Node.js built-in imports inside any test file
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access from any component — the only network seam
  is the bgio client inside `bgioClient.ts`
- Full file contents for every new or modified file in the output — no diffs,
  no snippets, no "show only the changed section"
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**

- `apps/arena-client/**` may import `@legendary-arena/game-engine` **types
  only** (`import type { UIState, ... }`). The single runtime import remains
  in `bgioClient.ts`. New components must not add a second runtime import.
- Every interactive component receives `submitMove` (or a typed wrapper
  derived from it) via prop or composable injection — never imports the live
  client directly. This keeps components testable with a stub function.
- The set of move names the UI may emit is locked to exactly:
  `'drawCards'`, `'playCard'`, `'endTurn'`, `'fightVillain'`, `'recruitHero'`,
  `'fightMastermind'`. Any extension requires a new WP.
- The `submitMove` prop type uses a locally-defined `UiMoveName` union of the
  six locked move names rather than a bare `string`, so typos are caught at
  compile time. The union is a UI-side mirror of the engine move bag — it is
  type-only and creates no runtime coupling. Where this union lives (a small
  shared types file under `apps/arena-client/src/components/play/` or inline
  in `PlayView.vue`) is an implementation choice; the constraint is that the
  six prop signatures all reference the same `UiMoveName`, not `string`.
- Scaffold artifacts: some UI elements in this packet (notably the `Draw`
  button) exist solely to compensate for known MVP gaps in the engine. They
  are explicitly documented in the WP body, decision-logged in
  `DECISIONS.md`, and **targeted for deletion** by a follow-up engine WP.
  Scaffold artifacts must be:
  - Clearly labeled as such in a `// why:` comment at the call site
  - Backed by a `DECISIONS.md` entry naming the engine gap they cover
  - **Removed**, not refactored, when the engine capability lands
- Disable buttons rather than hiding them when a move is gated by phase, stage,
  or insufficient currency. Disabled state must be derivable purely from
  `UIState` — no local "guess" state.
- Card tiles render `CardExtId` text labels in this scaffold. Card name /
  image / cost rendering is out of scope and tracked under Open Questions for
  a follow-up WP.
- Cost-based disabling, when applied, must compare against
  `economy.availableAttack` / `economy.availableRecruit` (post-spend
  amounts), NOT the raw `economy.attack` / `economy.recruit` fields. The
  raw fields represent total attack / recruit earned this turn before
  spending; only the `available*` fields reflect actual affordability.
- Cost-based disabling must only be applied when the relevant cost value
  is present on the `UIState` record being rendered. As of 2026-04-26
  costs are NOT projected into UIState — `UICityCard`, `UIHQState.slots`,
  and `UIMastermindState` carry no `fightCost` / `cost` field — so all
  components in this scaffold apply **stage-only gating only**. When a
  follow-up WP projects costs, the disabled expression extends to also
  disable when affordability fails. The UI must not infer, hardcode, or
  fetch costs from the registry.
- No optimistic UI: clicking a button calls `submitMove(...)` and waits for
  the next server frame to update visible state. The UI never mutates the
  Pinia store as a "preview".
- `.reduce()` is permitted only for simple accumulation (sum, join). No
  `.reduce()` for branching logic.
- No barrel re-exports, no `import * as` from local modules. Every component
  imports exactly the names it uses.

**Session protocol:**

- If `UIState` is missing a field this WP needs (e.g., `handCards` is empty
  for the viewing player when the engine indicates it should not be), STOP
  and raise it as a question — do not work around it client-side. The fix
  belongs in the engine `playerView`, not in the UI.
- If a move's payload shape in the engine differs from what this WP
  documents, STOP and trust the engine — re-read the move's `*.ts` file and
  align the UI emitter to it. Never invent a payload shape.

**Locked contract values (do not paraphrase or re-derive):**

- **Move names registered on `LegendaryGame`** (lock — UI must call only these):
  `'drawCards'` | `'playCard'` | `'endTurn'` | `'fightVillain'` |
  `'recruitHero'` | `'fightMastermind'`
- **All six move payloads** (verified against engine source 2026-04-26 — see
  Open Question Q2 resolution at the foot of this packet):
  - `drawCards`: `{ count: number }` (`coreMoves.types.ts`)
  - `playCard`: `{ cardId: string }` — CardExtId from
    `UIPlayerState.handCards` (`coreMoves.types.ts`)
  - `endTurn`: `{}` — empty object, `Record<string, never>`
    (`coreMoves.types.ts`)
  - `fightVillain`: `{ cityIndex: number }` — integer 0–4, the slot index
    in `UICityState.spaces` (`fightVillain.ts`)
  - `recruitHero`: `{ hqIndex: number }` — integer 0–4, the slot index in
    `UIHQState.slots` (`recruitHero.ts`)
  - `fightMastermind`: `{}` — no arguments; the move always targets the
    top tactic of the current mastermind (`fightMastermind.ts`)
- **UIState field paths** (verified against `uiState.types.ts` 2026-04-26):
  - `uiState.game.phase` — `'lobby'` | `'setup'` | `'play'` | `'end'`
    (NOT `uiState.phase`)
  - `uiState.game.currentStage` — `'start'` | `'main'` | `'cleanup'`
    (NOT `uiState.currentStage`)
  - `uiState.game.turn`, `uiState.game.activePlayerId` — also nested
  - `uiState.players[i].handCards?: string[]` — viewing-player hand
  - `uiState.city.spaces: (UICityCard | null)[]` — 5-slot array; each
    slot is either `null` (empty) or `{ extId, type, keywords }`
  - `uiState.hq.slots: (string | null)[]` — 5-slot array of CardExtIds
    (or null); HQ does NOT carry the `UICityCard` shape
  - `uiState.mastermind: { id, tacticsRemaining, tacticsDefeated }` —
    mastermind has no slot index; one tile, one click
  - `uiState.economy: { attack, recruit, availableAttack, availableRecruit }`
    — for affordability gating, use `availableAttack` /
    `availableRecruit` (the post-spend amounts), NOT `attack` / `recruit`
- **Stage gating per move** (UI must compute `disabled` from these — values
  read from `uiState.game.currentStage`):
  - `drawCards` enabled in `'start'` or `'main'`
  - `playCard` enabled in `'main'`
  - `fightVillain`, `recruitHero`, `fightMastermind` enabled in `'main'`
  - `endTurn` enabled in `'cleanup'`
- **Cost data is NOT in UIState** (verified 2026-04-26): `UICityCard`,
  `UIHQState.slots`, and `UIMastermindState` do not expose `fightCost` or
  `cost`. Per the cost-gating fallback constraint above, all six
  components apply **stage-only gating** today. Affordability gating is
  enabled only when a follow-up WP projects costs into UIState.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
state inspection of the Pinia store and the boardgame.io client log.

The following requirements are mandatory:

- Every interactive component derives its disabled / enabled state purely
  from the current `UIState` snapshot. Reproducing a UI state requires only
  replaying the same server frames into the Pinia store.
- Every `submitMove(...)` call passes a literal move name (one of the six
  locked names) and a typed payload — no dynamic move name construction, no
  spread-payload tricks. A search of the source for `submitMove(` reveals
  exactly the call sites this packet introduces.
- Click handlers emit one move per click. No batched submissions, no
  retries, no debouncing. Failed moves surface as no-op (engine returns
  `void` on validation failure) and the next server frame reflects truth.
- Component tests render a component with a stubbed `submitMove` and assert
  that clicking emits the expected `(name, args)` tuple. State changes are
  verified against UIState fixtures, not against engine output.

---

## Scope (In)

### A) Hand row component — `HandRow.vue`

- **`apps/arena-client/src/components/play/HandRow.vue`** — new:
  - Receives `handCards: readonly string[]` and `currentStage: TurnStage` as
    props (typed via `import type` from the game-engine UIState module)
  - Receives `submitMove: (name: UiMoveName, args: unknown) => void` as a prop
    (no direct client import; `UiMoveName` is the locally-defined union of the
    six locked move names — see Packet-specific constraints)
  - Renders one clickable `<button>` per card in `handCards`, label = the
    `CardExtId` string
  - Click handler calls `submitMove('playCard', { cardId })` exactly once
    per click
  - Each button is disabled when `currentStage !== 'main'`
  - Empty hand renders a "Hand is empty" placeholder (full sentence)
  - Add `// why:` comment on the disabled-derivation expression — it
    encodes the locked stage gating contract.

### B) City row component — `CityRow.vue`

- **`apps/arena-client/src/components/play/CityRow.vue`** — new:
  - Receives `city: UICityState` (= `{ spaces: (UICityCard | null)[] }`),
    `currentStage: TurnStage`, `economy: UITurnEconomyState`, and
    `submitMove` as props
  - Iterates `city.spaces` **by positional index** (`for (let cityIndex =
    0; cityIndex < city.spaces.length; cityIndex++)`). Each slot renders
    one of:
    - **Occupied slot** (`spaces[cityIndex] !== null`): a `<button>`
      labelled with the `UICityCard.extId` string. Click handler calls
      `submitMove('fightVillain', { cityIndex })` exactly once per click.
    - **Empty slot** (`spaces[cityIndex] === null`): a non-interactive
      placeholder element (e.g., a `<div>`) labelled "Empty slot". Empty
      slots must remain visible so the City row's slot positions stay
      stable across renders.
  - Each occupied-slot button is disabled when `currentStage !== 'main'`.
    Cost-based affordability gating is **not applied** in this scaffold —
    `UICityCard` does not expose `fightCost`. When a follow-up WP adds
    cost projection, the disabled expression extends to also disable
    when `economy.availableAttack` is below the projected cost.
  - Add `// why:` comment on the disabled-derivation expression citing
    the locked stage gating contract and the absence of cost data in
    today's `UICityCard`.
  - Add `// why:` comment on the empty-slot placeholder explaining that
    stable slot positions matter for the engine's positional `cityIndex`
    payload contract — collapsing empties would shift indices.

### C) HQ row component — `HQRow.vue`

- **`apps/arena-client/src/components/play/HQRow.vue`** — new:
  - Receives `hq: UIHQState` (= `{ slots: (string | null)[] }` — bare
    CardExtId strings, NOT the `UICityCard` shape used by the City),
    `currentStage: TurnStage`, `economy: UITurnEconomyState`, and
    `submitMove` as props
  - Iterates `hq.slots` **by positional index** (`for (let hqIndex = 0;
    hqIndex < hq.slots.length; hqIndex++)`). Each slot renders one of:
    - **Occupied slot** (`slots[hqIndex] !== null`): a `<button>` labelled
      with the bare CardExtId string. Click handler calls
      `submitMove('recruitHero', { hqIndex })` exactly once per click.
    - **Empty slot** (`slots[hqIndex] === null`): a non-interactive
      placeholder labelled "Empty slot". Empty slots must remain visible
      so the HQ row's slot positions stay stable.
  - Each occupied-slot button is disabled when `currentStage !== 'main'`.
    Cost-based affordability gating is **not applied** in this scaffold —
    `UIHQState.slots` exposes only CardExtId strings, no cost data. When
    a follow-up WP projects costs, the disabled expression extends to
    also disable when `economy.availableRecruit` is below the projected
    cost.
  - Add `// why:` comment on the disabled-derivation expression citing
    the locked stage gating contract and the bare-string slot shape.
  - Add `// why:` comment on the empty-slot placeholder explaining that
    stable slot positions matter for the engine's positional `hqIndex`
    payload contract.

### D) Mastermind tile component — `MastermindTile.vue`

- **`apps/arena-client/src/components/play/MastermindTile.vue`** — new:
  - Receives `mastermind: UIMastermindState` (= `{ id, tacticsRemaining,
    tacticsDefeated }`), `currentStage: TurnStage`,
    `economy: UITurnEconomyState`, and `submitMove` as props
  - Renders a single `<button>` labelled with `mastermind.id` plus a
    short status (e.g., `"Tactics remaining: <n>"`)
  - Click handler calls `submitMove('fightMastermind', {})` — empty
    object payload. The engine always targets the top tactic of the
    current mastermind; there is no per-click target choice.
  - Disabled when `currentStage !== 'main'` OR
    `mastermind.tacticsRemaining === 0`. Cost-based affordability gating
    is **not applied** in this scaffold — `UIMastermindState` does not
    expose `fightCost`.
  - Add `// why:` comment on the disabled-derivation expression citing
    the locked stage gating contract, the tactics-remaining check, and
    the absence of cost data in today's `UIMastermindState`.
  - Add `// why:` comment on the empty-object payload explaining that
    `fightMastermind` takes no arguments by design (defeats the top
    tactic; mastermind identity is implicit).

### E) Turn action bar — `TurnActionBar.vue`

- **`apps/arena-client/src/components/play/TurnActionBar.vue`** — new:
  - Receives `currentStage: TurnStage` and `submitMove` as props
  - Renders two buttons: `Draw` and `End Turn`
  - `Draw` calls `submitMove('drawCards', { count: 6 })` — count is
    hardcoded to 6 to match Legendary's standard hand size (one click
    refills to a full hand). The engine has no `HAND_SIZE` constant
    today and no `turn.onBegin` auto-draw; this button is a scaffold
    artifact that will be removed when a follow-up engine WP adds
    automatic draw-to-hand-size on turn start. See Open Question Q3.
  - `End Turn` calls `submitMove('endTurn', {})` — empty-object payload
    matches `EndTurnArgs = Record<string, never>`. Note: the engine's
    `endTurn` move already empties hand and inPlay into discard before
    rotating players (verified in `coreMoves.impl.ts:131`); the UI does
    not need to perform any cleanup mutation, only emit the move.
  - `Draw` disabled when `currentStage` is not `'start'` or `'main'`
  - `End Turn` disabled when `currentStage !== 'cleanup'`
  - Add `// why:` comments on both disabled expressions and on the
    `count: 6` constant (citing the absence of an engine `HAND_SIZE`
    constant and the deletion-target nature of this button).

### F) Play view composer — extend the existing live-match route

- **`apps/arena-client/src/components/play/PlayView.vue`** — new:
  - Top-level composition for the in-match screen
  - Reads from the Pinia `uiState` store (`useUiStateStore()`)
  - Resolves the active viewer's `UIPlayerState` (`handCards`, etc.) from
    the store
  - Resolves `submitMove` from the live client handle held by the route
    (see G below)
  - Composes `<ArenaHud />` (existing) above `<MastermindTile />`,
    `<CityRow />`, `<HQRow />`, `<HandRow />`, and `<TurnActionBar />`
  - Renders a fallback `<EmptyMatchState />` block when the store snapshot
    is `null` (full-sentence message)
  - Resolves `currentStage` for prop-passing from `uiState.game.currentStage`
    (NOT `uiState.currentStage` — phase / stage live nested under
    `uiState.game` per `uiState.types.ts`)
  - Resolves the active viewer's `UIPlayerState` from `uiState.players`
    matching the local player's id
  - Conditionally suppresses all interactive children (`MastermindTile`,
    `CityRow`, `HQRow`, `HandRow`, `TurnActionBar`) when
    `uiState.game.phase !== 'play'`. In non-play phases, only `ArenaHud`
    and the existing end / lobby components may render. Add `// why:`
    comment on the phase-gate expression citing the locked phase
    vocabulary (`'lobby'` | `'setup'` | `'play'` | `'end'`) and the
    nested `uiState.game.phase` path.

### G) Live-match route wiring

- **`apps/arena-client/src/lobby/LiveMatchView.vue`** — modified (or the
  equivalent file introduced by WP-090; the WP author must locate and read
  the actual file before editing):
  - Modifications are limited strictly to passing an existing `submitMove`
    reference into `<PlayView :submit-move="submitMove">` as a prop. No
    additional logic, refactors, side effects, lifecycle changes, or
    structural reorganisation are permitted in this file.
  - Does not introduce a second runtime engine import
  - Add `// why:` comment on the prop drilling — components are kept pure
    and prop-driven for testability rather than reaching into the client
    factory directly.

### H) Tests

Add `node:test` tests under `apps/arena-client/src/components/play/`:

- **`HandRow.test.ts`** — renders three CardExtId buttons from a fixture
  hand; clicking one calls the stubbed `submitMove` with
  `('playCard', { cardId: '<id>' })`; buttons disabled when stage is not
  `'main'`; empty hand renders the placeholder text.
- **`CityRow.test.ts`** — renders one button per villain; click emits
  `('fightVillain', <args>)`; disabled gating reflects stage and currency.
- **`HQRow.test.ts`** — symmetric to CityRow for `recruitHero`.
- **`MastermindTile.test.ts`** — single button emits `('fightMastermind',
  <args>)`; disabled gating asserted.
- **`TurnActionBar.test.ts`** — two buttons; `Draw` emits
  `('drawCards', { count: 6 })`; `End Turn` emits `('endTurn', {})`; stage
  gating asserted.
- **`PlayView.test.ts`** — given a UIState fixture, mounts `PlayView`,
  asserts that the five interactive children receive their expected props
  (use prop-spy mounting, not full DOM assertion).
- All tests use `node:test` and `node:assert` only — this is the
  project-wide test runner per `.claude/CLAUDE.md` ("Test runner:
  `node:test` (native Node.js test runner)") and the existing
  `apps/arena-client` test files (`ArenaHud.test.ts`,
  `BootstrapProbe.test.ts`, etc.) follow that precedent. No Vitest, no
  Jest, no Mocha. No new test runner may be introduced by this packet.
- No test imports `@legendary-arena/game-engine` runtime — types only.
- No test imports `boardgame.io`.

---

## Out of Scope

- No new moves added to the engine — the six existing moves are the entire
  vocabulary
- No engine changes — `playerView`, UIState shape, and move signatures
  remain locked. If the UI needs a field that does not exist, file a
  separate WP for the engine change
- No card display fidelity — names, images, attack-cost / recruit-cost
  surfaced via the registry are tracked under Open Questions and assigned
  to a follow-up WP
- No drag-and-drop, hover previews, or animation — buttons only
- No target picker / multi-target effects — moves with multiple targets
  (if any in the engine) use first-eligible-target defaults; richer
  selection UI is a future WP
- No pre-planning UI integration — the pre-plan store, adapters, and
  components landed in EC-059 (commit `5c5fc1e`, 2026-04-26) but are
  contract-surface only and not wired into the live match flow. The
  actual gameplay-time wiring is queued as WP-070 (Live Mutation
  Middleware — Pre-Plan ↔ Engine Disruption Wiring, queued
  2026-04-26 at commit `23dc700`). WP-100 must not modify any file
  under `apps/arena-client/src/{stores,preplan,components/preplan,fixtures/preplan}/`
  and must not import the pre-plan store from any new component.
- No spectator-specific UI — spectators continue to see the read-only HUD
  from WP-062 unchanged
- No replay-mode interactivity — the replay inspector (WP-064) remains
  read-only
- No keyboard shortcuts, accessibility-keyboard navigation, or
  screen-reader labelling beyond what Vue's default `<button>` provides
  (a11y polish is a follow-up WP — see Open Questions)
- No styling beyond a minimal default CSS class set; visual design is a
  follow-up WP
- Refactors, cleanups, or "while I'm here" improvements are out of scope
  unless explicitly listed in Scope (In)

---

## Files Expected to Change

- `apps/arena-client/src/components/play/HandRow.vue` — **new** — interactive hand row
- `apps/arena-client/src/components/play/HandRow.test.ts` — **new** — component test
- `apps/arena-client/src/components/play/CityRow.vue` — **new** — interactive City row
- `apps/arena-client/src/components/play/CityRow.test.ts` — **new** — component test
- `apps/arena-client/src/components/play/HQRow.vue` — **new** — interactive HQ row
- `apps/arena-client/src/components/play/HQRow.test.ts` — **new** — component test
- `apps/arena-client/src/components/play/MastermindTile.vue` — **new** — interactive mastermind tile
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **new** — component test
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **new** — Draw + End Turn buttons
- `apps/arena-client/src/components/play/TurnActionBar.test.ts` — **new** — component test
- `apps/arena-client/src/components/play/PlayView.vue` — **new** — in-match composer
- `apps/arena-client/src/components/play/PlayView.test.ts` — **new** — composer test
- `apps/arena-client/src/lobby/LiveMatchView.vue` — **modified** — pass `submitMove` into `PlayView` (WP author confirms exact filename before editing)

No other files may be modified.

**Note on file count.** This WP lists 13 files (6 `.vue` components + 6
`.test.ts` companions + 1 modified route file), which exceeds the
lint-guideline soft limit of ~8 in `00.3-prompt-lint-checklist.md §5`. The
count is intentional and the WP is **not** split because:

- The six interactive components (`HandRow`, `CityRow`, `HQRow`,
  `MastermindTile`, `TurnActionBar`, `PlayView`) form a single cohesive
  scaffold; splitting them across two WPs would require a temporary
  intermediate state where the arena-client is half-interactive and ships
  no testable surface in the meantime.
- Each `.vue` + `.test.ts` pair is a tightly coupled unit. Splitting the
  test out of its component's WP is a known anti-pattern (it lets
  components ship without proof).
- The modified `LiveMatchView.vue` is one-line prop-passing only and is
  scoped to a single seam (Scope G).
- Under `00.1-master-coordination-prompt.md` splitting guidance, splits
  are warranted when scope exceeds one session's coherent work. This WP
  is one cohesive scaffold sized for one session.

If a session-sized concern emerges during execution, the natural split
boundary is between the five interactive children (Hand / City / HQ /
Mastermind / TurnActionBar — Scope A–E + their tests) and the composer
(PlayView + LiveMatchView wiring — Scope F + G). That split would be
documented as a follow-up before execution if the scope-fit risk
materialises.

---

## Acceptance Criteria

**Note on AC count.** The lint-guideline soft limit in
`00.3-prompt-lint-checklist.md §14` is 6–12 binary checks. This WP has ~32
binary checks distributed across 6 component sub-tasks (~3 checks each)
plus engine-import discipline, determinism / authority, tests, and
scope-enforcement groups. Each
check is binary, observable, and tied to a specific component or
constraint — none are subjective. The count reflects breadth across the
six deliverables in `## Files Expected to Change`, not depth within any
single deliverable. Trimming would force consolidating per-component
gating checks (e.g., merging Hand / City / HQ / Mastermind disabled-state
assertions into one), which would lose the ability to identify which
component failed.

### Hand row
- [ ] `HandRow.vue` exists and exports a Vue component with exactly the props
      `handCards: readonly string[]`, `currentStage: TurnStage`, `submitMove`
- [ ] Clicking a hand button calls `submitMove('playCard', { cardId })` exactly
      once with the correct `cardId`
- [ ] All hand buttons disabled when `currentStage !== 'main'`
- [ ] Empty `handCards` renders a full-sentence placeholder message

### City row
- [ ] `CityRow.vue` exports a Vue component with the props specified in Scope B
- [ ] Renders exactly `city.spaces.length` slot positions (occupied buttons +
      empty placeholders), preserving positional indices 0..4
- [ ] Clicking an occupied villain button calls
      `submitMove('fightVillain', { cityIndex })` with the integer index
      matching that slot's position in `city.spaces`
- [ ] Empty slots render as non-interactive placeholders, not buttons
- [ ] Occupied buttons disabled when `currentStage !== 'main'`
- [ ] No reference to `economy.attack` or `economy.recruit` raw fields —
      affordability gating is deferred (cost data not in UIState)

### HQ row
- [ ] `HQRow.vue` exports a Vue component with the props specified in Scope C
- [ ] Renders exactly `hq.slots.length` slot positions (occupied buttons +
      empty placeholders), preserving positional indices 0..4
- [ ] Clicking an occupied hero button calls
      `submitMove('recruitHero', { hqIndex })` with the integer index
      matching that slot's position in `hq.slots`
- [ ] Empty slots render as non-interactive placeholders, not buttons
- [ ] Occupied buttons disabled when `currentStage !== 'main'`
- [ ] No reference to `economy.attack` or `economy.recruit` raw fields —
      affordability gating is deferred

### Mastermind tile
- [ ] `MastermindTile.vue` exports a Vue component with the props specified
- [ ] Click calls `submitMove('fightMastermind', {})` with an empty-object
      payload (no arguments)
- [ ] Disabled when `currentStage !== 'main'` OR
      `mastermind.tacticsRemaining === 0`
- [ ] No cost-based affordability gating in this scaffold

### Turn action bar
- [ ] `Draw` emits `submitMove('drawCards', { count: 6 })`
- [ ] `End Turn` emits `submitMove('endTurn', {})`
- [ ] `Draw` disabled when stage is not `'start'` or `'main'`
- [ ] `End Turn` disabled when stage is not `'cleanup'`

### Play view composer
- [ ] `PlayView.vue` reads UIState from `useUiStateStore()`
- [ ] Renders `<ArenaHud />` plus the five new interactive children
- [ ] Renders empty-state message when snapshot is `null`
- [ ] Reads `currentStage` from `uiState.game.currentStage` (NOT
      `uiState.currentStage`) before passing it down as a prop
- [ ] Interactive children (`MastermindTile`, `CityRow`, `HQRow`, `HandRow`,
      `TurnActionBar`) are not rendered when
      `uiState.game.phase !== 'play'`

### Engine-import discipline
- [ ] No new file under `apps/arena-client/**` introduces a runtime import of
      `@legendary-arena/game-engine` (types only — verified by Select-String
      for `^import {` lines without `type`)
- [ ] No file under `apps/arena-client/src/components/play/**` imports
      `bgioClient.ts` directly — `submitMove` is always passed in as a prop
- [ ] All six new components (`HandRow`, `CityRow`, `HQRow`, `MastermindTile`,
      `TurnActionBar`, `PlayView`) declare `submitMove` with the locally-defined
      `UiMoveName` union, not a bare `string`

### Determinism & Authority
- [ ] No component mutates the Pinia `uiState` store, derives local optimistic
      state, or maintains a "preview" buffer in response to a click; all UI
      changes occur only after a server frame updates `uiState`
- [ ] No scaffold artifact (e.g., the `Draw` button) is introduced without a
      `// why:` comment at the call site naming the engine gap it covers and a
      matching `DECISIONS.md` entry

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (all test files
      including the new ones)
- [ ] No test imports from `boardgame.io`
- [ ] No test imports from `@legendary-arena/game-engine` at runtime (types only)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed
      with `git diff --name-only`)
- [ ] Engine package, server package, and registry package are unchanged
- [ ] No new moves registered on `LegendaryGame`

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0, no TypeScript errors

# Step 2 — full test run
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests pass, 0 failing

# Step 3 — confirm no second runtime engine import in arena-client
Select-String -Path "apps\arena-client\src\components\play\*.vue", "apps\arena-client\src\components\play\*.ts" -Pattern "^import \{[^}]*\} from '@legendary-arena/game-engine'"
# Expected: no output (only `import type` lines should match a separate query)

# Step 4 — confirm submitMove is the only move-emission pattern
Select-String -Path "apps\arena-client\src\components\play" -Pattern "submitMove\(" -Recurse
# Expected: one match per emit site (drawCards, playCard, endTurn, fightVillain, recruitHero, fightMastermind)
#           plus prop-typed declarations

# Step 5 — confirm no client.moves direct access
Select-String -Path "apps\arena-client\src\components\play" -Pattern "client\.moves" -Recurse
# Expected: no output

# Step 6 — confirm no Math.random in new components
Select-String -Path "apps\arena-client\src\components\play" -Pattern "Math\.random" -Recurse
# Expected: no output

# Step 7 — confirm engine and server unchanged
git diff --name-only -- packages/game-engine apps/server packages/registry
# Expected: no output

# Step 8 — confirm pre-plan UI surface (EC-059) is untouched
git diff --name-only -- apps/arena-client/src/preplan apps/arena-client/src/components/preplan apps/arena-client/src/fixtures/preplan apps/arena-client/src/stores/preplan.ts
# Expected: no output (EC-059 contract surface is locked per §Out of Scope)

# Step 9 — confirm no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r build` exits 0 (full monorepo still builds)
- [ ] No second runtime engine import in arena-client (Select-String verified)
- [ ] No `client.moves` direct access in any component (Select-String verified)
- [ ] No `Math.random` in any new file (Select-String verified)
- [ ] Engine, server, and registry packages unchanged (`git diff` verified)
- [ ] WP-090 outputs (`bgioClient.ts`, `LobbyView.vue`, etc.) were not modified
      beyond the documented `LiveMatchView.vue` prop-passing change
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] Manual smoke test: dev server starts, two browsers join a match, the
      active player can click Draw, click a hand card, click a villain in the
      City, click a hero in the HQ, click End Turn, and the next player gets
      control with state visible to both clients
- [ ] `docs/ai/STATUS.md` updated — what is now playable end-to-end through
      the browser; what was not playable before
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
      - Why the UI emits `drawCards` with `count: 6` hardcoded (matches
        Legendary's standard hand size; engine has no `HAND_SIZE`
        constant and no `turn.onBegin` auto-draw today; the button is a
        scaffold artifact pending a follow-up engine WP that adds
        automatic draw-to-hand-size — see Open Question Q3)
      - Why card tiles render `CardExtId` strings rather than card names /
        images (registry-projection path is a separate WP — see Open Questions)
      - Why `submitMove` is prop-drilled instead of injected via a Vue provide
        / inject seam (testability — components remain pure and prop-driven)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-100 checked off with today's
      date

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §4 (Faithful
Multiplayer Experience), §8 (Deterministic Game Engine), §10 (Content as
Data), §11 (Stateless Client Philosophy), §17 (Accessibility & Inclusivity).

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

- §3 / §8 are upheld by the "engine owns truth" enforcement: every UI
  interaction routes through `submitMove(...)` and the client never computes
  outcomes, never applies optimistic state, and never short-circuits
  validation. The constraints in this packet make any local reconciliation
  attempt a packet-lint violation.
- §4 is advanced by introducing the first interactive multiplayer surface —
  active player drives a turn through the browser; spectator and waiting
  players see the resulting state via the same `UIState` projection. No
  reconnection or late-joining behavior is changed; the WP relies on
  WP-090's existing wiring.
- §10 is preserved by treating `CardExtId` strings as the canonical content
  identifier flowing through `UIState`. Card display fidelity (names,
  images, costs) is deferred to a follow-up registry-projection WP — the
  client is not granted a runtime registry seam in this packet (see Open
  Question #1). This keeps content authority in the engine / registry
  pipeline.
- §11 is preserved by writing components as pure consumers of the Pinia
  `uiState` store. Components hold no derived state; every disabled / enabled
  decision is a pure function of the current `UIState` snapshot. No browser
  persistence (localStorage, sessionStorage, IndexedDB) is permitted.
- §17 is acknowledged as in-scope vision territory but **deferred**: this
  scaffold ships plain `<button>` elements with default browser semantics. A
  follow-up WP must add ARIA labels, keyboard focus management, and
  screen-reader state announcements before public-beta gating. The deferral
  is intentional and tracked in Open Question #4.

**Non-Goal proximity check (NG-1..7):** None of NG-1..7 are crossed. This
WP introduces no monetization surface, no cosmetic store, no persuasive UI,
no engagement-pattern dark surfaces, no paid competitive lane, and no
content gated behind purchase. The scaffold renders functional buttons
only.

**Determinism preservation (Vision §8, §22):** This WP introduces no new
randomness source, no wall-clock reads, no client-side rule execution, and
no client-side state mutation that the server cannot reproduce from frame
replay. Every UI-visible state change is a function of an authoritative
`UIState` snapshot pushed by the server. The engine remains the sole
authority on game outcomes; the client is a pure renderer plus an intent
emitter. Replay faithfulness is preserved because this packet adds no state
the engine does not already produce.

---

## Open Questions (Resolution Record — Pre-Promotion Q&A)

These questions were surfaced during scaffold drafting (2026-04-26) and
resolved before promotion to Ready. Q4 remains deferred-by-design as a
named follow-up commitment, not a blocker. Kept here as audit trail.

1. *(Resolved 2026-04-26 — followed up as WP-111.)* Card display
   fidelity (registry projection path) was decided in favour of option
   (a): extend the engine `playerView` to embed a small card-display
   sub-record per visible card. The engine reaches the registry at
   setup time and snapshots display fields into UIState, mirroring the
   existing `G.cardStats` / `G.villainDeckCardTypes` setup-snapshot
   pattern. The Layer Boundary stays intact — no runtime registry seam
   in `apps/arena-client`.
   The work is drafted as
   [WP-111-uistate-card-display-projection.md](WP-111-uistate-card-display-projection.md):
   adds `G.cardDisplayData: Record<CardExtId, UICardDisplay>`, surfaces
   it through `buildUIState` on `UICityCard`, `UIHQState`,
   `UIPlayerState.handDisplay`, and `UIMastermindState`, and redacts
   `handDisplay` alongside opponent `handCards`. WP-111 is engine-only;
   a trivial follow-up UI WP binds the WP-100 components to the new
   display fields (~5 button labels + image tags). Until WP-111 lands,
   WP-100 components continue to render `CardExtId` strings as labels —
   correct and unchanged.

2. *(Resolved 2026-04-26 via move-payload pre-review.)* All three
   non-core moves take simple positional or empty arguments — no
   target picker is needed:
   - `fightVillain({ cityIndex: number })` — one slot, one click. The
     engine handles Guard blocking and attack-cost validation
     internally and silently no-ops on invalid input.
   - `recruitHero({ hqIndex: number })` — symmetric. The engine
     handles recruit-cost validation internally.
   - `fightMastermind({})` — no arguments. The move always defeats the
     top tactic of the current mastermind; mastermind identity is
     implicit, multi-tactic defeats are out of scope (deferred to
     WP-024 per `fightMastermind.ts` source).
   The locked payloads are pinned in the **Locked contract values**
   section above. The click-with-defaults model is sufficient for this
   scaffold; no follow-up target-picker WP is required for the engine's
   current move surface. (If WP-024 introduces multi-tactic or
   target-of-effect choices, that WP will need its own UI extension.)

3. *(Resolved 2026-04-26 via engine pre-review.)* The Draw button stays;
   count is locked at 6. Findings:
   - The engine has **no automatic draw**: `playerInit.ts` initializes
     every hand to `[]`, `turn.onBegin` resets stage and economy but does
     not draw, and `endTurn` empties hand+inPlay to discard but does not
     draw the next hand. There is no `HAND_SIZE` constant in the engine.
   - Without an explicit `drawCards` call, every player starts every turn
     (including turn 1) with **zero cards in hand**. The game is
     unplayable in the browser without either a UI Draw button or a new
     engine auto-draw hook.
   - **Decision:** keep the Draw button in this WP, hardcode
     `count: 6` to match Legendary's standard hand size (one click =
     full refill). The button is a **scaffold artifact** — it exists
     only because the engine's draw mechanics are MVP-incomplete.
   - **Follow-up engine WP recommended (not yet drafted):** add a
     `turn.onBegin` (or `onTurnEnd`) auto-draw to a canonical
     `HAND_SIZE` constant. When that lands, the Draw button is removed
     entirely and `drawCards` becomes an internal engine call only.
     This is a separate engine packet, not a blocker for WP-100.

4. **A11y baseline.** This scaffold ships plain `<button>` elements. A
   follow-up WP should add ARIA labels, keyboard focus management, and
   screen-reader-friendly state announcements.

5. *(Resolved during review pass.)* End-game and lobby gating is now a hard
   Scope F requirement: `PlayView` must suppress all interactive children
   when `uiState.phase !== 'play'`. The existing `EndgameSummary.vue` and
   lobby components continue to render via `ArenaHud` switching as before.

---

## Promotion Record (2026-04-26)

- Drafted 2026-04-26 in response to "what is keeping me from playing
  Legendary Arena?" — verified no existing WP in WP-061..WP-099 range
  delivers an interactive gameplay surface; closest prior work is
  WP-090 (live client wiring, non-interactive) and WP-062 (read-only
  HUD).
- 00.3 lint-gate self-review run 2026-04-26 — PASS. Final-Gate
  conditions clear. Findings applied:
  - §17 Vision Alignment section added (clauses §3, §4, §8, §10, §11,
    §17 cited; NG-1..7 proximity check stated; determinism
    preservation line included)
  - §4 Context references extended to include `00.2-data-requirements.md`
    (`CardExtId`) and `DECISIONS.md` (scan note)
  - §7 Test runner tightened to `node:test` only (project-wide rule)
  - §5 file count (13) and §14 AC count (~29) exceed soft limits;
    inline justification blocks added (cohesive scaffold; per-component
    fault isolation). Reviewer may still elect to split A–E vs F–G at
    pre-flight time.
  - §8 lint subsections reference legacy `cardRegistry.js` and
    `gameStore.move()` patterns that do not match current arena-client
    architecture (post-WP-090). WP follows current architecture
    (`submitMove` seam, no runtime registry import). No change to WP;
    lint checklist itself may need a refresh — tracked separately.
  - §18 prose-vs-grep: Verification Step 6 greps `Math\.random`
    against `apps\arena-client\src\components\play\` only; WP body's
    mention is outside that grep path — no §18 collision.
  - All §1, §2, §3, §6, §9, §10, §12, §13, §15, §16 checks pass.
  - §11 (Authentication Clarity) marked N/A — packet does not touch
    auth.
- Engine-source pre-review run 2026-04-26 — three spec errors caught
  and fixed in the move-payload review:
  1. UIState path corrected from `uiState.phase` /
     `uiState.currentStage` to `uiState.game.phase` /
     `uiState.game.currentStage` (nested under `game`).
  2. City / HQ rows changed from "iterate by card" to "iterate by
     positional index" — engine takes `{ cityIndex }` / `{ hqIndex }`,
     empty slots render as non-interactive placeholders to preserve
     index stability.
  3. Cost-gating fields changed from `economy.attack` /
     `economy.recruit` to `economy.availableAttack` /
     `economy.availableRecruit` (post-spend amounts).
- Engine draw-mechanics pre-review run 2026-04-26 — confirmed engine
  has no auto-draw (initial hand `[]` per `playerInit.ts`,
  `turn.onBegin` does not draw per `game.ts`, `endTurn` empties hand
  to discard but does not draw next hand per `coreMoves.impl.ts`, no
  `HAND_SIZE` constant). Decision: Draw button stays; count locked at
  6. Recommended follow-up engine WP to add `turn.onBegin` auto-draw
  to a canonical `HAND_SIZE` constant, after which this button is
  removed entirely.
- Peer-review pass run 2026-04-26 (post-promotion). Five surgical
  improvements applied; none expanded scope:
  1. **Test/spec mismatch fixed.** `TurnActionBar.test.ts` Draw
     assertion corrected from `{ count: 1 }` to `{ count: 6 }` to
     match Scope E, Open Question Q3, and Definition of Done.
  2. **Scaffold-artifact policy named.** New constraint under
     Packet-specific naming the policy explicitly (label, decision-log,
     remove-not-refactor) so the `Draw` button cannot quietly become
     permanent.
  3. **`submitMove` typed via local `UiMoveName` union.** Replaces the
     bare `string` move-name type with a UI-side mirror of the engine's
     six-move bag. Type-only, no runtime coupling, catches typos at
     compile time.
  4. **Determinism & Authority AC group added.** Makes the no-optimistic-UI
     and scaffold-artifact rules binary-auditable rather than
     prose-only.
  5. **"Empty space" → "Empty slot" naming standardised** between
     City and HQ rows for accessibility-label and test-text consistency.
- **EC-100 decision (recorded 2026-04-26):** No EC-100 is required.
  Rationale: WP-100 introduces no engine mutation, no data migration,
  no ordering-sensitive steps, and no irreversible side effects. All
  execution risk is detectable via the tests, static analysis, and
  Select-String steps already specified in `## Verification Steps`. The
  decision should be mirrored as a `DECISIONS.md` entry by the
  executing session so future reviewers do not re-litigate.
