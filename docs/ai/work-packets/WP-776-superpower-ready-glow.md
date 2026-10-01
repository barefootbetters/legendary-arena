# WP-776 — Superpower-ready rim: show which hand cards will chain if played now

**Status:** Draft 2026-09-26 · **EC:** EC-813 · **Reserves:** D-24613
**Primary Layer:** Game Engine (a new owner-only `UIState` field) + App (`apps/arena-client` render)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (cross-layer; a new client-visible `UIState` field under the
five-step Board-Visible Field Rule; triggers a `01.6` post-mortem)
**Baseline:** `origin/main` @ `32fd8ba2` (2026-09-26); re-synced against `e0d6fc0c` on 2026-09-30 (see the sync note under Non-Negotiable Constraints).

## Goal

Legendary's skill is superpower sequencing: a card with "[Tech]: +2 Attack" pays off only if you
have already played another Tech hero this turn. Today a player learns they played cards in the
wrong order only **after** the match, from the Synergy Realization coach's "Opportunities" tip
(WP-710 / WP-713). This packet moves that information to the moment it matters.

On your turn, each hand card whose superpower condition **already holds** for the cards you have
in play gets a hero-amber rim. The engine computes it with the same condition evaluation real
play uses, and only for superpowers that will actually do something. So the rim says "play this
now and its superpower fires". It is the Hearthstone "condition active" highlight and the Candy
Crush next-match hint, and it feeds the shipped combo ladder. "Fires" means the effect reaches its
play-time handler (`executeSingleEffect` returns `true`). A handler that finds nothing to act on
(for example a rescue with an empty Bystander stack) still counts as fired.

## User-Visible Impact

- On your turn, a hand card whose superpower condition is met by the cards you have played this
  turn shows a hero-amber ring over its art, and screen readers hear "Superpower ready".
- Play another hero and the rims update on the next frame.
- The ring lifts with the card on hover and shows in the phone hand band.
- There is no rim:
  - on another seat's turn;
  - on a disabled card;
  - on a split / Divided card;
  - on a card whose superpower would not do anything;
  - on a card whose readiness the engine cannot state for certain.

  When unsure, there is no rim. A rim never promises a superpower that will not fire.
- The only copy is "Superpower ready". No text says a card "missed" or "failed".

## Assumes

- **WP-710 / D-24533 ✅** — `packages/game-engine/src/hero/heroConditions.evaluate.ts` provides
  `heroConditionHoldsForInPlay(condition, playedCardId, candidateInPlayIds, cardData): 'holds' | 'fails' | 'unsupported'`
  (~L1015) and `SEQUENCE_GATE_CONDITION_TYPES = ['heroClassMatch', 'requiresTeam', 'requiresKeyword']`
  (~L952). Both are exported from `index.ts` (~L307), together with `HeroConditionCardData`.
  - It reuses `evaluateCondition` over a minimal `G` slice.
  - It returns `'unsupported'` when the card or any in-play card has a Size-Changing hook or
    `copy-powers`.
  - It evaluates one condition at a time.
  - **Non-gate types can throw in its minimal slice** (`recruitMadeThisTurnAtLeast`,
    `cardsDrawnThisTurnAtLeast`, `bystandersInVictoryAtLeast`, `heroClassInDiscardPile`), so a
    caller filters to gate types first, as `apps/server/src/coach/sequenceTeacher.logic.ts` does.
- **The play path** — `hero/heroEffects.execute.ts`:
  - `executeHeroEffects` reads `getHooksForCard` with **no timing filter** (every gate-only hook is
    `onPlay` anyway).
  - It ANDs every condition on a hook (`evaluateAllConditions`).
  - `hookHasExecutableEffect` checks only that a handler is **reachable**. (Drafted as
    module-private; D-24649 / PR #2447 has since exported it, see the 2026-09-30 sync note below.)
  - `executeSingleEffect` then **silently drops** an MVP keyword with no valid magnitude
    (`executeSingleEffect` ~L6037; its pre-gate ~L6058 calls `failsMagnitudePreGate(effect)` ~L627,
    which is `keyword !== 'ko' && !NO_MAGNITUDE_KEYWORDS.has(keyword)` → `isValidMagnitude(effect.magnitude)`).
    So a reachable hook can still do nothing: a gated hook
    whose only effects are magnitude-less `attack` / `recruit`. D-24649 now records these as
    honest `attack-no-magnitude` / `recruit-no-magnitude` hollows.
- **Self-exclusion** — `heroClassMatch` and `requiresTeam` skip the card's own instance id. At play
  the card is appended to `inPlay` before its effects run. So "live `inPlay` without the hand
  card" gives the same answer as play for these two types.
- **Split / Divided cards** — the face is chosen at play (`moves/splitFaceChoice.resolve.ts`
  `isSplitCardInstance(G, cardId)`, which since WP-772 (in this baseline) matches either face via
  `resolveSplitFacePair`).
- **The Board-Visible Field Rule** (`.claude/rules/architecture.md` §UIState Projection Integrity):
  1. type;
  2. `buildUIState`;
  3. `filterUIStateForAudience` pass-through;
  4. an audience test;
  5. the Play Diagnostics `uiStateSnapshot`.

  The owner-only precedent is `deckCardStats` (WP-608 / D-24419). `UICardDisplay` is pinned at
  seven fields, so the flag cannot ride on `handDisplay` entries.
- **The hand (WP-699 ✅)** — `apps/arena-client/src/components/play/HandRow.vue` renders one `li`
  per card, holding a `button` (zero padding, zero border, transparent) that wraps `CardTile`.
  The arc transform is on the `li`. `CardTile.vue`'s root `.card-tile` is
  `position: relative; overflow: hidden` with an opaque image, and carries the hover lift
  (`translateY(-12px) scale(1.06)`). `.sr-only` is defined in `apps/arena-client/src/styles/base.css`.
  PlayDesktop and PlayMobile pass `:hand-display="viewer.handDisplay"`, and the phone hand band is
  `overflow-x: auto`.
- `UIState` is never hashed (`replay.hash.ts` `computeStateHash` reads `G` only). `buildUIState`
  runs on every push, per viewer. The simulation runner, PAR aggregator, server autoplay and
  bot-ally driver also build it to feed their policies. `CompetentHeuristic` scores moves from the
  `UIState`, but no policy reads `handSuperpowerReady`, so their outcomes do not change. No
  simulation or bot policy may read `handSuperpowerReady` in this packet.
- `MatchPhase` (`turn/turnPhases.types.ts`) includes `'play'`.
- `pnpm -r build` exits 0 and the engine and arena-client suites are green on `origin/main`.

## Context (Read First)

- **Why the engine computes it.** The client has no `cardTraits`, hooks or grant maps, and
  computing a rule on the client is forbidden (the engine owns truth; D-20105 / D-24531 invariant 5).
  The engine already has the predicate.
- **Why one cross-layer packet.** The projection has no consumer without the rim, and the rim has
  no data without the projection. The engine half is small (one helper, one field). This follows
  the WP-750 precedent (engine projection + client render in one packet).
- **Why only when certain.** A rim that lights and then nothing happens teaches the wrong lesson.
  Every known way the projection could disagree with play in the unsafe direction resolves to
  **no rim**:
  - **A hook that mixes gate and non-gate conditions.** Real play ANDs them; the predicate sees
    only gates. Today this is one printed line, `asrd/thor/royal-decree`.
  - **A hollow hook**, with no reachable handler.
  - **A hook whose only effects are dropped for a missing magnitude** (the class D-24649 now
    records as `attack-no-magnitude` / `recruit-no-magnitude` hollows). The
    `hookHasDispatchableEffect` check covers it.
  - **A split card**, whose face and so hook set is chosen at play.
  - **`'unsupported'`** (Size-Changing / Copy Powers).
- **Known limits that remain, stated.** Some cases can err toward **unlit**, which is safe:
  - `requiresKeyword` does not self-exclude (no card data produces it today).
  - An earlier hook of the same card can change `inPlay` mid-play.
  - A single Size-Changing or Copy Powers card in play turns off every rim that turn.

  A few cases can show a rim where play is blocked for a reason outside the superpower:
  - a pending-choice freeze (HandRow's disabled state does not model it);
  - an unpayable discard-to-play cost.

  The rim also faithfully shows the engine's own known gate quirks (the D-24530 inline
  `[team:X]` gates; the D-24562 doubled-icon under-gate, where one other card satisfies
  `[hc:X][hc:X]`). It agrees with play in every one of these cases.
- **Why only the active player, and only with cards in play.** Every other player's `inPlay` is
  empty (end-of-turn cleanup empties it), and at the start of a turn the active player's is empty
  too. So the helper returns all-`false` immediately when `inPlay` is empty, and the field is built
  only for the active player (Vision §16: every push stays cheap).
- **Vision §19 — confirmed.** §19 ("no in-game AI assistance or prompting") governs AI (LLM) help.
  This is a deterministic readout of rule state from the same `evaluateCondition` the rules use,
  in the class of the Day/Night badge (WP-765) and the Fight N badge (WP-750). It recommends no
  order and plays nothing (§3). The operator confirmed this reading on 2026-09-26.
- **Copy.** The Synergy Realization two-vocabulary rule applies (`docs/ai/DESIGN-SYNERGY-REALIZATION.md`
  §2). The one string is "Superpower ready".
- **Replay snapshots.** `buildSnapshotSequence` builds unfiltered, play-phase states, so its
  snapshots gain the field for the mover. There is no privacy change (`handCards` is already
  unfiltered there) and no golden comparison.
- **In-flight overlaps.**
  - PR #2306 (WP-743, merged 2026-09-30 as `83f637d9`) added non-gate condition types to
    `heroConditions.evaluate.ts`; the gate-type filter keeps this packet safe.
  - PlayDesktop / PlayMobile are hub files touched by other open work; the one-line bindings rebase.
  - WP-775 also edits `PlayMobile.vue` (`isViewerTurn`); keep both.

## Non-Negotiable Constraints

**Engine (do not remove):**
- ESM only, Node v22+.
- The new helper is pure: no `boardgame.io` import, no I/O, no `Math.random`, `for...of` (no
  `.reduce()`), and it never throws.
- No new `G` field and no hash re-pin. The play-phase check uses a typed constant (`MatchPhase`),
  not a bare string.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- Human-style code per `00.6-code-style.md` (JSDoc, full words, `// why:` on each exclusion rule).
- Tests use `node:test` + `makeMockCtx` / `makeMockMoveContext`, with `.test.ts` and no
  `boardgame.io/testing`. New drift pins are **runtime** assertions (D-24372).

**App (do not remove):**
- The client renders the projected flag verbatim. It never evaluates a condition or reads card
  text to decide readiness.
- SFC authoring per D-6512. No new dependency. Colour: the existing
  `var(--color-hero-ability, #f5a623)` expression.
- `CardTile.vue` is **not** modified.

**Packet-specific:**
- **Five-step contract, all five.** The field is owner-only (redacted for other players and
  spectators, like `handCards`). A field that reaches `buildUIState` but not the filter is a
  shipped failure class (PR #1165).
- **Filter to gate types before calling the predicate.**
- **When unsure, false** (the exclusions above), never "probably".
- `hookHasExecutableEffect` and `hookHasDispatchableEffect` are reused, not duplicated. **Both
  already exist on `main`** (D-24649 / PR #2447 exported the first and added the second, matching
  the Locked Contract below). Neither function is added to `index.ts`.
- `heroConditionHoldsForInPlay`, `evaluateCondition` and the play path are unchanged. WP-776 makes
  **no** edit to `heroEffects.execute.ts`.

**2026-09-30 sync note (SPEC):** D-24649 (PR #2447, the magnitude pre-gate hollow fix) landed the
two predicates and the `hookHasDispatchableEffect` ↔ `executeSingleEffect` parity sweep
(`hero/heroEffects.dispatchable.test.ts`) before this WP ran. The Locked Contract below is
unchanged and is what `main` implements. Execution confirms it rather than re-adding it, and does not
duplicate the parity sweep or the predicate's unit cases. The Locked Contract's semantics are
unchanged; the only prose edits are the count of MVP keywords without a play-time handler (thirteen →
fourteen, `phasing` from WP-783) and the "present on `main`" note on `hookHasDispatchableEffect`.

**Session protocol:** if you find a card where the rim and real play disagree in the unsafe
direction (rim on, superpower does not fire), STOP and report it with the card id. Do not patch
around it on the client.

## Locked Contract Values

- `hero/heroEffects.execute.ts`:
  - `export function hookHasExecutableEffect(hook: HeroAbilityHook): boolean` — body unchanged.
  - `export function hookHasDispatchableEffect(hook: HeroAbilityHook): boolean` (present on `main` since D-24649) — true when
    `(hook.primitiveEffects?.length ?? 0) > 0`, or when any `effect` in `hook.effects ?? []` has
    `effect.type` in `MVP_KEYWORDS` **and** (`effect.type === 'ko'` **or**
    `NO_MAGNITUDE_KEYWORDS.has(effect.type)` **or** `isValidMagnitude(effect.magnitude)`) **and**
    `HERO_EFFECT_HANDLERS[effect.type] !== undefined`. Otherwise false. It mirrors all three steps
    of `executeSingleEffect`'s gate: the keyword, the magnitude, and the play-time handler. Fourteen MVP
    keywords have no play-time handler: seven run at other times (`wall-crawl`, `dodge`, `phasing`,
    `size-changing`, `return-on-discard`, `teleport-on-discard`, `diving-block`), plus the seven
    frozen `reveal-*` translations. (`phasing` joined with WP-783 / D-24629; verified on `e0d6fc0c`:
    72 MVP keywords, 58 play-time handlers.)
- New engine module `packages/game-engine/src/hero/superpowerReady.logic.ts` exporting exactly
  `computeHandSuperpowerReady(G: LegendaryGameState, playerId: string): boolean[]`. The result is
  parallel to `G.playerZones[playerId].hand` (same length, same order, a fresh array):
  - all `false` when `G.playerZones[playerId].inPlay` is empty;
  - `false` for a hand card when `isSplitCardInstance(G, cardId)`;
  - otherwise `hooks = getHooksForCard(G.heroAbilityHooks ?? [], cardId)`. A hook **qualifies**
    when all of these hold:
    - `conditions` is non-empty;
    - **every** condition's `type` is in `SEQUENCE_GATE_CONDITION_TYPES`;
    - `hookHasExecutableEffect(hook)`;
    - `hookHasDispatchableEffect(hook)`.
  - The card is `true` when **any** qualifying hook has **every** condition return `'holds'` from
    `heroConditionHoldsForInPlay(condition, cardId, G.playerZones[playerId].inPlay, cardData)`.
    Here `cardData = { cardTraits, cardSizeChangingClasses, cardCopiedTeams, heroAbilityHooks }`
    from `G`. `'fails'` and `'unsupported'` both count as not holding.
  - A card with no qualifying hook is `false`.
- `UIPlayerState.handSuperpowerReady?: boolean[]` (`ui/uiState.types.ts`; JSDoc: owner-only, parallel
  to `handCards`, present only for the active player during the play phase).
- `buildUIState` sets it for a player only when `ctx.currentPlayer === playerId` and
  `ctx.phase === PLAY_PHASE`, where `const PLAY_PHASE: MatchPhase = 'play'`. It uses conditional
  assignment after the player object is built
  (`if (…) { player.handSuperpowerReady = computeHandSuperpowerReady(gameState, playerId); }`) —
  never `handSuperpowerReady: undefined` and never a ternary inside the object literal. Otherwise
  the field is omitted.
- `filterUIStateForAudience`: `preserveHandCards` copies it as a fresh array
  (`base.handSuperpowerReady = [...player.handSuperpowerReady]`); `redactHandCards` omits it.
- Client `HandRow.vue`:
  - It gains the prop `handSuperpowerReady: { type: Array as PropType<readonly boolean[] | undefined>, required: false, default: undefined }`
    (the `handDisplay` prop shape; `exactOptionalPropertyTypes` is on).
  - The `li` gets the class `hand-card--superpower-ready` when `handSuperpowerReady[index] === true`
    **and** the card's button is not disabled.
  - Inside that button, `<span v-if="<the same predicate as the li class>" class="sr-only">Superpower ready</span>`.
  - The rim is locked as scoped CSS:
    `.hand-card--superpower-ready :deep(.card-tile)::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 3px var(--color-hero-ability, #f5a623); pointer-events: none; }`
    It is static, draws over the art, moves with the hover lift, and cannot be clipped by
    `overflow`.
- `PlayDesktop.vue` and `PlayMobile.vue` pass `:hand-superpower-ready="viewer.handSuperpowerReady"`
  beside `:hand-display` (the only change to those hub files).

## Scope (In)

### A) Engine helpers — `hero/superpowerReady.logic.ts` (new) + `.test.ts` (new); `hero/heroEffects.execute.ts` already has both predicates (D-24649)
- **Helper tests** (real hook shapes):
  - An `[hc:tech]` card in hand with a Tech hero in play → `true`. With a non-Tech hero in play
    → `false`. With empty `inPlay` → all `false` (short-circuit).
  - A second copy of the same card in play satisfies it (`#N` instance ids).
  - A doubled `[hc:X][hc:X]` hook needs only one other X card (agrees with play, D-24562).
  - A teamless S.H.I.E.L.D. starter satisfies `requiresTeam: 'shield'` (the `cardCountsAsTeamMember` carve-out).
  - The following are `false`, with no throw where noted:
    - a mixed gate + non-gate hook, even when the gate holds;
    - a non-gate condition that would throw in the minimal slice (no throw);
    - a hollow hook;
    - a gate-only hook whose only effect is a bare `{ type: 'attack' }` (no magnitude);
    - a split card;
    - a Size-Changing card in play (`'unsupported'`);
    - a card with no hooks.
  - A card with two hooks where one qualifies and holds → `true`.
  - The result length equals the hand length, and the array is fresh (not `===` to any `G` array).
  - `hookHasDispatchableEffect` (already covered case by case in `heroEffects.dispatchable.test.ts`,
    D-24649; confirm, do not duplicate): primitive-only → `true`; `attack` with magnitude 2 → `true`; bare
    `attack` → `false`; `ko` → `true`; `rescue` without magnitude → `true`; a gated hook whose
    only effect is `wall-crawl` (no play-time handler) → `false`.
- **Parity sweep (`hookHasDispatchableEffect` ↔ `executeSingleEffect`):** already landed with D-24649 in
  `hero/heroEffects.dispatchable.test.ts`. Confirm it is green and covers the shape below; do not
  duplicate it.
  - For every keyword in `MVP_KEYWORDS` × magnitude ∈ {undefined, 0, 2, 1.5, -1}, temporarily
    replace each `HERO_EFFECT_HANDLERS` entry with a no-op (restored in `finally`).
  - Assert `executeSingleEffect({} as LegendaryGameState, {}, '0', 'x', { type, magnitude })`
    returns the same boolean as `hookHasDispatchableEffect` on a hook whose only effect is
    `{ type, magnitude }`.
  - The gate reads nothing from `G` before the handler, so this is a true runtime parity check.
- **No-throw sweep:** for every `gateType` in `SEQUENCE_GATE_CONDITION_TYPES`,
  `computeHandSuperpowerReady` over a `G` whose hand card has a hook
  `{ conditions: [{ type: gateType, value: 'x' }], effects: [{ type: 'attack', magnitude: 2 }] }`
  and a non-empty `inPlay` returns a boolean array without throwing. It runs inside `playerView`.
- **Agreement with play (the key test):**
  - Setup: `buildInitialGameState` over a synthetic `getSet` registry in the
    `hero/hawkeyeImpossibleTrickShot.test.ts` `makeRegistry` shape:
    - hero `black-widow`, card `mission-accomplished` with `hc: 'tech'` and
      `rarityLabel: 'Common 1'` (≥ 2 copies);
    - `abilities` verbatim from `data/cards/core.json`:
      `['Draw a Card. [keyword:draw:1]', '[hc:tech]: Rescue a Bystander. [keyword:rescue:1]']`;
    - `bystandersCount ≥ 1`.

    Move two instances (A and B, ids read from `G.heroDeck` / `G.hq`) and one starting S.H.I.E.L.D.
    card into hand, and set `currentStage = 'main'`. Treat an undefined
    `conditionalClauses['0']` as 0.
  - Negative case: play the S.H.I.E.L.D. card. The helper is `false` for B. Play B: `played` +1,
    `assembled` +0, and no Bystander is gained.
  - Positive case: the helper is now `true` for A. Play A: `assembled` +1, and a Bystander lands in
    `victory`.

### B) Projection — `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + tests
- `uiState.build.test.ts`: the active player's field is parallel to `handCards`; a non-active
  player's field is absent; in the lobby phase it is absent.
- `uiState.filter.test.ts`: the owner sees it (as a fresh array); another player and a spectator get
  `undefined` (the `deckCardStats` test shape).
- `uiState.types.drift.test.ts`: a runtime presence pin — a built active-player projection with a
  non-empty `inPlay` includes the `handSuperpowerReady` key.

### C) Client — `HandRow.vue` + `HandRow.test.ts`, `PlayDesktop.vue`, `PlayMobile.vue`
- HandRow tests:
  - The `li` class and the hidden text appear for a `true`, enabled card.
  - They are absent for `false` / `undefined`.
  - They are absent on a disabled card (another seat's turn, a Wound).
  - The arc and lift classes are unaffected.
  - With every flag `true`, the rendered HandRow text matches none of `/whiff|fail|error|miss|wast/i`
    (the DESIGN-SYNERGY-REALIZATION §2 copy-lint).

### D) Docs
- `wiki/play-board.md`: the hand row of the zone→field map lists `handSuperpowerReady`.
- `wiki/visual-effects.md`: the "Superpower-ready rim" card-feel row becomes shipped.

## Out of Scope

- Any hint about **which card to play next**, or about cards that would *enable* others. The
  sequence teacher stays a post-match coach surface.
- Counting-condition payoffs (`distinctHeroClassesAtLeast`, wait-and-see types, numeric
  thresholds), relaxing the Size-Changing / Copy Powers `'unsupported'` rule (live `G` has the grant
  maps; a named follow-up), and split-card faces.
- The Synergy Rate counting the magnitude-less gated lines as "assembled" (WP-708's
  instrumentation). Fixed separately by D-24649 (PR #2447), not changed here.
- Pulses, particles or sound on the rim (static in v1). `CardTile.vue` changes.
- The WP-772 split-card off-play model, bot pacing (WP-773), the turn banner (WP-774), the
  affordability cues (WP-775).
- Any server, registry or card-data change.

## Files Expected to Change

Engine (`packages/game-engine/src/`):
- `hero/superpowerReady.logic.ts` + `.test.ts` — **new** — the helper, its exclusions, and the agreement-with-play test
- `hero/heroEffects.execute.ts` — **unchanged** — both predicates already exported (D-24649)
- `ui/uiState.types.ts` — **modified** — the field + JSDoc
- `ui/uiState.build.ts` + `.test.ts` — **modified** — active-player build
- `ui/uiState.filter.ts` + `.test.ts` — **modified** — owner-only pass-through
- `ui/uiState.types.drift.test.ts` — **modified** — runtime presence pin

App (`apps/arena-client/src/`):
- `components/play/HandRow.vue` + `HandRow.test.ts` — **modified** — prop, class, hidden text, rim CSS
- `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — **modified** — one prop binding each

Docs: `wiki/play-board.md`, `wiki/visual-effects.md`.

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24613 → Active),
`docs/ai/post-mortems/01.6-WP-776-superpower-ready-glow.md` — **new**,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- `computeHandSuperpowerReady(G, playerId): boolean[]`, `hookHasExecutableEffect` and
  `hookHasDispatchableEffect` exactly as locked. They are engine-internal (not re-exported from
  `index.ts`).
- `UIPlayerState.handSuperpowerReady?: boolean[]`: owner-only, parallel to `handCards`, active
  player during play only.
- The client prop, class, hidden text and rim CSS as locked. No other `UIState` field changes.

## Acceptance Criteria

1. For the active player, `handSuperpowerReady[i]` is `true` exactly when the locked rule holds for
   `handCards[i]`, and the array is parallel to `handCards` and fresh.
2. Every exclusion yields `false`, and the helper never throws. The exclusions are: empty
   `inPlay`, a mixed hook, a hollow hook, a magnitude-less-only hook, a split card,
   `'unsupported'`, and no qualifying hook.
3. When the helper says `true`, playing that card fires its conditional effect (tested through the
   real `playCard` path).
4. The field is visible to its owner only; other players and spectators never receive it. It
   appears in the owner's Play Diagnostics `uiStateSnapshot`.
5. The client shows the ring and the "Superpower ready" hidden text only on enabled cards flagged
   `true`. The arc, the lift and the other hand cards are unchanged.
6. No `G` field and no hash re-pin; the sentinel and replay fixtures are unchanged.

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — engine suite (record before/after counts)
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 failures; record the delta (helper ~15, projection 6, pin 1 — the dispatchable/parity tests already landed with D-24649)

# Step 3 — client typecheck + suite
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; 0 failures; at least +4 tests

# Step 4 — the field is copied on the owner path (step 3 of the five-step contract)
Select-String -Path packages\game-engine\src\ui\uiState.filter.ts -Pattern "base\.handSuperpowerReady\s*="
# Expected: exactly one match

# Step 5 — sentinel / replay fixtures unchanged
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code origin/main -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0

# Step 6 — whole repo
pnpm -r --no-bail test
# Expected: 0 failures

# Step 7 — scope
git status --porcelain
# Expected: only the Files Expected to Change (plus governance); revert line-ending-only build churn.
```

## Definition of Done

- [ ] All acceptance criteria pass; engine and arena-client counts recorded; client typecheck 0.
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures.
- [ ] Five-step contract complete: type, build, filter, audience test, and the field seen in a Play
      Diagnostics export.
- [ ] `docs/ai/post-mortems/01.6-WP-776-superpower-ready-glow.md` written (a new projection field), including the aliasing check that the
      array is fresh at build and at filter.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** on play.legendary-arena.com, in a match with Black Widow
      (`core/black-widow/mission-accomplished`, `[hc:tech]`):
  - With no Tech hero in play, Mission Accomplished has no ring.
  - After you play a Tech hero it gains the ring. Check that the ring shows at rest, while hovered
    (it lifts with the card), and in the phone hand band.
  - Play it: its rescue fires (the game log and the victory count agree).
  - Export Play Diagnostics: `handSuperpowerReady` is in your own snapshot.

  Record the matchId in `docs/ai/STATUS.md`. A merged PR alone is not done.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24613 flipped to Active.
- [ ] `wiki/play-board.md` and `wiki/visual-effects.md` updated.
- [ ] `WORK_INDEX.md` WP-776 checked off with date; `EC_INDEX.md` EC-813 → Done;
      `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 Rules Authenticity and §2 Content Authenticity: the rim applies the printed superpower
    condition exactly as the engine evaluates it, and only for effects that fire.
  - §3 Player Trust & Fairness: the rule state is inspectable before you commit, and the system
    decides nothing for you.
  - §16 Performance: an empty-`inPlay` short-circuit; built only for the active player.
  - §17 Accessibility: hidden text for screen readers; the ring is a shape, not only a colour.
  - §19: confirmed by the operator 2026-09-26 as a rules readout, not AI help.
  - §8 / §22 Determinism: no `G` or hash change.
- **Conflict assertion:** No conflict. Every seat sees its own hand's rim equally, and nothing is
  purchasable (NG-1). PAR and simulation outcomes are unchanged: `CompetentHeuristic` scores
  moves from the `UIState`, but no policy reads `handSuperpowerReady`.
- **Determinism preservation:** a read-only projection computed from `G` on each push. No `G`
  field, no hash input, no committed replay fixture change.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1 structure:** every required section is present; the baseline SHA is cited.
- **§2 constraints:** engine and app (ESM, Node v22+, full file contents, no new dependency,
  D-6512), packet-specific, session protocol, locked values.
- **§3 Assumes:** the following are all cited with locations:
  - WP-710 / D-24533;
  - the play path, including the magnitude drop;
  - self-exclusion and split cards;
  - the five-step rule and the `deckCardStats` precedent;
  - WP-699's HandRow / CardTile structure and `.sr-only`;
  - hashing and the policy consumers;
  - `MatchPhase`.
- **§4 Context:** the rationale, the one-packet rationale, every exclusion and every known limit,
  the confirmed §19 reading, the copy rule, replay snapshots and the in-flight overlaps.
- **§5 files / §7 deps:** a closed allowlist with one-line purposes (engine 8 after the 2026-09-30 sync, client 4, docs 2,
  governance incl. the post-mortem). No new npm dependency.
- **§6 naming:** full-word names (`computeHandSuperpowerReady`, `hookHasDispatchableEffect`,
  `handSuperpowerReady`, `hand-card--superpower-ready`, `PLAY_PHASE`). Existing names are reused
  verbatim.
- **§8 layer boundary:** the engine computes and the client renders a projected field verbatim.
  No client or server import in the engine; no runtime engine import added to the client.
- **§9 Windows:** `pwsh` verification (`Select-String`, `git diff`).
- **§10 env:** N/A — no environment variable. **§11 auth:** N/A — no auth or session surface.
- **§12 tests:** `node:test` + `makeMockMoveContext`. Negative cases for every exclusion, a
  concrete agreement-with-play test, audience tests, and a runtime presence pin (D-24372).
- **§13 verification:** exact commands with expected output (test floors; a filter assignment grep).
- **§14 AC / §15 DoD:** binary ACs. The DoD carries the five steps, the 01.6 post-mortem, STATUS,
  DECISIONS, the wiki, WORK_INDEX, and a named-card D-24026 live verify including hover, phone and
  a diagnostics export.
- **§16 code style:** `// why:` on each exclusion, the short-circuit and the active-player rule; a
  typed phase constant; `?? []` guard; `for...of`.
- **§17 Vision Alignment:** present, with the confirmed §19 reading.
- **§18 prose-vs-grep:** Step 4 greps the assignment form `base.handSuperpowerReady =`, which a
  comment would not match by accident.
- **§19 bridge:** N/A — commit-time rule; baseline `32fd8ba2` recorded.
- **§20 Funding Surface:** N/A — no global-nav, registry-viewer or profile funding affordance, no
  tournament funding channel; the only player copy is "Superpower ready".
- **§21 API Catalog:** N/A — no `apps/server` endpoint and no `apps/server/src/**` library function.

## Gate Verdicts

Drafted 2026-09-26 on base `32fd8ba2`. Each gate ran as an independent subagent.

- **01.4 pre-flight:** READY TO EXECUTE, after one fix round:
  - `hookHasDispatchableEffect` was added (the play path drops magnitude-less MVP effects);
  - the ring moved to the tile's `::after`.
- **Vision §19:** the operator confirmed on 2026-09-26 that this is a deterministic rules readout,
  not in-game AI assistance (D-24613 §4).
- **01.7 copilot:** CONFIRM, after one HOLD round with eight fixes:
  - the bot-policy premise;
  - the parity sweep;
  - the conditional-assignment and prop-shape locks;
  - the agreement fixture and the copy-lint test;
  - the post-mortem path;
  - the EC STOP smell;
  - the no-throw sweep;
  - the `v-if` on the sr-only text, the "fires" definition and the thirteen-keyword count.
  None changed scope, so pre-flight stands.
- **00.3 lint:** PASS.
- **01.5 runtime wiring:** not invoked; the two page bindings are in the allowlist.
- **01.6 post-mortem:** required at execution (new projection field).
