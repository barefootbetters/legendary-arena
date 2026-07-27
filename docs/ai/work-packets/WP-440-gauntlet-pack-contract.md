# WP-440 — Gauntlet Pack Contract (Registry Layer)

**User-Visible Surface:** none — infrastructure (a registry contract with no
rendered surface; the payoff is that WP-2's legends-board download control and
WP-5's server import endpoint both validate against one shared schema, so a
downloaded pack and an imported pack can never disagree on shape).

## Goal

After this session, `packages/registry` exports a narrow, identity-only
**Gauntlet Pack** contract: a strict Zod schema plus a pure `buildGauntletPack`
builder and a `validateGauntletPack` validator. A Gauntlet Pack is the tiny
download token a player gets on the legends site to say *which* Mastermind
Gauntlet they want to start — `{ pack_version, gauntlet: { setAbbr,
mastermindSlug, division, playerCount } }` and nothing else. It carries **no**
legs, **no** hero picks, and **no** approved adversary compositions; the server
re-resolves all of those from the live registry at import time (WP-5). This WP
delivers only the registry-layer contract and its unit tests — no download UI,
no server endpoint, no persistence, no migration.

## Assumes

- **On `origin/main` @ `cc206e8c`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). The registry package builds green on this SHA.
- `packages/registry/src/gauntletLoadouts.ts` exists and exports
  `GauntletLoadoutMenu` (`{ setAbbr, mastermindSlug, variants }`) — the
  `(setAbbr, mastermindSlug)` pair is the same gauntlet identity this pack
  carries, so the pack's two identity fields mirror that lookup key. (Source:
  the file on `main`, shipped by WP-395 / D-24199.)
- `packages/registry/src/playerCountSetup.ts` exports `SupportedPlayerCount`
  (`1 | 2 | 3 | 4 | 5`) — the pack's `playerCount` reuses this named type
  rather than re-declaring the 1–5 union. (Source: the file on `main`, WP-370 /
  D-24165.)
- `packages/registry` already publishes per-file subpath exports in
  `package.json` (`./gauntletLoadouts`, `./playerCountSetup`, …) and re-exports
  the same symbols from `src/index.ts`; this WP follows that exact pattern.
- `zod ^3.23.8` is a runtime dependency of `packages/registry` (it is —
  `package.json` `dependencies`), so a Zod schema is a legal registry import.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — Registry layer:
  may import `zod`, must never import `game-engine`, `server`, `pg`, or any
  `apps/*`; contains no gameplay logic.
- `.claude/rules/architecture.md §Registry Layer (Data Input)` and the Import
  Rules table (`registry` → Node built-ins + `zod` only).
- `.claude/skills/legendary-registry/SKILL.md` — registry enforcement.
- `packages/registry/src/gauntletLoadouts.ts` — the approved-loadout menu types
  this pack's identity fields mirror; the server (not this contract) resolves a
  gauntlet's legs + compositions from these menus at import time.
- `packages/registry/src/playerCountSetup.ts` — `SupportedPlayerCount` and the
  per-count `heroCount` the *run* (WP-4/5) will use; this WP only carries the
  count, it does not enforce leg-playability.
- `docs/ai/DECISIONS.md` — scan D-24131 (gauntlet leaderboards), D-24187
  (team-key / fixed-hero-pool division), D-24199 (approved loadout menus) for
  the surrounding gauntlet contract; this WP reserves **D-24260**.

**Why now / split rationale.** This is the first work packet of the approved
**Mastermind Gauntlets: download → import → build → track** epic. The epic was
deliberately decomposed into 8 layer-respecting WPs (the plan's §Work-packet
decomposition); this WP is #1, *contract first, before any consumer*. The pack
contract is the shared shape that WP-2 (legends download) builds client-side and
WP-5 (server import) validates — so it must exist and be locked before either
consumer. Keeping it a standalone registry-only WP (no download UI, no endpoint)
holds the layer boundary and lets the shape freeze before code depends on it,
which is the epic's stated ordering discipline.

**Backlog supersession (reference only).** The epic realizes and expands the
`WORK_INDEX.md` backlog line *"Gauntlet progress on profiles (Server + Client)"*
(D-24131 §8b). That backlog line is **not** deleted by this WP — it is a plain
(non-checkbox) list item and stays as-is; the epic supersedes it in scope, and a
later WP in the epic will reconcile it.

## Scope (In)

- New file `packages/registry/src/gauntletPack.ts` exporting:
  - `GAUNTLET_PACK_VERSION` — the current supported pack major version
    (`1` for v1).
  - `GauntletDivision` type (`'fixed' | 'open'`) and a `GauntletPackIdentity`
    type (`{ setAbbr, mastermindSlug, division, playerCount }`).
  - `GauntletPack` type (`{ pack_version, gauntlet: GauntletPackIdentity }`).
  - `GauntletPackSchema` — a **strict** Zod schema for the v1 pack (unknown
    keys rejected at both object levels).
  - `buildGauntletPack(identity: GauntletPackIdentity): GauntletPack` — a pure
    builder that stamps `pack_version: GAUNTLET_PACK_VERSION` and returns the
    identity-only pack (validated before return).
  - `validateGauntletPack(input: unknown): GauntletPack` — strict validation
    that (a) rejects an unknown **major** `pack_version` with a clear
    full-sentence error, then (b) parses against `GauntletPackSchema`; returns
    the typed pack or throws a full-sentence `Error`.
- New file `packages/registry/src/gauntletPack.test.ts` (`node:test`) covering:
  round-trip a `core/magneto` identity pack through
  `buildGauntletPack` → serialize → `validateGauntletPack`; assert the result
  has **only** `pack_version` + `gauntlet.{setAbbr,mastermindSlug,division,
  playerCount}` (no `legs`, no `heroes`/`heroDeckIds`, no `compositions`/
  `villainGroupIds`); the unknown-major-version reject path; the unknown-field
  reject path (both object levels); the out-of-range `playerCount` reject; the
  bad-`division` reject.
- Modify `packages/registry/src/index.ts` — re-export the new symbols/types
  (mirroring the existing `gauntletLoadouts` re-export block).
- Modify `packages/registry/package.json` — add the `./gauntletPack` subpath to
  the `exports` map (mirroring `./gauntletLoadouts`).

## Out of Scope

- **No download UI** on legends-board (`apps/legends-board`) — that is WP-2.
- **No server endpoint**, no `apps/server` change, no import/run persistence —
  that is WP-4/WP-5.
- **No migration** — no `data/migrations/**` change.
- **No `lagn-spec` change** — the pack is deliberately *not* a LAGN document
  (extending LAGN to a multi-leg container is explicitly rejected in the plan).
- **No registry existence check** — `validateGauntletPack` validates the pack's
  *shape* only; it does **not** confirm the `(setAbbr, mastermindSlug)` pair
  actually hosts a gauntlet, nor that `division`/`playerCount` are offered for
  it. That resolution is the server's job at import (WP-5), against the live
  registry — the pack is an import token, never a rules container.
- **No changes to** `gauntletLoadouts.ts`, `playerCountSetup.ts`, or any other
  existing registry contract file — this WP is strictly additive.

## Files Expected to Change

- `packages/registry/src/gauntletPack.ts` — **new** — the pack schema, builder,
  validator, and types.
- `packages/registry/src/gauntletPack.test.ts` — **new** — `node:test` unit
  tests (round-trip + reject paths).
- `packages/registry/src/index.ts` — **modified** — re-export the new
  gauntlet-pack symbols and types.
- `packages/registry/package.json` — **modified** — add the `./gauntletPack`
  subpath export.

## Contract

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - Registry-layer only: `zod` + Node built-ins; **no** `game-engine`,
>   `server`, `pg`, `apps/*`, or `boardgame.io` import.
> - `validateGauntletPack` throws a **full-sentence** `Error` on invalid input
>   (registry is not the move layer; throwing is legal here).

**The v1 pack shape (locked):**

```jsonc
{
  "pack_version": 1,
  "gauntlet": {
    "setAbbr": "core",
    "mastermindSlug": "magneto",
    "division": "fixed",     // "fixed" | "open"
    "playerCount": 1          // integer 1..5
  }
}
```

**Locked contract points:**
- `pack_version` is an integer; `GAUNTLET_PACK_VERSION = 1`. A pack whose
  `pack_version` is a number other than the supported major is **rejected**
  with a clear full-sentence error — never silently accepted, never
  field-ignored.
- `GauntletPackSchema` is **strict** at both levels (Zod `.strict()`): any key
  outside the locked shape is a rejection, not a silent drop.
- `division` is the closed set `'fixed' | 'open'`.
- `playerCount` is an integer in `1..5` (reuses `SupportedPlayerCount`).
- The pack is **identity-only**: it carries no `legs`, no `heroDeckIds`/heroes,
  and no `villainGroupIds`/`henchmanGroupIds`/compositions. (Enforced by the
  strict schema and asserted by test.)

## Acceptance Criteria

- [ ] `packages/registry/src/gauntletPack.ts` exports `GAUNTLET_PACK_VERSION`,
      `GauntletPackSchema`, `buildGauntletPack`, `validateGauntletPack`, and the
      `GauntletDivision` / `GauntletPackIdentity` / `GauntletPack` types.
- [ ] `buildGauntletPack({ setAbbr: 'core', mastermindSlug: 'magneto',
      division: 'fixed', playerCount: 1 })` returns
      `{ pack_version: 1, gauntlet: { setAbbr: 'core', mastermindSlug:
      'magneto', division: 'fixed', playerCount: 1 } }`.
- [ ] Round-trip: `validateGauntletPack(JSON.parse(JSON.stringify(built)))`
      deep-equals `built`.
- [ ] The validated pack has exactly the keys `pack_version` + `gauntlet`, and
      `gauntlet` has exactly `setAbbr, mastermindSlug, division, playerCount` —
      the test asserts NO `legs`, `heroDeckIds`, `heroes`, `compositions`,
      `villainGroupIds`, or `henchmanGroupIds` are present.
- [ ] `validateGauntletPack` on a pack with `pack_version: 2` throws an `Error`
      whose message names the unsupported version and the version this build
      reads.
- [ ] `validateGauntletPack` on a pack with an extra top-level key (e.g.
      `legs: []`) OR an extra `gauntlet.*` key (e.g. `heroDeckIds: []`) throws.
- [ ] `validateGauntletPack` on `playerCount: 0` and `playerCount: 6` throws;
      on a `division` outside `'fixed' | 'open'` throws.
- [ ] `packages/registry/package.json` `exports` includes `./gauntletPack`
      resolving to `./dist/gauntletPack.js` (+ types), and `src/index.ts`
      re-exports the new symbols.
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 and
      `pnpm --filter @legendary-arena/registry test` passes (new tests green).
- [ ] No file outside the `Files Expected to Change` list is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/registry build
# Expected: tsc exits 0; dist/gauntletPack.js + dist/gauntletPack.d.ts emitted

pnpm --filter @legendary-arena/registry test
# Expected: all registry tests pass, including gauntletPack.test.ts

node -e "import('@legendary-arena/registry/gauntletPack').then(m => console.log(JSON.stringify(m.buildGauntletPack({setAbbr:'core',mastermindSlug:'magneto',division:'fixed',playerCount:1}))))"
# Expected: {"pack_version":1,"gauntlet":{"setAbbr":"core","mastermindSlug":"magneto","division":"fixed","playerCount":1}}

pnpm -r build
# Expected: whole-repo build green (no dependent breakage; strictly additive)
```

## Vision Alignment

**Vision clauses touched:** §20–26 (Scoring, PAR & leaderboards — the gauntlet
is a competitive/leaderboard surface; a pack names *which* gauntlet a player
targets). No identity/monetization/RNG/determinism surface is touched.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
The pack is an identity-only import token; it stores and derives **no** scoring,
progress, or completion, and it makes the server the sole authority for legs and
approved compositions (re-resolved from the live registry at import). Nothing
here scores, ranks, or credits a player.

**Non-Goal proximity check:** No proximity to NG-1..7. The pack carries no paid
surface, no pay-to-win lever, and no cosmetic/monetization affordance — it is a
four-field identifier.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter @legendary-arena/registry build` and `test` exit 0;
      `pnpm -r build` exits 0.
- [ ] `docs/ai/STATUS.md` updated — and, because `User-Visible Surface` is
      `none — infrastructure`, the STATUS entry states **"No user-observable
      change — infrastructure only"** (D-24026 inverted gate).
- [ ] `docs/ai/DECISIONS.md` **D-24260** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-475 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary →
  `.claude/rules/architecture.md` §Registry → `legendary-registry` skill → this
  WP → EC-475. No conflict; registry may import `zod`.
- **Dependencies verified on `main` @ `cc206e8c`:** `gauntletLoadouts.ts`
  (`GauntletLoadoutMenu`) and `playerCountSetup.ts` (`SupportedPlayerCount`)
  both present with the cited shapes; `zod` is a registry runtime dependency;
  the per-file subpath-export + index-re-export pattern is established
  (`./gauntletLoadouts`, `./playerCountSetup`). No hard-dep WP is in-flight —
  this is epic WP #1 with no upstream WP dependency.
- **Scope lock:** exactly four files (2 new registry, `index.ts`,
  `package.json`) + governance ledgers. No layer crossing (registry only). No
  contract file *modified* — a new contract file is *added* (additive).
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP adds a
  brand-new export path with its own new tests; it does **not** tighten
  validation on any *existing* input path, so no pre-existing fixtures can carry
  a now-invalid form. The scaffold-first empirical gate does not trigger. (The
  only inputs the new strict schema rejects are inputs no existing code
  produces — the pack type is new to the repo.)
- **Ambiguities:** none blocking. The one design call — validator throws vs.
  returns a result object — is resolved to **throw a full-sentence `Error`**
  (registry is not the move layer; throwing is the idiomatic Zod pattern and is
  cleanly `assert.throws`-testable). Recorded in the WP Contract + EC.

### Copilot Check (`01.7`) — verdict: **PASS**

Audited against the Top-30 lens; findings summarized:
- **Separation of concerns / boundaries — PASS.** Registry-only; `zod` + Node
  built-ins; no engine/server/pg/apps import. The pack is a data contract, not
  gameplay logic; the server remains authoritative for adjudication.
- **Determinism — PASS.** Pure builder + validator; no RNG, no time, no I/O.
- **Immutability / mutation — PASS.** Builder returns a fresh object; no shared
  mutable state.
- **Type safety / contract integrity — PASS.** Strict Zod at both levels;
  `GauntletPack` type is the inferred contract; closed sets for `division` and
  `playerCount` (reused `SupportedPlayerCount`).
- **Persistence / serialization — PASS.** No persistence; the pack is
  plain-JSON-serializable by construction (round-trip test proves it).
- **Testing / invariants — PASS.** Round-trip + four reject paths + an
  identity-only key assertion (proves no legs/heroes/compositions leak in).
- **Scope / governance — PASS.** Four-file additive scope; explicit Out-of-Scope
  fences (no UI, no endpoint, no migration, no lagn-spec).
- **Extensibility — PASS.** Forward-compat via the `pack_version` major-reject
  gate, not lax parsing — the design decision D-24260 locks this.
- **Documentation / intent — PASS.** JSDoc on every export; `// why:` on the
  version-gate and the strict-schema rationale.
- **Error handling — PASS.** Full-sentence errors naming what failed and what
  the build expects.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order.
- **§2 Non-Negotiable Constraints** — PASS. ESM, Node v22+, zod-only registry
  import, human-style code stated in Contract.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source
  on `main`; no implicit dependency.
- **§4 Context References** — PASS. Specific docs/sections + files listed.
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Four files
  enumerated with new/modified + one-line each.
- **§6 Naming Consistency** — PASS. Field names (`setAbbr`, `mastermindSlug`,
  `division`, `playerCount`, `heroDeckIds`) match existing registry usage; no
  abbreviations invented.
- **§7 Dependency Discipline** — PASS. No hard-dep WP (epic #1); dependencies
  are existing `main` files, verified present.
- **§8 Architectural Boundaries** — PASS. Registry layer; import rules honored
  (zod + Node only); no gameplay logic; explicitly no engine/server/pg/apps.
- **§9 Windows Compatibility** — PASS. No shell scripts; `pnpm` verification
  commands only.
- **§10 Environment Variable Hygiene** — PASS. No env access.
- **§11 Authentication Clarity** — N/A. No auth surface (no endpoint); the pack
  is a client-built/import token with no credential handling.
- **§12 Test Quality** — PASS. `node:test`, `.test.ts`, no `boardgame.io/testing`,
  no live server; reject paths + a non-vacuous identity-only key assertion.
- **§13 Commands & Verification** — PASS. Exact `pnpm` commands with expected
  output.
- **§14 Acceptance Criteria Quality** — PASS. 9 binary, observable checks naming
  real symbols/values.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface`
  declared `none — infrastructure`; DoD requires the STATUS.md "No
  user-observable change — infrastructure only" line (inverted D-24026 gate).
- **§16 Code Style** — PASS. Small pure functions, explicit control flow, JSDoc,
  `// why:` on the version gate, named exports, full-sentence errors.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §20–26 touched
  (leaderboard-adjacent); "No conflict"; NG proximity checked (none).
- **§18 Prose-vs-Grep Discipline** — N/A. This WP defines no count-bounded grep
  gate over a literal token.
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge/adapter reconciliation; the
  baseline SHA `cc206e8c` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  registry-viewer, or profile funding affordance, no donate/tournament-funding
  copy, no funding channel — the WP adds a four-field registry data contract.
- **§21 API Catalog Update** — N/A. Registry-layer only: adds no `apps/server`
  HTTP endpoint and no `apps/server/src/**` `Library-only` function; the new
  export lives in `packages/registry` and is not catalog-tracked. (WP-5 will
  trigger §21 when it adds the import endpoint.)

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
