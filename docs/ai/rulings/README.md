# Effect Rulings Corpus

A private, **executable** record of card-effect edge-case decisions. Each entry pairs a
**scenario**, the **expected outcome**, and prose explaining **why**, stored as
structured JSON in [`effect-rulings.json`](effect-rulings.json) and run by a `node:test`
harness against the **real engine handlers** — so a ruling can never silently drift from
the code it describes.

- **Harness:** `packages/game-engine/src/rules/effectRulings.test.ts`
- **Validator + closed vocabulary:** `packages/game-engine/src/rules/effectRulings.validate.ts`
- **Governing decision:** D-24524 (WP-704 / EC-741)
- **Design page:** `wiki/effect-rulings.md`

This directory is **docs-only** — nothing reads it at runtime. It is a test corpus: the
specification the handlers are judged against, executed in the standard engine suite. It
is called **"effect rulings"**, never "LAGN rulings" (the public LAGN surface is the verb
list + argument shapes only); nothing here belongs in `packages/lagn-spec`.

## Entry shape

```json
{
  "id": "reveal-or-wound-match-in-play-spared",
  "mechanic": "reveal-or-wound",
  "decision": "D-24281",
  "scenario": { "action": "<closed action verb>", "setup": { "...": "per-action fields" } },
  "expected": { "kind": "<closed expectation verb>", "...": "the comparable value(s)" },
  "why": "Non-empty prose citing the decision's actual clause."
}
```

- `id` — unique, kebab-case. The validator rejects a duplicate or a non-kebab id.
- `mechanic` — the effect under test (free-form label).
- `decision` — optional, but every seed ruling cites the `D-` that settled it
  (`D-NNNNN`).
- `scenario.action` — a member of the **closed** `RULING_SCENARIO_ACTIONS` union; each
  maps to one harness runner that builds a minimal `G` and fires one real handler.
- `expected.kind` — a member of the **closed** `RULING_EXPECTATION_KINDS` union; each
  maps to one strict-equality assertion on handler output.
- `why` — **mandatory and non-empty.** A ruling without rationale is a fixture, not a
  ruling; the validator rejects an empty `why`.

### Current scenario actions

| action | fires | used for |
|---|---|---|
| `fire-villain-effect` | `executeVillainAbilities` with a single injected hook | reveal-or-wound, ko-wounds-current-hand-and-discard, the Melter ko-cullable park, capture-hq-hero, hero-deck-top-to-escape, capture-bystander, give-hq-hero-by-trait-to-current, give-hq-hero-each-player, swap-two-city-villains, ko-heroes-current-count-by-trait, capture-bystanders-plus-per-hq-hero-by-trait |
| `resolve-melter-ko` | `resolveMelterKoChoice` move | the Melter KO/keep resolve |
| `resolve-optional-ko-reward` | `resolveOptionalKoReward` move | optional-ko-reward (incl. the in-play source) |
| `query-card-has-class` | `cardHasClassWhenPlayed` pure query | dual-class hero membership |
| `fire-hero-effect` | `executeSingleEffect` (hero-effect executor) | hero keyword grants (attack/recruit/draw/rescue/ko), ko-wound-reward, investigate, recruit-as-attack, smash, reveal-top-dispose |
| `fire-rule-hook` | `executeRuleHooks` + `applyRuleEffects` for one trigger | scheme-twist / mastermind-strike pipeline (counters + messages) |
| `resolve-scry-ko` | `resolveScryKoChoice` move | the Doombot scry-KO pick |
| `resolve-ko-hero` | `resolveKoHeroChoice` move | the KO-a-Hero pick |
| `resolve-discard-to-play` | `resolveDiscardToPlay` move | the discard-to-play cost payment |
| `resolve-smash` | `resolveSmashDiscard` move | the Smash discard-for-attack choice (discard / decline) |
| `resolve-reveal-top-dispose` | `resolveRevealTopDispose` move | the reveal-top discard-or-keep choice (discard / top) |

### Current expectation kinds

| kind | asserts | comparable fields |
|---|---|---|
| `zone-cards-equal` | a player's zone equals an exact card list | `player`, `zone`, `cards` |
| `ko-pile-equal` | `G.ko` equals an exact card list | `cards` |
| `pending-queue-length` | a pending queue has an exact length (`melter` / `optional-ko-reward` / `scry-ko` / `ko-hero` / `give-hq-hero` / `smash` / `reveal-top-dispose`) | `queue`, `length` |
| `boolean-result` | the query's boolean return | `value` |
| `turn-economy-value` | a `G.turnEconomy` field equals an exact amount | `economyField`, `amount` |
| `counter-value` | a `G.counters` key equals an exact count (absent = 0) | `counter`, `count` |
| `hand-size-override` | a player's `G.handSizeOverrides` next-hand size equals a value | `player`, `size` |
| `villain-attached-heroes` | a villain's captured-hero list (`G.villainAttachedHeroes[id]`) equals an exact card list | `villainCardId`, `cards` |
| `escaped-pile-equal` | `G.escapedPile` equals an exact card list | `cards` |
| `attached-bystanders-equal` | a card's attached-bystander list (`G.attachedBystanders[id]`) equals an exact card list | `villainCardId`, `cards` |
| `city-equal` | the City row (`G.city`) equals an exact occupant list | `cards` |
| `turn-economy-flag` | a named boolean `G.turnEconomy` flag (absent = false) equals a boolean | `economyFlag`, `value` |

## How to add a ruling

1. **Find or add the action.** If an existing `RULING_SCENARIO_ACTIONS` member already
   fires the handler you need, reuse it — write only a new corpus entry. Most new
   rulings are corpus-only.
2. **If the mechanic is genuinely new,** add exactly one member to
   `RULING_SCENARIO_ACTIONS` (and/or `RULING_EXPECTATION_KINDS`), its runner in
   `SCENARIO_RUNNERS` (and/or its checker in `EXPECTATION_CHECKERS` **and** its perturber
   in `PERTURBERS`), and the ruling that uses it — **together, in one change.** The
   runtime drift pins fail if the union, the canonical array, and the harness map fall
   out of lockstep.
3. **Author the assertion on handler OUTPUT.** The per-ruling non-vacuity self-test
   perturbs your `expected` and requires that ruling to then fail — this proves your
   assertion is a live strict-equality check, not a constant-true / always-pass fixture.
   It does **not** by itself prove the asserted value came from the handler: a
   **non-mutation** assertion (a zone left unchanged, an empty KO pile — a "spared"
   ruling) still passes the guard even against a handler that did nothing. So (a) design
   every non-mutation assertion so a regression of the behavior it guards would flip it
   (e.g. Ymir's spared in-play Wound would be KO'd by a scope regression), and (b) pair it
   with a **positive sibling** ruling (same mechanic / decision) that asserts the handler
   produced a change. Every "spared" seed ruling in this corpus has such a sibling.
4. **Write a real `why`** citing the decision's actual clause.
5. Run `pnpm --filter @legendary-arena/game-engine test` — the new ruling executes as a
   `node:test` case, and the non-vacuity guard confirms it is live.

## The closed vocabulary grows one primitive at a time

There is deliberately **no general scenario DSL.** The scenario and expectation verbs
are small, closed, runtime-drift-pinned unions — like every other closed set in the
engine (the `VillainEffectPrimitive` discipline, D-24029). A new ruling that needs a new
verb adds **one** member plus its harness mapping plus the ruling, together — never a
speculative universal language up front. This keeps every ruling executable: an unmapped
verb is a hard failure, never an `it.skip` or an always-pass fixture.

The seed count target (≥ 8) is **subordinate to vocabulary minimalism**: never add a verb
solely to reach a count. If the members the seeds genuinely need cannot express eight
rulings, ship fewer and list the rest as deferred. Filling the corpus is the ongoing
grind — value grows with the rulings, not the verbs.
