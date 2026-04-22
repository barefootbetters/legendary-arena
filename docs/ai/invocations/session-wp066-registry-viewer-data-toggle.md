# Session Execution Prompt — WP-066 (Registry Viewer: Card Image-to-Data Toggle)

> **Authority:** This prompt is a strict transcription + ordering artifact produced by the WP-066 pre-flight bundle. It introduces **no new scope**, no new locked values, and no ambiguity resolutions beyond what EC-066 + WP-066 (post-PS-1 amendment) and the copilot check (2026-04-22) lock.
>
> **Execution contract:** EC-066 (`docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md`).
> **Design intent:** WP-066 (`docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md`, post-PS-1 at commit `5d72235`).
> **Pre-flight verdict:** READY TO EXECUTE (`docs/ai/invocations/preflight-wp066.md` — post-PS-1..PS-4 resolution).
> **Copilot-check disposition:** CONFIRM with 4 RISK findings locked as normative requirements below (`docs/ai/invocations/copilot-check-wp066.md`).

---

## Mandatory Read Order

Before writing any code, read in this order:

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, commit discipline.
2. `docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md` — EC usage workflow.
3. `docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md` — authoritative execution contract. Every locked value, guardrail, and verification step applies binary.
4. `docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md` — design intent (subordinate to EC-066 on execution contract; superior on design intent per `.claude/CLAUDE.md`).
5. `docs/ai/invocations/preflight-wp066.md` — READY verdict + four PS resolutions.
6. `docs/ai/invocations/copilot-check-wp066.md` — CONFIRM disposition + 4 normative RISK findings this prompt locks.
7. `apps/registry-viewer/CLAUDE.md` — viewer tech stack, data flow, composable conventions, layer boundary.
8. `apps/registry-viewer/src/registry/browser.ts` — confirm `FlatCard` export surface and available fields.
9. `apps/registry-viewer/src/composables/useGlossary.ts`, `useLightbox.ts`, `useResizable.ts`, `useRules.ts` — established composable patterns (Composition API, `export function useX()`).
10. `apps/registry-viewer/src/App.vue` — understand current component hierarchy, toolbar structure, selectedCard state management.
11. `apps/registry-viewer/src/components/CardDetail.vue` — current image-display branch (to be conditionally branched).

If EC-066 and WP-066 conflict on **execution contract** (locked values, guardrails, verification steps), EC-066 wins. On **design intent** (what the feature should do, why), WP-066 wins. `.claude/CLAUDE.md` and `docs/ai/ARCHITECTURE.md` override both.

---

## Branch Strategy (Already Established)

The execution branch is already prepared:

- **Branch:** `wp-066-registry-viewer-data-toggle`
- **Cut from:** `main` at commit `5d72235` (contains PS-1 amendment + pre-flight bundle) — then extended with `bcbae3a` (PS-2 WORK_INDEX flip)
- **Current HEAD:** `bcbae3a` (local + `origin/wp-066-registry-viewer-data-toggle`)

Verify:

```bash
git checkout wp-066-registry-viewer-data-toggle
git pull --ff-only origin wp-066-registry-viewer-data-toggle
git rev-parse HEAD                # should match bcbae3a or later PS commits
git log --oneline main..HEAD      # should show at least: PS-2 WORK_INDEX flip
```

Do NOT re-cut the branch from `main`. Do NOT rebase against `main` unless a specific coordination need arises — the branch already contains the governance bundle.

---

## Baseline Re-Derivation

On the branch, confirm baselines before any edit:

```bash
pnpm install --frozen-lockfile
pnpm --filter registry-viewer typecheck     # expect: exits 0 (vue-tsc silent)
pnpm --filter registry-viewer lint          # expect: 0 errors (warnings acceptable; 174 known cosmetic)
pnpm --filter registry-viewer build         # expect: exits 0, 60 modules transformed
```

Record exact baseline in execution summary. If typecheck or lint shows any **error** (not warning), stop and investigate — do not edit against an unknown baseline.

Engine-side builds (`pnpm -r build`, `pnpm -r test`) are **out of scope** for WP-066 — this WP touches only `apps/registry-viewer/`. Running them is optional but neither required nor part of the success criteria.

---

## Scope Lock — Files Allowed To Modify / Create

**Commit A allowlist (exact filenames; no `git add .` / `-A` / `-u`):**

1. `apps/registry-viewer/src/composables/useCardViewMode.ts` — **new** — composable managing `viewMode` ref + `localStorage` persistence. Public API: `{ viewMode, toggleViewMode }` only.
2. `apps/registry-viewer/src/components/ViewModeToggle.vue` — **new** — button/switch SFC rendering the toggle control. Emits no events; invokes `toggleViewMode` directly from the composable (or via prop callback — executor's call, both consistent with viewer conventions).
3. `apps/registry-viewer/src/components/CardDataDisplay.vue` — **new** — structured FlatCard data display; alternative to the current image branch in `CardDetail.vue`.
4. `apps/registry-viewer/src/App.vue` — **modified** — integrate `ViewModeToggle` into the existing toolbar; wire the composable; pass `viewMode` to `CardDetail.vue` as a prop.
5. `apps/registry-viewer/src/components/CardDetail.vue` — **modified** — conditionally render image branch (existing) or `CardDataDisplay` branch based on the `viewMode` prop.

**Optional (do not touch unless strictly needed; document with a DECISIONS.md entry if you do):**
- `apps/registry-viewer/src/components/CardGrid.vue` — EC §Guardrails: "do NOT touch unless necessary." Grid tiles may stay image-only in MVP.
- `apps/registry-viewer/CLAUDE.md` — optional Key Files table update to add the new `useCardViewMode.ts` row. Acceptable as a "while-I'm-here" doc fix per pre-flight RS-5.

**Commit B allowlist (governance close):**

1. `docs/ai/work-packets/WORK_INDEX.md` — update WP-066 row from `[x] Reviewed 2026-04-22` to `[x] Done YYYY-MM-DD, commit <Commit-A-hash>`.
2. `docs/ai/execution-checklists/EC_INDEX.md:134` — flip EC-066 Status column from `Draft` to `Done`.
3. `docs/ai/DECISIONS.md` — **only if** a DECISIONS entry is genuinely needed. WP-066 is purely additive UI; the copilot check concluded no new DECISIONS entry is required. If the executor discovers mid-execution that a pattern decision is needed (e.g., localStorage-key namespacing rule not already locked repo-wide), add one entry following the D-NNNN numbering convention. Default expectation: zero new entries.
4. `docs/ai/STATUS.md` — **optional**, only if the file follows a WP-summary-row convention for viewer-only WPs (consult prior viewer WPs like WP-060, WP-082, WP-083 for precedent).

**Anything else is out of scope.** If you find yourself needing to touch a file not listed above (or the optional escapes), STOP and escalate. Do NOT silently expand scope. Do NOT cite 01.5 runtime-wiring allowance retroactively.

---

## 01.5 Runtime-Wiring Allowance — NOT INVOKED

Per pre-flight §Invocation Prompt Conformance (WP-030 precedent):

| 01.5 trigger criterion | Status for WP-066 |
|---|---|
| New `LegendaryGameState` field added | ❌ Absent — no engine/`G` contact |
| `buildInitialGameState` shape change | ❌ Absent — no setup code contact |
| New `LegendaryGame.moves` entry | ❌ Absent — no move map contact |
| New phase hook | ❌ Absent — no phase/turn contact |

All four criteria are **absent**. The 01.5 allowance is therefore NOT INVOKED. Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, stop and escalate — do not force-fit.

---

## Locked Values (copied verbatim from EC-066 — do not re-derive)

### localStorage Persistence

- **Key:** `cardViewMode` (exact spelling — case-sensitive)
- **Allowed values:** `'image'` | `'data'` (strings, not booleans or other types)
- **Default (first visit):** `'image'`

### FlatCard Display Field Names (use EXACTLY as specified)

Post-PS-1 13-row table, verbatim-matching WP-066 §Non-Negotiable Constraints:

- `cost` → "Cost"
- `attack` → "Attack"
- `recruit` → "Recruit"
- `victoryPoints` → "Victory Points"
- `recruiterText` → "Recruiting Effect"
- `attackerText` → "Attack Effect"
- `abilityText` → "Ability"
- `heroClass` → "Class"
- `team` → "Team"
- `rarity` → "Rarity"
- `edition` → "Edition"
- `type` → "Type"
- `name` → "Name"

### Conditional Rendering (AND semantics)

- Data view displays attributes only if non-null and non-empty.
- Empty/null fields render as em-dash (—) **or** are omitted entirely (designer choice — pick one consistently; document which in the component's top-level comment).
- Both modes show the identical selected card; only presentation differs.

### Composable Public API

The composable exports exactly **two** names — nothing else on the public API:

```ts
export function useCardViewMode(): {
  viewMode: Ref<'image' | 'data'>;
  toggleViewMode: () => void;
};
```

**`setViewMode` is explicitly forbidden** on the public API (pre-flight PS-4 / copilot-check §External Review Disposition Log; no known caller exists, exposing it would create dead surface per `.claude/rules/architecture.md` "Prohibited AI Failure Patterns").

---

## Normative Requirements (Locked by Copilot Check — must be embedded verbatim)

The copilot check (`docs/ai/invocations/copilot-check-wp066.md`) produced 4 RISK findings whose FIXes are locked here as session-level normative requirements. Each must be implemented exactly as specified.

### REQ-1 — localStorage value narrowing (copilot #21)

The composable's mount-time read of `localStorage.getItem('cardViewMode')` returns `string | null`. The runtime narrowing to `'image' | 'data'` must reject any value that is not exactly `'data'`, defaulting to `'image'` in all other cases (including `null`, empty string, and any stale/tampered/future-mode value):

```ts
// why: localStorage.getItem returns string | null; explicit narrowing
// rejects stale or tampered values that would poison the discriminated
// union and break downstream switch/if branches.
const stored = localStorage.getItem('cardViewMode');
const initial: 'image' | 'data' = stored === 'data' ? 'data' : 'image';
```

On mount, **write the narrowed value back to localStorage** so malformed persisted values self-heal on first read:

```ts
// why: self-heal malformed or absent localStorage values by writing the
// narrowed initial value back, ensuring the 'image' | 'data' invariant
// holds on every subsequent read.
localStorage.setItem('cardViewMode', initial);
```

The write-back must also be wrapped per REQ-2.

### REQ-2 — localStorage.setItem error swallow with // why (copilot #22)

Every `localStorage.setItem('cardViewMode', ...)` call (mount-time self-heal and toggle-time flip) must be wrapped in a try/catch with a required `// why:` comment per `.claude/rules/code-style.md` Rule 11 / 15:

```ts
function toggleViewMode(): void {
  viewMode.value = viewMode.value === 'image' ? 'data' : 'image';
  try {
    localStorage.setItem('cardViewMode', viewMode.value);
  } catch (error) {
    // why: localStorage.setItem may throw in iOS Safari private browsing
    // mode or when storage quota is exceeded. The in-memory viewMode ref
    // is already updated above this block, so the UI remains functional —
    // only cross-reload persistence is lost. Silent swallow preserves UX;
    // 00.6 Rule 11 full-sentence swallow documentation required.
  }
}
```

The in-memory `viewMode.value = ...` update must run **before** the try/catch block, so a setItem failure leaves the UI in the correct state for the rest of the session (persistence is best-effort).

The mount-time `localStorage.getItem('cardViewMode')` read does **not** need a try/catch: `getItem` is specified to return `null` (not throw) when storage is inaccessible in all modern browsers.

### REQ-3 — Verification is manual; no automated test harness (copilot #11)

`apps/registry-viewer/` has **no automated test harness** at baseline (no `pnpm --filter registry-viewer test` script; no `*.test.ts` files in tree). Verification of WP-066 is manual, per EC-066 §After Completing:

1. `pnpm --filter registry-viewer typecheck` exits 0
2. `pnpm --filter registry-viewer lint` exits 0 **errors** (warnings acceptable)
3. `pnpm --filter registry-viewer build` exits 0
4. Browser DevTools → Application → Local Storage shows `cardViewMode` key with value `'image'` or `'data'`
5. Toggling view mode updates `localStorage` value in real-time
6. Select card → toggle → toggle back: same card selected, no state loss
7. Toggling view mode does NOT reset `searchText`, filters, or `selectedCard`
8. Data view is printable (browser print preview clean, all visible cards show attributes)
9. Both view modes work with existing card search / filter / selection features

WP-066 does not introduce a test harness. If the executor strongly believes a harness is warranted, raise it as a follow-up WP — do not expand WP-066 scope.

### REQ-4 — Known pre-existing issues, NOT addressed by this WP

The copilot check surfaced one repo-wide governance gap that predates WP-066 and is **not in scope**:

- **`apps/registry-viewer/` not classified in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`.** The category summary covers `client-app` (`apps/arena-client/`) and `cli-producer-app` (`apps/replay-producer/`) but no viewer row. WP-060 (EC-106), WP-082 (EC-107), WP-083 (EC-108), EC-103 all modified the viewer without this being a blocker; the precedent is that the viewer is implicitly a client-category cousin governed by `apps/registry-viewer/CLAUDE.md`.

Do **not** add a registry-viewer row to `02-CODE-CATEGORIES.md` in this session. That is a future docs-housekeeping WP's responsibility.

---

## Required `// why:` Comments

Per EC-066 §"Required `// why:` Comments" + REQ-1/REQ-2 additions:

1. `src/composables/useCardViewMode.ts` — why the localStorage key is `cardViewMode` (not abbreviated, not namespaced differently; consistency with viewer's convention of flat keys per `apps/registry-viewer/CLAUDE.md`).
2. `src/composables/useCardViewMode.ts` — REQ-1 narrowing `// why:` (rejects stale/tampered values).
3. `src/composables/useCardViewMode.ts` — REQ-1 self-heal write-back `// why:` (ensures invariant on subsequent reads).
4. `src/composables/useCardViewMode.ts` — REQ-2 setItem swallow `// why:` (Safari private mode / quota handling).
5. `App.vue` `onMounted` — why `viewMode` is read from `localStorage` on mount (user preference persistence across reloads).
6. `App.vue` toggle handler (if present in App.vue rather than composable-internal) — why the localStorage update + reactive state sync are coupled.

Any additional `// why:` comment is permitted if the executor finds non-obvious logic elsewhere. No fewer than the six above.

---

## Guardrails (from EC-066 §Guardrails)

- **Never break existing display:** image view must render identically before/after this packet.
- **Toggling view MUST NOT reset:** `selectedCard`, `filteredCards`, `searchText`, `filterSet`, `filterHC`, or any filter state.
- **localStorage must persist:** closing/reopening the browser must restore the user's last view mode choice.
- **Field names locked:** do NOT rename, abbreviate, or derive `FlatCard` field names; use exact names from the contract.
- **No new dependencies:** Vue 3 built-ins only. No date pickers, no UI frameworks, no additional libraries.
- **Styling:** scoped CSS in `<style scoped>` blocks matching the viewer's existing dark-theme convention. **No Tailwind** (not in use in the viewer per `apps/registry-viewer/package.json`; pre-flight RS-6 resolution). **No CSS modules.** **No new CSS framework.**

---

## Anti-Patterns (repo-wide, apply with full force to WP-066 scope)

From `.claude/rules/code-style.md` §"Patterns to Avoid":

- ❌ No `Math.random()` — blanket ban repo-wide.
- ❌ No `.reduce()` in any new code (the ban is targeted at zone ops and effect application; the pre-flight accepts `.reduce()` is not needed anywhere in WP-066 scope — reading a FlatCard and rendering fields is straight `for...of` / template iteration).
- ❌ No abbreviations: `vm`, `btn`, `tog`, `cfg`, `mm`, `sch`, `res`, `req`, `e`, `cb`, `fn`, `msg`, `ver`, `fix` are all forbidden. Use `viewMode`, `button`, `toggle`, etc.
- ❌ No nested or chained ternaries — use `if / else if / else` blocks (the single REQ-1 ternary `stored === 'data' ? 'data' : 'image'` has exactly one condition and is permitted).
- ❌ No dynamic property access for known keys — write out property names explicitly in `CardDataDisplay.vue`.
- ❌ No `import * as` — import exactly what you use by name.
- ❌ No barrel re-exports — import from specific paths.

From `.claude/rules/architecture.md` §"Prohibited AI Failure Patterns":

- ❌ No inventing mechanics, rules, fields, or card behavior.
- ❌ No exposing API surface without callers (the `setViewMode` rejection enforces this).

---

## Forbidden Imports (grep gates)

After Commit A edits, verify none of the following appear in any new or modified file:

```bash
# Engine, preplan, server imports — forbidden in viewer
git grep -n "from ['\"]@legendary-arena/game-engine" apps/registry-viewer/src/
git grep -n "from ['\"]@legendary-arena/preplan" apps/registry-viewer/src/
git grep -n "from ['\"]@legendary-arena/server" apps/registry-viewer/src/

# boardgame.io — forbidden in viewer
git grep -n "from ['\"]boardgame\.io" apps/registry-viewer/src/

# Node-only modules — forbidden in browser-bundled viewer code
git grep -n "from ['\"]node:" apps/registry-viewer/src/
git grep -n "from ['\"]pg['\"]" apps/registry-viewer/src/

# Math.random / Date.now — forbidden repo-wide
git grep -n "Math\.random\|Date\.now" apps/registry-viewer/src/composables/useCardViewMode.ts apps/registry-viewer/src/components/ViewModeToggle.vue apps/registry-viewer/src/components/CardDataDisplay.vue
```

All six greps must return **zero output** for the new/modified files. Escape the `.` in `boardgame.io` (per WP-031 precedent, unescaped dots match any character and can trip on unrelated strings).

---

## Commit Structure

### Commit A — Code

All 5 files in the Commit A allowlist in a single commit. No incremental commits. No amends.

**Message template:**

```
EC-066: add registry viewer card image-to-data toggle

Adds a global view-mode toggle to apps/registry-viewer/ that switches
all card displays between image view (current) and structured data view.
Toggle state persists in localStorage under key 'cardViewMode'
(values: 'image' | 'data', default 'image').

New files:
- src/composables/useCardViewMode.ts — viewMode ref + localStorage
  persistence with narrowed initial read, self-healing write-back, and
  error-swallow try/catch on setItem (iOS Safari private mode / quota).
- src/components/ViewModeToggle.vue — toolbar button for image/data flip.
- src/components/CardDataDisplay.vue — structured FlatCard display with
  13 locked field-display labels per EC-066 §Locked Values.

Modified:
- src/App.vue — mount useCardViewMode; pass viewMode to CardDetail;
  integrate ViewModeToggle into toolbar.
- src/components/CardDetail.vue — conditional render image branch or
  CardDataDisplay branch based on viewMode prop.

Verification (manual, per EC-066 §After Completing):
- pnpm --filter registry-viewer typecheck: 0 errors
- pnpm --filter registry-viewer lint: 0 errors
- pnpm --filter registry-viewer build: 0 errors
- DevTools Local Storage, toggle updates, state preservation across
  toggle, printable data view, filter/search interaction — all verified.

Copilot-check normative requirements REQ-1..REQ-4 applied
(docs/ai/invocations/copilot-check-wp066.md).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Use `EC-066:` prefix per `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`. Never `WP-066:`.

### Commit B — Governance Close

**Message template:**

```
SPEC: close WP-066 / EC-066 governance (WORK_INDEX + EC_INDEX)

WP-066 (registry viewer image-to-data toggle) complete per EC-066
After-Completing gate. Viewer typecheck + lint + build all 0 errors
at HEAD=<Commit-A-hash>. Manual verification per EC §After Completing.

- docs/ai/work-packets/WORK_INDEX.md: WP-066 Reviewed → Done
  (YYYY-MM-DD, commit <Commit-A-hash>)
- docs/ai/execution-checklists/EC_INDEX.md: EC-066 Draft → Done
- docs/ai/DECISIONS.md: <no new entries / new entries D-NNNN..D-NNNN>
- docs/ai/STATUS.md: <if file exists and convention followed>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Post-Mortem (Step 4 — Same Session, After EC Passes)

Per `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`:

- Inspect every new file and every modified region against this prompt's locked values and REQ-1..REQ-4.
- Trace each `localStorage` interaction against the narrowing + swallow patterns.
- Verify the forbidden-imports grep gates return zero output.
- Confirm `// why:` comments exist at all six required locations.
- Confirm no engine imports, no `Math.random`, no `.reduce()` in new code, no abbreviations.
- Any fix discovered during post-mortem that stays within the 5-file Commit A allowlist is an in-allowlist refinement (per WP-031 precedent) — apply immediately, re-verify, append to post-mortem §10 "Fixes applied during post-mortem."

The post-mortem document lives at `docs/ai/post-mortems/post-mortem-wp066-registry-viewer-data-toggle.md` (or consult recent viewer post-mortems for naming convention).

---

## Pre-Commit Review (Step 5 — Separate Session)

A non-implementing gatekeeper session (different Claude Code instance) reviews both commits against:

- `.claude/CLAUDE.md` commit discipline
- EC-066 After-Completing gate
- This prompt's Scope Lock + REQ-1..REQ-4
- `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`

The pre-commit review does not re-run builds — it assumes the execution summary accurately reports verification.

---

## Exit Criteria (What "Done" Means for This Session)

Session is complete when **all** of the following are true:

- [ ] All 5 Commit A files exist with full contents matching EC-066 + this prompt.
- [ ] All 4 copilot-check normative requirements (REQ-1..REQ-4) implemented verbatim.
- [ ] 6 required `// why:` comments present.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `pnpm --filter registry-viewer lint` exits 0 errors.
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] Manual browser verification covers all 9 EC §After-Completing checks.
- [ ] Post-mortem document saved.
- [ ] Commit A landed with `EC-066:` prefix.
- [ ] Commit B landed with `SPEC:` prefix, WORK_INDEX flipped to Done, EC_INDEX flipped to Done.
- [ ] Execution summary written for pre-commit review consumption.

---

## If Something Goes Wrong

- **Scope expansion needed mid-execution:** STOP. Do not touch off-allowlist files. Escalate with a clear statement of the gap and a proposed WP amendment (A-066-NN pattern). Do NOT cite 01.5 retroactively (it is NOT INVOKED for this WP).
- **Locked value contradicts reality:** STOP. The EC is the authoritative execution contract. If a locked value cannot be implemented as stated, escalate — do not silently adapt.
- **Discovered tests needed:** STOP. No test harness exists. A test-harness-establishment WP is a separate future WP. Do not add tests ad-hoc.
- **`CardGrid.vue` modification needed:** STOP. EC §Guardrails requires a DECISIONS.md entry to justify. Escalate before proceeding.
- **Unexpected file in working tree:** STOP and report. Do not include in either commit. (See WP-030 precedent: mystery `01.7-copilot-check.md` untracked file flagged and excluded.)

---

## Reference Documents (by priority)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `.claude/rules/architecture.md`
4. `.claude/rules/code-style.md`
5. `.claude/rules/work-packets.md`
6. `docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md`
7. `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`
8. `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`
9. `docs/ai/REFERENCE/00.6-code-style.md`
10. `apps/registry-viewer/CLAUDE.md`
11. `docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md`
12. `docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md`
13. `docs/ai/invocations/preflight-wp066.md`
14. `docs/ai/invocations/copilot-check-wp066.md`

If any of the above is unavailable, **stop**. Do not guess. Do not proceed without reading the authoritative artifacts.

---

**End of session execution prompt. Proceed to step 3 in a new Claude Code session.**
