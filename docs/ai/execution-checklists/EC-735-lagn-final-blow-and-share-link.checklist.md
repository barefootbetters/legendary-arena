# EC-735 — LAGN Final Blow field + loadout share-link (Execution Checklist)

**Source:** docs/ai/work-packets/WP-698-lagn-final-blow-and-share-link.md
**Layer:** Shared Tooling (lagn-spec) + App (registry-viewer)

## Before Starting
- [ ] `origin/main` is at or ahead of `d406f3d7`; working tree clean
- [ ] `validator.ts` has `LAGN_VERSION = LAGN_VERSION_1_5_0` (`:78`),
      `LAGN_SUPPORTED_VERSIONS` (`:88`), ordinal `isLagnVersionAtLeast` (`:111`),
      `GameSetupSchema` (`:234`) with `hero_alternates` (≥1.3.0 gate `:791`) /
      `support_pools` (≥1.1.0 gate `:725`) as the additive-field precedent
- [ ] NO `=== LAGN_VERSION` equality gate exists (only `!== LAGN_VERSION_1_0_0`
      + `isLagnVersionAtLeast`) — re-verify vs HEAD; if one exists, STOP
- [ ] `migrate.ts` `migrationRegistry` head is `1.4.0 → 1.5.0` (`:124/129`)
- [ ] `useLoadoutLagnExport.ts` stamps `lagn_version: LAGN_VERSION` (`:214`) and
      spreads envelope fields in `compositionToLagnSetup` (`:166–167`)
- [ ] `setupUrlParams.ts` is composition-only (`:146–149`); `parsePlayerCountFromUrl`
      (`:103`) is the non-composition-read precedent
- [ ] `SetupEnvelope.finalBlow?` (WP-686) + `draft.finalBlow` toggle (PR #2047)
      are on `main`
- [ ] **Scaffold-first (01.4):** prototype the validator field + gate and run
      `pnpm --filter @legendary-arena/lagn-spec test`; record which example/test
      files assert the literal `1.5.0` version and fold them into scope
- [ ] `pnpm --filter @legendary-arena/lagn-spec build && test` exit 0 (baseline)
- [ ] Target file set is EXACTLY `## Files to Produce`; anything outside is a FAIL

## Locked Values (do not re-derive)
- New LAGN version: `LAGN_VERSION_1_6_0 = '1.6.0'`; default `LAGN_VERSION = LAGN_VERSION_1_6_0`
- LAGN setup field: `setup.final_blow` — `z.boolean().optional()`
- Version gate: `final_blow` requires `lagn_version` ≥ `1.6.0`, **ordinal** (`isLagnVersionAtLeast`)
- Migration: `1.5.0 → 1.6.0` **pure restamp** (final_blow optional)
- URL param: `finalBlow=true`, emitted **only when on**
- App draft field: `MatchSetupDocument.finalBlow?` (unchanged; from WP-686)
- DECISIONS entry: **D-24517**

## Guardrails
- Additive-optional only; `migrate_1_5_0_to_1_6_0` is a pure restamp — no transform
- Ordinal gate only — never `=== LAGN_VERSION`; a future version must not be rejected
- Omit-when-off in exporter, importer, AND URL serializer — a non-Final-Blow
  loadout's LAGN/URL is byte-identical except the `lagn_version` restamp
- Regenerated `lagn-v1.json` MUST be an additive-only diff (`final_blow` property
  + `1.6.0` enum). Any other churn → STOP (CRLF/line-ending noise excluded)
- NO `packages/game-engine` / `packages/registry` runtime change; no state-hash /
  sentinel fixture in the diff (determinism N/A). NO `apps/server` **runtime**
  change — the only `apps/server` edit permitted is the `matchLagn.routes.test.ts`
  test-literal update (PS-1); the server result-LAGN runtime restamps to 1.6.0 by
  the constant bump alone
- Bump `package.json` `"version"` → 1.6.0 in lockstep (manifest lock, PS-2)
- The import parser (`loadoutLagnImport.ts`) stays pure — it EXTRACTS `finalBlow`
  into its return struct; the draft-set (`setFinalBlow`) happens in the apply
  callers `useLagnFromUrl.ts` + `LoadoutBuilder.vue` (PS-3), never in the parser
- `lagn-spec` stays zod-only (no engine import); the app transport reads the draft
- Full-sentence validation prose (00.6 R11)

## Required `// why:` Comments
- `validator.ts` at `LAGN_VERSION_1_6_0`: additive `setup.final_blow`, mirrors the
  support_pools/hero_alternates versioned-field precedent
- `validator.ts` at the gate: ordinal (`isLagnVersionAtLeast`), never `===`
- `migrate.ts` at `migrate_1_5_0_to_1_6_0`: pure restamp — final_blow is optional
- `useLoadoutLagnExport.ts` / `loadoutLagnImport.ts` at the conditional spread:
  emit/read `final_blow` only when on (omit-when-off parity with `setFinalBlow`)
- `setupUrlParams.ts` at the `finalBlow` encode/decode: the deliberate departure
  from the composition-only URL invariant (D-24517) — first envelope value on the link

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — 1.6.0 constant + SUPPORTED + default bump + `final_blow` field + ordinal gate
- `packages/lagn-spec/src/index.ts` — **modified** — export `LAGN_VERSION_1_6_0`
- `packages/lagn-spec/src/migrate.ts` — **modified** — `1.5.0 → 1.6.0` restamp hop
- `packages/lagn-spec/package.json` — **modified** — `"version"` → 1.6.0 (manifest lock, PS-2)
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated (additive)
- `packages/lagn-spec/examples/tier1-final-blow.lagn.json` — **new** — 1.6.0 + `final_blow: true`
- `packages/lagn-spec/src/validator.test.ts` — **modified** — gate + migrate + 13 version-literal updates
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** — emit `setup.final_blow` in `buildLagnObject` (RS-1)
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` — **modified** — emit/omit + `1.5.0`→`1.6.0`
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **modified** — extract `final_blow` into the return struct (PS-3)
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **modified** — parser extracts `finalBlow`
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` (+ `.test.ts`) — **modified, 01.5 wiring** — `applyComposition` calls `setFinalBlow` (PS-3)
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified, 01.5 wiring** — paste/file import applies `setFinalBlow` (PS-3)
- `apps/registry-viewer/src/lib/setupUrlParams.ts` — **modified** — encode/decode `finalBlow`
- `apps/registry-viewer/src/lib/setupUrlParams.test.ts` — **modified** — URL round-trip
- `apps/registry-viewer/src/lib/applyPreviewToDraft.ts` (+ `.test.ts`) — **modified, `01.5` wiring** — the Copy-Setup-Link → editor promotion applies `setFinalBlow` (added during execution: the real URL→draft apply site, alongside `useSetupFromUrl`)
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` (+ `.test.ts`) — **modified, 01.5 wiring** — pass/apply `finalBlow`
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified, test-literal only** — 2 `'1.5.0'` → `LAGN_VERSION` (PS-1)
- `docs/ai/DECISIONS.md` — **modified** — land D-24517
- `docs/ai/STATUS.md` — **modified** — user-facing entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-698 check-off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-735 → Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-698 node `📝` → `✅` + counts
- `packages/lagn-spec/README.md` — **modified if the version ladder is documented there**

## After Completing
- [ ] `pnpm --filter @legendary-arena/lagn-spec build && test` exit 0
- [ ] `git diff --stat packages/lagn-spec/schemas/lagn-v1.json` is additive-only
- [ ] `pnpm --filter registry-viewer build && typecheck && test` exit 0
- [ ] `node -e "JSON.parse(require('node:fs').readFileSync('packages/lagn-spec/schemas/lagn-v1.json','utf8'))"` exits 0
- [ ] `git diff --name-only` shows only the files above (NO `packages/game-engine/**`, no hash fixture)
- [ ] `docs/ai/DECISIONS.md` D-24517 landed (Active)
- [ ] `docs/ai/STATUS.md` user-facing entry added (D-24026 live-verify noted)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-698 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-735 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph updated, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A LAGN test asserts `lagn_version === '1.5.0'` and fails → update the literal to 1.6.0 (expected; not a gate weakening)
- `lagn-v1.json` diff shows non-additive churn → line-ending noise (revert) or a schema-gen change (STOP)
- A pre-1.6.0 document with `final_blow` validates → the ordinal gate is missing or misordered
- `git diff` shows `packages/game-engine/**` → scope leak; the engine already consumes the envelope (WP-686)
- The share-link emits `finalBlow` when off → the omit-when-off conditional is wrong
