# WP-540 — Partial Core Scheme-Twist Fidelity (Civil War KO-all + Cosmic Cube escalation)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (Core Super Hero Civil War + Unleash the Cosmic Cube matches — the twist effects now match the printed cards; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) only.
**Dependencies:** D-24178 (the twist-loss vs doom-clock-proxy model in `schemeTwistConfigs.ts`); WP-510 (Civil War hero-deck-depletion loss) + WP-515 (Civil War 2p hero-deck sizing) — both already landed; this WP fixes the twist EFFECT, an aspect they left untouched.

---

## Goal

After this session, the two **partial** Core scheme twists — the schemes that fire but diverge from their printed text (2026-08-13 scheme-coverage audit) — are faithful. Both are **param-driven** fixes on the existing resolvers; no new resolver, counter, or persistent shape.

- **Super Hero Civil War** — printed Twist *"KO all the Heroes in the HQ,"* but its config uses `params: { koCount: 2 }`, so only 2 are KO'd. **Fix:** teach the `koFromHq` resolver a `koAll` param and set the config to `{ koAll: true }` — KO **all** eligible HQ Heroes (then refill), reusing the resolver's existing all-eligible path.
- **Unleash the Cosmic Cube** — printed escalation (*nothing on twists 1-4; each player gains 1 Wound on twists 5-6; 3 Wounds on twist 7; twist 8 = Evil Wins*), but its config uses `params: { woundCount: 1 }`, so a flat 1 Wound is dealt **every** twist. **Fix:** teach the `woundAll` resolver a data-driven `escalation` schedule (`{ atOrAfterTwist, woundCount }[]`) and set the config to `[{ 5→1 }, { 7→3 }]`; the resolver reads the current twist number (`(schemeTwistCount ?? 0) + 1`, taken **before** the counter-increment effect applies) and deals the highest matching step's wounds (0 when none match).

Both loss conditions are already correct (Civil War: hero-deck-empty via WP-510; Cosmic Cube: `lossThreshold: 8`) and are OUT of scope. Locked by D-24349.

## User-Visible Impact

A Core Civil War match now KOs the **entire** HQ on a Scheme Twist (not just 2 Heroes), applying real HQ pressure. A Core Cosmic Cube match now deals **no** wounds early, then 1 wound on twists 5-6 and 3 on twist 7 — the printed escalation — instead of a flat 1 wound every twist (which both over-punished early and under-punished the twist-7 spike). No change to any other scheme or public/monetization surface. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The two partial configs are present with their current (partial) params
grep -q "resolverId: 'ko-from-hq'" packages/game-engine/src/rules/schemeTwistConfigs.ts && grep -q "koCount: 2" packages/game-engine/src/rules/schemeTwistConfigs.ts && grep -q "resolverId: 'wound-all'" packages/game-engine/src/rules/schemeTwistConfigs.ts && grep -q "woundCount: 1" packages/game-engine/src/rules/schemeTwistConfigs.ts && echo "A_OK"
# Expected: A_OK

# B. The two resolvers exist to extend
grep -q "function koFromHq" packages/game-engine/src/rules/schemeTwistResolvers.ts && grep -q "function woundAll" packages/game-engine/src/rules/schemeTwistResolvers.ts && echo "B_OK"
# Expected: B_OK

# C. The scheme-twist counter increments as a returned EFFECT (resolver runs first)
grep -q "schemeTwistCount" packages/game-engine/src/rules/schemeHandlers.ts && echo "C_OK"
# Expected: C_OK

# D. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — the config registry. `super-hero-civil-war` (`resolverId: 'ko-from-hq'`, `params: { koCount: 2 }`, `lossThresholdByPlayerCount`, `resourceLossCondition: pile-depleted heroDeck`) and `unleash-the-power-of-the-cosmic-cube` (`resolverId: 'wound-all'`, `params: { woundCount: 1 }`, `lossThreshold: 8`). Only the `params` change; the loss config stays.
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — `koFromHq` already builds an `eligible` HQ-hero list (cheapest-first, slot-tiebroken), KOs `Math.min(koCount, eligible.length)`, refills each slot, and even logs *"only N eligible — KO'ing all of them"* when `eligible.length < koCount`. Adding `koAll` reuses that path (KO `eligible.length`). `woundAll` deals `woundCount` wounds to every player; adding `escalation` makes the count twist-driven.
- `packages/game-engine/src/rules/schemeHandlers.ts` — `schemeTwistHandler` calls the resolver (mutating `G` directly) and **then** returns effects, including the `modifyCounter schemeTwistCount +1`. So at resolver time `G.counters.schemeTwistCount` is the count from **prior** twists; the **current** twist number is `(schemeTwistCount ?? 0) + 1`. This ordering is the load-bearing invariant for the Cosmic Cube escalation (documented with a `// why:` + a test).
- Civil War's hero-deck-empty loss (WP-510) and its 2p 4-Hero sizing (WP-515) already model the setup/loss; this WP is only the twist EFFECT (the KO count). Cosmic Cube's twist-8 loss (`lossThreshold: 8`, D-24178) is already correct; this WP is only the wound schedule.
- Master Strikes / scheme twists are selection-keyed, not markers, and not in the effect-implementation index — so this WP touches **no** `data/cards`, no marker, and regenerates **no** ledger/index artifact.

---

## Scope (In)

**Part A — Super Hero Civil War (KO-all):**
- Modify `koFromHq` (`schemeTwistResolvers.ts`) — accept `params['koAll']` as an optional boolean. When `koAll === true`, KO **all** eligible HQ Heroes (KO count = `eligible.length`, still cheapest-first/slot-tiebroken, each refilled) and log accordingly; `koCount` is then not required. When `koAll` is absent/false, the existing `koCount` behavior is unchanged.
- Modify `schemeTwistConfigs.ts` — `super-hero-civil-war` `params: { koCount: 2 }` → `params: { koAll: true }`. Update the config's `// why:` (the twist KOs all HQ Heroes, not 2).

**Part B — Unleash the Cosmic Cube (escalation):**
- Modify `woundAll` (`schemeTwistResolvers.ts`) — accept `params['escalation']` as an optional `Array<{ atOrAfterTwist: number; woundCount: number }>`. When present, compute `currentTwist = (gameState.counters.schemeTwistCount ?? 0) + 1` and set the effective wound count to the **maximum** `woundCount` among steps whose `atOrAfterTwist <= currentTwist` (0 when none match); deal that many wounds to each player (0 = no wounds, a logged no-op). When `escalation` is absent, the existing flat `woundCount` behavior is unchanged.
- Modify `schemeTwistConfigs.ts` — `unleash-the-power-of-the-cosmic-cube` `params: { woundCount: 1 }` → `params: { escalation: [{ atOrAfterTwist: 5, woundCount: 1 }, { atOrAfterTwist: 7, woundCount: 3 }] }`. Update the config's `// why:` (the printed escalation).

**Both:** add tests — `koFromHq` KO-all cases (all HQ Heroes KO'd + refilled; fewer-than-5 handled), `woundAll` escalation cases (0 wounds at twists 1-4, 1 at 5-6, 3 at 7, driven by `schemeTwistCount`; flat `woundCount` path still works), and the two config-`params` assertions.

## Out of Scope

- **Loss conditions** — Civil War's hero-deck-empty loss (WP-510) + 2p sizing (WP-515) and Cosmic Cube's twist-8 loss (`lossThreshold: 8`) are already correct and unchanged.
- **Every other scheme** — only these two configs' `params` + the two resolvers' param handling change; no other config or resolver behavior changes (the flat-`woundCount` / `koCount` paths remain for any current or future caller).
- **New resolvers / counters / persistent shapes** — both fixes are param-driven on the existing `koFromHq` / `woundAll` + the existing `schemeTwistCount` counter. No `SchemeTwistResolverId` / union / registry / phrases change.
- **Any `data/cards`, marker, effect-index, or mechanic-ledger change** — schemes are selection-keyed.

---

## Files Expected to Change

- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** (`koFromHq` `koAll` param; `woundAll` `escalation` param)
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** (Civil War + Cosmic Cube `params`; two `// why:` updates)
- `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` — **modified** (KO-all + escalation cases)
- `packages/game-engine/src/rules/schemeTwistConfigs.test.ts` — **modified** (the two `params` assertions)
- `docs/ai/DECISIONS.md` — **modified** (land D-24349)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-540 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Single layer (Game Engine); standard two-session lane (two card fidelity fixes + a D-entry).

---

## Contract (Locked by D-24349)

- **Civil War:** its Scheme Twist KOs **all** eligible HQ Heroes (each refilled from the Hero Deck), via `koFromHq` with `params: { koAll: true }`. The loss stays hero-deck-empty (WP-510).
- **Cosmic Cube:** its Scheme Twist deals wounds on the printed **escalation** — 0 on twists 1-4, 1 each on twists 5-6, 3 on twist 7 — via `woundAll` with `params: { escalation: [{5→1},{7→3}] }`, keyed on `currentTwist = (schemeTwistCount ?? 0) + 1` (read at resolver time, before the increment effect applies). The loss stays `lossThreshold: 8`.
- **Param semantics:** `koAll` (boolean, KO-all when true) and `escalation` (max matching-step wound count, 0 when none) are additive to the existing `koCount` / flat-`woundCount` params, which remain the default when the new param is absent.
- Both are selection-keyed (`G.selection.schemeId`); no new resolverId/counter/persistent shape; no `data/cards`/marker/ledger/index change.

### Determinism / persistence

Deterministic: reads `G` / `G.counters`, no `ctx.random`, no I/O, no new persistent shape (config data + the existing `schemeTwistCount` counter). Replay-identical. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture reaches a Civil-War or Cosmic-Cube twist — **none expected** (the sole complete-game fixture uses Legacy Virus).

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of`, full-sentence `[Scheme Twist]` logs, `// why:` on the `koAll` path, the `escalation` max-step selection, and the `schemeTwistCount + 1` pre-increment read. No `.reduce()` in the escalation selection. ESM, Node v22+. Session output emits full file contents.

---

## Acceptance Criteria

1. `koFromHq` KOs **all** eligible HQ Heroes when `params.koAll === true` (count = `eligible.length`, cheapest-first/slot-tiebroken, each slot refilled), and its existing `koCount` behavior is unchanged when `koAll` is absent.
2. `super-hero-civil-war` config `params` is `{ koAll: true }` (no `koCount`); its loss config (`lossThresholdByPlayerCount` + `resourceLossCondition: pile-depleted heroDeck`) is unchanged.
3. `woundAll` deals the **max matching-step** wound count under `params.escalation`: 0 at `currentTwist < 5`, 1 at 5-6, 3 at 7 — where `currentTwist = (schemeTwistCount ?? 0) + 1`; 0 wounds is a logged no-op (no throw); its existing flat-`woundCount` behavior is unchanged when `escalation` is absent.
4. `unleash-the-power-of-the-cosmic-cube` config `params` is `{ escalation: [{ atOrAfterTwist: 5, woundCount: 1 }, { atOrAfterTwist: 7, woundCount: 3 }] }` (no flat `woundCount`); `lossThreshold: 8` is unchanged.
5. No new `SchemeTwistResolverId` / counter / persistent shape; no `ctx.random`; no `data/cards`/marker/ledger/index/client change.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).

---

## Verification Steps

```bash
# 1. Config params updated
grep -nE "koAll: true|escalation:|atOrAfterTwist" packages/game-engine/src/rules/schemeTwistConfigs.ts
grep -c "koCount: 2\|woundCount: 1" packages/game-engine/src/rules/schemeTwistConfigs.ts  # expect 0 (both replaced)

# 2. Resolver param handling
grep -nE "koAll|escalation|schemeTwistCount" packages/game-engine/src/rules/schemeTwistResolvers.ts

# 3. No new resolverId / forbidden surfaces / RNG
grep -c "SchemeTwistResolverId\|SCHEME_TWIST_RESOLVER_KEYS" packages/game-engine/src/rules/schemeTwistResolvers.ts  # unchanged (no new id)
git diff --name-only | grep -E '^(data/cards|data/metadata|apps/|docs/ai/coverage)' ; echo "hits above (expect none but governance)"
grep -c "ctx.random" packages/game-engine/src/rules/schemeTwistResolvers.ts

# 4. Engine + full build/test
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: all exit 0; no finalStateHash / PRE_WP080 change

# 5. Live (post-deploy; D-24026): a Core Civil War match — a Scheme Twist KOs every HQ Hero;
#    a Core Cosmic Cube match — no wounds on twists 1-4, 1 wound each on 5-6, 3 on 7, Evil Wins
#    at 8. Record in STATUS (operator-pending).
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] Civil War KOs all HQ Heroes; Cosmic Cube deals the 0/1/3 escalation by twist; both loss configs unchanged
- [ ] Both fixes param-driven on the existing resolvers; no new resolverId/counter/persistent shape
- [ ] No `ctx.random`, no `data/cards`/marker/ledger/index/client change
- [ ] Engine build + test green; `pnpm -r` green; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] `docs/ai/STATUS.md` Done entry names WP-540 + both schemes, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24349 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-540 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-575:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: both twists confirmed in deployed matches (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: the two configs (`ko-from-hq`/`koCount: 2`, `wound-all`/`woundCount: 1`) + the two resolvers (`koFromHq` with its existing all-eligible-when-fewer path; `woundAll`) are on `main`; `schemeTwistHandler` calls the resolver **before** applying the `schemeTwistCount` increment effect (confirmed — the increment is a returned `modifyCounter` effect), so `(schemeTwistCount ?? 0) + 1` is the current twist at resolver time. Both fixes are param-additive; the existing `koCount` / flat-`woundCount` paths remain. **Empirical Scaffold N/A** — additive param handling, tightens no existing validation path. **Mutation Boundary** — resolvers mutate `G` deterministically via existing idioms (`koCard`/`refillHqSlot`/`gainWound`); no RNG.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13, after one RISK round)

Layer boundary (engine-only), determinism (reads `G`/counters, no `ctx.random`, no new persistent shape → no re-pin expected), contract fidelity (both printed effects modeled — KO-all + the 0/1/3 escalation — with loss configs untouched), and scope (only two configs' params + two resolvers' param handling; the flat paths remain for any other caller) all clear. RISK folded: the Cosmic Cube escalation's off-by-one hinges on the resolver-runs-before-increment ordering, so the current twist is `schemeTwistCount + 1`, not `schemeTwistCount` — locked in the Contract + a `// why:` + a test that sets `schemeTwistCount` to 4/5/6 and asserts wounds 0→1→1→3 across twists 5/6/7. Second RISK folded: `escalation` picks the MAX matching step (twist 7 matches both the 5→1 and 7→3 steps), not the first/last — locked in AC-3.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–D w/ expected output). **§4 Context** — PASS (both configs, both resolvers, the dispatch ordering, the WP-510/515 boundary; 00.2 N/A — config data, no new shape). **§5 Files** — PASS (closed engine allowlist + governance). **§6 Naming** — PASS (`koAll`, `escalation`, `atOrAfterTwist`, `schemeTwistCount` match canon). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine-only). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; KO-all + escalation-by-twist + config-params cases). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24349 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements the printed twists), §22 (determinism — config-data + existing counter, no RNG). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes two printed twists faithful without altering determinism, loss conditions, or any other scheme. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** deterministic mutation, no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
