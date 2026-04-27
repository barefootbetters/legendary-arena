# WP-100 — Interactive Gameplay Surface (Click-to-Play UI Scaffold)

**Status:** Ready (revised 2026-04-27; original Draft → Ready 2026-04-26; original Commit A `378729a` + Commit B `1dffb3a` reverted 2026-04-27 via `541d67c` + `19d1f66` after smoke-test discovery surfaced a lobby/setup phase-transition gap that the original scope did not cover; pre-A governance commit `7ff4006` retained — D-10001 amendment, EC-100 stub, D-10002 renumber, and PS-1/2/3 fold-ins all still apply)
**Primary Layer:** Arena Client (`apps/arena-client/**`) — primary; Game Engine (`packages/game-engine/src/lobby/`) — surgical patch only (one-line `setPhase` retarget in an existing move + paired test assertion flip; no new move, no new field, no new phase hook)
**Dependencies:** WP-089 (engine playerView wiring), WP-090 (live match client wiring), WP-062 (arena HUD scaffolds), WP-092 (lobby loadout intake)

---

## Session Context

WP-089 locked the `UIState` projection (including `handCards` for the viewing
player, `city`, `hq`, `mastermind`, and `economy.attack`/`economy.recruit`) and
WP-090 shipped the live boardgame.io client with `submitMove(name, ...args)` as
the single intent submission seam in `apps/arena-client/src/client/bgioClient.ts`;
this packet adds the first interactive components that consume that projection
and call `submitMove` so a human can click through a turn end-to-end.

**Revision context (2026-04-27).** The original WP-100 scope shipped on
2026-04-26 (Commits A `378729a` + B `1dffb3a`) and passed `pnpm test` with
`169/16/0`. Manual smoke testing in two browsers surfaced a gap WP-100's
original scope did not cover: the engine's lobby phase has two moves
(`setPlayerReady`, `startMatchIfReady`) that transition lobby → setup, but
the setup phase is empty (no `onBegin`, no `endIf`, no exit move) and no
production code anywhere calls `setPhase('play')`. Once a match enters
`setup`, it never reaches `play` — the click-to-play surface never renders.
WP-100's locked six-name UI vocabulary (`drawCards`, `playCard`, `endTurn`,
`fightVillain`, `recruitHero`, `fightMastermind`) also has no surface to
emit `setPlayerReady` / `startMatchIfReady` from the browser. Commits A + B
were reverted on 2026-04-27 (`541d67c` + `19d1f66`); the pre-A governance
commit `7ff4006` was retained because D-10001, the EC-100 stub, D-10002,
and the PS-1/2/3 fold-ins all still apply to the revised WP. This revision
extends WP-100's scope with two minimal additions that close the gap:

1. **UI:** a `LobbyControls.vue` component plus its test that surfaces
   `setPlayerReady` (Mark Ready / Mark Not Ready) and `startMatchIfReady`
   (Start Match) from the browser. Renders only when
   `uiState.game.phase === 'play'` is **false** — i.e., during the lobby
   phase. The locked `UiMoveName` union expands from six names to eight.
2. **Engine (surgical):** `apps/arena-client/...` is the primary layer, but
   one engine file gets a one-line retarget — `lobby.moves.ts:64` flips
   `events.setPhase('setup')` → `events.setPhase('play')`. Setup phase is
   reserved for future deck-construction work that doesn't exist today;
   skipping it keeps the smoke-test path open without adding a new phase
   hook (which would invoke 01.5). The paired `lobby.moves.test.ts:110`
   assertion flips to match. **D-10006** (landed at Commit B) records the
   skip-setup decision and the evolution path for the eventual
   deck-construction WP. No new move added; no new `LegendaryGameState`
   field; no `buildInitialGameState` shape change; no new phase hook —
   01.5 NOT INVOKED on the revised scope as well.

The revised WP is still one cohesive scaffold sized for one session; the
Definition of Done expands to cover the engine baseline + the new lobby
controls.

---

## Goal

After this session, `apps/arena-client` exposes a minimal interactive gameplay
surface that lets the active player play a complete turn through the browser
**including readying up and starting a match from the lobby phase**.
Specifically, the client renders a lobby-phase controls block (Mark Ready,
Mark Not Ready, Start Match), and once the match transitions to play phase,
renders the active player's hand as clickable card tiles, the City row, the
HQ row, and the Mastermind tile as clickable targets, plus `Draw`, `End Turn`,
and per-card action buttons. Every interaction routes through the existing
`LiveClientHandle.submitMove(...)` factory from WP-090. **Eight** already-
registered moves (`setPlayerReady`, `startMatchIfReady`, `drawCards`,
`playCard`, `endTurn`, `fightVillain`, `recruitHero`, `fightMastermind`)
each have exactly one UI surface that emits them. The engine gains a single
surgical patch at [lobby.moves.ts:64](packages/game-engine/src/lobby/lobby.moves.ts:64)
— `events.setPhase('setup')` → `events.setPhase('play')` — to close the
lobby → play transition gap (the empty setup phase has no `onBegin` /
`endIf` / exit-move and never advanced today). No new engine moves, no new
server work, no `LegendaryGameState` field changes, no new phase hooks —
01.5 stays NOT INVOKED.

This WP delivers the smallest surface that turns the arena-client from a
spectator into a playable game. Card display fidelity (names, images, costs
sourced from the registry) is intentionally out of scope; this scaffold renders
`CardExtId` strings as text labels and is followed by a registry-projection WP
(see Open Questions) that supplies card display data. Lobby UI feedback
(showing per-player readiness state) is also out of scope; the lobby controls
emit intent and rely on the phase transition itself as the "it worked"
signal — when all players have readied and one clicks Start Match, the
phase advances to `play` and `PlayView` swaps to the main play surface.

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
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- arena-client test baseline at session start: **143 / 10 / 0** (143
  tests, 10 suites, 0 failed, 0 skipped — captured at HEAD `541d67c`
  on 2026-04-27 after the original-WP-100 reverts). Post-execution
  baseline must equal this count plus the new tests added by §Scope H
  + §Scope I (estimated +30 to +40 tests, +7 suites — six original
  component suites + one new LobbyControls suite). A drop in
  pre-existing tests is a regression.
- game-engine test baseline at session start: **522 / 116 / 0**.
  Post-execution baseline must equal this count exactly (the
  `lobby.moves.test.ts:110` change is an assertion-target fixture
  flip, not a new test). A drop is a regression.
- Engine source contracts verified at session start (2026-04-27):
  - [lobby.moves.ts:64](packages/game-engine/src/lobby/lobby.moves.ts:64)
    today reads `events.setPhase('setup')` — the line WP-100 retargets
    to `'play'`.
  - [lobby.moves.test.ts:110](packages/game-engine/src/lobby/lobby.moves.test.ts:110)
    today asserts `setPhaseTarget === 'setup'` — the assertion WP-100
    flips to `'play'`.
  - [game.ts:279-281](packages/game-engine/src/game.ts) declares
    `setup: { next: 'play' }` with no `onBegin`, no `endIf`, and no
    moves block. No code anywhere in `packages/game-engine/src/`
    calls `events.setPhase('play')` (verified by grep).
  - The engine's `LegendaryGame.moves` bag (8 entries: drawCards,
    playCard, endTurn, advanceStage, revealVillainCard, fightVillain,
    recruitHero, fightMastermind) does NOT contain
    `setPlayerReady` or `startMatchIfReady` — those live as
    phase-scoped moves on the `lobby` phase per
    [game.ts:271-278](packages/game-engine/src/game.ts). The UI
    nevertheless emits them through `submitMove(name, args)`;
    boardgame.io routes phase-scoped moves the same way as global
    moves at the client API surface.
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
  outside the eight-name subset locked in this revision (six play-phase
  + two lobby-phase). Confirm the eight names match the engine moves
  bag plus the lobby-phase moves block before writing any component.
  Read [game.ts:271-281](packages/game-engine/src/game.ts) — the `phases`
  block declares `lobby.moves: { setPlayerReady, startMatchIfReady }` and
  `setup: { next: 'play' }` with no `onBegin`, no `endIf`, no exit move.
  This is the gap that the §Scope J surgical patch closes.
- `packages/game-engine/src/lobby/lobby.moves.ts` — read entirely. Two
  exported moves: `setPlayerReady({ G, ctx }, args: { ready: boolean })`
  mutates `G.lobby.ready[ctx.currentPlayer]`; `startMatchIfReady({ G,
  events })` validates `validateCanStartMatch(G.lobby)`, sets
  `G.lobby.started = true`, and currently calls
  `events.setPhase('setup')`. §Scope J retargets the setPhase call to
  `'play'`. Read the `// why:` comment context on the setPhase line so
  the replacement comment in §Scope J cites the same architectural
  rationale (boardgame.io's phase-transition mechanism) plus the new
  rationale (skip-empty-setup-phase per D-10006).
- `packages/game-engine/src/lobby/lobby.moves.test.ts` — read the
  `startMatchIfReady` describe block (line 88). The test at line 110
  asserts `setPhaseTarget === 'setup'`; §Scope J flips this to `'play'`.
  No other tests reference the setPhase target — confirm by grep before
  editing.
- `packages/game-engine/src/lobby/lobby.types.ts` — `LobbyState` shape
  and `SetPlayerReadyArgs` payload type. The UI emits `setPlayerReady`
  with `{ ready: boolean }`; the engine validates via
  `validateSetPlayerReadyArgs` and silently no-ops on invalid input.
- `packages/game-engine/src/lobby/lobby.validate.ts` — read the
  `validateCanStartMatch` function. It enforces "all required players
  ready" and silently no-ops if not satisfied. The UI's `Start Match`
  button is unconditionally enabled (no UIState lobby projection in
  this scaffold) — engine validation is the authority.
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
  `'setPlayerReady'`, `'startMatchIfReady'`, `'drawCards'`, `'playCard'`,
  `'endTurn'`, `'fightVillain'`, `'recruitHero'`, `'fightMastermind'`.
  Any extension requires a new WP. (Revised 2026-04-27: original lock
  was six names; the lobby controls added in §Scope I extend the union
  to eight to surface the lobby-phase moves
  `setPlayerReady` / `startMatchIfReady`.)
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

- **Move names the UI may call** (lock — strict subset of the engine's
  registered moves; six come from the `LegendaryGame.moves` bag, two
  come from the `lobby` phase moves block in `game.ts`):
  - Lobby-phase: `'setPlayerReady'` | `'startMatchIfReady'`
  - Play-phase + cross-phase: `'drawCards'` | `'playCard'` | `'endTurn'` |
    `'fightVillain'` | `'recruitHero'` | `'fightMastermind'`
- **All eight move payloads** (six verified against engine source on
  2026-04-26; lobby-pair verified on 2026-04-27):
  - `setPlayerReady`: `{ ready: boolean }` (`lobby.types.ts:37-40`)
  - `startMatchIfReady`: `{}` — no arguments; the move reads
    `G.lobby.ready` and silently no-ops if not all required players
    are ready (`lobby.moves.ts:48-65` + `lobby.validate.ts:57-75`)
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
- **Phase gating for lobby moves** (UI must compute visibility from
  `uiState.game.phase`):
  - `setPlayerReady` and `startMatchIfReady` are emitted only when
    `uiState.game.phase === 'lobby'`. PlayView gates the
    `<LobbyControls>` block on the lobby phase; in non-lobby phases
    the lobby controls are not rendered. Click handlers in
    `<LobbyControls>` always emit (no per-button stage / phase check
    inside the component) — the engine validates phase scoping on
    receipt.
- **Engine surgical patch — `lobby.moves.ts:64`** (verified
  2026-04-27): today reads `events.setPhase('setup');` — WP-100
  retargets to `events.setPhase('play');`. The replacement `// why:`
  comment cites D-10006 (skip-empty-setup-phase) plus the existing
  rationale (boardgame.io setPhase mechanism).
- **Engine assertion flip — `lobby.moves.test.ts:110`** (verified
  2026-04-27): today reads `assert.equal(setPhaseTarget, 'setup',
  'Phase target must be "setup"');` — WP-100 retargets to
  `assert.equal(setPhaseTarget, 'play', 'Phase target must be
  "play"');`. No other tests in `packages/game-engine/src/` reference
  the setPhase target string `'setup'` (verified by grep before
  editing).
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
  - **Phase-branch rendering (revised 2026-04-27):**
    - When `uiState.game.phase === 'lobby'`: renders `<LobbyControls>`
      (per §Scope I) below `<ArenaHud />`. The play-surface children
      (`MastermindTile`, `CityRow`, `HQRow`, `HandRow`,
      `TurnActionBar`) are NOT rendered.
    - When `uiState.game.phase === 'play'` AND the viewer is
      identified: renders the five play-surface children below
      `<ArenaHud />`.
    - In any other phase (`'setup'`, `'end'`): renders only
      `<ArenaHud />`. The setup phase is unreachable in the revised
      WP-100 (per §Scope J retarget) but the branch is preserved
      defensively in case a future WP reroutes the lobby → setup
      transition.
    - Add `// why:` comment on the phase-branch expression citing the
      locked phase vocabulary (`'lobby'` | `'setup'` | `'play'` |
      `'end'`), the nested `uiState.game.phase` path, and the
      WP-100-revision intent (lobby controls visible during lobby
      phase to unblock the smoke-test path).

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
- **`LobbyControls.test.ts`** — three buttons; `Mark Ready` emits
  `('setPlayerReady', { ready: true })`; `Mark Not Ready` emits
  `('setPlayerReady', { ready: false })`; `Start Match` emits
  `('startMatchIfReady', {})`; all three buttons unconditionally
  enabled (no stage / phase check inside the component — the engine
  validates).
- **`PlayView.test.ts`** — given a UIState fixture, mounts `PlayView`,
  asserts that the five interactive children receive their expected
  props in play phase (use prop-spy mounting, not full DOM assertion);
  asserts `<LobbyControls>` renders in lobby phase and the five play
  children do NOT render; asserts `<ArenaHud />` renders in every phase.
- All tests use `node:test` and `node:assert` only — this is the
  project-wide test runner per `.claude/CLAUDE.md` ("Test runner:
  `node:test` (native Node.js test runner)") and the existing
  `apps/arena-client` test files (`ArenaHud.test.ts`,
  `BootstrapProbe.test.ts`, etc.) follow that precedent. No Vitest, no
  Jest, no Mocha. No new test runner may be introduced by this packet.
- No test imports `@legendary-arena/game-engine` runtime — types only.
- No test imports `boardgame.io`.

### I) Lobby controls component — `LobbyControls.vue` (added 2026-04-27)

- **`apps/arena-client/src/components/play/LobbyControls.vue`** — new:
  - Receives `submitMove: SubmitMove` as a prop (typed via the shared
    `SubmitMove` alias from `uiMoveName.types.ts`). No other props.
    The component is intentionally stateless — it does NOT receive a
    `lobby: UILobbyState` projection because UIState does not project
    `G.lobby` today (deferred to a future engine projection WP; the
    UX trade-off is documented in the §Out of Scope block below).
  - Renders three `<button>` elements:
    - **Mark Ready** — click handler calls
      `submitMove('setPlayerReady', { ready: true })`.
    - **Mark Not Ready** — click handler calls
      `submitMove('setPlayerReady', { ready: false })`.
    - **Start Match** — click handler calls
      `submitMove('startMatchIfReady', {})`.
  - All three buttons are unconditionally enabled. The engine
    validates: `setPlayerReady` requires `args.ready: boolean` and
    only mutates the calling player's slot in `G.lobby.ready`;
    `startMatchIfReady` requires all required players ready
    (`validateCanStartMatch`) and silently no-ops otherwise.
  - Add `// why:` comment on each button's click handler citing the
    move name + the engine validation that makes the button safe to
    click unconditionally.
  - Add `// why:` comment on the empty-object payload for
    `startMatchIfReady` (no arguments by engine design).
  - Component uses the same `defineComponent({ setup() { return {...} } })`
    form as the other interactive components (D-6512 / P6-30
    separate-compile constraint); does NOT use `<script setup>`.
  - The component renders `<button>` elements only — no styling beyond
    a minimal default CSS class set; no ARIA labels beyond Vue's
    default `<button>` semantics. A11y polish is deferred per
    Open Question Q4.

### J) Engine surgical patch — `lobby.moves.ts` setPhase retarget (added 2026-04-27)

- **`packages/game-engine/src/lobby/lobby.moves.ts`** — modified:
  - Line 64 retargets the `setPhase` call inside `startMatchIfReady`
    from `events.setPhase('setup')` to `events.setPhase('play')`. The
    paired `// why:` comment is rewritten to cite:
    1. boardgame.io's `events.setPhase` is the canonical phase
       transition mechanism (preserved from the original comment).
    2. **D-10006 — skip-empty-setup-phase rationale.** Setup phase is
       declared at [game.ts:279-281](packages/game-engine/src/game.ts)
       with no `onBegin`, no `endIf`, no exit move, and an empty
       moves block. No code anywhere in `packages/game-engine/src/`
       calls `events.setPhase('play')` (verified by grep). Routing
       through setup created a dead-end phase that blocked every
       smoke-test path. WP-100 retargets directly to play; setup is
       reserved for a future deck-construction WP that will either
       (a) reroute through setup once setup gains real phase
       machinery, or (b) take ownership of the lobby → play seam
       differently. WP-100 does not lock either evolution path out.
    3. The `// why:` comment must explicitly name D-10006 so future
       maintainers can locate the decision.
  - No other lines in `lobby.moves.ts` are modified. The
    `validateCanStartMatch` precondition, the `G.lobby.started = true`
    write, and the `setPlayerReady` move are all unchanged.

- **`packages/game-engine/src/lobby/lobby.moves.test.ts`** — modified:
  - Line 110 retargets the assertion target string from `'setup'` to
    `'play'` plus the matching error message from `'Phase target must
    be "setup"'` to `'Phase target must be "play"'`. No new test cases
    added; no test cases removed; the assertion itself remains
    structurally identical (`assert.equal(setPhaseTarget, ...)`).
  - The `'does not call setPhase when not all players are ready'` test
    is unchanged (no setPhase call → no target to verify).
  - No other lines in `lobby.moves.test.ts` are modified.

This patch is **surgical and intentionally minimal**: two lines of
production code change (one in `.ts`, one in `.test.ts`) plus comment
rewrites. It does not add any new move, any new phase hook, any new
`LegendaryGameState` field, or any `buildInitialGameState` shape change
— **01.5 NOT INVOKED**. The engine test baseline `522 / 116 / 0`
shifts to `522 / 116 / 0` (assertion-target fixture flip, not a new
test).

---

## Out of Scope

- No new moves added to the engine — the eight existing moves
  (six on `LegendaryGame.moves` + two on the lobby phase moves block)
  are the entire UI vocabulary
- No engine changes beyond the surgical setPhase retarget in §Scope J
  — `playerView`, UIState shape, move signatures, and move
  implementations all remain locked. If the UI needs a field that does
  not exist, file a separate WP for the engine change.
- No UIState `lobby` projection — `G.lobby` is NOT projected into
  UIState by this packet. `LobbyControls` is intentionally stateless
  (renders three buttons unconditionally; engine validates on
  receipt). The UX trade-off — the user does not see who-is-ready
  feedback before clicking Start Match — is acceptable because the
  phase transition itself (lobby → play, when validation passes) is
  the visible "it worked" signal. Adding `uiState.lobby?: UILobbyState`
  is a future engine-projection WP (parallel to WP-111's UIState card
  display projection).
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

- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **new** — shared `UiMoveName` (8 names) + `SubmitMove` types
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
- `apps/arena-client/src/components/play/LobbyControls.vue` — **new** — Mark Ready / Mark Not Ready / Start Match buttons (added 2026-04-27)
- `apps/arena-client/src/components/play/LobbyControls.test.ts` — **new** — component test (added 2026-04-27)
- `apps/arena-client/src/components/play/PlayView.vue` — **new** — in-match composer with phase-branch rendering (lobby vs play)
- `apps/arena-client/src/components/play/PlayView.test.ts` — **new** — composer test (covers lobby + play branches)
- `apps/arena-client/src/App.vue` — **modified** — pass `submitMove` into `PlayView` in the live route (WP-100 §Scope G "or the equivalent file" — `LiveMatchView.vue` does not exist; `App.vue` is the live-route holder per WP-090)
- `packages/game-engine/src/lobby/lobby.moves.ts` — **modified** — surgical setPhase retarget per §Scope J (added 2026-04-27)
- `packages/game-engine/src/lobby/lobby.moves.test.ts` — **modified** — paired assertion-target flip (added 2026-04-27)

No other files may be modified.

**Note on file count.** This WP lists 18 files (7 `.vue` components +
7 `.test.ts` companions + 1 shared types file + 1 modified route file
+ 2 modified engine files), which exceeds the lint-guideline soft
limit of ~8 in `00.3-prompt-lint-checklist.md §5`. The count is
intentional and the WP is **not** split because:

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
- [ ] Renders `<ArenaHud />` in every phase (lobby, setup, play, end)
- [ ] Renders empty-state message when snapshot is `null`
- [ ] Reads `currentStage` from `uiState.game.currentStage` (NOT
      `uiState.currentStage`) before passing it down as a prop
- [ ] Renders the five play-surface children (`MastermindTile`, `CityRow`,
      `HQRow`, `HandRow`, `TurnActionBar`) only when
      `uiState.game.phase === 'play'` AND a viewer is identified
- [ ] Renders `<LobbyControls>` only when `uiState.game.phase === 'lobby'`
      (revised 2026-04-27)
- [ ] Never renders both `<LobbyControls>` and the play-surface children
      simultaneously (mutually exclusive phase branches)

### Lobby controls (added 2026-04-27)
- [ ] `LobbyControls.vue` exists and exports a Vue component with exactly
      the prop `submitMove: SubmitMove`
- [ ] Renders three `<button>` elements: Mark Ready, Mark Not Ready,
      Start Match
- [ ] Mark Ready emits `submitMove('setPlayerReady', { ready: true })`
- [ ] Mark Not Ready emits `submitMove('setPlayerReady', { ready: false })`
- [ ] Start Match emits `submitMove('startMatchIfReady', {})`
- [ ] All three buttons are unconditionally enabled (no stage / phase
      check inside the component — engine validates)
- [ ] No UIState read inside `LobbyControls` (component is stateless)

### Engine surgical patch (added 2026-04-27)
- [ ] `packages/game-engine/src/lobby/lobby.moves.ts` retargets the
      `setPhase` call from `'setup'` to `'play'` (exactly one production-
      code line modified)
- [ ] `// why:` comment on the retargeted line explicitly cites D-10006
- [ ] `packages/game-engine/src/lobby/lobby.moves.test.ts` flips the
      assertion target string from `'setup'` to `'play'` plus the matching
      error-message string (exactly one test-fixture line modified)
- [ ] No other lines in `lobby.moves.ts` or `lobby.moves.test.ts` are
      modified
- [ ] No new move added to `LegendaryGame.moves` or to any phase moves
      block
- [ ] No new phase hook added to `game.ts` (verified by grep — `setup`
      remains `{ next: 'play' }` with no `onBegin` / `endIf` / moves
      block)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; engine
      baseline `522 / 116 / 0` unchanged

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
- [ ] Engine package modifications limited to `lobby.moves.ts` and
      `lobby.moves.test.ts` per §Scope J (one production-code line +
      one test-fixture line + paired comment rewrites). Server package
      and registry package are unchanged.
- [ ] No new moves registered on `LegendaryGame.moves` or on any phase
      moves block

---

## Verification Steps

```pwsh
# Step 1 — arena-client build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0, no TypeScript errors

# Step 1b — game-engine build (added 2026-04-27 — surgical engine patch)
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — arena-client test run
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests pass, 0 failing; baseline 143 → ~177 (+34 tests, +7 suites)

# Step 2b — game-engine test run (added 2026-04-27)
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass, 0 failing; baseline 522 / 116 / 0 unchanged

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

# Step 7 — confirm engine modifications limited to the two files in §Scope J
git diff --name-only -- packages/game-engine apps/server packages/registry
# Expected: exactly two paths, both under packages/game-engine/src/lobby/:
#   packages/game-engine/src/lobby/lobby.moves.ts
#   packages/game-engine/src/lobby/lobby.moves.test.ts
# Any third path under packages/game-engine/, OR any path under
# apps/server/ or packages/registry/, is a scope violation — STOP.

# Step 7b — confirm the engine retarget is exactly the one-line setPhase change
git diff packages/game-engine/src/lobby/lobby.moves.ts
# Expected: a single production-code line change retargeting
# events.setPhase('setup') to events.setPhase('play'), plus the paired
# // why: comment rewrite citing D-10006. No other production-code
# changes inside the diff. Helper imports, validateCanStartMatch call,
# G.lobby.started write all unchanged.

# Step 7c — confirm no new setPhase calls anywhere in the engine
Select-String -Path "packages\game-engine\src\**\*.ts" -Pattern "events\.setPhase" -Recurse
# Expected: exactly one match — packages/game-engine/src/lobby/lobby.moves.ts
# at the retargeted line. The pre-existing test mocks
# (events: { setPhase: () => {} }) live in *.test.ts files and may
# also match; those are not production code and do not count as new
# setPhase calls.

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
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; engine
      baseline `522 / 116 / 0` unchanged
- [ ] `pnpm -r build` exits 0 (full monorepo still builds)
- [ ] No second runtime engine import in arena-client (Select-String verified)
- [ ] No `client.moves` direct access in any component (Select-String verified)
- [ ] No `Math.random` in any new file (Select-String verified)
- [ ] Engine modifications limited to `packages/game-engine/src/lobby/lobby.moves.ts`
      and `packages/game-engine/src/lobby/lobby.moves.test.ts` (`git diff` verified)
- [ ] Server and registry packages unchanged (`git diff` verified)
- [ ] WP-090 outputs (`bgioClient.ts`, `LobbyView.vue`, etc.) were not modified
      beyond the documented App.vue prop-passing change
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] Manual smoke test: dev server starts (use
      `scripts/Start-SmokeTest.ps1`), two browsers join the same match
      via `Create match from loadout` (player 0) + `Refresh / Join`
      (player 1). Both players click `Mark Ready`. One clicks `Start
      Match`; phase transitions to `play`; the play surface
      (MastermindTile + CityRow + HQRow + HandRow + TurnActionBar)
      replaces LobbyControls. Active player clicks Draw → playCard →
      fightVillain → recruitHero → fightMastermind → End Turn; turn
      rotates; second browser becomes active.
- [ ] `docs/ai/STATUS.md` updated — what is now playable end-to-end through
      the browser; what was not playable before; the lobby/setup gap
      that the revision closes
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
      - **D-10003** — Why the UI emits `drawCards` with `count: 6`
        hardcoded (matches Legendary's standard hand size; engine has
        no `HAND_SIZE` constant and no `turn.onBegin` auto-draw today;
        the button is a scaffold artifact pending a follow-up engine
        WP that adds automatic draw-to-hand-size — see Open Question
        Q3)
      - **D-10004** — Why card tiles render `CardExtId` strings rather
        than card names / images (registry-projection path is a
        separate WP — see Open Questions)
      - **D-10005** — Why `submitMove` is prop-drilled instead of
        injected via a Vue provide / inject seam (testability —
        components remain pure and prop-driven)
      - **D-10006** (added 2026-04-27) — Why `startMatchIfReady`
        retargets `setPhase('setup')` → `setPhase('play')` and the
        evolution path for the future deck-construction WP (skip
        the empty setup phase to unblock the smoke-test path; setup
        machinery is reserved for a future WP)
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
  players ready up and start a match through the browser, then the active
  player drives a turn through the browser; spectator and waiting
  players see the resulting state via the same `UIState` projection. No
  reconnection or late-joining behavior is changed; the WP relies on
  WP-090's existing wiring. The 2026-04-27 revision genuinely advances §4:
  before the revision, the click-to-play surface was unreachable because
  matches stalled in the empty setup phase; the surgical engine retarget
  (§Scope J) closes the lobby → play transition gap so a smoke test can
  actually exercise §4 end-to-end.
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

---

## Promotion Record (2026-04-27 Revision)

- **Original execution.** WP-100 originally executed on 2026-04-26
  (Commit A `378729a` + Commit B `1dffb3a`); arena-client baseline
  `143/10/0` → `169/16/0`; engine baseline unchanged at `522/116/0`;
  pre-A governance `7ff4006` carried D-10001 amendment + D-10002
  renumber + EC-100 stub + PS-1/2/3 fold-ins. The original scope
  shipped six interactive components (HandRow, CityRow, HQRow,
  MastermindTile, TurnActionBar, PlayView) plus the shared
  `uiMoveName.types.ts` and the App.vue prop-passing edit. All
  acceptance criteria, verification steps, and definition-of-done
  items passed. Commits A + B were correctly scoped to the
  click-to-play surface.
- **Smoke-test discovery.** Manual smoke testing on 2026-04-26
  revealed that the click-to-play surface was unreachable end-to-end:
  the engine's lobby phase has `setPlayerReady` and
  `startMatchIfReady` moves but the locked six-name UI vocabulary
  did not surface them, AND `startMatchIfReady` retargeted to the
  empty `setup` phase which has no exit path (no `onBegin`, no
  `endIf`, no exit move; verified by grep that no production code
  calls `setPhase('play')` anywhere in `packages/game-engine/src/`).
  The match stalled in lobby phase regardless of how many players
  joined; `PlayView.isPlayPhase` stayed false; the click-to-play
  surface never rendered. The smoke test was unable to exercise the
  WP's stated goal.
- **Revert decision.** On 2026-04-27 the user (jeff@barefootbetters.com)
  authorized "revise WP-100 to the beginning and re-run preflight
  and execution". Commits A + B were reverted via `git revert` —
  `541d67c` (revert Commit A code) and `19d1f66` (revert Commit B
  governance close). Pre-A `7ff4006` was retained because D-10001
  amendment, the EC-100 stub, D-10002 renumber, and PS-1/2/3 fold-ins
  all remain valid load-bearing governance for the revised WP. The
  reverted tree returns to baseline `143/10/0` arena-client tests with
  no `apps/arena-client/src/components/play/` directory, no D-10003 /
  D-10004 / D-10005 entries in DECISIONS, and EC-100 stub status
  back to `Stub` in EC_INDEX.
- **Revision scope (2026-04-27).** Two minimal additions on top of
  the original 14 files:
  - **§Scope I** — new `LobbyControls.vue` + `LobbyControls.test.ts`
    surfacing `setPlayerReady` (Mark Ready / Mark Not Ready) and
    `startMatchIfReady` (Start Match) for browser-side lobby
    progression. Stateless component (no UIState lobby projection
    in this scaffold; engine validates phase scoping on receipt).
  - **§Scope J** — surgical engine patch at
    [lobby.moves.ts:64](packages/game-engine/src/lobby/lobby.moves.ts:64)
    retargeting `events.setPhase('setup')` → `events.setPhase('play')`
    plus the paired assertion-target flip in
    [lobby.moves.test.ts:110](packages/game-engine/src/lobby/lobby.moves.test.ts:110).
    Setup phase becomes unreachable in WP-100; reserved for a future
    deck-construction WP per D-10006 evolution path.
  - **PlayView phase-branch rendering** — extended from "suppress
    interactive children when not play" to "render LobbyControls in
    lobby phase; render the five play-surface children in play phase;
    render ArenaHud only in setup/end". The `<PlayView>` and
    `<PlayView.test>` files in §Scope F gain the lobby branch and
    paired test.
  - **`UiMoveName` union expanded** from six names to eight
    (`'setPlayerReady' | 'startMatchIfReady'` added); the type
    definition in `uiMoveName.types.ts` is the single source of
    truth.
- **01.5 status (revised scope).** Still NOT INVOKED. Verified
  against the four 01.5 triggers per
  `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`:
  - ❌ No new `LegendaryGameState` field. (`G.lobby` already exists.)
  - ❌ No `buildInitialGameState` shape change. (Initial state
    construction is unchanged; the existing `G.lobby = { ... }`
    initialization is untouched.)
  - ❌ No new `LegendaryGame.moves` entry. (The two lobby-phase moves
    `setPlayerReady` and `startMatchIfReady` were already registered;
    the UI gains visibility into them, not the engine.)
  - ❌ No new phase hook. (`setup.onBegin` / `setup.endIf` /
    `setup.moves` all remain absent in `game.ts`. The §Scope J change
    is a one-line target retarget inside an existing move's body —
    not a new hook.)
- **Test baseline shift (revised scope).** arena-client
  `143/10/0` → estimated **`~177/17/0`** (+34 tests, +7 suites — six
  original component suites + one new LobbyControls suite); engine
  `522/116/0` → **`522/116/0`** unchanged (assertion-target fixture
  flip, not a new test).
- **File count (revised scope).** 14 → 18 in Commit A (15 UI files
  including the new LobbyControls pair + 1 modified App.vue + 2
  modified engine files); 16 with the post-mortem.
- **EC-100 stub remains stub-only.** The D-10001 Amendment carve-out
  authorizes a minimal hook-satisfaction stub; the revision does
  NOT promote EC-100 to a full Execution Checklist. WP-100 remains
  the sole authoritative execution contract.
- **Pre-flight re-run authorized.** The expanded scope warrants a
  new pre-flight pass against the revised dependency contracts
  (`lobby.moves.ts` current shape, `lobby.types.ts` `SetPlayerReadyArgs`
  payload, `lobby.validate.ts` `validateCanStartMatch` precondition,
  game.ts phases block). The pre-flight artifact at
  `docs/ai/invocations/preflight-wp100-interactive-gameplay-surface.md`
  is updated in the same documentation pass with a 2026-04-27 revision
  block.
