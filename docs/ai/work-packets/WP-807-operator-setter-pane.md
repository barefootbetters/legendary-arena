# WP-807 — Operator setter pane: a Tweakpane control pane in the operator panel that submits the WP-806 setters

**Status:** Draft 2026-10-13 · **EC:** EC-844 · **Reserves:** none of its own (reserve PR #2765 with WP-806 / EC-843 /
D-24713). Rulings sit under D-24689 §6 and D-24713.
**Primary Layer:** App (`apps/arena-client` only)
**User-Visible Surface:** play.legendary-arena.com: in an operator match, an admin's operator panel (WP-804) gains a
"Setters" control pane (Tweakpane) that sets up the board on the admin's own turn. Every seat sees each setter's
"Operator:" line in the game log.
**Lane:** standard two-session. Ineligible for the lightweight lane: a new runtime dependency and 10 code files (01.0a
criterion 2), and it drives the determinism surface through WP-806's moves (criterion 6).
**Baseline:** `origin/main` @ `5b6a0634` (2026-10-13) plus the reserve commit (#2765). arena-client **2351 / 0** on that
baseline after `pnpm install` + `pnpm -r build`. **Executes after WP-806 merges.**

## Goal

An admin in an operator match opens the WP-804 operator panel and finds a **Setters** pane, built with Tweakpane and
loaded as its own lazy chunk (D-24689 §6). Its six folders submit WP-806's six moves:
- **Supply:** set the Wound, Bystander, S.H.I.E.L.D. Officer or Sidekick supply to a count.
- **Villain deck:** put a chosen card on top; reveal a Scheme Twist now; reveal a Master Strike now.
- **Hero deck:** put a chosen card on top; place a chosen card in HQ space 1–5.
- **Move a card:** pick a card in any player's zone or a supply, and a destination. This covers "draw a card" and "KO a
  card".
- **Turn economy:** add 1–20 Recruit or Attack this turn.
- **Escape:** the Villain at the City's escape edge escapes.

The buttons are enabled only on the admin's own turn in the `main` stage. After each submit the panel refreshes the
board at once. The pane only submits intent; the engine decides (WP-806 refuses anything else silently).

Follow-on 2 of the WP-802 arc, client half. Engine half: WP-806.

## User-Visible Impact

- **Today** (with WP-806 merged), the setters exist but no client can submit them.
- **After this packet,** in one operator match:
  - **D-24686:** Supply → Wound → 0; Villain deck → Ymir → Move to top; end the turn. The empty-supply log line shows
    on the next fight.
  - **D-24684:** Move a card → Wound (supply top) → Player 1's discard pile, a few times; then put Ymir on top.
  - A chosen hero goes to the HQ, Recruit tops up a recruit test, and Escape tests an escape effect.
- **Business impact:** each pending live-verify (`docs/ai/coverage/live-verify.json`) becomes one set-up game instead
  of several. This packet's own live verification is also WP-806's (WP-806 §Verification).

## Assumes

- **Dependencies:**
  - **WP-806 / EC-843 / D-24713 merged.** That gives:
    - the six moves registered on `LegendaryGame.moves`;
    - the `.` surface exports: `OperatorSupplyPile`, `OperatorZoneRef`, `OperatorPlayerZoneName`, the six args types,
      `OperatorSetterMoveName`, `OPERATOR_SUPPLY_PILES` and `OPERATOR_ECONOMY_MAX_AMOUNT`;
    - `OperatorView.setAsideCounts?`.
    STOP if any of these is missing.
  - WP-804 / EC-841 (#2735): the panel, `useOperatorBoard` (`refreshNow`) and the lazy mount in `PlayViewport.vue`.
- **Client facts** (`apps/arena-client/src`):
  - **Move dispatch.** `App.vue` L453–463 builds `submitMove: SubmitMove = (name: UiMoveName, args) => { playMoveSound(name);
    liveClient.value?.submitMove(name, args); }`.
    - It passes `:submit-move` to `PlayViewport` (L518, L531).
    - `PlayViewport` declares `submitMove` as a required prop (L158–161).
  - **The union.** `components/play/uiMoveName.types.ts` defines `UiMoveName` (47 members, L43–150; the "thirteen" in
    the L35 doc comment is stale) and `SubmitMove` (L157).
    - A dispatched name outside the union is a `vue-tsc` error (`TS2345`). That makes the union a hard lockstep site.
    - `playMoveSound` ignores names it doesn't map, and `audio/moveSfxManifest.test.ts` pins only mapped keys, so the
      new names need no sound entry.
  - **Panel mount.**
    - `PlayViewport.vue` L64–66: `const OperatorBoardPanel = defineAsyncComponent(() =>
      import('../components/play/OperatorBoardPanel.vue'))`.
    - L654: `<OperatorBoardPanel v-if="isOperatorPanelVisible" :match-id="matchId" />`.
    - `PlayViewport` has `playerId` (L170–177, default `''`), the viewer's seat.
  - **The panel** (`components/play/OperatorBoardPanel.vue`) has one prop, `matchId` (L33–38). It calls
    `useOperatorBoard(props.matchId, isExpanded)`, which returns `{ board, errorMessage, refreshNow }`, and computes
    `operatorView`. Its test mounts with `{ matchId: 'op-match-1' }` only (`OperatorBoardPanel.test.ts` L150), so new
    props must be optional.
  - **What the pane reads.** `OperatorView` gives:
    - `currentStage` and `board.game.activePlayerId` (`UIState.game.activePlayerId`, `uiState.types.ts` L55);
    - `seats[]` (`playerId`, `deckTopFirst`, `hand`, `discard`, `inPlay`, `victory`);
    - `villainDeckTopFirst`, `heroDeckTopFirst` and `supplyCounts`;
    - `board.city.spaces` (`UICityState`, `uiState.types.ts` L640–643; the pane only needs to know whether index 4
      holds a card);
    - `cardDisplay[id]?.name`.
  - **Tests:** `node:test` + `@vue/test-utils` + jsdom (`import '../../testing/jsdom-setup'`), `flushPromises` for async
    components; `OperatorBoardPanel.test.ts` is the precedent.
- **Tweakpane works under the test harness.** At draft time (2026-10-13), `tweakpane@4.0.5` was added on a throwaway
  branch, and a component that mounts a `Pane` in `onMounted` passed under the arena-client's test command (`node
  --import tsx --import @legendary-arena/vue-sfc-loader/register --test`). The pane had a folder, a number binding, a
  list binding and a button:
  - the pane title, the folder title and the button each render as a `<button>` with that text;
  - `button.click()` fired the handler with the bound values;
  - `pane.dispose()` on unmount left no `.tp-rotv` in the document.
  The branch was then discarded. `tweakpane@4.0.5` is ESM-only (`"type": "module"`), and its bundle carries the
  literal `tp-rotv` (62 times).
- **Tweakpane's types need `@tweakpane/core`.** tweakpane 4.0.5's `.d.ts` files import `@tweakpane/core` (`Pane extends
  RootApi`), and core is only a devDependency of tweakpane, so it is never installed. A second throwaway scaffold
  (2026-10-13), a `.ts` file under `src/` using `new Pane`, `addFolder`, `addBinding` (number and list),
  `addButton`, `button.disabled` and `.on('click')`, gave these `vue-tsc --noEmit` results:
  - with `tweakpane` alone: `TS2339: Property 'addFolder' does not exist on type 'Pane'`;
  - after `pnpm --filter @legendary-arena/arena-client add -D @tweakpane/core@2.0.5`: exit 0.
  Core 2.0.5 is the version the 4.0.5 bundle embeds (`new Semver('2.0.5')`). The scaffold was reverted.
- **New dependencies** (D-24689 §6 assigns them to this packet):
  - `tweakpane` `^4.0.5` in arena-client `dependencies`;
  - `@tweakpane/core` `2.0.5` (exact) in arena-client `devDependencies`, types only. It is never imported at runtime.
  No Tweakpane plugin.

## Context (Read First)

**Why the pane takes the view as a prop.** The panel already polls the board. Passing `operatorView` down keeps one
poll and one source of truth. The pane emits `submitted`, and the panel calls `refreshNow()`, so the result shows in
under a poll interval.

**Why the pane rebuilds instead of patching lists.** Tweakpane list bindings take their options at creation. When the
options change (a card revealed, a supply emptied, the turn passing), the pane disposes and rebuilds from a key string.
Selections live in one reactive `params` object outside the pane, so a rebuild keeps them where the chosen value still
exists, and falls back to the first option where it doesn't.

**Why the enable rule is client-side but not authority.** Buttons are disabled unless `currentStage === 'main'` and
`board.game.activePlayerId === playerId`. That saves silent no-op clicks. The engine still checks the operator match,
the turn, the stage and open choices (WP-806). A click while a choice is open does nothing; the hint line says so.

**Why "Move a card" is one source list and one destination list.** Dependent lists (zone first, then a card in it) mean
nested rebuilds. One flat source list ("Player 0 · hand · Iron Man", "Wound supply (top)") and one destination list
("Player 1 · discard pile", "KO pile") cover every WP-806 route. The engine refuses pairs outside its table.

The options are valued by a **stable key**, never a list index. After a poll the lists shift, and an index would
silently point at a different card. Two copies of one card in one zone share a key, which is harmless: they're the same
card to the engine.

**Read:**
- WP-806 in full (§Locked Contract Values, §D-24713 Content), WP-804 (§Locked Contract Values, panel and mount),
  `docs/ai/DECISIONS.md` D-24689 §6–§7, D-24713, D-6512, D-24026.
- `docs/ai/ARCHITECTURE.md` §Package Import Rules (Hard Constraints) and §Layer Boundary (Authoritative): the
  arena-client imports the engine's `.` surface only, never `/setup`, never `registry` at runtime.
- `.claude/rules/architecture.md` §Engine Owns Truth (the client submits intent only).
- `wiki/why-play-needs-a-debug-panel.md` §What it lets an operator do and §Ideas … reconciled (the floating pane with
  collapsible folders).

## Non-Negotiable Constraints

**Repo-wide (do not remove):**
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`.
- SFCs use `defineComponent({ setup() { … } })` (D-6512), never `<script setup>`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names; booleans start with `is` / `has` / `can`;
  - JSDoc on every function; functions ~30 lines max;
  - no nested ternaries, no `import *`, no new barrel;
  - full-sentence messages; `// why:` on non-obvious rules.
- Output the **full file contents** for every new or modified file (including `package.json`). No diffs, no snippets.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token (case-insensitive WIP, fix stuff, misc, tmp,
  updates, changes, debug). Write "operator match".

**Packet-specific:**
- The pane submits intent through the prop-drilled `submitMove` only. It never edits state, never runs a rule and never
  imports the bgio client.
- Engine imports are from `@legendary-arena/game-engine` (`.`) only: types, plus the two runtime constants
  `OPERATOR_SUPPLY_PILES` and `OPERATOR_ECONOMY_MAX_AMOUNT`.
- `tweakpane` is imported only by `OperatorSetterPane.vue`.
- That component is loaded only through `defineAsyncComponent` inside `OperatorBoardPanel.vue`, so neither the entry
  chunk nor the panel chunk carries Tweakpane.
- No engine, server, `UIState` or persistence change. No new route.
- Card labels come from `operatorView.cardDisplay[id]?.name ?? id`, never card text.
- The pane is created in `onMounted` and disposed in `onUnmounted` and before every rebuild. There is never more than
  one live `Pane`.

**Session protocol:** Read the EC, then this WP, then WP-806 and WP-804. Confirm WP-806 is on `main` and run the
baseline before editing. STOP and report, without guessing, if:
- anything is unclear;
- a baseline differs from §Assumes;
- a file outside the allowlist would need to change.

## Locked Contract Values

- **Dependencies:**
  - `"tweakpane": "^4.0.5"` in `apps/arena-client/package.json` `dependencies`;
  - `"@tweakpane/core": "2.0.5"` in `devDependencies`, types only, never imported at runtime.
  `pnpm-lock.yaml` is updated by `pnpm --filter @legendary-arena/arena-client add tweakpane@^4.0.5` and
  `pnpm --filter @legendary-arena/arena-client add -D @tweakpane/core@2.0.5`.
- **Union:** `UiMoveName` gains `'operatorSetSupplyCount' | 'operatorMoveToDeckTop' | 'operatorRevealNow' |
  'operatorMoveCard' | 'operatorAddEconomy' | 'operatorEscapeVillain'`, with one `// why:` naming WP-806 / D-24713.
- **Intent builders**, in the new `lib/operatorSetterIntents.ts`. These are pure, with no Vue and no Tweakpane:
  - `export interface OperatorSetterIntent { name: OperatorSetterMoveName; args: unknown }`
  - `buildSupplyCountIntent(pile: OperatorSupplyPile, count: number): OperatorSetterIntent` →
    `{ name: 'operatorSetSupplyCount', args: { pile, count } }`
  - `buildDeckTopIntent(deck: 'villain' | 'hero', cardId: string)` → `operatorMoveToDeckTop`, `{ deck, cardId }`
  - `buildRevealNowIntent(cardType: 'scheme-twist' | 'mastermind-strike')` → `operatorRevealNow`, `{ cardType }`
  - `buildMoveCardIntent(source: OperatorCardSource, to: OperatorZoneRef)` → `operatorMoveCard`, `{ cardId:
    source.cardId, from: source.from, to }`
  - `buildEconomyIntent(resource: 'attack' | 'recruit', amount: number)` → `operatorAddEconomy`, `{ resource, amount }`
  - `buildEscapeIntent()` → `operatorEscapeVillain`, `{}`
- **Option builders** (same file):
  - `export interface OperatorCardSource { key: string; cardId: string; from: OperatorZoneRef; label: string }`
  - `export interface OperatorDestination { key: string; ref: OperatorZoneRef; label: string }`
  - `buildCardSources(view: OperatorView): OperatorCardSource[]`
    - **Seats:** for each seat in order, each card of `hand`, `deckTopFirst`, `discard`, `inPlay` and `victory`.
      - `from = { zone, playerId }`, with zone `'hand' | 'deck' | 'discard' | 'inPlay' | 'victory'`; `deckTopFirst`
        maps to `'deck'`.
      - `key = ${playerId}|${zone}|${cardId}`.
      - Label `Player ${playerId} · ${zoneLabel} · ${name}`.
    - **Supplies:** then, for each `OPERATOR_SUPPLY_PILES` pile whose `supplyCounts` is > 0, one entry.
      - `cardId` is the pile's fungible id: `pile-wound`, `pile-bystander`, `pile-shield-officer` or `pile-sidekick`.
      - `from = { zone: 'supply', pile }` and `key = supply|${pile}`.
      - Label `${PILE_LABEL} supply (top)`.
  - `buildDestinations(view: OperatorView): OperatorDestination[]`
    - for each seat, `hand`, `deck` (labelled "deck (top)"), `discard` and `victory`, with `ref = { zone, playerId }`
      and `key = ${playerId}|${zone}`;
    - then `{ zone: 'ko' }`, labelled "KO pile", with key `ko`.
  - `buildDeckCardOptions(cardIds: readonly string[], view: OperatorView): { text: string; value: string }[]` — one
    entry per distinct id, in first-seen order, `text = ${position}. ${name}`, where `position` is 1-based.
  - `isSetterWindowOpen(view: OperatorView, playerId: string): boolean` — `view.currentStage === 'main' &&
    view.board.game.activePlayerId === playerId`.
  - `hasEscapeCandidate(view: OperatorView): boolean` — `view.board.city.spaces[4] != null` (`UICityState.spaces:
    (UICityCard | null)[]`, `uiState.types.ts` L640–643; index 4 is the escape edge, WP-806 §Assumes).
  - `PILE_LABEL` repeats WP-806's labels (Wound / Bystander / S.H.I.E.L.D. Officer / Sidekick). The fungible ids are
    re-declared here with a `// why:`, since the engine doesn't export them on `.`.
- **Component** `components/play/OperatorSetterPane.vue` (`name: 'OperatorSetterPane'`):
  - **Props:** `operatorView: OperatorView` (required), `playerId: string` (required), `submitMove: SubmitMove`
    (required).
  - **Emits:** `submitted`.
  - **Root:** `<section data-testid="operator-setters">`, holding a hint `<p data-testid="operator-setters-hint">`
    and the pane host `<div data-testid="operator-setter-pane">`.
    - Hint text when closed: "Setters run on your turn, in the main stage, with no choice open."
    - Hint text when open: "Setters change the board through the engine. A refused setter changes nothing."
  - **Pane:** `new Pane({ container: host, title: 'Setters' })`, with folders in this order and these exact button
    titles:
    1. **Supply:** list `pile`; number `count` (min 0, step 1); button "Set supply count".
    2. **Villain deck:** list `villainCard`; button "Move villain card to top"; buttons "Reveal a Scheme Twist now" and
       "Reveal a Master Strike now".
    3. **Hero deck:** list `heroCard`; button "Move hero card to top"; number `hqSpace` (min 1, max 5, step 1); button
       "Place hero in HQ space". That button's intent is `buildMoveCardIntent({ key: 'heroDeck|' + heroCard, cardId:
       heroCard, from: { zone: 'heroDeck' }, label: '' }, { zone: 'hq', hqIndex: hqSpace − 1 })`, which is WP-806
       route R4.
    4. **Move a card:** list `source`, valued by `OperatorCardSource.key`; list `destination`, valued by
       `OperatorDestination.key`; button "Move card". On click each key maps back to its entry. If either key is
       missing from the current lists, nothing is submitted.
    5. **Turn economy:** list `resource` (Attack / Recruit); number `amount` (min 1, max `OPERATOR_ECONOMY_MAX_AMOUNT`,
       step 1); button "Add to this turn".
    6. **Escape:** button "Escape the Villain at the City's edge", disabled unless `hasEscapeCandidate`.
  - Every button is `disabled` unless `isSetterWindowOpen`.
  - On click, the handler re-checks `isSetterWindowOpen` against the current prop, plus `hasEscapeCandidate` for Escape.
    If the check passes, it builds the intent, calls `submitMove(intent.name, intent.args)` once and emits `submitted`.
    If it fails, nothing is submitted.
  - **Rebuild:** a `computed` key joins the option lists' keys, the window state and `hasEscapeCandidate`. On change, the pane is disposed and
    rebuilt from a reactive `params` object, which keeps a selection still present among the options and falls back
    to the first one otherwise.
  - **Teardown:** `onUnmounted` disposes the pane.
- **Panel** (`OperatorBoardPanel.vue`):
  - **New optional props:** `submitMove` (`Function as PropType<SubmitMove | null>`, default `null`) and `playerId`
    (`String`, default `''`).
  - **Lazy load:** `const OperatorSetterPane = defineAsyncComponent(() => import('./OperatorSetterPane.vue'))`,
    registered as `components: { OperatorSetterPane }`.
  - **Render:** `<OperatorSetterPane v-if="operatorView !== null && submitMove !== null && playerId !== ''"
    :operator-view="operatorView" :player-id="playerId" :submit-move="submitMove" @submitted="refreshNow" />`, inside
    the expanded body, after `operator-engine`.
  - **Set-aside counts:** when `operatorView.setAsideCounts` exists, the `operator-piles` section adds one line,
    `data-testid="operator-set-aside"`: `Set aside — Wounds N, Bystanders N, Officers N, Sidekicks N`.
- **Mount** (`PlayViewport.vue`): `<OperatorBoardPanel v-if="isOperatorPanelVisible" :match-id="matchId"
  :player-id="playerId" :submit-move="submitMove" />`.

## Scope (In)

### A) Dependency and union
- `apps/arena-client/package.json` + `pnpm-lock.yaml`: `tweakpane`.
- `components/play/uiMoveName.types.ts`: the six names.

### B) Intents and options
- `lib/operatorSetterIntents.ts` (new).

### C) Pane, panel, mount
- `components/play/OperatorSetterPane.vue` (new).
- `components/play/OperatorBoardPanel.vue`: two optional props, the lazy pane, the set-aside line.
- `pages/PlayViewport.vue`: pass `playerId` and `submitMove` to the panel.

### D) Tests
- `lib/operatorSetterIntents.test.ts` (new):
  1. each of the six builders returns the locked name and args (`buildEscapeIntent` gives `{}`);
  2. `buildCardSources` order and labels across two seats and five zones; supply entries only for piles > 0, with the
     fungible ids;
  3. `buildDestinations` lists four zones per seat plus the KO pile;
  4. `buildDeckCardOptions` collapses duplicate ids and numbers positions from 1;
  5. `isSetterWindowOpen` is false for stage `start`, false for another seat's turn, and true for own turn in `main`;
  6. `hasEscapeCandidate` is true and false.
- `components/play/OperatorSetterPane.test.ts` (new; jsdom, `attachTo: document.body`). It declares its own inline
  `OperatorView` fixture, with `board.game.activePlayerId` and `board.city.spaces` (five slots) set. Click the
  Tweakpane buttons found by text:
  - the pane and its six folders render, and the hint shows the open text on own turn in `main`;
  - "Set supply count" submits `operatorSetSupplyCount` with the bound pile and count, then emits `submitted`;
  - "Reveal a Scheme Twist now", "Escape the Villain at the City's edge", "Add to this turn" and "Place hero in HQ space"
    (`hqIndex` = space − 1) submit the locked intents;
  - "Move card" submits the chosen source's `cardId` / `from` and the chosen destination's `ref`;
  - **stable keys:** select a hand card, re-render with a card inserted before it in that hand, click "Move card". The
    same `cardId` is submitted;
  - on another seat's turn every button is `disabled`, a click submits nothing (the handler's re-check, tested by
    calling `.click()` on the button element), and the hint shows the closed text;
  - changing the `operatorView` prop (a card leaves the villain deck) rebuilds the pane: one `.tp-rotv` in the
    document, and the removed card is no longer an option;
  - unmount leaves no `.tp-rotv` in the document.
- `components/play/OperatorBoardPanel.test.ts`, with new cases only. They use a **new** fixture helper that adds
  `board.game.activePlayerId` and `board.city.spaces` to the board. The existing `buildBoardFixture()` stays untouched,
  because the pane would throw on its `game`-less board.
  - no `operator-setters` without `submitMove`;
  - with `submitMove` and `playerId`, `operator-setters` appears after `flushPromises()`;
  - a `submitted` event, sent with `findComponent({ name: 'OperatorSetterPane' }).vm.$emit('submitted')`, triggers a
    board fetch (count the stubbed fetches);
  - `operator-set-aside` renders only when `setAsideCounts` is present.
- `pages/PlayViewport.test.ts`, with one new case. It copies the WP-804 positive panel setup, adds `playerId: '0'` to
  the mount props, and asserts that the mounted `OperatorBoardPanel` receives `playerId: '0'` and a `submitMove`
  function (`findComponent(...).props()`).

### E) Docs (governance close, `SPEC:` commit)
- `wiki/why-play-needs-a-debug-panel.md`: the §Build status row for follow-on 2 reads done. Tweakpane now exists in
  the repo.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` (📝 → ✅, then `pnpm roadmap:counts:write`).
- No DECISIONS entry. The rulings are D-24689 §6 and D-24713. Confirm at close that none was needed.

## Limitations (accepted)

- **The enable rule is presentation only.** A forced click on another seat's turn reaches the engine, which refuses
  it (WP-806). The operator gate is the engine's `G.isDebugMatch` plus the admin-only operator create (D-24689 §1–§2);
  this pane adds no authority.
- **A refused setter is silent.** The engine returns without a log line, and the pane can't tell a refusal from a slow
  board. The hint says a refused setter changes nothing.
- **The instant refresh can race.** `submitMove` sends over the socket without waiting for an answer, so the immediate
  `refreshNow()` can come back before the server has applied the move. The next 3-second poll catches up. "At once" is
  best effort.
- **A rebuild resets an open dropdown.** Every poll that changes an option list rebuilds the pane. Selections survive;
  an open dropdown closes.
- **No command console.** A text console over the same moves is a later packet (D-24713 §8).
- **Large option lists.** "Move a card" can list a hundred-plus cards late in a game. That's acceptable for an operator
  tool.

## Out of Scope

- Any engine, server, `UIState` or persistence change; WP-806 owns the moves.
- A command console, Open Questions 8–9, jump to turn N, the effects tuner, and latency or connection monitors.
- Moving the WP-804 read-only sections into Tweakpane. They stay plain Vue.
- Sound cues for the setter moves (`playMoveSound` ignores unmapped names).
- Fixing the stale "thirteen move names" doc comment in `uiMoveName.types.ts` L35, beyond adding the six names.

## Files Expected to Change

- `apps/arena-client/package.json` — **modified** — `tweakpane` dependency, `@tweakpane/core` devDependency
- `pnpm-lock.yaml` — **modified** — lockfile for both
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — six names
- `apps/arena-client/src/lib/operatorSetterIntents.ts` — **new** — intent and option builders
- `apps/arena-client/src/lib/operatorSetterIntents.test.ts` — **new** — §D
- `apps/arena-client/src/components/play/OperatorSetterPane.vue` — **new** — the Tweakpane pane
- `apps/arena-client/src/components/play/OperatorSetterPane.test.ts` — **new** — §D
- `apps/arena-client/src/components/play/OperatorBoardPanel.vue` — **modified** — props, lazy pane, set-aside line
- `apps/arena-client/src/components/play/OperatorBoardPanel.test.ts` — **modified** — §D cases (additions)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — two props on the panel mount
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — §D case (addition)
- `wiki/why-play-needs-a-debug-panel.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

Ten code files (plus the lockfile) is over the ~8-file guidance:
- four are two new modules, each with its own test;
- the others are small edits: the union, `package.json`, the panel and its test, the mount and its test.
Splitting the dependency from the pane would ship a dependency nothing uses.

## Contract

- Locks the `tweakpane` dependency, the six `UiMoveName` members, the intent and option builders, the pane's test ids,
  folder order and button titles, the enable rule, and the panel's two optional props and lazy mount.
- No engine, server or `UIState` change.

## Acceptance Criteria

1. `apps/arena-client/package.json` lists `"tweakpane": "^4.0.5"` in `dependencies` and `"@tweakpane/core": "2.0.5"`
   in `devDependencies`, and `pnpm install --frozen-lockfile` exits 0.
2. Each intent builder returns WP-806's exact move name and args (§D).
3. The pane renders six folders with the locked button titles. Each button submits exactly one `submitMove` call with
   the locked intent, then emits `submitted`. "Move card" submits by stable key, not by list index.
4. Off the admin's turn, or outside `main`, every button is disabled and no click submits.
5. An `operatorView` change rebuilds the pane with exactly one live `Pane`. Unmount leaves no `.tp-rotv`.
6. `OperatorBoardPanel` renders `operator-setters` only with a `submitMove` and a non-empty `playerId`, and a
   `submitted` event triggers an immediate board fetch.
7. `PlayViewport` passes `playerId` and `submitMove` to the panel.
8. `operator-set-aside` renders only when `setAsideCounts` is present.
9. After `pnpm --filter @legendary-arena/arena-client build`, the literal `tp-rotv` appears in exactly one
   `dist/assets/*.js`. That file is neither the entry chunk that `dist/index.html` loads nor the chunk containing
   `operator-bot-decisions`.
10. `pnpm -r build` exits 0, `pnpm -r --no-bail test` reports 0 failures, and
    `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
11. Every change in `git diff origin/main -- '*.test.ts'` is an addition.

## Verification Steps

```pwsh
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r --no-bail test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client build
Get-ChildItem apps/arena-client/dist/assets -Filter *.js | Select-String -SimpleMatch "tp-rotv" -List | Select-Object Path
Get-ChildItem apps/arena-client/dist/assets -Filter *.js | Select-String -SimpleMatch "operator-bot-decisions" -List | Select-Object Path
Select-String -Path apps/arena-client/dist/index.html -Pattern 'assets/index-[^"]+\.js'
pnpm ledger:numbers:check
pnpm roadmap:counts:check
git diff --name-only origin/main
git diff origin/main -- '*.test.ts'
```

Expected:
- every `pnpm` command exits 0;
- `tp-rotv` is in exactly one asset, different from both the entry asset and the `operator-bot-decisions` asset;
- the name diff is ⊆ §Files Expected to Change;
- the test diff is additions only.

**Live (D-24026), after merge and deploy**, signed in as `jefferyjjensen` (admin), in a fresh 2p operator match. This
also verifies WP-806. On the admin's own turn, in `main`:
1. The Setters pane shows six folders in the panel. On the bot's turn its buttons are disabled.
2. Supply → Wound → 0 → "Set supply count". The panel shows Wound supply 0 and "Set aside — Wounds 30…". The game log
   reads `Operator: Wound supply set to 0 (was 30).`
3. Villain deck → choose a deep card → "Move villain card to top". The panel's villain deck shows it first. Next turn's
   reveal is that card.
4. "Reveal a Scheme Twist now": the log shows the operator line, then the twist's normal resolution, and the twist
   count rises.
5. Hero deck → choose a card → "Place hero in HQ space" 3. HQ space 3 holds it, and the old HQ card is last in the
   hero deck.
6. Move a card: a card in Player 1's hand → KO pile, then Player 0 · deck · (top card) → Player 0 · hand. Both moves
   land and are logged.
7. Turn economy → Attack 5 → "Add to this turn". The HUD's Attack rises by 5.
8. With a Villain at the City's edge, "Escape the Villain at the City's edge": it's in the escaped pile, the escape
   count rises, and its escape effect resolves.
9. Every seat's game log shows each "Operator:" line. The pane reads in day and night themes.

Record the matchId in STATUS, citing WP-806 and WP-807.

## Definition of Done

- [ ] Acceptance Criteria 1–11 pass, with command output pasted into the PR.
- [ ] `git diff --name-only origin/main` ⊆ §Files Expected to Change. Revert line-ending-only churn.
- [ ] STATUS, WORK_INDEX (`[x]` with date), EC_INDEX, the mindmap (✅, counts regenerated) and the ewiki §Build status
      are updated.
- [ ] DECISIONS.md: no new entry (D-24689 §6, D-24713). Confirm at close.
- [ ] Two commits in one PR: `EC-844:` (code + tests + dependency) and `SPEC:` (governance close). Neither subject
      contains a commit-msg Rule 1 token.
- [ ] D-24026 live verification after deploy (§Verification Steps 1–9), recorded as a STATUS flip for WP-806 and WP-807.

## Open Operator Decisions (do not block execution)

- **OD-1 — Pane placement.** The pane renders inside the panel's body (locked). Floating it over the play mat with
  Tweakpane's own drag is a later `INFRA:` change if the panel gets crowded.

## Vision Alignment

- §3 Player Trust & Fairness: only in an operator match, which every seat sees is unscored. Every setter is logged for
  every seat.
- §7 Strict Layer Separation: the pane submits intent and the engine decides.
- §11 Stateless Client Philosophy: the pane holds selections only, and nothing is persisted.
- §16 Performance & Responsiveness: Tweakpane loads in its own lazy chunk, only for an admin in an operator match.
- §17 Accessibility & Inclusivity: Tweakpane renders native buttons and inputs, keyboard-reachable; the hint explains
  disabled buttons.
- §22 Determinism & Replay: no client randomness. The moves are WP-806's and replay faithfully.
- **Conflict assertion:** No conflict.
- **NG-1..NG-8:** none crossed. Operator tooling, unreachable by purchase.

## Funding Surface Gate

N/A. Operator tooling, with no commerce, account-tier, entitlement, nav, profile or donate surface.

## API Catalog

No endpoint is added or changed. Moves travel over the existing boardgame.io socket. D-11804 doesn't trigger.

## Lint Gate Self-Review (00.3)

Pending: the gate runs as an independent subagent after pre-flight and copilot.

## Gate Verdicts

Pending.
