# WP-671 — Govern-Close Consistency Guard: fail CI on a WORK_INDEX `[ ]` row whose WP has executed (Shared Tooling / CI)

**Status:** Draft — pending execution
**Primary Layer:** Shared Tooling (governance scripts + CI)
**User-Visible Surface:** none — infrastructure

---

## Goal

Add a CI guard that fails when a `WORK_INDEX.md` WP row is still unchecked
(`- [ ]`) even though the WP has demonstrably **executed** — caught today only by
manual audit. The recurring drift: a burst of execution sessions lands the
`EC-###:` implementation commit (and often the `DECISIONS` D-entry → **Active**
and the `STATUS` close-out) but leaves the index rows stale, and
`roadmap:counts:check` cannot catch it because `WORK_INDEX` and the mindmap go
stale **together** (they agree, so the derived count is self-consistent but
overstates real open work). Observed at least three times: WP-391 (2026-07-18),
WP-657/658/660/661/662/664/665 (2026-09-07), WP-669/670 (2026-09-08).

## User-Visible Impact

`none — infrastructure`. Operator-facing only: a red CI check on any PR whose
`WORK_INDEX` leaves an executed WP's row unchecked, turning a drift that
currently surfaces days later at audit time into an immediate, local failure.
STATUS.md must record this as infrastructure with no player-observable change.

## Assumes

- **Baseline:** `origin/main` @ `12990598` (drafted 2026-09-08). Re-baseline at
  execution.
- **The govern-close drift is real and file-detectable.** In every observed case
  the WP's reserved `DECISIONS` D-entry was already **Active** while the
  `WORK_INDEX` row was `- [ ]` (WP-669/670: D-24483/D-24484 Active, rows
  `[ ]`), and/or the row text itself said "Executed …, pending PR". Both signals
  are pure file cross-references — no git history needed. ✅ verified 2026-09-08.
- **CI runs a series of governance `:check` steps** in `.github/workflows/ci.yml`
  (`ledger:numbers:check`, `workindex:rows:check` @ ~L255, etc.), each a
  `pnpm X:check` → `node scripts/<check>.mjs`. The new guard is a sibling step. ✅.
- **`scripts/check-workindex-rows.mjs`** (WP-455 / D-24275) is the row-**grammar**
  check and the pattern to mirror; this guard is **distinct** — it checks
  execution-vs-checkbox **consistency**, not row format. ✅.
- **DECISIONS status is machine-readable** in two forms: the heading suffix
  `### D-NNNNN — … (Active <date> — WP-NNN / EC-NNN)` and/or a `**Status:**
  Active` / `**Status:** Drafted …` line. The guard reads whichever is present. ✅.
- **GitHub Actions checkouts are shallow by default** (`fetch-depth: 1`), so a
  guard that shells `git log --grep` for a merged `EC-###` commit needs
  `fetch-depth: 0` — a reason to prefer the file-cross-reference signal.

## Context (Read First)

- `scripts/check-workindex-rows.mjs` + `scripts/check-number-ledger.mjs` —
  **AUTHORITATIVE for** the governance-check script idiom (parse a doc, exit 1
  with a full-sentence report on violation, exit 0 clean; no deps beyond
  `node:fs`).
- `.github/workflows/ci.yml` (the governance-`:check` block, ~L180–255) —
  **AUTHORITATIVE for** how a `:check` step is wired; add the new step beside
  `workindex:rows:check`.
- `package.json` `scripts` (the `*:check` entries ~L52–68) — **AUTHORITATIVE for**
  the script-entry convention.
- `docs/ai/work-packets/WORK_INDEX.md` — the rows to parse (`- [ ]` / `- [x]`,
  the `reserves **D-NNNNN**` / `**D-NNNNN**` reference, the `**<status>**` text).
- `docs/ai/DECISIONS.md` — the D-entry Active/Drafted markers (both forms above).
- `docs/ai/DECISIONS.md` D-24275 (the row-grammar guard rationale) + the reserved
  **D-24485** below. User memory `reference_workindex_stale_row_drift` records the
  audit heuristic this WP automates.

## Design Rationale

**The detection signal is SCAFFOLD-DECIDED among three candidates — none is
free, so the executor must empirically pick against real `main` (this is the
load-bearing decision, D-24485).** A pre-flight (2026-09-08) surfaced that each
candidate has a real failure mode:

1. **`[ ]` row + owned D-entry `Active`.** Fast, deterministic, no git. BUT it
   depends on the **`Drafted`→`Active` D-status convention** being followed:
   `DECISIONS` has both `Drafted` entries (~15 on `main`) and `Active` ones, and a
   D-entry is meant to be `Drafted` at draft and flipped `Active` at execution —
   so `[ ]` + owned-D-`Active` = executed-but-row-open (drift), while `[ ]` +
   owned-D-`Drafted` = legitimately drafted. This signal is only sound if no WP is
   ever drafted with a premature `Active` D-entry; the scaffold MUST verify that
   against real `main` (if a drafted-open WP carries an `Active` owned D, this
   signal false-positives and must be dropped or the git signal used).
2. **`[ ]` row + executed-text in the row's OWN status clause.** Catches a
   self-contradicting row without any D-entry. BUT the real phrasing varies
   (`executed`, `shipped`, `pending commit/PR` — NOT a hardcoded `pending PR`), so
   the token set is derived from real strings at execution; and the scan must be
   the row's own status/provenance clause, NOT the whole row (a row citing
   "WP-NNN shipped …" about ANOTHER WP must not trip — see the parsing guardrail).
3. **`[ ]` row + a merged `EC-###` execution commit for this WP.** The
   convention-independent ground truth. Needs `fetch-depth: 0` on the CI job
   (checkouts are shallow by default) and robust commit-message matching (`EC-### /
   WP-NNN:` and `EC-###:` forms). Slower, but immune to D-status/phrasing drift.

The executor scaffolds all three against real `main`, and the **hard acceptance
test** is: the chosen signal(s) (a) exit **0** on the current clean `main` (no
false positive), (b) catch a **synthetic** injected drift row (non-vacuous), and
(c) do NOT trip on a legitimately drafted-open WP, a reserve-only ledger line, the
template placeholder row, a backlog row, or the genuinely-blocked WP-042.1. If the
file signals cannot meet (a)+(c) on real `main`, the git signal (with
`fetch-depth: 0`) is the fallback primary.

**Parsing is cross-reference-safe and WP-row-scoped (scaffold this).** The parser
MUST: key the owned D-entry on the literal `reserves **D-NNNNN**` phrase (NOT any
bare `**D-NNNNN**` citation — WP-042.1 uses "per D-4201" and must pass); scan only
the row's own status clause for executed-text (a `WP-NNN …` cross-reference to
another WP inside the row must not trip); and **skip non-WP rows** — the template
placeholder (`- [ ] WP-NNN — Short Title — …`) and the `- [ ] **(backlog — to be
drafted)**` rows have no real `WP-NNN`/`reserves`. Confirm all exclusions in the
scaffold.

**Draft, reserve, and blocked states must pass.** A freshly-drafted WP row
(`- [ ]` + a `Drafted` owned D-entry, no executed-text), a reserve-only ledger
line, the template/backlog rows, and the genuinely-blocked WP-042.1 are all the
CORRECT open state and MUST pass. The guard fires ONLY on the executed-but-row-open
inconsistency, never on legitimately open work.

## Scope (In)

- **`scripts/check-workindex-executed-open.mjs`** (new) — parse `WORK_INDEX.md`
  `- [ ]` WP rows and flag any that have demonstrably executed, using the
  **scaffold-chosen signal(s)** from `## Design Rationale` (owned-D-`Active`,
  own-clause executed-text, and/or the git-`EC-###`-commit ground truth). Parsing
  is cross-reference-safe and WP-row-scoped (owned-D keyed on `reserves`;
  executed-text from the row's own clause; template + backlog + non-WP rows
  skipped). Exit 1 with a full-sentence report naming each offending `WP-NNN` (and
  the tripped signal); exit 0 clean. `node:fs` (+ `node:child_process` only if the
  git signal is chosen, with `fetch-depth: 0`).
- **`package.json`** — a `workindex:executed:check` script entry (+ a
  `workindex:executed:test` if a `node:test` file is added).
- **`.github/workflows/ci.yml`** — a CI step running `pnpm workindex:executed:check`,
  beside `workindex:rows:check`.
- **`scripts/check-workindex-executed-open.test.ts`** (new) — `node:test` with a
  POSITIVE fixture (a synthetic executed-but-open row per the chosen signal → the
  check FAILS) and NEGATIVE fixtures (a clean `[x]` row, a legitimately drafted
  `[ ]`+`Drafted` row, a cross-WP-reference row, the template placeholder, and a
  backlog row → the check PASSES); a cheat-proof guard (no mutation of the
  asserted-over inputs, no derived comparison that removes the elements under test).

## Out of Scope

- Any change to `WORK_INDEX.md` content, the row grammar, or `check-workindex-rows.mjs`.
- Auto-**fixing** stale rows (this guard only detects; reconciliation stays the
  operator's `INFRA:` catch-up per the `reference_workindex_stale_row_drift` memory).
- Any game engine, registry, server, or card-data change.
- `roadmap-counts.mjs` / `check-number-ledger.mjs` behavior (unchanged).

## Files Expected to Change

- `scripts/check-workindex-executed-open.mjs` — **new** — the guard.
- `scripts/check-workindex-executed-open.test.ts` — **new** — positive + negative coverage.
- `package.json` — **modified** — `workindex:executed:check` (+ `:test`) script entry.
- `.github/workflows/ci.yml` — **modified** — the CI step.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24485 Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close.

The exact script/CI filenames + the CI job the step joins are confirmed at
execution and locked into the EC allowlist; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents for every new/modified file; ESM only, Node v22+; `node:`
>   prefix on built-ins; human-style code per `00.6-code-style.md`.
> - The guard is **detect-only** — it never edits `WORK_INDEX`/`DECISIONS`.
> - No new npm dependency; `node:fs` (+ `node:test`, + `node:child_process` only
>   if the git signal is chosen). A file-only signal runs under the default shallow
>   checkout; the git signal requires `fetch-depth: 0` on its CI job.
> - Full-sentence failure messages naming each offending `WP-NNN` and the signal
>   that tripped, so the operator can reconcile without reading the script.
> - The guard MUST exit 0 on the current clean `main` — the scaffold proves it
>   against the real docs BEFORE wiring CI. If the scaffold finds a REAL executed-
>   but-open row on `main`, that is out-of-band drift: reconcile it (a manual
>   `INFRA:` row-flip) as a prerequisite that lands before/with the CI step, so the
>   guard goes green on a genuinely-clean tree — never suppress the signal to pass.
> - The test carries a NON-VACUOUS positive (a synthetic stale row FAILS) and
>   negatives (clean `[x]`, drafted-open, cross-WP-reference, template, backlog all
>   PASS), and does not mutate the asserted-over inputs.

## Contract

- **Fail condition:** a `WORK_INDEX.md` `- [ ]` WP row that the scaffold-chosen
  signal(s) mark as executed — one or more of: the WP's `reserves`-owned
  `DECISIONS` D-entry is `Active`; the row's OWN status clause matches the
  executed-text token set (derived from real phrasing at execution — e.g.
  `executed`, `shipped`, `pending commit/PR`); a merged `EC-###` execution commit
  exists for the WP. Signal choice + exact tokens locked at execution per D-24485.
- **Pass condition:** `[x]` rows (any D-state); `[ ]` rows with a `Drafted` (or
  absent) owned D-entry and no executed-text and no merged EC commit;
  reserve-only ledger lines; the template placeholder row; `(backlog …)` rows;
  WP-042.1.
- **Parsing:** owned-D keyed on `reserves **D-NNNNN**` (not a bare citation);
  executed-text scanned in the row's own status clause (cross-WP `WP-NNN …`
  references excluded); non-WP rows skipped.
- **Exit codes:** 0 = consistent; 1 = ≥1 violation, with a full-sentence per-WP report.

## Vision Alignment

- **Vision clauses touched:** §22 (governance integrity / measurement honesty).
- **Conflict assertion:** No conflict — a CI guard that keeps the WP ledger honest
  adds no player surface and no monetization/persuasion.
- **Non-Goal proximity check:** N/A — none of NG-1..7 are crossed.
- **Determinism preservation:** N/A — a governance doc-linter; no `G`, RNG, replay,
  or scoring surface. Hash oracles untouched.

## Funding Surface Gate

§20 N/A — governance tooling; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** On the current clean `main`, `pnpm workindex:executed:check` exits 0
  (no false positive). If the scaffold finds a real executed-but-open row, it is
  reconciled as a prerequisite so `main` is genuinely clean before the CI step.
- **AC-2** A synthetic executed-but-open row (per the chosen signal) → the check
  exits 1 and names that `WP-NNN` (asserted in the test; non-vacuous).
- **AC-3** The executed-text signal (if chosen) matches the row's OWN status clause
  against the real-phrasing token set — NOT a cross-WP `WP-NNN …` reference in the
  row (asserted: a row citing another WP as "shipped" does NOT trip).
- **AC-4** A `[x]` row (any D-state) and a legitimately-drafted `[ ]`+`Drafted`
  (or no-executed-text) row both PASS.
- **AC-5** Owned-D keyed on `reserves **D-NNNNN**` — a `[ ]` row that merely cites
  an unrelated `Active` D-number (e.g. WP-042.1's "per D-4201") does NOT trip.
- **AC-6** Non-WP rows are skipped — the template placeholder
  (`- [ ] WP-NNN — Short Title …`) and `- [ ] **(backlog — to be drafted)**` rows
  do not trip (asserted with fixtures). **WP-671's OWN row is an explicit negative
  fixture:** its descriptive prose legitimately contains all three executed-text
  tokens (`executed`, `shipped`, `pending-PR`) while its status marker is
  `**Draft 2026-09-08**` and its owned D-24485 is `Drafted` — so a whole-row
  scan self-trips but the own-status-clause scan (the locked behaviour) passes.
  This is the sharpest self-trip vector; the fixture pins it.
- **AC-7** The CI step runs `pnpm workindex:executed:check` and fails the build on
  a violation; a file-only signal needs no git history, and the git signal (if
  chosen) sets `fetch-depth: 0` on its job. No new npm dependency.

## Verification Steps

1. `pnpm workindex:executed:check` exits 0 on clean `main`.
2. `node --import tsx --test scripts/check-workindex-executed-open.test.ts` passes
   (positive + negative + owned-D-entry cases).
3. **Control run:** temporarily flip a shipped WP's row to `[ ]` (or point a
   fixture at an Active D-entry) and confirm the check exits 1 naming it; revert.
4. `pnpm -r build` exits 0 (no workspace breakage from the package.json entry).
5. Confirm the CI step is wired beside `workindex:rows:check` (file-only signal:
   no `fetch-depth` change; git signal: `fetch-depth: 0` on that job).
6. `git diff --name-only` equals the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-7 satisfied; all Verification Steps green incl. the Step-3 control run.
- [ ] No files outside the finalised EC allowlist modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24485 Active** (the govern-close-consistency
      invariant + the two signals + the owned-D-entry rule).
- [ ] `docs/ai/STATUS.md` — close-out stating **"No user-observable change —
      infrastructure only"**.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap `📝`→`✅` + counts
      regenerated. (And this WP's own close-out must not trip the new guard.)

## Reserved Decision (lands at execution)

**D-24485 — A WORK_INDEX `[ ]` row whose WP has executed is a govern-close
inconsistency, CI-enforced.** Records: the recurring executed-but-row-open drift
and why `roadmap:counts:check` misses it (WORK_INDEX + mindmap go stale
together); the **scaffold-chosen detection signal(s)** among the three candidates
(owned-D-`Active` — sound only if the `Drafted`→`Active` convention holds;
own-clause executed-text — token set from real phrasing; git-`EC-###`-commit —
convention-independent ground truth, `fetch-depth: 0`) with the observed rationale
for the choice; the `reserves`-keyed owned-D rule + cross-reference-safe,
non-WP-row-skipping parsing; and that the guard is detect-only (reconciliation
stays a manual `INFRA:` catch-up, sequenced as a prerequisite if the scaffold
finds real drift on `main`).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft
commit body). §1–§9 PASS; §12–§17 PASS (control run mandated; non-vacuous +
cheat-proof test; DoD carries the scope-boundary check + the self-referential
"this close-out must not trip the guard" check; `§15.1` declares
`none — infrastructure` with the inverted STATUS.md requirement; Vision block
carries the §17.2 conflict assertion). §10, §11, §18, §20, §21 resolve N/A with
named justifications. Lightweight-lane eligibility is provisional (single tooling
layer, ~4 files, additive, no contract, no determinism) — the executor confirms
at govern-close or self-demotes if the CI wiring proves cross-cutting.
