# Session Context — WP-097 (Tournament Funding Policy — Governance)

> **Authored:** 2026-04-27 as a step-0 / step-8 bridge between the
> WP-113 governance closeout (commit `ca3b1ae`) and the next
> executable WP in the user's queued order
> (WP-097 → WP-098 → WP-099 → WP-101 → WP-102). **Purpose:** surface
> the conversation-level context that produced WP-097 + EC-097 + the
> 2026-04-25 drafting session, so the executor does not re-derive
> governance decisions from git log alone.
>
> **This file is not authoritative.** If conflict arises, the priority
> chain in §8 wins.
>
> **No execution is performed by reading this file.** WP-097 is
> docs-only governance — the production change set is
> `docs/TOURNAMENT-FUNDING.md` modifications + `D-9701` insertion +
> `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` updates per the
> two-commit topology established by EC-085 and reused by EC-097
> itself.

---

## 1. State on `main` (as of authoring)

`main` HEAD: **`ca3b1ae`** (`SPEC: WP-113 + EC-113 governance
closeout — D-10014, post-mortem, WORK/EC indices`).

Recent landed history relevant to WP-097:

- **WP-113** — Engine-Server Registry Wiring + Validator Alignment
  — Done 2026-04-27 at `2a00193` (Commit A) + `ca3b1ae` (Commit B).
  Engine `570 / 126 / 0`, server `51 / 8 / 0`, arena-client
  `182 / 17 / 0`. D-10014 anchored. **Surface relevance:** none —
  WP-113 was engine + server work; WP-097 is docs-only governance.
  WP-113's lessons-learned precedent (P6-54) was added to
  `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` at
  governance-closeout time and applies prospectively to all
  contract-changing WPs going forward.
- **WP-100** (revised execution 2026-04-27) — closed; the
  D-10006 → D-10014 fix-forward chain ended at WP-113.
- **No prior governance-only WP since WP-093** (match-setup
  rule-mode envelope field, 2026-04-25). EC-097 cites WP-085 +
  WP-093 as topology / precedent siblings (two-commit `SPEC:` lands;
  no code).

### Uncommitted artifacts in the working tree at authoring time

WP-097 was drafted on 2026-04-25 and EC-097 was drafted on
2026-04-26. Both are committed to `main` already (the `Draft` row
in WORK_INDEX.md / EC_INDEX.md was already in place at the WP-113
session start). **What is NOT yet committed:** any pre-flight
report, copilot check, or session prompt for WP-097.

The user also has six unrelated working-tree items left over from
prior sessions (untouched throughout WP-113):

- `docs/ai/DESIGN-RANKING.md` (modified, +295 lines — Gauntlet /
  Challenge ranking-spec drift; **own SPEC commit, separate
  session**)
- `docs/ai/work-packets/WP-111-uistate-card-display-projection.md`
  (untracked — **own SPEC commit, separate session**)
- `data/cards-combined.{json,md,txt}` + `scripts/Combine-CardData.ps1`
  (untracked — **likely gitignore + standalone-script commit;
  separate session**)

**None of the six belong to WP-097.** The WP-097 session must not
stage them.

---

## 2. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

Steps completed for WP-097 (in the 2026-04-25 / 2026-04-26 drafting
sessions):

| Step | Gate | Status |
|---|---|---|
| 0 | Session context | **This file.** |
| 1 | Pre-flight (`01.4`) | **Pending** — needs to run before execution. |
| 1b | Copilot check (`01.7`) | **Pending** — runs after pre-flight. |
| 2 | Session prompt | **Pending** — generated post-pre-flight + copilot check. |
| 3 | Execution | Awaits steps 1, 1b, 2. |
| 4 | Post-mortem | OPTIONAL per the WP-085 / WP-093 governance-WP precedent (no executable code; no long-lived abstraction beyond the decision record itself). |
| 5 | Pre-commit review | Pending — separate session. |
| 6 | Commit (Commit A code, Commit B governance) | **Two-commit SPEC topology**, both prefixed `SPEC:` per the prior WP-093 / WP-085 governance-WP precedent (NOT `EC-097:` — there is no executable code). |
| 7 | Lessons learned | Likely OPTIONAL — single-decision governance WPs rarely surface new precedents. If WP-098 + WP-099 + WP-101 + WP-102 land in a single session arc and a cross-cutting pattern appears, batch the lessons into one entry at the end of the chain. |
| 8 | Session context for next WP | The next WP in the user's queue is **WP-098** (Funding Surface Gate Trigger), which is hard-dep on WP-097 (D-9701 must land first). WP-098's session context is authored after WP-097 lands. |

---

## 3. WP-097 Goal & Scope (Compressed Reference)

WP-097 is a **governance / policy WP**. No engine, registry, server,
app, or test code is touched. No new npm dependencies. The full
scope from WP-097 §Scope (In):

1. **Reconcile `docs/TOURNAMENT-FUNDING.md`** with Vision §Financial
   Sustainability. Existing draft does not currently cite the
   platform-level revenue model and uses "infrastructure" in a way
   that overlaps Vision's platform-infrastructure scope. Tighten the
   `## Definitions` section; add a `## Scope` section between
   `## Authority` and `## Definitions`; add a citation line at the
   foot of `## Authority`; add a `D-9701` citation at the foot of
   `## Governance and Amendments`.
2. **Anchor the funding contract to D-9701** in
   `docs/ai/DECISIONS.md`. The current highest decision ID is
   **D-9601** (verified 2026-04-27); WP-097's pre-flight should
   re-verify this is still the case. If a higher ID has landed
   between WP-113 close and WP-097 execution, D-9701 stays the
   correct slot — D-NNNN IDs are WP-derived (`D-{WP}{seq}`), not
   sequential — but the pre-flight should re-confirm.
3. **Record the contract** in `docs/ai/STATUS.md` and
   `WORK_INDEX.md` per the governance close pattern.

WP-097 also publishes three **Authorized Future Surfaces** that
downstream WPs (e.g., a global navigation funding affordance, a
registry-viewer funding affordance, an account / profile attribution
surface) must satisfy at their own pre-flight. WP-098 codifies one
of those surfaces (the Funding Surface Gate trigger added to
`00.3 §20`); future surface WPs cite WP-097 in their `## Authority`
or `## Assumes` block.

---

## 4. Dependency Chain

WP-097 has **zero hard dependencies**. Vision §Financial
Sustainability and Vision §Non-Goals (NG-1..7) must already exist
(they do — introduced in pre-WP-001 vision authoring).

WP-097 unblocks:

- **WP-098** (Funding Surface Gate Trigger) — hard-dep on D-9701
  landing; codifies the §20 prompt-lint check.
- **WP-099** (Auth Provider Selection) — independent of WP-097, but
  scheduled next in the user's queue. Hard-dep on WP-052 (already
  done).
- **WP-101** (Handle Claim Flow) + **WP-102** (Public Profile Page)
  — independent of WP-097/098/099 from a code-dependency standpoint,
  but every public-facing surface WP must satisfy the WP-097
  funding-attribution gate at its own pre-flight.

User's stated order (2026-04-27):
**WP-097 → WP-098 → WP-099 → WP-101 → WP-102**

(`WP-101` was missing from the user's first pass; confirmed inserted
between WP-099 and WP-102 since WP-102 has a hard-dep on WP-101's
`findAccountByHandle`.)

---

## 5. WP-113 Lessons Carried Forward

P6-54 (WP-113 governance closeout) added two pre-flight discipline
rules. Neither applies to WP-097 directly — WP-097 is docs-only — but
the executor should remain aware they exist for the WP-098/099/101/102
phase that follows:

- **Global consumer enumeration via grep, not directory walk** for
  any contract change touching `MatchSetupConfig` field types or
  formats (or any analogous cross-file contract surface). Applies to
  WP-101's handle-canonicalization design and WP-102's public
  profile read surface.
- **Type-guard real-method verification at promotion time** when a
  guard is moved from local-scope to exported. Likely applies to
  WP-101 if it introduces or extends any `isXReader` shape; WP-102
  is read-only and unlikely to add guards.

---

## 6. Pre-Flight Inputs (To Be Produced)

The next WP-097 pre-flight session needs:

- WP-097 + EC-097 already on `main` (✓ both committed)
- Vision §Financial Sustainability and §Non-Goals lines re-verified
- `docs/TOURNAMENT-FUNDING.md` content snapshot at session start (to
  detect drift since 2026-04-25 drafting)
- `docs/ai/DECISIONS.md` highest-ID re-verified (currently D-9601;
  D-9701 slot is reserved for this WP)
- Lint-gate (`00.3`) self-review confirmed PASS as of EC-097
  authoring (already noted in WORK_INDEX.md row)

No code-readiness checks required (no code surface).

---

## 7. Out of Scope (Explicitly NOT in WP-097)

- Any modification to `docs/01-VISION.md` (higher authority — only
  Vision authoring sessions touch it)
- Any modification to `docs/ai/ARCHITECTURE.md` (higher authority)
- Any code change in `apps/`, `packages/`, or `data/migrations/`
- Any UI surface change (deferred to future surface-implementation
  WPs that cite WP-097 in their `## Authority`)
- The four Authorized Future Surfaces themselves (A, B, C, D) — only
  the policy + the gate (in WP-098) are in scope here
- The six unrelated working-tree items left over from prior sessions
  (each needs its own session)

---

## 8. Authority Chain (When This File Conflicts)

If anything in this file contradicts the authoritative documents,
the authoritative document wins. Priority:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/01-VISION.md`
4. `.claude/rules/*.md`
5. `docs/ai/work-packets/WORK_INDEX.md`
6. `docs/ai/work-packets/WP-097-tournament-funding-policy.md`
7. `docs/ai/execution-checklists/EC-097-tournament-funding-policy.checklist.md`
8. `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` + EC-TEMPLATE.md
9. This file.

---

## 9. Next Action

The user's next concrete step is to **run pre-flight (`01.4`)
against WP-097 + EC-097**. The pre-flight should be fast — WP-097 is
docs-only with zero hard dependencies, and EC-097 is already
within the 60-line cap per the EC-085 / EC-097 precedent. No PS
items are anticipated; if any surface, follow the standard
PS-resolution → re-pre-flight → copilot check → session-prompt loop.

After pre-flight + copilot check pass, generate the WP-097 session
prompt (per `docs/ai/REFERENCE/01.5-session-prompt-template.md` if
present, or by adapting the WP-093 / WP-085 governance-WP session
prompt as a starting point). The execution session itself runs
against `docs/TOURNAMENT-FUNDING.md` modifications + a single
`D-9701` insertion + the standard governance closeout — typically a
20-30 minute session, two SPEC commits, no code review.

After WP-097 lands, author a session context for WP-098 and proceed
through the user's queue.
