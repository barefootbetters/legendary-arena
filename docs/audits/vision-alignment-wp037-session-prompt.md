# Vision Alignment Audit — WP-037 Session Prompt

**Audited artifact:** `docs/ai/invocations/session-wp037-public-beta-strategy.md`
**Gate under test:** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`
**Supporting gates:** `01.4-pre-flight-invocation.md` Authority Chain + Vision
Sanity Check; `01.3-commit-hygiene-under-ec-mode.md` Vision Trailer convention.
**Authoritative source for intent:** `docs/01-VISION.md`
**Audit date:** 2026-04-22
**Auditor:** vision-alignment audit session (read-only against WP/EC/session-prompt)
**Related commit:** governance gate landed at `0689406` (SPEC: vision audit
governance gates 00.3 / 01.3 / 01.4).

---

## 1. §17 Trigger Analysis

Per `00.3 §17.1`, the WP triggers the `## Vision Alignment` gate when it
touches any of the listed surfaces. For each trigger, the quoted lines
below are from the session prompt under review.

| # | §17.1 Trigger Surface | Triggered? | Evidence |
|---|---|---|---|
| 1 | Scoring, PAR, simulation, leaderboards | **YES (indirect)** | L152, L311: "Balance perception: human win rates within acceptable range of AI simulation predictions"; L137: "D-0702 (Balance Changes Require Simulation — beta feedback informs balance; simulation validates)". Beta exit criteria consume simulation output. |
| 2 | Replays, replay verification, replay storage | **YES** | L152: "all replay verifications pass"; L186 `reproductionReplayId?: string`; L76: "Replay remains the canonical debugging artifact. `BetaFeedback.reproductionReplayId` ... references replay IDs (from WP-027 harness)". |
| 3 | Player identity, accounts, ownership, visibility | **YES** | L203-L209: three cohorts (expert-tabletop / general-strategy / passive-observer); L275: "Invitation-only access — no anonymous sessions". Cohorts are an identity-adjacent partition of the player base. |
| 4 | Multiplayer sync / reconnection / late-joining | **PARTIAL** | L151: "full core loop, limited content set, replays + spectator enabled"; L159: "Beta runs the same deterministic engine as production." No explicit statement that multiplayer correctness is tested in beta. Beta objective list (L158) omits "multiplayer correctness". |
| 5 | Determinism guarantees / RNG sourcing | **YES** | L159: "Beta runs the same deterministic engine as production. No 'beta mode' anywhere"; L271: "No 'beta mode' in the engine — beta games run the same deterministic engine as production"; L259-L261 forbid `Math.random`, `Date.now`, `performance.now`, `new Date()` in `src/beta/`. |
| 6 | Card data / images / content semantics | NO | WP is type-only + strategy docs. No card-semantic surface. |
| 7 | Monetization, supporter tiers, cosmetics, paid surfaces | NO | L190 WP body Out of Scope: "No monetization testing"; L532 session prompt Out of Scope repeats it. |
| 8 | Live ops, beta gates, launch gates, change budgets | **YES (primary)** | WP-037 **is** a beta-gate WP by title. L147: "After this session, Legendary Arena has a complete, auditable controlled-public-beta strategy"; exit-criteria doc is the literal gate. |
| 9 | Accessibility / internationalization surfaces | NO (weak) | L158 lists "surface UX friction" as an objective. Neither WP-037 nor the session prompt names a11y-specific signal. Does not clearly trigger. |
| 10 | Registry Viewer public surfaces | NO | WP does not touch `apps/registry-viewer/`. |

**Summary.** Triggers **1, 2, 3, 5, 8** fire unambiguously. Trigger **4**
is ambiguous — the prompt preserves multiplayer determinism at the engine
level but never explicitly scopes multiplayer correctness into beta
validation. This is a §17 gap (see §3 and §5 below). Triggers 6, 7, 9, 10
do not fire.

---

## 2. Authority Chain Audit

The session prompt's Authority Chain is at L126–L144, numbered 1–14.

**Canonical chain after §17 landed** (per `01.4` L202–L245, commit
`0689406`):

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/01-VISION.md`
4. `docs/03.1-DATA-SOURCES.md`
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`
6. `docs/ai/execution-checklists/EC-XXX-*.checklist.md`
7. `docs/ai/work-packets/WP-XXX-*.md`
8. Explicitly referenced dependencies

**Session prompt chain (L128–L141):**

1. `.claude/CLAUDE.md`
2. `.claude/rules/architecture.md`
3. `.claude/rules/code-style.md`
4. `docs/ai/ARCHITECTURE.md §Section 3`
5. `docs/ai/ARCHITECTURE.md §Layer Boundary`
6. `docs/ai/ARCHITECTURE.md §MVP Gameplay Invariants`
7. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §engine`
8. `EC-037-beta-strategy.checklist.md`
9. `WP-037-public-beta-strategy.md`
10. `DECISIONS.md` (D-0702 / D-0902 / D-1232 / D-3501 / D-3601 / D-3701)
11. `docs/ops/RELEASE_CHECKLIST.md`
12. `packages/game-engine/src/index.ts`
13. `packages/game-engine/src/ops/ops.types.ts`
14. `packages/game-engine/src/simulation/ai.types.ts`

**Findings.**

- `01-VISION.md` is **absent** from the chain. Confirmed: no occurrence
  of `01-VISION` or `VISION.md` anywhere in the session prompt
  (grep-verified against the 553-line file).
- The renumbering required by the post-§17 canonical chain is not
  applied. Between ARCHITECTURE.md (item 4–6) and
  `02-CODE-CATEGORIES.md` (item 7), the session prompt has no Vision
  slot. Under the new chain, Vision sits immediately after ARCHITECTURE.
- This is a direct §17-adjacent gap (not §17 itself, but a
  `01.4`-driven requirement that §17 made mechanical).

**Verdict on this section:** Authority Chain is **out of date**. Needs a
Vision entry inserted as item 3 (pushing 02-CODE-CATEGORIES, EC, WP, and
DECISIONS down by one).

---

## 3. Per-Clause Walk

Clauses WP-037 touches (either directly or via the strategy docs it
produces). All line references are to the session prompt under review
unless stated otherwise.

### §3 (Player Trust & Fairness)

**Vision text (L42–L48):** "All game state transitions must be
inspectable, logged, and defensible. Randomness is verifiably fair and
reproducible (seeded for replays). The system enforces rules with
perfect neutrality."

**Where prompt addresses:**
- L159: "Beta runs the same deterministic engine as production. No
  'beta mode' anywhere."
- L271: same, restated as Non-Negotiable Constraint.
- L76 (Copilot #8): "Replay remains the canonical debugging artifact."
- L131: "beta feedback is transport metadata; `G` is Class 1 runtime
  and is never deployed".
- L233 (RS-3): engine-isolation grep covers all engine subdirectories,
  enforcing beta-code isolation from gameplay logic.

**Status:** **Preserved.** The engine-isolation grep at L449 is a
structural lock on bit-identical engine execution in beta. `src/beta/`
is forbidden from importing any gameplay subdirectory, so beta feedback
cannot bend fairness.

### §4 (Faithful Multiplayer Experience)

**Vision text (L52–L57):** "Multiplayer play must mirror the tabletop
cooperative experience ... Multiplayer synchronization, reconnection,
and late-joining must be reliable. Multiplayer correctness is
prioritized over convenience."

**Where prompt addresses:**
- L151: "full core loop, limited content set, replays + spectator
  enabled" — implies multiplayer because core loop is multiplayer.
- L158 beta objectives: "validate core loop, surface UX friction,
  detect edge-case bugs, measure difficulty perception vs AI metrics".
  **Does not name multiplayer.**
- `BETA_EXIT_CRITERIA.md` categories (L311): Rules correctness, UX
  clarity, Balance perception, Stability. **No explicit multiplayer
  sync / reconnection / late-joining criterion.**

**Status:** **Gap.** The prompt does not require `BETA_STRATEGY.md` or
`BETA_EXIT_CRITERIA.md` to include a multiplayer correctness criterion,
even though beta is the primary surface where §4 gets validated against
real players. Stability covers crashes; it does not cover late-joining
semantics or reconnection invariants.

This is not a §17 FAIL — §4 is not crossed. But §4 is arguably
**underserved** by the exit criteria.

### §5 (Longevity & Expandability)

**Vision text (L61–L68):** "Core systems must scale without rewrites.
Adding content must not require structural changes. Short-term
shortcuts that compromise long-term support are not acceptable."

**Where prompt addresses:**
- L104–L106 (Copilot #14, #28): `FeedbackCategory` and `BetaCohort`
  designed for governed extension via future WP + D-entry. No silent
  code-level widening.
- L196: `severity: 1 | 2 | 3` widening is "a governance event (new
  D-entry + doc update), not a silent code change".
- L195: "**`reproductionReplayId` is the ONLY optional field**" — every
  consumer must opt-in explicitly.

**Status:** **Preserved.** Extension seams are locked behind governance
events.

### §13 (EC-Driven Development)

**Vision text (L186–L188):** "Significant work follows Execution
Checklists (ECs). Bugs are treated as execution contract violations."

**Where prompt addresses:**
- L169: "EC / commit prefix: `EC-037:` on every code-changing commit;
  `SPEC:` on governance / doc-only commits; `WP-037:` is forbidden."
- L15: triple-cross-referenced commit-prefix rule; L135: EC-037 cited
  as primary execution authority.

**Status:** **Preserved.**

### §14 (Explicit Decisions, No Silent Drift)

**Vision text (L191–L194):** "Architectural or platform shifts must be
documented. 'Just this once' exceptions are not allowed."

**Where prompt addresses:**
- L249: D-3701 landed as pre-flight precondition.
- L170–L173: three-commit topology (A0 SPEC pre-flight, A EC code, B
  SPEC governance) guarantees every structural change is minuted.
- L284: "If any of D-0702 / D-0902 / D-1232 / D-3501 / D-3601 cannot
  be located in `DECISIONS.md` ... STOP".

**Status:** **Preserved.**

### NG-1 (Pay-to-Win)

**Vision text (L499–L506):** Legendary Arena will never sell mechanical
edge, modified card behavior, advantageous starting conditions.

**Where prompt addresses:**
- L532 Out of Scope: "No monetization testing."
- L99: "No special beta views beyond build ID display."
- L159: "Same release gates (WP-035). Same rollback capabilities."

**Status:** **Preserved.** Beta grants no mechanical edge. Cohorts
partition by role (see NG-3 below).

### NG-3 (Content Withheld for Competitive Advantage)

**Vision text (L526–L530):** "No heroes, masterminds, or villains that
are: Exclusive to payers in shared play; Temporarily locked to paying
users; Tuned differently based on ownership."

**Risk vector:** Beta cohorts could drift toward paid-tier gating if
cohort definitions are not locked to expertise/role only.

**Where prompt addresses:**
- L205–L209: three cohorts defined strictly by expertise / role:
  - "Expert tabletop players — rules-aware, edge-case focused"
  - "General strategy gamers — UX, clarity, onboarding signal"
  - "Passive observers — spectator and replay usability"
- L43 WP body: "Three user cohorts are defined: expert tabletop
  players, general strategy gamers, passive observers".

**Status:** **Preserved.** Cohort identifiers `'expert-tabletop'`,
`'general-strategy'`, `'passive-observer'` contain **no payer-status
token**. The closed literal union is locked by EC-037 §Locked Values
and cannot drift without a governance event.

**Weak signal:** There is no affirmative line in the session prompt or
WP-037 stating "cohorts are never defined by payer status or future
paid-tier intent." The lock is structural (closed union + verbatim
prose) but not declared. A §17 Vision Alignment block would make this
explicit.

### NG-4 through NG-7

**Status:** Not triggered. WP-037 produces no gameplay timers, ads,
dark patterns, or friction monetization.

### §18 (Replayability & Spectation)

**Where prompt addresses:**
- L151: "replays + spectator enabled" in beta scope.
- L207: cohort 3 is "Passive observers — spectator and replay
  usability".
- L152: exit criterion "all replay verifications pass".
- `BetaFeedback.reproductionReplayId?: string` is the canonical
  debugging anchor.

**Status:** **Preserved.**

### §22 (Deterministic & Reproducible Evaluation)

**Vision text (L274–L280):** "Scoring is fully deterministic. Results
are computed entirely from the authoritative game log and the final
game state. If a game can be replayed, it must produce the same score."

**Where prompt addresses:**
- L159: "Beta runs the same deterministic engine as production."
- L259–L261: `src/beta/` forbidden from `Math.random`, `Date.now`,
  `performance.now`, `new Date()`.
- L311: "Balance perception: human win rates within acceptable range
  of AI simulation predictions (D-0702)."

**Status:** **Preserved.** Beta cannot disturb scoring determinism
because beta types are pure data and the engine never reads them.

### §24 (Replay-Verified Competitive Integrity)

**Where prompt addresses:**
- L152: "all replay verifications pass" is a binary exit criterion.
- `reproductionReplayId` reinforces replay as the canonical reproducer.

**Status:** **Preserved.**

### Financial Sustainability

**Where prompt addresses:** L532 Out of Scope: "No monetization
testing." Beta is not a commercial surface.

**Status:** **Not crossed.**

---

## 4. Vision Trailer Coverage

Per `01.3` L89–L142, commits whose EC's governing WP carries a
`## Vision Alignment` section **should** include a `Vision: §X, §Y`
trailer in the commit body.

**WP-037 state today:** WP-037 does **not** yet have a
`## Vision Alignment` section. The user's prompt confirms this and
notes one is "queued for application after the WP-037 session lands."
The WP body was last reviewed above (L1–L309 of
`WP-037-public-beta-strategy.md`) — no `## Vision Alignment` header
is present.

**Session prompt commit guidance:** Searched for `Vision:` (trailer
form), `Vision Trailer`, and `Vision Alignment`:
- L6, L169, L519: Commit prefix rules name only `EC-037:`, `SPEC:`,
  and the `WP-037:` prohibition. No `Vision:` trailer mention.
- L172–L173 (three-commit topology): Commit A body guidance names the
  01.6 post-mortem bundle; no Vision trailer guidance.
- L550–L552 (Final Instruction): "commit per the established
  three-commit pattern" — no trailer guidance.

**Enforcement reality:** Per `01.3` L97: "The trailer is a
**documentation convention**, not a hook-enforced rule. Commits without
the trailer are not rejected." So the session prompt's silence does not
**block** the commit. It does, however, mean the executor has no
in-prompt cue to add the trailer.

**Net effect:** If WP-037's `## Vision Alignment` block is added
after-the-fact (as the user's prompt suggests), Commit A (EC-037 code)
will already be landed without a `Vision:` trailer. Reviewers may
request a retroactive note, but commits cannot be rewritten post-merge
without force-push. This is acceptable per `01.3` L131–L136 ("When to
omit" explicitly includes "EC-###: commits whose governing WP has no
`## Vision Alignment` section").

**Status:** **Tolerated by convention.** Not a FAIL today; may become
one if §17 trailer enforcement is later promoted to a hook.

---

## 5. Verdict

**FAIL.**

The session prompt would not pass the §17 gate as written today. The
WP-037 `## Vision Alignment` block is missing; the session prompt
compounds this by (a) omitting `01-VISION.md` from the Authority Chain
in violation of the post-§17 `01.4` canonical chain, and (b) omitting
any Vision Sanity Check equivalent that `01.4` now names "required for
all WP classes."

The FAIL is **structural, not substantive.** The underlying content
(engine-isolation lock, cohort partitioning, replay-verified exit
criteria, monetization-free scope) aligns with the vision and crosses
no non-goal. No clause conflict exists. No DECISIONS.md entry would be
needed to authorize an exception — no exception is being taken.

Required edits to convert FAIL → PASS, as a numbered patch list:

### Patch 1 — Insert `01-VISION.md` into Authority Chain

- **File:** `docs/ai/invocations/session-wp037-public-beta-strategy.md`
- **Location:** L126–L144 (`## Authority Chain (Read in Order Before
  Coding)`)
- **Forces the change:** `01.4 §Authority Chain` L202–L245; `00.3 §17`
  preamble noting the vision is authoritative for intent/fairness/
  identity/monetization/longevity.
- **Before:** Items 1–14 as listed in §2 above; item 4 begins
  `docs/ai/ARCHITECTURE.md §Section 3`.
- **After:** Insert a new item 4 between the current ARCHITECTURE items
  and `02-CODE-CATEGORIES.md`, reading:

  ```
  4. docs/01-VISION.md — Primary Goals #1-5, Secondary Goals #6-19,
     Scoring (#20-26), Non-Goals NG-1..7, Financial Sustainability.
     Authoritative for intent / fairness / identity / monetization /
     longevity. ARCHITECTURE.md wins only on layer-boundary questions.
  ```

  Renumber current items 7–14 to 8–15. (Current items 5 and 6 are
  ARCHITECTURE subsections — they may stay grouped as 5 and 6; the
  insertion sits at 4.)

### Patch 2 — Add a Vision Sanity Check block

- **File:** same.
- **Location:** Insert a new section between `## Copilot Check (01.7)`
  (ends L122) and `## Authority Chain` (begins L126). Heading:
  `## Vision Sanity Check (01.4 §Vision Sanity Check)`.
- **Forces the change:** `01.4 §Vision Sanity Check` L249–L283
  ("Required for all WP classes"); `00.3 §17.2` (clause-number
  citations, not paraphrases).
- **Content:** four fields per `01.4 §Vision Sanity Check`:
  - **Vision clauses touched:** `§3, §4 (partial), §5, §13, §14, §18,
    §22, §24, NG-1, NG-3`.
  - **Conflict assertion:** `No conflict: this WP preserves all
    touched clauses.`
  - **Non-Goal proximity:** explicit confirmation that cohort
    definitions partition by expertise/role only, never by payer status
    or future paid-tier intent — NG-1 and NG-3 not crossed.
  - **Determinism preservation:** explicit line confirming `src/beta/`
    cannot reach gameplay state and the engine is bit-identical in beta
    (Vision §22). The engine-isolation grep at L449 is the structural
    proof.

### Patch 3 — Add a §4 multiplayer-correctness line to exit criteria guidance

- **File:** same.
- **Location:** L311 (`BETA_EXIT_CRITERIA.md` content spec inside
  `## Files Expected to Change`).
- **Forces the change:** `00.3 §17.1` trigger #4 (multiplayer
  synchronization, reconnection, late-joining); Vision §4 ("multiplayer
  correctness is prioritized over convenience").
- **Before:** "Stability (zero crashes in final week; rollback never
  triggered in final deployment — D-0902)."
- **After:** Add a fifth sub-criterion under Stability **or** lift
  multiplayer to its own category: "**Multiplayer correctness**:
  reconnection round-trips succeed in final week; late-joining
  semantics match spec; no desync incidents in final 2 weeks." Mark
  binary pass/fail with measurable threshold.

  Alternate (lighter) fix: add a single sentence to the Stability
  category — "stability includes multiplayer reconnection and
  late-joining reliability per Vision §4."

### Patch 4 — Add Vision trailer guidance to commit topology

- **File:** same.
- **Location:** L170–L173 (`Commit topology` bullets).
- **Forces the change:** `01.3 §Vision Trailer` L89–L142 — convention
  triggers once WP-037 gains its `## Vision Alignment` block.
- **Content:** Add a sentence under Commit A and Commit B:

  > Commit A body should include a `Vision: §3, §4, §5, §18, §22, §24,
  > NG-1, NG-3` trailer once WP-037's `## Vision Alignment` block
  > lands. Commit B (governance close) should repeat the same trailer.

  Note: this patch is contingent on Patch 5 below — if WP-037's
  `## Vision Alignment` block is not added, the trailer remains
  omittable per `01.3 §When to omit`.

### Patch 5 — WP-037 `## Vision Alignment` block (out of scope for this audit)

The WP itself must grow a `## Vision Alignment` section to truly close
the §17 gate. That edit is **not** in this session's scope per the
audit constraints. It is deferred to whoever writes the follow-up SPEC
commit against `docs/ai/work-packets/WP-037-public-beta-strategy.md`.
Required content per `00.3 §17.2`:
- **Vision clauses touched:** `§3, §4, §5, §13, §14, §18, §22, §24,
  NG-1, NG-3`.
- **Conflict assertion:** `No conflict: this WP preserves all touched
  clauses.`
- **Non-Goal proximity:** cohorts partition by expertise/role only;
  NG-1 and NG-3 not crossed.
- **Determinism preservation:** beta games run the production engine
  bit-identically; `src/beta/` is pure data with no gameplay reach.

---

## 6. Disposition Recommendation

**Queue SPEC follow-up.**

**Rationale.** The WP-037 execution session is already in flight per
user's prompt. The audit constraints prohibit modifying the session
prompt, the WP, or the EC during this session. The FAIL is structural
— vision clauses are substantively preserved — so there is no safety
case for blocking WP-037 execution. Beta is a low-blast-radius product
experiment, not a commit to a revenue stream. The retrofit is
paperwork, not a design change.

**Proposed commit plan (to be executed in a later session, after the
WP-037 EC-037 code + Commit B governance close have landed):**

### Commit subject

```
SPEC: WP-037 session prompt — §17 vision alignment retrofit
```

### Commit body skeleton

```
Retrofit the WP-037 session prompt to the post-§17 vision-alignment
gate (landed at 0689406). Four patches applied:

1. Authority Chain — insert 01-VISION.md as item 4, renumbering
   02-CODE-CATEGORIES / EC-037 / WP-037 / DECISIONS / remaining refs.
2. Vision Sanity Check block inserted between Copilot Check and
   Authority Chain. Clauses touched: §3, §4, §5, §13, §14, §18, §22,
   §24, NG-1, NG-3. No conflict. NG-1 / NG-3 not crossed (cohorts
   partition by expertise/role only). Determinism preserved via
   engine-isolation grep.
3. Exit criteria guidance gains a multiplayer-correctness sub-criterion
   under Stability (Vision §4).
4. Commit topology documents the Vision: trailer convention (01.3).

WP-037 itself still requires a ## Vision Alignment block to close the
gate completely; that edit lives in a separate SPEC commit against
docs/ai/work-packets/WP-037-public-beta-strategy.md.

No code changes. No EC changes. No WP changes. Session-prompt prose
only.

Vision: §3, §4, §5, §13, §14, §18, §22, §24, NG-1, NG-3
```

### Ordering constraint

This SPEC commit must land **after** the WP-037 execution session
(EC-037 code commit + Commit B governance close) to avoid churning
prose the executor is actively reading. The audit report itself is
already safe to commit now — it does not touch any WP-037 lifecycle
document.

---

## Appendix — What was not audited

Per audit constraints, the following were read but not evaluated for
edits:

- `docs/ai/work-packets/WP-037-public-beta-strategy.md` — checked only
  for the presence/absence of a `## Vision Alignment` section. Absent.
  Retrofit is Patch 5 above; out of scope for this session.
- `docs/ai/execution-checklists/EC-037-beta-strategy.checklist.md` —
  checked only for Locked Values vs session prompt — verbatim match.
- `docs/ai/invocations/session-wp037-public-beta-strategy.md` — read
  in full; not modified.

No files were written under `docs/ai/`, `packages/`, or `apps/` during
this audit. Only `docs/audits/vision-alignment-wp037-session-prompt.md`
was created.

---

## Appendix A — Patch Kit (Ready-to-Apply)

This appendix contains exact before/after text for each of the four
patches identified in §5. The executor of the future SPEC retrofit
commit should apply them mechanically — no judgment calls, no
re-derivation. All line numbers reference
`docs/ai/invocations/session-wp037-public-beta-strategy.md` **as it
stands today** (pre-retrofit); apply patches in the order listed to
avoid line-drift.

### A.1 Patch 1 — Insert `01-VISION.md` into Authority Chain

**File:** `docs/ai/invocations/session-wp037-public-beta-strategy.md`
**Anchor:** the opening three items of the Authority Chain (L128–L130).
**Change kind:** insertion + renumber. No existing text is deleted.

**Find (exact match, L128–L130):**

```
1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code never imports `boardgame.io` in pure helpers, never imports registry, never imports server
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension (none added), ESM-only, `node:` prefix where needed (none expected), no abbreviations, full-sentence error messages (none expected — no runtime code)
```

**Replace with:**

```
1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code never imports `boardgame.io` in pure helpers, never imports registry, never imports server
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension (none added), ESM-only, `node:` prefix where needed (none expected), no abbreviations, full-sentence error messages (none expected — no runtime code)
4. [docs/01-VISION.md](../../01-VISION.md) — Primary Goals (#1-5), Secondary Goals (#6-19), Scoring & Skill Measurement (#20-26), Non-Goals (NG-1..7), Financial Sustainability. Authoritative for intent, fairness, identity, monetization, and longevity. ARCHITECTURE.md wins over 01-VISION.md only on layer-boundary questions. Per `00.3 §17` and `01.4 §Authority Chain` (gate landed at `0689406`).
```

Then renumber existing items 4–14 to 5–15. Specifically:

- L131 `4.` → `5.`
- L132 `5.` → `6.`
- L133 `6.` → `7.`
- L134 `7.` → `8.`
- L135 `8.` → `9.`
- L136 `9.` → `10.`
- L137 `10.` → `11.`
- L138 `11.` → `12.`
- L139 `12.` → `13.`
- L140 `13.` → `14.`
- L141 `14.` → `15.`

Nothing else in those lines changes.

### A.2 Patch 2 — Insert Vision Sanity Check block

**File:** same.
**Anchor:** insert a new section between the end of `## Copilot Check
(01.7)` (L122 last line) and the `---` + `## Authority Chain` heading
(L124–L126).
**Change kind:** insertion only.

**Find (exact match, L120–L126):**

```
**Overall Judgment:** **PASS** — 30 issues scanned, 30 PASS (with one FIX folded into Verification Steps for #11). Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

**Disposition:** **CONFIRM** (not HOLD, not SUSPEND). No remediation blocks execution.

---

## Authority Chain (Read in Order Before Coding)
```

**Replace with:**

```
**Overall Judgment:** **PASS** — 30 issues scanned, 30 PASS (with one FIX folded into Verification Steps for #11). Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

**Disposition:** **CONFIRM** (not HOLD, not SUSPEND). No remediation blocks execution.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Per [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Vision Sanity Check and [docs/ai/REFERENCE/00.3-prompt-lint-checklist.md](../REFERENCE/00.3-prompt-lint-checklist.md) §17. Required for all WP classes. Clause numbers only — no paraphrases.

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness — beta runs the production engine bit-identically), §4 (Faithful Multiplayer Experience — beta validates multiplayer correctness), §5 (Longevity & Expandability — extension seams locked behind governance events), §13 (Execution Checklist-Driven Development), §14 (Explicit Decisions, No Silent Drift), §18 (Replayability & Spectation — `reproductionReplayId` reinforces replay as canonical reproducer), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity — "all replay verifications pass" is a binary exit criterion), NG-1 (No Pay-to-Win), NG-3 (No Content Withheld for Competitive Advantage).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity (NG-1, NG-3):** The three beta cohorts (`'expert-tabletop'`, `'general-strategy'`, `'passive-observer'`) partition players **by expertise and role only — never by payer status, ownership, or future paid-tier intent.** The closed literal union is locked by EC-037 §Locked Values and cannot drift without a new `DECISIONS.md` entry. Beta grants no mechanical edge — Out of Scope line "No monetization testing" (this prompt) holds. NG-1 and NG-3 not crossed.
- **Determinism preservation (§22):** `packages/game-engine/src/beta/` is forbidden from `Math.random`, `Date.now`, `performance.now`, `new Date()` (Non-Negotiable Constraints above) and from importing any engine gameplay subdirectory (engine-isolation grep in Verification Steps). Beta games therefore run the production engine bit-identically. Replay reproduction is preserved — `BetaFeedback.reproductionReplayId` references the WP-027 replay harness without perturbing it.
- **WP `## Vision Alignment` section status:** WP-037 itself does not yet contain a `## Vision Alignment` block (it predates `00.3 §17`). A separate SPEC retrofit against `docs/ai/work-packets/WP-037-public-beta-strategy.md` is queued to add one. This session prompt's Vision Sanity Check stands as the interim structural lock; the WP-level block is tracked for the queued retrofit.

---

## Authority Chain (Read in Order Before Coding)
```

### A.3 Patch 3 — Multiplayer-correctness sub-criterion

**File:** same.
**Anchor:** the `BETA_EXIT_CRITERIA.md` content spec inside
`## Files Expected to Change` (L311).
**Change kind:** expansion of one category description; no category is
removed, no threshold is loosened.

**Find (exact match, L311):**

```
2. `docs/beta/BETA_EXIT_CRITERIA.md` — **new**. Binary pass/fail criteria organized by category (verbatim from Locked Values): **Rules correctness** (zero P0/P1 bugs in final 2 weeks; all replay verifications pass; no invariant violations detected); **UX clarity** (task completion rate above threshold for cohort 2; "confusion" feedback below threshold); **Balance perception** (human win rates within acceptable range of AI simulation predictions per D-0702); **Stability** (zero crashes in final week; rollback never triggered in final deployment — D-0902). Each criterion is binary pass/fail with measurable threshold. Exit requires ALL four categories to pass. Plus a "Why these criteria" or "Measurement methodology" section with D-0702 and D-0902 citations.
```

**Replace with:**

```
2. `docs/beta/BETA_EXIT_CRITERIA.md` — **new**. Binary pass/fail criteria organized by category (verbatim from Locked Values): **Rules correctness** (zero P0/P1 bugs in final 2 weeks; all replay verifications pass; no invariant violations detected); **UX clarity** (task completion rate above threshold for cohort 2; "confusion" feedback below threshold); **Balance perception** (human win rates within acceptable range of AI simulation predictions per D-0702); **Stability** (zero crashes in final week; rollback never triggered in final deployment — D-0902; **multiplayer reconnection round-trips succeed in final week; late-joining semantics match spec; no desync incidents in final 2 weeks — per Vision §4**). Each criterion is binary pass/fail with measurable threshold. Exit requires ALL four categories to pass. Plus a "Why these criteria" or "Measurement methodology" section with D-0702, D-0902, and Vision §4 citations.
```

### A.4 Patch 4 — Vision trailer guidance in commit topology

**File:** same.
**Anchor:** the `Commit topology` bullet list in `## Locked Values`
(L170–L173).
**Change kind:** append one sentence to Commit A and Commit B
descriptions. No re-ordering.

**Find (exact match, L170–L173):**

```
- **Commit topology (three commits, matching WP-035 / WP-036):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: D-3701 in `DECISIONS.md` + `src/beta/` entry in `02-CODE-CATEGORIES.md` §engine. **Already landed at `a4f5574` (2026-04-22).** This session prompt itself is not yet committed; the user may choose to bundle it into a follow-up `SPEC:` commit or into Commit A.
  - **Commit A (`EC-037:`)** — code + 01.6 post-mortem: five files under §Files Expected to Change (2 new docs + 1 new type file + 2 modified re-exports) + `docs/ai/post-mortems/01.6-WP-037-public-beta-strategy.md`.
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (three new minor decisions per DoD: invitation-only signal quality, three-cohort signal targets, same release gates as production).
```

**Replace with:**

```
- **Commit topology (three commits, matching WP-035 / WP-036):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: D-3701 in `DECISIONS.md` + `src/beta/` entry in `02-CODE-CATEGORIES.md` §engine. **Already landed at `a4f5574` (2026-04-22).** This session prompt itself is not yet committed; the user may choose to bundle it into a follow-up `SPEC:` commit or into Commit A.
  - **Commit A (`EC-037:`)** — code + 01.6 post-mortem: five files under §Files Expected to Change (2 new docs + 1 new type file + 2 modified re-exports) + `docs/ai/post-mortems/01.6-WP-037-public-beta-strategy.md`. **Commit body must include a `Vision: §3, §4, §5, §18, §22, §24, NG-1, NG-3` trailer (per `01.3 §Vision Trailer`) once WP-037's `## Vision Alignment` block lands. Until then, the trailer is optional per `01.3 §When to omit` (WP has no `## Vision Alignment` section yet).**
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (three new minor decisions per DoD: invitation-only signal quality, three-cohort signal targets, same release gates as production). **Commit body should repeat the same `Vision:` trailer as Commit A once applicable.**
```

### A.5 Apply-order and verification

**Apply order:** A.1 → A.2 → A.3 → A.4. Patches A.1 and A.2 both modify
prose near the top of the prompt; applying A.1 first keeps the Vision
Sanity Check block's own internal line references stable. A.3 and A.4
are in separate sections and do not conflict with each other.

**Post-patch self-check:**

1. `grep -n "01-VISION.md" docs/ai/invocations/session-wp037-public-beta-strategy.md` returns at least two matches (the new Authority Chain item and the Vision Sanity Check citation).
2. `grep -n "## Vision Sanity Check" docs/ai/invocations/session-wp037-public-beta-strategy.md` returns exactly one match.
3. `grep -n "multiplayer reconnection" docs/ai/invocations/session-wp037-public-beta-strategy.md` returns exactly one match (inside Stability).
4. `grep -n "Vision: §3, §4" docs/ai/invocations/session-wp037-public-beta-strategy.md` returns at least one match (Commit A trailer guidance).
5. Authority Chain final item number is `15.` (not `14.`). Item 4 is `docs/01-VISION.md`.

**Commit topology for the retrofit:** a single SPEC commit. Subject
exactly as in §6 above:

```
SPEC: WP-037 session prompt — §17 vision alignment retrofit
```

Body as drafted in §6. The body's own `Vision:` trailer (`Vision: §3,
§4, §5, §13, §14, §18, §22, §24, NG-1, NG-3`) is appropriate because
the retrofit itself is a vision-bearing governance change — this
mirrors the `0689406` commit that landed the §17 gate.

**Not in this patch kit:** WP-037's own `## Vision Alignment` block
(Patch 5 in §5). That edit belongs to a separate SPEC commit against
`docs/ai/work-packets/WP-037-public-beta-strategy.md` and is
explicitly out of scope for this retrofit.
