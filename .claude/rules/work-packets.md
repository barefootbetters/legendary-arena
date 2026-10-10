# Legendary Arena — Claude Rules: Work Packets

How Claude may interact with the Work Packet system. WP execution respects
`docs/ai/ARCHITECTURE.md` "Layer Boundary (Authoritative)"; no WP may redefine
layer responsibilities.

## Authority & Source of Truth

Packet content, order, review status, dependencies, and completion state live
in `docs/ai/work-packets/WORK_INDEX.md`, which is authoritative and wins any
conflict; this file never restates packet content or status. Consult
WORK_INDEX.md before starting a session, selecting a packet, or claiming
readiness to execute. Sources below: WORK_INDEX.md Format Rules (one packet),
dependency chain + parallel-safe notes, Review Status Legend, Foundation Prompts.

## Core Invariants (Non-Negotiable)

### One Packet per Session
Exactly **one Work Packet per Claude Code session**. Never combine packets; if
work spans packets, stop and hand off explicitly.

### Dependency Discipline
A WP runs only when **all listed dependencies are complete** in WORK_INDEX.md,
in parallel only where explicitly documented as parallel-safe. Never assume.

### Review Gate
A packet marked **Needs review** must NOT be executed. Claude may take part in
review, but not execute an unreviewed packet.

### Status Updates
Status changes **only when the Definition of Done is fully met**, and only in
WORK_INDEX.md. No partial or optimistic marking.

## Foundation Prompts Rule

Foundation Prompts (00.4 -> 00.5 -> 01 -> 02) are not Work Packets. They run
once, in order, before WP-002; if one fails, stop.

## Prohibited Behaviors [Guardrail]

Claude must never:
- Invent a new Work Packet without updating WORK_INDEX.md first
- Execute a packet not listed in WORK_INDEX.md
- Modify historical Work Packets marked complete
- Skip dependency checks "because it probably works"
- Update packet status outside WORK_INDEX.md
- Merge A-packet contract changes into B-packets
- Relitigate conventions already settled and documented
- Use chat history as authoritative memory instead of repo docs

When unsure, stop and ask — never guess.

## Conventions Are Locked

The conventions listed in WORK_INDEX.md ("Conventions Established Across WPs")
are settled; enforce them without re-debate unless DECISIONS.md is updated
(e.g. CardExtId-only zones, only `Game.setup()` throws, no boardgame.io in pure
helpers, `.test.ts` only, prior contract files are not modified).

## API Catalog Update Obligation (per D-11804)

A WP that adds, modifies, removes, or changes the status of an `apps/server`
HTTP endpoint, or of a `Library-only` catalog function reachable from
`apps/server/src/**`, updates `docs/ai/REFERENCE/api-endpoints.md` in the same
commit, replacing the affected row **entirely** (partial-column updates FAIL).
Closed sets: `Status` ∈ `{ Wired, Shipped-but-unwired, Library-only, Pending }`;
`Auth` ∈ `{ guest, handle-required, authenticated-session-required,
admin-session-required, match-seat-holder }` (D-9905, D-15901, D-24451). Schema
field names match `docs/ai/REFERENCE/00.2-data-requirements.md` exactly. The
draft-time gate is `00.3-prompt-lint-checklist.md §21`; both gates must pass.

## Adding or Extending Work Packets

Claude may assist only when the packet uses the canonical template (00.1), is
added to WORK_INDEX.md in the correct phase *before execution*, lists its
dependencies, and passes the lint checklist (00.3). If any is missing, stop.

## Invocation Artifacts (Commit Policy)

| File pattern | Disposition |
|---|---|
| `docs/ai/session-context/session-context-wp*.md` | **Committed** governance artifact (reconciled state at session start; future sessions read it). |
| `docs/ai/invocations/preflight-*.md` | **Scratchpad by default. Not committed** unless an EC or WP explicitly cites it as a normative input or output. |
| `docs/ai/invocations/copilot-*.md` | **Scratchpad by default. Not committed** (same reason). |
| `docs/ai/invocations/session-*.md` | **Scratchpad by default. Not committed** unless cited normatively (e.g. as an EC's canonical session prompt). Applies to WP-scoped and ad-hoc sessions alike. |

`.gitignore` excludes the three scratchpad patterns (already-tracked files are
unaffected). Override: `git add -f <path>` and document it in the WP / EC body;
never retro-commit otherwise.

## Final Rule

WORK_INDEX.md is the execution spine. Read it, respect it, enforce it — do not
reinterpret or replace it.
