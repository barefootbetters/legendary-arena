# WP-287 — Draw-or-Empowered Choose-One UX (Projection + Client Prompt)

**Status:** Ready to Execute
**Layer:** Game Engine UIState projection (`packages/game-engine/src/ui`) + arena-client (`apps/arena-client`)
**Depends on:** WP-286 (engine) — **co-release locked**, WP-249 (UX precedent) ✅, WP-243 (UX precedent) ✅, WP-128 ✅, WP-061 ✅
**EC:** EC-319
**Decisions:** D-24071
**User-Visible Surface:** play.legendary-arena.com (the player-facing draw-or-empowered choice prompt)

---

## Goal

After this session, when a player plays a card with WP-286's `draw-or-empowered` effect
(One-Hit Wonder), the arena-client renders a **non-dismissible** prompt offering two buttons —
**Draw a card** or **Empowered by {class}** — and End Turn / Pass Priority are disabled until the
choice resolves. The engine projects the pending choice (chooser-only); the client submits
`resolveDrawOrEmpowered({ choice })`. This is the human-facing surface for WP-286, which parks the
choice and resolves it via bot only without this packet.

The empowered button's label is **derived deterministically** in the engine projection from
WP-286's `empoweredClass` via a single class→display mapping (§Locked Contract Values), never an
ad-hoc per-card string.

---

## Session Context

WP-249 built the player-facing surface for the `optional-ko-reward` choice; WP-243 built it for the
KO-a-Hero choice. Both follow one shape: the engine projects the front-of-queue pending choice into
UIState (chooser-only redaction, D-24011), the arena-client renders a non-dismissible prompt, adds
the move to `UiMoveName`, and gates End Turn / Pass Priority via a `hasPending*` boolean. This packet
builds the **identical surface** for WP-286's `draw-or-empowered` choice — reusing those shapes, not
inventing new ones. It is **simpler** than WP-249: the choice is binary (draw vs empowered) with no
eligible-card list to project.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` at the WP-286 SPEC merge
> (`7d4600a6`, PR #454) alongside WP-286. Supersession check returned no collision. D-24069/D-24070
> reserved by WP-286; this packet reserves **D-24071**.

- **WP-286 (engine).** Co-release locked. Provides `G.pendingDrawOrEmpowered` FIFO +
  `PendingDrawOrEmpowered { playerID, empoweredClass }` + `resolveDrawOrEmpowered({ choice })` +
  `hasPendingDrawOrEmpowered`. This UX packet **does not change engine gameplay**. WP-286 is currently
  DRAFTED on `main` (SPEC bundle) and not yet executed; the two execute and deploy together (below).
- **WP-249 + WP-243 complete** (the structural templates). The reuse surface, verified live:
  - `packages/game-engine/src/ui/uiState.types.ts` — `UIPendingOptionalKoReward` /
    `UIPendingKoHeroChoice` + their optional `pending*` fields on the projected UIState.
  - `packages/game-engine/src/ui/uiState.build.ts` — front-of-queue projection blocks (§13b/§13c).
  - `packages/game-engine/src/ui/uiState.filter.ts` — chooser-only redaction keyed on `.playerID`.
  - `packages/game-engine/src/index.ts` — barrels `UIPendingKoHeroChoice` + `UIPendingOptionalKoReward`.
  - `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — the non-dismissible prompt
    precedent (the component to mirror).
  - `apps/arena-client/src/components/play/uiMoveName.types.ts` — `UiMoveName` union (a type-only
    union ending at `'resolveOptionalKoReward'`; append, no runtime drift-count assertion).
  - `apps/arena-client/src/composables/useTurnActions.ts` — `hasPendingChoice` / `hasPendingKoChoice`
    / `hasPendingOptionalKoReward` boolean params gating `canEndTurn` / `canPassPriority`.
  - `apps/arena-client/src/components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue`,
    `pages/PlayMobile.vue`.
- arena-client `typecheck` (vue-tsc) + `test` green; engine `test` green.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

1. `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — engine UIState is the Runtime-Safe
   surface arena-client consumes; the client submits **intent** (the move), never outcomes;
   redaction lives in the engine filter, not the client.
2. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`
3. `docs/ai/REFERENCE/00.6-code-style.md`
4. The WP-249 files in §Assumes — **read each and mirror its shape** for the `draw-or-empowered`
   analog. Do not invent a new projection / redaction / prompt pattern.
5. `packages/game-engine/src/ui/uiState.filter.ts` — the D-24011 chooser-only redaction.
6. `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — the prompt UX precedent.
7. `docs/ai/DECISIONS.md` — D-24069 + D-24070 (WP-286), D-24011 (chooser-only redaction),
   D-24020 (WP-249 UX precedent), D-24071 (this packet)

---

## Non-Negotiable Constraints

### Engine-wide (projection half)
- Full file contents — no diffs, no snippets. ESM only, Node v22+.
- No `Math.random()` in the projection; UIState stays JSON-serializable; projections are pure over
  `G` (no mutation; spread-copy any mutable `G` arrays per the WP-028 aliasing precedent).
- The projection recomputes from current `G` (no snapshot), mirroring WP-249.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (named imports, no `.reduce()` in
  projection/redaction logic, JSDoc, `// why:` on non-obvious decisions) — both halves.

### Client half
- Vue SFC; `vue-tsc` clean; tests via the arena-client harness; **no `boardgame.io` import** in
  components (the transport handles moves).
- The prompt is **non-dismissible** while the choice is pending (mirrors `OptionalKoRewardPrompt`);
  the only exits are pressing **Draw a card** or **Empowered by {class}**.

### Packet-specific
- **No engine gameplay change.** This packet only PROJECTS WP-286's existing state and SUBMITS the
  existing move. It must not add/alter any move, rule, or `G` mutation. (`git diff` shows engine
  changes ONLY in the `ui/` projection files + their tests + the `index.ts` type-only re-export.)
- **Chooser-only redaction (HARD, D-24011 analog).** `pendingDrawOrEmpowered` is visible ONLY to the
  choosing player; redacted for every other player and spectators — keyed on
  `pendingDrawOrEmpowered.playerID` vs `audience.playerId`, exactly as the KO-hero / optional-ko
  redactions are keyed.
- **Move-union addition.** `'resolveDrawOrEmpowered'` appended to the `UiMoveName` union.
- **Turn-action gating.** While a `pendingDrawOrEmpowered` exists for the active player, End Turn +
  Pass Priority are disabled (a parallel `hasPendingDrawOrEmpowered` boolean param on
  `useTurnActions`, mirroring `hasPendingOptionalKoReward`).
- **At most one pending prompt (relies on WP-286's block-all guard).** The engine guarantees at most
  one pending choice is non-empty at a time, so the client never arbitrates between simultaneous
  prompts — render exactly the one projected pending choice. Do NOT add client-side precedence logic.
- **Empowered-label derivation (LOCKED).** `empoweredLabel` is computed ONCE in `uiState.build.ts` by
  a single deterministic class→display mapping over WP-286's `empoweredClass` (e.g. `strength` →
  "Empowered by Strength"). Never an ad-hoc or per-card string. An unrecognized class → a safe
  generic fallback ("Empowered"), never a crash.
- **Both layouts.** Mount the prompt in `PlayDesktop.vue` AND `PlayMobile.vue`, gated on the
  projected pending choice.
- **Optional UIState field → no fixture backfill needed.** `pendingDrawOrEmpowered?` is OPTIONAL on
  the projected UIState, so existing arena-client UIState fixtures typecheck unchanged (the WP-249
  Amendment-A path; not the required-field WP-166/207/227 backfill case). Confirm `vue-tsc` is green
  WITHOUT fixture edits; if a fixture breaks, STOP and reconcile rather than widen scope.
- **Barrel re-export.** `UIPendingDrawOrEmpowered` MUST be re-exported from
  `packages/game-engine/src/index.ts` so the arena-client `import type` resolves (the D-16502 /
  WP-166 barrel-publish recurrence — listed in the allowlist up front, not a mid-execution amendment).

### Session protocol
- If any file in `## Files Expected to Change` does not exist as expected, STOP and report.
- After implementation, run engine `test` + arena-client `test` + arena-client `typecheck` and
  confirm green before reporting done.

### Locked Contract Values
- Projection type: `UIPendingDrawOrEmpowered` (in `ui/uiState.types.ts`) — front entry:
  `{ playerID: string; empoweredLabel: string }`. **`playerID` is REQUIRED** — `uiState.filter.ts`
  keys the chooser-only redaction on it.
- Projected field: `pendingDrawOrEmpowered?: UIPendingDrawOrEmpowered` (optional) on the projected UIState.
- Empowered-label mapping (default copy, single mapping): `strength` → "Empowered by Strength";
  `instinct` → "Empowered by Instinct"; `covert` → "Empowered by Covert"; `tech` → "Empowered by
  Tech"; `ranged` → "Empowered by Ranged"; unrecognized → "Empowered".
- Draw-button label (component constant): "Draw a card".
- Move name: `'resolveDrawOrEmpowered'` added to `UiMoveName`.
- Move args submitted: `{ choice: 'draw' }` or `{ choice: 'empowered' }`.
- Component: `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.vue`.
- Gating param: `hasPendingDrawOrEmpowered` on `useTurnActions`.

---

## Scope (In)

- **A)** `ui/uiState.types.ts` — add `UIPendingDrawOrEmpowered` + the optional
  `pendingDrawOrEmpowered?` field on the projected UIState.
- **B)** `ui/uiState.build.ts` — project the front `pendingDrawOrEmpowered`: `playerID` + the derived
  `empoweredLabel` (single class→display mapping). Recomputed fresh from `G`.
- **C)** `ui/uiState.filter.ts` — redact `pendingDrawOrEmpowered` for everyone except the chooser
  (keyed on `.playerID`, D-24011 analog).
- **D)** `index.ts` — re-export `UIPendingDrawOrEmpowered` from the engine barrel.
- **E)** `components/play/DrawOrEmpoweredPrompt.vue` — **new**: non-dismissible prompt with two
  buttons ("Draw a card" / `empoweredLabel`); submits `resolveDrawOrEmpowered({ choice: 'draw' })` or
  `({ choice: 'empowered' })`; disables its controls after a submit (no double-submit).
- **F)** `components/play/uiMoveName.types.ts` — append `'resolveDrawOrEmpowered'` to `UiMoveName`.
- **G)** `composables/useTurnActions.ts` — add `hasPendingDrawOrEmpowered` boolean param gating End
  Turn / Pass Priority (mirror `hasPendingOptionalKoReward`).
- **H)** `components/play/TurnActionBar.vue` — disable End Turn / Pass Priority while pending.
- **I)** `pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — mount `DrawOrEmpoweredPrompt`, gated on
  the projected pending choice.
- **J)** Tests: `ui/uiState.build.test.ts` + `ui/uiState.filter.test.ts` (projection populated for
  chooser incl. derived `empoweredLabel`; redacted for non-choosers); `DrawOrEmpoweredPrompt.test.ts`
  (renders both buttons; each submits the right `{ choice }`; non-dismissible; no double-submit);
  `useTurnActions.test.ts` (End Turn disabled while pending).

## Out of Scope

- **Engine gameplay** (the move, state, park, guards, bot) — that is WP-286. This packet is
  projection + client only.
- **A numeric empowered preview ("+N Attack").** The prompt shows the class label only; computing the
  live count in the projection is deferred (would couple the projection to the effect evaluator).
- **WP-285's victory-pile picker UX** — a separate deferred UX (its `resolveVictoryPileCardPick`
  is also absent from `UiMoveName`); not in scope here.
- **Any registry, server, or preplan change.**

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified**
- `packages/game-engine/src/index.ts` — **modified** (barrel re-export of `UIPendingDrawOrEmpowered`)
- `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.vue` — **new**
- `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.test.ts` — **new**
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified**
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified** (gating test)
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified**
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified**
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (D-24071 Reserved → Active)
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-287 `[x]`)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (EC-319 → Done)

**Total: ~18 files** (14 source/test + 4 governance). The `index.ts` barrel re-export and the
`useTurnActions.test.ts` gating test are in the allowlist **up front** (they are the WP-166 /
WP-249-Amendment-A recurrences that otherwise become mid-execution amendments).

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE. Any single FALSE = STOP.**

- **AC-1:** `UIPendingDrawOrEmpowered` projected for the **chooser**: carries `playerID` (the
  redaction key) + an `empoweredLabel` derived by the single deterministic class→display mapping
  (§Locked Contract Values — no ad-hoc/per-card strings); the field is absent when no choice pends.
- **AC-2:** The projection is **redacted** for non-choosers and spectators — proven by a filter test
  (a non-chooser UIState has no `pendingDrawOrEmpowered`).
- **AC-3:** `UIPendingDrawOrEmpowered` is re-exported from `packages/game-engine/src/index.ts`.
- **AC-4:** `'resolveDrawOrEmpowered'` is in the `UiMoveName` union.
- **AC-5:** `DrawOrEmpoweredPrompt.vue` renders exactly two buttons — "Draw a card" and the projected
  `empoweredLabel`; the first submits `resolveDrawOrEmpowered({ choice: 'draw' })`, the second
  `({ choice: 'empowered' })`; the prompt is non-dismissible while pending and disables its controls
  after a submit (no double-submit).
- **AC-6:** End Turn + Pass Priority are disabled while a `pendingDrawOrEmpowered` exists (gating
  test asserts it).
- **AC-7:** The prompt is mounted in BOTH `PlayDesktop.vue` and `PlayMobile.vue`.
- **AC-8:** **No engine gameplay change** — `git diff` shows engine changes ONLY in the `ui/`
  projection files (+ their tests) and the `index.ts` type-only re-export; no move/rule/`G`-mutation
  file touched.
- **AC-9:** engine `test` + arena-client `test` + arena-client `typecheck` (vue-tsc) exit 0;
  net-new projection/redaction/component/gating cases; no regress; `JSON.stringify(UIState)` succeeds;
  existing UIState fixtures typecheck UNCHANGED (optional field — no backfill).
- **AC-10:** `git diff --name-only` lists exactly the `## Files Expected to Change` set.

---

## Verification Steps

```pwsh
# Baselines (record; AC deltas are relative)
pnpm --filter @legendary-arena/game-engine test       # exits 0; record ENGINE_BASELINE
pnpm --filter @legendary-arena/arena-client test      # exits 0; record CLIENT_BASELINE

# After projection + client changes:
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test       # ≥ ENGINE_BASELINE + projection/redaction cases
pnpm --filter @legendary-arena/arena-client test      # ≥ CLIENT_BASELINE + component/gating cases
pnpm --filter @legendary-arena/arena-client typecheck # exits 0 (no fixture backfill — optional field)

# No-engine-gameplay gate: engine diff limited to the ui/ files + tests + index.ts
git diff --name-only -- packages/game-engine
# Expected: ONLY ui/uiState.types.ts, ui/uiState.build.ts, ui/uiState.filter.ts,
# ui/uiState.build.test.ts, ui/uiState.filter.test.ts, index.ts

# Move-union addition
#   grep resolveDrawOrEmpowered in uiMoveName.types.ts — expected ≥1

# Scope lock + serializable
git diff --name-only        # exactly the ~18 files in §Files Expected to Change
pnpm -r build               # exits 0
```

---

## Vision Alignment

**Touched surfaces (§17.1):** Card data / content semantics (Vision §1, §2) — the player receives the
choice the printed card grants.

**Clause check:** §1 (faithful to the physical game): One-Hit Wonder offers a choice; this packet is
the surface that lets a human make it. §2 (card-accurate execution): no conflict.

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

**Non-Goal proximity:** No NG-1..7 crossed — a gameplay-fidelity UX, not a paid/competitive/persuasive
surface.

**Determinism preservation:** N/A for gameplay — the projection is a pure read over `G`; it adds no
randomness and mutates nothing. The authoritative resolution is WP-286's deterministic move.

---

## Funding Surface Gate

**N/A** — gameplay-fidelity UX; no funding affordance, copy, or channel; none of the §20.1 trigger
surfaces are present.

## §21 API Catalog

**N/A** — engine UIState projection + arena-client only; no `apps/server` HTTP endpoint or
`Library-only` function added or modified.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All required sections present |
| §2 Constraints | ✅ PASS | Projection-half + client-half + packet-specific + locked values; cites 00.6 |
| §3 Assumes | ✅ PASS | WP-286 (co-release), WP-249/243/128/061; reuse surface enumerated |
| §4 Context | ✅ PASS | ARCHITECTURE §Layer Boundary, the WP-249 files to mirror, DECISIONS |
| §5 Files | ✅ PASS | ~18 files listed; index.ts + useTurnActions.test.ts in allowlist up front |
| §6 Naming | ✅ PASS | Canonical names; `UiMoveName`, `UIPendingDrawOrEmpowered` consistent |
| §7 Dependencies | ✅ PASS | No new npm deps; reuses WP-249 UX shapes |
| §8 Boundaries | ✅ PASS | Engine UIState projection + arena-client only; NO engine gameplay change |
| §9 Windows | ✅ PASS | `pwsh` verification steps |
| §10 Env Vars | ✅ PASS | None touched |
| §11 Auth | N/A | Privacy redaction is a projection concern, not an auth surface |
| §12 Tests | ✅ PASS | `node:test` (projection) + arena-client harness (component); vue-tsc gate |
| §13 Verification | ✅ PASS | Exact commands; no-engine-gameplay diff gate; vue-tsc gate |
| §14 AC Quality | ✅ PASS | 10 binary, observable items |
| §15 DoD | ✅ PASS | engine + arena-client test + typecheck; STATUS/DECISIONS/WORK_INDEX/EC_INDEX; live-verify (D-24026) |
| §16 Code Style | ✅ PASS | `// why:` on type/projection/filter/component/gating; named imports |
| §17 Vision | ✅ PASS | Triggered (card behavior); §1, §2 cited; no conflict |
| §18 Grep/Prose | ✅ PASS | Move-union grep targets a source file; redaction proven by a filter test |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification |
| §21 API Catalog | ✅ PASS | N/A with justification |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ WP-249 + WP-243 UX reuse surface verified live (uiState.types/build/filter, OptionalKoRewardPrompt,
  uiMoveName.types ending at `resolveOptionalKoReward`, useTurnActions boolean-param gating,
  TurnActionBar, PlayDesktop/PlayMobile)
- ✅ `index.ts` barrels `UIPendingKoHeroChoice` + `UIPendingOptionalKoReward` (the publish point for
  `UIPendingDrawOrEmpowered`)
- ✅ WP-286 (engine) provides `PendingDrawOrEmpowered { playerID, empoweredClass }` +
  `resolveDrawOrEmpowered({ choice })` + `hasPendingDrawOrEmpowered` — co-release locked
- ✅ Scope locked: 14 source/test + 4 governance; no engine gameplay change (engine diff = ui/ +
  index.ts type-only)
- ✅ Optional UIState field → no fixture backfill (WP-249 Amendment-A path; vue-tsc stays green)
- ✅ Ambiguity resolved: binary choice (no eligible-card list); single empowered-label mapping;
  chooser-only redaction

---

## Copilot Check Verdict

**PASS**

Direct structural mirror of WP-249 (front-of-queue projection, chooser-only redaction, non-dismissible
prompt, move-union add, turn-action gating, both layouts) — simpler (binary choice, no eligible list).
The three locked risks: chooser-only redaction (filter test), the barrel re-export (in the allowlist
up front), and the no-engine-gameplay diff gate. Co-release lock with WP-286 is the load-bearing
deploy constraint. No RISK/BLOCK.

---

## Definition of Done

- [ ] All 10 Acceptance Criteria pass
- [ ] engine `test` + arena-client `test` + arena-client `typecheck` (vue-tsc) exit 0
- [ ] `pnpm -r build` exits 0
- [ ] `docs/ai/STATUS.md` updated with the WP-287 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24071 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-287 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-319 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-287 node added under the correct subsystem cluster
- [ ] No files outside `## Files Expected to Change` modified
- [ ] **Co-released with WP-286** — not merged as a dangling UX without the engine; both execute and
      deploy together (Render auto-deploys on `main` push)
- [ ] **User-Visible Surface: play.legendary-arena.com** — D-24026 live-verification: in a real match,
      playing One-Hit Wonder shows the two-button prompt; choosing "Draw a card" draws one and choosing
      "Empowered by Strength" grants the attack; End Turn is blocked until resolved. (Inherently
      post-co-deploy of WP-286 + WP-287.)
