# EC-113 — Engine-Server Registry Wiring + Validator Alignment (Execution Checklist)

**Source:** [docs/ai/work-packets/WP-113-engine-server-registry-wiring-and-validator-alignment.md](../work-packets/WP-113-engine-server-registry-wiring-and-validator-alignment.md)
**Layer:** Server (`apps/server/`) + Game Engine (`packages/game-engine/`)

## Before Starting
- [ ] WP-100 complete; D-10006 → D-10013 all landed in main
- [ ] Pre-flight resolved Q1 (validator strategy: option (a) confirmed feasible per builder)
- [ ] Pre-flight resolved Q2 (hero-deck builder file path located + recorded)
- [ ] Pre-flight resolved Q3 (per-builder diagnostic emission site: inside builder vs orchestration)
- [ ] D-10014 reservation noted in DECISIONS.md (entry created at Commit B; pre-promotion drafts may reference it)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline `524 / 116 / 0`)
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline `47 / 7 / 0`)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline `182 / 17 / 0`)

## Locked Values (do not re-derive)
- Server wiring sequence: `loadRegistry()` resolves → `setRegistryForSetup(registry)` → registry/rules/PAR Promise.all → `Server({ games, origins })` → `server.run({ port })`
- `setRegistryForSetup` import path: `@legendary-arena/game-engine` (top-level export)
- `setRegistryForSetup` registry guard: do NOT remove `if (gameRegistry) { ... }` at `game.ts:201-210` — server wiring is the runtime fix, not the engine guard
- **Set-qualified ID format (LOCKED):** all five entity-ID fields on `MatchSetupConfig` use `<setAbbr>/<slug>`. Bare slugs, display names, and flat-card keys are ALL rejected. Format-error messages name the canonical form + concrete example.
- Empirical collision evidence (2026-04-27 probe): 23 hero slugs, 11 mastermind slugs, 4 villain group slugs, 2 scheme slugs collide across loaded sets. Bare slugs are nondeterministic by construction; qualified format is mandatory regardless of present-day disambiguation.
- `parseQualifiedId(input)` rejects empty / no-slash / multiple-slash / empty-part inputs. Validator emits a format error before existence check on parse failure.
- Validator distinguishes "set not loaded" vs "slug not in that set" in error messages.
- Slug-extractor exports: `extractVillainGroupSlug` from `villainDeck.setup.ts`; equivalents from `mastermind.setup.ts`, `buildSchemeSetupInstructions.ts`, hero-deck builder. Type-stable, no signature changes. Single source of truth for the slug half of qualified IDs.
- Builder filtering order: parse `<setAbbr>/<slug>` → filter cards by `setAbbr` first → match by `<slug>` within that set's cards only. No accidental cross-set matches.
- Diagnostic constraint: full-sentence `G.messages` entry on each `isXRegistryReader → empty fallback`. No new state fields, no signature-breaking changes to builders. Per-builder emission site (inside builder vs orchestration) per pre-flight Q3.
- 01.5 NOT INVOKED: no new `LegendaryGameState` field, no `buildInitialGameState` shape change, no new `LegendaryGame.moves` entry, no new phase hook

## Guardrails
- Server change is **minimal diff** — import addition + call site + `// why:` comment. No `startServer()` restructuring.
- Validator option (a) only: validator consumes builder-owned extractors. Pivot to option (b) requires WP body amendment + new pre-flight.
- `// why:` comments referencing D-10014 land in the SAME commit set as the D-10014 entry (Commit B).
- Existing test fixtures using flat-card keys for slug fields are updated, NOT preserved as drift sources. Each fixture change documented in test JSDoc with D-10014 reference.
- No changes to `apps/arena-client/`, `LegendaryGame.moves`, lobby phase config, or any UI surface.

## Required `// why:` Comments
- `apps/server/src/server.mjs` `setRegistryForSetup(registry)` call site: D-10014 + WP-100 smoke-test discovery
- `packages/game-engine/src/matchSetup.validate.ts` per-field validation loop: D-10014 + slug-vs-key contract
- Each promoted slug-extractor export site (4 files): D-10014 + "single source of truth"
- Each setup-time diagnostic emission site (4 builders or 1 orchestrator): D-10014 + remediation pointer

## Files to Produce (executed in this order)
1. `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — **modified** — promote `extractVillainGroupSlug` to export + diagnostic site
2. `packages/game-engine/src/mastermind/mastermind.setup.ts` — **modified** — promote slug-extractor + diagnostic site
3. `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts` — **modified** — promote slug-extractor + diagnostic site
4. `packages/game-engine/src/setup/<heroDeckBuilder>.ts` — **modified** — promote slug-extractor + diagnostic site (path locked at pre-flight Q2)
5. `packages/game-engine/src/matchSetup.validate.ts` — **modified** — 5 slug-set helpers + per-field alignment
6. `packages/game-engine/src/matchSetup.validate.test.ts` — **modified** — ≥10 new tests (5 fields × accept/reject) + fixture updates
7. `packages/game-engine/src/{villainDeck,mastermind,setup}/*setup.test.ts` (4 files) — **modified** — diagnostic-presence regression tests
8. `packages/game-engine/src/setup/buildInitialGameState.loadout.test.ts` — **new** — end-to-end loadout integration test (non-empty G + zero "skipped" diagnostics)
9. `apps/server/src/server.mjs` — **modified** — minimal-diff registry wiring
10. `apps/server/src/server.mjs.test.ts` — **new or modified** — wiring-ordering test (no boardgame.io constructor spying required)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; baseline `524 → ~534 / 117 / 0` (+10 tests, +1 suite)
- [ ] `pnpm --filter @legendary-arena/server test` exits 0; baseline `47 → ~48 / 7 / 0` (+1 wiring test)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; baseline `182 / 17 / 0` UNCHANGED
- [ ] `pnpm -r build` exits 0
- [ ] Manual smoke test (`scripts/Start-SmokeTest.ps1 -KillStaleListeners`): clicking Reveal in `start` produces a villain or henchman in the City; fightVillain defeats the target; fightMastermind decrements tactics
- [ ] `git diff --name-only -- apps/arena-client packages/registry` returns no output
- [ ] `docs/ai/STATUS.md` updated — match creation now produces non-empty matches end-to-end
- [ ] `docs/ai/DECISIONS.md` updated — D-10014 (engine-server registry wiring + slug-vs-key contract per field, with per-builder diagnostic emission sites)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-113 row Done with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-113 row Draft → Done with date
- [ ] 01.6 post-mortem at `docs/ai/post-mortems/01.6-WP-113-engine-server-registry-wiring-and-validator-alignment.md` (mandatory triggers: new contract surface — slug-set helpers; new code seam — server registry wiring; new long-lived abstraction — setup-diagnostic surfacing pattern)

## Common Failure Smells
- "Validator now rejects every loadout" → step 5 ran before steps 1-4 (extractors not yet exported). Re-order; the 10-step sequence is load-bearing.
- Diagnostic appears in `G.messages` on every match (even with registry wired) → diagnostic emission ran unconditionally instead of inside the `isXRegistryReader → empty` branch. Loadout integration test catches this.
- arena-client test count drifted → WP-113 touched a UI file. STOP and revert; this WP is engine + server only.
- Bare slug / display name / flat-card key fixture rejected by validator → **expected.** Update fixture to `<setAbbr>/<slug>` qualified format per D-10014 and document each migration in test JSDoc. Do NOT add the bare slug to a fallback list to "make the test pass."
- Validator returns "set 'wwhk' not loaded" or "format invalid: expected `<setAbbr>/<slug>`, got 'black-widow'" → expected when fixture omits the `<setAbbr>/` prefix. Format error fires before existence check on parse failure; "set not loaded" fires before "slug not in that set" — the two error kinds carry different remediations.
- Builder accepts `<setAbbr>/<slug>` but silently filters across all sets (e.g., parses qualifier then ignores it) → contract violation. Builder MUST filter by `setAbbr` first, THEN match `<slug>` within that set's cards only. Cross-set collision protection is the entire reason for the qualified format.
- "Cannot read properties of undefined (G.messages)" inside a builder → builder doesn't actually receive G; per pre-flight Q3, that builder's diagnostic emits at the orchestration site instead. Move the push to `buildInitialGameState.ts`.
