# WP-084 — Delete Unused Auxiliary Metadata Schemas and Files

**Status:** Draft — amended 2026-04-21 per pre-flight findings (amendment
A-084-01). Awaiting Gate 2+3 re-run + author approval.
**Primary Layer:** Registry (`packages/registry/**`) + Content / Data
(`data/metadata/`) + Registry Viewer dead-code cleanup
(`apps/registry-viewer/src/registry/impl/localRegistry.ts` + its
re-export only — viewer runtime code untouched) + Docs sweep
(`docs/**` + `docs/ai/REFERENCE/**`)
**Schema Version:** 1
**Last Updated:** 2026-04-21 (A-084-01 amendment)
**Dependencies:** None. Independent of WP-082 and WP-083.

---

## Session Context

A 2026-04-21 audit of the registry-viewer's R2 fetch paths discovered
that five metadata schemas and their corresponding JSON files are
defined in the monorepo but **not consumed by any runtime loader** —
neither by the server (`createRegistryFromLocalFiles`), the viewer
(`createRegistryFromHttp`, `themeClient`, `glossaryClient`), the game
engine, nor the pre-planning package. Their sole consumer is
`packages/registry/scripts/validate.ts` Phase 2, an opt-in manual
validation script that is **not** wired to `pnpm build` or `pnpm test`
and does not run in CI.

The five dormant pairs:

| JSON file | Zod schema | Current consumers |
|---|---|---|
| `data/metadata/card-types.json` | `CardTypeEntrySchema` (`schema.ts:51`) | `validate.ts:50, 371` only |
| `data/metadata/hero-classes.json` | `HeroClassEntrySchema` (`schema.ts:61`) | `validate.ts:51, 372` only |
| `data/metadata/hero-teams.json` | `HeroTeamEntrySchema` (`schema.ts:70`) | `validate.ts:52, 373` only |
| `data/metadata/icons-meta.json` | `IconEntrySchema` (`schema.ts:79`) | `validate.ts:53, 374` only |
| `data/metadata/leads.json` | `LeadsEntrySchema` (`schema.ts:89`) | `validate.ts:54, 375` only |

Additionally, `data/metadata/card-types-old.json` is confirmed
orphaned — zero references anywhere in `apps/`, `packages/`,
`scripts/`, or the five phases of `validate.ts`.

**Post-pre-flight audit (A-084-01 amendment, 2026-04-21):** the initial
2026-04-21 audit missed four additional orphan / drift artifacts that
the 01.4 pre-flight surfaced. These are in scope per the amendment:

1. **Viewer duplicate `localRegistry.ts`** —
   `apps/registry-viewer/src/registry/impl/localRegistry.ts` is a
   drifted duplicate of the main registry's `localRegistry.ts`, still
   carrying the exact WP-003 Defect 1 silent-failure bug
   (reads `card-types.json` as a set index; D-1203). Confirmed dead
   code: zero imports across the repo, never invoked by CI, absent
   from the viewer's `dist/` bundle, unchanged since initial commit
   `d5ea067` (2026-03-23). CLAUDE.md's "CI validation" label is
   aspirational.
2. **`00.2-data-requirements.md` §§2.1 / 2.3 / 2.4 / 2.5 / 2.6** —
   active contract mentions of the five deleted files (sections
   defining each as a current required input with schema reference).
   Per EC-109 Gate 3.2: "Active contract mentions are a BLOCKER
   until `00.2` is amended under a separate DECISIONS entry." The
   amendment folds this edit into WP-084 so the decision + code +
   docs land atomically.
3. **Legacy `scripts/Validate-R2-old.ps1`** — PowerShell validator
   superseded by `scripts/validate-r2.mjs` (Node variant) and
   `packages/registry/scripts/validate.ts` (tsx variant). File name
   admits `-old`; references all five target filenames in its
   docstring. Deleted as orphan, mirroring the `card-types-old.json`
   deletion already in scope.
4. **Current-state docs sweep** — `docs/01-REPO-FOLDER-STRUCTURE.md`,
   `docs/03-DATA-PIPELINE.md`, `docs/08-DEPLOYMENT.md`,
   `docs/10-GLOSSARY.md`, `docs/11-TROUBLESHOOTING.md`,
   `docs/ai/ARCHITECTURE.md`, `docs/ai/REFERENCE/00.5-validation.md`,
   `docs/ai/deployment/r2-data-checklist.md`,
   `docs/prompts-registry-viewer/*.md` all reference the five
   filenames as current-state data. One-to-few-line edits per file
   to historicize or remove. Historical WP / EC artifacts
   (`docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`, `WP-015*`,
   `WP-017*`, `WP-042*`, `WP-043*` and
   `docs/ai/execution-checklists/EC-003*`, `EC-014A*`) and external
   archive `prompts-legendary-area-game/*` are **excluded** from the
   acceptance-criterion grep — they are execution records and must
   not be rewritten.

Runtime consumers get the data they need from other sources:

- **Game engine** — receives card-type classification as runtime state
  in `G.villainDeckCardTypes`, built from per-set data at setup time;
  never reads `card-types.json`
- **Registry viewer** — displays `card.team` and `card.hc` directly
  from per-set JSON; hero-class tooltips are hardcoded in
  `useRules.ts` `HERO_CLASS_GLOSSARY` (five entries), not fetched from
  `hero-classes.json`
- **`httpRegistry.ts`** — fetches only `sets.json` and per-set
  `{abbr}.json`

The audit found zero TODO / FIXME / WP-NNN markers near the five
schemas or their usage, so the dormant state is not a transitional
"wire this up later" marker — it is accidental survival from an
earlier architecture. This packet removes the dead code and data.

---

## Why This Packet Matters

**Framing:** This packet deliberately *reduces the authoritative schema
surface* of the registry package so that any exported schema implies an
active runtime or CI consumer. Absence of a schema after WP-084 is
intentional — not an omission, not a TODO.

**Complement to WP-083:** WP-083 validates *live inputs* at fetch-time;
WP-084 deletes *dead inputs* that never reach a fetch boundary. The two
packets together define the registry layer's validation contract:
everything that runs validates, and nothing that validates is dormant.

**Schema removal ≠ data removal, on purpose.** The JSON files are
deleted alongside their schemas to prevent "ambient data contracts" —
files that appear meaningful but have no reader. Retaining inert JSON
without a consumer is treated as technical debt, not documentation. If
a future feature needs the data, the source of truth is per-set card
JSON; a standalone metadata file is only justified when wired to a
runtime or fetch-time consumer in the same WP.

1. **Reduce surface area and confusion** — five exported-but-unused
   schemas mislead future readers into thinking the files are a
   runtime contract. The naming collision around `RegistryConfigSchema`
   (documented in WP-083) is the same failure mode: a schema that
   looks authoritative but isn't.
2. **Close the gap flagged by the validation audit** — WP-083 closed
   the fetch-time validation gap for live R2 payloads. WP-084 closes
   the "schemas exist but nothing consumes them" gap by deleting the
   dead ones.
3. **Shrink validate.ts to its actual job** — Phase 2 is 12 lines
   validating nothing that runs in production. Removing it makes the
   remaining four phases (config, cards, cross-refs, images) easier to
   maintain and reason about.
4. **Delete one orphan file** — `card-types-old.json` is a pure
   legacy artifact with zero references.

---

## Goal

Delete the five unused auxiliary metadata JSON files, their five Zod
schemas, and the validate.ts phase that validated them. Delete the
orphaned `card-types-old.json`. Preserve every schema, file, and code
path that has a runtime consumer.

**`validate.ts` contract after WP-084:** the script validates **only
artifacts that have live runtime or fetch-time consumers**, or that
enforce cross-file integrity (cards, refs, images). It must not be
used as a parking lot for unconsumed metadata. If a future WP adds a
new validation phase, that phase must either (a) gate a runtime path
or (b) enforce cross-file integrity the runtime assumes — never "just
in case" validation over data nothing reads.

### After completion:

- `data/metadata/` contains exactly four files:
  - `keywords-full.json`
  - `rules-full.json`
  - `sets.json`
  - *(no `card-types.json`, `card-types-old.json`, `hero-classes.json`,
    `hero-teams.json`, `icons-meta.json`, or `leads.json`)*
- `packages/registry/src/schema.ts` exports no `CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`, or
  `LeadsEntrySchema`
- `packages/registry/src/index.ts` no longer re-exports any of the
  five deleted schemas or their inferred types
- `packages/registry/scripts/validate.ts` no longer contains the
  Phase 2 metadata validation block (lines 364–376 per HEAD audit) nor
  its five associated imports (lines 50–54). The remaining phases are
  renumbered sequentially: former Phase 3 → Phase 2, Phase 4 → Phase 3,
  Phase 5 → Phase 4.
- `pnpm registry:validate` (root `package.json`) still runs `validate.ts`
  successfully and exits 0 on the current repo content
- `apps/registry-viewer/CLAUDE.md`, `docs/03.1-DATA-SOURCES.md`, and
  any other doc that lists the deleted files is updated
- `docs/ai/DECISIONS.md` records the deletion and its rationale so
  future WPs cannot accidentally reintroduce the files
- `pnpm -r build` exits 0; `pnpm -r --if-present test` exits 0 with
  the pre-flight baseline passing count preserved

---

## Assumes

- All five JSON files and their five schemas are referenced **only**
  by `packages/registry/scripts/validate.ts` (audit confirmed
  2026-04-21). The pre-flight executor re-runs the grep checks in
  §Verification Step 1 before deleting anything. If any match is
  found outside `validate.ts`, this packet is **BLOCKED**.
- `data/metadata/card-types-old.json` has zero references in the repo
  (audit confirmed 2026-04-21). Same block-on-drift rule applies.
- `validate.ts` Phase numbering is sequential and the phases after
  Phase 2 can be renumbered safely without breaking any consumer. If
  the phase numbers are referenced in external docs or scripts
  (non-zero grep hits for `"Phase 3"` / `"Phase 4"` / `"Phase 5"` in
  the repo outside `validate.ts` itself), STOP and update those
  references as part of this packet.
- `pnpm registry:validate` is the only npm script that invokes
  `validate.ts`. If other scripts do, they must be updated.
- `pnpm -r build` exits 0 and `pnpm -r --if-present test` exits 0 at
  the WP-084 starting commit (re-derive the baseline passing count at
  pre-flight time).
- No upload script, deploy config, or CI job pushes the five target
  files to R2 (audit confirmed — `upload-r2.ts` touches `dist/*.json`
  and images, not `data/metadata/`). If any R2-facing automation is
  discovered that references these files, STOP.
- **`00.2-data-requirements.md` block condition (UPDATED BY
  A-084-01):** `00.2` §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 currently define
  the five files as active contracts. Per the amendment, `00.2` is
  now **in scope** for rewrite in Commit A — sections become
  historical notes referencing the WP-084 deletion date. If
  additional active contract mentions are discovered at execution
  time beyond the five enumerated sections + the field-contract
  references at lines 68, 83, 581–583, 611–623, 689–690, STOP and
  extend scope.
- **Viewer duplicate `localRegistry.ts` assumption (A-084-01):** the
  Explore agent confirmed 2026-04-21 that
  `apps/registry-viewer/src/registry/impl/localRegistry.ts` has zero
  invocation paths: no imports anywhere in the repo, absent from the
  viewer `dist/` bundle, CI never invokes it, unchanged since
  initial commit `d5ea067`. The pre-flight executor re-runs the
  import audit (`grep -rn "apps/registry-viewer/src/registry/impl/localRegistry"`
  and `grep -rn "apps/registry-viewer/src/registry/index"` across
  `apps/`, `packages/`, `scripts/`, `.github/`) before deleting.
  If any import is found, STOP — the file is not dead code.

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` Section 1 ("Monorepo Package Boundaries")
  and §"Registry Layer (Data Input)" and §"Layer Boundary (Authoritative)"
  — registry is the sole owner of data-shape schemas
- `.claude/rules/architecture.md` §"Layer Boundary (Authoritative)"
  — this packet touches the Registry layer only; no engine, server,
  viewer, or pre-plan changes
- `.claude/rules/registry.md` — lists `schema.ts` as "immutable unless
  strong justification"; the justification for this packet is the
  2026-04-21 audit showing the five schemas have no runtime consumer.
  A `DECISIONS.md` entry is required per the rules file.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — field-naming
  authority; removing fields requires confirming 00.2 does not
  document them as a public contract
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules
  (enforced by lint gate §16)
- `docs/ai/DECISIONS.md` — scan for prior decisions on the five
  metadata files before deleting. If a prior decision listed any of
  them as a future runtime contract, STOP and reconcile before
  proceeding.
- `docs/ai/work-packets/WP-003-registry-verification.md` — defines
  the registry validation surface; confirm WP-003's acceptance
  criteria do not name any of the five files
- `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` — the
  sibling packet that closed the fetch-time validation gap. WP-084 is
  the "delete the dead ones" complement.
- `packages/registry/scripts/validate.ts` — the sole consumer of the
  five schemas; this packet excises its Phase 2 block
- `packages/registry/scripts/upload-r2.ts` — confirm it does not
  reference the five files (audit says it does not)

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- ESM only, Node v22+ — all new or modified files use `import`/`export`,
  never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- **Full file contents** for every new or modified file — no diffs, no
  snippets, no partial edits
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (no
  nested ternaries; no `.reduce()` with branching logic; descriptive
  names; JSDoc on all functions; `// why:` comments for non-obvious
  code; full-sentence error messages)
- No `import *` or barrel re-exports

**Packet-specific:**

- **Delete-only — no additions, no rewrites.** The only non-deletion
  change is (a) the `validate.ts` phase renumbering and (b) the
  doc/DECISIONS updates. No new schemas, no new files, no new
  fetchers, no new config fields.
- **The four surviving metadata files are LOCKED** — `keywords-full.json`,
  `rules-full.json`, `sets.json`, and their corresponding schemas
  (`SetIndexEntrySchema`, `KeywordGlossaryEntrySchema` [added by
  WP-082], `RuleGlossaryEntrySchema` [added by WP-082]) are preserved
  byte-for-byte. Nothing in this packet touches them.
- **`SetDataSchema`, `HeroCardSchema`, `MastermindCardSchema`,
  `VillainCardSchema`, `VillainGroupSchema`, `SchemeSchema`,
  `HeroSchema`, `MastermindSchema`, `CardQuerySchema`,
  `RegistryConfigSchema`, and any schemas added by WP-083**
  (`ViewerConfigSchema`, `ThemeIndexSchema`, `ThemeDefinitionSchema`,
  etc.) are preserved byte-for-byte.
- **`createRegistryFromLocalFiles` and `createRegistryFromHttp` are
  LOCKED** — the loaders are not touched. Their callers are not
  touched.
- **No R2 deletions in this packet.** The five files are never pushed
  to R2 by any automated process (audit confirmed `upload-r2.ts` does
  not reference them). If any of the files happen to exist on R2 from
  a historical manual upload, leaving them there is harmless — nothing
  fetches them. A separate manual R2 cleanup is at the author's
  discretion and out of scope.
- **Viewer and engine code untouched** — no file under
  `apps/registry-viewer/`, `apps/server/`, `packages/game-engine/`, or
  `packages/preplan/` is modified by this packet.
- **No new dependencies.**

**Session protocol:**

- If the pre-flight audit greps (Verification Step 1) turn up any
  reference to the five schemas, the five JSON files, or
  `card-types-old.json` outside `validate.ts`, STOP and re-scope. The
  packet is BLOCKED until the extra reference is triaged.
- If `validate.ts` Phase numbering is referenced outside the file
  itself (external docs, other scripts, commit messages that form a
  contract), STOP and update those references as part of this packet.
- If any of the five files has been edited since the 2026-04-21 audit
  (use `git log -- data/metadata/card-types.json` and peers), STOP and
  re-read the diff — a recent edit may indicate a consumer was added
  that the audit missed.
- If deleting `card-types-old.json` conflicts with a `.gitignore` or
  `.gitattributes` entry that would prevent git from tracking the
  removal, STOP and reconcile.

**Locked contract values:**

- Five schemas to delete: `CardTypeEntrySchema`, `HeroClassEntrySchema`,
  `HeroTeamEntrySchema`, `IconEntrySchema`, `LeadsEntrySchema`
- Five JSON files to delete: `data/metadata/card-types.json`,
  `hero-classes.json`, `hero-teams.json`, `icons-meta.json`, `leads.json`
- One orphan file to delete: `data/metadata/card-types-old.json`
- One phase block to excise from `validate.ts`: Phase 2 metadata
  validation (lines 364–376 at HEAD) plus the five imports (lines
  50–54 at HEAD) — re-derive exact line ranges at execution time

---

## Scope (In)

### A) Delete the five unused schemas from `packages/registry/src/schema.ts`

Remove:

- `CardTypeEntrySchema` (lines 51–57 at HEAD)
- `HeroClassEntrySchema` (lines 61–66 at HEAD)
- `HeroTeamEntrySchema` (lines 70–74 at HEAD)
- `IconEntrySchema` (lines 79–83 at HEAD)
- `LeadsEntrySchema` (lines 89–94 at HEAD)

Also remove the adjacent comment blocks that describe each schema.
Re-derive the exact line ranges at execution time; HEAD may have
shifted if WP-082 or WP-083 landed first.

If `z.infer<typeof ...>` types based on these schemas are exported
from `schema.ts` or re-exported by `index.ts`, delete those types too.
No runtime consumer exists (audit confirmed), so deletion is safe.

### B) Remove re-exports from `packages/registry/src/index.ts`

Remove any explicit re-exports of the five schemas or their inferred
types. If the re-export pattern uses `export { ... }` with named items,
delete the relevant names. If the file uses `export *` (forbidden by
§2 but may pre-exist), leave the pattern as-is — the deleted schemas
simply stop being re-exported automatically.

### C) Excise Phase 2 from `packages/registry/scripts/validate.ts`

Remove:

- The five import lines (at HEAD: lines 50–54) that bring in the
  deleted schemas
- The entire Phase 2 validation block (at HEAD: lines 364–376, plus
  any Phase-2-only helper functions that become unused)
- The phase-2 header text and any `console.log('Phase 2: ...')` lines

Renumber the remaining phases:

- Former Phase 3 (per-set card JSON) → Phase 2
- Former Phase 4 (cross-references) → Phase 3
- Former Phase 5 (image spot-checks) → Phase 4

Update all in-file references to the phase numbers (console logs,
error prefixes, section comments).

The executor must verify `pnpm registry:validate` exits 0 after the
edit, proving the remaining phases still work against the four
surviving metadata files.

### D) Delete the five JSON files and the orphan

```
rm data/metadata/card-types.json
rm data/metadata/card-types-old.json
rm data/metadata/hero-classes.json
rm data/metadata/hero-teams.json
rm data/metadata/icons-meta.json
rm data/metadata/leads.json
```

Commit the deletions alongside the code changes so `git log --
data/metadata/` shows the reason in the same commit.

### E) Update `package.json` if needed

If `pnpm registry:validate` exits non-zero after §C, debug and fix
before committing. If the script name itself needs a rename or a flag
change, do that as part of this packet. The goal is that
`pnpm registry:validate` continues to be a working opt-in validator
over the four surviving metadata files and the per-set card JSON.

### F) Documentation updates (primary)

- `apps/registry-viewer/CLAUDE.md` — remove §"Key Files" row for
  `src/registry/impl/localRegistry.ts` (file deleted by §G below)
  and any `card-types-old.json` or five-file references
- `docs/03.1-DATA-SOURCES.md` — remove rows for the five deleted
  files if present
- `packages/registry/CLAUDE.md` (if present) — update the schema
  inventory
- `docs/ai/DECISIONS.md` — add the governance entries (see §Governance)

### G) Delete viewer dead-code duplicate (A-084-01)

Confirmed dead code per 2026-04-21 Explore agent:
`apps/registry-viewer/src/registry/impl/localRegistry.ts` is a
drifted duplicate of the main registry's `localRegistry.ts`, never
imported, never invoked by CI, absent from the viewer `dist/`
bundle. It carries the WP-003 Defect 1 silent-failure bug (reads
`card-types.json` where `sets.json` is expected — D-1203).

Actions:

- Delete `apps/registry-viewer/src/registry/impl/localRegistry.ts`
  (`git rm`)
- Remove line 27 from `apps/registry-viewer/src/registry/index.ts`:
  `export { createRegistryFromLocalFiles  } from "./impl/localRegistry.js";`
- Confirm the viewer still builds (`pnpm --filter registry-viewer
  build` exits 0) — expected, because the browser entry
  (`browser.ts`) uses HTTP-only and never depended on the Node
  file
- The viewer's own `schema.ts`, `shared.ts`, `types/`,
  `httpRegistry.ts`, and `browser.ts` are **not modified**

### H) Amend `docs/ai/REFERENCE/00.2-data-requirements.md` (A-084-01)

Rewrite active contract declarations to historical notes referencing
the WP-084 deletion. Expected edits (re-derive exact line ranges at
execution time):

- §2.1 (`card-types.json` — 37 types, lines ~260–275): convert to
  historical note. Cite the WP-084 deletion date and Commit A hash.
- §2.3 (`hero-teams.json` — 25 teams, lines ~351–364): convert to
  historical note.
- §2.4 (`hero-classes.json` — 5 classes, lines ~368–382): convert
  to historical note. Note that hero-class display labels are
  hardcoded in `useRules.ts` `HERO_CLASS_GLOSSARY` + `HERO_CLASS_LABELS`
  per WP-082 / EC-107.
- §2.5 (`icons-meta.json` — 7 icons, lines ~388–407): convert to
  historical note.
- §2.6 (`leads.json`, lines ~408–422): convert to historical note.
  Note that the WP-014B virtual-card conventions + in-repo per-set
  data + `G.villainDeckCardTypes` setup-time resolution replaced
  runtime consumption of this file.
- Line 68 (`team` field contract): remove `— matches slug in
  hero-teams.json` clause; keep `team` as a string that matches
  per-set JSON.
- Line 83 (`hc` field contract): same treatment for
  `hero-classes.json`.
- Lines 581–583 (glossary markup token lookups): the `[icon:X]`,
  `[hc:X]`, `[team:X]` resolution paths now bind to per-set data +
  hardcoded viewer maps (`HERO_CLASS_GLOSSARY`, `HERO_CLASS_LABELS`)
  rather than the deleted metadata files. Rewrite to reflect current
  resolution paths.
- Lines 611–623 (leads.json as "Level 2 cross-set index"): convert
  to historical note; no Level 2 file exists after WP-084.
- Lines 689–690 (leads.json data quality rules): convert to
  historical note.

No new required inputs are introduced. The four surviving files
(`sets.json`, `keywords-full.json`, `rules-full.json`) keep their
current sections.

### I) Sweep current-state docs (A-084-01)

Remove or historicize references to the five deleted filenames in:

- `docs/01-REPO-FOLDER-STRUCTURE.md` (lines ~189–193, 209 — folder
  layout description)
- `docs/03-DATA-PIPELINE.md` (lines ~24–28 — data flow diagram
  naming the five files)
- `docs/08-DEPLOYMENT.md` (exact line ranges re-derived at
  execution)
- `docs/10-GLOSSARY.md` (exact line ranges re-derived)
- `docs/11-TROUBLESHOOTING.md` (exact line ranges re-derived)
- `docs/ai/ARCHITECTURE.md` (authoritative doc — references are
  removed or historicized)
- `docs/ai/REFERENCE/00.5-validation.md` (validation protocol
  reference)
- `docs/ai/deployment/r2-data-checklist.md` (R2 deployment
  checklist)
- `docs/prompts-registry-viewer/*.md` (prompt archive files
  enumerated at execution; each file edited individually —
  historical context, not current protocol)

**Explicitly excluded from this sweep** (historical execution
records — must not be rewritten):

- `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`, `WP-015*`,
  `WP-017*`, `WP-042*`, `WP-043*`
- `docs/ai/execution-checklists/EC-003*`, `EC-014A*`
- Any file under `prompts-legendary-area-game/` (external repo
  archive, outside this monorepo)

The §Acceptance Criteria grep exclusions (see §Acceptance Criteria
below) enumerate these explicitly.

### J) Delete legacy `scripts/Validate-R2-old.ps1` (A-084-01)

Superseded by `scripts/validate-r2.mjs` (Node variant, wired to
root `pnpm validate`) and `packages/registry/scripts/validate.ts`
(tsx variant, wired to `pnpm registry:validate`). The file name
admits `-old`; its docstring lines 12, 17–20, 93 reference all five
deleted filenames.

Actions:

- Delete `scripts/Validate-R2-old.ps1` (`git rm`)
- Confirm root `package.json` does not reference it (verified
  2026-04-21: `package.json:22` invokes `scripts/Validate-R2.ps1`
  WITHOUT the `-old` suffix — distinct file; not to be touched by
  this packet)

### K) In-scope registry JSDoc clean-up (A-084-01)

- `packages/registry/src/schema.ts` file-header JSDoc lines 4–9
  list `card-types.json` as a runtime data source URL — remove
  that line.
- `packages/registry/src/impl/localRegistry.ts` lines 6–13 (JSDoc
  directory layout) and lines 36, 61, 91 (`// why:` comment
  references) mention the five filenames — remove the stale lines
  / rewrite to reference only `sets.json` and per-set JSON.
- `packages/registry/src/impl/httpRegistry.ts` lines 47–50 and 67
  mention `card-types.json` in `// why:` comments as the WP-003
  silent-failure counter-example. **Keep as-is** — these comments
  retain educational value even after the file is deleted (the
  bug pattern they warn against remains reachable in principle
  for any future metadata file). Add a one-line clarifying note
  that the specific file was deleted 2026-MM-DD by WP-084.

### L) Additional JSDoc / doc-reference cleanup (A-084-01, surfaced by Gate 2b dry-run)

Gate 2b post-amendment dry-run (2026-04-21) surfaced two additional
current-state references the initial amendment missed. Both are
pure documentation / JSDoc edits with no runtime or type-signature
impact; added to Commit A scope:

- `apps/registry-viewer/src/registry/types/index.ts` lines 87 and
  116 — JSDoc comments on `CardRegistry` type members claim
  *"All set index entries (from card-types.json)"* and *"load all
  sets listed in card-types.json"*. Both are drifted from the
  WP-003 fix era (the actual httpRegistry fetches `sets.json`, not
  `card-types.json` — classic D-1203 pattern). Edit: replace
  `card-types.json` → `sets.json` in both JSDoc blocks. No type
  signature change. No runtime behavior change.
- `apps/registry-viewer/src/registry/types/types-index.ts` lines
  87 and 116 — identical drifted JSDoc in the parallel type file
  (viewer maintains both `index.ts` and `types-index.ts` per
  EC-102 / EC-103 consolidation history). Same edit.
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` line 162 — uses
  `card-types.json` as a concrete example of the `sets.json` vs
  `card-types.json` confusion bug pattern. Edit options:
  (a) historicize the reference with a note citing WP-084
  deletion + D-1203, OR (b) rephrase to use a generic example
  (e.g., "loading the wrong metadata file"). **Executor's call
  at execution time** — default to (a), which preserves the
  specific D-1203 link for future readers.

**Scope discipline:** these three files join the existing scope
additions — the viewer types files are the ONLY additional viewer
runtime files touched by A-084-01 beyond the localRegistry
deletion + index.ts re-export removal + CLAUDE.md row removal.
Edits are JSDoc-only (no import changes, no type signature changes,
no runtime code changes). If the executor discovers additional
JSDoc drift elsewhere in the viewer during the sweep, STOP and
escalate — do not expand viewer scope further without explicit
author authorization.

No new docs are created by this packet.

---

## Out of Scope

- **WP-082 and WP-083 artifacts are untouched.** This packet does not
  modify the glossary pipeline, the rulebook PDF reference, the viewer
  config schema, or the theme validation work.
- **R2 cleanup.** If any of the five deleted files happen to exist on
  R2 from a historical manual upload, they stay — nothing fetches
  them, so they are harmless. Optional manual R2 cleanup is at the
  author's discretion.
- **Viewer, server, engine, and pre-plan code.** No file under
  `apps/registry-viewer/`, `apps/server/`, `packages/game-engine/`, or
  `packages/preplan/` is touched.
- **`validate.ts` Phases 1, 3, 4, 5 (post-renumber: 1, 2, 3, 4).**
  Their logic is preserved; only the phase numbers in headers and
  log prefixes are updated.
- **New schemas or validators.** No replacement schema is introduced.
  No new validation is added.
- **Hero class glossary** — `HERO_CLASS_GLOSSARY` in
  `useRules.ts` (five hardcoded entries) is unrelated to the deleted
  `hero-classes.json` and stays in place.
- **`sets.json`, `keywords-full.json`, `rules-full.json`** and their
  schemas are untouched.
- **`card-types-old.json` on the `.claude/worktrees/` side** — if a
  stale worktree copy exists (audit found one), it is not this
  packet's concern; worktrees are ephemeral.
- **Rebuilding or rehosting any data.** No JSON is regenerated.

---

## Files Expected to Change

**Registry core (Commit A):**

- `packages/registry/src/schema.ts` — **modified** — delete the five
  schemas and their adjacent comments (lines ~51–94 at HEAD;
  re-derive exact range at execution time); also remove the stale
  `card-types.json` line from the file-header JSDoc (line 7)
- `packages/registry/src/index.ts` — **modified if needed** — remove
  re-exports of the five deleted schemas and any inferred types
  (current state 2026-04-21: no such re-exports exist; this step is
  verify-and-proceed)
- `packages/registry/scripts/validate.ts` — **modified** — remove the
  five schema imports (lines ~51–55), delete the
  `checkOneMetadataFile` helper (lines ~302–370, Phase-2-only),
  delete the `checkMetadataFiles` function (lines ~372–384), remove
  the call in `main()` (line ~802), renumber former Phases 3/4/5 →
  2/3/4 throughout in-file references (console logs, error prefixes,
  section comments, and the file-header JSDoc at lines 2–43)
- `packages/registry/src/impl/localRegistry.ts` — **modified (A-084-01)**
  — remove the stale directory-layout JSDoc lines 6–13 naming the
  five deleted files; clean the `// why:` comment references at
  lines 36, 61, 91 so they reference only `sets.json` + per-set JSON
- `packages/registry/src/impl/httpRegistry.ts` — **modified (A-084-01)**
  — add one-line clarifying note after line 50 that
  `card-types.json` was deleted by WP-084 on YYYY-MM-DD; keep the
  educational `// why:` comments intact
- `apps/registry-viewer/src/registry/types/index.ts` — **modified
  (A-084-01 §L)** — JSDoc cleanup at lines 87 + 116, replace
  `card-types.json` → `sets.json` in both blocks. No type
  signature change.
- `apps/registry-viewer/src/registry/types/types-index.ts` —
  **modified (A-084-01 §L)** — identical JSDoc cleanup at lines
  87 + 116
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified
  (A-084-01 §L)** — line 162 historicize the `card-types.json`
  reference with a WP-084 / D-1203 citation

**Data deletions (Commit A):**

- `data/metadata/card-types.json` — **deleted** (`git rm`)
- `data/metadata/card-types-old.json` — **deleted** (`git rm`)
- `data/metadata/hero-classes.json` — **deleted** (`git rm`)
- `data/metadata/hero-teams.json` — **deleted** (`git rm`)
- `data/metadata/icons-meta.json` — **deleted** (`git rm`)
- `data/metadata/leads.json` — **deleted** (`git rm`)

**Viewer dead-code deletion (A-084-01, Commit A):**

- `apps/registry-viewer/src/registry/impl/localRegistry.ts` —
  **deleted (`git rm`)** — drifted duplicate confirmed dead code by
  Explore agent 2026-04-21
- `apps/registry-viewer/src/registry/index.ts` — **modified
  (A-084-01)** — remove line 27 re-export of
  `createRegistryFromLocalFiles`
- `apps/registry-viewer/CLAUDE.md` — **modified (A-084-01)** —
  remove line 62 §"Key Files" row for `src/registry/impl/localRegistry.ts`
  and any card-types / five-file references

**Legacy script deletion (A-084-01, Commit A):**

- `scripts/Validate-R2-old.ps1` — **deleted (`git rm`)** — legacy
  PowerShell validator superseded by `scripts/validate-r2.mjs` and
  `packages/registry/scripts/validate.ts`

**Docs sweep (A-084-01, Commit A):**

- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified
  (A-084-01)** — rewrite §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 to historical
  notes; fix field-contract references at lines 68, 83, 581–583,
  611–623, 689–690 per §H above
- `docs/03.1-DATA-SOURCES.md` — **modified** — remove rows for the
  five deleted files
- `docs/01-REPO-FOLDER-STRUCTURE.md` — **modified (A-084-01)** —
  remove lines 189–193, 209 references
- `docs/03-DATA-PIPELINE.md` — **modified (A-084-01)** — remove
  lines 24–28 data-flow diagram references
- `docs/08-DEPLOYMENT.md` — **modified if references present
  (A-084-01)**
- `docs/10-GLOSSARY.md` — **modified if references present
  (A-084-01)**
- `docs/11-TROUBLESHOOTING.md` — **modified if references present
  (A-084-01)**
- `docs/ai/ARCHITECTURE.md` — **modified if references present
  (A-084-01)** — authoritative doc; any current-state mentions
  historicized
- `docs/ai/REFERENCE/00.5-validation.md` — **modified if references
  present (A-084-01)**
- `docs/ai/deployment/r2-data-checklist.md` — **modified if
  references present (A-084-01)**
- `docs/prompts-registry-viewer/*.md` — **modified (A-084-01)** —
  per-file enumeration at execution time
- `packages/registry/CLAUDE.md` — **modified if present** — update
  schema inventory
- `package.json` — **modified if needed** — only if the
  `registry:validate` script needs a flag or name change; skip
  otherwise (no change anticipated)

**Governance (Commit B):**

- `docs/ai/DECISIONS.md` — **modified** — governance entries per
  §Governance (now seven entries, not five — see amendment below)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip WP-084
  `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip
  EC-109 row to `Done`
- `docs/ai/STATUS.md` — **modified if the file exists and prior WPs
  followed that convention**

No other files may be modified. In particular:

- No file under `apps/server/`, `packages/game-engine/`, or
  `packages/preplan/` is touched
- **`apps/registry-viewer/src/**` runtime code is untouched** — the
  only viewer edits are the dead-file deletion (§G) and the
  one-line re-export removal in `index.ts` and the one-row CLAUDE.md
  edit. `App.vue`, `src/lib/*`, `src/composables/*`,
  `src/components/*`, `src/registry/schema.ts`, `src/registry/shared.ts`,
  `src/registry/browser.ts`, `src/registry/impl/httpRegistry.ts`,
  `src/registry/types/**` are **not modified**
- No R2 artifact is modified
- `data/metadata/keywords-full.json`, `rules-full.json`, and
  `sets.json` are not touched
- Historical WP / EC artifacts
  (`docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`, `WP-015*`,
  `WP-017*`, `WP-042*`, `WP-043*`,
  `docs/ai/execution-checklists/EC-003*`, `EC-014A*`) are **not
  modified** — they record past execution and must remain
  historically accurate
- Any file under `prompts-legendary-area-game/` (external archive)
  is not modified (not in this monorepo's working set)

---

## Governance (Required)

Add the following decisions to `docs/ai/DECISIONS.md`:

- The five auxiliary metadata files (`card-types.json`,
  `hero-classes.json`, `hero-teams.json`, `icons-meta.json`,
  `leads.json`) are **deleted** as of WP-084. A 2026-04-21 audit
  confirmed they had no runtime consumer — not the server, the viewer,
  the game engine, or the pre-plan package. If a future feature needs
  this data, the source of truth is per-set card JSON and per-set
  metadata in `sets.json`; do not reintroduce standalone files without
  a WP that also defines the runtime consumer.
- The five corresponding Zod schemas (`CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
  `LeadsEntrySchema`) are deleted. Reintroducing any of them requires
  a new WP with a runtime consumer named in its ## Goal.
- `data/metadata/card-types-old.json` is deleted as an orphan (zero
  references in the repo at 2026-04-21). Legacy `*-old.json` files
  are a repo smell; scan for them during routine cleanup.
- `validate.ts` is a manual opt-in validator over `sets.json` + the
  per-set card JSON + cross-references + image spot-checks; it is **not**
  wired to `pnpm build` or `pnpm test` and must not be relied on as a
  gating check. Per-feature validation belongs at the fetch boundary
  (see WP-083) or in `Game.setup()` (engine).
- **Future reintroduction pattern:** if any of the deleted metadata
  concepts (card types, hero classes, hero teams, icon metadata,
  leads) are reintroduced, they must be either (a) *derived* from
  per-set data at setup or fetch time, **or** (b) wired to a runtime
  or fetch-time consumer in the same WP that reintroduces them. A
  standalone JSON file plus a Zod schema with no reader is forbidden
  by this decision. A future WP that violates this rule must first
  amend this DECISIONS entry with an explicit override.
- **Viewer duplicate `localRegistry.ts` deletion (A-084-01):**
  `apps/registry-viewer/src/registry/impl/localRegistry.ts` is
  deleted as a drifted orphan duplicate of the main registry's
  `localRegistry.ts`. It carried the exact WP-003 Defect 1
  silent-failure bug (reads `card-types.json` as a set index;
  D-1203) and was never invoked — confirmed by Explore agent
  2026-04-21: zero imports across the repo, absent from the viewer
  `dist/` bundle, untouched since the initial commit of the viewer
  registry folder (`d5ea067`, 2026-03-23). The file's
  "CI validation" label in `apps/registry-viewer/CLAUDE.md:62` was
  aspirational documentation, not reality. Reintroducing a
  Node-only CardRegistry factory inside the viewer package requires
  a new WP that also defines the actual CI validation job that
  invokes it; the main registry's `createRegistryFromLocalFiles` at
  `packages/registry/src/impl/localRegistry.ts` remains the single
  canonical Node factory and is unaffected.
- **Legacy `scripts/Validate-R2-old.ps1` deletion (A-084-01):**
  the PowerShell validator is deleted as a superseded orphan. Its
  replacements — `scripts/validate-r2.mjs` (Node, wired to root
  `pnpm validate`) and `packages/registry/scripts/validate.ts`
  (tsx, wired to `pnpm registry:validate`) — remain the authoritative
  validators. Any future PowerShell-specific validator must be a
  new file with a current name, not a revival of `Validate-R2-old.ps1`.

Update `docs/ai/work-packets/WORK_INDEX.md` to flip WP-084 `[ ]` →
`[x]` with the 2026-MM-DD execution date and Commit A hash on
governance-close (Commit B).

Update `docs/ai/execution-checklists/EC_INDEX.md` — the EC allocated
at pre-flight (EC-109 at time of drafting; re-confirm at pre-flight)
flips to `Done` on governance-close.

Update `docs/03.1-DATA-SOURCES.md` (if it currently lists any of the
deleted files).

---

## Acceptance Criteria

- [ ] `git ls-files data/metadata/` returns exactly these paths
  (re-derive at execution time if `sets.json` naming ever changes):
  - `data/metadata/keywords-full.json`
  - `data/metadata/rules-full.json`
  - `data/metadata/sets.json`
- [ ] `grep -rnE "CardTypeEntrySchema|HeroClassEntrySchema|HeroTeamEntrySchema|IconEntrySchema|LeadsEntrySchema"
  packages/ apps/ scripts/ | grep -v "^packages/registry/dist/"`
  returns **no matches** (schemas fully deleted, no stragglers —
  `dist/` excluded because compiled artifacts are regenerated after
  source deletion + build). `packages/registry/src/schema.ts` no
  longer hits because the definitions themselves are removed.
- [ ] `packages/registry/src/index.ts` does not re-export any deleted
  schema **directly or indirectly**. If the file uses explicit
  `export { ... }` lists, confirm none of the five names appear. If
  any `export *` pattern is present, manually inspect the source
  module to confirm the deleted names are no longer defined there
  (i.e., the `export *` transitively stops re-exporting them). This
  guards against the silent "schema removed from definition but still
  re-exported" failure mode.
- [ ] `grep -rnE "card-types\.json|card-types-old\.json|hero-classes\.json|hero-teams\.json|icons-meta\.json|leads\.json"
  packages/ apps/ scripts/ docs/` returns no matches **after
  filtering through the exclusion list below** — filenames removed
  from all **current-state** references. Historical execution
  records are excluded:

  ```
  | grep -v "^docs/ai/work-packets/WP-08"
  | grep -v "^docs/ai/work-packets/WP-003"
  | grep -v "^docs/ai/work-packets/WP-004"
  | grep -v "^docs/ai/work-packets/WP-009A"
  | grep -v "^docs/ai/work-packets/WP-014A"
  | grep -v "^docs/ai/work-packets/WP-015"
  | grep -v "^docs/ai/work-packets/WP-017"
  | grep -v "^docs/ai/work-packets/WP-042"
  | grep -v "^docs/ai/work-packets/WP-043"
  | grep -v "^docs/ai/work-packets/WP-060"
  | grep -v "^docs/ai/work-packets/PACKET-TEMPLATE.md"
  | grep -v "^docs/ai/work-packets/WORK_INDEX.md"
  | grep -v "^docs/ai/execution-checklists/EC-109"
  | grep -v "^docs/ai/execution-checklists/EC_INDEX.md"
  | grep -v "^docs/ai/execution-checklists/EC-003"
  | grep -v "^docs/ai/execution-checklists/EC-014A"
  | grep -v "^docs/ai/execution-checklists/EC-042"
  | grep -v "^docs/ai/execution-checklists/EC-106"
  | grep -v "^docs/ai/execution-checklists/EC-107"
  | grep -v "^docs/ai/execution-checklists/EC-108"
  | grep -v "^docs/ai/DECISIONS.md"
  | grep -v "^docs/ai/DECISIONS_INDEX.md"
  | grep -v "^docs/ai/STATUS.md"
  | grep -v "^docs/ai/REFERENCE/01.4-pre-flight-invocation.md"
  | grep -v "^docs/ai/session-context/"
  | grep -v "^docs/ai/invocations/"
  | grep -v "^docs/archive prompts-legendary-area-game/"
  | grep -v "^apps/registry-viewer/HISTORY-"
  | grep -v "^apps/registry-viewer/src/registry/types/index.ts"
  | grep -v "^apps/registry-viewer/src/registry/types/types-index.ts"
  | grep -v "^docs/ai/REFERENCE/02-CODE-CATEGORIES.md"
  | grep -v "^packages/registry/dist/"
  ```

  Rationale: historical WP / EC files record past execution and
  must remain accurate. `WORK_INDEX.md` and EC_INDEX rows describe
  WP-084's own deletion list by name — they may mention the deleted
  filenames in that role. `DECISIONS.md` contains the D-1203
  counter-example narrative and the new WP-084 governance entries
  that explicitly name the deleted files. `dist/` artifacts are
  compiled output regenerated at build.
- [ ] **A-084-01 viewer cleanup acceptance:** `ls
  apps/registry-viewer/src/registry/impl/` does not contain
  `localRegistry.ts`. `grep -n "createRegistryFromLocalFiles"
  apps/registry-viewer/src/registry/index.ts` returns no matches.
  `pnpm --filter registry-viewer build` exits 0.
- [ ] **A-084-01 legacy-script acceptance:** `ls scripts/` does not
  contain `Validate-R2-old.ps1`. `grep -n "Validate-R2-old"
  package.json` returns no matches.
- [ ] **A-084-01 00.2 acceptance:** `grep -nE "## 2\.(1|3|4|5|6) "
  docs/ai/REFERENCE/00.2-data-requirements.md` returns five
  **historical** section headers (or removed entirely if the author
  prefers full excision); none define a current required input.
- [ ] **A-084-01 docs-sweep acceptance:** the acceptance grep
  above (filtered) returns zero hits across `docs/**` — confirming
  current-state docs are all historicized.
- [ ] `packages/registry/scripts/validate.ts` has no `Phase 2:` block
  referring to the five metadata files; phases post-renumber appear
  as 1, 2, 3, 4 (or whatever sequential numbering the author locked —
  acceptance is that no phase numbering collisions or gaps remain)
- [ ] `pnpm registry:validate` exits 0 against the repo HEAD (proves
  the remaining phases still work)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with the pre-flight
  baseline passing count preserved
- [ ] No files outside §"Files Expected to Change" were modified
  (confirmed with `git diff --name-only` and `git status`)
- [ ] `docs/ai/DECISIONS.md` contains the four governance entries
  listed in §Governance
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-084 flipped
  `[ ]` → `[x]` with date + Commit A hash
- [ ] No runtime behavior change in the viewer, server, or game
  engine — confirmed by running the dev server and a smoke test (see
  §Verification Step 6)

---

## Verification Steps

```bash
# Step 1 — Pre-flight usage audit (MUST run BEFORE deleting anything)
# Confirm the five schemas are referenced only in validate.ts
grep -rn "CardTypeEntrySchema\|HeroClassEntrySchema\|HeroTeamEntrySchema\|IconEntrySchema\|LeadsEntrySchema" \
  packages/ apps/ scripts/ \
  | grep -v "^packages/registry/scripts/validate.ts"
# Expected: no output

# Confirm the five filenames are referenced only in validate.ts
grep -rn "card-types.json\|hero-classes.json\|hero-teams.json\|icons-meta.json\|leads.json" \
  packages/ apps/ scripts/ docs/ \
  | grep -v "^packages/registry/scripts/validate.ts" \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/work-packets/WORK_INDEX.md"
# Expected: no output
# (WP-082/083/084 drafts and WORK_INDEX are expected to mention the files;
# exclude them from the audit.)

# Confirm card-types-old.json has no references
grep -rn "card-types-old.json" packages/ apps/ scripts/ docs/
# Expected: no output

# If ANY of the above return unexpected output, STOP. The packet is
# BLOCKED until the extra reference is triaged.

# Step 2 — Post-deletion schema check
grep -rn "CardTypeEntrySchema\|HeroClassEntrySchema\|HeroTeamEntrySchema\|IconEntrySchema\|LeadsEntrySchema" \
  packages/ apps/ scripts/
# Expected: no output

# Step 3 — Post-deletion file check
ls data/metadata/
# Expected: exactly three files:
#   keywords-full.json  rules-full.json  sets.json

# Step 4 — validate.ts still works
pnpm registry:validate
# Expected: exits 0; log output shows phases 1, 2, 3, 4 (renumbered) running
# over sets.json + per-set cards + cross-refs + images

# Step 5 — build and test
pnpm -r build
# Expected: exits 0

pnpm -r --if-present test
# Expected: exits 0; baseline passing count preserved

# Step 6 — smoke the viewer to prove no behavioral change
#   pnpm --filter registry-viewer dev
#   Open the app, confirm:
#     - Cards load (reads sets.json + per-set JSON, unaffected)
#     - Themes load (reads themes/*.json, unaffected)
#     - Glossary panel populates (reads keywords-full + rules-full, unaffected)
#     - Keyword/rule/hero-class tooltips work (hardcoded hero class glossary
#       in useRules.ts, unaffected; hero-classes.json deletion is not a
#       runtime dependency)
#   Expected: no console errors about missing files or undefined data

# Step 7 — git hygiene
git diff --name-only
# Expected: only files listed in §"Files Expected to Change" appear.
# No file outside that list is modified.

git status
# Expected: six deleted files (the five JSON + card-types-old.json) plus
# the modified schema.ts, index.ts, validate.ts, and doc updates.

# Step 8 — Confirm no R2-upload automation references the deleted files
grep -rn "card-types.json\|hero-classes.json\|hero-teams.json\|icons-meta.json\|leads.json\|card-types-old.json" \
  packages/registry/scripts/ apps/ scripts/ \
  | grep -iE "(upload|sync|deploy|r2|bucket)"
# Expected: no output (upload-r2.ts audited clean; re-verify)
```

---

## Definition of Done

- [ ] All acceptance criteria above pass
- [ ] Pre-flight audit (Verification Step 1) confirmed zero consumers
  outside `validate.ts` **before** any deletion was committed
- [ ] `pnpm registry:validate` exits 0 post-deletion
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with baseline passing count preserved
- [ ] Viewer smoke test passes (Verification Step 6 — no console
  errors, all four surviving data paths work)
- [ ] No files outside §"Files Expected to Change" were modified
  (confirmed with `git diff --name-only` and `git status`)
- [ ] `docs/ai/DECISIONS.md` updated with all four items from §Governance
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-084 flipped `[ ]` →
  `[x]` with date + Commit A hash
- [ ] `docs/ai/STATUS.md` updated with the WP-084 completion line
  following the convention used by prior WPs (if `docs/ai/STATUS.md`
  does not exist, the lint gate §1 requirement is satisfied via
  `WORK_INDEX.md` status column per established repo convention —
  confirm at pre-flight)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has the allocated EC
  (EC-109 at time of drafting; re-confirm at pre-flight) flipped to
  `Done`
- [ ] `docs/03.1-DATA-SOURCES.md` updated if it referenced any deleted file
- [ ] Three-commit topology followed: A0 `SPEC:` pre-flight bundle →
  A `EC-109:` execution → B `SPEC:` governance close (commit prefix
  `WP-084:` is forbidden per P6-36)
- [ ] **A-084-01 amendment DoD:**
  - [ ] Viewer `localRegistry.ts` file deleted; `index.ts` re-export
        removed; viewer builds cleanly
  - [ ] `scripts/Validate-R2-old.ps1` file deleted
  - [ ] `00.2-data-requirements.md` §§2.1 / 2.3 / 2.4 / 2.5 / 2.6
        historicized or removed; field-contract references at lines
        68, 83, 581–583, 611–623, 689–690 updated
  - [ ] Current-state docs sweep complete across the enumerated doc
        list in §Files Expected to Change
  - [ ] Historical WP / EC files **not modified** (`git diff
        --name-only | grep -E "WP-003|WP-009A|WP-014A|WP-015|WP-017|WP-042|WP-043|EC-003|EC-014A"`
        returns zero hits)
  - [ ] `docs/ai/DECISIONS.md` contains **seven** governance entries
        (five original + viewer orphan deletion + legacy PS1
        deletion)

---

## Amendments

### A-084-01 — Pre-flight-driven scope expansion (2026-04-21)

**Source:** `docs/ai/invocations/preflight-wp084.md` §Pre-Session
Actions PS-1 through PS-12, authored 2026-04-21 against the A0
SPEC bundle.

**Reason:** the 2026-04-21 pre-flight discovered (a) an active
consumer of `card-types.json` in the viewer's drifted duplicate
`localRegistry.ts` (confirmed dead code by Explore agent, safe to
delete entirely), (b) active contract declarations in
`00.2-data-requirements.md` §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 (EC-109
Gate 3.2 blocker), (c) repo-wide current-state doc references in
`docs/**` beyond the WP's original doc scope (acceptance-criterion
grep cannot reach "no matches" without expansion), and (d) the
legacy `scripts/Validate-R2-old.ps1` orphan listing all five
filenames in its docstring.

**Scope-neutral decision per WP-031 A-031-01/02/03 precedent
framework?** No — A-084-01 **expands** the allowlist beyond the
original WP. This is not a scope-neutral mid-execution amendment;
it is a pre-execution authored amendment that *adds* files to
§Files Expected to Change, adds entries to §Governance, and
extends the acceptance-criterion grep exclusions. The amendment
lands on the A0 SPEC bundle **before** any Commit A edit, so the
executor works from a complete allowlist.

**Added to scope (all Commit A unless noted):**

- `apps/registry-viewer/src/registry/impl/localRegistry.ts`
  (deleted)
- `apps/registry-viewer/src/registry/index.ts` (one-line
  re-export removal)
- `apps/registry-viewer/CLAUDE.md` (one §"Key Files" row removal)
- `scripts/Validate-R2-old.ps1` (deleted)
- `docs/ai/REFERENCE/00.2-data-requirements.md` (rewrite
  §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 + fix field-contract references)
- `docs/01-REPO-FOLDER-STRUCTURE.md`
- `docs/03-DATA-PIPELINE.md`
- `docs/08-DEPLOYMENT.md` (if references present)
- `docs/10-GLOSSARY.md` (if references present)
- `docs/11-TROUBLESHOOTING.md` (if references present)
- `docs/ai/ARCHITECTURE.md` (if references present)
- `docs/ai/REFERENCE/00.5-validation.md` (if references present)
- `docs/ai/deployment/r2-data-checklist.md` (if references
  present)
- `docs/prompts-registry-viewer/*.md` (per-file enumeration)
- `packages/registry/src/impl/localRegistry.ts` (JSDoc
  directory-layout + `// why:` comment cleanup)
- `packages/registry/src/impl/httpRegistry.ts` (one-line
  clarifying note added to existing `// why:` comment block)

**Added to §Governance:** two new entries — viewer orphan
deletion + legacy PS1 deletion (total: seven entries, not five).

**Grep-pattern fixes (PS-4 / RS-4):** acceptance-criteria grep
pipes now exclude `packages/registry/dist/` (compiled artifacts,
regenerated at build); post-deletion schema grep no longer
matches `packages/registry/src/schema.ts` because the five
definitions are removed. EC-109 Gate 2a / Gate 2b greps updated
in parallel to match.

**Historical-records protection:** acceptance grep exclusions
cover `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`,
`WP-015*`, `WP-017*`, `WP-042*`, `WP-043*`,
`docs/ai/execution-checklists/EC-003*`, `EC-014A*`,
`WORK_INDEX.md`, and `DECISIONS.md` — historical execution
records must remain accurate.

**Authority:** author-approved 2026-04-21 after reading
preflight-wp084.md §Pre-Session Actions and confirming the
Explore-agent dead-code verdict. Re-runs EC-109 Gates 2 and 3
post-amendment before flipping the pre-flight verdict to READY.

**Cross-references:**
- `docs/ai/invocations/preflight-wp084.md` §Author Decision Log
  (captures the PS-1 / PS-2 / PS-3 / PS-8 selections)
- `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md`
  §Locked Values (updated in parallel)
- Explore agent transcript summarized in preflight §RS-1
  Mitigation (dead-code verdict with seven pieces of evidence)
