# WP-292 — Villain Defeat-Requirement Gate ("You can't defeat X unless you have a [class/team] Hero")

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine` — setup parser, per-card state, fight precondition) + a surgical card-data marker overlay (offline tooling, upstream of Registry)
**Depends on:** WP-185 ✅ (villain ability marker pipeline `apply-effect-markers.mjs` + `villainCardInstanceExtIds` fan-out), WP-179 ✅ (`G.cardTraits[id]` carries `heroClass` **and** `team`), WP-191 ✅ (villain hooks keyed by copy-indexed instance ext_id)
**EC:** EC-324
**Decisions:** D-24076
**User-Visible Surface:** play.legendary-arena.com (Blob / Venom / Zombie Venom can no longer be defeated unless the current player holds a qualifying Hero — in hand or in play)

---

## Goal

Implement the printed villain **defeat-requirement** restriction: *"You can't defeat &lt;Villain&gt; unless you
have a [class/team] Hero."* After this WP, fighting **Blob** (requires an `x-men`-team Hero), **Venom**, or
**Zombie Venom** (each requires a `covert`-class Hero) is **blocked** unless the current player has at least one
qualifying Hero card in their **hand or in-play** zone at fight time. The restriction is carried by a new
structured card-data marker `[require-to-defeat:<kind>:<value>]`, parsed at setup into an immutable per-card
table, and enforced as a silent-return precondition in the `fightVillain` move — exactly the contract used by the
existing Guard-block and attack-cost gates. The mechanic is a fight **precondition** (checked before the fight
resolves), architecturally distinct from the existing `onFight` / `onAmbush` / `onEscape` *consequence* hooks.

---

## Assumes

- **The restriction is enforced at fight time; "have" = hand or in play.** The printed Legendary wording for
  these cards is *"You can't defeat &lt;Villain&gt; unless you have a [Class/Team] Hero,"* adjudicated as a Hero
  the current player holds **in their hand or in their play area** this turn (operator decision, 2026-06-29;
  recorded in D-24076). Discard-pile and deck Heroes do **not** satisfy the gate.
- **`G.cardTraits[id]` carries both `heroClass` and `team`** (`state/cardTraits.types.ts`:
  `CardTraitEntry { heroClass: string | null; team: string | null }`), built once at setup from each card's `hc`
  field and its parent hero's `team`, normalized via `normalizeTraitSlug` (`setup/buildCardTraits.ts:189-215`),
  **read-only at runtime**. The ownership check reads only this table + the player's zones — **no new ownership
  data is needed.**
- **The two player zones the gate scans both exist** (`state/zones.types.ts`): `hand` (line 62) and `inPlay`
  (line 66). Both hold `CardExtId` strings only; both are resolvable via `G.cardTraits`.
- **The 3 affected cards and their exact identities** (verified against `data/cards/`):
  - Blob — `core` set, group `brotherhood`, slug `blob`, **2 copies**, requires `[team:x-men]`.
  - Venom — `core` set, group `spider-foes`, slug `venom`, **1 copy**, requires `[hc:covert]`.
  - Zombie Venom — `ssw1` set, group `deadlands-the`, slug `zombie-venom`, **1 copy**, requires `[hc:covert]`.
  - **`cvwr` "Venom" is a different card** (a Size-Changing card, no defeat restriction) and MUST NOT be marked.
- **`x-men` is a real team (42 Heroes incl. Cyclops, Wolverine, Storm) and `covert` is a real hero class** in the
  corpus, so the gate is satisfiable. A loadout with no qualifying Hero is a legal, intentionally-hard state.
- **The marker is appended, not regenerated.** `data/cards/*.json` is generated; the marker is applied by a new
  idempotent surgical overlay (`apply-defeat-requirement-markers.mjs`) modelled on `apply-effect-markers.mjs`
  (WP-185) — a clean-diff text append, re-runnable after any future full regeneration. No pipeline regen.
- **No existing engine test fights these 3 villains** (full-corpus grep, 2026-06-29): Venom appears only in
  reveal / escape-hook tests, never fought; Blob / Zombie Venom are never fought. The gate is data-keyed by the
  3 instance ext_ids, so it is provably **additive** to the existing 1687-test suite (scaffold result below).

---

## Context

**Read first** (specific, before touching a file):
- `.claude/rules/architecture.md` §"Move & Phase Rules" (the Move Validation Contract: validate → gate → mutate → void; moves never throw) and §"Layer Boundary".
- `packages/game-engine/src/moves/fightVillain.ts` — the existing Guard-block + attack-cost silent-return gates this mechanic mirrors.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — the marker-extraction + `villainCardInstanceExtIds` fan-out pattern the new builder mirrors (the existing `onFight`/`onAmbush`/`onEscape` parser ignores non-timing lines, so the requirement needs its own builder).
- `packages/game-engine/src/state/cardTraits.types.ts` + `setup/buildCardTraits.ts` — the `heroClass` + `team` source the ownership check reads.
- `scripts/convert-cards/apply-effect-markers.mjs` — the idempotent surgical-overlay precedent for the new data-marker script.
- `docs/ai/DECISIONS.md` — scan for D-24076 (this WP) + the villain-marker decisions (WP-185/186 lineage).

**Why now.** An operator field report (diagnostics `gitSha b108dc4`, match `FC6toc2rQQG`, 2026-06-29) defeated Blob
with an all-Avengers/Guardians board and **no** X-Men Hero. The villain-mechanic ledger confirms Blob is
`(unmarked)`: the ability text exists in card data but is cosmetic — neither the card data nor the engine carries
any defeat-requirement, so the fight resolves unconditionally. This is an **unimplemented mechanic class**, not a
regression: every existing villain effect is a *post-defeat consequence* fired on a timing hook
(`VILLAIN_EFFECT_PRIMITIVES`); there is no fight-**precondition** primitive anywhere in the engine.

**Why one WP (engine + a surgical data overlay), not a paired split.** The WP-185/WP-190 precedent split engine
mechanics from bulk data-marker curation, but that curation spanned dozens of cards. Here the data side is a
**3-line surgical overlay** authored alongside the grammar that gives it meaning; splitting 3 cards into a second
WP + PR is the over-decomposition `feedback_wp_design_patterns` warns against. No import-layer boundary is crossed
(the overlay is offline tooling upstream of Registry; the engine consumes generated data — neither imports the
other). ~14 files, comparable to WP-290 (13) / WP-285 (18). Drafted against `origin/main` @ `03f1d604`.
Supersession check (2026-06-29): no other WP/EC/PR covers a villain defeat-requirement / fight-precondition; the
existing `fight`-slug WPs (WP-016 fight/recruit, WP-185 fight effects, WP-242/243 KO-hero-choice) are all
consequence hooks, not preconditions.

---

## Scope (In)

- **New marker grammar.** `[require-to-defeat:<kind>:<value>]` where `<kind>` ∈ `{ team, hc }` and `<value>` is a
  team slug (`x-men`) or hero-class slug (`covert`). `team` → requirement kind `'team'`; `hc` → `'hero-class'`.
  The marker is appended to each card's existing restriction line (the pre-existing inline `[team:x-men]` /
  `[hc:covert]` display text is left intact — the parser acts only on `[require-to-defeat:...]`).
- **New requirement type + drift array.** In `rules/villainAbility.types.ts`: `VillainDefeatRequirement =
  { kind: VillainDefeatRequirementKind; value: string }` with closed union `VillainDefeatRequirementKind =
  'team' | 'hero-class'` and its canonical drift array `VILLAIN_DEFEAT_REQUIREMENT_KINDS` (asserted bidirectional
  by the existing `villainAbility.types.test.ts`).
- **Parse at setup.** New `setup/villainDefeatRequirement.setup.ts`: scan the selected villain groups' ability
  lines (any line, regardless of timing prefix) for one `[require-to-defeat:<kind>:<value>]` marker, normalize the
  value via `normalizeTraitSlug`, and fan one entry out per copy-indexed instance ext_id via the shared
  `villainCardInstanceExtIds` emitter. Unknown `<kind>`, malformed marker, or empty value → ignored (no entry, no
  throw). A card with no marker → no entry.
- **New immutable G field.** `G.villainDefeatRequirements?: Record<CardExtId, VillainDefeatRequirement>`, built in
  `setup/buildInitialGameState.ts`. **Omitted entirely when empty** (no marked villain in the match) to keep
  legacy game states and `finalStateHash` byte-identical for matches without these villains.
- **New ownership/gate helper.** New `moves/villainDefeatRequirement.logic.ts`, two pure functions:
  `getDefeatRequirement(G, cardId): VillainDefeatRequirement | null` and
  `playerMeetsDefeatRequirement(G, playerId, requirement): boolean` — the latter scans the player's `hand` ∪
  `inPlay` ext_ids and returns true iff any card's `G.cardTraits[id].team === value` (kind `team`) or
  `heroClass === value` (kind `hero-class`). `for...of`, no `.reduce()`, no mutation; reads only zones + cardTraits.
- **The gate in `fightVillain`.** After the attack-cost check and before the stage gate (grouped with the
  Guard-block / cost preconditions — the "can you fight this villain at all" cluster): if `getDefeatRequirement`
  returns a requirement and `playerMeetsDefeatRequirement` is false, `return` silently (no `G` mutation, no
  message, no event), exactly like the Guard-block gate above it.
- **The 3-card data overlay.** New `scripts/convert-cards/apply-defeat-requirement-markers.mjs` (idempotent
  surgical append, `--propose` dry-run, loud-fail on unknown set/group/card or a line that matches zero/many) +
  its curated input `scripts/convert-cards/inputs/villain-defeat-requirements.json`. Run once to append the marker
  to the Blob / Venom / Zombie Venom restriction lines in `data/cards/core.json` + `data/cards/ssw1.json`.
- **Tests** for each: type drift, parser (each kind, malformed/empty, per-copy fan-out, cvwr-Venom-not-marked),
  the helper (hand-hit, in-play-hit, discard-only miss, no-hero miss, team vs class), the `fightVillain` gate
  (blocked with no hero, allowed with a qualifying hero in hand and in play, unmarked villain unaffected), and the
  overlay's idempotence.

## Out of Scope

- **Mastermind / henchman / scheme defeat-requirements.** No printed Mastermind or henchman in the corpus carries
  a defeat-requirement of this form; `fightMastermind` is untouched. A future card needing one extends the same
  grammar — deferred.
- **Villain-ledger recognition of the new marker.** The coverage ledger (`pnpm ledger:villains`) is a reporting
  tool; whether it flips Blob from `(unmarked)` to recognized depends on the ledger script's marker vocabulary,
  which is a separate reporting surface. Out of scope here; named follow-up. The mechanic is correct regardless of
  the ledger's display.
- **The inline `[team:x-men]` / `[hc:covert]` display tokens** already in the card text — left untouched; the new
  `[require-to-defeat:...]` marker is the sole parsed source. No card-text rewrite.
- **Multi-requirement villains / OR-of-classes** (e.g. "a Covert OR Ranged Hero"). The grammar carries exactly one
  `{kind,value}`; no corpus card needs more. Deferred.
- **No change** to `G.cardTraits` (immutable), to `fightMastermind`, to the `onFight`/`onAmbush`/`onEscape` hook
  pipeline, to economy/attack resolution, or to any UIState projection (the block is a silent no-op; surfacing a
  "you need an X-Men Hero" client hint is a deferred UX follow-up).

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — add `VillainDefeatRequirement`, `VillainDefeatRequirementKind`, `VILLAIN_DEFEAT_REQUIREMENT_KINDS`
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — bidirectional drift assertion for the new kinds array
- `packages/game-engine/src/types.ts` — **modified** — add `villainDefeatRequirements?: Record<CardExtId, VillainDefeatRequirement>` G field
- `packages/game-engine/src/setup/villainDefeatRequirement.setup.ts` — **new** — `buildVillainDefeatRequirements(registry, matchConfig)`
- `packages/game-engine/src/setup/villainDefeatRequirement.setup.test.ts` — **new** — parser tests (each kind, malformed/empty, per-copy fan-out, cvwr-not-marked)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — build the field; omit when empty
- `packages/game-engine/src/moves/villainDefeatRequirement.logic.ts` — **new** — `getDefeatRequirement` + `playerMeetsDefeatRequirement`
- `packages/game-engine/src/moves/villainDefeatRequirement.logic.test.ts` — **new** — helper tests (hand/in-play hit, discard miss, no-hero miss, team vs class)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — the silent-return precondition gate
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — gate tests (blocked / allowed-hand / allowed-inplay / unmarked-unaffected)
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs` — **new** — idempotent surgical overlay (apply + `--propose`)
- `scripts/convert-cards/inputs/villain-defeat-requirements.json` — **new** — curated 3-card marker map
- `data/cards/core.json` — **modified** — append `[require-to-defeat:team:x-men]` to Blob + `[require-to-defeat:hc:covert]` to Venom (surgical)
- `data/cards/ssw1.json` — **modified** — append `[require-to-defeat:hc:covert]` to Zombie Venom (surgical)

**Note on file count:** ~14 files, one cohesive mechanic (grammar → data overlay → parse → store → gate). No
import-layer crossing (offline data tooling vs engine consumer). Comparable to WP-290 (13).

---

## Contract

- **D-24076:** `G.villainDefeatRequirements[cardId]` is the per-villain-instance restriction `{ kind, value }`
  that the current player must satisfy **to defeat** that villain. A villain in the City is defeatable by player
  `P` iff it carries **no** requirement, **or** `P` has at least one card in `hand ∪ inPlay` whose
  `G.cardTraits[id].team === value` (kind `'team'`) or `G.cardTraits[id].heroClass === value` (kind
  `'hero-class'`). "Have" is **hand or in play only** — discard and deck do not count. The table is built
  immutably at setup and **omitted entirely when empty**.
- The two helper functions in `moves/villainDefeatRequirement.logic.ts` are the **single** authority for this
  test; `fightVillain` MUST derive the gate decision from them and never re-implement zone/trait matching inline.
- The helper is **pure**: a deterministic function of exactly the player's `hand`/`inPlay` zones +
  `G.cardTraits` + `G.villainDefeatRequirements`; no mutation, no caching, no RNG, recomputed each call.
- The gate is a **silent-return precondition** in `fightVillain` — no throw, no `G` mutation, no message, no
  `notableEvent` on block (the Move Validation Contract; identical posture to the Guard-block gate).
- `[require-to-defeat:<kind>:<value>]` is the **only** parsed source of a requirement; `<kind>` ∈ `{team, hc}`
  maps to `{'team','hero-class'}`. The marker is data, authored by the overlay; the engine never infers a
  requirement from free text.

---

## Acceptance Criteria

- **AC-1 (type drift):** `VILLAIN_DEFEAT_REQUIREMENT_KINDS` equals `['team', 'hero-class']` and the existing
  `villainAbility.types.test.ts` asserts it bidirectionally against `VillainDefeatRequirementKind`.
- **AC-2 (parse each kind):** `[require-to-defeat:team:x-men]` on Blob's line yields
  `{ kind: 'team', value: 'x-men' }` for **both** copy instance ext_ids; `[require-to-defeat:hc:covert]` yields
  `{ kind: 'hero-class', value: 'covert' }` for Venom and Zombie Venom.
- **AC-3 (parser robustness):** an unknown kind (`[require-to-defeat:foo:bar]`), a malformed marker, or an empty
  value produces **no** entry and **no** throw; a card with no marker produces no entry.
- **AC-4 (helper — hand):** `playerMeetsDefeatRequirement` returns **true** when a qualifying Hero (matching team
  or class) is in the player's **hand**; **AC-5 (helper — in play):** true when in **inPlay**; false when the only
  qualifying Hero is in **discard** or **deck**; false when the player holds no qualifying Hero.
- **AC-6 (helper — team vs class):** a `team:x-men` requirement is satisfied by an X-Men Hero regardless of class;
  a `hero-class:covert` requirement is satisfied by any Covert-class card regardless of team.
- **AC-7 (gate blocks):** `fightVillain` on a requirement-bearing villain with no qualifying Hero in hand/inPlay
  leaves `G` **unchanged** — villain still in the City, victory pile unchanged, no message, no `notableEvent`,
  attack unspent.
- **AC-8 (gate allows):** the same fight **succeeds** when a qualifying Hero is in hand **or** in play (both
  paths tested); a villain **without** a requirement is fought exactly as before (regression-free).
- **AC-9 (data overlay):** after running `apply-defeat-requirement-markers.mjs`, Blob's line in `core.json` carries
  `[require-to-defeat:team:x-men]`, Venom carries `[require-to-defeat:hc:covert]`, Zombie Venom in `ssw1.json`
  carries `[require-to-defeat:hc:covert]`, and **cvwr Venom is unmarked**; a second run is a zero-line diff
  (idempotent); the script loud-fails on an unknown set/group/card.
- **AC-10 (build/test/determinism):** `pnpm --filter @legendary-arena/game-engine build` 0; `test` green
  (≥ 1687 baseline + new cases); `tsc --noEmit` 0; `pnpm -r build` 0. `villainDefeatRequirements` is omitted from
  G when empty. `sim:runtime-observed:check`: any `finalStateHash` shift is acceptable **only** if attributable to
  a bot's fight against Blob/Venom/Zombie-Venom now being blocked for lack of a qualifying Hero; any other cause
  is a FAIL — STOP and investigate, do not re-pin. If gate-attributable, re-pin and record as EXPECTED.

---

## Verification Steps

```pwsh
node scripts/convert-cards/apply-defeat-requirement-markers.mjs --propose   # review the 3 matched lines
node scripts/convert-cards/apply-defeat-requirement-markers.mjs             # apply (surgical, idempotent)
node scripts/convert-cards/apply-defeat-requirement-markers.mjs             # re-run = zero-line diff
pnpm --filter @legendary-arena/game-engine build                            # 0
pnpm --filter @legendary-arena/game-engine test                            # green; ≥ 1687 + new cases
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit                # 0
pnpm sim:runtime-observed:check                                            # byte-current OR gate-attributable shift (re-pin + EXPECTED)
pnpm -r build                                                              # 0
git diff --name-only                                                       # only the ~14 listed files
```

---

## Vision Alignment

**Touched surfaces (§17.1):** Card data / content semantics (Vision §1, §2) — implements a printed restriction
faithfully; Determinism / RNG (Vision §3, §8) — the gate is a pure read over immutable setup data + player zones.

**Vision clauses touched:** §1, §2, §3, §8.

**Conflict assertion:** No conflict: this WP preserves all touched clauses (it makes a licensed Marvel card behave
as printed — the prior behavior shipped an unenforced rule).

**Non-Goal proximity:** No NG-1..7 crossed (no monetization, scoring weights, identity, or pay-to-win; a
defeat-requirement is a fixed printed rule, not a balance knob).

**Determinism preservation:** `getDefeatRequirement` / `playerMeetsDefeatRequirement` are pure (read
`villainDefeatRequirements` + `cardTraits` + the player's hand/inPlay; no RNG, no mutation, no caching).
`villainDefeatRequirements` is immutable setup data, omitted when empty so matches without these villains are
byte-identical. The only determinism effect is that a fight against a marked villain can now be blocked where it
previously resolved — a legitimate, deterministic rule change; the sentinel re-pins only on that gate-attributable
divergence (executor confirms via `sim:runtime-observed:check`).

---

## Funding Surface Gate

**N/A** — gameplay-fidelity mechanic; no funding affordance, copy, or channel, and no navigation / registry-viewer
/ profile surface per WP-097 §A/§B/§C is touched.

## §21 API Catalog

**N/A** — no `apps/server` HTTP endpoint and no `apps/server/src/**` `Library-only` function is added, modified, or
removed; this is an engine + card-data change only.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | Goal / Assumes / Context (read-first list) / Scope (In) / Out of Scope / Files / Contract / Acceptance / Verification / DoD all present (Contract carries the §2 constraint set, per WP-290 current practice) |
| §2 Constraints | ✅ PASS | Contract locks the silent-return posture, single-helper authority, purity, immutable+omit-when-empty G field; engine-wide rules (ESM, Node 22, full-file output, no diffs) inherited from `.claude/rules` + 00.6 |
| §3 Assumes | ✅ PASS | Rule + "have"=hand/inPlay decision, cardTraits team+class with file:line, exact card identities, cvwr-exclusion, scaffold result all cited |
| §4 Context | ✅ PASS | Specific read-first docs with sections; 00.2 not triggered (no schema/setup-field change — marker is ability-text data, field names unchanged) |
| §5 Files | ✅ PASS | 14 files, each new/modified + one-line change; cohesion + no-layer-crossing rationale (the ~8 figure is stale per WP-290=13) |
| §6 Naming | ✅ PASS | Canonical `team`/`heroClass` trait names; `ext_id`/`CardExtId`; new names full-word (`villainDefeatRequirements`, `playerMeetsDefeatRequirement`) |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | Engine stays engine; overlay is offline tooling upstream of Registry; no import crossing; moves never throw / no RNG / no I/O in the move |
| §9 Windows | ✅ PASS | `pwsh` verification block; `node script.mjs` invocations |
| §10 Env Vars | ✅ PASS | None |
| §11 Auth | N/A | No auth surface |
| §12 Tests | ✅ PASS | `node:test`; parser/helper/gate/drift/overlay coverage; no boardgame.io import in the pure helper; no network/DB |
| §13 Verification | ✅ PASS | Exact `pnpm`/`node` commands with expected output incl. idempotence + determinism check |
| §14 AC Quality | ✅ PASS | 10 binary, observable, file/function-specific items aligned to scope |
| §15 DoD | ✅ PASS | STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap + D-24026 live-verify (surface ≠ none) |
| §16 Code Style | ✅ PASS | `// why:` on the gate + the omit-when-empty field + the marker parse; `for...of`, no `.reduce()`; small pure helpers; full-sentence errors in the overlay |
| §17 Vision | ✅ PASS | §1/§2/§3/§8 cited; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep gate restates a forbidden token in adjacent prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with reason (no funding/nav/registry/profile surface) |
| §21 API Catalog | ✅ PASS | N/A with reason (no server endpoint or Library-only function) |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ Canonical rule + "have" semantics confirmed (operator decision 2026-06-29 → D-24076: hand or in play; discard/deck do not count)
- ✅ Live bug confirmed (diagnostics `gitSha b108dc4`, match `FC6toc2rQQG`: Blob defeated with no X-Men Hero) + ledger agreement (`Blob = (unmarked)`)
- ✅ Mechanic class confirmed missing: no fight-**precondition** primitive exists; all villain effects are post-defeat consequence hooks
- ✅ Ownership data confirmed present: `G.cardTraits[id]` carries both `team` and `heroClass` (no new data needed)
- ✅ Exact card identities + the cvwr-Venom exclusion verified against `data/cards/`
- ✅ **Empirical scaffold (observed, not reasoned):** baseline 1687/0 green; full-corpus grep shows zero tests fight Blob/Venom/Zombie-Venom → the data-keyed gate is additive to the existing suite (the WP-254 fixture-breakage failure mode is ruled out empirically)
- ✅ Scope locked: 3 cards, one `{kind,value}` requirement; mastermind/henchman/multi-requirement/ledger-recognition/UX-hint deferred

---

## Copilot Check Verdict

**PASS**

Implements a printed villain restriction that was shipping unenforced (cosmetic card text). Mirrors the existing
Guard-block + attack-cost silent-return gates in the same move and the WP-185 villain-marker + instance-fan-out
parser, so it rides established patterns rather than inventing a pipeline. Load-bearing risks: (1) the gate placed
where it could mutate-then-block or throw — covered by the Move Validation Contract posture + AC-7 (G unchanged on
block); (2) the ownership check reading the wrong zones (discard/deck) and diverging from the operator's hand/inPlay
decision — covered by the single-helper contract + AC-4/AC-5; (3) marking the wrong Venom — covered by AC-9's
cvwr-unmarked assertion + exact set/group/slug identities; (4) a determinism shift — handled by AC-10's
gate-attributable fail-fast + the omit-when-empty field keeping unaffected matches byte-identical. The data overlay
follows the idempotent surgical-append precedent (clean diffs, loud-fail, `--propose`), avoiding fragile full
pipeline regeneration. No new contract beyond the additive G field + requirement type (D-24076).

---

## Definition of Done

- [ ] All 10 Acceptance Criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green (≥ 1687 baseline + new cases)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` 0; `pnpm -r build` 0
- [ ] `apply-defeat-requirement-markers.mjs` run + committed; second run is a zero-line diff; the 3 cards marked, cvwr Venom unmarked
- [ ] `pnpm sim:runtime-observed:check` byte-current, OR a gate-attributable `finalStateHash` shift re-pinned + recorded EXPECTED (any other cause = STOP)
- [ ] `docs/ai/STATUS.md` updated with the WP-292 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24076 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-292 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-324 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-292 node added
- [ ] No files outside `## Files Expected to Change` modified
- [ ] **User-Visible Surface: play.legendary-arena.com.** D-24026 live-verify (post-deploy): in a match with
      Blob (or Venom / Zombie Venom) in the City and **no** qualifying Hero in hand/in-play, confirm the fight is
      blocked; add a qualifying Hero (X-Men for Blob, Covert for Venom) to hand or play and confirm the fight then
      succeeds.
