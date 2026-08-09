# WP-514 — Secret Invasion of the Skrull Shapeshifters: Cross-Deck Hero Conversion + Escape Loss (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (four coupled net-new
mechanics on one scheme + a determinism-sensitive cross-deck shuffle + a change
to the shared city-villain defeat core — heavy determinism/contract surface;
lightweight-lane ineligible per 01.0a #3/#4/#6) · **Baseline:** `origin/main` @
`6a735274` (WP-514 reservation merged) · **User-Visible Surface:**
play.legendary-arena.com

## Goal

Secret Invasion of the Skrull Shapeshifters
(`core/secret-invasion-of-the-skrull-shapeshifters`) is unconfigured: it rides the
twist-count doom-clock proxy (D-24178) and its "heroes become villains" identity is
unmodeled. Its printed rules:

- **Setup:** *8 Twists. 6 Heroes. Skrull Villain Group required. Shuffle 12 random
  Heroes from the Hero Deck into the Villain Deck.*
- **Special Rules:** *Heroes in the Villain Deck count as Skrull Villains with
  Attack equal to the Hero's VP + 2. If you defeat that Hero, you gain it.*
- **Twist:** *The highest-cost Hero from the HQ moves into the Sewers as a Skrull
  Villain, as above.*
- **Evil Wins:** *If 6 Heroes get into the Escaped Villains pile.*

This is the epic's **second converted-card scheme** and its hardest. It reuses
WP-513's converted-villain overlay (adds origin `'skrull'`) and WP-508/513's
escaped-pile resource-loss framework unchanged, then adds four net-new,
tightly-coupled mechanics: (1) a **deterministic 12-hero cross-deck shuffle** at
setup (heroes leave the Hero Deck, become Skrull villains, and shuffle into the
Villain Deck); (2) a **converted-hero attack** = the hero's cost + 2 (a documented
proxy for the printed "VP + 2" — see Context); (3) **defeat-to-gain** — a defeated
Skrull returns to the defeating player's discard instead of the victory pile; (4) a
**twist** that converts the highest-cost HQ Hero into a Skrull at the Sewers. The
scheme loses when **6 Skrulls reach the Escaped Villains pile**.

## User-Visible Impact

On `play.legendary-arena.com`, a Secret Invasion match plays its printed rules:
12 Heroes are shuffled into the Villain Deck at setup and revealed as **Skrull
Villains** (attack = their cost + 2), enter the city, and can be fought — and when
you defeat one you **gain the Hero** into your discard. Each Twist drags the
highest-cost HQ Hero into the Sewers as a fresh Skrull. If **6 Skrulls escape**,
evil wins. The scheme no longer loses on the (irrelevant) twist-count proxy.

## Assumes

- **WP-513 / D-24324 (✅ merged).** Reuses the converted-card overlay verbatim: a
  card that "counts as" a villain is typed `'villain'` in `G.villainDeckCardTypes`
  (native reveal / fight / escape routing; `RevealedCardType` closed union
  untouched) plus the `G.convertedVillainOrigins: Record<CardExtId,
  ConvertedVillainOrigin>` overlay for identity. This WP only extends
  `ConvertedVillainOrigin` with `'skrull'`.
- **WP-513 / D-24325 escaped-converted-count loss (✅ merged).** The
  `resourceLossCondition` kind `{ kind: 'escaped-converted-count'; origin;
  threshold }` and `countEscapedByConvertedOrigin(gameState, origin)` in
  `schemeResourceLoss.ts` are **origin-parametric** — extending
  `ConvertedVillainOrigin` to include `'skrull'` makes `{ origin: 'skrull',
  threshold: 6 }` valid with **no change to `schemeResourceLoss.ts`** and no change
  to the escape-branch call site (`villainDeck.reveal.ts`).
- **The hero-deck reservoir is a clean pre-HQ seam.** In `buildInitialGameState.ts`
  the full shuffled hero reservoir exists as `shuffledHeroDeck` **before**
  `fillHqFromDeck` splits it into HQ + `G.heroDeck` (map: `:471-476`). The 12
  converted heroes are drawn here so they never reach HQ/`G.heroDeck`.
- **Hero cost is already in `G.cardStats` at runtime.** `resolveFightCost`'s
  existing dynamic mode already reads `G.cardStats[heroId]?.cost` for captured
  heroes (`economy.resolve.ts`), so a converted hero's cost is available with **no
  new setup materialization** — both setup-converted and twist-converted heroes
  carry a `cardStats` row. (Executor: confirm hero rows exist in `G.cardStats`; the
  captured-hero cost path already relies on it.)
- **The city entry is the Sewers.** `pushVillainIntoCity` (`board/city.logic.ts`)
  places a card at **space 0** and cascades toward the escape edge (space 4);
  space 0 is the Sewers. The twist reuses this exact helper, so a twist-converted
  Skrull uses the standard city-insert → cascade → escape → escaped-pile →
  resource-loss pipeline for free.
- **`refillHqSlot` + the cost-selection pattern exist.** `koFromHq`
  (`schemeTwistResolvers.ts`) already scans HQ, reads cost from `G.cardStats`, and
  sorts; `refillHqSlot` (`city.logic.ts`, pure, FIFO front-pop, empty-deck →
  null per D-13503) refills a vacated slot. The twist reuses both (comparator
  flipped to highest-cost).
- **The discard-routing idiom exists** (`board/heroCapture.logic.ts`
  `awardAttachedHeroes` pushes a villain's *attached* heroes to a player's
  discard). **Defeat-to-gain mirrors that push but on the fought card itself** — it
  pushes the defeated Skrull `cardId` **directly** to the defeating player's discard
  (replacing the victory-pile push). It does **not** call
  `awardAttachedHeroes(cardId)`, which operates on `G.villainAttachedHeroes`, not the
  fought card (pre-flight RS-2).

## Context (Read First)

**Attack = cost + 2 is a DOCUMENTED PROXY for "VP + 2" (D-24327, operator-chosen).**
The printed attack is *the Hero's VP + 2*, but **hero VP does not exist anywhere in
our data** — not in generated `data/cards/*.json` (0 of 63 core heroes carry `vp`;
villains/henchmen/bystanders/masterminds all do) **and not upstream** (`coreset.js`
heroes have `cost`/`recruit`/`attack` but no `vp`; the source never included it).
`buildCardVictoryPoints` mirrors that gap (villains/henchmen/masterminds only).
Authoring hero VP would mean **fabricating** values with no faithful source, across
every set, well out of proportion to one scheme. Per operator decision, the attack
uses the hero's **cost + 2** — a real, available value that correlates with card
power — as a deliberate proxy (the D-24178 proxy precedent), with a **clean swap
seam**: a single `// PROXY:` branch in `resolveFightCost` that becomes
`G.cardVictoryPoints[id] + 2` the day hero VP data lands. This is faithful in spirit
and honest about the gap; the epic replaces proxies where the data exists — here it
does not.

**Reuse the villain path + overlay identity (D-24324, unchanged).** A Skrull is a
Hero that counts as a Villain. It is typed `'villain'` in `G.villainDeckCardTypes`
(native reveal/city/fight/escape) and recorded `'skrull'` in
`G.convertedVillainOrigins`. The overlay — not the type — drives the distinct
escaped count, the cost-proxy attack, and defeat-to-gain. `RevealedCardType` and its
drift guard are **not** touched.

**The cross-deck shuffle is the one determinism-sensitive novelty.** Setup shuffles
in a fixed order (map): per-player decks → 4 global piles → villain deck →
mastermind tactics → **hero deck (LAST `ctx.random` draw)**. For Secret Invasion,
**after** the hero shuffle (so upstream draws are untouched) a setup step: (a) draws
the top 12 of the shuffled hero reservoir (equivalent to "12 random Heroes"), (b)
converts each (`villainDeckCardTypes` `'villain'` + `convertedVillainOrigins`
`'skrull'`), (c) injects them into `G.villainDeck.deck`, and (d) **re-shuffles the
villain deck** via `ctx.random.Shuffle` — one **new** `ctx.random` draw that fires
**only for Secret Invasion** and must be the **last** draw in setup. Consequence:
non-Secret-Invasion games add **zero** new random draws (byte-identical); Secret
Invasion games re-pin, and **no committed fixture plays Secret Invasion**, so the
sentinel `finalStateHash` + `PRE_WP080_HASH` are **byte-identical — verify, STOP on
any shift** (a shift means the new draw leaked outside the SI gate).

**Determinism of the overlay + no VP materialization.** `convertedVillainOrigins`
already exists (WP-513) and is materialized lazily — present only for converting
schemes. Secret Invasion populates it (as Killbots does); non-converting games leave
it absent. Because the attack proxy reads the **existing** `G.cardStats.cost`, there
is **no `G.cardVictoryPoints` change** and no VP-materialization re-pin.

**Defeat-to-gain touches the shared city-villain defeat core.** In
`moves/fightVillain.ts`, `defeatCityVillainCore` currently pushes a defeated city
villain to the defeating player's **victory** pile (`:220-221`). For a
`'skrull'`-origin card only, it instead pushes the **fought `cardId` itself**
directly to that player's **discard** ("you gain it") — replacing the `victory.push`
at `:221`, **not** calling `awardAttachedHeroes` (which handles a villain's attached
heroes, not the fought card — RS-2) — and **clears its conversion** (remove from
`convertedVillainOrigins`; it is a Hero again in the discard) and **logs the gain**
(`pushLog`, mirroring the attached-hero log at `:269-278` — else a hero appears in the
player's deck with no log trail, a documented papercut). This is a guarded branch on
the shared core — the highest-blast-radius change; every non-Skrull defeat must be
byte-unchanged (tested both ways). (Silent Sniper's defeat path shares this core at
`:184-185`; the guard must not disturb it — and its "defeat a villain" also gains the
Hero, faithful to the printed rule.)

## Design Rationale

**Reuse everything WP-513 and WP-508 built.** Overlay identity, escaped-converted
loss, city insert/cascade/escape, `refillHqSlot`, the `awardAttachedHeroes`
discard idiom, and the `resolveFightCost` overlay-first pattern all carry over. The
genuinely new surface is: the cross-deck setup shuffle, the cost-proxy attack
branch, the defeat-to-gain branch, and the highest-cost-HQ→Sewers twist resolver.

**Overlay-first attack, proxy-documented.** The `'skrull'` branch sits beside
WP-513's `'killbot'` branch at the top of `resolveFightCost` and returns
`(G.cardStats[id]?.cost ?? 0) + 2` with a `// PROXY:` `// why:` comment naming the
VP-data gap and the swap seam.

**Twist reuses the city pipeline, not a bespoke path.** Placing the converted HQ
hero via `pushVillainIntoCity` at the Sewers means a full city triggers the standard
escape → escaped-pile carry (WP-508) → `escaped-converted-count` check (WP-513) with
no new escape code.

## Scope (In)

- `packages/game-engine/src/types.ts`: extend `ConvertedVillainOrigin` →
  `'killbot' | 'skrull'` (one line).
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`: add
  `SchemeTwistResolverId` `'secret-invasion'`. (The `escaped-converted-count` kind
  already accepts `'skrull'` via the type extension — no union edit.)
- `packages/game-engine/src/setup/buildInitialGameState.ts` (+ a small pure helper,
  e.g. `setup/convertHeroesToSkrulls.ts`): for Secret Invasion only, after the hero
  shuffle, draw the top 12 of the reservoir, convert (type `'villain'` + origin
  `'skrull'`), inject into `G.villainDeck.deck`, re-shuffle the villain deck (the
  **last** `ctx.random` draw), and materialize `convertedVillainOrigins`. Non-SI
  games: no reservoir draw, no new shuffle, field absent (lazy).
- `packages/game-engine/src/rules/schemeTwistResolvers.ts`: new `'secret-invasion'`
  resolver — select the **highest-cost** HQ hero (flip the `koFromHq` comparator;
  a `'highestCost'` HQ selector precedent also exists in
  `board/heroCapture.logic.ts:69-81`, RS-3), convert to `'skrull'`,
  `pushVillainIntoCity` at the Sewers (handling any escape via the existing
  pipeline), and `refillHqSlot` the vacated slot.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts`: Secret Invasion entry —
  `resolverId: 'secret-invasion'`, `resourceLossCondition { kind:
  'escaped-converted-count', origin: 'skrull', threshold: 6 }`, `lossThreshold`
  retained but inert (proxy suppressed; 8 twists is the deck's twist **count**, not
  a loss condition).
- `packages/game-engine/src/economy/economy.resolve.ts`: `'skrull'` attack mode —
  overlay-first (beside `'killbot'`), returns `(G.cardStats[id]?.cost ?? 0) + 2`
  with the `// PROXY:` comment + swap seam.
- `packages/game-engine/src/moves/fightVillain.ts`: `defeatCityVillainCore`
  defeat-to-gain — a `'skrull'`-origin defeated city card routes to the defeating
  player's **discard** (not victory) and clears its `convertedVillainOrigins` entry;
  all non-Skrull defeats unchanged. **Emit a `pushLog` naming the gained Hero into
  the discard** (mirroring the attached-hero precedent at `:269-278` — a hero landing
  in a player's deck with no log trail is a documented papercut; copilot #2).
- `packages/game-engine/src/events/notableEvents.types.ts`: add
  `'secretInvasion'` to `SchemeTwistResolverKey` **and**
  `SCHEME_TWIST_RESOLVER_KEYS`, and correct **every** stale "five" resolver-key
  reference in the file → seven (`:75`, `:90-92`, `:156-157`, `:164` — copilot #1;
  the array is already 6, so all four are already wrong).
- `packages/game-engine/src/events/notableEvents.compose.ts`: add the
  `RESOLVER_KEY_PHRASES` entry.
- Tests: `setup/*.test.ts` (12 heroes converted + injected + deterministic
  re-shuffle; non-SI leaves field absent + adds no draw), `economy/economy.resolve.test.ts`
  (skrull attack = cost + 2, overlay-first), `moves/fightVillain.test.ts`
  (defeat-to-gain routes skrull → discard + clears overlay; non-skrull → victory
  unchanged), `rules/schemeTwistResolvers.test.ts` (SI twist: highest-cost HQ hero →
  Sewers as skrull, HQ refilled), `rules/schemeResourceLoss.test.ts` (6 skrulls
  escaped → `SCHEME_LOSS`; not at 5), `rules/schemeHandlers.test.ts` (SI proxy
  suppressed), `events/notableEvents.types.test.ts` (resolver count 6 → 7).

**Not needed:** no `schemeResourceLoss.ts` change (origin-parametric already); no
`villainDeck.reveal.ts` change (escape call site reused); no `buildCardVictoryPoints`
/ `G.cardVictoryPoints` change (cost proxy uses existing `cardStats`); no
`RevealedCardType` change; no new bgio move (defeat-to-gain is a branch in the
existing fight path, so no `game.test.ts` move-set edit).

## Out of Scope

- **Faithful hero-VP attack.** Deferred to a future data-pipeline effort if hero VP
  data is ever authored; the swap seam is left in `resolveFightCost` (D-24327).
- **Enforcing "8 Twists / 6 Heroes / Skrull Group required" as engine setup gates.**
  Twist count and hero-group composition are loadout/qualification concerns
  (config-driven `villainDeckTwistCount` / `heroDeckIds`), not engine overrides;
  a Skrull-group qualification badge belongs to the gauntlet/loadout layer, not
  here. Flagged for the loadout-qualification track, not this WP.
- Civil War's "4 Heroes at 2p" sizing + the D-24322 coverage-backdrop follow-up
  (WP-512, separate tracked items).
- Extending `RevealedCardType` (closed union stays 5 values).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/types.ts` | `ConvertedVillainOrigin` += `'skrull'` |
| `packages/game-engine/src/rules/schemeTwistConfig.types.ts` | `SchemeTwistResolverId` += `'secret-invasion'` |
| `packages/game-engine/src/setup/buildInitialGameState.ts` | SI-only: 12-hero draw + convert + inject + re-shuffle villain deck (last draw) + materialize overlay |
| `packages/game-engine/src/setup/convertHeroesToSkrulls.ts` (new, pure helper) | draw-12 + relabel + inject logic (no `boardgame.io`; `ctx.random` passed in) |
| `packages/game-engine/src/rules/schemeTwistResolvers.ts` | `'secret-invasion'` resolver (highest-cost HQ hero → Sewers as skrull → refill) |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | Secret Invasion config entry |
| `packages/game-engine/src/economy/economy.resolve.ts` | skrull attack = cost + 2 (overlay-first, PROXY + swap seam) |
| `packages/game-engine/src/moves/fightVillain.ts` | `defeatCityVillainCore` defeat-to-gain branch (skrull → discard, clear overlay) |
| `packages/game-engine/src/events/notableEvents.types.ts` | `SchemeTwistResolverKey` + `SCHEME_TWIST_RESOLVER_KEYS` += `'secretInvasion'` |
| `packages/game-engine/src/events/notableEvents.compose.ts` | `RESOLVER_KEY_PHRASES` entry |
| `packages/game-engine/src/setup/*.test.ts` | cross-deck conversion + determinism (non-SI leaves field absent + no new draw) |
| `packages/game-engine/src/economy/economy.resolve.test.ts` | skrull cost+2 attack |
| `packages/game-engine/src/moves/fightVillain.test.ts` | defeat-to-gain routing (skrull vs non-skrull) |
| `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` | SI twist resolver |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | 6-skrull escape loss |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | SI proxy suppressed |
| `packages/game-engine/src/events/notableEvents.types.test.ts` | resolver count 6 → 7 |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24326 + D-24327 Active at execution), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

> **Scope note (GATES MUST RULE — self-flagged over-size, ~17 files).** This is
> materially larger than WP-513 (~11): four coupled net-new mechanics plus a change
> to the **shared** `defeatCityVillainCore`. It is presented as **one** WP because a
> split ships an incoherent half-scheme (heroes that convert but are fought at the
> wrong cost, or a scheme that can't be lost, or a Skrull you can't gain).
> **Proposed split axis if pre-flight rules over-size:** WP-514a = setup cross-deck
> conversion + cost-proxy attack + escaped-converted loss (the "heroes become
> Skrull villains that escape to lose" core); WP-514b = defeat-to-gain +
> highest-cost-HQ→Sewers twist (the interaction layer, depends on 514a's overlay).
> Even 514a alone is playable-but-unfaithful (defeat sends a hero to the victory
> pile; no twist), so the epic's faithfulness bar argues for one WP. **Pre-flight
> decides.**

## Non-Negotiable Constraints

- Converted heroes are typed `'villain'` (native routing) + `'skrull'` in
  `convertedVillainOrigins`; `RevealedCardType` and its drift guard are **not**
  touched.
- The escaped count reads the **origin overlay** (`'skrull'`), never `'villain'`
  (which would include the scheme's real villains).
- Skrull attack is engine-resolved in `resolveFightCost` (cost + 2, PROXY); the UI
  consumes the resolved value and never recomputes.
- Defeat-to-gain is a **guarded** branch: only `'skrull'`-origin city cards route to
  discard; every other defeat is byte-unchanged (tested both ways).
- The cross-deck villain-deck re-shuffle is a **single new `ctx.random.Shuffle`**,
  gated to Secret Invasion, and the **last** random draw in setup; no other new
  randomness. No `.reduce()` in zone/rule/economy ops; no `boardgame.io`/registry
  import in pure helpers (the new conversion helper takes `ctx.random` + resolved
  data as arguments).
- Determinism: `convertedVillainOrigins` stays lazy (SI-only). No committed fixture
  plays Secret Invasion, so sentinel `finalStateHash` + `PRE_WP080_HASH` are
  **byte-identical**; **if either shifts, STOP** (the SI-gated draw or overlay
  leaked into a non-SI game) — do not blind-re-pin.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md`; ESM-only, `.test.ts` on `node:test`, Node
v22+. Work from full file contents.

## Contract

**`ConvertedVillainOrigin`** — `'killbot' | 'skrull'`.
**Secret Invasion** — `core/secret-invasion-of-the-skrull-shapeshifters`; resolver
`'secret-invasion'`; `resourceLossCondition { kind: 'escaped-converted-count',
origin: 'skrull', threshold: 6 }`. Setup shuffles 12 Heroes from the reservoir into
the Villain Deck as `'skrull'`-origin `'villain'` cards. Skrull attack =
`(G.cardStats[id]?.cost ?? 0) + 2` (PROXY for VP + 2). Defeating a Skrull routes the
Hero to the defeating player's discard and clears the overlay. Twist: highest-cost
HQ Hero → Sewers as a Skrull.

## Acceptance Criteria

1. At setup for Secret Invasion, exactly **12** Heroes are removed from the hero
   reservoir (never reaching HQ / `G.heroDeck`), typed `'villain'` in
   `G.villainDeckCardTypes`, recorded `'skrull'` in `G.convertedVillainOrigins`, and
   present in `G.villainDeck.deck`; the villain deck is re-shuffled. A **non-Secret-
   Invasion scheme leaves `G.convertedVillainOrigins` absent** and adds **no** new
   `ctx.random` draw.
2. A revealed Skrull enters the city and is fightable/escapable via the existing
   villain path (no routing change).
3. A Skrull's resolved attack (via `resolveFightCost`, overlay-first before the
   `cardStats → 0` guard) equals its Hero cost **+ 2** (documented PROXY for VP + 2).
4. Defeating a city Skrull routes the Hero card to the defeating player's **discard**
   (not victory), clears its `convertedVillainOrigins` entry, and **emits a `pushLog`
   line naming the gained Hero**; a **non-Skrull** city villain still routes to the
   **victory** pile and emits no such gain line (unchanged — non-vacuous both ways).
5. The `'secret-invasion'` twist resolver moves the **highest-cost** HQ Hero into the
   Sewers (`pushVillainIntoCity`, space 0) as a `'skrull'`-origin villain and refills
   the vacated HQ slot via `refillHqSlot`; ties break by **lowest slot index**
   (ascending, matching `koFromHq`'s comparator — the test pins the direction).
6. `SCHEME_LOSS` latches when **6** `'skrull'`-origin entries are in `G.escapedPile`
   (counted via the overlay; real escaped villains do not count); not at 5. The
   twist-count proxy is suppressed via `resourceLossCondition`.
7. Determinism: full engine suite green; **whole-workspace** green; sentinel
   `finalStateHash` + `PRE_WP080_HASH` **byte-identical** (no committed SI fixture;
   SI-gated draw). Any shift STOPs — do not blind-re-pin.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson —
   `evaluateEndgame`/outcome shifts are invisible to the engine suite alone).
4. Control-revert non-vacuous: drop the SI config → AC-5/AC-6 fail; drop the
   skrull attack mode → AC-3 fails; drop the defeat-to-gain branch → AC-4's
   skrull-half fails while the non-skrull half stays green. Restore.
5. Sentinel + `PRE_WP080_HASH` byte-identical (STOP on shift); `sim:runtime-observed:check`
   current (Secret Invasion is not a sim backdrop — the LESSON check: confirm no sim
   harness uses it).
6. `pnpm -r build` → 0; `git diff --name-only` = the allowlist + governance.
7. **D-24026 live-verify (operator-pending):** a Secret Invasion match on
   play.legendary-arena.com reveals Skrull Villains (attack = cost + 2), gains a Hero
   on defeat, drags the top-cost HQ hero to the Sewers on a twist, and loses at 6
   escaped Skrulls.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel + PRE_WP080 byte-identical (or dual re-pin applied + documented with
      the reason — SI-gated draw should NOT touch them).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24326 + D-24327 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-549 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24326** — Skrull conversion overlay + deterministic cross-deck shuffle: Secret
Invasion extends `ConvertedVillainOrigin` with `'skrull'` (reusing WP-513's
overlay + WP-508/513's escaped-converted-count loss, `{ origin: 'skrull', threshold:
6 }`, with no change to `schemeResourceLoss.ts`). At setup, after the hero-deck
shuffle, the top 12 heroes of the shuffled reservoir are converted (typed
`'villain'` + origin `'skrull'`), injected into `G.villainDeck.deck`, and the villain
deck is re-shuffled via a **single new `ctx.random.Shuffle`** — gated to Secret
Invasion and the **last** random draw in setup, so non-SI games are byte-identical
and only SI (no committed fixture) re-pins. `convertedVillainOrigins` stays lazy.

**D-24327** — Skrull combat (cost-proxy attack) + defeat-to-gain + HQ→Sewers twist:
a Skrull's fight cost is `(G.cardStats[id]?.cost ?? 0) + 2` via a new overlay-first
`resolveFightCost` mode — a **documented PROXY** for the printed "Hero's VP + 2",
because hero VP exists nowhere in the data (generated or upstream) and authoring it
would fabricate values across every set; a `// PROXY:` swap seam becomes
`G.cardVictoryPoints[id] + 2` if hero VP is ever authored (operator-chosen over
authoring VP or deferring the scheme). Known skew: a Hero's cost typically runs
**higher** than its printed VP, so `cost + 2` makes Skrulls slightly **harder** to
defeat than the printed `VP + 2` — an acceptable, documented direction pending real
VP data. Defeating a city Skrull pushes the fought
`cardId` directly to the defeating player's discard ("you gain it") — replacing the
victory-pile push, not via `awardAttachedHeroes` — clears its overlay, and logs the
gain (`pushLog`), via a guarded branch in the shared `defeatCityVillainCore`
(non-Skrull defeats unchanged).
The twist moves the highest-cost HQ Hero (ties → lowest slot index, matching
`koFromHq`) into the Sewers (`pushVillainIntoCity`, space 0) as a Skrull and refills
the slot (`refillHqSlot`).

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (WP-513 overlay + escaped-converted loss; hero reservoir
  seam; hero cost in `cardStats`; city Sewers = space 0; `refillHqSlot` +
  cost-selection + `awardAttachedHeroes` idioms).
- **§4 Context** — PASS (cost-proxy rationale + data-gap evidence; overlay reuse;
  cross-deck determinism; defeat-core blast radius).
- **§5 Files** — PASS (allowlist + explicit self-flagged over-size + proposed split
  axis for the gates).
- **§6 Naming** — PASS (`'skrull'`, `'secret-invasion'`, `secretInvasion`,
  `escaped-converted-count`, `SCHEME_LOSS`, `convertHeroesToSkrulls`).
- **§7 Dependency** — PASS (WP-513 ✅ merged; WP-508 ✅).
- **§8 Architecture** — PASS (game-engine only; `evaluateEndgame` counter-only; no
  closed-union change; no `.reduce()`; single SI-gated `ctx.random` draw; pure helper
  takes `ctx.random` as an argument; shared-defeat-core change is guarded + tested
  both ways).
- **§9–§11** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-reverts on config,
  attack mode, and defeat-to-gain branch; determinism assertions).
- **§13 Commands** — PASS (whole-workspace test; byte-identical STOP rule).
- **§14 Acceptance Criteria** — PASS (7 testable ACs).
- **§15 Definition of Done** — PASS.
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (faithful printed
  rules; cost-proxy documented + swap seam; determinism line; NG-1..7 not crossed).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `6a735274`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (no `apps/server`
  endpoint or library-surface change).

Pre-flight verdict (independent subagent, all 7 load-bearing claims verified against
source, file:line): **READY TO EXECUTE — ONE WP (do not split)**. The 514a split
would ship a scheme that violates two of its four printed rules (defeat-to-victory
instead of gain; twist never fires); the ~17-file count is inflated by 7 test files +
~4 one-line union/trio edits (net-new logic in ~5 files, comparable to WP-513's ~11);
the `defeatCityVillainCore` change is a single origin-guarded branch, not a refactor;
514b has no independent value. No PS (blocking) items. Four RS items **folded above**:
RS-1 (correct stale `notableEvents` "five-entry" JSDoc → 7), RS-2 (defeat-to-gain
pushes the fought `cardId` directly to discard — **not** `awardAttachedHeroes`, which
handles attached heroes), RS-3 (tie-break pinned to lowest slot index; `'highestCost'`
selector precedent noted), RS-4 (the 12-hero draw must trim `shuffledHeroDeck`
**before** `fillHqFromDeck` consumes it — the one place a subtle both-decks-get-the-card
bug hides). Copilot verdict (independent subagent, on the RS-folded WP + the pre-flight
report): **RISK → HOLD-resolved**. Concurs with the one-WP ruling and re-verified all 7
claims + the hero-`cardStats.cost` prerequisite (`buildInitialGameState.loadout.test.ts:228,285`).
Two scope-neutral findings **folded above**: **#1** the stale-"five" JSDoc sweep must
cover all four sites (`notableEvents.types.ts:75/:90-92/:156-157/:164`), not just one;
**#2** defeat-to-gain must emit a `pushLog` naming the gained Hero (the file's own
attached-hero precedent at `:269-278` documents this as required) + an AC-4 assertion.
Out-of-lens observation folded into D-24327: `cost` typically exceeds `VP`, so the
proxy skews Skrulls slightly harder than printed. No new scope/contract/field/move →
no pre-flight re-run; copilot re-run confirms the folds.
