# WP-315 — Card Ability Text in `UICardDisplay` + Diagnostic Embedding (WP-314 Option B)

## Goal

Project each hero card's printed ability text onto the engine's `UICardDisplay`
(a new **optional** `abilityText` field), populated at setup from the registry's
`card.abilities`, and have the diagnostic export's `recentlyPlayedCards` embed that
text for each played card. This delivers **WP-314 Option B** (D-24100): a "froze
after I played card X" report now carries the card's literal printed text alongside
the inferred `outcome`, so an operator can confirm at a glance whether the effect
that fired matches the printed rules — without an engine trace or a manual
`data/cards/*.json` lookup.

## Assumes

- **WP-314 / D-24100** (shipped, `origin/main` @ `7ade7532`) — the diagnostic
  `effectProvenance` block with `recentlyPlayedCards[].abilityText` and the injected
  `resolveCardText` seam this WP populates. Source: `apps/arena-client/src/diagnostics/effectProvenance.ts`.
- **WP-018 / WP-135 `G.cardDisplayData`** — the setup-time `Readonly<Record<CardExtId, UICardDisplay>>`
  sibling-snapshot and its hero card-instance (`#N`, slash-format) population branch.
  Source: `packages/game-engine/src/setup/buildCardDisplayData.ts §1b`.
- **`resolveDisplay` spread** — the UIState projection returns `{ ...entry, heroClass, team }`
  (`uiState.build.ts:125`), so a new `cardDisplayData` field rides every display projection
  automatically with no projection edit. Source: `uiState.build.ts:104-128`.
- **Registry `card.abilities: string[]`** — the printed ability lines (marker-annotated),
  present on ~95% of hero cards across all sets (verified `antm`/`core`/`xmen`). Source:
  `data/cards/*.json` hero `cards[].abilities`.
- Baseline: `origin/main` @ `7ade7532`.

## Context

WP-314 shipped the diagnostic `effectProvenance` block but discovered (D-24100) that
the arena-client has **no client-side card-text source** — the `UICardDisplay` projection
carries only name/image/cost, and `diagnostics.ts` is boundary-pure (cannot import the
registry). So `abilityText` was left as an injected `resolveCardText` seam defaulting to
`null`. Jeff asked for Option B: literally embed the card text. The architecturally-aligned
way is to make the **engine** project ability text onto `UICardDisplay` (the engine owns card
data; display already flows engine→client), then have the diagnostic read it structurally from
the snapshot it already carries. This respects the layer boundary (engine produces the
projection; the client consumes it via the snapshot with no import), reuses the existing
`cardDisplayData` → `resolveDisplay` channel, and — as a side benefit — makes ability text
available to a future in-HUD card tooltip.

**Single WP, cross-package, boundary-respecting.** The engine half (produce) and the
client half (consume the snapshot) are the normal engine→client data-flow direction, not a
boundary crossing — so this is one WP, not a split. It is NOT lightweight-lane eligible
(touches two packages + a contract type), so it runs the standard two-session lane.

**Scoped to hero card instances.** `recentlyPlayedCards` only tracks *played* cards, which
are hero card instances (the `#N` slash-format ext_ids from `buildCardDisplayData §1b`).
Villain / mastermind / henchman / scheme ability text is explicitly OUT of scope (those are
fought, not played, and never appear in `recentlyPlayedCards`); a later WP may extend
`abilityText` to those surfaces if an in-HUD tooltip wants it.

## Scope (In)

- Add `abilityText?: string` (optional) to `UICardDisplay` (`uiState.types.ts`).
- Populate it in `buildCardDisplayData §1b` (BOTH the `physicalCards` branch and the
  per-card fallback branch) from the hero card entry's `abilities` array, joined into one
  string (marker-annotated text preserved verbatim). Absent / empty `abilities` → field
  omitted (fail-soft; no empty string).
- The UIState projection carries `abilityText` automatically via `resolveDisplay`'s spread
  (assert this in a projection test; no projection-code edit expected).
- Diagnostic: `effectProvenance.buildEffectProvenance` derives an `extId → abilityText` map
  from the snapshot's own display-bearing zones (the viewer's `inPlayDisplay` / `handDisplay`
  / `discardDisplay`, and the shared face-up display arrays) and uses it as the default
  `abilityText` source for `recentlyPlayedCards`, replacing the `() => null` default. The
  explicit `resolveCardText` parameter remains an optional override.

## Scope (Out)

- No `abilityText` on villain / mastermind / henchman / scheme / bystander / master-strike
  display entries (deferred; optional field stays absent there).
- No in-HUD rendering of ability text (diagnostic export only; a future WP owns any on-screen
  tooltip).
- No change to gameplay, moves, effect resolution, determinism, or `finalStateHash`
  (`cardDisplayData` is setup-time static registry data, already in `G`; adding a string
  field to existing entries changes no runtime decision).
- No new registry import in any engine or client file (registry data reaches the engine only
  via the existing `Game.setup()` reader; the client reads only the snapshot).
- No change to `diagnostics.ts`, `DiagnosticExportButton.vue`, or any on-screen play component.

## Files Expected to Change

**Engine (`packages/game-engine`):**
- `src/ui/uiState.types.ts` — add `abilityText?: string` to `UICardDisplay`.
- `src/setup/buildCardDisplayData.ts` — populate `abilityText` in §1b (both branches);
  extend the local `DisplayDataHeroCardEntry` interface with `abilities?: string[]`.
- `src/ui/uiState.types.drift.test.ts` — extend the `UICardDisplay` fixture (drift guard).
- `src/setup/buildCardDisplayData.test.ts` — assert `abilityText` populated for a hero card
  instance + omitted when `abilities` absent.
- `src/ui/uiState.build.test.ts` — assert `abilityText` rides `resolveDisplay` into a
  projected zone (the projection-carry proof).

**Client (`apps/arena-client`):**
- `src/diagnostics/effectProvenance.ts` — derive the `extId → abilityText` map from the
  snapshot; use as the default `abilityText` source.
- `src/diagnostics/effectProvenance.test.ts` — snapshot-derived-text tests.

**Governance:** `docs/ai/DECISIONS.md` (D-24101), `STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.

**Conditional fold-inline (WP-313 precedent):** if `uiState.filter.ts` reconstructs a
`UICardDisplay` for any zone the viewer sees (rather than passing the projected object
through), `abilityText` must be preserved there — add the file per the fold-inline rule and
record it in D-24101. Expected: no change (the filter redacts hidden cards; it does not
rebuild visible-card display).

## Contract

- `UICardDisplay.abilityText?: string` — the card's printed ability lines joined by a single
  newline, marker annotations (`[keyword:…]`, `[hc:…]`) preserved verbatim. Absent when the
  card has no `abilities` (never an empty string). Optional → no fixture backfill required for
  existing `UICardDisplay` consumers.
- `recentlyPlayedCards[].abilityText: string | null` (unchanged shape from WP-314) — now
  populated from the snapshot's projected display for the viewer's visible played cards; `null`
  when the card is not in a viewer-visible zone (e.g. an opponent's play) or carries no text.

## Acceptance Criteria

- `UICardDisplay` has an optional `abilityText`; the drift fixture includes it.
- `buildCardDisplayData` populates `abilityText` for hero card instances from `abilities`
  (both §1b branches); omits it when `abilities` is absent/empty.
- A projected zone entry (e.g. `inPlayDisplay`) carries `abilityText` (projection-carry test).
- `buildEffectProvenance` populates `recentlyPlayedCards[].abilityText` from a snapshot whose
  display zones carry the text; falls back to `null` for cards not in a visible zone.
- Engine + arena-client suites green; `vue-tsc` clean; `pnpm -r build` 0.
- No `finalStateHash` change (determinism unaffected — setup-time static data).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — green (new display + projection tests).
2. `pnpm --filter @legendary-arena/game-engine build` (registry consumers read `dist`).
3. `pnpm --filter @legendary-arena/arena-client test` + `typecheck` — green.
4. `pnpm -r build` — 0.
5. **D-24026 live-verify (operator, post-deploy):** play a hero card, export the diagnostic,
   confirm `recentlyPlayedCards[].abilityText` shows the printed text for the played card.

## Definition of Done

- [ ] All allowlist files changed; engine + arena-client suites green; `vue-tsc` clean;
      `pnpm -r build` 0.
- [ ] `abilityText` optional on `UICardDisplay`; drift fixture updated.
- [ ] `recentlyPlayedCards[].abilityText` populated from the snapshot in a test.
- [ ] D-24101 landed (Active); STATUS / WORK_INDEX (WP-315 [x]) / EC_INDEX (EC-345 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` diagnostic export → D-24026 live-verify
      operator-pending (embedded card text appears in the export).

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
1. **Goal clear** — PASS (one paragraph, user-visible: embedded card text in export).
2. **Layer identified** — PASS (Game Engine produce + arena-client consume; boundary-respecting).
3. **Deps listed** — PASS (WP-314/D-24100, WP-018/135, resolveDisplay spread).
4. **Scope closed** — PASS (In/Out enumerated; hero-only scoping explicit).
5. **Files allowlisted** — PASS (6 code/test + governance + conditional filter fold-inline).
6. **Contract stated** — PASS (`abilityText` field semantics + join/marker/absent rules).
7. **Acceptance testable** — PASS.
8. **Determinism** — PASS/N/A (setup-time static data; no `finalStateHash` change; §Scope Out).
9. **Persistence** — N/A (no snapshot-count or persistence change; `cardDisplayData` already in G).
10. **Randomness** — N/A (no RNG).
11. **Move contract** — N/A (no moves touched).
12. **Phase/turn** — N/A.
13. **Zone ops** — N/A (no zone mutation; display is a read-side sibling-snapshot).
14. **Naming** — PASS (`abilityText` full words; matches registry `abilities`).
15. **Comments** — PASS (`// why:` on the join + the marker-preservation + the omit-when-empty).
16. **Error handling** — PASS (fail-soft: absent `abilities` → omit; malformed → skip; no throw).
17. **Vision** — PASS (§3 clarity / §14 observability / §22; no conflict; no anti-commercial drift).
18. **Contract-file lock** — PASS with DECISIONS entry — `uiState.types.ts` is a contract file;
    the additive optional field is authorized by D-24101 (contract-change → DECISIONS rule).
19. **Drift arrays** — N/A (`UICardDisplay` is not a canonical readonly array; the drift *fixture*
    test is updated per §Files).
20. **Test extension** — PASS (`.test.ts`).
21. **API catalog (D-11804)** — N/A (no HTTP endpoint / `apps/server` library surface change).

## Pre-flight Verdict (01.4)

**READY TO EXECUTE.** Dependencies complete on `main` (WP-314/D-24100 @ `7ade7532`; WP-018/135
cardDisplayData present). Scope locked and additive (optional field; no rewrite). The one
empirical risk — whether `uiState.filter.ts` reconstructs visible-zone display and would drop
`abilityText` — is pre-identified as a conditional fold-inline (WP-313 precedent) with the
expected outcome (no change) stated; it does not block READY because the allowlist already
accounts for it. Not a validation-tightening WP (no input newly rejected), so no scaffold gate
applies. No `01.6` trigger beyond the contract-field add (covered by D-24101).

## Copilot Check Verdict (01.7)

**PASS.** No invented mechanics; no persisted runtime state; no upward/sideways import; the
change is a read-side display field flowing the sanctioned engine→client direction. RISK noted
and documented: the filter-reconstruction question (mitigated above as a conditional fold-inline).
Determinism preserved (setup-time static registry data). Wire cost is bounded and one-time
(static `cardDisplayData` rides boardgame.io deltas — re-sent only on full sync/resync).
