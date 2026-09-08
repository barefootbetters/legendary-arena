# EC-705 — Jade Giantess: reveal top Hero-Deck card per 2 Recruit, gain its printed Attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-668-jade-giantess-reveal-herodeck-attack.md
**Layer:** Game Engine (a synchronous count-scaled reveal-Hero-Deck-attack keyword) + card-data

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm `jade-giantess` in `data/cards/wwhk.json` still prints "For every 2[icon:recruit]you made this turn, Reveal the top card of the Hero Deck, put it on the bottom of that deck, and you get that card's printed[icon:attack]." with NO marker. If a marker is present now, STOP.
- [ ] Read the models end-to-end: `heroEffectInvestigate` (`hero/heroEffects.execute.ts:~2687`) for the top-of-deck read + `G.cardStats` + bottoming shape; `heroEffectAttackPerCount` (`~1611`) for the count-scaled `addResources` grant + log; the `attack-per-count` icon-subsumption block (`setup/heroAbility.setup.ts:~1237`). NOTE `heroEffectInvestigate` reads the PLAYER deck (`playerZones.deck`); Jade Giantess reads the SHARED `G.heroDeck` — do not confuse them.
- [ ] Read the lockstep catalogue (memory `reference_hero_keyword_lockstep_sites`): a handler-bearing keyword touches union + `HERO_KEYWORDS` + BOTH length pins + `HERO_EFFECT_HANDLERS` + handler-count pin + `HANDLED_KEYWORDS`. This keyword is **NOT** in `NO_MAGNITUDE_KEYWORDS` (magnitude 2 is a real divisor). **Read the CURRENT pin values at execution** — they drift (last seen 42 keywords / 28 handlers).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record baselines).

## Locked Values (do not re-derive)
- Keyword: **`reveal-herodeck-attack`**, magnitude = the "for every N Recruit" divisor (**2** for Jade Giantess). Full handler-bearing lockstep (read CURRENT pins; bump each by 1: keyword count 42→43, handler count 28→29). **NOT** in `NO_MAGNITUDE_KEYWORDS`.
- Handler: **`heroEffectRevealHeroDeckAttack`** — `divisor = effect.magnitude as number`; guard `!G.turnEconomy` and `divisor <= 0` (silent return); `iterations = Math.floor(G.turnEconomy.recruit / divisor)`; `iterations === 0` → neutral log ("made fewer than N Recruit … no Hero-Deck cards revealed") + return; empty `G.heroDeck` → blocked log + return. Loop `iterations` times: `top = G.heroDeck[0]`; break if undefined; `attack = G.cardStats[top]?.attack ?? 0`; accumulate; `G.heroDeck = [...G.heroDeck.slice(1), top]` (rotate to bottom). `G.turnEconomy = addResources(G.turnEconomy, total, 0)`; applied log naming the count + total. NEVER throw.
- Snapshot-at-play timing — read `G.turnEconomy.recruit` ONCE in the handler. Do **NOT** register a wait-and-see / deferred re-check (a scaling factor cannot re-fire cleanly). No `recruitMadeThisTurnAtLeast` condition on this hook.
- Parser: the generic `KEYWORD_PATTERN` arm already emits `{ type: 'reveal-herodeck-attack', magnitude: 2 }` once `isValidHeroKeyword` is true (add the keyword to the union/array). ADD a sibling icon-subsumption block after the `attack-per-count` one (`~L1237`): when `uniqueKeywords` contains `reveal-herodeck-attack`, drop the plain `attack` keyword + `magnitudes.delete('attack')` (the printed "you get that card's printed[icon:attack]" is subsumed).
- Marker on `jade-giantess`: **`[keyword:reveal-herodeck-attack:2]`**. `VALID_TOKEN_PATTERN += ^\[keyword:reveal-herodeck-attack:[1-9]\d*\]$`.

## Guardrails
- **No pending choice / new zone / new G field.** The effect is forced pure-upside → synchronous. `G.heroDeck` already exists; the only mutations are the reorder + the `G.turnEconomy.attack` grant. Adding a pending queue would be a FAIL.
- **Snapshot, not wait-and-see.** Read `G.turnEconomy.recruit` at handler time. Do NOT defer/re-fire.
- **`G.heroDeck` reorder by rebind** (`G.heroDeck = [...slice(1), top]`), never `.shift()`/`.push()` that re-encodes zone ordering. Front = top; bottom = end. Bottoming keeps length constant so N reveals proceed on a non-empty deck.
- **Read printed attack from `G.cardStats[id].attack`** (`?? 0`) — never a registry access, never a re-derivation. A card with no stat entry contributes 0.
- **Icon subsumption is required** — without it the printed `[icon:attack]` emits a phantom flat `attack` keyword (no-op, but wrong classification). Assert the parser emits only the `reveal-herodeck-attack` effect (AC-4).
- Determinism: no RNG (a top-of-deck read is deterministic); moves never throw; safe-skip malformed state.
- Card data regenerated, not hand-edited (WP-633): `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0. Do NOT run `ledger:villains`. Confirm each diff is real (not LF/CRLF churn); revert any `lagn-v1.json` line-ending-only churn.
- Hash oracles: NO re-pin (the sentinel plays no wwhk cards). Confirm `PRE_WP080_HASH` + `finalStateHash` unchanged.

## Required `// why:` Comments
- The handler divisor read: `effect.magnitude` is the "for every N Recruit" divisor.
- The snapshot: `G.turnEconomy.recruit` read once at play — faithful tabletop timing, NOT wait-and-see.
- The bottoming reorder: rotate the revealed top card to the bottom (rebind, front=top).
- The `G.cardStats[id].attack` read: the setup-injected printed attack; a missing entry contributes 0.
- The parser icon-subsumption: the printed `[icon:attack]` is the effect's own grant, not a flat attack (mirrors D-24016).

## Files to Produce
- `rules/heroKeywords.ts` (+ BOTH length-pin tests) — the keyword.
- `hero/heroEffects.execute.ts` (+ handler-count + `HANDLED_KEYWORDS` keyset tests) — the handler + registrations.
- `setup/heroAbility.setup.ts` (+ setup tests) — the icon-subsumption sibling block.
- `packages/game-engine/src/**/*.test.ts` — AC-1..AC-7 coverage + the drift pins.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json` + `data/cards/wwhk.json` (regenerated) + hero derived artifacts (ledger / effect-index / mechanics metadata).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24481), `NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record count); `pnpm -r build` 0.
- [ ] Card-data regen reproduces committed `data/cards/*.json`; `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0.
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
- [ ] **Control run:** remove the `reveal-herodeck-attack` marker from Jade Giantess; AC-1 fails (no Attack granted). Restore. Record the failure.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged (no re-pin).
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` match plays Jade Giantess after making Recruit and gains the scaled Attack; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24481 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- Jade Giantess grants no Attack → the marker didn't apply, or the handler read `G.turnEconomy.recruit` after a divisor typo, or `iterations` floored to 0 unexpectedly.
- A phantom flat `+attack` appears alongside the reveal grant → the icon-subsumption sibling block is missing.
- `G.heroDeck` shrinks or the game desyncs → bottoming used `.shift()` without rebinding, or the rotate dropped a card.
- The card reads hollow in the ledger after the change → the keyword is missing from `HANDLED_KEYWORDS`/`HERO_EFFECT_HANDLERS`, so the hook classified `no-handler`.
- A `:check` green locally but CI red → a second-order derived artifact (effect-index off the ledger) not regenerated, or `lagn-v1.json` CRLF churn committed.
- Hash pin moved → an unintended shared-state change; the sentinel plays no wwhk cards, so investigate before re-pinning.
