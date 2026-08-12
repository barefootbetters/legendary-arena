# EC-567 — Paibok Fight: Each Player Gains an HQ Hero (Interactive) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-532-paibok-fight-give-hq-hero-each-player.md
**Layer:** Game Engine + Server (bot-loops) + Arena-Client + Card Data

## Before Starting
- [ ] **Scope lock — the EXACT file set is `## Files to Produce` below; any edit outside it is a FAIL, surfaced as a blocker before touching the file.**
- [ ] The interactive KO-hero pipeline exists as the template: `PendingKoHeroChoice`/`G.pendingKoHeroChoices` (`types.ts`), `resolveKoHeroChoice` + `hasPendingKoHeroChoice` (`moves/koHeroChoice.resolve.ts`), the block-all guard cascade (`fightVillain.ts` + ~14 sites), the `buildUIState` "13b" projection + `filterUIStateForAudience` arm, `PendingKoHeroChoicePrompt.vue`, the `ai.legalMoves` short-circuit.
- [ ] `villainEffectGiveHqHeroByTraitToCurrent` + `selectHqHeroIndexByTraitHighestCost` + `refillHqSlot` exist (`villainEffects.execute.ts`, `board/city.logic.ts`); "gain" pushes to `G.playerZones[player].discard` (D-24327), never victory.
- [ ] `PENDING_CHOICE_MOVE_NAMES` (`apps/server/src/autoplay/botLoopProgress.mjs`) + `PENDING_CHOICE_FLAGS` (`apps/server/src/bot-ally/botAllyDriver.mjs`) are the two bot-loop lists to extend.
- [ ] `core/skrulls/paibok-the-power-skrull` Fight line is unmarked; `G.hq` 5-tuple; `G.cardStats[id].cost`.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; engine + server + arena-client tests + gates green.

## Locked Values (do not re-derive)
- New primitive: `'give-hq-hero-each-player'` (append-only, D-24034; union+array lockstep; count 19 → 20). No-param marker `[effect:give-hq-hero-each-player]`; parser via the generic terminal no-param branch.
- **Card marked (1):** `core/skrulls/paibok-the-power-skrull` Fight line only (co2e twin OUT).
- Pending type `PendingGiveHqHeroChoice { choiceType: 'give-hq-hero'; playerID: string }`; `G.pendingGiveHqHeroChoices?: PendingGiveHqHeroChoice[]` (FIFO, lazy, runtime-only).
- Resolve move `resolveGiveHqHeroChoice({ G, playerID }, { cardId })` + `hasPendingGiveHqHeroChoice(G)`; registered `client: false`, NOT in `CORE_MOVE_NAMES`; **`game.test.ts` move count 27 → 28** (sorted list + count + comment ledger).
- Handler `villainEffectGiveHqHeroEachPlayer` (`onFight`): non-current players FIRST (sorted) auto-gain highest-cost HQ Hero (`G.cardStats[id]?.cost ?? 0`, ties → **rightmost**) → discard + `refillHqSlot`; THEN current player — park when ≥ 2 HQ Heroes, auto-gain when exactly 1, no-op when 0. Keyword-less → `pushLog` self-narrate.
- Bot: `ai.legalMoves` returns exactly `[{ name: 'resolveGiveHqHeroChoice', args: { cardId: <highest-cost HQ Hero> } }]` when `hasPendingGiveHqHeroChoice`.
- UIState `UIPendingGiveHqHeroChoice { choiceType: 'give-hq-hero'; playerID; eligible }`; `eligible` recomputed from the **public** `G.hq` (no hand-leak redaction; still per-chooser).

## Guardrails
- Union + array lockstep (append-only, D-24034); drift test bumped + non-vacuous negative (a phantom primitive FAILS the guard).
- **Ship atomically:** block-all guard + UIState build/type/filter projection + client prompt in the SAME PR — an engine `pending*` block without a prompt is a hard-freeze (`project_pending_choice_no_ux_freeze`).
- Add `hasPendingGiveHqHeroChoice` following the **newest D-24301 `returnOnDiscard` convention**: the 9 core sites (`game.ts`, `moves/coreMoves.impl.ts`, `moves/recruitHero.ts`, `moves/fightMastermind.ts`, `moves/fightVillain.ts`, `moves/playFromUndercover.ts`, `moves/healWounds.ts`, `moves/dodgeCard.ts`, `simulation/ai.legalMoves.ts`) + the new resolve move's own guard. Do **NOT** add it to the older `optionalKoReward`/`scryKoChoice` resolve-move cross-guards or to `villainDeck/villainDeck.reveal.ts` (grepping `hasPendingKoHeroChoice` — the 12-file convention — would hit those and FAIL the scope-lock).
- Board-Visible Field Rule (5 steps): declare in `uiState.types.ts`, populate in `buildUIState`, **pass through `filterUIStateForAudience`**, add a filter test, and **verify it appears in the Play Diagnostics `uiStateSnapshot`** (canonical step 5) — plus the client-render check — a missed filter arm silently drops the prompt.
- Selection is deterministic: highest-cost, rightmost tie — NEVER `ctx.random`. Non-current players resolve BEFORE the current player (sorted), so the human picks from the remaining HQ.
- Gain → recipient's `discard` (D-24327), never victory; HQ slot refilled via `refillHqSlot` (FIFO `G.heroDeck` shift; `null` on empty).
- Moves never throw: `resolveGiveHqHeroChoice` with a `cardId` not in the HQ is a silent no-op. Only `Game.setup()` may throw.
- Net-new primitive → `{ "wp": "WP-532", "decision": "D-24343" }` provenance row; ewiki vocab + pending-choice list updated.

## Required `// why:` Comments
- The current-parks/others-auto split: D-24343 / D-24284 — the fighting player picks interactively; every other player (and a bot-driven current player) auto-picks highest-cost. This is the operator-locked reading (the human picks their own Hero; bot allies get highest-cost), NOT an engine limitation — a current-player-multi-pick rendering was available on the same queue but deliberately not taken.
- Non-current-first ordering: D-24343 — others resolve before the current player parks, so the human picks from the HQ that remains (single deterministic sequence).
- Gain → discard: D-24327 — "gain" routes to the recipient's discard, never victory.
- Highest-cost + rightmost tie: D-24343 — mirrors `captureHeroFromHq`/`selectHqHeroIndexByTraitHighestCost` selection determinism.
- Each new block-all guard site + the `ai.legalMoves` short-circuit: why the new `pending*` freezes the board and how the bot drains it.

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}`, `setup/villainAbility.setup.{ts,test.ts}`, `villain/villainEffects.execute.{ts,test.ts}`, `types.ts`, `moves/giveHqHeroChoice.resolve.ts` **new** + `.test.ts`, `game.{ts,test.ts}`, the block-all guard sites (D-24301 9-site convention: `moves/coreMoves.impl.ts`, `moves/recruitHero.ts`, `moves/fightMastermind.ts`, `moves/fightVillain.ts`, `moves/playFromUndercover.ts`, `moves/healWounds.ts`, `moves/dodgeCard.ts` — **not** `optionalKoReward`/`scryKoChoice` resolve moves, **not** `villainDeck/villainDeck.reveal.ts`), `simulation/ai.legalMoves.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `ui/uiState.{types,build,filter}.ts` + uiState build/filter tests — **modified/new**
- Server: `apps/server/src/autoplay/botLoopProgress.mjs` + `apps/server/src/bot-ally/botAllyDriver.mjs` + their `.test.ts` — **modified**
- Client: `apps/arena-client/src/components/play/PendingGiveHqHeroChoicePrompt.vue` **new** + `.test.ts`, `pages/PlayDesktop.vue` + `PlayMobile.vue` (mount + block-all gate), `useTurnActions` / `TurnActionBar` gate mirror if the other `pending*` flags are threaded there — **modified**
- Data/tooling: `apply-effect-markers.mjs` + `scripts/convert-cards/inputs/villain-effect-markers.json` (Paibok Fight row — the `MARKER_MAP_PATH` the script reads) + `data/cards/core.json` regen + `villain-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` + `mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md` + `wiki/villain-deck.md`
- Governance: DECISIONS (D-24343), NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (handler each-player + park/auto/no-op + resolve + drift + parse + move-count 28)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` 0; arena-client test pass (prompt render/submit + block-all gate)
- [ ] `pnpm --filter @legendary-arena/server test` pass (bot loops drain the new pending move)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0; `check:wiki` + `wiki-viewer:check-links` 0
- [ ] `git diff --name-only` = allowlist
- [ ] `pendingGiveHqHeroChoice` appears in the Play Diagnostics `uiStateSnapshot` for the chooser (Board-Visible Field step 5)
- [ ] Paibok (core) Fight flips unmarked → executable with `{ WP-532, D-24343 }`; no `no-handler`
- [ ] Hashed oracles (`finalStateHash`/`PRE_WP080`/sentinel) UNCHANGED, or re-recorded via `record-game-fixture.mjs` (never hand-edited) if a fixture fights Paibok
- [ ] D-24343 Active; STATUS updated; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`
- [ ] Live-verify (D-24026): fight Paibok → the fighting human gets a "choose a Hero to gain" prompt; picked Hero enters discard + HQ refills; bot ally gains highest-cost

## Common Failure Smells
- Engine block-all guard added but no client prompt / no filter arm → hard-freeze or blank prompt (ship all three together).
- Gain landed in victory (not discard) → wrong zone (D-24327).
- Non-current players parked (or resolved after the current player) → wrong split/order; only the current player parks, others resolve first.
- Selection used `ctx.random` or lowest-cost → must be deterministic highest-cost, rightmost tie.
- HQ slot left null/stale → missing `refillHqSlot`.
- Move-count drift test still says 27 → forgot the `game.test.ts` bump.
- Bot stalls on Paibok Fight → `PENDING_CHOICE_MOVE_NAMES` / `PENDING_CHOICE_FLAGS` / `ai.legalMoves` not extended.
