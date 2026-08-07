# EC-541 — Core Magneto Tactic "Crushing Shockwave" onFight Resolver (Execution Checklist)

**Source:** docs/ai/work-packets/WP-506-magneto-tactic-crushing-shockwave.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` @ `7dbebf94`. Record the observed engine-suite
      pass count before editing; if it moved, re-record — do not force it.
- [ ] Confirm the framework is landed: `dispatchTacticOnFight(G, ctx,
      defeatedTacticId)` in `rules/tacticHandlers.ts`, wired as the final step
      of `defeatMastermindTacticCore` (`moves/fightMastermind.ts`), firing on
      `ctx.currentPlayer`. **WP-497 must be on `main`.** If absent, STOP.
- [ ] Confirm the dispatch key: core Magneto Crushing Shockwave resolves to
      `core-mastermind-magneto-crushing-shockwave` (card slug
      `crushing-shockwave`, `data/cards/core.json`; grammar
      `${setAbbr}-mastermind-${slug}-${tacticSlug}`, `mastermind.setup.ts:240`).
- [ ] Read the sibling `resolveCo2eMagnetoStrike` (`rules/mastermindHandlers.ts`)
      — the reveal/penalty + `gainWound` pattern this mirrors. Do NOT export
      from or modify `mastermindHandlers.ts` (inline the two checks here).

## Locked Values (do not re-derive)
- `MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID = 'core-mastermind-magneto-crushing-shockwave'`
  (its own named constant in `tacticHandlers.ts`).
- `SHOCKWAVE_WOUND_COUNT = 2` (the printed "two Wounds").
- `TEAM_X_MEN = 'x-men'` — the normalized lowercase `G.cardTraits?.[extId]?.team`
  slug (matches `mastermindHandlers.ts` verbatim).
- Defeating player = `ctx.currentPlayer` (narrow `ctx` via `unknown`, as
  `dispatchTacticOnFight` already does — no `boardgame.io` import).
- Scope = **each OTHER player**: iterate `Object.keys(G.playerZones).sort()`,
  **skip `currentPlayer`**.
- Wound gain via `gainWound(G.piles.wounds, playerDiscard)` from
  `board/wounds.logic.ts` (pure/non-mutating; empty pile = no-op). The two
  calls **thread**: assign the returned `woundsPile` + `playerDiscard` back
  after the first call so the second reads the updated arrays (a second call
  against the original pile nets only ONE Wound). Detect the per-call no-op by
  the returned `woundsPile.length` dropping (mirrors `gainWoundToDiscard`).
- Log lines use the `tacticHandlers.ts` prose prefix `Fight effect: …` (as the
  Octet resolver does), NOT the `[… Master Strike]` bracket form — one line per
  affected other player, default `neutral` outcome (`pushLog` with no outcome arg).

## Guardrails
- Never throws — the dispatch stays a silent no-op for any unhandled id.
- **Skip the defeating player** — `currentPlayer` gets no reveal check, no Wounds.
- **Reveal is a no-op mutation** — an X-Men holder loses nothing, only a log line.
- **At most two Wounds** per penalized player; on a supply shortfall gain the
  available count and log it — never throw, never substitute another card.
- Team read is defensive: `G.cardTraits?.[extId]?.team === 'x-men'` (legacy
  states predate WP-179). Wounds carry no team and never match.
- No RNG, no wall-clock, no I/O; no `.reduce()`; no new zone / `RuleEffect` /
  move / phase / `G` field; no layer crossing; no `boardgame.io` or registry
  import in `tacticHandlers.ts`.
- Do NOT touch `mastermindHandlers.ts`, `resolveMagnetoStrike`, or
  `MAGNETO_HAND_SIZE_LIMIT` (a different mastermind mechanic; one mastermind
  per match — no interaction).
- Determinism gates binary: sentinel `finalStateHash`, `PRE_WP080_HASH`, and
  `sim:runtime-observed:check` pass with **no regeneration** — no committed
  fixture defeats a Magneto tactic, so **no re-pin is expected**; drift = STOP,
  never blind-re-pin.

## Required `// why:` Comments
- `SHOCKWAVE_WOUND_COUNT = 2` — the printed "gains two Wounds", distinct from the
  co2e-Magneto strike's single Wound.
- Skip-`currentPlayer` — the printed "each OTHER player" (a tactic Fight is the
  defeating player's reward against the others; unlike a Master Strike, which
  hits every player).
- Reveal branch is mutation-free — an X-Men holder reveals and loses nothing
  (mirrors the Master Strike reveal branch); deterministic auto-resolve is
  player-optimal so no fidelity is lost (D-24312 / D-24192 precedent).
- Supply-shortfall path — fewer Wounds than needed is a logged no-op, moves
  never throw.

## Files to Produce
- `packages/game-engine/src/rules/tacticHandlers.ts` — **modified** —
  `+ resolveCrushingShockwave` + `MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID` +
  `SHOCKWAVE_WOUND_COUNT` + `TEAM_X_MEN` + a `dispatchTacticOnFight` branch.
- `packages/game-engine/src/rules/tacticHandlers.test.ts` — **modified** —
  AC-1..AC-6/AC-8: dispatch fires; other-player-no-X-Men gains 2 Wounds;
  other-player-with-X-Men reveals (0 Wounds); defeating player untouched;
  supply-shortfall gives available count + logs; unknown id no-op.
- Governance: `docs/ai/DECISIONS.md` (D-24312 Drafted→Active, edit in place);
  `WORK_INDEX.md` checkbox; `EC_INDEX.md` status; `docs/05-ROADMAP-MINDMAP.md`
  `📝`→`✅` + `pnpm roadmap:counts:write`; `docs/ai/STATUS.md` close-out.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `pnpm -r build` 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 — baseline + new
      tests; record the delta.
- [ ] Control run: stub `resolveCrushingShockwave` to no-op → the two-Wounds /
      reveal / skip-defeater assertions FAIL (non-vacuous); restore.
- [ ] `pnpm sim:runtime-observed:check` 0, **no regeneration**; sentinel
      `finalStateHash` + `PRE_WP080_HASH` byte-identical.
- [ ] `git diff --name-only` on STAGED = the two-file allowlist + governance
      (CRLF-only unstaged diff is not a violation).
- [ ] D-24312 Active; `WORK_INDEX` + `EC_INDEX` flipped with date; mindmap `✅`
      + counts refreshed; `STATUS.md` updated.
- [ ] D-24026 live-verify (operator-pending): a deployed Magneto match where
      defeating Crushing Shockwave gives each other X-Men-less player two Wounds
      + the Fight log lines show.

## Common Failure Smells
- The defeating player takes Wounds → the `currentPlayer` skip is missing or
  mis-scoped.
- A penalized player gains 1 or 3 Wounds → wrong loop bound; must be exactly 2,
  clamped by supply.
- An X-Men holder still gains Wounds → the team read is wrong (case, wrong field,
  or missing `?.`).
- A determinism gate regenerates → a fixture path reached the resolver (no
  committed fixture defeats a Magneto tactic); investigate, never re-pin.
- Any diff to `mastermindHandlers.ts` → the two checks were exported instead of
  inlined; revert and inline.
