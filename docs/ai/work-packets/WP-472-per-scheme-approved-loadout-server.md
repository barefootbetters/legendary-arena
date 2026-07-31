# WP-472 — Per-Scheme Approved-Loadout: Server Truth + Leaderboard Qualification + Publisher (Arc 2/5)

**User-Visible Surface:** `legends.legendary-arena.com` (indirectly — the published
`gauntlet-index.json` now carries per-scheme approved loadouts; the visible variety
renders in WP-474). **D-24026 live-verification applies** (operator-pending: the
deployed snapshot's legs carry per-scheme loadouts).

## User-Visible Impact

None in this packet directly; it makes the server qualify ranked runs and publish
approved loadouts **per scheme**, so WP-474 can render the variety and ranked play
judges each leg against its own approved adversaries.

## Goal

Arc 2 of 5. Thread the WP-471 per-scheme config through the server's **shared truth +
leaderboard + publisher** so the ranked gauntlet's approved loadouts are keyed per
**(scheme × mastermind × player-count)**: the wiring builds a per-scheme map,
`matchesApprovedLoadout` / `qualifiesAsLegClear` select the **leg's** config (by the
scheme already carried in `scenarioKey`), the **leaderboard** caller
(`getGauntletStandings`) passes the leg scheme, the `buildSetDetailsCatalog` coverage
flags (D-24279) recompute against per-scheme configs, and the publisher emits the
per-scheme loadout **onto each `GauntletIndexLeg`**. Lands **D-24283** (supersedes
D-24278's one-config-per-mastermind axis; PAR count unchanged; D-24199 core rule intact).

**Additive re-key (arc-splitting invariant).** The shared truth predicate gains a
per-scheme lookup that is **additive**: absent a scheme it falls back to today's
per-mastermind selection, so the **other** caller — the run-tracker leg-clear +
per-leg launch (WP-473) and the client consumers (WP-474) — keep building and
behaving as today until each migrates its own call site. Only this WP's leaderboard +
publisher path is migrated here; the functional "leg requires Skrulls but launch/tracker
still uses the mastermind default" gap is closed incrementally across WP-473/474.

## Assumes

- **On `origin/main` after WP-471 merges** — `packages/registry` exposes
  `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)` +
  `getActiveYear()` from the year-keyed JSON. `apps/server` green.
- Chain map (2026-07-30): `matchesApprovedLoadout` (`gauntletTruth.logic.ts`) already
  receives `scenarioKey` (`scheme::mastermind::villains`) and parses `[2]` (villains)
  — the scheme `[0]` is in-hand, just unused. `server.mjs` wiring already gathers
  every set's schemes. `GauntletDefinition.legs` are the schemes; the loadout is a
  sibling `approvedLoadouts` (per count).

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (server wires,
engine/registry decide; legends module imports no registry — data is injected),
`.claude/rules/architecture.md` + the `legendary-server` skill, the WP-471 loader,
`docs/ai/REFERENCE/00.2-data-requirements.md §8.1` (canonical `villainGroupIds` /
`henchmanGroupIds` field names carried by the approved-loadout shapes), and the D-24283
draft in `DECISIONS.md`. Source: `server.mjs` (wiring ~607-660),
`gauntlet.logic.ts` (`GauntletApprovedLoadouts`, `buildGauntletCatalog`,
`getGauntletStandings`), `gauntletTruth.logic.ts` (`matchesApprovedLoadout`,
`qualifiesAsLegClear`), `legends.publisher.ts` (`buildPublishedApprovedLoadouts`),
`legends.types.ts` (`GauntletIndexApprovedLoadouts`, `GauntletIndexLeg`).

## Scope (In)

- **`apps/server/src/server.mjs`** (01.5 wiring): build the approved-loadout map per
  **(setAbbr/mastermindSlug/schemeSlug)** from the WP-471 loader (active year) — one
  entry per leg per count — instead of the per-mastermind `GAUNTLET_LOADOUT_MENUS`
  loop; pass it through the existing catalog-injection path.
- **`apps/server/src/legends/gauntletTruth.logic.ts`** (the exact additive signature —
  do NOT deviate): `matchesApprovedLoadout`'s signature is **unchanged**;
  `qualifiesAsLegClear` gains **exactly one new optional trailing parameter**
  `approvedLoadoutsByScheme?: ReadonlyMap<string, GauntletApprovedLoadouts>` and resolves
  `effective = approvedLoadoutsByScheme?.get(scenarioKey.split('::')[0]) ?? approvedLoadouts`
  before the existing match. **`GauntletApprovedLoadouts`'s shape and the existing
  `approvedLoadouts` param are PRESERVED unchanged** — do NOT re-key the type in place or
  move it onto `GauntletLeg`. This is what keeps WP-473's 3-arg `qualifiesAsLegClear(facts,
  inputs.approvedLoadouts, publishedVersion)` call compiling untouched (the additive-split
  invariant).
- **`apps/server/src/legends/gauntlet.logic.ts`**: `getGauntletStandings` builds the
  per-scheme `ReadonlyMap<schemeSlug, GauntletApprovedLoadouts>` (from the injected
  per-scheme wiring) and passes it as the new optional arg to `qualifiesAsLegClear`; the
  scheme it keys by is `replay.scenarioKey.split('::')[0]` (already computed for score
  bucketing). `definition.approvedLoadouts` (per-mastermind) stays populated as the
  fallback; `buildGauntletCatalog` stamps the per-scheme loadout onto each `GauntletLeg`
  **additively** (a new leg field), leaving the entry-level menu in place.
- **`apps/server/src/legends/gauntlet.logic.ts §coverage`**: `buildSetDetailsCatalog`
  (D-24279 `usedByGauntlets` flags) recomputes against the per-scheme configs — a
  villain/henchman group counts as "used" if it appears in **any leg's** approved config,
  so per-scheme changes the coverage set. `buildGauntletCatalog` stamps the per-scheme
  loadout onto each `GauntletDefinition` leg.
- **`apps/server/src/legends/legends.publisher.ts`**: `buildPublishedApprovedLoadouts`
  emits per-scheme; attach the per-count loadout to each **`GauntletIndexLeg`**.
- **`apps/server/src/legends/legends.types.ts`**: **add** the published approved loadout
  onto `GauntletIndexLeg` (`approvedLoadouts?: GauntletIndexApprovedLoadouts`) — additive.
  **Dual-write (RS-1, no deploy-window blank):** the entry-level
  `GauntletIndexEntry.approvedLoadouts` stays **populated** (per-mastermind) here so the
  deployed pre-WP-474 legends-board (which reads it via `selectApprovedLoadout`) keeps
  showing loadouts between the WP-472 and WP-474 Cloudflare Pages deploys; **WP-474**
  removes the entry-level field once the client mirror reads the leg-level one.
- **Tests** for the re-keyed qualification (a run qualifies only against its leg's
  config; a swapped-scheme run with the mastermind's *other* scheme's villains is
  rejected) + the per-leg publisher emission.
- **`docs/ai/DECISIONS.md`**: land **D-24283**.

## Out of Scope

- **Run-tracker leg-clear (`apps/server/src/gauntlet/gauntletRunProgress.logic.ts`) +
  the per-leg "Play this leg" launch composition (`server.mjs
  resolveGauntletRunProgressInputs`, `GauntletRunLaunch`, `deriveGauntletRunLaunch`,
  `gauntletRun.types.ts`) → WP-473.** The additive scheme param keeps those callers
  green here; WP-473 migrates them.
- No client/cards change (`LoadoutBuilder.vue`, legends-board, gauntletQualificationCheck,
  pack import) → WP-474. No registry change beyond consuming the WP-471 loader.
- No scoring-math / `ScenarioKey` / `henchman_key` shape change (only which approved
  config a leg is matched/published against).

## Files Expected to Change

- `apps/server/src/server.mjs` — 01.5 wiring (per-scheme map)
- `apps/server/src/legends/gauntlet.logic.ts` — re-key + per-leg stamp (+ test)
- `apps/server/src/legends/gauntletTruth.logic.ts` — per-scheme match (+ test)
- `apps/server/src/legends/legends.publisher.ts` — per-leg emission (+ test)
- `apps/server/src/legends/legends.types.ts` — loadout onto `GauntletIndexLeg`
- `docs/ai/DECISIONS.md` — land D-24283

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; the legends module imports
> no registry (per-scheme configs injected via the wiring layer, as today);
> deterministic fixed-order JSON; the published loadout is additive on the leg
> (pre-WP-474 readers ignore it).

**Locked:** approved loadout keyed per (scheme × mastermind × count); published on
`GauntletIndexLeg`; `matchesApprovedLoadout` selects by the leg scheme parsed from
`scenarioKey`; D-24199 core rule + `ScenarioKey`/`henchman_key` shapes unchanged;
PAR scenario count unchanged (~2,118 — one config per leg per count, as before).

## Acceptance Criteria

- [ ] The published `gauntlet-index.json` legs carry per-scheme `approvedLoadouts`;
      a Core Dr. Doom "Secret Invasion…" leg publishes Skrulls + Masters of Evil at
      2p, a non-swapped Dr. Doom leg publishes Brotherhood + Masters of Evil.
- [ ] `matchesApprovedLoadout` qualifies a run only against **its leg's** approved
      config; a run matching a *different* scheme's villains of the same mastermind
      is rejected (new test).
- [ ] Non-Core gauntlets qualify + publish identically to today (seeded configs).
- [ ] `buildSetDetailsCatalog` coverage uses **union-over-legs** semantics, not
      single-leg: the Core coverage input marks `radiation` **used** (it now appears in
      Loki's 3 swapped schemes) **and** still marks `enemies-of-asgard` **used** (still on
      Loki's other legs + Dr. Doom) — proving a group counts as used if it appears in
      **any** leg's config, so coverage grows, never under-reports.
- [ ] The legends module imports no registry; per-scheme configs arrive injected.
- [ ] `D-24283` landed. Server tests (run affected pure files directly if the DB
      suite times out) + `pnpm -r build` exit 0.
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
node --import tsx --test apps/server/src/legends/gauntletTruth.logic.test.ts \
  apps/server/src/legends/gauntlet.logic.test.ts apps/server/src/legends/legends.publisher.test.ts
pnpm -r build
# Post-deploy (D-24026): gauntlet-index.json legs carry approvedLoadouts; Core
# Dr. Doom Secret-Invasion 2p = skrulls + masters-of-evil.
```

## Vision Alignment

**Clauses:** §20-26 (competitive gauntlet), §22 (scoring config versioning).
**Conflict:** *No conflict* — the ranked contract changes which approved config a
leg matches; PAR/score math unchanged; `competitive_scores` empty (zero migration).
Reopens D-24278's per-mastermind axis under **D-24283** (documented). **NG:** none.

## Definition of Done

- [ ] All AC pass; server tests + `pnpm -r build` green. **D-24283 Active.**
- [ ] **D-24026 live-verify (operator-pending):** deployed snapshot legs carry
      per-scheme loadouts.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-507 Done.
- [ ] No files outside the list.

## Lint Gate Self-Review

- §1/§15: header + impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list. PASS. §5: 5 server files + wiring (01.5) + DECISIONS. PASS.
  §8: legends registry-free (injected). PASS. §17: §20-26/§22, No conflict, D-24283.
  PASS. §20 N/A — no funding surface, copy, or channel touched. §21 N/A — publisher writes R2, no apps/server HTTP endpoint or Library-only fn changed. Reserves/lands **D-24283**.

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body (paired with WP-471 + WP-473 + WP-474).
