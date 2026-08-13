# WP-539 — Portals to the Dark Dimension Scheme Twist (Dark-Portal attack buffs)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (a Core Portals match — Dark Portals now raise villain/mastermind attack, and the twist-7 loss is correct-by-design; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) only.
**Dependencies:** WP-513 / D-24325 (the Killbots dynamic-attack precedent — a scheme-twist counter read at combat time by `resolveFightCost`); WP-489 / D-24295 (the City-space index binding, `citySpaceNames.ts`); D-24178 (the twist-loss vs doom-clock-proxy model in `schemeTwistConfigs.ts`).

---

## Goal

After this session, the Core scheme **"Portals to the Dark Dimension"** is faithful. Today it is the **only truly-hollow Core scheme** (2026-08-13 scheme-coverage audit): it has no `SCHEME_TWIST_CONFIGS` entry, so `schemeTwistHandler` logs *"No resolver configured … counter increment only,"* the Dark-Portal attack buffs are unmodeled, and it loses at twist 7 **only by coincidence** (the unconfigured MVP fallback threshold happens to equal the printed loss-twist). This WP implements the printed card:

- **Setup:** 7 Twists, each a Dark Portal.
- **Twist 1:** Dark Portal above the Mastermind → the Mastermind gets **+1 attack**.
- **Twists 2-6:** Dark Portal in the leftmost city space without one → Villains in that space get **+1 attack**.
- **Twist 7:** Evil Wins.

The implementation adds an explicit twist-loss config (`lossThreshold: 7`, no `resourceLossCondition` — making the twist-7 loss correct-by-design, not coincidental), a `DARK_PORTAL_COUNT` counter driven by a new `portals` resolver, a **positional villain attack buff** in `resolveFightCost` (the single villain-attack source), and a **static mastermind attack buff** via a new centralized `resolveMastermindFightCost`. Locked by D-24348.

## User-Visible Impact

A player in a Core Portals match sees villain and mastermind fight requirements **climb** as Dark Portals accumulate (the Mastermind after twist 1; each city space as its portal lands, twists 2-6), and Evil Wins at twist 7 — the scheme now applies real pressure instead of doing nothing until an arbitrary loss. No change to any other scheme, mastermind, or public/monetization surface. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. Portals has no config today (this WP adds it)
node -e "const {SCHEME_TWIST_CONFIGS}=require('./packages/game-engine/dist/rules/schemeTwistConfigs.js'); process.exit(SCHEME_TWIST_CONFIGS.has('core/portals-to-the-dark-dimension')?1:0)" && echo "A_OK absent" || echo "A_EXISTS (STOP + inspect)"
# Expected: A_OK absent  (build dist first if the module is missing)

# B. The scheme-twist system + the Killbots dynamic-attack precedent are present
grep -q "SCHEME_TWIST_RESOLVERS" packages/game-engine/src/rules/schemeTwistResolvers.ts && grep -q "KILLBOT_TWISTS_NEXT_TO_SCHEME" packages/game-engine/src/economy/economy.resolve.ts && grep -q "function resolveFightCost" packages/game-engine/src/economy/economy.resolve.ts && echo "B_OK"
# Expected: B_OK

# C. The mastermind fight requirement is read inline (the site to centralize)
grep -q "cardStats\[G.mastermind.baseCardId\]?.fightCost" packages/game-engine/src/moves/fightMastermind.ts && echo "C_OK"
# Expected: C_OK

# D. The City-space index binding exists (WP-489)
test -f packages/game-engine/src/board/citySpaceNames.ts && echo "D_OK"
# Expected: D_OK

# E. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "E_OK"
# Expected: E_OK
```

If B fails, the scheme-twist / economy system is not on `main` as assumed — STOP and reconcile.

---

## Context (Read First)

- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — the config registry (`SCHEME_TWIST_CONFIGS`, keyed by scheme ext_id). Its header already names Portals as the one unconfigured scheme and a **TRUE twist-loss** (printed "Twist 7: Evil Wins!"), the same shape as Cosmic Cube (`lossThreshold: 8`, no `resourceLossCondition`). Portals gets `lossThreshold: 7`, no `resourceLossCondition` (D-24178).
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — the `SCHEME_TWIST_RESOLVERS` registry (`Record<SchemeTwistResolverId, …>`). The **`killbots` resolver** (WP-513) is the closest precedent: it bumps a per-scheme counter (`KILLBOT_TWISTS_NEXT_TO_SCHEME`) that later drives attack. The new `portals` resolver mirrors this — bump `DARK_PORTAL_COUNT`, log which portal landed.
- `packages/game-engine/src/economy/economy.resolve.ts` — **`resolveFightCost(G, villainCardId)` is the single authoritative villain-attack source** (consumed by `fightVillain`, `uiState.build`, `ai.legalMoves`). The Killbots branch (`G.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME]`) shows the pattern for a scheme-counter-driven buff. The Portals villain buff adds `+1` when the scheme is Portals AND the villain's **city space** has a Dark Portal.
- **City binding (WP-489 / D-24295, `citySpaceNames.ts`):** index 0 = Sewers (entry) … index 4 = Bridge (escape); villains advance 0→4. The wireframe renders the row L→R Bridge…Sewers (escape on the left), so **"leftmost city space" = the escape end = the highest portal-less index**. Fill order for twists 2-6: index 4 (Bridge), 3, 2, 1, 0. So city space `K` has a Dark Portal iff `DARK_PORTAL_COUNT >= 6 - K` (K=4 at twist 2 … K=0 at twist 6). A villain's city index is `G.city.indexOf(villainCardId)`. **The fill direction is locked by D-24348 and verified at execution against `DESIGN-BOARD-LAYOUT.md §City row`; all 5 spaces are portal'd by twist 6 regardless of direction, so the direction affects only which villains buff early (twists 2-5).**
- `packages/game-engine/src/moves/fightMastermind.ts` — the mastermind fight requirement is read **inline** as `G.cardStats[G.mastermind.baseCardId]?.fightCost` (line ~68); the same read appears in `uiState.build` (the projected requirement) and `ai.legalMoves` (the bot's affordability check). This WP extracts a **`resolveMastermindFightCost(G)`** helper (base fightCost + the Portals mastermind bonus: `+1` when `DARK_PORTAL_COUNT >= 1`) and routes all three sites through it — so the buff is consistent across combat, UI, and AI (the `resolveFightCost` centralization discipline).
- `packages/game-engine/src/types.ts` — `KILLBOT_TWISTS_NEXT_TO_SCHEME` counter key (line ~74); `DARK_PORTAL_COUNT` is added beside it (a `G.counters` string key; **not** a new persistent shape). `G.counters.schemeTwistCount` is the general twist counter; `DARK_PORTAL_COUNT` is Portals-specific (mirrors the Killbots-specific counter) and increments once per Portals twist.
- Master Strikes / scheme twists are keyed by selection (`G.selection.schemeId`), not markers, and are not in the effect-implementation index — so this WP touches **no** `data/cards`, no marker, and regenerates **no** ledger/index artifact.

---

## Scope (In)

- Modify `packages/game-engine/src/types.ts` — add `export const DARK_PORTAL_COUNT = 'darkPortalCount';` (a `G.counters` key, beside `KILLBOT_TWISTS_NEXT_TO_SCHEME`).
- Modify `packages/game-engine/src/rules/schemeTwistResolvers.ts` — add a `portals` resolver: increment `G.counters[DARK_PORTAL_COUNT]`, and log the placement (twist 1 → "above the Mastermind (+1 attack)"; twists 2-6 → the city space that just gained a portal; twist 7 → the loss is handled by the config threshold, not the resolver). Register it in `SCHEME_TWIST_RESOLVERS` and add `'portals'` to the `SchemeTwistResolverId` union (+ its drift test if one asserts the union↔registry parity).
- Modify `packages/game-engine/src/rules/schemeTwistConfigs.ts` — add the `core/portals-to-the-dark-dimension` entry: `resolverId: 'portals'`, `params: {}`, `lossThreshold: 7`, **no** `resourceLossCondition` (TRUE twist-loss; the twist-7 doom-clock IS the printed loss). Update the header comment (Portals is now configured — remove it from the "one remaining" note).
- Modify `packages/game-engine/src/economy/economy.resolve.ts` — in `resolveFightCost`, add a Portals **positional villain buff**: when `G.selection.schemeId === 'core/portals-to-the-dark-dimension'`, add `+1` if the villain's city space (`G.city.indexOf(villainCardId)`, when found) has a Dark Portal (`DARK_PORTAL_COUNT >= 6 - index`). Applied on top of the resolved static/dynamic cost, after the killbot/skrull overlays.
- Add `packages/game-engine/src/economy/economy.mastermind.ts` (or extend `economy.resolve.ts`) — a **`resolveMastermindFightCost(G): number`** helper = `G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0` + the Portals mastermind bonus (`+1` when scheme is Portals AND `DARK_PORTAL_COUNT >= 1`). Route `fightMastermind.ts`, `uiState.build.ts`, and `ai.legalMoves.ts` through it (replace the three inline `G.cardStats[baseCardId].fightCost` reads).
- Add tests: `schemeTwistResolvers` Portals cases (counter increments; placement logs), `schemeTwistConfigs`/loss cases (loss fires at twist 7, not earlier), `economy.resolve` villain-buff cases (a villain in a portal'd space costs +1; unbuffed spaces unchanged; non-Portals schemes unaffected), and `resolveMastermindFightCost` cases (base + portal bonus; non-Portals unchanged) + the three call sites reflect it.

## Out of Scope

- **A separate Dark-Portal display UI** (a visual marker showing which city spaces / the mastermind carry a portal). The mechanical effect — raised fight requirements — is already projected through `resolveFightCost` / `resolveMastermindFightCost` into `UIState`, so players see the higher numbers. A dedicated portal-token visual is a follow-up.
- **Every other scheme, mastermind, or villain** — Portals only. No change to the Killbots/Cosmic-Cube/etc. configs beyond the header-comment update.
- **Any `data/cards`, marker, effect-index, or mechanic-ledger change** — schemes are keyed by selection, not markers, and are not in the index.
- **Reworking the city-space index binding or the general `schemeTwistCount`** — `DARK_PORTAL_COUNT` is a new Portals-specific counter mirroring the Killbots one; the WP-489 city binding is consumed, not changed.

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** (`DARK_PORTAL_COUNT` counter key)
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** (`portals` resolver + registry + `SchemeTwistResolverId` union)
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** (Portals config entry + header comment)
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** (positional villain Dark-Portal buff)
- `packages/game-engine/src/economy/economy.mastermind.ts` — **new** (`resolveMastermindFightCost` helper) *(or extend `economy.resolve.ts`; executor's call)*
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** (route through `resolveMastermindFightCost`)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** (mastermind requirement via `resolveMastermindFightCost`)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** (mastermind affordability via `resolveMastermindFightCost`)
- Tests: `schemeTwistResolvers.test.ts`, `schemeTwistConfigs.test.ts` (or the loss test), `economy.resolve.test.ts`, `economy.mastermind.test.ts` (**new**) + any `SchemeTwistResolverId` drift test — **modified/new**
- `docs/ai/DECISIONS.md` — **modified** (land D-24348)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-539 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Single layer (Game Engine); standard two-session lane (combat-economy + a mastermind-cost centralization refactor + the scheme system + a D-entry).

---

## Contract (Locked by D-24348)

- **Loss:** Portals is a TRUE twist-loss — `lossThreshold: 7`, no `resourceLossCondition`. Evil Wins when the Portals twist counter reaches 7 (correct-by-design; the previous twist-7 loss was an MVP-fallback coincidence).
- **Counter:** `DARK_PORTAL_COUNT` (`G.counters` key), seeded 0, `+1` per Portals twist by the `portals` resolver. It equals the number of Dark Portals placed.
- **Mastermind buff:** `resolveMastermindFightCost(G)` = base `fightCost` + `1` when the scheme is Portals AND `DARK_PORTAL_COUNT >= 1` (the twist-1 portal). Consumed at every mastermind-requirement read site (combat / UI / AI).
- **Villain buff:** a villain in city space index `K` costs `+1` to fight when the scheme is Portals AND `DARK_PORTAL_COUNT >= 6 - K` (space `K` has been portal'd; leftmost=Bridge=index 4 first). Applied in `resolveFightCost` on top of the static/dynamic cost, after the killbot/skrull overlays. A villain not in the city (index not found) gets no buff.
- Keyed by `G.selection.schemeId === 'core/portals-to-the-dark-dimension'`; no `data/cards`/marker/ledger/index change.

### Determinism / persistence

Deterministic: reads `G` / `G.counters`; no `ctx.random`, no I/O. `DARK_PORTAL_COUNT` is a `G.counters` string key (no new persistent SHAPE; counters are already part of `G`). Replay-identical. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture reaches a Portals twist — **none expected** (verify at execution: the sole complete-game fixture uses Legacy Virus, not Portals).

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of`, full-sentence `[Portals to the Dark Dimension] …` logs, `// why:` on the new counter, the `6 - index` fill formula, and the mastermind-cost centralization. No `.reduce()` in the buff computation. ESM, Node v22+. Session output emits full file contents.

---

## Acceptance Criteria

1. `SCHEME_TWIST_CONFIGS` has a `core/portals-to-the-dark-dimension` entry: `resolverId: 'portals'`, `lossThreshold: 7`, no `resourceLossCondition`; the header comment no longer lists Portals as unconfigured.
2. The `portals` resolver increments `G.counters[DARK_PORTAL_COUNT]` by 1 per twist and logs placement (mastermind on twist 1; the city space gaining a portal on twists 2-6); `'portals'` is in the `SchemeTwistResolverId` union + registry, and the union↔registry drift test (if any) passes.
3. Evil Wins fires when the Portals twist counter reaches **7**, and NOT at 6 or earlier (the twist-loss test asserts the threshold).
4. `resolveFightCost` adds `+1` to a villain in a portal'd city space (`DARK_PORTAL_COUNT >= 6 - index`) under the Portals scheme, `0` for an unportal'd space, `0` for any non-Portals scheme, and `0` for a villain not in the city; the buff stacks on top of static/dynamic/killbot/skrull costs.
4b. `resolveMastermindFightCost(G)` returns base `fightCost` `+1` when the scheme is Portals AND `DARK_PORTAL_COUNT >= 1`, else base; `fightMastermind`, `uiState.build`, and `ai.legalMoves` all consume it (no remaining inline `cardStats[baseCardId].fightCost` reads at those sites).
5. No `ctx.random`; no new persistent shape (counter key only); no `data/cards`/marker/ledger/index/client change.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).

---

## Verification Steps

```bash
# 1. Config + resolver + counter present
grep -nE "core/portals-to-the-dark-dimension|resolverId: 'portals'|lossThreshold: 7" packages/game-engine/src/rules/schemeTwistConfigs.ts
grep -nE "DARK_PORTAL_COUNT|function portals|'portals'" packages/game-engine/src/rules/schemeTwistResolvers.ts

# 2. Villain buff + mastermind centralization
grep -nE "DARK_PORTAL_COUNT|portals-to-the-dark-dimension|6 - " packages/game-engine/src/economy/economy.resolve.ts
grep -rnE "resolveMastermindFightCost" packages/game-engine/src/moves/fightMastermind.ts packages/game-engine/src/ui/uiState.build.ts packages/game-engine/src/simulation/ai.legalMoves.ts
# Expected: all three route through the helper (no inline cardStats[baseCardId].fightCost left there)

# 3. No forbidden surfaces / no RNG
git diff --name-only | grep -E '^(data/cards|data/metadata|apps/|docs/ai/coverage)' ; echo "hits above (expect none but governance docs)"
grep -c "ctx.random" packages/game-engine/src/rules/schemeTwistResolvers.ts packages/game-engine/src/economy/economy.resolve.ts

# 4. Engine + full build/test
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: all exit 0; no finalStateHash / PRE_WP080 change (or a noted re-pin only on a real fixture diff)

# 5. Live (post-deploy; D-24026): a Core Portals match — after twist 1 the Mastermind's
#    fight requirement is +1; as twists 2-6 land, villains in portal'd city spaces cost +1
#    more; Evil Wins at twist 7. The game log shows the "[Portals to the Dark Dimension] …"
#    placement lines. Record in STATUS (operator-pending).
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed before the edit
- [ ] All 6 (+4b) Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] Portals loses at twist 7 by explicit config (not MVP-fallback coincidence); the resolver + counter drive the buffs
- [ ] Villain positional buff + mastermind static buff both fire; all mastermind-requirement sites route through `resolveMastermindFightCost`
- [ ] The `6 - index` (leftmost=Bridge) fill direction verified against `DESIGN-BOARD-LAYOUT.md §City row`; corrected if the doc says otherwise
- [ ] No `ctx.random`, no new persistent shape, no `data/cards`/marker/ledger/index/client change
- [ ] Engine build + test green; `pnpm -r` green; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] `docs/ai/STATUS.md` Done entry names WP-539 + Portals, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24348 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-539 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-574:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: Dark-Portal buffs + twist-7 loss confirmed in a deployed Portals match (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: the scheme-twist system (`SCHEME_TWIST_CONFIGS` / `SCHEME_TWIST_RESOLVERS` / `schemeTwistHandler` MVP fallback), the Killbots scheme-counter-driven attack precedent (`KILLBOT_TWISTS_NEXT_TO_SCHEME` read in `resolveFightCost`), the single villain-attack source `resolveFightCost` (consumed by `fightVillain`/`uiState.build`/`ai.legalMoves`), the inline mastermind fight-requirement read (`fightMastermind.ts:68`), and the WP-489 city binding are all on `main`. Portals is confirmed hollow (no config; the header comment already flags it). The change is config + a counter + a resolver + a positional villain buff + a mastermind-cost centralization — single layer, no new persistent shape, no client. **Empirical Scaffold N/A** — additive scheme behavior + a behavior-preserving mastermind-cost extraction (the +1 is the only new value), not a validation-tightening path. **Mutation Boundary** — the resolver mutates `G.counters` deterministically; the buffs are read-only computations. **One PS-item folded:** the "leftmost" fill direction is a fidelity detail locked by D-24348 and re-verified against the board-layout doc at execution (a one-line flip if wrong; all 5 spaces fill by twist 6 either way).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13, after one RISK round)

Layer boundary (engine-only; no registry/server/client edge), determinism (reads `G`/counters, no `ctx.random`/I/O, counter-only state → no re-pin expected), contract fidelity (both printed buffs modeled — positional villain + static mastermind — plus the correct-by-design twist-7 loss replacing the coincidental fallback), and scope (Portals only; the mastermind-cost extraction is behavior-preserving for every non-Portals scheme) all clear. RISK folded: the mastermind buff must route through a **single** `resolveMastermindFightCost` so combat / UI / AI never disagree (a partial centralization would let the bot mis-judge affordability) — locked as AC-4b + Verification-2 (the grep asserting no inline read remains at the three sites) + an EC failure smell. Second RISK folded: the "leftmost" direction is doc-locked + verified at execution (AC/DoD item).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2 Constraints** — PASS (Contract §Determinism + Code-style). **§3 Assumes** — PASS (A–E w/ expected output). **§4 Context** — PASS (config registry, killbots precedent, `resolveFightCost`, the inline mastermind read, the city binding; 00.2 N/A — no new data shape, a `G.counters` key). **§5 Files** — PASS (closed engine allowlist + governance; the new-file-vs-extend choice noted). **§6 Naming** — PASS (`DARK_PORTAL_COUNT`, `resolveMastermindFightCost`, `portals`; `schemeId`/`fightCost` match canon). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine-only). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; resolver/loss/economy/mastermind cases). **§13 Verification** — PASS. **§14 AC** — PASS (7 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24348 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements the printed scheme), §22 (determinism — counter-only, no RNG). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes a printed scheme faithful and its loss correct-by-design without altering determinism or any other scheme. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** deterministic counter mutation + read-only buff computation; no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
