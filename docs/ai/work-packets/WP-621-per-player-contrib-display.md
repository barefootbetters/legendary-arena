# WP-621 — Endgame Report Card Shows Per-Seat Team Contribution

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client/src/components/hud/EndgameSummary.vue`)
**Dependencies:** WP-616 / D-24427 (the per-seat contribution counts on `PlayerScoringContribution`), WP-588 / D-24393 (the per-player report-card split this extends)
**User-Visible Surface:** `play.legendary-arena.com` (the end-of-match report card)

> Baseline: `origin/main` at commit `e3e4009a`.

---

## Session Context

WP-616 added per-seat team-contribution counts —
`mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated` — to the
engine `PlayerScoringContribution`, and the engine `deriveScoringInputs` + the
server's jsonb `scoreBreakdown` already carry them to the client (Vanguard,
WP-617, reads them server-side). But the endgame report card's **"By player"**
block never surfaced them: it renders only each seat's VP and bystanders
rescued. The per-seat attribution the operator has been building toward is on
the wire but invisible.

This surfaces it: a dimmed contribution line beneath each seat's VP —
"defeated 3 villains, 1 henchman, 2 mastermind tactics" — singularised, and
omitted when the seat defeated nothing or the record predates WP-616.

---

## Goal

The "By player" report-card block shows, per seat, the villains / henchmen /
mastermind tactics that seat defeated — a purely client-side display of data
already returned by the server.

---

## User-Visible Impact

After a match, the report card's "By player" section shows not just each
player's VP and bystanders rescued but what each one actually defeated
(villains, henchmen, mastermind tactics) — making a co-op ally's contribution
legible at a glance.

---

## Assumes

- WP-616 on `main`: `PlayerScoringContribution` carries
  `mastermindTacticsDefeated` / `villainsDefeated` / `henchmenDefeated`, and the
  server's stored jsonb `scoreBreakdown.inputs.perPlayer` carries them to the client.
- The client mirror `CompetitivePlayerContribution` (`competitionApi.ts`) does
  **not** yet type those three fields.
- `EndgameSummary.vue` renders the WP-588 "By player" block from
  `workedCalc.perPlayer` (VP + bystanders only today).
- `pnpm -r build` 0; arena-client suite + `vue-tsc` green on `e3e4009a`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/lib/api/competitionApi.ts` — `CompetitivePlayerContribution`
  (the client mirror of the engine projection; 3 fields today).
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — the `WorkedScoreCalc['perPlayer']`
  row type + `buildPerPlayerSplit` (maps VP + bystanders today).
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — the
  `arena-hud-per-player` block (renders label + VP + bystanders).
- `packages/game-engine/src/scoring/parScoring.types.ts` — `PlayerScoringContribution`
  (the source-of-truth shape, WP-616).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the null-when-absent mapping.

**Packet-specific:**
- **Client display only.** No server, engine, or wire-shape change — the fields
  are already on the wire. No hash surface, no migration, no new route.
- **Backward-compatible.** The three client-mirror fields are **optional**;
  records persisted before WP-616 carry none. A seat with no counts (or all
  zero) renders **no** contribution line — never a misleading "0 villains".
- **Singularised.** "1 villain" / "3 villains", "1 henchman" / "2 henchmen",
  "1 mastermind tactic" / "2 mastermind tactics".

**Locked values:** the three field names match `PlayerScoringContribution`
exactly (`mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated`).

---

## Scope (In)

### A) `competitionApi.ts` (**modified**)
- Add `mastermindTacticsDefeated?`, `villainsDefeated?`, `henchmenDefeated?`
  (`readonly … ?: number`) to `CompetitivePlayerContribution`, with a `// why:`
  (WP-616 populates them; optional for pre-WP-616 records).

### B) `scoreCalcDisplay.ts` (**modified**)
- Widen the `WorkedScoreCalc['perPlayer']` row with the three counts as
  `number | null`; map them in `buildPerPlayerSplit` via `?? null`.

### C) `EndgameSummary.vue` (**modified**)
- A `contributionPhrases(row)` helper building the singularised, zero/null-omitting
  phrase list; render a dimmed `.per-player-contrib` line (`v-if` phrases present)
  with `data-testid="arena-hud-per-player-contrib"`.

### D) `scoreCalcDisplay.test.ts` + `EndgameSummary.test.ts` (**modified**)
- Display: null-when-absent + carries-when-present; render line with
  plural/singular + zero-omission + omits the line for a pre-WP-616 record.

---

## Out of Scope

- **No server / engine / wire-shape change** — the fields already reach the client.
- **No new tier, badge, `source_kind`, route, or migration.**
- **No change to the team totals or the raw/PAR/final calc** — contribution counts
  are display-only, not part of the score.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/competitionApi.ts` — **modified** — 3 optional mirror fields
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — **modified** — row type + mapping
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — helper + line + style
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts` — **modified** — mapping tests
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — render tests

No other **code** files may be modified. (The `EC-656:` implementation commit
touches exactly these 5; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Makes each cooperator's contribution legible (§24 recognition, not power). No
score change, no PvP framing (§23b) — the counts describe hero-vs-villain
defeats, not player-vs-player. Read-only display of data already computed.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint added, removed, or changed; the field is already in the
returned jsonb.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] The "By player" block shows a per-seat "defeated …" line when the record
  carries WP-616 counts, singularised, with zero counts omitted.
- [ ] A seat / record with no WP-616 counts renders VP + bystanders and **no**
  contribution line.
- [ ] The team totals and raw/PAR/final calc are unchanged.
- [ ] `pnpm -r build` 0; arena-client suite + `vue-tsc` green; the `EC-656:` diff
  is exactly the 5 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 / all pass (+ the WP-621 display cases)

Select-String -Path "apps\arena-client\src\components\hud\EndgameSummary.vue" -Pattern "arena-hud-per-player-contrib"
# Expected: the contribution line's test id is present

git diff --name-only
# Expected (implementation commit): only the 5 files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a co-op match's report card shows each seat's defeated villains / henchmen /
  tactics beneath its VP. (Component mount tests stand in for a staged
  server-scored game-over, which the dev fixture route cannot produce.)
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; arena-client suite + `vue-tsc` green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24432 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-621 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (≥2 Out-of-Scope). §2 Constraints — PASS (client display
  only; backward-compatible; locked field names). §3 Assumes — PASS. §4 Context —
  PASS (cites the mirror type + the engine source shape). §5 Files — PASS (5 code
  files). §6 Naming — PASS (field names match `PlayerScoringContribution`). §7 Deps
  — PASS (WP-616/588). §8 Boundaries — PASS (arena-client only; reads a projection).
  §9 — PASS. §10 — N/A. §11 Persistence — PASS (display only; no store). §12 Tests —
  PASS (mapping + render). §13 — PASS. §14 Acceptance — PASS (4 binary). §15/§15.1 —
  PASS (surface + D-24026). §16 — PASS. §17 Vision — PASS. §18 Prose-vs-grep — PASS.
  §19 — N/A. §20 Funding / §21 API — N/A (field already on the wire).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main` (`e3e4009a`):**
  `PlayerScoringContribution` (engine) carries the 3 counts (WP-616);
  `deriveScoringInputs` populates them; the server stores `scoreBreakdown` as
  jsonb (full pass-through) and its badge predicates read
  `perPlayer[].mastermindTacticsDefeated` at runtime — so the fields reach the
  client. `CompetitivePlayerContribution` (client mirror) lacks them; the
  report-card block renders VP + bystanders only. No collision.
- **PS items (blocking): none.** Additive optional fields + a display line.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** The data is already on the wire (server jsonb
`scoreBreakdown.inputs.perPlayer`), so this is a strict display add: type the
optional mirror fields, map them (null when a pre-WP-616 record omits them),
render a dimmed line that omits zeros and absent counts. No score, hash, wire,
or persistence surface moves. Backward-compatible with pre-WP-616 records by
construction (optional → null → line omitted). Session-prompt generation folded
into this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24432 (reserved; Drafted 2026-08-27)** — The endgame report card's per-seat
  "By player" row surfaces each seat's WP-616 team-contribution counts (villains /
  henchmen / mastermind tactics defeated) as a dimmed line beneath its VP +
  bystanders, singularised, omitted when the seat defeated nothing or the record
  predates WP-616. The engine/server already carry the fields to the client
  (WP-616 `deriveScoringInputs` → jsonb `scoreBreakdown`); this is a client-only
  display of data already on the wire — no new server/engine field, no hash
  surface, no migration.

---

## See Also

- WP-616 / D-24427 (the per-seat counts this surfaces), WP-588 / D-24393 (the
  per-player report-card split this extends), WP-617 / D-24428 (Vanguard — the
  first server-side reader of the same counts)
