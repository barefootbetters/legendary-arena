# EC-761 — Split / dual-faced hero "choose a side": engine + setup (Execution Checklist)

**Source:** docs/ai/work-packets/WP-724-split-hero-choose-a-side-engine.md
**Layer:** Game Engine + Setup

## Before Starting
- [ ] `pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline count)
- [ ] Confirm on `main`: `heroCardInstanceExtIds` (buildHeroDeck.ts) still collapses to `sides[0]` (L~479);
      the four sibling maps (`cardStats` / `heroAbilityHooks` / `cardDisplayData` / `cardTraits`) key off the
      instance ext_id; `buildTransformTargets` + `heroEffects` strip-`#copyIndex` idiom present.
- [ ] EXACT target file set = `## Files to Produce` below; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- ext_id grammar UNCHANGED: `<setAbbr>/<heroSlug>/<cardSlug>#<copyIndex>` (D-13502). Alternate face =
  `<setAbbr>/<heroSlug>/<sides[1]>#<copyIndex>`.
- `PendingSplitFaceChoice = { playerID: string; sourceCardId: CardExtId; faceA: CardExtId; faceB: CardExtId }`.
- `G.pendingSplitFaceChoices?: PendingSplitFaceChoice[]` — FIFO, lazy-init, **never** in `Game.setup()`.
- `G.splitFaces?: Record<CardExtId, CardExtId>` — copy-agnostic base(sides[0]) → alternate(sides[1]),
  setup-built, immutable.
- `resolveSplitFaceChoice({ face: 'a' | 'b' })` — server-only (`client: false`).
- `UIPendingSplitFaceChoice = { playerID; faceA: UISplitFaceOption; faceB: UISplitFaceOption }`,
  `UISplitFaceOption = { extId; name; abilityText?; cost: number|null; attack: number; recruit: number }`,
  chooser-redacted.
- Drift: moves count **+1** (RUNTIME assertion, `game.test.ts`). `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS`
  counts UNCHANGED (no keyword / handler added).

## Guardrails
- `G.heroDeck` composition is byte-unchanged — reservoir = **primary-face instances only**; alternate faces
  go ONLY into the sibling maps + `G.splitFaces`. Pin the copy count in a test.
- Split is **structural** (`sides.length === 2`), detected at setup — NOT a `[keyword:…]` marker; no new
  `HeroKeyword`, no new `HeroEffect` handler.
- On play, a split instance grants NO economy and fires NO ability until `resolveSplitFaceChoice` — economy +
  ability resolve against the CHOSEN face ext_id (Transform strip-and-map precedent).
- Choice is active-player-scoped (D-24284); block-all guard on EVERY action move + the sim short-circuit.
- Moves never throw; invalid / wrong-player / empty-queue → silent no-op. Randomness via `ctx.random.*` only.
- No `data/cards/*.json` change (both faces already authored); no registry schema change.
- Drift/guard tests non-vacuous: stubbing the alternate-face emit must FAIL the both-faces-present assertion.

## Required `// why:` Comments
- The play-time split-detection branch in `playCardCore` — why economy/ability are deferred until the choice.
- The `resolveSplitFaceChoice` swap — why the inPlay ext_id is relabelled to the chosen face (Transform idiom).
- `buildSplitFaces` — why the map is copy-agnostic (both faces share the copy index).
- The `heroDeck`-primary-only filter — why alternate-face instances are excluded from the reservoir (D-14102).
- Any state-hash inclusion/exclusion of `splitFaces` / `pendingSplitFaceChoices` — why it matches its sibling.

## Files to Produce
- `packages/game-engine/src/setup/buildHeroDeck.ts` — **modified** (both-face emit + `buildSplitFaces`)
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** (both-face `buildCardStats`)
- `packages/game-engine/src/setup/buildCardDisplayData.ts` — **modified** (alternate-face display)
- `packages/game-engine/src/setup/buildCardTraits.ts` — **modified** (alternate-face traits)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (both-face hooks)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** (`splitFaces` + pending-queue init)
- `packages/game-engine/src/types.ts` — **modified** (`PendingSplitFaceChoice` + two `G` fields)
- `packages/game-engine/src/moves/splitFaceChoice.resolve.ts` — **new**
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** (play-time park + block-all ×3)
- `packages/game-engine/src/moves/{fightVillain,fightMastermind,recruitHero,recruitOfficer,dodgeCard,healWounds}.ts`
  — **modified** (block-all guard)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** (block-all guard)
- `packages/game-engine/src/game.ts` — **modified** (register move + guard)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (chosen-face dispatch if needed)
- `packages/game-engine/src/versioning.migrate.ts` — **modified** (two new fields)
- `packages/game-engine/src/simulation/{ai.legalMoves,simulation.runner,par.aggregator}.ts` — **modified** (sim dispatch)
- `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts` — **modified** (projection + filter)
- `packages/game-engine/src/index.ts` — **modified** (re-export)
- `packages/game-engine/src/moves/splitFaceChoice.resolve.test.ts` — **new**
- `packages/game-engine/src/{game,setup/buildHeroDeck,economy/economy.logic,setup/heroAbility.setup,setup/buildCardDisplayData}.test.ts`
  — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (moves-count pin +1; `heroDeck` copy-count pin green)
- [ ] `pnpm sim:runtime-observed:check` exits 0 (artifact byte-current)
- [ ] `finalStateHash` sentinel pin green + byte-identical (core-2p-Doom plays no split hero — CONFIRM; honest
      re-pin ONLY if a committed split-hero fixture is added, and then investigate WHY before regenerating)
- [ ] `git diff --name-only` = the allowlist; no `data/cards/*.json`
- [ ] `docs/ai/STATUS.md` updated (engine resolves a chosen split face; picker is WP-725)
- [ ] `docs/ai/DECISIONS.md` — D-24545 + D-24546 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-724 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-724 node `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- A blank scheme-tile-style regression on split cards → a sibling map (esp. `buildCardDisplayData` §1b, which
  does its OWN walk) was not given the alternate-face pass.
- Deck size doubled for a split hero → the reservoir picked up alternate-face instances (the primary-only
  filter was missed).
- The board freezes on playing a split card → the block-all guard is missing from one action move, or the sim
  MOVE_MAP / short-circuit was not updated (the WP-719 three-site lockstep).
- `finalStateHash` shifts unexpectedly → an alternate-face entry leaked into a hashed surface for the sentinel,
  or `splitFaces`/`pendingSplitFaceChoices` was included in the hash unlike its sibling.
