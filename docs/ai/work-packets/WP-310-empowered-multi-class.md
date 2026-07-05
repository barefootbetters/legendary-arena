# WP-310 — Empowered Multi-Class Form (`by [hc:X] and [hc:Y]`)

**Status:** Ready — drafted + gated 2026-07-05 (EC-342; lint self-review PASS). Reserves **D-24098** (D-24096/24097 taken by WP-311/WP-312 after this draft was first written).
**Primary Layer:** Game Engine / Setup (parser)
**Dependencies:** WP-256 (composable primitive substrate + `buildEmpoweredComposition`), WP-267
(empowered core form + `count-cards-by-class-in-zone`), WP-283 (empowered oracle/choose-one
pre-passes), WP-284 (empowered dynamic fallback). All ✅ on `main`.
**User-Visible Surface:** play.legendary-arena.com — `8th-wonder-of-the-world` (and any sibling
multi-class-empowered card) now grants its printed Attack bonus instead of silently no-oping.

> Surfaced 2026-07-05 from a live diagnostic: `antm/wonder-man/8th-wonder-of-the-world` logged
> two `empowered`/`onPlay`/`parse-unrecognized` hollows (turns 16, 22). Its Empowered clause is
> the one printed form the empowered dispatch chain does not yet handle.

---

## Session Context

WP-267 built the empowered core substrate (`count-cards-by-class-in-zone` → `gain-resource`,
`buildEmpoweredComposition(class)`); WP-283/WP-284 added the oracle-choice and deck-peek pre-passes
to the empowered dispatch chain in `heroAbility.setup.ts`. This packet adds ONE more pre-pass for
the multi-class form and reuses `buildEmpoweredComposition` per parsed class — no new primitive,
value-expression, or node type.

---

## Goal

After this session, the empowered parser recognizes the printed multi-class form "you get
[keyword:Empowered] by [hc:X] and [hc:Y]" (two or more classes joined by "and"), emitting one
`buildEmpoweredComposition(class)` primitive per parsed class. A hero card with that clause grants
`+1 Attack per HQ card of each named class` (the sum), instead of falling through to a
`parse-unrecognized` hollow. Clears the `8th-wonder-of-the-world` empowered hollow and any sibling
multi-class-empowered line in the corpus.

---

## User-Visible Impact

A player who plays `8th-wonder-of-the-world` sees its Empowered bonus actually apply to their
Attack total (e.g. +1 per Ranged card and +1 per Strength card currently in the HQ), where before
the card played but the bonus silently did nothing. The change is observable in a live match and
on `dashboard.legendary-arena.com/coverage` (the card's `empowered` row flips out of the
hollow/unsupported bucket).

---

## Assumes

- WP-256/267/283/284 complete. Specifically:
  - `packages/game-engine/src/rules/heroCompositions.ts` exports `buildEmpoweredComposition`
    (per-class `gain-resource` over `count-cards-by-class-in-zone`).
  - `packages/game-engine/src/setup/heroAbility.setup.ts` holds the empowered dispatch chain
    (`tryResolveEmpoweredChooseOneLine`, `tryResolveDrawOrEmpoweredLine`, `tryResolveEmpoweredCore`,
    `tryResolveEmpoweredFreeChoice`, `tryResolveEmpoweredDynamic`) and emits `primitiveEffects` on
    `HeroAbilityHook`.
  - `HeroAbilityHook.primitiveEffects?: EffectNode[]` is executed by `interpretHeroPrimitiveEffect`
    (each entry runs in array order under the conditions-passed gate).
- `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Rule Execution Pipeline` — unknown effects warn-and-continue, never
  throw; the empowered parse-to-primitive path lives here.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read the whole empowered dispatch chain;
  the new pre-pass slots into it and must not disturb the ordering the existing forms rely on.
- `packages/game-engine/src/rules/heroCompositions.ts` — `buildEmpoweredComposition` (reused
  per parsed class; no edit unless a multi-class helper reads cleaner than an emit-loop).
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts §evaluateCountCardsByClassInZone`
  (D-24044) — confirms the per-class count is HQ-scoped, no self-exclusion, tolerant of empty HQ.
- `data/cards/antm.json` — `8th-wonder-of-the-world` printed text (the `[keyword:Empowered] by
  [hc:ranged] and [hc:strength]` clause). Confirm the marker form before writing the regex.
- `data/metadata/keywords-full.json §empowered` — the printed rule ("+1 Attack per class card in
  the HQ") the composition realizes.
- `docs/ai/work-packets/WP-283-empowered-oracle-choice-forms.md` + `WP-284-*` — the precedent
  pre-pass shape to mirror.
- `docs/ai/DECISIONS.md` — scan D-24044 / D-24063..D-24066 (empowered form decisions).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- No `Math.random()`; all randomness via `ctx.random.*`.
- Moves never throw; only `Game.setup()` may throw. The parser warns on an unresolved tail.
- `G` never persisted; JSON-serializable at all times.
- `.reduce()` forbidden in effect application — `for...of` only.
- ESM only; `node:` prefix; `.test.ts` tests; full-file outputs.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Reuse `buildEmpoweredComposition` per parsed class — do NOT invent a `'multi-empowered'`
  keyword, a new `ValueExpression`, or a new `EffectNode` type (the substrate already sums via
  multiple `gain-resource` primitives).
- The new pre-pass recognizes ONLY the "Empowered by [hc:X] and [hc:Y] (and [hc:Z]…)" tail with an
  anchored regex; it must not broaden the single-class `tryResolveEmpoweredCore` match or the
  choose-one path.
- **Honest-partial:** the compound HQ-choose prefix on `8th-wonder-of-the-world` ("Choose any
  number of cards from the HQ. Put them on the bottom of the Hero Deck.") is OUT of scope — that
  clause stays an unresolved marker / reported hollow (a named follow-up), exactly as the WP-283
  honest-partial pattern leaves unhandled clauses reported.
- `data/cards/*.json` byte-unchanged (the `[keyword:Empowered]` marker is already printed).

**Session protocol:**
- If the corpus contains a 3+-class "and"-list or an Oxford-comma form the regex would miss, STOP
  and confirm the exact grammar before broadening — never guess the class-list separator rules.

**Locked contract values:**
- Empowered grant resource = `attack` (per `buildEmpoweredComposition`); count zone = `hq`
  (`EFFECT_COUNT_ZONE_KINDS = ['hq']`).

---

## Debuggability & Diagnostics

- Deterministic: the parse-to-primitive translation is pure; given the same card text it emits the
  same primitive array. The grant is deterministic at play time (HQ contents + `cardTraits`).
- Observable: a played multi-class-empowered card resolves via `interpretHeroPrimitiveEffect`,
  whose per-primitive warnings already surface to `G.messages`; the empowered hollow no longer
  fires for the recognized line.
- `G` stays JSON-serializable; no new runtime field.

---

## Scope (In)

### A) Multi-class empowered pre-pass
- **`packages/game-engine/src/setup/heroAbility.setup.ts`** — modified:
  - Add `tryResolveEmpoweredMultiClass(ability, lineIndex)` in the empowered dispatch chain,
    positioned AFTER `tryResolveEmpoweredCore` (single-class) and BEFORE the free-choice/dynamic
    fallbacks, so the single-class and choose-one forms are unaffected.
  - Anchored regex matches the marker tail `by [hc:A] and [hc:B]` (extendable to an N-class
    "and"-joined list); extract each `hc:` class token in printed order.
  - For each parsed class, push `buildEmpoweredComposition(class)` onto the hook's
    `primitiveEffects` (array order = printed order; sum is commutative but order is fixed for
    determinism).
  - On match, suppress the per-token empowered dispatch for that line (the `processedAs*` flag
    pattern the choose-one path uses).
  - `// why:` on the ordering (after core, before fallbacks) and on the reuse-per-class decision.

### B) Tests
- **`packages/game-engine/src/setup/heroAbility.setup.test.ts`** — modified:
  - Two-class line → two `buildEmpoweredComposition` primitives with the two named classes, in
    printed order; the line is not left as an unresolved marker.
  - A single-class line still routes through `tryResolveEmpoweredCore` (regression: the new
    pre-pass did not capture it).
  - The `8th-wonder-of-the-world` HQ-choose prefix clause remains reported as an unresolved
    marker (honest-partial proof).
  - `JSON.stringify(G)` succeeds after a play that applies the composition.

### C) Coverage-artifact regeneration (card-data-derived gates)
- Regenerate every `:check`-gated feed that observes empowered coverage, so CI stays green:
  `pnpm ledger:heroes` (+`:check`), `pnpm sim:coverage --update-baseline` (+`--check`),
  `pnpm sim:runtime-observed` (+`:check`), and `mechanics:metadata` if the mechanic vocabulary
  feed moves. Confirm which feeds actually change by running each `--check` first.

---

## Out of Scope

- **The compound HQ-choose prefix** on `8th-wonder-of-the-world` (choose HQ cards → bottom of Hero
  Deck) — a separate interactive effect; stays a reported hollow (named follow-up).
- **The `wtif` "Empowered by multicolored cards" oracle form** — a distinct oracle criterion, not
  a class-list; its own WP.
- **Double/Triple/Quadruple Empowered** (multiplier) and **villain/mastermind/henchman** empowered
  — out of hero scope.
- No new `HeroKeyword`, `ValueExpression`, or `EffectNode` type; no `data/cards` edit; no move,
  server, or UI change.

---

## Files Expected to Change

- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — multi-class pre-pass.
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — parse + honest-partial
  tests.
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified (only if)** a small
  multi-class helper reads cleaner than an inline per-class emit loop (duplicate-first: prefer the
  loop unless a helper is clearly warranted).
- Regenerated coverage artifacts under `docs/ai/coverage/**` + `scripts/coverage/**` — **modified**
  — the empowered rows that flip out of hollow.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24098), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close.

No other files may be modified.

---

## Acceptance Criteria

### Parser
- [ ] `tryResolveEmpoweredMultiClass` emits one `buildEmpoweredComposition` primitive per parsed
      class for a "by [hc:X] and [hc:Y]" line, in printed order.
- [ ] A single-class "by [hc:X]" line is unchanged (still routed by `tryResolveEmpoweredCore`).
- [ ] The multi-class line is NOT recorded as an unresolved `empowered` marker.
- [ ] No new `HeroKeyword` / `ValueExpression` / `EffectNode` type added (drift arrays unchanged;
      confirmed with `Select-String` on the canonical arrays).

### Honest-partial
- [ ] The `8th-wonder-of-the-world` HQ-choose prefix clause remains a reported hollow (its own
      unresolved marker), proven by a test.

### Determinism / coverage
- [ ] Sentinel `finalStateHash` unchanged (the deterministic sweep fixture is core-only — verify;
      if a multi-class card enters the sweep, re-pin is EXPECTED and documented).
- [ ] All `:check`-gated coverage feeds regenerated and green.

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] No `boardgame.io` import in the parser or its test.

### Scope
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; multi-class + honest-partial + single-class-regression cases green

# Step 3 — no new keyword/value-expression/node type
Select-String -Path "packages\game-engine\src\rules\effectPrimitive.types.ts" -Pattern "multi"
# Expected: no output (no new union member)

# Step 4 — coverage feeds current
pnpm ledger:heroes:check ; pnpm sim:coverage --check ; pnpm sim:runtime-observed:check
# Expected: each exits 0, no regeneration/diff (after the regen commit)

# Step 5 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **Live-on-surface (D-24026):** confirmed live on play.legendary-arena.com — play
      `8th-wonder-of-the-world` in a match and observe the Empowered Attack bonus apply (or a
      diagnostics check showing the empowered hollow cleared for the card), with the
      deploy-confirmed SHA.
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Sentinel `finalStateHash` unchanged (or re-pin documented).
- [ ] All `:check`-gated coverage feeds green.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated — multi-class empowered now executes.
- [ ] `docs/ai/DECISIONS.md` updated — D-24098 (multi-class empowered = per-class composition sum;
      HQ-choose prefix deferred).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-310 checked off with date.

---

## Vision Alignment

> §17 triggered: card content semantics (Vision §1, §2, §10) and determinism (§3, §8).

- **Vision clauses touched:** §1/§2/§10 (card content fidelity — makes a printed effect execute),
  §3/§8 (determinism/replay). No monetization, scoring, identity, or multiplayer-sync clause.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It makes a printed
  card effect faithful to its text; the parse-to-primitive path is deterministic and replay-safe.
- **Non-Goal proximity check:** none of NG-1..7 crossed (no paid/persuasive/competitive surface).
- **Determinism preservation:** the composition is built from committed state (HQ + `cardTraits`),
  emitted in fixed printed order, summed via existing deterministic primitives; replay-faithful
  (Vision §22). Sentinel `finalStateHash` unchanged unless a multi-class card enters the sweep
  fixture (then a documented re-pin).

---

## Execution Lane (resolved at gating 2026-07-05)

**Scaffold-first, then a conditional lane.** This is a small additive parser change (recognizes a
previously-unresolved marker) with `data/cards` byte-unchanged, but it (a) touches the Game Engine
setup layer, (b) recognizes **new input** (which 01.0a Step 3 requires be scaffolded before
drafting the final shape), and (c) regenerates several card-data-derived `:check`-gated coverage
feeds (a known drift surface — see `feedback_card_data_derived_ci_gates`). Decision:

- **Execution opens with a scaffold run** (per 01.0a Step 3 / the WP-290 empowered precedent):
  add the anchored regex against the real `8th-wonder-of-the-world` marker text, confirm it emits
  the expected per-class primitives, and run the deterministic sweep + full engine suite.
- **If the scaffold shows the sentinel `finalStateHash` is unchanged (core-only sweep fixture) AND
  no existing fixture breaks**, the remainder MAY run in the **D-24028 lightweight lane** (single
  session, inline EC amendments).
- **Otherwise (hash re-pin needed, or any fixture breaks), run the standard two-session lane.**

Default to standard if the scaffold result is ambiguous. Either way, the coverage-feed regeneration
(Scope §C) must complete before the PR — the `:check` gates are repo-wide and reddening.

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. All applicable sections resolved. Verdict: **PASS.**

- **§1 Structure** — PASS. Goal, Assumes, Context, Scope In, Out of Scope (≥2 exclusions: the
  HQ-choose prefix; the `wtif` multicolored oracle form; multiplier/villain empowered), Files,
  Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition of Done all
  present and non-empty.
- **§2 Constraints** — PASS. Engine-wide (no `Math.random`, moves-never-throw, `G` not persisted,
  no `.reduce()` in effect application, ESM/`node:`/`.test.ts`, 00.6 code style) + packet-specific
  (reuse `buildEmpoweredComposition`, anchored regex only, honest-partial, `data/cards`
  byte-unchanged) + session protocol (STOP on an unforeseen 3+-class / Oxford-comma grammar) +
  locked values (grant `attack`, count zone `hq`).
- **§3 Assumes** — PASS. WP-256/267/283/284 complete; the exact substrate symbols
  (`buildEmpoweredComposition`, the empowered dispatch chain in `heroAbility.setup.ts`,
  `HeroAbilityHook.primitiveEffects: EffectNode[]`) verified present on `main` at gating.
- **§4 Context** — PASS. ARCHITECTURE §Rule Execution Pipeline, `heroAbility.setup.ts`,
  `heroCompositions.ts`, `effectPrimitive.interpret.ts §evaluateCountCardsByClassInZone` (D-24044),
  the `antm.json` printed text, `keywords-full.json §empowered`, the WP-283/284 precedent, and the
  empowered D-entries cited specifically.
- **§5 Files** — PASS. Code surface = `heroAbility.setup.ts` + its test (+ conditional
  `heroCompositions.ts` helper only if clearly warranted); the rest are generated coverage
  artifacts + governance ledgers. Single engine layer.
- **§6 Naming** — PASS. `tryResolveEmpoweredMultiClass` mirrors the sibling `tryResolveEmpowered*`
  chain; no abbreviation; no 00.2 field renamed. Locked `attack` / `hq` match the substrate.
- **§7 Dependency discipline** — PASS. No new npm dependency; reuses the WP-256 substrate. Explicit:
  no new `HeroKeyword` / `ValueExpression` / `EffectNode` type.
- **§8 Architectural boundaries** — PASS. Game-Engine-only; setup-time parser; no `boardgame.io`
  import in the parser or its test; no `G` state surface; no server/UI/`data/cards` edit. Warn-and-
  continue on an unresolved tail (never throws).
- **§9 Windows compat** — PASS. Verification uses `pwsh` + `Select-String` + `\` paths.
- **§10 Env vars** — N/A. None introduced or referenced.
- **§11 Auth** — N/A. No auth surface touched.
- **§12 Tests** — PASS. `node:test` + `.test.ts`; parse (two-class), regression (single-class still
  via core), honest-partial (HQ-choose prefix stays reported), and `JSON.stringify(G)` covered; no
  `boardgame.io` import in the test.
- **§13 Verification** — PASS. `pnpm --filter` build/test + exact `Select-String` (drift-array +
  `multi` union checks) + the coverage `:check` gates, expected output inline.
- **§14 Acceptance Criteria** — PASS. Binary, symbol-specific, grouped (Parser / Honest-partial /
  Determinism-coverage / Tests / Scope); each maps to a Verification Step.
- **§15 Definition of Done** — PASS. §15.1: `User-Visible Surface = play.legendary-arena.com`
  declared; DoD carries a live-on-surface item (play `8th-wonder-of-the-world`, observe the bonus /
  hollow cleared) not satisfiable by tests + merge alone (D-24026).
- **§16 Code style** — PASS. Small pre-pass function, JSDoc, `// why:` on the ordering + reuse-per-
  class, explicit `for...of` emit (no `.reduce()`), no premature abstraction (helper only if a
  third use warrants it).
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §1/§2/§10 (card fidelity) +
  §3/§8/§22 (determinism/replay) cited; no-conflict + determinism-preservation line included;
  NG-1..7 not crossed.
- **§18 Prose-vs-grep** — PASS. Verification greps target `multi` on the types file and the
  canonical drift arrays; no adjacent prose enumerates forbidden tokens without a cite.
- **§19 Bridge-vs-HEAD** — N/A at lint (commit-time discipline; the drafting commit re-checks).
- **§20 Funding Surface Gate** — N/A. Card-semantics engine change; no funding affordance / copy.
- **§21 API Catalog** — N/A. No HTTP endpoint or `apps/server` library function touched (engine /
  setup only).
