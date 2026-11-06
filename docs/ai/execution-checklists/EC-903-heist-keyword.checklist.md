# EC-903 — Heist: "Attempt a Heist", and Heist lines stop granting at play (Execution Checklist)

**Source:** docs/ai/work-packets/WP-865-heist-keyword.md
**Layer:** Game Engine (parser, executor, move, economy, UIState) + arena-client (one button) + curated `amwp` markers
**Risk Tier:** MEDIUM — gameplay logic, a new move and new turn-economy state on G; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `adbe8c14` with the reserve #3171 merged; `pnpm -r build && pnpm -r --no-bail test` and
      `pnpm --filter @legendary-arena/arena-client typecheck` exit 0; record every package's count.
- [ ] Read the models: the EV fusion (`setup/heroAbility.setup.ts` ~l.831–852, ~l.4432, ~l.4636); `heroEffectExcessiveViolence`
      / `fireExcessiveViolencePlays` (`hero/heroEffects.execute.ts` ~l.7116, ~l.7160); the EV ledger + carry
      (`economy/economy.logic.ts` ~l.486–540); `moves/ritualArtifact.ts` + its `game.ts` registration; the
      `excessiveViolenceAvailable` build/filter path; the ritual button in `PlayedCardsRow.vue`.
- [ ] Re-probe the ten lines at HEAD (WP Assumes). If any parse differs from the WP, STOP and reconcile.

## Locked Values (do not re-derive; verify at HEAD)
- `HEIST_LINE_PATTERN = /^\s*(?:\[keyword:Heist\]|Heist):/i`.
- `HEIST_CARDS` → inner `heistEffects`: `amwp/scott-lang-cat-burglar/petty-larceny` → `recruit 2`;
  `…/anything-for-cassie` → `rescue 1`; `…/shocking-support` → `attack 2`; `amwp/wasp/infiltrate` → `attack 3`;
  `amwp/ant-man/tiny-little-risk` → `draw 2`; `amwp/ant-army/up-the-ante` → `draw 1`.
- Honest hollows (`keywords: []`, no effects, `unresolvedMarkers: ['heist']`): `the-big-score` 0, `putting-a-crew-together` 0,
  `x-con-security-van` 0, `revolutionary-anthem` 2.
- Fused hook: `{ cardId, timing: 'onPlay', keywords: ['heist'], effects: [{ type: 'heist', heistEffects }] }`, emitted in the
  per-line loop at the Heist line's own index (never prepended). The `HEIST_LINE_PATTERN` prefix is stripped before
  `parseAbilityText`, so `heistEffects` deep-equals the inner list above and never holds a `'heist'` descriptor.
- `'heist'` joins `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and the handler table (`hero/heroEffects.execute.ts`), and
  `BY_HOOK_KEYWORDS` in `scripts/hero-mechanic-ledger.mjs`.
- Marker entries (appended to `amwp`): `scott-lang-cat-burglar/anything-for-cassie` 1 `[keyword:rescue:1]`;
  `ant-man/tiny-little-risk` 1 `[keyword:draw:2]`; `ant-army/up-the-ante` 0 `[keyword:draw:1]`. Remove the Cassie line-1 and
  `tiny-little-risk` entries from `_deferred`.
- Economy: `heistCrewCards?: CardExtId[]`, `hasAttemptedHeistThisTurn?: boolean`; lazy, omitted when unset, carried with the EV ledger.
- Heist Count = distinct `G.cardStats[id].cost` values > 0 over the active hand + `playedCardIdsStillInPlay(G, inPlay)`
  ("Heroes you have", rules ~l.3439, D-24529). An id without `cardStats` adds nothing; a top card without
  `villainDeckCardTypes` reads 0 VP; both are silent.
- Move: `attemptHeist({ G, playerID, ...context }: MoveContext): void`, player = `context.ctx.currentPlayer`; forward
  `context` to `fireHeistPlays` so inner draws can reshuffle.
- Revealed VP: `villain` → `G.cardVictoryPoints[id] ?? VP_VILLAIN`; `henchman` → `?? VP_HENCHMAN`; `bystander` →
  `VP_BYSTANDER` (all from `scoring/scoring.types.ts`); any other type → 0.
- Availability (`isHeistAvailable`): `main` stage, `!hasAnyPendingChoice(G)`, non-empty `heistCrewCards`, no
  `hasAttemptedHeistThisTurn`, non-empty `G.villainDeck.deck`.
- Log lines (outcome):
  - readied (`applied`): `Player {p} readied {card} for a Heist — its Heist ability fires if a Heist you attempt this turn succeeds.`
  - too late (`blocked`): `Player {p} played {card} after this turn's Heist, so it is too late for its Heist ability.`
  - attempt (`neutral`): `Player {p} attempts a Heist: Heist Count {n} against {revealed card} ({vp} VP).`
  - success (`applied`): `The Heist worked! Player {p} uses {k} Heist abilit{y|ies}.`
  - tie (`blocked`): `The Heist went sideways — Heist Count {n} ties {vp} VP, so nothing happens.`
  - caught (`blocked`), prefix `The Heist failed — Heist Count {n} is lower than {vp} VP`, then by `gainWoundWithOutcome`:
    `'gained'` → `, so Player {p} gains a Wound.`; `'no-wound'` → `, but the Wound supply is empty.`;
    `'diving-block-pending'` → `, so Player {p} must gain a Wound unless they block it.` `woundsDrawn` bumps on the first and
    last, never on `'no-wound'` (the `heroEffectGainWound` convention).
- Emitting the fused hook or the hollow sets `previousLineHook = null` (WP-790), so no later line widen-fuses into it.
- UIState: `economy.heistAvailable?: true`, `economy.heistCount?: number`; active-player-only, absent from
  `REDACTED_ECONOMY`, omitted when unavailable. Client: move `'attemptHeist'`, label `Attempt Heist (Heist Count {n})`.
- Tests (all new cases): `setup/heistFusion.test.ts` (committed `amwp.json` via a `getSet` stub): 6 fusions, 4 hollows,
  Revolutionary Anthem's Antics hook unchanged. `moves/attemptHeist.test.ts`: play through `executeHeroEffects` readies
  without a grant; higher fires in order and leaves the top card; tie no-op; lower gains one Wound; empty Wound supply logs
  the no-wound variant; second attempt, nothing readied, empty Villain Deck, outside `main` and an open choice are no-ops; a
  Heist card played after the attempt is not readied; equal and 0 costs in the count; a hand card's cost counts and a played
  card that left play does not; a missing `cardStats` entry adds nothing; bystander / Scheme Twist / villain VP.
  Plus the filter test (active sees both fields; opponent and spectator see neither), the built-projection keyset pin, the
  `game.test.ts` registration, and the client `PlayedCardsRow` render + dispatch.
- Count pins that move by exactly +1 (read the value at HEAD; WP-866 bumps the same ones): `HERO_KEYWORDS` length in
  `rules/heroKeywords.test.ts` ~l.68, `setup/heroAbility.setup.test.ts` ~l.1604 and the ordered list in `rules/heroAbility.setup.test.ts`
  ~l.596–700; `HERO_EFFECT_HANDLERS` length in `hero/heroEffects.execute.test.ts` ~l.152/~l.8119; `moveNames.length` in
  `moves/recruitSidekick.test.ts` ~l.358; the move count + ordered names in `game.test.ts` ~l.240/~l.278 (`attemptHeist` after `advanceStage`).
- Regen order: apply markers → live-verify rows → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` →
  `pnpm sim:runtime-observed` → `pnpm sim:coverage --update-baseline`.

## Guardrails
- The move's count / reveal / compare uses no `ctx.random.*` (inner effects may reshuffle via the forwarded context); no
  clock, I/O or registry read; moves return void and never throw.
- `attemptHeist.ts` joins the `ritualArtifact.ts` import cycle: read imported bindings only inside function bodies.
- The revealed card never leaves `villainDeck.deck[0]`; no shuffle, draw or reorder. The latch is set before resolution.
- Only the six allowlisted cards fire inner effects; every other Heist line is an effect-less `heist` hollow.
- No `HeroAbilityTiming`, `LOG_OUTCOMES`, `CORE_MOVE_NAMES`, `getLegalMoves` or bot-policy change.
- Core sentinel / `finalStateHash` / PAR / sim pins do not move; a moved pin is a STOP, never a re-pin.
- `data/cards/amwp.json` changes only via `apply-hero-ability-markers.mjs`; no existing test is weakened. The only pin
  literals edited are the listed +1 count pins, and the `EC-903:` commit body says why.
- No `.reduce()`, no nested ternaries; JSDoc on every function; full-sentence log and error text.

## Required `// why:` Comments
- `HEIST_CARDS` / `HEIST_LINE_PATTERN` (the Honest-Partial allowlist; plain `Heist:` and `[keyword:Heist]:` both match), and the
  non-allowlisted hollow branch (it stops the play-time payout).
- `heroEffectHeist` (enrol only); `fireHeistPlays` (readying order stands in for "in any order").
- `attemptHeist`: the latch before resolution, the "Heroes you have" pool (D-24529), the VP rule and its fallback residual, why
  the revealed card stays on top, and the context forwarding.
- The `game.ts` registration (non-core, `client: false`, not in `getLegalMoves`, so bots never Heist) and the filter pass-through.

## Files to Produce
- Engine: `packages/game-engine/src/rules/{heroKeywords,heroAbility.types}.ts`, `setup/heroAbility.setup.ts`,
  `hero/heroEffects.execute.ts`, `economy/{economy.types,economy.logic}.ts`, `moves/attemptHeist.ts` (**new**), `game.ts`,
  `ui/{uiState.types,uiState.build,uiState.filter}.ts`. `index.ts` is NOT modified.
- Client: `apps/arena-client/src/components/play/{uiMoveName.types.ts,PlayedCardsRow.vue}`, `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue`.
- Data: `scripts/convert-cards/inputs/hero-ability-markers.json`, `data/cards/amwp.json` (generated),
  `scripts/hero-mechanic-ledger.mjs` (`BY_HOOK_KEYWORDS`).
- Generated: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/{effect-implementation-index,card-mechanics}.json`,
  `docs/ai/coverage/{runtime-observed-hollows,live-verify}.json`, `scripts/coverage/{hero-effect-coverage.baseline,mechanic-provenance}.json`,
  the `apps/dashboard/src/data/*` copies, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (only if its pin moves).
- Tests: new `moves/attemptHeist.test.ts`, `setup/heistFusion.test.ts`; the six pin files above; `economy/economy.logic.test.ts`,
  `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts`; client `PlayedCardsRow.test.ts`, `PlayDesktop.test.ts`, `PlayMobile.test.ts`.
- Close: `docs/ai/DECISIONS.md` (D-24808), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`.

## After Completing
- [ ] `apply-hero-ability-markers.mjs --validate`, `pnpm cards:check`, `pnpm cards:count-markers:check`: 0.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0; feeds 0 (`ledger:heroes:check`, `effect-index:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`).
- [ ] Dashboard `prebuild:coverage` then `test:coverage` 0; `ledger:numbers:check` and `workindex:rows:check` 0.
- [ ] If WP-866 (#3173, Infiltrate's extra draw) landed first: rebase, re-run the whole regen chain, and re-read the count pins.
- [ ] `git diff --name-only origin/main` ⊆ Files to Produce; five-step UIState contract met (Play Diagnostics snapshot checked).
- [ ] D-24808 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED;
      D-24026 live-verify recorded as operator-pending with the `live-verify.json` rows.

## Common Failure Smells
- Infiltrate still grants +3 at play: the fusion did not consume line 2, or the allowlist key is wrong.
- The Big Score still grants +4: the non-allowlisted branch missed plain `Heist:` lines.
- The button never shows: `heistAvailable` is built but not passed through `filterUIStateForAudience`.
- An attempt changes the Villain Deck: the reveal used the reveal pipeline instead of reading `deck[0]`.
- Playing Infiltrate never readies it: `'heist'` is missing from `NO_MAGNITUDE_KEYWORDS`.
