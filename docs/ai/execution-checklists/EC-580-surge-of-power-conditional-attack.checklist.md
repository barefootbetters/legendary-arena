# EC-580 — Surge of Power Recruit-Threshold Conditional Attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-545-surge-of-power-conditional-attack.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Surge unmarked (grants +3 attack unconditionally today): `node -e "const c=require('./data/cards/core.json'); const t=c.heroes.find(h=>h.slug==='thor'); const card=t.cards.find(x=>x.slug==='surge-of-power'); const line=card.abilities[0]; process.exit(/\[keyword:|\[cond:/.test(line)?1:0)"` → exit 0 (no condition marker yet)
- [ ] Executor gates effects on conditions: `grep -q "evaluateAllConditions(G, playerID, hook.conditions" packages/game-engine/src/hero/heroEffects.execute.ts` → OK (line ~387)
- [ ] Spectrum condition-marker precedent present: `grep -q "distinctHeroClassesAtLeast" packages/game-engine/src/setup/heroAbility.setup.ts` → OK
- [ ] `HeroCondition` is open-typed: `grep -A2 "interface HeroCondition" packages/game-engine/src/rules/heroAbility.types.ts` shows `type: string; value: string`
- [ ] `turnEconomy.recruit` is the gross recruit-made accumulator: `grep -q "economy.recruit - economy.spentRecruit" packages/game-engine/src/economy/economy.logic.ts` → OK (available = recruit − spentRecruit)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- **New `HeroCondition` type** `recruitMadeThisTurnAtLeast` — a `case` added to the `switch` in `heroConditions.evaluate.ts`: `const threshold = parseInt(condition.value, 10); if (Number.isNaN(threshold)) return false; return G.turnEconomy.recruit >= threshold;`. `HeroCondition` is open-typed `{type,value}` — **NO union / canonical-array / drift-test change** (unlike a keyword add).
- **`G.turnEconomy.recruit`** is the **gross recruit-MADE-this-turn** value (available = `recruit − spentRecruit`). Compare against it directly — do NOT subtract `spentRecruit` (the card gates on recruit *made*, not recruit *remaining*).
- **New condition-marker parse arm** in `heroAbility.setup.ts` — mirror the D-24055 `[keyword:Spectrum]` → `distinctHeroClassesAtLeast` arm (the `else if (normalizedKeyword === 'spectrum')` block, ~713): a new `else if` **before** the unresolved-marker fallback that recognizes the recruit-threshold marker and does `conditions.push({ type: 'recruitMadeThisTurnAtLeast', value: String(threshold) })`.
- **Marker token — RECOMMENDED `[keyword:recruit-threshold:8]`** (parse the `:N` threshold), with two operator/copilot-review alternatives (fixed token + constant à la `SPECTRUM_CLASS_THRESHOLD`, or a `[cond:…]` namespace). Whichever is picked: (a) it MUST be registered so it never records `parse-unrecognized` (add to `RECOGNIZED_NON_KEYWORD_MARKERS` or handle before the fallback, exactly like Spectrum), and (b) it MUST attach the condition to the SAME hook that carries the inline `+3[icon:attack]` effect.
- **Card marker:** mark Surge of Power's ability line in `scripts/convert-cards/inputs/hero-ability-markers.json`. Surge is in **`core` AND `msp1`** — mark wherever the ability text appears; regen `core.json` **and** `msp1.json` (if it keys there) via the hero-marker apply pass + ALL hero-derived feeds (`ledger:heroes`, effect-index, card-mechanics).
- **DECISIONS reservation:** **D-24354**.

## Guardrails
- Do NOT touch the `ICON_MAGNITUDE_PATTERN` parse or the +3 attack effect itself — the effect is correct; only its GATING condition is missing. Add the condition; leave the effect.
- Do NOT gate the +2 recruit — that is Surge's printed recruit STAT, not a conditional effect. Only the +3 attack line gets the condition.
- Do NOT add a new union/canonical-array/drift test — `HeroCondition` is open-typed; this is a switch-case add. (Contrast the villain-primitive WPs, which DO move a union+array+drift together.)
- Determinism: read `G.turnEconomy.recruit` only; NO `ctx.random`, NO `Math.random`, NO new `G` field.
- Compare against `recruit` (gross made), NOT `getAvailableRecruit()` (net) — spending recruit must not lower the gate.
- Regenerate EVERY hero card-data-derived feed after the marker edit (partial = red `main`); byte-check the regenerated set file(s) are a REAL diff (`git diff --numstat`).
- Register the new marker so it never records a `parse-unrecognized` hollow (Spectrum precedent).

## Required `// why:` Comments
- On the `recruitMadeThisTurnAtLeast` case: it reads `G.turnEconomy.recruit` (the gross recruit-MADE accumulator, not net available) so spending recruit does not lower the gate; NaN safe-skips (mirrors `playedThisTurn`).
- On the new condition-marker parse arm: it mirrors the D-24055 Spectrum marker→condition pattern — a `[keyword:…]` marker that pushes a game-state CONDITION (not a keyword/effect), placed before the unresolved-marker fallback so it never flags.
- On the Surge marker (card data / marker map): "If you made 8 or more recruit this turn" is a game-state gate not expressible via the `[hc:X]:`/`[team:X]:` line-prefix conditions, so it is marked explicitly.

## Files to Produce
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — new `recruitMadeThisTurnAtLeast` case
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — true ≥N / false <N / false NaN
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — new condition-marker parse arm (+ marker registration)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — parse-arm test (marker → condition on the hook)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — Surge of Power marker
- `data/cards/core.json` (+ `data/cards/msp1.json` if the marker keys there) — **modified** — regenerated
- hero mechanic ledger + effect-implementation index + card-mechanics — **modified** — regenerated feeds
- (If a hero-effect runtime gate test fits) `packages/game-engine/src/hero/heroEffects.execute.test.ts` or a conditional test — **modified** — Surge's +3 attack gated on recruit
- `docs/ai/DECISIONS.md` (D-24354 → Active) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-545 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "recruitMadeThisTurnAtLeast" heroConditions.evaluate.ts heroAbility.setup.ts` → present in both
- [ ] No new drift surface: `git diff` shows NO edit to a `VILLAIN_EFFECT_PRIMITIVES`/`HERO_*`-style union+array (HeroCondition is open-typed)
- [ ] Surge marker applied: the regenerated set file's Surge line carries the condition marker; `git diff --numstat` real diff; feeds regenerated
- [ ] `grep -c "ctx.random\|Math.random" heroConditions.evaluate.ts` → 0
- [ ] Runtime gate proven: a test shows +3 attack applied at `turnEconomy.recruit >= 8` and NOT at `< 8` (the +2 recruit unaffected)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (no committed fixture plays Surge of Power)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24354 landed (Active)
- [ ] Commit prefix `EC-580:` (code + regenerated card data) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Surge still grants +3 attack on a low-recruit turn → the condition was added to `heroConditions.evaluate.ts` but the MARKER never attaches it to Surge's hook (check the parse arm + the marker-map entry + the regenerated card line).
- The marker records a `parse-unrecognized` hollow / shows in `/debug/effects` as unmarked → the new marker was not registered before the unresolved-marker fallback (mirror the Spectrum placement / `RECOGNIZED_NON_KEYWORD_MARKERS`).
- Surge stops granting +3 even at 8+ recruit → gating against `getAvailableRecruit()` (net) instead of `turnEconomy.recruit` (gross made); spending recruit must not lower the gate.
- The +2 recruit disappears → you gated the recruit stat too; only the +3 attack line takes the condition.
- Drift test red → you added a union+array entry that HeroCondition does not have; it is open-typed `{type,value}`, a switch-case add only.
- `core.json` dirty but `git diff --numstat` 0/0 → CRLF noise; the marker didn't apply (check the set/hero/card slug in the marker map).
- Surge fixed in `core` but not `msp1` → the msp1 copy of Surge of Power was not marked/regenerated.
