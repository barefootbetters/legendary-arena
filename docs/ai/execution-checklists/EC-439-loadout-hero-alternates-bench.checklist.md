# EC-439 — Loadout Hero Alternates + LAGN Writer Flip (Execution Checklist)

**Source:** docs/ai/work-packets/WP-404-loadout-hero-alternates-bench.md
**Layer:** App (`apps/registry-viewer`) + one locked constant in `packages/lagn-spec`

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by the §Empirical
      Scaffold runs are folded into the WP's Scope (In) + Files list FIRST.
- [ ] **WP-402 landed** — `LAGN_VERSION_1_3_0` + `setup.hero_alternates` on `main`.
- [ ] **WP-403 landed** — `heroAlternateIds` on the MATCH-SETUP envelope. If either
      is missing this packet is **BLOCKED**. Verify both, don't assume.
- [ ] **Re-verify WP-404 / EC-439 / D-24213 are still free** against `origin/main`
      *and* open PR branches (`gh pr list`).
- [ ] `pnpm -r build` exits 0, then record baselines:
      `pnpm --filter @legendary-arena/lagn test`,
      `pnpm --filter registry-viewer test`, `pnpm --filter registry-viewer typecheck`.
- [ ] Enumerate the real viewer file set: `git ls-files apps/registry-viewer/src`.
      **That enumeration becomes the scope lock** (EC-432 pattern).
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold 1 — the flip alone.** Set `LAGN_VERSION = LAGN_VERSION_1_3_0`,
      `pnpm -r build && pnpm -r --no-bail test`, RECORD the output. **Measured at
      draft (this is the outcome to expect, not a grep guess):** ~5 failures, ALL
      in `packages/lagn-spec/src/validator.test.ts` (writer-version assertion, two
      `migrateToCurrent` cases, derived-schema enum, AC-5 migration-target), and
      **ZERO viewer failures.** The two viewer `'1.1.0'` literals
      (`useLagnFromUrl.test.ts:168`, `loadoutLagnImport.test.ts:127`) are
      **read-path input fixtures** — a 1.1.0 document still imports after the writer
      moves — so the flip does NOT break them; they are edited later only to add
      bench coverage, never as flip breakage. Do NOT touch `loadoutLagnImport.ts`
      (no literal; reads the constant) or `versioning.check.ts:35` (a comment, wrong
      version namespace). Anything outside `validator.test.ts` gets folded into scope
      before editing.
- [ ] **Scaffold 2 — the envelope.** Confirm a draft carrying `heroAlternateIds`
      validates against the WP-403 `setupContract` as landed on `main`. (Draft-time
      proxy: registry suite 178/178 with the field prototyped; re-confirm on `main`.)

## Locked Values (do not re-derive)
- `LAGN_VERSION` becomes `LAGN_VERSION_1_3_0` — the string `1.3.0`. It skips 1.2.0
  **deliberately**; provenance is optional and unpopulated, so a 1.3.0 stamp carries
  it no differently. Do not add an intermediate 1.2.0 emission step.
- LAGN field, verbatim: `setup.hero_alternates` (snake_case)
- MATCH-SETUP field, verbatim: `heroAlternateIds` (camelCase). The rename across the
  boundary is the same non-1:1 mapping `shield_officers_count` ↔ `officersCount`
  already carries — map it in ONE place.
- Bench UI slot count: **2**. UI-only. Do NOT add a `.max()` to any schema.
- Empty bench ⇒ the `hero_alternates` **key is omitted entirely**, never `[]`.
- Setter names, verbatim: `addHeroAlternate`, `removeHeroAlternate` — mirroring the
  existing `addHeroGroup` / `removeHeroGroup`.
- `ext_id` grammar is D-10014 set-qualified `setAbbr/slug`.

## Guardrails
- **DO NOT TOUCH `packages/game-engine/src/versioning/**`.** It contains `1.1.0`
  for the **engine save-version namespace**, which is unrelated to LAGN. It will
  appear in a naive grep. Changing it moves a determinism surface for no reason.
- **No `packages/game-engine` file may change at all.** `finalStateHash` unmoved.
- **Do not fork the validator.** Import extends `parseLagnLoadout` and reuses the
  published `validate` — a second LAGN parser is the failure this arc exists to
  avoid (D-24075).
- **Do not fork the exporter.** Extend `compositionToLagnSetup`; do not add a
  second composition→LAGN mapping.
- Import stays **atomic**: setters fire only on `ok`. A malformed payload must
  leave the existing draft intact and show a dismissible full-sentence banner.
- `package.json` version + description bump lands in the **SAME commit** as the
  constant. Nothing enforces this automatically — it is the EC-422 miss that
  briefly published a 1.0.0 manifest for a 1.1.0-emitting package.
- `apps/arena-client` is out of scope entirely. The in-match link relays a
  server-produced LAGN with no bench, by design (D-24210).
- `apps/server` gets **no code edit**. Its stamped version moves because it reads
  the constant.
- `pnpm --filter registry-viewer typecheck` is the load-bearing gate. `vite build`
  is esbuild and `node:test` runs via tsx — **neither typechecks SFCs**.

## Required `// why:` Comments
- The `LAGN_VERSION` flip: why now and not in WP-402/WP-394 — the writer flips
  *with* the producer; a bump with nothing to emit moves a catalogued endpoint for
  zero benefit (D-24213)
- The flip: why it skips 1.2.0
- The empty-bench omission: why the key is dropped rather than emitted as `[]` —
  an empty array asserts "a bench exists and is empty," which is a different claim
- The snake_case ↔ camelCase mapping: why it is done in one place
- The two-slot UI: why the cap lives here and not in the published schema
- The bench's visual distinction: why played and reserve heroes must not be
  confusable at a glance

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` only
- `packages/lagn-spec/package.json` — **modified** — version + description lockstep
- `packages/lagn-spec/src/validator.test.ts` — **modified** — `LAGN_VERSION` assertion
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` — **modified**
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified**
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **modified**
- `docs/ai/DECISIONS.md` — **modified** — D-24213 Active
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — TWO rows replaced WHOLE (D-11804)
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — version table + `hero_alternates`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] AC-5 **round trip** explicitly run: export → import → identical bench
- [ ] AC-4 empty-bench case: key omitted, document still valid
- [ ] `pnpm --filter registry-viewer typecheck` 0 (load-bearing)
- [ ] `git diff --name-only` contains **no** `packages/game-engine/**` path
- [ ] `package.json` bumped in the SAME commit as the constant
- [ ] D-24213 landed **Active**; both `api-endpoints.md` rows replaced WHOLE
- [ ] `wiki/lagn-v1.md` version table updated
- [ ] **D-24026 live verification** on deployed `cards.legendary-arena.com` —
      build a bench, SAVE it, RE-OPEN it, confirm the bench survived. A rendering
      slot is NOT proof; drive the terminal action.
- [ ] STATUS flip recorded after the deploy-confirmed SHA
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- `packages/game-engine/src/versioning/**` in the diff → the wrong `1.1.0` was
  changed; revert immediately
- A bench survives export but not import (or vice versa) → the round trip was never
  run; AC-5 exists because this exact asymmetry recurred in WP-291 and EC-429
- `hero_alternates: []` in an exported document → the empty-bench omission was missed
- A second LAGN parser or a second composition→LAGN mapping appeared → fork; revert
- A malformed payload wiped the draft → import was not atomic
- `.max(2)` appeared in a schema → the cap belongs in the UI
- Viewer tests green but `typecheck` red → SFC types; `typecheck` is the real gate
- `npm publish` ran → publishing is tag-gated; not this packet's job
- The bench appears in a match, a projection, or `matchConfiguration` → the bench
  reached gameplay state; STOP and re-read D-24210
