# WP-542 — Core Villain Recursive Villain-Deck Play (Endless Armies of HYDRA + The Leader)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (Core matches with Endless Armies of HYDRA / The Leader — their abilities now play villain-deck cards; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) + Card Data.
**Dependencies:** WP-485 / D-24290 (the villain-effect-primitive vocabulary + marker pipeline); WP-481 / D-24287 (the `become-scheme-twist` **secondary-fire-site** pattern this reuses for effects that need the reveal/rule pipeline the executor lacks); the `chained-reveals` scheme resolver + `performVillainReveal` (the canonical "play the top villain-deck card" machinery, with its empty-deck guard + safe recursion).

---

## Goal

After this session, two hollow Core villain abilities that **play the top card(s) of the Villain Deck** are faithful:

- **Endless Armies of HYDRA** (villain `core/hydra/endless-armies-of-hydra`) — *"Fight: Play the top two cards of the Villain Deck."*
- **The Leader** (villain `core/radiation/the-leader`) — *"Ambush: Play the top card of the Villain Deck."*

The recursive-reveal machinery already exists — `performVillainReveal` (`villainDeck.reveal.ts`) is the canonical "reveal + resolve the top villain-deck card," and the `chained-reveals` scheme resolver (Negative Zone) already loops it N times with an empty-deck guard and safe recursion (a played card that triggers another reveal / scheme-twist / master-strike recurses through the rule pipeline). But the **villain-effect executor deliberately lacks `RevealContext` + `implementationMap`** (`villainEffects.execute.ts` ~1255), so this WP uses the **WP-481 `become-scheme-twist` secondary-fire-site pattern**: a new append-only `play-villain-deck-cards` primitive that is a **reachable no-op** in the executor, with the actual reveal fired from the two sites where the reveal pipeline is in scope — `villainDeck.reveal.ts` (The Leader's Ambush) and `fightVillain.ts` (Endless Armies' Fight). One primitive clears both cards. Locked by D-24351.

## User-Visible Impact

A player defeating Endless Armies of HYDRA sees the top two Villain Deck cards played (villains enter the city, henchmen/bystanders/scheme-twists/master-strikes resolve as revealed); revealing The Leader plays the top card similarly. Instead of those abilities doing nothing. No change to any other card or public/monetization surface. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The two cards are currently unmarked
node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); const h=(m.villains.core||{}).hydra||{}; const r=(m.villains.core||{}).radiation||{}; process.exit((h['endless-armies-of-hydra']?.fight||r['the-leader']?.ambush)?1:0)" && echo "A_OK unmarked" || echo "A_MARKED (STOP)"
# Expected: A_OK unmarked

# B. The reveal machinery + the secondary-fire precedent are present
grep -q "export function performVillainReveal" packages/game-engine/src/villainDeck/villainDeck.reveal.ts && grep -q "function chainedReveals" packages/game-engine/src/rules/schemeTwistResolvers.ts && grep -q "villainCardEscapeTriggersSchemeTwist" packages/game-engine/src/villain/villainEffects.execute.ts && echo "B_OK"
# Expected: B_OK

# C. DEFAULT_IMPLEMENTATION_MAP is a static module constant (importable at the fight site)
grep -q "DEFAULT_IMPLEMENTATION_MAP" packages/game-engine/src/rules/ruleRuntime.impl.js 2>/dev/null || grep -q "export const DEFAULT_IMPLEMENTATION_MAP" packages/game-engine/src/rules/ruleRuntime.impl.ts && echo "C_OK"
# Expected: C_OK

# D. The fight fire site calls executeVillainAbilities onFight, and the reveal path owns the ambush fire
grep -q "executeVillainAbilities(G, ctx, cardId, 'onFight'" packages/game-engine/src/moves/fightVillain.ts && grep -q "ambushResolved" packages/game-engine/src/villainDeck/villainDeck.reveal.ts && echo "D_OK"
# Expected: D_OK

# E. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "E_OK"
# Expected: E_OK
```

---

## Context (Read First)

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — `performVillainReveal(gameState, context, implementationMap)` reveals + resolves the top villain-deck card (draw → classify → route → chain), reshuffling the discard into the deck when empty (via `context`'s shuffle provider). The **onAmbush fire site** (~393, where `ambushResolved` is emitted) resolves a revealed villain's Ambush abilities with `context` + `DEFAULT_IMPLEMENTATION_MAP` already in scope — the fire site for The Leader.
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — `chainedReveals` (Negative Zone) is the reference loop: call `performVillainReveal` N times, breaking early when `villainDeck.deck` and `villainDeck.discard` are both empty. Extract/mirror this as the shared `playTopVillainDeckCards(G, context, implementationMap, count)` helper.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — the executor (`executeVillainAbilities`) deliberately does NOT receive `hookRegistry + implementationMap + RevealContext` (~1255). `villainEffectBecomeSchemeTwist` (WP-481) is the template: the handler is a **reachable no-op** (`return { targets: [] }`), and `villainCardEscapeTriggersSchemeTwist(G, cardId)` reads the hook at the fire site where the pipeline is in scope. Mirror both: a no-op `play-villain-deck-cards` handler + a `villainCardPlaysVillainDeckCards(G, cardId, timing): number` detector (returns the count N, or 0).
- `packages/game-engine/src/moves/fightVillain.ts` — `executeVillainAbilities(G, ctx, cardId, 'onFight', shuffleContext, cityIndex)` (~282) resolves a defeated villain's Fight abilities. The **onFight fire site** for Endless Armies: after that call, if `villainCardPlaysVillainDeckCards(G, cardId, 'onFight') > 0`, build a narrow `RevealContext` (`{ random: <shuffleContext/ctx.random>, ctx: { currentPlayer } }` — the shape `performVillainReveal` reads) and import the **static** `DEFAULT_IMPLEMENTATION_MAP` (`rules/ruleRuntime.impl.ts`, already imported by `game.ts` + `villainDeck.reveal.ts`), then call `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 2)`.
- `packages/game-engine/src/rules/villainAbility.types.ts` — `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (a drift test asserts parity); `VillainAbilityTiming = 'onAmbush' | 'onFight' | 'onEscape'`. Append `play-villain-deck-cards` (append-only, D-24034).
- `scripts/convert-cards/inputs/villain-effect-markers.json` + `apply-effect-markers.mjs` — add `villains.core.hydra['endless-armies-of-hydra'].fight = ['play-villain-deck-cards:2']` and `villains.core.radiation['the-leader'].ambush = ['play-villain-deck-cards:1']`; regenerate `data/cards/core.json` + the villain mechanic ledger + effect index (all card-data-derived feeds).

---

## Scope (In)

- Add `play-villain-deck-cards` to the `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (append-only) in `villainAbility.types.ts`.
- In `villainEffects.execute.ts`: add a **reachable no-op** `play-villain-deck-cards` handler (`return { targets: [] }`, self-narration optional — the fire sites narrate the reveals) + registry entry + parse the `:N` count; add the detector `villainCardPlaysVillainDeckCards(G, cardId, timing): number` (mirror `villainCardEscapeTriggersSchemeTwist`, reading the descriptor's count for the given timing).
- In `villainDeck.reveal.ts`: add/extract the shared `playTopVillainDeckCards(G, context, implementationMap, count)` helper (the `chainedReveals` empty-deck-guarded loop). At the **onAmbush fire site**, after the ambush abilities resolve, if `villainCardPlaysVillainDeckCards(G, cardId, 'onAmbush') > 0`, call it (The Leader, count 1) with the in-scope `context` + `implementationMap`.
- In `fightVillain.ts`: at the **onFight fire site**, after the `executeVillainAbilities(...'onFight'...)` call, if `villainCardPlaysVillainDeckCards(G, cardId, 'onFight') > 0`, build the narrow `RevealContext` + import `DEFAULT_IMPLEMENTATION_MAP`, and call `playTopVillainDeckCards(...)` (Endless Armies, count 2).
- Add the two markers to `villain-effect-markers.json`; regenerate `data/cards/core.json` + the villain ledger + effect index.
- Add tests: the shared `playTopVillainDeckCards` loop (plays N, empty-deck guard, no infinite recursion), the detector, the two fire sites (Ambush plays 1 / Fight plays 2), the drift test update (primitives count +1), and the marker assertions.

## Out of Scope

- **Maestro** (counted self-KO) + **Supreme HYDRA** (dynamic piercing) — the remaining villain-batch follow-ons; separate WPs.
- **Threading `implementationMap`/`RevealContext` through the villain-effect executor** — the WP-481 pattern deliberately fires from the sites that already have the pipeline, NOT by widening the executor's signature.
- **Any new reveal/classification behavior** — this reuses `performVillainReveal` verbatim; it plays cards exactly as a normal villain-deck reveal (no new routing).
- **Any other card, set, or primitive.**

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** (union + array: `play-villain-deck-cards`)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (no-op handler + registry + parse + `villainCardPlaysVillainDeckCards` detector)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** (`playTopVillainDeckCards` helper + the onAmbush fire site)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** (the onFight fire site: build RevealContext + import `DEFAULT_IMPLEMENTATION_MAP` + call the helper)
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** (two markers)
- `data/cards/core.json` — **modified** (regenerated: the two `[effect:play-villain-deck-cards:N]` markers)
- villain mechanic ledger + effect-implementation index — **modified** (regenerated feeds)
- Tests (`villainEffects.execute.test.ts` / `villainDeck.reveal.test.ts` / `fightVillain.test.ts` + primitive drift test + marker test) — **modified**
- `docs/ai/DECISIONS.md` — **modified** (land D-24351)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-542 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Game Engine + Card Data; standard two-session lane (one new primitive + two fire sites + recursion + a D-entry).

---

## Contract (Locked by D-24351)

- **`play-villain-deck-cards:N`** (new, append-only): plays (reveals + resolves) the top `N` cards of the Villain Deck via `performVillainReveal`, stopping early when the deck and discard are both empty. Implemented via the **secondary-fire-site** pattern (WP-481): a reachable no-op executor handler; the actual reveal fires from `villainDeck.reveal.ts` (onAmbush) + `fightVillain.ts` (onFight), where `performVillainReveal` + `DEFAULT_IMPLEMENTATION_MAP` + a `RevealContext` are in scope. The fight site builds the `RevealContext` from its `ctx` + `shuffleContext`; the reveal site uses the ones already threaded.
- **Endless Armies of HYDRA** → `play-villain-deck-cards:2` (Fight); **The Leader** → `play-villain-deck-cards:1` (Ambush).
- Marked in the card data (the mark is the card-data change); regenerated feeds.

### Determinism / persistence

Deterministic under the engine's RNG contract: `performVillainReveal` reshuffles the discard into the deck when empty via `context`'s shuffle provider (`ctx.random.Shuffle`) — the same allowed reveal-path randomness the scheme `chained-reveals` already uses. No `Math.random`. Recursion terminates: each `performVillainReveal` consumes a deck card (or reshuffles finite discard), bounded by deck + discard size and the empty-deck guard. It mutates hashed `G` fields (villain deck / city / escaped pile / counters) at runtime, but **no committed fixture fights Endless Armies or reveals The Leader**, so `finalStateHash` / `PRE_WP080` are unaffected — verify at execution and re-pin with a note only on a real diff.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of`, full-sentence logs, `// why:` on the no-op-handler/secondary-fire rationale and the fight-site `RevealContext` construction. No `.reduce()`. ESM, Node v22+. Session output emits full file contents.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` (+ union) gains `play-villain-deck-cards` (append-only); the drift test passes. The executor handler is a reachable no-op (`{ targets: [] }`) — not hollow, per the D-24266/WP-257 detector.
2. `playTopVillainDeckCards(G, context, implementationMap, count)` calls `performVillainReveal` up to `count` times, breaking early when `villainDeck.deck` and `.discard` are both empty; `villainCardPlaysVillainDeckCards(G, cardId, timing)` returns the marked count (or 0).
3. **The Leader** (Ambush): revealing it plays the top 1 villain-deck card (fired from the reveal site with the in-scope context/impl-map).
4. **Endless Armies of HYDRA** (Fight): defeating it plays the top 2 villain-deck cards (fired from `fightVillain.ts` with a built `RevealContext` + the static `DEFAULT_IMPLEMENTATION_MAP`).
5. Recursion is safe (a played card that itself reveals/plays more resolves through the rule pipeline; the loop terminates on deck+discard exhaustion; no infinite loop).
6. The two markers are applied to `data/cards/core.json`; the villain ledger + effect index regenerate with both cards executable; the executor is not widened to receive `implementationMap`/`RevealContext`.
7. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).

---

## Verification Steps

```bash
# 1. Primitive + detector + helper + fire sites
grep -nE "play-villain-deck-cards|villainCardPlaysVillainDeckCards|playTopVillainDeckCards" packages/game-engine/src/rules/villainAbility.types.ts packages/game-engine/src/villain/villainEffects.execute.ts packages/game-engine/src/villainDeck/villainDeck.reveal.ts packages/game-engine/src/moves/fightVillain.ts | head
grep -n "DEFAULT_IMPLEMENTATION_MAP" packages/game-engine/src/moves/fightVillain.ts   # the fight site imports the static map

# 2. Markers applied
node -e "const s=JSON.stringify(require('./data/cards/core.json')); console.log('play-villain-deck:', s.includes('play-villain-deck-cards'))"

# 3. Executor NOT widened (secondary-fire discipline preserved)
grep -n "implementationMap\|RevealContext" packages/game-engine/src/villain/villainEffects.execute.ts | grep -iE "executeVillainAbilities|handler" ; echo "expect: no implementationMap/RevealContext added to the executor/handler signatures"

# 4. No Math.random; real card-data diff; feeds regenerated
grep -c "Math.random" packages/game-engine/src/villainDeck/villainDeck.reveal.ts packages/game-engine/src/moves/fightVillain.ts
git diff --numstat data/cards/core.json
git status --short | grep -E 'ledger|effect-implementation|card-mechanics'

# 5. Engine + full build/test
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8

# 6. Live (post-deploy; D-24026): defeat Endless Armies of HYDRA (top 2 villain-deck cards play);
#    reveal The Leader (top card plays); the game log shows the chained reveals. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed before the edit
- [ ] All 7 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] One new append-only primitive (reachable no-op executor handler) + the detector + the shared loop; two fire sites (Ambush reveal + Fight)
- [ ] The executor is NOT widened; `DEFAULT_IMPLEMENTATION_MAP` imported at the fight site; recursion terminates
- [ ] `data/cards/core.json` + villain ledger + effect index regenerated (real diff, freshness gate green)
- [ ] No `Math.random`; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] Engine build + test green; `pnpm -r` green
- [ ] `docs/ai/STATUS.md` Done entry names WP-542 + both cards, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24351 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-542 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-577:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: both cards' plays confirmed in deployed matches (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: `performVillainReveal` + `chainedReveals` (the play-top-N loop with the empty-deck guard + safe recursion), the WP-481 secondary-fire template (`villainEffectBecomeSchemeTwist` reachable no-op + `villainCardEscapeTriggersSchemeTwist` detector), the static `DEFAULT_IMPLEMENTATION_MAP` (importable at the fight site — already imported by `game.ts` + `villainDeck.reveal.ts`), the `onFight` fire site in `fightVillain.ts`, and the `onAmbush` fire site in `villainDeck.reveal.ts` are all on `main`; the two cards are unmarked. The change adds one append-only primitive (no-op in the executor) + a detector + a shared reveal loop + two fire-site hooks — no executor-signature widening. **Empirical Scaffold N/A** — additive vocabulary + fire-site hooks, tightens no existing validation path. **Mutation Boundary** — the reveal loop mutates `G` via `performVillainReveal` (existing idiom); randomness is `ctx.random.Shuffle` through the RevealContext (allowed). **PS-item folded:** the card-data-derived feeds must all be regenerated (freshness gate); recursion termination is bounded by deck+discard + the empty-deck guard — both in the AC/DoD.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13, after one RISK round)

Layer boundary (engine + card-data), determinism (`ctx.random.Shuffle` via the reveal path — no `Math.random`; recursion bounded), contract fidelity (both cards play villain-deck cards exactly as a normal reveal), and scope (the executor is NOT widened; the secondary-fire pattern fires from the sites that already own the pipeline) all clear. RISK folded: the **fight** fire site must build the narrow `RevealContext` from its `ctx` + `shuffleContext` and import the STATIC `DEFAULT_IMPLEMENTATION_MAP` (not a runtime-built map) — locked in the Contract + AC-4 + a `// why:`. Second RISK folded: recursion could otherwise loop if `performVillainReveal` doesn't consume/exhaust — the shared loop keeps `chainedReveals`' both-empty guard, and a test asserts termination + the "plays fewer than N when the deck runs out" path.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–E w/ expected output). **§4 Context** — PASS (`performVillainReveal`/`chainedReveals`, the become-scheme-twist template, the static impl-map, both fire sites, the timing enum; 00.2 — field/timing names match canon). **§5 Files** — PASS (closed engine + card-data + derived-feed allowlist + governance). **§6 Naming** — PASS (`play-villain-deck-cards`, `playTopVillainDeckCards`, `villainCardPlaysVillainDeckCards` mirror the WP-481 detector). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine + card-data; the executor boundary is respected, not widened). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; loop-termination + fire-site + detector + drift + marker cases). **§13 Verification** — PASS. **§14 AC** — PASS (7 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24351 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements two printed villain-deck-play abilities), §22 (determinism — `ctx.random.Shuffle` via the reveal path, bounded recursion). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes two printed abilities faithful by reusing the existing reveal machinery, without new randomness or executor widening. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** reveal-path RNG only, bounded recursion, no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine/card-data gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
