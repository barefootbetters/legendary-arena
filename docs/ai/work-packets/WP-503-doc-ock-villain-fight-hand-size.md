# WP-503 — Doctor Octopus (Villain) Fight: Draw 8 Instead of 6 Next Hand

**User-Visible Surface:** `play.legendary-arena.com` — fighting the core
spider-foes **Doctor Octopus** villain now makes your *next* hand draw **eight
cards instead of six**, instead of doing nothing. **D-24026 live-verification
applies** (operator-pending: fight Doc Ock, end the turn, confirm the next hand
is 8).

## User-Visible Impact

Reported from a live Magneto match (2026-08-05, match `zdcAitTRmIY`, log line
`17.2.17`): fighting Doctor Octopus emitted a runtime hollow —
`Unhandled effect observed: card "core-villain-spider-foes-doctor-octopus-01"
declared a "unmarked-ability" mechanic at onFight, but no executable handler was
reached (no-handler)` — i.e. his printed **Fight** ability did nothing. This WP
makes it faithful: *"Fight: When you draw a new hand of cards at the end of this
turn, draw eight cards instead of six."*

## Goal

Implement the core spider-foes villain **Doctor Octopus**
(`core/spider-foes/doctor-octopus`, copies 2), currently hollow (D-24266
`unmarked-ability`). His Fight ability sets the fighting player's **next**
hand-fill target to **8** (instead of `HAND_SIZE` = 6). This is a new
auto-resolve **villain-effect-vocabulary** primitive (`override-next-hand-size`)
that **writes the same shared `G.handSizeOverrides` field WP-497 introduces**,
fired from the villain `onFight` site. It reuses WP-497's field **and** its
play-phase `onBegin` consumption verbatim — this WP adds only the villain-side
**writer** and the Doc Ock marker. Game engine + card data, one WP. Locks
**D-24307**.

## Assumes

- Baseline: `origin/main` @ the WP-503 reserve (`639fd3af` or later; the WP-497
  reserve is on `main`). Working tree clean.
- **WP-497 / D-24300 (mastermind-tactic onFight framework) — HARD DEPENDENCY,
  currently DRAFTED not executed. THIS WP IS BLOCKED until WP-497 lands.** WP-497
  introduces the shared hashed field `G.handSizeOverrides?: Record<string,
  number>` (per-player next-`onBegin`-fill override; lazy-init, never seeded in
  `buildInitialGameState`) **and** the play-phase `onBegin` consumption in
  `game.ts` (fill target = `handSizeOverrides[player] ?? HAND_SIZE`, then clear
  the entry). This WP consumes both; it MUST NOT re-declare the field or add a
  second consumption point. If WP-497's field/consumption names differ at
  execution time, this WP conforms to WP-497 (the owner), never the reverse.
- **WP-252 / D-24023** — the `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES`
  array (`rules/villainAbility.types.ts`), the `VillainEffectDescriptor`
  (`primitive` + optional params incl. `magnitude`), the marker pipeline
  (`apply-effect-markers.mjs` + `inputs/villain-effect-markers.json`).
- **WP-485 / D-24290** — the Tier-A auto-resolve fire path:
  `executeVillainAbilities(G, ctx, timing)` reads `ctx.currentPlayer` and
  dispatches `applyVillainEffect(G, currentPlayer, cardId, timing, descriptor,
  …)`; the handler mutates `G` directly and self-narrates via `pushLog`.
- **D-24266** — the markerless `unmarked-ability` breadcrumb Doc Ock currently
  emits; marking the card removes it and flips the card unmarked→executable.
- **D-24034** — append-only union/array drift discipline for
  `VillainEffectPrimitive` (count 13 → 14).

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move Validation
  Contract, §Persistence Boundary (`G` runtime-only, hashed).
- `.claude/rules/*.md` + `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` (canonical field names;
  `ext_id`).
- `docs/ai/DECISIONS.md` — D-24300 (WP-497, the field + consumption this reuses),
  D-24290/D-24295/D-24299 (villain-effect Tier precedents), D-24023, D-24034,
  D-24266.
- **The template WP** — `docs/ai/work-packets/WP-494-villain-effect-vocab-tier-d-viper.md`
  + `EC-529` (the freshest villain-effect-vocab draft: one new primitive +
  handler + marker + drift, single layer).
- **The WP-497 design** — `docs/ai/work-packets/WP-497-mastermind-tactic-onfight-framework.md`
  §Contract (the `handSizeOverrides` field shape + `onBegin` consumption). This WP
  is the villain-side sibling of WP-497's mastermind-side writer.
- Source: `rules/villainAbility.types.ts` (union + array + descriptor);
  `villain/villainEffects.execute.ts` (`executeVillainAbilities` +
  `applyVillainEffect` dispatch); `data/cards/core.json:2304` (the Doc Ock card).

**Split-vs-single decision:** one WP, single layer (game engine + card-data
markers), the Tier A/B shape. No client change (auto-resolve, no pending choice,
no new UIState field). The `onBegin` consumption is WP-497's, not duplicated
here.

**Why not fold into WP-497:** WP-497 is scoped to the **mastermind-tactic**
dispatcher (co2e Doc Ock "Octet of Valence Electrons"); the core spider-foes Doc
Ock is a **villain** card fired through a different subsystem (the villain-effect
vocabulary). Same effect + shared field, distinct execution path — a separate
WP that hard-deps WP-497 keeps the two subsystems' ownership clean.

## Scope (In)

- New `VillainEffectPrimitive` `'override-next-hand-size'` (union +
  `VILLAIN_EFFECT_PRIMITIVES` array, lockstep, count 13 → 14, append-only per
  D-24034) — a keyword-less auto-resolve primitive. Marker grammar
  `[effect:override-next-hand-size:<N>]` where `<N>` is the target hand size
  (Doc Ock: `8`).
- **Handler** in `villain/villainEffects.execute.ts` — add a new
  `VILLAIN_EFFECT_HANDLERS` record entry keyed by the primitive (which
  `applyVillainEffect` looks up); at the timing it fires, set
  `G.handSizeOverrides[currentPlayer] = descriptor.magnitude` (lazy-init the
  field if absent — but see §Contract: WP-497 owns the lazy-init idiom, mirror
  it exactly), and `pushLog` a keyword-less self-narration (e.g. `Fight effect:
  your next hand draws N cards instead of {HAND_SIZE}.`).
- **Marker row** for `core/spider-foes/doctor-octopus` on ability index 0 (the
  Fight line) in `inputs/villain-effect-markers.json` → regenerated
  `data/cards/core.json`.
- Drift-test updates: `villainAbility.types.test.ts` (union/array parity,
  13 → 14), `villainEffects.execute.test.ts` (new handler cases),
  `diagnostics/hollowEffect.test.ts` if it enumerates Doc Ock.
- Regenerated derived artifacts: `data/cards/core.json`, the villain mechanic
  ledger (`ledger:villains`), `effect-implementation-index.json`
  (`effect-index`), and a `{ wp: WP-503, decision: D-24307 }` provenance row in
  `scripts/coverage/mechanic-provenance.json` (net-new primitive).

## Out of Scope

- **The `handSizeOverrides` G field and the `onBegin` consumption** — owned by
  WP-497. This WP writes the field and MUST NOT declare it or add a second
  consumption/clear site.
- **The co2e / any other-set Doctor Octopus villain twin** — only the core
  spider-foes card is marked here; twins ride a follow-up marker-only WP (the
  WP-494 co2e-twin-deferred precedent).
- **The Magneto-cap interaction** — Magneto's `MAGNETO_HAND_SIZE_LIMIT` (=4)
  discard-to-4 is a Master-Strike-time reaction, **orthogonal to** (not merged
  with) this override's `onBegin` fill; there is no ordering/precedence to
  resolve and no change to WP-497's `onBegin` logic (see §Contract). This WP only
  writes `handSizeOverrides`.
- No new UIState field, no pending choice, no client change; no scoring/PAR
  change; no new contract file.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array
  (+`override-next-hand-size`); `magnitude` param already exists on the
  descriptor
- `packages/game-engine/src/villain/villainEffects.execute.ts` — new handler +
  dispatch registration
- `packages/game-engine/src/setup/villainAbility.setup.ts` — marker → descriptor
  parse (only if the generic `magnitude`-bearing arm is insufficient)
- Tests: `villainAbility.types.test.ts`, `villainEffects.execute.test.ts`,
  `diagnostics/hollowEffect.test.ts` (if it names Doc Ock)

**Data:**
- `scripts/convert-cards/inputs/villain-effect-markers.json` — one marker row
- `data/cards/core.json` — regenerated (the Doc Ock Fight marker)
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` +
  `scripts/coverage/mechanic-provenance.json` — regenerated / provenance row

**Governance:** `docs/ai/DECISIONS.md` (D-24307), `docs/ai/STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24307).** `override-next-hand-size` is a keyword-less
  auto-resolve villain primitive. Its handler sets the fighting player's entry in
  the shared `G.handSizeOverrides` (WP-497) to the descriptor `magnitude` (the
  absolute target hand size, `8` for Doc Ock). It fires at whatever timing the
  marked line carries (Doc Ock: `onFight`). No player choice, no pending queue.
- **Reuse, not re-build.** WP-497 owns `G.handSizeOverrides` (declaration +
  lazy-init idiom) and the play-phase `onBegin` consumption (`fill target =
  handSizeOverrides[player] ?? HAND_SIZE`, then clear). This WP adds ONLY the
  villain-side writer + the marker. It declares no new `G` field and no new
  consumption point. **Sequencing:** WP-497 must land first (hard dep); at
  execution, conform to WP-497's actual field/const names.
- **Magneto composition — ORTHOGONAL lifecycles, not a precedence (verify at
  execution).** Unlike the co2e *mastermind* Doc Ock (one mastermind per match),
  the *villain* Doc Ock can appear in ANY mastermind's game — including Magneto,
  where it did surface. The two effects are **orthogonal in lifecycle, with no
  shared merge point**: Doc Ock's override governs only the play-phase `onBegin`
  fill-to-8 (consumed + cleared there); Magneto's `MAGNETO_HAND_SIZE_LIMIT` (=4)
  is a **Master-Strike-time** discard-to-4 reaction (`resolveMagnetoStrike` parks
  a pending discard), a temporally distinct event. WP-497 ships a
  **Magneto-unaware** `onBegin` (`target = handSizeOverrides[player] ??
  HAND_SIZE`) — there is no precedence rule to "match." The WP-503 execution adds
  a test asserting the **independence** (a set override fills the next `onBegin`
  to 8 and clears; a Master Strike independently trims the current hand to 4;
  neither modifies the other) and does NOT touch WP-497's `onBegin` logic.
- **Determinism.** No `ctx.random` (Doc Ock reveals/shuffles nothing). Two
  hashed surfaces move: (a) the marker changes Doc Ock's hook `effects` in the
  **setup-built, hashed `villainAbilityHooks`**, so a fixture whose villain
  config **includes** the spider-foes group shifts its initial-`G` hash **even if
  Doc Ock is never fought**; (b) the `handSizeOverrides` **write** shifts state
  only when a fixture **fights** him. So the sentinel `finalStateHash` /
  `PRE_WP080_HASH` re-pin **if any committed fixture includes OR fights the
  spider-foes Doc Ock**. **None currently do** — `sentinel-core-doom-2p` uses
  `villainGroupIds: ['core/brotherhood']` and `PRE_WP080_HASH` uses a synthetic
  test group, neither with spider-foes. Verify at execution; if it shifts,
  re-record via the canonical tool, never hand-edit.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics: making
  a printed villain ability faithful).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; a villain effect).
- **Determinism preservation** — deterministic and replay-faithful: no
  `ctx.random`; writes the WP-497 hashed field; re-pin posture stated in
  §Contract.

## Acceptance Criteria

1. Fighting `core/spider-foes/doctor-octopus` sets
   `G.handSizeOverrides[currentPlayer]` to `8` and emits a keyword-less
   self-narration in the game log — **no `no-handler` hollow breadcrumb** (the
   D-24266 breadcrumb is gone).
2. At the fighting player's next play-phase `onBegin`, their hand fills to **8**
   (via WP-497's consumption), then the override entry clears; subsequent turns
   fill to `HAND_SIZE` (6).
3. `override-next-hand-size` is in BOTH the `VillainEffectPrimitive` union AND
   `VILLAIN_EFFECT_PRIMITIVES` (count 13 → 14); the drift test passes.
4. `core/spider-foes/doctor-octopus` flips unmarked → **executable** in the
   regenerated villain ledger + `effect-implementation-index.json`, with
   `{ WP-503, D-24307 }` provenance; `ledger:villains:check` +
   `effect-index:check` green.
5. A Magneto-composition test asserts the two effects are **independent**: a set
   override fills the next `onBegin` to 8 and clears; a Magneto Master Strike
   independently makes the player discard down to 4 (the strike *parks a pending
   discard choice* — resolve it, then assert the hand is 4) — neither modifies
   the other (no shared merge point, no precedence).
6. No new `G` field declared and no second `onBegin` consumption/clear site added
   (grep-verify: exactly one `handSizeOverrides` declaration and one
   consumption, both in WP-497's files).
7. `pnpm -r build` 0; engine test green; sentinel/replay hashes unchanged unless
   a committed fixture **includes or fights** the spider-foes Doc Ock (re-record
   via the canonical tool if so).

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. new handler +
   drift + Magneto-composition tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm roadmap:counts:check`
   → all 0.
4. `pnpm sim:runtime-observed:check` → 0 (marking Doc Ock changes the sweep).
5. Live-verify (D-24026, operator, post-deploy): fight Doc Ock, end the turn,
   confirm the next hand is 8 cards (and, in a Magneto game, that the composed
   behavior matches).

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-538:` impl + `SPEC:` govern-close): D-24307 landed
  Active; STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap
  `📝`→`✅` + `pnpm roadmap:counts:write`.
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
- **BLOCKED on WP-497** — do not execute until WP-497's `handSizeOverrides` field
  + `onBegin` consumption are on `main`. Conform to WP-497's actual names.
- Declare NO new `G` field; add NO second consumption/clear site (WP-497 owns
  both).
- `VillainEffectPrimitive` union and `VILLAIN_EFFECT_PRIMITIVES` array move in
  lockstep (append-only, D-24034); drift test enforces parity.
- Villain effect handlers mutate `G` directly and self-narrate; no pending
  choice, no client change.
- Only `core/spider-foes/doctor-octopus` is marked; twins deferred.
- No new npm dependency; no `pg`/server/registry import in engine effect files.

**Session protocol:** if any locked value here conflicts with the code on `main`
at execution time (especially WP-497's field/const names), STOP and reconcile
against WP-497 + ARCHITECTURE.md before proceeding — do not guess.

**Locked contract values:** see `## Contract` and `EC-538` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; constraints
  reference `00.6`; forbid partial output; BLOCKED-on-WP-497 stated).
- **§3 Assumes** — PASS (WP-497 hard dep + field/consumption reuse, WP-252,
  WP-485, D-24266, D-24034 enumerated).
- **§4 Context (Read First)** — PASS (ARCHITECTURE.md sections, DECISIONS scan,
  WP-494 template, WP-497 design, source files — all specific).
- **§5 Files** — PASS (each marked new/modified; bounded, single layer).
- **§6 Naming** — PASS (`ext_id`, canonical primitive/field names; no renamed
  fields).
- **§7 Dependencies** — PASS (no new dep).
- **§8 Architecture** — PASS (engine + card data; no server/registry/pg reach in
  effect files; reuses WP-497's field, no boundary crossing).
- **§9 Windows / §10 Env** — N/A (no shell scripts beyond existing pnpm/node
  regen; no new env var).
- **§11 Auth** — N/A (no auth surface).
- **§12 Test Quality** — PASS (`node:test`; drift + handler + Magneto-composition
  tests; no `boardgame.io/testing`).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (7 binary, observable, file/function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary; `**User-Visible Surface:**` + `## User-Visible Impact`;
  live-on-surface D-24026 item present).
- **§16 Code Style** — PASS (no premature abstraction; explicit control flow;
  full-word names; small handler; `// why:` on the field-write + lazy-init +
  Magneto-composition; named imports only).
- **§17 Vision Alignment** — PASS (present; §1/§2/§10; no conflict; NG clear;
  determinism line).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI, no user-visible donate/support
  copy — a gameplay-mechanic WP.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` library
  function touched.
- Reserves **D-24307** (the villain override-next-hand-size contract).
