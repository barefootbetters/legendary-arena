# EC-584 — Registry Viewer LAGN Result Round-Trip (Execution Checklist)

**Source:** docs/ai/work-packets/WP-549-registry-viewer-lagn-result-roundtrip.md
**Layer:** App (`apps/registry-viewer`) — single layer

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] **Sequencing:** WP-549 and WP-550 were drafted in one SPEC PR and share five governance files (`DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`) plus `pnpm roadmap:counts:write`. Execute them **sequentially, either order** — never in parallel worktrees. If WP-550 landed first, rebase onto it, re-anchor this WP's `DECISIONS.md` append on the newly-landed D-24359 tail, and re-run `roadmap:counts:write` before committing (a stale derived count reddens the Dashboard gate and reads like an unrelated coverage failure)
- [ ] `pnpm install` then `pnpm -r build` in this worktree **first** — a fresh worktree has no `node_modules` / `dist`, and an absent `dist` reports as failing tests
- [ ] Baseline green + **record the count**: `pnpm --filter @legendary-arena/registry-viewer test` exit 0. STOP if red before you edit anything
- [ ] Importer drops `result` today (binary): `node -e "const s=require('fs').readFileSync('apps/registry-viewer/src/lib/loadoutLagnImport.ts','utf8'); process.exit(/result\s*:/.test(s.split('function lagnToComposition')[1]||'')?1:0)"` → exit 0 (no `result` mapping in `lagnToComposition`)
- [ ] Exporter fabricates today: `grep -c 'loss_condition: lagnOutcome === "defeat" ? "deck_exhausted" : undefined' apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` → **1**, and `grep -c 'ref<"victory" | "loss">("victory")' apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` → **1**
- [ ] `result` is OPTIONAL in the contract: `node -e "const s=require('./packages/lagn-spec/schemas/lagn-v1.json'); process.exit(s.required.includes('result')?1:0)"` → exit 0
- [ ] No overlapping WP in flight: `grep -n 'WP-404' docs/ai/work-packets/WORK_INDEX.md` still shows **Blocked**, and no open branch touches these files (`gh pr list --state open --search 'EC-439'` is empty). WP-404 / EC-439 targets the same files plus `packages/lagn-spec`
- [ ] Server producer correct + to be left alone: `grep -A8 "function toLagnResult" apps/server/src/match/matchLagn.logic.ts` shows BOTH `heroes-win → victory` and `scheme-wins → defeat` (`-A8`, not `-A4` — four lines of context stop before the `scheme-wins` arm)

## Locked Values (do not re-derive)
- **Outcome is TRI-state:** `"unset" | "victory" | "loss"`. Default **`"unset"`**, NOT `"victory"`. `"unset"` ⇒ the `result` **key is absent from the emitted object** (not `undefined`, not `null`, not `{}`) — build the object conditionally.
- **LAGN enum unchanged:** `result.outcome ∈ {"victory","defeat"}`. Internal `"loss"` still maps to `"defeat"` via the existing `mapOutcomeToLagn`; `"unset"` never reaches it.
- **`loss_condition` is IMPORT-ONLY.** Delete the `lagnOutcome === "defeat" ? "deck_exhausted" : undefined` expression. Emit `loss_condition` **only** when it arrived on an import; a user-chosen `loss` emits none. Also **remove the dead `lossReason` computed and its test** (`useLoadoutLagnExport.test.ts:232-240`) — it is a hardcoded `"unavailable"` the template never reads, and leaving it strands an unreachable branch.
- **Importer copies KNOWN KEYS EXPLICITLY — never spread.** `parseLagnLoadout` returns the **raw** object (`parsed as LAGN`), so zod's strip never runs; `result` also permits `victory_points` and `timestamp`. Copy `outcome`, and `loss_condition` when present. A spread would round-trip arbitrary unknown keys from an untrusted file.
- **Seeding channel (locked — do not redesign at execution):** `useLagnFromUrl` returns the imported result on `UseLagnFromUrlResult` → `App.vue` holds it in state → passes it to `LoadoutBuilder` as a prop → `LoadoutBuilder` calls a new `applyImportedResult(...)` on the `useLoadoutLagnExport` instance it owns. This channel is required because the two composables are **separate instances** (`useLagnFromUrl` in `App.vue`, `useLoadoutLagnExport` in `LoadoutBuilder.vue`) with no existing link. Do **not** park the result on the draft (that would need `useLoadoutDraft.ts` + `MatchSetupDocument` in `packages/registry`, forbidden by WP §5) and do **not** use module-level state (`useLoadoutLagnExport.ts:182` documents a no-module-state, independent-instance invariant; `useLagnFromUrl` carries no such statement, but sharing state module-globally would still break the per-instance contract the export composable guarantees).
- **Seeding is one-way:** import → export. Nothing writes back into the parsed import.
- **`applyImportedResult` is REPLACE, never merge.** An import carrying **no** `result` block resets the outcome to `"unset"` and clears any `loss_condition` — matching `applyLagnImport`'s documented total-replace contract (`LoadoutBuilder.vue:735-747`). It also overrides a prior **user** choice. Never "keep the old outcome because the new file had none": that is the exact bug class D-24358 forbids.
- **Locked identifiers** (three executors would otherwise pick three names, and one of them is a template-facing prop):
  - `LagnLoadoutComposition.result` — the optional field on the importer contract
  - `UseLagnFromUrlResult.importedResult` — the field the deep-link composable returns
  - `importedLagnResult` — the `LoadoutBuilder` prop (`:imported-lagn-result` in the template)
  - `applyImportedResult(result)` — the method on the export composable. Signature: it MUST accept `undefined` (that is the reset path), i.e. the imported-result type **or** `undefined`
- **Mount timing (locked):** `LoadoutBuilder` calls `applyImportedResult` **at mount**, or via `watch(..., { immediate: true })`. `useLagnFromUrl` runs at `App.vue:379` inside the async registry loader, which completes **before** the registry-gated `<LoadoutBuilder>` mounts (`App.vue:1404`) — so a non-immediate watcher never fires and the deep-link half silently no-ops.
- **Unset `<option>` value (locked):** `value="unset"`, label `— not recorded —`. A bare `<option value="">` writes `""` into the ref, breaking the union and reaching `mapOutcomeToLagn`.
- **Both import channels seed.** The paste/file channel (`LoadoutBuilder.applyLagnImport`, `:735`) and the `?lagn=` deep-link channel are BOTH in scope; wiring only one leaves half the round trip broken.
- **DECISIONS reservation:** **D-24358**.

## Guardrails
- Do NOT touch `apps/server/**` — `toLagnResult` is CORRECT and is the sole authority for a real match verdict. Any diff under `apps/server/` is out of scope.
- Do NOT modify `packages/lagn-spec/**` — `result` is already optional. A `lagn-v1.json` diff means you widened the contract; revert it (judge by `git diff --numstat`, not `git status` — CRLF churn shows as modified at 0/0).
- Do NOT add `tie` to the LAGN outcome enum (WP §5 Out) — omission already models it.
- Do NOT infer an outcome from scores, VP, `players[]`, or player count. The refuted VP-comparison theory must not be re-introduced.
- Do NOT invent a `loss_condition` UI control — import-only is the locked contract.
- Do NOT change `variant`, `player_count`, `setup`, or `support_pools` mapping in either direction.
- Emit `result` only when the outcome is genuinely established; a guessed verdict is the bug being fixed.

## Required `// why:` Comments
- On the new optional importer field: cite D-24358 + the EC-429 / `supportPools` precedent — the importer previously dropped `result`, so a shared match link delivered the board but re-exported a fabricated verdict.
- On copying keys explicitly instead of spreading: `parseLagnLoadout` hands back the raw parsed object, so an untrusted file's unknown keys would survive a spread.
- On the `"unset"` default: a Loadout-tab export is a **Tier-1 setup document**; `result` is optional in LAGN, so asserting no verdict is legal and honest, while defaulting to `"victory"` claims an authority the loadout builder does not have.
- On removing the derived `loss_condition`: `"deck_exhausted"` was stamped on every defeat and is wrong for a scheme-completion or mastermind loss; the server producer deliberately never emits it.

## Files to Produce
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **modified** — optional result field, explicit key copy
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **modified** — parse preserves / absent stays absent / unknown keys not round-tripped
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** — tri-state, `applyImportedResult`, omission, no fabricated `loss_condition`, `lossReason` removed, **and the file-header JSDoc at `:23-26` updated** (it currently documents the very mapping this WP deletes — `loss_condition="deck_exhausted"` — so leaving it makes the header false; updating it also lets a plain unscoped `grep -c deck_exhausted … → 0` replace the scoped AC-5 expression below)
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` — **modified** — round-trip + omit-when-unset + no-fabrication + the REPLACE-semantics case (import defeat → import a no-result LAGN → no `result` key). **Delete two existing tests:** `:117-127` (`"loss_condition set when outcome='loss'"`, which asserts the `deck_exhausted` this WP removes — replace it with the inverse assertion) and `:232-240` (the dead `lossReason` test)
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` — **modified** — return the imported result
- `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` — **modified** — add a **NEW** case whose fixture carries `result.outcome` and assert `importedResult` is returned. Leave `:91` / `:100` **unmodified**: their fixture has no `result` block, so under conditional omission the returned object gains no key and both strict `deepEqual`s still pass
- `apps/registry-viewer/src/App.vue` — **modified** — hold the deep-link result; pass it as a prop
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — accept the `importedLagnResult` prop and call `applyImportedResult` at mount (deep-link channel), **and** call `applyImportedResult(composition.result)` from `applyLagnImport` (`:735`) so the paste/file channel seeds too; add the unset `<option value="unset">`
- `docs/ai/DECISIONS.md` (D-24358 → Active) · `docs/ai/STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-549 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] AC-1 regression: a `"defeat"` LAGN imported → re-exported is still `"defeat"`
- [ ] AC-4: a hand-built draft's export has NO `result` key. Assert on **both** the built object and the serialized file — `Object.hasOwn(builtObject, "result") === false` **and** `!file.includes('"result"')` — and confirm the doc still passes `validate()`. Asserting only on `JSON.parse(file)` is insufficient: `JSON.stringify` drops `result: undefined`, so the gate would pass even if the property is set, which the Failure Smells forbid (`exactOptionalPropertyTypes` is not enabled, so the compiler will not catch it either)
- [ ] AC-5 (**scoped grep is the primary gate**): `grep -n 'deck_exhausted' apps/registry-viewer/src/composables/useLoadoutLagnExport.ts | grep -vc '^[0-9]*:\s*\*'` → **0** live-code hits. Only the amendment-block sentence at `:26` (which documents the `"loss" → "defeat" with loss_condition="deck_exhausted"` mapping this WP deletes) MUST go; `:25`'s factual listing of the validator enum is accurate and may stay — do not delete a true line to satisfy a gate. Note `grep -vc` exits **1** on a zero count: never chain it with `&&`
- [ ] AC-6b (REPLACE semantics): import a `"defeat"` LAGN, then import a no-`result` LAGN → the export has **no** `result` key and no `loss_condition`
- [ ] Deep link: assert `useLagnFromUrl` **returns** `importedResult`, and separately that `applyImportedResult` seeds the export state. The `.vue` prop wiring itself has **no unit coverage in this app** — the test glob is `src/**/*.test.ts` and there is no SFC test harness. **Do not build one**; that wiring is gated solely by the D-24026 live-verify
- [ ] `git diff --name-only` shows NO file under `apps/server/`, `packages/lagn-spec/`, or `packages/game-engine/`
- [ ] `pnpm --filter @legendary-arena/registry-viewer test` + `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24358 landed (Active)
- [ ] Commit prefix `EC-584:` (implementation) + `SPEC:` (governance)
- [ ] D-24026 live-verify recorded as pending: import a real match LAGN on the deployed viewer, re-export, outcome survives

## Common Failure Smells
- Export emits `"result": {}` or `"result": {"outcome": undefined}` for an unset draft → the KEY must be absent; build conditionally, don't set an undefined property.
- A hand-built export suddenly fails `validate()` → you omitted `outcome` while keeping `result`; `outcome` is required *within* the block. Omit the whole block.
- Round-trip works from the paste box but not from a share link → you seeded `LoadoutBuilder`'s paste path but not the `useLagnFromUrl` → `App.vue` → prop channel.
- Do NOT force `useLagnFromUrl.test.ts:91` / `:100` to change. Those use strict `deepEqual`, but the fixture carries no `result` block, so under the conditional-omission idiom this codebase uses everywhere (`loadoutLagnImport.ts:112`) the returned object gains no key and both assertions still pass. If you find yourself attaching `importedResult: undefined` to make them "expected-red," stop — that is the same set-an-undefined-property shape the exporter is forbidden to emit. Add a NEW case whose fixture carries `result.outcome` and assert it is returned.
- `lagn-v1.json` appears in `git status` → you touched `packages/lagn-spec`; revert (confirm a real diff first — CRLF churn is 0/0).
- Server tests go red → you edited `toLagnResult`; it was already correct.
- Unknown keys (`victory_points`, `timestamp`, or junk) appear in a re-export → you spread the incoming block instead of copying known keys.
