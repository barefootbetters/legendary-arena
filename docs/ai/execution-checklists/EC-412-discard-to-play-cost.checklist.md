# EC-412 — `discard-to-play` Hero Card Cost (Execution Checklist)

**Source:** docs/ai/work-packets/WP-383-discard-to-play-cost.md
**Layer:** Game Engine + Arena Client + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `aaaa5c95` (or later); working tree clean, synced.
- [ ] D-24139 landed: `return-zero-cost-discard` end-to-end (pending type + park + resolve move + UIState projection + `ReturnZeroCostDiscardPrompt.vue`). **This WP mirrors it.**
- [ ] `applyCardPlay` (`coreMoves.impl.ts`) commit order: append `inPlay` → add base attack/recruit → fire hero abilities LAST. Confirm the pre-commit precondition inserts AFTER the block-all guards and BEFORE the hand removal.
- [ ] Keyword substrate: `HeroKeyword` union + `HERO_KEYWORDS`; generic 2-segment `[keyword:X:N]` parser arm; marker pipeline.
- [ ] `pnpm -r build` 0; engine test + arena-client typecheck + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.

## Locked Values (do not re-derive)
- New keyword: `'discard-to-play'` (a play-cost prerequisite, NOT an onPlay reward).
- Marker token: `[keyword:discard-to-play:<n>]`, `n` = cards to discard.
- **Cards marked (5, all `n=1`, abilityIndex 0):** core/cyclops/determination, core/cyclops/optic-blast, ssw2/ruby-summers/heir-to-legends, vill/juggernaut/runaway-train, xmen/havok/unleash-havok → `[keyword:discard-to-play:1]`.
- **Deferred to `_deferred`:** ssw2/ruby-summers/extinction-blast (*"discard three cards"*, `n=3`) — multi-prompt resolve UX out of scope.
- Pending shape: `PendingDiscardToPlay { playerID, sourceCardId, remaining }`; queue `G.pendingDiscardToPlay?: PendingDiscardToPlay[]` (FIFO, lazy-init, never seeded).
- Resolve move: `resolveDiscardToPlay`, args `{ cardId }`, `client: false` (D-10008).
- Precondition (pre-commit, in `playCard`): payable iff `hand.length ≥ n + 1` (played card still in hand).

## Guardrails
- The precondition MUST run BEFORE commit — an unpayable play grants NO base power (return void; a `G.messages` line records the block). Test the last-card-in-hand no-op explicitly (this is the whole point — the power must not leak).
- Base power is granted at commit (payability pre-guaranteed); the mandatory discard resolves via the prompt. No decline shape.
- KO/discard target = the chooser's HAND only (not discard, unlike D-24139). Eligible list recomputed via the IMPORTED `getEligibleDiscardToPlayCards` in the UIState build (round-trip rule).
- Add `hasPendingDiscardToPlay(G)` to the block-all guard on EVERY action move (drawCards/playCard/endTurn in coreMoves.impl.ts + recruitHero/fightVillain/fightMastermind/healWounds/dodgeCard/playFromUndercover) AND the `game.ts` cleanup guard. Missing one = a legal move leaks past the pending choice.
- `ai.legalMoves.ts`: add `resolveDiscardToPlay` to `SIMULATION_MOVE_NAMES` AND the forced-resolve short-circuit (return exactly that move while pending).
- Keyword in BOTH union AND `HERO_KEYWORDS`; handler in BOTH `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`. Move in `game.ts` moves block + `game.test.ts` move-set list + count.
- No `.reduce()` in the hand scan; `PendingDiscardToPlay` JSON-serializable.
- **Sim-outcome cascade:** marking these cards changes the balance sweep (plays now cost a discard) → regen mechanics:metadata + ledger:heroes + runtime-observed. Sentinel `finalStateHash` + `PRE_WP080_HASH` re-pin ONLY if a recorded fixture plays a marked card — canonical record tool, never hand-edit; investigate WHY first.
- **UIState field add → arena-client fixture backfill** (documented recurrence); re-export any new UIState type in `index.ts`.

## Required `// why:` Comments
- `playCard` precondition: D-24185 — first card-specific pre-commit veto; unpayable play grants no power (the bug being fixed).
- park handler: D-24184 — payability pre-guaranteed by the precondition, so no re-check here.
- resolve move front-of-queue + hand-membership recompute (round-trip rule).
- `heroKeywords.ts` entry: D-24184 — mandatory discard-to-play cost.

## Files to Produce
- Engine: `heroKeywords.ts`, `types.ts`, `coreMoves.impl.ts`, `heroEffects.execute.ts`, `resolveDiscardToPlay.ts` (**new**), `game.ts`, the 6 block-all-guard move files, `ai.legalMoves.ts`, `uiState.{types,build,filter}.ts` — **modified/new**
- Engine tests: `resolveDiscardToPlay.test.ts` (**new**), `game.test.ts`, `heroKeywords.test.ts`, `heroAbility.setup.test.ts`, `heroEffects.execute.test.ts`, `coreMoves.*.test.ts`, `uiState.*.test.ts`, `ai.legalMoves.test.ts`
- Client: `DiscardToPlayPrompt.vue` (**new**), `PlayDesktop.vue`, `PlayMobile.vue`, `useTurnActions.ts` + tests/fixtures
- Data: `inputs/hero-ability-markers.json` [5 rows + 1 `_deferred`] + `data/cards/{core,ssw2,vill,xmen}.json` regen + `data/metadata/card-mechanics.json` + `docs/ai/coverage/*`
- Governance: DECISIONS (D-24184 + D-24185), ARCHITECTURE.md (Move Validation Contract clause), STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test + arena-client typecheck (vue-tsc) + test pass
- [ ] `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts + fixture backfill)
- [ ] D-24184 + D-24185 Active; ARCHITECTURE.md Move Validation Contract clause added; §11/§21 N/A (no HTTP/auth)
- [ ] Live-verify (D-24026, operator, post-deploy): Optic Blast with a spare card → discard prompt; as last card → cannot play (no free attack)

## Common Failure Smells
- Base power leaked on an unpayable play → the precondition ran AFTER commit (must be pre-commit, before hand removal).
- A move slips past the pending choice → a block-all guard is missing on that move.
- `:check` gate red → a derived artifact wasn't regenerated after the marker edit.
- Sentinel hash shifted → a recorded game plays a marked card; re-record, don't hand-edit.
- Drift red → keyword in union but not array, or move in `game.ts` but not `game.test.ts` (or vice-versa), or `ai.legalMoves` not updated.
