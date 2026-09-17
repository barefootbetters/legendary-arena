# WP-704 — Executable effect-rulings corpus (first slice: schema + harness + seed)

**Status:** Draft (reserved WP-704 / EC-741 / D-24524).
**Baseline:** `origin/main` @ `77956f2a`.
**Layer:** Game Engine (test corpus) + a `node:test` harness. No runtime/gameplay change.

## Goal

Stand up the **effect-rulings corpus** the LAGN architecture brief calls its "crown
jewel" (layer 5) and `wiki/card-effect-system.md` flags as Known-gap #4: a **single,
executable** record of card-effect edge-case rulings — `scenario → expected → why` —
run by a harness against the **real engine handlers**, so a ruling can never silently
drift from the code it describes. This WP ships the **first slice**: the ruling schema,
the executing harness, a CI gate, and a **seed set** of rulings migrated from
already-decided edge cases. It does **not** attempt to capture the full backlog — that
is the ongoing grind the brief itself describes.

## User-Visible Impact

Indirect: higher fidelity confidence. Today an edge-case decision (e.g. "reveal-or-wound
counts hand ∪ in-play", "KO-ing your own Wounds is beneficial") lives as prose in
`DECISIONS.md` + a `// why:` comment, and can rot as handlers change. A ruling that
**executes** turns each decision into a green/red check. No end-user surface.

## Assumes

- The effect subsystems are built and stable (hero / villain / scheme-mastermind
  handlers), per `wiki/card-effect-system.md`. — the corpus asserts against them.
- Engine unit-test helpers exist for building a minimal `G` and invoking effects
  without a full match — `buildInitialGameState` + `src/test/fixtureBuilders.ts` for the
  minimal `G`, and `makeMockMoveContext` (`src/test/mockMoveContext.ts`) to fire an effect
  against the real handler (the setup-time `makeMockCtx` is a different, narrower context);
  the `ruleRuntime.integration.test.ts` pattern is the proven precedent. — the harness
  reuses these, it does not invent a new engine entry.
- `node:test` + `tsx` is the runner; `.test.ts` is the only test extension
  (`.claude/rules/code-style.md`). — the harness is a `.test.ts`.

## Context (Read First)

The analytical work the brief prizes **exists but is scattered**: `DECISIONS.md` prose,
`wiki/card-effect-system.md` §Edge Cases, inline `// why:` comments, and
full-game **replay hash-oracle fixtures**. None of those is the brief's target:
- Replay fixtures assert *whole-game determinism* via an opaque hash — they carry **no
  rationale** and don't isolate a single interaction.
- The coverage indices (`effect-implementation-index.json`, the mechanic ledgers,
  `runtime-observed-hollows.json`) track *implementation status*, not *correctness*.

The rulings corpus is the missing middle: **focused single-interaction correctness with
human-readable rationale, executed.** This WP is deliberately a **thin first slice** — the
enduring risk is over-building a fully general "scenario DSL" up front. The discipline
(mirroring the D-24029 effect-primitive model) is: a **closed, small** scenario vocabulary
that grows one primitive at a time as a new ruling needs it, never a speculative DSL.

**Naming (brief):** this is **"effect rulings"**, private to this repo — **never "LAGN
rulings"** (the public LAGN surface stays the verb list + argument shapes only; the
edge-case analysis is the private work product). Nothing here goes in `packages/lagn-spec`.

## Scope (In)

1. **Ruling validator** — a **hand-written runtime validator, Node built-ins only (NO
   zod)** — because `game-engine` may import Node built-ins only per
   `.claude/rules/architecture.md` (zod is the registry layer's dep; the engine has no
   zod dependency). It mirrors the established engine precedent — a local structural
   interface + a runtime type guard + a closed-union canonical readonly array with a
   runtime drift pin (exactly the `VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES`
   shape). It validates one ruling entry: `{ id (kebab, unique), mechanic (string),
   decision? (D-ref string), scenario: RulingScenario, expected: RulingExpectation, why
   (non-empty prose) }`.
2. **Corpus file** — `docs/ai/rulings/effect-rulings.json`: an array of ruling entries,
   hand-authored, committed, human-diffable.
3. **Scenario/expectation vocabulary (closed, small — the crux)** — a **narrow** initial
   set sufficient for the seed rulings: a `scenario` names a minimal setup (the cards in
   the relevant zones, the acting player) and one action (an effect/keyword/primitive to
   fire); an `expected` names post-state assertions (a zone's contents/counts, a resource
   delta, a log line). Each vocabulary member maps to an existing engine helper in the
   harness. **No general DSL** — the union is closed and drift-pinned like the effect
   primitives; a new ruling that needs a new verb adds one member + its harness mapping.
4. **The harness** — `packages/game-engine/src/rules/effectRulings.test.ts`: loads +
   validates the corpus, and for each ruling builds the minimal `G` (via
   `buildInitialGameState` / `src/test/fixtureBuilders.ts`), fires the action through the
   **real handler** with `makeMockMoveContext` (`src/test/mockMoveContext.ts` — the full
   `FnContext` + `playerID`; **not** the setup-time `makeMockCtx`), and asserts the
   expectation **on the handler's output**. It reuses the proven
   `ruleRuntime.integration.test.ts` pattern (minimal `G` → real pipeline → assert on `G`).
   The corpus path is resolved relative to the test file (`import.meta.url` + `path.resolve`),
   never `process.cwd()`, so it works under `pnpm --filter` and CI; this fs read is a
   deliberate test-harness exemption to the `src/rules/` no-I/O rule. Rulings are iterated in
   **file order** (stable). A malformed corpus fails loudly; every ruling is a `node:test`
   case. Runs in the standard engine suite.
5. **Per-ruling non-vacuity self-test** — a standing harness guard that, for **every**
   ruling, programmatically perturbs its `expected` and asserts **that** ruling's case
   fails. This proves each ruling asserts on the handler's *output*, not on a value the
   setup already set — a one-shot manual flip of a single ruling does not (a vacuous ruling
   elsewhere would still pass). This is the reward-integrity core of the WP.
6. **CI gate** — the harness runs under `pnpm --filter @legendary-arena/game-engine test`
   (already CI-gated), so a drifted or vacuous ruling reddens CI. A `--check`-style freshness
   gate is **not** needed (the corpus is hand-authored, not generated).
7. **Seed set** — rulings migrated from decided edge cases, each citing its `D-`: e.g.
   D-24281 (reveal-or-wound counts hand ∪ in-play — the 2026-07-31 amendment),
   D-24329 (KO-own-Wounds beneficial, hand + discard only), D-24413 (Melter KO-or-keep),
   D-24442 (`optional-ko-reward` KO source widened to include `inPlay`; a KO'd
   played-this-turn card keeps the value it produced), D-24523 (dual-class card counts as
   either printed class). **Target ≥ 8, but subordinate to vocabulary minimalism:** if ≥ 8
   cannot be expressed by the closed-vocabulary members the seeds *genuinely* need, ship
   fewer and list the rest as deferred in the EC — **never add a vocabulary member solely to
   reach the count.**
8. **A short authoring doc** — `docs/ai/rulings/README.md`: what a ruling is, the entry
   shape, how to add one, and the "closed vocabulary grows one primitive at a time" rule.
   Also classifies `docs/ai/rulings/` as a docs-only directory (no runtime consumption).

## Out of Scope

- **Capturing the full backlog.** This slice seeds the corpus; filling it is the ongoing
  grind (a ruling captured per edge case as future WPs decide them).
- **A general scenario DSL / full game-state authoring.** The vocabulary is intentionally
  minimal and grows on demand.
- **Any public / `lagn-spec` surface.** The verb list + arg shapes are already public via
  LAGN; the rulings stay private.
- **Runtime consumption.** Nothing reads the corpus during play — it is a test corpus only.
- **Replacing** the replay hash-oracle fixtures or the coverage indices. Complementary.
- **A `/dashboard` view** of rulings (a possible later follow-on, not this WP).

## Files Expected to Change

- `docs/ai/rulings/effect-rulings.json` (new — the corpus)
- `docs/ai/rulings/README.md` (new — authoring doc)
- `packages/game-engine/src/rules/effectRulings.validate.ts` (new — the ruling **runtime validator**, Node built-ins only, NO zod + closed scenario/expectation unions + runtime drift pins)
- `packages/game-engine/src/rules/effectRulings.test.ts` (new — the executing harness)
- Govern-close: `DECISIONS.md` (land D-24524), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Non-Negotiable Constraints

- **Every ruling executes.** A corpus entry that the harness cannot run (unmapped verb)
  is a **hard failure**, not a skip — a non-executing ruling is exactly the drift the WP
  exists to prevent (reward-integrity: no `it.skip`, no always-pass fixture).
- **Closed vocabulary, drift-pinned.** The scenario/expectation verb unions are canonical
  readonly arrays with **runtime** drift assertions (D-24372), like every other engine
  closed set. Growth = union + harness mapping + a ruling that uses it, together.
- **`why` is mandatory and non-empty.** A ruling without rationale is a fixture, not a
  ruling — the schema rejects it.
- **Test corpus only — no engine behavior change.** No production `src` handler is
  modified; no `G` field added; no `finalStateHash`/PAR re-pin (verify the sentinels are
  byte-identical — this WP adds tests, it does not change gameplay).
- **Node built-ins only in the validator (NO zod).** `game-engine` may import Node
  built-ins only (`.claude/rules/architecture.md`); the ruling validator is a hand-written
  runtime type guard + closed unions, never a zod schema (zod is the registry layer's dep;
  a zod import would break `pnpm -r build` and cross the layer boundary).
- **Reuse the engine's own helpers.** The harness builds `G` and fires effects through
  existing test/setup helpers; it never re-implements handler logic (a re-implementation
  would let a ruling pass while the real handler is broken).
- **Private, "effect rulings" naming.** Not "LAGN rulings"; not in `packages/lagn-spec`.

## Contract

- **`effect-rulings.json`** — `Ruling[]`; each `{ id, mechanic, decision?, scenario,
  expected, why }`. `id` unique + kebab; `why` non-empty.
- **Scenario/expectation unions** — closed readonly arrays exported from
  `effectRulings.validate.ts`, drift-pinned at runtime.
- No move/phase/UIState/`G` change; no public API change.

## Vision Alignment

Fidelity to the physical game and to the accumulated rulings analysis (the brief's stated
"real moat"). No monetization/fairness surface. Pure internal quality infrastructure.

## Funding Surface Gate

N/A — no funding/monetization/checkout surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` function.

## Acceptance Criteria

- [ ] `docs/ai/rulings/effect-rulings.json` exists with **≥ 8** rulings — **or fewer, with
      the remainder listed as deferred** where the closed vocabulary cannot yet express them
      (count is subordinate to vocabulary minimalism; never add a verb just to reach 8) —
      each citing a `D-` and carrying non-empty `why`.
- [ ] `effectRulings.test.ts` loads + validates the corpus and runs **one executing
      `node:test` case per ruling** against the real handlers; all green.
- [ ] The **per-ruling non-vacuity self-test** runs: every ruling's `expected`, when
      programmatically perturbed, makes **that** ruling's case fail (proving each asserts on
      handler output, not a setup value) — a standing harness guard, not a one-shot flip.
- [ ] The scenario/expectation unions have runtime drift pins.
- [ ] `finalStateHash` / `PRE_WP080` sentinels **byte-identical** (no gameplay change);
      engine suite green with the new cases added; `pnpm -r build` green.
- [ ] `docs/ai/rulings/README.md` documents the entry shape + the grow-on-demand rule.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — the new ruling cases run + pass;
   record the new total.
2. Run the per-ruling non-vacuity self-test → each ruling reddens when its `expected` is
   perturbed (proves none is vacuous). This is a standing test, not a manual flip.
3. Confirm no `src` handler diff and no hash-sentinel change (`git diff` scope).
4. `pnpm -r build` green.

## Definition of Done

- [ ] All Acceptance Criteria checked.
- [ ] D-24524 landed Active; WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, roadmap counts.
- [ ] No engine behavior change; sentinels byte-identical.

## Reserved Decision (lands at execution)

**D-24524 — the executable effect-rulings corpus.** Validated by a **hand-written runtime
validator (Node built-ins only, no zod — the engine's layer rule)**, with a **per-ruling
non-vacuity self-test** so no ruling can assert on a setup value instead of handler output.
No new code-category is introduced: the corpus (`docs/ai/rulings/`) falls under the existing
`docs` category (docs-only, no runtime consumption) and the validator + harness under
`game-engine`. The harness's read of the corpus JSON is a deliberate **test-harness exemption**
to the `src/rules/` no-I/O rule (code-style pure-helper section), resolved via `import.meta.url`.
A private, hand-authored JSON corpus
(`docs/ai/rulings/effect-rulings.json`) of `scenario → expected → why` card-effect edge-case
rulings, executed by a `node:test` harness against the real engine handlers so rulings cannot
drift from code. Named "effect rulings" (never "LAGN rulings"); the public LAGN surface stays
the verb list + arg shapes only (brief's public/private split). Complements — does not replace
— the replay hash-oracle fixtures (whole-game determinism) and the coverage indices
(implementation status) with focused single-interaction correctness + rationale. The scenario
vocabulary is closed and grows one primitive at a time (the D-24029 discipline); no speculative
DSL. First slice = schema + harness + CI + seed; full-backlog capture is the ongoing grind.
Test corpus only — no runtime consumption, no gameplay/determinism change.

## Lint Gate Self-Review (00.3)

- Scope closed (In/Out); single layer (engine test corpus + harness). ✓
- Dependencies cited (effect subsystems, test helpers, node:test). ✓
- Contract locked (ruling shape + closed unions). ✓
- Determinism: none — test-only, sentinels byte-identical (asserted). ✓
- Reward integrity: every ruling executes (no skip / always-pass); non-vacuous check required. ✓
- No new contract file in the locked sense / canonical array / move / phase beyond the corpus's own drift-pinned unions. ✓
- Files allowlist present; Vision / Funding / API Catalog resolved (N/A justified). ✓
- Naming + public/private split honored (private "effect rulings", not lagn-spec). ✓
- All 21 §00.3 items PASS or N/A-justified; no unmet item.
