# WP-537 — Core Loki Master Strike (auto reveal-[hc:strength]-or-Wound)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (a Core Loki match — the Master Strike now punishes players without a Strength Hero; D-24026 live-verification applies once a Loki Master Strike is observed firing in a deployed match).
**Primary Layer:** Game Engine (`packages/game-engine`) only.
**Dependencies:** WP-024 (Master Strike execution pipeline + `mastermindStrikeHandler`); WP-388 / D-24192 (the per-mastermind strike-dispatch pattern this mirrors). Paired with **WP-538** (core Dr. Doom strike) — they share the strike-dispatch surface; land WP-537 first.

---

## Goal

After this session, a Core **Loki** match resolves Loki's printed Master Strike — *"Each player reveals a `[hc:strength]` Hero or gains a Wound."* Today `core/loki` takes **no branch** in `mastermindStrikeHandler` (`packages/game-engine/src/rules/mastermindHandlers.ts`) and falls through to generic bystander-capture + strike-counter bookkeeping — the Master Strike is inert (verified by the 2026-08-13 Core mastermind-coverage audit: 2 of 4 Core Master Strikes fire — Magneto + Red Skull — while Dr. Doom and Loki are hollow). This WP adds a `MASTERMIND_CORE_LOKI` constant + a dispatch branch + a `resolveCoreLokiStrike` resolver that, for each player (sorted), reveals a Strength Hero (no penalty) or gains a Wound — an **auto-resolve** effect mirroring `resolveCo2eMagnetoStrike` (reveal/discard-or-Wound) and `resolveRedSkullStrike` (auto, all-players loop). Locked by D-24346.

## User-Visible Impact

A player in a Core Loki co-op/solo match now takes a Wound on a Master Strike when they hold no Strength Hero (and reveals to avoid it when they do), instead of the Strike doing nothing. No change to any other mastermind, to non-Loki matches, or to any public/monetization surface — a faithfulness fix to one mastermind's printed text. D-24026 live-verification applies (a Loki Master Strike observed firing in a deployed match).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. core/loki takes no strike branch today (this WP adds it)
grep -q "MASTERMIND_CORE_LOKI\|'core/loki'" packages/game-engine/src/rules/mastermindHandlers.ts && echo "EXISTS" || echo "ABSENT"
# Expected: ABSENT (the only core/loki reference must not already be a strike branch; STOP + inspect if EXISTS)

# B. The strike dispatch + auto-resolve helpers this WP reuses are present
grep -q "function mastermindStrikeHandler" packages/game-engine/src/rules/mastermindHandlers.ts && grep -q "function resolveCo2eMagnetoStrike" packages/game-engine/src/rules/mastermindHandlers.ts && grep -q "gainWoundToDiscard" packages/game-engine/src/rules/mastermindHandlers.ts && grep -q "function selectLowestCostHero" packages/game-engine/src/rules/mastermindHandlers.ts && echo "B_OK"
# Expected: B_OK

# C. Hero class is on cardTraits.heroClass (the read this resolver needs)
grep -q "heroClass" packages/game-engine/src/state/cardTraits.types.ts && echo "C_OK"
# Expected: C_OK

# D. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "D_OK"
# Expected: D_OK
```

If B fails, the strike pipeline is not on `main` as assumed — STOP and reconcile.

---

## Context (Read First)

- `packages/game-engine/src/rules/mastermindHandlers.ts` — the host. `mastermindStrikeHandler` (~line 828) dispatches by `gameState.selection.mastermindId` through a mutually-exclusive `if/else-if` chain (~840–855); an id matching no branch is generic bookkeeping only (the explicit fall-through comment there). Core dispatch constants live at the top (`MASTERMIND_MAGNETO = 'core/magneto'`, `MASTERMINDS_RED_SKULL = ['core/red-skull','co2e/red-skull']`, four `co2e/*` constants). **There is no `core/loki` constant** — add one.
- `resolveCo2eMagnetoStrike` — the **closest template**: loop `Object.keys(gameState.playerZones).sort()`; per player, `selectLowestCostHero(gameState, hand, <traitKind>, <traitValue>)` is the existence check; on the penalty branch call `gainWoundToDiscard(gameState, playerZones)` (returns `false` when the Wound supply is empty — log accordingly). `resolveCoreLokiStrike` is this shape with `('heroClass', 'strength')` and the **reveal** (not discard) escape — a player holding a Strength Hero **keeps** it and takes no penalty.
- **Existing `resolveLokiStrike` is the `co2e/loki` face** (different printed penalty — stacks a non-grey Hero next to Loki). Do NOT reuse or repoint it; core Loki needs its own resolver. Name the new one distinctly (`resolveCoreLokiStrike`) to avoid the co2e collision.
- Class read: `gameState.cardTraits?.[cardExtId]?.heroClass` (the `HeroTraitKind = 'any' | 'team' | 'heroClass'` selector on `selectLowestCostHero`). `[hc:strength]` → the `'strength'` heroClass slug (normalized lowercase — `traits.normalize.ts`).
- Master Strikes are keyed by **mastermind selection**, not a card-data marker, and are **not** in the effect-implementation index / mechanic ledgers — so this WP touches **no** `data/cards`, no marker file, and regenerates **no** ledger/index artifact.
- `docs/ai/ARCHITECTURE.md` — determinism: the resolver reads `G` and mutates it deterministically via `gainWoundToDiscard` (no `ctx.random`, no I/O). Moves never throw.

---

## Scope (In)

- Modify `packages/game-engine/src/rules/mastermindHandlers.ts`:
  - Add `const MASTERMIND_CORE_LOKI = 'core/loki';` with a `// why:` noting core Loki's printed text and that it is distinct from `co2e/loki` (different penalty).
  - Add an `else if (mastermindId === MASTERMIND_CORE_LOKI) { resolveCoreLokiStrike(gameState); }` branch in `mastermindStrikeHandler`.
  - Add `function resolveCoreLokiStrike(gameState): void` — loop players sorted; per player, if the hand holds a `heroClass === 'strength'` Hero (`selectLowestCostHero(gameState, hand, 'heroClass', 'strength') !== null`) log a reveal and continue (no penalty, hero **kept**); else `gainWoundToDiscard(gameState, playerZones)` and log the Wound (or the supply-empty no-effect case). Full-sentence `[Loki Master Strike] …` logs mirroring the existing strike logs.
- Modify `packages/game-engine/src/rules/mastermindHandlers.test.ts` — add `resolveCoreLokiStrike` / dispatch cases: a player with a Strength Hero reveals + keeps it (no Wound, hand unchanged); a player without gains a Wound; the Wound-supply-empty no-effect path; multi-player partition; dispatch routes `core/loki` to the resolver.

## Out of Scope

- `co2e/loki` (different printed penalty — its `resolveLokiStrike` is untouched), and every other mastermind.
- **Loki's tactic Fight abilities** (Cruel Ruler / Maniacal Tyrant / Vanishing Illusions / Whispers and Lies) — the tactic-Fight surface (`tacticHandlers.ts`) is a separate arc, still hollow, not this WP.
- **Dr. Doom's Master Strike** — the paired **WP-538** (interactive; cross-layer). This WP is Loki-only.
- Any interactive pending-choice / UIState / arena-client change — Loki's strike is fully **auto-resolve** (reveal is not a meaningful choice).
- Any `data/cards`, marker file, effect-implementation-index, or mechanic-ledger change — strikes are keyed by mastermind selection, not markers.

---

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** (`MASTERMIND_CORE_LOKI` constant + dispatch branch + `resolveCoreLokiStrike`)
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** (resolver + dispatch cases)
- `docs/ai/DECISIONS.md` — **modified** (land D-24346)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-537 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

**2 code/test files (both `packages/game-engine`) + governance.** Single layer (Game Engine); standard two-session lane (engine gameplay mechanic + a D-entry — barred from the Lightweight Lane).

---

## Contract (Locked by D-24346)

- **Effect:** for each player (`Object.keys(G.playerZones).sort()`), core Loki's Master Strike is `reveal a heroClass==='strength' Hero (keep it, no penalty) OR gainWound`. Fully **auto-resolve** — reveal is not a decision, so no pending-choice; the have-Strength-Hero player reveals and takes nothing, exactly as at the table.
- **Keyed by mastermind selection** `core/loki` — not a card-data marker; distinct from `co2e/loki` (different printed penalty).
- **Wound-supply-empty** degrades to a logged no-effect (the `gainWoundToDiscard` false return), never a throw.

### Determinism / persistence

The resolver reads `G` and mutates it deterministically (`gainWoundToDiscard`); no `ctx.random`, no I/O, no new `G` field. Replay-identical. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture reveals a Master Strike while `selection.mastermindId === 'core/loki'` — **none expected** (verify at execution: run the strike/fixture suites and re-pin with a note only if a real diff appears).

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of`, full-sentence `[Loki Master Strike] …` logs, a `// why:` on the new constant. ESM, Node v22+. Session output emits full file contents.

---

## Acceptance Criteria

1. `MASTERMIND_CORE_LOKI = 'core/loki'` exists with a `// why:` distinguishing it from `co2e/loki`; `mastermindStrikeHandler` routes `core/loki` to `resolveCoreLokiStrike`.
2. `resolveCoreLokiStrike` loops players sorted; a player holding a `heroClass==='strength'` Hero reveals it, **keeps it** (hand unchanged), and takes no Wound; a player holding none gains a Wound via `gainWoundToDiscard`.
3. Wound-supply-empty is a logged no-effect (no throw); logs are full sentences prefixed `[Loki Master Strike]`.
4. No pending-choice / UIState / arena-client / `data/cards` / marker / ledger / index change; no `ctx.random`; no new `G` field.
5. `mastermindHandlers.test.ts` covers reveal-keeps, no-hero-Wound, supply-empty, multi-player partition, and the `core/loki` dispatch route; all pass.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only if a real fixture diff appears).

---

## Verification Steps

```bash
# 1. Constant + dispatch + resolver present
grep -nE "MASTERMIND_CORE_LOKI|resolveCoreLokiStrike" packages/game-engine/src/rules/mastermindHandlers.ts
# Expected: the constant, the dispatch branch, the resolver

# 2. No forbidden surfaces touched
git diff --name-only | grep -E '^(data/cards|apps/|docs/ai/coverage|data/metadata)' ; echo "hits above (expect none but docs governance)"
grep -c "ctx.random" packages/game-engine/src/rules/mastermindHandlers.ts
# Expected: no data/cards or apps hits; ctx.random count unchanged (0 new)

# 3. Engine tests
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
# Expected: both exit 0; Loki strike cases pass

# 4. Hash stability
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: exit 0; no finalStateHash / PRE_WP080 change (or a noted re-pin only on a real fixture diff)

# 5. Live (post-deploy; D-24026): a Core Loki match — on a Master Strike, a
#    player with no Strength Hero gains a Wound; the game log shows the
#    "[Loki Master Strike] …" line. Record in STATUS (operator-pending).
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] `resolveCoreLokiStrike` fires reveal-keeps / no-hero-Wound / supply-empty correctly; auto-resolve (no pending-choice)
- [ ] No `data/cards` / marker / ledger / index / arena-client / UIState change; no new `G` field; no `ctx.random`
- [ ] Engine build + test green; `pnpm -r` green; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] `docs/ai/STATUS.md` Done entry names WP-537 + Loki's Master Strike, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24346 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-537 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-572:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: a Loki Master Strike observed firing in a deployed match (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: `mastermindStrikeHandler` + the `if/else-if` strike dispatch + the auto-resolve helpers (`resolveCo2eMagnetoStrike`, `resolveRedSkullStrike`, `gainWoundToDiscard`, `selectLowestCostHero` with the `'heroClass'` trait kind) are on `main`; `cardTraits.heroClass` carries the class read; core Loki has no strike branch today (confirmed hollow by the 2026-08-13 audit). The change is one constant + one dispatch branch + one resolver cloning the co2e-Magneto shape — no new `G` field, no card data, no cross-layer surface. **Empirical Scaffold N/A** — additive resolver on an existing dispatch, tightens no existing validation path. **Mutation Boundary** — mutates `G` deterministically via the existing `gainWoundToDiscard` idiom; no RNG.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13)

Layer boundary (engine-only; no registry/server/client edge), determinism (reads `G`, deterministic Wound mutation, no `ctx.random`/I/O, no new field → no re-pin expected), contract fidelity (reveal **keeps** the Strength Hero — the printed escape — and only the have-none case takes a Wound; distinct from the `co2e/loki` penalty), and scope (engine + test only, no card/marker/ledger) all clear. RISK folded: the new resolver MUST be named distinctly (`resolveCoreLokiStrike`) so it does not collide with or get mistaken for the existing co2e `resolveLokiStrike` — locked in Scope + AC-1 + a Common Failure Smell in the EC.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS. **§2 Constraints** — PASS (Contract §Determinism + Code-style). **§3 Assumes** — PASS (A–D w/ expected output). **§4 Context** — PASS (host + template + the co2e-Loki collision + class read; 00.2 N/A — no new data shape). **§5 Files** — PASS (closed 2-file code allowlist + governance). **§6 Naming** — PASS (`resolveCoreLokiStrike`, `MASTERMIND_CORE_LOKI`; `heroClass`/`strength` match canon). **§7 Deps** — PASS (none). **§8 Boundaries** — PASS (engine-only). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`, no network/DB/boardgame.io). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24346 + indices + mindmap + D-24026 for the user-visible surface). **§16 Code Style** — PASS. **§17 Vision** — present (below). **§18 Prose-vs-Grep** — PASS (greps the source, not this doc). **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A (no HTTP/server-lib surface).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements the printed Master Strike), §22 (determinism — deterministic Wound mutation, no RNG). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes a printed ability faithful without altering determinism or any other card. **Non-Goal proximity:** none of NG-1..NG-8 (no monetization/persuasion/pay-to-win/competitive-integrity surface). **Determinism preservation:** reads `G`, deterministic mutation, no new field → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
