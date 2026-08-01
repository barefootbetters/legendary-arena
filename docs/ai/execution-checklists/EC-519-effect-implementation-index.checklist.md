# EC-519 — Effect Implementation Index (Execution Checklist)

**Source:** docs/ai/work-packets/WP-484-effect-implementation-index.md
**Layer:** Shared tooling (`scripts/`) + Registry (`packages/registry`) + Metadata staging (`data/metadata/`)

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Hero ledger exists + hero-scoped: `node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); process.exit(d.cardType==='hero'&&Array.isArray(d.rows)?0:1)"` → exit 0
- [ ] Villain ledger exists + villain-scoped: `node -e "const d=require('./docs/ai/coverage/villain-mechanic-ledger.json'); process.exit(d.cardType==='villain'&&Array.isArray(d.rows)?0:1)"` → exit 0
- [ ] BOTH ledgers populate handler provenance for resolved rows: `node -e "const h=require('./docs/ai/coverage/hero-mechanic-ledger.json'),v=require('./docs/ai/coverage/villain-mechanic-ledger.json'); process.exit(h.rows.some(r=>r.status==='executable'&&r.handler)&&v.rows.some(r=>r.status==='executable'&&r.handler)?0:1)"` → exit 0
- [ ] Metadata staging + schema export site present: `test -f data/metadata/card-mechanics.json && test -f packages/registry/src/schema.ts` → OK
- [ ] No feed yet: `test -f data/metadata/effect-implementation-index.json` → **ABSENT** on a first run. If PRESENT, inspect `git status` + provenance; continue ONLY if it is this WP-branch's own regenerated artifact. STOP if it came from another branch / WP / abandoned attempt.
- [ ] Working tree clean except for this WP

## Locked Values (do not re-derive)
- Published path: exactly `data/metadata/effect-implementation-index.json`; R2 `/metadata/effect-implementation-index.json`
- Schema export: `EffectImplementationIndexSchema` from `@legendary-arena/registry/schema`
- Contract: `{ version:1, scope:"all", generatedAt, summary:{totalEntries,byScope,byStatus}, entries:[{extId,name,set,scope,mechanic,status,handler,wp,decision}], cards:{ extId:{scope,mechanics:[]} } }`
- Entry `scope` closed union: `hero` | `villain`; top-level `scope` is the literal `"all"`
- `status` closed union: `executable` | `deferred` | `condition` | `unsupported` | `unmarked`
- `handler`/`wp`/`decision`: **verbatim ledger pass-through**, `""` when the ledger row is blank — NEVER synthesized/inferred/fabricated. Both ledgers populate provenance for resolved rows; `""` occurs only on `unsupported`/`unmarked` rows (both scopes)
- `mechanic`: the ledger token **verbatim** — NOT normalized (the villain `(unmarked)` sentinel stays literal); token normalization is `card-mechanics.json`'s job, not this index's
- `name` normalization: hero row `heroName` OR villain row `cardName` → `name` (the only cross-ledger field-name divergence)
- `generatedAt` sentinel: `"1970-01-01T00:00:00.000Z"` (neither ledger has a timestamp; resolution chain in WP-484 Contract)
- Output ordering: locked top-level + per-entry property order; `entries[]` sorted by `(extId, mechanic)`; `cards{}` keys + each `mechanics[]` sorted + de-duped; `byStatus` keys emitted in the fixed 5-value union order (zero counts as `0`); 2-space indent + trailing newline
- Transform self-validates output via `EffectImplementationIndexSchema` (from `../packages/registry/dist/schema.js`) before write/compare
- Schema rejects (`.superRefine`): wrong `version`, non-`all` top-level scope, bad entry `scope`/`status`, `summary` count mismatch, both join directions, `cards[].scope` disagreement
- `summary.totalEntries === entries.length`; `byScope`/`byStatus` are exact tallies over `entries`
- npm scripts: `effect-index`, `effect-index:check`
- DECISIONS reservation: **D-24289**

## Guardrails
- `packages/registry/src/schema.ts` MUST NOT import `@legendary-arena/game-engine` (or any non-`zod`, non-Node module) — schema is data-only
- The transform reads ONLY the two committed JSON ledgers + the registry dist schema (self-validation). It MUST NOT import the game-engine dist or any `packages/**` runtime module — this join needs no source classification
- Transform is **deterministic**: no `Date.now()`/wall-clock; `generatedAt` derives from input; identical input ⇒ byte-identical output; `--check` regenerates in memory (CRLF-normalized) + exits non-zero on drift
- `handler`/`wp`/`decision` pass-through ONLY — verbatim ledger value or `""`; never fabricate a handler path or decision id the ledger lacks (the honesty constraint; AC-5)
- `for...of` join/group (no `.reduce()` with branching); full-sentence errors
- Do NOT touch any `packages/game-engine`, `apps/registry-viewer`, `apps/dashboard`, or `apps/arena-client` file — no `/debug/effects` viewer, no engine metadata, no runtime tracing (all future WPs)
- Emit BOTH scopes; top-level `scope` is the literal `"all"` — a hero-only/villain-only feed duplicates existing artifacts
- If either ledger shape changed (no `rows[]` / wrong `cardType` / missing row fields): STOP and reconcile
- If `--check` can't be made byte-stable: STOP and fix the ordering (explicit sort), not the gate

## Required `// why:` Comments
- On `generatedAt` being the input-derived fixed sentinel (determinism / `--check` byte-stability).
- On the `handler`/`wp`/`decision` empty-string pass-through (surface the ledger verbatim; never fabricate — both ledgers populate provenance for resolved rows, and `unsupported`/`unmarked` rows carry `""` in both scopes).
- On the transform reading only committed JSON ledgers (build script; explains why no game-engine dist import is needed here, unlike `build-card-mechanics-metadata.mjs`).
- On the transform self-validating its output against `EffectImplementationIndexSchema` (producer and schema can never drift apart).
- On the fixed-order `byStatus` keys (a zero-count status is still emitted, so the shape is stable across card-data changes).

## Files to Produce
- `scripts/build-effect-implementation-index.mjs` — **new** — two-ledger join transform + `--check` (self-validates output against the schema)
- `data/metadata/effect-implementation-index.json` — **new** — generated artifact (committed)
- `packages/registry/src/schema.ts` — **modified** — additive `EffectImplementationIndexSchema` + types (`.superRefine` join + count invariants)
- `packages/registry/src/schema.effectImplementationIndex.test.ts` — **new** — `node:test` accept/reject coverage (mirrors `schema.cardMechanicsIndex.test.ts` naming)
- `package.json` — **modified** — `effect-index(:check)` scripts
- `.github/workflows/ci.yml` — **modified** — freshness gate step in `hero-effect-coverage` (after `pnpm -r build`)
- `docs/ai/DECISIONS.md` — **modified** — land D-24289 (Status → Active)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-484 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS states "No user-observable change — infrastructure only")

## After Completing
- [ ] `pnpm effect-index` → file with `version:1`/`scope:"all"`/`generatedAt`/`summary`/`entries[]`/`cards{}`
- [ ] Per-entry: `scope`∈{hero,villain}, `status`∈closed union, sorted by `(extId,mechanic)`; both scopes present (`byScope.hero>0 && byScope.villain>0`)
- [ ] Pass-through: ≥1 executable hero entry AND ≥1 executable villain entry each have a `<file>#<primitive>` handler; no `handler`/`wp`/`decision` is `null` (blanks are `""`, only on `unsupported`/`unmarked` rows)
- [ ] `summary.totalEntries===entries.length`; all five `byStatus` keys present
- [ ] Bidirectional join: every `entries[]` `(extId,mechanic)` ∈ `cards[extId].mechanics` AND vice-versa; `cards[].scope` matches its entries
- [ ] `grep -n 'game-engine' packages/registry/src/schema.ts scripts/build-effect-implementation-index.mjs` → **NO MATCH**
- [ ] `pnpm --filter @legendary-arena/registry test` → exit 0 (schema accept + reject tests)
- [ ] `pnpm effect-index:check` → exit 0 clean; non-zero after a deliberate edit
- [ ] Determinism: two runs byte-identical (`diff -q`)
- [ ] `git diff --name-only | grep -E '^(packages/game-engine|apps/(registry-viewer|dashboard|arena-client))/'` → **NO MATCH**
- [ ] `pnpm -r build` + `pnpm test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP-MINDMAP node `✅` + counts refreshed; D-24289 landed (Active)
- [ ] Commit prefix: `EC-519:` (code) + `SPEC:` (governance)

## Common Failure Smells
- `--check` flaps run-to-run → nondeterministic ordering; add explicit `.sort()` on `entries` `(extId,mechanic)` + `cards` keys, derive `generatedAt` from input
- A `handler`/`decision` differs from the ledger's own value → you didn't pass through verbatim; emit exactly what the ledger row carries (populated for resolved rows in BOTH scopes; `""` only where the ledger row is blank, i.e. `unsupported`/`unmarked`)
- A `mechanic` value got normalized (e.g. `(unmarked)` → `unmarked`) → wrong; carry the ledger token verbatim (that normalization is `card-mechanics.json`'s job, not this index's)
- `byStatus` drops a zero-count status → emit all five keys in fixed order so the shape is stable
- Schema pulls Node/engine modules into the viewer build later → an import leaked into `schema.ts`; keep it `zod`-only
- `summary.totalEntries` ≠ `entries.length` → count computed off a pre-filter list; tally the final `entries`
- Only one scope present → you read one ledger; the transform MUST read + merge BOTH
- A test checks `null` handler → wrong; blank is `""` (empty string), never `null`
