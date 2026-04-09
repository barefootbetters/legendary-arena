# Legendary Arena — Claude Rules: Work Packets

This file governs **how Claude may interact with the Work Packet system**.
It does **not** define the packets themselves.

The authoritative source of Work Packet content, order, status, and dependencies
is:

- `docs/ai/work-packets/WORK_INDEX.md`

This file exists solely to enforce correct behavior during
AI-assisted development sessions.

Work Packet execution must respect layer ownership as defined in
**`docs/ai/ARCHITECTURE.md` -- "Layer Boundary (Authoritative)"**.

No Work Packet may redefine layer responsibilities.

---

## Authority & Source of Truth

In all cases:

- WORK_INDEX.md is authoritative for:
  - Which Work Packets exist
  - Execution order and dependencies
  - Review status
  - Completion state
- This file **must never restate packet content or status**
- Claude must always consult WORK_INDEX.md before:
  - Starting a session
  - Selecting a packet
  - Claiming readiness to execute work

If any conflict exists, **WORK_INDEX.md wins**.

---

## Core Invariants (Non-Negotiable)

### One Packet per Session
- Exactly **one Work Packet per Claude Code session**
- Claude must never combine work from multiple packets in one session
- If work spans packets, stop and hand off to the next packet explicitly

Source: WORK_INDEX.md, Format Rules

### Dependency Discipline
- A Work Packet may not be executed until **all listed dependencies are complete**
- Parallel execution is allowed **only if explicitly documented as parallel-safe**
- Claude must verify dependency completion in WORK_INDEX.md before starting

Never assume dependencies are met.

Source: WORK_INDEX.md (dependency chain + parallel-safe notes)

### Review Gate
- Any packet marked **Needs review** must NOT be executed by Claude
- Review is a prerequisite to execution, not an optional step
- Claude may participate in review, but may not execute unreviewed packets

Source: WORK_INDEX.md, Review Status Legend

### Status Updates
- Packet status is updated **only when Definition of Done is fully met**
- Partial completion does not permit status changes
- Claude must not "pre-mark" or "optimistically mark" packets complete

Status updates belong in WORK_INDEX.md only.

---

## Foundation Prompts Rule

- Foundation Prompts (00.4 -> 00.5 -> 01 -> 02) are **not Work Packets**
- They must be run **once**, in order, before WP-002 may execute
- If any Foundation Prompt fails, Claude must stop

Source: WORK_INDEX.md, Foundation Prompts

---

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

When unsure, stop and ask -- never guess.

---

## Conventions Are Locked

The conventions listed in WORK_INDEX.md are **settled decisions**.
Claude must enforce them without re-debate unless DECISIONS.md is explicitly updated.

Examples (non-exhaustive):
- Zones store CardExtId strings only
- `Game.setup()` may throw; moves never throw
- No boardgame.io imports in pure helpers
- `.test.ts` is the only valid test extension
- Prior packet contract files must not be modified

Source: WORK_INDEX.md, Conventions Established Across WPs

---

## Adding or Extending Work Packets

Claude may assist only if **all** of the following are done:

1. Packet file created using the canonical template (00.1)
2. Packet added to WORK_INDEX.md in the correct phase *before execution*
3. Dependencies explicitly listed
4. Lint checklist (00.3) passes

If any step is missing, Claude must stop.

---

## Final Rule

WORK_INDEX.md is the execution spine of the project.

Claude's role is to:
- Read it
- Respect it
- Enforce it

Not to reinterpret or replace it.
