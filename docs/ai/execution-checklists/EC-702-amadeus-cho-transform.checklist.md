# EC-702 — Amadeus Cho's Transform fires (drew-two-cards condition + gamma gating) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-665-amadeus-cho-transform.md
**Layer:** Game Engine (wait-and-see condition + per-turn draw counter) + card-data

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm gamma-draining-nanites' ability is STILL two lines in `data/cards/wwhk.json`: `abilities[0]` = `"Draw a card. [keyword:draw:1]"`, `abilities[1]` = `"Then, if you drew two cards this turn, [keyword:Transform] this into Like Totally Smart Hulk."` (if it is one line now, STOP — the two-hook assumption is void). Confirm `SUPPORTED_TRANSFORM_BASES` is still She-Hulk-only.
- [ ] Read the models: `recruitMadeThisTurnAtLeast` (evaluator `heroConditions.evaluate.ts:158` + describe `~:517`; marker arm `heroAbility.setup.ts:938`); `WAIT_AND_SEE_CONDITION_TYPES` (`deferredConditionalGrants.ts:62`) + its drift pin; the FIVE `TurnEconomy` rebuild sites that copy `woundsDrawn` (`economy.logic.ts`); `heroEffectDraw` (`heroEffects.execute.ts:~927`).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test`, and the arena-client test, exit 0 (record baselines).

## Locked Values (do not re-derive)
- Counter: **`TurnEconomy.cardsDrawn: number`** — always present (mirror `woundsDrawn`); reset 0 by `resetTurnEconomy`; copied by `addResources` / `spendAttack` / `spendRecruit` / `enableRecruitSpendableAsAttack` / `spendFightCost` (the 5 sites that copy `woundsDrawn` — add `cardsDrawn: economy.cardsDrawn` beside each).
- Increment site: **`heroEffectDraw`** only — `G.turnEconomy.cardsDrawn += drawnCount` after the realized draw. The current-player `draw:N` path. NOT `drawCardsIntoHand` (the start-of-turn refill — must NOT count) and NOT the each-player `drawFromPlayerDeck` call at `heroEffects.execute.ts:~2757` (out of scope).
- Condition: **`cardsDrawnThisTurnAtLeast`** — evaluator reads `G.turnEconomy.cardsDrawn >= parseInt(value)` (NaN-guard → false, mirror recruit); a describe case for the waiting log ("needs N or more cards drawn this turn — you have drawn M"); added to `WAIT_AND_SEE_CONDITION_TYPES` + the runtime drift pin. `HeroCondition.type` is open string — NO union change.
- Marker: **`[keyword:draw-threshold:2]`** on `gamma-draining-nanites` **abilityIndex 1** (the transform line) — NEVER abilityIndex 0 (the draw). Setup arm mirrors `recruit-threshold` (pushes `{ type: 'cardsDrawnThisTurnAtLeast', value: keywordMatch[2] }`).
- Token grammar: `VALID_TOKEN_PATTERN += ^\[keyword:draw-threshold:[1-9]\d*\]$` (reject the zero form).
- Allowlist: add **`wwhk/amadeus-cho/gamma-draining-nanites`** to `SUPPORTED_TRANSFORM_BASES`.
- Ledger: `cardsDrawnThisTurnAtLeast` → `KNOWN_CONDITIONS`; gamma flips `unsupported → executable` (transform is a `BY_HOOK_KEYWORDS` keyword — She-Hulk precedent) + a condition row.

## Guardrails
- **The draw stays unconditional.** The `draw-threshold` marker gates ONLY abilities[1] (transform). If gamma stops drawing its card, the marker is on the wrong line — a bug.
- **The start-of-turn refill must not count.** It uses `drawCardsIntoHand`, not `heroEffectDraw`, so incrementing only in `heroEffectDraw` excludes it. Assert `cardsDrawn == 0` after a fresh turn's fill (AC-4) — a non-vacuous guard against counting the refill (which would make the threshold trivially true every turn).
- **Wait-and-see lockstep.** A type in `WAIT_AND_SEE_CONDITION_TYPES` with no evaluator case silently never fires (`default → false`). Add BOTH; the drift pin enforces it.
- **Hooks execute in array order** (`for (const hook of hooks)`), so abilities[0]'s draw increments the counter BEFORE abilities[1]'s condition is evaluated — the same-play ≥2 case fires immediately; the deferred case re-fires transform-only (no re-draw).
- Determinism: `ctx.random.*` only; moves never throw; counter/condition/deferred-recheck deterministic.
- Card data regenerated, not hand-edited (WP-633): `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0. Do NOT run `ledger:villains`. Confirm each diff is real (not LF/CRLF churn).
- Both hash oracles re-pin deliberately (new `TurnEconomy` field): update `PRE_WP080_HASH` + the sentinel `finalStateHash` to the observed values, with a recorded no-behaviour-change note. If a THIRD oracle moves, investigate before re-pinning.

## Required `// why:` Comments
- `cardsDrawn` field + reset: per-turn effect-draw count (sibling of `woundsDrawn`); the "drew N cards this turn" gate reads it.
- The `heroEffectDraw` increment: counts current-player effect draws (the `draw:N` path); the start-of-turn refill (`drawCardsIntoHand`) is deliberately excluded so the threshold is never trivially met.
- The evaluator case: reads the gross per-turn effect-draw count (mirror recruit-threshold).
- The `draw-threshold` arm: gates abilities[1]'s transform on "drew N cards this turn"; abilities[0]'s draw is untouched.
- The two hash re-pins: new `TurnEconomy` field shifts `computeStateHash`; no behaviour change (WP-657/658 precedent).

## Files to Produce
- `economy/economy.types.ts`, `economy/economy.logic.ts` — the counter + 5 rebuild sites + reset.
- `hero/heroEffects.execute.ts` — the `heroEffectDraw` increment.
- `hero/heroConditions.evaluate.ts` — evaluator + describe cases.
- `hero/deferredConditionalGrants.ts` (+ `.test.ts`) — the wait-and-see enrollment + drift pin.
- `setup/heroAbility.setup.ts` — the `draw-threshold` arm + gamma in `SUPPORTED_TRANSFORM_BASES`.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json` (gamma abilities[1]) + `data/cards/wwhk.json` (regenerated) + hero derived artifacts.
- `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS`) + regenerated ledger data.
- `packages/game-engine/src/**/*.test.ts` — AC-1..AC-8 coverage + the drift pin + the hash re-pins.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24476), `NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record count); `pnpm -r build` 0.
- [ ] Card-data regen reproduces committed `data/cards/*.json`; `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0.
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
- [ ] **Control run:** remove gamma from `SUPPORTED_TRANSFORM_BASES`; AC-2 fails (transform reverts to a parse-unrecognized hollow). Restore. Record the failure.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` — both re-pinned deliberately, nothing else moved.
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** an Amadeus Cho match on `play.legendary-arena.com` plays Gamma-Draining Nanites after ≥2 draws and it transforms; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24476 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- Gamma transforms on EVERY play → the start-of-turn refill is being counted (increment leaked into `drawCardsIntoHand`), or the marker landed on abilities[0].
- Gamma's draw stopped happening → the `draw-threshold` marker / condition landed on abilities[0] (gating the draw hook).
- Gamma never transforms even after 2 draws → `cardsDrawnThisTurnAtLeast` not in `WAIT_AND_SEE_CONDITION_TYPES`, or no evaluator case (silent `default → false`), or `heroEffectDraw` not incrementing.
- The deferred re-fire re-draws a card → the transform hook wrongly carries the draw effect (it must be abilities[1], transform-only).
- A `:check` green locally but CI red → a second-order derived artifact (effect-index off the ledger) not regenerated.
- A third hash oracle moved → an unintended `G` mutation; investigate before re-pinning.
