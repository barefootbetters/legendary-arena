# WP-725 — Split / dual-faced hero "choose a side": arena-client picker

**Status:** Draft 2026-09-21 · **EC:** EC-762 · **Reserves:** (none)
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session — the client half of the WP-724 arc (mirrors WP-717→WP-718)

## Goal

Render the player-facing **split-face picker** for WP-724's `PendingSplitFaceChoice`. When a player
plays a split / dual-faced hero card, a `SplitFaceChoicePrompt.vue` shows the card's two halves —
each with its name, ability text, cost, attack, and recruit — and submitting
`resolveSplitFaceChoice({ face })` binds the chosen side. After this packet the split-hero "choose a
side" mechanic is complete end-to-end on `play.legendary-arena.com`; this packet carries the D-24026
live-verify for the whole WP-724→WP-725 arc.

## User-Visible Impact

A player who plays a split hero card (e.g. Peter Parker's Hot Bowl of Soup / Protect My Family) sees a
two-option prompt and picks the half they want; the chosen half's resources and ability resolve, and the
board does not freeze. Before this arc the second half was unreachable (operator-confirmed live on
`gitSha df9291f`).

## Assumes

- **WP-724 ✅** — the engine serves an audience-filtered `UIPendingSplitFaceChoice` on `UIState`
  (chooser-redacted), accepts the server-only `resolveSplitFaceChoice({ face: 'a' | 'b' })` move, and
  blocks all other actions while the choice is pending. This packet consumes that surface and adds no
  engine change.
- **WP-719 / EC-756 ✅** — `CoveringFireChoicePrompt.vue` + the `UiMoveName` union member + the
  `useTurnActions` End-Turn/Pass gate + the `anyPendingChoice()` aggregate + the `PlayDesktop`/`PlayMobile`
  mount pattern. The component + wiring model.
- **WP-718 / EC-755 ✅** — the engine-then-client split precedent (client renders the already-served field
  verbatim; no client-side rule re-evaluation, D-20105).
- `AbilityText.vue` exists and renders marker syntax (`[hc:…]`, `[icon:…]`, `[keyword:…]`) — the split-face
  ability text MUST route through it (never raw marker syntax to the player).
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) + test are green on `origin/main`.

## Context (Read First)

- `.claude/rules/architecture.md` §UIState Projection Integrity (client renders `gameText`/`abilityText`
  via `AbilityText.vue`; client submits intent only).
- `apps/arena-client/src/components/play/CoveringFireChoicePrompt.vue` + its `.test.ts` — the prompt model.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — the `UiMoveName` union.
- `apps/arena-client/src/composables/useTurnActions.ts` — the End-Turn/Pass gate + `anyPendingChoice()`.
- `apps/arena-client/src/components/play/TurnActionBar.vue`, `apps/arena-client/src/pages/PlayDesktop.vue`,
  `apps/arena-client/src/pages/PlayMobile.vue` — the mount + prop-pass sites.
- `apps/arena-client/src/components/play/AbilityText.vue` — required for the ability text render.
- WP-724 §Contract for the `UIPendingSplitFaceChoice` shape.
- `docs/ai/REFERENCE/00.6-code-style.md`; `docs/ai/DECISIONS.md` D-24545 / D-24546.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix; Vue SFCs compiled via
`vue-sfc-loader` (test-only devDep, never runtime); full file contents, no diffs; human-style code per
`docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Client-only** — no engine / server / `packages/**` change; consume WP-724's served field verbatim
  (D-20105: the client re-evaluates no rule and composes no game text).
- The prompt renders **only** for the chooser (`pendingSplitFaceChoice !== undefined &&
  viewerPlayerId === playerID`) — the field is already chooser-redacted server-side; the client double-gates.
- Ability text routes through `AbilityText.vue` — never raw marker syntax to the player.
- `boardgame.io/react` is never imported; the move dispatches through the existing move-submission path.
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) is gated **Before** and **After**
  (esbuild/tsx do not type-check).

**Session protocol:** if the served field shape differs from WP-724's Contract, STOP — do not invent a
client-side shape.

## Scope (In)

### A) `SplitFaceChoicePrompt.vue` (new) + `.test.ts` (new)
- Props: the `UIPendingSplitFaceChoice` + `viewerPlayerId`. Renders iff `pendingSplitFaceChoice !==
  undefined && viewerPlayerId === playerID`.
- Two option buttons (face A / face B), each showing name, `AbilityText`-rendered ability, cost, attack,
  recruit from the served per-face fields; a click submits `resolveSplitFaceChoice({ face: 'a' | 'b' })`.
- `data-testid="arena-hud-split-face-choice"`. Tests: renders both faces for the chooser / hidden for a
  non-chooser / hidden when the field is `undefined` / each button submits the right `face`.

### B) `uiMoveName.types.ts` — add `| 'resolveSplitFaceChoice'` to the `UiMoveName` union.

### C) `useTurnActions.ts` — add a `hasPendingSplitFaceChoice` param, include it in the End-Turn / Pass
gate and the `anyPendingChoice()` aggregate (the WP-719 pattern).

### D) `TurnActionBar.vue` — take the `hasPendingSplitFaceChoice` prop for the gate.

### E) `PlayDesktop.vue` + `PlayMobile.vue` — import + register + mount `SplitFaceChoicePrompt`, compute
`pendingSplitFaceChoice` / `hasPendingSplitFaceChoice` from `uiState`, and pass the props through.

## Out of Scope

- Any engine / server / `packages/**` change (all in WP-724).
- Any change to the served `UIPendingSplitFaceChoice` shape or the move contract.
- A dedicated per-face image (the single `physicalCard.imageUrl` shows both halves; face selection is by
  name/ability/economy) — a face-specific image scheme is a possible follow-up, not this packet.
- Recruit-time selection UI (the choice is play-time only, D-24546).

## Files Expected to Change

- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue` — **new** — the picker.
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.test.ts` — **new** — component tests.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — union member.
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — End-Turn/Pass gate + aggregate.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — gate prop.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — mount + prop pass.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — mount + prop pass.

No other files may be modified.

## Contract

- Consumes `UIPendingSplitFaceChoice` (WP-724) verbatim; submits `resolveSplitFaceChoice({ face: 'a' | 'b' })`.
- `UiMoveName` gains `'resolveSplitFaceChoice'`.
- No new engine/server contract element.

## Acceptance Criteria

- The prompt renders both faces (name / ability via `AbilityText` / cost / attack / recruit) for the
  chooser only; hidden for a non-chooser and when the field is `undefined`.
- Clicking face A submits `resolveSplitFaceChoice({ face: 'a' })`; face B submits `{ face: 'b' }`.
- While the choice is pending, the End-Turn / Pass action is gated (via `useTurnActions`).
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) clean; arena-client suite green.
- No engine/server/`packages/**` file changed (`git diff --name-only`).

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc — esbuild/tsx do NOT type-check)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all pass, incl. the new SplitFaceChoicePrompt tests

# Step 3 — client-only scope
git diff --name-only
# Expected: only the apps/arena-client allowlist; no packages/**, no apps/server

# Step 4 — ability text routes through AbilityText.vue
Select-String -Path "apps\arena-client\src\components\play\SplitFaceChoicePrompt.vue" -Pattern "AbilityText"
# Expected: at least one match (ability text is not rendered raw)
```

## Definition of Done

- [ ] **User-visible verification (D-24026) — REQUIRED:** on the deployed
      `play.legendary-arena.com`, play `cvwr/peter-parker`'s split card in a real match, confirm the
      picker appears, pick each face, and confirm the correct economy + ability fires with no freeze —
      observable evidence captured. This closes the WP-724→WP-725 arc's live-verify.
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` + test green; `pnpm -r build` 0.
- [ ] No files outside `## Files Expected to Change` (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — split-hero "choose a side" is complete on-screen.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-725 checked off with date; `docs/05-ROADMAP-MINDMAP.md`
      node `📝`→`✅` + `pnpm roadmap:counts:write`, `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (card content faithful on-screen), NG-1 (no pay-to-win).
- **Conflict assertion:** No conflict — a display + intent-submission surface; the choice is a gameplay
  decision, never buyable; off-ranking.
- **Non-Goal proximity:** NG-1 not crossed.
- **Determinism preservation:** N/A at the client — the client submits intent only; the engine (WP-724)
  owns the deterministic resolution. No client-side rule re-evaluation (D-20105).

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1–7:** all required sections present; closed 7-file allowlist; no new npm deps; no forbidden packages
  (`boardgame.io/react` explicitly excluded).
- **§8 layer boundary:** arena-client only; consumes the engine's served field; no upward/sideways runtime import.
- **§9 Windows:** `pwsh` / `Select-String`.
- **§11 auth:** N/A.
- **§12 tests:** `node:test`, no boardgame.io import, no network/DB; mounted-component states.
- **§16 code style:** small SFC, descriptive names, ability text via `AbilityText.vue`.
- **§17 Vision Alignment:** present above.
- **§18 prose-vs-grep:** Step 4 greps `AbilityText` (a required-presence check, ≥1 match) — no conflict.
- **§20 Funding Surface Gate:** N/A — no funding affordance / navigation / profile / donate copy touched.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only` function changed.

**Pre-flight:** READY (hard-dep WP-724 is the paired engine WP; scope is a pure client render of a served
field; the WP-719 prompt + WP-718 render precedents are established). **Copilot:** PASS (the vue-tsc gate,
the chooser double-gate, the `AbilityText` routing, and the End-Turn aggregate — the client pending-choice
under-scope risks — are all in the allowlist and covered by the component tests).
