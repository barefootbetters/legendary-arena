# WP-370 — Player-Count Setup Table (Registry source of truth) + Engine Enforcement; Fix Villain-Deck Bystander Sizing

**Status:** Draft 2026-07-13 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: crosses the Registry → Engine boundary, threads a new argument into two **contract validators** (`matchSetup.validate.ts` engine-side, `setupContract.*` registry-side), and changes villain-deck composition (a determinism / `finalStateHash` surface)). Pairs with **EC** (authored at execution-prep). Reserves **D-24165**, **D-24166** (both land Active at execution).
**Primary Layer:** Registry (the canonical table + its browser-mirror validator) + Game Engine (the authoritative validator + villain-deck setup), fed by Registry data at setup time (the normal Registry → Engine setup-time flow).
**Dependencies:** WP-092 / D-10014 (`validateMatchSetup` + per-field qualified-ID validation); WP-091 / WP-245 (`setupContract` schema/validate + the `playerCount` envelope field); WP-168 / D-16801 + WP-169 / D-16803 / D-16804 (villain-deck composition logic + the scheme `villainDeckBystanderCount` and its `numPlayers` fallback this WP replaces); the registry `CardRegistry` reader surface consumed by `configureGameRegistry`.
**User-Visible Surface:** none directly — infrastructure. The authoritative block it installs is observed downstream (WP-371 lobby rejection, WP-372 loadout-builder warn/export-gate). A wrong-player-count match now **fails loudly at `Game.setup()`** instead of starting with an illegal board; villain decks at 3+ players seed the **correct** in-deck bystander count.

---

## Session Context

The Marvel Legendary rules fix the number of each setup component by **player count**:

| Players | Villain Groups | Henchmen Groups | Villain-Deck Bystanders | Heroes |
|---|---|---|---|---|
| 1 | 1 | 1 | 1 | 3 |
| 2 | 2 | 1 | 2 | 5 |
| 3 | 3 | 1 | 8 | 5 |
| 4 | 3 | 2 | 8 | 5 |
| 5 | 4 | 2 | 12 | 6 |

**Today this table exists nowhere in the codebase.** `playerCount` / `numPlayers` is captured at every layer (loadout builder, lobby, server, engine setup) but **drives none of the composition counts.** Two concrete gaps:

1. **No cross-validation.** `validateMatchSetup` (`packages/game-engine/src/matchSetup.validate.ts:449`, `(input, registry)`) checks field shape, ext-id existence, and the D-24032 supply floors — but never takes `numPlayers` and never checks `villainGroupIds.length` / `henchmanGroupIds.length` / `heroDeckIds.length` against the player count. A 4-player match submitted with 1 villain group, or a 2-player match with 6 heroes, sets up an illegal board silently.
2. **Villain-deck bystander sizing is wrong for 3+ players.** When a scheme does not specify `villainDeckBystanderCount`, `villainDeck.setup.ts:265-267` falls back to `context.ctx.numPlayers` — so at 3 players it seeds **3** bystanders into the villain deck, where the rules require **8** (and 4p→8, 5p→12). This is the pre-existing bug WP-169 / D-16804 flagged as "pending a future per-player-mapping" when it declined to hand-encode player-count-dependent counts; the fallback was left at `numPlayers`.

This WP installs the missing source of truth (in Registry, so every consumer can reach it legally) and wires the authoritative enforcement (in the Engine, which owns setup truth). It is the foundation the two UI WPs consume: **WP-371** (server create-gate + arena-client lobby) and **WP-372** (registry-viewer loadout builder).

---

## Goal

After this session, a single canonical table `PLAYER_COUNT_SETUP` (in `packages/registry`) maps each player count 1–5 to its required `{ villainGroupCount, henchmenGroupCount, villainDeckBystanderCount, heroCount }`, and it is the sole source of truth for those numbers. The Game Engine reads it via the registry object already passed into setup (no cross-import) and **blocks** — throws at `Game.setup()` — when the submitted composition's villain-group / henchman-group / hero-deck counts do not match the table for `ctx.numPlayers`. The villain-deck in-deck bystander fallback reads the table's `villainDeckBystanderCount` for the player count (1/2/8/8/12) instead of `ctx.numPlayers` (scheme-specified counts still override). The registry-side `setupContract` mirror gains the same player-count ↔ composition coupling so browser consumers (WP-372) can surface it without a second copy of the numbers.

---

## User-Visible Impact

No new screen. Two behavior changes that surface through the WP-371 / WP-372 consumers and in live matches:

- A match whose loadout composition does not match its player count **fails to start** with a full-sentence error naming the wrong count (was: started an illegal board).
- A 3-, 4-, or 5-player villain deck (with a scheme that does not fix its own bystander count) now contains the **rules-correct** number of bystanders (8 / 8 / 12), not `numPlayers` (3 / 4 / 5). Players at 3+ see the intended villain-deck density.

---

## Assumes

- **`validateMatchSetup` contract (WP-092 / D-10014):** `packages/game-engine/src/matchSetup.validate.ts` exports `validateMatchSetup(input: unknown, registry: CardRegistryReader): ValidateMatchSetupResult`; it validates the 9-field `MatchSetupConfig` (shape + per-field qualified-ID existence + the D-24032 `COUNT_FIELD_MINIMUMS` supply floors) and **never throws** (returns a structured result). It is called at `packages/game-engine/src/game.ts:244` inside `Game.setup()` — the single engine throw site — as `validateMatchSetup(matchConfiguration, gameRegistry)`.
- **`numPlayers` availability at setup:** `Game.setup()` runs with `ctx.numPlayers` in scope (boardgame.io); `game.ts:201` `validateSetupData(setupData, _numPlayers)` already receives the count (currently ignored, prefixed `_`).
- **Villain-deck bystander sizing (WP-168 / WP-169):** `packages/game-engine/src/villainDeck/villainDeck.setup.ts:265-267` computes `bystanderCount = bystanderFromScheme === null ? context.ctx.numPlayers : bystanderFromScheme` where `bystanderFromScheme = readSchemeBystanderCount(scheme)`. A scheme's own `villainDeckBystanderCount` (D-16803, curated in WP-169) **overrides** and is unaffected by this WP; only the `null`-scheme fallback changes.
- **Registry reader surface:** the object passed to `configureGameRegistry` and thence to `validateMatchSetup` as `gameRegistry` is the registry's `CardRegistry`; the engine describes what it needs from it via the `CardRegistryReader` interface (`matchSetup.validate.ts`). TypeScript **structural typing** lets the engine read a new `playerCountSetup` member off that object without either package importing the other's types.
- **`setupContract` (WP-091 / WP-245):** `packages/registry/src/setupContract/setupContract.schema.ts:81-85` validates `playerCount` as an integer 1–5; `setupContract.validate.ts` returns a structured ok/errors result; the envelope carries both `playerCount` and the composition arrays.
- **Baseline:** `origin/main @ c47b0491` (2026-07-13). `pnpm --filter @legendary-arena/game-engine build` and `pnpm --filter @legendary-arena/registry build` exit 0; both suites green — **absolute baselines captured at execution-prep**; this WP asserts the **delta**.
- `docs/ai/DECISIONS.md` exists; **D-24165** and **D-24166** are reserved for this packet.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary` + `.claude/rules/architecture.md §Import Rules` — **the load-bearing constraint.** `game-engine` imports Node built-ins only (never `registry`); `registry` imports Node built-ins + `zod` (never `game-engine`). The table therefore **cannot be a shared import**. It lives in `registry` and reaches the engine as a **value on the registry object passed at setup** (the sanctioned Registry → Engine setup-time data flow), read through the engine-defined `CardRegistryReader` interface via structural typing. No new cross-import is introduced; confirm this against the Import Rules table before coding.
- `docs/ai/ARCHITECTURE.md §Determinism` + the sentinel/replay harness — **the risk surface.** Changing the villain-deck bystander fallback changes villain-deck composition → `G` → `finalStateHash` **for matches at 3+ players**. At 2 players the new table value (2) equals the old `numPlayers` (2), so the committed 2-player sentinel fixture (`sentinel-core-doom-2p`) is **byte-identical** and expects **no re-pin**. The re-pin decision is **execution-measured** (`pnpm sim:coverage --check`); if any replay fixture runs at 3+ players it re-pins per `01.5` with recorded evidence.
- `packages/game-engine/src/matchSetup.validate.ts` — read `validateMatchSetup` (:449), the `CardRegistryReader` interface, the `COUNT_FIELD_MINIMUMS` block (:72, D-24032) and its check loop (:298-301). The new `numPlayers` param + the composition-length checks slot in **after** existence validation and **before** the ok-cast, as BLOCK errors.
- `packages/game-engine/src/game.ts` — read the `Game.setup()` body (:224-247) and the `validateSetupData` hook (:201); this is where `ctx.numPlayers` is threaded into the `validateMatchSetup` call.
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts:132`, `:259-273`, `:568` — the bystander-count fallback and its `// why:` comments (which already document the "villain-deck bystanders vs. `config.bystandersCount` supply-pile" distinction — preserve and extend that comment).
- `packages/registry/src/setupContract/setupContract.schema.ts` + `setupContract.validate.ts` + `setupContract.types.ts` — the browser-mirror validator; the player-count ↔ composition-length coupling is added here (`superRefine`) using the **same** `PLAYER_COUNT_SETUP` table (one source of truth, not a second copy of the numbers).
- `packages/registry/src/index.ts` (+ `package.json` `exports`) — how the registry package exposes barrels / subpaths; the new table needs a browser-safe export path both `registry-viewer` (WP-372) and `apps/server` (WP-371) can import.
- `docs/ai/DECISIONS.md` — D-24032 (supply floors — a **different** count concern; do not conflate the supply-pile `bystandersCount` with the villain-deck bystander count), D-16801 / D-16803 / D-16804 (villain-deck composition + the deferred per-player mapping this WP completes), D-10014 (qualified-ID validation authority).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 8 (no branching `.reduce()`), Rule 11 (full-sentence error messages).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- `G` stays JSON-serializable; no objects/Maps/functions added to `G`. This WP adds **no** `G` field (the table is registry data + a validator input, never persisted into `G`).
- No `Math.random()`; villain-deck instancing keeps its existing `ctx.random.Shuffle` determinism. No I/O / DB / network / filesystem in validators or setup builders.
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- No `.reduce()` in the changed files; explicit `for...of` / direct indexing with descriptive names.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `00.6-code-style.md`.

**Packet-specific:**
- **The engine never imports `registry`.** The table's values live only in `registry`; the engine reads them through the `CardRegistryReader.playerCountSetup` member of the object passed at setup (structural typing). Any `import ... from '@legendary-arena/registry'` in a `game-engine` source file is an immediate FAIL.
- **One source of truth.** The numbers 1/2/3/3/4, 1/1/1/2/2, 1/2/8/8/12, 3/5/5/5/6 appear **once** — in `PLAYER_COUNT_SETUP` in `registry`. `setupContract` and every consumer read that constant; no file re-types the numbers. (This is the canonical-array discipline from `.claude/rules/code-style.md §Drift Detection`, applied to a table.)
- **`bystandersCount` (supply pile) is NOT the table's bystander column.** The table's `villainDeckBystanderCount` sizes the bystanders shuffled **into the villain deck**; `MatchSetupConfig.bystandersCount` sizes the **bystander supply pile** and keeps its D-24032 floor of 30 unchanged. The two must never be conflated (extend, don't remove, the existing `// why:` at `villainDeck.setup.ts:262-264`).
- **Scheme-specified counts win.** The villain-deck bystander change touches only the `null`-scheme fallback. A scheme carrying `villainDeckBystanderCount` (D-16803) still overrides; WP-169's curated values are unaffected.
- **Composition-length mismatches are BLOCK errors, not warnings.** Wrong `villainGroupIds.length` / `henchmanGroupIds.length` / `heroDeckIds.length` for the player count push a `MatchSetupError` → `validateMatchSetup` returns not-ok → `Game.setup()` throws (the enforcement model in D-24165: **block at engine/server, warn in builder**).
- **Determinism (locked):** villain-deck bystander change is behavior-affecting at 3+ players only. Sentinel re-pin is **execution-measured**; the 2-player fixture is expected byte-identical. No re-pin is assumed silently — the decision + evidence are recorded per `01.5`.
- **Contract files touched under review.** `matchSetup.validate.ts` (signature change) and `setupContract.*` (added coupling) are contract files; the change is authorized by D-24165 (per `.claude/rules/code-style.md §Contract Files`). No unrelated edits to them.

**Locked contract values:**

```ts
// packages/registry — the single source of truth
export interface PlayerCountSetupRow {
  readonly villainGroupCount: number;        // === villainGroupIds.length
  readonly henchmenGroupCount: number;       // === henchmanGroupIds.length
  readonly villainDeckBystanderCount: number; // bystanders shuffled INTO the villain deck (scheme override wins)
  readonly heroCount: number;                // === heroDeckIds.length
}
export const PLAYER_COUNT_SETUP: Readonly<Record<1 | 2 | 3 | 4 | 5, PlayerCountSetupRow>> = {
  1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1,  heroCount: 3 },
  2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2,  heroCount: 5 },
  3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8,  heroCount: 5 },
  4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8,  heroCount: 5 },
  5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
};
```

- **Standard-only.** These are the base-game numbers. The "What If…?" modified table (4p→4 villain groups, 5p→5 / 16 bystanders) is a game-mode variant with **no game-mode concept in the app today** — explicitly OUT of scope (see below), reserved for a future mode-aware WP.
- **Enumerated player counts.** The table is keyed 1–5 exactly (matching the `playerCount` 1–5 schema bound); `numPlayers` outside 1–5 is already rejected upstream (boardgame.io / schema) — the engine reads `PLAYER_COUNT_SETUP[numPlayers]` and, if absent (defensive), skips the composition check rather than throwing on a key it cannot map (a malformed `numPlayers` is not this validator's error to own).

---

## Debuggability & Diagnostics

- Fully reproducible: enforcement is a pure function of `(MatchSetupConfig, numPlayers, table)`; the villain-deck fallback is a deterministic lookup.
- Observable: a mismatched setup produces a named full-sentence `MatchSetupError` (e.g. "A 4-player match requires 3 villain groups, but 1 was provided."); the villain-deck bystander count is visible in the deck composition (and in the WP-168 golden composition test).
- `G` unchanged in shape (no new field); no hollow-effect surface touched.

---

## Scope (In)

### A) Canonical table (`packages/registry/src/playerCountSetup.ts` — new)
- Export `PlayerCountSetupRow` + `PLAYER_COUNT_SETUP` (verbatim above) + a pure helper `getPlayerCountSetup(numPlayers: number): PlayerCountSetupRow | undefined`. No `zod`, no I/O — plain data + a lookup. `// why:` documents the villain-deck-bystander-vs-supply-pile distinction and the standard-only scope.
- Expose it on the registry's public surface: a browser-safe export path (barrel/subpath in `packages/registry/src/index.ts` + `package.json` `exports`) importable by `registry-viewer` and `apps/server`; and, so the engine can read it structurally, exposed as a member on the `CardRegistry` object that `configureGameRegistry` receives.

### B) Engine validator (`packages/game-engine/src/matchSetup.validate.ts` — modified)
- Extend the `CardRegistryReader` interface with `playerCountSetup: Readonly<Record<number, PlayerCountSetupRow>>` (engine-local `PlayerCountSetupRow` type — structurally compatible with the registry's, **no import**).
- Change the signature to `validateMatchSetup(input, registry, numPlayers: number)`. After existence validation and before the ok-cast, add composition-length checks against `registry.playerCountSetup[numPlayers]` for `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds`; each mismatch pushes a full-sentence `MatchSetupError`. Absent table row (defensive) → skip. `// why:` cites D-24165.

### C) Engine setup call site (`packages/game-engine/src/game.ts` — modified)
- Pass `ctx.numPlayers` into the `validateMatchSetup(matchConfiguration, gameRegistry, ctx.numPlayers)` call (:244). Confirm `ctx.numPlayers` is in scope at the setup boundary; wire it through `validateSetupData` if that is the cleaner thread (drop the `_` prefix if so). `// why:` cites D-24165.

### D) Villain-deck bystander fallback (`packages/game-engine/src/villainDeck/villainDeck.setup.ts` — modified)
- Replace the `null`-scheme fallback `context.ctx.numPlayers` (:267) with `registry.playerCountSetup[context.ctx.numPlayers].villainDeckBystanderCount` (read via the same setup-time registry object; confirm the setup context/threading exposes the registry — `buildInitialGameState(config, registry, ctx)` already has it). Scheme override path unchanged. Extend the existing `// why:` (:262-264) to name D-24166 and keep the supply-pile distinction. Defensive: absent table row → keep `context.ctx.numPlayers` as the last-ditch fallback (never throw here).

### E) Registry mirror coupling (`packages/registry/src/setupContract/setupContract.schema.ts` + `setupContract.validate.ts` — modified)
- Add a `superRefine` (or validate-side check) coupling the envelope's `playerCount` to the composition array lengths using `PLAYER_COUNT_SETUP` — same three length checks, full-sentence messages, structured errors (no throw). This is the browser-reachable mirror WP-372 surfaces as a warn + export-gate; it does **not** alter `parseLoadoutJson`'s success path for a **matching** loadout.

### F) Tests
Add `node:test` tests (each new group in exactly one `describe()`):
- **`packages/registry/src/playerCountSetup.test.ts`** — new: the table has exactly rows 1–5; each row's four counts equal the rules table (a literal drift-lock, per canonical-array discipline); `getPlayerCountSetup` returns the row / `undefined` out of range.
- **`packages/game-engine/src/matchSetup.contracts.test.ts`** (or the existing validate test) — modified: a matching composition passes at each player count; a wrong villain-group / henchman-group / hero count at a given `numPlayers` returns not-ok with the named error; the supply-floor (D-24032) behavior is unchanged; a `numPlayers` with no table row skips the composition check (does not throw).
- **`packages/game-engine/src/villainDeck/villainDeck.setup.test.ts`** — modified: with a `null`-bystander scheme, 3p seeds 8 / 4p seeds 8 / 5p seeds 12 / 1p seeds 1 / 2p seeds 2 villain-deck bystanders; a scheme-specified count still overrides; 2p is byte-identical to the pre-WP behavior (regression guard for the sentinel).
- **`packages/registry/src/setupContract/setupContract.test.ts`** — modified: an envelope whose `playerCount` disagrees with its composition lengths yields the coupling errors; a matching envelope still validates ok.
- All engine tests use structural mocks; no `boardgame.io` imports; no `@legendary-arena/registry` import in engine tests (mock the `playerCountSetup` reader member).

---

## Out of Scope

- **"What If…?" modified setup** — a game-mode variant (4p→4 villain groups, 5p→5 / 16 bystanders) with no mode concept in the app; a future mode-aware WP. This WP encodes the **standard** table only.
- **The supply-pile `bystandersCount` / `woundsCount` / `officersCount` / `sidekicksCount` floors (D-24032)** — unchanged. This WP touches the villain-deck bystander count, a different concern.
- **Scheme twist counts / the WP-169 D-16804 conditional-twist carve-out** — unchanged; this WP completes only the bystander half of the deferred per-player mapping.
- **Server create-gate + arena-client lobby enforcement** — WP-371 (consumes this table).
- **Registry-viewer loadout-builder warn + required-count display + export-gate** — WP-372 (consumes this table + the `setupContract` coupling).
- **Any `G` field, snapshot, or persistence change** — none added.
- **Retro-validation of in-flight / historical matches** — this enforces new setups going forward.
- Refactors / cleanups outside Scope (In).

---

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts` — **new** — the canonical table + `getPlayerCountSetup`
- `packages/registry/src/index.ts` (+ `packages/registry/package.json` `exports` if a new subpath is used) — **modified** — export the table on a browser-safe path + on the `CardRegistry` surface
- `packages/registry/src/playerCountSetup.test.ts` — **new** — table drift-lock + helper tests
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** — player-count ↔ composition coupling (`superRefine`)
- `packages/registry/src/setupContract/setupContract.validate.ts` — **modified** — surface the coupling errors (if not fully expressed in the schema)
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** — coupling tests
- `packages/game-engine/src/matchSetup.validate.ts` — **modified** — `CardRegistryReader.playerCountSetup` + `numPlayers` param + composition-length checks
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **modified** — composition-length + skip-when-no-row tests
- `packages/game-engine/src/game.ts` — **modified** — thread `ctx.numPlayers` into the `validateMatchSetup` call
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — **modified** — bystander fallback reads the table
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` — **modified** — per-player bystander counts + scheme-override + 2p regression
- `docs/ai/STATUS.md` — **modified** — session close
- `docs/ai/DECISIONS.md` — **modified** — D-24165 + D-24166 reserved → Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-370 checked off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC row (authored at execution-prep)
- `docs/05-ROADMAP-MINDMAP.md` + roadmap counts artifact — **modified** — node added, `pnpm roadmap:counts --write`
- **(execution-measured)** the sentinel fixture(s) — re-pinned **only if** a replay fixture runs at 3+ players (expected: the 2p fixture is byte-identical → no re-pin); decision + evidence recorded per `01.5`.

No other files may be modified. Run `pnpm sim:coverage --check` + `pnpm roadmap:counts:check` before pushing; regenerate any stale artifact in the same commit.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2 (faithful tabletop content — correct per-player component counts), §3 (trust & fairness — an illegal board can no longer start silently), §8/§22 (determinism — villain-deck composition made rules-correct; re-pin controlled).
- **Conflict assertion:** No conflict — a **correctness + integrity** fix. No NG-1 (pay-to-win) surface.
- **Non-Goal proximity check:** Not triggered — no scoring/PAR change, no identity, no monetization surface.
- **Determinism preservation:** the only behavior-affecting change (villain-deck bystanders) is 3p+; the 2p sentinel is byte-identical; re-pin is execution-measured and recorded.

## Funding Surface Gate

N/A — engine/registry validation + setup only; no UI, no funding affordances/copy/channels.

## API Catalog (00.3 §21)

N/A — no `apps/server` HTTP endpoint added/modified/removed; no server library function touched. (The server-side consumer is WP-371, which owns its own catalog row.)

---

## Acceptance Criteria

### Table (source of truth)
- [ ] `PLAYER_COUNT_SETUP` has exactly rows 1–5; each row's four counts equal the rules table (drift-lock test).
- [ ] The numbers appear only in `PLAYER_COUNT_SETUP` — no consumer re-types them (`git grep` for the literals across `packages/` / `apps/` finds only the table + tests).

### Engine enforcement
- [ ] `validateMatchSetup(input, registry, numPlayers)` returns not-ok with a named full-sentence error when `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds` length ≠ the table for `numPlayers`; returns ok for a matching composition at each of 1–5.
- [ ] `Game.setup()` throws (does not start a match) for a mismatched composition; the D-24032 supply floors still behave unchanged.
- [ ] The engine has no `@legendary-arena/registry` import (`git grep "@legendary-arena/registry" packages/game-engine/src` empty).

### Villain-deck bystanders
- [ ] With a `null`-bystander scheme: 1p→1, 2p→2, 3p→8, 4p→8, 5p→12 villain-deck bystanders; a scheme-specified count overrides; 2p output byte-identical to pre-WP.

### Registry mirror
- [ ] `setupContract` validation flags a player-count ↔ composition-length mismatch with full-sentence errors; a matching envelope validates ok.

### Determinism
- [ ] `pnpm sim:coverage --check` OK; sentinel re-pin decision recorded (expected: none, 2p fixture unchanged).

### Tests / scope
- [ ] `pnpm --filter @legendary-arena/registry test` + `pnpm --filter @legendary-arena/game-engine test` green at baseline + new tests, 0 fail.
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# 1 — builds
pnpm --filter @legendary-arena/registry build
pnpm --filter @legendary-arena/game-engine build

# 2 — suites
pnpm --filter @legendary-arena/registry test
pnpm --filter @legendary-arena/game-engine test

# 3 — determinism / sentinel
pnpm sim:coverage --check   # OK; finalStateHash unchanged (2p fixture)

# 4 — engine never imports registry
git grep "@legendary-arena/registry" packages/game-engine/src   # expect: no output

# 5 — numbers appear only in the table
git grep -n "villainDeckBystanderCount" packages/ apps/   # only the table + consumers reading the field, never re-typed literals

# 6 — roadmap counts current
pnpm roadmap:counts:check

# 7 — scope
git diff --name-only origin/main   # only ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification:** N/A directly (infrastructure) — the authoritative block is verified via the engine/registry suites; the live payoff lands with WP-371 (lobby rejection) + WP-372 (builder warn). (D-24026 N/A for this WP; the consuming WPs carry the live-surface item.)
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/registry build` + `pnpm --filter @legendary-arena/game-engine build` exit 0; both suites green at baseline + new tests.
- [ ] `pnpm sim:coverage --check` OK; sentinel re-pin decision recorded (expected: none).
- [ ] Engine has no `registry` import; the table's numbers appear only in `PLAYER_COUNT_SETUP` (confirmed with `git grep`).
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — D-24165 + D-24166 flipped to Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-370 checked off with the execution date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node added + `pnpm roadmap:counts --write` regenerated in the close commit.

---

## Lint Gate Self-Review & Gate Verdicts

Recorded in the drafting SPEC commit body (per the current SPEC-draft convention: lint 00.3 self-check + pre-flight facts live in the commit body, not a WP section). Summary: 21/21 resolved (PASS); pre-flight **READY TO EXECUTE** (all hard-deps on `main`, contract fidelity verified against the cited source lines, layer-boundary read confirmed, the villain-deck determinism re-pin surfaced as execution-measured); copilot **PASS**.
