# WP-364 — `gain-wound-self` / `gain-wound-each` Hero Keywords (Crazed Rampage family — "gain a Wound")

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: two new members of the closed `HeroKeyword` union + a new executor that mutates the shared Wound supply pile; un-defers a `DEFERRED_BY_DESIGN_MECHANICS` slice). Pairs with **EC-395** (renumbered from EC-391 at execution — WP-361 landed EC-391 first). Reserves **D-24156** (lands at execution).
**Primary Layer:** Game Engine / Implementation (+ card-data pipeline)
**Dependencies:** WP-021, WP-022 (hero ability hook pipeline); WP-017 (`gainWound` helper + Wound supply pile); WP-316 (the villain `gainWoundEachPlayer` per-target loop this executor mirrors)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-021/022 established the hero ability hook pipeline (`heroAbility.setup.ts` marker parsing → `HeroEffectDescriptor` → `HERO_EFFECT_HANDLERS` executors). WP-017 shipped the Wound supply pile (`G.piles.wounds`) and the `gainWound(woundsPile, discard)` helper that deposits one wound into a player's discard. WP-316 wired that helper into the villain effect pipeline for `gainWoundEachPlayer` (per-target loop over players, with the active-player `woundsDrawn` bump). This packet reuses all three: it adds the **hero-side** door to the exact same wound mechanic for cards whose printed text is the plain "gain a Wound" form, and clears them from the hollow list.

A live diagnostics capture (`matchId sGTM7LWSIHy`, `gitSha 5f8dafa`, 2026-07-12) shows Hulk's **Crazed Rampage** ("Each player gains a Wound.") played twice with **no effect**: the Wound supply pile stayed at 30 and the player gained 0 wounds. Root cause is two stacked gaps: (1) the printed line is bare prose with no marker, so the parser emits nothing; and (2) the generic hero `wound` keyword is in `DEFERRED_BY_DESIGN_MECHANICS` (no handler). Neither gap needs the "targeting UI" the generic deferral cites — a gained wound goes to discard, no target selection.

---

## Goal

After this session, `@legendary-arena/game-engine` executes the plain **"gain a Wound"** hero ability in its two printed shapes, via two new `HeroKeyword` members: `'gain-wound-self'` ("You gain a Wound." / "Gain a Wound.") and `'gain-wound-each'` ("Each player gains a Wound."). Concretely: the two union/canonical-array entries, single-segment marker tokens `[keyword:gain-wound-self]` / `[keyword:gain-wound-each]` recognized by `heroAbility.setup.ts`, one shared executor registered in `HERO_EFFECT_HANDLERS` under both keys that mirrors the WP-316 villain `gainWound` per-target loop (`self` = active player only; `each` = every player in `G.playerZones`), marker rows for the seven affected hero-card ability lines in the card-data pipeline, and the regenerated card JSONs + hero-mechanic ledger. The generic `wound` keyword **stays deferred** — only the plain no-target form is un-deferred (honest partial). Crazed Rampage and its `self`-form siblings stop being silent no-ops.

---

## User-Visible Impact

A player who plays Crazed Rampage now sees every player gain a Wound (the Wound supply pile drops, a wound enters each player's discard) and a game-log line reporting it. A player who plays a `self`-form card (Colossus **Draw Their Fire**, Human Torch **Hothead**, Luke Cage **Reckless**, Hulkling **Half-Kree**) gains one Wound to their own discard with a log line. Today all of these visibly do nothing beyond their printed stat line — a wound the player *should* take is silently skipped, which in a competitive/multiplayer match is a real rules divergence (a table-wide penalty that never lands).

---

## Assumes

- WP-021/WP-022 complete. Specifically:
  - `packages/game-engine/src/rules/heroKeywords.ts` exports the `HeroKeyword` union + `HERO_KEYWORDS` canonical array (+ its drift test asserts array ↔ union).
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports `HeroEffectDescriptor` — this contract file is **NOT** modified by this packet (the two new keywords carry no magnitude/reward/target field; each keyword name encodes its own target, so no descriptor field is added).
  - `packages/game-engine/src/setup/heroAbility.setup.ts` implements the `[keyword:X]` marker-extraction pipeline; a plain single-segment keyword (no colon segments) is the simplest extraction shape already present.
  - `packages/game-engine/src/hero/heroEffects.execute.ts` exports `HANDLED_KEYWORDS`, `MVP_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, and the `HERO_EFFECT_HANDLERS` registry; handlers receive `(G, ctx, playerID, cardId, effect)`.
- WP-017 complete: `packages/game-engine/src/board/wounds.logic.ts` exports `gainWound(woundsPile, discard)` returning `{ woundsPile, discard }` (moves one wound from the supply into the target discard); `G.piles.wounds` is the Wound supply pile.
- WP-316 complete: `packages/game-engine/src/villain/villainEffects.execute.ts` contains the `gainWound` per-target loop (target `'each'` iterates `G.playerZones`, guards `G.piles.wounds.length === 0`, and bumps `G.turnEconomy.woundsDrawn` for the active player) — the exact loop this hero executor mirrors.
- `DEFERRED_BY_DESIGN_MECHANICS` (`packages/game-engine/src/diagnostics/hollowEffect.types.ts`) contains `'wound'` and `'conditional'`; **neither is removed** — the new keywords are distinct tokens, so the generic `wound` deferral is untouched.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` + `scripts/convert-cards/inputs/hero-ability-markers.json` exist (WP-216 pipeline).
- `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0. **Absolute test/suite baseline is captured at execution-prep** against `origin/main @ c3890370` (the WP-356 baseline of 1877/438 is stale post-WP-357/358); this WP asserts the **delta**, not an absolute.
- `docs/ai/DECISIONS.md` exists; **D-24156** is reserved for this packet.
- Baseline: `origin/main @ c3890370` (2026-07-11).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Architectural Principles` — "The Rule Execution Pipeline" (unknown effects warn and continue, never throw) and "Persistence Boundaries". The executor introduces **no** new `ctx.random.*` consumer (wound draw is top-of-pile, deterministic).
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` and `.claude/rules/architecture.md §Layer Boundary` — the engine edit imports no registry or boardgame.io in pure-helper files.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — read the `gainWound` per-target loop (the `target: 'each'` case, the empty-pile guard, the `woundsDrawn` bump). This packet's executor mirrors it exactly so hero and villain wound-gain are behaviourally identical.
- `packages/game-engine/src/board/wounds.logic.ts` — read `gainWound`'s signature and return shape before calling it.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `HANDLED_KEYWORDS`, `MVP_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, the `heroEffectRescue` handler (the closest existing pile-moving + `pushLog` pattern), and the `HERO_EFFECT_HANDLERS` registration block.
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — read `DEFERRED_BY_DESIGN_MECHANICS`; confirm `'wound'` stays and the two new keywords are simply added to the handled set (never to the deferred set).
- `docs/ai/DECISIONS.md` — scan D-24019 (keyword grammar precedent), D-24081 (`G.messages` hash exclusion), D-24033 (per-hook hollow rule — the two new keywords become reachable `applied`).
- `docs/ai/REFERENCE/00.2-data-requirements.md §Hero card fields` — ability text + marker conventions.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 9 (`node:` prefix), Rule 11 (full-sentence messages), Rule 13 (ESM only).
- `data/cards/{3dtc,core,msp1,cvwr,dkcy,ff04}.json` — confirm the seven ability lines verbatim + their `abilityIndex` before editing the marker map.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (this packet consumes NO randomness; the wound draw is top-of-pile deterministic).
- Never throw inside boardgame.io move functions — return void on invalid input.
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Persistence Boundaries.
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions.
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files use `.test.ts`.
- No database or network access inside move functions or pure helpers.
- Full file contents for every new or modified file in the output — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no `.reduce()` in the changed files.

**Packet-specific:**
- `packages/game-engine/src/rules/heroAbility.types.ts` must NOT be modified — no new `HeroEffectDescriptor` field. Each keyword name encodes its target (`-self` / `-each`); the executor branches on the keyword, not on a descriptor field.
- `DEFERRED_BY_DESIGN_MECHANICS` must retain `'wound'` and `'conditional'` unchanged — this packet un-defers **only** the plain no-target form, by adding two NEW keywords, never by loosening the generic `wound` entry. Every targeting / conditional wound form (Wound the Mastermind, Wound a Villain, reveal-a-Hero-or-gain-a-Wound, board-attached wounds) stays a hollow (the Honest-Partial Invariant, matching WP-272 / WP-256's discipline).
- The wound draw is **top-of-pile deterministic** (`G.piles.wounds[0]` via `gainWound`) — no RNG, replay-faithful. Do not shuffle or randomize.
- `each` iterates the players in a **fixed deterministic order** (sorted `Object.keys(G.playerZones)`, matching the villain path) so replay is identical.
- Empty Wound supply (`G.piles.wounds.length === 0`) is a legitimate no-op per target — skip that target and append a `G.messages` line naming the empty supply (mirrors the `heroEffectRescue` empty-supply logging, D-24017), never throw.
- Both keywords append one human-readable `G.messages` line naming the card and the wound(s) gained (D-24081: messages are hash-excluded, so log lines are replay-safe).
- Both keywords are added to `NO_MAGNITUDE_KEYWORDS` (a "gain a Wound" is exactly one wound; there is no magnitude segment and the pre-gate must not reject them for a missing magnitude), and to `HANDLED_KEYWORDS` / `MVP_KEYWORDS` via a `HERO_EFFECT_HANDLERS` entry.
- Every `ctx.events.*` / phase / turn call: none introduced (no `// why:` phase comments needed).

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human before proceeding — never guess or invent field names, type shapes, or file paths.

**Locked contract values:**

- **Keyword slugs (union + canonical array + marker token):** `gain-wound-self`, `gain-wound-each`
- **Marker token grammar (single-segment plain keyword):** `[keyword:gain-wound-self]` and `[keyword:gain-wound-each]` (no colon segments, no magnitude).
- **Descriptor emitted by the parser:** `{ type: 'gain-wound-self' }` and `{ type: 'gain-wound-each' }` — no `magnitude`, no `rewardType`, no new field.
- **The seven data rows** (set / heroSlug / cardSlug → token; exact `abilityIndex` verified at execution):
  - `core` / `hulk` / `crazed-rampage` → `[keyword:gain-wound-each]`
  - `3dtc` / `hulk` / `crazed-rampage` → `[keyword:gain-wound-each]`
  - `msp1` / `hulk` / `crazed-rampage` → `[keyword:gain-wound-each]`
  - `cvwr` / `hulkling` / `half-kree` → `[keyword:gain-wound-self]`
  - `cvwr` / `luke-cage` / `reckless` → `[keyword:gain-wound-self]`
  - `dkcy` / `colossus` / `draw-their-fire` → `[keyword:gain-wound-self]`
  - `ff04` / `human-torch` / `hothead` → `[keyword:gain-wound-self]`
- **PlayerZones keys:** `deck` | `hand` | `discard` | `inPlay` | `victory`
- **Wound supply pile:** `G.piles.wounds` (WP-017)

---

## Debuggability & Diagnostics

- Behavior is fully reproducible given identical setup + ordered moves — the wound draw is top-of-pile, RNG-free.
- Execution is externally observable: the `each`/`self` branch changes `G.piles.wounds` and the target player(s)' `discard`; both branches append a `G.messages` line naming the card and the wounds gained; the active player's `woundsDrawn` bumps in parity with the villain path.
- Runtime state stays JSON-serializable; no cross-packet state mutated outside declared scope.
- The pre-existing hollow-effect detector (WP-257 / D-24033) stops classifying these hooks as no-effect once the handler is reachable — the runtime-observed hollows artifact is re-checked at close.

---

## Scope (In)

### A) Keyword contract (`packages/game-engine/src/rules/heroKeywords.ts` — modified)
- Add `'gain-wound-self'` and `'gain-wound-each'` to the `HeroKeyword` union AND to `HERO_KEYWORDS`, each with a `// why: D-24156` comment describing the mandatory immediate wound-to-discard semantics and the self-vs-each target.

### B) Marker parser (`packages/game-engine/src/setup/heroAbility.setup.ts` — modified)
- Extend the plain-keyword recognition so `[keyword:gain-wound-self]` and `[keyword:gain-wound-each]` each emit exactly one `{ type }` descriptor (they are single-segment keywords; no new pattern constant is needed beyond registering them as recognized keywords, mirroring how existing no-segment keywords parse). Add a `// why: D-24156` comment.

### C) Executor (`packages/game-engine/src/hero/heroEffects.execute.ts` — modified)
- Add both keywords to `NO_MAGNITUDE_KEYWORDS`, `HANDLED_KEYWORDS`, and `MVP_KEYWORDS`.
- `heroEffectGainWound(G, ctx, playerID, cardId, effect): void` — one shared handler, registered under both keys:
  - resolve the target set: `effect.type === 'gain-wound-self'` → `[playerID]`; `'gain-wound-each'` → sorted `Object.keys(G.playerZones)` (`// why:` deterministic order for replay);
  - for each target player: if `G.piles.wounds.length === 0`, `pushLog` an empty-supply line and continue; else `const result = gainWound(G.piles.wounds, zones.discard)`, assign `G.piles.wounds` and `zones.discard` from the result, and (matching WP-316) bump `G.turnEconomy.woundsDrawn` when the target is the active player;
  - `pushLog` one summary line naming the card and the wound(s) gained.
- Register `heroEffectGainWound` under `'gain-wound-self'` and `'gain-wound-each'` in `HERO_EFFECT_HANDLERS`.

### D) Card-data pipeline
- **`scripts/convert-cards/inputs/hero-ability-markers.json`** — modified: append the seven rows from Locked Values (exact `abilityIndex` verified against the source JSONs at execution).
- **`scripts/convert-cards/apply-hero-ability-markers.mjs`** — modified: extend `VALID_TOKEN_PATTERN` with `^\[keyword:gain-wound-(self|each)\]$` plus a `// why: D-24156` line.
- **`data/cards/{3dtc,core,msp1,cvwr,dkcy,ff04}.json`** — modified by running the apply script (exactly 7 ability lines gain a trailing marker; idempotent re-run is a zero-diff — scaffold-verified at execution).
- **`docs/ai/coverage/hero-mechanic-ledger.csv`** (+ `.json`) — regenerated via `pnpm ledger:heroes` (the marker change stales `ledger:heroes:check`).

### E) Tests
Add `node:test` tests (each new group in exactly one `describe()` — suite count is locked):
- **`packages/game-engine/src/rules/heroKeywords.test.ts`** — modified: one `describe` asserting both new keywords are in `HERO_KEYWORDS` and the array ↔ union drift test still passes.
- **`packages/game-engine/src/rules/heroAbility.setup.test.ts`** — modified: one `describe` — (1) `[keyword:gain-wound-self]` → one `{ type: 'gain-wound-self' }` descriptor; (2) `[keyword:gain-wound-each]` → `{ type: 'gain-wound-each' }`; (3) the marker does not leak into the parsed condition/keyword set beyond the one effect.
- **`packages/game-engine/src/hero/heroEffects.execute.test.ts`** — modified: one `describe` — (1) `self` → one wound leaves `G.piles.wounds`, enters the active player's discard, `woundsDrawn` bumps by 1; (2) `each` with 2 players → both discards gain a wound, pile drops by 2; (3) empty wound pile → no-op + a `G.messages` empty-supply line, no throw; (4) both branches append a summary `G.messages` line; (5) `JSON.stringify(G)` succeeds after each branch; (6) the `wound` generic keyword is still classified `deferred` (regression guard on the un-defer boundary).
- All tests use `makeMockCtx` / plain structural mocks; no `boardgame.io` imports in test files.

---

## Out of Scope

- **Every non-plain hero wound form stays deferred** (the Honest-Partial Invariant): "Wound the Mastermind / a Villain / each Villain", "Wounded Fury", reveal-a-Hero-**or**-gain-a-Wound (a choice), and all board-attached "Wound on Killmonger/Preyy/…" variants (the 40 non-plain hero wound abilities enumerated at draft). Each stays a runtime hollow and a future WP's target.
- No change to the generic `wound` keyword or to `DEFERRED_BY_DESIGN_MECHANICS`'s membership beyond leaving it intact.
- No change to `packages/game-engine/src/rules/heroAbility.types.ts` (no new descriptor field).
- No new move, no pending-choice queue, no UIState projection, no arena-client change — the effect is mandatory and immediate (no player choice → no pending-choice hard-freeze class).
- No change to the villain wound pipeline, `wounds.logic.ts`, or the cleanup/draw pipeline.
- No VP-scoring change (the flat-VP table + wound VP penalty are a separate concern).
- No database, network, or filesystem access in any helper; no server changes.
- Refactors / cleanups / "while I'm here" improvements are out of scope unless explicitly in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + canonical array (two entries)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — recognize the two plain keywords
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — shared executor + registration + NO_MAGNITUDE/HANDLED/MVP set membership
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — drift/registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — parser tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — executor tests
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 7 rows
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — VALID_TOKEN_PATTERN branch + `// why:`
- `data/cards/3dtc.json`, `data/cards/core.json`, `data/cards/msp1.json`, `data/cards/cvwr.json`, `data/cards/dkcy.json`, `data/cards/ff04.json` — **modified** — regenerated (7 ability lines gain markers)
- `docs/ai/coverage/hero-mechanic-ledger.csv` + `.json` — **modified** — regenerated (`pnpm ledger:heroes`)
- `docs/ai/STATUS.md` — **modified** — session close
- `docs/ai/DECISIONS.md` — **modified** — D-24156 flips reserved → Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-364 checked off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-395 row (renumbered from EC-391 — WP-361 landed EC-391 first)
- `docs/05-ROADMAP-MINDMAP.md` + roadmap counts artifact — **modified** — node added, `pnpm roadmap:counts --write` (close ritual)

No other files may be modified. Run all four card-data-derived `:check` gates (`ledger:heroes`, `mechanics:metadata`, `sim:runtime-observed`, `roadmap:counts`) before pushing — regenerate any that report stale in the same commit.

---

## Vision Alignment

- **Vision clauses touched:** §1 (faithful card content semantics), §2 (content fidelity), §3 (trust & fairness — a printed penalty must actually land), §8 (determinism/RNG sourcing), §22 (deterministic eval).
- **Conflict assertion:** No conflict — this WP makes a printed effect faithful and consumes no randomness.
- **Non-Goal proximity check:** N/A — no monetization/leaderboard/identity/paid surface; VP scoring is explicitly out of scope.
- **Determinism preservation:** the wound draw is top-of-pile (`G.piles.wounds[0]`); the `each` loop iterates a sorted key order; given identical setup + moves the result replays identically (Vision §22). `G.messages` additions are hash-excluded (D-24081).

## Funding Surface Gate

N/A — engine keyword + card-data change only; no UI funding affordances, no user-visible funding copy, no funding channels referenced (§20.1 trigger surfaces absent).

## API Catalog (00.3 §21)

N/A — no HTTP endpoints added/modified/removed/re-statused; no `apps/server/src/**` library functions touched (engine + card-data pipeline only).

---

## Acceptance Criteria

### Keyword contract
- [ ] `HeroKeyword` union and `HERO_KEYWORDS` both contain `'gain-wound-self'` and `'gain-wound-each'`; the array ↔ union drift test passes with the updated count.
- [ ] `heroAbility.types.ts` is byte-identical to `origin/main` (`git diff` empty).
- [ ] `DEFERRED_BY_DESIGN_MECHANICS` still contains `'wound'` and `'conditional'` (`git diff` shows no removal).

### Parser
- [ ] `[keyword:gain-wound-self]` on a synthetic ability line yields exactly one effect `{ type: 'gain-wound-self' }`; `[keyword:gain-wound-each]` yields `{ type: 'gain-wound-each' }`.
- [ ] The marker does not leak into the parsed condition set or add other keywords.

### Executor
- [ ] `self` → one wound leaves `G.piles.wounds`, enters the active player's discard, `G.turnEconomy.woundsDrawn` rises by 1.
- [ ] `each` (2-player mock) → each player's discard gains one wound, `G.piles.wounds` drops by 2, iteration order deterministic.
- [ ] Empty wound pile → silent no-op with a `G.messages` empty-supply line; no `throw` (confirmed with `Select-String`).
- [ ] Both branches append one summary `G.messages` line; `JSON.stringify(G)` succeeds afterward.
- [ ] The generic `wound` keyword is still classified `deferred` by `classifyHeroEffectReason`.

### Card data
- [ ] `node scripts/convert-cards/apply-hero-ability-markers.mjs` reports exactly 7 updated lines on first run and 0 on re-run (idempotent).
- [ ] `pnpm ledger:heroes:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm roadmap:counts:check` all exit 0 at close.

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at the execution-captured baseline **+ the new tests (≈12) / + 3 suites**, 0 fail.
- [ ] New tests use `node:test` + `node:assert` only; no `boardgame.io` imports.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: execution-captured baseline + ~12 new tests / +3 suites, 0 fail

# Step 3 — marker application is idempotent
node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat -- data/cards/
# Expected: second run reports 0 updated lines; diff shows exactly the 7 marked ability lines vs origin/main

# Step 4 — card-data-derived gates are current
pnpm ledger:heroes:check; pnpm mechanics:metadata:check; pnpm sim:runtime-observed:check; pnpm roadmap:counts:check
# Expected: all exit 0

# Step 5 — no ambient randomness / throw in the executor (see D-3701 for the forbidden list)
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "Math\.random"
# Expected: no output

# Step 6 — locked contract file + deferred set untouched-as-required
git diff origin/main -- packages/game-engine/src/rules/heroAbility.types.ts
# Expected: no output
git diff origin/main -- packages/game-engine/src/diagnostics/hollowEffect.types.ts
# Expected: no removal of 'wound' / 'conditional'

# Step 7 — no files outside scope were changed
git diff --name-only origin/main
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = play.legendary-arena.com):** after deploy, a real match with Hulk (Crazed Rampage) in the loadout shows every player gaining a Wound (Wound supply drops, discard gains a wound) with a game-log line — diagnostics JSON or log capture as evidence. Green tests + merged PR alone do NOT satisfy this item. (D-24026)
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; engine test suite green at the captured baseline + new tests.
- [ ] All four card-data-derived `:check` gates exit 0.
- [ ] No `Math.random` in any new or modified file; no `throw` in the executor (confirmed with `Select-String`).
- [ ] `heroAbility.types.ts` not modified; `DEFERRED_BY_DESIGN_MECHANICS` retains `'wound'` + `'conditional'` (confirmed with `git diff`).
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the plain "gain a Wound" hero form now executes; hollow count reduced by the seven cleared lines.
- [ ] `docs/ai/DECISIONS.md` updated — D-24156 flipped to Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-364 checked off with the execution date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node added + `pnpm roadmap:counts --write` regenerated in the close commit.

---

## Lint Gate Self-Review

Recorded per `00.3-prompt-lint-checklist.md` (drafted 2026-07-11):

- §1 Structure — PASS (all required sections present + non-empty; Out of Scope lists ≥2 exclusions incl. the deferred wound corpus).
- §2 Constraints — PASS (engine-wide block intact, full-file output rule, 00.6 referenced, packet-specific + session protocol + locked values present).
- §3 Assumes — PASS (every consumed export named with file path; baseline SHA recorded; blocking clause present; absolute test-count deferred to execution with an explicit reason).
- §4 Context — PASS (ARCHITECTURE.md sections named; villain executor + wounds.logic named as the read-first reuse targets; 00.2 referenced for card-data shape; DECISIONS scan list named).
- §5 Output completeness — PASS (every file marked modified with a one-line description; no diff/patch language; 6 card JSONs are regenerated artifacts of the one mechanic, not independent edits).
- §6 Naming — PASS (`heroClass`, `cardSlug`, `abilityIndex`, `woundsDrawn` match established names; no new field names).
- §7 Dependencies — PASS (no new npm packages; forbidden packages not touchable by scope).
- §8 Boundaries — PASS (engine-only mutation via move-context handler; no registry/boardgame.io import in helpers; no randomness introduced).
- §9 Windows — PASS (pwsh `Select-String` verification steps).
- §10 Env vars — PASS (none required/introduced).
- §11 Auth — N/A (no authentication surface).
- §12 Test quality — PASS (node:test only, structural mocks, no boardgame.io imports, no network/DB, deterministic).
- §13 Verification — PASS (exact pnpm/node commands with expected output).
- §14 Acceptance — PASS (binary, observable, scope-aligned).
- §15 DoD — PASS (STATUS/DECISIONS/WORK_INDEX/mindmap + scope-boundary check + D-24026 live-on-surface item; surface declared in header).
- §16 Code style — PASS (no premature abstraction — one shared handler for two near-identical keywords is duplicate-avoidance at the point of a second copy, not speculative; `// why:` requirements stated; no reduce; explicit control flow).
- §17 Vision — PASS (clause numbers, no-conflict assertion, NG proximity, determinism line present).
- §18 Prose-vs-grep — PASS (Step 5/6 grep tokens appear only inside the verification block; prose cites D-3701 instead of enumerating forbidden tokens; the `'wound'` literal in Step 6 targets a `git diff`, not a self-tripping content grep).
- §19 Bridge staleness — N/A at draft (baseline SHA re-checked at commit).
- §20 Funding — N/A with justification (see §Funding Surface Gate).
- §21 API catalog — N/A with justification (see §API Catalog).

Verdict: **PASS** — all 21 sections resolved.

## Pre-Flight & Copilot Verdicts

- **Pre-flight (`01.4`): READY TO EXECUTE (2026-07-11, baseline `c3890370`).** Hard-deps on `main`: WP-021/022 (hook pipeline + `HERO_EFFECT_HANDLERS`), WP-017 (`gainWound` + `G.piles.wounds`), WP-316 (the villain `gainWound` per-target loop this mirrors). Contract fidelity verified against source: `gainWound(woundsPile, discard)` return shape (`wounds.logic.ts`); the villain `target:'each'` loop + `woundsDrawn` bump (`villainEffects.execute.ts`); `HANDLED_KEYWORDS` / `MVP_KEYWORDS` / `NO_MAGNITUDE_KEYWORDS` / `DEFERRED_BY_DESIGN_MECHANICS` membership sets (`heroEffects.execute.ts`, `hollowEffect.types.ts`); the plain-keyword extraction path (`heroAbility.setup.ts`). The affected card corpus was enumerated over `data/cards/**` (7 plain hero gain-wound lines: 3× Crazed Rampage `each` + 4× `self`; 40 non-plain forms confirmed to stay deferred). Scope is a closed allowlist (single engine layer + card-data pipeline; `heroAbility.types.ts` and the generic `wound` deferral held invariant). **Empirical Scaffold (01.4 §Validation-Tightening): N/A** — this is additive recognition (a previously-hollow marker form becomes handled), not validation-tightening; no previously-accepted input is newly rejected. The exact `abilityIndex` per card + the absolute test baseline are execution-measured (both in the allowlist).
- **Copilot (`01.7`): PASS (2026-07-11).** Boundary (parser/executor import no registry/boardgame.io; no new type leaks; `heroAbility.types.ts` unchanged). Determinism (no RNG; top-of-pile wound draw; sorted-key `each` order). Honest-Partial (the generic `wound` keyword + all targeting/conditional forms stay deferred — the un-defer is two NEW narrow keywords, not a loosening). Silent-vs-loud (empty-supply no-op is logged, mirroring D-24017; a resolved effect is not a hollow). Scope creep (closed allowlist + `git diff` checks + explicit no-VP-scoring boundary). Naming (`woundsDrawn`, `cardSlug`, `abilityIndex` canonical). Disposition: **CONFIRM** — session-prompt generation authorized at execution-prep.
