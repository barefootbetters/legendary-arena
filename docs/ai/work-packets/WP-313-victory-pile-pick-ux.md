# WP-313 — Victory-Pile Villain-Pick UX (Projection + Client Prompt)

**Status:** Ready
**Primary Layer:** Game Engine UIState (projection) + Client (arena-client prompt) — co-release
**Dependencies:** WP-285 (engine `victory-villain-attack` park + `resolveVictoryPileCardPick` move + `hasPendingVictoryPileCardPick` + `getEligibleVictoryVillains`, all ✅) · WP-289 (simulation resolve-move dispatch ✅) · WP-287 / EC-319 (the draw-or-empowered UX — the near-identical precedent this mirrors) · WP-249 (optional-KO-reward UX — the eligible-list precedent).
**User-Visible Surface:** play.legendary-arena.com — playing `antm/black-knight/the-ebony-blade` (or any `victory-villain-attack` card) no longer **hard-freezes** the match.

> **This closes a guaranteed live freeze.** WP-285 shipped the engine half of `victory-villain-attack`: playing The Ebony Blade with ≥1 villain in the victory pile parks `G.pendingVictoryPileCardPick`, and a **block-all guard in every move** rejects all actions except `resolveVictoryPileCardPick` until the player picks a villain. But that pending choice was **never projected into UIState** and the arena-client has **no prompt and no move wiring** for it — so the player can neither see nor resolve the pick, and every click (including End Turn) is rejected → hard freeze. Confirmed 2026-07-05 (match `D0_OMZnnUWQ`, turn 22, gitSha `36bf9a8`). WP-285's two sibling pending-choices — optional-KO-reward (WP-249) and draw-or-empowered (WP-287) — both got the projection + prompt; victory-pile-pick was left engine-only.

---

## Session Context

boardgame.io interactive resolve-moves in this engine follow a fixed pattern: an `onPlay` effect parks a pending choice on a `G.pending*[]` FIFO queue; a **block-all guard** in every action move gates the turn until it is resolved; the engine **projects the front-of-queue entry into UIState** (chooser-redacted) with the freshly-computed eligible targets; the arena-client renders a prompt and submits the resolve-move. WP-285 built the engine + simulation side of `victory-villain-attack` but **omitted the UIState projection and the client prompt** — the two remaining steps. This packet adds exactly those, mirroring WP-287 (draw-or-empowered) for the projection/prompt shape and WP-249 (optional-KO-reward) for the eligible-target-list shape.

---

## Goal

After this session:

- `buildUIState` projects a `pendingVictoryPileCardPick?: UIPendingVictoryPileCardPick` field — the FRONT entry of `G.pendingVictoryPileCardPick`, **chooser-redacted** (present only for the chooser's audience), carrying the **eligible villains** (each with its `CardExtId`, display data, and the attack value = the villain's printed `fightCost`). Absent (`undefined`) when there is no pending pick. The type is re-exported from `packages/game-engine/src/index.ts`.
- The arena-client renders a **"Choose a Villain from your Victory Pile"** prompt when `pendingVictoryPileCardPick` is present, listing the eligible villains + their attack values; picking one submits `resolveVictoryPileCardPick({ cardId })`. `resolveVictoryPileCardPick` is added to `UiMoveName`, and End Turn / other turn actions are gated on `hasPendingVictoryPileCardPick` (via the new UIState field) so the UI mirrors the engine's block-all.
- The prompt is mounted in `PlayDesktop` + `PlayMobile` (the WP-287 mount sites).

No engine gameplay change — the projection is a read-only `ui/` addition; the move, the park, the block-all guards, and the attack math are unchanged.

---

## User-Visible Impact

A player who plays The Ebony Blade with villains in their victory pile now sees a prompt to pick which villain's printed Attack to claim, picks it, gains the Attack, and continues their turn — instead of the board silently rejecting every action forever. Combined with WP-309's durable store (which would otherwise persist the frozen state across reloads), this is the difference between a strong rare being playable and a match-ending trap.

---

## Assumes

- WP-285 complete on `main`: `hasPendingVictoryPileCardPick(G)`, `getEligibleVictoryVillains(G, playerID)`, the `resolveVictoryPileCardPick({ cardId })` move (registered `client: false` in `game.ts`), the block-all guards, and `PendingVictoryPileCardPick { playerID, rewardType: 'attack' }` all exist. (Verified.)
- The villain's printed attack is stored as `G.cardStats[cardId].fightCost` (per the resolve move); card display data is available via `G.cardDisplayData` / the existing UIState card-display resolution used by sibling projections.
- UIState pending-choice projections are **optional** fields (absent when no pending choice), so adding one needs **no** arena-client fixture backfill (unlike a required-field add).
- `apps/arena-client` `test` + `typecheck` (vue-tsc) and `packages/game-engine` `test` + `build` are green on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/ui/uiState.build.ts` — the `pendingOptionalKoReward` (WP-249) + `pendingDrawOrEmpowered` (WP-287) projection blocks + the chooser-redaction pattern; the new projection mirrors them.
- `packages/game-engine/src/ui/uiState.types.ts` — `UIPendingOptionalKoReward` / `UIPendingDrawOrEmpowered` (the type shape to mirror; the eligible-list shape comes from optional-KO-reward).
- `packages/game-engine/src/moves/resolveVictoryPileCardPick.ts` — `getEligibleVictoryVillains` + the fightCost-as-attack read; the projection reuses these (no re-derivation).
- `packages/game-engine/src/index.ts` — re-export the new `UIPendingVictoryPileCardPick` type (client-imported).
- `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.vue` + `.test.ts` — the prompt precedent; the victory-pile prompt is a list-pick variant (closer to the WP-249 optional-KO-reward prompt if one exists).
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — add `'resolveVictoryPileCardPick'`.
- `apps/arena-client/src/composables/useTurnActions.ts` — the End-Turn / Pass gating; add a `hasPendingVictoryPileCardPick`-style block mirroring `hasPendingDrawOrEmpowered`.
- `apps/arena-client/src/components/play/TurnActionBar.vue`, `src/pages/PlayDesktop.vue`, `src/pages/PlayMobile.vue` — the mount + gating sites (WP-287 precedent).

---

## Non-Negotiable Constraints

**Engine (UIState `ui/` layer):**
- The projection is **read-only** — it reads `G` and derives the UI shape; it never mutates `G`, the queue, or the economy. No new move, no change to the park/guard/resolve logic or the attack math.
- **Chooser-redaction**: the field is present ONLY for the chooser's audience (keyed on the pending entry's `playerID`), mirroring `pendingDrawOrEmpowered` / `pendingOptionalKoReward`. Absent for every other audience.
- Eligible villains are recomputed via the existing `getEligibleVictoryVillains` (authoritative at projection time), not snapshotted or re-implemented. Attack value = the villain's `fightCost` (the printed attack), read the same way the resolve move reads it.
- The field is **optional** (`?:`) so no fixture backfill is required; re-export the new type from `index.ts`.
- No `.reduce()` in the projection loop; `for...of`. No `boardgame.io` import in a pure helper. Determinism unchanged (projection is pure over `G`).

**Client (arena-client):**
- The client stays a read-only consumer: the prompt renders the projected eligible list and submits intent (`resolveVictoryPileCardPick({ cardId })`) — it never computes the attack or filters authoritatively.
- The prompt is **non-dismissible** while a pick is pending (mirrors the block-all), and End Turn / Pass are disabled via `hasPendingVictoryPileCardPick` so the UI cannot desync from the engine's guard.
- `.test.ts` tests; vue-tsc must stay green.

**Session protocol:**
- If the villain's printed attack is NOT reliably readable at projection time (e.g., `cardStats` unavailable in the `ui/` layer), STOP and confirm the read path against the resolve move before inventing one.

---

## Scope (In)

### A) Engine UIState projection
- **`packages/game-engine/src/ui/uiState.types.ts`** — new `UIPendingVictoryPileCardPick { playerID: string; eligibleVillains: UIVictoryPileVillainChoice[] }` (each choice = `{ cardId, display, attackValue }`); add the optional `pendingVictoryPileCardPick?: UIPendingVictoryPileCardPick` field to the UIState.
- **`packages/game-engine/src/ui/uiState.build.ts`** — project the FRONT entry of `G.pendingVictoryPileCardPick` when non-empty, chooser-redacted, with `getEligibleVictoryVillains` → each villain's display + `fightCost` attack value.
- **`packages/game-engine/src/index.ts`** — re-export `UIPendingVictoryPileCardPick` (+ the choice type).

### B) Arena-client prompt + gating
- **`apps/arena-client/src/components/play/VictoryPileCardPickPrompt.vue`** — new: renders the eligible villains (name/image + "+N Attack"), non-dismissible; clicking one calls `submitMove('resolveVictoryPileCardPick', { cardId })`.
- **`apps/arena-client/src/components/play/uiMoveName.types.ts`** — add `'resolveVictoryPileCardPick'`.
- **`apps/arena-client/src/composables/useTurnActions.ts`** — gate End Turn / Pass on a `hasPendingVictoryPileCardPick` derived from the new UIState field (mirror `hasPendingDrawOrEmpowered`).
- **`apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue`** (+ `TurnActionBar.vue` if that is the gating host) — mount the prompt + wire the gate (the WP-287 sites).

### C) Tests
- Engine: `uiState.build.test.ts` — the projection present when a pick is pending (chooser audience) with the correct eligible list + attack values; absent for non-chooser audiences; absent when no pick pending.
- Client: `VictoryPileCardPickPrompt.test.ts` — renders the eligible list, click submits `resolveVictoryPileCardPick({cardId})`; `useTurnActions.test.ts` — End Turn disabled while pending.

---

## Out of Scope

- **No engine gameplay change** — the park, block-all guards, `resolveVictoryPileCardPick` logic, and attack math are unchanged (WP-285 owns them).
- **No new `victory-villain-attack` cards** — this is UX for the existing one (The Ebony Blade).
- **No diagnostic-export change** — surfacing pending choices on the freeze diagnostic is WP-314 (separate).
- **No new npm dependency.**

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — new UI type + optional field.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — projection.
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — projection tests.
- `packages/game-engine/src/index.ts` — **modified** — re-export the new type.
- `apps/arena-client/src/components/play/VictoryPileCardPickPrompt.vue` — **new** — prompt.
- `apps/arena-client/src/components/play/VictoryPileCardPickPrompt.test.ts` — **new** — prompt tests.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — add the move name.
- `apps/arena-client/src/composables/useTurnActions.ts` (+ `.test.ts`) — **modified** — End-Turn gate.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` (+ `TurnActionBar.vue` if the gating host) — **modified** — mount + gate.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24099), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] `buildUIState` projects `pendingVictoryPileCardPick` (front entry, chooser-redacted) with the eligible villains + their `fightCost` attack values; absent for non-choosers and when no pick pends.
- [ ] `UIPendingVictoryPileCardPick` is re-exported from `packages/game-engine/src/index.ts`.
- [ ] The arena-client renders the pick prompt when the field is present; clicking a villain submits `resolveVictoryPileCardPick({ cardId })`.
- [ ] End Turn / Pass are disabled while `pendingVictoryPileCardPick` is present (UI mirrors the engine block-all).
- [ ] `resolveVictoryPileCardPick` is in `UiMoveName`.
- [ ] Engine `build` + `test` and arena-client `test` + `typecheck` (vue-tsc) pass; `pnpm -r build` 0.
- [ ] No engine gameplay/move/guard change (`git diff` limited to `ui/` + `index.ts` on the engine side).
- [ ] `docs/ai/DECISIONS.md` D-24099 landed.
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build ; pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client typecheck ; pnpm --filter @legendary-arena/arena-client test
# engine diff is ui/ + index.ts only (no move/guard change)
git diff --name-only packages/game-engine | Select-String "moves/|game.ts|rules/"
# Expected: no output
Select-String -Path "apps\arena-client\src\components\play\uiMoveName.types.ts" -Pattern "resolveVictoryPileCardPick"
git diff --name-only
```

---

## Definition of Done

- [ ] **Live-on-surface (D-24026):** confirmed live — play The Ebony Blade with a villain in the victory pile, see the pick prompt, pick a villain, gain the Attack, and continue the turn (no freeze). Evidence + deploy SHA.
- [ ] All acceptance criteria pass; engine + client suites + `pnpm -r build` green.
- [ ] No engine gameplay change (`git diff`).
- [ ] STATUS.md / DECISIONS.md (D-24099) / WORK_INDEX.md / EC_INDEX.md updated.

---

## Vision Alignment

> §17 triggered: interactive resolution / player choice (Vision §3, §4); card fidelity (§1, §2).

- **Vision clauses touched:** §1/§2 (a printed card effect becomes playable), §3 (Trust & Fairness — the player makes the choice the card grants; the system never picks for them), §4 (multiplayer interactive resolution), §11 (read-only client). No monetization/scoring clause.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The engine already owns the choice + attack math; this only makes the choice visible + submittable. The client stays read-only; determinism (Vision §22) is untouched (a read-only projection + an existing move).
- **Non-Goal proximity:** none of NG-1..7 crossed.
- **Determinism preservation:** the projection is pure over `G`; no `G`/move/RNG change; `finalStateHash` unaffected (no gameplay-state mutation).

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. Verdict: **PASS.**

- **§1 Structure / §2 Constraints / §3 Assumes / §4 Context / §5 Files** — PASS. All sections present; ≥2 out-of-scope exclusions (no gameplay change; no diagnostic change); engine `ui/`-only + client, co-release; WP-249/287 precedents + the exact engine symbols cited.
- **§6 Naming** — PASS. `UIPendingVictoryPileCardPick`, `resolveVictoryPileCardPick`, `hasPendingVictoryPileCardPick`, `getEligibleVictoryVillains` match the engine; no 00.2 field touched.
- **§7 Dependency / §8 Boundaries** — PASS. No new dep; engine change confined to the read-only `ui/` projection + `index.ts` re-export (no move/guard/registry edit); client read-only; optional field → no fixture backfill.
- **§9 Windows / §13 Verification** — PASS. `pwsh` + `Select-String` + `pnpm --filter`, expected output inline.
- **§10 Env / §11 Auth / §20 Funding / §21 API Catalog** — N/A (no env/auth/funding/HTTP surface).
- **§12 Tests** — PASS. Engine projection + client prompt + End-Turn-gate tests via the existing harnesses.
- **§14 AC / §15 DoD** — PASS. Binary, symbol-specific; §15.1 `User-Visible Surface = play.legendary-arena.com` with a live-on-surface verify (play the card, no freeze) not test-satisfiable (D-24026).
- **§16 Code style** — PASS. Small projection helper, JSDoc, `// why:` on the redaction + attack read, `for...of` (no `.reduce()`), no premature abstraction.
- **§17 Vision** — PASS. Block present; §1/§2/§3/§4/§11/§22 cited; no-conflict + determinism line.
- **§18 Prose-vs-grep** — PASS. Greps target `moves/|game.ts|rules/` (engine no-change) + the move name; no forbidden-token prose without a cite.
- **§19 Bridge-vs-HEAD** — N/A at lint.
