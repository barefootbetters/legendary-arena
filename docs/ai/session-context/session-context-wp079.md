# Session Context — WP-079 (Label Engine Replay Harness as Determinism-Only)

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

- Repo test baseline: **442 passing** (3 registry + 409 game-engine +
  11 vue-sfc-loader + 6 server + 13 arena-client) as of the forensics
  run (commit `1d709e5`). WP-079 must **not** regress any of these
  counts or add any new tests (the latter is forbidden by the WP's
  Acceptance Criteria, "Test count is identical to the starting
  commit").
- Game-engine suite baseline: **409 passing** across the existing
  suites. WP-079 touches two source files; both have existing test
  coverage that does not exercise JSDoc. The tests will re-run
  unchanged.
- Build baseline: `pnpm --filter @legendary-arena/game-engine build`
  exits 0 at the starting commit. JSDoc additions cannot break the
  TypeScript build unless they introduce malformed `@` tags — a risk
  the `Verification Steps` §Step 6 catches.

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
- `docs/ai/work-packets/WORK_INDEX.md` — WP-079 row at end of Phase 6.

No further planning artifacts need to be created before WP-079 can
execute. Pre-flight can begin immediately.

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
7. WP-079 row inserted at end of Phase 6 in WORK_INDEX.md;
   narrative-log paragraph updated
8. This file

---

## Next Steps

Run pre-flight for WP-079 when ready. Because WP-079 is doc-only and
its `Files Expected to Change` allowlist is tight (2 source files +
3 governance files), pre-flight will be a short confirmation rather
than a branching decision:

- Confirm the starting commit's test count is 442 (or record the
  actual baseline) and that `pnpm --filter @legendary-arena/game-engine build`
  and `pnpm --filter @legendary-arena/game-engine test` exit 0.
- Confirm D-0205 is still `Status: Active` in `DECISIONS.md`.
- Confirm `MOVE_LOG_FORMAT.md` Gap #4 still exists unedited.
- Confirm the two target JSDoc blocks (`replayGame` at
  `replay.execute.ts:127-141`, `verifyDeterminism` at
  `replay.verify.ts:16-38`) still sit at roughly those line ranges
  and contain the text the WP assumes.

If all four confirm, proceed to execution. The WP is expected to
produce ~30-50 lines of new JSDoc/header text total across both
files. Post-execution, update `DECISIONS.md §D-0205 Follow-up actions
required` to mark the JSDoc action completed with the commit hash.
