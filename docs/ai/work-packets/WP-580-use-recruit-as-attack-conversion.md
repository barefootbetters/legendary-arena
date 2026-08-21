# WP-580 — "Use Recruit as Attack" Conversion (God of Thunder)

**Status:** Draft 2026-08-21 — awaiting execution. **Reserves WP-580 / EC-615 / D-24389.** Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21) — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` — after playing God of Thunder, a player can fund a Fight from unspent Recruit ("use Recruit as Attack this turn"), which today does nothing. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) — the engine's first resource-conversion primitive — plus a card-data marker (`data/cards/core.json` via the regen pipeline) and its derived artifacts.
**Dependencies:** the economy subsystem (`economy/economy.logic.ts` — `TurnEconomy`, `resetTurnEconomy`, `getAvailableAttack`, `spendAttack`); the hero-keyword parser + registry (`setup/heroAbility.setup.ts`, `rules/heroKeywords.ts`); the fight moves (`moves/fightVillain.ts`, `moves/fightMastermind.ts`); the bot affordability (`simulation/ai.legalMoves.ts`) and the UIState economy projection (`ui/uiState.build.ts`). All landed. Baseline `origin/main` at draft: `3dd6fbc9`.

---

## Goal

Implement "You can use Recruit as Attack this turn" for God of Thunder (`core/thor/god-of-thunder`). Today the ability is completely and silently unimplemented: the card's ability line carries **no `[keyword:]` marker** (only decorative `[icon:recruit]` / `[icon:attack]` tokens), so `parseAbilityText` resolves it to two no-op grant keywords with undefined magnitude, and `detectHollowHeroHook` does **not** flag it (attack/recruit are `MVP_KEYWORDS` with handlers, so `hasReachable` is true) — it masquerades as applied and never appears in diagnostics. The engine has no resource-conversion primitive at all: `TurnEconomy` silos Attack and Recruit, and the Fight moves spend Attack only. This WP adds a real keyword marker, a turn-scoped economy flag, and an attack-first-then-recruit spend path so a player who plays God of Thunder can pay a Fight cost from unspent Recruit — with the bot affordability projection and the UIState economy projection agreeing on the combined figure.

## User-Visible Impact

On `play.legendary-arena.com`, a player who plays God of Thunder can, for the rest of that turn, spend unspent Recruit toward Fight costs (Villains and the Mastermind) once their Attack is exhausted. The combined "available attack" the play surface shows reflects Attack + convertible Recruit while the flag is set, and reverts next turn. Bots recognise the same affordability, so a bot playing God of Thunder no longer under-fights. Scope is **core God of Thunder only, one-directional (Recruit→Attack), whole-turn**; the other printings and the "any amount" / bidirectional variants are deferred. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. God of Thunder's ability carries NO [keyword:] marker today (only decorative icons)
grep -q "You can use \[icon:recruit\] as \[icon:attack\] this turn" data/cards/core.json && ! grep -A2 "god-of-thunder" data/cards/core.json | grep -q "keyword:recruit-as-attack" && echo "A_OK"
# Expected: A_OK

# B. The economy silos attack/recruit and resets per turn
grep -q "resetTurnEconomy" packages/game-engine/src/economy/economy.logic.ts && grep -q "getAvailableAttack" packages/game-engine/src/economy/economy.logic.ts && echo "B_OK"
# Expected: B_OK

# C. Fight spends attack only; no conversion primitive exists
grep -q "spendAttack" packages/game-engine/src/moves/fightVillain.ts && ! grep -rq "recruit-as-attack" packages/game-engine/src && echo "C_OK"
# Expected: C_OK

# D. The hero-keyword canonical array + union exist (both must be updated together)
grep -q "HERO_KEYWORDS" packages/game-engine/src/rules/heroKeywords.ts && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §"Core Invariants" (Determinism; `G` runtime-only; moves never throw) and §"Rule Execution Pipeline" — the conversion flag lives on `G.turnEconomy`, is set by a hero effect, and is consumed by the Fight moves; no `.reduce()` in economy ops.
- `.claude/rules/code-style.md` §"Drift Detection" — `RULE_EFFECT_TYPES` and the hero-keyword canonical array are drift-pinned: **a new keyword must update BOTH the `HeroKeyword` union and the `HERO_KEYWORDS` array**, or the drift test fails. New engine drift pins are **runtime** assertions (WP-563 / D-24372), not bare `satisfies`.
- `docs/ai/DECISIONS.md` — scan **D-24389** (this WP), the economy decisions, and the hashed-G-field re-pin precedent.
- `data/cards/core.json` — God of Thunder (`core/thor/god-of-thunder`, slot 4): `recruit: "5"`, ability `"You can use [icon:recruit] as [icon:attack] this turn."`. The printed `+5 recruit` is applied independently of the ability and is unaffected.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `parseAbilityText`: `KEYWORD_PATTERN` finds `[keyword:…]` tokens (and records `unresolvedMarker` only for those), `ICON_PATTERN` maps bare `[icon:…]` to grant keywords, `ICON_MAGNITUDE_PATTERN` needs a digit adjacent to the icon (absent here → undefined magnitude).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectAttack` / `heroEffectRecruit` gate on `isValidMagnitude`; `detectHollowHeroHook` + `classifyHeroEffectReason` treat `MVP_KEYWORDS` members as reachable, which is why the missing conversion is not flagged today. Enrolling the new keyword must not re-introduce a false "applied" for a genuinely hollow line.
- `packages/game-engine/src/economy/economy.logic.ts` — `TurnEconomy` (`attack` / `spentAttack` / `recruit` / `spentRecruit`), `getAvailableAttack`, `spendAttack`, `resetTurnEconomy` (clears per-turn state at turn start).
- `packages/game-engine/src/moves/fightVillain.ts` / `moves/fightMastermind.ts` — affordability gate (`getAvailableAttack(G.turnEconomy) < requiredFightCost` → silent return) and `spendAttack`.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — the bot's Fight affordability projection (must mirror the move guard, per the legalMoves↔move-guard invariant).
- `packages/game-engine/src/ui/uiState.build.ts` — the economy projection (`availableAttack`) the client renders.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm the marker syntax and any economy field spellings before adding them.
- `docs/01-VISION.md` §1, §2 (card fidelity), §8 / §22 (determinism).

## Scope (In)

- **`data/cards/core.json` (via the regen pipeline)** — add a `[keyword:recruit-as-attack]` marker to God of Thunder's ability line. The marker is added in the **upstream source / marker pass** and the generated JSON is **regenerated**, never hand-edited alone; the regenerated hero-mechanic ledger (and effect-implementation index, if the hero marker feeds it) are committed in lockstep.
- **`packages/game-engine/src/rules/heroKeywords.ts`** — register `recruit-as-attack` in BOTH the `HeroKeyword` union and the `HERO_KEYWORDS` canonical array (drift-pinned pair), and extend the runtime drift assertion so the addition cannot land unpinned.
- **`packages/game-engine/src/economy/economy.logic.ts`** — add a turn-scoped flag to `TurnEconomy` (e.g. `recruitSpendableAsAttack`, **lazily materialized** — present only when set, absent otherwise — to avoid moving the state-hash oracle; see Determinism) that `resetTurnEconomy` clears at turn start; add a helper for combined available attack (`getAvailableAttack` + convertible Recruit when the flag is set) and a spend path that debits Attack first, then Recruit.
- **`packages/game-engine/src/hero/heroEffects.execute.ts`** — an `onPlay` handler for `recruit-as-attack` that sets the turn flag; enroll the keyword so the hollow detector reports it correctly (reachable-and-applied when the flag is set, not a false positive).
- **`packages/game-engine/src/moves/fightVillain.ts`** and **`moves/fightMastermind.ts`** — the affordability gate and spend use the combined figure and the attack-first-then-recruit spend order when the flag is set; moves still never throw (unaffordable → silent return).
- **`packages/game-engine/src/simulation/ai.legalMoves.ts`** — the bot Fight affordability projection includes convertible Recruit when the flag is set (mirror the move guard).
- **`packages/game-engine/src/ui/uiState.build.ts`** — the economy projection reflects the combined available attack when the flag is set.
- **Tests** — economy unit tests (flag set/cleared per turn; combined available; spend order attack-then-recruit); a fight test (a Fight funded from Recruit after God of Thunder; unaffordable still silent no-op); a `parseAbilityText` test (the marker resolves to the new keyword, magnitude-free); a drift test (union↔array); a hollow-detector test (the line is no longer a silent no-op); a bot legalMoves test (the Fight is offered when Recruit covers the cost); the state-hash oracle reconciliation (see Determinism).

## Out of Scope

- **The other printings and variants.** `msp1` (second Thor printing), `cvwr` ("Fight: spend Recruit as Attack" — fight-gated), `co2e` ("any amount"), and `xmen` (`[keyword:X-Gene]` bidirectional; X-Gene itself unimplemented) are **deferred**, each its own follow-up WP. This WP marks and implements **core God of Thunder only**.
- **Bidirectional conversion (Attack→Recruit).** Only Recruit→Attack is implemented; the reverse and the X-Men bidirectional case are deferred.
- **The printed `+5 recruit`.** Applied independently of the ability; unchanged.
- **Recruit-cost purchases.** The conversion funds Fight (Attack) costs only; Recruiting still spends Recruit normally. No change to `recruitHero`.
- **The console/diagnostics buffer and effect-trace channel.** Untouched (WP-575 territory).

---

## Files Expected to Change

- `data/cards/core.json` — **modified** (God of Thunder `[keyword:recruit-as-attack]` marker, via regen)
- `scripts/convert-cards/inputs/**` **or** the relevant marker pass — **modified** (upstream marker source; executing session confirms the exact stage)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **modified** (regenerated: `pnpm ledger:heroes`)
- `data/metadata/effect-implementation-index.json` — **modified** (regenerated — REQUIRED: `build-effect-implementation-index.mjs` reads `hero-mechanic-ledger.json` as a source, so the new hero-ledger row flows into the effect-index; `pnpm effect-index`, gated by `effect-index:check`)
- `scripts/coverage/mechanic-provenance.json` — **modified** (a `{ wp, decision }` row for the net-new `recruit-as-attack` primitive)
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (union + array + runtime drift pin)
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** (turn flag + combined-available + spend order)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (onPlay handler + hollow-detector enrollment)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** (combined affordability + spend order)
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** (same)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** (bot affordability mirror)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** (economy projection reflects combined available)
- `packages/game-engine/src/**/*.test.ts` — **modified** (economy / fight / parse / drift / hollow / bot / hash-oracle tests)
- `docs/ai/DECISIONS.md` — **modified** (land D-24389)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-580 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

This is a multi-file engine + card-data WP; **not** lightweight-lane-eligible (determinism/economy surface). Standard two-session lane. If the executing session finds the card-data marker + regen is cleanly separable from the engine conversion, it MAY split into paired WPs (marker first, engine second) sharing an `## Assumes` chain — but the single-WP path is the default.

## Contract (Locked by D-24389)

- **The marker and the keyword.** God of Thunder's ability carries `[keyword:recruit-as-attack]`; the engine registers `recruit-as-attack` as a hero keyword (union + canonical array + runtime drift pin). The bare-icon parse that made the line a silent no-op is superseded by the explicit marker.
- **Turn-scoped flag.** An `onPlay` handler sets a per-turn flag on `G.turnEconomy`; `resetTurnEconomy` clears it at turn start. The flag is **lazily materialized** (absent when unset) so the state-hash oracle does not move — OR, if always-present is chosen, the dual re-pin below is mandatory and proven.
- **The flag must SURVIVE every `TurnEconomy` rebuild.** `spendAttack`, `spendRecruit`, and `addResources` each reconstruct `TurnEconomy` from an **explicit 6-field object literal, not a spread** — so a flag set `onPlay` is silently dropped by any later spend/add in the same turn unless every one of these helpers carries it forward. Since play order is player-chosen (God of Thunder, then another resource hero → `addResources` → Fight), a naive implementation silently fails the feature. Every `TurnEconomy`-producing helper must preserve the flag.
- **Optional-field construction discipline.** `packages/game-engine/tsconfig.json` sets `exactOptionalPropertyTypes: true`, so the optional flag (e.g. `recruitSpendableAsAttack?: boolean`) is built by **conditional spread** (truly absent when unset), never assigned from a possibly-`undefined` source — that is exactly what makes the lazy materialization (and the byte-stable hash) work.
- **Two drift pins move together, not one.** Setting the flag is an `onPlay` action → a real `HERO_EFFECT_HANDLERS` entry → the keyword must be added to `HANDLED_KEYWORDS` in lockstep (the bidirectional `HERO_EFFECT_HANDLERS`-keys ↔ `HANDLED_KEYWORDS` test), in addition to the `HeroKeyword` union + `HERO_KEYWORDS` array pin.
- **Spend order.** Fight costs debit **Attack first, then convertible Recruit**. The combined "available attack" figure (`Attack` + `Recruit` when the flag is set) is used identically by the Fight move guard, the bot affordability projection (`ai.legalMoves.ts`), and the UIState economy projection (`uiState.build.ts`) — so bot, player, and move-guard never disagree (the legalMoves↔move-guard invariant).
- **Scope.** Core God of Thunder only; one-directional; whole-turn. Variants deferred.
- **Moves never throw.** An unaffordable Fight (even with conversion) is a silent return, per the move contract.

### Determinism / persistence

`G.turnEconomy` is part of the hashed game state. Adding an **always-present** field changes the serialized bytes and moves both the sentinel `finalStateHash` and `PRE_WP080_HASH` — a **dual re-pin** (per the hashed-G-field precedent), which must be re-derived and the reason recorded. **Preferred:** materialize the flag **lazily** (present only while a conversion is active within a turn; absent at turn boundaries), so a completed replay serializes identically and **neither oracle moves** — verify byte-identical. The flag is reset every turn (`resetTurnEconomy`), never persisted across turns, and is not a snapshot field (snapshots stay counts-only). No `ctx.random`, no I/O. If an oracle moves unexpectedly, **STOP** and reconcile before re-pinning.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names (`recruitSpendableAsAttack`, `getCombinedAvailableAttack`), `for...of` (never `.reduce()`) in economy ops, a `// why:` on the flag (whole-turn semantics + lazy materialization), a `// why:` on the attack-first spend order, and a `// why:` on any `ctx.random`-adjacent or hash-oracle-adjacent line. New drift pins are **runtime** assertions (D-24372). ESM, Node v22+.

---

## Acceptance Criteria

1. God of Thunder's ability carries `[keyword:recruit-as-attack]` in the regenerated `data/cards/core.json`; the marker is sourced upstream and the hero-mechanic ledger AND the effect-implementation-index (fed by the hero ledger) are regenerated in lockstep; `ledger:heroes:check` and `effect-index:check` exit 0.
2. `recruit-as-attack` is registered in the `HeroKeyword` union, the `HERO_KEYWORDS` array, AND `HANDLED_KEYWORDS` (in lockstep with its `HERO_EFFECT_HANDLERS` entry); the runtime drift assertion + the `HERO_EFFECT_HANDLERS`↔`HANDLED_KEYWORDS` test cover it and fail if any is missing.
3. Playing God of Thunder sets a turn-scoped flag on `G.turnEconomy`; `resetTurnEconomy` clears it at turn start (proven by a test across a turn boundary).
4. With the flag set, `fightVillain` and `fightMastermind` can fund a Fight from unspent Recruit, debiting Attack first then Recruit; an unaffordable Fight is still a silent no-op (moves never throw).
5. The bot affordability projection (`ai.legalMoves.ts`) offers the Fight when Attack + convertible Recruit covers the cost, mirroring the move guard; the UIState economy projection reflects the combined available attack.
6. `parseAbilityText` resolves the marker to the new keyword; the hollow detector no longer treats the ability as a silent no-op (no false "applied" for a genuinely hollow line elsewhere).
7. Determinism: the flag is lazily materialized and `finalStateHash` / `PRE_WP080_HASH` are byte-unchanged **or** re-pinned with a recorded reason; the flag never persists across turns and is not a snapshot field.
8. `pnpm -r build` + `pnpm -r --no-bail test` exit 0; engine suite green (economy / fight / parse / drift / hollow / bot / hash-oracle tests); all card-data derived `:check` gates green.

## Verification Steps

```bash
# 1. Marker present in regenerated card data + keyword registered (union + array)
grep -n "keyword:recruit-as-attack" data/cards/core.json
grep -nE "recruit-as-attack|HERO_KEYWORDS" packages/game-engine/src/rules/heroKeywords.ts

# 2. Turn flag reset per turn; spend order attack-first
grep -nE "recruitSpendableAsAttack|resetTurnEconomy|getCombinedAvailableAttack" packages/game-engine/src/economy/economy.logic.ts

# 3. Fight guard + bot + UIState use the combined figure (mirror check)
grep -nE "recruitSpendableAsAttack|CombinedAvailableAttack" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/fightMastermind.ts packages/game-engine/src/simulation/ai.legalMoves.ts packages/game-engine/src/ui/uiState.build.ts

# 4. Card-data derived artifacts regenerated + gated
pnpm -r build && pnpm ledger:heroes && pnpm effect-index 2>&1 | tail -3
pnpm ledger:heroes:check && pnpm effect-index:check 2>&1 | tail -3

# 5. Engine suite + hash oracles
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r --no-bail test 2>&1 | tail -8
# Expected: engine green; finalStateHash / PRE_WP080 byte-unchanged (lazy flag) or re-pinned with a note

# 6. Live (post-deploy; D-24026): play.legendary-arena.com — play God of Thunder, then fund a
#    Fight from unspent Recruit; the play surface's available attack reflects the conversion.
#    Record in STATUS.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 8 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] Marker sourced upstream + regenerated; hero ledger (+ effect-index if fed) regenerated; provenance row added; all `:check` gates green
- [ ] `recruit-as-attack` in union + array + runtime drift pin
- [ ] Turn flag set onPlay, cleared by `resetTurnEconomy`; attack-first-then-recruit spend order across move guard + bot + UIState (all agree)
- [ ] Moves never throw; unaffordable Fight is a silent no-op
- [ ] Determinism: lazy flag → both oracles byte-unchanged (or re-pinned with a recorded reason); flag never persisted across turns; not a snapshot field
- [ ] `pnpm -r build` + `--no-bail test` exit 0; engine suite green
- [ ] `docs/ai/STATUS.md` Done entry names WP-580, records the hash-oracle outcome, and the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24389 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-580 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-615:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed in a real match (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (after draft-time correction, 2026-08-21)

Independent gate review verified **every** engine claim by reading source — no fabricated symbol (`TurnEconomy`, `resetTurnEconomy`, `getAvailableAttack`, `spendAttack`, `fightMastermind.ts`, `HERO_KEYWORDS`, `detectHollowHeroHook`/`MVP_KEYWORDS`, `parseAbilityText`/`ICON_MAGNITUDE_PATTERN`, the economy UIState projection are all real; God of Thunder precondition A holds; the pnpm scripts exist) — and confirmed the **determinism claim is sound**: both oracles serialize `G.turnEconomy` via `JSON.stringify`, which omits absent/`undefined` keys, so a lazily-materialized flag is byte-identical when unset (direct precedent: `lastPlayEffectsFired` D-24221, `diagnostics` D-24271/D-24294). One **blocker was corrected in this draft**: the bot affordability file is `packages/game-engine/src/simulation/ai.legalMoves.ts`, not `rules/ai.legalMoves.ts` (a non-existent path the WP cited in 5 places incl. a Verification grep) — **fixed everywhere**. Residual to verify at execution (not a blocker): confirm no pinned replay fixture plays God of Thunder and captures a mid-turn state with the flag live.

### Copilot (`01.7`) — verdict: **RISK (documented)** (2026-08-21)

Engine layer discipline, move-guard↔bot mirror, moves-never-throw — clean. Three scope-neutral Contract/AC tightenings were **folded into this draft**: (1) the flag must **survive every `TurnEconomy` rebuild** — `spendAttack`/`spendRecruit`/`addResources` reconstruct from explicit 6-field literals (not spreads), so a later same-turn spend silently drops an `onPlay` flag unless each helper carries it forward (the highest-value catch); (2) build the optional flag by **conditional spread** under `exactOptionalPropertyTypes: true` (what makes lazy materialization work); (3) pin `HANDLED_KEYWORDS` ↔ `HERO_EFFECT_HANDLERS` in lockstep (a second drift pin beside the union/array). Also resolved the effect-index "iff fed" hedge to **REQUIRED** (the index reads the hero ledger as a source). No BLOCK — the determinism design is sound.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (after path fix, 2026-08-21)

§1 structure PASS (house `## Contract` substitutes for `## Non-Negotiable Constraints`, per WP-567/577). §6 Naming/Paths — the wrong `rules/ai.legalMoves.ts` path (§6 FAIL as first drafted) is **corrected** to `simulation/ai.legalMoves.ts` everywhere. §16 Code Style PASS (full-word names, `for...of`, runtime drift pins D-24372). §17 Vision present (§1/§2/§10 card fidelity; §8/§22 determinism, with the determinism-preservation line). §20 / §21 N/A justified. No ❌ FAIL triggers.

---

## Vision Alignment

**Clauses touched:** §1, §2, §10 (card fidelity — a printed ability that does nothing today now works as printed), §8 / §22 (determinism — a new turn-scoped state flag, kept replay-faithful via lazy materialization + turn reset, with the hash oracles reconciled). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes God of Thunder faithful without altering RNG sourcing or replay behaviour (the flag is deterministic and turn-scoped). **Non-Goal proximity:** none of NG-1..NG-8 — no monetization, no pay-to-win (the ability is on an existing recruitable card), no player-interaction terminology. **Determinism preservation:** the conversion is fully deterministic; the flag is lazily materialized and turn-reset so a completed replay serializes identically (both hash oracles verified byte-unchanged, or re-pinned with a recorded reason). Replay-faithful per Vision §22.

## Funding Surface Gate

**N/A** — a gameplay ability implementation on an existing hero card; no §20.1 funding surface, no funding copy, no funding channel. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function changes; a pure game-engine + card-data change. `docs/ai/REFERENCE/api-endpoints.md` is unaffected. (Authority: WP-118 / D-11804.)

## Decision (reserved, lands at execution)

**D-24389 — use-recruit-as-attack-conversion.** Reserved in `NUMBER-LEDGER.md` at draft; the `DECISIONS.md` entry lands **Active** when the WP executes. Records: the marker + keyword that fix the silent-no-op parse; the turn-scoped, lazily-materialized `G.turnEconomy` flag cleared by `resetTurnEconomy`; the attack-first-then-recruit spend order applied uniformly to the Fight move guard, the bot affordability projection, and the UIState economy projection (so all agree); the core-God-of-Thunder-only, one-directional, whole-turn scope with the msp1 / cvwr / co2e / xmen variants deferred; and the determinism posture (lazy flag → both oracles byte-unchanged, else a proven dual re-pin).

## Notes

**Why the ability was invisible.** The line had only `[icon:recruit]` / `[icon:attack]` decoration and no `[keyword:]` token, so the parser mapped it to two undefined-magnitude grant keywords that granted nothing, and the hollow detector — which treats `attack`/`recruit` as reachable `MVP_KEYWORDS` — reported it as applied. It was found live: a winner played God of Thunder twice and was never offered the conversion; the end-state economy showed `availableRecruit: 6` the player could have spent as Attack.

**Play-order note.** The flag helps Fights resolved **after** God of Thunder is played that turn (players choose play order, so playing it before fighting is the natural line). Fights already resolved earlier in the turn are unaffected — consistent with the physical card's within-turn resource pooling.
