# WP-280 — Spectrum: ≥3-Hero-Class Conditional Keyword + Simple-Effect Markup

**User-Visible Surface:** in-game gameplay (ssw2 Silk / Hawkeye hero cards — the 4
plain-English Spectrum abilities now act when the gate passes; the 5 icon-bearing
Spectrum cards now require ≥3 Hero classes to fire their bonus) + `dashboard.legendary-arena.com/coverage`
(the `spectrum` mechanic leaves the unsupported list).

## Goal

Make the printed **Spectrum** keyword execute its rulebook gate. Spectrum
(`data/metadata/keywords-full.json` → *"You can use a card's Spectrum abilities
only if you have at least 3 classes of Hero … Grey S.H.I.E.L.D. Heroes and
normal Sidekicks don't have classes."*) is today an **unrecognized** marker:
`[keyword:Spectrum]` resolves to nothing, so the 5 icon-bearing Spectrum hero
lines fire their bonus **ungated** (a rules violation) and the 4 plain-English
Spectrum hero lines do **nothing at all** (the live `parse-unrecognized` onPlay
hollows). This WP recognizes `[keyword:Spectrum]` as a **conditional gate** — a
new `distinctHeroClassesAtLeast` hero condition (≥3 distinct in-play Hero
classes) attached to the hook — and marks up the simple gated effects so the
affected Silk / Hawkeye hero cards either do their printed thing (when the gate
passes) or are a clean condition-failed no-op (when it doesn't). Net result:
the live `spectrum` onPlay hollows clear, and every Spectrum hero ability now
honors the ≥3-classes rule.

## Assumes

- **WP-021 / WP-022** (hero ability hook parser + `executeHeroEffects`) — ✅ on `main`.
- **WP-179** (`heroClassMatch` / `requiresTeam` conditions evaluated against
  `G.cardTraits[id].heroClass` over `playerZones.inPlay`) — ✅. The new condition
  reuses this exact read path and `evaluateAllConditions` AND-gating.
- **WP-215 / WP-253** (collapsed `reveal` keyword; `[keyword:reveal:N]` →
  `cost-lte N` "reveal top, draw if cost ≤ N") — ✅. The long-range markup reuses it.
- **WP-257** (hollow-effect detector; `unresolvedMarkers` → `parse-unrecognized`)
  — ✅. This WP's honest-partial relies on the WP-257 per-hook + mixed-hook rules.
- **Baseline:** `origin/main` `1ce1ff2e` (recorded per `01.0a §Step 2`).
- **Card data:** `data/cards/ssw2.json` carries the 13 `[keyword:Spectrum]` lines
  (present since the 2026-05-06 pipeline migration). **ssw2 is a non-reproducible
  pipeline set** (`reference_card_pipeline_multistage`) — its markup is edited
  **directly**, never regenerated.

## Context (Read First)

The 2026-06-22 live diagnostics (match `8f3e898…`, after the WP-273 wall-crawl
fix cleared) showed **24 `spectrum` / `onPlay` / `parse-unrecognized`** hollows
on Silk hero cards (`cascading-maneuver`, `long-range-spider-sense`) — the
operator's "cards played without triggering any effects" report. Measurement:
Spectrum is **ssw2-only**, 13 marker lines total:

- **5 hero lines already carry `[icon:…]` markup** (`+2[icon:attack]`,
  `+1[icon:recruit]`, …: `multi-gun`, `jurassic-america`, `patriotic-chomp`,
  `bloodstone-pendant`, `prodigy-of-ulysses-bloodstone`) → they parse to reachable
  effects, so they don't flag hollow — but they fire **ungated**, ignoring the
  ≥3-classes rule. (A 6th icon-bearing `[keyword:Spectrum]` line is on the **villain**
  card `'92 Jubilee` [X-Men '92 group, `Fight: Gain this as a Hero`] — villain parser,
  out of scope.)
- **4 hero lines are plain-English** → the hollows: `Draw a card` ×2
  (`quiver-of-thunderbolts`, `cascading-maneuver`), `Reveal top, draw if ≤2` ×1
  (`long-range-spider-sense`), `Reveal top four, take any totaling ≤2` ×1
  (`borrowed-cloaking-device`).
- The remaining lines are **villain** cards (`Fight:` / `Escape:`,
  `doctor-spectrum` / `pink-sphinx`) — a different parser and a different
  "player *has* Spectrum" semantics; **out of scope**.

**Operator decision (2026-06-22): implement the full gate.** Recognizing
`[keyword:Spectrum]` as the rulebook condition applies to **all 9 hero lines at
once** — which correctly **gates the 5 currently-ungated icon cards** (a
correctness fix that is also a balance nerf) in addition to clearing the 4
hollows. The alternative (mark up the dead effects but leave Spectrum
unrecognized → abilities fire ungated) was rejected as semantically incomplete.

**Single WP, two concerns (engine + card-data), no package-layer crossing.**
The engine change (condition + parser recognition) and the `data/cards/ssw2.json`
markup are one coherent mechanic and must land together: recognizing Spectrum
without the markup would *silence* the plain-English hollows while the cards
still did nothing (the dishonest-partial the WP-257 design forbids). This is
**not** lightweight-lane eligible — it changes existing behavior (the 5 icon
cards) and touches `data/cards`.

**Determinism (corrected at pre-flight — PS-1/PS-2):** the sweep sentinel
`finalStateHash` is **UNCHANGED**. The sentinel replay fixture
(`test/fixtures/games/sentinel-core-doom-2p.replay.json`) is a **core-set Doom**
board (core heroes / `core/dr-doom`) that plays **no ssw2 card**, so gating ssw2
Spectrum cannot move it — an *unchanged* hash is the correct, expected outcome
(NOT a re-pin). The artifacts that legitimately move are: (a)
`hero-effect-coverage.baseline.json`'s **ssw2 row** (the 3 marked-up plain-English
lines flip `noEffect → executable` — a deterministic static-parse delta), and (b)
possibly `runtime-observed-hollows.json` (the sweep's `HERO_DECK_SETS` includes
ssw2 — measured at scaffold). `hero-effect-coverage.baseline.json` carries **no
hash**; do not label its regeneration a "sentinel re-pin."

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; **moves never throw** (only `Game.setup()` may); `G` stays JSON-serializable.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; **no `.reduce()`** in
  condition/effect logic — use `for...of`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — named-export imports,
  descriptive names (`distinctHeroClassesAtLeast`, not `dhc`), full-sentence errors,
  functions ≤ ~30 lines, no premature abstraction. `// why:` on non-obvious decisions.

**Packet-specific:**
- **Spectrum is a CONDITION, not a keyword.** Do NOT add `spectrum` to `HERO_KEYWORDS`
  / `MVP_KEYWORDS` / `HERO_EFFECT_HANDLERS` / `HANDLED_KEYWORDS`. `heroKeywords.ts` stays
  byte-unchanged; the handler-key bidirectional drift test count is unchanged. It rides
  the existing `HeroCondition` path (open `{ type: string; value: string }` shape — no
  closed-union drift array to update).
- **Self-INCLUSIVE count.** The new condition counts the triggering card (you "have" ≥3
  classes); it MUST NOT copy `heroClassMatch`/`requiresTeam`'s `triggeringCardId`
  self-exclusion.
- **Recognize the existing marker; minimal card-data edits.** The `[keyword:Spectrum]`
  lines already exist. The ONLY `data/cards/ssw2.json` edits are the 4 listed
  effect-markup appends; **ssw2 is a non-reproducible pipeline set — edit the JSON
  directly, never run the card pipeline.**
- **Honest fix, honest-partial.** A marked-up Spectrum line MUST execute its effect at ≥3
  classes (not a bare recognition that silences); `borrowed-cloaking-device` MUST keep an
  unresolved placeholder so it stays a reported hollow.
- **Determinism (strict).** The sweep sentinel `finalStateHash` is **UNCHANGED** — the
  sentinel board is core-only (no ssw2). A sentinel divergence is a FAIL to investigate,
  not a re-pin. Only the diagnostics + the ssw2 coverage tally move; regenerate every
  committed coverage artifact in the SAME commit.
- **Engine + its tests + card data + regenerated coverage artifacts + governance only.**
  No `apps/**`, no `packages/registry/**`, no `apps/server/**`, no `ai.legalMoves.ts`, no
  `heroKeywords.ts`.

**Locked Contract Values:**
- Condition `{ type: 'distinctHeroClassesAtLeast', value: '3' }` — distinct non-empty
  `G.cardTraits[id].heroClass` over `playerZones[pid].inPlay`, self-inclusive,
  `>= parseInt(value)`; `NaN` → false. `// why: D-24055`.
- `SPECTRUM_CLASS_THRESHOLD = 3` (rulebook; D-24055).
- Parser: `[keyword:Spectrum]` (any case) → push the condition (NOT a keyword, NOT an
  unresolved marker), before the unresolved-marker fallback.
- Markup tokens: `[keyword:draw:1]` (draw); `[keyword:reveal:2]` = `cost-lte 2` (NOT
  `reveal-min` = `cost-gte`); `[keyword:reveal-multi-take:2]` placeholder on
  `borrowed-cloaking-device`.

## Scope (In)

1. **New hero condition `distinctHeroClassesAtLeast`**
   (`hero/heroConditions.evaluate.ts`): a `case` that counts **distinct
   non-empty** `G.cardTraits[id].heroClass` values across
   `playerZones[pid].inPlay` and returns `count >= parseInt(condition.value, 10)`.
   **Self-INCLUSIVE** — unlike `heroClassMatch`/`requiresTeam`, the triggering
   card is **counted** (you "have" the classes; the played Spectrum card is in
   `inPlay` when `executeHeroEffects` runs). S.H.I.E.L.D. / Sidekick cards carry
   no `heroClass` in `G.cardTraits`, so they contribute nothing automatically.
2. **`SPECTRUM_CLASS_THRESHOLD = 3`** constant (with a `// why:` citing the
   rulebook + D-24055), used to build the condition's `value`.
3. **Parser recognition** (`setup/heroAbility.setup.ts`): in the `[keyword:X]`
   loop, a branch recognizing `spectrum` (case-insensitive) → push
   `{ type: 'distinctHeroClassesAtLeast', value: String(SPECTRUM_CLASS_THRESHOLD) }`
   into the line's conditions (merged like `heroClassMatch` / `requiresTeam`),
   **not** to `unresolvedMarkers` and **not** to `keywords`. Spectrum is a
   condition, never a `HeroKeyword` (`HERO_KEYWORDS` stays unchanged at its
   current length).
4. **Card-data markup** (`data/cards/ssw2.json`, direct edit):
   - `quiver-of-thunderbolts` + `cascading-maneuver`: `[keyword:Spectrum]: Draw a
     card.` → append `[keyword:draw:1]`.
   - `long-range-spider-sense`: `[keyword:Spectrum]: Reveal the top card … If it
     costs 2 or less, draw it.` → append the **`cost-lte` reveal** token
     `[keyword:reveal:2]` (NOT `reveal-min`, which is `cost-gte`; the exact token
     is **scaffold-pinned** — see RS-1).
5. **Honest-partial on `borrowed-cloaking-device`** (`[keyword:Spectrum]: Reveal
   the top four … total cost 2 or less …`): leave an **explicit unresolved
   marker** so the line stays a reported hollow (e.g. `[keyword:reveal-multi-take:2]`,
   an unrecognized token → `parse-unrecognized`). This prevents Spectrum
   recognition from silencing a card that still does nothing. The multi-card
   sum-cost-select reveal primitive is a **named follow-up** (out of scope).
6. **Regenerated coverage artifacts + tests** (the WP-273/275 precedent set).

## Out of Scope

- **Villain Spectrum lines** (`doctor-spectrum`, `pink-sphinx` `Fight:`/`Escape:`)
  — villain parser, "player *has* Spectrum" semantics; untouched.
- **The multi-card sum-cost-select reveal primitive** (`borrowed-cloaking-device`)
  — named follow-up; this WP only keeps it honestly hollow.
- **Any new `HeroKeyword`** — Spectrum is a condition; `HERO_KEYWORDS` /
  `HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` are byte-unchanged.
- **In-game UI** surfacing the gate (a player-facing "needs 3 classes" hint) —
  not modeled here.
- **Other sets** — Spectrum is ssw2-only (measured).
- `apps/**`, `packages/registry/**`, `apps/server/**`,
  `simulation/ai.legalMoves.ts` — byte-unchanged.

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — new condition case.
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — condition tests.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — Spectrum marker → condition + threshold constant.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — parser recognition + no-longer-unresolved tests.
- `data/cards/ssw2.json` — markup on `quiver-of-thunderbolts`, `cascading-maneuver`, `long-range-spider-sense`; honest placeholder on `borrowed-cloaking-device` (direct edit; ssw2 non-reproducible).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — play-time: gated Spectrum hook fires when ≥3 classes, condition-failed (not hollow) when <3; the marked-up lines no longer flag, the placeholder line still flags.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — regenerated (`spectrum` reclassifies).
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated.
- `scripts/coverage/hero-effect-coverage.baseline.json` — regenerated.
- `data/metadata/card-mechanics.json` — regenerated (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — additive `spectrum` entry.
- `scripts/hero-mechanic-ledger.mjs` — **only if** classifying a condition-gate mechanic needs a mapping extension (RS-2; executor's call, folded in-scope if the scaffold shows the ledger mis-classifies `spectrum`).
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24055, D-24056), `STATUS.md`, `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `apps/**`, `packages/registry/**`, `apps/server/**`,
`packages/game-engine/src/simulation/ai.legalMoves.ts`,
`packages/game-engine/src/rules/heroKeywords.ts` (no new keyword) — byte-unchanged.

## Contract

- **`HeroCondition` `distinctHeroClassesAtLeast`** — `{ type:
  'distinctHeroClassesAtLeast', value: '3' }`. Evaluation: distinct non-empty
  `G.cardTraits[id].heroClass` across `playerZones[pid].inPlay`, **self-inclusive**,
  `>= parseInt(value)`. `HeroCondition` stays the open `{ type: string; value:
  string }` shape (no closed-union/drift-array — conditions are not enumerated).
- **Parser:** `[keyword:Spectrum]` (any case) → one
  `distinctHeroClassesAtLeast` condition on the hook; never a keyword, never an
  unresolved marker. The line's printed effect markup supplies the effects the
  gate guards.
- **Threshold:** `SPECTRUM_CLASS_THRESHOLD = 3` (rulebook; D-24055).
- **Markup tokens (scaffold-pinned, RS-1):** `[keyword:draw:1]` (draw a card);
  `[keyword:reveal:2]` = `cost-lte 2` (reveal top, draw if cost ≤ 2).
- **Honest-partial:** `borrowed-cloaking-device` retains an unrecognized
  `[keyword:reveal-multi-take:2]` marker → stays a `parse-unrecognized` hollow.

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior), §2 (card data — read-only
marker recognition + minimal markup of the printed effect), §22 (determinism). **No
conflict.** Makes the printed Spectrum keyword execute as written (the rulebook
≥3-Hero-classes gate); invents no card text and re-marks no existing token. Determinism
preserved — the condition reads only `G` (`cardTraits` / `playerZones`), no RNG; the
sweep sentinel `finalStateHash` is **unchanged** (the sentinel board is core-only).
Non-Goals NG-1..7: none crossed.

## Funding Surface Gate

**N/A — justified.** Gameplay engine + card data only; no funding affordance, copy, or channel.

## API Catalog (§21)

**N/A — justified.** No `apps/server` HTTP endpoint and no `apps/server/src/**`
`Library-only` catalog function is added/modified/removed; the change is an engine
condition/parser + card-data markup + regenerated coverage artifacts. `docs/ai/REFERENCE/api-endpoints.md`
is unaffected.

## Acceptance Criteria

1. `[keyword:Spectrum]` (any case) parses to a single
   `distinctHeroClassesAtLeast` condition on the hook, with no `spectrum`
   `unresolvedMarker` and no `spectrum` in `hook.keywords`.
2. `distinctHeroClassesAtLeast` returns true iff ≥ `value` distinct non-empty
   hero classes are in `inPlay` (self-inclusive); S.H.I.E.L.D./Sidekick (no
   class) never contribute; <3 → false.
3. A marked-up Spectrum hero line (`cascading-maneuver` draw) **executes its
   effect when ≥3 classes are in play** and is a **clean condition-failed no-op
   (NOT hollow)** when <3.
4. The 5 icon-bearing hero Spectrum lines are now **gated** by the same condition
   (their `+attack`/`+recruit` fires only with ≥3 classes) — a behavior change,
   asserted by test.
5. The 3 marked-up plain-English Spectrum lines **no longer flag a
   `parse-unrecognized` hollow**; `borrowed-cloaking-device` **still flags** one
   when played with ≥3 classes (the gate passes → detection runs; honest-partial).
6. `HERO_KEYWORDS` / `HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` are
   byte-unchanged; the handler-key bidirectional drift test is unchanged.
7. The hero mechanic ledger no longer reports `spectrum` as `unsupported` — as a
   `hook.conditions` entry it is invisible to the ledger's mechanic extraction
   (keywords/effects/unresolvedMarkers), so `spectrum` **drops out** of the ledger
   (RS-2: confirm at scaffold whether it vanishes cleanly or needs a mapping
   extension); the committed coverage artifacts are regenerated in the same commit
   and the freshness gates pass.
8. The deterministic sweep sentinel `finalStateHash` is **UNCHANGED** (the
   sentinel board is core-only; gating ssw2 Spectrum cannot move it). The
   coverage-baseline ssw2 row + the runtime-observed delta are recorded at
   scaffold; neither is a hash re-pin.
9. `apps/**`, `packages/registry/**`, `apps/server/**`, `ai.legalMoves.ts`,
   `heroKeywords.ts` are byte-unchanged.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` — clean.
2. `pnpm --filter @legendary-arena/game-engine test` — green; record the count delta.
3. `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`,
   `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` — exit 0
   after regeneration.
4. `node scripts/roadmap-counts.mjs --check` — passes (WP-280 ✅).
5. `git diff --name-only` ⊆ the allowlist; `git diff` empty for the
   explicit-non-change set.
6. Live: a fresh ssw2 match with a Silk loadout downloads diagnostics with **no
   `spectrum` hollow** except the deliberate `borrowed-cloaking-device` one
   (D-24026 post-deploy).

## Definition of Done

- [ ] All Acceptance Criteria satisfied + test-asserted.
- [ ] Mandatory scaffold run + observed result recorded (parse-affecting WP — RS-1).
- [ ] Coverage artifacts regenerated in the same commit; four freshness gates green.
- [ ] Sentinel `finalStateHash` **unchanged** (sentinel board core-only); the
  coverage-baseline ssw2 row + runtime-observed deltas recorded at scaffold.
- [ ] `git diff` confined to the allowlist; explicit-non-change set byte-unchanged.
- [ ] D-24055 + D-24056 flipped Active; `WORK_INDEX` (WP-280 ✅) + `EC_INDEX`
  (EC-311 Done) + `STATUS` + roadmap mindmap updated.
- [ ] D-24026 live-verify queued post-deploy (the `/coverage` `spectrum` flip + a
  Silk-match diagnostics check).

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order pre-flight → copilot → lint, against `origin/main` @ `1ce1ff2e`.

- **Pre-flight (01.4): READY TO EXECUTE (2026-06-23).** Class: **Behavior / State
  Mutation** (a new runtime condition read on the `playCard` → `executeHeroEffects` path;
  changes existing play behavior — gates the icon Spectrum lines; card-data markup).
  Independent review verified against source: `[keyword:reveal:2]` builds `cost-lte 2`
  (draw if cost ≤ 2 — `reveal-min` would be `cost-gte`, wrong); the triggering card is in
  `inPlay` before `executeHeroEffects` runs, so self-inclusion is achievable
  (`coreMoves.impl.ts`); the honest-partial trace holds (`detectHollowHeroHook` flags
  `borrowed-cloaking-device` when the gate passes); `spectrum ∉ HERO_KEYWORDS` keeps the
  drift tests green. Deps WP-021/022/179/215/253/257/259/265 ✅ on `main`. **Three
  documentation defects surfaced + corrected in-place (no design change):** PS-1/PS-2 —
  the sentinel `finalStateHash` is UNCHANGED (the sentinel board is core-only; the moving
  artifacts are the ssw2 coverage row + runtime-observed, neither a hash), corrected from
  a wrong "re-pin / divergence-expected" claim; PS-3 — 5 hero icon + 4 plain-English = 9
  hero lines (the 6th icon Spectrum line is the villain card `'92 Jubilee`, scoped out).
  RS-1 (the honest-partial flag requires the gate to pass) + RS-2 (the condition mechanic
  drops from the ledger rather than "reclassifies") folded in; re-verified residue-free.
  Verdict READY.
- **Copilot check (01.7): PASS (2026-06-23) — disposition CONFIRM.** All 30 failure modes
  clear: layer/boundary lock (engine + card-data only; `apps`/`registry`/`server`/`ai.legalMoves`/`heroKeywords`
  byte-unchanged with a `git diff` step); determinism (#2/#23 — condition reads only `G`,
  `for…of` + `Set`, no `.reduce()`; sentinel-unchanged with correct core-only reasoning);
  contract/extensibility (#4/#5/#21 — open `HeroCondition` shape, no closed-union drift, no
  keyword added); invariants-over-behavior (#11 — each EC Hardened Invariant is binary +
  test-asserted, incl. the honest-fix FAIL condition); loud-vs-silent (#22 — honest-partial
  + `NaN`-safe-skip). The mandatory parse-affecting scaffold (7 observed checks, the token
  pin) is the strongest signal. No RISK/BLOCK.

## Lint Gate Self-Review (`00.3`)

**Verdict: PASS** — all 21 sections resolved (PASS or justified N/A); Final Gate clear.

- **§1 Structure:** PASS — Goal / Assumes / Context (Read First) / Non-Negotiable
  Constraints / Scope (In) / Out of Scope / Files Expected to Change / Contract / Vision
  Alignment / Funding Surface Gate / API Catalog / Acceptance Criteria / Verification Steps
  / Definition of Done all present + non-empty; Out of Scope lists ≥4 exclusions.
- **§2 Constraints:** PASS — Engine-wide block (full file contents, no diffs/snippets,
  ESM/Node v22+, cites `00.6-code-style.md`) + packet-specific + locked contract values
  present; no body contradiction.
- **§3 Assumes:** PASS — each dependency + the exact source shape/read-path it provides,
  the baseline `1ce1ff2e`, and the ssw2 non-reproducible-pipeline external state.
- **§4 Context:** PASS — names the specific files/sections to read + the live diagnostics
  + DECISIONS ids; canonical field names (`heroClass`, `cardTraits`, `inPlay`) honored.
- **§5 Files:** PASS — every changed file listed + dispositioned (new/modified/regenerated/
  conditional); explicit non-change set; single layer (game-engine + its tooling artifacts)
  + the bounded card-data edit.
- **§6 Naming:** PASS — `distinctHeroClassesAtLeast` / `SPECTRUM_CLASS_THRESHOLD` /
  `heroClass` / `inPlay` / `[keyword:reveal:2]` match the codebase; no abbreviations.
- **§7 Dependencies:** PASS — no new npm dep; reuses the condition/parser/reveal infra.
- **§8 Architecture:** PASS — Game Engine layer only (+ CI-gated coverage artifacts + card
  data); `G` runtime-only; condition reads `G` only and is JSON-serializable; no registry
  import; no `.reduce()`; no persistence change.
- **§9 Windows / §10 Env / §11 Auth:** N/A — Node built-ins; no shell-specific paths, env
  vars, or auth surface.
- **§12 Tests:** PASS — `node:test`, `.test.ts`, `makeMockCtx`; no boardgame.io/network/DB;
  determinism preserved.
- **§13 Verification:** PASS — exact `pnpm` / `node` commands with expected exit-0 /
  diff-subset / count-delta outcomes; the live D-24026 check named.
- **§14 Acceptance:** PASS — 9 binary, observable, file/symbol-specific criteria (parse
  shape, gate truth-table, executes-at-≥3 / no-op-at-<3, icon-cards-gated behavior change,
  honest-partial still flags, byte-unchanged sets, sentinel unchanged).
- **§15 Definition of Done:** PASS — STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + the
  scope-boundary (`git diff ⊆ allowlist`) check. **§15.1:** `**User-Visible Surface:**`
  declared (in-game gameplay + `/coverage`) with the D-24026 live-verify DoD item.
- **§16 Code Style:** PASS — EC mandates `for…of` + `Set<string>` (no `.reduce()`), the
  four required `// why:` comments, full-file output, and the self-inclusive count as one
  named single-responsibility case.
- **§17 Vision:** TRIGGERED (card behavior / card data / determinism — §1/§2/§22). `## Vision
  Alignment` present with clause numbers, a no-conflict assertion, and the
  determinism-preservation line.
- **§18 Prose-vs-Grep:** PASS — the verification greps target `spectrum` / diff-subset, not
  forbidden import/RNG tokens; no adjacent prose enumerates forbidden tokens verbatim.
- **§19 Bridge-vs-HEAD:** N/A — WP-280 is not a repo-state-summarizing artifact.
- **§20 Funding Surface:** N/A — justified; touches no funding affordance/copy/channel.
- **§21 API Catalog:** N/A — justified; no `apps/server` HTTP endpoint or `Library-only`
  catalog function added/modified/removed.
