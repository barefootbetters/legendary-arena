# WP-516 — Ymir, Frost Giant King (Villain) Fight: KO Your Wounds from Hand + Discard

**User-Visible Surface:** `play.legendary-arena.com` — fighting the core
**Ymir, Frost Giant King** villain (Enemies of Asgard) now lets the fighting
player **KO all their Wounds from hand and discard pile**, instead of doing
nothing. **D-24026 live-verification applies** (operator-pending: fight Ymir with
Wounds in hand/discard, confirm they leave for the KO pile).

## User-Visible Impact

Reported in passing during the WP-514 Secret Invasion live-verify (2026-08-09, a
2p Secret Invasion + Magneto co-op match): fighting Ymir emitted a runtime hollow
on both copies —
`Unhandled effect observed: card "core-villain-enemies-of-asgard-ymir-frost-giant-king-00"
declared a "unmarked-ability" mechanic at onFight, but no executable handler was
reached (no-handler)` — i.e. his printed **Fight** ability did nothing. This WP
makes it faithful: *"Fight: Choose a player. That player KOs any number of Wounds
from their hand and discard pile."* The effect is player-**beneficial** (KO'ing
Wounds is pure upside), so the gap is low-impact, but it is a genuine
faithfulness gap and it litters the game log with a `no-handler` breadcrumb.

## Goal

Implement the core Enemies-of-Asgard villain **Ymir, Frost Giant King**
(`core/enemies-of-asgard/ymir-frost-giant-king`, copies 2) Fight ability,
currently hollow (D-24266 `unmarked-ability`). His Fight ability KOs every Wound
in the fighting player's **hand + discard pile**. This is a new keyword-less
auto-resolve **villain-effect-vocabulary** primitive
(`ko-wounds-current-hand-and-discard`), fired from the villain `onFight` site,
following the WP-485 / WP-503 Tier-A auto-resolve shape (mutate `G` directly,
self-narrate via `pushLog`, no pending choice, no client change). Game engine +
card data, one WP. Locks **D-24329**.

## Assumes

- Baseline: `origin/main` @ the WP-516 reserve (`826ed935` or later). Working
  tree clean.
- **WP-252 / D-24023** — the `VillainEffectPrimitive` union +
  `VILLAIN_EFFECT_PRIMITIVES` array (`rules/villainAbility.types.ts`), the
  `VillainEffectDescriptor`, and the marker pipeline (`apply-effect-markers.mjs`
  + `inputs/villain-effect-markers.json`). A **no-param** primitive parses
  through `parseUngatedEffect`'s generic terminal branch
  (`if (parts.length === 1) return { primitive: primitiveToken }`) — **no new
  parser arm is needed**, matching `scry-ko-own-deck` / `gain-attached-hero` /
  `become-scheme-twist`.
- **WP-485 / D-24290** — the Tier-A auto-resolve fire path:
  `executeVillainAbilities(G, ctx, timing)` reads `ctx.currentPlayer` and
  dispatches `applyVillainEffect(G, currentPlayer, cardId, timing, descriptor,
  …)`; the handler mutates `G` directly and self-narrates via `pushLog`. Template
  handler: `villainEffectKoHeroesCurrentByTrait` (Destroyer, same group) — scans
  the current player's zones, KOs matches, self-narrates, `{ targets }`.
- **D-24266** — the markerless `unmarked-ability` breadcrumb Ymir's Fight
  currently emits; marking the card removes it and flips the card
  unmarked→executable.
- **D-24034** — append-only union/array drift discipline for
  `VillainEffectPrimitive` (count 14 → 15).
- **Existing constants reused, not re-declared:** `WOUND_EXT_ID` (`'pile-wound'`,
  `setup/pilesInit.ts`, already imported by the executor), `koCard`
  (`board/ko.logic.ts`), `pushLog`, `villainEffectTimingLabel`.
- Ymir's **Ambush** line is already marked (`reveal-or-wound:hc:ranged`) and
  works; this WP touches only the **Fight** line.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move Validation
  Contract, §Persistence Boundary (`G` runtime-only, hashed).
- `.claude/rules/*.md` + `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` (canonical field names; `ext_id`).
- `docs/ai/DECISIONS.md` — D-24290/D-24299/D-24307 (villain-effect Tier
  precedents), D-24023, D-24034, D-24266.
- **The template WP** — `docs/ai/work-packets/WP-503-doc-ock-villain-fight-hand-size.md`
  + `EC-538` (the freshest single-primitive villain-effect-vocab draft: one new
  keyword-less auto-resolve primitive + handler + marker + drift, single layer),
  and its sibling `WP-485` (Tier-A: `ko-heroes-current-by-trait`, the same-group
  Destroyer — the closest handler shape).
- Source: `rules/villainAbility.types.ts` (union + array + descriptor);
  `villain/villainEffects.execute.ts` (`executeVillainAbilities` +
  `applyVillainEffect` dispatch + `villainEffectKoHeroesCurrentByTrait`
  template); `setup/villainAbility.setup.ts` (`parseUngatedEffect` no-param
  branch); `data/cards/core.json:2074` (the Ymir Fight line).

**Split-vs-single decision:** one WP, single layer (game engine + card-data
markers), the Tier-A shape. No client change (auto-resolve, no pending choice, no
new UIState field). Self-contained — no shared-field dependency (unlike WP-503,
which reused WP-497's `handSizeOverrides`).

**Enemies-of-Asgard cluster check:** the prompt asked whether Destroyer /
Enchantress / Frost Giant form a markable cluster with Ymir. They do **not** —
all three are **already marked** in `inputs/villain-effect-markers.json`
(`destroyer.fight = ko-heroes-current-by-trait:team:shield` +
`escape = koHeroEachPlayerMag2`; `enchantress.fight = draw-cards-current:3`;
`frost-giant.fight/escape = reveal-or-wound:hc:ranged`). Only Ymir's **Fight**
line is unmarked. So this is a single-villain, single-ability WP, not a cluster.

**Target semantics — "Choose a player" (D-24329):** the printed text is *"Choose
a player. That player KOs any number of Wounds…"*. In solo / co-op (the shipped
modes) the chooser is the fighting player, and a rational chooser both chooses
**themselves** (KO'ing your own Wounds is pure upside — you would never hand the
benefit to no one) and KOs **all** their Wounds ("any number" → the maximum). So
the faithful auto-resolve is: the **current player** KOs **every** Wound from
their hand + discard, non-interactively. No pending-choice, no player-selection
UI — consistent with the framework's other current-player primitives
(`draw-cards-current`, `ko-heroes-current-by-trait`).

## Scope (In)

- New `VillainEffectPrimitive` `'ko-wounds-current-hand-and-discard'` (union +
  `VILLAIN_EFFECT_PRIMITIVES` array, lockstep, count 14 → 15, append-only per
  D-24034) — a keyword-less **no-param** auto-resolve primitive. Marker grammar
  `[effect:ko-wounds-current-hand-and-discard]` (no colon params).
- **Handler** `villainEffectKoWoundsCurrentHandAndDiscard` in
  `villain/villainEffects.execute.ts` + its `VILLAIN_EFFECT_HANDLERS` record
  entry: KO every `WOUND_EXT_ID` (`'pile-wound'`) card from the current player's
  `hand` and `discard`, appending each to `G.ko` via `koCard`; `pushLog` a
  keyword-less self-narration. Auto-resolve, no pending queue.
- **Marker row** for `core/enemies-of-asgard/ymir-frost-giant-king` on the Fight
  line in `inputs/villain-effect-markers.json` (add a `"fight"` key beside the
  existing `"ambush"`) → regenerated `data/cards/core.json`.
- **Marker-script vocabulary:** append `'ko-wounds-current-hand-and-discard'` to
  the hand-synced `VILLAIN_EFFECT_PRIMITIVES` array in
  `apply-effect-markers.mjs` (a no-param primitive validates via that script's
  terminal `return parts.length === 1` branch — no new grammar arm).
- Drift/handler/parse-test updates: `villainAbility.types.test.ts` (union/array
  parity, 14 → 15), `villainEffects.execute.test.ts` (new handler cases),
  `setup/villainAbility.setup.test.ts` (assert the marker parses to the no-param
  descriptor).
- Regenerated derived artifacts: `data/cards/core.json`, the villain mechanic
  ledger (`ledger:villains`), `effect-implementation-index.json`
  (`effect-index`), the runtime-observed hollows artifact
  (`sim:runtime-observed`, if it enumerates Ymir), and a
  `{ wp: WP-516, decision: D-24329 }` provenance row in
  `scripts/coverage/mechanic-provenance.json` (net-new primitive).
- **ewiki refresh:** `wiki/card-effect-system.md` villain-vocabulary paragraph —
  add the new primitive to the `VILLAIN_EFFECT_PRIMITIVES` list and a short
  descriptive note (per `reference_villain_effect_vocabulary_extension`:
  keyword-less descriptors are silently dropped, so the wiki is their only
  human-facing home). The listed count is already stale (says "nine entries"
  while the array holds 14); this WP brings it current to the full set.

## Out of Scope

- **Any player-selection UI / pending-choice.** "Choose a player" collapses to
  the current player (D-24329); no interactive target picker, no partial-KO
  choice ("any number" → all).
- **KO'ing Wounds from any zone other than hand + discard** (the printed text
  names exactly those two; Wounds do not sit in `inPlay` in normal play).
- **KO'ing Wounds from any OTHER player** (single-player-target, current player).
- No new UIState field, no client change; no scoring/PAR change; no new contract
  file; no change to Ymir's already-working Ambush line.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array
  (+`ko-wounds-current-hand-and-discard`, 14 → 15)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — new handler +
  dispatch registration
- Tests: `rules/villainAbility.types.test.ts` (drift 14 → 15),
  `villain/villainEffects.execute.test.ts` (handler),
  `setup/villainAbility.setup.test.ts` (no-param parse assertion)

**Data / tooling:**
- `scripts/convert-cards/apply-effect-markers.mjs` — one array entry
- `scripts/convert-cards/inputs/villain-effect-markers.json` — one Ymir `fight`
  row
- `data/cards/core.json` — regenerated (the Ymir Fight marker)
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` +
  `scripts/coverage/mechanic-provenance.json` — regenerated / provenance row

**ewiki:** `wiki/card-effect-system.md` (villain-vocab list + new-primitive note)

**Governance:** `docs/ai/DECISIONS.md` (D-24329), `docs/ai/NUMBER-LEDGER.md`,
`docs/ai/STATUS.md` (if present), `WORK_INDEX.md`, `EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24329).** `ko-wounds-current-hand-and-discard` is a
  keyword-less **no-param** auto-resolve villain primitive. Its handler KOs every
  `WOUND_EXT_ID` card in the current (fighting) player's `hand` and `discard`,
  appending each to `G.ko`, and self-narrates via `pushLog`. It fires at whatever
  timing the marked line carries (Ymir: `onFight`). No player choice, no pending
  queue, no client change.
- **Target semantics.** "Choose a player" → the current player (solo/co-op);
  "any number of Wounds" → all of them (rational-chooser KO-all). Both are locked
  in D-24329; there is no interactive selection.
- **Zones.** Hand + discard only (the printed text). Wounds never sit in `inPlay`
  in normal play; the handler does not scan it (distinct from
  `ko-heroes-current-by-trait`, which scans hand + in-play because a Hero played
  this turn sits in-play — Wounds are never played).
- **Wound identity.** A Wound is the shared synthetic ext_id `WOUND_EXT_ID`
  (`'pile-wound'`); the handler matches by `cardId === WOUND_EXT_ID` (no registry
  read, no trait predicate). KO'd Wounds go to `G.ko` (the general KO pile), not
  back to the `G.piles.wounds` supply — a KO removes them from play.
- **Determinism.** No `ctx.random` (Ymir's Fight reveals/shuffles nothing). One
  hashed surface can move: the marker adds a Fight descriptor to Ymir's
  setup-built, hashed `villainAbilityHooks`, so a fixture whose villain config
  **includes** the Enemies-of-Asgard group would shift its initial-`G` hash even
  if Ymir is never fought; and the KO **write** shifts state only when a fixture
  **fights** Ymir. **No committed fixture references Enemies-of-Asgard or Ymir**
  (grep-verified at draft: `sentinel-core-doom-2p` uses
  `villainGroupIds: ['core/brotherhood']`; `PRE_WP080_HASH` uses a synthetic test
  group). So `finalStateHash` / `PRE_WP080_HASH` are expected **unchanged**.
  Verify at execution; if either shifts, re-record via the canonical tool
  (`record-game-fixture.mjs`), never hand-edit.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics: making
  a printed villain ability faithful).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; a villain effect).
- **Determinism preservation** — deterministic and replay-faithful: no
  `ctx.random`; re-pin posture stated in §Contract (expected: no re-pin).

## Acceptance Criteria

1. Fighting `core/enemies-of-asgard/ymir-frost-giant-king` KOs every
   `WOUND_EXT_ID` card from the current player's hand + discard (appended to
   `G.ko`; hand + discard contain no Wound afterward) and emits a keyword-less
   self-narration in the game log — **no `no-handler` hollow breadcrumb** (the
   D-24266 breadcrumb is gone).
2. A fighting player with **zero** Wounds in hand + discard triggers a reachable
   no-op (log colour `blocked`, no crash, no hollow) — not an error.
3. Non-current players' Wounds are **untouched** (single-target, current player).
4. `ko-wounds-current-hand-and-discard` is in BOTH the `VillainEffectPrimitive`
   union AND `VILLAIN_EFFECT_PRIMITIVES` (count 14 → 15); the drift test passes.
5. `[effect:ko-wounds-current-hand-and-discard]` parses to
   `{ primitive: 'ko-wounds-current-hand-and-discard' }` via the generic no-param
   branch (parser test asserts it; no new parser arm added).
6. `core/enemies-of-asgard/ymir-frost-giant-king` flips unmarked →
   **executable** in the regenerated villain ledger + `effect-implementation-index.json`,
   with `{ WP-516, D-24329 }` provenance; `ledger:villains:check` +
   `effect-index:check` green.
7. `pnpm -r build` 0; engine test green; sentinel/replay hashes **unchanged**
   (no committed fixture includes or fights Ymir — verify; re-record via the
   canonical tool if one does).

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. new handler +
   drift 14 → 15 + no-param parse tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check`
   → all 0.
4. `pnpm check:wiki && pnpm check-links` (or the repo's ewiki gates) → 0 after
   the `wiki/card-effect-system.md` edit.
5. Live-verify (D-24026, operator, post-deploy): fight Ymir with Wounds in
   hand/discard, confirm they move to the KO pile and the log shows the KO count.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-551:` impl + `SPEC:` govern-close): D-24329 landed
  Active; STATUS updated (if present); `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done;
  mindmap `📝`→`✅` + `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the allowlist (+ regenerated data/artifacts).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only; Node v22+; `node:`-prefixed built-ins.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names,
  functions ≤ 30 lines with JSDoc, `if/else` over nested ternaries, `for...of`
  over branching `.reduce()`, `// why:` on non-obvious decisions.
- Determinism: no `Math.random()` / `Date.now()` / wall-clock / I/O in engine
  code; randomness only via `ctx.random.*` (none needed here).

**Packet-specific:**
- `VillainEffectPrimitive` union and `VILLAIN_EFFECT_PRIMITIVES` array move in
  lockstep (append-only, D-24034); drift test enforces parity 14 → 15.
- Villain effect handler mutates `G` directly and self-narrates; no pending
  choice, no client change.
- KO Wounds from **hand + discard only**; match by `WOUND_EXT_ID`; append to
  `G.ko`. No `.reduce()` in the handler.
- Only `core/enemies-of-asgard/ymir-frost-giant-king` is marked (Fight line);
  the Destroyer / Enchantress / Frost Giant are already marked — do not touch
  them.
- No new npm dependency; no `pg`/server/registry import in engine effect files.
- Net-new primitive → hand-add a `{ wp: "WP-516", decision: "D-24329" }` row to
  `scripts/coverage/mechanic-provenance.json` (else the ledger/index render blank
  WP/Decision).

**Session protocol:** if any locked value here conflicts with the code on `main`
at execution time, STOP and reconcile against ARCHITECTURE.md before proceeding —
do not guess.

**Locked contract values:** see `## Contract` and `EC-551` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; constraints
  reference `00.6`; forbid partial output).
- **§3 Assumes** — PASS (WP-252 no-param parse, WP-485 fire path + template
  handler, D-24266, D-24034, reused constants enumerated).
- **§4 Context (Read First)** — PASS (ARCHITECTURE.md sections, DECISIONS scan,
  WP-503/WP-485 templates, source files with line anchors — all specific).
- **§5 Files** — PASS (each marked new/modified; bounded, single layer + card
  data + ewiki + governance).
- **§6 Naming** — PASS (`ext_id`, canonical primitive/field names; `WOUND_EXT_ID`
  reused verbatim; no renamed fields).
- **§7 Dependencies** — PASS (no new dep).
- **§8 Architecture** — PASS (engine + card data; no server/registry/pg reach in
  effect files; no boundary crossing).
- **§9 Windows / §10 Env** — N/A (no new shell scripts beyond existing pnpm/node
  regen; no new env var).
- **§11 Auth** — N/A (no auth surface).
- **§12 Test Quality** — PASS (`node:test`; drift + handler + no-op + non-current
  + parse tests; no `boardgame.io/testing`).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (7 binary, observable, file/function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary; `**User-Visible Surface:**` + `## User-Visible Impact`;
  live-on-surface D-24026 item present).
- **§16 Code Style** — PASS (no premature abstraction — models the Destroyer
  handler without over-sharing; explicit `for...of`; full-word names; small
  handler; `// why:` on the Wound-match + hand+discard-only + KO-all-target-choice
  decisions; named imports only).
- **§17 Vision Alignment** — PASS (present; §1/§2/§10; no conflict; NG clear;
  determinism line).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI, no user-visible donate/support
  copy — a gameplay-mechanic WP.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` library
  function touched.
- Reserves **D-24329** (the villain `ko-wounds-current-hand-and-discard`
  contract).
