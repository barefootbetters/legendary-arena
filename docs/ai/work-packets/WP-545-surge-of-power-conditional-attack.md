# WP-545 — Surge of Power Recruit-Threshold Conditional Attack

**Status:** Draft 2026-08-14
**Layer:** Game Engine (`packages/game-engine`) + Card Data
**Depends on:** WP-021 (the `HeroCondition` descriptor + `evaluateAllConditions` gating) ·
WP-179 (`heroClassMatch` / `requiresTeam` condition evaluation) · the D-24055 `[keyword:Spectrum]`
→ `distinctHeroClassesAtLeast` condition-marker precedent
**Reserves:** EC-580 · D-24354
**Lane:** Standard two-session (1 new condition type + 1 new condition-marker parse arm + 1 marker;
no new contract, no new resolve move / pending field / client UX).
**User-Visible Surface:** `play.legendary-arena.com` (Thor decks — Surge of Power's +3 attack is now
gated on the printed recruit condition; D-24026 live-verification applies).
**Baseline:** `origin/main` at draft = `e3cdddbc`.

---

## 1. Problem

The Thor Hero **Surge of Power** (`core/thor/surge-of-power`, also `msp1/surge-of-power`) prints:

> You get +2 Recruit. **If you made 8 or more [icon:recruit] this turn, you get +3[icon:attack].**

The +2 recruit is the printed stat. The **+3 attack is conditional** — it should apply **only** when
the player has generated 8+ recruit this turn. In the engine, the **+3 attack applies
unconditionally.**

**Live evidence (WP-542 live-verify, Red Skull / Cosmic Cube solo-1p match `uONsXu1WnDR`, gitSha
`e37e540`, 2026-08-14):** every Surge of Power play granted +3 attack regardless of recruit. The
unambiguous case is **turn 14** — Surge was the *first* card played (only its own +2 recruit on the
board), the whole turn generated **4 recruit total** (the end-of-turn economy snapshot shows
`recruit: 4`), yet `14.2.2` applied +3 attack. It fired on turns 3, 4, 5, 9, 13, 14 — every one below
the 8-recruit threshold. Net effect: Surge of Power is strictly stronger than printed (a guaranteed +3
attack), inflating every Thor deck.

## 2. Root cause

`packages/game-engine/src/setup/heroAbility.setup.ts` parses the inline `+3[icon:attack]` token via

```
const ICON_MAGNITUDE_PATTERN = /\+?(\d+)\s*\[icon:(attack|recruit)\]/g;   // line 337
```

into an **unconditional** attack-grant `HeroEffectDescriptor` on Surge's hook. The **"If you made 8 or
more recruit this turn"** prose is never parsed into a `HeroCondition`, so the hook carries the +3
attack effect with **no gating condition** — and the executor (`heroEffects.execute.ts:387`,
`if (!evaluateAllConditions(G, playerID, hook.conditions, cardId)) …`) applies it every time.

The condition cannot currently be expressed: the `HeroCondition` vocabulary in
`heroConditions.evaluate.ts` is `heroClassMatch` / `requiresTeam` / `requiresKeyword` /
`playedThisTurn` / `distinctHeroClassesAtLeast` — **no per-turn recruit-threshold type exists.**
Game-state conditionals of exactly this shape are the **deferred class** called out in the
`hero-ability-markers.json` curation notes ("game-state-conditional … neither is in the current
executor design").

## 3. Why this is small: the mechanism already exists (Spectrum)

D-24055 already added a **marker → condition** path for a game-state gate: `[keyword:Spectrum]` is
parsed in `heroAbility.setup.ts` (the `else if (normalizedKeyword === 'spectrum')` arm, ~713) into a
`conditions.push({ type: 'distinctHeroClassesAtLeast', value: … })`, so the line's printed effects gate
on ≥3 distinct classes via the same `evaluateAllConditions` path. Surge of Power is the **second**
instance of this exact pattern — a `[keyword:…]` marker that pushes a game-state condition — differing
only in *which* condition (a recruit threshold instead of a class count) and that the threshold is
parameterized (`8`) rather than a fixed constant.

`G.turnEconomy.recruit` is the gross **recruit-made-this-turn** accumulator (available =
`recruit − spentRecruit`, `economy.logic.ts:452`), so the condition reads a value that already exists —
no new counter, no new `G` field.

## 4. Contract (locked by D-24354)

### 4.1 New `HeroCondition` type

Add a `case 'recruitMadeThisTurnAtLeast'` to the `switch` in `heroConditions.evaluate.ts`:

```ts
case 'recruitMadeThisTurnAtLeast': {
  const threshold = parseInt(condition.value, 10);
  if (Number.isNaN(threshold)) return false;   // why: safe-skip malformed data (mirrors playedThisTurn)
  return G.turnEconomy.recruit >= threshold;    // why: recruit is the gross recruit-MADE accumulator, not net available
}
```

`HeroCondition` is **open-typed** (`{ type: string; value: string }`) — there is **no union or
canonical array** to extend, and **no drift test** to update. This is a pure switch-case addition.

### 4.2 New condition-marker parse arm

Mirror the D-24055 Spectrum arm in `heroAbility.setup.ts`: a new `else if` branch (placed **before**
the unresolved-marker fallback, exactly as Spectrum is) that recognizes the recruit-threshold marker
and pushes the condition:

```ts
conditions.push({ type: 'recruitMadeThisTurnAtLeast', value: String(threshold) });
```

**Marker token — RECOMMENDED, exact string is an operator/copilot-review FORK.** The recommended token
is a parameterized `[keyword:recruit-threshold:8]` (parsed for its `:N` threshold, mirroring how other
parameterized `[keyword:X:N]` markers carry a magnitude). Alternatives the executing session may choose
with copilot sign-off: a fixed non-parameterized token plus a threshold constant (closest to Spectrum's
`SPECTRUM_CLASS_THRESHOLD` shape), or a `[cond:…]` namespace. Whichever is chosen, it MUST be added to
`RECOGNIZED_NON_KEYWORD_MARKERS` (or handled before the unresolved-marker fallback) so it never records
a `parse-unrecognized` hollow, and it MUST attach the condition to the **same hook** that carries the
inline `+3[icon:attack]` effect.

### 4.3 Marker on the card

Mark Surge of Power's ability line in `scripts/convert-cards/inputs/hero-ability-markers.json` with the
chosen recruit-threshold marker. Surge of Power appears in **both** `core` and `msp1`
(marvelstudios) with the same ability text — the executing session confirms which set file(s) the
marker keys into and regenerates **every** affected `data/cards/*.json` plus all card-data-derived hero
feeds (`ledger:heroes`, effect-implementation index, card-mechanics). Byte-check the regenerated
`core.json` (and `msp1.json` if applicable) is a real diff (`git diff --numstat`), not CRLF churn.

### 4.4 Determinism / persistence

- Reads `G.turnEconomy.recruit`; **no `ctx.random`**, **no `Math.random`**, **no new `G` field**.
- No committed fixture plays Surge of Power (verify at execution via a grep of the fixture corpus), so
  `finalStateHash` / `PRE_WP080_HASH` are byte-identical — no re-pin.

## 5. Out of scope

- The general "game-state conditional" deferred class — this WP adds **one** condition type
  (`recruitMadeThisTurnAtLeast`) for Surge of Power only; other deferred game-state conditionals stay
  deferred.
- Any change to the inline `[icon:attack]`/`[icon:recruit]` magnitude parse itself — the +3 attack
  effect is correct; only its **gating** is missing.
- Any other Thor card or any change to the existing condition types.
- The `[hc:instinct]` class-synergy behavior observed in the same match (a separate fidelity question,
  not this WP).

## 6. Acceptance Criteria

1. `heroConditions.evaluate.ts` gains a `recruitMadeThisTurnAtLeast` case: `true` when
   `G.turnEconomy.recruit >= N`, `false` when `< N`, `false` on a NaN value.
2. `heroAbility.setup.ts` parses the recruit-threshold marker into a
   `{ type: 'recruitMadeThisTurnAtLeast', value: 'N' }` condition on the marked line's hook — and the
   marker never records a `parse-unrecognized` hollow.
3. Surge of Power's hook carries the recruit-threshold condition alongside its +3 attack effect.
4. At runtime, Surge's +3 attack applies **only** when the player made ≥8 recruit this turn; a
   sub-8-recruit turn grants **no** +3 attack (the +2 recruit is unaffected — it is the printed stat,
   not a gated effect).
5. Surge of Power is marked in the card data; `core.json` (+ `msp1.json` if applicable) and all
   card-data-derived hero feeds regenerate with a real diff.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` +
   `pnpm -r --no-bail test` exit 0; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## 7. Verification Steps

```bash
# 1. Condition type + parse arm + marker present
grep -nE "recruitMadeThisTurnAtLeast" packages/game-engine/src/hero/heroConditions.evaluate.ts packages/game-engine/src/setup/heroAbility.setup.ts
node -e "const s=JSON.stringify(require('./data/cards/core.json')); console.log('surge marker:', s.includes('surge-of-power') && /surge/i.test(s))"

# 2. No new RNG / no new G field
grep -c "ctx.random\|Math.random" packages/game-engine/src/hero/heroConditions.evaluate.ts   # expect 0

# 3. Card-data diff is real + feeds regenerated
git diff --numstat data/cards/core.json
git status --short | grep -E 'ledger|effect-implementation|card-mechanics'

# 4. Engine + full build/test
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8

# 5. Live (post-deploy; D-24026): in a Thor game, play Surge of Power on a turn with <8 recruit made
#    -> NO +3 attack; on a turn with >=8 recruit made -> +3 attack. Record in STATUS.
```

## 8. Definition of Done (Binary Gate — ALL must pass)

- [ ] New `recruitMadeThisTurnAtLeast` condition case (true ≥N / false <N / false NaN) + tests.
- [ ] New condition-marker parse arm (mirrors Spectrum); marker never flags `parse-unrecognized`; parse test.
- [ ] Surge of Power marked; `core.json` (+ `msp1.json` if applicable) + hero ledger + effect index +
      card-mechanics regenerated (real diff, freshness gates green).
- [ ] Runtime: Surge's +3 attack gated on ≥8 recruit-made-this-turn (test both branches; the +2 recruit
      is unaffected).
- [ ] No `ctx.random` / `Math.random`, no new `G` field; hash surfaces unchanged (no fixture plays Surge).
- [ ] Engine build + test green; `pnpm -r` green.
- [ ] `docs/ai/STATUS.md` Done entry names WP-545 + Surge of Power; D-24026 live-verify operator-pending
      (`User-Visible Surface = play.legendary-arena.com`).
- [ ] `docs/ai/DECISIONS.md` D-24354 landed (Status → Active).
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-545 node `📝` → `✅`,
      `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0.
- [ ] Commit prefix `EC-580:` for code + regenerated card data, `SPEC:` for governance close.
- [ ] D-24026 live-verification: the gated behavior confirmed in a deployed Thor match (operator-pending).

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-14)

Dependencies verified against the repo: `evaluateAllConditions` gates a hook's effects on
`hook.conditions` (`heroEffects.execute.ts:387`); `HeroCondition` is open-typed `{type,value}` so a new
type is a switch-case add with no union/drift; the `[keyword:Spectrum]` →
`distinctHeroClassesAtLeast` condition-marker precedent (D-24055) is on `main`
(`heroAbility.setup.ts` ~713); `G.turnEconomy.recruit` is the gross recruit-made accumulator
(`economy.logic.ts:452`). The change adds one condition case + one condition-marker parse arm + one card
marker — no new contract, no new pending/resolve/client surface, no determinism/hash surface. **Empirical
Scaffold** — this is NOT a validation-tightening change on an existing input path (it gates a gameplay
effect, tightening no parser/schema that pre-existing fixtures feed); N/A. **Mutation Boundary** — the
condition is read-only over `G.turnEconomy`; no new `G` write. **Marker-token FORK** flagged for copilot
(the exact `[keyword:…]` string) — a locked recommendation with two named alternatives, resolvable at
execution without scope change.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-14)

Layer boundary (game-engine hero-effect layer + card-data), determinism (read-only `G.turnEconomy`, no
`ctx.random`, no new `G` field → no re-pin), contract fidelity (Surge's +3 attack becomes gated exactly
as printed; the +2 recruit stat is untouched), and scope (one condition type + one marker arm, mirroring
the Spectrum precedent; no new resolve/pending/client surface) all clear. RISK folded: the exact
marker-token is a bounded FORK with a locked recommendation (`[keyword:recruit-threshold:8]`) + two named
alternatives — the executing session picks one with copilot sign-off and MUST register it so it never
records a `parse-unrecognized` hollow. Second RISK folded: Surge of Power appears in `core` **and**
`msp1` — the executor MUST regenerate every affected set file, not just `core.json` (verified in
`§4.3`).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2 Constraints** — PASS. **§3 Assumes**
  — PASS (deps cite WP-021 / WP-179 / D-24055, baseline `e3cdddbc`). **§4 Context** — PASS (Spectrum
  precedent, the ICON_MAGNITUDE parse, `turnEconomy.recruit` semantics; field names match `00.2`).
  **§5 Files** — PASS (closed engine + card-data + derived-feed + governance allowlist). **§6 Naming** —
  PASS (`recruitMadeThisTurnAtLeast` mirrors `distinctHeroClassesAtLeast`). **§7 Deps** — PASS (none
  new). **§8 Boundaries** — PASS (hero-effect layer + card-data; no cross-layer). **§9 Windows** — PASS.
  **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; condition-true/false/NaN
  + parse + runtime-gate branches). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD**
  — PASS (STATUS + DECISIONS D-24354 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17
  Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding**
  — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — makes a printed conditional gate faithful), §22
(determinism — read-only `G.turnEconomy`, no new RNG or persistent shape). **Conflict assertion:**
`No conflict: this WP preserves all touched clauses` — it corrects an over-powered effect to match the
printed card, without new randomness or persistence. **Non-Goal proximity:** none of NG-1..NG-8.
**Determinism preservation:** no new RNG, no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine/card-data gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 /
D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md`
unaffected.
