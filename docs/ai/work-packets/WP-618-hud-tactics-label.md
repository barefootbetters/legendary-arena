# WP-618 — HUD "Strikes" → "Tactics" Label Fix

**Status:** Ready
**Primary Layer:** `apps/arena-client` (one HUD label + testid)
**Dependencies:** WP-062 / WP-128 (the `TopHudBar` mastermind counter)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `ba70f538`.

---

## Session Context

Operator-reported: the top HUD shows **"Strikes: 4/4"** while the game-over panel
shows **"Master Strikes: 3"** — they disagree because they measure different
things. Traced: `TopHudBar.vue`'s `mastermindProgressLabel()` reads
`mastermind.tacticsDefeated` (of `mastermindTacticsTotal`) — the mastermind's
**tactics** defeated (defeat-progress toward vanquishing it) — but the HUD labels
it **"Strikes"**. The *actual* Master Strike count lives on `MasterStrikePile.vue`
as **"Master Strikes: N"** (`strikePile.length`). So the HUD label both
mislabels the quantity (tactics, not strikes) and collides with the real strike
count — the same class of bug as WP-612's Escaped/Bystanders collision.

---

## Goal

The HUD counter reads **"Tactics: N/M"** (tactics defeated / total) — its true
quantity — with no collision with the separate "Master Strikes" count.

---

## User-Visible Impact

The top HUD reads "Tactics: 4/4" instead of "Strikes: 4/4"; the "Master Strikes:
N" count on the strike pile is unchanged and no longer contradicted.

---

## Assumes

- `TopHudBar.vue` renders `<span data-testid="play-hud-strikes">Strikes: {{
  mastermindProgressLabel() }}</span>`, where `mastermindProgressLabel()` =
  `${mastermind.tacticsDefeated}/${mastermindTacticsTotal}`.
- `MasterStrikePile.vue` renders the real "Master Strikes: N" (`strikePile.length`) — untouched.
- The only test reference is `TopHudBar.test.ts` (one assertion); no other consumer reads `play-hud-strikes`.
- `pnpm -r build` 0; arena-client `typecheck` + `test` green on `ba70f538`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/components/play/TopHudBar.vue` — the label + testid (line ~155) + the `mastermindTacticsTotal` JSDoc (~line 37).
- `apps/arena-client/src/components/play/TopHudBar.test.ts` — the one `play-hud-strikes` assertion.
- `apps/arena-client/src/components/play/MasterStrikePile.vue` — the real "Master Strikes" count (reference; not modified).
- `docs/ai/DECISIONS.md` D-24423 (the sibling Escaped/Bystanders label fix).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the rename (tactics ≠ master strikes).

**Packet-specific:**
- **Label + testid only.** `Strikes:` → `Tactics:` and `data-testid="play-hud-strikes"`
  → `play-hud-tactics`. No change to `mastermindProgressLabel()` (it already reads
  tactics) or to any projection/engine surface.
- **Do not touch `MasterStrikePile.vue`** — its "Master Strikes: N" is the correct
  real-strike count.
- **`vue-tsc` gates.**

**Locked values:** label text `Tactics:`; testid `play-hud-tactics`.

---

## Scope (In)

### A) `TopHudBar.vue` (**modified**)
- Line ~155: `Strikes:` → `Tactics:`, `data-testid="play-hud-strikes"` →
  `play-hud-tactics`. Clarify the `mastermindTacticsTotal` JSDoc (tactics ≠ master strikes).

### B) `TopHudBar.test.ts` (**modified**)
- The one assertion: `play-hud-strikes` → `play-hud-tactics`, `'Strikes: 1/4'` → `'Tactics: 1/4'`.

---

## Out of Scope

- **No change to `MasterStrikePile.vue`** or the "Master Strikes" count.
- **No change to `mastermindProgressLabel()`** — it already computes tactics.
- **No engine / projection change** — the counter's data is unchanged; only the label.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/components/play/TopHudBar.vue` — **modified** — label + testid + JSDoc
- `apps/arena-client/src/components/play/TopHudBar.test.ts` — **modified** — the assertion

No other **code** files may be modified. (The `EC-653:` implementation commit
touches exactly these 2; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync, card-data, or
monetization. A HUD label-fidelity fix; no engine / `G` / `ctx` / hash surface.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] The HUD counter renders "Tactics: N/M" (testid `play-hud-tactics`); no
  "Strikes:" label remains in `TopHudBar.vue`.
- [ ] `MasterStrikePile.vue`'s "Master Strikes: N" is unchanged.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client
  suite green; the `EC-653:` diff is exactly the 2 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: all exit 0 / pass

Select-String -Path "apps\arena-client\src\components\play\TopHudBar.vue" -Pattern "Tactics:|play-hud-tactics"
# Expected: the renamed label + testid; no "Strikes:" remains

git diff --name-only
# Expected (implementation commit): only TopHudBar.vue + TopHudBar.test.ts.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  the top HUD reads "Tactics: N/M"; "Master Strikes: N" is separate and correct.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24429 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-618 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (label+testid only; locked values). §3 Assumes — PASS. §4 Context — PASS
  (cites the counter source + the real strike display + the sibling D-24423).
  §5 Files — PASS (2 code files; governance separate). §6 Naming — PASS. §7 Deps —
  PASS (none). §8 Boundaries — PASS (client label only). §9 Windows — PASS.
  §10/§11 — N/A. §12 Tests — PASS (the one assertion updated). §13 — PASS.
  §14 Acceptance — PASS (3 binary). §15/§15.1 — PASS (surface + D-24026).
  §16 — PASS. §17 Vision — N/A + no-hash note. §18 Prose-vs-grep — PASS. §19 — N/A.
  §20 Funding / §21 API — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main` (`ba70f538`):** `mastermindProgressLabel()`
  reads `mastermind.tacticsDefeated` and is labeled "Strikes" (line 155);
  `MasterStrikePile.vue` shows the real "Master Strikes: N"; the only `play-hud-strikes`
  reference is the one `TopHudBar.test.ts` assertion. No hidden consumer.
- **PS items (blocking): none.** Trivial label + testid rename.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** The counter already computes tactics; only its
label is wrong. Renaming to "Tactics" (and the testid to match) removes both the
mislabel and the collision with the real "Master Strikes" count. No engine or
projection surface. Session-prompt generation folded into this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24429 (reserved; Drafted 2026-08-27)** — The `TopHudBar` mastermind counter
  shows **tactics defeated / total** (mastermind-defeat progress, from
  `mastermind.tacticsDefeated`), so it is labeled **"Tactics: N/M"**, not
  **"Strikes"** — which both mislabeled the quantity and collided with the separate
  **"Master Strikes: N"** ability count (`MasterStrikePile.vue`, `strikePile.length`).
  Client-only label + testid rename (`play-hud-strikes` → `play-hud-tactics`); no
  engine / projection / hash surface. The same class as D-24423 (Escaped → Bystanders).

---

## See Also

- D-24423 / WP-612 — the sibling Escaped/Bystanders HUD label fix
- `apps/arena-client/src/components/play/MasterStrikePile.vue` — the real "Master Strikes" count
