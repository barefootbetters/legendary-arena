# Design: Master Strike Migration — Hand-Coded Dispatcher to Composable Descriptors

> **Status:** DRAFT — PROPOSAL (not yet ratified; no `DECISIONS.md` entry
> allocated). Subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.
> **Extends** `docs/ai/DESIGN-EFFECT-MODEL-DECISION.md` (D-24029, composable
> primitives) and `docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md` by applying the
> same model to the **Mastermind Master Strike** subsystem — the last effect
> path still shaped like one closed keyword per mechanic.
> **Date:** 2026-07-30

---

## 1. The question

Every effect subsystem in the engine has moved (or is moving) from
"one hand-written branch per card behaviour" toward **data-authored effects
over a closed, deterministic vocabulary** — except one. Mastermind Master
Strikes are still resolved by a hardcoded `if/else` chain in
[`mastermindHandlers.ts`](../../packages/game-engine/src/rules/mastermindHandlers.ts),
one bespoke `resolve<Name>Strike` function per mastermind.

Should Master Strikes stay hand-coded per mastermind, or become **strike
descriptors** — data the engine interprets — so a new set's masterminds
usually ship as data, the same way hero and villain effects now do?

This becomes urgent for the same reason D-24029 did: a large content wave is
coming. Each new set brings ~4 masterminds, each with printed strike text.
Under the current model each one is an engine WP: a new `mastermindId`
constant, a new resolver, new tests, coverage regeneration. That is the
per-mechanic grind `DESIGN-EFFECT-AUTHORING-SCALE.md` diagnosed, still live in
this one subsystem.

---

## 2. Where we actually are

The Master Strike handler is the registered `onMastermindStrikeRevealed`
handler in the rule pipeline's `ImplementationMap` (see
[Rule Execution Pipeline](../../wiki/rule-execution-pipeline.md)). Its shape
today:

- **Generic bookkeeping runs for every strike, regardless of text:**
  `captureBystanderOntoMastermind` (D-15401), the `masterStrikeCount`
  increment + queued message (`buildGenericStrikeEffects`), and the terminal
  `mastermindStrikeResolved` notable-event emission (WP-200).
- **Per-mastermind text is an `if/else` chain** on `G.selection.mastermindId`
  against hardcoded ext_id constants (`MASTERMIND_MAGNETO`,
  `MASTERMINDS_RED_SKULL`, four `MASTERMIND_CO2E_*`). Seven masterminds have
  implemented text; every other mastermind matches no branch and gets generic
  bookkeeping only — its printed strike is inert data.
- **Card-specific resolvers mutate `G` directly** (`resolveMagnetoStrike`,
  `resolveRedSkullStrike`, `resolveDoctorDoomStrike`, `resolveLokiStrike`,
  `resolveCo2eMagnetoStrike`, `resolveDoctorOctopusStrike`).

Crucially, the resolvers **already share a latent composition vocabulary**:

- `selectLowestCostHero(gameState, hand, traitKind, traitSlug)` — the reusable
  selector: pick the lowest-cost Hero in a hand, optionally gated on
  `'any' | 'team' | 'heroClass'`, ties broken by hand index. Red Skull is
  documented in-code as "the ungated case of the shared selector."
- `discardCardFromHand`, `gainWoundToDiscard`, `isNonGreyHero`,
  `captureBystanderOntoMastermind` — shared per-player primitives.
- Every resolver iterates `Object.keys(playerZones).sort()` — the same
  **each-player, sorted-id** control loop.

So the subsystem is already most of the way to a small primitive set; it just
expresses that set as hand-written TypeScript per mastermind instead of as
data.

### The recorded fidelity gaps (current state, not new)

- **No reveal-and-choose interaction.** Strikes that print "each player reveals
  X **or** does Y" resolve via a **deterministic auto-pick** (D-24188 for Red
  Skull; D-24192 for the co2e set): the engine takes the player-optimal branch
  itself. Core Magneto always takes its punitive branch; Doctor Octopus always
  takes the discard branch when eligible.
- **Loki's Hypno-Thrall branch is deliberately unimplemented** (needs a new
  mastermind-adjacent zone; a player with no Strength Hero takes a logged
  no-op). Client work is tracked separately (WP-399).

These gaps are properties of the *interaction model*, not of the dispatch
mechanism — see §7.

---

## 3. Why this is the last "model A" holdout

Using the model spectrum from
[DESIGN-EFFECT-MODEL-DECISION.md §4](DESIGN-EFFECT-MODEL-DECISION.md):

| Subsystem | Model today | Reference |
|---|---|---|
| Hero abilities | **C** — composable primitives (Berserk/Empowered) + parameterized keywords | D-24029 / D-24030 |
| Villain / henchman abilities | **B→C** — parameterized `VillainEffectDescriptor` (7 primitives) | WP-252 / D-24023 |
| **Mastermind Master Strikes** | **A** — one hand-coded branch per mastermind | this doc |

A hand-coded branch per mastermind *is* "one closed keyword per mechanic,"
just at the granularity of a whole mastermind. It carries exactly the costs
D-24029 §4 assigns to model A: an engine WP every time, and no path for a new
mastermind to ship as data. The villain subsystem already made this exact move
(ten frozen keywords → parameterized descriptors); masterminds are the same
migration, not yet done.

*(Scheme-twist handlers are a parallel model-A candidate but are out of scope
here; this doc is Master Strikes only.)*

---

## 4. The hard constraint

Determinism, replay, and fixture stability (Vision Primary Goal 3) bound the
solution, exactly as in D-24029 §3. Two specifics for Master Strikes:

- **Auto-pick determinism must be preserved byte-for-byte.** The current
  resolvers produce specific KO / discard / wound outcomes, specific
  `G.messages` log lines, and specific `mastermindStrikeResolved` notable
  events. Complete-game fixtures and the replay state-hash pin these. A
  descriptor migration must reproduce the **same** selections and the **same**
  narrative surface, or it is a behaviour change, not a refactor.
- **The multi-player interaction is the genuinely hard part.** D-24029 §10
  already flagged this: *"Composable primitives make firing an effect trivial;
  how effects interact is where engine complexity legitimately lives."* A
  strike's "each player chooses" is harder than a hero's pending choice because
  it is *every* player, not just the current one. The auto-pick is the current
  answer to that hard problem; a real reveal-and-choose is a separable, later
  primitive (§7, Track B).

---

## 5. Proposal

**Adopt composable strike descriptors as the target model for Master Strikes —
the explicit continuation of D-24029 into this subsystem.** A mastermind's
Master Strike becomes **data** (a descriptor authored from its printed text via
a marker path), interpreted by a closed, drift-tested primitive set. New
masterminds ship as data unless they introduce a genuinely new primitive.

The migration splits into two **separable tracks** that must not be coupled:

- **Track A — descriptor migration (the refactor).** Replace the `if/else`
  chain + bespoke resolvers with strike descriptors over primitives.
  Auto-pick semantics are preserved exactly; no player-facing behaviour
  changes. This is the bulk of the value and carries the determinism risk.
- **Track B — the reveal-and-choose interaction model (net-new capability).**
  A multi-player pending-choice primitive that replaces auto-pick with a real
  player decision. This is the genuinely-hard, genuinely-new work; it is
  **deferred and must not block Track A.** Until it lands, descriptors keep
  declaring the auto-pick resolution strategy the resolvers use today.

---

## 6. Anatomy of a strike as a composition

The seven implemented strikes decompose cleanly into a small vocabulary. This
is the evidence that model C fits — the corpus already exhibits the primitives.

| Mastermind | Composition (informal) |
|---|---|
| Red Skull | `for-each-player`: select lowest-cost Hero (`any`) → `ko-card` |
| co2e Magneto | `for-each-player`: select lowest-cost Hero (`team:x-men`) → `move-card` hand→discard; **else** `gain-wound` |
| co2e Loki | `for-each-player`: select lowest-cost Hero (`hc:strength`) → `move-card` hand→discard; **else** no-op *(Hypno-Thrall deferred)* |
| core Magneto | `for-each-player`: discard-down-to-N (N=4) *(punitive branch; reveal-or-discard auto-picked)* |
| co2e Doctor Doom | `for-each-player`: if hand ≥ Omens → discard `count` lowest-cost Heroes; **else** `gain-wound`; where `count = read-counter(masterStrikeCount)+1` |
| co2e Doctor Octopus | `for-each-player`: select lowest-cost Hero (`team:spider-friends`) → `move-card`; **else** reveal-top-N (N=8) → partition non-grey Heroes → discard them, return rest shuffled |
| *(generic, all)* | `capture-bystander-onto-mastermind`; `modify-counter masterStrikeCount +1`; emit `mastermindStrikeResolved` |

The recurring pieces: a **`for-each-player`** combinator, a **hero selector**
(lowest-cost, optional trait gate), and actions **`move-card`**, **`ko-card`**,
**`gain-wound`**, **`discard-to-count`**, plus a **`reveal-partition`** and a
**counter-read value expression** and a **conditional/choice** ("or" branches).

---

## 7. The two tracks in detail

### Track A — descriptor migration (do first)

1. **A marker/authoring path for strike text**, mirroring the villain
   `[effect:...]` overlay (`apply-effect-markers.mjs`) — a curated map plus an
   idempotent overlay script that attaches a strike descriptor to each
   mastermind's printed strike line, loud-failing on an unknown primitive.
2. **A strike descriptor interpreted at the `onMastermindStrikeRevealed`
   handler**, replacing the `if/else` chain. The generic bookkeeping and the
   terminal emission stay exactly where they are; only the per-mastermind text
   becomes descriptor-driven.
3. **Auto-pick stays the resolution strategy.** A descriptor whose printed text
   is "reveal or choose" declares `resolution: auto-pick` and reproduces the
   current player-optimal selection (`selectLowestCostHero` becomes the
   selector primitive's implementation). No behaviour change.

### Track B — the reveal-and-choose interaction model (defer)

The one genuinely new capability. A strike choice is a **multi-player**
pending-choice: each player independently reveals-or-chooses. The engine has
per-player pending mechanics for the *current* player (hero `PendingHeroChoice`;
villain `resolveKoHeroChoice`) but no *all-players* choice gate. Building it is
its own design problem (turn-flow suspension across players, bot defaults,
timeout/auto-resolve, replay of each player's decision) and deserves its own
design doc when scoped. Until then, `resolution: auto-pick` is the default and
the recorded fidelity gap is unchanged.

Keeping these tracks separate is the core of the proposal: **the refactor
(Track A) delivers the anti-fragmentation value now; the hard interaction work
(Track B) is not on its critical path.**

---

## 8. What stays closed, what becomes data

The same shift D-24029 §7 made for heroes:

```
Before:  closed set = the masterminds with a resolver   (grows one branch per mastermind)
After:   closed set = the strike primitives + resolution strategies   (small, slow-growing)
```

> **Strike primitive registry:** closed, versioned, deterministic, drift-tested,
> decision-ceremonied.
> **Mastermind space:** open, data-authored, coverage-ledgered — a new
> mastermind whose strike composes existing primitives ships as data.

The "is this a new primitive or a composition of existing primitives?" test
(D-24029 §8) governs every future mastermind.

---

## 9. New vs. reused primitives (inventory)

The migration is not free: masterminds legitimately introduce primitives the
current hero AST
([`effectPrimitive.types.ts`](../../packages/game-engine/src/rules/effectPrimitive.types.ts))
does not have. This is the D-24029-anticipated growth of the primitive
registry, and it is where the ceremony rightly lands.

| Primitive | Status | Note |
|---|---|---|
| `sequence`, `move-card`, `gain-resource`, `card-printed-stat` | **exists** (hero AST) | reused directly |
| `for-each-player` (owner/combinator) | **net-new** | hero AST is `current-player`-only (`EFFECT_OWNER_KINDS`); "each player" is the first genuinely-new mastermind primitive |
| hero-in-hand **selector** (lowest-cost, trait-gated) | **net-new** | the D-24029 §6 "Selector" category, not yet built; `selectLowestCostHero` is its ready-made implementation |
| `ko-card` action | **net-new to the AST** | exists as a villain descriptor primitive (`ko-hero`) and as `koCard`; needs an AST node or a shared action surface |
| `gain-wound` action | **net-new to the AST** | exists villain-side (`gain-wound`) + `gainWound` helper |
| `read-counter` value expression | **net-new** | Doctor Doom's Omen count = `masterStrikeCount + 1` |
| `conditional` / `choice` combinator | **net-new** | the "or" branches; also the seam Track B later fills |
| `reveal-partition` | **net-new** | Doctor Octopus's reveal-8-and-partition |

This inventory surfaces a **design fork worth deciding explicitly at
ratification:**

- **(a) Extend the hero primitive AST into the one shared effect language** —
  masterminds, heroes, and (eventually) villains interpret the same registry.
  Closest to D-24029's "one primitive registry" vision; higher up-front cost;
  the interpreter must generalize beyond `current-player`.
- **(b) A mastermind-specific descriptor set** mirroring the villain approach
  (`VillainEffectDescriptor`) — faster, lower blast radius, but a third parallel
  effect vocabulary that later has to converge.

This doc **leans (a)** on the D-24029 principle that the engine should know one
closed set of primitives, while acknowledging (b) as the lower-risk first step
the villain precedent validates. The proving WP should pick one and record it.

---

## 10. Migration strategy (phased)

1. **Bootstrap + first proving mastermind.** Stand up the descriptor path and
   port the simplest fully-faithful strike: **Red Skull** (ungated selector →
   `ko-card`, no "or" branch). Its rows stay `executable`; fixtures and the
   replay hash are unchanged. This front-loads the infrastructure (as Berserk
   did for heroes, D-24029 §9).
2. **Second proving mastermind — exercise the gate + fallback.** Port
   **co2e Magneto** (trait-gated selector → `move-card`; else `gain-wound`) to
   prove the vocabulary generalizes past the ungated case.
3. **Port the remaining implemented strikes** (core Magneto, Loki, Doctor Doom,
   Doctor Octopus) one WP at a time, each preserving its exact auto-pick
   outcome and log surface. The `reveal-partition` and `read-counter`
   primitives land with the strikes that need them.
4. **New masterminds ship as data** once their strikes compose existing
   primitives. The `/coverage`-style worklist tracks which mastermind strikes
   are `executable` vs. inert.
5. **Track B (reveal-and-choose) is scoped separately**, later, on its own
   design doc.

Each phase is a normal set-sized unit of work, not a per-mastermind grind — the
whole point of the migration.

---

## 11. Counter-pressure (the honest case against)

- **Only seven strikes exist today.** The code standard is "duplicate first,
  abstract on the third copy." Seven near-identical resolvers already clear that
  bar — but if the incoming sets were *not* coming, the shared helpers
  (`selectLowestCostHero` et al.) might be abstraction enough. What tips it is
  the same thing that tipped Berserk (D-24029 §10): the content wave is known,
  not speculative — every future set adds masterminds.
- **A third effect vocabulary is a real cost.** If the migration takes fork
  (b), the engine carries hero primitives, villain descriptors, *and* mastermind
  descriptors — three languages to converge later. Fork (a) avoids that but is
  more up-front work. Either way this is a genuine trade, not a free win.
- **Auto-pick semantics are load-bearing and subtle.** The resolvers encode
  specific tabletop-optimal choices, `?? 0`-cost handling for S.H.I.E.L.D.
  starters, first-index tie-breaks, and empty-supply no-ops. The selector
  primitive must reproduce all of it byte-for-byte or fixtures break. The
  refactor's risk is entirely here.
- **Interaction is still deferred.** This proposal does **not** close the
  reveal-and-choose fidelity gap; it makes the dispatch data-driven and isolates
  that gap behind an explicit resolution strategy. Anyone hoping this fixes
  Magneto's core strike should read Track B: it does not, yet.

---

## 12. Invariants to preserve

- **Replay / fixture stability:** identical KO / discard / wound selections,
  identical `G.messages` lines, identical `notableEvents`
  (`mastermindStrikeResolved`) and state-hash for every existing scenario.
- **Generic bookkeeping order:** bystander capture (D-15401) → per-mastermind
  text → terminal emission → return `buildGenericStrikeEffects()`. Unchanged.
- **`moves never throw`; no `.reduce()` in effect application;** all randomness
  via the pipeline-provided `Shuffle` (Doctor Octopus's return-shuffle),
  matching `.claude/rules/*`.
- **Recorded fidelity gaps stay recorded** (Loki Hypno-Thrall; auto-pick) — the
  migration must not silently "improve" them into an unfaithful improvisation.

---

## 13. Ratification requirements

This proposal becomes a decision when a `DECISIONS.md` D-entry (number allocated
via `docs/ai/NUMBER-LEDGER.md` at promotion time — not reserved by this draft)
records:

1. Master Strikes adopt **composable strike descriptors**, extending D-24029 to
   this subsystem — not hand-coded per mastermind, not arbitrary scripting.
2. The **strike primitive registry stays closed, versioned, drift-tested**; the
   **mastermind space is open**, data-authored, coverage-ledgered.
3. The **fork in §9** (shared primitive AST vs. mastermind-specific descriptors)
   is decided and recorded.
4. **Track A (descriptor migration) and Track B (reveal-and-choose interaction)
   are separate**; Track B does not gate Track A.
5. **Auto-pick remains the default resolution strategy** until Track B lands;
   the proving WP preserves every existing outcome and log line.
6. Red Skull is the first proving case; co2e Magneto the second.

Promotion also needs: a proving WP + EC in `WORK_INDEX.md`, and — if fork (a)
adds a primitive or a new cross-module surface — the corresponding
`ARCHITECTURE.md` / `.claude/rules/*` touchpoints per the import-rule
obligations.

---

## 14. Acceptance criteria for the proving WP

The first (Red Skull) proving WP passes only if:

- Red Skull's strike executes as a **descriptor over primitives**, with **no
  per-mastermind `if` branch** for it in the handler.
- **No arbitrary per-card code** is introduced — only descriptor data
  interpreted by closed primitives.
- The new primitives (`for-each-player`, the hero-in-hand selector, `ko-card`)
  are **reusable** and live in a drift-protected registry with a `DECISIONS`
  entry.
- Existing Red Skull fixtures, the replay state-hash, and the
  `mastermindStrikeResolved` narrative are **byte-identical** to pre-migration.
- co2e Magneto's strike is representable in the same vocabulary (trait gate +
  wound fallback) — proven by porting it next, not by leaving it hand-coded.

---

## 15. Recommendation (one line)

> **Migrate Master Strikes onto composable strike descriptors — the D-24029
> model applied to the last hand-coded effect subsystem — in two decoupled
> tracks: the descriptor refactor first (preserving auto-pick byte-for-byte),
> the multi-player reveal-and-choose interaction later. New masterminds then
> ship as data, not as another engine branch.**

---

## References

- [`packages/game-engine/src/rules/mastermindHandlers.ts`](../../packages/game-engine/src/rules/mastermindHandlers.ts)
  — the current dispatcher and the seven resolvers
- [`packages/game-engine/src/rules/villainAbility.types.ts`](../../packages/game-engine/src/rules/villainAbility.types.ts)
  — the villain descriptor precedent (WP-252 / D-24023)
- [`packages/game-engine/src/rules/effectPrimitive.types.ts`](../../packages/game-engine/src/rules/effectPrimitive.types.ts)
  — the hero primitive AST this would extend or mirror (D-24030)
- [`docs/ai/DESIGN-EFFECT-MODEL-DECISION.md`](DESIGN-EFFECT-MODEL-DECISION.md)
  (D-24029) and [`DESIGN-EFFECT-AUTHORING-SCALE.md`](DESIGN-EFFECT-AUTHORING-SCALE.md)
  — the model this extends
- [Rule Execution Pipeline](../../wiki/rule-execution-pipeline.md),
  [Card Effect System](../../wiki/card-effect-system.md) — the pipeline and the
  subsystem overview
- Decisions: D-15401 (bystander capture), D-24188 (Red Skull auto-pick),
  D-24192 / D-24193 (co2e strike auto-pick / base-face selection); Work Packets:
  WP-386 (Red Skull), WP-388 (co2e strike texts), WP-397 (Doctor Octopus
  reveal-eight), WP-399 (Loki Hypno-Thrall client)
