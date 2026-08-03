# EC-526 — Hero Ledger Design Attribution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-491-hero-ledger-per-design-granularity.md
**Layer:** Shared Tooling (ledger/index generators) + Registry (`EffectImplementationIndexSchema`) + App (`apps/dashboard` — `/debug/effects` + `/coverage`)

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (the ledger generator imports registry + engine `dist`)
- [ ] Hero ledger has no `designs` yet: `node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); process.exit(d.cardType==='hero'&&d.schemaVersion===1&&!('designs'in d.rows[0])?0:1)"` → exit 0 (if present, this WP already ran — STOP)
- [ ] Index has no `designs` yet: `node -e "const d=require('./data/metadata/effect-implementation-index.json'); process.exit(d.version===1&&!d.entries.some(e=>'designs'in e)?0:1)"` → exit 0
- [ ] Both viewers + coverage types present: `test -f apps/dashboard/src/pages/debug/EffectsPage.vue && test -f apps/dashboard/src/pages/coverage/CoveragePage.vue && test -f apps/dashboard/src/types/coverage.ts` → OK
- [ ] Villain ledger per-card (parity ref): `node -e "process.exit(require('./docs/ai/coverage/villain-mechanic-ledger.json').rows[0].cardName?0:1)"` → exit 0
- [ ] listCards per-design: `node --input-type=module -e "import {createRegistryFromLocalFiles} from './packages/registry/dist/index.js'; const r=await createRegistryFromLocalFiles({metadataDir:'./data/metadata',cardsDir:'./data/cards'}); const s=r.listCards().filter(c=>c.cardType==='hero'&&c.extId==='core/black-widow').map(c=>c.slug); process.exit(new Set(s).size>=4&&s.includes('silent-sniper')?0:1)"` → exit 0
- [ ] Working tree clean except for this WP

## Locked Values (do not re-derive)
- **Row identity UNCHANGED — additive attribution, NOT a re-partition.** The hero ledger keeps **one row per `(extId, mechanic)`** exactly as today; add a `designs` array field to each row. Do NOT emit one row per design (that would create 246 duplicate `(extId, mechanic)` rows, break both viewers' keys, and inflate `/coverage` counts). The row COUNT and the `summary` block must be byte-identical to the pre-WP ledger
- `designs` value: per `(extId, mechanic)`, the **slug-sorted, slug-deduped** array of `{slug, name}` of the design(s) whose abilities carry that mechanic's marker; `[]` for the hero-level `(unmarked)` row. Derive by iterating the hero's per-design `listCards()` entries and reusing the EXISTING `normalizeMechanicToken`/`reduceParameterizedKeyword`/`foldMechanicFamily` pipeline per design (so a design's mechanics classify identically to today's merged set). **Each design appears at most once per row** even when it prints the mechanic on 2+ ability lines (e.g. `cyber-specter` prints `[keyword:Cyber-Mod]` twice) — the per-design `extractMechanics()` Set already dedups; carry that through to the row's `designs`
- Unmarked: UNCHANGED — a `(unmarked)` row fires only when a hero has zero markers across ALL designs (the existing 46-hero behavior); its `designs` is `[]`. Do NOT introduce per-design unmarked rows (operator ruling — would grow the registry-viewer glossary `unmarked` bucket 46→~231)
- Composition-marker status: still classified by the hero-deck's `buildHeroAbilityHooks` `resolvedMarkers` (per-deck) — unchanged; only the `designs` attribution is new
- `SCHEMA_VERSION` → **2**; CSV gains a `designs` column (pipe-joined design slugs; empty for unmarked); the existing row sort is UNCHANGED (rows stay unique); sort each row's `designs` by slug for byte-stability
- Schema: `EffectDesignSchema = z.object({ slug: z.string().min(1), name: z.string().min(1) }).strict()`; add `designs: z.array(EffectDesignSchema).min(1).optional()` to `EffectImplementationEntrySchema` (present ⇒ non-empty); export inferred `EffectDesign`. `version` stays `z.literal(1)`; NO `cards{}`/`summary` change
- Index pass-through: in `normalizeRow`, when `scope==='hero'` AND `row.designs` is non-empty, set `designs: row.designs`; villain + unmarked-hero rows omit it. NO sort-key change (rows stay one per `(extId, mechanic)`)
- `/debug/effects`: add a **Design** column after Card in `EffectsPage.vue`, rendering the entry's `designs` joined by name (`"—"` when absent). Row `:key` UNCHANGED. `useEffectIndex` haystack adds design names
- `/coverage`: add `designs?: { slug: string; name: string }[]` to `LedgerRow` (`apps/dashboard/src/types/coverage.ts`); add a **Design** column after Card in `CoveragePage.vue`'s by-card table, rendering `row.designs` joined by name (`"—"` when empty). Row `:key` UNCHANGED. Touch NO metric/worklist/summary logic in `useCoverageLedger.ts`
- **Build order (RS-1):** after editing `schema.ts`, REBUILD the registry dist (`pnpm -r build`) BEFORE `pnpm effect-index` — the index generator imports the schema from `packages/registry/dist/schema.js` and self-validates, so a stale dist rejects the new `designs` key. Sequence: edit `schema.ts` → `pnpm -r build` → `pnpm ledger:heroes` → `pnpm effect-index` → tests.
- Regen: `pnpm ledger:heroes` (+`:check`), `pnpm effect-index` (+`:check`); confirm `node scripts/build-card-mechanics-metadata.mjs` leaves `card-mechanics.json` byte-identical
- DECISIONS reservation: **D-24297**

## Guardrails
- **Row identity is sacred:** the ledger row count + `summary` + the `/coverage` metrics + `card-mechanics.json` MUST be byte-identical after regen. `designs` is additive only. If any aggregate drifts, you re-partitioned rows — revert to per-`(extId, mechanic)` rows
- READ-ONLY attribution: author NO new effect data, add NO second parser, fabricate NO `status`/`handler`/`wp`/`decision`/design value — read design `slug`/`name` from `registry.listCards()` verbatim
- Do NOT change the hero `extId` (loadout id + `cards{}` join key); `designs` is additive only
- Do NOT touch `villain-mechanic-ledger.{mjs,json,csv}`, `data/cards/**`, `scripts/convert-cards/**`, any marker-apply pass, `build-card-mechanics-metadata.mjs`, `useCoverageLedger.ts` metric logic, `packages/game-engine`, `apps/server`, `apps/arena-client`, `apps/registry-viewer`
- `designs` is populated for HERO entries with ≥1 design only; villain + unmarked-hero entries OMIT it
- Registry schema stays data-only zod (no engine import); dashboard imports `@legendary-arena/registry/schema` only (no barrel/engine) — WP-487 discipline
- Determinism: build-time artifacts only; touch no `G`/`ctx`/RNG/replay/hash; NO `finalStateHash`/`PRE_WP080_HASH` re-pin
- Dashboard coverage thresholds must still pass; no Vue duplicate row key (rows stay unique — do not introduce a key regression)

## Required `// why:` Comments
- On building the per-`(extId, mechanic)` → designs map from the per-design `listCards()` entries WITHOUT re-partitioning rows (why: the ledger feeds `/coverage` + `card-mechanics.json` which count/dedup by row identity; a per-design row split would corrupt both — the attribution is additive).
- On keeping composition-marker classification at the hero-deck level while attributing per design (the `resolvedMarkers` set is a per-deck property, not per-design).
- On the index `normalizeRow` populating `designs` for marked hero rows while villain + unmarked rows omit it (villain `extId`+`name` already identify the card; an unmarked row has no carrying design).
- On the empty `designs: []` for the hero-level `(unmarked)` row (it is hero-level, not design-specific — kept unchanged per the operator ruling to preserve the glossary `unmarked` bucket).

## Files to Produce
- `scripts/hero-mechanic-ledger.mjs` — **modified** — per-mechanic→designs map; additive `designs` row column; CSV column; `SCHEMA_VERSION` 1→2; row count unchanged
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** — `pnpm ledger:heroes`
- `packages/registry/src/schema.ts` — **modified** — `EffectDesignSchema` + optional `designs` on the entry + inferred type
- `packages/registry/src/schema.effectImplementationIndex.test.ts` — **modified** — designs accept/reject/absent cases
- `scripts/build-effect-implementation-index.mjs` — **modified** — pass `designs` through (hero-with-designs); villain/unmarked omit
- `data/metadata/effect-implementation-index.json` — **regenerated** — `pnpm effect-index`
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **modified** — Design column (row key unchanged)
- `apps/dashboard/src/composables/useEffectIndex.ts` — **modified** — design names in search haystack
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **modified** — designs assertions (hero has, villain omits, search matches)
- `apps/dashboard/src/types/coverage.ts` — **modified** — `LedgerRow.designs?`
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** — Design column (row key unchanged)
- `docs/ai/DECISIONS.md` — **modified** — land D-24297 (Status → Active)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-491 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify operator-pending)

## After Completing
- [ ] `pnpm ledger:heroes` → `schemaVersion: 2`, `designs` on every row, **row count == pre-WP count**, `summary` byte-identical; `pnpm ledger:heroes:check` exits 0; second run byte-stable
- [ ] Black Widow rows attribute correctly (draw/rescue→mission-accomplished, optional-ko-reward→dangerous-rescue, attack-per-count→covert-operation, defeat-with-bystander→silent-sniper); a multi-design mechanic (e.g. ghost-rider-2099 cyber-mod) lists all designs
- [ ] `pnpm effect-index` + `:check` exit 0; marked hero entries carry `designs`, villain + unmarked entries omit it; `superRefine` holds
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (designs cases)
- [ ] `node scripts/build-card-mechanics-metadata.mjs` → `git diff --exit-code data/metadata/card-mechanics.json` = 0; `villain-mechanic-ledger.json` unchanged
- [ ] `/debug/effects` + `/coverage` both show the Design column (hero name(s) / else `"—"`), no duplicate-key warning; `/debug/effects` search matches a design name; `/coverage` metrics unchanged
- [ ] `pnpm --filter @legendary-arena/dashboard test` + `build` exit 0; coverage thresholds hold
- [ ] `git diff --name-only | grep -E '^(packages/game-engine|apps/(server|arena-client|registry-viewer))/'` → NO MATCH
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0; replay/sentinel suites green with NO oracle edit (no re-pin)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24297 landed (Active)
- [ ] Commit prefix: `EC-526:` (code) + `SPEC:` (governance); D-24026 live-verify both Design columns on the deployed dashboard (operator-pending)

## Common Failure Smells
- `card-mechanics.json` or the ledger `summary` shows a diff after regen → you re-partitioned rows (one per design) instead of adding an additive `designs` list; the row set must stay one per `(extId, mechanic)`
- `/coverage` headline % or by-mechanic counts shift → same root cause (row identity changed); `buildMechanicDictionary` counts rows — keep rows unique per `(extId, mechanic)`
- The index fails its own `safeParse` after regen → you added `designs` to the generator but not to `EffectImplementationEntrySchema` (`.strict()` rejects the unknown key); schema + generator ship together
- Vue "duplicate keys" warning on either page → you emitted per-design rows; with additive `designs` the keys stay unique, so a warning means a re-partition slipped in
- A villain entry or an unmarked-hero entry carries `designs` → only marked hero rows set it; villain + unmarked omit
- Schema rejects the index because a hero entry has `designs: []` → don't emit an empty array; omit `designs` when the row has no design (`.min(1)` when present)
- `ledger:heroes:check` fails after a byte-stable-looking edit → the CSV `designs` column or the per-row `designs` sort is non-deterministic; sort designs by slug
- Composition-marker status flips (a berserk/empowered hero row changes status) → you changed the classification path; only the `designs` attribution is new, `resolvedMarkers` logic is untouched
- `finalStateHash`/`PRE_WP080` suite goes red → you touched hashed state out of scope; this WP is build-time-only, revert the stray change
