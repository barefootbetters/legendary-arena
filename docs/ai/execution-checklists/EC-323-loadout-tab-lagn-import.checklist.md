# EC-323 — Loadout Tab "Load LAGN" Import (Execution Checklist)

**Source:** docs/ai/work-packets/WP-291-loadout-tab-lagn-import.md
**Layer:** Registry Viewer (`apps/registry-viewer`) · **Lightweight Lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] WP-245 LAGN export present: `grep -c "compositionToLagnSetup" apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` ≥ 1 (the mapping this reverses)
- [ ] `@legendary-arena/lagn` importable from the viewer: `grep -c "@legendary-arena/lagn" apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` ≥ 1
- [ ] Worktree built once (`pnpm -r build`) so the viewer typechecks against the lagn dist
- [ ] Baseline snapshot: `pnpm --filter registry-viewer typecheck` → **0**; `pnpm --filter registry-viewer test` → record passing count **X** (= 106 on `99ff1dad`). At close: typecheck still 0; test count **=== X + the new `loadoutLagnImport` tests**, no other suite delta
- [ ] Scaffold (lane requirement): prototype the helper + run the viewer suite, record the observed result BEFORE confirming eligibility

## Locked Values (do not re-derive)
- Composition field names written into the draft (00.2 §8.1): `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds` + counts `bystandersCount`/`woundsCount`/`officersCount`/`sidekicksCount`
- LAGN→composition field map (reverse of WP-245 `compositionToLagnSetup`): `scheme.id→schemeId`, `mastermind.id→mastermindId`, `villain_groups[].id→villainGroupIds`, `henchmen_groups[].id→henchmanGroupIds`, `heroes[].id→heroDeckIds`, `bystanders_count→bystandersCount`, `wounds_count→woundsCount`, **`shield_officers_count→officersCount`** (only renamed field), `sidekicks_count→sidekicksCount`, `lagn.player_count→playerCount`
- LAGN ids are already set-qualified ext_ids (D-24018) — NO registry lookup / id translation
- LAGN validity is judged by the published `validate` from `@legendary-arena/lagn` — do NOT hand-roll a LAGN schema check

## Guardrails
- Additive only: the new control NEVER touches the existing "Load JSON" importer, `loadFromJson`, or any `useLoadoutDraft` mutation/validation logic
- No composable change, no new draft-API method, no new contract file (`.types.ts`/`.validate.ts`/`.gating.ts`), no `MatchSetupConfig` change
- No change to `packages/lagn-spec` — this WP only *consumes* `validate` + `LAGN`
- No forbidden import in `loadoutLagnImport.ts` / `LoadoutBuilder.vue` (`game-engine`/`server`/`dashboard`/`boardgame.io`/`scripts/`); helper is boardgame.io-free
- No `App.vue`, WP-288 gallery, `CardGrid.vue`, Cards-filter, or WP-279 add-to-loadout/tray change
- The control applies the composition via the EXISTING setters only (`resetDraft`/`setScheme`/`setMastermind`/`add*`/`setCount`/`setPlayerCount`) — never by writing `draft.composition.*` directly
- `for...of` / explicit `if/else` (no branching `.reduce()`); full-word names; `ok`/`is*` booleans

## Required `// why:` Comments
- On the `shield_officers_count → officersCount` mapping (the one non-1:1 field name)
- On reusing the published `validate` (rejects non-LAGN input with real errors instead of a partial load)
- On `resetDraft()` before applying (a LAGN import REPLACES the draft, matching `loadFromJson` semantics)

## Files to Produce
- `lib/loadoutLagnImport.ts` (new — `parseLagnLoadout` + `LagnLoadoutComposition`)
- `lib/loadoutLagnImport.test.ts` (new — node:test coverage)
- `components/LoadoutBuilder.vue` (modified — "📥 Load LAGN (paste or file)" control + handlers)
- `DECISIONS.md` (D-24075 → Active) + `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` + `05-ROADMAP-MINDMAP.md` (governance close)

## File Responsibilities (no logic duplication)
- `lib/loadoutLagnImport.ts` — the SINGLE source of LAGN-parse + LAGN→composition extraction. `LoadoutBuilder.vue` must not re-encode the field map
- `components/LoadoutBuilder.vue` — UI + orchestration only: read file/paste → call `parseLagnLoadout` → apply the returned composition via existing setters; render the control, errors, and success line

## Required Test Matrix (`lib/loadoutLagnImport.test.ts` — every row required)
- non-JSON text → `{ ok: false }` with a full-sentence "could not be parsed as JSON" error
- a MATCH-SETUP document (schemaVersion/composition) → `{ ok: false }` with non-empty errors (proves non-LAGN rejection via the published validator)
- a valid LAGN → `{ ok: true }` with `schemeId`/`mastermindId`/counts/`playerCount` mapped, including `shield_officers_count → officersCount`
- group expansion: `villain_groups`/`henchmen_groups`/`heroes` → the matching id arrays (deepEqual)

## After Completing
- [ ] Helper + tests cover non-JSON / non-LAGN / valid-LAGN extraction / group→ids + officers rename
- [ ] "Load LAGN" control drives existing setters (resetDraft → set*/add*/setCount/setPlayerCount); error + success feedback; existing "Load JSON" untouched
- [ ] No forbidden import; helper boardgame.io-free; no composable/contract/`App.vue`/gallery/`CardGrid` change
- [ ] `typecheck` 0; `test` 0 (count preserved + new tests); `build` 0
- [ ] LIVE: Download LAGN → Load LAGN round-trip fills the draft → View as cards shows its cards; a non-LAGN file shows errors not a partial load
- [ ] D-24075 lands (Active); WORK_INDEX/EC_INDEX/STATUS/mindmap flipped
- [ ] Commit prefix `EC-323:` (code) + `SPEC:` (governance); D-24026 live-verify post-deploy

## Common Failure Smells
- LAGN import silently loads an empty/partial draft → the `validate` gate was skipped or `!valid` wasn't returned early
- `officersCount` ends up 0 → mapped from the wrong LAGN field (must be `shield_officers_count`, not a nonexistent `officers_count`)
- A second mastermind's Always-Leads villains appear → expected: `setMastermind` re-applies required groups (deduped) — not a bug
- The existing "Load JSON" import broke → the new control reused/edited `loadFromJson` instead of staying additive
