# WP-513 — Replace Earth's Leaders with Killbots: Converted-Bystander Villains + Escape Loss (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (introduces a new
converted-card mechanic + a new `G` field + a new dynamic-attack source —
determinism/contract surface; lightweight-lane ineligible per 01.0a #3/#4/#6) ·
**Baseline:** `origin/main` @ `3a51b63d` (WP-511 merged) · **User-Visible
Surface:** play.legendary-arena.com

## Goal

Replace Earth's Leaders with Killbots (`core/replace-earths-leaders-with-killbots`)
is unconfigured: it rides the twist-count doom-clock proxy (D-24178, MVP fallback
7), and its Bystanders-in-the-Villain-Deck do nothing special. Its printed rules:
*"Bystanders in the Villain Deck count as Killbot Villains, with attack equal to
the number of Twists next to this Scheme"* and *"Evil Wins: If 5 'Killbots'
escape."* This WP introduces the epic's first **converted-card villain** mechanic
— a card that keeps its printed identity but **acts as a villain** of a named
group — scoped narrowly to Killbots (the smaller, self-contained conversion
scheme; Secret Invasion is WP-514 and reuses this foundation). It wires: (1) the
18 villain-deck Bystanders convert to Killbot Villains at setup (route into the
city, are fought, and escape as villains); (2) their attack scales with a
per-scheme "twists next to this Scheme" counter (starts at 3, +1 per Killbots
twist); (3) the scheme loses when **5 Killbots reach the Escaped Villains pile**,
reusing WP-508's escaped-pile framework via a converted-origin count.

## User-Visible Impact

On `play.legendary-arena.com`, a Killbots match plays its printed rules:
Bystanders drawn from the Villain Deck enter the city as **Killbot Villains**
whose attack rises as more Killbots twists are drawn, can be fought like villains,
and — if 5 of them escape the city — evil wins. The scheme no longer loses on the
(unreachable) twist-count proxy.

## Assumes

- **WP-508 / D-24315 (✅ merged).** Reuses the `SchemeTwistConfig.resourceLossCondition`
  framework + `schemeResourceLoss.ts` + the escape-branch call site
  (`villainDeck.reveal.ts`), extended here to count by **converted origin** rather
  than only `RevealedCardType`.
- **Killbots villain-deck composition is already data-driven.**
  `data/cards/core.json` declares `villainDeckTwistCount: 5` +
  `villainDeckBystanderCount: 18`, both read by `buildVillainDeck`
  (`villainDeck.setup.ts`). The 18 Bystanders are **already** in the Killbots
  villain deck; today they are typed `'bystander'` and route to a captor
  (`villainDeck.reveal.ts`), never entering the city. **No new deck-composition
  surface** — the conversion (typing + routing + identity) is the work.
- **`RevealedCardType` is a closed 5-value union** (`villainDeck.types.ts`) driving
  BOTH reveal routing AND escaped-pile counting. Converted cards need villain
  routing **and** a distinct identity for the 5-Killbot count — a single type
  field cannot do both without a wide closed-union ripple (see Context).
- **Dynamic fight cost precedent (WP-214).** `resolveFightCost`
  (`economy/economy.resolve.ts`) already supports a `'dynamic'` `fightCostMode`;
  this WP adds a converted-origin attack source (the per-scheme twist counter),
  keeping the UI-reads-engine-resolved-value contract.
- **`G.counters` is the home for the per-scheme twist counter** (a plain integer,
  hashed, JSON-serializable) — no new counter *type*, a new key.

## Context (Read First)

**The converted-card design (D-24324) — a parallel origin overlay, NOT a
closed-union extension.** A Killbot is a **Bystander that counts as a Villain**.
Modeling that by adding a `'killbot'` value to `RevealedCardType` would ripple
into the `REVEALED_CARD_TYPES` drift guard, every reveal-routing switch, and every
type-specific trigger branch — the map's #1 risk. Instead, converted cards are
typed **`'villain'`** in `G.villainDeckCardTypes` (so they route into the city,
fight, and escape via the **existing** villain path — zero routing/drift-guard
change), and a new **`G.convertedVillainOrigins: Record<CardExtId,
ConvertedVillainOrigin>`** overlay records their converted identity
(`'killbot'` for this WP; `'skrull'` reserved for WP-514). The overlay — not the
type — is the identity used for (a) the distinct escaped count, (b) dynamic
attack, (c) display-as-Killbot. This is faithful to the tabletop ("counts as")
and contained.

**Why the escaped count needs the overlay, not `'villain'`.** A Killbots match
also has real villain groups; counting escaped `'villain'` entries would wrongly
include real villains. The loss counts escaped entries whose **origin** is
`'killbot'` — a new `resourceLossCondition` kind `'escaped-converted-count'`
(reads `G.convertedVillainOrigins`), sibling to WP-508's `'escaped-pile-count'`.

**Dynamic Killbot attack.** *"attack = the number of Twists next to this Scheme."*
Setup places 3 twists next to the scheme; each Killbots twist adds one. This is a
per-scheme counter (`G.counters`, seeded 3). `resolveFightCost` gains a converted
attack mode: a `'killbot'`-origin card's attack = that counter (starts 3, grows).
This widens `resolveFightCost`'s inputs to read a scheme counter — noted as a
contract point (the UI consumes the engine-resolved attack, never recomputes).

**Determinism (RS-1 — lazy materialization, no re-pin).** `hashGameState` /
`computeStateHash` serialize the whole `G` via `JSON.stringify`, which OMITS
`undefined` but INCLUDES empty objects. So a new top-level `G.convertedVillainOrigins`
seeded `{}` on *every* game would add `"convertedVillainOrigins":{}` to the
Legacy-Virus sentinel's canonical JSON and shift **both** oracles (the
`reference_hashed_g_field_dual_repin` trap). To avoid re-pinning, the field is
**materialized lazily** — present only for schemes that convert cards (Killbots);
**absent** for every other game — exactly how `lastPlayEffectsFired` / `diagnostics`
avoid re-pin. The field is therefore typed **optional** (`Record<...> | undefined`)
and every reader guards with `?? {}`. Consequence: non-Killbots games are
**byte-identical** (field absent → omitted from the hash), and no committed
fixture plays Killbots, so sentinel `finalStateHash` + `PRE_WP080_HASH` are
**genuinely byte-identical — verify, STOP on any shift.** The new `G.counters` key
is seeded only for Killbots, so non-Killbots `counters` are unchanged too. Built
deterministically at setup (no new `ctx.random` call — the 18 bystanders are
already shuffled into the deck; conversion is a pure relabel after the shuffle).

## Design Rationale

**Reuse the villain path; overlay identity.** Typing converted cards `'villain'`
means the reveal pipeline, city placement, fight resolution, and escape/count all
work unchanged; the overlay adds only what "counts as Killbot" needs. This is the
"duplicate first" concrete choice — WP-514 (Secret Invasion) will add `'skrull'`
to the same overlay, and only a third case would justify abstracting a framework.

**Reuse WP-508's escape-count shape.** The loss is still "N of X in the escaped
pile"; only the classifier changes (origin, not card type). `applyEscapedPileResourceLoss`'s
idempotent-latch + escape-branch call site are reused; a sibling
`applyEscapedConvertedResourceLoss` (or a widened classifier) handles the origin
kind.

## Scope (In)

- `packages/game-engine/src/types.ts`: add `G.convertedVillainOrigins:
  Record<CardExtId, ConvertedVillainOrigin>` + the `ConvertedVillainOrigin` type
  (`'killbot'` for this WP).
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts`: for Killbots, type
  the villain-deck Bystanders `'villain'` in `villainDeckCardTypes` and record
  each in `convertedVillainOrigins` as `'killbot'`.
- `packages/game-engine/src/setup/buildInitialGameState.ts`: seed the per-scheme
  "twists next to this Scheme" counter at 3 for Killbots (initialize
  `convertedVillainOrigins`).
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`: add resolver id
  `'killbots'` + `resourceLossCondition` kind `{ kind: 'escaped-converted-count';
  origin: ConvertedVillainOrigin; threshold: number }`.
- `packages/game-engine/src/rules/schemeResourceLoss.ts`: **widen
  `applyEscapedPileResourceLoss` in-place** (RS-2/R3) to dispatch on the condition
  kind — for `'escaped-converted-count'` count `G.escapedPile` entries by
  `convertedVillainOrigins` origin and latch `SCHEME_LOSS` at threshold. The
  escape-branch call site (`villainDeck.reveal.ts:380`) is UNCHANGED and stays
  OFF the allowlist.
- `packages/game-engine/src/rules/schemeTwistResolvers.ts`: new `'killbots'`
  resolver — increment the per-scheme twist counter.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts`: Killbots entry
  (resolver `'killbots'`, `resourceLossCondition` escaped-converted-count/killbot/5,
  `lossThreshold: 5` inert — proxy suppressed).
- `packages/game-engine/src/economy/economy.resolve.ts`: converted attack mode
  **overlay-first (RS-3)** — check `G.convertedVillainOrigins?.[id]` **before** the
  `cardStats === undefined → 0` guard and return the per-scheme twist counter. This
  avoids `economy.logic.ts` / `buildCardStats` entirely (`buildCardStats` is
  scheme-blind; seeding scheme-aware bystander stat rows would balloon scope).
- Tests: `schemeResourceLoss.test.ts` (escaped-converted-count), `schemeTwistResolvers.test.ts`
  (killbots twist increments the counter), `economy/economy.resolve.test.ts` (killbot
  overlay-first dynamic attack = counter), a setup test (18 bystanders → 'villain' +
  origin 'killbot'; counter seeded 3; non-Killbots game leaves the field absent),
  `schemeHandlers.test.ts` (Killbots proxy suppressed).

**Not needed (RS-3/RS-4, per pre-flight source read):** no `economy.logic.ts`
stat-row seeding (overlay-first attack sidesteps it); no new `UIState` field / no
`uiState.filter.ts` change — the city projection already sets `fightCost =
resolveFightCost(...)` (`uiState.build.ts`), so the resolved Killbot attack rides
the existing field. `cardDisplayData` already emits a record for
`bystander-villain-deck-NN` (renders as "Bystander"); a distinct **"Killbot"
display label** is a deferred cosmetic (a future Board-Visible-Field-Rule add), NOT
in this WP — the Killbot is fully functional (enters city, scaling attack, fought,
escapes, counts toward the loss) without it.

## Out of Scope

- **Secret Invasion** (`core/secret-invasion-of-the-skrull-shapeshifters`) — WP-514:
  reuses this WP's converted-villain overlay (adds origin `'skrull'`) but needs the
  determinism-sensitive 12-hero cross-deck shuffle, VP+2 dynamic attack,
  defeat-to-gain routing, and the HQ-hero→Sewers twist. Not here.
- Extending `RevealedCardType` (the closed union stays 5 values).
- Any converted-card "defeat → gain" behavior (that is Secret Invasion's heroes;
  Killbots defeat normally to the victory pile).
- Civil War's "4 Heroes at 2p" sizing + the D-24322 coverage-backdrop follow-up
  (separate tracked items).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/types.ts` | `G.convertedVillainOrigins` + `ConvertedVillainOrigin` type |
| `packages/game-engine/src/villainDeck/villainDeck.setup.ts` | Killbots: bystanders → `'villain'` + origin `'killbot'` |
| `packages/game-engine/src/setup/buildInitialGameState.ts` | for Killbots only: seed the twist counter (3) + materialize `convertedVillainOrigins`; non-Killbots leave both absent (lazy — RS-1) |
| `packages/game-engine/src/rules/schemeTwistConfig.types.ts` | `'killbots'` resolver id + `escaped-converted-count` kind |
| `packages/game-engine/src/rules/schemeResourceLoss.ts` | count escaped by converted origin |
| `packages/game-engine/src/rules/schemeTwistResolvers.ts` | `'killbots'` resolver (increment twist counter) |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | Killbots config entry |
| `packages/game-engine/src/economy/economy.resolve.ts` | killbot attack = twist counter (overlay-first, before the cardStats→0 guard) |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | escaped-converted-count tests |
| `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` | killbots resolver test |
| `packages/game-engine/src/economy/economy.resolve.test.ts` | killbot overlay-first attack test |
| `packages/game-engine/src/setup/*.test.ts` | conversion-typing + counter-seed test (+ non-Killbots leaves field absent) |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | Killbots proxy suppressed |

**Dropped from the original draft (RS-3/RS-4):** `economy.logic.ts` (overlay-first
attack needs no stat-row seeding), `ui/uiState.build.ts` + `ui/uiState.filter.ts`
(attack rides the existing `fightCost` projection; no new field). Net ~11 files.

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24324 + D-24325 Active at execution), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

> **Scope note (gates ruled — ONE WP).** The draft self-flagged ~14 files as
> possibly over-large. Pre-flight's source read showed the true surface is
> materially smaller (display already exists for `bystander-villain-deck-NN`;
> attack rides the existing `fightCost` projection; fightability/defeat are
> free/type-driven; overlay-first attack drops the `economy.logic.ts` work) → net
> ~11 files. Pre-flight verdict: **keep ONE WP — do not split** (a split would ship
> an incoherent half-mechanic: a Killbot that escapes-to-lose but is fought at the
> wrong cost). Copilot recommended a split, but its rationale rested on a display
> gap the pre-flight refuted with source evidence; the one-WP call stands.

## Non-Negotiable Constraints

- Converted cards are typed `'villain'` (native routing) + a `convertedVillainOrigins`
  overlay; `RevealedCardType` and its drift guard are **not** touched.
- The escaped count reads the **origin** overlay (`'killbot'`), never `'villain'`
  (which would include real villains).
- The per-scheme twist counter lives in `G.counters` (a new key, integer); no new
  counter type; `evaluateEndgame` stays counter-only.
- Killbot attack is engine-resolved via `resolveFightCost`; the UI consumes the
  resolved value and never recomputes (economy contract).
- No `.reduce()` in zone/rule/economy ops; no `ctx.random.*` added at setup (the
  bystanders are already shuffled in); no `boardgame.io`/registry import in pure
  helpers.
- Determinism (RS-1): `G.convertedVillainOrigins` is materialized **lazily** —
  present only for Killbots, **absent** (undefined) for every other game — so it is
  omitted from the hash for non-Killbots games. The new counter key is likewise
  Killbots-only. No committed fixture plays Killbots, so sentinel `finalStateHash`
  + `PRE_WP080_HASH` are **genuinely byte-identical**; **if either shifts, STOP**
  (it would mean the field leaked into non-Killbots games) — do not blind-re-pin.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md`; ESM-only, `.test.ts` on `node:test`, Node
v22+. Work from full file contents.

## Contract

**`ConvertedVillainOrigin`** — `'killbot'` (WP-514 adds `'skrull'`).
**`G.convertedVillainOrigins`** — `Record<CardExtId, ConvertedVillainOrigin> |
undefined`, materialized lazily at setup for converting schemes only (absent
otherwise); readers guard with `?? {}`.
**Killbots** — resolver `'killbots'`; `resourceLossCondition { kind:
'escaped-converted-count', origin: 'killbot', threshold: 5 }`; the 18 villain-deck
Bystanders convert to Killbot villains; attack = the per-scheme twist counter
(seeded 3, +1 per Killbots twist).

## Acceptance Criteria

1. At setup for Killbots, the 18 villain-deck Bystanders are typed `'villain'` in
   `G.villainDeckCardTypes` and recorded `'killbot'` in `G.convertedVillainOrigins`;
   the per-scheme twist counter is seeded at 3. A **non-Killbots scheme leaves
   `G.convertedVillainOrigins` absent (undefined)** (lazy materialization — RS-1).
2. A revealed Killbot enters the city and is fightable/escapable via the existing
   villain path (no routing change).
3. A Killbot's resolved attack (via `resolveFightCost`, checked overlay-first
   before the `cardStats → 0` guard) equals the per-scheme twist counter (3 at
   setup, +1 after each Killbots twist).
4. The Killbots twist resolver increments the per-scheme twist counter (and the
   twist-count proxy is suppressed via `resourceLossCondition`).
5. `SCHEME_LOSS` latches when 5 `'killbot'`-origin entries are in `G.escapedPile`,
   counted via the overlay (real escaped villains do not count); not at 4.
6. A Killbot's resolved attack rides the **existing** city `fightCost` projection
   (`uiState.build.ts`) — no new `UIState` field. (Display name renders "Bystander"
   via existing `cardDisplayData`; a distinct "Killbot" label is a deferred
   cosmetic, out of scope.)
7. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** (lazy field absent for the non-Killbots
   sentinel); any shift STOPs (it would mean the field leaked into non-Killbots
   games) — do not blind-re-pin.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson).
4. Control check: revert the Killbots config → AC-4/AC-5 assertions FAIL
   (non-vacuous); revert the converted-attack mode → AC-3 FAILS. Restore.
5. Sentinel + `PRE_WP080_HASH` byte-identical (or deliberate dual re-pin);
   `sim:runtime-observed:check` current.
6. `pnpm -r build` → 0; `git diff --name-only` = the allowlist + governance.
7. **D-24026 live-verify (operator-pending):** a Killbots match on
   play.legendary-arena.com fields Killbot Villains with scaling attack and loses
   at 5 escaped Killbots.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel + PRE_WP080 byte-identical (or dual re-pin applied + documented).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24324 + D-24325 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-548 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24324** — Converted-card villain overlay: a card that "counts as" a villain of
a named group is typed `'villain'` in `G.villainDeckCardTypes` (native reveal
routing / fight / escape — `RevealedCardType` and its drift guard untouched) plus a
new `G.convertedVillainOrigins: Record<CardExtId, ConvertedVillainOrigin>` overlay
(`'killbot'`; WP-514 adds `'skrull'`) carrying the converted identity used for the
distinct escaped count, dynamic attack, and display. Chosen over extending the
closed `RevealedCardType` union to avoid the routing/drift-guard/trigger ripple and
to stay faithful to the tabletop "counts as."

**D-24325** — Killbots faithful model: the 18 villain-deck Bystanders convert to
Killbot villains at setup; their attack = a per-scheme "twists next to this Scheme"
counter (`G.counters`, seeded 3, +1 per `'killbots'`-resolver twist) via a new
`resolveFightCost` converted-attack mode; the scheme loses via
`resourceLossCondition { kind: 'escaped-converted-count', origin: 'killbot',
threshold: 5 }` (reuses WP-508's escape-branch call site, counts by overlay origin);
the twist-count proxy is suppressed.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (WP-508 framework; Killbots deck data-driven; closed union; WP-214 dynamic cost).
- **§4 Context** — PASS (overlay design, escaped-count-by-origin, dynamic attack, determinism).
- **§5 Files** — PASS (allowlist + explicit over-size split note for the gates).
- **§6 Naming** — PASS (`convertedVillainOrigins`, `ConvertedVillainOrigin`, `escaped-converted-count`, `SCHEME_LOSS`).
- **§7 Dependency** — PASS (WP-508 ✅; Killbots data ✅).
- **§8 Architecture** — PASS (game-engine only; evaluateEndgame counter-only; no closed-union change; no `.reduce()`; UIState Board-Visible Field Rule cited for the new projection).
- **§9–§11** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-reverts on config + attack mode).
- **§13 Commands** — PASS (whole-workspace test; dual-re-pin STOP rule).
- **§14 Acceptance Criteria** — PASS (7 testable ACs).
- **§15 Definition of Done** — PASS.
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3 faithful rules; determinism line; NG-1..7 not crossed).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `3a51b63d`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A.

Pre-flight verdict: **READY TO EXECUTE** (one WP; RS-1 lazy-materialization,
RS-2 widen-in-place, RS-3 overlay-first attack, RS-4 attack-rides-existing-projection
all folded above — the folds shrank the WP to ~11 files). Copilot verdict: **RISK →
recommended a split**, superseded — its split rationale (a virtual-bystander display
gap) was refuted by the pre-flight's source read (`buildCardDisplayData §7` already
covers `bystander-villain-deck-NN`); both gates' real fixes (R1 determinism, R3
call-site) are folded. Executing as one WP with the folded plan.
