# Session Prompt — WP-087 Engine Type Hardening

**Work Packet:** [docs/ai/work-packets/WP-087-engine-type-hardening.md](../work-packets/WP-087-engine-type-hardening.md) (A0-amended 2026-04-23; DRAFT banner replaced by READY TO EXECUTE header; Verification Step 4 grep narrowed)
**Execution Checklist:** [docs/ai/execution-checklists/EC-087-engine-type-hardening.checklist.md](../execution-checklists/EC-087-engine-type-hardening.checklist.md) (A0-amended 2026-04-23; After Completing grep narrowed)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp087.md](../session-context/session-context-wp087.md) (A0-reconciled 2026-04-23 against `main @ 372bf71` per 00.3 §19)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp087-engine-type-hardening.md](preflight-wp087-engine-type-hardening.md)
**Pre-flight verdict:** 🟢 **READY TO EXECUTE.** All 4 PS findings resolved in A0 bundle. 00.3 Lint Gate: 17/17 applicable sections PASS.
**Commit prefix:** `EC-087:` on the code-changing commit; `SPEC:` on any governance close. `WP-087:` forbidden (commit-msg hook rejects per P6-36).
**WP Class:** Type-only tightening. **No runtime behavior change. No new moves. No phase hook. No `LegendaryGameState` field added. No `buildInitialGameState` shape change. No serialization / replay / snapshot shape change.**
**Primary layer:** Game Engine (`packages/game-engine/src/types.ts`, `state/zones.types.ts`, `persistence/persistence.types.ts`, `rules/ruleRuntime.ordering.test.ts`).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-087:` on the code commit; `SPEC:` on any governance-close commit; `WP-087:` forbidden.

2. **A0 bundle landed.** Confirm the A0 SPEC pre-flight commit is HEAD (or present in the current branch). A0 contains:
   - `docs/ai/work-packets/WORK_INDEX.md` — WP-087 registered in Gameplay phase
   - `docs/ai/execution-checklists/EC_INDEX.md` — EC-087 registered (Draft)
   - `docs/ai/work-packets/WP-087-engine-type-hardening.md` — DRAFT banner replaced; Verification Step 4 grep narrowed
   - `docs/ai/execution-checklists/EC-087-engine-type-hardening.checklist.md` — DRAFT banner replaced; After Completing grep narrowed
   - `docs/ai/session-context/session-context-wp087.md` — §1 reconciled against `HEAD`
   - `docs/ai/invocations/preflight-wp087-engine-type-hardening.md` — pre-flight report
   - This prompt

   If the A0 bundle is not landed, STOP — execution is blocked on pre-flight governance.

3. **Upstream baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **671 tests / 127 suites / 0 fail** repo-wide (post-WP-051):
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - game-engine `506 / 113 / 0`
   - apps/server `19 / 3 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`

   **After Commit A:** the totals must be **identical** — `671 / 127 / 0`. Zero new tests; zero deleted tests. `ruleRuntime.ordering.test.ts` is the only test file modified, and its test count within the file is unchanged.

   If the baseline diverges from `671 / 127 / 0`, STOP and reconcile before writing code.

4. **Upstream contract-surface verification.** Before writing any file, re-run the pre-flight greps to confirm the surface has not drifted since A0:

   ```bash
   # Baseline confirmation: zero existing PlayerId / PlayerKey symbol
   grep -rn "type PlayerId\b\|type PlayerKey\b" packages/
   # Expected: no output.

   # Sole non-setup hookRegistry mutation still at line 56
   grep -rnE "(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.test.ts" packages/game-engine/src/
   # Expected: exactly one match — ruleRuntime.ordering.test.ts:56.

   # Zero post-setup mutations in production code (narrowed pattern)
   grep -rnE "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.ts" packages/game-engine/src/ | grep -v "\.test\.ts"
   # Expected: no output.

   # types.ts:365 false-premise trap check
   sed -n '365p' packages/game-engine/src/types.ts
   # Expected: "  random: { Shuffle: <T>(deck: T[]) => T[] };"

   # MatchSnapshot.playerNames pre-change shape
   grep -n "playerNames" packages/game-engine/src/persistence/persistence.types.ts
   # Expected: "58:  playerNames: Record<string, string>;"
   ```

   If any grep returns unexpected output, STOP — a parallel session landed a change during the pre-flight-to-execution window. Re-run the pre-flight.

5. **Files outside `## Files Expected to Change` must be unchanged during Commit A.** Before and after Commit A, verify:
   ```bash
   git diff main --name-only | sort
   ```
   Expected exactly 6 lines at Commit A close (4 code + 2 governance docs merged inline):
   ```
   docs/ai/DECISIONS.md
   docs/ai/STATUS.md
   packages/game-engine/src/persistence/persistence.types.ts
   packages/game-engine/src/rules/ruleRuntime.ordering.test.ts
   packages/game-engine/src/state/zones.types.ts
   packages/game-engine/src/types.ts
   ```
   If any other file appears, STOP — scope has leaked.

6. **Branch discipline.** Cut a fresh topic branch from `main` (after the A0 bundle lands):
   ```bash
   git checkout -b wp-087-engine-type-hardening main
   ```

7. **Working-tree hygiene (P6-27).** `git status --short` should show only `?? .claude/worktrees/` and any in-flight untracked files not part of this session. Stage by exact filename only — `git add .` / `-A` / `-u` are forbidden.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

WP-087 is a type-only tightening that touches **zero** wiring surface:

| 01.5 Trigger Criterion | Applies to WP-087? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero new fields. Existing fields get `readonly` modifier; type is structurally equivalent at runtime. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | Return shape unchanged. Internal `readonly` tightening is transparent to callers. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. |

**Conclusion:** 01.5 is **NOT INVOKED**. If an unanticipated structural break appears mid-execution — e.g., a TS error in a file not listed under `## Files Expected to Change` — **STOP and escalate**. This is a generic-ripple signal per WP-087 session protocol; the fix belongs in a separate WP.

---

## Post-Mortem (01.6) — OPTIONAL

None of the four 01.6 mandatory triggers fire for WP-087:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | No | `PlayerId` is a single-line type alias used in exactly three sites — not an "abstraction" in the 01.6 sense. |
| New contract consumed by future WPs | No | The three `Record<PlayerId, …>` swaps are structurally identical to `Record<string, …>` at runtime; no downstream WP is gated on this change. |
| New canonical readonly array | No | No new `PAR_ARTIFACT_SOURCES`-style constant. The `readonly` modifier applies to existing array fields; the field names were already canonical. |
| New filesystem / IO surface | No | Zero IO. |

Post-mortem is **optional**. The executor may author a brief one at `docs/ai/post-mortems/01.6-WP-087-engine-type-hardening.md` if any mid-session drift occurs, per the "documentation packets optional, execution packets mandatory" convention. If no drift, omit — per WP-087 session protocol this does not affect Definition of Done.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline, **test file extension rule (line 11): `.test.ts` never `.test.mjs`**
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative)
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine invariants; `G` serializability; throwing convention
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only, full-sentence errors, JSDoc required
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §Persistence Boundaries
6. [docs/ai/execution-checklists/EC-087-engine-type-hardening.checklist.md](../execution-checklists/EC-087-engine-type-hardening.checklist.md) — **primary execution authority**
7. [docs/ai/work-packets/WP-087-engine-type-hardening.md](../work-packets/WP-087-engine-type-hardening.md) — authoritative WP specification
8. [docs/ai/session-context/session-context-wp087.md](../session-context/session-context-wp087.md) — drafting-session rationale + §1 HEAD reconciliation
9. [docs/ai/invocations/preflight-wp087-engine-type-hardening.md](preflight-wp087-engine-type-hardening.md) — READY TO EXECUTE verdict; PS-1..PS-4 resolutions
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — scan for existing entries on player-ID typing, `LegendaryGameState` shape, or G-field immutability before adding D-NNNN

**Implementation anchors (read before coding — paths verified at pre-flight time):**

11. [packages/game-engine/src/types.ts](../../../packages/game-engine/src/types.ts) — `LegendaryGameState` definition. `hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks` currently typed `HookDefinition[]` / `SchemeSetupInstruction[]` / `HeroAbilityHook[]`; `playerZones` currently `Record<string, PlayerZones>`.
12. [packages/game-engine/src/state/zones.types.ts](../../../packages/game-engine/src/state/zones.types.ts) — `GameStateShape.playerZones` currently `Record<string, PlayerZones>`.
13. [packages/game-engine/src/persistence/persistence.types.ts](../../../packages/game-engine/src/persistence/persistence.types.ts) — `MatchSnapshot.playerNames` currently `Record<string, string>` at line 58.
14. [packages/game-engine/src/rules/ruleRuntime.ordering.test.ts](../../../packages/game-engine/src/rules/ruleRuntime.ordering.test.ts) — line 56 currently `gameState.hookRegistry = createHookRegistry(hooks);` (sole post-setup assignment; must move to factory-time).

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `packages/game-engine` carries a tightened type contract:

1. **`packages/game-engine/src/types.ts`** exports `PlayerId = string` with the required `// why:` comment citing the boardgame.io `"0" | "1" | …` player-ID string convention. The three array fields `hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks` on `LegendaryGameState` are typed `readonly`. `LegendaryGameState.playerZones` is `Record<PlayerId, PlayerZones>`.
2. **`packages/game-engine/src/state/zones.types.ts`** imports `PlayerId` from `../types.js` and uses it as the `playerZones` key type.
3. **`packages/game-engine/src/persistence/persistence.types.ts`** imports `PlayerId` and uses it as the `playerNames` key type.
4. **`packages/game-engine/src/rules/ruleRuntime.ordering.test.ts`** no longer contains a post-construction `gameState.hookRegistry = …` assignment; `hookRegistry` is built into the test state at factory time.
5. **Build:** `pnpm -r build` exits 0 with zero new TS errors and zero new warnings.
6. **Tests:** `pnpm -r test` exits 0 with `671 / 127 / 0` — **identical to pre-change baseline**. Zero new tests, zero deleted tests.
7. **Type-only check:** `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0.
8. **Grep invariant:** the narrowed grep in the EC returns zero matches over `packages/game-engine/src/**/*.ts` excluding `*.test.ts`.
9. **Governance (Commit A inline OR separate Commit B):** `docs/ai/DECISIONS.md` has a new D-NNNN entry covering (1) non-branded rationale, (2) three-array-only scope, (3) `MatchSetupConfig` non-applicability + `heroDeckIds` communal-pool semantic; `docs/ai/STATUS.md` has a one-line note; `docs/ai/work-packets/WORK_INDEX.md` flips WP-087 `[ ]` → `[x]`; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-087 Draft → Done.

No runtime behavior change. No serialization / replay / snapshot shape change. No new gameplay surface.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-087 §Locked Values and WP-087 §Non-Negotiable Constraints §Locked contract values. Re-stating them in the session prompt prevents re-derivation drift.

### Alias declaration (verbatim)

```ts
// why: boardgame.io 0.50.x uses the string player-index convention
// ("0" | "1" | "2" | ... — the index of the seat within a match's
// playerOrder array) for every G-scoped player key. This alias names
// that convention without narrowing it — deliberately non-branded to
// avoid rippling into every test factory. A future WP may upgrade to
// `string & { readonly __brand: unique symbol }` or
// `` `${number}` `` if the ripple cost becomes justified.
export type PlayerId = string;
```

The `// why:` comment is mandatory and must appear immediately above the `export type PlayerId = string;` line. Its absence fails the EC Required `// why:` Comments check.

### Three `LegendaryGameState` array fields receiving `readonly`

| Field | Before | After |
|---|---|---|
| `hookRegistry` | `HookDefinition[]` | `readonly HookDefinition[]` |
| `schemeSetupInstructions` | `SchemeSetupInstruction[]` | `readonly SchemeSetupInstruction[]` |
| `heroAbilityHooks` | `HeroAbilityHook[]` | `readonly HeroAbilityHook[]` |

No other field on `LegendaryGameState` receives `readonly` in this packet. `messages`, `counters`, `playerZones` (values), `piles`, `cardStats`, `cardKeywords`, `villainDeckCardTypes`, `attachedBystanders` are explicitly out of scope.

### Three `Record` keys changing `string` → `PlayerId`

| Site | Before | After |
|---|---|---|
| `LegendaryGameState.playerZones` in `packages/game-engine/src/types.ts` | `Record<string, PlayerZones>` | `Record<PlayerId, PlayerZones>` |
| `GameStateShape.playerZones` in `packages/game-engine/src/state/zones.types.ts` | `Record<string, PlayerZones>` | `Record<PlayerId, PlayerZones>` |
| `MatchSnapshot.playerNames` in `packages/game-engine/src/persistence/persistence.types.ts` | `Record<string, string>` | `Record<PlayerId, string>` |

`zones.types.ts` and `persistence.types.ts` each add a type-only import:

```ts
import type { PlayerId } from '../types.js';
```

The `.js` extension is correct for ESM + TypeScript build output — matches existing cross-file import patterns in the package.

### Sole non-setup mutation site being fixed

`packages/game-engine/src/rules/ruleRuntime.ordering.test.ts:56` currently reads:

```ts
gameState.hookRegistry = createHookRegistry(hooks);
```

Post-change: this line is deleted. The test factory that builds `gameState` is modified so `hookRegistry: createHookRegistry(hooks)` is inline at construction time. No other line in the file changes. No test assertion changes. Test count within the file unchanged.

### Locked grep pattern (narrowed per PS-1)

The invariant grep in WP-087 Verification Step 4 and EC-087 After Completing #4:

```powershell
Select-String -Path "packages/game-engine/src/**/*.ts" `
  -Pattern "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" `
  -Exclude "*.test.ts"
```

**Do not revert the pattern to the pre-PS-1 form** `(hookRegistry|...)` without the `(G|gameState)\.` qualifier. The unqualified form false-positives on `buildInitialGameState.ts:178 const schemeSetupInstructions = ...` — a legitimate setup-time local variable declaration that is exactly the pattern WP-087 requires.

Expected output: no matches.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any TS error in a file NOT listed under WP-087 `## Files Expected to Change`. This is the generic-ripple signal per WP-087 session protocol.
- Test count drift from `671 / 127 / 0` pre-change baseline. WP-087 adds zero tests and removes zero tests; any drift indicates accidental scope creep.
- Any `import *` or barrel re-export added to any file.
- Any new `HookDefinition[]` mutation site introduced anywhere in production code (grep must stay at zero).
- Any attempt to make `PlayerId` branded (`string & { __brand }` or `` `${number}` ``).
- Any attempt to apply `readonly` to a `LegendaryGameState` field other than the three locked (`hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks`).
- Any attempt to modify `MatchSetupConfig`, `MatchSetupError`, or `ValidateMatchSetupResult` in `matchSetup.types.ts` (pre-engine, pre-player-instantiation).
- Any attempt to split `types.ts` or reorder its barrel re-exports.
- Any `eslint --fix`, `prettier --write`, or blanket formatter / code-generation pass.
- Any file outside the 4 code + 2 governance docs allowed in Commit A scope.
- Any `.test.mjs` extension (forbidden by CLAUDE.md line 11).
- Any commit with `WP-087:` prefix (forbidden per P6-36 + commit-msg hook).

---

## AI Agent Warning (Strict)

WP-087 is a **type-only change**. The most likely failure modes are:

1. **Generic ripple.** A `readonly` modifier on `hookRegistry` may cause TS to complain at a call site that passes `G.hookRegistry` to a function typed `(hooks: HookDefinition[]) => …`. The fix is to widen the callee's parameter to `readonly HookDefinition[]` **only if** the callee is in the 4-file allowlist; otherwise STOP — the ripple belongs in a separate WP.
2. **Test-factory propagation.** After the three-array `readonly` change, TS may complain at test fixtures that construct `LegendaryGameState` objects with plain `HookDefinition[]` values. These assignments are allowed in TypeScript's structural type system (mutable arrays are assignable to `readonly` positions), so the compiler should accept them. If TS does complain, re-check the test fixture code — a rare edge case is a fixture that stores `hookRegistry` in a local `let` variable and reassigns it; that pattern would need to switch to `const` + `createHookRegistry(…)` inline. This case is not expected to exist based on the pre-flight grep (only `ordering.test.ts:56` fires).
3. **Cross-file `PlayerId` import resolution.** Both `zones.types.ts` and `persistence.types.ts` are at different depths in the module tree from `types.ts`. Use the exact import path `'../types.js'` — both files are one directory away from `types.ts`. Do not use `'../../types.js'` or an absolute path.
4. **Serialization non-change.** `Record<PlayerId, string>` where `PlayerId = string` serializes to JSON identically to `Record<string, string>`. Do not "normalize" snapshot producers or replay serializers — they are out of scope and out of the allowlist.

**Do NOT:**
- Introduce a helper function `makePlayerId(seat: number): PlayerId` — single-call-site, premature abstraction, and unnecessary because the alias is non-branded (literal strings already satisfy `PlayerId`).
- "Improve" the JSDoc on fields untouched by this packet.
- Reorder imports, reorder type exports, or apply any formatter-like transformation.
- Apply `readonly` prophylactically to `piles`, `cardStats`, `cardKeywords` "while you're here" — out of scope.
- Add a new `.test.ts` file. Zero new test files in Commit A.

**Instead:**
- Open each of the 4 code files; make exactly the tiny edits listed in §Implementation Tasks below; save; re-run the greps; re-run the tests.
- If anything surprises you (a TS error in an unlisted file, a test failure, a grep hit), STOP and ask before improvising.

---

## Implementation Tasks (Authoritative)

### A) Modify `packages/game-engine/src/types.ts`

Three edits in this single file:

1. **Add `PlayerId` alias.** Insert after the other simple type aliases near the top of the file (before `LegendaryGameState` is defined). Full block to insert:

   ```ts
   // why: boardgame.io 0.50.x uses the string player-index convention
   // ("0" | "1" | "2" | ... — the index of the seat within a match's
   // playerOrder array) for every G-scoped player key. This alias names
   // that convention without narrowing it — deliberately non-branded to
   // avoid rippling into every test factory. A future WP may upgrade to
   // `string & { readonly __brand: unique symbol }` or
   // `` `${number}` `` if the ripple cost becomes justified.
   export type PlayerId = string;
   ```

2. **Swap `playerZones` key:** change `playerZones: Record<string, PlayerZones>` to `playerZones: Record<PlayerId, PlayerZones>` on the `LegendaryGameState` interface.

3. **Apply `readonly` to the three arrays:** change
   - `hookRegistry: HookDefinition[]` → `hookRegistry: readonly HookDefinition[]`
   - `schemeSetupInstructions: SchemeSetupInstruction[]` → `schemeSetupInstructions: readonly SchemeSetupInstruction[]`
   - `heroAbilityHooks: HeroAbilityHook[]` → `heroAbilityHooks: readonly HeroAbilityHook[]`

No other line in `types.ts` changes. No JSDoc edits. No barrel reorder.

### B) Modify `packages/game-engine/src/state/zones.types.ts`

Two edits:

1. **Add type-only import** for `PlayerId` from `../types.js` at the top of the file (next to existing imports).
2. **Swap `playerZones` key** on `GameStateShape`: `Record<string, PlayerZones>` → `Record<PlayerId, PlayerZones>`.

No other changes.

### C) Modify `packages/game-engine/src/persistence/persistence.types.ts`

Two edits:

1. **Add type-only import** for `PlayerId` from `../types.js`.
2. **Swap `playerNames` key** on `MatchSnapshot`: `Record<string, string>` → `Record<PlayerId, string>`.

No other changes. The `MatchSnapshot` interface otherwise remains byte-identical in shape — this change is purely a type-level label swap, and JSON serialization is unchanged.

### D) Modify `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts`

One edit: the factory that constructs the test `gameState` currently assigns `hookRegistry` post-construction at line 56. Move the assignment into the factory so `hookRegistry: createHookRegistry(hooks)` is an inline property of the constructed object. Delete the post-construction assignment line. Do not modify any test assertion, any `describe` / `test` block, or any other line.

### E) Append `D-NNNN` to `docs/ai/DECISIONS.md`

After reading `docs/ai/DECISIONS.md` to find the next free entry number (expected in the 8700–8800 range but allocate from what's actually free at HEAD), append an entry covering the four required sub-points:

1. **Non-branded `PlayerId` rationale.** Plain `string` alias chosen over `string & { __brand }` and `` `${number}` `` because branding would ripple into every test factory (~40+ sites) and turn a type-only WP into a codebase-wide refactor. Future upgrade path documented; no current justification for ripple cost.
2. **`readonly` only on three arrays.** `hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks` are provably setup-only (grep-verified zero post-setup mutations in production code at `main @ 372bf71`). Other `LegendaryGameState` fields (`messages`, `counters`, `playerZones`, `piles`, `cardStats`, `cardKeywords`, `villainDeckCardTypes`, `attachedBystanders`) have live mutation sites in move or effect code and are explicitly out of scope.
3. **`MatchSetupConfig` non-applicability.** `MatchSetupConfig` and siblings (`MatchSetupError`, `ValidateMatchSetupResult`) in `matchSetup.types.ts` operate strictly pre-engine and pre-player-instantiation; they contain no player-keyed fields, and `PlayerId` has no relationship to formalize there.
4. **`heroDeckIds` communal-pool semantic.** `MatchSetupConfig.heroDeckIds` is a pool of chosen hero decks that get shuffled together into **one communal recruit deck** (Legendary's standard mechanic). `heroDeckIds.length` is decoupled from `numPlayers`; `heroDeckIds[N]` is not "player N's deck". Any future WP proposing per-seat hero-deck assignment must consciously override this decision rather than silently redefine it.

Full-sentence prose. Cite the pre-flight report (preflight-wp087-engine-type-hardening.md) and session-context §3.2, §3.3 as supporting rationale. Match the D-4901..D-5103 entry style precedent (a single numbered entry with bulleted sub-points is acceptable; four separate D-NNNN entries are also acceptable at executor discretion).

### F) Update `docs/ai/STATUS.md`

One-line note under Current State:

```
### WP-087 / EC-087 Executed — Engine Type Hardening (2026-04-<DD>, EC-087)

`PlayerId` alias added; three `LegendaryGameState` array fields (`hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks`) typed `readonly`; three `Record<string, …>` → `Record<PlayerId, …>` swaps. Zero runtime behavior change. Test baseline `671 / 127 / 0` unchanged.
```

### G) Flip `docs/ai/work-packets/WORK_INDEX.md` and `docs/ai/execution-checklists/EC_INDEX.md`

- `WORK_INDEX.md`: flip WP-087 `[ ]` → `[x]` with today's date and Commit A hash.
- `EC_INDEX.md`: flip EC-087 Status `Draft` → `Done 2026-04-<DD>`; Summary counts `Done 14 → 15`, `Draft 47 → 46`.

If the executor chooses the two-commit split (EC-087: code only + SPEC: governance close), F and G land in Commit B; otherwise all of A–G may land in Commit A. Commit A must carry either `EC-087:` prefix (if governance docs bundled) or remain code-only. Bundled form matches WP-051 precedent; split form is cleaner-read. Executor's call.

---

## Verification Steps

Run after Commit A is drafted but BEFORE committing. All must pass.

### Build + test

```bash
pnpm -r build
# Expected: exit 0; zero new TS errors; zero new warnings.

pnpm -r test
# Expected: exit 0; 671 / 127 / 0 total (unchanged from pre-change baseline).

pnpm --filter @legendary-arena/game-engine exec tsc --noEmit
# Expected: exit 0; zero errors.
```

### Invariant grep (narrowed pattern — do not revert)

```bash
grep -rnE "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.ts" packages/game-engine/src/ | grep -v "\.test\.ts"
# Expected: no output.

grep -rnE "(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.test.ts" packages/game-engine/src/
# Expected: no output. (Pre-change: exactly one match at ordering.test.ts:56; post-change: zero because the assignment moved into the factory.)
```

### Type-only verification

```bash
grep -n "export type PlayerId" packages/game-engine/src/types.ts
# Expected: exactly one match, on the line immediately above `= string;`.

grep -n "import type { PlayerId }" packages/game-engine/src/state/zones.types.ts packages/game-engine/src/persistence/persistence.types.ts
# Expected: exactly one match per file.

grep -n "readonly HookDefinition\[\]\|readonly SchemeSetupInstruction\[\]\|readonly HeroAbilityHook\[\]" packages/game-engine/src/types.ts
# Expected: exactly three matches.

grep -n "Record<PlayerId" packages/game-engine/src/types.ts packages/game-engine/src/state/zones.types.ts packages/game-engine/src/persistence/persistence.types.ts
# Expected: exactly three matches — one per file.
```

### Scope lock

```bash
git diff --name-only main | sort
# Expected 6 lines (Commit A bundled form):
#   docs/ai/DECISIONS.md
#   docs/ai/STATUS.md
#   packages/game-engine/src/persistence/persistence.types.ts
#   packages/game-engine/src/rules/ruleRuntime.ordering.test.ts
#   packages/game-engine/src/state/zones.types.ts
#   packages/game-engine/src/types.ts
# OR 4 lines (Commit A code-only, Commit B governance) — only the 4 engine files.
```

### Out-of-scope files must be unchanged

```bash
git diff main -- packages/game-engine/src/matchSetup.types.ts packages/registry/ packages/preplan/ apps/
# Expected: no output.
```

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm -r build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm -r test` exits 0 with `671 / 127 / 0` (identical to pre-change baseline)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0
- [ ] Narrowed grep invariant returns zero matches in production code
- [ ] `ordering.test.ts:56` no longer contains a post-construction `hookRegistry` assignment
- [ ] `export type PlayerId = string;` appears in `types.ts` with its required `// why:` comment
- [ ] Three `Record<PlayerId, …>` swaps verified via grep
- [ ] Three `readonly` modifiers on `LegendaryGameState` array fields verified via grep
- [ ] `zones.types.ts` and `persistence.types.ts` each import `PlayerId` from `../types.js` (type-only import)
- [ ] `DECISIONS.md` has the new D-NNNN entry covering all four required sub-points
- [ ] `STATUS.md` has the one-line Current State note
- [ ] `WORK_INDEX.md` flips WP-087 `[ ]` → `[x]` with date + Commit A hash
- [ ] `EC_INDEX.md` flips EC-087 Draft → Done with date; Summary counts updated
- [ ] No files outside `## Files Expected to Change` + the two governance docs were modified
- [ ] Commit A subject line starts with `EC-087:`; any governance-close Commit B starts with `SPEC:`
- [ ] `git diff --name-only main` matches the expected list exactly (6 files bundled OR 4 + 4 split)

---

## Final Instruction

WP-087 is a **type-only tightening**. The value is in what does NOT change: no runtime behavior, no moves, no phase hooks, no `LegendaryGameState` field additions, no serialization changes. The risk profile is low but the scope discipline must be tight — a single "while I'm here" refactor converts the packet into a cross-WP contamination.

If anything feels underdefined, re-read EC-087 (primary execution authority) and this prompt's §Locked Values. If still unclear — STOP and ask. Do not guess. Do not introduce helper functions. Do not expand scope.

Post-mortem: optional. Skip unless you hit mid-session drift.

Good luck.
