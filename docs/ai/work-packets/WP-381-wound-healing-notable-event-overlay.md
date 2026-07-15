# WP-381 — Wound "Healing" Notable-Event Overlay (healResolved center-screen announcement)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (notableEvent emission) + arena-client (overlay label)
**Dependencies:** WP-379 (the `healWounds` move + its `G.messages` log line), WP-380 (the Heal Wounds button — now live-verified in play), WP-200 (the `G.notableEvents` discriminated union + `UIState.notableEvents` projection + `NotableEventOverlay`)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `80ba5847` (WP-380 client affordance).

---

## Session Context

WP-379 shipped the engine `healWounds` move (which appends a `G.messages` log line but **deliberately no `notableEvent`** — "a client concern for the follow-up WP") and WP-380 shipped the Heal Wounds button, now **live-verified** in a real match (a Red Skull game on 2026-07-15, `gitSha 80ba584`: Player 0 healed on turns 16 / 24 / 32, each KO'ing 1–2 Wounds with no fight or recruit that turn). WP-200 (D-20008) established the `G.notableEvents` discriminated union, its verbatim projection through `UIState.notableEvents`, and the client `NotableEventOverlay` that renders a chip label + engine-composed narrative for each variant (`fightResolved`, `mastermindDefeated`, …). This packet is the deferred cosmetic follow-up: it adds a sixth notableEvent variant, `healResolved`, so a heal produces a center-screen overlay ("Healed 2 Wounds") like every other notable action — closing the WP-379 §Out-of-Scope deferral.

---

## Goal

After this session, when a player uses the Wound Healing ability, `healWounds` appends a `healResolved` `NotableGameEvent` to `G.notableEvents` carrying the player and the number of Wounds KO'd, and the arena-client's `NotableEventOverlay` renders it as a **"Healed"** chip + the engine-composed narrative (e.g. *"Used Healing, KO'ing 2 Wound(s) from hand."*). The event projects through the existing `UIState.notableEvents` surface (no new projection) and is public — every client sees it, exactly like `fightResolved`. No engine gameplay changes; no competitive-hash re-pin (no heal fires in any recorded fixture).

---

## User-Visible Impact

When a player clicks Heal Wounds, in addition to the existing game-log line they (and every other player watching) now see the **same center-screen overlay treatment** the game already gives fights, ambushes, scheme twists, Master Strikes, and mastermind defeats — a "Healed" chip and a one-sentence description of how many Wounds were removed. Today a heal is the only notable turn action that produces no overlay.

---

## Assumes

- WP-379 complete: `packages/game-engine/src/moves/healWounds.ts` exports `healWounds`, mutates `G` (KOs Wounds, sets `G.hasHealedThisTurn`, pushes a `G.messages` line) and knows the KO'd Wound count locally.
- WP-200 complete. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines `NotableGameEventType`, the `NOTABLE_EVENT_TYPES` readonly array, the per-variant interfaces, and the `NotableGameEvent` union.
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports the per-variant narrative composers (e.g. `composeMastermindDefeatedNarrative`).
  - `G.notableEvents: NotableGameEvent[]` is initialized in `buildInitialGameState` and projected verbatim through `UIState.notableEvents` (spread, public, per `uiState.build.ts` / `uiState.filter.ts`).
  - `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders `event.narrative` verbatim (D-20002) plus a `CHIP_LABELS[event.type]` chip.
- `packages/game-engine/src/events/notableEvents.types.test.ts` pins `NOTABLE_EVENT_TYPES`.
- `pnpm -r build` exits 0; engine + arena-client suites + `arena-client typecheck` pass on `80ba5847`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/events/notableEvents.types.ts` — read the `NotableGameEventType` union, `NOTABLE_EVENT_TYPES` array, the `MastermindDefeatedEvent` interface (the closest template — `type` + `playerId` + one count + `narrative`), and the `NotableGameEvent` union. `healResolved` is added to all four.
- `packages/game-engine/src/events/notableEvents.compose.ts` — read `composeMastermindDefeatedNarrative` (the composer pattern: pure, returns a single English sentence). `composeHealNarrative` mirrors it.
- `packages/game-engine/src/moves/healWounds.ts` — read the Step-3 mutation tail (`G.hasHealedThisTurn = true;` + `pushLog(...)`). The emission goes **last**, after the log push, observing settled state (the `fightVillain` precedent: emit as the final step).
- `packages/game-engine/src/moves/fightVillain.ts` — read the `G.notableEvents.push({ type: 'fightResolved', … })` site as the emission idiom (unconditional push; setup guarantees the array).
- `packages/game-engine/src/events/notableEvents.types.test.ts` — the `NOTABLE_EVENT_TYPES` drift pin (bidirectional + length); add `'healResolved'` to the pinned expected array.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — the golden-narrative test pattern; add a `composeHealNarrative` case.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the `CHIP_LABELS` map (string-keyed `Record<string, string>`; **not** compile-enforced, so the entry must be added explicitly) and the `data-event-type` CSS blocks.
- `docs/ai/ARCHITECTURE.md §The Rule Execution Pipeline` / notableEvents — the emit-as-final-step, JSON-serializable, minimal-payload (no `eventId`/`seq`/`timestamp`, D-20001) contract.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 13 (ESM).
- `docs/ai/DECISIONS.md` — scan D-20001 / D-20008 (the notableEvents contract + the `mastermindDefeated` precedent this WP mirrors) and the reserved D-24182 at the tail of this WP.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here
- Moves never throw — the emission is an unconditional array push (setup guarantees `G.notableEvents`)
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the event is a plain object (string + number + string)
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The `healResolved` payload is **minimal** (D-20001): `type` + `playerId` + `woundsHealed: number` + `narrative: string` — no `eventId`, `seq`, or `timestamp`.
- The emission is the **last** step in `healWounds`, after the `G.hasHealedThisTurn` set and the `pushLog`, so it observes settled state (the `fightVillain` precedent).
- The narrative is **engine-composed** (`composeHealNarrative`) and rendered **verbatim** by the client (D-20002) — the client never re-derives copy.
- Adding `'healResolved'` requires updating **both** the `NotableGameEventType` union **and** the `NOTABLE_EVENT_TYPES` array (drift-checked) — never one without the other.
- The event is **public** (not audience-redacted), exactly like `fightResolved` — a heal is observable; the existing `UIState.notableEvents` spread already projects it, so **no UIState projection change**.
- **No competitive-hash re-pin:** `G.notableEvents` is hashed, but no recorded sentinel/golden fixture exercises `healWounds` (it is not in `ai.legalMoves` / `SIMULATION_MOVE_NAMES`), so their `notableEvents` are byte-identical — the sentinel `finalStateHash` and `PRE_WP080_HASH` must stay unchanged.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **New event type string:** `'healResolved'`
- **`HealResolvedEvent` fields:** `type: 'healResolved'`, `playerId: string`, `woundsHealed: number`, `narrative: string`
- **Client chip label:** `healResolved: 'Healed'`
- **NotableEvent minimal-payload rule:** no `eventId` / `seq` / `timestamp` (D-20001)

---

## Debuggability & Diagnostics

- The event is deterministic and observable: a heal appends exactly one `healResolved` to `G.notableEvents` with `woundsHealed` equal to the KO'd count; verifiable by a `healWounds` unit test.
- The narrative is a pure function of `woundsHealed` — reproducible by a `composeHealNarrative` golden test.
- No new state mutation beyond the single append; `G` stays JSON-serializable.

---

## Scope (In)

### A) Engine — the `healResolved` variant (`packages/game-engine/src/events/notableEvents.types.ts`, **modified**)
- Add `'healResolved'` to the `NotableGameEventType` union.
- Add `'healResolved'` to the `NOTABLE_EVENT_TYPES` readonly array (last entry; 5 → 6).
- Add a `HealResolvedEvent` interface (`type: 'healResolved'`; `playerId: string`; `woundsHealed: number`; `narrative: string`) with a JSDoc mirroring `MastermindDefeatedEvent`.
- Add `HealResolvedEvent` to the `NotableGameEvent` union.

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`, **modified**)
- Add `composeHealNarrative(woundsHealed: number): string` — pure, returns e.g. `Used Healing, KO'ing ${woundsHealed} Wound(s) from hand.`. Mirror `composeMastermindDefeatedNarrative`.

### C) Engine — emit in the move (`packages/game-engine/src/moves/healWounds.ts`, **modified**)
- Import `composeHealNarrative`. After the existing `G.hasHealedThisTurn = true;` and the `pushLog(...)`, push one `healResolved` event to `G.notableEvents` with `playerId: ctx.currentPlayer`, `woundsHealed: <the counted Wounds>`, `narrative: composeHealNarrative(woundsHealed)`. Add a `// why:` (emit-last, D-24182, mirrors fightVillain).

### D) Engine tests
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified**: add `'healResolved'` to the pinned expected `NOTABLE_EVENT_TYPES` array (length 5 → 6); JSON-serializable check covers the new variant.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified**: golden test for `composeHealNarrative` (1 Wound and N Wounds).
- `packages/game-engine/src/moves/healWounds.test.ts` — **modified**: a successful heal appends exactly one `healResolved` with the correct `woundsHealed`; no-op heals append none; `JSON.stringify(G)` still succeeds.

### E) Client — the overlay chip label (`apps/arena-client/src/components/play/NotableEventOverlay.vue`, **modified**)
- Add `healResolved: 'Healed'` to `CHIP_LABELS`. Optionally add a `data-event-type="healResolved"` CSS block (reuse an existing accent; not required for correctness). The narrative renders through the existing verbatim path — no other template change.

### F) Client test (`apps/arena-client/src/components/play/NotableEventOverlay.test.ts`, **modified**)
- Add a render case: a `healResolved` event renders the "Healed" chip + its narrative; no effect-badge row.

---

## Out of Scope

- **No engine gameplay change.** The `healWounds` move's KO/flag/gating logic (WP-379) and the button (WP-380) are untouched — this WP only *appends* a notableEvent.
- **No `UIState` projection change.** `UIState.notableEvents` already projects the array verbatim; `healResolved` rides it for free.
- **No AI / simulation integration** and **no recorded-fixture re-pin** — no heal fires in the sentinel/golden games.
- **No new overlay component / no sound / no animation** — reuse the existing `NotableEventOverlay` render path.
- **No Healing Factor / hero-card wound-KO effects.** The core-set hero **Healing Factor** ("you may KO a Wound from hand or discard; if you do, draw a card") observed no-op'ing in the same live game is the **deferred generic hero `wound` keyword family** (WP-364 §Honest-Partial), a separate future WP — not this overlay.
- **No Enraging-Wound variants.** Distinct future data/keyword WP.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `healResolved` type + array entry + `HealResolvedEvent` + union
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeHealNarrative`
- `packages/game-engine/src/moves/healWounds.ts` — **modified** — emit the `healResolved` event (last step)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 5 → 6
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/moves/healWounds.test.ts` — **modified** — emission assertion
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry (+ optional CSS)
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case

No other files may be modified.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no multiplayer sync, no card-data/content-semantics change, no monetization. **Determinism note:** although `G.notableEvents` is part of `computeStateHash`, this WP appends a `healResolved` event only when a player heals, and **no recorded fixture heals**, so the pinned sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged (no re-pin) — a heal in live play is deterministic and replay-faithful (the composed narrative is a pure function of the KO count). NG-1..7 preserved (a cosmetic overlay for a co-op/solo action; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy. A gameplay overlay.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the event flows over the boardgame.io state push, not the HTTP surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine
- [ ] `NotableGameEventType` and `NOTABLE_EVENT_TYPES` both include `'healResolved'` (6 entries); the drift test pins the updated array and passes.
- [ ] `HealResolvedEvent` has exactly `{ type: 'healResolved', playerId, woundsHealed, narrative }` — no `eventId`/`seq`/`timestamp`.
- [ ] `composeHealNarrative(n)` returns the locked sentence; the golden test pins it for n = 1 and n = 2.
- [ ] A successful `healWounds` appends exactly one `healResolved` with `playerId === ctx.currentPlayer` and `woundsHealed` equal to the KO'd Wound count; a no-op heal (no Wounds / wrong stage / acted / pending) appends none.
- [ ] `JSON.stringify(G)` succeeds after the heal.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with the sentinel `finalStateHash` and `PRE_WP080_HASH` **unchanged** (no re-pin).

### Client
- [ ] `CHIP_LABELS.healResolved === 'Healed'`; a `healResolved` event renders the "Healed" chip + its narrative verbatim, with no effect-badge row.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0; `pnpm --filter arena-client test` passes.

### Build / scope
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (drift + narrative + emission + NO hash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash + PRE_WP080_HASH unchanged

# Step 3 — client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 4 — confirm the emission is a single push in healWounds
Select-String -Path "packages\game-engine\src\moves\healWounds.ts" -Pattern "notableEvents.push"
# Expected: exactly one match

# Step 5 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):** in a **real deployed match**, using Heal Wounds surfaces a center-screen **"Healed"** overlay naming the Wound count (alongside the existing log line), observed on the deployed bundle (green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] Engine + client suites pass; sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — a heal now raises a notable-event overlay.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24182 (the `healResolved` notableEvent variant + overlay) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-381 checked off with today's date.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All 10 required sections present; `Out of Scope` lists ≥2 excluded items (Healing Factor hero wound-KO, Enraging Wounds, AI/sim, projection change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-379/380/200 named with exact exports/paths + green baseline.
- **§4 Context (Read First)** — PASS. Specific files + the `mastermindDefeated` template + `00.6`. No `00.2` reference: no card-data shape or setup field changes (the event is an engine-composed runtime record, not a `00.2` contract).
- **§5 Files** — PASS. 8 files, all modified, within the ~8 guideline — a genuinely small cross-layer WP (6 engine + 2 client).
- **§6 Naming** — PASS. `healResolved`, `woundsHealed`, `composeHealNarrative`, `CHIP_LABELS`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine emits the event; the client reads it through the already-typed `UIState.notableEvents` (no new runtime engine import in the overlay); no engine→client import.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; arena-client `node:test` + `@vue/test-utils` + `jsdom`; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope check; `User-Visible Surface = play.legendary-arena.com`; §15.1 live-on-surface (D-24026) present.
- **§16 Code style** — PASS. Pure composer, explicit push, JSDoc, `// why:`, no abbreviations.
- **§17 Vision Alignment** — N/A (declared with justification) + the required determinism note: `G.notableEvents` is hashed, but no recorded fixture heals, so the sentinel `finalStateHash` + `PRE_WP080_HASH` are unchanged (no re-pin); a live heal is deterministic and replay-faithful (the narrative is a pure function of the KO count).
- **§18 Prose-vs-grep** — PASS. Verification Step 4 greps `healWounds.ts` for `notableEvents.push` (source-file scoped, not the WP); the WP prose that mentions the token is out of the grep's file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — a gameplay overlay.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the event flows over the boardgame.io state push.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-07-15).**

- **Sequencing / dependencies:** WP-379 ✅ (the move), WP-380 ✅ (the button, live-verified), WP-200 ✅ (the notableEvents union + overlay) — all landed on `main`; verified by direct source read of `notableEvents.types.ts`, `notableEvents.compose.ts`, `healWounds.ts`, and `NotableEventOverlay.vue`.
- **Green baseline:** `main @ 80ba5847` (measured this session): `pnpm -r build` 0; engine suite **1953 / 0**; `arena-client` typecheck (vue-tsc) 0 **after** `pnpm -r build` (a fresh worktree's client typecheck reads the engine's built dist, so the dist must be built first — the initial red was the known stale-dist artifact, not a `main` breakage).
- **Scope lock:** the `Files Expected to Change` allowlist is closed (8 files); `git diff --name-only` is a DoD gate.
- **Contract fidelity:** the `healResolved` variant mirrors `MastermindDefeatedEvent` exactly (`type` + `playerId` + one count + `narrative`); the emission mirrors `fightVillain`'s `G.notableEvents.push`; the overlay change is one `CHIP_LABELS` entry on the verbatim-narrative render path.
- **RS-1 (clarification, non-blocking):** the exact narrative wording is specified (`Used Healing, KO'ing N Wound(s) from hand.`) but the executor may tune the phrasing to match the composer family's voice, pinned by the golden test either way.
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-15).** The pre-flight READY verdict stands; all 30 issues scan PASS. This is a small, additive, well-precedented change (the sixth notableEvent variant, mirroring D-20008) with no architectural or determinism risk.

Selected findings:
- **#2 (determinism)** — PASS. `G.notableEvents` is hashed, but no recorded fixture heals, so the AC + EC require the sentinel + `PRE_WP080_HASH` to stay byte-identical and flag any shift as a STOP.
- **#4 (contract drift)** — PASS. `'healResolved'` is added to both the union and the drift-pinned `NOTABLE_EVENT_TYPES`; the drift test enforces the pair.
- **#1 / #9 (layer boundary)** — PASS. Engine composes the narrative; the client renders it verbatim (D-20002) and re-derives no copy; the overlay reads the already-typed projection.
- **#12 (scope creep)** — PASS. 8-file closed allowlist + `git diff --name-only` gate.
- **#26 (implicit content semantics)** — PASS. The narrative is engine-authored and golden-tested; the chip label is locked.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24182 (reserved; Drafted 2026-07-15, not yet landed)** — The Wound Healing ability gains a **`healResolved`** `NotableGameEvent` variant (the sixth; mirrors the `mastermindDefeated` D-20008 precedent). `healWounds` emits it as its final step — a minimal-payload event (`type` + `playerId` + `woundsHealed` + engine-composed `narrative`, no `eventId`/`seq`/`timestamp` per D-20001) appended to `G.notableEvents`. It is **public** (not audience-redacted, like `fightResolved`) and rides the existing `UIState.notableEvents` projection with no UIState change; the arena-client `NotableEventOverlay` renders a **"Healed"** chip + the verbatim narrative (D-20002). No engine gameplay change; **no competitive-hash re-pin** because no recorded sentinel/golden fixture exercises `healWounds`. Closes the WP-379 §Out-of-Scope "notableEvent is a client concern for the follow-up WP" deferral.

---

## See Also

- [WP-379](WP-379-wound-healing-ability.md) — the `healWounds` move that this WP makes announce itself
- [WP-380](WP-380-wound-healing-client-affordance.md) — the Heal Wounds button (live-verified 2026-07-15)
- [WP-200](WP-200-notable-game-event-log.md) / [D-20008](../DECISIONS.md) — the notableEvents union + overlay + the `mastermindDefeated` precedent this mirrors
- `docs/legendary-universal-rules-v23.md §Healing Wounds` — the printed rule
