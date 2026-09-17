# EC-741 — Executable effect-rulings corpus (Execution Checklist)

**Source:** docs/ai/work-packets/WP-704-effect-rulings-corpus.md
**Layer:** Game Engine (test corpus + `node:test` harness)

## Before Starting
- [ ] Read `wiki/card-effect-system.md` §Edge Cases + the cited decisions (D-24281, D-24329, D-24413, D-24442, D-24523) — these are the seed rulings.
- [ ] Locate the engine's minimal-`G` + fire-effect helpers: `buildInitialGameState` + `src/test/fixtureBuilders.ts` (minimal `G`), `makeMockMoveContext` (`src/test/mockMoveContext.ts` — full `FnContext` + `playerID`; NOT the setup-time `makeMockCtx`), and read the `ruleRuntime.integration.test.ts` precedent — the harness REUSES these, never re-implements a handler.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` green; record baseline test count.

## Locked Values (do not re-derive)
- Corpus path: `docs/ai/rulings/effect-rulings.json` (array of rulings). Authoring doc: `docs/ai/rulings/README.md`.
- Naming: **"effect rulings"** — NEVER "LAGN rulings"; NOT in `packages/lagn-spec`.
- Ruling entry shape: `{ id (kebab, unique), mechanic, decision? (D-ref), scenario, expected, why (non-empty) }`.
- Validator + closed scenario/expectation unions live in `packages/game-engine/src/rules/effectRulings.validate.ts` — a **hand-written runtime validator, Node built-ins only, NO zod** (game-engine may import Node built-ins only; a zod import breaks `pnpm -r build` + crosses the layer). Harness in `packages/game-engine/src/rules/effectRulings.test.ts`.
- Corpus path resolved via `import.meta.url` + `path.resolve` (NOT `process.cwd()`); the fs read is a deliberate test-harness exemption to the `src/rules/` no-I/O rule; iterate rulings in **file order**.
- **Per-ruling non-vacuity** is a standing self-test: perturb each ruling's `expected`, assert that ruling fails — not a one-shot manual flip. Assert on handler OUTPUT.
- Seed **target ≥ 8, subordinate to vocabulary minimalism**: never add a vocabulary member solely to reach the count; ship fewer + defer the rest.
- Scenario/expectation verb unions are **closed readonly arrays with RUNTIME drift pins** (D-24372) — grow one member + its harness mapping + a using ruling together; NO speculative DSL.
- Seed set: **≥ 8** rulings, each citing a `D-`. Any decided edge case the closed vocabulary can't yet express is listed here as **deferred**, not force-fit.

## Guardrails
- **Every ruling executes against the real handler.** No `it.skip`, no always-pass fixture, no re-implemented handler logic in the harness — a non-executing or self-answering ruling is the exact drift this WP prevents (reward-integrity).
- **`why` mandatory + non-empty** — the schema rejects an empty rationale (a ruling without a why is a fixture).
- **Non-vacuous (standing, per-ruling)** — a standing harness guard that perturbs **every** ruling's `expected` and asserts **that** ruling fails; NOT a one-shot manual flip. A ruling that passes when perturbed is vacuous (asserts on a setup value, not handler output) and is a hard failure.
- **Test corpus only** — do NOT modify any production `src` handler; no `G` field; no move/phase/UIState change. `finalStateHash` / `PRE_WP080` sentinels must be **byte-identical** (this WP adds tests, changes no gameplay).
- **Closed vocabulary drift-pinned** — union ↔ canonical array ↔ harness map kept in lockstep, runtime-asserted.
- **Private** — corpus + harness stay in this repo; nothing enters `@legendary-arena/lagn`.

## Required `// why:` Comments
- On each scenario/expectation union: cite D-24524 (closed, grows one primitive at a time).
- On the harness's handler-invocation seam: why it reuses the engine helper (a re-implementation would let a ruling pass while the real handler is broken).

## Files to Produce
- `docs/ai/rulings/effect-rulings.json` (corpus), `docs/ai/rulings/README.md` (authoring doc)
- `packages/game-engine/src/rules/effectRulings.validate.ts` (runtime validator, Node built-ins only NO zod + closed unions + runtime drift pins)
- `packages/game-engine/src/rules/effectRulings.test.ts` (executing harness + per-ruling non-vacuity self-test)
- Govern-close: `DECISIONS.md` (D-24524), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] ≥ 8 rulings (or fewer + deferred list if the closed vocabulary can't express 8), all executing + green; the per-ruling non-vacuity self-test passes (each ruling fails when its `expected` is perturbed).
- [ ] `finalStateHash`/`PRE_WP080` byte-identical; engine suite green (state new total); `pnpm -r build` 0.
- [ ] D-24524 Active; WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, `roadmap:counts:check` 0, `ledger:numbers:check` 0.

## Common Failure Smells
- A ruling that "passes" but the harness never actually fired the handler (assert on a value the setup already set) — the non-vacuous check catches this; design the assertion on the handler's OUTPUT.
- Re-implementing the effect in the harness to make the ruling green — forbidden; call the real handler.
- Reaching for a general JSON→engine DSL — stop; add one closed vocabulary member for the specific ruling instead.
- A sentinel hash changed — you touched a production handler; a rulings WP must not.
