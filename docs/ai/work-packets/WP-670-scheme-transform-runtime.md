# WP-670 — Scheme Transform runtime: the flip primitive + second-face capture (Chthon first slice) (Game Engine)

**Status:** Executed 2026-09-08, pending PR
**Primary Layer:** Game Engine (scheme setup + a per-move flip check)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

Nine double-sided **Schemes** across `mdns` / `msmc` / `rvlt` flip `[rule:Transforms]`
into a **"Great Old One"** alternate win condition when a per-scheme condition is met.
Midnight Sons' **Chthon** is the worked example: the base scheme *Ritual Sacrifice to
Summon Chthon* flips into *Great Old One Chthon* once **5 Bystanders** sit in the KO
pile, after which Chthon destroys players and wins if all are destroyed. Nothing in the
engine handles `[rule:Transforms]` or the `scheme-transform` card type, so the flip is
inert and the Great Old One never appears.

This WP is the **first slice** of the Scheme Transform arc — the third transform surface
after Heroes (WP-658) and Masterminds (WP-669). It builds the flip primitive +
second-face capture end-to-end for a **`SCHEME_TRANSFORM_TARGETS`** allowlist (starting
Chthon); the other eight Great Old Ones stay honest-partial.

## User-Visible Impact

In a Chthon match, once 5 Bystanders are in the KO pile the Scheme **awakens the Great
Old One**: the scheme's rules text (projected to the play surface) changes to Chthon's,
and the game log shows a `threat` line announcing the transformation. (Chthon's printed
destroy-player effect and the alternate win condition are the next slice.)

## Assumes

- **Baseline:** `origin/main` @ `d99d5ec9` (2026-09-08, includes WP-669). Re-baseline at execution.
- **`G.scheme` has no face/form field**; scheme identity lives in `G.selection.schemeId`,
  which the twist dispatcher + loss config key on. `G.scheme.gameText` is projected to the
  client. ✅ on `main`.
- **`buildSchemeGameText(schemeId, registry)` returns any scheme's first-card abilities**,
  so it reads the Great Old One face's text the same way as the base scheme's. ✅.
- **`turn.onMove` (game.ts) already runs per-move state checks** (`applyPileDepletionResourceLoss`,
  `latchFinalTurnIfDeckExhausted`, `resolveDeferredHeroGrants`) — the right cadence for a
  per-move flip trigger. ✅.
- **Bystanders in the KO pile are `bystander-villain-deck-*` / `BYSTANDER_EXT_ID`** (the
  hero-condition predicate). ✅.

## Design Rationale

**Mirror the mastermind flip, adapted to the prose-linked separate scheme faces.** Unlike
masterminds (two faces in one `masterminds[]` entry), a scheme's base and Great Old One
faces are **separate `schemes[]` entries** linked only by prose, so pairing is a hardcoded
`SCHEME_TRANSFORM_TARGETS` map. The flip does **not** change `G.selection.schemeId` (that
would break twist dispatch + loss config); instead it swaps `G.scheme.gameText` to the
Great Old One's text and sets a `hasTransformed` flag — so the flip is **observable with no
UIState projection change** (gameText is already projected). The scheme name/image, Chthon's
destroy-player effect, and the alternate win condition are honest-partial follow-ups.

**Optional fields, allowlist-gated, guarded per-move check → no hash re-pin.** The three
new `SchemeState` fields (`transformTargetSchemeId?`, `transformTargetGameText?`,
`hasTransformed?`) are populated **only** for a scheme in the allowlist (the `gameText?`
optional-field precedent), and the `onMove` check early-returns (no read, no mutation) for
every non-transform scheme. A game whose scheme does not transform — including the sentinel
`core/legacy-virus-the` — serializes byte-identically, so **no state-hash oracle re-pins**.

## Scope (In)

- **`SchemeState.transformTargetSchemeId?` + `transformTargetGameText?` + `hasTransformed?`**
  (optional; the `gameText?` precedent).
- **`SCHEME_TRANSFORM_TARGETS`** pairing map + **`transformScheme`** (pure flip) +
  **`countBystandersInKo`** + **`checkAndTransformScheme`** (the guarded per-move check),
  all in `scheme/schemeTransform.logic.ts`.
- **Setup capture** (`buildInitialGameState`): for an allowlisted scheme, read the target's
  text (`buildSchemeGameText(target)`) into the three fields via a conditional spread (absent
  otherwise).
- **`onMove` wiring** (`game.ts`): call `checkAndTransformScheme(G)` at the existing per-move
  cadence.
- **Tests**: the flip helper (flip / no-op / already-transformed); the Bystander count; the
  per-move check (flip at threshold / below / non-transform scheme / no re-flip); the setup
  capture (allowlisted present / non-allowlisted absent); the hash pins hold (no re-pin).

## Out of Scope (named follow-ups)

- **The scheme name/image identity swap** (display still resolves from `G.selection.schemeId`).
- **Chthon's destroy-the-current-player effect** and the **Chthon-Wins alternate win
  condition** (all-players-destroyed → set `SCHEME_LOSS` → `scheme-wins`) — a net-new
  player-elimination mechanic.
- **The 8 other Great Old One schemes** (msmc / rvlt) and their triggers.

## Files Expected to Change

- `packages/game-engine/src/scheme/schemeState.types.ts` — the three optional fields.
- `packages/game-engine/src/scheme/schemeTransform.logic.ts` (new) — the map + helpers.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — the setup capture.
- `packages/game-engine/src/game.ts` — the `onMove` wiring.
- `packages/game-engine/src/**/*.test.ts` — the coverage above.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24484), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: the flip is pure over `G` (no RNG); the new fields are OPTIONAL +
>   allowlist-gated and the per-move check early-returns for a non-transform scheme, so a
>   normal game is byte-identical → NO hash re-pin (verify the pin tests pass unchanged).
> - `checkAndTransformScheme` is a hook → never throws (guards absent `scheme` / `selection`
>   / `ko`); `transformScheme` is copy-then-override.
> - The flip does NOT change `G.selection.schemeId` (twist dispatch + loss config untouched).
> - Card data is untouched (both scheme faces already exist in `mdns.json`).

## Acceptance Criteria

- **AC-1** Setup of an allowlisted scheme (`mdns/ritual-sacrifice-to-summon-chthon`) captures
  `transformTargetSchemeId` = the Great Old One, `transformTargetGameText` = its lines, and
  `hasTransformed = false`.
- **AC-2** Setup of a non-allowlisted scheme leaves the three fields **absent**.
- **AC-3** `transformScheme` sets `hasTransformed = true`, swaps `gameText` to the Great Old
  One's text, preserves other fields, and is a no-op for a non-transform / already-flipped
  scheme.
- **AC-4** `checkAndTransformScheme` flips the scheme when the KO pile holds ≥ the threshold
  Bystanders and logs a `threat` awakening line; below the threshold it is a no-op; for a
  non-transform scheme (or after a flip) it is a silent no-op.
- **AC-5** Determinism: the engine hash pins pass unchanged — NO re-pin.
- **AC-6** The flip is observable via `G.scheme.gameText` (Chthon's rules), with no UIState
  projection change.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. **Control:** removing Chthon from `SCHEME_TRANSFORM_TARGETS` makes setup skip the capture
   (AC-1 fails) and `checkAndTransformScheme` a no-op (AC-4 fails) — the allowlist is load-bearing.
4. `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged.
5. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-6 satisfied; all Verification Steps green.
- [ ] `docs/ai/DECISIONS.md` — **D-24484 Active**; `STATUS.md` close-out; `WORK_INDEX.md` +
      `EC_INDEX.md` rows; mindmap node + counts.
- [ ] **D-24026 live-on-surface:** a real Chthon match awakens the Great Old One when 5
      Bystanders are KO'd — operator-pending.

## Reserved Decision (lands at execution)

**D-24484 — Scheme Transform (first slice): capture the Great Old One flip target at setup
for a `SCHEME_TRANSFORM_TARGETS` allowlist (three optional `SchemeState` fields), and flip
`G.scheme.gameText` via a pure `transformScheme` helper fired by a guarded per-move
`checkAndTransformScheme`; optional + allowlist-gated so no hash re-pin.** See the DECISIONS
entry for the full record.

## Lint Gate Self-Review (00.3)

§1–§9 PASS (engine-only; §4 no card-data / 00.2 change). §12–§17 PASS (control run mandated;
§16 human-style; §17 Vision — §1 faithful scheme behaviour, §2 engine decides, §22
determinism; §15.1 `play.legendary-arena.com` + D-24026 gate). §10/§11/§18/§20/§21 N/A.
