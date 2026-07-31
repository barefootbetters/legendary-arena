# WP-474 — Per-Scheme Approved-Loadout: Client + Cards Consumers (Arc 4/5)

**User-Visible Surface:** `legends.legendary-arena.com` (the coverage matrix / reveal
/ challenge links now vary by scheme) **and** `cards.legendary-arena.com` (the
qualification badge + pack prefill honour the leg's scheme). **D-24026
live-verification applies** (operator-pending on both Cloudflare Pages deploys).

## User-Visible Impact

The coverage matrix's ✓ patterns finally **differ per scheme** (the whole point of
the variety) — e.g. Dr. Doom's "Secret Invasion…" row fights Skrulls while his other
rows fight Brotherhood. Challenge links, the WP-456 reveal, the cards-builder
qualification badge, and gauntlet-pack prefill all resolve the **leg's** approved
adversaries.

## Goal

Arc 4 of 5. Make every consumer read the per-scheme approved loadout WP-472 publishes
(on `GauntletIndexLeg`): the legends-board snapshot mirror moves in lockstep, and the
coverage matrix / reveal / challenge links resolve per leg; the cards-builder
qualification badge (WP-454) and gauntlet-pack prefill (WP-444) resolve by the leg's
scheme. No new decision — this consumes the D-24283 contract.

## Assumes

- **On `origin/main` after WP-472 merges** — the published `gauntlet-index.json` legs
  carry `approvedLoadouts` (per count); the server `GauntletIndexLeg` type carries it;
  the registry `getGauntletConfig(...schemeSlug...)` exists (WP-471). `apps/legends-
  board` + `apps/registry-viewer` green.
- **Two consumption shapes.** The legends-board consumers read `leg.approvedLoadouts`
  off the mirror — WP-472 already stamps that as the leg's **effective** loadout
  (per-scheme where authored, else the per-mastermind menu), so every leg carries one. The
  registry-viewer consumers instead call `getGauntletConfig` **directly**, which returns
  **`undefined` for any absent leg** (the JSON is Core-only, #1116); those consumers MUST
  fall back to the per-mastermind menu (`GauntletLoadoutMenu` / `compositionsByPlayerCount`)
  on `undefined` — exactly what the cards badge + pack prefill read today.
- Chain map (2026-07-30): the client consumers already have the scheme in hand —
  `buildCoverageMatrix` iterates `leg.schemeSlug`, `buildRowChallengeUrl` uses
  `legs[0].schemeSlug`, the reveal lists `legs`, the pack prefill carries
  `input.schemeId`; only `checkGauntletQualification` (WP-454) lacks a `schemeId` on
  its input.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (legends board
mirrors snapshot types, never imports server; registry-viewer reads registry),
WP-472's `GauntletIndexLeg` change, and the consumers in
`apps/legends-board/src/panels/gauntletDisplay.ts`
(`selectApprovedLoadout`/`listApprovedLoadouts`/`buildGauntletDetails`/`buildRowChallengeUrl`/`buildCoverageMatrix`)
+ `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` +
`loadoutGauntletPackImport.ts`, and `docs/ai/REFERENCE/00.2-data-requirements.md §8.1`
(the canonical `villainGroupIds` / `henchmanGroupIds` / `schemeId` field names).

## Scope (In)

- **`apps/legends-board/src/snapshots/snapshotClient.ts`** — mirror WP-472: move
  `approvedLoadouts` onto the `GauntletIndexLeg` mirror (drop/deprecate the
  entry-level field); tolerate an old snapshot (absent → today's degrade).
- **`apps/legends-board/src/panels/gauntletDisplay.ts`** — `selectApprovedLoadout` /
  `listApprovedLoadouts` take the **leg** (or scheme) and read `leg.approvedLoadouts`;
  `buildCoverageMatrix` selects per **leg** (so each scheme-row's ✓ pattern reflects
  that leg's config — remove the "config doesn't vary by scheme" reuse);
  `buildGauntletDetails` (WP-456 reveal) pairs each scheme with its own config;
  `buildRowChallengeUrl` pins the row's leg config. (+ tests.)
- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** /
  **`GauntletBoardPanel.vue`** — pass the leg to the updated helpers.
- **`apps/registry-viewer/src/lib/gauntletQualificationCheck.ts`** — add `schemeId`
  to `GauntletQualificationInput`; resolve the leg's approved config via the **WP-471
  `getGauntletConfig` loader**, **falling back to the per-mastermind `GauntletLoadoutMenu`
  when `getGauntletConfig` returns `undefined`** (all non-Core, unswapped Core — the
  today-behaviour). (RS-2: **not** by extending `GauntletLoadoutMenu` in
  `packages/registry/src/gauntletLoadouts.ts`, which is intentionally **not** in this
  allowlist — the barrel export from WP-471 makes `getGauntletConfig` reachable). (+ tests,
  incl. an absent-leg case that resolves to the per-mastermind menu.)
- **`apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts`** —
  `resolveGauntletLegLoadout` **uses** the `input.schemeId` it already carries to select
  the leg's composition via `getGauntletConfig`, **falling back to the scheme-blind
  `compositionsByPlayerCount`** (the per-mastermind menu) when the loader returns
  `undefined` (today it echoes `schemeId` but always pulls scheme-blind — the client twin
  of the launch break). (+ tests, incl. an absent-leg fallback case.)
- **`apps/registry-viewer/src/components/LoadoutBuilder.vue`** — the orchestrator call
  sites thread the leg's scheme: `onPickGauntletLeg` passes `schemeId` into a resolver
  that now uses it; the `gauntletQualification` computed passes `schemeId` into
  `checkGauntletQualification` (today it omits it); `gauntletMenu` / the menu lookups
  resolve per-scheme. Without this, the badge + prefill stay scheme-blind even after the
  helper signatures gain `schemeId`.

## Out of Scope

- No registry/server/publisher/snapshot **contract** change (WP-471/472 own it); this
  packet only *reads* the per-scheme data. No D-entry.

## Files Expected to Change

- `apps/legends-board/src/snapshots/snapshotClient.ts` — mirror re-key
- `apps/legends-board/src/panels/gauntletDisplay.ts` (+ `.test.ts`) — per-leg helpers
- `apps/legends-board/src/panels/GauntletIndexPanel.vue`, `GauntletBoardPanel.vue`
- `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` (+ test) — schemeId
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` (+ test) — per-scheme select
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — thread schemeId into the badge + prefill call sites

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; legends board `vue`-only /
> zero-API, mirrors (never imports) the server leg type; registry-viewer reads the
> registry; rendered coverage data now per-scheme; degrades on an old snapshot.

**Locked:** consumers read the **leg's** approved config; the coverage matrix ✓
pattern varies by scheme; the cards badge + pack prefill resolve by the leg scheme;
mirror moves in lockstep with WP-472; accessible names / count selector unchanged.

## Acceptance Criteria

- [ ] The Core coverage matrix shows **different** ✓ patterns across a mastermind's
      schemes (e.g. Dr. Doom "Secret Invasion…" marks Skrulls ✓ where his other
      schemes mark Brotherhood ✓).
- [ ] Challenge links + the WP-456 reveal pin each leg's own approved adversaries.
- [ ] The cards-builder badge qualifies a draft against the **leg's** config
      (schemeId threaded); the pack prefill fills the leg's approved adversaries.
- [ ] An old snapshot (no per-leg loadouts) degrades cleanly (no crash).
- [ ] legends-board + registry-viewer `test`/`typecheck`/`build` + `pnpm -r build`
      exit 0.
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test typecheck build
pnpm --filter registry-viewer test typecheck build
pnpm -r build
# Live smoke (D-24026): Core matrix at 2p — Dr. Doom's Secret-Invasion row marks
# Skrulls ✓; a non-swapped row marks Brotherhood ✓. Cards badge honours the leg.
```

## Vision Alignment

**Clauses:** §10 (board presentation), §20-26 (gauntlet). **Conflict:** *No conflict*
— read-only render + qualification-preview of the per-scheme contract. **NG:** none.

## Definition of Done

- [ ] All AC pass; legends-board + registry-viewer + `pnpm -r build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed matrix varies per scheme;
      cards badge/pack honour the leg.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-509 Done.
- [ ] No files outside the list. No D-entry (consumes D-24283).

## Lint Gate Self-Review

- §1/§15: header + impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list. PASS. §5: legends-board (3) + registry-viewer (2) files, two
  apps, same client tier. PASS. §8: mirror-not-import; registry-viewer reads
  registry. PASS. §17: §10/§20-26, No conflict. PASS. §20 N/A — no funding surface, copy, or channel touched. §21 N/A — client-tier reads only; no apps/server HTTP endpoint or Library-only fn touched. No new
  contract file; no D-entry.

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body (paired with WP-471 + WP-472).
