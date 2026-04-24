# WP-088 — Setup Module Hardening: `buildCardKeywords` Runtime Guards, Villain Pre-Index, Output Ordering

> **Status: READY (A0 SPEC bundle complete 2026-04-23).** WP-088 is registered
> in `docs/ai/work-packets/WORK_INDEX.md`; EC-088 is registered in
> `docs/ai/execution-checklists/EC_INDEX.md` (Status: Draft); the Prompt Lint
> Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`) has been run and
> recorded PASS — see **Appendix A** for the per-section verdict. All four
> Appendix A human-approval items (WP number, EC depth, emission-order lock,
> whitespace-tolerance deferral) are resolved via D-8801 / D-8803 and the
> WP-number audit at registration time.
>
> **Gating cleared:** (a) WP-050 merged to `main` 2026-04-23 at `ccdf44e`
> (see [WORK_INDEX.md:1291](../work-packets/WORK_INDEX.md)); (b) WP-088
> registered in `WORK_INDEX.md`; (c) 00.3 lint gate PASS recorded (Appendix A).
> The remaining prerequisite to execution is operational only: a pre-flight
> session (per `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`) + copilot
> check (`01.7`) yielding `READY TO EXECUTE` + `CONFIRM` before the session
> execution prompt is generated.
>
> **WP number note:** `WP-086` is memory-reserved for the registry viewer
> card-types upgrade (blocked on WP-084 landing first). `WP-087` is the
> type-alias / setup-only `readonly` hardening packet, landed 2026-04-23 at
> `73aeada` (scope-narrowed — `readonly` deferred per D-8702). `WP-088` is
> this packet and the next free number at registration time (verified against
> WORK_INDEX.md 2026-04-23).

## Goal

Harden `packages/game-engine/src/setup/buildCardKeywords.ts` against malformed
registry payloads, eliminate the O(V·F) flat-card rescan in the inner loop,
and future-proof the output shape for multi-keyword emission — all without
changing the exported function signature, the caller, `G.cardKeywords`
serialization shape, or any observable behavior for well-formed card data.
Purely an internal-hardening pass on one setup-time module, with a small,
explicitly enumerated set of in-file changes, zero caller touches, and
defensive (non-exhaustive) runtime guards that fail closed via local
`continue` rather than throwing.

## Assumes
- WP-050 complete (merged to `main`). This WP must not start while WP-050 is
  in flight; both sessions would otherwise land on overlapping parts of the
  engine setup surface.
- `buildCardKeywords` has exactly one production caller:
  `packages/game-engine/src/setup/buildInitialGameState.ts:173`. Re-verify at
  execution time that no additional call site has been introduced (grep for
  `buildCardKeywords\s*\(` under `packages/game-engine/src`).
- The villain `FlatCard.key` convention
  `${setAbbr}-villain-${groupSlug}-${cardSlug}` is still the registry's
  villain key format. This assumption is load-bearing for the pre-index
  lookup and must be re-verified against the registry's `listCards()` output
  before execution.
- `BoardKeyword` union remains `'ambush' | 'patrol' | 'guard'` per
  `packages/game-engine/src/board/boardKeywords.types.ts`. If a new keyword
  is added between draft and execution, §Scope item 4 (canonical ordering)
  must be revised.
- boardgame.io 0.50.x remains locked per `.claude/rules/game-engine.md`
  §boardgame.io Version. This WP does not touch `G`, moves, phases, or the
  rule pipeline.

## Context (Read First)
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — setup-only
  resolution pattern; engine may not import `@legendary-arena/registry`.
- `.claude/rules/game-engine.md` §Registry Boundary, §Zone Mutation Rules,
  §Prohibited Behaviors.
- `.claude/rules/code-style.md` §Abstraction & Control Flow (no `.reduce()`
  in zone operations / effect application), §Error Handling, §Comments
  (every non-obvious constant or predicate needs `// why:`).
- `docs/ai/work-packets/WP-025-keywords-patrol-ambush-guard.md` and
  `docs/ai/execution-checklists/EC-025-board-keywords.checklist.md` — the
  originating packet for this file; WP-088 is a follow-on hardening pass,
  not a behavior revision of EC-025.
- `docs/ai/DECISIONS.md` D-2302 — "Patrol and Guard have no data source in
  current card data; safe-skip until structured classification lands." This
  WP preserves D-2302 unchanged.

## Vision Alignment

**Vision clauses touched:** `§1, §2`.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.
For well-formed registry data, `cardKeywords` output is byte-identical
pre/post. The WP hardens against malformed input, pre-indexes villain
cards for O(V+F) lookup instead of O(V·F), and locks a canonical emission
order for future multi-keyword stability. No new keyword semantics are
introduced; Patrol and Guard remain safe-skip per D-2302.

**Non-Goal proximity check:** Not applicable — WP is not user-facing,
not paid, not persuasive, not competitive; `NG-1..7` are not crossed.

## Scope (In)

1. **Runtime shape validation for set data.** Add a private
   `isKeywordSetData(x: unknown): x is KeywordSetData` type guard that
   checks `typeof o.abbr === 'string'` and `Array.isArray(o.villains)`.
   Replace the existing unchecked
   `const setData = registry.getSet(...) as KeywordSetData | undefined`
   with a narrowed `if (!isKeywordSetData(rawSetData)) continue;`.
2. **Per-iteration shape guards inside the villain loop.** Before using
   `villainGroup.slug`, `villainGroup.cards`, `villainCard.slug`, and
   `villainCard.abilities`, validate each with narrow `typeof` /
   `Array.isArray` checks and `continue` on mismatch. Pass
   `Array.isArray(villainCard.abilities) ? villainCard.abilities : undefined`
   into `extractKeywordsFromAbilities`.
3. **Villain pre-index using a local `Set<string>`.** Before the outer
   `listSets()` loop, scan `allFlatCards` once and build
   `const villainExtIds = new Set<string>()` containing every
   `card.key` whose `cardType === 'villain'`. Inside the inner loop,
   construct the expected key
   `` `${setEntry.abbr}-villain-${villainGroup.slug}-${villainCard.slug}` ``
   and look it up via `villainExtIds.has(expectedKey)`. Delete the
   `findFlatCardForVillainCard` helper entirely. Keep the `Set` strictly
   local to the function body — it must never reach `G`.
4. **Canonical output ordering for `extractKeywordsFromAbilities`.** Replace
   the current push-and-break pattern with local boolean flags
   (`let hasAmbush = false;` only, for MVP) and, after the loop, emit into
   `BoardKeyword[]` in the canonical order
   `['patrol', 'ambush', 'guard']` — **byte-identical to `BOARD_KEYWORDS`**
   at `packages/game-engine/src/board/boardKeywords.types.ts:24`, so the
   engine carries one canonical order, not two (see D-8801). MVP still
   only flips `hasAmbush`; Patrol / Guard remain safe-skip per D-2302.
   The output for today's data stays byte-identical (`['ambush']` or `[]`);
   the change is structural, to lock snapshot stability: without a canonical
   emission order, future Patrol / Guard enablement would introduce
   non-semantic diffs between otherwise-equivalent `cardKeywords` records
   on cards that carry multiple keywords simultaneously. Each card's
   `result[extId]` must be a freshly-constructed `BoardKeyword[]` — never
   a reference to the shared canonical array or to any other card's
   `result` entry (see D-8802 for the aliasing prohibition and WP-028
   post-mortem precedent).
5. **Remove unused fields from `KeywordSetData`.** Delete the
   interface-level `abbr: string` declaration (callers already consume
   `setEntry.abbr` from the index produced by `listSets()`; only the
   `KeywordSetData` copy is unused — `setEntry.abbr` usage is preserved)
   and `henchmen: unknown[]` (the file no longer touches henchmen data;
   the existing deferral comment on henchman keyword extraction remains
   in the function body).
6. **Tighten return-contract JSDoc.** In the `buildCardKeywords` JSDoc,
   drop the clause that asserts caller behavior ("moves handle missing
   cardKeywords entries gracefully") and replace it with a local
   contractual statement ("returns empty record when the registry does not
   satisfy `CardKeywordsRegistryReader`; callers must treat a missing entry
   as no keywords"). No behavior change.
7. **One `// why:` comment at each new predicate or locked value.**
   Specifically: the `isKeywordSetData` guard, the per-iteration guards,
   the villain pre-index (rationale: avoid O(V·F) rescan; `Set` is local,
   never in `G` — cite D-8802), and the canonical ordering array (cite
   D-8801 for the order lock *and* D-8802 for the per-card fresh-array
   prohibition; without the fresh-array note, a future editor could alias
   multiple cards' entries to the same array instance — the WP-028
   `cardKeywords` post-mortem precedent).

## Out of Scope

- **Whitespace-tolerant Ambush detection** (e.g., `ability.trimStart()`).
  Deferred per D-8803. The existing `// why:` comment asserts a verified
  data invariant ("consistently start with 'Ambush' (capital A) across
  all 304 occurrences"). Adding tolerance hides upstream data drift.
  Reversal requires a new WP + new D-NNNN entry explicitly overturning
  D-8803, citing the concrete registry drift that motivated it
  (D-8803 §"Reversal conditions").
- **Patrol / Guard data-source work.** D-2302 remains in force. No
  ability-text heuristic for Patrol or Guard is added here.
- **Henchman keyword extraction.** The in-file deferral comment stays
  unchanged. A future WP will introduce structured keyword classification
  for group-level henchman text.
- **Changing the `buildCardKeywords` signature** or any of its four
  structural interfaces' names. `MatchSetupConfig` remains a formal param
  (underscore-prefixed); the first argument remains `unknown`.
- **Modifying the caller.** `buildInitialGameState.ts:173` is not touched.
- **Changing `G.cardKeywords` serialization shape.** The output type
  stays `Record<CardExtId, BoardKeyword[]>`; `readonly` return-type
  propagation belongs in a WP-087-class type-hardening pass.
- **Adding new tests beyond the existing simulation / setup coverage.**
  The existing build + test baseline is the acceptance bar; any new test
  would be either redundant with existing coverage or scope-creep.
- **Any other file under `packages/game-engine/src/setup/`.**

## Files Expected to Change

- `packages/game-engine/src/setup/buildCardKeywords.ts` — modified — all
  seven Scope items applied in-file. Net line delta is negative (helper
  deletion + field removal outweighs added guards). No new imports; no
  new exports.
- `docs/ai/DECISIONS.md` — **already updated by the A0 SPEC bundle**
  (2026-04-23) with three entries that cover the WP-088 rationale set:
  - **D-8801** — canonical keyword emission order `['patrol', 'ambush',
    'guard']`, byte-identical to `BOARD_KEYWORDS`, locking snapshot
    stability under future Patrol / Guard activation.
  - **D-8802** — villain pre-index as the O(V·F) → O(V+F) fix with
    `Set<string>` locality invariant, plus the per-card fresh-array
    construction invariant (WP-028 `cardKeywords` aliasing precedent).
  - **D-8803** — whitespace-tolerant Ambush detection deferred with
    explicit reversal conditions; the existing `// why:` comment stands.
  At execution close, append a new `D-NNNN` entry **only** if the
  runtime-guard work surfaces a previously-unrecorded invariant not
  already covered by D-8801 / D-8802 / D-8803. Do not re-author or
  duplicate those three entries.
- `docs/ai/work-packets/WORK_INDEX.md` — check off WP-088 on completion.
- `docs/ai/execution-checklists/EC_INDEX.md` — mark EC-088 Done on
  completion.
- `docs/ai/STATUS.md` — one-line note that the setup-module hardening
  landed.

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents required for every new or modified file — no diffs,
  no snippets, no "show only the changed section".
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- `pnpm -r build` and `pnpm test` both pass with zero new warnings and
  identical test count to the pre-change baseline.

**Packet-specific:**
- Single-file internal-hardening change. No runtime behavior change for
  well-formed card data.
- No `boardgame.io` import. No `@legendary-arena/registry` import.
- No new dependencies.
- No `.reduce(` anywhere in the target file.
- `buildCardKeywords` signature stays byte-identical; caller
  (`buildInitialGameState.ts:173`) is not touched.
- No change to `G.cardKeywords` serialization shape.
- Villain pre-index `Set<string>` is strictly function-local — never
  returned, exported, or placed in `G` (JSON-serializability invariant;
  D-8802).
- Every `result[extId]: BoardKeyword[]` value is a freshly-constructed
  array — never a reference to a shared module-level constant or to
  another card's `result` entry (D-8802; WP-028 aliasing precedent).
- No whitespace-tolerance change (`trimStart()`) to Ambush detection —
  the existing verified-invariant `// why:` comment stands (D-8803).
- Locked test baseline (re-measure at session open; abort if diverged):
  - Engine: `506 / 113 / 0` post-WP-087 at `73aeada`.
  - Repo-wide: `671 / 127 / 0` post-WP-051 at `ce3bffb`.
  - No test count change permitted by WP-088 (no new tests; no deletions).

**Session protocol:**
- Stop and ask before proceeding if any unclear item is encountered.
- If the villain `FlatCard.key` format has drifted from
  `${setAbbr}-villain-${groupSlug}-${cardSlug}` since WP-088 was drafted,
  stop — the pre-index lookup's correctness depends on this invariant.
- If the `BoardKeyword` union has grown beyond
  `'patrol' | 'ambush' | 'guard'` between draft and execution, stop and
  revise both the canonical-order array in `buildCardKeywords.ts` **and**
  `BOARD_KEYWORDS` in `boardKeywords.types.ts` before proceeding — they
  must remain byte-identical per D-8801. The drift-detection test
  (`.claude/rules/code-style.md` §Drift Detection) will fire on a
  mismatch, so treat any failure of that test as a hard STOP.

**Locked contract values:**
- Target file (sole production file modified):
  `packages/game-engine/src/setup/buildCardKeywords.ts`.
- Caller not modified:
  `packages/game-engine/src/setup/buildInitialGameState.ts:173`.
- Villain key format (verbatim):
  `` `${setAbbr}-villain-${groupSlug}-${cardSlug}` ``.
- Canonical keyword emission order (verbatim):
  `['patrol', 'ambush', 'guard']` — byte-identical to `BOARD_KEYWORDS` at
  `packages/game-engine/src/board/boardKeywords.types.ts:24` per D-8801.
- Private guard name (verbatim): `isKeywordSetData`.
- Deleted helper (verbatim): `findFlatCardForVillainCard`.
- Function signature (byte-identical pre/post):
  `export function buildCardKeywords(registry: unknown, _matchConfig: MatchSetupConfig): Record<CardExtId, BoardKeyword[]>`.

## Acceptance Criteria

- [ ] `packages/game-engine/src/setup/buildCardKeywords.ts` exports
      `buildCardKeywords(registry: unknown, _matchConfig: MatchSetupConfig):
      Record<CardExtId, BoardKeyword[]>` with the signature byte-identical
      to the pre-change version.
- [ ] `isKeywordSetData` exists as a private function with a `// why:`
      comment and is the sole mechanism by which `unknown` is narrowed to
      `KeywordSetData` inside the function body.
- [ ] Per-iteration guards reject a villain group with non-string
      `slug` or non-array `cards` via `continue`; reject a villain card
      with a missing or non-string `slug` via `continue`; normalize
      non-array `abilities` to `undefined` before
      `extractKeywordsFromAbilities`.
- [ ] `findFlatCardForVillainCard` is deleted. Villain lookup uses a
      locally-scoped `Set<string>` built once before the `listSets()`
      loop. The `Set` is never returned, assigned to `G`, or exported.
- [ ] `extractKeywordsFromAbilities` uses local boolean flags and emits
      keywords in the canonical order `['patrol', 'ambush', 'guard']` —
      byte-identical to `BOARD_KEYWORDS` at
      `packages/game-engine/src/board/boardKeywords.types.ts:24` per
      D-8801. Every `result[extId]` is a freshly-constructed
      `BoardKeyword[]` — never a reference to the canonical-order array
      or to another card's entry (D-8802). The canonical-order site
      carries a `// why:` comment citing both D-8801 and D-8802.
- [ ] `KeywordSetData` no longer declares `abbr` or `henchmen`. All other
      structural interfaces (`KeywordVillainCardEntry`,
      `KeywordVillainGroupEntry`, `KeywordFlatCard`,
      `CardKeywordsRegistryReader`) are preserved verbatim.
- [ ] `buildCardKeywords` JSDoc's return-contract sentence is local /
      contractual ("returns empty record when the registry does not
      satisfy `CardKeywordsRegistryReader`; callers must treat a missing
      entry as no keywords") and no longer asserts caller behavior.
- [ ] `pnpm -r build` and `pnpm test` both pass with zero new TS errors,
      zero new warnings, and identical test count to the pre-change
      baseline.
- [ ] No file outside `## Files Expected to Change` was modified —
      including the explicit negative guarantee that
      `buildInitialGameState.ts` is byte-identical to its pre-change
      content.
- [ ] Governance docs updated: new D-NNNN entry appended to
      `docs/ai/DECISIONS.md` covering the four rationale points listed
      under `## Files Expected to Change`; `docs/ai/work-packets/WORK_INDEX.md`
      shows WP-088 checked off with a completion date; and
      `docs/ai/execution-checklists/EC_INDEX.md` marks EC-088 Done.
- [ ] No `try/catch` blocks were added; all malformed-data handling is
      via narrow runtime guards and `continue`, preserving setup
      determinism.

## Verification Steps

```pwsh
# 1. Full build — must pass with zero errors.
pnpm -r build
# Expected: all packages build; zero TS errors.

# 2. Full test suite — must match pre-change count.
pnpm test
# Expected: full suite green; test count matches pre-change baseline.

# 3. Type-only check on the engine package.
pnpm --filter game-engine exec tsc --noEmit
# Expected: zero errors.

# 4. Invariant: no `.reduce(` anywhere in the target file.
Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" `
  -Pattern "\.reduce\("
# Expected: no matches.

# 5. Invariant: no boardgame.io or registry imports in the target file.
Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" `
  -Pattern "from\s+['""](boardgame\.io|@legendary-arena/registry)"
# Expected: no matches.

# 6. Invariant: `findFlatCardForVillainCard` has been removed.
Select-String -Path "packages/game-engine/src/**/*.ts" `
  -Pattern "findFlatCardForVillainCard"
# Expected: no matches.

# 7. Invariant: exactly one production call site of buildCardKeywords.
Select-String -Path "packages/game-engine/src/**/*.ts" `
  -Pattern "buildCardKeywords\s*\(" -Exclude "*.test.ts"
# Expected: exactly two hits — the declaration in buildCardKeywords.ts
# and the call site in buildInitialGameState.ts. No third.
```

## Definition of Done
This packet is complete when ALL of the following are true:
- [ ] All acceptance criteria pass.
- [ ] `docs/ai/STATUS.md` updated with a one-line summary explicitly
      noting **setup-time hardening only; no runtime behavior change**.
- [ ] `docs/ai/DECISIONS.md` updated with the D-NNNN entry described above.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has this packet checked off with
      a completion date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` marks EC-088 Done.
- [ ] No files outside `## Files Expected to Change` were modified.

---

## Appendix A — Prompt Lint Gate (00.3) — Verdict: PASS

**Run date:** 2026-04-23 (same-day as A0 SPEC bundle).
**Gate document:** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`.
**Verdict:** **PASS** on every applicable section. Zero unresolved deferrals.

| 00.3 Section | Verdict | Notes |
|---|---|---|
| §1 Work Packet Structure | PASS | All required sections present: Goal, Assumes, Context, Scope (In), Out of Scope, Files Expected to Change, Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition of Done. |
| §2 Non-Negotiable Constraints Block | PASS | Engine-wide / Packet-specific / Session protocol / Locked contract values sub-bullets match `PACKET-TEMPLATE.md`. Full-file-output requirement and `00.6-code-style.md` reference present. Test baseline locked (506/113/0 + 671/127/0). |
| §3 Prerequisites | PASS | `## Assumes` lists WP-050 gating (now resolved — WP-050 done at `ccdf44e`), grep-based invariants, `BoardKeyword` union stability, boardgame.io version lock. |
| §4 Context References | PASS | Specific sections cited: ARCHITECTURE Layer Boundary; game-engine rules §Registry Boundary + §Zone Mutation Rules + §Prohibited Behaviors; code-style §Abstraction & Control Flow + §Error Handling + §Comments; WP-025 / EC-025; D-2302; D-8801 / D-8802 / D-8803. |
| §5 Output Completeness | PASS | Every modified file enumerated with a one-line description. Target file explicit; governance docs (DECISIONS / WORK_INDEX / EC_INDEX / STATUS) enumerated. |
| §6 Naming Consistency | PASS | No abbreviations. Structural interface names preserved verbatim (`KeywordVillainCardEntry`, `KeywordVillainGroupEntry`, `KeywordFlatCard`, `CardKeywordsRegistryReader`). |
| §7 Dependency Discipline | PASS | No new packages. Explicit forbidden-import re-statement: no `boardgame.io`; no `@legendary-arena/registry`. |
| §8 Architectural Boundaries | PASS | Game Engine / setup-time only. Registry consumed structurally via the `registry: unknown` + local interface + runtime type guard pattern (WP-014B / WP-025 precedent). |
| §9 Windows Compatibility | PASS | Verification uses `pwsh` + `Select-String`; no Unix-only tools. |
| §10 Mutation Discipline | PASS | Setup-time function; no `G` mutation. `Set<string>` strictly function-local per D-8802. No `.reduce(`. |
| §11 Framework Neutrality | PASS | No `ctx.events.*`; no `ctx.random.*`; no phase / turn / move touchpoints. |
| §12 Test Strategy | PASS | Zero new tests; existing simulation / setup coverage is the acceptance bar. Baseline locked in Non-Negotiable Constraints. |
| §13 Commands and Verification | PASS | Exact commands with expected output (six `pwsh` / `pnpm` invocations). |
| §14 Acceptance Criteria Quality | PASS | 10 items; all binary, observable, specific. Negative guarantees included (no caller change, no signature change, no serialization shape change). |
| §15 Definition of Done | PASS | Includes STATUS, DECISIONS, WORK_INDEX, EC_INDEX, and file-boundary check. |
| §16–17 Code Style & Vision Alignment | PASS | No premature abstraction. `## Vision Alignment` section cites `§1, §2` with explicit "No conflict" / byte-identical-for-well-formed-data assertion + Non-Goal proximity check. |
| §18 Prose-vs-Grep Discipline | PASS | Every mechanical claim in `## Assumes` tied to a re-runnable grep: single-call-site (`buildCardKeywords\s*\(` under `packages/game-engine/src`), villain-key-format (runtime spot-check in EC §Before Starting), `BoardKeyword` union stability (grep of `boardKeywords.types.ts`). |
| §19 Bridge-vs-HEAD Staleness | PASS | Line reference `buildInitialGameState.ts:173` verified 2026-04-23 during the pre-flight bundle — still points to `const cardKeywords = buildCardKeywords(registry as unknown, config);`. |

**Resolved human-approval items (originally listed in the pre-lint draft; closed by this bundle):**

1. **WP-088 is the final number.** Audited at registration time against `WORK_INDEX.md` (2026-04-23): no intervening WP has claimed the number. `WP-085` through `WP-087` are accounted for; `WP-089` / `WP-090` are drafted but unregistered as of the prior index state — WP-088 slots cleanly between WP-087 (Done) and WP-089 (Ready, drafted).
2. **EC-088 is the right depth.** Confirmed. The change is split across seven numbered in-file edits with drift-prone locked values (canonical keyword order, villain key format, `Set` locality invariant, per-card fresh-array rule). The EC's length is proportional to the discipline it encodes.
3. **Canonical emission order is `['patrol', 'ambush', 'guard']`** — byte-identical to `BOARD_KEYWORDS` at `boardKeywords.types.ts:24`. Locked by **D-8801**. Alternatives (listed / alphabetical) rejected with rationale in the decision entry. The two-canonical-array divergence surfaced during pre-flight is eliminated by this choice.
4. **Whitespace-tolerance deferral is accepted.** Locked by **D-8803** with explicit reversal conditions (new WP + new `D-NNNN` entry citing concrete registry drift). The existing `// why:` comment at `buildCardKeywords.ts:209-212` stands verbatim.

**Addenda locked by this bundle (beyond the original draft):**

- **D-8802** adds an explicit per-card fresh-array construction invariant to complement the villain pre-index locality rule — closes the WP-028 `cardKeywords` aliasing class of bug before code exists. EC-088 `## Guardrails` carries the rule; the canonical-order `// why:` comment must cite both D-8801 and D-8802.
- Test baseline captured in Non-Negotiable Constraints (engine 506/113/0 + repo 671/127/0 at `ce3bffb`), to be re-measured at session open.

Lint gate status: **PASS.** No unresolved findings. Appendix A is authoritative over any conflicting "preliminary self-check" language that may survive elsewhere in prior drafts.
