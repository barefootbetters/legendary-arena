# EC-570 — Rogue "Copy Powers": Interactive Copy-a-Hero Ability

**WP:** WP-535 · **Layer:** Game Engine + arena-client + Card Data · **Baseline:**
`origin/main` @ `f4200779` · **Lane:** Standard two-session.

Authoritative execution contract for WP-535. The WP is the design authority; on conflict the
WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*` + `.claude/skills/legendary-game-engine/SKILL.md`.

> **CONFIRM Forks 1–4 with the operator before coding** (WP §Design): (1) interactive [rec]
> vs auto; (2) copy = re-fire ABILITY not stats [rec]; (3) dual-class full [covert static +
> copied dynamic] vs simplified [covert-only]; (4) 0-eligible no-op / 1-eligible auto [rec].
> Fork 3 changes whether a new hashed `G` field is added — do NOT guess.

## Before Starting

- [ ] `git pull --ff-only origin main`; WP-532 (give-HQ-Hero pending-choice) + WP-251
      (`HERO_EFFECT_HANDLERS`) + WP-290 (size-changing dual-class) on main.
- [ ] Read the WP §Context surface map, then at source: `heroEffects.execute.ts` (executor
      `:349`, generic-block `:392`, `HANDLED_KEYWORDS` `:80`, `MVP_KEYWORDS` `:184`),
      `heroKeywords.ts` (`:26`/`:69`), `moves/giveHqHeroChoice.resolve.ts` (the pattern),
      `hero/sizeChanging.logic.ts` (`:34`/`:62`), `heroConditions.evaluate.ts` (`:50`/`:59`/`:63`),
      `coreMoves.impl.ts` (play core `:183`, inPlay `:194`; the give-HQ block-all guard lives
      in 8 files — grep `hasPendingGiveHqHeroChoice` for the exact set, RS-4),
      `ai.legalMoves.ts` (`:100`/`:258`), `ui/uiState.{types,build,filter}.ts`, `game.test.ts:136`.

## Locked Values (do not re-derive)

- Card: **`core/rogue/copy-powers`** (cost 5, no printed attack). New keyword **`copy-powers`**.
- Eligible = **`playerZones.inPlay` minus the `copy-powers` ext_id (ALL copies), real Heroes
  only** (exclude S.H.I.E.L.D. starters / Wounds). Excluding the ext_id (not just the one
  instance) neutralizes copy-of-copy recursion when two Copy Powers are played (Finding 5).
- "Copy" = **re-fire** the chosen hero's ability via **`executeHeroEffects(G, fullCtx,
  playerID, chosenHeroId)`** — BOTH re-fire paths (the ≥2 resolve move AND the 1-eligible
  in-handler auto) MUST thread the **random-bearing `MoveContext`** (Findings 3+4), NOT the
  `{G, playerID}`-only shape other resolve moves use.
- The wrapper calls `executeHeroEffects` **DIRECTLY** — it MUST NOT re-invoke `applyCardPlay`,
  re-write `lastPlayEffectsFired`, or re-append `inPlay` (Finding 4 — those belong to
  `applyCardPlay`, off the copy path).
- Dual-class (Fork 3 full): Copy Powers counts as **covert (already baked, `core.json:1139`)
  + the copied hero's class**; write the copied class into the **EXISTING**
  `G.cardSizeChangingClasses` map — **no new `G` field, no `sizeChanging.logic.ts` change**
  (Finding 2). `cardTraits` is NEVER mutated.
- Edge: **0 eligible → no-op** (logged, not "blocked-condition"); **1 eligible → auto**.
- Move `resolveCopyPowersChoice` is `client:false`, NOT in `CORE_MOVE_NAMES`.

## Guardrails

- [ ] New keyword appended to BOTH `HeroKeyword` union AND `HERO_KEYWORDS` array (drift test).
- [ ] The pending choice hits **every** touch-point (a built-but-not-filtered field is
      silently dropped — Board-Visible Field Rule): types field (lazy) · park · `hasPending*`
      · `getEligible*`+`selectDefault*` · resolve move · **block-all guards on EVERY action
      move + advanceStage** · move registration · `game.test.ts` move-count 28→29 ·
      `ai.legalMoves` allow-set + single-move short-circuit · `UIPending*` type · uiState
      **build** · uiState **FILTER pass-through** (chooser-only) · turn-end empty-queue invariant.
- [ ] FIFO queue: append at park; `queue.shift()` front-pop on SUCCESS only; invalid = silent
      no-op leaving the queue intact. Chained pending choices supported (copying a hero whose
      ability itself parks).
- [ ] The one new `G` field (the pending queue) is **lazy-materialized**; the copied class
      reuses the **existing** lazy `cardSizeChangingClasses` map (Finding 2 — no new field) —
      so non-Copy-Powers games keep byte-identical `finalStateHash` + `PRE_WP080_HASH`.
- [ ] Re-fire does NOT re-append the copied hero to `inPlay` (already there) and does NOT
      re-add its base attack/recruit economy (Fork 2 — ability only). `lastPlayEffectsFired`
      not double-counted.
- [ ] Zones store `CardExtId` strings only; the dual-class map is `Record<CardExtId,
      HeroClass[]>` (data-only, no functions/Maps/classes in `G`). No `.reduce()` in
      zone/effect ops. `ctx.random` only via the threaded ctx.
- [ ] Card-data: extend the closed markupToken set (D-21601) for `[keyword:copy-powers]`;
      regen `core.json` + ALL card-data-derived `:check` feeds before push (memory
      `card_data_derived_ci_gates`).

## Required Comments (`// why:`)

- [ ] `copyPowersChoice.resolve.ts`: why the full MoveContext is threaded (copied ability
      may draw via `ctx.random` — unlike other resolve moves); why it writes the copied class
      into the setup-static `cardSizeChangingClasses` at runtime (Finding 2 reuse).
- [ ] the lazy pending-queue `G` field: why lazy (hash-invariance for non-Copy-Powers games).

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] Engine: `heroKeywords.ts`, `heroEffects.execute.ts`, `types.ts`,
      `moves/copyPowersChoice.resolve.ts` (new), `coreMoves.impl.ts`, `game.ts`,
      `simulation/ai.legalMoves.ts`, `ui/uiState.{types,build,filter}.ts` + tests (handler /
      resolve / **exec-ctx: a 1-eligible auto-copied draw-2 actually draws via `ctx.random`**
      / **two-Copy-Powers: no self/other-copy target, no recursion** / ai / uiState
      build+filter / drift + `game.test.ts` count). `sizeChanging.logic.ts` is **NOT touched**
      under the recommended fork (reuses `cardSizeChangingClasses`).
- [ ] **Block-all guard in EACH action-move file (PS-1 — the give-HQ-Hero guard lives in 8
      files, not just `coreMoves.impl.ts`+`game.ts`):** `moves/fightVillain.ts`,
      `moves/fightMastermind.ts`, `moves/recruitHero.ts`, `moves/healWounds.ts`,
      `moves/dodgeCard.ts`, `moves/playFromUndercover.ts` — grep `hasPendingGiveHqHeroChoice`
      for the exact guard-line set (real engine touch-count is ~18-20, not "~15").
- [ ] Card data: `inputs/hero-ability-markers.json` + regen `data/cards/core.json` (+ derived).
- [ ] arena-client: Copy Powers prompt component + `uiMoveName.types.ts` + TurnActionBar +
      play pages + fixtures.
- [ ] NOT touched: other pending choices, Steal Abilities, non-rogue card data.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24345 Active, mindmap
      `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` +
      `pnpm -r --no-bail test` green (record delta).
- [ ] Control-revert non-vacuous: neuter the `copy-powers` parker → copy tests fail; others green.
- [ ] Sentinel + `PRE_WP080_HASH` byte-identical (or deliberate documented re-pin via
      `record-game-fixture.mjs`); `sim:runtime-observed:check` + `ledger:heroes` + card-data
      `:check` current.
- [ ] Two-commit topology `EC-570:` + `SPEC:`; D-24026 live-verify performed or operator-pending.

## Common Failure Smells

- A UIState pending field built but not passed through `uiState.filter.ts` → silent client
  freeze (no prompt).
- Threading `{G, playerID}` into `executeHeroEffects` (missing `ctx.random`) → the copied
  draw crashes / no-ops.
- Forgetting a block-all guard on one action move → the board proceeds mid-pending-choice.
- Re-adding the copied hero's base attack/recruit (Fork 2 is ability-only).
- A non-lazy `G` field → sentinel/PRE_WP080 re-pin churn on every game.
- Forgetting `game.test.ts` move-count / the keyword drift test.
