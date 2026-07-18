# EC-423 — Registry Version + Per-Set Content Hash (Execution Checklist)

**Source:** docs/ai/work-packets/WP-393-registry-version-content-hash.md
**Layer:** Registry

## Before Starting
- [ ] **Scope lock — these 11 files and no others** (identical to Files to Produce):
      `canonicalJson.{ts,test.ts}`, `registryHash.test.ts`, `types/index.ts`,
      `impl/httpRegistry.ts`, `impl/localRegistry.ts`, DECISIONS.md, 00.2, STATUS.md,
      WORK_INDEX.md, EC_INDEX.md. Anything else = STOP.
- [ ] `git rev-parse origin/main` recorded in the session log
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] `pnpm -r build` exits 0 (baseline before any edit)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 (baseline). The viewer
      package is **`registry-viewer`, UNSCOPED** — `@legendary-arena/registry-viewer`
      matches zero projects and exits 0 without running `vue-tsc`. REQUIRED
      separately from `build`, which is esbuild and does NOT type-check.
- [ ] Confirmed `RegistryInfo` still lacks `registryVersion` (not landed by another branch)
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit
- [ ] Note there are TWO vendored `RegistryInfo` copies in `apps/registry-viewer`
      (`src/registry/types/index.ts`, `src/registry/types/types-index.ts`).
      Neither is edited by this WP — that drift is accepted per D-24197.

## Locked Values (do not re-derive)
- Both fields are **OPTIONAL** on `RegistryInfo` — `apps/registry-viewer` vendors its
  own copy (`src/registry/types/index.ts`); required fields would drift it silently
- Field names, verbatim: `registryVersion`, `setContentHashes`
- Hash prefix, verbatim: `sha256:` (lowercase hex digest follows)
- `setContentHashes` is keyed by **set abbreviation** (`abbr`), not `id`, not `slug`
- Canonicalization is **RFC 8785 (JCS)** — sorted keys, UTF-8, no insignificant
  whitespace, RFC 8785 number form. Not "JSON.stringify with sorted keys."
- `registryVersion` = sha256 over the per-set hashes **sorted by abbr ascending**,
  concatenated as `<abbr>:<hash>` joined by `\n`
- **AC-2 parity technique (locked):** both fixtures are built IN-TEST — set JSON
  written under `node:os` `tmpdir()` for the local loader, and the same parsed
  payload served by a `globalThis.fetch` stub installed and restored inside the
  test. The stub MUST answer **both** the set-index URL and each per-set URL —
  `createRegistryFromHttp` requests both, and a stub covering only the per-set
  route lets the index request hit the real network. No fixture file is added
  to the repo; any request reaching the network is a FAIL, as is a parity
  assertion that never calls `createRegistryFromHttp`.
- Hash the **parsed set object**, never the raw response bytes — HTTP and local
  loaders must agree for identical data

## Guardrails
- `packages/registry` may import Node built-ins and `zod` ONLY. No `game-engine`,
  no `server`, no `apps/*`, no `pg`.
- No gameplay logic. This packet computes hashes and returns strings.
- Do NOT expose raw set JSON, buffers, or the canonical string on the public
  surface — hashes only.
- Both loaders change together. A hash implemented in one loader only is a FAIL.
- `RegistryInfo` is a hand-authored contract: the D-24197 entry is required in
  the same commit as the type change.
- No `.reduce()` for the multi-step hash accumulation — explicit `for...of`.
- Full English names — no `cfg`, `res`, `hash1`. `for (const setAbbr of sortedSetAbbrs)`.

## Required `// why:` Comments
- `canonicalJson.ts`: why RFC 8785 rather than `JSON.stringify` with sorted keys
  (two tools must agree byte-for-byte; stringify leaves number form and
  escaping unspecified)
- Both loaders, at the hash call: why the **parsed object** is hashed rather
  than the raw bytes (HTTP and local paths deliver different bytes for
  identical data)
- `registryVersion` derivation: why sorted-by-abbr (load order must not change
  the version)

## Files to Produce
- `packages/registry/src/canonicalJson.ts` — **new** — RFC 8785 serializer
- `packages/registry/src/canonicalJson.test.ts` — **new** — RFC 8785 worked examples
- `packages/registry/src/registryHash.test.ts` — **new** — loader parity + stability
- `packages/registry/src/types/index.ts` — **modified** — two `RegistryInfo` fields
- `packages/registry/src/impl/httpRegistry.ts` — **modified** — hash on load
- `packages/registry/src/impl/localRegistry.ts` — **modified** — hash on load
- `docs/ai/DECISIONS.md` — **modified** — D-24197 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — both field names
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`

## After Completing
- [ ] AC-1..AC-8 each demonstrated with observed output, not asserted
- [ ] Registry suite green; `pnpm -r build` 0
- [ ] D-24197 landed **Active** (not "Drafted")
- [ ] `00.2-data-requirements.md` updated
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `git diff --name-only` matches the scope lock exactly — no extra files
- [ ] WORK_INDEX row flipped `[ ]` → `[x]`; EC_INDEX Status → `Complete`

## Common Failure Smells
- HTTP and local hashes differ → raw bytes were hashed, not the parsed object
- Hash changes between runs on unchanged data → key order leaked in (canonicalizer bug)
- `registryVersion` changes when sets load in a different order → sort was skipped
- Registry suite green but `pnpm -r build` red → a canonical `RegistryInfo` consumer broke
- Loader parity test fails on an empty HTTP registry → `eagerLoad` was not passed
  (the HTTP loader defaults to `options.eagerLoad ?? []` = ZERO sets)
- The viewer's vendored `RegistryInfo` was edited → out of scope, revert it
- `No projects matched the filters` on the viewer typecheck → wrong filter
  (`registry-viewer` is unscoped). A typecheck that did not run is a FAIL.
- `registryVersion` present on a zero-set registry → the empty-scope omission
  rule was skipped; a digest over nothing is never emitted
