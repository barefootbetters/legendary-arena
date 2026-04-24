# Session Prompt — WP-088 Setup Module Hardening: `buildCardKeywords`

**Work Packet:** [docs/ai/work-packets/WP-088-build-card-keywords-hardening.md](../work-packets/WP-088-build-card-keywords-hardening.md) (A0 SPEC bundle landed 2026-04-23; emission order aligned with `BOARD_KEYWORDS` per D-8801; aliasing invariant locked per D-8802; whitespace-tolerance deferral locked per D-8803; 00.3 lint gate PASS recorded in §Appendix A)
**Execution Checklist:** [docs/ai/execution-checklists/EC-088-build-card-keywords-hardening.checklist.md](../execution-checklists/EC-088-build-card-keywords-hardening.checklist.md) (A0-amended 2026-04-23; aliasing guardrail + self-audit + failure-smell pattern added)
**Pre-Flight Report:** in-session pre-flight of 2026-04-23 — verdict `READY TO EXECUTE` after A0 SPEC bundle; copilot check re-run 30/30 PASS verdict `CONFIRM`
**Pre-flight verdict:** 🟢 **READY TO EXECUTE.** All five PS items resolved in A0 bundle (D-8801 / D-8802 / D-8803 + WORK_INDEX registration + EC_INDEX registration + WP-088 §Appendix A 00.3 lint PASS + test baseline lock). 30/30 copilot categories PASS on re-run.
**Commit prefix:** `EC-088:` on the code-changing commit; `SPEC:` on any governance close. `WP-088:` forbidden (commit-msg hook rejects per P6-36).
**WP Class:** Setup-module internal hardening. **No runtime behavior change for well-formed registry data. No new moves. No new phase hook. No `LegendaryGameState` field added. No `buildInitialGameState` shape change. No serialization / replay / snapshot shape change. Output `Record<CardExtId, BoardKeyword[]>` is byte-identical pre/post for real card data (only Ambush fires; `['ambush']` or `[]`).**
**Primary layer:** Game Engine, setup-time only (`packages/game-engine/src/setup/buildCardKeywords.ts`).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-088:` on the code commit; `SPEC:` on any governance-close commit; `WP-088:` forbidden.

2. **A0 SPEC bundle landed.** Confirm the A0 bundle is present in `main` (or on the current topic branch). A0 contains:
   - `docs/ai/DECISIONS.md` — D-8801 (emission order), D-8802 (Set locality + per-card fresh array), D-8803 (whitespace-tolerance deferral)
   - `docs/ai/work-packets/WORK_INDEX.md` — WP-088 registered with dependencies WP-025, WP-050, WP-087
   - `docs/ai/execution-checklists/EC_INDEX.md` — EC-088 registered (Draft); Summary `Draft 47 → 48`, `Total 62 → 63`
   - `docs/ai/work-packets/WP-088-build-card-keywords-hardening.md` — DRAFT banner replaced; emission order aligned to `BOARD_KEYWORDS`; Appendix A upgraded to formal PASS
   - `docs/ai/execution-checklists/EC-088-build-card-keywords-hardening.checklist.md` — DRAFT banner replaced; aliasing guardrail + self-audit + failure-smell pattern added
   - This prompt

   If the A0 bundle is not landed, STOP — execution is blocked on pre-flight governance.

3. **Upstream baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **671 tests / 127 suites / 0 fail** repo-wide (post-WP-087 at `73aeada`; post-WP-051 at `ce3bffb`):
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - game-engine `506 / 113 / 0`
   - apps/server `19 / 3 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`

   **After Commit A:** the totals must be **identical** — `671 / 127 / 0` repo-wide and `506 / 113 / 0` engine. Zero new tests; zero deleted tests. `buildCardKeywords.ts` is the only code file modified.

   If the baseline diverges from `671 / 127 / 0`, STOP and reconcile before writing code.

4. **Upstream contract-surface verification.** Before writing any file, re-run the pre-flight greps to confirm the surface has not drifted since A0:

   ```bash
   # Single production call site of buildCardKeywords (declaration + caller)
   grep -rnE "buildCardKeywords\s*\(" --include="*.ts" packages/game-engine/src/ | grep -v "\.test\.ts"
   # Expected: exactly 2 matches — declaration in buildCardKeywords.ts and caller in buildInitialGameState.ts.
   # Any third match is a new call site introduced since A0 — STOP and reconcile.

   # BoardKeyword union membership stable (patrol | ambush | guard)
   grep -n "^export type BoardKeyword\b" packages/game-engine/src/board/boardKeywords.types.ts
   # Expected: one line: "export type BoardKeyword = 'patrol' | 'ambush' | 'guard';" at line 16.

   # BOARD_KEYWORDS canonical array byte-identical to the locked emission order
   grep -nE "^  'patrol'," packages/game-engine/src/board/boardKeywords.types.ts
   grep -nE "^  'ambush'," packages/game-engine/src/board/boardKeywords.types.ts
   grep -nE "^  'guard'," packages/game-engine/src/board/boardKeywords.types.ts
   # Expected: three sequential lines inside the BOARD_KEYWORDS array (patrol, ambush, guard in that order).
   # If BOARD_KEYWORDS has grown or reordered, STOP — D-8801 order-lock must be re-evaluated.

   # Caller line reference
   sed -n '173p' packages/game-engine/src/setup/buildInitialGameState.ts
   # Expected: "  const cardKeywords = buildCardKeywords(registry as unknown, config);"
   # If line 173 has drifted, find the new line and update Hard Stops before proceeding.

   # Target file pre-change reference points
   grep -n "findFlatCardForVillainCard\|KeywordSetData\|isCardKeywordsRegistryReader\|extractKeywordsFromAbilities" packages/game-engine/src/setup/buildCardKeywords.ts
   # Expected: the pre-change symbols are present. findFlatCardForVillainCard will be deleted;
   # KeywordSetData will lose its abbr + henchmen fields; isCardKeywordsRegistryReader is preserved verbatim.
   ```

   If any grep returns unexpected output, STOP — a parallel session landed a change during the pre-flight-to-execution window. Re-run the pre-flight.

5. **Spot-check villain `FlatCard.key` format invariant.** The pre-index optimization depends on the format `${setAbbr}-villain-${groupSlug}-${cardSlug}`. Run a one-off verification (inline in a throwaway Node REPL or short script) that loads the registry and finds at least one villain card whose `.key` matches. If the format has drifted, STOP — the pre-index lookup's correctness depends on this invariant (WP-088 §Assumes).

6. **Files outside `## Files Expected to Change` must be unchanged during Commit A.** Before and after Commit A, verify:
   ```bash
   git diff main --name-only | sort
   ```
   Expected at Commit A close (bundled form — all of A–G in one commit):
   ```
   docs/ai/STATUS.md
   docs/ai/execution-checklists/EC_INDEX.md
   docs/ai/work-packets/WORK_INDEX.md
   packages/game-engine/src/setup/buildCardKeywords.ts
   ```
   Plus `docs/ai/DECISIONS.md` only if the executor appends a new `D-NNNN` entry for an unrecorded invariant (expected: no additional entry — D-8801 / D-8802 / D-8803 cover the full scope per EC-088 §Files to Produce).

   If any other file appears, STOP — scope has leaked.

7. **Branch discipline.** Cut a fresh topic branch from `main` (after the A0 bundle lands):
   ```bash
   git checkout -b wp-088-build-card-keywords-hardening main
   ```

8. **Working-tree hygiene (P6-27).** `git status --short` should show only `?? .claude/worktrees/` and any in-flight untracked files not part of this session. Stage by exact filename only — `git add .` / `-A` / `-u` are forbidden.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

WP-088 is a single-file internal-hardening pass that touches **zero** wiring surface:

| 01.5 Trigger Criterion | Applies to WP-088? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero new fields. `buildCardKeywords` return type `Record<CardExtId, BoardKeyword[]>` is byte-identical pre/post. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildCardKeywords`'s signature is byte-identical; `buildInitialGameState.ts:173` call site is not touched. `G.cardKeywords` serialization shape is unchanged. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. Setup-time only. |

**Conclusion:** 01.5 is **NOT INVOKED**. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` §Escalation — *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution — e.g., a TS error in a file not listed under `## Files Expected to Change` — **STOP and escalate**. The fix belongs in a separate WP or a scope-neutral in-place amendment authorized by the user.

---

## Post-Mortem (01.6) — OPTIONAL

None of the four 01.6 mandatory triggers fire for WP-088:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | No | `isKeywordSetData` is a private type guard local to a single file — not an abstraction in the 01.6 sense. |
| New contract consumed by future WPs | No | `buildCardKeywords` signature is byte-identical; the canonical-order array is a local implementation detail that reuses `BOARD_KEYWORDS`. No downstream WP is gated on this change. |
| New canonical readonly array | No | Emission order reuses `BOARD_KEYWORDS` (already canonical). No new array introduced. |
| New filesystem / IO surface | No | Zero IO. |

Post-mortem is **optional**. The executor may author a brief one at `docs/ai/post-mortems/01.6-WP-088-build-card-keywords-hardening.md` if any mid-session drift occurs, per the "documentation packets optional, execution packets mandatory" convention. If no drift, omit — per WP-088 session protocol this does not affect Definition of Done.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline, **test file extension rule (line 11): `.test.ts` never `.test.mjs`**
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative); §Game State (JSON-serializability — grounds D-8802)
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine invariants; §Registry Boundary; §Zone Mutation Rules; §Prohibited Behaviors; §Throwing Convention (only `Game.setup()` may throw — grounds the `continue`-instead-of-throw rule)
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only; full-sentence errors; JSDoc required; §Abstraction & Control Flow (`.reduce()` ban); §Drift Detection (canonical arrays)
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §Persistence Boundaries
6. [docs/ai/execution-checklists/EC-088-build-card-keywords-hardening.checklist.md](../execution-checklists/EC-088-build-card-keywords-hardening.checklist.md) — **primary execution authority**
7. [docs/ai/work-packets/WP-088-build-card-keywords-hardening.md](../work-packets/WP-088-build-card-keywords-hardening.md) — authoritative WP specification
8. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-8801 / D-8802 / D-8803** (WP-088 pre-flight decisions); **D-2302 / D-2503 / D-2504** (WP-025 originating decisions — Patrol/Guard safe-skip; inline Ambush-wound; setup-time safe-skip pattern)
9. [docs/ai/work-packets/WP-025-keywords-patrol-ambush-guard.md](../work-packets/WP-025-keywords-patrol-ambush-guard.md) + [EC-025](../execution-checklists/EC-025-board-keywords.checklist.md) — the originating packet for the target file

**Implementation anchors (read before coding — paths verified at pre-flight time):**

10. [packages/game-engine/src/setup/buildCardKeywords.ts](../../../packages/game-engine/src/setup/buildCardKeywords.ts) — target file. Pre-change: 273 lines; contains `isCardKeywordsRegistryReader` + four structural interfaces + `buildCardKeywords` + `extractKeywordsFromAbilities` + `findFlatCardForVillainCard`.
11. [packages/game-engine/src/setup/buildInitialGameState.ts:173](../../../packages/game-engine/src/setup/buildInitialGameState.ts) — sole production call site: `const cardKeywords = buildCardKeywords(registry as unknown, config);`. **Not modified by this WP.**
12. [packages/game-engine/src/board/boardKeywords.types.ts:16-28](../../../packages/game-engine/src/board/boardKeywords.types.ts) — `BoardKeyword` union + `BOARD_KEYWORDS` canonical array. **Not modified by this WP.** The emission-order array in `buildCardKeywords.ts` must match `BOARD_KEYWORDS` byte-for-byte per D-8801.
13. [packages/game-engine/src/state/zones.types.ts](../../../packages/game-engine/src/state/zones.types.ts) — `CardExtId` type alias. **Not modified by this WP.**

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `packages/game-engine/src/setup/buildCardKeywords.ts` carries the hardened shape specified in WP-088 §Scope:

1. **Private `isKeywordSetData(x: unknown): x is KeywordSetData` type guard** exists with a `// why:` comment and is the sole mechanism by which `unknown` is narrowed to `KeywordSetData` inside the function body. The old unchecked `as KeywordSetData | undefined` cast is replaced by `if (!isKeywordSetData(rawSetData)) continue;`.
2. **Per-iteration shape guards** inside the villain loop reject non-string / non-array inputs via `continue`: villain-group `slug` (must be `string`), `cards` (must be `Array`); villain-card `slug` (must be `string`); villain-card `abilities` normalized to `undefined` via `Array.isArray(villainCard.abilities) ? villainCard.abilities : undefined` before `extractKeywordsFromAbilities`.
3. **Villain pre-index `const villainExtIds = new Set<string>()`** built once before the outer `listSets()` loop by scanning `allFlatCards` for `cardType === 'villain'` and adding each `card.key`. Inner loop uses `villainExtIds.has(expectedKey)` where `expectedKey = \`${setEntry.abbr}-villain-${villainGroup.slug}-${villainCard.slug}\``. The `Set` is strictly function-local (D-8802) — never assigned to `G`, returned, exported, or passed across the function boundary. Ceases to exist when `buildCardKeywords` returns.
4. **`findFlatCardForVillainCard` is deleted** (both declaration and sole call site).
5. **`extractKeywordsFromAbilities` uses local boolean flags and canonical emission order** `['patrol', 'ambush', 'guard']` — byte-identical to `BOARD_KEYWORDS` per D-8801. MVP still only flips `hasAmbush` (Patrol / Guard remain safe-skip per D-2302). Each `result[extId]` value is a **freshly-constructed** `BoardKeyword[]` per D-8802 — never a reference to a shared canonical-order array or to another card's entry.
6. **`KeywordSetData` no longer declares `abbr` or `henchmen`.** The other four structural interfaces (`KeywordVillainCardEntry`, `KeywordVillainGroupEntry`, `KeywordFlatCard`, `CardKeywordsRegistryReader`) are preserved verbatim. `isCardKeywordsRegistryReader` is preserved verbatim.
7. **`buildCardKeywords` JSDoc return-contract sentence** is local / contractual — *"returns empty record when the registry does not satisfy `CardKeywordsRegistryReader`; callers must treat a missing entry as no keywords"* — no longer asserting caller behavior (the old clause *"moves handle missing cardKeywords entries gracefully"* is dropped).
8. **Required `// why:` comments** at each new predicate or locked value — see §Locked Values §Required `// why:` Comments below.
9. **Whitespace-tolerance unchanged.** No `trimStart()` added. The existing 304-occurrence verified-invariant `// why:` comment at the Ambush prefix-match site is preserved verbatim (D-8803).
10. **Build:** `pnpm -r build` exits 0 with zero new TS errors and zero new warnings.
11. **Tests:** `pnpm -r test` exits 0 with `671 / 127 / 0` repo-wide and `506 / 113 / 0` engine — **identical to pre-change baseline**. Zero new tests, zero deleted tests.
12. **Type-only check:** `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0.
13. **Grep invariants** (see §Verification Steps) all return their expected output (zero `.reduce(`, zero `try/catch`, zero `findFlatCardForVillainCard`, zero `boardgame.io` / `@legendary-arena/registry` imports, exactly two `buildCardKeywords(` hits, `buildInitialGameState.ts` byte-identical to pre-change).
14. **Governance (inline in Commit A or split to Commit B):** `docs/ai/STATUS.md` has a one-line Current State note; `docs/ai/work-packets/WORK_INDEX.md` flips WP-088 `[ ]` → `[x]` with date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-088 Draft → Done; Summary counts updated `Done 15 → 16`, `Draft 48 → 47`. No new `D-NNNN` entry required (D-8801 / D-8802 / D-8803 already landed by A0).

No runtime behavior change for well-formed registry data. No serialization / replay / snapshot shape change. No caller touches. No new gameplay surface.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-088 §Locked Values and WP-088 §Non-Negotiable Constraints §Locked contract values. Re-stating them in the session prompt prevents re-derivation drift.

### Target file and caller (boundary)

- Target file (sole production file modified): `packages/game-engine/src/setup/buildCardKeywords.ts`.
- Caller (NOT modified): `packages/game-engine/src/setup/buildInitialGameState.ts:173` — byte-identical pre/post.

### Function signature (byte-identical pre/post)

```ts
export function buildCardKeywords(
  registry: unknown,
  _matchConfig: MatchSetupConfig,
): Record<CardExtId, BoardKeyword[]>
```

The `registry: unknown` parameter type and the underscore-prefixed `_matchConfig: MatchSetupConfig` parameter name are both locked. Do not narrow the first parameter to `CardRegistryReader`. Do not drop the underscore prefix from `_matchConfig`. Do not change the return type.

### Villain key format (verbatim — load-bearing)

```
`${setAbbr}-villain-${groupSlug}-${cardSlug}`
```

Constructed inside the inner loop as `expectedKey`, then looked up via `villainExtIds.has(expectedKey)`.

### Canonical keyword emission order (verbatim — D-8801)

```ts
// Literal inline or spread from BOARD_KEYWORDS — both acceptable.
// The important constraint is byte-identity with BOARD_KEYWORDS.
const canonicalOrder: readonly BoardKeyword[] = ['patrol', 'ambush', 'guard'];
```

**Byte-identical** to `BOARD_KEYWORDS` at `packages/game-engine/src/board/boardKeywords.types.ts:24`. The emission-order array is referenced for iteration order only. Each `result[extId]` is a freshly-constructed `BoardKeyword[]` per D-8802.

### Aliasing prohibition (verbatim — D-8802)

- The villain `Set<string>` is strictly function-local. Never assigned to `G`, returned, exported, or passed across the function boundary. JSON-serializability invariant.
- Every `result[extId]: BoardKeyword[]` value is a **freshly-constructed** array. Simplest safe pattern:
  ```ts
  for (const villainCard of villainGroup.cards) {
    // ... shape guards + pre-index lookup ...
    const hasAmbush = /* detect */;
    // Fresh array per card — never a shared reference.
    const keywords: BoardKeyword[] = [];
    for (const keyword of canonicalOrder) {
      if (keyword === 'ambush' && hasAmbush) keywords.push('ambush');
      // patrol + guard safe-skip per D-2302 — no flag set, nothing pushed
    }
    if (keywords.length > 0) {
      result[extId] = keywords;
    }
  }
  ```
  Do NOT write `result[extId] = canonicalOrder`, `result[extId] = BOARD_KEYWORDS`, or `result[extId] = <any shared module-level const>`. Do NOT reuse one `keywords` array across multiple cards by hoisting it outside the loop.

### Private guard name (verbatim)

`isKeywordSetData` — private (non-exported) function. Signature: `isKeywordSetData(x: unknown): x is KeywordSetData`. Body checks `typeof o.abbr === 'string'` and `Array.isArray(o.villains)`.

### Deleted helper (verbatim)

`findFlatCardForVillainCard` — both declaration and call site are removed. Replaced by `villainExtIds.has(expectedKey)`.

### Preserved structural interfaces (verbatim — do not rename, split, or widen)

- `KeywordVillainCardEntry`
- `KeywordVillainGroupEntry`
- `KeywordFlatCard`
- `CardKeywordsRegistryReader`

### Deleted `KeywordSetData` fields

- `KeywordSetData.abbr` — deleted (callers consume `setEntry.abbr` from `listSets()` index; `KeywordSetData`'s copy is unused).
- `KeywordSetData.henchmen` — deleted (file no longer touches henchmen data).

### Runtime type guard preserved verbatim (not modified by this EC)

`isCardKeywordsRegistryReader` — body and declaration stay byte-identical. Its existing `// why:` comment stays verbatim.

### Required `// why:` Comments

Every comment below must exist in the final file:

- **On `isKeywordSetData` declaration** — cite that the registry package is not imported at this layer, so shape is validated structurally at runtime before cast-narrowing.
- **On the villain pre-index `const villainExtIds = new Set<string>()` declaration** — cite (1) the O(V·F) → O(V+F) rationale and (2) the invariant that this `Set` is strictly function-local and never placed in `G` (JSON-serializability constraint; **cite D-8802**).
- **On the canonical keyword emission order** — **cite both D-8801 and D-8802** (three sentences minimum): (1) order is locked to match `BOARD_KEYWORDS` per D-8801 so the engine carries one canonical order, not two; (2) adding a new `BoardKeyword` requires revising both this array and `BOARD_KEYWORDS` together — the drift-detection test fires on mismatch; (3) the canonical-order array is referenced for iteration order only — each `result[extId]` is a freshly-constructed `BoardKeyword[]` per D-8802 (WP-028 `cardKeywords` aliasing precedent).
- **Preserved verbatim (do not rewrite):** the existing `// why:` comments on `isCardKeywordsRegistryReader`, on the Ambush prefix-match predicate (304 occurrences, case-sensitive rationale — D-8803), on the Patrol / Guard safe-skip (D-2302), and on the henchman deferral.

### Locked test baseline (re-measure at session open; abort if diverged)

- Engine: `506 / 113 / 0` post-WP-087 at `73aeada`.
- Repo-wide: `671 / 127 / 0` post-WP-051 at `ce3bffb`.
- No test count change permitted by WP-088 (no new tests; no deletions).

---

## Hard Stops (Stop Immediately If Any Occur)

- Any TS error in a file NOT listed under WP-088 `## Files Expected to Change`. This is the generic-ripple signal — WP-088 is a single-file change, so this should not happen. If it does, the `unknown`-narrowing or structural-interface change has unexpectedly propagated; STOP and escalate.
- Any change to `buildCardKeywords`'s function signature or parameter names. Both `registry: unknown` and `_matchConfig: MatchSetupConfig` are byte-identical pre/post.
- Any modification to `packages/game-engine/src/setup/buildInitialGameState.ts` (the caller must be byte-identical to its pre-change content).
- Test count drift from `671 / 127 / 0` pre-change baseline. WP-088 adds zero tests and removes zero tests; any drift indicates accidental scope creep.
- Any `import` statement added to `buildCardKeywords.ts`. The only imports should be the three pre-existing type-only imports (`CardExtId`, `BoardKeyword`, `MatchSetupConfig`).
- Any `import` of `boardgame.io` or `@legendary-arena/registry` anywhere in the target file.
- Any `.reduce(` added to the target file.
- Any `try {` / `catch (` pattern introduced in the target file. All malformed-data handling is via narrow runtime guards and `continue`.
- Any `trimStart()` or other whitespace-tolerance transformation applied to the Ambush prefix-match predicate (violates D-8803).
- Any assignment of the form `result[extId] = BOARD_KEYWORDS`, `result[extId] = canonicalOrder`, or any other form where `result[extId]` receives a reference to a shared array. This is a D-8802 aliasing violation — fresh array per card is mandatory.
- Any Patrol- or Guard-specific ability-text heuristic (violates D-2302 safe-skip).
- Any henchman keyword extraction code (the in-file deferral comment stays).
- Any rename, split, or widening of the four preserved structural interfaces.
- Any `eslint --fix`, `prettier --write`, or blanket formatter / code-generation pass.
- Any `.test.mjs` extension (forbidden by CLAUDE.md line 11) — WP-088 adds no tests regardless.
- Any commit with `WP-088:` prefix (forbidden per P6-36 + commit-msg hook).

---

## AI Agent Warning (Strict)

WP-088 is a **single-file internal-hardening pass** with **byte-identical output for well-formed registry data**. The most likely failure modes are:

1. **Aliasing the canonical-order array.** The biggest latent risk — because the emission order is declared as a `readonly BoardKeyword[]` and MVP only flips `hasAmbush`, it is easy to "optimize" by returning a shared array. This is a D-8802 violation. Always construct a fresh `BoardKeyword[]` per card. If the resulting array is `['ambush']` on every matching card, each card still gets its own `['ambush']` array instance — that is the correct shape.

2. **Reverting to the pre-D-8801 emission order.** The WP's initial draft listed `['ambush', 'patrol', 'guard']` (introduction order from D-2302 / WP-025). **Do not use that order.** The A0 SPEC bundle aligned emission to `BOARD_KEYWORDS = ['patrol', 'ambush', 'guard']` so the engine carries one canonical order, not two. The drift-detection test in `boardKeywords.types.ts` enforces parity between the union and `BOARD_KEYWORDS`; the emission-order array reuses that single source of truth.

3. **Whitespace-tolerance "helpfulness."** When looking at the Ambush prefix-match, it is tempting to add `trimStart()` defensively. **Do not.** The existing `// why:` comment at the prefix-match site asserts a verified data invariant (304 case-sensitive occurrences, zero leading whitespace). Adding tolerance hides upstream drift. D-8803 locks this deferral with explicit reversal conditions requiring a separate WP.

4. **Promoting the villain `Set<string>` to `G` "for debuggability."** **Forbidden.** The `Set` is a performance optimization that must stay strictly function-local. Promoting it to `G.villainExtIds` breaks JSON-serializability and every persistence / snapshot test. D-8802 is unambiguous.

5. **Widening `isKeywordSetData` or the per-iteration guards.** The shape guards are minimal by design — only the fields the function actually reads are validated. Do not check additional fields "just in case"; that grows the structural interface and creates false-negative `continue` paths.

6. **Adding new tests "because the change feels nontrivial."** WP-088's acceptance bar is the existing simulation / setup coverage. The test-count baseline is locked at `506 / 113 / 0` + `671 / 127 / 0`. Zero new tests. The aliasing self-audit in EC-088 §After Completing is the substitute for test coverage of the fresh-array invariant.

**Do NOT:**
- Export `isKeywordSetData` or the villain pre-index `Set<string>`. Both are strictly internal.
- "Improve" the JSDoc on any interface, field, or comment untouched by this packet.
- Reorder imports, reorder interface declarations, or apply any formatter-like transformation.
- Convert the inner `for...of` loops to `.map()` / `.flatMap()` / `.reduce()` chains. `.reduce()` is banned per `.claude/rules/code-style.md` §Abstraction & Control Flow, and the explicit loop form is the established setup-code pattern.
- Add a helper `buildVillainExtIdSet(flatCards)` — single-call-site, premature abstraction, and WP-088 scope is internal to `buildCardKeywords`.
- Touch `buildInitialGameState.ts`, `boardKeywords.types.ts`, any registry file, any move file, or any test file.

**Instead:**
- Open `buildCardKeywords.ts`; apply the seven §Scope-item edits inline in reading order; save; re-run the greps; re-run the tests.
- If anything surprises you (a TS error in an unlisted file, a test failure, a grep hit, a line count drift beyond the expected net-negative range), STOP and ask before improvising.

---

## Implementation Tasks (Authoritative)

All seven tasks apply to the single file `packages/game-engine/src/setup/buildCardKeywords.ts`. Work in reading order — the file scans cleanly top-to-bottom when the edits are applied in the order below.

### A) Tighten the `buildCardKeywords` JSDoc return-contract sentence

Locate the JSDoc block above `export function buildCardKeywords(...)`. The existing body mentions *"moves handle missing cardKeywords entries gracefully"*. Replace the return-contract sentence with:

> Returns an empty record when the registry does not satisfy
> `CardKeywordsRegistryReader`; callers must treat a missing entry as
> no keywords.

No other JSDoc edits. Do not touch the `// why:` comment block above the function.

### B) Delete `KeywordSetData.abbr` and `KeywordSetData.henchmen`

In the `KeywordSetData` interface declaration, delete:
- `abbr: string;`
- `henchmen: unknown[];`

Keep `villains: KeywordVillainGroupEntry[];`. The other four structural interfaces (`KeywordVillainCardEntry`, `KeywordVillainGroupEntry`, `KeywordFlatCard`, `CardKeywordsRegistryReader`) are unchanged.

### C) Add the `isKeywordSetData` private type guard

Immediately after the `isCardKeywordsRegistryReader` declaration (keep that function verbatim), add the new private guard with its required `// why:` comment. Suggested body:

```ts
// why: the registry package is not imported at this layer, so shape
// must be validated structurally at runtime before the narrowed cast.
// Only the fields buildCardKeywords actually reads are checked —
// growing this guard to check additional fields would create
// false-negative `continue` paths on legitimate data.
function isKeywordSetData(x: unknown): x is KeywordSetData {
  if (!x || typeof x !== 'object') return false;
  const candidate = x as Record<string, unknown>;
  return Array.isArray(candidate.villains);
}
```

(The field list narrows to `villains` because `abbr` was deleted in step B. If the executor prefers to check both `abbr` and `villains` historically, note that `abbr` is no longer a declared field on `KeywordSetData` — checking it would be structurally sound but semantically redundant with the `setEntry.abbr` value already available from `listSets()`.)

### D) Replace the unchecked cast with the narrowed guard

Inside `buildCardKeywords`, find:

```ts
const setData = registry.getSet(setEntry.abbr) as KeywordSetData | undefined;
if (!setData || !Array.isArray(setData.villains)) {
  continue;
}
```

Replace with:

```ts
const rawSetData = registry.getSet(setEntry.abbr);
if (!isKeywordSetData(rawSetData)) {
  continue;
}
const setData = rawSetData;
```

(`rawSetData` is `unknown`; after the guard narrows, `setData` is typed `KeywordSetData`.)

### E) Add the villain pre-index `Set<string>` before the outer loop

After `const allFlatCards = registry.listCards();` (and before the `for (const setEntry of registry.listSets())` loop), insert the pre-index:

```ts
// why: avoid O(V·F) rescan of allFlatCards for every villain-card member.
// Scan once, build a Set<string>, look up O(1) inside the inner loop.
// This Set is strictly function-local and never placed in G (D-8802;
// JSON-serializability invariant). It ceases to exist when
// buildCardKeywords returns.
const villainExtIds = new Set<string>();
for (const card of allFlatCards) {
  if (card.cardType === 'villain') {
    villainExtIds.add(card.key);
  }
}
```

### F) Rewrite the inner villain-card loop with shape guards, pre-index lookup, and fresh-array emission

Inside the innermost `for (const villainCard of villainGroup.cards)` loop, the current body calls `findFlatCardForVillainCard(...)` and pushes a keyword array. Replace the entire inner body with the combined shape-guard + pre-index + canonical-order + fresh-array pattern:

```ts
// Per-iteration shape guards: reject missing / non-string slugs and
// non-array cards lists. fail-closed via `continue` — no throws.
if (typeof villainGroup.slug !== 'string') continue;
if (!Array.isArray(villainGroup.cards)) continue;
// (villainGroup.slug + cards checks are in the outer for — see below.)

// Inside: for (const villainCard of villainGroup.cards)
if (typeof villainCard.slug !== 'string') continue;

const abilities: string[] | undefined = Array.isArray(villainCard.abilities)
  ? villainCard.abilities
  : undefined;

const hasAmbush = detectAmbush(abilities);
// Patrol + Guard safe-skip per D-2302 — no hasPatrol / hasGuard flags
// because they have no data source in current card data.

if (!hasAmbush) continue;

const expectedKey = `${setEntry.abbr}-villain-${villainGroup.slug}-${villainCard.slug}`;
if (!villainExtIds.has(expectedKey)) continue;

// why: canonical keyword emission order is locked to match BOARD_KEYWORDS
// (['patrol', 'ambush', 'guard']) per D-8801 so the engine carries one
// canonical order, not two. Adding a new BoardKeyword requires revising
// both this array and BOARD_KEYWORDS together — the drift-detection test
// fires on mismatch. The canonical-order array is referenced for
// iteration order only; each result[extId] below is a freshly-constructed
// BoardKeyword[] per D-8802 (WP-028 cardKeywords aliasing precedent).
const canonicalOrder: readonly BoardKeyword[] = ['patrol', 'ambush', 'guard'];

const keywords: BoardKeyword[] = [];
for (const keyword of canonicalOrder) {
  if (keyword === 'ambush' && hasAmbush) {
    keywords.push('ambush');
  }
  // 'patrol' and 'guard' safe-skip — no flag, no push.
}

if (keywords.length > 0) {
  result[expectedKey as CardExtId] = keywords;
}
```

(The executor may restructure the code above for readability — e.g., hoist `canonicalOrder` to module scope if the `// why:` block is carried with it, keeping the spec intent. The constraints are: canonical order byte-identical to `BOARD_KEYWORDS`; fresh `BoardKeyword[]` per card; single `// why:` block carrying the three required sentences.)

The helper `detectAmbush(abilities)` is an optional inline refactor of the existing loop body inside `extractKeywordsFromAbilities`. If kept inline (equivalent behavior), `extractKeywordsFromAbilities` may be:
- Simplified to the single-boolean form (returns `boolean`), OR
- Preserved returning `BoardKeyword[]` for backward-compatibility with the WP's specified signature.

Either form is acceptable as long as (a) the canonical-order emission lives at the call site (so the fresh-array rule is visible), (b) MVP still only flips `hasAmbush`, (c) the existing 304-occurrence `// why:` comment at the Ambush prefix-match is preserved verbatim, and (d) `.startsWith('Ambush')` (case-sensitive, no `trimStart()`) is preserved.

### G) Delete `findFlatCardForVillainCard`

Delete the entire function declaration (all ~30 lines from `function findFlatCardForVillainCard(...)` through its closing `}`). The pre-index + `villainExtIds.has(expectedKey)` replaces it entirely.

### H) Post-code governance updates (inline in Commit A or split to Commit B)

1. **`docs/ai/STATUS.md`** — append a one-line Current State note:

   ```
   ### WP-088 / EC-088 Executed — `buildCardKeywords` Setup Module Hardening (2026-04-<DD>, EC-088)

   Setup-time hardening only; no runtime behavior change for well-formed card data. Runtime guards, villain pre-index (O(V·F) → O(V+F)), and canonical emission order aligned with `BOARD_KEYWORDS` per D-8801 / D-8802 / D-8803. Test baseline `671 / 127 / 0` unchanged.
   ```

2. **`docs/ai/work-packets/WORK_INDEX.md`** — flip WP-088 `[ ]` → `[x]` with today's date and Commit A hash. Example tail: `Completed 2026-04-<DD> (Commit A <hash>)`.

3. **`docs/ai/execution-checklists/EC_INDEX.md`** — flip EC-088 Status `Draft` → `Done 2026-04-<DD>`; Summary counts `Done 15 → 16`, `Draft 48 → 47`.

4. **`docs/ai/DECISIONS.md`** — **expected: no change.** D-8801 / D-8802 / D-8803 already cover the scope. Append a new `D-NNNN` entry **only if** runtime-guard work surfaces a previously-unrecorded invariant.

If the executor chooses the two-commit split (`EC-088:` code-only + `SPEC:` governance close), H.1–H.4 land in Commit B; otherwise all of A–H may land in Commit A. Commit A must carry either `EC-088:` prefix (if governance docs bundled) or remain strictly code-only with a separate SPEC governance-close commit. Bundled form matches WP-051 precedent; split form is cleaner-read. Executor's call.

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

### Invariant greps

```bash
# No .reduce( anywhere in target file
grep -n "\.reduce(" packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output.

# No boardgame.io or registry imports
grep -nE "from ['\"](boardgame\.io|@legendary-arena/registry)" packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output.

# findFlatCardForVillainCard fully removed
grep -rn "findFlatCardForVillainCard" packages/game-engine/src/
# Expected: no output.

# No try/catch introduced
grep -nE "try\s*\{|catch\s*\(" packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output.

# Exactly two buildCardKeywords( hits in production code (declaration + caller)
grep -rnE "buildCardKeywords\s*\(" --include="*.ts" packages/game-engine/src/ | grep -v "\.test\.ts"
# Expected: exactly 2 matches — declaration + buildInitialGameState.ts:173.

# No trimStart applied to Ambush predicate
grep -n "trimStart" packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output.

# No aliasing of canonical order into result entries
grep -nE "result\[.*\]\s*=\s*(BOARD_KEYWORDS|canonicalOrder)\b" packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output.
```

### Windows / pwsh equivalents (from EC-088 §After Completing)

```powershell
Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "\.reduce\("
Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "from\s+['""](boardgame\.io|@legendary-arena/registry)"
Select-String -Path "packages/game-engine/src/**/*.ts" -Pattern "findFlatCardForVillainCard"
Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "try\s*\{"
Select-String -Path "packages/game-engine/src/**/*.ts" -Pattern "buildCardKeywords\s*\(" -Exclude "*.test.ts"
# Each: expected zero matches OR the two declaration-plus-caller hits for the final grep.
```

### Caller byte-identity

```bash
git diff main -- packages/game-engine/src/setup/buildInitialGameState.ts
# Expected: no output (file is byte-identical to main).
```

### Aliasing self-audit (D-8802 — manual trace)

Open `buildCardKeywords.ts` post-change and trace every line that writes to `result[<extId>]`. For each write, confirm the RHS is a **freshly-constructed** `BoardKeyword[]` (a new array literal or a local `const keywords: BoardKeyword[] = []` that was populated this iteration). If the RHS is a reference to `BOARD_KEYWORDS`, `canonicalOrder`, or any shared array, revert to the per-card fresh-array pattern.

### Scope lock

```bash
git diff --name-only main | sort
# Expected (bundled form — all of A–H in Commit A):
#   docs/ai/STATUS.md
#   docs/ai/execution-checklists/EC_INDEX.md
#   docs/ai/work-packets/WORK_INDEX.md
#   packages/game-engine/src/setup/buildCardKeywords.ts
#
# OR (split form — Commit A code-only, Commit B governance):
#   Commit A: packages/game-engine/src/setup/buildCardKeywords.ts  (1 line)
#   Commit B: docs/ai/STATUS.md + WORK_INDEX.md + EC_INDEX.md  (3 lines)
#
# If DECISIONS.md appears, confirm it's an execution-close addition only —
# D-8801 / D-8802 / D-8803 are already landed by A0 and must not be re-authored.
```

### Out-of-scope files must be unchanged

```bash
git diff main -- packages/game-engine/src/setup/buildInitialGameState.ts packages/game-engine/src/board/ packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/turn/ packages/registry/ packages/preplan/ apps/
# Expected: no output.
```

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm -r build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm -r test` exits 0 with `671 / 127 / 0` repo-wide and `506 / 113 / 0` engine (identical to pre-change baseline)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0
- [ ] `buildInitialGameState.ts` is byte-identical to its pre-change content (`git diff main -- packages/game-engine/src/setup/buildInitialGameState.ts` returns no output)
- [ ] `isKeywordSetData` exists as a private (non-exported) function with its required `// why:` comment and is the sole mechanism by which `unknown` is narrowed to `KeywordSetData` inside the function body
- [ ] Per-iteration shape guards reject non-string `slug` / non-array `cards` / non-string card `slug` via `continue`; normalize non-array `abilities` to `undefined` before extraction
- [ ] `findFlatCardForVillainCard` is deleted (both declaration and call site); grep returns zero matches
- [ ] Villain lookup uses a locally-scoped `Set<string>` built once before the `listSets()` loop; `Set` is never returned, assigned to `G`, or exported (D-8802)
- [ ] `extractKeywordsFromAbilities` (or its inline replacement) uses local boolean flags and emits keywords in the canonical order `['patrol', 'ambush', 'guard']` — byte-identical to `BOARD_KEYWORDS` (D-8801)
- [ ] Every `result[extId]` is a freshly-constructed `BoardKeyword[]` — aliasing self-audit passed (D-8802)
- [ ] `KeywordSetData` no longer declares `abbr` or `henchmen`; the other four structural interfaces are preserved verbatim
- [ ] `buildCardKeywords` JSDoc's return-contract sentence is local / contractual; no longer asserts caller behavior
- [ ] No `try/catch` introduced; all malformed-data handling is via narrow runtime guards + `continue`
- [ ] No `trimStart()` or other whitespace-tolerance change to Ambush prefix-match (D-8803)
- [ ] `buildCardKeywords` signature byte-identical pre/post (`registry: unknown`, `_matchConfig: MatchSetupConfig`, return `Record<CardExtId, BoardKeyword[]>`)
- [ ] All four required `// why:` comments present (§Locked Values §Required `// why:` Comments)
- [ ] `STATUS.md` has the one-line Current State note
- [ ] `WORK_INDEX.md` flips WP-088 `[ ]` → `[x]` with date + Commit A hash
- [ ] `EC_INDEX.md` flips EC-088 Draft → Done with date; Summary counts updated (`Done 15 → 16`, `Draft 48 → 47`)
- [ ] No files outside `## Files Expected to Change` + the governance docs were modified
- [ ] Commit A subject line starts with `EC-088:`; any governance-close Commit B starts with `SPEC:`
- [ ] `git diff --name-only main` matches the expected list exactly (4 files bundled OR 1 + 3 split)

---

## Final Instruction

WP-088 is a **single-file internal-hardening pass** on a setup-time function. The value is in what does NOT change: no runtime behavior for well-formed data, no moves, no phase hooks, no `LegendaryGameState` field additions, no serialization changes, no caller touches. The risk profile is low but two invariants must stay tight:

1. **Canonical emission order byte-identical to `BOARD_KEYWORDS`** (D-8801) — one canonical order across the engine.
2. **Fresh array per card** (D-8802) — the aliasing-prevention rule that closes the WP-028 `cardKeywords` bug class before code exists.

If anything feels underdefined, re-read EC-088 (primary execution authority) and this prompt's §Locked Values. If still unclear — STOP and ask. Do not guess. Do not introduce helper functions. Do not expand scope. Do not add `trimStart()`. Do not promote the `Set` to `G`.

Post-mortem: optional. Skip unless you hit mid-session drift.

Good luck.
