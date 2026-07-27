# WP-441 — Legends Gauntlet Pin + Download (legends-board client)

**User-Visible Surface:** `legends.legendary-arena.com` (the public Legends
attract board / gauntlet index). Two additions a visitor can see and use:
(1) the **Core Set — Magneto** gauntlet is pinned to the top of the gauntlet
index as the showcase example, and (2) each gauntlet row gains a **"Download
Mastermind Gauntlet"** control with a small player-count (1–5) + division
(fixed | open) selector that downloads a `.gauntlet.json` identity pack.
**D-24026 live-verification applies** (operator-pending on the Cloudflare Pages
deploy).

## Goal

After this session, the legends-board SPA (`apps/legends-board`) shows the
**Core Set / Magneto** gauntlet first on the Mastermind Gauntlets index (a
display-only reorder — the publisher's underlying `setAbbr` ASC / mastermind
ASC order is otherwise preserved), and every gauntlet row offers a **"Download
Mastermind Gauntlet"** button beside a compact **player-count (1–5)** +
**division (fixed | open)** selector that defaults to **solo (1) + fixed**.
Clicking Download builds the WP-440 identity pack **client-side** from data the
SPA already holds in its cached `gauntlet-index.json` entry (`setAbbr` +
`mastermindSlug`) plus the selector, and triggers a browser Blob/anchor
download named
`gauntlet-<setAbbr>-<mastermindSlug>-<division>-p<N>.gauntlet.json`. There is
**no server call, no new endpoint, no snapshot change** — the download is a
tiny client-built token. This is the second WP of the Mastermind Gauntlets:
download → import → build → track epic (the smallest shippable, user-visible,
zero-API slice), and it consumes WP-440's pack contract for compile-time
shape-conformance only.

## Assumes

- **On `origin/main` @ `01ec0a27`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/legends-board` builds and typechecks green
  on this SHA.
- **WP-440 / EC-475 / D-24260 is landed on `main`** (hard dependency, shape
  only). `packages/registry/src/gauntletPack.ts` exports the `GauntletPack`,
  `GauntletPackIdentity`, and `GauntletDivision` types, and
  `packages/registry/package.json` `exports` includes `./gauntletPack`
  resolving to `./dist/gauntletPack.{js,d.ts}`. (Source: WORK_INDEX.md WP-440
  row = **Done 2026-07-27**; the file on `main`.)
- `apps/legends-board/package.json` declares **`vue` as its sole runtime
  dependency** (the WP-343/WP-345 zero-API / sole-runtime-dep invariant), and
  `@legendary-arena/lagn` is already a **devDependency** consumed **type-only**
  (`import type { LAGN, LagnPlayer } from '@legendary-arena/lagn'` in
  `src/panels/matchResultDisplay.ts`). This WP mirrors that exact devDep +
  type-only pattern for `@legendary-arena/registry`. (Source: the file on
  `main`.)
- `apps/legends-board/src/snapshots/snapshotClient.ts` exports the
  `GauntletIndexEntry` type carrying `setAbbr` and `mastermindSlug` (among
  others) — the two identity fields the pack needs are already in the cached
  index entry, so the pack build reads nothing new. (Source: the file on
  `main`, WP-343/WP-344.)
- `apps/legends-board/src/panels/gauntletDisplay.ts` exports
  `groupGauntletsBySet`, whose documented contract is **"preserving the
  artifact's order … this function adds no ordering of its own."** This WP does
  **not** modify that contract; the showcase pin is a **separate** helper
  applied after grouping. (Source: the file on `main`.)
- `apps/legends-board/src/panels/matchResultDownload.ts` exports the
  Blob/object-URL anchor download pattern (`URL.createObjectURL` →
  `<a download>` → `anchor.click()` → `URL.revokeObjectURL`) this WP mirrors —
  minus the `fetch` (this download builds its bytes client-side, it does not
  fetch them). (Source: WP-408 / D-24218, the file on `main`.)
- `apps/legends-board/tsconfig.json` uses `moduleResolution: "bundler"`, so
  `@legendary-arena/registry/gauntletPack` resolves through the registry
  `exports` map to `dist/gauntletPack.d.ts` — the registry package must be
  **built** for legends-board's `vue-tsc` typecheck to see the type. `pnpm -r
  build` builds registry before legends-board, so this holds in CI and locally
  after a full build. (Source: the file on `main`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the App layer
  (`apps/legends-board`) and the Import Rules table row for
  `apps/registry-viewer` / legends-board-class apps: UI framework only at
  runtime; **`registry` must NOT be a runtime import** on a zero-API board SPA.
- `.claude/rules/architecture.md` Import Rules table + §Persistence Boundary —
  no `G`, no snapshot change; this WP touches neither.
- `.claude/rules/code-style.md` — ESM-only, `node:test`, `.test.ts`, full
  English names, `// why:` on non-self-evident constants, human-style code.
- `packages/registry/src/gauntletPack.ts` (WP-440) — the `GauntletPack` /
  `GauntletPackIdentity` / `GauntletDivision` types this WP imports **type-only**
  and satisfies. The inline literal this WP builds mirrors `buildGauntletPack`'s
  output shape exactly, without the runtime call.
- `apps/legends-board/src/panels/matchResultDownload.ts` +
  `matchResultDownload.test.ts` — the Blob/anchor download pattern and its
  pure-helper (`buildLagnFilename` / `serializeLagnDocument`) test posture this
  WP mirrors for `gauntletPackDownload.ts`.
- `apps/legends-board/src/panels/gauntletDisplay.ts` +
  `GauntletIndexPanel.vue` + `gauntletDisplay.test.ts` — the index grouping,
  render, and pure-helper test the pin extends.
- `docs/ai/DECISIONS.md` — D-24260 (pack identity-only), D-24218 (export-only
  download precedent), D-24134/D-24187/D-24199 (surrounding gauntlet contract);
  this WP reserves **D-24261**.

**Why now / split rationale.** This is WP #2 of the approved Mastermind
Gauntlets epic (plan §Work-packet decomposition), deliberately the **smallest
shippable, user-visible, zero-API** slice: it proves the WP-440 pack shape by
producing a real downloadable file, and ships a visible showcase pin, without
any server, persistence, or migration surface. It is a single-app, single-layer
change (`apps/legends-board` only). It is **not** lightweight-lane eligible —
it is a user-visible surface across five files (> the 4-file lane budget) and
adds a new panel module — so it runs the standard two-session lane.

**Backlog supersession (reference only).** The epic supersedes in scope the
`WORK_INDEX.md` backlog line *"Gauntlet progress on profiles (Server +
Client)"* (D-24131 §8b). That line is a plain (non-checkbox) reference item and
is **not** deleted by this WP; a later epic WP reconciles it.

## Scope (In)

- **Showcase pin (display-only reorder).** Add a pure pin helper to
  `apps/legends-board/src/panels/gauntletDisplay.ts` that takes the grouped
  set-groups and returns a **new** array in which the group whose `setAbbr` is
  the showcase set (`"core"`) is moved to the front, and within that group the
  gauntlet whose `mastermindSlug` is the showcase mastermind (`"magneto"`) is
  moved to the front. When the showcase gauntlet is absent (an old snapshot
  without `core/magneto`), the helper returns the groups **unchanged** (a
  fresh copy — never a mutation of the input). `groupGauntletsBySet`'s
  order-preserving contract is **not** modified.
- **Apply the pin** in `GauntletIndexPanel.vue`'s `setGroups` computed:
  `pinShowcaseGauntlet(groupGauntletsBySet(props.index.gauntlets))`.
- **New panel module** `apps/legends-board/src/panels/gauntletPackDownload.ts`
  exporting pure helpers:
  - `buildGauntletPackDocument(identity)` — builds the identity pack **inline**
    as a plain object literal `{ pack_version: 1, gauntlet: { setAbbr,
    mastermindSlug, division, playerCount } }`, typed `satisfies GauntletPack`
    via a **type-only** import of the WP-440 contract. No runtime registry
    call.
  - `buildGauntletPackFilename(identity)` —
    `gauntlet-<setAbbr>-<mastermindSlug>-<division>-p<N>.gauntlet.json`.
  - `serializeGauntletPack(pack)` — `JSON.stringify(pack, null, 2)`.
  - `downloadGauntletPack(identity)` — serialize → `Blob`
    (`application/json`) → object-URL `<a download>` anchor → click → revoke,
    mirroring `matchResultDownload.ts` (no `fetch`).
- **Download control + selector** in `GauntletIndexPanel.vue`: per gauntlet
  row, a compact **player-count (1–5)** selector and a **division (fixed |
  open)** selector, defaulting to **playerCount 1 + division "fixed"**, plus a
  **"Download Mastermind Gauntlet"** button that calls `downloadGauntletPack`
  with the row's `{ setAbbr, mastermindSlug }` and the selected count/division.
- **New/extended tests:**
  - `apps/legends-board/src/panels/gauntletPackDownload.test.ts` (**new**) —
    `buildGauntletPackDocument` produces the identity-only shape (asserts NO
    `legs` / `heroDeckIds` / `villainGroupIds` keys), the default is solo +
    fixed, `buildGauntletPackFilename` produces the locked convention across
    counts and both divisions, and `serializeGauntletPack` round-trips.
  - `apps/legends-board/src/panels/gauntletDisplay.test.ts` (**modified**) —
    pin moves `core/magneto`'s group and gauntlet to the front; a set-list
    without the showcase is returned unchanged; the input is not mutated.
- **`apps/legends-board/package.json`** (**modified**) — add
  `@legendary-arena/registry: "workspace:*"` to **`devDependencies`** only
  (mirroring `@legendary-arena/lagn`); the import is type-only and erased from
  the runtime bundle.

## Out of Scope

- **No runtime registry dependency** — `@legendary-arena/registry` goes in
  `devDependencies` only, and the contract is imported **type-only**
  (`import type`). `buildGauntletPack` / `validateGauntletPack` are **not**
  runtime-imported. Adding registry to `dependencies` is a layer violation.
- **No server endpoint, no `apps/server` change, no persistence, no
  migration** — the download is a client Blob; import/run persistence is
  WP-4/WP-5.
- **No snapshot / publisher change** — `apps/server/src/legends/**` and the R2
  artifacts are untouched; the pack is built from the already-cached
  `gauntlet-index.json` entry.
- **No `packages/registry` change** — WP-440's contract is consumed as-is; this
  WP modifies no registry file.
- **No validation of gauntlet existence** — the download names whatever the
  row + selector say; the server re-resolves and validates at import (WP-5).
  legends-board does not confirm the `(setAbbr, mastermindSlug, division,
  playerCount)` combination is offered.
- **No LAGN change** — the pack is deliberately not a LAGN document.
- **No change to the existing per-count claim chips, challenge links, or
  fixed-division toggle** — those (WP-345 / WP-385 / WP-395) render exactly as
  before; the pin and download control are additive.

## Files Expected to Change

- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — add the
  pure `pinShowcaseGauntlet` helper + the two showcase constants.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** —
  apply the pin in the `setGroups` computed; add the per-row player-count +
  division selector and the "Download Mastermind Gauntlet" button wired to
  `downloadGauntletPack`.
- `apps/legends-board/src/panels/gauntletPackDownload.ts` — **new** — inline
  pack build + filename + serialize + Blob/anchor download.
- `apps/legends-board/src/panels/gauntletPackDownload.test.ts` — **new** —
  `node:test` unit tests (identity-only shape, default solo/fixed, filename
  convention, serialize round-trip).
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — pin
  tests (reorder + absent-showcase passthrough + no-mutation).
- `apps/legends-board/package.json` — **modified** — add
  `@legendary-arena/registry` to `devDependencies`.

## Contract

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - App layer (`apps/legends-board`): **`vue` stays the sole runtime
>   dependency**; `@legendary-arena/registry` is a **devDependency**, imported
>   **type-only**, and MUST NOT appear in the built runtime bundle.
> - Pure helpers (`pinShowcaseGauntlet`, `buildGauntletPackDocument`,
>   `buildGauntletPackFilename`, `serializeGauntletPack`) are side-effect free
>   and unit-tested; the Blob/anchor trigger and the Vue selector are covered
>   by the dev-server smoke + `vue-tsc` (mirroring `matchResultDownload`).

**Locked values (do not re-derive):**

- **Showcase identity:** `SHOWCASE_SET_ABBR = "core"`,
  `SHOWCASE_MASTERMIND_SLUG = "magneto"`.
- **Pack literal (inline):**
  `{ pack_version: 1, gauntlet: { setAbbr, mastermindSlug, division,
  playerCount } }` — `pack_version` is the literal `1` (mirrors WP-440's
  `GAUNTLET_PACK_VERSION`; inlined to avoid a runtime registry import), and the
  object `satisfies GauntletPack`.
- **Filename convention:**
  `gauntlet-<setAbbr>-<mastermindSlug>-<division>-p<N>.gauntlet.json`
  (e.g. `gauntlet-core-magneto-fixed-p1.gauntlet.json`).
- **Selector domain / defaults:** player count ∈ `1 | 2 | 3 | 4 | 5`, division
  ∈ `"fixed" | "open"`; default **playerCount 1**, **division "fixed"**.
- **Button label:** `"Download Mastermind Gauntlet"`. **MIME:**
  `application/json`.
- **Type-only import:** `import type { GauntletPack, GauntletDivision } from
  "@legendary-arena/registry/gauntletPack"` (and `GauntletPackIdentity` if the
  helper takes it) — never a value import.

## Acceptance Criteria

- [ ] `apps/legends-board/src/panels/gauntletDisplay.ts` exports
      `pinShowcaseGauntlet(groups)` which returns a new array with the
      `core/magneto` group first and `magneto` first within it, leaving all
      other groups and gauntlets in their prior relative order, and returns an
      unchanged copy when no group contains `core/magneto`. The input array and
      its group objects are not mutated (asserted by test).
- [ ] `GauntletIndexPanel.vue`'s `setGroups` computed applies
      `pinShowcaseGauntlet` to the grouped index, so `core/magneto` renders
      first; `groupGauntletsBySet` is unchanged.
- [ ] `apps/legends-board/src/panels/gauntletPackDownload.ts` exports
      `buildGauntletPackDocument`, `buildGauntletPackFilename`,
      `serializeGauntletPack`, and `downloadGauntletPack`.
- [ ] `buildGauntletPackDocument({ setAbbr: 'core', mastermindSlug: 'magneto',
      division: 'fixed', playerCount: 1 })` returns `{ pack_version: 1,
      gauntlet: { setAbbr: 'core', mastermindSlug: 'magneto', division:
      'fixed', playerCount: 1 } }` — exactly the keys `pack_version` +
      `gauntlet`, and `gauntlet` has exactly `setAbbr, mastermindSlug,
      division, playerCount`; the test asserts NO `legs`, `heroDeckIds`,
      `heroes`, `villainGroupIds`, or `henchmanGroupIds` are present.
- [ ] `buildGauntletPackFilename` produces
      `gauntlet-core-magneto-fixed-p1.gauntlet.json` for the default and the
      correct string for `open` / other counts (e.g.
      `gauntlet-core-magneto-open-p5.gauntlet.json`).
- [ ] `serializeGauntletPack(pack)` equals `JSON.stringify(pack, null, 2)` and
      `JSON.parse` of it deep-equals `pack`.
- [ ] The per-row selector defaults to player count 1 + division "fixed"; the
      "Download Mastermind Gauntlet" button is present on every gauntlet row.
- [ ] `@legendary-arena/registry` is in `apps/legends-board/package.json`
      `devDependencies` only (never `dependencies`); the only import of it is
      `import type`.
- [ ] **Zero-API bundle assertion (WP-343 / EC-164 precedent):** after
      `pnpm --filter @legendary-arena/legends-board build`,
      `grep -r "legendary-arena/registry" apps/legends-board/dist` returns **no
      match** (the type-only import is erased — registry never enters the
      runtime bundle), and the download path issues **no** network request
      (verified live via `read_network_requests` in the DoD).
- [ ] `pnpm --filter @legendary-arena/legends-board test`,
      `pnpm --filter @legendary-arena/legends-board typecheck`
      (`vue-tsc --noEmit`), and `pnpm --filter @legendary-arena/legends-board
      build` all exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the `Files Expected to Change` list is modified.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green; registry dist present so legends-board
# type-only import of @legendary-arena/registry/gauntletPack resolves.

pnpm --filter @legendary-arena/legends-board test
# Expected: all legends-board tests pass, including gauntletPackDownload.test.ts
# and the new pin cases in gauntletDisplay.test.ts.

pnpm --filter @legendary-arena/legends-board typecheck
# Expected: vue-tsc --noEmit exits 0 (satisfies GauntletPack holds).

pnpm --filter @legendary-arena/legends-board build
grep -r "legendary-arena/registry" apps/legends-board/dist ; echo "exit=$?"
# Expected: no match (grep exit=1) — the type-only import left no runtime trace.

# Dev-server smoke (pure-logic is unit-tested; the DOM trigger + selector are
# smoke-verified): run the SPA, open the Mastermind Gauntlets index, confirm
# Core Set / Magneto renders first, pick a count + division, click "Download
# Mastermind Gauntlet", and confirm the saved file is
# gauntlet-core-magneto-<div>-p<N>.gauntlet.json and validates against the
# WP-440 GauntletPackSchema. read_network_requests shows ZERO API calls.
```

## Vision Alignment

**Vision clauses touched:** §20–26 (Scoring, PAR & leaderboards — the gauntlet
index is a competitive/leaderboard surface; the download names *which* gauntlet
a player targets). No identity / monetization / RNG / determinism / persistence
surface is touched.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
The pin is a display-only reorder and the download is an identity-only client
token; nothing here scores, ranks, credits, or persists anything, and the
server remains the sole authority for legs, compositions, and adjudication at
import (WP-5).

**Non-Goal proximity check:** No proximity to NG-1..7. The download is free,
account-less, carries no paid surface, no pay-to-win lever, and no
cosmetic/monetization affordance — it is a four-field identifier a visitor can
save.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter @legendary-arena/legends-board build`, `test`, and
      `typecheck` exit 0; `pnpm -r build` exits 0; the zero-API bundle grep
      returns no match.
- [ ] **D-24026 live-verification (operator-pending on deploy):** on the
      deployed `legends.legendary-arena.com`, Core Set / Magneto renders first
      on the Mastermind Gauntlets index, and the "Download Mastermind Gauntlet"
      control produces a valid `gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json`
      that parses against the WP-440 `GauntletPackSchema`, with
      `read_network_requests` showing zero API calls on the click.
- [ ] `docs/ai/STATUS.md` updated (user-visible: names the pin + download on
      legends).
- [ ] `docs/ai/DECISIONS.md` **D-24261** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-476 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary (App /
  legends-board import rules) → `.claude/rules/architecture.md` Import Rules +
  §Persistence Boundary → `.claude/rules/code-style.md` → this WP → EC-476. No
  conflict: an App-layer SPA may import a workspace package **type-only** from
  `devDependencies` without acquiring a runtime edge (the `@legendary-arena/lagn`
  precedent proves it).
- **Dependencies verified on `main` @ `01ec0a27`:** WP-440 is **Done**
  (WORK_INDEX row 2026-07-27); `packages/registry/package.json` `exports` maps
  `./gauntletPack` → `dist/gauntletPack.{js,d.ts}`, and `gauntletPack.ts`
  exports `GauntletPack` / `GauntletPackIdentity` / `GauntletDivision`.
  legends-board declares `vue` as its sole runtime dep and already carries a
  type-only devDep (`@legendary-arena/lagn`). `groupGauntletsBySet`,
  `GauntletIndexEntry` (`setAbbr` + `mastermindSlug`), and the
  `matchResultDownload` Blob/anchor pattern are all present on `main`.
- **Scope lock:** exactly six files, all under `apps/legends-board`
  (2 new, 4 modified) + governance ledgers. Single layer (App), single app. No
  contract file modified; no server / persistence / migration surface.
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP adds a
  brand-new download path and new pure helpers with their own new tests, and a
  display-only reorder; it **tightens no existing input path** and rejects no
  previously-accepted input, so no pre-existing fixture can carry a now-invalid
  form. The scaffold-first empirical gate does not trigger. (The `satisfies
  GauntletPack` conformance is a compile-time check the executor confirms via
  `typecheck`, not a runtime validation over existing data.)
- **Ambiguities:** none blocking. The one design call — whether the pin
  reorders the flat entries or the grouped set-groups — is resolved to **the
  grouped set-groups** (the panel renders `setGroups`, and pinning post-grouping
  keeps `groupGauntletsBySet`'s order-preserving contract intact). The second —
  where `pack_version` comes from — is resolved to an **inline literal `1`**
  (a runtime `GAUNTLET_PACK_VERSION` import would breach the zero-runtime-registry
  invariant), documented with a `// why:` and cross-checked by the server's
  import validation (WP-5). Both recorded in the WP Contract + EC.

### Copilot Check (`01.7`) — verdict: **PASS**

Audited against the Top-30 lens; findings summarized:
- **Separation of concerns / layer boundaries — PASS.** App layer only; `vue`
  stays the sole runtime dependency; registry is a type-only devDep, erased from
  the bundle (grep-asserted). No server / persistence / snapshot reach.
- **Determinism — PASS.** Pure helpers (pin, build, filename, serialize); no
  RNG, no time, no I/O beyond the DOM Blob/anchor trigger; no `G`/`ctx`.
- **Immutability / mutation — PASS.** `pinShowcaseGauntlet` returns a fresh
  reordered array and never mutates the input groups (asserted by test);
  `buildGauntletPackDocument` returns a fresh literal.
- **Type safety / contract integrity — PASS.** `satisfies GauntletPack` binds
  the inline literal to WP-440's contract at compile time; `GauntletDivision`
  and the 1..5 count reuse the contract's closed sets.
- **Persistence / serialization — PASS.** No persistence; the pack is
  plain-JSON-serializable (round-trip test proves it).
- **Testing / invariants — PASS.** Identity-only key assertion (no
  legs/heroes/compositions), default solo/fixed, filename convention across
  counts + divisions, serialize round-trip, and three pin cases (reorder,
  absent-showcase passthrough, no-mutation).
- **Scope / governance — PASS.** Six-file, single-app additive scope with
  explicit Out-of-Scope fences (no runtime registry dep, no endpoint, no
  snapshot, no migration, no LAGN change).
- **Zero-API invariant — PASS.** The load-bearing risk (a runtime registry edge
  or a fetch) is fenced by the devDep-only + type-only rule and the grep bundle
  assertion, matching the WP-343 / EC-164 precedent.
- **Documentation / intent — PASS.** JSDoc on every export; `// why:` on the
  showcase constants, the inline `pack_version`, and the object-URL revoke.
- **Error handling — PASS.** The download path is never a silent no-op; the
  pure builders operate on already-typed identity data.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order.
- **§2 Non-Negotiable Constraints** — PASS. ESM, Node v22+, `vue`-sole-runtime,
  type-only registry devDep, human-style code stated in Contract.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source
  on `main` @ `01ec0a27`; the WP-440 hard-dep is verified Done.
- **§4 Context References** — PASS. Specific docs/sections + files listed.
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Six files
  enumerated with new/modified + one-line each; matches the EC allowlist.
- **§6 Naming Consistency** — PASS. `setAbbr`, `mastermindSlug`, `division`,
  `playerCount` match the WP-440 contract and the index entry exactly; no
  abbreviations invented.
- **§7 Dependency Discipline** — PASS. Sole hard-dep WP-440 is **Done** on
  `main` (not in-flight); no other WP dependency.
- **§8 Architectural Boundaries** — PASS. App layer; `vue` sole runtime dep;
  registry type-only devDep (bundle grep-asserted); no server/persistence/
  snapshot reach; `groupGauntletsBySet` contract preserved.
- **§9 Windows Compatibility** — PASS. No shell scripts authored; `pnpm` +
  `grep` verification only.
- **§10 Environment Variable Hygiene** — PASS. No new env access (the download
  reads no `import.meta.env`; it builds bytes from in-memory index data).
- **§11 Authentication Clarity** — N/A. No auth surface; legends is a zero-auth
  public board and the download is a client-built token with no credential.
- **§12 Test Quality** — PASS. `node:test`, `.test.ts`, no `boardgame.io/testing`,
  no live server; non-vacuous identity-only key assertion + pin no-mutation
  assertion.
- **§13 Commands & Verification** — PASS. Exact `pnpm`/`grep` commands with
  expected output, incl. the zero-API bundle grep.
- **§14 Acceptance Criteria Quality** — PASS. Binary, observable checks naming
  real symbols/values and the exact filename strings.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface` is the
  named legends surface, so the DoD carries the **D-24026 live-verification**
  item (operator-pending on the Pages deploy), plus the `typecheck` gate
  (App-package requirement).
- **§16 Code Style** — PASS. Small pure functions, explicit control flow, JSDoc,
  `// why:` on the showcase constants / inline `pack_version` / URL revoke,
  named exports.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §20–26 touched
  (leaderboard-adjacent); "No conflict"; NG proximity checked (none).
- **§18 Prose-vs-Grep Discipline** — PASS. The one count-bounded grep gate
  (`legendary-arena/registry` = 0 matches in `dist`) targets a build artifact,
  not this repo's source prose, so no source comment can inflate it; the WP/EC
  prose that names the token refers to `package.json`/source, never `dist`.
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge/adapter reconciliation; the
  baseline SHA `01ec0a27` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  donate/tournament-funding copy, or funding channel — the WP adds a gauntlet
  download control and a display reorder.
- **§21 API Catalog Update** — N/A. App-layer only: adds no `apps/server` HTTP
  endpoint and no `apps/server/src/**` `Library-only` function; the download is
  a client Blob with no server call. (WP-5 will trigger §21 when it adds the
  import endpoint.)

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
