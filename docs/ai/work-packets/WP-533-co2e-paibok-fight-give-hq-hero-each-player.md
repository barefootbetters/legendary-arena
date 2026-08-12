# WP-533 — co2e Paibok the Power Skrull Fight: Mark the co2e Twin (give-hq-hero-each-player)

**User-Visible Surface:** `play.legendary-arena.com` — fighting the **co2e**
(Legendary 2nd-edition) **Paibok the Power Skrull** now gives each player an HQ Hero
(the same interactive effect WP-532 shipped for the Core card) instead of doing
nothing. **D-24026 live-verification applies** (operator-pending, post-deploy).

## User-Visible Impact

The co2e Skrulls villain **Paibok the Power Skrull**'s Fight — *"Choose a Hero from
the HQ for each player. Each player gains that Hero."* — is currently **unmarked**, so
fighting him reaches no executable handler (D-24266 `unmarked-ability` `no-handler`
breadcrumb). This is the **co2e twin** WP-532 deferred (it marked only the Core card).

## Goal

Mark the co2e `co2e/skulls/paibok-the-power-skrull` (copies 2) **Fight** line with the
**existing** `give-hq-hero-each-player` primitive (WP-532 / D-24343). **Card-data
only** — no engine, client, or server change; no new primitive; **no new
DECISIONS entry** (applies D-24343). **Lightweight lane** (single layer, additive).

## Assumes

- Baseline: `origin/main` @ the WP-533 reserve (`529a5602` + the reserve commit).
  Working tree clean.
- **WP-532 / D-24343 — the `give-hq-hero-each-player` primitive is landed and
  executable** (the Core Paibok marking; `villainEffects.execute.ts#give-hq-hero-each-player`).
  This WP adds only the co2e card marker — the handler, pending type, move, guards,
  UIState, client prompt, and bot wiring already exist and are set-agnostic (they
  dispatch on the villain hook, not the set).
- The co2e group slug is **`skulls`** — a typo in the co2e upstream source
  (`data/cards/co2e.json` uses `"slug": "skulls"`; the villain instance ext_id is
  `co2e-villain-skulls-paibok-the-power-skrull-00`). The marker key MUST match it.
- `scripts/convert-cards/apply-effect-markers.mjs` reads
  `scripts/convert-cards/inputs/villain-effect-markers.json` (`MARKER_MAP_PATH`) and
  already recognizes `give-hq-hero-each-player` (added by WP-532); no tooling change.

## Context (Read First)

- `.claude/CLAUDE.md` "Card Data" section; `docs/ai/REFERENCE/01.0a §Lightweight Lane`.
- The card: `data/cards/co2e.json` (villains → `skulls` → `paibok-the-power-skrull`),
  Fight line (read verbatim). The co2e-only passive line *"Paibok gets +1[icon:attack]
  for each Hero Class among Heroes in the HQ."* is a **variable-attack** line
  (`resolveFightCost` class), NOT a Fight/Ambush/Escape timing line, so it does NOT
  trip the D-24266 detector and is **out of scope** (the WP-520 / D-24333 passive-class
  posture).
- Sibling markings: the WP-532 Core Paibok row + the WP-520 co2e Masters-of-Evil block.

**Split-vs-single decision:** one lightweight-lane WP. The mechanic already exists;
this is a single card-data marker + its regenerated coverage artifacts.

## Scope (In)

- Add a `skulls` group to the **co2e** section of
  `scripts/convert-cards/inputs/villain-effect-markers.json`:
  `"paibok-the-power-skrull": { "fight": ["give-hq-hero-each-player"] }`.
- Apply the marker (`apply-effect-markers.mjs`) → `data/cards/co2e.json` Fight line
  gains `[effect:give-hq-hero-each-player]` (a 1-line diff).
- Regenerate `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` (`ledger:villains`)
  and `data/metadata/effect-implementation-index.json` (`effect-index`).

## Out of Scope

- **The `+1[icon:attack] per Hero Class in the HQ` passive** — a variable-attack line,
  not a timing line; a separate mechanic class (D-24333 posture). Not marked here.
- **Any engine / client / server change** — the primitive already exists (WP-532).
- **`mechanic-provenance.json`** — `give-hq-hero-each-player` already carries its
  `{ WP-532, D-24343 }` provenance row; this WP adds no net-new primitive, so no
  provenance edit.
- No new `DECISIONS` entry (applies D-24343); no contract; no scoring/PAR.

## Files Expected to Change

**Data / tooling:** `scripts/convert-cards/inputs/villain-effect-markers.json` (co2e
`skulls` block), `data/cards/co2e.json` (regen, 1-line marker), `docs/ai/coverage/
villain-mechanic-ledger.{json,csv}` (regen), `data/metadata/effect-implementation-index.json`
(regen).

**Governance:** `NUMBER-LEDGER.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

## Contract

- The co2e Paibok Fight line reduces to the **existing** `give-hq-hero-each-player`
  primitive — identical mechanic to the Core card (WP-532): every player gains one HQ
  Hero into their discard; the current player picks interactively, non-current + bot
  players auto-gain highest-cost; refills the HQ.
- **Determinism.** Card-data only; no engine source change. The marker adds a Fight
  descriptor to the co2e Paibok hashed `villainAbilityHooks` **at setup time** — a
  hash oracle re-pins ONLY if a committed fixture materializes `co2e/skulls` Paibok.
  Verified: **no committed fixture references co2e** → `finalStateHash` /
  `PRE_WP080_HASH` / sentinel unchanged.

## Acceptance Criteria

1. The co2e `skulls/paibok-the-power-skrull` Fight line carries
   `[effect:give-hq-hero-each-player]` in `data/cards/co2e.json` (1-line diff; no other
   card churn).
2. `villain-mechanic-ledger.csv` flips the co2e Paibok row `(unmarked)`/`unmarked` →
   `give-hq-hero-each-player` / `executable` with `{ WP-532, D-24343 }` provenance;
   the co2e-only passive line stays out of the timing-line coverage.
3. `pnpm ledger:villains:check` + `pnpm effect-index:check` + `pnpm
   sim:runtime-observed:check` exit 0; `pnpm --filter @legendary-arena/registry test`
   passes (card data valid).
4. No engine/client/server file changes; hash oracles unchanged (no co2e fixture).

## Verification Steps

1. `node scripts/convert-cards/apply-effect-markers.mjs` → 1 new marker.
2. `pnpm -r build && pnpm ledger:villains && pnpm effect-index`.
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm
   sim:runtime-observed:check && pnpm roadmap:counts:check` → 0.
4. `pnpm --filter @legendary-arena/registry test` → pass.
5. `git diff --name-only` = the allowlist (data/tooling + governance only).
6. Live-verify (D-24026, operator, post-deploy): fight co2e Paibok; confirm the "choose
   a Hero to gain" prompt appears and each player gains an HQ Hero; no `no-handler`.

## Definition of Done

- All Acceptance Criteria pass; Verification Steps green.
- Two-commit topology (`EC-568:` marker + regen; `SPEC:` govern-close): STATUS updated;
  `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` + counts.
- `git diff --name-only` matches the allowlist; `User-Visible Surface =
  play.legendary-arena.com` — D-24026 operator-pending.

## Non-Negotiable Constraints

- Card-data only; NO engine/client/server change; NO new primitive; NO new D-entry
  (applies D-24343).
- Only the co2e `skulls/paibok-the-power-skrull` **Fight** line is marked; the passive
  line is out of scope.
- Regenerate the ledger:villains → effect-index chain; never hand-edit the artifacts.
- No hash re-pin (no committed fixture fights co2e Paibok — verify at execution).

## Lint Gate Self-Review (00.3)

All applicable sections resolved:
- **§1/§2** PASS. **§3 Assumes** PASS (WP-532/D-24343 landed; co2e `skulls` slug).
- **§4 Context** PASS (card + passive-class posture + sibling markings).
- **§5 Files** PASS (data/tooling + governance only). **§6 Naming** PASS
  (`give-hq-hero-each-player`, `skulls`). **§7** PASS (no new dep).
- **§8 Architecture** PASS (card-data layer only; no cross-layer). **§9-11** N/A.
- **§12 Test Quality** PASS (scaffold: registry suite + the three coverage gates).
- **§13/§14** PASS (4 binary AC). **§15/§15.1 DoD** PASS (two-commit + user-visible
  surface + D-24026). **§16** PASS (no code). **§17 Vision** PASS (faithful card
  semantics; No conflict). **§18** PASS. **§19/§20/§21** N/A.
- **No new D-entry** (applies D-24343). Lightweight lane confirmed by the scaffold run.
