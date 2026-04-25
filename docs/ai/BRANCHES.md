# BRANCHES.md — Retained Topic Branches

> Inventory of local topic branches that are **not** merged into `main` but
> are deliberately retained. Each entry records why the branch is kept,
> what it contains, and what the future disposition is expected to be.
>
> Purpose: prevent these branches from being silently pruned during routine
> branch-cleanup passes, and give future executors enough context to
> reclaim, formally close, or supersede the work without re-investigating
> every branch tip.
>
> Updated whenever a topic branch is intentionally retained past its
> originating WP's expected completion window, or when an entry's status
> changes.

---

## Retention Status Definitions

- **paused-mid-execution** — A WP was started, code/spec landed on the
  branch, then work paused before merge. The branch is the canonical
  artifact of the in-progress work. Reclaim by resuming the WP under its
  original number, OR by formally closing the WP and re-scoping under a
  new WP number that supersedes it.
- **abandoned-unmerged** — A WP's design or implementation diverged from
  what eventually landed on `main` (under different commits). The branch
  carries unique drafts / artifacts that were not adopted. Retain only
  while those drafts may still inform future work; otherwise close the
  WP formally and delete.
- **intentional-quarantine** — A branch deliberately preserved as a
  durable, audit-traceable reference to content that was excluded from
  its originating WP by guardrails. Not a merge candidate. Reclaim only
  under an explicitly governed future WP that authorizes the excluded
  content.

---

## Retained Branches

### `wp-068-preferences-foundation`

- **Tip:** `8ec6ced EC-070: split After Completing into dedicated Verification + Scope Guardrails sections`
- **Authored:** 2026-04-18
- **Status:** **paused-mid-execution**
- **Originating WP:** WP-068 (Preferences Foundation, Option A — no UI;
  governing EC is **EC-070**, not EC-068).
- **Unique content not on `main`:**
  - `apps/registry-viewer/src/prefs/**` — Pinia preferences foundation:
    `shared/registry/sectionRegistry.ts`, `shared/schema/{accessibility,
    advancedBase, appearance, base}.schema.ts`,
    `shared/store/{createPreferencesStore, persistence}.ts`, plus
    matching `*.test.ts` siblings (incl. `_schema-purity.test.ts`).
  - `apps/registry-viewer/src/prefs/registerSections.ts`,
    `shared/composables/usePreferences.ts`, `main.ts` modifications.
  - `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` (~941 lines).
  - `docs/ai/work-packets/WP-068-preferences-foundation.md`,
    `docs/ai/execution-checklists/EC-070-preferences-foundation.checklist.md`,
    `docs/ai/session-context/session-context-wp068.md`.
  - DECISIONS.md additions in the D-1414 / Preferences range
    (renumbered from a duplicate D-1401).
  - STATUS.md / WORK_INDEX.md entries for WP-068.
  - `pnpm-lock.yaml` updates (Pinia + dependencies).
- **Why retained:** The implementation work is real and sizeable
  (≈3057 net additions across ~24 files). Discarding the branch would
  lose the only canonical artifact of the WP-068 / EC-070 work.
- **Disposition next:** Either resume execution under WP-068 / EC-070
  (rebase onto current `main` first) or formally close WP-068 with a
  decision recording why the foundation was abandoned, then delete the
  branch. Do not silently prune.

### `wp-081-theme-audio`

- **Tip:** `41fa60a SPEC: WP-081 theme audio fields — musicTheme / musicAIPrompt / musicURL`
- **Authored:** 2026-04-19
- **Status:** **abandoned-unmerged**
- **Originating WP:** WP-081 (Theme Audio Registry — design phase).
- **Unique content not on `main`:**
  - `docs/ai/drafts/WP-081-theme-audio-registry-contract-skeleton.md`
    (~593 lines) — design draft for the audio contract.
  - `docs/ai/drafts/theme-audio-v2-decisions-draft.md` (~360 lines) —
    draft decisions document.
  - `content/themes/00-ScriptCombindJSON.ps1`,
    `content/themes/01-ScripAddMusicFields.ps1` — tooling scripts.
  - Per-theme JSON modifications carrying an early version of the
    `musicTheme` / `musicAIPrompt` / `musicURL` fields.
- **Why retained:** Main has the music fields but reached them
  independently — the per-theme JSON files differ from the branch by
  ~27 lines each, and the drafts / tooling scripts were never adopted.
  Branch may still inform a future audio-contract WP.
- **Disposition next:** Read the two drafts when the audio-contract
  WP is authored to harvest any decisions worth preserving, then
  delete the branch. If the audio contract has been fully settled
  elsewhere on `main` already, delete now.

### `wp-082-rules-summary-quarantine`

- **Tip:** `a1b9da0 INFRA: quarantine rules-full.json summary rewrites for future WP reclaim`
- **Authored:** 2026-04-21
- **Status:** **intentional-quarantine**
- **Originating WP:** WP-082 (closed; see Amendments A-082-02).
- **Unique content not on `main`:**
  - `data/metadata/rules-full.json` — the 20-entry rulebook-verbatim
    `summary` rewrite that WP-082's EC-107 §Non-Negotiable guardrail
    blocked from merging (`label` / `key` byte-identical; only
    `summary` rewrites).
- **Why retained:** The branch's tip commit message documents the
  quarantine intent verbatim: *"this branch is NOT a merge candidate.
  It exists only as a durable, reviewable artifact so the rewrite
  content survives as an audit-traceable reference until the reclaim
  WP is authored."* Retain until a future WP with explicit scope
  authorizes the rulebook-verbatim summary rewrites.
- **Disposition next:** When a successor WP is authored to land
  rulebook-verbatim summary content, that WP cites this branch in its
  Authority block, harvests the diff, and the branch is deleted as
  part of the successor's governance close. Do not delete before the
  reclaim WP exists.

---

## Pruning Discipline

Routine branch-cleanup passes (e.g., `git branch -d` for merged
branches, periodic housekeeping after a WP merges) **must not** delete
any branch listed above without first updating this file. The pruning
sequence is:

1. Confirm the originating WP / governance entry has been formally
   closed or superseded (depending on the branch's Status).
2. Update the entry below with the closing reference (commit hash,
   successor WP, or DECISIONS.md entry).
3. Move the entry to a `## Closed` section (add when first needed) or
   delete it from this file outright.
4. Then delete the branch.

This gives the pruning step an audit trail in `git log` of
`docs/ai/BRANCHES.md` rather than silent disappearance.
