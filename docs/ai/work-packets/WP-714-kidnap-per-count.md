# WP-714 — Kidnap-per-count bystander-capture hero effect (Game Engine + card-data)

**Status:** Draft 2026-09-20 (EC-751; D-24537 reserved)
**Layer:** Game Engine (new count-scaled hero effect) + card-data marker
**Hard-deps:** WP-711 (`tech-heroes-played-this-turn` count source / D-24534) ✅, WP-247 (attack-per-count executor + count-scaled parse recipe / D-24016) ✅, the `here-hold-this` hero bystander-capture machinery (Deadpool) ✅
**Baseline:** `origin/main` @ 6d5b8cb2 (2026-09-20)

## Goal

Ultron's **Genetic Experimentation** (`vill`) prints `[hc:tech]: Kidnap a Bystander
for each other [hc:tech] Ally you played this turn`, but does nothing today: the
line carries no count-scaled marker, so it falls through as an unimplemented
descriptor (it was deferred by WP-711/EC-748 and sits on the
`check-hero-count-markers` deferral allowlist, PR #2187). This WP adds a **new
count-scaled hero-effect type**, `kidnap-per-count`, that captures **N = magnitude ×
⌊count / perEach⌋** Bystanders where `count` is the **already-shipped**
`tech-heroes-played-this-turn` source, then backfills the card's marker. It is the
bystander-capture analogue of the shipped `attack-per-count` / `recruit-per-count`
family: same count-scaling half, a **bystander-capture** grant instead of a
resource grant.

## User-Visible Impact

Genetic Experimentation begins working: playing it after other Tech Ultron cards
captures one Bystander per other Tech card played this turn (self-exclusive), each
attached to a City villain (Mastermind fallback), supply-bounded. Today it captures
nothing. Validated by unit tests (the executor's count-scaled capture loop, the
target/fallback, supply exhaustion) and by the card's end-to-end grant.

## Assumes

- **The count source already exists.** `tech-heroes-played-this-turn`
  (`rules/heroCountSource.ts`; resolver `hero/heroCountSource.resolve.ts:426`) ships
  from WP-711/D-24534 and is **self-exclusive** via `triggeringCardId` — exactly the
  card's "each **other** [hc:tech] Ally". **No new count source is added.**
- **The capture primitive already exists.** Deadpool's `here-hold-this` hero keyword
  drives hero-initiated bystander capture through
  `attachBystanderToCityVillain(G, cityIndex)` and the universal-rules fallback
  `captureBystanderToMastermind(G)` (imported by `heroEffectHereHoldThis`,
  `hero/heroEffects.execute.ts`), over the pure ops in `board/bystanders.logic.ts`
  (`attachBystanderToVillain`). **No new capture primitive is added.**
- **The count-scaled grant family + parse recipe ship at HEAD.** The
  `attack-per-count` / `recruit-per-count` executors
  (`hero/heroEffects.execute.ts:1946/1992`), the `COUNT_SCALED_PATTERN` extraction
  and effect-descriptor builder (`setup/heroAbility.setup.ts`), and
  `isValidHeroCountSource` all ship. This WP mirrors that recipe for a
  bystander-capture grant.
- The card's leading `[hc:tech]:` synergy prefix is the existing `heroClassMatch`
  gate; it stays. The **inline** `[hc:tech]` count criterion emits the usual
  duplicate `heroClassMatch` that collapses to the one gate (Legendary Commander
  inline-`[team:shield]` parity) — no new suppression.
- Card data is GENERATED; the marker is authored via
  `scripts/convert-cards/inputs/hero-ability-markers.json` + the multi-stage regen,
  never hand-edited in `data/cards/`.

## Design Rationale (three load-bearing decisions)

### 1. A new grant type, not a new count source — capture is the novel half

Unlike WP-711 (which reused the shipped grant family and only added count
*sources*), the capture *grant* has no count-scaled form yet. So this WP adds one
`HeroKeyword` — `kidnap-per-count` — whose executor scales like its siblings
(`N = magnitude × ⌊count / perEach⌋`, `count = resolveCountSource(G, p,
'tech-heroes-played-this-turn', cardId)`) but performs **N bystander captures**
instead of a resource add. The count-scaling code path is copied from
`heroEffectRecruitPerCount`; the per-iteration action is copied from
`heroEffectHereHoldThis`.

### 2. Auto-targeted, non-interactive (operator decision 2026-09-20)

Each capture attaches to the **first City villain** (lowest city index holding a
villain), with `captureBystanderToMastermind(G)` as the universal-rules fallback
when the City holds none — reusing the `here-hold-this` machinery, but **without**
its interactive `PendingSeatChoice`. This keeps `kidnap-per-count` a **synchronous**
count-scaled effect exactly like every other `-per-count` sibling (no N sequential
seat parks), and matches base-game "capture" semantics (a Bystander attached to a
villain, awarded on that villain's later defeat). Locked by D-24537.

- **Rejected:** a `PendingSeatChoice` per capture ("a Villain of your choice"). It
  would turn a bulk count-scaled effect into N interactive parks — a
  pending-choice-shaped WP an order of magnitude larger, and not what the card's
  bulk "Kidnap a Bystander for each …" wording implies. Out of scope.
- **Rejected:** banking captured Bystanders straight to the player's Victory Pile. A
  different destination with different award timing; not the engine's capture
  semantics. Out of scope.

### 3. Supply-bounded, deterministic, no new hashed field

The loop breaks when `G.piles.bystanders` is empty (the `villainEffectCaptureBystander`
counted-variant precedent). It reads the shipped, already-hashed `G`
(`inPlay` + `cardTraits` for the count; `piles.bystanders` + city for the capture)
and mutates only the same zones any capture mutates (`piles.bystanders`,
`attachedBystanders`). **No new hashed `G` field.** A committed complete-game fixture
that plays Genetic Experimentation legitimately shifts that fixture's outcome hash
(it now captures); re-pin only such a fixture, honestly.

## Scope (In)

- `rules/heroKeywords.ts` — add `'kidnap-per-count'` to the `HeroKeyword` union AND
  the `HERO_KEYWORDS` canonical array (lockstep; drift pin 58 → 59).
- `hero/heroEffects.execute.ts` — new `heroEffectKidnapPerCount`; register in
  `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`; **keep out of** `NO_MAGNITUDE_KEYWORDS`
  (it carries a magnitude). The executor: resolve count (self-exclusive), compute
  `N = magnitude × ⌊count / perEach⌋`, loop N times capturing one bystander each to
  the first City villain / Mastermind fallback, supply-bounded.
- `setup/heroAbility.setup.ts` — a `kidnap-per-count` extraction step mirroring
  Step 2d (`/\[keyword:kidnap-per-count:([a-z][a-z-]*):(\d+)\]/g`, `isValidHeroCountSource`
  gate, record magnitude + countSource) + a builder branch emitting
  `{ type: 'kidnap-per-count', magnitude, countSource }`. No printed-icon suppression
  (there is no resource icon on this line).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — add the
  `^\[keyword:kidnap-per-count:[a-z][a-z-]*:[1-9]\d*\]$` alternative to
  `VALID_TOKEN_PATTERN` + the human-readable valid-forms text.
- Card-data marker for Genetic Experimentation via `hero-ability-markers.json` +
  regen of `data/cards/vill.json` and all derived feeds.
- `scripts/check-hero-count-markers.mjs` — recognize `kidnap-per-count:<class>-heroes-played-this-turn`
  in `markerPresentFor`, and **remove** the `vill/ultron/genetic-experimentation`
  entry from the `DEFERRED` allowlist (it is now marked); update its `.test.ts`.
- Tests: the new executor (count-scaled N; auto-target first City villain; Mastermind
  fallback when City empty; supply exhaustion; self-exclusive count via hc2/tech);
  the drift pins — `HERO_KEYWORDS` 58 → 59 in **both** `rules/heroKeywords.test.ts`
  and `rules/heroAbility.setup.test.ts`, and `HERO_EFFECT_HANDLERS` keys 42 → 43 in
  `hero/heroEffects.execute.test.ts`; the parse (marker → descriptor) in
  `setup/heroAbility.setup.test.ts`; the card end-to-end grant.

## Out of Scope

- Any new count source — `tech-heroes-played-this-turn` ships (WP-711).
- Any new capture primitive — `here-hold-this` machinery + `attachBystanderToVillain`
  ship.
- Interactive per-capture `PendingSeatChoice`, or Victory-Pile banking (Rationale 2).
- Any other Kidnap/count line and any non-tech class — this WP is Genetic
  Experimentation only (the sole remaining `check-hero-count-markers` deferral;
  Encephalo-Ray already shipped its `attack-per-count` marker in #2187).
- Any new hashed `G` field; any client/UIState/server surface.

## Files Expected to Change

See EC-751 §Files to Produce (authoritative allowlist). Primarily:
`packages/game-engine/src/rules/heroKeywords.ts` (union + array);
`packages/game-engine/src/hero/heroEffects.execute.ts` (+ `.test.ts`) — executor +
registration + handler-registry drift 42→43; `packages/game-engine/src/setup/heroAbility.setup.ts`
(+ `setup/heroAbility.setup.test.ts` for the parse) — parse step + builder branch;
the two `HERO_KEYWORDS` 58→59 drift pins in `packages/game-engine/src/rules/heroKeywords.test.ts`
and `packages/game-engine/src/rules/heroAbility.setup.test.ts`;
`scripts/convert-cards/apply-hero-ability-markers.mjs` — token grammar;
`scripts/convert-cards/inputs/hero-ability-markers.json` — one marker; regenerated
`data/cards/vill.json` + all derived feeds; `scripts/check-hero-count-markers.mjs`
(+ `.test.ts`) — recognize the marker + drop the deferral. No client, no new hashed
field, no new count source, no new capture primitive.

## Non-Negotiable Constraints

- `HeroKeyword` union + `HERO_KEYWORDS` array updated together; drift pin RUNTIME
  (59), and `HANDLED_KEYWORDS` ↔ `HERO_EFFECT_HANDLERS` parity kept.
- Executor pure-ish/total: reads `G`, mutates only capture zones via the existing
  helpers, never throws, no registry read, no `.reduce()` in the capture loop;
  unknown/absent count → 0 captures.
- Count is **self-exclusive** (thread `triggeringCardId`) via the shipped
  `tech-heroes-played-this-turn` resolver — no fresh class loop.
- Capture is **supply-bounded** (break on empty `G.piles.bystanders`) and
  **deterministic** (first City villain by index; Mastermind fallback) — no RNG, no
  interactive park.
- Marker authored via the generator + regen, never by editing `data/cards/`; all
  card-data derived CI feeds regenerated in the same commit.
- `check-hero-count-markers` recognizes `kidnap-per-count` and the Genetic
  Experimentation deferral is removed (no stale allowlist entry).

## Contract

- `HeroKeyword` gains `'kidnap-per-count'` (union + array; drift 59).
- `heroEffectKidnapPerCount(G, ctx, playerID, cardId, effect)` captures
  `N = (effect.magnitude ?? 0) × ⌊resolveCountSource(G, playerID, effect.countSource,
  cardId) / (effect.perEach ?? 1)⌋` Bystanders, each attached to the first City
  villain via `attachBystanderToCityVillain`, else `captureBystanderToMastermind`;
  the loop breaks when the Bystander supply is empty.
- Marker token: `[keyword:kidnap-per-count:tech-heroes-played-this-turn:1]` on
  `vill/ultron/genetic-experimentation` abilityIndex 0. Grammar admits
  `[keyword:kidnap-per-count:<source>:<n>]`.
- `check-hero-count-markers` treats `kidnap-per-count:<class>-heroes-played-this-turn`
  as a satisfying marker for a per-class count clause.

## Vision Alignment

- §1 Rules Authenticity — Genetic Experimentation now performs the printed
  count-scaled kidnap instead of nothing.
- §3 Player Trust & Fairness — deterministic, replay-faithful, supply-bounded;
  off-ranking (no scoring surface touched).

## Acceptance Criteria

- Genetic Experimentation played after k other Tech Ultron cards captures exactly k
  Bystanders (self-exclusive; k=0 → no capture), each attached to the first City
  villain, Mastermind fallback when the City holds none, and stops when the supply
  empties.
- The count honours hc2 dual-class / Size-Changing granted classes via the shipped
  resolver (no fresh loop).
- Drift: `HERO_KEYWORDS` asserts 59; `HANDLED_KEYWORDS` ↔ `HERO_EFFECT_HANDLERS`
  parity holds; union ↔ array parity holds.
- Marker parses to `{ type: 'kidnap-per-count', magnitude: 1, countSource:
  'tech-heroes-played-this-turn' }`.
- `check-hero-count-markers --check` green (Genetic Experimentation now marked, off
  the deferral list; `cards:count-markers:test` green).
- Engine suite green; `pnpm -r build` 0; `pnpm cards:check` reproducible; all
  card-data derived feeds regenerated; re-pin only a fixture that legitimately plays
  the card.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — executor (count-scaled N,
   auto-target, Mastermind fallback, supply exhaustion, self-exclusive), both drift
   pins, the parse, the card grant.
2. `pnpm --filter @legendary-arena/game-engine typecheck:tests` (D-24372,
   informational — fix any surfaced test error, never widen a type).
3. `pnpm -r build` exits 0.
4. `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check`
   + `effect-index:check` + `sim:runtime-observed:check` regenerated + green;
   `pnpm cards:count-markers:check` + `:test` green.
5. `git status` shows no unexpected state-hash fixture churn; re-pin only a
   complete-game fixture whose play legitimately changed, and say so.

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, the marker live +
all derived feeds regenerated, `cards:count-markers:check` green with Genetic
Experimentation off the deferral list, D-24537 Active, WORK_INDEX + EC_INDEX rows
flipped, roadmap mindmap node flipped, PR squash-merged. Ultron's Genetic
Experimentation captures one Bystander per other Tech card played this turn.

## Reserved Decision (lands at execution)

D-24537 — the `kidnap-per-count` count-scaled bystander-capture hero effect for
Ultron's Genetic Experimentation: a new `HeroKeyword` scaling `N = magnitude ×
⌊count / perEach⌋` over the shipped `tech-heroes-played-this-turn` source, capturing
via the shipped `here-hold-this` machinery (first City villain, Mastermind fallback),
auto-targeted/non-interactive, supply-bounded; a new
`[keyword:kidnap-per-count:<source>:<n>]` marker token; the Genetic Experimentation
marker backfilled and dropped from the `check-hero-count-markers` deferral. No new
count source, no new capture primitive, no new hashed field. See DECISIONS.md.

## Gate Verdicts (on record)

- **Pre-flight (01.4): READY TO EXECUTE.** All hard-deps, cited line numbers, the
  58-entry `HERO_KEYWORDS` baseline, the target card line, its sole
  `check-hero-count-markers` deferral, and the missing `kidnap-per-count` grammar
  all verified against HEAD. PS-1 fixed in-place: added
  `rules/heroKeywords.test.ts` (a second `HERO_KEYWORDS.length === 58` pin) to the
  allowlist (RS-1 handler count 42→43 and RS-2 split test bullets also applied) —
  allowlist addition, no scope change, no re-run required.
- **Copilot (01.7): RISK (documented, proceed).** Architecturally and
  deterministically sound; two wording fixes applied in-place — the
  `rules/heroAbility.setup.test.ts` pin carries an ordered `expectedKeywords`
  `deepStrictEqual` (not only a length assert), and the stale "other deferred vill
  line" phrasing was corrected to name Genetic Experimentation as the sole remaining
  deferral. The `perEach`-less grammar is a documented intentional scope limit.

## Lint Gate Self-Review (00.3)

Locked values (new keyword `kidnap-per-count`; drift 58→59 RUNTIME;
`N = magnitude × ⌊count/perEach⌋`; source `tech-heroes-played-this-turn`
self-exclusive; auto-target first City villain + Mastermind fallback; supply-bounded;
mag 1 marker) stated, not re-derived. Canonical-array change updates BOTH union and
array AND the `HANDLED_KEYWORDS`↔`HERO_EFFECT_HANDLERS` parity. Single layer (Game
Engine) + generated card data + two build/test-tooling scripts (the marker grammar +
the gap-scan gate); no layer inversion. Determinism: no new hashed field; capture
mutates existing zones via shipped helpers; re-pin only an actually-affected fixture.
Card data regenerated via the generator, never hand-edited; all derived CI feeds
regenerated in-commit. Tests specified per executor path + both drift pins + parse +
card grant + the gap-scan recognition. §21 API catalog: N/A (no HTTP/library
surface). §20 funding: N/A. §1: Files Expected to Change present; Context carried by
Goal + Assumes + Design Rationale. §17.2 Non-Goal proximity: no pay-to-win, no client
authority, determinism preserved. All applicable items satisfied or explicitly N/A.
