# DECISIONS_INDEX.md — Legendary Arena

## Purpose
This index maps **architectural and product decisions** to the **Work Packets (WPs)**
where they were introduced, justified, or locked in.

Use this file to:
- trace decision origins
- understand dependency chains
- evaluate impact before proposing changes

For full rationale, see `DECISIONS.md`.

---

## Meta‑Principles

| Decision ID | Summary | Introduced In |
|------------|---------|---------------|
| D‑0001 | Correctness over convenience | WP‑027 |
| D‑0002 | Determinism is non‑negotiable | WP‑027 |
| D‑0003 | Data outlives code | WP‑034 |

---

## Engine & Core Architecture

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0101 | Engine is the sole authority | WP‑031 | WP‑032, WP‑041 |
| D‑0102 | Fail fast on invariant violations (not gameplay conditions) | WP‑031 | WP‑039, WP‑010–023 |
| D‑0103 | Engine has no UI/network knowledge | WP‑028 | WP‑041 |
| D‑0104 | Counters are numeric flags, never booleans | WP‑010 | WP‑015, WP‑019, WP‑024 |

---

## Determinism & Replay

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0201 | Replay is first‑class | WP‑027 | WP‑039 |
| D‑0202 | Deterministic state hashing | WP‑027 | WP‑032 |

---

## UI & Presentation

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0301 | UI consumes projections only | WP‑028 | WP‑041 |
| D‑0302 | One UIState, many audiences | WP‑029 | WP‑042 |

---

## Network & Multiplayer

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0401 | Clients submit intents only | WP‑032 | WP‑041 |
| D‑0402 | Engine‑authoritative resync | WP‑032 | WP‑039 |

---

## Campaigns & Scenarios

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0501 | Campaigns are meta‑orchestration | WP‑030 | WP‑041 |
| D‑0502 | Campaign state lives outside engine | WP‑030 | WP‑034 |

---

## Content System

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0601 | Content is data, not code | WP‑033 | WP‑046 |
| D‑0602 | Invalid content blocked at load | WP‑033 | WP‑039 |
| D‑0603 | Representation before execution | WP‑021 | WP‑022, WP‑023, WP‑024 |

---

## AI & Balance

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0701 | AI is tooling, not gameplay | WP‑036 | WP‑040 |
| D‑0702 | Balance requires simulation | WP‑036 | WP‑047 |

---

## Versioning & Migration

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0801 | Explicit engine/data/content versions | WP‑034 | WP‑035 |
| D‑0802 | Incompatible data fails loudly | WP‑034 | WP‑039 |

---

## Live Ops

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0901 | Deterministic metrics only | WP‑039 | — |
| D‑0902 | Rollback always available | WP‑035 | WP‑039 |

---

## Growth Governance

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑1001 | Growth requires change budgets | WP‑040 | — |
| D‑1002 | Immutable surfaces protected | WP‑040 | WP‑041 |
| D‑1003 | Content & UI are growth vectors | WP‑040 | WP‑042 |

---

## Onboarding

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑1101 | Tutorials use real rules | WP‑042 | — |
| D‑1102 | Onboarding is UI‑only | WP‑042 | WP‑041 |

---

## Usage Rules

- Before changing behavior, locate related Decision IDs here
- Review all referenced WPs
- Add a new decision entry if behavior meaningfully changes
- Never alter an “Immutable” decision without a major version bump

---

## Relationship to Other Docs
- `DECISIONS.md` → authoritative narrative
- `WORK_INDEX.md` → execution order
- `ARCHITECTURE.md` / WP‑041 → structural reference

This index exists to keep growth **intelligent and intentional**.
``