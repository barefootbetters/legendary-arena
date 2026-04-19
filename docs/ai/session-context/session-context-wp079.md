# Session Context — WP-079 (Label Engine Replay Harness as Determinism-Only)

> **Amendment 2026-04-19 (SPEC) — post-governance landing + pre-flight READY.**
> This amendment **supersedes** the specific stale statements noted below.
> All other guidance in this document remains authoritative (phrases,
> scope guardrails, target line ranges, locked contract values).
>
> 1. **Branch status** — supersedes "no branch created yet" (below).
>    Branch `wp-079-replay-harness-determinism-label` exists. Cut off
>    `main` at `3307b12`. Current HEAD `b9977f0` (STATUS session-close).
>    Step 0 sanity check: `git branch --show-current` → expect
>    `wp-079-replay-harness-determinism-label`.
>
> 2. **Governance bundle gate wording** — supersedes "STOP if 41d28d1 /
>    EC-073 drafting commit not present" guidance that pointed at the
>    wp-062-arena-hud-era HEAD. Current state: governance artifacts are
>    merged to `main` via `3307b12` (no reach-over needed).
>
> 3. **DECISIONS.md §D-0205 existence** — supersedes any implication
>    that D-0205 is missing or lives only in session-context narration.
>    D-0205 now exists as a canonical decision block in `DECISIONS.md`
>    at line 4868, Status **Active**, Resolved **2026-04-18** (landed
>    by SPEC-A′, merged to main).
>
> 4. **WORK_INDEX.md registration note** — supersedes earlier
>    "WP-079 not listed" / "now listed" confusion. WP-079 row exists
>    and the top-of-file review-status paragraph now carries an
>    additional one-sentence registration sentence (SPEC-C, merged
>    to main).
>
> 5. **Test baseline** — baseline unchanged at **464** but now
>    re-verified on the execution branch itself. Verified at `b9977f0`:
>    464 / 0 (registry 3 + vue-sfc-loader 11 + game-engine 409 +
>    server 6 + arena-client 35).
>
> 6. **Pre-flight status** — supersedes "pre-flight can begin
>    immediately" future tense. Pre-flight re-run 2026-04-19 returned
>    **READY**; all 11 Pre-Session Gates pass. Execution may begin.
>
> 7. **Working tree hygiene warning** — execution session must not
>    accidentally commit unrelated artifacts. Working tree carries
>    **7 Category D untracked** governance artifacts (forensics
>    invocations + prior session-context / invocation docs for
>    WP-048/067/068/063). These are outside EC-073 Files-to-Produce
>    allowlist and must NOT be included in any `EC-073:` commit.
>    Verification Step 9 expectation stands: `git diff --name-only`
>    shows **exactly 6 files** after execution.
>
> This is an **append-only clarification** intended to prevent Step 0
> reader confusion; it does not revise the original Step 8 authored
> content below.

> **Amendment 2026-04-18 (SPEC) — post-P6-36 reconciliation:** Two
> claims below predate P6-36 and WP-080 drafting and are now
> superseded:
>
> 1. **"No Execution Checklist (EC) needed"** — superseded. P6-36
>    (established at WP-062 closeout) forbids `WP-###:` commit
>    prefixes; the `.githooks/commit-msg` hook rejects them. The only
>    valid code-changing prefix under 01.3 is `EC-###:`. Because
>    WP-079 modifies `.ts` files (code-changing session), an EC is
>    required for a valid commit prefix. EC-073 has been drafted
>    under the `SPEC:` bundle that created this amendment. See
>    `docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md`
>    and `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`.
>
> 2. **"WP-079 is already listed in WORK_INDEX.md"** — superseded.
>    The row was never inserted before WP-080 drafting began. The
>    WP-079 row has now been added to WORK_INDEX.md at end of Phase 6
>    under the same SPEC bundle.
>
> The rest of this document remains accurate: forbidden phrases,
> required phrases, line-range targets, baseline-preservation
> guidance, and scope guardrails are all still load-bearing for
> execution. The only changes are commit-prefix (`EC-073:` not
> `WP-079:`) and EC now required.

WP-079 is a **doc-only decision-closure WP** arising from the
`docs/ai/MOVE_LOG_FORMAT.md` forensics report (2026-04-18, commit
`1d709e5`) and the Active resolution of `D-0205`. Its entire scope is
JSDoc + module-header text added to two files. Zero runtime behavior
change. Zero signature change. Zero export change. Zero test change.

Key context for executing WP-079:

- **Primary authority:** the WP file itself at
  `docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md`.
  Every Acceptance Criterion is binary. No partial credit. Read the
  packet's §Context (Read First) before writing a single line.
- **Branch:** no branch created yet. Recommend
  `wp-079-replay-harness-determinism-label` off `main` at whatever
  commit is current when execution begins.
- **No Execution Checklist (EC).** Per the 2026-04-18 planning
  discussion, WP-047 precedent applies (small doc-only WP → the WP
  itself is the checklist). If a second replay-semantics WP later
  revisits this area, an EC may become useful; for WP-079 alone it
  would be overhead without signal.
- **WORK_INDEX.md status:** WP-079 is already listed in
  `docs/ai/work-packets/WORK_INDEX.md` at the end of Phase 6 (inserted
  2026-04-18 after WP-068). The execution session only needs to flip
  `[ ]` → `[x]` and append a completion timestamp, not add a new row.
- **Lint status:** WP-079 passed the 00.3 self-lint clean on
  2026-04-18 after two surgical patches (Verification Steps switched
  to `Select-String` per §9; Acceptance Criteria consolidated from 14
  to 12 per §14). No lint notes remain.

---

## Why This WP Exists (What D-0205 Decided)

The forensics report discovered that
`packages/game-engine/src/replay/replay.execute.ts` hardcodes a
reverse-shuffle at lines 121-123 and ignores the stored
`ReplayInput.seed`. The harness proves the reducer is deterministic
given a fixed mock RNG — but it does **not** reproduce the RNG that
drives live boardgame.io matches (seeded `ctx.random.*`).

D-0205 resolved this by **scoping the harness as *determinism-only /
debug-only*** rather than by adding a new RNG pipeline. Rationale
blocks in `DECISIONS.md §D-0205`:

- Option (A) — make `boardgame.io ctx.random.*` canonical — was
  **deferred, not rejected.** Revisit when D-0203 (canonical persisted
  artifact) resolves.
- Option (B) — make an engine-owned seed canonical — was **permanently
  rejected** because it contradicts D-0002 (*Determinism Is
  Non-Negotiable*).
- Option (C) — label the existing harness as determinism-only — was
  **chosen.** WP-079 carries out the single follow-up action D-0205
  names: add JSDoc + module-header warnings so the narrowed claim is
  visible at every export surface.

If execution encounters any pressure to replace the reverse-shuffle or
change `seed` semantics, **stop immediately** — that belongs to a future
WP gated on D-0203, not to WP-079.

---

## Baseline to Preserve

- **Updated 2026-04-18 (SPEC `1264133`):** Repo test baseline has
  advanced since the original forensics commit. Current baseline is
  **464 passing** (3 registry + 409 game-engine + 11 vue-sfc-loader +
  6 server + 35 arena-client) as of commit `7eab3dc` (WP-062 close)
  and unchanged through the three SPEC commits that followed
  (`4b75dca`, `41d28d1`, `1264133` — all docs-only). The original
  forensics-run baseline of **442 passing** (arena-client at 13)
  is historical; the arena-client delta of +22 tests came from
  WP-062 HUD component tests. WP-079 must hold the count at
  whatever HEAD is at execution-session start — the Acceptance
  Criteria "Test count is identical to the starting commit" is
  still the binary gate, just measured against the current HEAD,
  not 442.
- Game-engine suite baseline: **409 passing** across 101 suites
  (unchanged since WP-067 / EC-068 at commit `1d709e5`; WP-062 did
  not modify the engine). WP-079 touches two source files; both
  have existing test coverage that does not exercise JSDoc. The
  tests re-run unchanged.
- Build baseline: `pnpm --filter @legendary-arena/game-engine build`
  exits 0 at the starting commit. JSDoc additions cannot break the
  TypeScript build unless they introduce malformed `@` tags — a risk
  the Verification Steps in EC-073 / the execution session prompt
  catch.

---

## Locked Contract Values (From WP-079 §Non-Negotiable Constraints)

These are drift-prone and must be preserved verbatim in the JSDoc
output:

### Forbidden phrases (must appear **zero** times across both files)

- `"replays live matches"`
- `"replays a specific match"`
- `"reproduces live-match outcomes"`

These phrases would re-create the false claim D-0205 exists to
prevent. `Select-String` verifications at §Step 4 of the WP's
Verification Steps catch violations.

### Required phrases (at least one per file, author's discretion)

- `"determinism-only"` (must appear **≥ 2 times** in
  `replay.execute.ts` — once in the module header, once in
  `replayGame()` JSDoc)
- `"does not replay live-match RNG"` (or equivalent disclaimer
  referencing `ReplayInput.seed` being ignored)
- Cross-reference to `D-0205` in both files
- Cross-reference to `MOVE_LOG_FORMAT.md` Gap #4 in
  `replay.execute.ts` (at minimum)

---

## Scope Guardrails (What WP-079 is NOT)

From `## Out of Scope` in the WP:

- **Not** a runtime change. The reverse-shuffle at
  `replay.execute.ts:121-123` is not touched.
- **Not** a type change. `replay.types.ts` is untouched.
- **Not** an API change. `replayGame` and `verifyDeterminism`
  signatures and exports are unchanged; `packages/game-engine/src/index.ts`
  is unmodified.
- **Not** a test change. `replay.verify.test.ts` is untouched. Test
  count must be identical before and after.
- **Not** a `MOVE_LOG_FORMAT.md` change. Gap #4 remains worded as the
  condition D-0205 resolves — editing the forensics report to say
  "resolved" would muddle the audit trail. `DECISIONS.md §D-0205` is
  the resolution record, not the forensics report.

If during execution any of these boundaries feels tempting, **stop
and flag it** — a runtime or contract change requires a new WP and
almost certainly a new DECISIONS.md entry.

---

## Relevant DECISIONS.md Entries

- **D-0002** — Determinism Is Non-Negotiable (meta-principle; rationale
  for rejecting option B)
- **D-0201** — Replay as a First-Class Feature (introduced the
  harness in WP-027; D-0205 narrows what "replay" means in the
  current harness)
- **D-0202** — Deterministic State Hashing (`computeStateHash`;
  untouched by WP-079)
- **D-0203** — Canonical Persisted Artifact for Move Log / Replay
  (**Open**; gates the future "replay live matches" feature that
  option A of D-0205 was deferred toward)
- **D-0204** — Privacy Boundary for Persisted Logs (**Open**)
- **D-0205** — RNG Truth Source for Replay (**Active** 2026-04-18;
  the decision WP-079 carries out)

All five D-02xx entries live in the
"Decision Points Raised by `MOVE_LOG_FORMAT.md`" section of
`DECISIONS.md`, except D-0201 and D-0202 which sit in the original
Determinism & Replay cluster.

---

## Files WP-079 Will Need to Read Before Coding

- `docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md`
  — the packet itself. Read in full, including Locked contract values.
- `docs/ai/DECISIONS.md §D-0205 — RNG Truth Source for Replay` —
  read `Decision:`, `Decision rationale:`, `Options rejected:`, and
  `Follow-up actions required by this decision:` blocks in full.
  JSDoc wording must be consistent with this rationale.
- `docs/ai/MOVE_LOG_FORMAT.md §Known Gaps / Risks Gap #4` — the
  evidence trail that surfaced the issue. The JSDoc warnings must
  reference this file and the specific line range
  `replay.execute.ts:119-123`.
- `packages/game-engine/src/replay/replay.execute.ts` — read entirely
  before modifying. Existing `replayGame()` JSDoc at lines 127-141
  will be replaced wholesale, not appended to. The module-level JSDoc
  at lines 1-9 gets a new paragraph appended.
- `packages/game-engine/src/replay/replay.verify.ts` — read entirely
  before modifying. Existing `verifyDeterminism()` JSDoc at lines
  16-38 will be replaced wholesale. Module-level JSDoc at lines 1-10
  gets a new sentence appended.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirm
  the engine layer owns the replay/determinism harness and that
  WP-079 introduces no cross-layer imports.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 11 (full-sentence
  error messages → JSDoc warnings must be full sentences), Rule 6
  (`// why:` comments preserved on the existing reverse-shuffle
  callout), Rule 13 (ESM only).
- `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` —
  WP-079 does **not** execute under EC mode, but the commit-message
  format (`WP-079:` prefix; full-sentence body; no partial-output
  apologies) still applies.

---

## Sibling Artifacts Already in Place

- `docs/ai/MOVE_LOG_FORMAT.md` — forensics report (created 2026-04-18,
  commit `1d709e5`). The source of Gap #4.
- `docs/00-INDEX.md` — row added linking to MOVE_LOG_FORMAT.md as a
  discovery artifact (2026-04-18).
- `docs/ai/DECISIONS.md` — D-0203, D-0204, D-0205 all added
  2026-04-18. D-0205 is Active; the other two are Open.
- `docs/ai/DECISIONS_INDEX.md` — three new rows in the Determinism &
  Replay cluster.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-079 row in Phase 6 (added
  in SPEC `1264133` as part of the EC-073 drafting bundle, clustered
  with WP-080 and WP-063).

### Added in SPEC `1264133` (2026-04-18) — EC-073 drafting bundle
- `docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md`
  — Draft status; **primary execution authority** for the WP-079
  session. Follows EC-TEMPLATE verbatim. Locked Values encode
  forbidden/required phrases + existing `// why:` comments to
  preserve. Common Failure Smells include the `WP-079:` commit-
  prefix hook rejection.
- `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
  — execution session prompt. Pre-Session Gates, Authority Chain
  (11 entries), Goal, Files Expected to Change allowlist (P6-27
  enforced), Non-Negotiable Constraints, Verification Steps 1–10
  in `pwsh`, Definition of Done.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-073 row in
  Shared Tooling section.

### Downstream coordination (added in SPEC `41d28d1`, confirmed in `1264133`)
- `docs/ai/work-packets/WP-080-replay-harness-step-level-api.md`
  lists WP-079 as a **hard upstream dependency**. Both packets
  touch `packages/game-engine/src/replay/replay.execute.ts`.
  WP-079 lands first (minimal merge surface, doc-only); WP-080
  (step-level API + `replayGame` loop refactor) inherits
  WP-079's JSDoc narrowing verbatim without re-wording. Do NOT
  attempt to parallelize. The WP-080 body's "EC status UNKNOWN"
  note was replaced in `1264133` with a concrete EC-073 Draft
  reference.
- `docs/ai/DECISIONS.md §D-6304` (added in `41d28d1`) cites D-0205
  and depends on WP-079 to land before WP-080 executes. D-6304
  locks the single-source-of-truth-for-dispatch decision that
  `applyReplayStep` (WP-080) introduces.

No further planning artifacts need to be created before WP-079 can
execute. Pre-flight can begin immediately by loading
`docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`.

---

## Steps Completed for the Forensics → WP-079 Chain

0. Forensics invocation run → `MOVE_LOG_FORMAT.md` produced
   (2026-04-18; `docs/ai/invocations/forensics-move-log-format.md`)
1. `docs/00-INDEX.md` pointer added
2. Three decision points raised in `DECISIONS.md` (D-0203 / D-0204 /
   D-0205) and indexed in `DECISIONS_INDEX.md`
3. D-0205 resolved to option (C); option (A) deferred, option (B)
   permanently rejected
4. Preamble of "Decision Points Raised by MOVE_LOG_FORMAT.md"
   rewritten to support mixed Open/Active states
5. WP drafted (initially numbered WP-069; renumbered to WP-079 after
   discovering the WP-068..WP-078 Preferences-series reservation)
6. WP 00.3 self-lint run → 🔧 Pass with notes → two patches applied
   → ✅ clean Pass
7. WP-079 row planned for WORK_INDEX.md (original note at top of
   this file claimed the row was inserted, but grep confirmed it
   was never landed — the row was actually added later in step 9b)
8. This file drafted
9. **SPEC `1264133` (2026-04-18) — EC-073 drafting bundle landed.**
   Four new artifacts committed (WP-079 body tracked; EC-073
   checklist; session-wp079 execution prompt; this session-context
   tracked + amended). Three index updates (WORK_INDEX.md WP-079
   row added to Phase 6; EC_INDEX.md EC-073 row added; STATUS.md
   "WP-079 EC-073 Drafted" section added at top of Current State).
   WP-080 body's "EC status UNKNOWN" note replaced with a concrete
   EC-073 Draft reference. Two predated claims in this file
   superseded by the amendment block at the top: "no EC needed"
   (P6-36 forbids `WP-###:` prefixes on code-changing commits;
   EC-073 is now the required authority) and "already in
   WORK_INDEX.md" (false — row added in this SPEC commit). 00.3
   lint gate PASS on the WP-079 body documented in the commit
   body. No source code changes. Both stashes retained. EC-069
   `<pending>` placeholder retained.

---

## Next Steps

WP-079 execution is **Step 2 of the four-step replay-harness chain**
that unblocks WP-063. Full chain:

- ✅ **Step 1 (COMPLETE — SPEC `1264133`):** EC-073 drafted +
  governance artifacts in place.
- ⏳ **Step 2 (READY NOW):** WP-079 execution under `EC-073:`
  commit prefix. Authoritative session prompt at
  `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`.
  No blockers.
- ⏸ **Step 3 (BLOCKED on Step 2):** WP-080 execution under
  `EC-072:` prefix. Both packets touch `replay.execute.ts`; do NOT
  parallelize.
- ⏸ **Step 4 (BLOCKED on Step 3):** WP-063 resume under existing
  `EC-071:` prefix. Pre-Session Gate #4 (amended in SPEC `41d28d1`)
  satisfies once `applyReplayStep` from WP-080 is visible at
  `packages/game-engine/src/index.ts`.

### To execute WP-079 (Step 2)

Load the session prompt as the primary authority — it supersedes
this session-context for execution-time decisions. In particular,
the session prompt + EC-073 override this file's original claim of
"no EC needed" (which is why they exist at all under P6-36).

Pre-flight (abbreviated because EC-073 owns the gates):

- `git log --oneline -5` — confirm `1264133` (this SPEC bundle) or
  later is HEAD. If not, STOP — governance is unlanded.
- `pnpm -r test` — record actual starting-commit count (expected
  464 unless intervening commits landed). This count, not 442, is
  the binary equality target for "test count identical" AC.
- Confirm D-0205 Status `Active`; confirm `MOVE_LOG_FORMAT.md` Gap
  #4 exists unedited.
- Confirm target JSDoc blocks still at their line ranges:
  - `replay.execute.ts` — `replayGame()` JSDoc at ~127–137;
    signature at line 138
  - `replay.verify.ts` — `verifyDeterminism()` JSDoc at ~25–38;
    signature at line 39
  (The original session-context claimed 127–141 and 16–38; verify
  the actual ranges at session start. WP-080 drafting confirmed
  `replay.execute.ts` line 138 has the `replayGame` signature —
  the 127–141 claim rounded to include the signature line.)
- Confirm `stash@{0}` + `stash@{1}` present and untouched; do NOT
  pop; do NOT backfill the EC-069 `<pending>` placeholder in
  `EC_INDEX.md`.

If all confirm, proceed to execution per the session prompt's Goal
and Files Expected to Change allowlist. Expected diff: ~30–50 lines
of new JSDoc/header text across the two source files + five
governance updates (STATUS + WORK_INDEX + DECISIONS §D-0205
Follow-up + EC_INDEX EC-073 flip + this session-context if
post-exec notes are added). Commit under `EC-073:` (NEVER
`WP-079:`).

### Post-execution handoff

After WP-079 execution lands under `EC-073:`, Step 3 (WP-080
execution) becomes ready. The WP-080 execution session should read
the landed `replay.execute.ts` header + `replayGame()` JSDoc
verbatim as the narrowing to preserve — do NOT re-word WP-079's
text, and do NOT introduce new forbidden phrases while adding
`applyReplayStep` alongside.
