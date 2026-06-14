# WP-249 — Optional-KO-then-Reward UX (Projection + Client Prompt)

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24020.
> **Paired WP:** WP-248 (engine framework) — **co-release locked** (this UX is
> inert without WP-248's `pendingOptionalKoReward` state + `resolveOptionalKoReward`
> move; WP-248 has no human-facing choice surface without this packet).
> **Paired EC:** EC-280.
> **Depends on:** WP-248 (engine), WP-243 (KO-hero UX precedent), WP-128 (UIState
> board projections), WP-061 (arena-client). WP-248 must land first or co-release.

---

## Session Context

> WP-243 built the player-facing choice surface for the villain KO-a-Hero choice:
> the engine projects `pendingKoHeroChoice` into UIState (front-of-queue, eligible
> targets recomputed fresh, redacted for non-choosers per D-24011); the
> arena-client renders `PendingKoHeroChoicePrompt.vue`, adds the move to the
> `UiMoveName` union, and gates End Turn / Pass Priority via `hasPendingKoChoice`.
> This packet builds the **identical surface** for WP-248's `optional-ko-reward`
> choice — reusing the WP-243 shapes, not inventing new ones.

---

## Goal

After this session, when a player plays a card with WP-248's `optional-ko-reward`
effect (e.g., Black Widow's **Dangerous Rescue**), the arena-client renders a
non-dismissible prompt letting the player **pick a card from their hand or
discard to KO (→ reward), or Decline** — and End Turn / Pass Priority are
disabled until the choice resolves. The engine projects the pending choice
(chooser-only) and the eligible hand/discard cards; the client submits
`resolveOptionalKoReward`.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` alongside
> WP-248 (engine). Supersession check returned no collision. D-24018 reserved on
> the in-flight `#314` branch; D-24019 reserved by WP-248; this packet reserves
> **D-24020**.

- **WP-248 complete (or co-released).** `G.pendingOptionalKoReward(s)` FIFO +
  `PendingOptionalKoReward` shape + `resolveOptionalKoReward` move + reward
  dispatch exist. **This UX packet does not change engine gameplay.**
- **WP-243 complete.** The KO-hero UX exists and is the structural template:
  `ui/uiState.types.ts` (`UIPendingKoHeroChoice`), `ui/uiState.build.ts`
  (projection), `ui/uiState.filter.ts` (chooser-only redaction, D-24011);
  `components/play/PendingKoHeroChoicePrompt.vue`, `components/play/uiMoveName.types.ts`
  (`UiMoveName` union), `composables/useTurnActions.ts` (`hasPendingKoChoice`
  gating), `components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue`,
  `pages/PlayMobile.vue`.
- arena-client `typecheck` (vue-tsc) + `test` green; engine `test` green.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary` — engine UIState is the Runtime-Safe
  surface arena-client consumes; the client submits **intent** (the move), never
  outcomes; redaction lives in the engine filter, not the client.
- The WP-243 files listed in §Assumes — **read each and mirror its shape** for the
  `optional-ko-reward` analog. Do not invent a new projection/redaction/prompt
  pattern.
- `packages/game-engine/src/ui/uiState.filter.ts` — the D-24011 chooser-only
  redaction (the pending choice + the owner's hand/discard must not leak to
  other players / spectators).
- `apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.vue` — the
  prompt UX precedent (non-dismissible selectable card list + submit).
- `.claude/rules/code-style.md` + `00.6`. (No `.claude/skills/legendary-game-engine`
  authority here for the client; the engine projection half still obeys it.)

---

## Non-Negotiable Constraints

**Engine-wide (projection half):**
- Full file contents. No `Math.random()` in the engine projection; UIState stays
  JSON-serializable; projections are pure over `G` (no mutation, spread-copy
  mutable `G` arrays per the D-WP-028 aliasing precedent).
- The projection recomputes the eligible hand/discard set **fresh** from current
  `G` (no snapshot), mirroring WP-243.

**Client half:**
- ESM, Vue SFC; `vue-tsc` clean; tests via the project's arena-client harness;
  no `boardgame.io` import in components (the client transport handles moves).
- The prompt is **non-dismissible** while the choice is pending (mirrors
  `PendingKoHeroChoicePrompt`); the only exits are selecting a card to KO or
  pressing **Decline**.

**Packet-specific:**
- **No engine gameplay change.** This packet only PROJECTS WP-248's existing state
  and SUBMITS the existing move. It must not add/alter any move, rule, or `G`
  mutation. (`git diff` must show no change to WP-248's engine logic files beyond
  the three `ui/` projection files.)
- **Chooser-only redaction (HARD, D-24011 analog).** `pendingOptionalKoReward`
  and the projected eligible hand/discard cards are visible ONLY to the choosing
  player; redacted for every other player and spectators (hand/discard contents
  are private).
- **Move-union addition.** `resolveOptionalKoReward` added to the `UiMoveName`
  union (the count grows by 1; update the drift assertion if one exists).
- **Turn-action gating.** While a `pendingOptionalKoReward` exists for the active
  player, End Turn + Pass Priority are disabled (extend `hasPendingKoChoice`
  pattern — a parallel `hasPendingOptionalKoReward`, or a combined predicate).
- **Both layouts.** Mount the prompt in `PlayDesktop.vue` AND `PlayMobile.vue`,
  gated on the projected pending choice (mirrors WP-243).

**Locked Contract Values:**
- Projection type: `UIPendingOptionalKoReward` (in `ui/uiState.types.ts`) — front
  entry: `{ rewardLabel: string; eligibleHand: UICardDisplay[]; eligibleDiscard:
  UICardDisplay[] }` (exact shape mirrors `UIPendingKoHeroChoice`; reuse the
  existing card-display sub-type).
- Move name: `'resolveOptionalKoReward'` added to `UiMoveName`.
- Component: `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue`.

---

## Scope (In)

### A) `packages/game-engine/src/ui/uiState.types.ts` — modified
- Add `UIPendingOptionalKoReward` + the optional field on the projected UIState
  (mirrors `UIPendingKoHeroChoice`). `// why: D-24020`.

### B) `packages/game-engine/src/ui/uiState.build.ts` — modified
- Project the front `pendingOptionalKoReward` (reward label + eligible hand +
  discard with display data, recomputed fresh, defensive copies). `// why: D-24020`.

### C) `packages/game-engine/src/ui/uiState.filter.ts` — modified
- Redact `pendingOptionalKoReward` (and the eligible hand/discard) for everyone
  except the chooser (D-24011 analog). `// why: D-24020 — hand/discard are private`.

### D) `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — **new**
- Non-dismissible prompt: selectable list of eligible hand + discard cards (zone
  labeled) + a **Decline** button; submits `resolveOptionalKoReward({zone,cardId})`
  or `({decline:true})`.

### E) `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified
- Add `'resolveOptionalKoReward'` to `UiMoveName` (+ drift assertion if present).

### F) `apps/arena-client/src/composables/useTurnActions.ts` — modified
- Add `hasPendingOptionalKoReward` (mirror `hasPendingKoChoice`) gating End Turn /
  Pass Priority.

### G) `apps/arena-client/src/components/play/TurnActionBar.vue` — modified
- Disable End Turn / Pass Priority while a pending optional-ko-reward exists.

### H) `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — modified
- Mount `OptionalKoRewardPrompt`, gated on the projected pending choice.

### I) Tests
- `ui/uiState.build.test.ts` + `ui/uiState.filter.test.ts` — **modified**:
  projection populates for the chooser; redacted for non-choosers/spectators.
- `components/play/OptionalKoRewardPrompt.test.ts` — **new**: renders eligible
  cards; KO-select submits `{zone,cardId}`; Decline submits `{decline:true}`;
  non-dismissible.
- Turn-action gating test — **modified**: End Turn disabled while pending.

---

## Out of Scope

- **Engine gameplay** (the move, state, reward dispatch, guards, bot) — that is
  WP-248. This packet is projection + client only.
- **The rest of the family / other rewards** — follow-ups (see WP-248).
- **Any registry, server, preplan change.**

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified**.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified**.
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified**.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified**.
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — **new**.
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.test.ts` — **new**.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**.
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified**.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified**.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified**.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified**.
- `docs/ai/DECISIONS.md` — **modified** — D-24020 Reserved → Active.
- `docs/ai/STATUS.md` — **modified**.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-249 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-280 → Done.

**Total: ~16 files** (12 source/test + 4 governance). Exact count + the precise
gating-test file pinned in EC-280 at pre-flight against the live WP-243 surface.
The arena-client UIState-fixture-backfill recurrence (engine UIState field adds
break `vue-tsc` — WP-166/207/227) applies: **backfill arena-client fixtures in
this same packet** so CI stays green.

---

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior — the player gets the
choice the card grants), §2 (card data). **No conflict.** Non-Goals NG-1..7: none
crossed (a gameplay-fidelity UX, not a paid/competitive/persuasive surface).

## Funding Surface Gate

**N/A — justified.** No funding affordance, copy, or channel.

## API Catalog (§21)

**N/A — justified.** No HTTP endpoint or `apps/server/src/**` library function;
engine UIState projection + arena-client only.

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE. Any single FALSE = STOP.**

1. `UIPendingOptionalKoReward` projected for the **chooser** with the reward label
   + eligible hand/discard cards (display data, fresh, defensive copies); the
   field is absent/empty when no choice is pending.
2. The projection is **redacted** for non-choosers and spectators (no
   hand/discard leak) — proven by a filter test.
3. `resolveOptionalKoReward` is in the `UiMoveName` union (+ drift assertion if
   one exists).
4. `OptionalKoRewardPrompt.vue` renders the eligible hand+discard cards
   (zone-labeled) + a Decline button; selecting a card submits
   `resolveOptionalKoReward({zone,cardId})`, Decline submits `{decline:true}`; the
   prompt is non-dismissible while pending.
5. End Turn + Pass Priority are disabled while a pending optional-ko-reward exists.
6. The prompt is mounted in BOTH `PlayDesktop.vue` and `PlayMobile.vue`.
7. **No engine gameplay change** — `git diff` shows engine changes ONLY in the
   three `ui/` projection files (+ their tests); no move/rule/`G`-mutation file
   touched.
8. engine `test` + arena-client `test` + arena-client `typecheck` (vue-tsc) exit 0;
   net-new projection/redaction/component/gating cases; no regress;
   `JSON.stringify(UIState)` succeeds.
9. `git diff --name-only` lists exactly the `## Files Expected to Change` set
   (final count pinned in EC-280).

---

## Definition of Done

- [ ] All Acceptance Criteria (1–9) pass.
- [ ] engine + arena-client `test` + arena-client `typecheck` exit 0.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` D-24020 Reserved → Active (byte-identical to the
      EC-280 §Verbatim Block).
- [ ] `WORK_INDEX.md` WP-249 `[x]`; `EC_INDEX.md` EC-280 → Done.
- [ ] Co-released with WP-248 (not merged as a dangling UX without the engine).
- [ ] No files outside `## Files Expected to Change` modified.

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order (pre-flight → copilot → lint), run in this drafting session against
`origin/main`:

- **Pre-flight (01.4): READY TO EXECUTE** (2026-06-13). Class: UI projection +
  client (no engine gameplay). The WP-243 UX surface was verified live:
  `ui/uiState.{types,build,filter}.ts`, `components/play/PendingKoHeroChoicePrompt.vue`,
  `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts`,
  `components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue` + `PlayMobile.vue`.
  Deps WP-243/128/061 ✅; WP-248 is co-release (must land together).
- **Copilot check (01.7): PASS** (2026-06-13). The three risks are locked with
  HARD gates in EC-280: chooser-only redaction (filter test, no hand/discard
  leak), the arena-client fixture backfill (`vue-tsc` green — the WP-166/207/227
  recurrence), and the no-engine-gameplay grep (engine diff = 3 `ui/` files +
  tests). No RISK/BLOCK.
- **Lint gate (00.3): PASS** (2026-06-13). §1 structure; §2 constraints
  (no-engine-change, chooser-only redaction, fixture backfill, non-dismissible);
  §5 ~16-file count justified; §8 boundaries (engine UIState + client only); §17
  Vision; §20 Funding N/A; §21 API N/A — satisfied or reasoned-N/A. No Final-Gate
  FAIL.
