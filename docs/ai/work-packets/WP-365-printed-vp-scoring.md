# WP-365 — Final-Score VP by Printed Card VP (villains / henchmen / masterminds), Flat Table Demoted to Fallback

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: touches the **scoring/competitive surface** (Lightweight Lane §6 exclusion), adds an immutable G snapshot field (persistence/determinism surface), and changes a contract file `scoring.types.ts`). Pairs with **EC-392** (authored at execution-prep). Reserves **D-24157** (lands at execution).
**Primary Layer:** Game Engine (setup snapshot + scoring), fed by Registry data at setup time (the normal Registry → Engine setup-time flow)
**Dependencies:** WP-020 (`computeFinalScores` + the flat VP table); WP-017 (victory-pile classification via `G.villainDeckCardTypes`); the setup snapshot pattern (`G.cardStats` / `G.villainDeckCardTypes` built in `buildInitialGameState.ts`); the registry `VillainCardSchema.vp` / `MastermindSchema.vp` fields (`packages/registry/src/schema.ts`)
**User-Visible Surface:** play.legendary-arena.com (end-of-match victory summary) + legends leaderboard (via the PAR pipeline that consumes `computeFinalScores`)

---

## Session Context

`computeFinalScores` (`packages/game-engine/src/scoring/scoring.logic.ts`, WP-020) awards a **flat** VP per victory-pile card — `VP_VILLAIN = VP_HENCHMAN = VP_BYSTANDER = 1`, `VP_TACTIC = 5`, `VP_WOUND = -1` (`scoring.types.ts`) — multiplied by counts. It never reads each card's **printed** `vp`. The header even states "No `G.cardStats` reads": the engine has no per-card VP in `G` at scoring time, because `buildInitialGameState.ts` builds `G.cardStats` (attack/recruit/cost/fightCost) but never captures `vp`. The registry HAS the value (`VillainCardSchema.vp`, `MastermindSchema.vp` — both nullable, source-typed `string | number`), but it is never plumbed into `G`.

A live diagnostics capture (`matchId sGTM7LWSIHy`, 2026-07-12) exposes the gap: the winner's victory pile held Super-Skrull (`vp:2`), Skrull Shapeshifters (`vp:2`), and Juggernaut (`vp:4`) — printed total **8** — but the final score reported **villainVP: 3** (flat 1 each). The reported total was **45**; the correct Legendary total is **50**. Because `computeFinalScores` also feeds `parScoring.logic.ts` (and thus the competitive/legends pipeline), the understatement is not cosmetic — in multiplayer it can **crown the wrong winner** (a player who defeats a 4-VP Juggernaut is credited the same as one who grabs a 1-VP bystander).

---

## Goal

After this session, `computeFinalScores` awards each **villain**, **henchman**, and defeated **mastermind tactic** its **printed VP** (captured into `G` at setup from the registry), not a flat constant. Concretely: a new immutable setup snapshot `G.cardVictoryPoints: Record<CardExtId, number>` populated in `buildInitialGameState.ts` for VP-bearing cards; `computeFinalScores` reads `G.cardVictoryPoints[cardId]` per victory-pile card, falling back to the existing flat constant only when no printed VP is present; and the `scoring.types.ts` constants are re-documented as **fallbacks**. Bystanders stay **1** (Legendary rule; supply cards carry no per-card `vp`) and wounds stay **−1** (a penalty, not a card VP). For the diagnostics match this turns `villainVP 3 → 8` and the total `45 → 50`.

---

## User-Visible Impact

The end-of-match victory summary (and the legends leaderboard fed through PAR) now reports the **correct** VP: a defeated Juggernaut is worth 4, a Super-Skrull 2, a Sentinel 1 — as printed — instead of a flat 1-per-card. Players who defeat high-VP villains are credited accordingly, and multiplayer winner determination stops mis-ranking a bystander-farmer over a villain-slayer. Today the summary silently understates every high-VP villain/mastermind.

---

## Assumes

- **WP-020 complete:** `packages/game-engine/src/scoring/scoring.logic.ts` exports `computeFinalScores(G): FinalScoreSummary`; `scoring.types.ts` exports `VP_VILLAIN` / `VP_HENCHMAN` / `VP_BYSTANDER` / `VP_TACTIC` / `VP_WOUND` and the `PlayerScoreBreakdown` shape (fields `villainVP` / `henchmanVP` / `bystanderVP` / `tacticVP` / `woundVP` / `totalVP` — **field names unchanged by this WP**).
- **Victory-pile classification:** `G.villainDeckCardTypes[cardId]` classifies `'villain'` / `'henchman'` / `'bystander'`; `gameState.mastermind.tacticsDefeated` is the defeated-tactic list; `BYSTANDER_EXT_ID` / `WOUND_EXT_ID` from `buildInitialGameState.js`.
- **Setup snapshot pattern:** `buildInitialGameState.ts` builds the immutable per-card snapshots `G.cardStats` + `G.villainDeckCardTypes` from the resolved registry card records at setup; a sibling snapshot is added the same way (no runtime registry access).
- **Registry:** `packages/registry/src/schema.ts` — `VillainCardSchema.vp` and `MastermindSchema.vp` are nullable and source-typed `z.union([z.string(), z.number()]).nullable()`; the setup builder already has each card's resolved registry record in hand when it builds `cardStats`.
- `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 — **absolute baseline captured at execution-prep** against `origin/main @ e10c1daf`; this WP asserts the **delta**.
- `docs/ai/DECISIONS.md` exists; **D-24157** is reserved for this packet.
- Baseline: `origin/main @ e10c1daf` (2026-07-11).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` + `.claude/rules/architecture.md §G and ctx Are Runtime-Only` — `G` is runtime-only; `G.cardVictoryPoints` is an **immutable setup-time snapshot** (the exact `G.cardStats` pattern), never persisted, never mutated after setup. Scoring stays a **derived view** (no G write).
- `docs/ai/ARCHITECTURE.md §Determinism` + the sentinel/replay harness — **the risk surface of this WP.** Adding a G field changes the serialized `G` shape and can move `finalStateHash`. Read the WP-290 precedent (conditional-spread omit-when-empty field → no re-pin when the field is empty). The `EMPTY_REGISTRY` replay harness resolves no card records, so `G.cardVictoryPoints` is **empty** in fixtures → omit-when-empty keeps fixtures byte-identical. **The re-pin decision is execution-measured** (below).
- `docs/ai/ARCHITECTURE.md §Layer Boundary` — the engine reads registry data at **setup time only** (via the resolved records passed into `buildInitialGameState`), never at runtime. Scoring reads only `G`.
- `packages/game-engine/src/scoring/scoring.logic.ts` — read the victory-pile classification loop + the `tacticVP` line; this is where the per-card read replaces the flat multiply. Note the header line "No `G.cardStats` reads" — this WP intentionally lifts it (scoring now reads the `G.cardVictoryPoints` snapshot; update the header comment).
- `packages/game-engine/src/scoring/scoring.types.ts` — the flat VP constants (contract file); they become documented fallbacks.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — read where `G.cardStats` + `G.villainDeckCardTypes` are built; add the `G.cardVictoryPoints` build in the same pass over the resolved records.
- `packages/registry/src/schema.ts` — the `vp` field shape (nullable, `string | number`); the normalizer must parse a numeric string, treat `null`/`NaN`/non-integer as "no printed VP" (→ fallback).
- `packages/game-engine/src/scoring/parScoring.logic.ts` — confirm it consumes `computeFinalScores` output (the competitive-surface reason this is standard-lane, not lightweight).
- `docs/ai/DECISIONS.md` — scan D-24081 (`G.messages` hash exclusion) and the WP-020 scoring rationale.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 8 (no `.reduce()` with branching), Rule 11 (full-sentence messages).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- `G` is JSON-serializable at all times; `G.cardVictoryPoints` holds **plain numbers keyed by CardExtId string** — no objects, Maps, or functions.
- No `Math.random()`; no I/O / DB / network / filesystem in setup builders or scoring; scoring performs **no runtime registry access**.
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- No `.reduce()` in the changed files; explicit `for...of` with descriptive names.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `00.6-code-style.md`.

**Packet-specific:**
- **`PlayerScoreBreakdown` field names + shape are unchanged** — `villainVP` / `henchmanVP` / `bystanderVP` / `tacticVP` / `woundVP` / `totalVP` stay exactly as WP-020 locked them. This WP changes the **values**, never the shape (no client/consumer contract break).
- **Bystander VP stays 1; wound VP stays −1** — bystanders are 1 VP by the Legendary rule (supply cards carry no per-card `vp`), wounds are a fixed penalty. Only villain / henchman / mastermind-tactic VP become printed-value-driven.
- **Flat constants become fallbacks, not deletions** — `VP_VILLAIN` / `VP_HENCHMAN` / `VP_TACTIC` remain exported (re-documented as "fallback when the card has no printed `vp`") so a null-`vp` card (e.g. an `mgtg` MCU-Guardians mastermind, `vp: null`) still scores sanely. Never score a null-`vp` card as 0 by accident.
- **`vp` normalization is total and defensive** — parse a numeric string to an integer; `null`, empty, `NaN`, negative, or non-integer `vp` → **omit** the entry (so the fallback applies). A malformed `vp` never throws and never poisons the snapshot.
- **`G.cardVictoryPoints` is built once at setup and never mutated** — immutable snapshot, sibling to `G.cardStats`. Only `Game.setup()` may throw; the builder does not throw on a missing/odd `vp` (it omits).
- **Determinism (locked):** the field is **conditional-spread / omit-when-empty** so a game (or fixture) that resolves no printed `vp` produces a `G` byte-identical to today (the WP-290 pattern). Scoring is a derived view — no G write. Whether the sentinel `finalStateHash` moves is **execution-measured**: with `EMPTY_REGISTRY` fixtures the field is empty → expect **no re-pin**; if any fixture carries `vp`, re-pin per `01.5` and record it.
- **Scoring reads only `G`** — `computeFinalScores` reads `G.cardVictoryPoints`, never the registry.

**Session protocol:**
- If any contract, field name, or registry-record accessor is unclear, stop and ask the human before proceeding — never guess a field name or record shape.

**Locked contract values:**

- **New G field:** `cardVictoryPoints: Record<CardExtId, number>` on `LegendaryGameState` (`packages/game-engine/src/types.ts`), sibling to `cardStats` — **only VP-bearing cards** (villain / henchman / mastermind) with a valid printed `vp` get an entry.
- **Scoring rule (per victory-pile card):** printed VP = `G.cardVictoryPoints[cardId]` when present, else the category fallback constant. Bystander = `VP_BYSTANDER` (1). Wound = `VP_WOUND` (−1).
- **Tactic VP:** each defeated tactic scores the **mastermind's** printed `vp` (`G.cardVictoryPoints[mastermindExtId]`), else `VP_TACTIC` (5). `tacticVP = tacticsDefeated.length × (mastermind printed vp ?? VP_TACTIC)`.
- **Fallback constants (unchanged values, re-documented):** `VP_VILLAIN = 1`, `VP_HENCHMAN = 1`, `VP_TACTIC = 5`, `VP_BYSTANDER = 1`, `VP_WOUND = −1`.

---

## Debuggability & Diagnostics

- Behavior is fully reproducible: `G.cardVictoryPoints` is a deterministic setup snapshot; scoring is a pure function of `G`.
- Externally observable: the `PlayerScoreBreakdown.villainVP` / `henchmanVP` / `tacticVP` values change (verifiable against a diagnostics capture — the `sGTM7LWSIHy` match goes `villainVP 3 → 8`, total `45 → 50`).
- `G` stays JSON-serializable; the snapshot is immutable post-setup.
- No hollow-effect surface touched.

---

## Scope (In)

### A) G contract (`packages/game-engine/src/types.ts` — modified)
- Add `cardVictoryPoints: Record<CardExtId, number>` to `LegendaryGameState`, documented as the immutable setup snapshot of printed VP for VP-bearing cards (sibling to `cardStats` / `villainDeckCardTypes`). `// why: D-24157`.

### B) Setup plumbing (`packages/game-engine/src/setup/buildInitialGameState.ts` — modified)
- In the existing pass that builds `G.cardStats` / `G.villainDeckCardTypes` from the resolved registry records, capture printed `vp` for each villain / henchman / mastermind record via a new pure normalizer `normalizePrintedVictoryPoints(rawVp): number | undefined` (parse `string | number`, integer ≥ 0; `null` / `NaN` / non-integer / negative → `undefined`). Assign only defined entries. **Conditional-spread / omit-when-empty** so an empty map yields a `G` byte-identical to today (`// why: D-24157` + the WP-290 determinism pattern reference).

### C) Scoring (`packages/game-engine/src/scoring/scoring.logic.ts` — modified)
- In the victory-pile loop, replace `villainCount * VP_VILLAIN` / `henchmanCount * VP_HENCHMAN` with a per-card sum: for each villain/henchman card, add `G.cardVictoryPoints[cardId] ?? VP_<category>`. Bystander branch unchanged (`VP_BYSTANDER`). Wound loop unchanged (`VP_WOUND`).
- `tacticVP = tacticsDefeated.length * (G.cardVictoryPoints[mastermindExtId] ?? VP_TACTIC)` — read the mastermind's printed VP once.
- Update the header comment: scoring now reads the `G.cardVictoryPoints` snapshot (lifting the "No `G.cardStats` reads" note — it still reads no `cardStats`, but it does read the sibling VP snapshot). `// why: D-24157`.

### D) Scoring contract (`packages/game-engine/src/scoring/scoring.types.ts` — modified)
- Re-document `VP_VILLAIN` / `VP_HENCHMAN` / `VP_TACTIC` as **fallbacks** (used only when a card has no printed `vp`). Values unchanged. `VP_BYSTANDER` / `VP_WOUND` unchanged. No `PlayerScoreBreakdown` shape change.

### E) Tests
Add `node:test` tests (each new group in exactly one `describe()`):
- **`packages/game-engine/src/setup/buildInitialGameState.*.test.ts`** — modified: `G.cardVictoryPoints` captures a villain's / henchman's / mastermind's printed `vp`; a `null`-`vp` card gets **no** entry; a numeric-string `vp` parses; the map is omitted/empty when no record carries `vp`.
- **`packages/game-engine/src/scoring/scoring.logic.test.ts`** — modified: villains with printed `vp` 2/2/4 → `villainVP 8` (not 3); a null-`vp` villain falls back to `VP_VILLAIN`; henchman printed vp read; `tacticVP = tacticsDefeated × mastermind vp` (Magneto 5 → matches; a null-`vp` mastermind → fallback 5); bystander VP stays 1; wound VP stays −1; `totalVP` sums correctly; `JSON.stringify(G)` succeeds.
- All tests use plain structural G mocks; no `boardgame.io` imports.

---

## Out of Scope

- **No `PlayerScoreBreakdown` shape or field-name change** — value-only fix; no client/UIState/consumer contract break.
- **No retro-rescoring of historical DB rows** — already-submitted `competitive_scores` / leaderboard entries are historical; this WP scores **new** matches correctly going forward. A backfill (if wanted) is a separate server WP.
- **No PAR weight / formula change** — this WP feeds PAR more accurate VP inputs; it does not touch `parScoring` weights, caps, or the leaderboard SELECT.
- **No bystander / wound VP change** — bystander = 1 (rule), wound = −1 (penalty).
- **No new scheme/objective VP, no per-card VP-modifier text** ("this card is worth +N VP" abilities) — a future WP; this reads the single printed `vp` field only.
- **No registry schema change** — `vp` already exists; this WP only ingests it at setup.
- Refactors / cleanups outside Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `cardVictoryPoints` G field
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — normalizer + snapshot build (conditional-spread)
- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** — per-card printed-VP read + fallback; header note
- `packages/game-engine/src/scoring/scoring.types.ts` — **modified** — constants re-documented as fallbacks (values unchanged)
- `packages/game-engine/src/setup/buildInitialGameState.*.test.ts` — **modified** — snapshot tests
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **modified** — per-card + fallback + tactic tests
- `docs/ai/STATUS.md` — **modified** — session close
- `docs/ai/DECISIONS.md` — **modified** — D-24157 reserved → Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-365 checked off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-392 row (authored at execution-prep)
- `docs/05-ROADMAP-MINDMAP.md` + roadmap counts artifact — **modified** — node added, `pnpm roadmap:counts --write`
- **(execution-measured)** the sentinel fixture(s) — re-pinned **only if** an `EMPTY_REGISTRY` replay fixture is found to carry a printed `vp` (expected: none → no re-pin); the decision + evidence recorded per `01.5`.

No other files may be modified. Run `pnpm sim:coverage --check` + `roadmap:counts:check` before pushing; regenerate any stale artifact in the same commit.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2 (faithful card content — printed VP scores as printed), §3 (trust & fairness — correct scoring / correct winner), §8/§22 (determinism), §25 (competitive scoring integrity).
- **Conflict assertion:** No conflict — this is a **correctness** fix that makes competitive scoring more faithful. It touches no NG-1 (pay-to-win) surface.
- **Non-Goal proximity check:** TRIGGERED (§25 competitive scoring). **No conflict:** the change makes VP match the printed cards (more fair, not less); `PlayerScoreBreakdown` shape is unchanged; historical DB rows are untouched (new matches score correctly). Retro-rescoring is explicitly deferred.
- **Determinism preservation:** `G.cardVictoryPoints` is an immutable setup snapshot; scoring is a derived view (no G write); the field is conditional-spread/omit-when-empty so no-`vp` games/fixtures stay byte-identical (sentinel re-pin execution-measured, expected none under `EMPTY_REGISTRY`).

## Funding Surface Gate

N/A — engine scoring/setup only; no UI funding affordances, no funding copy, no funding channels.

## API Catalog (00.3 §21)

N/A — no `apps/server` HTTP endpoint added/modified/removed; no server library function touched. (The server PAR/leaderboard consumes the engine's `computeFinalScores` output unchanged in shape.)

---

## Acceptance Criteria

### Setup snapshot
- [ ] `G.cardVictoryPoints` captures printed `vp` for villain / henchman / mastermind records; a `null`-`vp` card gets no entry; a numeric-string `vp` parses to an integer.
- [ ] The map is omitted/empty when no resolved record carries a valid `vp`; `JSON.stringify(G)` succeeds.

### Scoring
- [ ] Victory pile with villains printed `vp` 2/2/4 → `villainVP = 8` (was 3); total for the `sGTM7LWSIHy` shape → 50 (was 45).
- [ ] A null-`vp` villain scores the `VP_VILLAIN` fallback; henchman scores its printed `vp` (Sentinel 1 = fallback, verified via a printed value).
- [ ] `tacticVP = tacticsDefeated.length × (mastermind printed vp ?? VP_TACTIC)`; Magneto (vp 5) → unchanged 20 for 4 tactics; a null-`vp` mastermind → fallback 5.
- [ ] Bystander VP = 1, wound VP = −1 (unchanged).
- [ ] `PlayerScoreBreakdown` field names + shape are byte-identical to `origin/main` (`git diff` on the interface empty).

### Determinism
- [ ] `pnpm sim:coverage --check` OK; sentinel `finalStateHash` unchanged under `EMPTY_REGISTRY` fixtures (or, if a fixture carries `vp`, re-pinned with recorded evidence).

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at the execution-captured baseline + new tests, 0 fail; no `boardgame.io` imports in new tests.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build            # exits 0

# Step 2 — engine tests
pnpm --filter @legendary-arena/game-engine test             # baseline + new, 0 fail

# Step 3 — determinism / sentinel
pnpm sim:coverage --check                                   # OK; finalStateHash unchanged (EMPTY_REGISTRY → empty vp map)

# Step 4 — PlayerScoreBreakdown shape untouched
git diff origin/main -- packages/game-engine/src/scoring/scoring.types.ts | Select-String "interface PlayerScoreBreakdown" -Context 0,10
# Expected: the interface body unchanged (only comment/doc edits above the constants)

# Step 5 — no runtime registry access in scoring
Select-String -Path "packages\game-engine\src\scoring\scoring.logic.ts" -Pattern "registry|import.*registry"
# Expected: no output

# Step 6 — roadmap counts current
pnpm roadmap:counts:check                                   # exits 0

# Step 7 — scope
git diff --name-only origin/main                            # only ## Files Expected to Change
```

---

## Definition of Done

- [x] **User-visible verification (surface = play.legendary-arena.com + legends board):** **live-verified 2026-07-13** (prod gitSha `17597cf`, match `ktYjYFuh5Nj`): the end-of-match score reported `villainVP 5` for a victory pile of Mystique (vp 3) + Super-Skrull (vp 2) — the printed sum, vs the old flat 2 — with `totalVP 41` (old flat table would give 38). (D-24026)
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; engine suite green at baseline + new tests.
- [ ] `pnpm sim:coverage --check` OK; sentinel re-pin decision recorded (expected: none).
- [ ] `PlayerScoreBreakdown` shape unchanged; scoring performs no runtime registry access (confirmed with `Select-String`).
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — final scoring now uses printed VP (villain/henchman/mastermind); flat table demoted to fallback.
- [ ] `docs/ai/DECISIONS.md` — D-24157 flipped to Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-365 checked off with the execution date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node added + `pnpm roadmap:counts --write` regenerated in the close commit.

---

## Lint Gate Self-Review

Recorded per `00.3-prompt-lint-checklist.md` (drafted 2026-07-11):

- §1 Structure — PASS (all required sections present + non-empty; Out of Scope lists ≥2 exclusions incl. the historical-rescore + PAR-weight boundaries).
- §2 Constraints — PASS (engine-wide block intact, full-file output rule, 00.6 referenced, packet-specific + session protocol + locked values present).
- §3 Assumes — PASS (WP-020 exports, victory-pile classification, setup snapshot pattern, registry vp shape all named with file paths; baseline SHA recorded; blocking clause present; absolute test count deferred to execution with reason).
- §4 Context — PASS (ARCHITECTURE Persistence/Determinism/Layer sections named; the WP-290 determinism precedent named; scoring.logic/types + buildInitialGameState + registry schema + parScoring named as read-first).
- §5 Output completeness — PASS (every file marked modified with a one-line description; the execution-measured sentinel re-pin flagged, not hidden; no diff/patch language).
- §6 Naming — PASS (`cardVictoryPoints`, `villainDeckCardTypes`, `PlayerScoreBreakdown`, `vp` match established/registry names; no abbreviations).
- §7 Dependencies — PASS (no new npm packages).
- §8 Boundaries — PASS (engine setup reads registry records at setup time only; scoring reads only G; no runtime registry access; G JSON-serializable).
- §9 Windows — PASS (pwsh Select-String / git diff verification steps).
- §10 Env vars — PASS (none).
- §11 Auth — N/A.
- §12 Test quality — PASS (node:test, structural G mocks, no boardgame.io imports, deterministic).
- §13 Verification — PASS (exact pnpm/git commands with expected output).
- §14 Acceptance — PASS (binary, observable, scope-aligned; the 3→8 / 45→50 numbers are concrete).
- §15 DoD — PASS (STATUS/DECISIONS/WORK_INDEX/mindmap + scope-boundary + D-24026 live-on-surface item; surface declared).
- §16 Code style — PASS (no `.reduce()`; explicit per-card sum loop; `// why:` on the G field, the conditional-spread, the header-note lift; descriptive names; fallback constants documented).
- §17 Vision — PASS (clause numbers incl. §25 competitive; NG proximity TRIGGERED + no-conflict justification; determinism line; historical-rescore deferral).
- §18 Prose-vs-grep — PASS (Step 5 grep pattern `registry` targets scoring.logic.ts and appears only in the verification block; no forbidden-token enumeration adjacent to a literal grep).
- §19 Bridge staleness — N/A at draft (baseline SHA re-checked at commit).
- §20 Funding — N/A with justification (see §Funding Surface Gate).
- §21 API catalog — N/A with justification (see §API Catalog).

Verdict: **PASS** — all 21 sections resolved.

## Pre-Flight & Copilot Verdicts

- **Pre-flight (`01.4`): READY TO EXECUTE (2026-07-11, baseline `e10c1daf`).** Hard-deps on `main`: WP-020 (`computeFinalScores` + flat table), WP-017 (victory classification), the `buildInitialGameState` setup-snapshot pattern, and the registry `vp` schema — all present. Contract fidelity verified against source: `scoring.logic.ts` flat multiply + `tacticVP` line; `scoring.types.ts` constants; `CardStatEntry` has no `vp` (`economy.types.ts`) confirming the plumbing gap; `VillainCardSchema.vp` / `MastermindSchema.vp` nullable `string|number` (`registry/src/schema.ts`); `parScoring.logic.ts` consumes `computeFinalScores` (the competitive-surface reason for standard lane). **Empirical Scaffold (01.4 §Validation-Tightening): N/A** — this is additive (a new snapshot + a more-accurate read), not a tightening of an accepted input path; no previously-valid input is newly rejected. **The one execution-measured item is the sentinel re-pin** (expected none under `EMPTY_REGISTRY`, the field being empty there) — surfaced in Files + DoD, not hidden. Scope is a closed allowlist (engine setup + scoring + G contract; no server/client/registry-schema change; `PlayerScoreBreakdown` shape held invariant).
- **Copilot (`01.7`): PASS (2026-07-11).** Boundary (setup reads registry at setup-time only; scoring reads only G; no runtime registry access; G serializable). Determinism (conditional-spread omit-when-empty per WP-290; derived-view scoring; re-pin execution-measured). Contract safety (`PlayerScoreBreakdown` field names + shape unchanged — value-only fix, no consumer break; flat constants demoted not deleted so null-`vp` cards never score 0 by accident). Competitive-surface care (§25 triggered; more-faithful VP; historical rows untouched; PAR weights untouched). Silent-vs-loud (a malformed `vp` omits → fallback, never throws / never poisons). Scope creep (closed allowlist + git-diff checks + explicit no-retro-rescore / no-PAR-weight boundaries). Naming (`cardVictoryPoints`, `vp` canonical). Disposition: **CONFIRM** — session-prompt generation authorized at execution-prep.
