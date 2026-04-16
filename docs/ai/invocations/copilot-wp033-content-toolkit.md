# Copilot Check — WP-033 (Content Authoring Toolkit)

**Date:** 2026-04-16
**Pre-flight verdict under review:** READY TO EXECUTE (2026-04-16)
**WP Class:** Contract-Only (copilot check is recommended, not mandatory,
for this class — running as a defensive pass at user request)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-033-content-toolkit.checklist.md`
- WP: `docs/ai/work-packets/WP-033-content-authoring-toolkit.md`
- Pre-flight: `docs/ai/invocations/preflight-wp033-content-toolkit.md`
- Session prompt: `docs/ai/invocations/session-wp033-content-toolkit.md`

---

## Overall Judgment

**HOLD**

The pre-flight's READY TO EXECUTE verdict holds for the architectural,
determinism, persistence, scope, and governance categories — 27 of 30
issues are clean PASS. Three RISK findings surface in the type-safety
category (#10 Stringly-Typed Outcomes, #21 Type Widening, #19
JSON-Serializability) around the stringly-typed `contentType: string`
parameter and the use of `ReadonlySet` in `ContentValidationContext`.
None would cause architectural or determinism damage — all three
resolve via scope-neutral wording additions to the session prompt
(locked accept-list for `contentType`, explicit `// why:` note on
`ReadonlySet` boundary semantics). HOLD is appropriate: apply FIXes
in-place, no pre-flight re-run required.

---

## Findings

### 1. Separation of Concerns & Boundaries

1. **Engine vs UI / App Boundary Drift (#1) — PASS.** Session prompt
   hard-stops `boardgame.io`, `@legendary-arena/registry`, `apps/server/`
   imports in `src/content/` and tests. Grep verification steps (3, 4)
   enforce. Hard Stops section lists every layer-crossing import
   explicitly.

2. **UI Re-implements or Re-interprets Engine Logic (#9) — PASS.** WP-033
   does not touch UI or projections. Content validation is a pre-engine
   gate; UI is out of scope.

3. **Lifecycle Wiring Creep (#16) — PASS.** Session prompt §AI Agent
   Warning and §Hard Stops explicitly prohibit wiring into `game.ts`,
   moves, phase hooks, setup builders, or rule hooks. §Runtime Wiring
   Allowance declared NOT INVOKED with all four criteria enumerated.

4. **Assumptions Leaking Across Layers (#29) — PASS.** RS-1 locks
   author-facing schemas as independent from registry Zod schemas;
   content layer is agnostic of `G` and `boardgame.io`.

### 2. Determinism & Reproducibility

5. **Non-Determinism Introduced by Convenience (#2) — PASS.** Hard Stops
   ban `Math.random()`, `Date.now()`, `performance.now()`, and any
   environment access. Validation is a pure `(content, contentType,
   context?) -> result` function.

6. **No Single Debugging Truth Artifact (#8) — PASS.** Not applicable —
   validation has no runtime state to debug. `ContentValidationError`
   is fully self-describing (contentType + contentId + field + message).

7. **Lack of Deterministic Ordering Guarantees (#23) — PASS.** Session
   prompt locks `for...of` iteration and declarative schema-array
   iteration. Errors are accumulated into a local array in iteration
   order. No `Object.keys` iteration over content data.

### 3. Immutability & Mutation Discipline

8. **Pure Functions vs Immer Mutation (#3) — PASS.** Hard Stops forbid
   mutating any input parameter. Validators are declared pure. No `G`
   mutation possible (no `G` reference in scope).

9. **Hidden Mutation via Aliasing (#17) — PASS.** Schemas are
   module-level constants (no `G` alias possible). `ContentValidationContext`
   uses `ReadonlySet<string>`. Errors arrays are freshly allocated.
   Post-mortem §Aliasing audit re-verifies per WP-028 precedent.

### 4. Type Safety & Contract Integrity

10. **Contract Drift Between Types, Tests, and Runtime (#4) — PASS.**
    EC-033 Locked Values copies every contract shape verbatim.
    Canonical arrays (HERO_KEYWORDS, BOARD_KEYWORDS, HERO_ABILITY_TIMINGS,
    SCHEME_SETUP_TYPES) are referenced, not re-declared. Session prompt
    §Pre-Flight Locked Decisions #9 documents the deliberate defer of a
    HERO_CLASSES drift-detection test (RS-9).

11. **Optional Field Ambiguity — `exactOptionalPropertyTypes` (#5) —
    PASS.** `ContentValidationContext` uses `readonly ... ?:`
    consistently. `ContentValidationResult` uses a discriminated union
    rather than a flat optional-field shape. Test 7 exercises both
    context-present and context-omitted branches.

12. **Undefined Merge Semantics (#6) — PASS.** Session prompt §Pre-Flight
    Locked Decisions #3 locks the forwarding semantic: "The same
    `context` is forwarded to each per-item call" in
    `validateContentBatch`. No merge/override behavior.

13. **Stringly-Typed Outcomes and Results (#10) — RISK.** The
    `contentType: string` parameter is a free-form string with no
    enumerated accept list. Nothing in the locked contract defines
    behavior when `contentType` is an unrecognized value (e.g.,
    `"Hero"`, `"heroes"`, `"HERO"`, `""`). The session prompt forbids
    adding a canonical `CONTENT_TYPES` array + drift test ("out of
    scope for this WP"), but does not specify whether an unknown
    contentType should:
    (a) produce `{ valid: false, errors: [{ contentType, field:
        "contentType", message: "..." }] }`, or
    (b) silently pass, or
    (c) throw.

    Without a lock, the executor may pick (b) silently, which would
    be a loud correctness gap: a typo in `contentType` yields "valid"
    content.

    **FIX (scope-neutral — wording addition to session prompt):** Add a
    new locked decision #10 to §Pre-Flight Locked Decisions:

    > **Unknown `contentType` must produce a structured error, not
    > silently pass.** Accepted values are the six strings declared in
    > EC-033 §Locked Values "Content types requiring schemas": `"hero"`,
    > `"villain"`, `"henchman"`, `"mastermind"`, `"scheme"`, `"scenario"`.
    > If `contentType` is not one of these exact lowercase strings,
    > return `{ valid: false, errors: [{ contentType: contentType,
    > contentId: "", field: "contentType", message: "The contentType
    > <value> is not a recognized content type." }] }`. Add a 10th
    > unit test: "Unknown contentType produces a structured error".
    > Update §Success Condition test count to 377 / 96 / 0 and §Test
    > Expectations in pre-flight accordingly.

    **Alternative scope-neutral FIX (no extra test, tighter invariant):**
    Lock the accept list as above but do NOT add a 10th test —
    instead, require test 9 ("All error messages are full sentences")
    to cover the unknown-contentType error in addition to its current
    assertions. This keeps the 376/96/0 locked count intact.

14. **Type Widening at Boundaries (#21) — RISK (same root as #10).**
    `content: unknown` is correct (caller-supplied, must validate).
    `contentType: string` is widening. Same resolution as #10.

    **FIX:** Same as #10.

15. **Weak Canonical Naming Discipline (#27) — PASS.** Author-facing
    field names match registry conventions (name, slug, team, hc,
    cost, attack, recruit, abilities for hero cards;
    `validVillainGroupSlugs` etc. for context). EC-033 locks all
    shapes verbatim. No abbreviations in new names.

### 5. Persistence & Serialization

16. **Persisting Runtime State by Accident (#7) — PASS.** No
    persistence in scope. Session prompt forbids adding content
    validation types to `LegendaryGameState`.

17. **Weak JSON-Serializability Guarantees (#19) — RISK.**
    `ContentValidationContext` uses `ReadonlySet<string>`. `Set` is
    explicitly forbidden in `G` per D-1232 (WP-009A/009B precedent)
    and `.claude/rules/architecture.md`. `ContentValidationContext` is
    a caller-supplied runtime parameter and not stored in `G`, so the
    invariant isn't violated today. However, a future reader might
    (a) attempt to store a `ContentValidationContext` in `G`,
    (b) attempt to transport it over the wire without converting
    `Set` to `string[]`, or
    (c) construct it by reading a persisted snapshot that contains
    `Set` — none of which are explicitly prohibited in the session
    prompt or EC.

    **FIX (scope-neutral — wording addition):** Add a `// why:`
    requirement #7 to session prompt §Required `// why:` Comments:

    > **`content.validate.ts` — `ContentValidationContext`:** uses
    > `ReadonlySet<string>` for O(1) membership check. This type is
    > for **runtime call-site use only**. It MUST NOT be stored in
    > `G`, persisted, serialized over the wire, or embedded in a
    > snapshot. If any future caller needs to transport this data
    > across a serialization boundary, convert to `readonly string[]`
    > at the boundary per D-1232 (no `Set` in `G`, no `Set` in
    > snapshots).

    Also add a Hard Stop line:

    > Any assignment of `ContentValidationContext` or any field of it
    > into `LegendaryGameState`, any snapshot type, or any JSON
    > serialization path.

18. **Mixed Persistence Concerns (#24) — PASS.** No persistence
    involved. Validation is stateless.

### 6. Testing & Invariant Enforcement

19. **Tests Validate Behavior, Not Invariants (#11) — PASS.** Test 7
    asserts the silent-skip invariant (context-absent path).
    Test 9 asserts the full-sentence-message invariant. Tests 1–6, 8
    validate named behaviors per EC-033 §E. Post-mortem §Purity audit
    re-verifies non-mutation. Baseline test count locked in pre-flight.

### 7. Scope & Execution Governance

20. **Scope Creep During "Small" Packets (#12) — PASS.** Allowed /
    forbidden file lists are explicit. `git diff --name-only`
    verification step (#9). "Anything not explicitly allowed is out of
    scope" rule cited in both pre-flight §Scope Lock and session
    prompt §Scope Lock.

21. **Unclassified Directories and Ownership Ambiguity (#13) — PASS.**
    D-3301 created during pre-flight PS-1 resolution.
    `02-CODE-CATEGORIES.md` §engine updated to list `src/content/`.

22. **Missing Pre-Session Governance Fixes (#30) — PASS.** All six
    pre-session items (PS-1, PS-2, RS-6, RS-7) logged as RESOLVED in
    pre-flight §Authorized Next Step. RS-1..RS-5 and RS-8..RS-9
    locked as session-prompt-only content.

### 8. Extensibility & Future-Proofing

23. **No Extension Seams for Future Growth (#14) — PASS.** The
    `contentType` parameter plus per-type dispatch in the validator
    provides the extension seam — future WPs add new content types by
    adding a case without refactoring existing ones. Pre-flight
    §Maintainability documented this. (Note: this is the flip-side of
    #10 — the extensibility benefit requires the accept-list
    discipline from #10's FIX to be effective.)

24. **No Upgrade or Deprecation Story (#28) — PASS.** Explicit defers
    documented:
    - Team enum (RS-8) — deferred with rationale
    - HERO_CLASSES drift test (RS-9) — deferred with rationale
    - Henchman dedicated schema (D-3302) — "until superseded by a
      dedicated henchman authoring WP"
    - Canonical `CONTENT_TYPES` array — explicitly out of scope

### 9. Documentation & Intent Clarity

25. **Missing "Why" for Invariants and Boundaries (#15) — PASS.**
    Session prompt §Required `// why:` Comments lists 6 required
    comments plus sub-items per validation stage. Each RS lock ties
    to a `// why:` comment in code.

26. **Ambiguous Authority Chain (#20) — PASS.** Session prompt
    §Mandatory Read Order lists 17 documents in order with rationale.
    Pre-flight §Authority Chain lists 6. Both cite
    `.claude/CLAUDE.md` hierarchy.

27. **Implicit Content Semantics (#26) — PASS.** The critical
    semantic — "absent context ⇒ skip cross-reference check, not
    fail" — is explicitly locked in WP-033 §B, EC-033 §Locked Values,
    session prompt §Pre-Flight Locked Decisions #3, and test 7 which
    asserts both halves.

### 10. Error Handling & Failure Semantics

28. **Outcome Evaluation Timing Ambiguity (#18) — PASS.** Pure
    validation, no lifecycle ambiguity. Validators run pre-engine,
    outside any boardgame.io lifecycle.

29. **Silent Failure vs Loud Failure Decisions Made Late (#22) —
    PASS.** Explicit policy:
    - Validators never throw (Hard Stop); always return structured
      result.
    - Error messages are full sentences (Rule 11).
    - Batch validation: "Single invalid item does not short-circuit
      the batch."
    - Context absent ⇒ silent skip (locked).

    Note: #13 above (RISK) exposes a failure-mode gap for unknown
    `contentType` — fix resolves this comprehensively.

### 11. Single Responsibility & Logic Clarity

30. **Overloaded Function Responsibilities (#25) — PASS.**
    `validateContent` has 4 named stages (structural, enum,
    cross-reference, hook consistency). Each uses `for...of`.
    Validators execute checks; schemas are declarative data.
    `validateContentBatch` is a thin fan-out wrapper — no extra
    logic beyond per-item dispatch and error concatenation.

---

## Mandatory Governance Follow-ups

None. The two RISK findings (#13 / #14 share a FIX; #17 has its own
FIX) resolve via scope-neutral wording additions to the session prompt.
No DECISIONS.md entry, no `02-CODE-CATEGORIES.md` update, no
`.claude/rules/*.md` change, no WORK_INDEX change required.

---

## Pre-Flight Verdict Disposition

- [ ] CONFIRM — Pre-flight READY TO EXECUTE verdict stands. Session
      prompt generation authorized.
- [x] **HOLD** — Apply listed FIXes in-place to the session prompt,
      re-run copilot check. No pre-flight re-run required (scope
      unchanged). Specifically:
      1. Add §Pre-Flight Locked Decisions item #10 locking the
         `contentType` accept list and the unknown-contentType error
         contract (resolves Findings 13 and 14).
      2. Add §Required `// why:` Comments item #7 on
         `ContentValidationContext` runtime-only scope, and add a new
         Hard Stop line forbidding assignment of the context (or any
         field) into `G`, snapshots, or JSON serialization paths
         (resolves Finding 17).
      3. Decide between the two FIX variants in Finding 13:
         (a) add a 10th test (baseline 377/96/0), or
         (b) fold the unknown-contentType assertion into test 9
         (baseline unchanged at 376/96/0).
         Recommended: **(b)** — keeps the locked test count unchanged
         and avoids a post-pre-flight test-count drift.
- [ ] SUSPEND — not needed. No fix changes scope, allowlist, or
      mutation boundary.

---

## Next Step

Apply the three FIXes above to the session prompt in place, then
re-run the copilot check. Expected re-run outcome: all 30 issues
PASS → **CONFIRM**.

If the user prefers FIX variant (a) (add a 10th test), update the
pre-flight's §Test Expectations and the session prompt's §Success
Condition to 377/96/0 before re-running the copilot check. This is a
wording change only — still scope-neutral, still no pre-flight re-run
required, because the change is in test quantity only, not in the
file allowlist or mutation boundary.

---

## Re-Run — 2026-04-16

**Variant selected:** (b) — unknown-contentType assertion folded into
test 9; baseline remains **376 / 96 / 0**.

**FIXes applied to session prompt:**

1. **Finding 13 / 14 (#10 / #21):** Added §Pre-Flight Locked Decisions
   item #10 to
   `docs/ai/invocations/session-wp033-content-toolkit.md`. Locks the
   six-value `ACCEPTED_CONTENT_TYPES` constant, the `ContentType`
   union type, the exact unknown-contentType error shape (including
   message template), the batch-continuation semantic, the `// why:`
   rationale comment requirement, and the integration into test 9
   (Parts B and C). Updated §Implementation Task §A declarations to
   list `ACCEPTED_CONTENT_TYPES`. Updated §B imports to include it.
   Updated §B `validateContent` function description to include stage
   0 (accept-list check).

2. **Finding 17 (#19):** Added §Required `// why:` Comments item #7 to
   the session prompt. `ContentValidationContext` is declared
   runtime-call-site-only with explicit prohibition against storage
   in `G`, snapshots, databases, or JSON-serialized payloads. Cites
   D-1232 (no `Set` in `G`).

3. **Hard Stops (supporting Findings 13/14/17):** Added three new
   Hard Stop lines:
   - Clarified that `ACCEPTED_CONTENT_TYPES` is an internal validator
     constant, NOT a drift-checked canonical array.
   - Forbids any assignment of `ContentValidationContext` (or any
     `ReadonlySet<string>` field) into `LegendaryGameState`, any
     snapshot, any persisted record, or any JSON-serialized payload.
   - Forbids silent pass on unrecognized `contentType` values.

**Test 9 extension:** Test 9's description and body sketch now
document three assertion parts (A: pattern check, B: unknown-type
error shape, C: accept-list strictness on casing / empty / plural
inputs). All within the existing single test slot — count unchanged.

**Finding verdicts after FIX:**

| # | Issue | Before | After | Rationale |
|---|---|---|---|---|
| 13 | #10 Stringly-Typed Outcomes | RISK | **PASS** | Accept list locked; unknown-contentType error shape defined and test-asserted. Silent-pass explicitly forbidden in Hard Stops. |
| 14 | #21 Type Widening at Boundaries | RISK | **PASS** | `ContentType` union provides runtime narrowing via `ACCEPTED_CONTENT_TYPES.includes(contentType)` check at validator entry. Caller-facing signature retains `contentType: string` (correct — caller may supply any string; validator rejects non-members). |
| 17 | #19 Weak JSON-Serializability | RISK | **PASS** | `// why:` #7 locks `ContentValidationContext` as runtime-only; Hard Stop forbids all persistence / serialization / snapshot assignment paths. D-1232 cited. |

All three RISK findings resolved. No new findings surfaced by the
re-scan: the FIXes are purely additive wording + type constants,
with no new types appearing in `G`, no new mutation surface, no
scope expansion, and no change to the allowlist or test baseline.

**Pre-Flight Verdict Disposition (final):**

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands.
      Session prompt generation authorized. All 30 issues PASS.
- [ ] HOLD — N/A (all FIXes applied, re-run clean).
- [ ] SUSPEND — N/A.

**Session prompt status:** Ready to execute.
`docs/ai/invocations/session-wp033-content-toolkit.md` is locked and
may be pasted into a fresh Claude Code session for step 3 execution.
