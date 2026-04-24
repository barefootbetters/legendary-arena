# EC-088 — Setup Module Hardening: `buildCardKeywords` (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-088-build-card-keywords-hardening.md`
**Layer:** Game Engine (setup-time only)

> **Status: DRAFT, execution-ready.** A0 SPEC bundle complete 2026-04-23:
> (a) WP-050 merged to `main` at `ccdf44e` — see
> [WORK_INDEX.md:1291](../work-packets/WORK_INDEX.md); (b) WP-088 registered
> in `WORK_INDEX.md`; (c) 00.3 lint gate PASS recorded in WP-088 §Appendix A;
> (d) EC-088 registered in `EC_INDEX.md`. Emission-order lock, aliasing
> invariant, and whitespace-tolerance deferral are locked by
> **D-8801 / D-8802 / D-8803** respectively. Remaining prerequisite is a
> pre-flight (`01.4`) + copilot check (`01.7`) session yielding
> `READY TO EXECUTE` + `CONFIRM` before a session execution prompt is
> generated.

## Before Starting

- [ ] WP-050 merged to `main`; WP-088 registered in `WORK_INDEX.md`; 00.3
      lint gate passed for WP-088
- [ ] No parallel session is editing
      `packages/game-engine/src/setup/buildCardKeywords.ts` or
      `packages/game-engine/src/setup/buildInitialGameState.ts`
- [ ] Baseline captured and matches locked values: `pnpm -r build` exits 0;
      `pnpm test` exits 0 with engine `506 / 113 / 0` (post-WP-087 at
      `73aeada`) and repo-wide `671 / 127 / 0` (post-WP-051 at `ce3bffb`).
      If either diverges, STOP — revise WP-088 Non-Negotiable Constraints
      and re-run pre-flight before proceeding
- [ ] Single-call-site invariant verified: the grep
      `buildCardKeywords\s*\(` under `packages/game-engine/src/**/*.ts`
      (excluding `*.test.ts`) returns exactly two hits — the declaration
      and the call site in `buildInitialGameState.ts`
- [ ] Villain key-format invariant spot-checked: at least one entry in
      `registry.listCards()` with `cardType === 'villain'` matches the
      format `${setAbbr}-villain-${groupSlug}-${cardSlug}`
- [ ] `BoardKeyword` union in
      `packages/game-engine/src/board/boardKeywords.types.ts` is still
      `'patrol' | 'ambush' | 'guard'` AND `BOARD_KEYWORDS` canonical array
      at the same file is still `['patrol', 'ambush', 'guard']` (the two
      must remain byte-identical per D-8801). If a new keyword has been
      added, STOP and revise WP-088 §Scope item 4 and the canonical
      emission-order array together before proceeding — they must remain
      byte-identical to `BOARD_KEYWORDS`

> **Execution Abort Conditions (Hard STOP):**
> If any invariant in **Before Starting** fails — WP-050 not merged,
> a parallel session is editing the target or caller, the `BoardKeyword`
> union has expanded, the villain `FlatCard.key` format has drifted,
> or additional production call sites of `buildCardKeywords` have been
> introduced — STOP execution immediately and revise WP-088 before
> proceeding. Do not "adapt in place."

## Locked Values (do not re-derive)

- Target file (sole production file modified):
  `packages/game-engine/src/setup/buildCardKeywords.ts`
- Caller (not modified):
  `packages/game-engine/src/setup/buildInitialGameState.ts:173`
- Villain key format (verbatim):
  `` `${setAbbr}-villain-${groupSlug}-${cardSlug}` ``
- Canonical keyword emission order (verbatim):
  `['patrol', 'ambush', 'guard']` — byte-identical to `BOARD_KEYWORDS`
  at `packages/game-engine/src/board/boardKeywords.types.ts:24` per
  D-8801. The emission-order array is referenced for iteration order
  only; each card's `result[extId]` is a fresh `BoardKeyword[]` per
  D-8802.
- Aliasing prohibition (D-8802): every `result[extId]` value is a
  freshly-constructed `BoardKeyword[]`. The canonical-order array must
  never be returned by reference, assigned directly to a result entry,
  or shared across cards. The simplest safe pattern is a new
  `const keywords: BoardKeyword[] = []` per villain card, with `push()`
  driven by the canonical order plus local boolean flags.
- Villain pre-index `Set<string>` locality (D-8802): never assigned to
  `G`, returned, exported, or passed across the function boundary.
  Ceases to exist when `buildCardKeywords` returns.
- Locked test baseline (D-8801/D-8802/D-8803 are scope-neutral; no
  new tests permitted):
  - Engine: `506 / 113 / 0` at `73aeada`.
  - Repo-wide: `671 / 127 / 0` at `ce3bffb`.
- Private guard name (verbatim): `isKeywordSetData`
- Deleted helper (verbatim): `findFlatCardForVillainCard`
- Function signature (byte-identical pre/post):
  `export function buildCardKeywords(registry: unknown, _matchConfig: MatchSetupConfig): Record<CardExtId, BoardKeyword[]>`
- Structural interfaces preserved verbatim:
  `KeywordVillainCardEntry`, `KeywordVillainGroupEntry`,
  `KeywordFlatCard`, `CardKeywordsRegistryReader`
- Structural interface fields deleted:
  `KeywordSetData.abbr`, `KeywordSetData.henchmen`
- Runtime-type-guard name (verbatim, preserved, **not modified by this
  EC** — its body and declaration stay byte-identical):
  `isCardKeywordsRegistryReader`

## Guardrails

- Do NOT change the `buildCardKeywords` signature, the parameter names,
  or the return type
- Do NOT modify `buildInitialGameState.ts` or any other caller
- Do NOT add a `trimStart()` / whitespace-tolerance branch to Ambush
  detection (explicit §Out of Scope item; the existing `// why:` comment
  asserts the data invariant)
- Do NOT introduce Patrol or Guard ability-text heuristics
  (D-2302 preserved)
- Do NOT touch henchman handling; the in-file deferral comment remains
- Do NOT place the villain `Set<string>` in `G`, return it, export it,
  or pass it across the function boundary — it is strictly local
  (D-8802)
- Do NOT return the canonical-order array by reference, assign it
  directly to any `result[extId]`, or hoist it to a shared module-level
  constant returned by the function. Every `result[extId]` is a
  freshly-constructed `BoardKeyword[]` per D-8802 (WP-028 aliasing
  precedent). The simplest safe pattern: a new
  `const keywords: BoardKeyword[] = []` per villain card with `push()`
  driven by the canonical order + local boolean flags
- Do NOT import `boardgame.io` or `@legendary-arena/registry`
- Do NOT introduce `.reduce(` anywhere in the target file
- Do NOT add new tests; the existing build + test baseline is the
  acceptance bar
- Do NOT rename or split any of the four preserved structural interfaces
- Do NOT run `eslint --fix`, `prettier --write`, or any blanket
  formatter / code-generation pass
- No files outside `## Files to Produce` are modified

## Required `// why:` Comments

- On the `isKeywordSetData` declaration — cite that the registry package
  is not imported at this layer, so shape is validated structurally at
  runtime before cast-narrowing
- On the villain pre-index `const villainExtIds = new Set<string>()`
  declaration — cite (1) the O(V·F) → O(V+F) rationale and (2) the
  invariant that this `Set` is strictly function-local and never placed
  in `G` (JSON-serializability constraint; **cite D-8802**)
- On the canonical keyword emission order — **cite both D-8801 and
  D-8802** (three sentences minimum): (1) order is locked to match
  `BOARD_KEYWORDS` per D-8801 so the engine carries one canonical order,
  not two; (2) adding a new `BoardKeyword` requires revising both this
  array and `BOARD_KEYWORDS` together — the drift-detection test fires
  on mismatch; (3) the canonical-order array is referenced for iteration
  order only — each `result[extId]` is a freshly-constructed
  `BoardKeyword[]` per D-8802 (WP-028 `cardKeywords` aliasing precedent)
- Preserved verbatim (do not rewrite): the existing `// why:` comments
  on `isCardKeywordsRegistryReader`, on the Ambush prefix-match
  predicate (304 occurrences, case-sensitive rationale), on the
  Patrol / Guard safe-skip (D-2302), and on the henchman deferral

## Files to Produce

- `packages/game-engine/src/setup/buildCardKeywords.ts` — **modified** —
  apply all seven WP-088 §Scope items in-file; delete
  `findFlatCardForVillainCard`; remove `KeywordSetData.abbr` and
  `KeywordSetData.henchmen`; add `isKeywordSetData`; add villain
  `Set<string>` pre-index; rewrite `extractKeywordsFromAbilities` to
  use local boolean flags and canonical ordering; tighten
  `buildCardKeywords` JSDoc's return-contract sentence
- `docs/ai/DECISIONS.md` — **already updated by A0 SPEC bundle** with
  **D-8801** (emission order aligned with `BOARD_KEYWORDS`), **D-8802**
  (villain pre-index locality + per-card fresh-array construction), and
  **D-8803** (whitespace-tolerance deferral). At execution close, append
  one additional `D-NNNN` entry if runtime-guard hardening surfaces any
  previously-unrecorded invariant (expected: none — the three A0 entries
  cover the full scope). Do not re-author D-8801..D-8803 content
- `docs/ai/STATUS.md` — **modified** — one-line note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-088
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — mark
  EC-088 Done

## After Completing

- [ ] `pnpm -r build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm test` exits 0 with test count identical to the Before
      Starting baseline
- [ ] `pnpm --filter game-engine exec tsc --noEmit` exits 0
- [ ] `buildInitialGameState.ts` is byte-identical to its pre-change
      content
- [ ] Grep invariant passes with zero matches:
      `Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "\.reduce\("`
- [ ] Grep invariant passes with zero matches:
      `Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "from\s+['""](boardgame\.io|@legendary-arena/registry)"`
- [ ] Grep invariant passes with zero matches:
      `Select-String -Path "packages/game-engine/src/**/*.ts" -Pattern "findFlatCardForVillainCard"`
- [ ] Grep invariant passes with zero matches (no `try/catch` introduced):
      `Select-String -Path "packages/game-engine/src/setup/buildCardKeywords.ts" -Pattern "try\s*\{"`
- [ ] Grep invariant passes with exactly two hits (declaration + caller):
      `Select-String -Path "packages/game-engine/src/**/*.ts" -Pattern "buildCardKeywords\s*\(" -Exclude "*.test.ts"`
- [ ] Test-count identity verified — engine exactly `506 / 113 / 0` and
      repo-wide exactly `671 / 127 / 0`, matching the Before Starting
      baseline byte-for-byte. A changed count means a test was deleted,
      duplicated, or scope-crept in
- [ ] Aliasing self-audit (D-8802): manually trace every line that
      writes to `result[<extId>]`. Confirm each write assigns a
      freshly-constructed `BoardKeyword[]` (not a reference to the
      canonical-order array, not a shared module-level constant, not
      another card's `result` entry). If any `result[extId] =
      BOARD_KEYWORDS` or `result[extId] = <module-level const>` pattern
      appears, the aliasing invariant is broken — revert and use the
      per-card fresh-array pattern
- [ ] `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, and `EC_INDEX.md`
      all updated per `## Files to Produce` (D-8801 / D-8802 / D-8803
      already landed by the A0 SPEC bundle — verify present, do not
      duplicate)

## Common Failure Smells

- Test count changed from the Before Starting baseline → a test was
  deleted, duplicated, or scope-crept in
- `buildInitialGameState.ts` appears in the diff → caller was touched;
  revert and restart that edit
- New import in `buildCardKeywords.ts` → boundary violation; only the
  pre-existing **type-only** imports (`import type { CardExtId }`,
  `BoardKeyword`, `MatchSetupConfig`) should remain
- `Set<string>` leaked into `G`, a return value, or an exported symbol
  → JSON-serializability invariant broken; the `Set` must be strictly
  local to `buildCardKeywords`'s body
- `extractKeywordsFromAbilities` still uses `break` after a push →
  ordering rewrite was not applied; refactor to local booleans +
  canonical-order emission
- `KeywordSetData` still declares `abbr` or `henchmen` → field removal
  was skipped; re-check §Scope item 5
- A `trimStart()` call appears on an ability string → whitespace
  tolerance was added despite the §Out of Scope guardrail
- `eslint --fix` / `prettier --write` diff present anywhere outside
  the target file → formatter-pass guardrail was violated
- `result[extId] = BOARD_KEYWORDS` (or assignment to any shared
  module-level array, or to another card's `result` entry, or to the
  canonical-order array by reference) → D-8802 aliasing invariant
  broken; two cards' entries now point at the same array instance and
  consumer mutation will propagate across cards. Revert to the per-card
  fresh-array pattern (`const keywords: BoardKeyword[] = []` inside the
  villain-card loop, `push()` driven by canonical order + local boolean
  flags)
- Emission-order array declared as `['ambush', 'patrol', 'guard']` (or
  any order other than `['patrol', 'ambush', 'guard']`) → D-8801 order
  lock broken; the engine now carries two canonical orders. Re-align to
  `BOARD_KEYWORDS` and verify the drift-detection test still passes
