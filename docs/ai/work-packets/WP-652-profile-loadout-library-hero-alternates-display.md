# WP-652 — Hero Alternates on the Saved-Loadout Library Display (Arena Client)

**Layer:** App (`apps/arena-client`)
**EC:** `docs/ai/execution-checklists/EC-689-profile-loadout-library-hero-alternates-display.checklist.md`
**Reserves:** none (display-only; reuses the WP-404 pattern — no architectural decision to lock)
**Baseline:** drafted off `origin/main` @ `183aefab`
**User-Visible Surface:** `play.legendary-arena.com` (My Profile → Saved Loadouts; public Shared Loadout page) — **D-24026 live verification REQUIRED**

---

## Goal

Show the **hero bench** (reserve heroes) on the arena-client saved-loadout
library so a loadout saved with a bench displays its reserves instead of
silently dropping them from view. The profile's "Saved Loadouts" card gains a
reserve count, and the public Shared Loadout page gains a **Bench** row listing
the reserve heroes, visually distinct from the played heroes. This is the
explicit WP-404 Scope-Out follow-on: *"Displaying a bench on SharedLoadoutPage /
MyProfilePage is a deliberate follow-on, not this packet."*

---

## Context

### Why this is a real gap, not polish

WP-404 shipped the bench in the **Registry Viewer** (`cards.legendary-arena.com`)
— build, export, `?lagn=` share, all carrying `setup.hero_alternates`. The
saved-loadout **library** is a different app: `MyProfilePage.submitCreateLoadout`
accepts a pasted viewer-exported LAGN and `POST`s it to `/api/me/loadouts`, and
the server stores `setup.hero_alternates` on a ≥1.3.0 body (WP-402 / D-24211). So
a bench **already reaches the library today** — but `summarizeLoadout`
(`lib/loadoutSummary.ts`) reads only mastermind / scheme / heroes / villain-groups
/ henchman-groups, so the saved-loadout card and the Shared Loadout page render
the played heroes and drop the reserves from view. This packet closes that
display gap and completes WP-404 AC-11's library-display promise.

### Why display-only

The library **save** path already carries the bench (paste-save + server store),
and the in-match loadout is a **server-produced LAGN with no bench by design**
(D-24210) — so nothing here adds a save path, a server change, or an engine edge.
The bench on the profile is **read-only, non-authoritative** metadata, exactly as
in the Registry Viewer.

---

## Assumes

- **WP-404 ✅ / D-24213** — the Registry Viewer emits `setup.hero_alternates` on a
  1.5.0 LAGN; that document is what a user pastes into the library.
- **WP-402 ✅ / D-24210 / D-24211** — LAGN 1.3.0 `setup.hero_alternates`; the
  server accepts it on a ≥1.3.0 body (already reflected in `api-endpoints.md`).
- **WP-301 ✅ / WP-302 ✅ / D-24087** — the saved-loadout library stores an opaque
  LAGN document; `summarizeLoadout` is the single client-side display projection
  (the client never imports `@legendary-arena/lagn`; the server is the validation
  authority, D-24086).
- **D-24210** — a bench is never gameplay state; the in-match server LAGN has none.

---

## Scope (In)

1. **`lib/loadoutSummary.ts`** — add `heroAlternates: string[]` to `LoadoutSummary`,
   populated via the existing `readEntityNames(setup['hero_alternates'])` (same
   defensive `{ id, name }` → display-name path as `heroes`; empty array when
   absent). No new parsing helper.
2. **`pages/MyProfilePage.vue`** — the saved-loadout card gains a reserve
   indicator (e.g. `· N in reserve`) shown only when `heroAlternates.length > 0`,
   worded so reserves are never conflated with played heroes.
3. **`pages/SharedLoadoutPage.vue`** — the summary `<dl>` gains a **Bench** row
   listing the reserve heroes (comma-joined, `—` when empty), visually distinct
   from the Heroes row.
4. Tests: `lib/loadoutSummary.test.ts` (bench read + absent → empty) and whatever
   the two SFCs' existing test files cover, extended for the bench.
5. Governance: `STATUS.md`, both indices, mindmap. `api-endpoints.md` is **N/A**
   (no endpoint change — the server already stores the field).

## Scope (Out)

- **`packages/*` / `apps/server` / `apps/registry-viewer`** — untouched. No engine,
  no server, no LAGN-spec change; the field already exists and is already stored.
- **Any new save path** — the paste-save (`submitCreateLoadout`) already accepts a
  bench-carrying LAGN. No "save from the viewer to the library" cross-app feature.
- **Bench editing on the profile** — the profile is a *viewer* of saved loadouts;
  editing stays in the Registry Viewer (the "Edit in Registry Viewer" `?lagn=`
  link already round-trips the bench, WP-404).
- **In-match bench** — the server match LAGN has no bench (D-24210); unchanged.

---

## Files Expected to Change

- `apps/arena-client/src/lib/loadoutSummary.ts` — **modified** — `heroAlternates`
- `apps/arena-client/src/lib/loadoutSummary.test.ts` — **modified**
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — reserve indicator
- `apps/arena-client/src/pages/SharedLoadoutPage.vue` — **modified** — Bench row
- `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` /
  `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

> The exact SFC test-file set is asserted at execution via `git ls-files` and
> becomes the scope lock (EC-432 pattern).

---

## Contract

`LoadoutSummary` gains one field:

```ts
readonly heroAlternates: string[];  // reserve-hero display names; [] when absent
```

Populated from `setup.hero_alternates` (LAGN snake_case, `{ id, name }` entries)
via the existing `readEntityNames`. No server or LAGN-spec change; the field is
already stored on ≥1.3.0 documents.

---

## Acceptance Criteria

- **AC-1** — `summarizeLoadout` reads `setup.hero_alternates` into
  `heroAlternates` (display names, `id` fallback), and returns `[]` when the field
  is absent or misshaped (defensive, never throws).
- **AC-2** — MyProfilePage's saved-loadout card shows a reserve indicator when the
  loadout has a bench, and omits it when empty — never conflating reserves with
  played heroes.
- **AC-3** — SharedLoadoutPage shows a **Bench** row with the reserve heroes,
  visually distinct from the Heroes row; `—` when empty.
- **AC-4** — A loadout with **no** bench renders exactly as today (regression).
- **AC-5** — `pnpm --filter arena-client typecheck` (vue-tsc) exits 0 — the
  load-bearing SFC gate (`vite build` = esbuild, `node:test` = tsx; neither
  typechecks SFCs).
- **AC-6** — No `apps/server`, `packages/*`, or `apps/registry-viewer` path in the
  diff; `finalStateHash` untouched (assert).
- **AC-7** — **D-24026 live verification** on deployed `play.legendary-arena.com`:
  save a bench-carrying loadout (paste a viewer LAGN export) and confirm the bench
  shows on the Saved Loadouts card and the Shared Loadout page. Drive the terminal
  action, not just a render.

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter arena-client typecheck      # load-bearing; AC-5
pnpm --filter arena-client test
pnpm -r --no-bail test
git diff --name-only | grep -E 'server|packages/|registry-viewer'   # expect NO output
pnpm roadmap:counts:check
```

Then the AC-7 live pass on the deployed bundle, after the deploy-confirmed SHA.

---

## Vision Alignment

- **Clauses touched:** §19b (loadout library), NG-1. **No conflict** — a displayed
  bench is organizational convenience; it confers no in-match capability (the bench
  never reaches `matchConfiguration` or any engine path, D-24210), so NG-1
  ("no pay-to-win") is untouched. No monetization/identity/live-ops surface.
- **Determinism:** no engine, RNG, scoring, replay, or persistence surface; a
  read-only display projection. AC-6 pins it.

---

## Lightweight-Lane Note

Provisionally **lightweight-lane eligible** (`01.0a`): single layer
(`apps/arena-client`), ≤4 code/test files, strictly additive, no new contract
file, surface limited to UX display. The executor confirms the empirical criteria
(additive, zero determinism impact, file budget) at govern-close; any miss
self-demotes to the two-session lane.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Non-negotiables | PASS — display-only; no server/engine/lagn-spec edit; opaque `lagn` |
| §3 Assumes | PASS — WP-404 ✅ + WP-402 ✅ + WP-301/302 ✅ named |
| §4 Context refs | PASS — D-24087 / D-24086 / D-24210 / D-24211 cited |
| §5 Output completeness | PASS — 4 code/test files + governance |
| §6 Naming | PASS — `heroAlternates` (client camelCase) ↔ `hero_alternates` (LAGN) |
| §7 Dependency discipline | PASS — both hard-deps landed |
| §8 Architectural boundaries | PASS — single layer, `apps/arena-client` |
| §9 Windows | PASS |
| §10 Env vars | N/A |
| §11 Auth | N/A — the saved-loadout endpoints/auth are WP-301's, unchanged |
| §12 Test quality | PASS — AC-1 read + AC-4 regression + the two SFC render paths |
| §13 Commands | PASS |
| §14 AC quality | PASS — 7 binary criteria |
| §15 DoD | PASS |
| §15.1 D-24026 | **TRIGGERED** — `play.legendary-arena.com`; AC-7 drives the terminal action |
| §16 Code style | PASS — reuses `readEntityNames`; no parallel reader; opaque `lagn` |
| §17 Vision | PASS — §19b; NG-1 untouched (bench confers no in-match capability) |
| §18 Determinism | **PASS, asserted** — AC-6 pins no engine/server/packages path; read-only projection |
| §19 Rollback | PASS — reverting removes the bench display; stored documents unchanged |
| §20 Migration | N/A — no stored-record change; the field is already stored |
| §21 API catalog | **N/A** — no endpoint added/changed; the server already stores the field |

## Definition of Done

- [ ] AC-1..AC-7 each demonstrated with observed output
- [ ] `pnpm --filter arena-client typecheck` 0 (AC-5, load-bearing)
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `git diff --name-only` has no `apps/server` / `packages/` / `registry-viewer` path
- [ ] **AC-7 live-verified on the deployed bundle** and the STATUS flip recorded
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
