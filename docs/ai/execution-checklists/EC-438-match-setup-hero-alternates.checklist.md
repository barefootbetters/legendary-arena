# EC-438 — MATCH-SETUP Envelope Hero Alternates (Execution Checklist)

**Source:** docs/ai/work-packets/WP-403-match-setup-hero-alternates.md
**Layer:** Registry (`packages/registry/src/setupContract/**`)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by the §Empirical
      Scaffold run are folded into the WP's Scope (In) + Files list FIRST, then
      edited.
- [ ] **WP-402 landed on `main`** — `LAGN_VERSION_1_3_0` + `setup.hero_alternates`
      exist. If it has not landed, this packet is **BLOCKED**. Verify, don't assume.
- [ ] **Re-verify WP-403 / EC-438 / D-24212 are still free** against `origin/main`
      *and* open PR branches (`gh pr list`).
- [ ] `pnpm -r build && pnpm --filter @legendary-arena/registry test` exits 0 —
      record the baseline count.
- [ ] **`pnpm -r build` BEFORE any dependent-suite run.** Apps import the built
      `dist`; a stale `dist` produces both false green and false red (import crash
      shrinks the total). Never diagnose a cross-package failure before rebuilding.
- [ ] Enumerate the real file set: `git ls-files packages/registry/src/setupContract/`.
      **That enumeration becomes the scope lock** (EC-432 pattern).
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold first** (WP §Empirical Scaffold): prototype, run the registry suite
      AND `pnpm -r --no-bail test`, RECORD the observed output. This packet adds
      validation to an existing input path — a `READY` reached by argument is invalid.

## Locked Values (do not re-derive)
- Field name, verbatim: `heroAlternateIds` — camelCase, `*Ids` suffix, matching
  `heroDeckIds` / `villainGroupIds`
- Placement: the **envelope** object (beside `heroSelectionMode` / `supportPools`).
  **NOT** `CompositionSchema`.
- Schema, verbatim: `uniqueExtIdArray("heroAlternateIds").optional()`
- The envelope keeps `.strict()`. Do not add `.passthrough()` anywhere.
- Overlap error, verbatim (00.6 Rule 11):
  `The heroAlternateIds entry <ext_id> is also listed in composition.heroDeckIds — a hero is either played or held in reserve, never both.`
- `ext_id` grammar is D-10014 set-qualified `setAbbr/slug`
- **No count rule.** No min beyond the array's own, no max, no seat-count coupling.

## Guardrails
- **`CompositionSchema` is untouched.** The nine-field lock (`schemeId`,
  `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`,
  `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`) does not
  gain a tenth field. Any edit inside `CompositionSchema` is a FAIL.
- **No `packages/game-engine` file may change.** The engine never reads the bench
  (D-24210/D-24212). If a change there seems necessary, STOP — the design is wrong,
  not the boundary.
- **`finalStateHash` and every sentinel/hash surface unchanged.** Assert it; a moved
  hash means gameplay state was touched.
- **Optional means optional.** A document without the field MUST validate exactly
  as it does today. AC-2 is a regression test, not a formality.
- Reuse `checkArrayExtIds` for id resolution. **No parallel resolver** — a second
  code path that resolves hero ids will drift from the first.
- `PLAYER_COUNT_SETUP` is not touched and not consulted. The bench has no seat-count
  relationship; inventing one is a prohibited AI failure pattern.
- Error messages are full sentences naming the field, the offending id, and what to
  do (00.6 Rule 11). No terse messages.
- Do NOT add a migration. Saved loadouts store LAGN (D-24087), not MATCH-SETUP.

## Required `// why:` Comments
- `heroAlternateIds`: why the **envelope** and not the composition — a bench is not
  on the board; the 9-field lock describes what is (D-24212)
- `heroAlternateIds`: why **optional** — every stored document predates it and must
  keep validating unchanged
- The overlap check: why disjointness matters — an id in both lists makes "is this
  hero played?" unanswerable from the document
- Absence of a count rule: why no min/max — `PLAYER_COUNT_SETUP` governs played
  heroes only and says nothing about reserves
- The `.strict()` retention: why the envelope still rejects unknown keys after
  gaining one

## Files to Produce
- `packages/registry/src/setupContract/setupContract.types.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.validate.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified**
  (exact test paths per the `git ls-files` enumeration above)
- `docs/ai/DECISIONS.md` — **modified** — D-24212 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — extensibility row
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-8 each demonstrated with observed output
- [ ] AC-2 regression (document without the field) explicitly run and green
- [ ] AC-6 negative test: a misspelled envelope key still rejected
- [ ] `git diff --name-only` contains **no** `packages/game-engine/**` path
- [ ] Engine suite count unmoved; `finalStateHash` unchanged
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24212 landed **Active**; `00.2` + `MATCH-SETUP-SCHEMA.md` updated
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `git diff --name-only` matches Files to Produce exactly
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- A tenth field appeared in `CompositionSchema` → wrong block; the bench is envelope-side
- An engine file in `git diff` → the bench leaked into gameplay state; revert and re-read D-24210
- A document without `heroAlternateIds` now fails → the field was made required
- `.passthrough()` appeared → the envelope was loosened instead of extended
- A second hero-id resolver appeared → reuse `checkArrayExtIds`
- A min/max or seat-count rule appeared → invented, not specified; remove it
- Cross-package suite red before a rebuild → stale `dist`, not a real failure;
  `pnpm -r build` then re-run before diagnosing
- `finalStateHash` moved → something reached gameplay state; STOP
