# EC-573 — Core Dr. Doom Master Strike (Execution Checklist)

**Source:** docs/ai/work-packets/WP-538-core-dr-doom-master-strike.md
**Layer:** Game Engine (`packages/game-engine`) + Arena Client (`apps/arena-client`) — cross-layer

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] core/dr-doom has no strike branch yet: `grep -q "MASTERMIND_CORE_DR_DOOM\|'core/dr-doom'" packages/game-engine/src/rules/mastermindHandlers.ts` → **ABSENT**
- [ ] WP-476 interactive-strike precedent present: `grep -q "resolveMagnetoStrike" … && grep -q "pendingDiscardChoices" … && test -f packages/game-engine/src/moves/discardChoice.resolve.ts && test -f apps/arena-client/src/components/play/PendingDiscardChoicePrompt.vue` → OK
- [ ] Wiring surfaces exist: `types.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.{build,filter,types}.ts`, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`
- [ ] **WP-537 is on main** (shared `mastermindHandlers.ts`): `grep -q "MASTERMIND_CORE_LOKI" packages/game-engine/src/rules/mastermindHandlers.ts` → present (else STOP — land WP-537 first)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` and `pnpm --filter @legendary-arena/arena-client test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- Constant: `const MASTERMIND_CORE_DR_DOOM = 'core/dr-doom';` (+ `// why:` vs `co2e/doctor-doom`). Dispatch: `else if (mastermindId === MASTERMIND_CORE_DR_DOOM) { resolveCoreDoomStrike(gameState, resolveCurrentPlayer(strikeContext)); }` — mirror the Magneto branch (pass the current player).
- Resolver name: **`resolveCoreDoomStrike`** — NOT `resolveDoctorDoomStrike` (existing co2e face; untouched).
- Per player (`Object.keys(G.playerZones).sort()`): gate `hand.length === 6` (players with ≠6 untouched) → if `selectLowestCostHero(G, hand, 'heroClass', 'tech') !== null` reveal + keep, no penalty → else put 2 on top.
- Penalty split (the WP-476 pattern): **current player** (`resolveCurrentPlayer(strikeContext)`) parks `PendingPutCardsOnDeckChoice`; **non-current / null-current / bot** auto-put the deterministic cheapest-2 (Wounds cheapest first — the `selectDiscardToLimitCards` idiom).
- New type: `PendingPutCardsOnDeckChoice = { choiceType: 'put-cards-on-deck'; playerID: string; count: number }` (count = 2); state field `pendingPutCardsOnDeckChoices?: PendingPutCardsOnDeckChoice[]` — **optional, lazy-init at the park site, NEVER seeded in `buildInitialGameState`**.
- Selection order = deck-top order (first chosen ends up on top).
- Resolve move `putCardsOnDeckChoice.resolve.ts`: validate the 2 ids are in the chooser's hand → move to deck top in order → clear the entry; silent return on invalid args / wrong player / not-in-hand (moves never throw). Export `hasPendingPutCardsOnDeckChoice(G)`.
- Block-all: add `hasPendingPutCardsOnDeckChoice` to **every** move already guarding `hasPendingDiscardChoice`.
- UIState: build the field, type it, and **pass it through `filterUIStateForAudience` to the owning player** (the EC-206 drop-at-filter failure mode — add a filter test).
- Keyed by mastermind selection — **no** `data/cards` / marker / ledger / effect-index change.
- DECISIONS reservation: **D-24347**.

## Guardrails
- Ship engine block-all + UIState projection + client prompt **together** — a human chooser hard-freezes otherwise (`project_pending_choice_no_ux_freeze`).
- The new `G` field is optional + lazy-init (hashed but absent on a fresh state) → no `finalStateHash`/`PRE_WP080` re-pin expected; verify, do not pre-pin.
- Interactive for the CURRENT player only (the pending-choice architecture is single-current-player-scoped, D-24284); non-current + bots auto — do NOT park choices for non-current players.
- Do NOT touch `co2e/doctor-doom` / `resolveDoctorDoomStrike`, `tacticHandlers.ts`, any other mastermind, `data/cards`, markers, or ledger/index artifacts.
- No `ctx.random`; no generic "select N cards" abstraction (build put-on-top concretely — abstract on the third copy).
- `useTurnActions` positional-boolean discipline: APPEND the new guard LAST (the WP-476/477 gotcha).

## Required `// why:` Comments
- On `MASTERMIND_CORE_DR_DOOM` (core vs co2e) and on the lazy-init park site (never seeded in setup → no re-pin).
- On the `filterUIStateForAudience` pass-through (the field is dropped silently without it — the shipped EC-206 failure mode).
- On the non-current auto-pick branch (why bots resolve deterministically rather than parking).

## Files to Produce
- **New:** `packages/game-engine/src/moves/putCardsOnDeckChoice.resolve.{ts,test.ts}` · `apps/arena-client/src/components/play/PendingPutCardsOnDeckChoicePrompt.vue`
- **Modified (engine):** `rules/mastermindHandlers.ts` · `types.ts` · `moves/coreMoves.impl.ts` · `game.ts` · `moves/{dodgeCard,fightMastermind,fightVillain,healWounds,playFromUndercover,recruitHero}.ts` (+ play move) · `simulation/ai.legalMoves.ts` · `simulation/par.aggregator.ts` · `simulation/simulation.runner.ts` · `ui/uiState.{types,build,filter}.ts` · tests `rules/mastermindHandlers.test.ts` · `game.test.ts` (move-count) · `ui/uiState.filter.test.ts` · `ai.legalMoves` test
- **Modified (client):** `pages/PlayDesktop.vue` · `pages/PlayMobile.vue` · `composables/useTurnActions.ts` · `components/play/TurnActionBar.vue`
- **Governance:** `docs/ai/DECISIONS.md` (D-24347 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-538 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] Every `hasPendingDiscardChoice` move also guards `hasPendingPutCardsOnDeckChoice`: `grep -rl hasPendingDiscardChoice packages/game-engine/src/moves | while read f; do grep -L hasPendingPutCardsOnDeckChoice "$f"; done` → **NO output**
- [ ] `grep -n pendingPutCardsOnDeck packages/game-engine/src/ui/uiState.filter.ts` → pass-through present
- [ ] Move-count test updated; resolve-move / resolver / filter / legalMoves cases pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test`, `pnpm --filter @legendary-arena/arena-client test` (+ vue-tsc), `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] `git diff --name-only | grep -E '^(data/cards|data/metadata|docs/ai/coverage)'` → **NO MATCH**; hashes unchanged (or noted re-pin on a real diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24347 landed (Active)
- [ ] Commit prefix `EC-573:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Human chooser hard-freezes → the UIState projection or client prompt was skipped, or the filter dropped the field; ship all three together and assert the filter pass-through
- A move acts around the pending choice → a `hasPendingDiscardChoice` site is missing the new guard (see the After-Completing grep)
- `finalStateHash` re-pin with no real diff → the new field was seeded in `buildInitialGameState` instead of lazy-init; make it optional + park-site-created
- Bot fault mid-strike → `ai.legalMoves` did not short-circuit to the resolve move, or `par.aggregator`/`simulation.runner` has no resolver ([reference_bot_legalmoves_moveguard_divergence])
- A non-current player gets a prompt → only the current player parks; non-current + bots auto-pick
- `useTurnActions` gate mis-wires an existing action → the new positional boolean was not appended LAST
