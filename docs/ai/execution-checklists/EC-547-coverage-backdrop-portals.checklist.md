# EC-547 — Recover Runtime-Observed Coverage: Portals Backdrop + Termination Guard

**WP:** WP-512 · **Layer:** Shared Tooling (sim scripts) + coverage artifact +
Dashboard test · **Baseline:** `origin/main` @ `3a51b63d` · **Lane:** Standard
two-session.

This EC is the authoritative execution contract for WP-512. The WP is the design
authority; on conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off `3a51b63d`.
- [ ] WP-511 / D-24322 merged (both backdrops currently Cosmic Cube; dashboard test
      pins `totalObs 163` / `percentResolved 36.2`).
- [ ] `pnpm -r build` (scripts import the compiled engine + registry dist).
- [ ] Read `scripts/runtime-observed-hollows.mjs` (`SENTINEL_CORE`, the `harvest`
      `aggregateCell`, `assertHarvestLoaded`, `ProbeFailure`), `scripts/coop-winrate.mjs`
      (`MATCH_CONFIGURATION`), and `apps/dashboard/src/composables/useInPlayCoverage.test.ts`.

## Locked Values (do not re-derive)

- Backdrop scheme (both harnesses): **`core/portals-to-the-dark-dimension`**.
- Regenerated artifact: **`distinctMechanics: 12`**, **`totalObservations: 125`**,
  **`gamesPlayed: 312`**, **`hollowEffectsDropped: 0`**; new mechanics **`rooftops`
  + `streets`** present.
- Dashboard pins: **`totalObs === 188`**, **`percentResolved === 31.4`**,
  **`resolvedObs === 59`** (unchanged), `remaining.length > 0`.
- `SEEDS_PER_BOARD` stays **8**; `MAX_TURNS` stays **50**.
- Termination signal: **`cell.endgameReached === false`** ⇒ a turn-cap game ⇒ throw
  (the purpose-built flag on the sweep cell; equivalently `cell.outcome.winner ==
  null` — `EndgameOutcome` is never null, a tie is `'tie'`, so no false-positive on
  ties). Prefer `endgameReached` (self-documenting).
- `in-play-hollow-baseline.json` stays at its **140** high-water (NOT rebuilt).

## Guardrails

- [ ] **No `packages/**` change** — Portals loses via the existing
      `MVP_SCHEME_TWIST_THRESHOLD = 7` fallback. Adding a `SCHEME_TWIST_CONFIGS`
      entry is OUT (needs a `resolverId`; zero behavioral gain). `git diff
      --name-only` shows zero `packages/` files.
- [ ] The artifact is **regenerated** via `pnpm sim:runtime-observed`, never
      hand-edited; serializer untouched.
- [ ] The termination guard reuses the file's `ProbeFailure` / exit-2 idiom; reads
      `cell.outcome.winner` only; no engine read; no `.reduce()`.
- [ ] Dashboard pins are **read from the regenerated artifact**, not guessed; the
      `resolvedObs` stays 59; `in-play-hollow-baseline.json` is NOT rebuilt.
- [ ] `SEEDS_PER_BOARD` / `MAX_TURNS` unchanged — do NOT bump seeds to chase 16
      (Portals plateaus at 12).

## Required Comments (`// why:`)

- [ ] In `runtime-observed-hollows.mjs` `SENTINEL_CORE`: why Portals is the backdrop
      (faithful "Twist 7: Evil Wins!" loss via the MVP fallback; non-polluting; no
      engine config) — replacing the WP-511 Cosmic Cube block.
- [ ] In `runtime-observed-hollows.mjs` at the guard: why a game that did not reach
      endgame (`endgameReached === false`) is a non-termination that must fail loudly
      (the WP-511 silent-timeout lesson).
- [ ] In `coop-winrate.mjs` `MATCH_CONFIGURATION`: why Portals (shared sentinel;
      0% win-rate is backdrop-independent, a Bot-Ally-epic concern).

## Files to Produce (allowlist — 4 code/artifact + governance)

- [ ] `scripts/runtime-observed-hollows.mjs` — backdrop `schemeId` → Portals;
      Portals rationale comment; **fix stale "16" header comments** — change only the
      two **mechanic-count** "16" tokens (matrix comment + `SEEDS_PER_BOARD`
      comment) → 12; **leave the seed-count list "8, 16, and 24 seeds" intact** (do
      NOT blanket-replace 16); **add the deterministic-termination guard** (count
      `cell.endgameReached === false` games in `harvest`; throw `ProbeFailure` if any).
- [ ] `scripts/coop-winrate.mjs` — `MATCH_CONFIGURATION.schemeId` → Portals; **fully
      rewrite** the scheme-substitution comment (~lines 54–64) — it is currently
      **doubly stale**, still narrating the WP-452/EC-487 swap to *Legacy Virus*
      though the value is now Cosmic Cube. Replace the whole block, do NOT append.
- [ ] `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated** (12 / 125 /
      312 / 0).
- [ ] `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — pins 163→188,
      36.2→31.4 (resolvedObs 59) + WP-512 comment.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24323 Active,
      mindmap `✅` + `roadmap:counts:write`, `STATUS` close-out, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm -r build` → 0; `pnpm sim:runtime-observed` prints `12 distinct
      mechanic(s); 125 observation(s); dropped 0`.
- [ ] `pnpm sim:runtime-observed:check` → `OK` in ~seconds (no timeout).
- [ ] Control-trip: force a `winner == null` cap-hit (or a non-terminating backdrop)
      → harness throws `ProbeFailure` (exit 2). Restore.
- [ ] `node apps/dashboard/scripts/build-coverage-ledger.mjs`; `node --import tsx
      --test apps/dashboard/src/composables/useInPlayCoverage.test.ts` → green on
      188 / 31.4.
- [ ] `pnpm sim:coop-winrate` runs on Portals (real games; no turn-0 auto-loss, no
      turn-cap).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace).
- [ ] `git diff --name-only` = the 4-file allowlist + governance; **zero
      `packages/`**.
- [ ] Two-commit topology: `EC-547:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Hand-editing the artifact JSON instead of regenerating (breaks `:check`).
- Bumping `SEEDS_PER_BOARD` to chase 16 (Portals plateaus at 12 — wasted CI time).
- Adding a `SCHEME_TWIST_CONFIGS` / `schemeTwistConfig.types.ts` entry for Portals
  (out of scope — the fallback already loses at 7).
- Rebuilding `in-play-hollow-baseline.json` (it is a 140 high-water reference).
- Forgetting the dashboard build-time copy regen before running its test, then
  mis-reading the pin failure.
