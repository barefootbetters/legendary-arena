# WP-271 — Villain & Henchman Mechanic Ledger (Mechanic Coverage Beyond Heroes; Data-Production)

**Status:** Done — executed (see `WORK_INDEX.md` for the execution record; header flipped 2026-07-04 to match the status authority).
**Primary Layer:** Shared Tooling — a new repo-root generator script (`scripts/villain-mechanic-ledger.mjs`) plus the regenerated Lever-3 instruments (`docs/ai/coverage/villain-mechanic-ledger.{json,csv}`) and their CI freshness gate. Reads the engine + registry **dist** one-way (the same Layer Boundary import the hero ledger already uses); imports no engine/registry **source**, and the engine never imports the ledger.
**Dependencies:** the villain ability pipeline — **WP-185 / WP-186 / WP-189 / WP-202 / WP-214 ✅** (`buildVillainAbilityHooks` + `VILLAIN_EFFECT_KEYWORDS` + the `Ambush:`/`Fight:`/`Escape:` timing prefixes + the executor) and **WP-252 / D-24023 ✅** (the `VillainEffectDescriptor` / `VILLAIN_EFFECT_PRIMITIVES` parameterized vocabulary the parser resolves `[effect:X]` markers into); **WP-257 / D-24034 ✅** (`VillainAbilityHook.unresolvedMarkers` — the raw `[effect:X]` tokens the parser saw but could not resolve, the signal a marker is unsupported); the **hero mechanic ledger ✅** (the INFRA generator this mirrors — `scripts/hero-mechanic-ledger.mjs`, `ledger:heroes` / `:check`, `scripts/coverage/mechanic-provenance.json`); **WP-268 / D-24045 ✅** (the by-hook discipline: classify from the parser's *actual* resolution, never re-implement parsing in the tool); **WP-269 / D-24046 ✅** (the data-production-vs-consumption split that queued this WP, and the shared provenance map).
**Baseline:** `origin/main` @ `03a7f22a`.
**User-Visible Surface:** none — infrastructure. This WP produces the villain/henchman coverage **data substrate** (a generated ledger artifact + a CI freshness gate), exactly as the hero ledger originally shipped as an `INFRA:` generator before any dashboard surface consumed it. Per **D-24046**, surfacing it (widening the WP-269 `card-mechanics.json` feed to all card types; adding a card-type dimension to the dashboard `/coverage` page) is **consumption** work, deliberately split into follow-up WPs and out of scope here. Payoff named: the artifact gives operators a per-card worklist of which **villain/henchman** cards still do nothing in play, and is the substrate a later consumption WP surfaces on `/coverage` / the registry-viewer filter.

---

## Goal

After this session, a new deterministic repo-root generator `scripts/villain-mechanic-ledger.mjs` emits one row per **(villain or henchman card × mechanic)** to `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`, mirroring the hero mechanic ledger's shape and discipline. Each `[effect:X]` mechanic is classified **by-hook** — from the villain ability parser's *actual* resolution (via the engine dist's `buildVillainAbilityHooks`), not a re-implemented parse — into `executable` (the parser resolved it to a handled villain keyword/primitive), `unsupported` (an unresolved `[effect:X]` marker — a `parse-unrecognized` runtime hollow), or `unmarked` (the card has ability text but no `[effect:X]` token); `deferred` is carried in the status vocabulary for symmetry with the hero ledger but is expected empty (every recognized villain effect is executor-handled today — there is no parsed-but-deferred villain vocabulary). A `ledger:villains` / `ledger:villains:check` npm script pair and a CI freshness gate keep the committed artifact current, exactly as `ledger:heroes:check` does for heroes. **Mastermind and scheme card types are explicitly out of scope** — they have no ability-hook parser to read (see §Out of Scope).

## Assumes

- **`buildVillainAbilityHooks` is on `main` and importable from the engine dist** at `packages/game-engine/dist/setup/villainAbility.setup.js` (source: `packages/game-engine/src/setup/villainAbility.setup.ts`, exported at the `buildVillainAbilityHooks(registry, matchConfig): VillainAbilityHook[]` signature). It builds villain hooks (`collectVillainHookEntries`) and henchman hooks (`collectHenchmanHookEntries`) from registry card text, reading only `[effect:X]` markers and the `Ambush:`/`Fight:`/`Escape:`/`Overrun:` timing prefix — no NL inference. This is the villain analog of `buildHeroAbilityHooks`, which the hero ledger imports the same way.
- **The villain mechanic vocabulary is on `main` and importable** from `packages/game-engine/dist/rules/villainAbility.types.js`: `VILLAIN_EFFECT_KEYWORDS` (the 10 frozen legacy keywords, `gainWoundEachPlayer`…`captureHqHeroLowestCost`) and `VILLAIN_EFFECT_PRIMITIVES` (the 5 parameterized primitives `ko-hero` / `gain-wound` / `capture-hq-hero` / `hero-deck-top-to-escape` / `capture-bystander`). These are submodule exports (not in the dist barrel `index.js`), the same way the hero ledger imports `HERO_KEYWORDS` from `dist/rules/heroKeywords.js`.
- **`VillainAbilityHook` carries `keywords: VillainEffectKeyword[]`, `effects: VillainEffectDescriptor[]`, and the optional `unresolvedMarkers?: string[]`** (WP-257 / D-24034 — the raw `[effect:X]` tokens that resolved to neither a keyword nor a descriptor). A villain hook has **no** `resolvedMarkers` field and **no** composition markers — villains carry no parameterized-composition deferred variants, so by-hook classification reads "resolved (in `keywords`/`effects`) vs unresolved (in `unresolvedMarkers`)", not the hero ledger's `resolvedMarkers` set.
- **Every recognized villain effect is executor-handled.** `executeVillainAbilities` (`packages/game-engine/src/villain/villainEffects.execute.ts`) dispatches all 5 `VILLAIN_EFFECT_PRIMITIVES`; the 10 frozen legacy keywords each translate to one of those primitives (`LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR`). There is no villain analog of the hero `MVP_KEYWORDS` subset gate — recognition implies executability. (An unrecognized `[effect:X]` never becomes a keyword/descriptor; it lands in `unresolvedMarkers` and the executor records a `parse-unrecognized` hollow.)
- **The registry enumerates villain and henchman cards.** `createRegistryFromLocalFiles({ metadataDir, cardsDir })` (`packages/registry/dist/index.js`) is the same loader the hero ledger uses; `registry.listCards()` returns flat cards whose `cardType` is one of `hero | mastermind | villain | scheme` (`packages/registry/src/types/index.ts`). Henchman cards are part of the villain-deck composition (group-level abilities, classified `villain | henchman` at runtime via `G.villainDeckCardTypes`); the exact registry surface for enumerating every villain/henchman card + its ability text and for sourcing the `matchConfig` groups `buildVillainAbilityHooks` needs is **scaffold-confirmed at execution** (see §Scope (In) and the EC §Before Starting). Game.setup() already builds these hooks from registry data, so the enumeration is reachable.
- **The hero ledger generator is on `main`** at `scripts/hero-mechanic-ledger.mjs` (the INFRA template this mirrors: deterministic JSON+CSV, stable composite sort key, CRLF-normalized `--check`, `ProbeFailure` exit code 2, `schemaVersion` 1) and **the shared provenance map** is at `scripts/coverage/mechanic-provenance.json` (`{ schemaVersion, mechanics: { <name>: { wp, decision } } }`), keyed by mechanic name. Hero and villain mechanic names do not collide, so villain entries extend the same map.
- **Baseline green:** `origin/main` @ `03a7f22a`; `pnpm -r build`, `pnpm --filter @legendary-arena/game-engine test`, `pnpm sim:coverage --check`, `pnpm ledger:heroes:check`, `pnpm sim:runtime-observed:check` all pass on the base.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §"Layer Boundary (Authoritative)" + `.claude/rules/architecture.md` — the generator is **Shared Tooling**: it consumes the engine + registry **dist** one-way (build/test-time only), imports no engine/registry **source**, and no layer on the `Registry → Engine → Server` chain imports it. This is the same posture the hero ledger holds.
- `.claude/rules/code-style.md` + `docs/ai/REFERENCE/00.6-code-style.md` — human-style code; ESM-only `.mjs`; no `.reduce()` with branching; descriptive names; small JSDoc'd functions; `// why:` on non-obvious decisions; full file contents for every modified file.
- `scripts/hero-mechanic-ledger.mjs` — **the template.** Read it end to end: `normalizeMechanicToken`, `extractMechanics`, `statusForMechanic`, `handlerForMechanic`, `buildRow`, `buildLedger` (the `cardType === 'hero'` filter to invert), the stable sort key, `serializeJson`/`serializeCsv`, `readProvenance`, and the `--check` CRLF-normalized diff. The villain generator is its sibling.
- `packages/game-engine/src/rules/villainAbility.types.ts` — `VillainAbilityHook`, `VillainEffectKeyword` + `VILLAIN_EFFECT_KEYWORDS`, `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES`, `VillainAbilityTiming`, `unresolvedMarkers`.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — `buildVillainAbilityHooks`, `collectVillainHookEntries`, `collectHenchmanHookEntries`, `extractEffects` (the `[effect:X]` parser — the resolution the ledger reflects).
- `docs/ai/DECISIONS.md` — scan **D-24046** (the data-production-vs-consumption split that queued this WP and pins the hero-only feed scope), **D-24045** (the by-hook ledger discipline), **D-24023** (the villain descriptor vocabulary), **D-24034** (`unresolvedMarkers`). **D-24048 is reserved by this WP.**
- This WP touches no `docs/ai/REFERENCE/00.2-data-requirements.md` setup-payload field — it reads existing card markup and emits a coverage artifact — so `00.2` is not a required Context reference for a payload-field check; it is consulted only for canonical field-name spelling (`ext_id`, `cardType`).

---

## Session Context

The hero mechanic ledger (the INFRA generator landed at `659e1d0a`) emits a per-(hero × mechanic) coverage table read two ways: the authoring worklist (which cards still do nothing) and the debugging index (when a card misbehaves, which mechanic owns it and where the code lives). It is **hero-only** by a `card.cardType !== 'hero'` filter. WP-269 / D-24046 froze the downstream `card-mechanics.json` feed to `scope:"hero"` *because the ledger is hero-only*, and **explicitly queued WP-271 as the data-production extension** to the remaining card types — kept separate from the feed (WP-269) and the viewer surface (WP-270) per the data-production-vs-consumption split.

A pre-draft investigation of the non-hero ability landscape (2026-06-20) establishes the realistic shape of "beyond heroes":

- **Villain + henchman: a full ability-hook pipeline already exists** — `buildVillainAbilityHooks` parses `[effect:X]` markers into a `VillainAbilityHook` carrying `keywords` / `effects` / `unresolvedMarkers`, exactly parallel to `buildHeroAbilityHooks`. A villain/henchman mechanic ledger is buildable **today** by reading that parser's resolution, mirroring the hero ledger. This is WP-271's deliverable.
- **Mastermind + scheme: no ability-hook parser exists.** Masterminds and schemes store only a `gameText?: readonly string[]` snapshot; their effects are config-driven (hardcoded per-mastermind branches in `mastermindHandlers.ts`; `SCHEME_TWIST_CONFIGS` → resolver lookup in `schemeHandlers.ts`), never parsed from `[effect:X]` markers. Building a mechanic ledger for them would first require authoring parsers + effect vocabularies + executors analogous to the villain pipeline — foundational engine work, far larger than a tooling WP, and a different layer. **They are deferred to named follow-up WPs** (see §Out of Scope).

So WP-271 ships the villain (+ henchman) mechanic ledger — the half of "beyond heroes" the existing parser makes possible — and names the mastermind/scheme ledgers as parser-blocked follow-ups. This honest narrowing is the difference between a shippable single-layer tooling WP and a multi-WP engine effort mis-scoped as one packet.

### Villain mechanic vocabulary (baseline enumeration)

| Source | Tokens | Status the ledger assigns |
|---|---|---|
| `VILLAIN_EFFECT_KEYWORDS` (10 frozen legacy) | `gainWoundEachPlayer`, `gainWoundCurrentPlayer`, `koHeroCurrentPlayer`, `heroDeckTopToEscape`, `captureBystander`, `koHeroEachPlayer`, `koHeroEachPlayerMag2`, `captureHqHeroRightmost`, `captureHqHeroHighestCost`, `captureHqHeroLowestCost` | **executable** (each translates to a handled primitive) |
| `VILLAIN_EFFECT_PRIMITIVES` (5 parameterized) | `ko-hero`, `gain-wound`, `capture-hq-hero`, `hero-deck-top-to-escape`, `capture-bystander` | **executable** (all dispatched by the executor) |
| Unrecognized `[effect:X]` | any value the parser cannot resolve (lands in `unresolvedMarkers`) | **unsupported** (a `parse-unrecognized` runtime hollow) |
| No `[effect:X]` token | a villain/henchman card with ability text but no effect marker | **unmarked** (a DATA todo) |

The exact per-card flip counts (how many villain/henchman rows are executable vs unsupported vs unmarked) are **execution-measured** from the regenerated artifact; this table is the draft-time vocabulary baseline.

---

## The Classification Gate (by-hook, faithful to the parser)

A villain/henchman `[effect:X]` mechanic's status is read from the parser's **actual** resolution, never re-derived by a parallel parse in the tool (the WP-268 / D-24045 by-hook discipline):

1. The mechanic name is the normalized `[effect:X]` token (the legacy keyword name, or — for the parameterized form `[effect:<primitive>:<params>]` — the primitive segment; normalization mirrors the hero ledger's `normalizeMechanicToken`, with the exact rule scaffold-confirmed against `extractEffects`).
2. A token that the parser resolved into `hook.keywords` or `hook.effects` → **executable** (recognition implies executability for villains — every recognized effect is executor-handled; there is no `MVP_KEYWORDS`-style subset gate).
3. A token the parser saw but could not resolve → it appears in `hook.unresolvedMarkers` → **unsupported** (a `parse-unrecognized` runtime hollow — the honest signal the card does nothing).
4. A villain/henchman card with ability text but **no** `[effect:X]` token → a single **unmarked** row (a DATA todo), exactly as the hero ledger emits `(unmarked)`.
5. `deferred` remains in the status vocabulary for symmetry with the hero ledger, but is **expected empty** for villains today — there is no recognized-but-not-executed villain vocabulary (the hero ledger's `deferred` exists for `HERO_KEYWORDS` members outside `MVP_KEYWORDS`; villains have no such gap). If a future villain keyword is parsed but not yet executed, this bucket is where it lands.

Reading the parser's resolution (rather than re-checking the raw token against the vocab) is what keeps the ledger faithful to parameterized-marker param-validation: a malformed `[effect:ko-hero:bogus]` the parser rejects to `unresolvedMarkers` is correctly **unsupported**, not falsely executable from a naive primitive-segment match.

---

## Load-Bearing Invariant — the hero ledger is untouched

> This WP adds a **sibling** generator; it MUST NOT change `scripts/hero-mechanic-ledger.mjs`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, or the hero feed/coverage instruments. The shared `scripts/coverage/mechanic-provenance.json` is **extended additively** with villain mechanic entries (new keys only — hero keys byte-unchanged; no collision, hero and villain mechanic names are disjoint). The villain ledger is deterministic and byte-stable across runs (the same discipline as the hero ledger: stable composite sort key, fixed JSON key order, trailing newline, CRLF-normalized `--check`) so its freshness gate compares cleanly across machines.

---

## User-Visible Impact

**Surface: none — infrastructure.** This WP ships a generated coverage artifact (`villain-mechanic-ledger.{json,csv}`) and a CI freshness gate — there is nothing rendered on a live site to observe, exactly as the hero ledger shipped as an `INFRA:` generator before WP-259 built the dashboard `/coverage` surface that consumes it. Per **D-24046**, the user-visible surfacing of villain mechanics (widening the `card-mechanics.json` feed beyond `scope:"hero"`; adding a card-type dimension to `/coverage`) is **consumption** work split into follow-up WPs. The payoff this WP delivers is the **data substrate**: a per-(villain/henchman card × mechanic) worklist that (a) tells operators which villain/henchman cards still do nothing in play and where the handler lives, and (b) is the artifact a later consumption WP reads to surface villain mechanics on `/coverage` and the registry-viewer filter. Because the surface is `none — infrastructure`, the Definition of Done carries no D-24026 live-on-surface item; STATUS records "No user-observable change — infrastructure only."

---

## Non-Negotiable Constraints

**Engine-wide:** ESM-only `.mjs`, Node v22+ (the generator uses `node:fs`/`node:path`/`node:url` only); deterministic given the in-repo card data (no `Date.now()` / `Math.random()` / network / DB); **full file contents for every new or modified file — no diffs, no snippets, no "show only the changed section"**; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (no `.reduce()` with branching, no nested ternaries, no dynamic known-key access, descriptive names, small JSDoc'd functions, `// why:` on non-obvious decisions); named imports only, real file paths (no `import *`, no barrel re-export that hides where code lives).

**Packet-specific:**
- **Shared Tooling only.** The only production change is the new `scripts/villain-mechanic-ledger.mjs` + the additive `scripts/coverage/mechanic-provenance.json` villain entries + the `package.json` npm-script pair + the CI gate step. **No `packages/game-engine/**` change, no `packages/registry/**` change, no `apps/**` change, no `data/cards/**` change.** The villain parser, vocabulary, executor, and hollow detection already exist — the ledger only reads them.
- **By-hook classification, faithful to the parser.** Classify each `[effect:X]` mechanic from `buildVillainAbilityHooks`' actual resolution (`keywords`/`effects` → executable; `unresolvedMarkers` → unsupported), never from a re-implemented parse of the raw token. Do not duplicate the villain parse grammar in the tool.
- **Reuse the engine dist vocabulary.** Import `VILLAIN_EFFECT_KEYWORDS` / `VILLAIN_EFFECT_PRIMITIVES` (and `buildVillainAbilityHooks`) from the engine **dist**; never hardcode the vocabulary in the script (no duplicated source of truth — the hero ledger's discipline).
- **Hero ledger + hero instruments byte-unchanged.** `scripts/hero-mechanic-ledger.mjs`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `scripts/hero-effect-coverage.mjs` + its baseline, `scripts/runtime-observed-hollows.mjs` + its artifact, and `scripts/build-card-mechanics-metadata.mjs` + `data/metadata/card-mechanics.json` are all out of scope and unchanged.
- **Mastermind / scheme are out** (no parser — named follow-ups). The generator emits villain + henchman rows only; it MUST NOT invent a mastermind/scheme mechanic or shoehorn `gameText` into a ledger row.
- **Deterministic + byte-stable.** Stable composite sort key, fixed JSON key order, trailing newline, CRLF-normalized `--check` — the artifact regenerates byte-identical run to run, the freshness gate's contract.
- **`schemaVersion` 1; `cardType: "villain"`** in the JSON (the artifact spans villain + henchman cards; `cardType` names the ledger family, mirroring the hero ledger's `cardType: "hero"`). Each row carries an explicit per-row card-type field (`villain` | `henchman`) so the two are distinguishable within the one artifact — scaffold-confirmed against how the registry/`G.villainDeckCardTypes` distinguishes them.

---

## Scope (In)

### A) Generator — `scripts/villain-mechanic-ledger.mjs` (new)
- A deterministic repo-root ESM generator mirroring `scripts/hero-mechanic-ledger.mjs`: loads the registry via `createRegistryFromLocalFiles`, enumerates **villain + henchman** cards, builds each card's villain ability hooks via `buildVillainAbilityHooks` (the by-hook way), extracts `[effect:X]` mechanics, classifies each per §The Classification Gate, joins the shared provenance map, derives a handler-column location for executable mechanics (the villain executor module), and emits a per-(card × mechanic) ledger.
- Output: `docs/ai/coverage/villain-mechanic-ledger.json` (`{ schemaVersion: 1, cardType: "villain", summary: { totalRows, byStatus, distinctMechanics }, rows: [...] }`) + `.csv` (header `ext_id,card_name,set,card_type,mechanic,status,wp,decision,handler`). The CSV adds a `card_type` column (villain|henchman) the hero ledger lacks, because one artifact spans both; otherwise the column set mirrors the hero ledger.
- Modes mirror the hero ledger exactly: default regenerates the two files + prints a summary; `--check` regenerates in memory and CRLF-normalized-diffs against the committed files, exiting `1` if stale, `0` if current; a load/empty failure is a `ProbeFailure` (exit `2`).
- The exact registry-enumeration surface (how to list every villain/henchman card + source the `matchConfig` groups `buildVillainAbilityHooks` consumes) and the exact `[effect:X]` normalization are **scaffold-confirmed at execution** against `villainAbility.setup.ts` — the EC requires a scaffold run proving the generator produces a sane, byte-stable ledger before close.

### B) Provenance — `scripts/coverage/mechanic-provenance.json` (modified, additive)
- Add villain mechanic → `{ wp, decision }` entries (new keys only) so the ledger fills the `wp`/`decision` columns: the legacy keywords / primitives map to their authoring WPs/decisions (`WP-185`/`WP-186` D-18601/D-18602, `WP-189` D-18901, `WP-202` D-20201, `WP-214` D-21401, `WP-252` D-24023). Hero keys are byte-unchanged; entries left blank where provenance is genuinely unknown (honestly-blank, never guessed — the hero ledger's rule).

### C) npm scripts — `package.json` (modified)
- Add `ledger:villains` (`node scripts/villain-mechanic-ledger.mjs`) and `ledger:villains:check` (`node scripts/villain-mechanic-ledger.mjs --check`), mirroring `ledger:heroes` / `ledger:heroes:check`.

### D) CI gate — `.github/workflows/ci.yml` (modified)
- Add a `pnpm ledger:villains:check` step to the existing coverage job (the job that already runs `ledger:heroes:check` after `pnpm -r build`), so the committed villain ledger cannot drift. No new job; the gate is independent after build and runs alongside the hero gate.

### E) Generated artifacts
- `docs/ai/coverage/villain-mechanic-ledger.json` + `docs/ai/coverage/villain-mechanic-ledger.csv` — the regenerated ledger, committed so `--check` has a baseline.

---

## Out of Scope
- **Mastermind and scheme mechanic ledgers.** No ability-hook parser exists for these card types (only a `gameText` snapshot + config-driven handlers), so a mechanic ledger cannot read them without first authoring a parser + effect vocabulary + executor — foundational engine work in a different layer. Deferred to named follow-up WPs (a "mastermind ability parser + ledger" WP and a "scheme ability parser + ledger" WP), each blocked on that parser. This WP names them as out-of-scope follow-ups and does NOT stub them in the artifact.
- **The WP-269 feed scope-widening.** `scripts/build-card-mechanics-metadata.mjs` (`FEED_SCOPE = 'hero'`, the `cardType !== 'hero'` reject) and `CardMechanicsIndexSchema` (`scope: z.literal("hero")`, `packages/registry/src/schema.ts`) stay hero-only. Widening the feed to consume the villain ledger is **consumption** work (a separate WP) per D-24046's data-production-vs-consumption split.
- **The dashboard `/coverage` villain view.** No `apps/dashboard/**` change — adding a card-type filter/dimension and loading the villain ledger into the bundle is a separate consumption WP. The registry-viewer mechanic filter (WP-270) is already scope-transparent and needs no change regardless.
- **No engine / registry / data change.** The villain parser, `VILLAIN_EFFECT_KEYWORDS`/`VILLAIN_EFFECT_PRIMITIVES`, the executor, `unresolvedMarkers`, and all `data/cards/**` are unchanged — the ledger only reads them. No new effect keyword/primitive, no parser change, no `data/cards/**` re-marking.
- **No hero-ledger / hero-instrument change.** The hero ledger, hero coverage probe, runtime-observed sweep, and the hero feed are untouched (only the shared provenance map is extended additively with new villain keys).

---

## Files Expected to Change

### Implementation / generated artifacts
- `scripts/villain-mechanic-ledger.mjs` — **new** — the villain/henchman mechanic ledger generator (sibling of the hero ledger; by-hook classification via `buildVillainAbilityHooks`).
- `scripts/coverage/mechanic-provenance.json` — **modified** — additive villain mechanic `{ wp, decision }` entries (new keys only; hero keys byte-unchanged).
- `package.json` — **modified** — `ledger:villains` + `ledger:villains:check` scripts.
- `.github/workflows/ci.yml` — **modified** — `pnpm ledger:villains:check` step in the existing coverage job.
- `docs/ai/coverage/villain-mechanic-ledger.json` — **new (generated)** — the committed ledger JSON.
- `docs/ai/coverage/villain-mechanic-ledger.csv` — **new (generated)** — the committed ledger CSV.

### Governance (at close)
- `docs/ai/STATUS.md` — **updated** (villain/henchman mechanic ledger shipped; infrastructure only).
- `docs/ai/DECISIONS.md` — **updated** with **D-24048**.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-271 checked off.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-303 marked Done.
- `docs/05-ROADMAP-MINDMAP.md` — WP-271 node updated to ✅; `node scripts/roadmap-counts.mjs --check` passes.

**Explicit non-change:** `scripts/hero-mechanic-ledger.mjs`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `scripts/hero-effect-coverage.mjs` + baseline, `scripts/runtime-observed-hollows.mjs` + artifact, `scripts/build-card-mechanics-metadata.mjs`, `data/metadata/card-mechanics.json`, `packages/registry/src/schema.ts`, all of `packages/game-engine/**`, `packages/registry/**`, `apps/**`, and `data/cards/**` MUST be byte-unchanged.

No tracked file outside the two groups above may change.

**Execution-output constraint** (applies in the execution session, not an engine rule): when producing the new/modified files, provide **full file contents** — no diffs, snippets, or "changed section only".

---

## Acceptance Criteria

### A) The generator produces a faithful villain/henchman ledger
- [ ] `pnpm ledger:villains` writes `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` with `schemaVersion: 1`, `cardType: "villain"`, a `summary` (totalRows + byStatus + distinctMechanics), and one row per (villain/henchman card × mechanic), each row carrying `ext_id`, `card_name`, `set`, `card_type` (`villain`|`henchman`), `mechanic`, `status`, `wp`, `decision`, `handler`.
- [ ] Each `[effect:X]` mechanic is classified by-hook from `buildVillainAbilityHooks`' resolution: a resolved keyword/primitive → `executable`; an `unresolvedMarkers` token → `unsupported`; a villain/henchman card with ability text but no `[effect:X]` → one `(unmarked)` row.
- [ ] A spot-check: at least one known villain effect (e.g. a `koHeroCurrentPlayer` / `ko-hero` bearer) shows `status: executable` with the `handler` column pointing at the villain executor module; at least one `(unmarked)` villain/henchman row exists.

### B) Determinism + freshness gate
- [ ] `pnpm ledger:villains` run twice produces byte-identical JSON + CSV (stable sort key, fixed key order, trailing newline).
- [ ] `pnpm ledger:villains:check` exits `0` against the committed artifact and exits `1` after a deliberate edit to the committed file (then `0` again after regeneration).
- [ ] `.github/workflows/ci.yml` runs `pnpm ledger:villains:check` in the existing coverage job.

### C) Scope containment
- [ ] `git diff --name-only` shows only the 6 implementation/artifact files + the 5 governance files. `scripts/hero-mechanic-ledger.mjs`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, all `packages/game-engine/**`, `packages/registry/**`, `apps/**`, and `data/cards/**` are byte-unchanged (`git diff` empty for each).
- [ ] `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`, `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all still pass (the hero instruments are untouched; the shared provenance map's new keys do not affect hero output).
- [ ] The provenance map diff is additive only — hero mechanic entries are byte-unchanged; only new villain keys are added.

### D) Build + repo health
- [ ] `pnpm -r build` exits 0 (the generator reads the dist; the build must precede the run).
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-271 node present, status ✅).

---

## Verification Steps

```pwsh
pnpm -r build                                  # exits 0 — the generator imports the engine + registry dist
pnpm ledger:villains                           # writes villain-mechanic-ledger.{json,csv}; prints a status summary
pnpm ledger:villains                           # run again — byte-identical output (determinism)
pnpm ledger:villains:check                     # OK: current
pnpm ledger:heroes:check                       # OK — hero ledger untouched
pnpm sim:coverage --check                      # OK — hero coverage probe untouched
pnpm sim:runtime-observed:check                # OK — runtime sweep untouched
pnpm mechanics:metadata:check                  # OK — hero feed untouched (provenance new keys are villain-only)
git diff --name-only -- scripts/hero-mechanic-ledger.mjs docs/ai/coverage/hero-mechanic-ledger.json docs/ai/coverage/hero-mechanic-ledger.csv packages/game-engine/ packages/registry/ apps/ data/cards/   # empty
Select-String -Path "docs\ai\coverage\villain-mechanic-ledger.csv" -Pattern "executable" | Select-Object -First 1   # at least one executable villain row
node scripts/roadmap-counts.mjs --check        # passes
```

---

## Vision Alignment

**Vision clauses touched:** §10 / §10a (Registry & coverage tooling that reads card content), §1 / §2 (card data & content semantics — **read-only**).

- **No conflict:** this WP preserves all touched clauses. It is a read-only coverage instrument over already-committed `data/cards/**` markup; it changes no card data, no gameplay, no scoring, and ships no user-facing surface.
- **Non-Goal proximity check:** none of NG-1..7 are crossed — there is no monetization, no paid surface, no persuasive/competitive copy, no identity or leaderboard surface. The artifact is internal data-production tooling.
- **Determinism preservation:** the generator is deterministic (no `Date.now()` / `Math.random()` / I/O beyond reading the in-repo registry data + writing the artifact); it touches no engine RNG, no replay, no simulation, and no `finalStateHash` surface (it does not run the engine's gameplay loop — it reads setup-time parse output). Vision §22 determinism is unaffected. It advances Secondary Goal 10 (honest coverage of what mechanics exist and which execute), extending the hero ledger's worklist to villain/henchman cards.

---

## Funding Surface Gate

**N/A** — data-production tooling: no global-nav / registry-viewer / profile funding affordances, no tournament-funding-channel integration, and no user-visible "donate"/"support" copy. None of the §20.1 trigger surfaces are present; the conceptual mention of WP-269/D-24046 here is governance citation, not a funding surface.

## API Catalog

**N/A** — no `apps/server` HTTP endpoint is added/modified/removed and no `apps/server/src/**` `Library-only` catalog function is touched; this WP adds a repo-root generator script + a CI gate only. None of the §21.1 trigger surfaces are present.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved (PASS or justified N/A); Final Gate (38 conditions) clear.

- **§1 Structure:** PASS — `## Goal`, `## Assumes`, `## Context (Read First)`, `## Scope (In)`, `## Out of Scope`, `## Files Expected to Change`, `## Non-Negotiable Constraints`, `## Acceptance Criteria`, `## Verification Steps`, `## Definition of Done` all present + non-empty; `## Out of Scope` excludes ≥2 related things (mastermind/scheme ledgers; the WP-269 feed widening; the dashboard `/coverage` view; the hero instruments).
- **§2 Constraints:** PASS — Engine-wide block requires full file contents, forbids diffs/snippets, states ESM/Node v22+, references `00.6-code-style.md`; packet-specific constraints present; no body contradiction.
- **§3 Assumes:** PASS — lists each dependency + exact dist import paths/exports/shapes (`buildVillainAbilityHooks`, `VILLAIN_EFFECT_KEYWORDS`, `VILLAIN_EFFECT_PRIMITIVES`, `VillainAbilityHook.unresolvedMarkers`, `createRegistryFromLocalFiles`, the provenance map shape, the hero-ledger template); out-of-order execution cannot silently misbehave (base gates asserted; the enumeration risk is flagged as scaffold-confirmed, not assumed).
- **§4 Context:** PASS — specific docs/sections (ARCHITECTURE layer boundary, code-style, the hero-ledger template, `villainAbility.types.ts`/`villainAbility.setup.ts`, DECISIONS D-24046/45/23/34). Touches no `00.2` setup-payload field (reads existing markup), so `00.2` is not required for a payload check; canonical names (`ext_id`, `cardType`) are honored.
- **§5 Files:** PASS — every changed file listed + marked (new/modified/generated) + described, in two groups (6 implementation/artifact + 5 governance); explicit non-change list present; single layer (Shared Tooling); bounded (well under 8). No partial-output language; the full-file-contents requirement is labeled an execution-output constraint.
- **§6 Naming:** PASS — `ext_id` / `cardType` / `card_type` / `mechanic` / `status` match canonical + the hero-ledger column precedent; villain vocabulary names (`VILLAIN_EFFECT_KEYWORDS`, etc.) match the engine source; no abbreviations; no stray backticks.
- **§7 Dependencies:** PASS — no new npm deps; `node:fs`/`node:path`/`node:url` only; no forbidden packages.
- **§8 Architecture:** PASS — Shared Tooling consuming the engine + registry **dist** one-way (build/test-time), no engine/registry **source** import, no layer-chain package imports the script; the generator is a read-only diagnostic (no DB writes, no `DELETE`; not a seeder/migration); no `G`/`ctx` persistence.
- **§9 Windows / §10 Env / §11 Auth:** N/A — the script uses Node built-ins with `node:`-prefixed imports and no shell, no env vars, no auth surface; Verification Steps use `pwsh`-compatible `pnpm` + `Select-String`.
- **§12 Tests:** N/A — mirrors the hero ledger, which ships no `.test.ts`; correctness is gated by the deterministic `ledger:villains:check` CI freshness gate (regenerate-and-diff), not a unit test. (No `boardgame.io` import, no network/DB.)
- **§13 Verification:** PASS — exact `pnpm` + `node` + `Select-String` commands with expected output.
- **§14 Acceptance:** PASS — binary, observable, scope-aligned criteria (artifact shape, determinism, freshness gate, scope containment, build); no subjective items; aligned with the deliverables.
- **§15 Definition of Done:** PASS — includes STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + the scope-boundary check. **§15.1:** PASS — `**User-Visible Surface:** none — infrastructure` declared with the payoff named; `## User-Visible Impact` present; per the §15.1 infrastructure path the DoD requires the STATUS entry to state "No user-observable change — infrastructure only" (no live-on-surface item, correctly, because there is no surface).
- **§16 Code Style:** PASS — the generator mirrors the hero ledger's human-style shape (no premature abstraction — it reuses the established generator pattern; no `.reduce()` with branching; explicit `for...of`; descriptive names; small JSDoc'd functions; `// why:` on the dist imports, the by-hook classification, and the determinism sort); named imports only; full-sentence `ProbeFailure` messages.
- **§17 Vision:** TRIGGERED (card content semantics / coverage tooling — §1, §2, §10). `## Vision Alignment` present with clause numbers, a no-conflict assertion, an NG proximity check, and a determinism-preservation line.
- **§18 Prose-vs-Grep:** PASS — the `Select-String` verification targets the generated villain ledger CSV (`executable`), not this WP's prose; no forbidden-token enumeration adjacent to a literal grep.
- **§19 Bridge-vs-HEAD:** N/A — this WP is not a repo-state-summarizing artifact; the SPEC commit re-checks `HEAD` regardless.
- **§20 Funding Surface:** N/A with justification (`## Funding Surface Gate` above — data-production tooling; no funding affordances/copy/channels).
- **§21 API Catalog:** N/A with justification (`## API Catalog` above — no `apps/server` HTTP endpoint or `Library-only` function touched).

Verdict: **PASS** — all 21 sections resolved; Final Gate clear. Execution remains gated on the scaffold confirming the registry enumeration + `[effect:X]` normalization produce a faithful, byte-stable villain ledger, and on the hero instruments staying byte-unchanged.

## Pre-Flight & Copilot Verdicts

- **Pre-flight (`01.4`): READY TO EXECUTE (2026-06-20, baseline `03a7f22a`).** Class: **Infrastructure & Verification** (a generator with runtime logic that does not mutate `G`, does not wire into `game.ts`, consumes engine + registry dist APIs). Dependencies are on `main`: `buildVillainAbilityHooks` + `VILLAIN_EFFECT_KEYWORDS`/`VILLAIN_EFFECT_PRIMITIVES` (WP-185/186/189/202/214/252) and `unresolvedMarkers` (WP-257); the hero-ledger template + shared provenance map; the registry loader. Contract fidelity verified against source, not just WP text: `buildVillainAbilityHooks` signature + `collectVillainHookEntries`/`collectHenchmanHookEntries` (`villainAbility.setup.ts`); `VillainAbilityHook` carrying `keywords`/`effects`/`unresolvedMarkers` and **no** `resolvedMarkers`/composition markers (`villainAbility.types.ts`); every recognized villain effect executor-handled (no `MVP_KEYWORDS`-style gate) — so recognition ⇒ executable and the by-hook signal is resolved-vs-unresolved; the hero ledger's exact generator shape (`scripts/hero-mechanic-ledger.mjs`). Scope is a closed allowlist (single layer, Shared Tooling; engine/registry/apps/data out, with explicit non-changes; hero instruments byte-unchanged). **Empirical Scaffold (01.4 §Validation-Tightening): N/A as a validation-tightening WP** — nothing previously-accepted is newly-rejected (the generator adds a new artifact). BUT the WP carries one genuine execution-time **RS** (clarifying, non-blocking): **RS-1 — the registry enumeration of all villain/henchman cards + the `matchConfig` group surface `buildVillainAbilityHooks` consumes, and the exact `[effect:X]` normalization, are scaffold-confirmed at execution** (the EC §Before Starting mandates a scaffold run proving a sane, byte-stable ledger before close). The enumeration is reachable (Game.setup() already builds these hooks from registry data), so RS-1 is a "confirm the exact registry API" item, not a dependency blocker. Verdict READY.
- **Copilot (`01.7`): PASS (2026-06-20) — relevant modes walked; 0 BLOCK; disposition CONFIRM.** Boundary (#1/#16/#29 — Shared Tooling, dist-only one-way import, no engine/registry/app source edit, hero instruments byte-unchanged). Determinism (#2/#23 — no RNG/clock; deterministic byte-stable artifact; CRLF-normalized `--check`; the generator does not run the gameplay loop, so `finalStateHash` is untouched). Source-of-truth duplication (#27 — imports the villain vocab from the dist, never hardcodes it; by-hook reads the parser's resolution, never re-implements the parse). Silent-vs-loud (#22 — unresolved `[effect:X]` markers stay loud `unsupported`/`parse-unrecognized`; `(unmarked)` is the honest DATA-todo signal). Scope creep (#12/#30 — closed allowlist + `git diff` checks + the explicit mastermind/scheme + feed-widening + dashboard deferrals). Provenance map shared-file safety (additive villain keys only; hero keys byte-unchanged; freshness gate `mechanics:metadata:check` unaffected). The review-surfaced risk (the villain enumeration / normalization mechanism) is captured as pre-flight RS-1 and routed to the execution scaffold. **Disposition: CONFIRM** — pre-flight READY stands; session-prompt generation authorized.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0; `pnpm ledger:villains` runs and is byte-stable across two runs; `pnpm ledger:villains:check` exits 0
- [ ] Hero instruments untouched: `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`, `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all pass; `git diff` empty for `scripts/hero-mechanic-ledger.mjs`, the hero ledger artifacts, `packages/game-engine/**`, `packages/registry/**`, `apps/**`, `data/cards/**`
- [ ] `scripts/coverage/mechanic-provenance.json` diff is additive only (hero keys byte-unchanged; new villain keys only)
- [ ] No files outside `## Files Expected to Change` modified
- [ ] `docs/ai/STATUS.md` updated — villain/henchman mechanic ledger shipped; the entry states **"No user-observable change — infrastructure only"** (per §15.1 infrastructure path; surface = `none — infrastructure`, so no D-24026 live-verification item applies)
- [ ] `docs/ai/DECISIONS.md` updated — **D-24048** (villain/henchman mechanic ledger: by-hook classification reusing `buildVillainAbilityHooks`; mastermind/scheme deferred pending an ability parser; data-production only per the D-24046 split)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-271 checked off
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-303 marked Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-271 node updated to ✅; `node scripts/roadmap-counts.mjs --check` passes
