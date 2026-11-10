# EC-917 — Schemes in the Effect-Implementation Index (Execution Checklist)

**Source:** docs/ai/work-packets/WP-879-scheme-effect-feed.md
**Layer:** Registry (schema) + Shared Tooling (generator) + App (dashboard `/debug/effects`)

## Before Starting
- [ ] Re-confirm `origin/main` HEAD (draft baseline `4fd75a15`). Record the registry,
      `effect-index:test` and dashboard pass counts before editing.
- [ ] Confirm `EFFECT_INDEX_ENTRY_SCOPES = ["hero", "villain", "mastermind"]` and the
      `.strict()` `byScope` `{ hero, villain, mastermind }` (`packages/registry/src/schema.ts`).
- [ ] Confirm no `scheme` scope, `readSchemes`, or `scheme-provenance.json` exists yet.
- [ ] **Scaffold the enum widening first.** Prototype the schema change, then
      `pnpm --filter @legendary-arena/registry build` **before** the dashboard
      typecheck (a stale dist is a false green). Grep `EffectIndexEntryScope` across
      `apps/` and `packages/`; fold any observed break in as an inline allowlist amendment.

## Every hardcoded `byScope` literal gains `scheme` (lockstep)
- `schema.ts` `EffectImplementationSummarySchema.byScope` — the type add.
- `schema.ts` `superRefine` `const scopeTally = { …, mastermind: 0 }` — **MUST-FIX or NaN.**
- `build-effect-implementation-index.mjs` `buildSummary` `byScope` — **MUST-FIX or NaN.**
- `apps/dashboard/src/composables/useEffectIndex.ts` `EMPTY_INDEX.byScope` — **MUST-FIX or vue-tsc break.**
- `apps/dashboard/scripts/build-effect-index.mjs` `EMPTY_INDEX_STUB` — `byScope` adds
  `mastermind: 0` + `scheme: 0`; `byStatus` adds `subsystem: 0`. This is for consistency only:
  the stub's `safeParse` fails by design.
- Test fixtures in `schema.effectImplementationIndex.test.ts` + `useEffectIndex.test.ts`.

## Locked Values (do not re-derive)
- New scope member: `"scheme"`. Scheme ext_id: `${setAbbr}-scheme-${schemeSlug}`; `set` = file-level `abbr`.
- Scheme source: `data/cards/{abbr}.json` → `schemes[]` (`slug`, `name`, `cards[].abilities[]`),
  files read in sorted `readdir` order; all of a Scheme's cards contribute.
- Label = text before the first `:`, then (1) strip a trailing quoted title
  `/\s*“[^“”]*[“”]\s*$/`, then (2) strip a trailing number list
  `/\s+\d+(?:\s*-\s*\d+)?(?:\s*,\s*(?:and\s+)?\d+)*$/`. Closed map:
  `Setup`→`setup`; `Special Rules`, `When revealed`→`special-rules`;
  `Twist`, `Twists`, `Other Twists`, `Master Strike or Twist`→`twist`;
  `Evil Wins`, `Chthon Wins`→`evil-wins`; `Good Wins`, `When the players win`→`good-wins`;
  **anything else (unlabelled lines, `[hc:…]` lead-ins, `{"points":…}` strings) → `special-rules`**.
  Expected totals at the baseline: 664 rows (setup 195, special-rules 104, twist 200, evil-wins 154,
  good-wins 11). A loss printed on a Twist line counts in `twist`.
- One entry per (Scheme, distinct mechanic) — three Twist lines are one `twist` row.
- Overlay: `scripts/coverage/scheme-provenance.json` =
  `{ "schemaVersion": 1, "_comment": "…", "schemes": { extId: { mechanic: { status, handler, wp,
  decision } } } }`. Seed = WP-879 §Seed evidence (12 Schemes, 39 rows). Rows are built with
  `normalizeTactic`, which gains a trailing `scope` param defaulting to `'mastermind'` (tactic and
  strike callers and the 4 test call sites stay unchanged; `readSchemes` passes `'scheme'`). Test: every scheme entry has
  `scope === 'scheme'`, and `byScope.scheme` equals the entry count.
- Absent from overlay → `status: "unmarked"`, `handler`/`wp`/`decision` = `""`.
- These throw, with a message naming the key: a `schemes` key or mechanic that matches no
  enumerated Scheme line (the check iterates `schemes` only), and an `executable` row with a
  blank `handler`.

## Guardrails
- Generator stays **engine-free**: card data + committed JSON; no `packages/game-engine` import.
- **Verbatim honesty:** a seeded line is `executable` only with evidence: a live-verify
  record or PR naming that Scheme (`live-verify.json` scheme entries; #2976; #3015), plus
  the engine symbol that runs the line as `handler`. An unevidenced line stays OUT of
  the overlay and is listed in the execution summary. Never fabricate.
- Scope enum, every `byScope` literal, `scopeLabel`, `SCOPE_FILTERS`, `.fx-scope-scheme`
  CSS and both `EMPTY_*` stubs widen together; `scheme` is handled explicitly everywhere.
- No engine / `G` / determinism / persistence / card-data change.
- Commit the regenerated `data/metadata/effect-implementation-index.json`; never hand-edit
  the gitignored `apps/dashboard/src/data/effect-implementation-index.json`.

## Required `// why:` Comments
- `scheme-provenance.json` `_comment`: identity generated from card data; status curated;
  seed limited to live-verified Schemes; unmarked = no curated evidence.
- `readSchemes`: one row per line kind (a Scheme's lines are implemented by different
  engine code, e.g. a `counter-only` Twist beside a real loss).
- The fold-into-`special-rules` default (closed vocabulary; every printed line accounted for).
- The orphan-overlay throw (the WP-867 rule).
- The new `scheme` scope member (closed-enum widening, D-24828).

## Files to Produce
- `packages/registry/src/schema.ts` + `schema.effectImplementationIndex.test.ts`
- `scripts/coverage/scheme-provenance.json` — **NEW**
- `scripts/build-effect-implementation-index.mjs` + `scripts/build-effect-implementation-index.test.ts`
- `data/metadata/effect-implementation-index.json` — regenerated
- `apps/dashboard/src/composables/useEffectIndex.ts` + `useEffectIndex.test.ts`
- `apps/dashboard/scripts/build-effect-index.mjs`
- `apps/dashboard/src/pages/debug/EffectsPage.vue` (also its subtitle)
- `wiki/debug-effects.md` (`source:` list; "three-scope" / "all three scopes" → four, lines 90, 116,
  284, 301, 336, 355)
- In the generator, also fix the stale "three-scope" text, the `buildCards` message and the
  `main()` summary log.

## After Completing
- [ ] `pnpm --filter @legendary-arena/registry build` 0; schema test green.
- [ ] `pnpm effect-index && pnpm effect-index:check && pnpm effect-index:test` 0; spot-check
      Brainwash (4 rows), Cosmic Cube (no `evil-wins`), Pulse Waves (`twist`), Sneak Attack (`unmarked`).
- [ ] Dashboard `typecheck` + `lint` + `format:check` + `test:coverage` + `build` 0; `pnpm -r build` 0;
      index = 2193 + 664 = 2857 entries; `git diff --name-only` = allowlist + artifact + governance.
- [ ] D-24828 landed Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `✅` + `roadmap:counts:write`; `STATUS.md`.
- [ ] D-24026 live-verify: `/debug/effects` Scheme filter shows ca75's four Schemes `executable`.

## Common Failure Smells
- `byScope.scheme` NaN / schema refinement fails → a hardcoded `byScope` literal was missed.
- Fallback stub fails to parse → `EMPTY_INDEX_STUB` still lacks `mastermind` / `scheme`.
- A Pulse Waves Twist becomes `special-rules` → the comma-list Twist label was not stripped.
- A seeded Scheme row is `executable` with an empty `handler` → evidence rule skipped.
- `effect-index:check` drifts run to run → card files or Schemes not iterated in sorted order.
