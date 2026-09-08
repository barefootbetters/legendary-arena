# EC-708 — Govern-Close Consistency Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-671-govern-close-consistency-guard.md
**Layer:** Shared Tooling (governance scripts + CI)

## Before Starting
- [ ] `scripts/check-workindex-rows.mjs` (WP-455, the row-GRAMMAR check) is the idiom to mirror — this guard is the distinct execution-vs-checkbox CONSISTENCY check. `scripts/check-number-ledger.mjs` is a second pattern (parse doc → exit 1 with a full-sentence report / exit 0 clean; `node:fs` only). If either differs, STOP: reconcile — the WP intent governs.
- [ ] `.github/workflows/ci.yml` runs the governance `:check` steps (~L180–255, incl. `workindex:rows:check`); the new step is a sibling. `package.json` `*:check` entries (~L52–68) are the script-entry convention.
- [ ] DECISIONS status is readable two ways: the heading `### D-NNNNN — … (Active <date> — WP-NNN / EC-NNN)` and/or a `**Status:** Active|Drafted` line. WORK_INDEX rows carry `- [ ]`/`- [x]`, a `reserves **D-NNNNN**` / `**D-NNNNN**` reference, and `**<status>**` text.
- [ ] **SCAFFOLD-DECIDE the signal (D-24485, load-bearing).** Prototype all three candidates against the REAL `WORK_INDEX` + `DECISIONS` on current `main` and RECORD which meets the acceptance test: (1) `[ ]` + owned-D-`Active` — sound ONLY if no drafted-open WP carries a premature `Active` D (verify — `DECISIONS` uses both `Drafted` and `Active`); (2) `[ ]` + own-clause executed-text — tokens from REAL phrasing (`executed`, `shipped`, `pending commit/PR` — NOT hardcoded `pending PR`); (3) `[ ]` + merged `EC-### / WP-NNN:` commit — convention-independent, needs `fetch-depth: 0`. **Acceptance:** the chosen signal(s) exit **0** on clean `main`, catch a synthetic drift, and do NOT trip a drafted-open row, reserve-only line, template placeholder, backlog row, or WP-042.1.
- [ ] **If the scaffold finds a REAL executed-but-open row on `main`,** reconcile it first (a manual `INFRA:` row-flip prerequisite that lands before/with the CI step) — NEVER suppress the signal to force exit 0.
- [ ] Enumerate the finalised scope lock (script + test filenames + which CI job the step joins; whether that job needs `fetch-depth: 0`); any edit outside = FAIL.

## Locked Values (do not re-derive)
- **Fail condition:** a WORK_INDEX `- [ ]` WP row the scaffold-chosen signal(s) mark executed (owned-D-`Active` / own-clause executed-text / merged `EC-###` commit). Signal choice + exact tokens locked at execution per D-24485.
- **Pass condition:** any `- [x]` row; a `- [ ]` row with a `Drafted`/absent owned D-entry, no executed-text, no merged EC commit; a reserve-only ledger line; the template placeholder row; `(backlog …)` rows; WP-042.1.
- **Owned D-entry** = keyed on the literal `reserves **D-NNNNN**` phrase (NOT a bare `**D-NNNNN**` citation — amendment / hard-dep).
- **Parsing:** executed-text scanned in the row's OWN status clause (a cross-WP `WP-NNN …` reference inside the row must not trip); non-WP rows (template, backlog) skipped.
- Exit 0 = consistent; exit 1 = ≥1 violation, full-sentence per-`WP-NNN` report naming the tripped signal.

## Guardrails
- **Detect-only** — the guard NEVER edits `WORK_INDEX`/`DECISIONS`. Reconciliation stays a manual `INFRA:` catch-up.
- **Signal soundness is scaffold-proven, not assumed.** Owned-D-`Active` false-positives if a WP is drafted with a premature Active D; executed-text is phrasing-fragile; the git signal is the convention-independent fallback (with `fetch-depth: 0`). Pick per the recorded scaffold.
- No new npm dependency; `node:fs` (+ `node:test`, + `node:child_process` only if the git signal is chosen).
- MUST exit 0 on the current clean `main` (no false positive) — proven by the scaffold before CI wiring; real drift is reconciled first, never suppressed.
- Own-vs-cited D-entry (`reserves`-keyed) + cross-WP-reference-safe executed-text + non-WP-row skipping — each asserted by a fixture.
- Draft (`[ ]`+Drafted), reserve-only, template, backlog, and genuinely-blocked (WP-042.1) states MUST pass.
- Full-sentence failure messages name each offending `WP-NNN` + the signal.
- This WP's OWN govern-close must not trip the new guard (flip its row to `[x]` in the same close that sets D-24485 Active).

## Required `// why:` Comments
- The chosen signal: `roadmap:counts:check` can't catch this because WORK_INDEX + mindmap go stale together (they agree); the guard needs an independent oracle.
- The owned-D-entry resolution: why a cited-but-not-owned (`reserves`-vs-bare) Active D-number must not false-positive.
- The signal choice rationale (why the scaffold picked file-vs-git; if git, why `fetch-depth: 0`).

## Files to Produce
- `scripts/check-workindex-executed-open.mjs` — **new** — the detect-only guard.
- `scripts/check-workindex-executed-open.test.ts` — **new** — POSITIVE (synthetic executed-but-open row per the chosen signal FAILS) + NEGATIVEs (clean `[x]`, drafted-open `[ ]`+Drafted, cross-WP-reference row, template placeholder, backlog row all PASS) + owned-D `reserves`-keying; cheat-proof (no mutation of the asserted-over inputs).
- `package.json` — **modified** — `workindex:executed:check` (+ `:test`) entry.
- `.github/workflows/ci.yml` — **modified** — the CI step beside `workindex:rows:check` (+ `fetch-depth: 0` on that job only if the git signal is chosen).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24485 Active), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm workindex:executed:check` exits 0 on clean `main` (real drift reconciled first, never suppressed); the new test passes (positive + all negatives + owned-D `reserves`-keying).
- [ ] **Control run:** inject a synthetic executed-but-open row (per the chosen signal) → the check exits 1 naming it; revert. Record the observed result.
- [ ] `pnpm -r build` exits 0; the CI step is wired beside `workindex:rows:check` (file-only: no `fetch-depth` change; git signal: `fetch-depth: 0` on that job).
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] Live-on-surface: N/A (`none — infrastructure`) — STATUS.md states "No user-observable change — infrastructure only".
- [ ] `docs/ai/DECISIONS.md` D-24485 Active (with the recorded signal choice); `docs/ai/STATUS.md` updated; `WORK_INDEX.md` (WP-671 `[x]`) + `EC_INDEX.md` flipped with date; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0 AND `pnpm workindex:executed:check` still 0 (this WP's own close is consistent).

## Common Failure Smells
- The check exits 1 on clean `main` → a cited (not `reserves`-owned) Active D false-positived; a `[x]` row mis-parsed as `[ ]`; a cross-WP `WP-NNN shipped …` reference matched; a template/backlog row not skipped; OR real un-reconciled drift exists (reconcile it, don't weaken the check).
- Owned-D-`Active` chosen but a drafted-open WP carries a premature Active D → the signal false-positives; switch to the git signal (the scaffold should have caught this).
- The test passes with the guard logic reverted → the positive assertion is vacuous (it must FAIL a synthetic executed-but-open row).
- The executed-text signal misses a real drift → the token set was hardcoded (`pending PR`) instead of derived from real phrasing (`pending commit/PR`).
