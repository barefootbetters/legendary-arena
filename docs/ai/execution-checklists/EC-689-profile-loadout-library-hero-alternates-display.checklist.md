# EC-689 — Hero Alternates on the Saved-Loadout Library Display (Execution Checklist)

**Source:** docs/ai/work-packets/WP-652-profile-loadout-library-hero-alternates-display.md
**Layer:** App (`apps/arena-client`) only

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by the scaffold run are
      folded into the WP Scope (In) + Files list FIRST.
- [ ] **WP-404 ✅ and WP-402 ✅ on `main`** — the Registry Viewer emits
      `setup.hero_alternates` and the server stores it on a ≥1.3.0 body. Verify.
- [ ] **Re-verify WP-652 / EC-689 are still free** against `origin/main` and open
      PR branches (`gh pr list`).
- [ ] `pnpm -r build` exits 0, then record baselines:
      `pnpm --filter arena-client test`, `pnpm --filter arena-client typecheck`.
- [ ] Enumerate the real SFC/test set: `git ls-files apps/arena-client/src`. **That
      enumeration becomes the scope lock** (EC-432 pattern).
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold:** prototype the `heroAlternates` field on `summarizeLoadout`,
      render it in both pages, run `pnpm --filter arena-client test` + `typecheck`,
      RECORD the counts. Additive display; a READY reached by argument is invalid.

## Locked Values (do not re-derive)
- Summary field, verbatim: `heroAlternates: string[]` on `LoadoutSummary`
  (`lib/loadoutSummary.ts`), populated via the EXISTING `readEntityNames`
  on `setup['hero_alternates']`. **No new parsing helper** — reuse the `heroes` path.
- LAGN field read, verbatim: `setup.hero_alternates` (snake_case), `{ id, name }`
  entries — the same shape `setup.heroes` uses.
- Empty / absent bench ⇒ `heroAlternates` is `[]`; the UI omits the reserve
  indicator (MyProfilePage) and shows `—` (SharedLoadoutPage). Never a placeholder
  row implying a bench exists.
- The client treats `lagn` as **opaque** — do NOT import `@legendary-arena/lagn`
  (D-24086); read defensively like every other `summarizeLoadout` field.

## Guardrails
- **Display-only.** No `POST` / save-path change — `submitCreateLoadout` already
  accepts a bench-carrying LAGN. No new "save from viewer" cross-app feature.
- **No `apps/server`, no `packages/*`, no `apps/registry-viewer` edit.** The field
  already exists and is already stored. `finalStateHash` untouched.
- **No LAGN validator import client-side** — `summarizeLoadout` stays a pure,
  defensive reader; a misshaped document must render, not throw.
- Reserves are **read-only** on the profile; no bench editing here (editing stays
  in the Registry Viewer via the `?lagn=` "Edit in Registry Viewer" link).
- Reserves must be **visually distinct** from played heroes on both surfaces so the
  two are never confused (mirrors the WP-404 viewer treatment).
- `pnpm --filter arena-client typecheck` (vue-tsc) is the load-bearing gate —
  `vite build` is esbuild and `node:test` runs via tsx; neither typechecks SFCs.

## Required `// why:` Comments
- The `heroAlternates` field: why it reuses `readEntityNames` and reads
  `setup.hero_alternates` (WP-404 producer; display-only; D-24210 non-authoritative)
- The empty-bench UI branch: why the indicator/row is omitted rather than shown
  empty — an empty reserve display implies a bench where there is none
- The visual distinction: why reserves must not be confusable with played heroes

## Files to Produce
- `apps/arena-client/src/lib/loadoutSummary.ts` — **modified** — `heroAlternates`
- `apps/arena-client/src/lib/loadoutSummary.test.ts` — **modified**
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — reserve indicator
- `apps/arena-client/src/pages/SharedLoadoutPage.vue` — **modified** — Bench row
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-7 each demonstrated with observed output
- [ ] AC-4 regression (a no-bench loadout renders as today) explicitly run
- [ ] `pnpm --filter arena-client typecheck` 0 (load-bearing)
- [ ] `git diff --name-only` has no `apps/server` / `packages/` / `registry-viewer` path
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] **D-24026 live verification** on deployed `play.legendary-arena.com`: save a
      bench-carrying loadout (paste a viewer LAGN export) and confirm the bench
      shows on the Saved Loadouts card + the Shared Loadout page. Drive the action.
- [ ] STATUS flip recorded after the deploy-confirmed SHA
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- `@legendary-arena/lagn` imported in arena-client → the client must treat `lagn`
  as opaque (D-24086); read defensively instead
- `apps/server` / `packages/*` / `registry-viewer` in the diff → out of scope; the
  field already exists and is already stored
- A reserve indicator/row shown for an empty bench → the empty branch was missed
- Reserves rendered identically to played heroes → not visually distinct (AC-2/AC-3)
- Viewer tests green but `typecheck` red → SFC types; `typecheck` is the real gate
- A new save/POST path appeared → display-only; the paste-save already carries it
