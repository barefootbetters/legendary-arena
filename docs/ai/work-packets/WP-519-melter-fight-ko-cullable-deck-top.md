# WP-519 — Melter (Villain) Fight: KO Each Player's Cullable Deck-Top Card

**User-Visible Surface:** `play.legendary-arena.com` — fighting the core
**Melter** villain (Masters of Evil) now reveals each player's deck-top card
and KOs the ones a rational cooperative player would thin (Wounds and basic
S.H.I.E.L.D. starters), instead of doing nothing. **D-24026 live-verification
applies** (operator-pending: fight Melter with a Wound or basic starter on a
deck top, confirm it leaves for the KO pile and real Heroes stay).

## User-Visible Impact

Surfaced live 2026-08-10 in a 2p co-op Secret Invasion vs Dr. Doom match
(`25b12dd6`; diagnostics `doctor-doom-diagnostics-secret-invasion-p2.lagn.json`):
fighting Melter emitted a runtime hollow on both copies —
`Unhandled effect observed: card "core-villain-masters-of-evil-melter-00"
declared a "unmarked-ability" mechanic at onFight, but no executable handler
was reached (no-handler)` (also the `-01` copy at turn 29; game-log lines
`9.2.11` and `28.2.15`) — i.e. his printed **Fight** ability did nothing. This
WP makes it faithful: *"Fight: Each player reveals the top card of their deck.
For each card, you choose to KO it or put it back."* The effect is player-
**beneficial** (deck-thinning weak cards is upside; a real Hero is never KO'd),
so the gap is low-impact, but it is a genuine faithfulness gap and it litters
the game log with a `no-handler` breadcrumb.

## Goal

Implement the core Masters-of-Evil villain **Melter**
(`core/masters-of-evil/melter`, copies 2) Fight ability, currently hollow
(D-24266 `unmarked-ability`). His Fight ability reveals the top card of **every**
player's deck and lets the fighting player KO or keep each one. This is a new
keyword-less auto-resolve **villain-effect-vocabulary** primitive
(`ko-cullable-each-deck-top`), fired from the villain `onFight` site. The
"you choose to KO it or put it back" choice **collapses deterministically**
(D-24332) to a rational cooperative chooser: KO only **cullable** cards — a
Wound or a basic starting S.H.I.E.L.D. card (Agent / Trooper) — and keep every
real Hero and the S.H.I.E.L.D. Officer on top. Game engine + card data, one WP.
Locks **D-24332**.

## Assumes

- Baseline: `origin/main` @ the WP-519 reserve (`4d6a2435` or later — the
  `SPEC: reserve WP-519 / EC-554 / D-24332` commit). Working tree clean.
- **WP-252 / D-24023** — the `VillainEffectPrimitive` union +
  `VILLAIN_EFFECT_PRIMITIVES` array (`rules/villainAbility.types.ts`), the
  `VillainEffectDescriptor`, and the marker pipeline (`apply-effect-markers.mjs`
  + `inputs/villain-effect-markers.json`). A **no-param** primitive parses
  through `parseUngatedEffect`'s generic terminal branch
  (`if (parts.length === 1) return { primitive: primitiveToken }`) — **no new
  parser arm is needed**, matching `scry-ko-own-deck` / `reveal-or-wound` /
  `ko-wounds-current-hand-and-discard`.
- **WP-485 / D-24290** — the Tier-A auto-resolve fire path:
  `executeVillainAbilities(G, ctx, timing, shuffleContext, cityIndex)` reads
  `ctx.currentPlayer` and dispatches `applyVillainEffect(...)`; the handler
  mutates `G` directly and self-narrates via `pushLog`.
- **WP-447 / WP-478 / D-24267 / D-24285** — the `scry-ko-own-deck` handler
  (`villainEffectScryKoOwnDeck`): the **template** for a deck-reveal villain
  effect. It reads the trailing `shuffleContext?: ShuffleProvider`, calls
  `reshuffleDiscardIntoDeck(zones, shuffleContext)` when a player's deck runs
  short, and removes a card from the deck top via `moveCardFromZone(zones.deck,
  [], cardId)` → `G.ko = koCard(...)`. `selectScryKoTarget` (exported, same
  file) defines the "deterministically-worst" tiers this WP reuses for the
  **cullable** predicate: (1) a Wound, (2) a basic starting S.H.I.E.L.D. card
  (Agent / Trooper). **This WP uses ONLY tiers 1–2** — NOT tier 3 (the
  lex-lowest fallback), because Melter's per-card choice includes "put it back",
  so a card that is not worth thinning is **kept**, never force-KO'd.
- **WP-470 / D-24282** — the scry-ko *pending-choice upgrade*. It is the reason
  the auto-resolve collapse is safe here: scry-ko was upgraded to an interactive
  pending choice because its auto-resolve **force-KO'd one of two cards** even
  when both were real Heroes (the Jeff-reported agency bug). Melter's Fight has
  a **keep** option, so the faithful auto-resolve KOs a card only when KO'ing it
  is pure upside (a Wound / basic starter) and never touches a real Hero — the
  scry-ko failure mode cannot arise, so no pending choice / client change is
  warranted (operator-confirmed, drafting session 2026-08-10).
- **D-24266** — the markerless `unmarked-ability` breadcrumb Melter's Fight
  currently emits; marking the card removes it and flips the card
  unmarked→executable.
- **D-24034** — append-only union/array drift discipline for
  `VillainEffectPrimitive` (count 15 → 16).
- **Existing constants/helpers reused, not re-declared:** `WOUND_EXT_ID`,
  `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID` (`setup/pilesInit.ts`, already
  imported by the executor); `reshuffleDiscardIntoDeck` (`moves/drawCards.logic.ts`,
  already imported); `moveCardFromZone` (`moves/zoneOps.ts`), `koCard`
  (`board/ko.logic.ts`), `pushLog`, `villainEffectTimingLabel`,
  `resolveCardDisplayName`.
- Melter's **only** ability line is the Fight line (no Ambush / Escape). The
  other three Masters-of-Evil villains (Baron Zemo, Ultron, Whirlwind) are
  already marked/executable; only Melter's Fight is unmarked.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move Validation
  Contract, §Persistence Boundary (`G` runtime-only, hashed), §Determinism.
- `.claude/rules/*.md` + `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` (canonical field names; `ext_id`).
- `docs/ai/DECISIONS.md` — D-24290/D-24307/D-24329 (villain-effect Tier-A
  precedents), D-24267/D-24282/D-24285 (the scry-ko deck-reveal template +
  reshuffle + pending-choice-upgrade rationale), D-24023, D-24034, D-24266.
- **The template WPs** — `docs/ai/work-packets/WP-516-ymir-fight-ko-wounds.md`
  + `EC-551` (the freshest single-primitive keyword-less no-param villain-effect
  draft: one new primitive + handler + marker + drift, single layer) and
  `WP-447` / `WP-478` (the `scry-ko-own-deck` deck-reveal + reshuffle handler,
  the closest mechanical shape).
- Source: `rules/villainAbility.types.ts` (union + array + descriptor);
  `villain/villainEffects.execute.ts` (`executeVillainAbilities` +
  `applyVillainEffect` dispatch + `villainEffectScryKoOwnDeck` /
  `selectScryKoTarget` / `villainEffectKoWoundsCurrentHandAndDiscard`
  templates); `setup/villainAbility.setup.ts` (`parseUngatedEffect` no-param
  branch, line ~582); `data/cards/core.json:2160` (the Melter Fight line).

**Split-vs-single decision:** one WP, single layer (game engine + card-data
markers), the Tier-A auto-resolve shape. No client change (auto-resolve, no
pending choice, no new UIState field). Self-contained.

**Masters-of-Evil cluster check:** the prompt asked whether other Masters-of-
Evil villains form a markable cluster with Melter. In **core** they do **not** —
Baron Zemo (`rescue-bystanders-current-by-trait-count:team:avengers`, WP-485),
Ultron (Escape `reveal-or-wound:hc:tech`, WP-469), and Whirlwind
(`ko-hero:current:2@rooftops+bridge`, WP-252) are all already marked/executable.
Only Melter's **Fight** line is unmarked. So this is a single-villain, single-
ability WP. **Separate whole-set gap noted (out of scope):** all four **co2e**
(Legendary 2nd-edition) Masters-of-Evil villains are unmarked — that is a
distinct 2nd-edition-set effort, not part of this Melter fix.

**Choice-collapse semantics — "you choose to KO it or put it back" (D-24332):**
the printed text gives the fighting player a per-card KO/keep decision over every
player's revealed deck top. In the shipped solo/co-op modes all players are
allies, and a rational cooperative chooser thins **weak** cards (Wounds and
basic S.H.I.E.L.D. starters — pure deck-thinning upside, the established
`selectScryKoTarget` "worst-worthy" judgment, D-24267) while **keeping** every
real Hero (and the recruited S.H.I.E.L.D. Officer). Because the keep-option
means a real Hero is **never** auto-KO'd, the WP-470 scry-ko agency bug (which
arose only because scry-ko must KO one of two cards) cannot occur — so the
faithful auto-resolve is non-interactive: no pending choice, no player-selection
UI, no partial-KO prompt. This is the operator-selected fidelity level
(auto-resolve) for this WP.

## Scope (In)

- New `VillainEffectPrimitive` `'ko-cullable-each-deck-top'` (union +
  `VILLAIN_EFFECT_PRIMITIVES` array, lockstep, count 15 → 16, append-only per
  D-24034) — a keyword-less **no-param** auto-resolve primitive. Marker grammar
  `[effect:ko-cullable-each-deck-top]` (no colon params).
- **Handler** `villainEffectKoCullableEachDeckTop` in
  `villain/villainEffects.execute.ts` + its `VILLAIN_EFFECT_HANDLERS` record
  entry: for each player in `Object.keys(G.playerZones).sort()`, reveal their
  deck top (calling `reshuffleDiscardIntoDeck(zones, shuffleContext)` first when
  `zones.deck.length === 0`, per the Legendary reveal-reshuffle rule / scry
  precedent D-24285); if the revealed top is **cullable**
  (`isCullableDeckTopCard`), remove it from the deck top via `moveCardFromZone`
  and append to `G.ko` via `koCard`; otherwise leave it on top. `pushLog` a
  keyword-less self-narration. Auto-resolve, no pending queue.
- **Predicate** `isCullableDeckTopCard(cardId)` (local helper): true iff
  `cardId` is `WOUND_EXT_ID`, `SHIELD_AGENT_EXT_ID`, or `SHIELD_TROOPER_EXT_ID`
  — the `selectScryKoTarget` tiers-1–2 "worst-worthy" set (D-24267), **excluding
  the tier-3 lex-lowest fallback** and **excluding** `SHIELD_OFFICER_EXT_ID` (a
  recruited card a rational player keeps).
- **Marker row** for `core/masters-of-evil/melter` on the Fight line in
  `inputs/villain-effect-markers.json` (add a `"fight"` key under the
  `masters-of-evil` group) → regenerated `data/cards/core.json`.
- **Marker-script vocabulary:** append `'ko-cullable-each-deck-top'` to the
  hand-synced `VILLAIN_EFFECT_PRIMITIVES` array in `apply-effect-markers.mjs`
  (a no-param primitive validates via that script's terminal
  `return parts.length === 1` branch — no new grammar arm).
- Drift/handler/parse-test updates: `villainAbility.types.test.ts` (union/array
  parity, 15 → 16), `villainEffects.execute.test.ts` (new handler cases),
  `setup/villainAbility.setup.test.ts` (assert the marker parses to the no-param
  descriptor).
- Regenerated derived artifacts: `data/cards/core.json`, the villain mechanic
  ledger (`ledger:villains`), `effect-implementation-index.json`
  (`effect-index`), the runtime-observed hollows artifact
  (`sim:runtime-observed`, if it enumerates Melter), and a
  `{ wp: WP-519, decision: D-24332 }` provenance row in
  `scripts/coverage/mechanic-provenance.json` (net-new primitive).
- **ewiki refresh:** `wiki/card-effect-system.md` villain-vocabulary paragraph —
  add the new primitive to the `VILLAIN_EFFECT_PRIMITIVES` list and a short
  descriptive note (keyword-less descriptors are silently dropped, so the wiki
  is their only human-facing home).

## Out of Scope

- **Any player-selection UI / pending-choice.** The per-card KO/keep choice
  collapses to the deterministic cullable auto-resolve (D-24332); no interactive
  picker, no per-card prompt. (This is the deliberate difference from WP-470's
  scry-ko pending choice — justified in §Context / §Assumes.)
- **KO'ing a real Hero or a S.H.I.E.L.D. Officer** from any deck top — cullable
  is Wounds + basic starters only (a rational chooser keeps real cards).
- **KO'ing from any zone other than the deck top** (the printed text reveals the
  top card only).
- **The co2e (2nd-edition) Masters-of-Evil villains** — a separate whole-set
  gap, not this WP.
- No new UIState field, no client change; no scoring/PAR change; no new contract
  file; no change to the already-marked Baron Zemo / Ultron / Whirlwind lines.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array
  (+`ko-cullable-each-deck-top`, 15 → 16) + descriptor JSDoc note (no-param)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — new handler +
  `isCullableDeckTopCard` predicate + dispatch registration
- Tests: `rules/villainAbility.types.test.ts` (drift 15 → 16),
  `villain/villainEffects.execute.test.ts` (handler),
  `setup/villainAbility.setup.test.ts` (no-param parse assertion)

**Data / tooling:**
- `scripts/convert-cards/apply-effect-markers.mjs` — one array entry
- `scripts/convert-cards/inputs/villain-effect-markers.json` — one Melter
  `fight` row
- `data/cards/core.json` — regenerated (the Melter Fight marker)
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` +
  `scripts/coverage/mechanic-provenance.json` — regenerated / provenance row

**ewiki:** `wiki/card-effect-system.md` (villain-vocab list + new-primitive note)

**Governance:** `docs/ai/DECISIONS.md` (D-24332), `docs/ai/NUMBER-LEDGER.md`,
`docs/ai/STATUS.md` (if present), `WORK_INDEX.md`, `EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24332).** `ko-cullable-each-deck-top` is a keyword-less
  **no-param** auto-resolve villain primitive. Its handler iterates every player
  in `Object.keys(G.playerZones).sort()` (D-18902 determinism), reveals each
  player's deck top (reshuffling their discard into the deck first when the deck
  is empty), and KOs the revealed card to `G.ko` **only when it is cullable**;
  otherwise the card is kept on top. It self-narrates via `pushLog`. Fires at the
  marked timing (Melter: `onFight`). No player choice, no pending queue, no
  client change.
- **Cullable definition.** A card is cullable iff its ext_id is `WOUND_EXT_ID`,
  `SHIELD_AGENT_EXT_ID`, or `SHIELD_TROOPER_EXT_ID` — the `selectScryKoTarget`
  tiers-1–2 "worst-worthy" set (D-24267). The tier-3 lex-lowest fallback and the
  `SHIELD_OFFICER_EXT_ID` are **excluded**: a rational chooser keeps a real Hero
  and the recruited Officer.
- **Reveal / reshuffle.** "Reveals the top card" is a reveal, so an empty deck
  reshuffles the player's discard into the deck first (scry-ko precedent,
  D-24285) via `reshuffleDiscardIntoDeck(zones, shuffleContext)`; a genuinely
  exhausted deck+discard is a reachable no-op for that player (no reveal, no KO).
- **Multi-player, all players.** Every player's deck top is revealed (unlike the
  current-player-only `ko-wounds-current-hand-and-discard`); the fighting player
  is not special-cased (a cullable card is culled regardless of owner, matching
  the printed "each player").
- **Zone mechanics.** Removal is `moveCardFromZone(zones.deck, [], cardId)` (top
  card off the deck) → `G.ko = koCard(G.ko, cardId)` (append to the general KO
  pile, per the scry-ko handler). No `.reduce()`; explicit `for...of`.
- **Determinism.** Randomness only via the reshuffle
  (`reshuffleDiscardIntoDeck` → `shuffleContext.random.Shuffle`, seeded); no
  `Math.random()`. Two hashed surfaces can move: (a) the marker adds a Fight
  descriptor to Melter's setup-built, hashed `villainAbilityHooks`, so a fixture
  whose villain config **includes** the Masters-of-Evil group shifts its
  initial-`G` hash even if Melter is never fought; (b) the reveal/reshuffle/KO
  **writes** shift state only when a fixture **fights** Melter. **Unlike Ymir
  (WP-516), `masters-of-evil` IS referenced by scoring fixtures**
  (`parScoring.keys.ts`, `parScoring.logic.test.ts`, `par.storage.test.ts`) —
  those are PAR-key/scoring fixtures, not necessarily the hashed replay/sentinel
  oracles. **At execution, verify** whether any HASHED oracle
  (`finalStateHash` via `record-game-fixture.mjs`; `PRE_WP080_HASH` in
  `replay.execute.test.ts`; the sentinel replay fixture) has a villain config
  that **includes or fights** Masters-of-Evil / Melter. If none does, hashes are
  expected **unchanged**. If any does, re-record via the canonical tool
  (`record-game-fixture.mjs`), never hand-edit — and record the re-pin in the
  D-24332 entry.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics:
  making a printed villain ability faithful).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; a villain effect).
- **Determinism preservation** — deterministic and replay-faithful: randomness
  only via the seeded reshuffle; re-pin posture stated in §Contract (verify at
  execution; re-record via the canonical tool if a hashed oracle shifts).

## Acceptance Criteria

1. Fighting `core/masters-of-evil/melter` reveals every player's deck top and
   KOs (to `G.ko`) exactly the cullable ones (Wound / basic S.H.I.E.L.D.
   starter), leaving real Heroes and Officers on top, and emits a keyword-less
   self-narration in the game log — **no `no-handler` hollow breadcrumb** (the
   D-24266 breadcrumb is gone).
2. A revealed deck top that is a real Hero (or S.H.I.E.L.D. Officer) is **kept**
   on top — not KO'd (the keep-option; distinct from scry-ko's force-KO).
3. A player whose deck is empty has their discard reshuffled first, then their
   top revealed; a player with empty deck **and** empty discard is a reachable
   no-op (no reveal, no KO, no crash, no hollow).
4. `ko-cullable-each-deck-top` is in BOTH the `VillainEffectPrimitive` union AND
   `VILLAIN_EFFECT_PRIMITIVES` (count 15 → 16); the drift test passes.
5. `[effect:ko-cullable-each-deck-top]` parses to
   `{ primitive: 'ko-cullable-each-deck-top' }` via the generic no-param branch
   (parser test asserts it; no new parser arm added).
6. `core/masters-of-evil/melter` flips unmarked → **executable** in the
   regenerated villain ledger + `effect-implementation-index.json`, with
   `{ WP-519, D-24332 }` provenance; `ledger:villains:check` +
   `effect-index:check` green.
7. `pnpm -r build` 0; engine test green; hashed oracles (`finalStateHash` /
   `PRE_WP080_HASH` / sentinel) **verified** — unchanged if no committed hashed
   fixture includes/fights Masters-of-Evil, else re-recorded via the canonical
   tool with the re-pin noted in D-24332.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. new handler +
   cullable/keep + reshuffle-on-empty + drift 15 → 16 + no-param parse tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check`
   → all 0.
4. `pnpm check:wiki && pnpm check-links` (or the repo's ewiki gates) → 0 after
   the `wiki/card-effect-system.md` edit.
5. Live-verify (D-24026, operator, post-deploy): fight Melter with a Wound or
   basic starter on a deck top, confirm it moves to the KO pile and a real Hero
   on a deck top is kept; the log shows the KO count.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-554:` impl + `SPEC:` govern-close): D-24332 landed
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
  code; randomness only via the seeded `shuffleContext` reshuffle.

**Packet-specific:**
- `VillainEffectPrimitive` union and `VILLAIN_EFFECT_PRIMITIVES` array move in
  lockstep (append-only, D-24034); drift test enforces parity 15 → 16.
- Villain effect handler mutates `G` directly and self-narrates; no pending
  choice, no client change.
- Cullable = Wound / basic S.H.I.E.L.D. starter (Agent, Trooper) only; NOT the
  Officer, NOT the lex-lowest fallback, NOT a real Hero. Reveal each player's
  deck top; reshuffle-on-empty via `shuffleContext`; append KO'd cards to
  `G.ko`. No `.reduce()` in the handler.
- Only `core/masters-of-evil/melter` is marked (Fight line); the co2e MoE
  villains and the already-marked Baron Zemo / Ultron / Whirlwind are untouched.
- No new npm dependency; no `pg`/server/registry import in engine effect files.
- Net-new primitive → hand-add a `{ wp: "WP-519", decision: "D-24332" }` row to
  `scripts/coverage/mechanic-provenance.json` (else the ledger/index render
  blank WP/Decision).

**Session protocol:** if any locked value here conflicts with the code on `main`
at execution time, STOP and reconcile against ARCHITECTURE.md before proceeding —
do not guess.

**Locked contract values:** see `## Contract` and `EC-554` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; constraints
  reference `00.6`; forbid partial output).
- **§3 Assumes** — PASS (WP-252 no-param parse, WP-485 fire path, WP-447/478
  scry-ko deck-reveal + reshuffle template, WP-470 pending-choice rationale,
  D-24266, D-24034, reused constants enumerated).
- **§4 Context (Read First)** — PASS (ARCHITECTURE.md sections, DECISIONS scan,
  WP-516/WP-447/WP-478 templates, source files with line anchors — all specific).
- **§5 Files** — PASS (each marked new/modified; bounded, single layer + card
  data + ewiki + governance).
- **§6 Naming** — PASS (`ext_id`, canonical primitive/field names;
  `WOUND_EXT_ID` / `SHIELD_*_EXT_ID` reused verbatim; no renamed fields).
- **§7 Dependencies** — PASS (no new dep).
- **§8 Architecture** — PASS (engine + card data; no server/registry/pg reach in
  effect files; no boundary crossing).
- **§9 Windows / §10 Env** — N/A (no new shell scripts beyond existing pnpm/node
  regen; no new env var).
- **§11 Auth** — N/A (no auth surface).
- **§12 Test Quality** — PASS (`node:test`; drift + handler + cullable/keep +
  reshuffle-on-empty + no-param parse tests; no `boardgame.io/testing`).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (7 binary, observable, file/function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary; `**User-Visible Surface:**` + `## User-Visible Impact`;
  live-on-surface D-24026 item present).
- **§16 Code Style** — PASS (models the `scry-ko-own-deck` deck-reveal handler +
  the `ko-wounds-current-hand-and-discard` narration without over-sharing;
  explicit `for...of`; full-word names; small handler + one predicate helper;
  `// why:` on the cullable-set, keep-option, reshuffle-on-empty, and
  sorted-iteration decisions; named imports only).
- **§17 Vision Alignment** — PASS (present; §1/§2/§10; no conflict; NG clear;
  determinism line — seeded reshuffle only).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI, no user-visible donate/support
  copy — a gameplay-mechanic WP.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` library
  function touched.
- Reserves **D-24332** (the villain `ko-cullable-each-deck-top` contract).
