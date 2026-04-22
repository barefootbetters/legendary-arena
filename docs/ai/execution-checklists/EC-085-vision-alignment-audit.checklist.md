# EC-085 — Vision Alignment Audit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-085-vision-alignment-audit.md
**Layer:** Governance / Audit Tooling

**Execution Authority:**
This EC is the authoritative execution checklist for WP-085.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-085.

---

## Before Starting

- [ ] INFRA `24996a9` landed (four `.greps.mjs` scripts under
      `scripts/audit/vision/`, each exporting `RULES` + `runRules()`)
- [ ] SPEC `0689406` landed (§17 in `00.3`; Vision Trailer in `01.3`;
      Vision Sanity Check + `01-VISION.md` at Authority Chain #3 in `01.4`)
- [ ] SPEC `2f65d9f`, `b1c675b`, `2e88aa7` all landed (Phase 7 WP
      blocks; breadcrumb; WP-085 registration + D-8501)
- [ ] `git grep -P` available; `pnpm` and Node v22+ installed;
      `docs/audits/` exists or will be created at first run

## Locked Values (do not re-derive)

- Baseline constants (source: INFRA `24996a9` on `main`):
  `EXPECTED_DET_001 = 6`, `EXPECTED_DET_007 = 4`,
  `EXPECTED_MONETIZATION = 0`, `EXPECTED_REGISTRY = 0`,
  `EXPECTED_ENGINE_BOUNDARY = 0`.
- DET-001 allowlist — six doc-comment file:line pairs:
  `coreMoves.impl.ts:10`, `zoneOps.ts:5`, `setup/shuffle.ts:5`,
  `simulation/ai.legalMoves.ts:9`, `simulation/ai.random.ts:9`,
  `simulation/simulation.runner.ts:10` (all under
  `packages/game-engine/src/`).
- DET-007 allowlist — four file:line pairs, single-channel:
  `persistence/persistence.types.ts:75`, `persistence/snapshot.create.ts:86`,
  `persistence/snapshot.create.ts:90`, `versioning/versioning.stamp.ts:59`
  (all under `packages/game-engine/src/`).
- Report path: `docs/audits/vision-alignment-{YYYY-MM-DD}.md` (local date).
- Vision trailer: `Vision: §3, §13, §14, §22, §24`.

## Guardrails

- Two-channel DET-001: script-channel executable count = `0` after the
  comment-aware filter; orchestrator-channel allowlist verification =
  exactly 6 doc-comment matches. Deviation in either channel is a FAIL.
  DET-007 stays single-channel — no comment filter on it.
- Orchestrator is read-only against `packages/` and `apps/`. Reading
  the six DET-001 allowlist paths for doc-comment form verification
  is permitted; imports of engine/registry/server/UI code are not.
- Same-day re-run refuses to overwrite; exits non-zero with a
  full-sentence error.
- ESM only, Node v22+, `node:` prefix on built-ins. No `.reduce()` for
  branching. No magic numbers — all baseline values as named constants.

## Required `// why:` Comments

- `determinism.greps.mjs` comment-aware filter: explain asymmetry
  with DET-007 (DET-001 doc-comment hits are documentation; DET-007
  doc-comment hits carry equal meaning).
- `run-all.mjs` date-collision refusal: explain audit-history
  immutability.

## Files to Produce

### Commit A (EC-085 execution)
- `scripts/audit/vision/run-all.mjs` — **new** — orchestrator
- `scripts/audit/vision/determinism.greps.mjs` — **modified** —
  comment-aware filter on DET-001 only; other RULES untouched
- `docs/audits/vision-alignment-{YYYY-MM-DD}.md` — **new** — first
  audit report with audited commit hash, per-scan counts, AC-3/AC-4
  allowlist references, DET-001 baseline-exception enumeration,
  single `VERDICT:` line, `Vision:` trailer

### Commit B (SPEC governance close; not EC-085)
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`
  (WP-085 `[ ]` → `[x]`), `docs/ai/DECISIONS.md` (Path B
  operational claim + two-channel DET-001 model)

## After Completing

- [ ] Baseline matches bit-for-bit (6 / 4 / 0 / 0 / 0); both DET-001
      channels observable in the report
- [ ] Same-day re-run refuses (exit code non-zero)
- [ ] `git diff --name-only packages/ apps/` empty
- [ ] `git diff --name-only` limited to the three Commit-A files
- [ ] EC-085 commit body carries the Vision trailer above
- [ ] Commit B lands STATUS + WORK_INDEX checkbox + two DECISIONS
      entries
