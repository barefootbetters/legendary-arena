# Session Context — WP-084 (Delete Unused Auxiliary Metadata Schemas and Files)

> **Authored:** 2026-04-21 as part of the A0 SPEC pre-flight bundle for
> WP-084. **Purpose:** bridge document for the executor. Captures the
> branch, starting commit, scope boundary, baseline-check placeholders,
> and the six pre-flight STOP gates the executor must turn green before
> beginning Commit A.
>
> **No execution is performed by authoring this file.** Deletion of any
> schema, JSON file, or validate.ts block is forbidden until every STOP
> gate in §5 is marked complete.

WP-084 is a **delete-only subtractive packet** driven by a 2026-04-21
audit of the registry layer. Five Zod schemas, five JSON files, one
orphan JSON file, and one `validate.ts` phase block are removed because
**no runtime consumer reads them** — not the server, not the viewer, not
the game engine, not the pre-plan package. The sole consumer is
`packages/registry/scripts/validate.ts` Phase 2, which is opt-in and not
wired to `pnpm build` / `pnpm test` / CI.

The authoritative execution contract is
`docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md`.
The authoritative design document is
`docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`. This
session-context file does not redefine either; it captures pre-flight
preparation state.

---

## 1. Branch

`wp-084-delete-unused-auxiliary-metadata`

Cut from the current tip of `main` at pre-flight time. If execution
instead begins from a clean point on the active branch
(`wp-036-ai-playtesting`) after EC-036 governance has fully closed,
record that decision here and re-derive the baseline in §3.

---

## 2. Starting Commit

**Placeholder (to be filled by executor at pre-flight):** `_______________`

Record the full 40-char SHA, the short 7-char SHA, and the commit
subject line. The starting commit is the anchor for every byte-for-byte
diff invariant in EC-109 §Guardrails.

Example form once filled:

> `45ddb49` — SPEC: close WP-036 / EC-036 governance (STATUS + WORK_INDEX + EC_INDEX + A-036-02 + post-mortem)

---

## 3. Scope Declaration

### 3.1 In-Scope Paths (Commit A)

EC-109 permits modification of exactly these files and nothing else:

- `packages/registry/src/schema.ts` — delete five schemas + adjacent
  block comments; surviving schemas untouched
- `packages/registry/src/index.ts` — remove re-exports of the five
  deleted schemas and their inferred types
- `packages/registry/scripts/validate.ts` — remove the five schema
  imports; excise the Phase 2 validation block; renumber former Phases
  3 / 4 / 5 → 2 / 3 / 4
- `data/metadata/card-types.json` — delete (`git rm`)
- `data/metadata/card-types-old.json` — delete (`git rm`, orphan)
- `data/metadata/hero-classes.json` — delete (`git rm`)
- `data/metadata/hero-teams.json` — delete (`git rm`)
- `data/metadata/icons-meta.json` — delete (`git rm`)
- `data/metadata/leads.json` — delete (`git rm`)
- `package.json` — modified only if the `registry:validate` script
  requires a flag or name change after phase excision; skip otherwise
- `apps/registry-viewer/CLAUDE.md` — modified only if it currently
  mentions any deleted file or schema (audit says none)
- `docs/03.1-DATA-SOURCES.md` — modified only if it currently lists any
  of the five deleted files
- `packages/registry/CLAUDE.md` — modified only if present and it lists
  any of the five deleted schemas in its schema inventory

### 3.2 In-Scope Paths (Commit B — Governance Close)

- `docs/ai/DECISIONS.md` — five governance entries per WP-084 §Governance
  (JSON deletion + reintroduction rule; schema deletion + reintroduction
  rule; `card-types-old.json` orphan deletion; `validate.ts` contract
  clarification; future-reintroduction pattern)
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-084 `[ ]` → `[x]` with
  date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-109 row to `Done`
- `docs/ai/STATUS.md` — completion line, if the file exists and prior
  WPs followed that convention

### 3.3 In-Scope Paths (Commit A0 — this SPEC bundle)

- `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md`
- `docs/ai/execution-checklists/EC_INDEX.md` (Draft row for EC-109)
- `docs/ai/work-packets/WORK_INDEX.md` (pending row for WP-084)
- `docs/ai/session-context/session-context-wp084.md` (this file)
- `docs/ai/invocations/preflight-wp084.md`

### 3.4 Out-of-Scope Paths (Must NOT Be Modified by WP-084)

- `packages/registry/src/theme.schema.ts`
- `packages/registry/src/theme.validate.ts`
- `packages/registry/scripts/upload-r2.ts`
- `data/metadata/keywords-full.json` (surviving — LOCKED byte-for-byte)
- `data/metadata/rules-full.json` (surviving — LOCKED byte-for-byte)
- `data/metadata/sets.json` (surviving — LOCKED byte-for-byte)
- All surviving schemas in `packages/registry/src/schema.ts`
  (`SetDataSchema`, `SetIndexEntrySchema`, `HeroCardSchema`,
  `MastermindCardSchema`, `VillainCardSchema`, `VillainGroupSchema`,
  `SchemeSchema`, `HeroSchema`, `MastermindSchema`, `CardQuerySchema`,
  `RegistryConfigSchema`, and any schemas added by WP-082 / WP-083 if
  they have landed) — LOCKED byte-for-byte
- `apps/registry-viewer/src/**` runtime code (no change in behavior)
- `apps/server/**`
- `packages/game-engine/**`
- `packages/preplan/**`
- `content/themes/**`
- Any R2 artifact

### 3.5 Out-of-Scope Concerns (Explicit Non-Goals)

- **R2 cleanup.** If any of the five deleted files happen to exist on
  R2 from a historical manual upload, they stay. Nothing fetches them.
- **Hero class glossary.** `HERO_CLASS_GLOSSARY` (five hardcoded entries
  in `useRules.ts`) is unrelated to the deleted `hero-classes.json` and
  stays in place.
- **Replacement schemas or data.** None. Governance forbids
  reintroduction without a runtime consumer in the same WP.
- **`validate.ts` surviving phases.** Phases 1, 3, 4, 5 (post-renumber:
  1, 2, 3, 4) logic is preserved verbatim; only phase numbers in
  headers, log prefixes, and section comments change.
- **Worktree copies.** Any `.claude/worktrees/` mirror of the deleted
  files is ephemeral and not this packet's concern.

---

## 4. Baseline Checks (Re-Derive at Pre-Flight)

All three must exit 0 at the starting commit. The executor records the
actual numeric results below before beginning Commit A. A regression in
any of these counts after execution is a hard failure (baseline
invariance is a locked Acceptance Criterion — see EC-109 §Guardrails).

### 4.1 `pnpm -r build`

```bash
pnpm -r build
```

- **Expected:** exits 0
- **Result (placeholder):** `exits ___ at commit ___`

### 4.2 `pnpm -r --if-present test`

```bash
pnpm -r --if-present test
```

- **Expected:** exits 0
- **Baseline passing count (placeholder):** `_______ tests / 0 failing`
- Record per-package counts if useful for drift detection (registry,
  game-engine, vue-sfc-loader, replay-producer, server, arena-client,
  registry-viewer).

### 4.3 `pnpm registry:validate`

```bash
pnpm registry:validate
```

- **Expected:** exits 0; log output shows five phases running over
  the current metadata files
- **Result (placeholder):** `exits ___; phases observed ___`

Post-execution, the same command must exit 0 again, with log output
showing **four** phases (renumbered 1, 2, 3, 4) over
`sets.json` + per-set cards + cross-refs + images.

---

## 5. Pre-Flight STOP Gates (All Must Pass Before Deletion)

These gates are reproduced verbatim from EC-109 §Pre-Flight STOP Gates
so the executor can mark progress in one place. Any ❌ or unknown item
blocks execution — STOP and triage in writing before continuing.

### Gate 1 — Branch & Baseline

- [ ] Working branch is `wp-084-delete-unused-auxiliary-metadata` cut
      from current `main` tip (or a clean equivalent — record decision
      in §1). Starting commit hash recorded in §2.
- [ ] `pnpm -r build` exits 0 at the starting commit (§4.1 result
      recorded).
- [ ] `pnpm -r --if-present test` exits 0 at the starting commit, with
      baseline passing count recorded in §4.2.
- [ ] `pnpm registry:validate` exits 0 at the starting commit (§4.3
      result recorded) — proves the existing five-phase pipeline is
      green before any phase excision.

### Gate 2 — Pre-Deletion Usage Audit (HARD BLOCKER)

Run these commands verbatim. Any unexpected output blocks execution.

```bash
# 2a. The five schemas are referenced ONLY in validate.ts
grep -rn "CardTypeEntrySchema\|HeroClassEntrySchema\|HeroTeamEntrySchema\|IconEntrySchema\|LeadsEntrySchema" \
  packages/ apps/ scripts/ \
  | grep -v "^packages/registry/scripts/validate.ts"
# expected: no output

# 2b. The five JSON filenames are referenced ONLY in validate.ts
grep -rn "card-types.json\|hero-classes.json\|hero-teams.json\|icons-meta.json\|leads.json" \
  packages/ apps/ scripts/ docs/ \
  | grep -v "^packages/registry/scripts/validate.ts" \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/work-packets/WORK_INDEX.md" \
  | grep -v "^docs/ai/execution-checklists/EC-109" \
  | grep -v "^docs/ai/session-context/session-context-wp084.md" \
  | grep -v "^docs/ai/invocations/preflight-wp084.md"
# expected: no output

# 2c. Orphan confirmation — card-types-old.json has zero consumers
grep -rn "card-types-old.json" packages/ apps/ scripts/ docs/ \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/execution-checklists/EC-109" \
  | grep -v "^docs/ai/session-context/session-context-wp084.md" \
  | grep -v "^docs/ai/invocations/preflight-wp084.md"
# expected: no output

# 2d. No R2-upload automation references any of the six target files
grep -rn "card-types.json\|card-types-old.json\|hero-classes.json\|hero-teams.json\|icons-meta.json\|leads.json" \
  packages/registry/scripts/ apps/ scripts/ \
  | grep -iE "(upload|sync|deploy|r2|bucket)"
# expected: no output
```

- [ ] 2a returns no output
- [ ] 2b returns no output
- [ ] 2c returns no output
- [ ] 2d returns no output

### Gate 3 — Contract & Doc Sanity Checks

- [ ] `docs/ai/DECISIONS.md` contains **no prior decision** declaring
      any of the five deleted files or schemas as a current or future
      runtime contract. Any hit must be triaged; a "future runtime
      contract" hit is a hard BLOCKER.
- [ ] `docs/ai/REFERENCE/00.2-data-requirements.md` does **not** list
      any of the five files or schemas as a current or future required
      input. Active contract mentions BLOCK; historical / superseded
      mentions (e.g., crossed-out fields, "earlier drafts referenced…")
      may be cleaned up as part of Commit A.
- [ ] `packages/registry/scripts/upload-r2.ts` is re-verified clean —
      does not reference any of the six target files.
- [ ] `apps/registry-viewer/CLAUDE.md` scanned: any mention of the
      deleted files or schemas in §"Key Files" or §"Data Flow" is
      catalogued for removal in Commit A.

### Gate 4 — `validate.ts` Safety Check

- [ ] Phase numbering in `validate.ts` is referenced **only inside the
      file itself**. External references to "Phase 2 / 3 / 4 / 5" in
      scripts, docs, or automation are absent (grep confirmed).
- [ ] Renumbering plan locked: former Phase 1 unchanged; former Phase 2
      deleted; former Phases 3 / 4 / 5 → 2 / 3 / 4.
- [ ] `pnpm registry:validate` is confirmed the only npm script that
      invokes `validate.ts`.

### Gate 5 — Git-File Health

- [ ] No post-2026-04-21 commit touches any of the six target files.
      Any late edit is a BLOCKER — re-read the diff, because a recent
      edit may imply a consumer the audit missed.
- [ ] No `.gitignore` / `.gitattributes` rule prevents `git rm` from
      tracking the deletions.

### Gate 6 — Deletion-Intent Confirmation

- [ ] This WP makes **delete-only** changes: no new schemas, no
      replacement JSON, no loader rewiring, no new fetchers, no new npm
      scripts.
- [ ] The four surviving metadata inputs are LOCKED byte-for-byte:
      `keywords-full.json`, `rules-full.json`, `sets.json`.
- [ ] No file under `apps/registry-viewer/src/`, `apps/server/`,
      `packages/game-engine/`, or `packages/preplan/` will be modified.
- [ ] No R2 artifact will be mutated.

### Pre-Flight Verdict (Binary)

- [ ] **ALL gates 1–6 complete → EC-109 MAY EXECUTE.** Update
      `docs/ai/invocations/preflight-wp084.md` from Pending to READY and
      proceed to Commit A.
- [ ] **ANY gate incomplete → EXECUTION BLOCKED.** Leave
      `preflight-wp084.md` at Pending, document the finding in this
      file under a new §6 "Pre-Flight Findings" section, and either
      resolve or escalate.

---

## 6. Dependency Confirmation

**WP-084 is independent of WP-082 and WP-083.**

Authoritative anchor: `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`
§Dependencies reads: *"None. Independent of WP-082 and WP-083."*

Rationale captured at audit time:

- The five auxiliary schemas and their JSON files have zero runtime
  consumers. Their only consumer is `validate.ts` Phase 2, which is
  opt-in.
- WP-082 adds glossary schemas (`KeywordGlossaryEntrySchema`,
  `RuleGlossaryEntrySchema`) and labels; those schemas are separate
  from the five WP-084 deletes.
- WP-083 adds fetch-time validation (`ViewerConfigSchema`,
  `ThemeIndexSchema`, reuse of existing theme schemas); those schemas
  are also separate from the five WP-084 deletes.
- If WP-082 or WP-083 have not yet landed at WP-084 pre-flight time,
  the EC-109 §Guardrails list of "surviving schemas LOCKED byte-for-byte"
  simply omits any not-yet-present schema. No amendment is required —
  re-verify the actual survivor list at Gate 1 and proceed.
- If WP-082 or WP-083 land after WP-084, they neither depend on nor are
  blocked by this cleanup; the surviving `validate.ts` phases (post-
  renumber) accommodate any glossary / theme additions those WPs
  introduce.

Execution may proceed in any order: WP-084 first, last, or sandwiched
between WP-082 and WP-083.

---

## 7. Notes for Executor

- This file is **not** authoritative over EC-109 or WP-084. If a
  conflict surfaces on design intent, WP-084 wins; on execution
  contract, EC-109 wins.
- Do NOT pre-mark any gate in §5 complete until the underlying command
  or inspection actually passes. Optimistic marking violates WP-084
  §Session Protocol and EC-109 Pre-Flight Verdict discipline.
- Three-commit topology is locked: **A0 SPEC** (this bundle) → **A
  EC-109:** (execution) → **B SPEC** (governance close). The commit
  prefix `WP-084:` is forbidden by the commit-msg hook per P6-36.
- On discovering any audit miss (unexpected grep output, 404 during
  viewer smoke, etc.), STOP. Do not re-add a deleted schema or JSON
  file to "paper over" the finding — the premise of WP-084 is that
  these artifacts have no consumer. Escalate, triage, and amend the WP
  in writing before proceeding.
