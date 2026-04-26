# EC-097 — Tournament Funding Policy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-097-tournament-funding-policy.md
**Layer:** Governance / Policy (docs-only; no engine, app, or registry touch)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-097.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-097.

---

## Before Starting

- [ ] WP-097 status flipped Draft → Executing; pre-flight bundle registered
- [ ] `docs/01-VISION.md §Financial Sustainability` and §Non-Goals (NG-1..NG-7) present
- [ ] `docs/TOURNAMENT-FUNDING.md` matches the 2026-04-26 baseline (Cost Baseline + Public Blurb sections present; slogan absent at start)
- [ ] `docs/ai/DECISIONS.md` highest current ID is `D-9601` (D-9701 not yet present)
- [ ] `docs/ai/STATUS.md` and `docs/ai/work-packets/WORK_INDEX.md` exist
- [ ] `git diff --name-only packages/ apps/` empty at start

## Locked Values (do not re-derive)

- Funding-doc canonical path: `docs/TOURNAMENT-FUNDING.md`
- Decision ID: `D-9701`
- Vision peer-authority sections: `§Financial Sustainability`, `§Non-Goals: Exploitative Monetization` (NG-1..NG-7)
- Approved channels: `Open Collective` (primary), `PayPal donate link` (supplemental)
- Disallowed-models count: 5 (entry fees that generate organizer profit; prize pools from organizer margin; gameplay-conditioning sponsorships; advertorials / pay-to-win; opaque custodial handling)
- Slogan ban: `No margin, no mission` MUST NOT appear in `docs/TOURNAMENT-FUNDING.md`
- §A authorized neutral labels: `Support Tournaments`, `Tournament Funding`, `Donate` (illustrative; equivalents permitted)
- §A forbidden lexicon: `Buy`, `Purchase`, `Order`, `Subscribe`, `Upgrade`, `Unlock`, `Get Access`
- D-9701 must cite both `docs/TOURNAMENT-FUNDING.md` and `docs/01-VISION.md §Financial Sustainability` and explicitly note the slogan-sense divergence
- Canonical UI term: **funding affordance** (per WP-097 §Authorized Future Surfaces opening Definition). "Funding surface" is reserved for the §F **Funding Surface Gate** proper noun. Do not introduce alternate phrasings ("funding-related UI", "funding element") in any artifact this EC produces.

## Guardrails

- Docs-only. No `packages/` or `apps/` files modified. No `docs/01-VISION.md`, `docs/ai/ARCHITECTURE.md`, or `.claude/` files modified.
- Funding-doc additions are surgical inserts only: `## Scope` section between Authority and Definitions; tightened `Infrastructure` definition; Vision citation in `## Authority`; D-9701 citation in `## Governance and Amendments`. The Cost Baseline, Public Blurb, and all other sections are byte-identical to the 2026-04-26 baseline — do NOT rewrite them.
- D-9701 lands immediately before `## Final Note` in `docs/ai/DECISIONS.md`.
- Profile-attribution language in WP-097 §C stays presentation-only; never authorize comparison-context display, never authorize entitlement framing.
- WP-097 itself implements zero UI surfaces. `grep -nE "Donate|Support Tournaments|Tournament Supporter" apps/ packages/` MUST return zero matches at execution.
- "Cosmetic" is overloaded — Vision §Financial Sustainability already permits platform-level cosmetic flair for supporter subscriptions; this EC's §C uses "presentation-only" instead. Do not collapse the two terms.

## Required `// why:` Comments

- N/A — no executable code is created or modified by EC-097.

## Files to Produce

### Commit A (EC-097 execution — funding-doc reconciliation)

- `docs/TOURNAMENT-FUNDING.md` — **modified** — add `## Scope` section between `## Authority` and `## Definitions`; tighten the `Infrastructure` definition entry to specify "incremental tournament-specific costs"; add Vision citation at the foot of `## Authority`; add D-9701 citation at the foot of `## Governance and Amendments`. All other content (Funding Principles, Approved Channels, Disallowed Models, Reconciliation, Cost Baseline, Sunset / Dissolution, Summary, Public Blurb) byte-identical to the 2026-04-26 baseline.

### Commit B (SPEC governance close — not EC-097)

- `docs/ai/DECISIONS.md` — **modified** — `## D-9701` inserted immediately before `## Final Note`; cites both `TOURNAMENT-FUNDING.md` and `01-VISION.md §Financial Sustainability`; notes slogan-sense divergence; status `Active`
- `docs/ai/STATUS.md` — **modified** — `### WP-097 / EC-097 Executed — Tournament Funding Policy ({YYYY-MM-DD}, EC-097)` block at top of `## Current State`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-097 row flipped `[ ]` → `[x]` with today's date and SPEC commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-097 row flipped `Draft` → `Done {YYYY-MM-DD}`

## After Completing

- [ ] WP-097 acceptance criteria AC-1 through AC-8 all pass (AC-7 covers §A–§E policy authorization; AC-8 covers §F gate-mechanics verification — they were split during the WP-097 governance-tightening pass)
- [ ] `grep -i "no margin" docs/TOURNAMENT-FUNDING.md` returns zero matches
- [ ] `grep -n "^## D-9701" docs/ai/DECISIONS.md` returns exactly one match (immediately before `## Final Note`)
- [ ] `grep -A 50 "^## D-9701" docs/ai/DECISIONS.md | grep -E "TOURNAMENT-FUNDING|01-VISION"` returns at least two matches (both anchors cited)
- [ ] `grep -nE "\[x\] WP-097" docs/ai/work-packets/WORK_INDEX.md` returns exactly one match under Phase 7
- [ ] `grep -nE "NG-1|NG-3" docs/TOURNAMENT-FUNDING.md` returns at least two matches (Cost Baseline non-drivers preserved)
- [ ] `grep -nE "Public Blurb|SHOULD NOT paraphrase" docs/TOURNAMENT-FUNDING.md` returns at least two matches (Public Blurb section preserved)
- [ ] `grep -nE "Donate|Support Tournaments|Tournament Supporter" apps/ packages/` returns zero matches
- [ ] WP-097 §F Funding Surface Gate is intact: `grep -nE "G-[1-7]" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns at least seven matches; the section header `### F) Funding Surface Gate` is present and was not silently dropped during execution
- [ ] WP-097 §F verification-only framing intact: `grep -nE "verification gate only" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns exactly one match
- [ ] WP-097 §F micro-copy exemption intact: `grep -nE "micro-copy" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns at least one match in the Copy deferral block
- [ ] WP-097 canonical "funding affordance" term defined exactly once at the top of §Authorized Future Surfaces: `grep -nE "Definition . funding affordance" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns exactly one match
- [ ] `git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/` returns empty
- [ ] `git diff --name-only` limited to the files listed in `## Files to Produce`
- [ ] EC-097 commit body includes a `Vision: §Financial Sustainability, NG-1, NG-3, NG-5, NG-6, NG-7` trailer per `01.3-commit-hygiene-under-ec-mode.md`
- [ ] EC_INDEX EC-097 row updated `Draft` → `Done {YYYY-MM-DD}`

## Common Failure Smells

- D-9701 added but only one anchor cited — re-read Locked Values; both `TOURNAMENT-FUNDING.md` and `01-VISION.md §Financial Sustainability` MUST appear in the body, plus the slogan-sense divergence note.
- Funding doc's Cost Baseline or Public Blurb section rewritten — STOP; both are byte-locked at the 2026-04-26 baseline. Re-read WP-097 §Scope §A and restore.
- "No margin, no mission" appears in the funding doc — STOP; the slogan is forbidden under WP-097's Non-Negotiable Constraints to prevent semantic collision with Vision §Financial Sustainability (which uses the same phrase in the standard nonprofit-margin sense).
- STATUS block reads "WP-097 / (no EC)" — STOP; this WP has EC-097, so the block header reads `### WP-097 / EC-097 Executed`. Earlier WP-097 draft text said "(no EC)" before EC-097 was created; that draft text is superseded by this EC.
- Any UI token (`Donate`, `Support Tournaments`, `Tournament Supporter`) appears in `apps/` or `packages/` — STOP; WP-097 authorizes future UI WPs but implements none. Tokens leaking into code is a scope violation.
- Alternate UI terminology ("funding-related UI", "funding element", "donation surface") introduced anywhere in the EC, the funding doc, D-9701, the STATUS block, or the WORK_INDEX row — STOP; the canonical term is **funding affordance** (per WP-097 §Authorized Future Surfaces Definition). "Funding surface" is reserved for the §F gate proper noun. Re-derive the wording from the WP rather than coining a synonym.
- §F gate items rewritten to restate policy instead of cite §A–§D — STOP; §F is a verification gate only. New constraints belong in §A–§D; the gate is re-derived, not edited in isolation. If a constraint genuinely needs to change, that is a successor WP, not an EC-097 deliverable.
