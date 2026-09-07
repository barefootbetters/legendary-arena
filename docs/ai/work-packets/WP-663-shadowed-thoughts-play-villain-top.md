# WP-663 — Shadowed Thoughts: Optional "Play the Top Villain-Deck Card → +2 Attack" (Game Engine + Arena Client)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine + Arena Client (a pending-choice mechanic)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`core/emma-frost/shadowed-thoughts` prints *"Covert: You may play the top card of
the Villain Deck. If you do, you get +2 Attack."* Its leading `[hc:covert]:` gate
is faithful and already works, but the ability's body is unimplemented: when the
gate passes the engine grants +2 Attack **unconditionally and immediately** and
never offers the *"play the top card of the Villain Deck"* choice. This WP lands
the printed mechanic — an **optional** choice to play the top Villain-Deck card
(which enters the city / resolves as a normal reveal, per the operator ruling),
granting +2 Attack **only if** the player accepts.

## User-Visible Impact

A player who plays Shadowed Thoughts (with the Covert synergy met) is now offered
a choice: *"Play the top card of the Villain Deck for +2 Attack?"* Accepting
reveals the top Villain-Deck card into the city (with all its normal
consequences — a Villain/Henchman enters, or a Master Strike / Scheme Twist
resolves) and grants +2 Attack; declining does neither. The card stops handing
out a free, unconditional +2 Attack.

## Assumes

- **Baseline:** `origin/main` @ `6095b871` (2026-09-07). Re-baseline at execution.
- **The `[hc:covert]:` gate is FAITHFUL and stays.** The upstream source
  (`scripts/convert-cards/inputs/cards/coreset.js` ~L294) encodes `{ hc: 1 }` + `:`
  — a genuine leading class-synergy gate ("if you played another Covert Hero this
  turn"). The parser already emits a `heroClassMatch` condition for it, and it
  works (live-observed firing at 8.2.8 in `magneto-Midtown-Bank-Robbery` 1p). This
  WP does **not** touch the gate.
- **The optional-choice pending pattern exists** — `heroEffectOptionalKoReward`
  (`hero/heroEffects.execute.ts:1615`) parks `G.pendingOptionalKoRewards`,
  `optionalKoReward.resolve.ts` exports the block-all guard `hasPendingOptionalKoReward`
  + the resolve move, and the arena-client renders `OptionalKoRewardPrompt.vue`. This
  WP mirrors that end-to-end (a new pending type + park + resolve + projection +
  client prompt). ✅ on `main`.
- **The "play the top Villain-Deck card" behaviour exists** — `playTopVillainDeckCards`
  (`villainDeck/villainDeck.reveal.ts:670`) plays the top Villain-Deck card as a
  normal reveal (city entry, Master Strike, Scheme Twist), reused by the scheme
  resolvers. This WP reuses it for the accept path — no re-implementation of the
  villain-reveal cascade. ✅ on `main`.
- **`core/emma-frost/shadowed-thoughts` is the sole in-scope card.** A cross-set
  scan of the hero cards finds this "[hc:covert]: You may play the top card of the
  Villain Deck. If you do, +N[icon:attack]" form ONLY on `core/emma-frost/shadowed-thoughts`
  (the msp1 / nmut / wwhk matches are scheme twists or other forms). Confirm at
  execution (the WP-656 co2e/nmut lesson).
- **No such keyword / pending type / client prompt exists yet** — this WP adds all.

## Context (Read First)

- `scripts/convert-cards/inputs/cards/coreset.js` (~L294) — **AUTHORITATIVE for** the
  printed Shadowed Thoughts text (the faithful covert gate + the optional-play body).
- `packages/game-engine/src/hero/heroEffects.execute.ts` (`heroEffectOptionalKoReward`
  @ `:1615`; `HERO_EFFECT_HANDLERS`; `HANDLED_KEYWORDS`; `NO_MAGNITUDE_KEYWORDS`) —
  **AUTHORITATIVE for** the park-a-pending-choice model + the handler-bearing keyword
  lockstep sites (see the `reference_hero_keyword_lockstep_sites` catalogue: union +
  `HERO_KEYWORDS` + both length pins + `HANDLED_KEYWORDS` + handler-count pin + the
  setup parser — and `NO_MAGNITUDE_KEYWORDS` only for NO-magnitude keywords, which this
  one is NOT). Note `optional-ko-reward` — the magnitude-carrying model — is absent from
  `NO_MAGNITUDE_KEYWORDS`; `optional-play-villain-top` follows it.
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **AUTHORITATIVE for**
  the resolve-move + block-all-guard shape the new resolve move mirrors.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` (`playTopVillainDeckCards`
  @ `:670`) — **AUTHORITATIVE for** the villain-deck-play reuse (accept path).
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.filter.ts` — **AUTHORITATIVE
  for** the UIState projection + audience-filter pass-through (the Board-Visible Field
  Rule — a pending choice needs a `UIState` projection AND the audience-filter
  pass-through, or the human freezes: see the `project_pending_choice_no_ux_freeze`
  memory + `.claude/rules/architecture.md §UIState Projection Integrity`).
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` (+ its `.test.ts`) —
  **AUTHORITATIVE for** the client prompt component + wiring pattern.
- `docs/ai/DECISIONS.md` — the reserved **D-24474** below; scan **D-24019**
  (optional-ko-reward, the model) + **D-24291** (defeat-with-bystander, a fight-path
  reuse precedent).

## Design Rationale

**Mirror `optional-ko-reward` (D-24019) end-to-end, reuse `playTopVillainDeckCards`.**
Shadowed Thoughts is the same *shape* as optional-ko-reward — "you MAY do a
consequential action; if you do, a reward" — so it takes the same machinery: a park
handler, a `G.pending…` list, a block-all guard, a resolve move, a UIState
projection, and a bespoke client prompt. The only genuinely-new engine logic is the
accept branch: play the top Villain-Deck card (delegating to the existing
`playTopVillainDeckCards`, so the full reveal cascade — city entry, Master Strike,
Scheme Twist — fires faithfully) and then grant +2 Attack. The covert gate is
untouched (it already gates the whole hook, so the pending choice is parked only
when the synergy is met).

**The "may" is a REAL choice — no auto-default (contrast WP-659).** Unlike Psychic
Link's pure-upside reveal (auto-taken), playing the top Villain-Deck card has a real
downside (a tough Villain enters the city, or a Master Strike / Scheme Twist fires),
so the player genuinely chooses. A human is prompted (the client component). For a
deterministic engine default where no human input is available (bot ally, autoplay,
`getLegalMoves`), the default is **DECLINE** (D-24474) — the conservative, safe,
deterministic choice that never forces a risky board change. Following the established
pending-choice `getLegalMoves` pattern (`simulation/ai.legalMoves.ts` — return-on-discard,
optional-put-bottom-HQ, optional-ko-reward each short-circuit to a SINGLE deterministic
entry while a choice is pending), `getLegalMoves` returns **only** the DECLINE default,
not both moves; both `{ accept: true }` and `{ accept: false }` remain valid at the
`resolvePlayVillainTopChoice` move for a human.

## Scope (In)

- **New `optional-play-villain-top` HeroKeyword** — added across the handler-bearing
  lockstep: union + `HERO_KEYWORDS` + both length pins + `HERO_EFFECT_HANDLERS` +
  handler-count pin + `HANDLED_KEYWORDS` + the setup parser marker arm (per the
  `reference_hero_keyword_lockstep_sites` catalogue). It **carries magnitude 2** (the
  attack reward), so — exactly like its model `optional-ko-reward` — it relies on the
  `executeSingleEffect` magnitude pre-gate and MUST NOT join `NO_MAGNITUDE_KEYWORDS`
  (that set is for no-magnitude keywords only; adding a magnitude-carrying keyword would
  strip its reward-magnitude validation).
- **New `PendingPlayVillainTopChoice` pending type + `G.pendingPlayVillainTopChoices`
  field** — lazily materialized (never in `Game.setup()`), carrying `playerId`,
  `cardId`, and the `attackReward` magnitude.
- **Park handler** `heroEffectOptionalPlayVillainTop` (`hero/heroEffects.execute.ts`) —
  parks the pending choice (the covert gate already gated the hook).
- **Block-all guard** `hasPendingPlayVillainTopChoice` enforced at every play-phase
  move (the established pending-choice guard placement).
- **Resolve move** `resolvePlayVillainTopChoice({ accept })` — on accept, call
  `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 1)` then grant +2 Attack (`addResources`); on
  decline, clear the pending entry and grant nothing. Registered in the move map +
  the sim/bot `MOVE_MAP`; `getLegalMoves` short-circuits to the SINGLE deterministic
  DECLINE default while the choice is pending (the return-on-discard / optional-put-
  bottom-HQ precedent) — both `{accept:true}` and `{accept:false}` stay valid at the
  resolve move for a human. The accept path builds a `RevealContext`
  (`{ random, ctx: { currentPlayer } }`, per `moves/fightVillain.ts`) and passes
  `DEFAULT_IMPLEMENTATION_MAP` to `playTopVillainDeckCards`.
- **UIState projection** `UIPendingPlayVillainTop` — populated in `buildUIState`,
  passed through `filterUIStateForAudience` (owner-scoped like the other pending
  choices), and surfaced in the Play Diagnostics `uiStateSnapshot`.
- **Client prompt** `PlayVillainTopPrompt.vue` + its wiring in the play surface +
  a component test — modeled on `OptionalKoRewardPrompt.vue`.
- **Card data** — a new `[keyword:optional-play-villain-top:2]` marker on
  `core/emma-frost/shadowed-thoughts` (via `VALID_TOKEN_PATTERN` +
  `hero-ability-markers.json`, regenerated; the setup parser emits the keyword +
  magnitude, gated by the existing `[hc:covert]:` condition). Suppress the printed
  `+2[icon:attack]` from the icon→keyword / icon-magnitude passes so the reward is
  the keyword's, not a second unconditional attack grant (the optional-ko-reward
  icon-subsumption precedent).
- **Regenerated hero card-data-derived artifacts** + their `:check` gates.
- **Tests** — engine: parks on covert-gate pass, not on fail; the block-all guard;
  accept → the top Villain-Deck card is played + +2 Attack; decline → neither; the
  deterministic DECLINE default; `getLegalMoves` returns only the DECLINE default while
  pending; the keyword lockstep +
  the UIState projection + audience-filter survival. Client: the prompt renders +
  dispatches accept/decline.

## Out of Scope

- **The `[hc:covert]:` gate** — faithful, unchanged.
- **Other Villain-Deck-play cards** (msp1 / nmut / wwhk forms, scheme twists) — a
  different form / layer; this WP is the single `core/emma-frost/shadowed-thoughts`.
- **Psychic Link / Diamond Form** — shipped (WP-659 / WP-656).
- **A generic pending-choice renderer** — the client uses bespoke prompts per type;
  this WP adds one, it does not refactor the pattern.
- **Any change to `playTopVillainDeckCards`'s reveal cascade** — reused as-is.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ the two length-pin tests) —
  the new keyword.
- `packages/game-engine/src/types.ts` — `PendingPlayVillainTopChoice` + the
  `pendingPlayVillainTopChoices?` `G` field + `UIPendingPlayVillainTop`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ its handler-count/keyset
  tests) — the park handler + `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` entries. NOT
  `NO_MAGNITUDE_KEYWORDS` (the keyword carries magnitude 2 → it relies on the pre-gate,
  like `optional-ko-reward`).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the marker → keyword +
  magnitude + the `+2[icon:attack]` suppression on the marked line.
- `packages/game-engine/src/moves/playVillainTop.resolve.ts` (**new**) — the resolve
  move + `hasPendingPlayVillainTopChoice`.
- the move registration + block-all-guard sites + the sim/bot `MOVE_MAP` +
  `getLegalMoves` — **modified**. Place `hasPendingPlayVillainTopChoice` at **exactly the
  same set of sites** as the model's `hasPendingOptionalKoReward` — grep its call sites
  (`coreMoves.impl.ts` and any other guard hosts), mirror them one-for-one, and freeze that
  list into the EC allowlist before coding (so guard coverage is verifiable, not judgment).
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.filter.ts` (+ the
  audience-filter test) — the projection + pass-through.
- `packages/game-engine/src/**/*.test.ts` — engine coverage above.
- `apps/arena-client/src/components/play/PlayVillainTopPrompt.vue` (**new**) + its
  wiring + `.test.ts`.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`
  + `data/cards/core.json` (regenerated) + the regenerated hero derived artifacts.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24474 Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` — governance.

The exact allowlist (esp. the move-registration + guard sites, and the client wiring
files) is finalised at execution; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: `ctx.random.*` only; moves never throw; the resolve move + park handler
>   safe-skip malformed state. `getLegalMoves` and the sim/bot default are deterministic
>   (default DECLINE).
> - **Pending-choice UX integrity:** the new pending type MUST have a `UIState` projection
>   AND survive `filterUIStateForAudience`, or the human freezes (block-all guard with no
>   projection is the shipped freeze failure mode). A client prompt is REQUIRED, not deferred.
> - The covert gate is untouched.
> - The card-data marker is regenerated by the pipeline, never hand-edited (WP-633).
> - New keyword ↔ the full lockstep (per `reference_hero_keyword_lockstep_sites`); runtime
>   drift pins (engine tests are not typechecked — D-24372).
> - Session protocol: on any ambiguity not resolved by the WP + EC, STOP and surface it.

## Contract

- **Keyword** — `optional-play-villain-top`, magnitude 2 (the attack reward).
- **Pending** — `PendingPlayVillainTopChoice { playerId; cardId; attackReward: number }`;
  `G.pendingPlayVillainTopChoices?`.
- **Resolve move** — `resolvePlayVillainTopChoice({ accept: boolean })`. Accept →
  `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 1)` + `+attackReward` Attack; decline → clear, nothing.
- **Deterministic default** — DECLINE (D-24474), for bot/autoplay/`getLegalMoves`.
- **Marker** — `[keyword:optional-play-villain-top:2]` on `core/emma-frost/shadowed-thoughts`.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §4 (pending-choice sync), §22 (determinism).
- **Conflict assertion:** No conflict — a printed hero ability made faithful; the choice
  is deterministic (no RNG added beyond the reused villain-reveal path's existing
  `ctx.random`), replay-faithful, and buys no game outcome (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..7 crossed.
- **Determinism preservation:** The resolve move + default are deterministic; the accept
  path reuses `playTopVillainDeckCards` (existing shuffle envelope); the pending field is
  lazily materialized so a game that never parks it is byte-unchanged.

## Funding Surface Gate

§20 N/A — engine gameplay + card data + a gameplay client prompt; no funding affordance
or copy.

## API Catalog Update

§21 N/A per D-11804 — a boardgame.io move (not an HTTP endpoint or server-reachable
library function).

## Acceptance Criteria

- **AC-1** Playing Shadowed Thoughts with the Covert synergy met parks a
  `PendingPlayVillainTopChoice` and grants **no** immediate Attack.
- **AC-2** With the Covert synergy NOT met, the hook is gated (no pending, no Attack) —
  the existing faithful behaviour, unchanged.
- **AC-3** Resolving with `accept: true` plays the top Villain-Deck card (the top card
  moves out of the Villain Deck and its reveal resolves) AND grants +2 Attack.
- **AC-4** Resolving with `accept: false` grants **no** Attack and does **not** touch the
  Villain Deck; the pending entry is cleared either way.
- **AC-5** The pending choice is block-all: other play-phase moves are refused while it is
  open, and it carries a `UIPendingPlayVillainTop` projection that survives
  `filterUIStateForAudience` for the owning player (no freeze).
- **AC-6** While the choice is pending, `getLegalMoves` returns the **single** DECLINE
  default (matching the return-on-discard / optional-put-bottom-HQ short-circuit — NOT
  an enumeration of both moves); a bot never softlocks and never forces the reveal. Both
  `{accept:true}` and `{accept:false}` are accepted by the resolve move itself.
- **AC-7** `optional-play-villain-top` is wired across the keyword lockstep (union,
  `HERO_KEYWORDS` + both length pins, `HERO_EFFECT_HANDLERS` + handler-count pin,
  `HANDLED_KEYWORDS`) — but **NOT** `NO_MAGNITUDE_KEYWORDS` (it carries magnitude 2, so it
  relies on the pre-gate like `optional-ko-reward`); the runtime drift pins pass, and the
  accept path grants exactly the magnitude-2 reward (proving the magnitude survives the
  `executeSingleEffect` pre-gate).
- **AC-8** The client `PlayVillainTopPrompt.vue` renders the prompt and dispatches
  accept / decline; its component test passes.
- **AC-9** `data/cards/core.json` `shadowed-thoughts` encodes the marker, and a clean
  regen reproduces the committed bytes; the printed `+2[icon:attack]` is not double-counted
  as a separate unconditional grant.
- **AC-10** Determinism: the pending field is lazily materialized (a no-park game is
  byte-unchanged); `sim:runtime-observed:check` current (or a recorded, explained re-pin);
  both hash oracles handled deliberately.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. `pnpm --filter @legendary-arena/arena-client test` (or the client test script) exits 0.
4. The card-data regen chain reproduces the committed `data/cards/*.json` + every `:check`.
5. `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
6. **Control run:** revert the resolve-move accept branch; confirm AC-3 fails (non-vacuous).
7. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-10 satisfied.
- [ ] All Verification Steps green, incl. the Step-6 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24474 Active**, recording: the optional-ko-reward
      pattern reuse + the `playTopVillainDeckCards` reuse; the new keyword / pending type /
      resolve move; the deterministic DECLINE default; the covert gate left untouched; and
      the pending-choice UIState-projection + client-prompt requirement.
- [ ] `docs/ai/STATUS.md` close-out.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real match plays
      Shadowed Thoughts (Covert met) and is offered the choice — accept plays the top
      Villain-Deck card + +2 Attack, decline does neither; recorded or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24474 — Shadowed Thoughts' "You may play the top card of the Villain Deck. If you do,
+2 Attack" is a new optional pending-choice mechanic (the optional-ko-reward pattern),
reusing `playTopVillainDeckCards`; the deterministic default is DECLINE.** Records: the
covert gate is faithful and untouched; the new `optional-play-villain-top` keyword joins
the full handler-bearing lockstep; the `PendingPlayVillainTopChoice` park + block-all
guard + `resolvePlayVillainTopChoice` resolve move (accept → play top Villain-Deck card
via the existing reveal cascade + +2 Attack; decline → nothing); the mandatory UIState
projection + audience-filter pass-through + bespoke client prompt (a pending choice with
no projection freezes the human); and — unlike WP-659's auto-reveal — the "may" is a real
choice with a downside, so it is prompted for humans and defaults to DECLINE for
bot/autoplay/`getLegalMoves` (deterministic, conservative).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft commit
body). §1–§9 PASS (Context specific; §4 the card-data change is a prose-marker append, not a
00.2 §8.1 schema change; §8 layer boundary respected — engine decides, client renders a
read-only prompt that dispatches a move). §12–§17 PASS (control run mandated; §16 human-style
per 00.6; §17 Vision block carries clause numbers + conflict assertion + the determinism
line; §15.1 declares `play.legendary-arena.com` with the D-24026 live gate). §10, §11, §18,
§20, §21 resolve N/A with named justifications.
**Gate verdicts:** pre-flight NOT READY + copilot BLOCK → both caught PS-1/BLOCK-1: the
keyword carries magnitude 2 so it must NOT join `NO_MAGNITUDE_KEYWORDS` (its model
`optional-ko-reward` relies on the pre-gate) — struck from Scope/Files/AC-7/Context + the
EC + D-24474, with an AC that the accept path grants exactly the magnitude-2 reward.
Pre-flight also caught PS-2 (the real `playTopVillainDeckCards` signature is the 4-arg
`(G, RevealContext, ImplementationMap, count)` per `fightVillain.ts` — corrected everywhere,
with the `RevealContext` build + `DEFAULT_IMPLEMENTATION_MAP` import named) and RS-1
(`getLegalMoves` returns the single DECLINE default, not both moves — the return-on-discard
precedent). All scope-neutral corrections; a re-confirmation verified the fixes against the code (the 4-arg playTopVillainDeckCards signature, the pre-gate exempt-set membership, the single-DECLINE getLegalMoves pattern). Verdict: READY / PASS.
