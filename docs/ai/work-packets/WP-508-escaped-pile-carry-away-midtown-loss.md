# WP-508 — Escaped-Pile Bystander Carry-Away + Midtown Bank Robbery Resource Loss (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (mutates the
determinism surface — changes escape-time zone routing and adds a scheme-loss
writer; lightweight-lane ineligible per 01.0a eligibility #6/#8) ·
**Baseline:** `origin/main` @ `1dfc78a9` · **User-Visible Surface:**
play.legendary-arena.com

## Goal

Midtown Bank Robbery's printed **Evil Wins** condition — *"When 8 Bystanders
are carried away by escaping Villains"* — is not modeled. The engine loses the
game on a **doom-clock proxy** instead: `buildGenericTwistEffects`
(`rules/schemeHandlers.ts`) sets `SCHEME_LOSS` the moment the scheme's twist
count reaches its printed stack size (8), and Midtown carries `lossThreshold: 8`
purely as that proxy (D-24178). Worse, on a villain escape the engine
**returns the villain's captured Bystanders to the shared supply**
(`resolveEscapedBystanders`, `board/bystanders.logic.ts`) — the exact opposite
of "carried away" — so the real condition is not merely unfired but
**untracked**. This WP makes escaping villains **carry their captured
Bystanders into the Escaped Villains pile** (`G.escapedPile`), adds a
data-driven **`resourceLossCondition`** to `SchemeTwistConfig` that counts
escaped-pile entries of a given card type against a threshold, wires Midtown to
it (8 Bystanders), and **suppresses the twist-count proxy** for any scheme that
declares a real resource condition. After it lands, a Midtown match ends for
evil only when 8 Bystanders have actually been carried off the city — not when
the eighth twist is drawn.

## User-Visible Impact

On `play.legendary-arena.com`, a Midtown Bank Robbery match no longer ends the
instant the eighth Scheme Twist is revealed. Twists still fire (Bank villain
captures 2 Bystanders, chain a villain-deck card) and the twist count still
displays, but Evil now wins only when the Escaped Villains pile holds **8
Bystanders** carried off by escaping villains. The escaped-pile projection now
shows carried-away Bystanders alongside escaped villains, matching the tabletop.
Directly fixes the operator-reported 2026-08-07 core-Magneto/Midtown co-op
match, which ended as `scheme-wins` at twist 8 with an **empty** escaped pile
(zero villains escaped) and a dominant hero board.

## Assumes

- **WP-200 / D-24178** (scheme-twist resolver framework + `lossThreshold`
  doom-clock proxy, ✅) — the config-driven dispatcher
  `schemeTwistHandler` in `rules/schemeHandlers.ts`, the
  `SCHEME_TWIST_CONFIGS` map in `rules/schemeTwistConfigs.ts`, and the
  `SchemeTwistConfig` interface in `rules/schemeTwistConfig.types.ts`. This WP
  extends that interface and gates the proxy on the new field. D-24178
  explicitly records the six resource-loss schemes as unmodeled ("doom-clock
  proxy … until their real loss conditions are modeled") — this WP begins that
  work for the escaped-pile-count subclass.
- **WP-153** (destination piles: strike/twist/escaped, ✅) — `G.escapedPile`
  exists as the append-only Escaped Villains pile and is projected to
  `UIState.city.escapedPile`. This WP appends Bystander ext_ids to it in
  addition to escaped villain ext_ids.
- **WP-015 / villain reveal pipeline** — the escape branch of
  `performVillainReveal` (`villainDeck/villainDeck.reveal.ts`): on a full city,
  space-4's card becomes `pushResult.escapedCard`; the branch increments
  `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`, appends to `G.escapedPile`, gains a
  Wound for the current player, then calls `resolveEscapedBystanders`. This WP
  replaces the bystander-return step and adds a resource-loss check after it.
- **Card-type classification** — `G.villainDeckCardTypes[extId]` maps every
  villain-deck card to a `RevealedCardType` (`'villain' | 'henchman' |
  'bystander' | 'scheme-twist' | 'mastermind-strike'`), built at setup, read
  O(1) in moves (no registry read at runtime). Midtown's Bystanders are typed
  `'bystander'` there. The resource-loss evaluator classifies escaped-pile
  entries through this map.
- **`ENDGAME_CONDITIONS.SCHEME_LOSS`** (`endgame/endgame.types.ts`) — the
  existing scheme-loss counter; `evaluateEndgame` returns `scheme-wins` when it
  is `>= 1`. This WP adds a **second writer** of that counter (the resource-loss
  check); the twist-proxy remains the writer for twist-loss schemes.
- **`board/bystanders.logic.ts`** — `attachBystanderToVillain` (used by the
  Midtown twist to capture), and the current `resolveEscapedBystanders` (returns
  attached bystanders to `G.piles.bystanders`). Not a contract file
  (`.types`/`.validate`/`.gating`) — editable.

## Context (Read First)

**"Carried away" = into the Escaped Villains pile, not back to supply.** The
Universal Rules v23 escape rule: when an escaping villain has captured
Bystanders, those Bystanders "go … into the Escaped Villains pile." The engine
today recycles them to `G.piles.bystanders` (comment: "to prevent memory leaks
and supply depletion"). That recycling is what makes Midtown's condition
uncountable. The fix routes them to `G.escapedPile` so they are both faithful
and countable. The `attachedBystanders` mapping entry for the escaped villain is
still cleared (no leak); only the destination changes (escaped pile, not supply).

**Escaped pile now holds mixed card types.** After this WP, `G.escapedPile`
contains escaped villain ext_ids **and** carried-away Bystander ext_ids. Any
consumer that assumed villains-only must tolerate Bystander entries. The
`UIState.city.escapedPile` projection already renders arbitrary ext_ids via
`cardDisplayData`, so Bystanders display correctly (they resolve to the
Bystander card face). The separate `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`
counter is **unchanged** — it still increments once per escaped *villain* card,
never per Bystander (Bystanders are carried, not "escaped villains").

**Doom-clock proxy is suppressed only for resource schemes.** The twist-count
still increments every twist (the display + the `schemeTwistCount` counter are
untouched). What changes: `buildGenericTwistEffects` no longer pushes a
`SCHEME_LOSS` increment when the active scheme declares a `resourceLossCondition`.
Twist-loss schemes (Portals, Cosmic Cube) have **no** `resourceLossCondition`,
so their twist-threshold loss is preserved exactly.

**The generic `escapedVillains >= ESCAPE_LIMIT (8)` loss is NOT touched.** That
every-match villain-escape proxy in `evaluateEndgame` stays as-is. It remains a
second, coarser loss path for Midtown (8 escaped *villains* would still end the
game), but it is rarely reachable and is a distinct MVP proxy. Making
`ESCAPE_LIMIT` scheme-aware (so Negative Zone loses at 12 villains and
bystander-loss schemes stop losing on villain-escape count) is the **next WP**
in this epic (see Out of Scope). Keeping it out here holds WP-508 off the
`evaluateEndgame` escaped-villains branch — which fires every match and touches
every committed fixture — and confines this WP's determinism blast radius to the
escape-with-captured-Bystanders path only.

**Determinism (the re-pin question).** Two hashed fields change **on escape of
a villain that has captured Bystanders**: `G.escapedPile` gains the Bystander
ext_ids (instead of `G.piles.bystanders` regaining them), and `SCHEME_LOSS` may
flip to 1. Both `hashGameState` (`finalStateHash`) and `computeStateHash`
(`PRE_WP080_HASH`) serialize the whole `G` minus the diagnostics exclusion set,
so any committed replay/sentinel fixture whose playthrough **escapes a villain
that has attached Bystanders** re-pins. The operative condition is "escapes with
attached bystanders," NOT "runs Midtown": Bystanders also attach to villains via
the scheme-independent `captureBystander` villain-card effect
(`villainEffects.execute.ts`), so the committed sentinel
(`sentinel-core-doom-2p.replay.json`, scheme `core/legacy-virus-the`) could in
principle escape a capture-carrying villain. No committed fixture is *expected*
to, but the guard is the empirical dual-hash check + STOP-on-drift below, not
this reasoning. **No new `G` field is added** — `resourceLossCondition` lives on the config (outside `G`),
`escapedPile`/`SCHEME_LOSS`/`villainDeckCardTypes` all pre-exist. Verify both
oracles at execution; **STOP on any drift, never blind-re-pin**
(`reference_hashed_g_field_dual_repin`).

## Design Rationale

**One data-driven condition type, not a Midtown-specific hook.** The four
escaped-pile-count schemes (Midtown 8 bystanders, Negative Zone 12 villains,
Secret Invasion 6 heroes, Killbots 5 "killbots") are the **same mechanic** —
count entries of a card type in the escaped pile against a threshold. Modelling
it as a declarative `resourceLossCondition` on `SchemeTwistConfig` lets the
later WPs in this epic wire their schemes as **data rows**, not new code. This
WP builds the type + evaluator and wires only Midtown; a third copy is not
speculative abstraction — it is the documented shape of three follow-on schemes
(D-24178 audit).

**Set `SCHEME_LOSS`, keep `evaluateEndgame` counter-only.** The endgame
evaluator's invariant is "reads only `G.counters`" (`legendary-game-engine`
skill; endIf contract). Rather than widen it to read `escapedPile` + the active
config, the resource-loss check runs in the escape path (the only place
`escapedPile` grows) and writes the existing `SCHEME_LOSS` counter — exactly how
the twist-proxy already signals scheme loss. `evaluateEndgame` is unchanged.

**Replace the bystander-return helper in place.** `resolveEscapedBystanders`
has exactly one production **call site** (the escape branch in
`villainDeck.reveal.ts`), so replacing its body leaves no dead code. Rather than
add a parallel helper, this WP replaces the body to route to the escaped pile and
renames it `carryEscapedBystandersToPile` for honesty at the call site. Note the
symbol (and its result type) is **also re-exported from the package barrel**
`index.ts` (PS-1) — those two re-export lines are updated in the same change so
the build stays green; no consumer outside `game-engine` imports either symbol.
Its unit test is updated in lockstep.

**Known stale comment, deliberately out of scope.** A `// why:` comment in
`packages/game-engine/src/villain/villainEffects.execute.test.ts` (~lines
1798–1803) mentions `resolveEscapedBystanders` and the old "released to supply"
semantics. It is **comment-only** (no import — the "no importer outside
`game-engine`" claim holds), so the rename does not break the build; but the
comment will name a dead symbol and describe inverted behaviour. That file is
**not** in this WP's eleven-file allowlist and MUST NOT be edited here (touching
it is an allowlist FAIL). It is tracked for a separate one-line cleanup rather
than expanding this WP's scope to a twelfth file — which would force a third gate
cycle for a comment.

## Scope (In)

- `packages/game-engine/src/rules/schemeTwistConfig.types.ts` — **locked
  contract file** (`.types.ts`); the additive optional field below is
  authorized under the `code-style.md` contract-change exception (additive,
  backward-compatible, reuses the canonical `RevealedCardType`) via this
  session's architecture review (pre-flight + copilot) + the DECISIONS entry
  D-24315. This is a later WP extending a shipped framework, not a B-packet of
  the A-packet that created the file, so the "B must not modify A's contract"
  prohibition does not apply.
  - New exported type `SchemeResourceLossCondition` =
    `{ kind: 'escaped-pile-count'; cardType: RevealedCardType; threshold: number }`.
    Import `RevealedCardType` from its canonical source
    `packages/game-engine/src/villainDeck/villainDeck.types.ts` (do **not**
    import it through the `../types.js` or `index.ts` barrel).
  - New optional field `resourceLossCondition?: SchemeResourceLossCondition` on
    `SchemeTwistConfig`, with a JSDoc noting it declares the scheme's real
    Evil-Wins condition and, when present, suppresses the twist-count proxy.
- `packages/game-engine/src/rules/schemeResourceLoss.ts` — **new** pure module:
  - `countEscapedPileByType(G, cardType): number` — counts `G.escapedPile`
    entries whose `G.villainDeckCardTypes[extId]` equals `cardType` (a plain
    `for...of`, no `.reduce()`).
  - `applyEscapedPileResourceLoss(G): void` — reads the active scheme's config
    from `SCHEME_TWIST_CONFIGS.get(G.selection.schemeId)`; if it carries an
    `escaped-pile-count` condition and the count `>= threshold`, sets
    `G.counters[SCHEME_LOSS] = 1` (idempotent) and pushes one `pushLog` line.
    No-op when the scheme has no `resourceLossCondition`. Never throws.
- `packages/game-engine/src/board/bystanders.logic.ts`:
  - Replace `resolveEscapedBystanders` (returns bystanders to supply) with
    `carryEscapedBystandersToPile(escapedCardId, attachedBystanders, escapedPile)`
    — moves the villain's attached bystanders to the **end of `escapedPile`**,
    deletes the mapping entry, returns `{ attachedBystanders, escapedPile }`.
    `G.piles.bystanders` is no longer touched on escape. Rename the result type
    `ResolveEscapedBystandersResult` → `CarryEscapedBystandersResult`.
- `packages/game-engine/src/index.ts`:
  - Update the two barrel re-exports that name the renamed symbols — the value
    `resolveEscapedBystanders` (line 168) → `carryEscapedBystandersToPile`, and
    the type `ResolveEscapedBystandersResult` (line 173) →
    `CarryEscapedBystandersResult`. **Required** — the package barrel re-exports
    both, so without this `pnpm -r build` fails on missing exports (PS-1). No
    importer outside `game-engine` references either symbol, so the blast radius
    is the barrel only.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`:
  - Escape branch: call `carryEscapedBystandersToPile` (writing back
    `G.attachedBystanders` and `G.escapedPile`) instead of
    `resolveEscapedBystanders`. The whole supply-return cluster is rewritten in
    lockstep, not just the log line (RS-3 / RS-A): remove the
    `G.piles.bystanders = escapeBystanderResult.bystandersPile` write and the
    `bystanderPileBefore` capture; replace the guard
    `if (escapeBystanderResult.bystandersPile.length > bystanderPileBefore)`
    with one on escaped-pile growth; update the "returned to supply" log to
    "carried into the Escaped Villains pile"; and fix the now-stale
    "releases bystanders back to supply" comment above the call. Leave **no**
    reference to the removed `bystandersPile` field.
  - Call `applyEscapedPileResourceLoss(G)` at the **end of the escape branch**
    — after all escape consequences settle (`executeVillainAbilities`
    `'onEscape'`, `koAttachedHeroesOnEscape`, and the Mystique
    escape→scheme-twist path), not immediately after the carry-away — so the
    count reflects the full escape before evaluation (C-3). It is a no-op for
    schemes without a `resourceLossCondition`.
- `packages/game-engine/src/rules/schemeHandlers.ts`:
  - **Gate the twist-proxy in the dispatcher, where `config` is in scope.**
    `schemeTwistHandler` (which holds `config`) passes a derived
    `suppressTwistLoss: boolean` (= `config?.resourceLossCondition != null`)
    into `buildGenericTwistEffects`; the helper skips the twist-threshold
    `SCHEME_LOSS` push when `suppressTwistLoss` is true. Do **not** re-fetch the
    config inside `buildGenericTwistEffects` (C-2). The twist count still
    increments; only the "twist threshold reached" loss effect + message are
    suppressed, and only for schemes declaring a `resourceLossCondition`.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts`:
  - Add `resourceLossCondition: { kind: 'escaped-pile-count', cardType:
    'bystander', threshold: 8 }` to the `core/midtown-bank-robbery` entry;
    update its comment (the `lossThreshold: 8` line stays — it remains the twist
    fallback for any code path that still reads it, but is now inert for Midtown
    loss because the proxy is suppressed).
- Tests:
  - `packages/game-engine/src/rules/schemeResourceLoss.test.ts` — **new**:
    count-by-type over a mixed escaped pile; loss fires at exactly the threshold
    and not below; no-op for a scheme without a `resourceLossCondition`;
    idempotent when already lost; **plus an `evaluateEndgame` composition
    assertion (import it here — in-allowlist): `scheme-wins` at 8 escaped
    Bystanders, `null` at 7** (AC-6 — do not add a separate endgame test file).
  - `packages/game-engine/src/board/bystanders.logic.test.ts` — carry-away now
    lands bystanders in the escaped pile (not supply); supply unchanged; mapping
    entry cleared; empty-mapping no-op.
  - `packages/game-engine/src/rules/schemeHandlers.test.ts` — a Midtown twist no
    longer sets `SCHEME_LOSS` at the twist threshold; a twist-loss scheme
    (Cosmic Cube) still does.
  - `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — an escape
    with captured bystanders appends them to `escapedPile` and, at the Midtown
    threshold, sets `SCHEME_LOSS`.

## Out of Scope

- **Negative Zone Prison Breakout** (12 villains escape) and making the generic
  `ESCAPE_LIMIT` scheme-aware — the **next WP** in this epic. It shares the
  `resourceLossCondition` framework (villains-in-escaped-pile count) but must
  also change `evaluateEndgame`'s every-match `escapedVillains` branch, a wider
  determinism surface deliberately deferred.
- **Stack-depletion schemes** — Legacy Virus (wound stack empties), Super Hero
  Civil War (hero deck empties, incl. the final-turn-tie override). Separate WP;
  a different mechanic (pile emptiness, not escaped-pile count).
- **Conversion schemes** — Secret Invasion (6 Heroes → Skrull villains in the
  escaped pile) and Replace Earth's Leaders with Killbots (5 Bystanders → Killbot
  villains escaped). Both are currently unconfigured with **no resolver at all**
  and need card-conversion mechanics on top of this framework. Separate WP.
- The "each player discards a card when a villain escapes with Bystanders"
  tabletop penalty — a distinct escape-fidelity item, not required to model the
  loss condition; the existing current-player Wound-on-escape is left as-is.
- Any change to `evaluateEndgame`, `ESCAPE_LIMIT`, the `ESCAPED_VILLAINS`
  counter, or the `schemeTwistCount` counter/display.
- Card-data changes; new `G` field; UIState type changes (the escaped-pile
  projection already carries arbitrary ext_ids).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeTwistConfig.types.ts` | `+ SchemeResourceLossCondition` type; `+ resourceLossCondition?` field on `SchemeTwistConfig` |
| `packages/game-engine/src/rules/schemeResourceLoss.ts` | **new** — `countEscapedPileByType` + `applyEscapedPileResourceLoss` (pure) |
| `packages/game-engine/src/board/bystanders.logic.ts` | replace `resolveEscapedBystanders` → `carryEscapedBystandersToPile` (route to escaped pile, not supply); rename result type `ResolveEscapedBystandersResult` → `CarryEscapedBystandersResult` |
| `packages/game-engine/src/index.ts` | update the barrel re-exports (line 168 value, line 173 type) to the renamed `carryEscapedBystandersToPile` / `CarryEscapedBystandersResult` — else `pnpm -r build` fails on missing exports (PS-1) |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` | escape branch: call carry-away helper (rewrite the `bystandersPile`-referencing supply-return log guard in lockstep); call `applyEscapedPileResourceLoss` at the **end** of the escape branch |
| `packages/game-engine/src/rules/schemeHandlers.ts` | suppress the twist-proxy `SCHEME_LOSS` effect when the scheme has a `resourceLossCondition` |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | add `resourceLossCondition` to `core/midtown-bank-robbery` |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | **new** — count + loss-threshold + no-op + idempotent |
| `packages/game-engine/src/board/bystanders.logic.test.ts` | carry-away destination assertions |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | proxy-suppressed-for-resource vs proxy-kept-for-twist-loss |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` | escape carries bystanders + sets `SCHEME_LOSS` at threshold |

Governance (not counted in the code allowlist): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24314 + D-24315 flip Active at
execution), `NUMBER-LEDGER.md` (reserved), `STATUS.md`.

## Non-Negotiable Constraints

- Moves never throw; both new helpers return normally on every input
  (empty escaped pile, missing config, empty mapping, empty supply).
- **Carry-away destination is `G.escapedPile`, never `G.piles.bystanders`.** The
  escape path must not return captured bystanders to the shared supply. The
  `attachedBystanders` mapping entry for the escaped villain is still deleted
  (no leak).
- **`ESCAPED_VILLAINS` counter unchanged** — it increments once per escaped
  villain card, never per carried Bystander.
- **Twist-count untouched** — `schemeTwistCount` still increments every twist;
  only the twist-threshold `SCHEME_LOSS` push is suppressed, and only when the
  active scheme declares a `resourceLossCondition`.
- **`evaluateEndgame` is not modified** — the resource-loss path signals via the
  existing `SCHEME_LOSS` counter; the evaluator stays counter-only.
- Card-type classification reads `G.villainDeckCardTypes[extId]` — the same
  setup-built map moves already use; never import `@legendary-arena/registry`
  into the engine, never re-derive types at runtime.
- `resourceLossCondition` is **data-only** (a plain object literal, no
  functions) so `SchemeTwistConfig` stays JSON-serializable and the config map
  is inspectable.
- No `ctx.random.*` (nothing shuffled/revealed by the loss check), no I/O, no
  wall-clock.
- No boardgame.io import in `schemeResourceLoss.ts`, `bystanders.logic.ts`, or
  `schemeTwistConfig.types.ts` (pure helpers); no `.reduce()` in the count loop.
- No new `LegendaryGameState` field.

**Engine-wide (standing) constraints.** The executing session must also honor
the repo-wide rules that apply to every engine change: `.claude/rules/code-style.md`
and `docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable code;
full English names; every function JSDoc'd; `// why:` on non-obvious constants
and any escaped-pile routing choice); ESM-only with `node:`-prefixed built-ins,
`.test.ts` tests on `node:test`, Node v22+. The executor works from **full file
contents**, never diffs or elided snippets, and outputs complete files.

## Contract

**`SchemeResourceLossCondition`** (new, data-only) — `{ kind:
'escaped-pile-count'; cardType: RevealedCardType; threshold: number }`. The only
`kind` in this WP is `'escaped-pile-count'` (a string-literal union open to
future kinds in later WPs).

**`SchemeTwistConfig.resourceLossCondition?`** — optional; when present the
scheme's Evil-Wins is governed by the condition and the twist-count proxy is
suppressed for that scheme.

**`countEscapedPileByType(G: LegendaryGameState, cardType: RevealedCardType):
number`** — pure; counts escaped-pile entries whose `villainDeckCardTypes` entry
equals `cardType`.

**`applyEscapedPileResourceLoss(G: LegendaryGameState): void`** — pure handler;
if the active scheme declares an `escaped-pile-count` condition and the count is
`>= threshold`, sets `G.counters[SCHEME_LOSS] = 1` and logs once; else no-op.
Never throws.

**`carryEscapedBystandersToPile(escapedCardId, attachedBystanders, escapedPile)`**
— pure; returns `{ attachedBystanders, escapedPile }` with the escaped villain's
bystanders appended to `escapedPile` and its mapping entry removed.

**Locked constants (verbatim — do not re-derive):** the scheme-loss counter key
is `ENDGAME_CONDITIONS.SCHEME_LOSS === 'schemeLoss'` — import the constant, never
the literal; the resource-loss check sets it to `1` (idempotent; `evaluateEndgame`
checks `>= 1`). `RevealedCardType` values are hyphenated (`'bystander'`,
`'villain'`), never underscored. Midtown condition: `cardType: 'bystander'`,
`threshold: 8`, scheme `core/midtown-bank-robbery`.

**Behavioral contract:** on a Midtown match, `SCHEME_LOSS` is set (→
`evaluateEndgame` returns `scheme-wins`) exactly when the escaped pile holds ≥ 8
Bystander ext_ids; the eighth twist alone no longer ends the game.

## Vision Alignment

§3 (faithful Legendary rules) — implements a printed Evil-Wins condition
currently replaced by a proxy that ended a winning game. NG-1..7 not crossed;
no monetization / PvP / identity surface. **Determinism preserved (§8 / §22):**
no `ctx.random.*`, no wall-clock, no I/O; the only state changes are captured
Bystanders routed between existing hashed zones (escaped pile vs supply) and the
existing `SCHEME_LOSS` counter, which replays identically given the same setup +
moves. Firing only on an escape-with-captured-Bystanders (no committed fixture
does so), it leaves every committed replay/sentinel oracle byte-identical — no
persistence-boundary or re-pin impact expected.

## Funding Surface Gate

N/A — no pricing, checkout, or account surface.

## API Catalog Update

N/A — no `apps/server` HTTP endpoint or `Library-only` export changes.

## Acceptance Criteria

1. On a villain escape with captured Bystanders, those Bystander ext_ids are
   appended to `G.escapedPile`; `G.piles.bystanders` is unchanged; the escaped
   villain's `attachedBystanders` entry is removed.
2. `countEscapedPileByType(G, 'bystander')` returns the number of Bystander
   ext_ids in `G.escapedPile` (classified via `G.villainDeckCardTypes`),
   ignoring villain/henchman entries.
3. For a Midtown match, `applyEscapedPileResourceLoss` sets
   `G.counters[SCHEME_LOSS] = 1` when the escaped pile holds ≥ 8 Bystanders, and
   leaves it unset at 7.
4. For a scheme with no `resourceLossCondition`, `applyEscapedPileResourceLoss`
   is a no-op (no `SCHEME_LOSS` write).
5. A Midtown twist reaching the twist threshold (8) no longer pushes a
   `SCHEME_LOSS` effect (the proxy is suppressed); a Cosmic Cube twist at its
   threshold still does (twist-loss scheme unaffected).
6. `evaluateEndgame` returns `scheme-wins` for a Midtown state with 8 escaped
   Bystanders, and `null` (continue) for the same state with 7 and no other
   ending condition. (Asserted **in-allowlist** as a composition check inside
   `schemeResourceLoss.test.ts` — set `SCHEME_LOSS` via the resource-loss helper,
   then assert the unchanged `evaluateEndgame` maps `SCHEME_LOSS >= 1 →
   scheme-wins`. Do **not** add a separate endgame test file.)
7. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** (no committed fixture escapes a villain
   with captured Bystanders) — any drift STOPs execution.
8. `ESCAPED_VILLAINS` counter behavior and the `schemeTwistCount` display are
   unchanged.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the pass
   delta.
3. Control check: temporarily stub `applyEscapedPileResourceLoss` to a no-op →
   the threshold/`SCHEME_LOSS` assertions FAIL (non-vacuous); restore. Also
   revert `carryEscapedBystandersToPile` to return-to-supply → the destination
   assertions FAIL; restore.
4. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep + full
   run); `pnpm sim:runtime-observed:check` current with no regeneration.
5. `pnpm -r build` → 0.
6. `git diff --name-only` = the eleven-file allowlist + governance only.
7. **D-24026 live-verify (operator-pending, post-deploy):** on
   `play.legendary-arena.com`, play a Midtown Bank Robbery match past the eighth
   twist with an empty/low escaped pile → the game continues; force villain
   escapes carrying Bystanders until 8 are in the escaped pile → the match ends
   `scheme-wins`.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite green (pass delta recorded).
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or drift diagnosed + a
      deliberate, documented re-pin — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24314 + D-24315 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX →
      `Done`; mindmap `📝`→`✅`; `roadmap:counts:check` 0; `docs/ai/STATUS.md`
      close-out entry added.
- [ ] Two-commit topology (EC-543 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24314** — Escaping villains carry their captured Bystanders into the Escaped
Villains pile (`G.escapedPile`), replacing the return-to-supply behavior of
`resolveEscapedBystanders`. `G.escapedPile` is the canonical zone for every card
carried off the city (escaped villains + their Bystanders); the
`ESCAPED_VILLAINS` counter still counts escaped villain cards only. Faithful to
Universal Rules v23 escape handling; enables escaped-pile resource-loss counting.

**D-24315** — Scheme resource-loss conditions are declared data-only on
`SchemeTwistConfig.resourceLossCondition`. The first `kind`,
`'escaped-pile-count'` (`cardType` + `threshold`), sets `SCHEME_LOSS` when
`G.escapedPile` holds ≥ `threshold` entries of `cardType` (classified via
`G.villainDeckCardTypes`), checked in the escape path. When a scheme declares a
`resourceLossCondition`, the twist-count doom-clock proxy (D-24178) is
suppressed for that scheme. Wired for Midtown Bank Robbery (8 Bystanders);
twist-loss schemes (Portals, Cosmic Cube) declare none and keep the twist-loss.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections present, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine rules cited).
- **§3 Assumes** — PASS (every prerequisite cites its locking source; WP-200/D-24178 + WP-153 are the framework deps, both ✅).
- **§4 Context** — PASS (`## Context (Read First)` covers carry-away destination, mixed escaped pile, proxy suppression, the untouched generic escape limit, and the re-pin question).
- **§5 Files Expected to Change** — PASS (closed eleven-file allowlist + governance; `index.ts` barrel added per pre-flight PS-1).
- **§6 Naming Consistency** — PASS (canonical `escapedPile`, `villainDeckCardTypes`, `SCHEME_LOSS`, `RevealedCardType`, `SchemeTwistConfig`).
- **§7 Dependency Discipline** — PASS (all deps landed on `main`).
- **§8 Architectural Boundaries** — PASS (game-engine only; no `boardgame.io`/registry import in pure helpers; no `.reduce()`; `evaluateEndgame` counter-only invariant preserved).
- **§9 Windows Compatibility** — N/A (no shell/path-specific work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub steps for both helpers).
- **§13 Commands & Verification** — PASS (`## Verification Steps` runnable).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + two-commit topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the routing choice, no clever control flow).
- **§17 Vision Alignment** — PASS (§3 faithful rules; NG-1..7 not crossed; determinism §8/§22 line present).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused in prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `1dfc78a9` cited; current at draft).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; stated in the WP).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only` export change; stated in the WP).

Pre-flight verdict: **READY TO EXECUTE** (2026-08-07, independent re-run). The
first pass returned NOT READY on one blocker — the barrel re-export of
`resolveEscapedBystanders` / `ResolveEscapedBystandersResult` from
`packages/game-engine/src/index.ts` (PS-1); the allowlist now includes `index.ts`
(eleven files) with both renames, and the re-run confirmed READY with no importer
outside `game-engine`. Advisories RS-1 (determinism keyed on "escapes with
attached bystanders," not "runs Midtown"), RS-2 (`RevealedCardType` canonical
source named), RS-3/RS-A (the full supply-return cluster rewritten in lockstep)
folded in.

Copilot verdict: **PASS** (2026-08-07, independent re-run). The first pass was
RISK on four items — contract-lock acknowledgment for `schemeTwistConfig.types.ts`,
the twist-proxy suppression seam locked to the dispatcher, the resource-loss check
placed at the end of the escape branch, and Locked-Values provenance — all folded
in and confirmed accurate against source. Two NITs folded scope-neutrally: AC-6
assigned an in-allowlist composition home in `schemeResourceLoss.test.ts`; the
stale `villainEffects.execute.test.ts` comment acknowledged as knowingly
out-of-scope (tracked separately). Allowlist unchanged at eleven files.
