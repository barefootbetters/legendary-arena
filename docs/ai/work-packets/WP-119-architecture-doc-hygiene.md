# WP-119 — Architecture Doc Hygiene

**Status:** Draft (stub — pre-lint, pre-pre-flight)
**Primary Layer:** Governance / Documentation (no code; pure doc edits)
**Dependencies:** None — these are independent low-risk doc cleanups.

---

## Session Context

Three small drift items in `docs/02-ARCHITECTURE.md` and `docs/ai/ARCHITECTURE.md` were identified during a 2026-04-29 architecture review:

1. The `apps/replay-producer` package (D-6301, WP-063) has shipped but is missing from the System Layers ASCII diagram in `docs/02-ARCHITECTURE.md`.
2. The wording for `packages/preplan` import rules differs subtly between `docs/ai/ARCHITECTURE.md` ("read-only against engine projections") and `.claude/rules/architecture.md` / `docs/02-ARCHITECTURE.md` ("TYPE-only imports from engine"). Both are correct; the phrasing should align so future readers don't infer two different rules.
3. The architecture doc has no stated posture on internationalization (i18n). The MVP is English-only; absent a written line, this gap will be relitigated each time a UI WP touches user-visible text.

This packet bundles all three into a single doc-hygiene WP.

---

## Goal

After this session:

- `apps/replay-producer` appears in the System Layers diagram in `docs/02-ARCHITECTURE.md` as a CLI consumer of `packages/game-engine`.
- The preplan import-rule wording is identical (or explicitly cross-referenced) across `docs/ai/ARCHITECTURE.md`, `docs/02-ARCHITECTURE.md`, and `.claude/rules/architecture.md`.
- A new one-paragraph `## Internationalization` section exists in `docs/ai/ARCHITECTURE.md` (and a one-line summary in `docs/02-ARCHITECTURE.md`) stating: "MVP is English-only; i18n is deferred; no `i18n` library is adopted; user-visible strings live where they are used."
- A single `D-NNN01` entry in `DECISIONS.md` anchors the i18n posture (the diagram and wording fixes are pure cleanups, no decision).

This WP changes no code, no tests, no contracts, no APIs.

---

## Vision Alignment

> Trigger surfaces from §17.1:
> - #9 (Accessibility or internationalization surfaces — Vision §17): **Triggered** by the i18n posture line.

**Vision clauses touched:** §17 (Accessibility / Internationalization). NG-1..NG-7 not crossed.

**Conflict assertion:** No conflict — the WP commits to "deferred", which is consistent with §17 not having committed to a specific i18n implementation.

**Determinism preservation:** N/A — no engine / replay / RNG surface touched.

**§20 Funding Surface Gate:** N/A — pure documentation cleanup; no funding affordances per WP-097 §A/§B/§C; no user-visible copy referencing donations or tournament funding.

---

## Assumes

- `docs/02-ARCHITECTURE.md` and `docs/ai/ARCHITECTURE.md` exist.
- `.claude/rules/architecture.md` exists and contains the preplan import-rule table.
- `apps/replay-producer/package.json` exists (confirms the package is real).
- `docs/ai/DECISIONS.md` exists.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/02-ARCHITECTURE.md` — full read; locate the System Layers ASCII diagram and the preplan reference.
- `docs/ai/ARCHITECTURE.md` — full read; locate the preplan section + identify the right insertion point for the new `## Internationalization` section.
- `.claude/rules/architecture.md` — full read; locate the preplan row in the import-rules table and the prose under "Pre-Planning Layer".
- `apps/replay-producer/package.json` and `apps/replay-producer/src/cli.ts` — read to confirm what to render in the diagram (CLI tool, consumes `@legendary-arena/game-engine` only, no DB / no network).
- `docs/ai/DECISIONS.md` — read recent entries to match D-NNNN format.
- `docs/01-VISION.md §17` — confirm i18n posture matches vision.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — applies to prose written into the doc
- Full file contents for every modified file — no diffs, no snippets

**Packet-specific:**
- **No code changes.** Files under `packages/`, `apps/`, `data/`, or any test files MUST NOT be modified.
- **No content changes beyond the three identified items.** This is a hygiene WP, not a "while I'm here" rewrite. If other drift is noticed, log it as a follow-up WP rather than fixing inline.
- **The preplan-wording fix must not change the *rule*.** Both phrasings already encode the same constraint; this WP picks one canonical phrasing and propagates. The semantics MUST NOT shift.
- **The replay-producer diagram addition must not move existing nodes.** Add to the diagram; do not redraw.
- **The i18n posture is "deferred"** — do not commit to a specific library or strategy. Future WPs that adopt i18n make their own decision.

**Session protocol:**
- If a fourth drift item is noticed during reading, STOP and add it to a follow-up WP — do not extend this WP's scope.

**Locked contract values:**
- N/A — this WP touches no engine constants.

**Forbidden packages (per `00.3 §7`):**
- This WP introduces none. No `vue-i18n`, `@formatjs/intl`, etc.

---

## Scope (In)

### A) Diagram update
- **`docs/02-ARCHITECTURE.md`** — modified: extend the System Layers ASCII diagram to show `apps/replay-producer` as a CLI box consuming `packages/game-engine` (one new node, one new edge). Add a row to the Package Boundaries table covering `apps/replay-producer` (mirrors the existing rows).

### B) Preplan-wording alignment
- **`docs/ai/ARCHITECTURE.md`** — modified: pick one canonical phrasing for preplan's import rule (recommend: "type-only imports at compile time; reads engine state via projections passed in by the host app"). Apply to the preplan paragraph + any table entry.
- **`docs/02-ARCHITECTURE.md`** — modified: align with the canonical phrasing.
- **`.claude/rules/architecture.md`** — modified: align both the import-rules table and the "Pre-Planning Layer" prose with the canonical phrasing.

### C) i18n posture
- **`docs/ai/ARCHITECTURE.md`** — modified: add `## Internationalization` section (one paragraph). Cite Vision §17. State that MVP is English-only, i18n is deferred, no library is adopted, user-visible strings live where they are used.
- **`docs/02-ARCHITECTURE.md`** — modified: add a one-line summary under the relevant section pointing to the authoritative version.
- **`docs/ai/DECISIONS.md`** — modified: append `D-NNN01` anchoring the deferred-i18n posture.

### D) STATUS + WORK_INDEX
- **`docs/ai/STATUS.md`** — modified: one-line capability statement ("Architecture-doc hygiene cleanup at WP-119; i18n posture: deferred").
- **`docs/ai/work-packets/WORK_INDEX.md`** — modified: check WP-119 off.

---

## Out of Scope

- **No code changes.** Strictly doc hygiene.
- **No new architecture sections** beyond `## Internationalization`. The WP-116 / WP-117 / WP-118 sections are separate WPs.
- **No i18n library evaluation** or strategy work — the posture is "deferred".
- **No replay-producer behavior changes.** The CLI is unchanged; only its diagram representation is added.
- **No `.claude/rules/*.md` rewrites** beyond the preplan-wording alignment.
- **No retroactive changes** to historical WPs even if they used the older preplan phrasing — they are immutable per `.claude/rules/work-packets.md`.

---

## Files Expected to Change

- `docs/ai/ARCHITECTURE.md` — **modified** — preplan wording + new `## Internationalization` section
- `docs/02-ARCHITECTURE.md` — **modified** — diagram update + preplan wording + i18n one-liner
- `.claude/rules/architecture.md` — **modified** — preplan wording alignment
- `docs/ai/DECISIONS.md` — **modified** — D-NNN01 (i18n posture)
- `docs/ai/STATUS.md` — **modified** — capability line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off

6 files. Well under the 8-file cap.

No other files may be modified.

---

## Acceptance Criteria

### Diagram
- [ ] `docs/02-ARCHITECTURE.md` System Layers diagram contains a node labeled `apps/replay-producer` (or equivalent)
- [ ] The diagram shows an edge from `apps/replay-producer` into `packages/game-engine` (CLI consumer)
- [ ] No other diagram nodes were removed or moved
- [ ] Package Boundaries table contains a row for `apps/replay-producer`

### Preplan wording
- [ ] `docs/ai/ARCHITECTURE.md`, `docs/02-ARCHITECTURE.md`, and `.claude/rules/architecture.md` use identical canonical phrasing for the preplan import rule
- [ ] The semantic constraint (type-only imports, no runtime engine code, no boardgame.io import, no writes to G/ctx) is preserved

### i18n
- [ ] `docs/ai/ARCHITECTURE.md` contains `## Internationalization` section
- [ ] Section explicitly says: MVP is English-only, i18n is deferred, no library adopted
- [ ] Section cites Vision §17
- [ ] `docs/02-ARCHITECTURE.md` has the one-line summary + cross-link
- [ ] `docs/ai/DECISIONS.md` contains `D-NNN01` for the i18n posture

### Hygiene
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-119 checked off with date + commit hash
- [ ] No code files modified (`git diff -- 'apps/**' 'packages/**' 'data/**'` is empty)
- [ ] No files outside `## Files Expected to Change` modified

---

## Verification Steps

```pwsh
# Step 1 — replay-producer in diagram
Select-String -Path "docs\02-ARCHITECTURE.md" -Pattern "replay-producer"
# Expected: at least one match inside the System Layers section + one in the Package Boundaries table

# Step 2 — preplan wording is consistent across all three files
Select-String -Path "docs\ai\ARCHITECTURE.md","docs\02-ARCHITECTURE.md",".claude\rules\architecture.md" -Pattern "type-only" -Context 0,1
# Expected: matches in all three files using the same canonical phrasing

# Step 3 — i18n section exists
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "^## Internationalization"
# Expected: one match

# Step 4 — i18n DECISIONS entry
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "^### D-NNN01"
# Expected: one match (replace NNN with assigned prefix)

# Step 5 — no code touched
git diff --name-only -- "apps/**" "packages/**" "data/**"
# Expected: no output

# Step 6 — scope check
git diff --name-only
# Expected: only the six files in ## Files Expected to Change

# Step 7 — full test suite regression check
pnpm -r test
# Expected: exits 0; baseline unchanged (no code changes should mean no test deltas)
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r test` exits 0
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated with D-NNN01
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-119 checked off with today's date + commit hash
- [ ] No files outside `## Files Expected to Change` modified
- [ ] Lint-gate self-review passes (§17 i18n trigger confirmed; §20 N/A justified)

---

## Lint Self-Review

> To be filled in by the packet author before pre-flight invocation.
