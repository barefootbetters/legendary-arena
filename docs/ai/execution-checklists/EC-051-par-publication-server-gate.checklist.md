# EC-051 — PAR Publication & Server Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-051-par-publication-server-gate.md
**Layer:** Server / Enforcement (Read-Only)

## Before Starting
- [ ] WP-050 complete — `ParIndex`, `lookupParFromIndex` exist; `data/par/` layout defined
- [ ] WP-004 complete — server startup sequence exists (`apps/server/src/index.mjs`)
- [ ] `.claude/rules/server.md` read — server is wiring layer only
- [ ] `pnpm -r build` exits 0

## Locked Values (do not re-derive)
- Index is the sole oracle of PAR publication — filesystem probing forbidden
- Server is read-only for PAR data — never generates, modifies, repairs, or rebuilds
- PAR loading is non-blocking at startup — if index is missing, unreadable, or invalid, competitive enforcement fails closed; diagnostic logging should distinguish these cases
- Startup log: `[server] PAR index loaded: N scenarios (vX)` on success, warning on failure
- Gate check: `checkParPublished(parIndex, scenarioKey)` returns `{ parValue, parVersion } | null`
- Active PAR version is configuration-driven, read-only — changing it is an operational decision, not runtime
- Competitive gate rule (non-negotiable): submission rejected if `checkParPublished` returns `null`
- Gate evaluation is strictly binary: published or not published — no probabilistic/heuristic/partial acceptance
- Server must not interpret, transform, or reason about `parValue` — returned for recording and display only
- Rejection is deterministic — no player-specific, hero-dependent, or outcome-dependent behavior
- No fallback, default, or inferred PAR — fail closed always
- Leaderboard entries must record `parVersion` and `scoringConfigVersion`
- Server files use `.mjs` extension (consistent with WP-004)

## Guardrails
- No game logic in PAR gate files — existence check only, not difficulty computation
- No engine files modified
- No WP-050 contract files modified
- No write operations in PAR gate files (no writeFile, mkdir, unlink, rename)
- No boardgame.io or LegendaryGame imports in server PAR files
- No database for PAR enforcement
- No "temporary bypass" flags or silent fallback paths
- No automatic index regeneration on server startup

## Required `// why:` Comments
- `parGate.mjs` loadParIndex: PAR is optional for startup; missing index disables competitive features
- `parGate.mjs` checkParPublished: index is canonical oracle; filesystem probing forbidden
- `parGate.mjs` createParGate: load once at startup, check many times — same pattern as registry

## Files to Produce
- `apps/server/src/par/parGate.mjs` — **new** — loadParIndex, checkParPublished, createParGate
- `apps/server/src/index.mjs` — **modified** — add PAR index loading to startup
- `apps/server/src/par/parGate.test.mjs` — **new** — 9 tests

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] Server tests pass with 0 failures
- [ ] No engine files modified (git diff packages/game-engine/)
- [ ] No game logic in PAR gate files (Select-String for boardgame.io/LegendaryGame/ctx)
- [ ] No write operations in PAR gate files (Select-String for writeFile/mkdir/unlink)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (non-blocking PAR load, index-only lookup, fail-closed, server as enforcer)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Accepting competitive score because artifact file "exists on disk" — must use index only
- Computing or inferring PAR on server when index is missing — must fail closed
- Falling back to default PAR values — no defaults, no fallbacks
- Player- or hero-dependent gate behavior — gate is scenario-only
- Automatically regenerating index on server startup — server is read-only
- Server writing to `data/par/` — layer boundary violation
- Letting a match be ranked "temporarily" without PAR — trust violation
- PAR index reloaded or changed during runtime without server restart — active PAR version must be stable for a server process
- Server importing game-engine internals for PAR checks — layer boundary violation
