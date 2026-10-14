# EC-844 — Operator setter pane: a Tweakpane control pane in the operator panel that submits the WP-806 setters (Execution Checklist)

**Source:** docs/ai/work-packets/WP-807-operator-setter-pane.md
**Layer:** App (`apps/arena-client` only)

## Before Starting
- [ ] **WP-806 is merged.** `LegendaryGame.moves` has the six `operator*` moves; `@legendary-arena/game-engine` exports `OperatorZoneRef`, `OperatorSupplyPile`, `OperatorDeckName`, `OperatorRevealCardType`, `OperatorEconomyResource`, `OperatorSetterMoveName`, the six `Operator*Args` types, `OPERATOR_SUPPLY_PILES` and `OPERATOR_ECONOMY_MAX_AMOUNT`; and `OperatorView.setAsideCounts?` exists. Otherwise STOP.
- [ ] Run `pnpm install`, then `pnpm -r build` (0), `pnpm -r --no-bail test` (0 fail) and `pnpm --filter @legendary-arena/arena-client typecheck` (0). Record the counts (draft: arena-client 2351 / 0 on `5b6a0634`, before WP-806).
- [ ] Confirm, and STOP if any differs: `OperatorBoardPanel.vue` has only the `matchId` prop; `PlayViewport.vue` L654 mounts it with `:match-id` only; `UiMoveName` has no `operator*` member; nothing imports `tweakpane`.
- [ ] The EXACT target file set = `## Files to Produce`. Any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- Dependencies: `"tweakpane": "^4.0.5"` in arena-client `dependencies` and `"@tweakpane/core": "2.0.5"` in `devDependencies`, types only. Add them with `pnpm --filter @legendary-arena/arena-client add tweakpane@^4.0.5` and `pnpm --filter @legendary-arena/arena-client add -D -E @tweakpane/core@2.0.5`. No Tweakpane plugin.
- `UiMoveName` gains `operatorSetSupplyCount`, `operatorMoveToDeckTop`, `operatorRevealNow`, `operatorMoveCard`, `operatorAddEconomy` and `operatorEscapeVillain`.
- `OperatorSetterIntent` is a discriminated union `{ name: '<move>'; args: Operator<Move>Args }` over the six WP-806 args types. Builder parameters use `OperatorSupplyPile` / `OperatorDeckName` / `OperatorRevealCardType` / `OperatorEconomyResource`.
- Intent builders in `lib/operatorSetterIntents.ts`, each returning `{ name, args }`:
  - `buildSupplyCountIntent(pile, count)` → `{ pile, count }`; `buildDeckTopIntent(deck, cardId)` → `{ deck, cardId }`; `buildRevealNowIntent(cardType)` → `{ cardType }`
  - `buildMoveCardIntent(source, to)` → `{ cardId: source.cardId, from: source.from, to }`; `buildEconomyIntent(resource, amount)` → `{ resource, amount }`; `buildEscapeIntent()` → `{}`
- `OperatorCardSource { key; cardId; from; label }` and `OperatorDestination { key; ref; label }`.
- `buildCardSources(view)`:
  - seats in order × `hand`, `deckTopFirst` (as `'deck'`), `discard`, `inPlay`, `victory`, with `from = { zone, playerId }`, `key = ${playerId}|${zone}|${cardId}` and label `Player ${playerId} · ${zoneLabel} · ${name}`, where `zoneLabel` is `hand` / `deck` / `discard pile` / `play area` / `Victory Pile`;
  - then each supply with a count > 0, with `cardId` its engine-exported fungible id (`WOUND_EXT_ID` / `BYSTANDER_EXT_ID` / `SHIELD_OFFICER_EXT_ID` / `SIDEKICK_EXT_ID`), `from = { zone: 'supply', pile }` and `key = supply|${pile}`.
- `buildDestinations(view)`: per seat `hand`, `deck`, `discard` and `victory`, with `ref = { zone, playerId }`, `key = ${playerId}|${zone}` and label `Player ${playerId} · ${destinationLabel}`, where `destinationLabel` is `hand` / `deck (top)` / `discard pile` / `Victory Pile`; then `{ zone: 'ko' }` with key `ko`, labelled "KO pile".
- `buildDeckCardOptions(cardIds, view)` = distinct ids, labelled `${position}. ${name}`, where position = first-occurrence index + 1 (`['a','a','b']` gives "1. A", "3. B"). `isSetterWindowOpen(view, playerId)` = `currentStage === 'main' && board.game.activePlayerId === playerId`. `hasEscapeCandidate(view)` = `board.city.spaces[4] != null`.
- `OperatorSetterPane.vue` (`name: 'OperatorSetterPane'`):
  - **Props:** `operatorView`, `playerId` and `submitMove`, all required. **Emits:** `submitted`.
  - **Test ids:** `operator-setters`, `operator-setters-hint`, `operator-setter-pane`.
  - **Pane:** `new Pane({ container, title: 'Setters' })`, with folders Supply, Villain deck, Hero deck, Move a card, Turn economy, Escape.
  - **Binding labels:** `Pile`, `Count`, `Villain card`, `Hero card`, `HQ space`, `Card`, `Destination`, `Resource`, `Amount`.
  - **Empty decks:** an empty deck binds a list with no options, and a click with an empty selection submits nothing. If Tweakpane 4.0.5 throws on `options: []`, omit that list binding and disable its buttons instead. That isn't a STOP.
- Buttons: "Set supply count", "Move villain card to top", "Reveal a Scheme Twist now", "Reveal a Master Strike now", "Move hero card to top", "Place hero in HQ space", "Move card", "Add to this turn" (amount 1–`OPERATOR_ECONOMY_MAX_AMOUNT`), "Escape the Villain at the City's edge".
- "Place hero in HQ space" submits `buildMoveCardIntent({ key: 'heroDeck|' + heroCard, cardId: heroCard, from: { zone: 'heroDeck' }, label: '' }, { zone: 'hq', hqIndex: hqSpace − 1 })`, with `hqSpace` 1–5.
- "Move card" `source` / `destination` lists are valued by `key`, never by index. On click each key maps back to its entry; a missing key submits nothing.
- Hints: closed "Setters run on your turn, in the main stage, with no choice open."; open "Setters change the board through the engine. A refused setter changes nothing."
- Buttons are disabled unless `isSetterWindowOpen`, and Escape also needs `hasEscapeCandidate`. Each click re-checks those against the current prop, then makes one `submitMove(name, args)` call and emits `submitted`.
- Rebuild when the `computed` key (option keys in list order + window state + `hasEscapeCandidate`) changes: dispose, then rebuild from a reactive `params`, keeping a still-present selection or taking the first option. Dispose in `onUnmounted`. Never more than one live `Pane`.
- `OperatorBoardPanel.vue`:
  - new optional props `submitMove` (default `null`) and `playerId` (default `''`);
  - `const OperatorSetterPane = defineAsyncComponent(() => import('./OperatorSetterPane.vue'))`, registered in `components`, rendered after `operator-engine` when `operatorView !== null && submitMove !== null && playerId !== ''`, with `@submitted="refreshNow"`;
  - `operator-set-aside` line `Set aside — Wounds N, Bystanders N, Officers N, Sidekicks N` when `setAsideCounts` exists.
- `PlayViewport.vue`: `<OperatorBoardPanel v-if="isOperatorPanelVisible" :match-id="matchId" :player-id="playerId" :submit-move="submitMove" />`.

## Guardrails
- The pane submits intent through `submitMove` only. It never edits state, runs a rule or imports the bgio client.
- Engine imports come from `@legendary-arena/game-engine` `.` only: types plus six constants (`OPERATOR_SUPPLY_PILES`, `OPERATOR_ECONOMY_MAX_AMOUNT` and the four fungible pile ids). Never `/setup` or `registry`.
- `tweakpane` is imported only in `OperatorSetterPane.vue`, loaded only via `defineAsyncComponent` in the panel (AC 9). `@tweakpane/core` is never imported at runtime.
- No engine, server, `UIState` or persistence change. Card labels are names only, never card text.
- SFCs use `defineComponent({ setup })` (D-6512). Functions ~30 lines; no nested ternaries; JSDoc everywhere.
- Existing tests: additions only. The existing `buildBoardFixture()` in `OperatorBoardPanel.test.ts` stays untouched; new cases use a new helper with `board.game` and `board.city`.
- Pane tests use the locked helpers. Buttons via `button.tp-btnv_b` with an exact trimmed title and exactly one match; folders via `.tp-fldv_t`; inputs by binding label plus a `change` event. The off-turn click uses `dispatchEvent(new MouseEvent('click', { bubbles: true }))`, because jsdom's `.click()` skips disabled controls. The unmount check reads the captured host element.

## Required `// why:` Comments
- The enable rule and the click re-check: presentation only; the engine re-checks the match, turn, stage and choices (WP-806).
- Stable option keys: list indexes shift after a poll and would move the wrong card.
- The rebuild: Tweakpane list options are fixed at creation.
- The lazy pane in `OperatorBoardPanel.vue`: Tweakpane stays out of the entry and panel chunks (D-24689 §6).
- The re-declared `PILE_LABEL`: WP-806 doesn't export it; it mirrors WP-806's labels.
- `@submitted="refreshNow"`: shows the result without waiting for the 3-second poll (best effort; the socket doesn't wait).

## Files to Produce
- `apps/arena-client/package.json`, `pnpm-lock.yaml` — **modified** — `tweakpane` + `@tweakpane/core` (types)
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — six names
- `apps/arena-client/src/lib/operatorSetterIntents.ts`, `operatorSetterIntents.test.ts` — **new**
- `apps/arena-client/src/components/play/OperatorSetterPane.vue`, `OperatorSetterPane.test.ts` — **new**
- `apps/arena-client/src/components/play/OperatorBoardPanel.vue`, `OperatorBoardPanel.test.ts` — **modified**
- `apps/arena-client/src/pages/PlayViewport.vue`, `PlayViewport.test.ts` — **modified**
- `docs/ai/post-mortems/01.6-WP-807-operator-setter-pane.md` — **new** — mandatory, in the `EC-844:` commit
- `wiki/why-play-needs-a-debug-panel.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm -r build` (0), `pnpm -r --no-bail test` (0 fail) and arena-client `typecheck` (0). Record before / after counts.
- [ ] Run `pnpm --filter @legendary-arena/arena-client build`. `tp-rotv` must be in exactly one `dist/assets/*.js`, which is neither the `dist/index.html` entry nor the `operator-bot-decisions` chunk.
- [ ] Revert proofs, each failing ≥ 1 new test:
  - enable buttons off-turn (fails the `disabled` assertion);
  - drop the click re-check (fails the `dispatchEvent` assertion);
  - drop the `submitted` emit;
  - skip the dispose on rebuild (two `.tp-rotv`);
  - skip the dispose on unmount (the captured host still holds `.tp-rotv`);
  - `hqIndex = hqSpace`;
  - swap `deck` between the two move-to-top buttons;
  - swap `cardType` between the two reveal buttons;
  - value "Move card" by index;
  - render the pane without `submitMove`;
  - render it with `playerId: ''`;
  - drop the `playerId` pass-through in `PlayViewport` (the test mounts with `playerId: '0'`);
  - leave `hasEscapeCandidate` out of the Escape disabled state.
- [ ] `git diff origin/main -- '*.test.ts'` is additions only. `git diff --name-only origin/main` ⊆ Files to Produce.
- [ ] **STOP gate:** the 01.6 post-mortem is written (`docs/ai/REFERENCE/01.6-post-mortem-checklist.md`) before Commit 1.
- [ ] Commit 1, `EC-844: …`: code + tests + dependencies + post-mortem, with `Vision: §3, §7, §11, §16, §17, §22`.
- [ ] Commit 2, `SPEC: WP-807 / EC-844 govern-close — …`: STATUS; the ewiki §Build status; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write` + `:check`; DECISIONS.md: none (D-24689 §6, D-24713); `pnpm ledger:numbers:check`.
- [ ] Neither commit subject contains a Rule 1 token (WIP / fix stuff / misc / tmp / updates / changes / debug).
- [ ] Live (D-24026), after merge + deploy only: WP-807 §Verification steps 1–9 as `jefferyjjensen`. The STATUS flip covers WP-806 and WP-807.

## Common Failure Smells
- `TS2339 … 'addFolder' does not exist on type 'Pane'` → `@tweakpane/core` is missing from `devDependencies`.
- The entry chunk contains `tp-rotv` → the pane or `tweakpane` was imported statically.
- Two panes stack after a poll → the rebuild doesn't dispose the old `Pane`.
- `TS2345 … not assignable to UiMoveName` → a setter name is missing from the union.
- "Move card" moves a neighbouring card after a poll → the lists are valued by index.
- HQ placement lands one space to the right → `hqIndex` wasn't `hqSpace − 1`.
