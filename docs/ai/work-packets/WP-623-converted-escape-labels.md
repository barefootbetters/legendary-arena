# WP-623 — Danger Meter Names the Converted Enemy (Killbots / Skrulls)

**Status:** Ready
**Primary Layer:** Game Engine (`packages/game-engine/src/rules/schemeLossProgress.ts`) + Client (`apps/arena-client/src/vfx/menaceDisplay.ts`)
**Dependencies:** WP-612 / D-24423 (the `escaped-bystander` split this mirrors), WP-562 / D-24367 (the danger-meter projection + label boundary), WP-513 / D-24325 (converted-villain origins)
**User-Visible Surface:** `play.legendary-arena.com` (the danger meter)

> Baseline: `origin/main` at commit `9dea4747`.

---

## Session Context

WP-612 split `escaped-pile` into `escaped-bystander` because a bystander-counting
scheme (Midtown Bank Robbery) tracks *bystanders* carried into the escaped pile,
not villains fleeing — so "Escaped" both mislabeled the quantity and collided
with the raw escaped-villain count in the HUD.

The **`escaped-converted`** kind has the identical defect. Two schemes —
**Replace Earth's Leaders with Killbots** (origin `killbot`) and **Secret
Invasion of the Skrull Shapeshifters** (origin `skrull`) — lose when a threshold
of *converted* villains of one origin escape. Converted cards are typed
`'villain'` for routing, so the meter counts a **subset** of the escaped pile, yet
the client labels it the generic "Escaped". A Killbots player sees "Escaped 3/5"
while other escaped villains that don't count sit in the same pile — the exact
confusion WP-612 removed for bystanders.

---

## Goal

The danger meter names the enemy a converted-escape scheme actually counts —
"Killbots N/5" / "Skrulls N/5" — instead of the generic, colliding "Escaped".

---

## User-Visible Impact

On the Killbots and Secret Invasion schemes, the danger meter reads "Killbots"
or "Skrulls" (the enemies whose escapes actually drive the loss), not "Escaped" —
which mislabeled a subset count and clashed with the raw escaped-villain tally.

---

## Assumes

- `ConvertedVillainOrigin = 'killbot' | 'skrull'` (`packages/game-engine/src/types.ts`);
  both are used by `escaped-converted-count` loss conditions.
- `resolveSchemeLossKind` maps `escaped-converted-count` → `'escaped-converted'` today;
  `SchemeLossKind` + `SCHEME_LOSS_KINDS` carry `'escaped-converted'`.
- `menaceDisplay.ts` maps `'escaped-converted'` → 'Escaped'.
- `SchemeLossKind` is a **projection** label (D-24367 §2) derived from G at
  projection time — not a stored `G` field, so no hash surface.
- `pnpm -r build` 0; engine + arena-client suites green on `9dea4747`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/rules/schemeLossProgress.ts` — `SchemeLossKind` union,
  `SCHEME_LOSS_KINDS` (drift-checked), `resolveSchemeLossKind` (the WP-612 split precedent at `escaped-pile-count`).
- `packages/game-engine/src/types.ts` — `ConvertedVillainOrigin`.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — the two `escaped-converted-count` configs (killbot/skrull).
- `apps/arena-client/src/vfx/menaceDisplay.ts` — `SCHEME_LOSS_NOUNS`.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the origin→kind mapping.

**Packet-specific:**
- **Label fidelity only.** No change to the loss threshold, the counted quantity
  (`countEscapedByConvertedOrigin`), or the projection pipeline — only the *kind*
  the client labels from and the noun.
- **Origin-exhaustive.** The origin→kind map is an explicit `switch` so a future
  `ConvertedVillainOrigin` fails to compile rather than silently mislabelling.
- **Drift pin in lockstep.** `SchemeLossKind` union and `SCHEME_LOSS_KINDS` array
  change together (per `.claude/rules/code-style.md §Drift Detection`); the runtime
  drift test is updated with them.
- **No hash surface.** `SchemeLossKind` is projection-derived, not a stored `G`
  field — no `finalStateHash` / `PRE_WP080_HASH` re-pin.

**Locked values:** `killbot` → `escaped-killbot` → "Killbots"; `skrull` →
`escaped-skrull` → "Skrulls".

---

## Scope (In)

### A) `schemeLossProgress.ts` (**modified**)
- Replace `'escaped-converted'` in the `SchemeLossKind` union + `SCHEME_LOSS_KINDS`
  with `'escaped-killbot'` + `'escaped-skrull'`; add an exhaustive
  `escapedConvertedKind(origin)` helper; `resolveSchemeLossKind` returns it for
  `escaped-converted-count`. Import `ConvertedVillainOrigin`.

### B) `menaceDisplay.ts` (**modified**)
- Replace the `'escaped-converted': 'Escaped'` noun with `'escaped-killbot': 'Killbots'`
  and `'escaped-skrull': 'Skrulls'`.

### C) `schemeLossProgress.test.ts` (**modified**)
- Killbots resolves to `escaped-killbot`; Secret Invasion to `escaped-skrull`; the
  runtime drift array matches the union.

### D) `menaceDisplay.test.ts` (**modified**)
- `escaped-killbot` → "Killbots" (+ a "Killbots 3/5" ratio line); `escaped-skrull` → "Skrulls".

---

## Out of Scope

- **No change to the loss count, threshold, or which cards count** — only the label.
- **No change to the other five kinds' labels** (`hero-deck`, `wound-stack`,
  `escaped-pile`, `escaped-bystander`, `twists`).
- **No projection-pipeline, `G`-field, or hash change; no migration.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/rules/schemeLossProgress.ts` — **modified** — union + array + resolver + helper
- `packages/game-engine/src/rules/schemeLossProgress.test.ts` — **modified** — origin split + drift pin
- `apps/arena-client/src/vfx/menaceDisplay.ts` — **modified** — Killbots/Skrulls nouns
- `apps/arena-client/src/vfx/menaceDisplay.test.ts` — **modified** — label assertions

No other **code** files may be modified. (The `EC-658:` implementation commit
touches exactly these 4; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Truthful danger signal (§24 informative, not manipulative). The meter names the
hero-vs-villain threat accurately (§23b), no PvP framing. Projection-only; no
score or state change.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; the label is a client-side projection read.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `resolveSchemeLossKind` returns `escaped-killbot` for the Killbots scheme and
  `escaped-skrull` for Secret Invasion; the meter labels them "Killbots" / "Skrulls".
- [ ] `SCHEME_LOSS_KINDS` runtime drift pin matches the union (both carry the two
  new members, not `escaped-converted`).
- [ ] The other five labels are unchanged.
- [ ] `pnpm -r build` 0; engine + arena-client suites + `vue-tsc` green; the
  `EC-658:` diff is exactly the 4 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 / all pass (+ the WP-623 origin-split cases)

Select-String -Path "apps\arena-client\src\vfx\menaceDisplay.ts" -Pattern "'escaped-killbot': 'Killbots'"
# Expected: the Killbots noun is present

git diff --name-only
# Expected (implementation commit): only the 4 files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a Killbots / Secret Invasion match's danger meter reads "Killbots N/5" / "Skrulls N/5".
  (Unit tests assert the kind + noun; a live match confirms on the surface.)
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + arena-client suites + `vue-tsc` green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24434 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-623 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (≥2 Out-of-Scope). §2 Constraints — PASS (label fidelity only;
  origin-exhaustive switch; drift pin lockstep; no hash). §3 Assumes — PASS. §4
  Context — PASS (cites the WP-612 precedent + the two configs + the origin type).
  §5 Files — PASS (4 code files). §6 Naming — PASS. §7 Deps — PASS (WP-612/562/513).
  §8 Boundaries — PASS (engine derives the kind; client maps the noun — the D-24367
  §2 boundary). §9 — PASS. §10 — N/A. §11 Persistence — PASS (projection-only).
  §12 Tests — PASS (origin split + drift). §13 — PASS. §14 Acceptance — PASS (4
  binary). §15/§15.1 — PASS (surface + D-24026). §16 — PASS. §17 Vision — PASS.
  §18 Prose-vs-grep — PASS. §19 — N/A. §20 Funding / §21 API — N/A.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main` (`9dea4747`):** `ConvertedVillainOrigin
  = 'killbot' | 'skrull'`; both origins appear in `escaped-converted-count` configs
  (`replace-earths-leaders-with-killbots`, `secret-invasion-...`);
  `resolveSchemeLossKind` returns `'escaped-converted'` today; `SCHEME_LOSS_KINDS`
  is drift-pinned by a runtime `deepStrictEqual`; `menaceDisplay.ts` maps the noun
  via a `Record<SchemeLossKind, string>` (a compile guard for coverage). No collision.
- **PS items (blocking): none.** A union split mirroring the shipped WP-612 pattern.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** This is WP-612 applied to the converted-escape
kind: the meter counts a subset of the escaped pile (one converted origin), so the
generic "Escaped" both mislabels the count and collides with the raw escaped tally.
Splitting the kind by origin (exhaustive switch, drift pin in lockstep) names the
actual enemy without any projection-pipeline or hash change — `SchemeLossKind` is
projection-derived, not a stored `G` field. Session-prompt generation folded into
this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24434 (reserved; Drafted 2026-08-27)** — The danger-meter scheme-loss kind
  for a converted-villain escape scheme is split by origin: `escaped-converted`
  becomes `escaped-killbot` (labelled "Killbots") and `escaped-skrull` (labelled
  "Skrulls"), so the meter names the enemy it actually counts rather than the
  generic "Escaped" that both mislabels the subset count and collides with the raw
  escaped-villain tally — extending WP-612 / D-24423 from bystanders to converted
  villains. `resolveSchemeLossKind` maps `condition.origin` via an exhaustive
  switch; the `SchemeLossKind` union and `SCHEME_LOSS_KINDS` runtime drift pin move
  in lockstep. Projection-only (the kind is derived from `G`, not stored) — no hash
  surface, no `G`-field, no migration.

---

## See Also

- WP-612 / D-24423 (the `escaped-bystander` split this mirrors), WP-562 / D-24367
  (the danger-meter projection + label boundary), WP-513 / D-24325 (converted-villain origins)
