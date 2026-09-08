# WP-669 — Mastermind Transform runtime: the flip primitive + second-face capture (General Ross first slice) (Game Engine)

**Status:** Executed 2026-09-08, pending PR
**Primary Layer:** Game Engine (mastermind setup + the strike-time flip runtime)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

Six World War Hulk (`wwhk`) **Masterminds** are double-faced — they ship two boss
faces and flip between them mid-game off a **Master Strike** (General "Thunderbolt"
Ross ⇄ Red Hulk, Illuminati Secret Society ⇄ Open Warfare, King Hulk Sakaarson ⇄
Worldbreaker, M.O.D.O.K. ⇄ Network Nightmare, The Red King ⇄ Power Armored, the
Sentry ⇄ the Void). But `mastermind.setup.ts` keeps only the **first** non-tactic
face and drops the rest (D-24193), so the second boss never loads and the printed
`[keyword:Transforms]` is inert — the match runs against the base face only.

This WP is the **first slice** of the Mastermind Transform arc — the mastermind
analog of WP-658 for heroes. It builds the flip primitive + second-face capture
end-to-end for a **`MASTERMIND_TRANSFORM_ALLOWLIST`** (starting with
`wwhk/general-thunderbolt-ross`); the other five stay honest-partial (their second
face is still dropped) until they are added to the allowlist with a matching strike
resolver.

## User-Visible Impact

Playing General "Thunderbolt" Ross, the Mastermind **flips faces on its Master
Strike**: General Ross transforms into Red Hulk (a different Attack, Master Strike,
and always-on rules), and the next strike flips back. The play surface shows the
active face (name / image / game text) update on each flip.

## Assumes

- **Baseline:** `origin/main` @ `5187d417` (2026-09-08). Re-baseline at execution.
- **`G.mastermind` has no face/form field**, `baseCardId` is the sole `G.cardStats`
  key, and Master Strikes dispatch on `G.selection.mastermindId` via bespoke
  per-mastermind resolvers in `mastermindHandlers.ts` (NOT a marker parser). ✅ on `main`.
- **`buildCardDisplayData` already builds a display entry for every mastermind
  card** (base + second face + tactics — it walks `mastermind.cards`), so the second
  face's display is present with no change. ✅ on `main`.
- **`G.cardStats` mastermind entries are added only by `buildMastermindState`** (not
  `buildCardStats`), so adding the second face's entry there is the single site. ✅.

## Design Rationale

**Mirror the hero transform, adapted to the single-slot mastermind.** The hero
transform sets aside second-forms in `G.transformDeck` and swaps via `moveCardFromZone`.
A mastermind has ONE live slot (`baseCardId` + `G.cardStats[baseCardId]` +
`gameText`, all keyed off `G.selection.mastermindId` for strike dispatch), so the
flip is an in-place face swap, not a zone move: `baseCardId ↔ alternateFaceId`, with
`gameText` re-pointed at the new face. Both faces' fight costs live in `G.cardStats`
(added at setup) and both faces' display in `G.cardDisplayData` (already built), so
`fightMastermind` and the UIState projection follow automatically.

**Optional fields, allowlist-gated → no hash re-pin.** The two new `MastermindState`
fields (`alternateFaceId?`, `faceGameText?`) and the second face's `cardStats` entry
are populated **only** for a mastermind in the allowlist (the `hypnoThralls?` /
`gameText?` optional-field precedent). A game without a transforming mastermind —
including the sentinel `core/dr-doom` and the empty-replay `PRE_WP080_HASH` —
serializes byte-identically, so **no state-hash oracle re-pins**.

**The strike triggers the flip; named effects are honest-partial.** A new
`resolveGeneralRossStrike` branch (dispatched on `G.selection.mastermindId`) flips
the face when the Master Strike fires; the named ride-along effects
(`[keyword:Cross-Dimensional Hulk Rampage]`, `[keyword:Wounded Fury]`) are logged as
unmodeled this slice.

## Scope (In)

- **`MastermindState.alternateFaceId?` + `faceGameText?`** (optional; the `hypnoThralls?`
  precedent).
- **Setup capture** (`mastermind.setup.ts`): `findMastermindCards` also returns the
  SECOND non-tactic face; `buildMastermindState`, for a `MASTERMIND_TRANSFORM_ALLOWLIST`
  mastermind with a second face, adds its `fightCost` to `cardStats` and populates the
  two transform fields (conditional spread → absent otherwise).
- **`transformMastermind` flip helper** (`mastermind.logic.ts`): pure, copy-then-override,
  bidirectional, no-op when `alternateFaceId` is absent.
- **`resolveGeneralRossStrike`** (`mastermindHandlers.ts`) + its dispatch branch: flips
  the face on the Master Strike; logs the flip (`applied`) and the unmodeled ride-along
  (`neutral`); logs a `blocked` honest hollow if the second face was not captured.
- **Tests**: setup capture (allowlisted → fields present; non-allowlisted → absent); the
  flip helper (swap / preserve / bidirectional / no-op); the strike flip (flip / flip-back
  / hollow); the hash pins hold (no re-pin).

## Out of Scope (named follow-ups)

- **The other five transforming masterminds** (Illuminati, King Hulk, M.O.D.O.K., Red
  King, Sentry) — each is an allowlist entry + a strike resolver + (for the Sentry) the
  Void's own boss identity.
- **The named ride-along strike effects** (Cross-Dimensional Hulk Rampage, Wounded
  Fury, the Helicopter carryover) — honest-partial here.
- **The entire Scheme Transform mechanic** (`[rule:Transforms]` / `scheme-transform` /
  the Chthon alternate win condition) — WP-670.

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.types.ts` — the two optional fields.
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — the allowlist + second-face capture.
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — `transformMastermind`.
- `packages/game-engine/src/rules/mastermindHandlers.ts` — the strike resolver + dispatch.
- `packages/game-engine/src/**/*.test.ts` — the coverage above.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24483), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: the flip is pure over `G` (no RNG); the new fields are OPTIONAL +
>   allowlist-gated so a non-transform game is byte-identical → NO hash re-pin (verify
>   the pin tests pass unchanged).
> - `transformMastermind` is copy-then-override (the `defeatTopTactic` precedent) so no
>   `MastermindState` field is silently dropped on a flip.
> - `Game.setup()` may throw; moves/handlers never throw — the strike resolver safe-skips
>   (logs an honest hollow) when the second face is absent.
> - Card data is untouched (the two faces already exist in `wwhk.json`).

## Acceptance Criteria

- **AC-1** Setup of an allowlisted mastermind (`wwhk/general-thunderbolt-ross`) with two
  non-tactic faces captures the second: `alternateFaceId` = the second face, `faceGameText`
  holds both faces' lines, and `G.cardStats` has a `fightCost` for both faces.
- **AC-2** Setup of a non-allowlisted mastermind (or one with a single non-tactic face)
  leaves `alternateFaceId` / `faceGameText` **absent** (not undefined-valued).
- **AC-3** `transformMastermind` swaps `baseCardId ↔ alternateFaceId`, sets `gameText` to
  the new face, preserves every other field, is bidirectional, and is a no-op (returns the
  input) when `alternateFaceId` is absent.
- **AC-4** Firing General Ross's Master Strike flips the face (General Ross → Red Hulk),
  updates `gameText`, and emits an `applied` flip log line; a second strike flips back.
- **AC-5** When the second face was not captured, the strike logs a `blocked` honest
  hollow and does not flip.
- **AC-6** Determinism: the engine hash pins (`PRE_WP080_HASH`, the sentinel
  `finalStateHash`) pass unchanged — NO re-pin.
- **AC-7** UIState mastermind projection shows the flipped face (via `display` from the
  new `baseCardId`) with no projection change.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. **Control:** with the mastermind removed from `MASTERMIND_TRANSFORM_ALLOWLIST`, AC-1
   fails (no capture) and AC-4 becomes the AC-5 hollow — the allowlist is load-bearing.
4. `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged.
5. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-7 satisfied; all Verification Steps green.
- [ ] `docs/ai/DECISIONS.md` — **D-24483 Active**.
- [ ] `docs/ai/STATUS.md` close-out; `WORK_INDEX.md` + `EC_INDEX.md` rows; mindmap node + counts.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` match with General Ross
      flips to Red Hulk on a Master Strike — operator-pending.

## Reserved Decision (lands at execution)

**D-24483 — Mastermind Transform (first slice): capture the second boss face at setup for
a `MASTERMIND_TRANSFORM_ALLOWLIST` mastermind (two optional `MastermindState` fields), and
flip it via a pure `transformMastermind` helper fired by a per-mastermind strike resolver;
optional + allowlist-gated so no hash re-pin.** See the DECISIONS entry for the full record.

## Lint Gate Self-Review (00.3)

§1–§9 PASS (engine-only; §4 no card-data / 00.2 change). §12–§17 PASS (control run mandated;
§16 human-style; §17 Vision — §1 faithful boss behaviour, §2 engine decides, §22 determinism;
§15.1 `play.legendary-arena.com` + D-24026 gate). §10/§11/§18/§20/§21 N/A.
