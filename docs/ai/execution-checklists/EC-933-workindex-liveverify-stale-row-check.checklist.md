# EC-933 — Live-Verify Stale-Row Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-895-workindex-liveverify-stale-row-check.md
**Layer:** Shared Tooling (governance scripts + CI)
**Risk Tier:** LOW — a detect-only doc linter in CI; no runtime, engine, server, persistence or player surface. Lightweight Lane (D-24028).

## Before Starting
- [ ] Baseline `origin/main` includes #3376 (reserve WP-895 / EC-933 / D-24852) and the reconciliation PRs #3371 / #3373 / #3374.
- [ ] `scripts/check-workindex-executed-open.mjs` (WP-671 / D-24485) is the idiom: pure helpers exported, CLI behind `isRunDirectly()`, full-sentence report, `node:fs` only. If it differs, STOP.
- [ ] Coverage & Ledger Gates (`hero-effect-coverage` job) runs `pnpm install` and then `workindex:rows:check` / `workindex:executed:check`; the new step follows them.
- [ ] Scaffold recorded before eligibility (WP §Design Rationale): exit 0 on `main`; exit 1 with 58 rows on `62ac480e7^`.
- [ ] Scope lock: exactly the files in §Files to Produce (4 code/test + 8 governance); any other edit = FAIL — surface it before touching the file.

## Locked Values (do not re-derive)
- Pending pattern (case-insensitive): `(?:D-24026|live[- ]verif\w*|live-on-surface)[^.;]{0,60}?\bpending\b(?![- ]choice)`
- Done-row pattern: `^- \[x\] (WP-\d+(?:\.\d+)?) ` — the template `WP-NNN` and `**(backlog …)**` rows never match.
- WP token in live-verify.json `wp`: `/WP-\d+(?:\.\d+)?/g`, compared as whole tokens.
- Stale ⇔ done row ∧ pending phrase ∧ ≥1 entry names the WP ∧ every such entry `state === "verified"`.
- pnpm entries: `workindex:liveverify:check` → `node scripts/check-workindex-liveverify-pending.mjs`; `workindex:liveverify:test` → `node --import tsx --test scripts/check-workindex-liveverify-pending.test.ts`.
- CI step name: `WORK_INDEX live-verify consistency check`; runs the test, then the check.
- live-verify.json must have `schemaVersion === 1` and an `entries` array, else a full-sentence error (exit 1).
- Exit 0 = consistent; exit 1 = ≥1 stale row or unreadable/malformed input.

## Guardrails
- Detect-only: never write WORK_INDEX or live-verify.json.
- live-verify.json is the only oracle; no git history, no network, no PR reads.
- A row with no entry, or any `partial` / `pending` entry, MUST pass.
- Only `- [x]` rows are checked.
- No new npm dependency. Built-ins only: script `node:fs`, `node:path`, `node:url`, `node:process`; test `node:test`, `node:assert`.
- MUST exit 0 on `main`; real drift is reconciled in the row, never by weakening the pattern.
- Fixtures are never mutated; the POSITIVE and the cross-clause NEGATIVE each carry a recorded revert proof.

## Required `// why:` Comments
- Repo-root anchoring to the script's own directory.
- Done-rows-only (an open row is expected to be pending; template/backlog skipped).
- The pending pattern: the real phrasings it covers, why it is clause-bounded, and the `pending-choice` lookahead.
- Whole-token `wp` parsing (free-text field; WP-67 ≠ WP-674).
- No entry / any non-verified entry = legitimately pending.
- The CLI guard (`isRunDirectly()`).

## Files to Produce
- `scripts/check-workindex-liveverify-pending.mjs` — **new** — the guard.
- `scripts/check-workindex-liveverify-pending.test.ts` — **new** — 8 cases (WP §Scope In).
- `package.json` — **modified** — the two entries above, after `workindex:executed:test`.
- `.github/workflows/ci.yml` — **modified** — the one step after `workindex:executed:check`, in its own `INFRA:` commit (an `EC-###:` commit may not touch `.github/workflows/**`, D-24444 Guard A).
- Commit topology: `SPEC:` draft → `EC-933:` script + test + `package.json` → `INFRA:` CI step → `SPEC:` close; one PR.
- Governance: WP-895, this EC, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (`LANDED` stamp on WP-895 / EC-933 / D-24852).

## After Completing
- [ ] `pnpm workindex:liveverify:check` 0; `pnpm workindex:liveverify:test` 8/8; control run on `62ac480e7^` exits 1 (record the count); both revert proofs observed, then restored.
- [ ] `pnpm workindex:rows:check`, `workindex:executed:check`, `ledger:numbers:check`, `roadmap:counts:check` all 0 after the close.
- [ ] `git diff --name-only origin/main` = exactly §Files to Produce.
- [ ] D-24852 Active; STATUS.md says "No user-observable change — infrastructure only"; WORK_INDEX `[x]` with date; EC_INDEX Done with date; mindmap `✅` + `pnpm roadmap:counts:write`; NUMBER-LEDGER WP-895 / EC-933 / D-24852 lines stamped `; LANDED <date>`.
- [ ] Lane empirical criteria 7–9 confirmed (additive; no determinism surface; budget held). Live-verify (D-24026): N/A, `none — infrastructure`.

## Common Failure Smells
- Exit 1 on `main` → a real stale row landed (reconcile it) or the pattern lost its clause bound.
- The test passes with the all-verified branch disabled → the POSITIVE is vacuous.
- A `partial` WP flagged → the oracle uses "some verified" instead of "every verified".
- WP-67 flagged from a `WP-674` entry → substring match instead of whole tokens.
