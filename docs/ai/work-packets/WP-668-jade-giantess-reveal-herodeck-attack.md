# WP-668 — Jade Giantess: "For every 2 Recruit, reveal the top Hero-Deck card and gain its printed Attack" (Game Engine + card-data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (a new synchronous, count-scaled reveal-Hero-Deck-attack keyword) + card-data
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`wwhk/she-hulk/jade-giantess` prints *"For every 2 Recruit you made this turn,
Reveal the top card of the Hero Deck, put it on the bottom of that deck, and you
get that card's printed Attack."* Today the ability is an **unmodeled hollow that
does nothing**: WP-660 correctly suppresses the *"for every 2[icon:recruit]"*
condition icon, but the trailing bare *"printed[icon:attack]"* is promoted to a
**magnitude-less `attack` keyword** that the `executeSingleEffect` magnitude
pre-gate silently drops — so the card grants **no Attack** at all, while the
phantom keyword even masks it from the hollow detector. This WP models the real
ability: for every 2 Recruit made this turn, reveal the top card of the shared
**Hero Deck** (`G.heroDeck`), grant its **printed Attack**, and rotate it to the
**bottom** of that deck.

## User-Visible Impact

A player who plays Jade Giantess after making Recruit this turn now gains Attack
scaled to their Recruit: e.g. with 6 Recruit made, three Hero-Deck cards are
revealed (top → bottom, three times) and the player gains the sum of their
printed Attack. The game log names the reveals and the total. Below 2 Recruit the
ability reveals nothing and says so (a neutral log line).

## Assumes

- **Baseline:** `origin/main` @ `ffa69a4a` (2026-09-07). Re-baseline at execution.
- **`G.heroDeck` is the shared Hero Deck** (`CardExtId[]`, front = top; the HQ
  refills from its front via `refillHqSlot`). Rotating a card to the bottom is an
  ordinary array reorder; the zone already exists and is already hashed. ✅ on `main`.
- **`G.cardStats[cardId].attack` is the printed hero Attack**, injected at setup
  from the registry so moves need no registry access (the same field
  `investigate` reads via `stats?.attack`, and the villain sibling reads via
  `fightCost`). ✅ on `main`.
- **`G.turnEconomy.recruit` is the GROSS Recruit made this turn** (the
  `recruitMadeThisTurnAtLeast` accumulator; spending does not lower it). The
  "for every 2 Recruit" scale reads it directly. ✅ on `main`.
- **WP-660 suppresses the condition recruit icon** (`CONDITION_ICON_PATTERN`
  covers "for every N[icon:recruit]"), so no phantom +2 Recruit is emitted; the
  Jade Giantess reference test already asserts this. ✅ on `main`.

## Context (Read First)

- `data/cards/wwhk.json` (`jade-giantess`) — the printed ability (no marker today).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **AUTHORITATIVE for**
  the effect executor. Model after `heroEffectInvestigate` (top-of-deck read +
  `G.cardStats` + bottoming) and `heroEffectAttackPerCount` (the count-scaled
  grant + `addResources`). Touch `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, the
  handler-count pin. **NOT** `NO_MAGNITUDE_KEYWORDS` — magnitude 2 is a real divisor.
- `packages/game-engine/src/rules/heroKeywords.ts` (+ both length-pin tests) — the
  keyword lockstep per the `reference_hero_keyword_lockstep_sites` catalogue.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the generic
  `KEYWORD_PATTERN` arm emits `{ type, magnitude }` for a valid keyword with `:N`;
  add a **sibling icon-suppression block** (mirroring the `attack-per-count`
  subsumption @ ~L1237) so the co-located printed `[icon:attack]` does not emit a
  phantom flat `attack` keyword.
- `packages/game-engine/src/economy/economy.logic.ts` (`addResources`) — the
  attack-grant helper (`addResources(turnEconomy, attackDelta, recruitDelta)`).
- `packages/game-engine/src/board/city.logic.ts` (`refillHqSlot`) — confirms
  `G.heroDeck` front = top; NEVER mutate via `.shift()`, rebind the array.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` — the marker grammar + authoring.
- `docs/ai/DECISIONS.md` — the reserved **D-24481**; scan **D-24016**
  (attack-per-count / the icon-subsumption precedent), **D-24373** (investigate:
  top-of-deck reveal + `G.cardStats`), **D-24471** (WP-660 condition-icon suppression).

## Design Rationale

**A dedicated synchronous keyword — no pending choice, no new zone, no new G
field.** Jade Giantess resolves entirely from state the engine already holds:
`G.turnEconomy.recruit` (the scale), `G.heroDeck` (the reveal source), and
`G.cardStats[id].attack` (the printed Attack). There is no player decision — the
reveals are forced and pure-upside — so the effect fires **synchronously** at play
time (the `investigate` / `reveal-from-hand` pattern), not through the
pending-choice machinery. The only G mutations are the ordinary
`G.turnEconomy.attack` grant and the `G.heroDeck` reorder.

**Snapshot at play time — faithful tabletop timing, not wait-and-see.** In
Marvel Legendary an ability resolves when its card is played, using state at that
moment; "for every 2 Recruit you made this turn" counts Recruit generated by
cards resolved **before** Jade Giantess this turn. So `iterations =
floor(G.turnEconomy.recruit / 2)` is evaluated once, when the handler runs. This
is deliberately **not** the WP-568 recruit-threshold wait-and-see (a boolean gate
that re-fires later): a *scaling factor* cannot cleanly re-fire — re-running the
reveal loop each move would multi-count. A play below 2 Recruit reveals nothing
and logs a neutral line, so the player sees why.

**The divisor rides the marker's magnitude.** `[keyword:reveal-herodeck-attack:2]`
parses through the generic `KEYWORD_PATTERN` arm to `{ type:
'reveal-herodeck-attack', magnitude: 2 }`; the handler reads `magnitude` as the
"for every N Recruit" divisor. Magnitude 2 is a valid magnitude, so the effect
flows through the standard pre-gate — **no** `NO_MAGNITUDE_KEYWORDS` entry.

**Bottoming keeps the shared deck whole.** Each reveal rotates the top card to the
bottom, so `G.heroDeck` never shrinks; N reveals proceed as long as the deck is
non-empty (a short deck simply re-reveals cycled cards — faithful to the printed
instruction repeated N times). An empty Hero Deck (rare, near game end) reveals
nothing and logs a blocked line.

## Scope (In)

- **New `reveal-herodeck-attack` HeroKeyword** across the handler-bearing lockstep:
  union + `HERO_KEYWORDS` + both length pins (42→43) + `HERO_EFFECT_HANDLERS` +
  handler-count pin (28→29) + `HANDLED_KEYWORDS`. **NOT** `NO_MAGNITUDE_KEYWORDS`.
- **Handler `heroEffectRevealHeroDeckAttack`** — `divisor = effect.magnitude`;
  `iterations = Math.floor(G.turnEconomy.recruit / divisor)`; loop revealing
  `G.heroDeck[0]`, summing `G.cardStats[id]?.attack ?? 0`, rotating each to the
  bottom; `addResources(G.turnEconomy, total, 0)`; log the total. Neutral log at
  `iterations === 0`; blocked log at empty `G.heroDeck`. Never throws; safe-skips
  malformed state (`!G.turnEconomy`, `divisor <= 0`).
- **Parser icon-subsumption** — a sibling block (mirroring `attack-per-count`)
  drops the plain `attack` keyword + its magnitude when the line carries
  `reveal-herodeck-attack`, so the printed "you get that card's printed
  [icon:attack]" does not emit a phantom flat attack.
- **Card data** — `jade-giantess` gets `[keyword:reveal-herodeck-attack:2]` via
  `hero-ability-markers.json` (regenerated); `VALID_TOKEN_PATTERN +=
  reveal-herodeck-attack:[1-9]\d*`.
- **Regenerated hero card-data-derived artifacts** + their `:check` gates; the
  ledger flips `jade-giantess` to executable (`reveal-herodeck-attack`).
- **Tests** — the handler grants the summed printed Attack for N = floor(recruit/2)
  and rotates the deck; 0 Recruit → no reveal, no grant; a short/empty Hero Deck is
  handled; the parser emits the effect and suppresses the phantom attack keyword;
  the keyword lockstep pins.

## Out of Scope

- **A pending-choice / UI prompt** — the effect is forced and pure-upside, so it
  resolves synchronously (no `pending*` entry, no client prompt, no projection or
  audience-filter change beyond the already-projected `heroDeck` count and
  `turnEconomy`).
- **Other "for every N …" cards** (Sentry's Vast Unstable Power reveal-5, etc.) —
  distinct shapes / different reveal counts / conditional targets; each is its own
  follow-up on this or the count-scaled family.
- **Any change to `attack-per-count` or the count-source machinery** — Jade
  Giantess reads `G.turnEconomy.recruit` directly (the divisor is card-intrinsic),
  so it needs no `HeroCountSource` entry.
- **Variable-attack fidelity of revealed "X+" cards** — the handler reads the
  setup-resolved `G.cardStats[id].attack` (the faithful engine value); no runtime
  re-derivation of dynamic attack.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ both length-pin tests) — the keyword.
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ handler-count/keyset tests) —
  the handler + `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS`.
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ setup tests) — the icon-subsumption block.
- `packages/game-engine/src/**/*.test.ts` — the coverage above.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` + `data/cards/wwhk.json`
  (regenerated) + the hero derived artifacts (ledger / effect-index / mechanics metadata).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24481), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

The exact allowlist is finalised at execution; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: no `Math.random()`; the handler is pure over `G` (no RNG — the reveal
>   is a deterministic top-of-deck read); moves never throw; safe-skip malformed state.
> - `G.heroDeck` is reordered by **rebinding** the array (`G.heroDeck = [...rest, top]`),
>   never `.shift()`/`.push()` on the draft in a way that re-encodes zone ordering elsewhere.
> - New keyword ↔ the full handler-bearing lockstep (per `reference_hero_keyword_lockstep_sites`);
>   it is **NOT** in `NO_MAGNITUDE_KEYWORDS` (magnitude 2 is a real divisor). Runtime drift
>   pins (engine tests are not typechecked — D-24372), so the count/keyset pins are runtime asserts.
> - The card-data marker is regenerated by the pipeline, never hand-edited (WP-633).
> - Session protocol: on any ambiguity not resolved by the WP + EC, STOP and surface it.

## Contract

- **Keyword** — `reveal-herodeck-attack`, magnitude = the "for every N Recruit"
  divisor (2 for Jade Giantess). NOT in `NO_MAGNITUDE_KEYWORDS`.
- **Effect** — synchronous onPlay: `floor(G.turnEconomy.recruit / divisor)`
  reveals of `G.heroDeck[0]`, each granting `G.cardStats[id].attack` to
  `G.turnEconomy.attack` and rotating that card to the bottom of `G.heroDeck`.
- **Marker** — `[keyword:reveal-herodeck-attack:2]` on `jade-giantess`.

## Vision Alignment

- **Vision clauses touched:** §1 (faithful card behavior), §2 (client renders a
  read-only projection, engine decides), §22 (determinism).
- **Conflict assertion:** No conflict — a printed hero ability made faithful; the
  reveal is deterministic (no RNG — a top-of-deck read + reorder), replay-faithful,
  buys no game outcome (NG-1 untouched).
- **Non-Goal proximity check:** N/A.
- **Determinism preservation:** the handler is pure over `G`; the `G.heroDeck`
  reorder + `G.turnEconomy.attack` grant are ordinary hashed mutations. No hash
  re-pin — the `sentinel-core-doom-2p` game plays no wwhk cards, so neither
  `PRE_WP080_HASH` nor the sentinel `finalStateHash` moves (confirm at execution).

## Funding Surface Gate

§20 N/A — engine gameplay + card data.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint; a synchronous hero effect.

## Acceptance Criteria

- **AC-1** Playing Jade Giantess with `G.turnEconomy.recruit === 6` (divisor 2)
  reveals 3 Hero-Deck cards top→bottom and grants `G.turnEconomy.attack +=` the sum
  of their printed Attack (`G.cardStats[id].attack`); `G.heroDeck` length is
  unchanged and the top 3 have rotated to the bottom in order.
- **AC-2** With `recruit < 2`, no card is revealed, no Attack is granted, and a
  neutral log line explains it; `G.heroDeck` is unchanged.
- **AC-3** With a Hero Deck shorter than `iterations`, reveals cycle the bottomed
  cards (a short deck re-reveals) and never throw; an empty `G.heroDeck` reveals
  nothing and logs a blocked line.
- **AC-4** The parser emits `{ type: 'reveal-herodeck-attack', magnitude: 2 }` for
  the marked Jade Giantess line and does **not** emit a phantom flat `attack`
  keyword/effect (the printed `[icon:attack]` is subsumed); no phantom recruit
  (WP-660 unchanged).
- **AC-5** `reveal-herodeck-attack` is wired across the handler-bearing lockstep
  (union, array, both length pins 42→43, handler, handler-count pin 28→29,
  HANDLED_KEYWORDS) and is **not** in `NO_MAGNITUDE_KEYWORDS`; the runtime drift
  pins pass.
- **AC-6** `data/cards/wwhk.json` `jade-giantess` encodes the marker; a clean regen
  reproduces the committed bytes; every `:check` is green; the hero ledger flips
  `jade-giantess` to executable (`reveal-herodeck-attack`).
- **AC-7** Determinism: no hash re-pin (the sentinel plays no wwhk cards); the
  handler uses no RNG.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. The card-data regen chain reproduces committed `data/cards/*.json` + every `:check`.
4. `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
5. **Control run:** remove the `reveal-herodeck-attack` marker from Jade Giantess;
   confirm AC-1 fails (no Attack granted) — non-vacuous.
6. `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged.
7. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-7 satisfied.
- [ ] All Verification Steps green, incl. the Step-5 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24481 Active**, recording the new
      `reveal-herodeck-attack` keyword, the snapshot-at-play timing, the
      Hero-Deck reveal + printed-attack grant + bottoming, the icon-subsumption,
      and the no-hash-re-pin.
- [ ] `docs/ai/STATUS.md` close-out.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real match
      plays Jade Giantess after making Recruit and gains the scaled Attack;
      recorded or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24481 — Jade Giantess's "For every 2 Recruit, reveal the top Hero-Deck card,
bottom it, and gain its printed Attack" is a new `reveal-herodeck-attack` keyword
whose magnitude carries the "for every N Recruit" divisor.** The handler is a
deterministic synchronous onPlay effect: `iterations = floor(G.turnEconomy.recruit
/ divisor)` snapshotted at play time (faithful tabletop resolution, NOT the
WP-568 wait-and-see gate), then per iteration reveals `G.heroDeck[0]`, grants
`G.cardStats[id].attack` to `G.turnEconomy.attack`, and rotates that card to the
bottom of `G.heroDeck`. No pending choice, no new G field. The parser subsumes the
co-located printed `[icon:attack]` (the D-24016 attack-per-count precedent) so no
phantom flat attack is emitted. Not in `NO_MAGNITUDE_KEYWORDS`. No hash re-pin (the
sentinel plays no wwhk cards).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft
commit body). §1–§9 PASS (Context authoritative; §4 the card-data change is a
prose-marker append, not a 00.2 schema change; §8 engine decides, no client
surface change — the reveal is state the client already projects). §12–§17 PASS
(control run mandated; §16 human-style; §17 Vision block carries clause numbers +
conflict assertion + determinism line; §15.1 declares `play.legendary-arena.com`
with the D-24026 gate). §10, §11, §18, §20, §21 resolve N/A with named
justifications. **Gate verdicts finalised at execution.**
