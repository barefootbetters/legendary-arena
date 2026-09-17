# LAGN Architecture Brief — Card Data, Validator, Resolver, Rulings

Design decisions from a brainstorming session. This is a **direction document**, not an
implementation spec.

> **⚠️ Reconciliation 2026-09-17 — read this first.** The body below is the original
> brainstorm and is now **historical**. Most of what it proposes has since shipped, and
> three of its framing claims are wrong. The section immediately below is the authoritative
> current state; the original text is preserved underneath for context, with `⚠️ Superseded`
> callouts at the claims that no longer hold. Verified against the codebase + the ewiki
> (`card-effect-system`, `lagn-v1`) on 2026-09-17.

---

## Reconciliation (2026-09-17) — what is actually built

Treat the original brief as historical. Nearly all five layers exist; the "next piece of
work" (the resolver) has been mature for months.

| # | Layer | Real status | Where |
|---|-------|-------------|-------|
| 1 | Card data + images | ✅ built — **but not "LAGN format"** | `data/cards/*.json` (registry format with inline effect markers); images on R2 |
| 2 | Schema | ✅ built — **Zod is authoritative, schema is *derived*** | `packages/lagn-spec/src/validator.ts` (`generateSchema()` via `zodToJsonSchema`), `schemas/lagn-v1.json` (CI drift-guarded) |
| 3 | Validator | ✅ **shipped & published** — Zod, not AJV | `@legendary-arena/lagn` on npm + public MIT repo `legendary-arena/lagn-spec`; `lagn validate` CLI; 80+ tests; all 3 tiers **incl. replay** |
| 4 | Resolver (verb→handler) | ✅ **heavily built** (the brief's "not yet built" is wrong) | `ImplementationMap` dispatch (WP-009B), held outside `G`: `HERO_EFFECT_HANDLERS` (`hero/heroEffects.execute.ts`), `EFFECT_NODE_HANDLERS`/`VALUE_EXPRESSION_EVALUATORS` (`hero/effectPrimitive.interpret.ts`), `VILLAIN_EFFECT_HANDLERS` (`villain/villainEffects.execute.ts`), `SCHEME_TWIST_RESOLVERS`, `mastermindHandlers.ts` |
| 5 | Handlers / engine | ✅ built | hero (60 keywords / ~30 live handlers + composable-primitive AST), villain (25 primitives), scheme (8 resolvers), per-mastermind strikes; hollow-effect + effect-trace diagnostics |
| 6 | Rulings (exec. corpus) | ⚠️ **realized differently — the one real gap** | No scenario→expected→why JSON corpus. Instead: coverage/index spine (`data/metadata/effect-implementation-index.json` ~1862 entries; hero/villain mechanic ledgers; `runtime-observed-hollows.json`) surfaced on the dashboard `/coverage` + `/debug/effects`. Edge-case rulings live as prose in `DECISIONS.md` + `wiki/card-effect-system.md` §Edge Cases + `// why:` comments + replay hash-oracle fixtures. |

**Three framing claims that are wrong:**

1. **"Card data lives in LAGN format" — no.** The card catalog is the **registry format**
   (`data/cards/*.json`); **LAGN is a match/loadout/result *notation*** (setup + thin
   card-catalog metadata + replay logs). The registry viewer consumes the *registry*;
   it only ingests LAGN as a shareable loadout via `?lagn=` links.
2. **"Schema is authored; validator uses AJV" — inverted.** The **Zod validator is the
   source of truth**; the JSON Schema is *derived* from it and CI-drift-guarded. AJV is a
   test-only dependency.
3. **"Resolver not yet built / replay provisional" — both shipped.** The resolver is a
   mature multi-map dispatch; the Tier-3 replay schema is fully implemented, tested
   (strictly-increasing `seq` refinement), and emitted by `apps/replay-producer`.

**LAGN versioning:** shipped through **1.5.0** (battle plan + report card) here, **1.6.0**
on `main` (final-blow, WP-698); readers accept every version back to 1.0.0, the writer
stamps one. Loadout sharing (WP-361/362/363) and the "gauntlet packs are not LAGN" boundary
are both settled — see `wiki/lagn-v1.md`.

**Image-in-LAGN question (from the same chat):** already answered in `wiki/lagn-v1.md` —
**rejected** (breaks the `?lagn=` URL transport, puts binaries in git); the goal is met by
**setup-time prefetch** (Option C) plus the immutable cache headers already applied to R2.

**The one thing still worth scoping:** the brief's layer-5 "rulings" vision — a single
**executable scenario→expected→why corpus** — is the piece that matches its original intent
and does *not* exist in that form. The analytical work is captured but **scattered**
(DECISIONS prose + wiki edge-cases + `// why:` + hash-oracle fixtures + coverage indices).
`wiki/card-effect-system.md` "Known gaps #4" flags the same thing. Everything else the brief
proposes is done.

---

## The layering

Five layers, from the bottom up. The line between layer 3 and layer 4 is the open/proprietary
boundary.

| # | Layer | Owns | Open source? |
|---|-------|------|--------------|
| 1 | **Card data + images** | The facts about each card; image URLs | Yes |
| 2 | **Schema** | Machine-readable definition of valid LAGN | Yes |
| 3 | **Validator** | Checks files against the schema and vocabulary | Yes |
| 4 | **Resolver** | Maps abstract effect verbs to engine handlers | No — Legendary Arena internal |
| 5 | **Game engine** | Handlers, game state, play | No — proprietary |

**Rulings** sit *alongside* layers 4–5, not above them. See below.

### Terminology note

- **LAGN** is the whole standard: prose, setup rules, replay semantics, report card, schema.
- **The schema** is the normative machine-readable artifact *inside* LAGN. Same repo, same
  publication. Casual usage treats them as interchangeable; keep them distinct in docs.

---

## 1. Card data & images (foundation)

> **⚠️ Superseded (2026-09-17):** "card data lives in LAGN format" is wrong — the catalog is
> the **registry format** (`data/cards/*.json`); LAGN is a separate loadout/replay notation.
> See the Reconciliation section above.

Already in place. Card data lives in LAGN format with URLs pointing at card images
(Cloudflare R2). The registry viewer already consumes LAGN — it is the de facto reference
implementation and proves the catalog side of the format works.

**No change needed here.** This layer is doing real work today.

---

## 2. Schema

Published as part of the LAGN spec repo (`legendary-arena/lagn-spec`) and hosted so the
`$schema` URL resolves.

**Key decision: LAGN stays declarative.** Cards describe *what they do* in abstract terms
("gain a wound", "reveal from the HQ"), **never** which engine function to call.

Rationale:
- Engine call references would tie the open standard to Legendary Arena's internals — anyone
  else implementing LAGN would inherit that architecture.
- Declarative keeps the card catalog portable. If a second engine is ever written (native web
  app, different runtime), only the resolver and handlers are rewritten. **Hundreds of cards
  carry across untouched.** This is the single strongest argument for the declarative choice.

### What the schema owns

- The **effect vocabulary**: the allowed verbs and their argument shapes.
- A **stable error code table**: each code, the rule it maps to, and a one-line canonical
  message. Any implementation reports the same code for the same violation.
- Optionally per-rule `description` / hint fields so the standard itself says what a valid
  value looks like.

### What the schema does *not* own

- Set membership (`core`, `dims`, `ff04`, etc.) belongs in the card catalog data, not in the
  error table. "Unknown verb" is the same violation regardless of set.
- Presentation: line numbers, colour, "did you mean" suggestions. That's the validator.

> Rule of thumb: **the schema says what is wrong; the validator says where and how to fix it.**

### Replay half is provisional

> **⚠️ Superseded (2026-09-17):** the replay tier is now fully schema'd, tested (strictly-
> increasing `seq` refinement), and emitted by `apps/replay-producer`. No longer provisional.

The setup and catalog portions of LAGN are exercised in production. The **replay logging
portion is specified but not implemented** — untested spec is usually wrong in small ways.

**Action:** build validation against catalog + setup first. Leave the replay schema marked
provisional until a replay viewer forces it to be made real.

---

## 3. Validator

### Current state — largely built

> **⚠️ Superseded (2026-09-17):** understated and partly wrong. It's **shipped & published**
> (`@legendary-arena/lagn` on npm + public MIT repo), **Zod not AJV** (ajv is test-only),
> **80+ tests not 20**, no `--summary` flag (binary is `lagn`), and the replay tier IS
> implemented. See the Reconciliation section above.

A previous session scaffolded `legendary-arena/lagn-spec` with:

- `schemas/lagn-v1.json` — the JSON Schema
- `src/index.js` — validator library (AJV + ajv-formats under the hood)
- `src/index.d.ts` — TypeScript type definitions
- `src/cli.js` — CLI tool (`lagn-validate <file>`, `--summary` flag)
- `examples/` — linked-mode and embedded-with-replay samples
- `test/validate.test.js` — 20 tests, passing
- `.github/workflows/ci.yml` — CI on Node 18/20/22
- MIT license, README, CHANGELOG, `package.json` as `@legendary-arena/lagn`

**Unverified:** whether this was actually pushed to GitHub and published to npm. Those were
left as manual to-dos. **Check before building on top of it.**

### Design intent

Two conceptual layers:

1. **Schema validation** — is the shape right, is every verb in the allowed vocabulary?
2. **Argument resolution check** — do the arguments make sense? (`reveal from the HQ` needs a
   count; `gain a wound` needs a target.)

Written in **TypeScript, compiled to Node**, shipped with type definitions so consumers get
autocomplete on LAGN structures.

**CLI matters.** Takes file paths or a glob, prints what failed and where, exits non-zero so
CI catches it. Keep error messages human-readable — card designers who aren't programmers
should be able to run it.

### Repo layout

Schema and validator are **siblings, not bundled**:

- Schema lives in the spec repo — it *is* part of the standard.
- Validator is tooling that consumes the schema; separate package.
- Someone should be able to read the spec and write their own validator in another language
  without pulling any JavaScript.

Pattern: **spec repo at the center, tooling repos around it**, each depending on the published
schema package. Validator, replay viewer, etc. Clean dependency direction, nothing circular.

### Wire it into the registry viewer

Once stable, have the registry viewer validate on load. Catches bad card data at authoring
time rather than mid-game.

### Open-source split

- Validator + schema: **open**. Nobody adopts a standard they can't verify against.
- Argument-resolution semantics: **split** — the half that's Marvel Legendary semantics is
  shared; the half that's Legendary Arena engine expectations stays private.

---

## 4. Resolver (proprietary plumbing)

> **⚠️ Superseded (2026-09-17):** this is the most out-of-date claim — the resolver has been
> **heavily built for months** as the `ImplementationMap` verb→handler dispatch (hero /
> villain / scheme / mastermind maps, held outside `G`). The design intent below (thin
> lookup, logging→dashboard, per-card dependency manifests) largely describes what shipped.
> See the Reconciliation section above.

Not yet built. **This is the next piece of work.**

### What it is

A thin lookup layer: **verb in, handler out.** It is the *only* place that knows about the
engine. Everything above it is declarative LAGN data; everything below is handlers.

Written in TypeScript — types let the compiler catch a handler whose signature doesn't match
the verb it claims to implement, which is exactly the class of bug that otherwise surfaces
mid-game.

### What it is not

- **Not the replay viewer.** The resolver runs at load time or when a card fires during live
  play. The replay viewer reads a finished LAGN log and walks through what already happened;
  outcomes are already recorded, nothing is resolved.
- **Not a dashboard feature.** The resolver belongs inside the game engine.

### Maintenance burden is low by design

The resolver only changes when a card introduces a **new verb**. Cards using existing effects
are pure data entry. Most new cards require no code. This is the payoff of the declarative
approach.

### Suggested first task: build the dictionary

Before implementing handlers, **read the entire existing card database and extract the distinct
verbs.** The vocabulary falls out of the data. Expect a few dozen verbs covering the bulk of
cards, plus a small long tail of genuine one-offs.

Then implement handlers incrementally as each card is wired up.

### Per-card dependency manifests

Each card (or hero/villain module) should **declare its engine dependencies explicitly** —
e.g. "this one touches wounds and the HQ".

Three payoffs:

1. **Grep-ability** — find every card that touches wounds when wound logic changes.
2. **Load-time validation** — if a card declares it touches the HQ but its handler reaches into
   player decks, that's caught immediately rather than mid-game.
3. **Isolated test cases** — mock only the declared dependencies, run the handler, assert the
   state change. No full game needed.

This is a **debugging boundary**, not a loading boundary. Everything still ships bundled.

### Logging → dashboard

Build resolver logging in from the start, not bolted on later. The resolver knows which handler
fired for which verb, so log: card → verb → handler → state before/after.

`dashboard.legendary-arena.com` should surface **the view over the resolver**, not the resolver
itself:

- Verb coverage — which verbs have handlers, which are still stubs
- Which cards are blocked on unimplemented handlers
- Validation failures across the catalog
- Effect traces, so a bug report is readable rather than archaeology

---

## 5. Rulings (the actual crown jewel)

### Why this matters

The architecture is reproducible. The card IP isn't owned. What **is** genuinely expensive to
reproduce is the accumulated analytical work:

- The **vocabulary itself** — deciding that these forty cards all express the same verb is the
  hard reading of Marvel Legendary's design, distilled.
- The **edge-case rulings** — "wound stack is empty", "HQ slot empty when refilling", "what
  happens when these two cards collide". Each one is a decision someone had to make.

Value is proportional to completeness. A dozen rulings is a gesture; several hundred covering
the messy interactions is a real moat. **The effort is the grind of capturing them as you
build, not the file format.**

### Format

**JSON or YAML — not Markdown, not TypeScript.**

- Markdown prose drifts from the handlers silently.
- TypeScript tangles rulings into the codebase and loses the ability to hand them over as a
  document.
- Structured data can be **executed**: write a test harness that reads each ruling and runs the
  scenario against the handlers. Rulings and code then cannot drift.

Each ruling entry: a **scenario**, the **expected outcome**, and **prose explaining why**.

Git history matters here — a ruling that changed is itself useful information.

### Where they sit

**Alongside the handlers, not above them.** Nothing calls rulings at runtime. They are a test
corpus — the specification the handlers are judged against.

### Public vs. private split

| Artifact | Visibility | Why |
|---|---|---|
| Verb list + argument shapes | **Public** | A validator can't check vocabulary it doesn't know |
| Edge-case rulings and analysis | **Private** | This is the work product with standalone value |

Same verb names, different depth.

**Naming:** avoid calling the private one "LAGN rulings" — that implies it's part of the
standard. Prefer something like **"effect rulings"** or **"arena rulings"** to keep the public
LAGN surface clearly separate.

### Companion: the effect vocabulary reference

Generate this **from the data** so it can't drift. Every verb gets four parts:

1. Plain-English definition
2. Arguments
3. Edge cases resolved
4. **The cards that use it** ← this is the proof the abstraction survived contact with the
   real catalog

---

## Suggested order of work

1. **Verify** the `lagn-spec` repo is actually pushed and published; confirm the CLI works.
2. **Extract the verb dictionary** from the full card database. Read-only, no handlers yet.
3. **Define the vocabulary** formally in the schema — verbs + argument shapes + error codes.
4. **Build the resolver** as a thin lookup, with logging built in.
5. **Implement handlers** incrementally, capturing a ruling for every edge case decided.
6. **Build the ruling test harness** early, so rulings are executable from ruling #1.
7. **Generate the vocabulary reference** from the data.
8. Replay viewer (own repo) when the replay schema needs to be made real.

---

## Explicitly out of scope / decided against

- ❌ Embedding engine call references in LAGN — rejected; tighter coupling for speed is not wanted.
- ❌ Resolver wired into the dashboard — dashboard shows the *view over* it only.
- ❌ Set membership in the error code table — that's catalog data.
- ❌ Rulings as Markdown — not testable.
- ❌ A deck builder repo — the registry viewer already covers this.
