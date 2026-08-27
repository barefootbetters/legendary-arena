# WP-622 — AI Coach Reads Per-Seat Team Contribution

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/coach/coachSummary.logic.ts`)
**Dependencies:** WP-616 / D-24427 (the per-seat contribution counts on `PlayerScoringContribution`), WP-594 / D-24405 (the endgame coach summary this extends)
**User-Visible Surface:** `play.legendary-arena.com` (the end-of-match AI Coach panel)

> Baseline: `origin/main` at commit `e3e4009a`.

---

## Session Context

WP-616 added per-seat team-contribution counts —
`mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated` — to the
engine `PlayerScoringContribution`, and the server's stored jsonb
`scoreBreakdown.inputs.perPlayer` carries them (WP-617 Vanguard + WP-621 report
card already read them). But the AI Coach's per-player line
(`buildPerPlayerLines`) reads only each seat's VP and bystanders rescued — it is
blind to who actually took down the villains, henchmen, and mastermind tactics.

The coach summary is `JSON.stringify`'d verbatim to the model, so the coach
cannot reason about combat contribution it never receives. In a bot-ally game
especially, the coach can't tell the human "your ally carried the villains while
you chased bystanders."

---

## Goal

The coach summary's per-player line carries each seat's WP-616 defeat counts, and
the system prompt tells the model what they mean, so per-player coaching can read
who carried the combat.

---

## User-Visible Impact

The end-of-match AI Coach can give contribution-aware, per-player coaching —
naming who took down the villains/henchmen/mastermind tactics vs who bought well
but defeated little — instead of reasoning from VP totals alone.

---

## Assumes

- WP-616 on `main`: `PlayerScoringContribution` carries
  `mastermindTacticsDefeated` / `villainsDefeated` / `henchmenDefeated`, exported
  from the engine's runtime-safe surface; the stored jsonb `scoreBreakdown`
  carries them.
- `buildPerPlayerLines` (`coachSummary.logic.ts`) builds `CoachPlayerLine`s from
  `breakdown.inputs.perPlayer` (VP + bystanders only today).
- The coach summary reaches the model via `JSON.stringify(summary, …)` in
  `coachClient.ts` (no per-field rendering — added fields serialize automatically).
- `pnpm -r build` 0; server suite green on `e3e4009a`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/coach/coach.types.ts` — `CoachPlayerLine` (label + VP +
  bystanders + acquiredCards today).
- `apps/server/src/coach/coachSummary.logic.ts` — `buildPerPlayerLines` (reads VP
  + bystanders from each `contribution`).
- `apps/server/src/coach/coachClient.ts` — `COACH_SYSTEM_PROMPT` + `buildUserMessage`
  (`JSON.stringify` of the summary).
- `packages/game-engine/src/scoring/parScoring.types.ts` — `PlayerScoringContribution` (WP-616 source shape).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the default-0 mapping.

**Packet-specific:**
- **Coach summary only.** No score, hash, wire-shape, or persistence change — the
  counts are already in the stored breakdown. No new route, no migration.
- **Default 0 for pre-WP-616 records.** A `contribution` missing the counts maps
  to 0 (matching the existing `?? 0` for VP), truthful for a record that never
  carried them.
- **System-prompt is constant.** Keep `COACH_SYSTEM_PROMPT` a per-request-free
  constant (a prompt-cache target) — describe the new fields generically, no
  match-specific text.

**Locked values:** the three field names match `PlayerScoringContribution`
exactly (`mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated`).

---

## Scope (In)

### A) `coach.types.ts` (**modified**)
- Add `villainsDefeated`, `henchmenDefeated`, `mastermindTacticsDefeated`
  (`readonly … : number`) to `CoachPlayerLine`, with a `// why:` (WP-616 counts;
  default 0 for older records).

### B) `coachSummary.logic.ts` (**modified**)
- `buildPerPlayerLines` keeps the whole `PlayerScoringContribution` in its map and
  populates the three counts via `?? 0`; import `PlayerScoringContribution` type.

### C) `coachClient.ts` (**modified**)
- Add a short block to `COACH_SYSTEM_PROMPT` explaining the three per-player
  defeat counts and how to use them for per-player coaching.

### D) `coachSummary.logic.test.ts` (**modified**)
- The counts flow through for a WP-616 record (2 seats); default to 0 for a
  pre-WP-616 record.

---

## Out of Scope

- **No score / hash / wire-shape / persistence change** — the counts already reach
  the server in the stored breakdown.
- **No new route, model, `source_kind`, or migration.**
- **No change to `acquiredCards`, adversity, or the outcome/grade derivation.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/coach/coach.types.ts` — **modified** — 3 counts on `CoachPlayerLine`
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — populate the counts
- `apps/server/src/coach/coachClient.ts` — **modified** — system-prompt guidance
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified** — flow + default tests

No other **code** files may be modified. (The `EC-657:` implementation commit
touches exactly these 4; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Contribution-aware coaching (§24 recognition, not power). The counts describe
hero-vs-villain defeats, not player-vs-player comparison (§23b). No score change;
read-only over data already computed. Deepens the Legendary-Pass coach value.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint added, removed, or changed; the coach endpoint's request
and response shapes are unchanged (the fields ride inside the existing summary the
server builds internally).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `CoachPlayerLine` carries `villainsDefeated` / `henchmenDefeated` /
  `mastermindTacticsDefeated`, populated from the breakdown's per-seat counts.
- [ ] A pre-WP-616 record defaults each count to 0.
- [ ] The coach system prompt describes the three fields.
- [ ] `pnpm -r build` 0; server suite green; the `EC-657:` diff is exactly the 4 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
# Expected: exits 0 / all pass (+ the WP-622 coach cases)

Select-String -Path "apps\server\src\coach\coach.types.ts" -Pattern "mastermindTacticsDefeated"
# Expected: the count is on CoachPlayerLine

git diff --name-only
# Expected (implementation commit): only the 4 files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  the AI Coach panel for a co-op match reads each seat's contribution (per-player
  combat coaching). Unit tests assert the summary carries the counts; the model's
  narration is non-deterministic, so the field-presence tests are the gate.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24433 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-622 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (≥2 Out-of-Scope). §2 Constraints — PASS (coach summary only;
  default 0; constant prompt; locked names). §3 Assumes — PASS. §4 Context — PASS
  (cites the reader + the engine source shape). §5 Files — PASS (4 code files).
  §6 Naming — PASS (field names match `PlayerScoringContribution`). §7 Deps — PASS
  (WP-616/594). §8 Boundaries — PASS (server; reads engine projection via
  runtime-safe surface). §9 — PASS. §10 — N/A. §11 Persistence — PASS (no store
  change). §12 Tests — PASS (flow + default). §13 — PASS. §14 Acceptance — PASS
  (4 binary). §15/§15.1 — PASS (surface + D-24026; non-deterministic-model note).
  §16 — PASS. §17 Vision — PASS. §18 Prose-vs-grep — PASS. §19 — N/A. §20 Funding —
  N/A. §21 API — N/A (request/response shapes unchanged; internal summary only).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main` (`e3e4009a`):**
  `PlayerScoringContribution` (engine) carries + exports the 3 counts (WP-616,
  `index.ts` line ~223); the server jsonb `scoreBreakdown.inputs.perPlayer`
  carries them (badge predicates read them at runtime); `buildPerPlayerLines`
  currently maps only VP + bystanders; `coachClient.ts` serializes the summary
  via `JSON.stringify`. No collision.
- **PS items (blocking): none.** Additive fields on an internal summary + a
  constant-prompt addition.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** The counts are already in the stored breakdown
the coach reads, and the summary is JSON-serialized to the model verbatim — so
this is a strict data-surfacing add: keep the contribution in the per-player map,
populate the three counts (default 0 for older records), and tell the model what
they mean. No score, hash, wire, or persistence surface moves; request/response
shapes unchanged. Session-prompt generation folded into this combined
draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24433 (reserved; Drafted 2026-08-27)** — The AI Coach's per-player summary
  line (`CoachPlayerLine`) carries each seat's WP-616 team-contribution counts
  (`villainsDefeated` / `henchmenDefeated` / `mastermindTacticsDefeated`),
  defaulting to 0 for records persisted before WP-616, and the coach system prompt
  describes them so the model can give contribution-aware per-player coaching. The
  counts are already in the stored jsonb `scoreBreakdown` the coach reads; this is
  a display/summary surfacing of data already on the server — no score, hash,
  wire-shape, or persistence change, no new route, no migration.

---

## See Also

- WP-616 / D-24427 (the per-seat counts this surfaces), WP-594 / D-24405 (the coach
  summary extended), WP-621 / D-24432 (the report-card surfacing of the same counts),
  WP-617 / D-24428 (Vanguard — the first server-side reader)
