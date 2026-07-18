# WP-393 — Registry Version + Per-Set Content Hash Surface (Registry)

**User-Visible Surface:** none — infrastructure

## Goal

`CardRegistry` reports **which card data it actually loaded**: a per-set
content hash over the parsed set object, plus a derived digest identifying
that exact load scope. Today a consumer can read every card but cannot pin,
verify, or reproduce the snapshot those cards came from. This WP adds that
surface and nothing else. Payoff: WP-394 can anchor LAGN provenance to real
evidence instead of an unverifiable file name.

## User-Visible Impact

None. No endpoint, no UI, no gameplay, no persisted value changes. The only
observable difference is two additional read-only fields on an in-process
object. `docs/ai/STATUS.md` records: *No user-observable change —
infrastructure only.*

## Assumes

- `packages/registry` owns card-data loading and validation and exposes an
  immutable `CardRegistry` — `.claude/rules/architecture.md §Registry Layer`.
- Both loaders exist and must stay behaviourally paired:
  `createRegistryFromHttp` (`impl/httpRegistry.ts:42`) and
  `createRegistryFromLocalFiles` (`impl/localRegistry.ts:43`).
- `RegistryInfo` is a hand-authored contract at
  `packages/registry/src/types/index.ts:118`; that file's header states
  changes to registry interfaces require a `DECISIONS.md` entry.
- **The HTTP loader loads only `options.eagerLoad ?? []`** — defaulting to
  **zero sets** (`impl/httpRegistry.ts:98`) — while the local loader loads
  every card file on disk (`impl/localRegistry.ts:102`). Load scope is a
  caller decision, not a property of the data. This drives the whole
  `registryVersion` semantics below.
- **`apps/registry-viewer` vendors its own copy of `RegistryInfo`**
  (`apps/registry-viewer/src/registry/types/index.ts:61`, plus a second at
  `src/registry/types/types-index.ts:103`) and returns it from its own
  `httpRegistry.ts:76`. Structurally independent types — no import of the
  canonical one, no `implements`/`extends` edge — not implementers.
- A **different** `dataVersion` field already exists in the published
  `registry-info.json` artifact (`packages/registry/scripts/upload-r2.ts:110`).
  It is not this field and is not touched — see §Non-Negotiable Constraints.
- Node 22+ — `node:crypto` `createHash` available; no new dependency.
- Draft baseline: `origin/main` @ `06dda61d`.

## Context (Read First)

Read in this order before editing:

1. `.claude/CLAUDE.md` — operating posture, authority chain.
2. `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — Registry
   responsibilities and the downward-only dependency direction.
3. `.claude/rules/architecture.md §Registry Layer` — what the layer may and
   may not do.
4. `.claude/rules/code-style.md` and
   `docs/ai/REFERENCE/00.6-code-style.md` — naming, `.reduce()` ban,
   `// why:` requirements, error-message form.
5. `docs/ai/REFERENCE/00.2-data-requirements.md §7 (Match Configuration)`
   and its field-naming rules — this WP adds two canonical field names and
   must register them there.
6. `docs/ai/DECISIONS.md` — scan D-24197 (reserved by this WP). No prior
   D-entry governs registry hashing; verified by scan at draft.
7. `packages/registry/src/impl/httpRegistry.ts` and `impl/localRegistry.ts`
   — the two load paths whose scopes differ.

**Why now.** Reviewing a proposed LAGN provenance extension surfaced that its
load-bearing item — `{registry_version, registry_hash}` — has no source to
read. Verified at draft: `RegistryInfo` is `{ totalSets, totalHeroes,
totalCards, loadedSetAbbrs, metadataBaseUrl }`; `SetIndexEntry` is `{ id,
abbr, pkgId, slug, name, releaseDate, type }`; `git grep
registryVersion|content_hash|sha256` over `packages/registry/src` returns
nothing. WP-394 is blocked on this, and the LAGN side must not reach up into
registry internals to compute hashes itself — that would invert the
dependency direction.

**Supersession check (01.0a §Step 2).** `WP-314` / `EC-344`
(`diagnostic-effect-provenance`) match on *provenance* but are engine-side
diagnostic export — recorded false-positive near-collision.

## Design Rationale

**Hash the parsed object, not the bytes.** The HTTP and local loaders receive
different bytes for identical data (whitespace, key order, transfer
encoding). Hashing raw responses would make identical card data hash
differently depending on how it was loaded, defeating the purpose.

**Canonicalization is RFC 8785 (JCS), not sorted-key `JSON.stringify`.**
Stringify leaves number formatting, Unicode escaping, and string
normalization unspecified, so two conforming implementations can disagree
byte-for-byte. A hash two tools compute differently is worse than no hash —
it fails closed on valid data.

**`registryVersion` identifies the load scope, and that is deliberate.**
It is derived from the per-set hashes of the sets **actually loaded**, sorted
by abbreviation, so a process that eager-loads two sets and one that loads
forty produce different values. That is the correct provenance property: a
consumer needs to know *what the producer saw*, not what existed somewhere.
It is therefore **not** a global "registry snapshot id", and WP-394 must not
describe it as one — the authoritative per-set evidence is
`setContentHashes`. AC-5 pins this property explicitly so it cannot be
quietly reinterpreted later.

**Optional, not required, on `RegistryInfo`.** The viewer's vendored copy
means "no external implementer" is false. Adding required fields to the
canonical type would leave the vendored copy silently lacking them —
`pnpm -r build` stays green, so it is drift, not a caught break. The fields
are therefore optional on the canonical type, populated by both loaders, and
the viewer syncs its copy only if and when it needs provenance. That is
recorded as accepted drift rather than discovered later.

## Scope (In)

- Add optional `registryVersion?: string` and
  `setContentHashes?: Record<string, string>` to the canonical `RegistryInfo`
  (keyed by set abbreviation, values `sha256:<hex>`).
- New `packages/registry/src/canonicalJson.ts` — RFC 8785 (JCS) serializer.
  It is the shared canonicalization contract the **producer-wiring** packet
  hashes against (WP-394 itself computes no hashes — it validates hash
  *shape* only).
- Populate both fields in **both** loaders, over the canonical serialization
  of the parsed set object.
- Derive `registryVersion` from the loaded per-set hashes sorted by
  abbreviation ascending, joined `<abbr>:<hash>` by newline, then hashed.
- Tests: RFC 8785 conformance; loader parity **for an explicitly equal load
  scope**; hash changes on card change; version independent of load *order*;
  version differs across load *scope*.

## Out of Scope

- Any LAGN change — that is WP-394.
- Exposing raw set JSON, buffers, or the canonical string on the public
  surface.
- Any change to card data, schemas, or the card pipeline.
- The existing `dataVersion` in `scripts/upload-r2.ts` — untouched.
- `apps/registry-viewer`'s vendored `RegistryInfo` copy — deliberately not
  synced (accepted drift, D-24197).
- Persisting hashes to a database or publishing them over HTTP.
- Consumer wiring — no consumer is added in this packet.

## Files Expected to Change

- `packages/registry/src/canonicalJson.ts` — **new** — RFC 8785 serializer.
- `packages/registry/src/canonicalJson.test.ts` — **new** — RFC 8785 examples.
- `packages/registry/src/registryHash.test.ts` — **new** — parity + stability.
- `packages/registry/src/types/index.ts` — **modified** — two optional fields.
- `packages/registry/src/impl/httpRegistry.ts` — **modified** — hash on load.
- `packages/registry/src/impl/localRegistry.ts` — **modified** — hash on load.
- `docs/ai/DECISIONS.md` — **modified** — D-24197 lands Active.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — both names.
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → Complete.

## Non-Negotiable Constraints

- **ESM only; Node v22+.** No `require()`, no CommonJS. `node:` prefix on all
  built-in imports.
- **Full file contents** in responses — never diffs, never elided snippets.
- Code style per `docs/ai/REFERENCE/00.6-code-style.md`: full English names
  (no `cfg`/`res`/`hash1`), JSDoc on every function, no `.reduce()` for the
  multi-step hash accumulation — explicit `for...of`.
- `packages/registry` may import **Node built-ins and `zod` only**. No
  `game-engine`, no `server`, no `apps/*`, no `pg`.
- **Empty load scope emits nothing.** When zero sets are loaded, BOTH fields
  are **omitted** (left `undefined`) — that is what their optionality is for.
  A sha256 over an empty input looks like a real digest, would satisfy
  WP-394's `startsWith('sha256:')`, and would let an audit bundle claim
  provenance over nothing. Never emit a digest over an empty scope.
- **Compute once, return a copy.** Hashes are computed during loader
  construction after all eager loads settle, and cached. `info()` returns a
  **fresh** `setContentHashes` object each call — never the cached internal
  reference (the registry is immutable; handing out the live map breaks that).
- **`setContentHashes` key order is unspecified.** The HTTP loader populates
  its set map in network-completion order. Never rely on `Object.keys()`
  order; tests compare by key lookup, never by stringified equality.
- **Locked values** (verbatim, do not re-derive): field names
  `registryVersion` / `setContentHashes`; prefix `sha256:`;
  `setContentHashes` keyed by set **`abbr`**; canonicalization **RFC 8785
  (JCS)**; version input `<abbr>:<hash>` joined by `\n`, sorted by abbr
  ascending.
- Both loaders change together. A hash implemented in one loader only is a
  FAIL.
- Do not rename, repurpose, or read `dataVersion` from
  `scripts/upload-r2.ts` — different field, different semantics.
- The public surface exposes **hashes only** — never raw JSON, buffers, or
  the canonical string.

## Contract

```ts
export interface RegistryInfo {
  totalSets:         number
  totalHeroes:       number
  totalCards:        number
  loadedSetAbbrs:    string[]
  metadataBaseUrl:   string
  /** setAbbr → sha256 over that set's RFC 8785 canonical JSON. */
  setContentHashes?: Record<string, string>
  /**
   * sha256 over the LOADED sets' hashes, sorted by abbr.
   * Identifies the load scope, NOT a global registry snapshot.
   */
  registryVersion?:  string
}
```

## Vision Alignment

- **Vision clauses touched:** §22 (Deterministic Eval) — a reproducible,
  load-order-independent version string.
- **Conflict assertion:** No conflict. This WP adds read-only derived data
  and changes no gameplay, randomness, or replay behavior.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..8 are crossed.
- **Determinism preservation:** No RNG added or removed. No engine surface,
  no `G`, no sentinel or `finalStateHash` input. Hashing is pure over
  already-parsed data; identical input yields an identical digest.

## Funding Surface Gate

**N/A — declared, not inferred.** This WP adds no pricing, billing,
entitlement, quota, paywall, or revenue-affecting surface. It is an
in-process read-only field pair on a registry object with no consumer.

## API Catalog Update

**N/A — declared, not inferred.** This WP adds, modifies, and removes **no**
HTTP endpoint on `apps/server`, and adds no `apps/server`-reachable
library-only function recorded in `docs/ai/REFERENCE/api-endpoints.md`. The
new fields live on an in-process object; `apps/server/src/server.mjs:371`
calls `registry.info()` but reads none of the new fields and is untyped
`.mjs`. No catalogue row changes.

## Empirical Scaffold (01.4)

**N/A — declared, not inferred.** `01.4 §Empirical Scaffold` fires for WPs that
add or tighten validation on an existing input path, where previously-accepted
data becomes newly-rejected. This WP rejects nothing: it adds two **optional**
read-only fields to an object no caller currently constructs outside the two
loaders, parses no new input, and narrows no existing type. There is no
input path whose acceptance could change, so there is nothing for a scaffold
run to observe. (Contrast WP-394, where the gate does fire and a scaffold is
REQUIRED.)

## Acceptance Criteria

- **AC-1** — for a **non-empty** load scope, `info()` returns
  `registryVersion` and `setContentHashes` from both loaders. (Zero scope is
  AC-5b.)
- **AC-2** — for byte-identical set data **and an explicitly equal load
  scope** (the HTTP loader given an `eagerLoad` list naming exactly the sets
  the local fixture holds), both loaders produce **identical**
  `setContentHashes` and an identical `registryVersion`.
- **AC-3** — changing any card field changes that set's hash and the
  `registryVersion`.
- **AC-4** — `registryVersion` is independent of set **load order**.
- **AC-5** — `registryVersion` **differs** when the load **scope** differs
  (two sets vs one), and `setContentHashes` for a commonly-loaded set is
  **identical** across those two scopes. This pins the semantics WP-394
  depends on.
- **AC-5b** — with **zero** sets loaded, `registryVersion` and
  `setContentHashes` are both `undefined` — not a digest over empty input.
- **AC-6** — canonicalization is RFC 8785: sorted keys, UTF-8, no
  insignificant whitespace, spec number form. Unit-tested against the RFC's
  worked examples.
- **AC-7** — no `packages/registry` import of `game-engine`, `server`, or
  any `apps/*`; `pnpm -r build` exits 0.
- **AC-8** — `apps/registry-viewer` **builds and passes `vue-tsc` typecheck**
  unchanged; neither vendored `RegistryInfo` copy is edited. The typecheck is
  the load-bearing half — `vite build` does not type-check.

## Verification Steps

```bash
pnpm --filter @legendary-arena/registry build
# expected: exit 0, no TS errors

pnpm --filter @legendary-arena/registry test
# expected: exit 0; suite count increases by the new canonicalJson +
# registryHash blocks; 0 failing

pnpm --filter registry-viewer build
# expected: exit 0

pnpm --filter registry-viewer typecheck
# expected: exit 0 — AC-8. REQUIRED separately: `build` is `vite build`
#           (esbuild), which does NOT type-check. Only `vue-tsc --noEmit`
#           proves the vendored RegistryInfo copies still compile.
#   NOTE: the viewer package is named `registry-viewer` — UNSCOPED. Filtering
#   `@legendary-arena/registry-viewer` matches zero projects, exits 0, and
#   silently disarms this AC. `No projects matched the filters` is a FAIL.

pnpm -r build
# expected: exit 0 across all packages

grep -rnE "from '(@legendary-arena/(game-engine|server)|pg)'" packages/registry/src
# expected: no matches, exit 1 — AC-7 forbidden-import check (`pnpm -r build`
#           alone will not catch a resolvable-but-forbidden import)

git diff --name-only
# expected: exactly the 11 files in §Files Expected to Change, no others
```

## Definition of Done

- All ACs pass with observed output recorded, not asserted.
- Registry suite green; `pnpm -r build` 0; viewer build 0.
- `git diff --name-only` contains **no** file outside §Files Expected to
  Change.
- D-24197 landed **Active** in `DECISIONS.md`.
- `00.2-data-requirements.md` carries both canonical field names.
- `docs/ai/STATUS.md` states: *No user-observable change — infrastructure
  only.*
- WORK_INDEX row `[ ]` → `[x]`; EC_INDEX Status → `Complete`.

## Reserved Decision (lands at execution)

**D-24197** — the registry reports its own snapshot: reproducible version
string + per-set content hashes over RFC 8785 canonical JSON; fields optional
because the viewer vendors its own copy.

## Pre-Flight Resolutions (01.4)

First pre-flight run returned **NOT READY** with six blocking items against
this WP. All resolved in-place:

- **PS-2 (vendored `RegistryInfo`)** — the "no external implementer" claim
  was false; `apps/registry-viewer` vendors its own copy. Fields are now
  **optional**, the drift is recorded in §Design Rationale + D-24197, and
  AC-8 asserts the viewer is untouched and still builds.
- **PS-3 (loader parity unsatisfiable)** — the HTTP loader defaults to
  `eagerLoad ?? []` (zero sets). AC-2 now conditions parity on an explicitly
  equal load scope.
- **PS-4 (`registryVersion` semantics)** — it is load-scope-dependent. Rather
  than paper over it, the property is now stated in §Design Rationale, pinned
  by new **AC-5**, and WP-394 is corrected to stop calling it a snapshot pin.
- **PS-1 / PS-7** — `## Vision Alignment` and the lint self-review added.
- **RS-3** — the pre-existing `dataVersion` in `scripts/upload-r2.ts` is now
  named in §Assumes and fenced in §Non-Negotiable Constraints.

## Lint Gate Self-Review (00.3)

All 21 sections resolved. Highlights:

- **§1/§2** — full section structure present incl. `## Non-Negotiable
  Constraints` and `## Context (Read First)`.
- **§4** — Context lists the seven read-first inputs with section numbers.
- **§5** — every file carries a `— new` / `— modified` marker; 11 files.
- **§6** — two new canonical names registered in `00.2`; §Files + DoD commit
  to the edit.
- **§7** — no new dependency (`node:crypto`).
- **§12** — tests are `node:test` + `node:assert` only, no network, no DB;
  AC-2's parity fixture is local.
- **§13** — every Verification Step carries expected output; all commands
  use `pnpm`.
- **§15/§15.1** — DoD includes STATUS.md, the infrastructure-only wording,
  and the scope-boundary check.
- **§16** — `00.6-code-style.md` cited in §Context and §Non-Negotiable
  Constraints.
- **§17** — `## Vision Alignment` present with the determinism line.
- **§20** — Funding Surface Gate **N/A, declared**.
- **§21** — API Catalog **N/A, declared** with the reasoning.
- **§11/§18/§19** — N/A: no auth surface; no literal-string grep step; a
  commit-time concern.
