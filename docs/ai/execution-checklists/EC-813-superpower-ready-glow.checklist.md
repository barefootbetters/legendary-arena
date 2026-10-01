# EC-813 — Superpower-ready rim (Execution Checklist)

**Source:** docs/ai/work-packets/WP-776-superpower-ready-glow.md
**Layer:** Game Engine + App (`apps/arena-client`)

## Before Starting
- [ ] `pnpm -r build` exits 0
- [ ] Engine and arena-client suites exit 0; client `typecheck` 0 (record baseline counts)
- [ ] Confirm on `main`: `heroConditionHoldsForInPlay` / `SEQUENCE_GATE_CONDITION_TYPES` exported; `executeHeroEffects` reads
      `getHooksForCard` with no timing filter; `hookHasExecutableEffect` is module-private; `executeSingleEffect` drops an MVP
      keyword without a valid magnitude (unless `'ko'` or in `NO_MAGNITUDE_KEYWORDS`); `UICardDisplay` pinned at seven fields.
- [ ] Confirm the `deckCardStats` owner-only pass-through in `uiState.filter.ts` (the precedent to mirror).
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `export function hookHasExecutableEffect(hook: HeroAbilityHook): boolean` — body unchanged.
- `export function hookHasDispatchableEffect(hook: HeroAbilityHook): boolean` — true when `(hook.primitiveEffects?.length ?? 0) > 0`,
  or any `effect` in `hook.effects ?? []` has `effect.type` in `MVP_KEYWORDS` AND (`effect.type === 'ko'` OR
  `NO_MAGNITUDE_KEYWORDS.has(effect.type)` OR `isValidMagnitude(effect.magnitude)`) AND
  `HERO_EFFECT_HANDLERS[effect.type] !== undefined`; otherwise false.
- `computeHandSuperpowerReady(G: LegendaryGameState, playerId: string): boolean[]` — parallel to `G.playerZones[playerId].hand`, fresh:
  - all `false` when `G.playerZones[playerId].inPlay` is empty;
  - `false` when `isSplitCardInstance(G, cardId)`;
  - a hook qualifies when `conditions` is non-empty, EVERY `condition.type` ∈ `SEQUENCE_GATE_CONDITION_TYPES`,
    `hookHasExecutableEffect(hook)` and `hookHasDispatchableEffect(hook)` (hooks from `getHooksForCard(G.heroAbilityHooks ?? [], cardId)`);
  - `true` when ANY qualifying hook has EVERY condition `=== 'holds'` via `heroConditionHoldsForInPlay(condition, cardId,
    G.playerZones[playerId].inPlay, { cardTraits, cardSizeChangingClasses, cardCopiedTeams, heroAbilityHooks })`.
- `UIPlayerState.handSuperpowerReady?: boolean[]`; built only when `ctx.currentPlayer === playerId` and
  `ctx.phase === PLAY_PHASE` (`const PLAY_PHASE: MatchPhase = 'play'`), by conditional assignment after the player object is
  built: `if (…) { player.handSuperpowerReady = computeHandSuperpowerReady(gameState, playerId); }` — never
  `handSuperpowerReady: undefined`, never a ternary in the object literal; `preserveHandCards`:
  `base.handSuperpowerReady = [...player.handSuperpowerReady]`; `redactHandCards` omits it.
- HandRow: prop `handSuperpowerReady: { type: Array as PropType<readonly boolean[] | undefined>, required: false, default: undefined }`;
  `li` class `hand-card--superpower-ready` when `[index] === true` AND the button is enabled;
  `<span v-if="<the same predicate as the li class>" class="sr-only">Superpower ready</span>` inside the button; rim CSS
  `.hand-card--superpower-ready :deep(.card-tile)::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
  box-shadow: inset 0 0 0 3px var(--color-hero-ability, #f5a623); pointer-events: none; }`. `CardTile.vue` unchanged.
- PlayDesktop / PlayMobile: `:hand-superpower-ready="viewer.handSuperpowerReady"` beside `:hand-display`.

## Guardrails
- Five steps, all five: type → build → filter pass-through (owner-only) → audience test → Play Diagnostics snapshot.
- Filter to gate types BEFORE calling the predicate (non-gate types can throw in its minimal slice).
- When unsure, `false`: empty `inPlay`, mixed / hollow / magnitude-less hooks, split cards and `'unsupported'` never light the rim.
- Pure helper: no `boardgame.io`, no I/O, `for...of`, never throws; no new `G` field; no hash re-pin; typed phase constant.
- `heroEffects.execute.ts` changes = the export + the new predicate only (reuse `MVP_KEYWORDS`, `HERO_EFFECT_HANDLERS`, the private `NO_MAGNITUDE_KEYWORDS` / `isValidMagnitude`); nothing in `index.ts`.
- The client renders the flag verbatim — no condition evaluation, no card-text parsing. Copy is "Superpower ready" only
  (never whiff / failed / error / missed / wasted).
- No-throw sweep: for every `gateType` in `SEQUENCE_GATE_CONDITION_TYPES`, a hand-card hook
  `{ conditions: [{ type: gateType, value: 'x' }], effects: [{ type: 'attack', magnitude: 2 }] }` with a non-empty `inPlay`
  returns a boolean array without throwing (the helper runs inside `playerView`).
- No simulation or bot policy reads `handSuperpowerReady` (`CompetentHeuristic` scores from the `UIState`; PAR must not move).
- ESM only, Node v22+; drift pins are runtime assertions (D-24372).

## Required `// why:` Comments
- Each exclusion (split, mixed, hollow, magnitude-less, `'unsupported'`): a rim must never promise a superpower that won't fire.
- The gate-type filter before the predicate: non-gate types can throw inside its minimal slice.
- The empty-`inPlay` short-circuit and the active-player-only build: every push stays cheap (Vision §16).
- `hookHasDispatchableEffect`: mirrors `executeSingleEffect`'s three-step gate (keyword, magnitude, play-time handler).
- HandRow's enabled-only rule and the `::after` ring on the tile: visible over the art, lifts with the card, cannot be clipped.

## Files to Produce
- `packages/game-engine/src/hero/superpowerReady.logic.ts` + `.test.ts` — **new** (incl. the agreement-with-play test)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — export + `hookHasDispatchableEffect`
- `packages/game-engine/src/ui/uiState.types.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — runtime presence pin
- `apps/arena-client/src/components/play/HandRow.vue` + `HandRow.test.ts` — **modified**
- `apps/arena-client/src/pages/PlayDesktop.vue`, `PlayMobile.vue` — **modified** — one binding each
- `wiki/play-board.md`, `wiki/visual-effects.md` — **modified**
- `docs/ai/post-mortems/01.6-WP-776-superpower-ready-glow.md` — **new**
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; client typecheck 0; `pnpm -r --no-bail test` 0 failures; engine ≥ +20, client ≥ +4 tests recorded
- [ ] Parity sweep green: `MVP_KEYWORDS` × magnitude {undefined, 0, 2, 1.5, -1}, each `HERO_EFFECT_HANDLERS` entry swapped
      for a no-op (restored in `finally`) — `executeSingleEffect({} as LegendaryGameState, {}, '0', 'x', { type, magnitude })`
      equals `hookHasDispatchableEffect` on the one-effect hook
- [ ] Agreement test green over the synthetic `makeRegistry` fixture (Mission Accomplished, printed `[hc:tech]` rescue line):
      after a S.H.I.E.L.D. play the helper is false and B's play adds `played` +1 / `assembled` +0 / no Bystander; after B the
      helper is true and A's play adds `assembled` +1 and a Bystander in `victory`
- [ ] HandRow copy-lint: with every flag true the text matches none of `/whiff|fail|error|miss|wast/i`
- [ ] Step 4: exactly one `base.handSuperpowerReady =` in `uiState.filter.ts`; sentinel / replay fixtures unchanged
- [ ] `docs/ai/post-mortems/01.6-WP-776-superpower-ready-glow.md` written (new projection field; fresh-array aliasing check at build and filter)
- [ ] `git status --porcelain` ⊆ Files to Produce (revert line-ending-only `pnpm -r build` churn such as `lagn-v1.json`)
- [ ] Live-on-surface (D-24026) with `core/black-widow/mission-accomplished`: no ring before a Tech hero is played; ring after (at rest,
      hovered, phone band); playing it fires the rescue; Play Diagnostics shows `handSuperpowerReady`; matchId in STATUS.md
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24613 → Active; both wiki pages updated
- [ ] `WORK_INDEX.md` WP-776 checked off with date; `EC_INDEX.md` EC-813 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-776 `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- The rim never shows in a live match → built but not passed through the audience filter (PR #1165 class).
- An engine test throws inside the helper → a non-gate condition reached the predicate before the type filter.
- A ringed card plays and nothing fires → a mixed, hollow or magnitude-less hook qualified → STOP and report the card id
  (WP session protocol); do not change the locked rule and do not patch the client.
- The ring is invisible or stays behind on hover → it was drawn on the `li` / button instead of the tile's `::after`.
- Rings on another seat's turn → the flag was built for every player, or HandRow ignored the disabled state.
- Commit message: `EC-813:` for code, `SPEC:` for the governance close — never `WP-776:`.
