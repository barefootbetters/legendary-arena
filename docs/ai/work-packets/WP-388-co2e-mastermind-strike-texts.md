# WP-388 — co2e Mastermind Strike Texts: Doom, Loki, Magneto, Doctor Octopus (Game Engine)

**User-Visible Surface:** play.legendary-arena.com

**Status:** Draft — **BLOCKED on WP-389** (mastermind base-face selection)
**Layer:** Game Engine

## Goal

Four of the five co2e masterminds' printed Master Strike abilities are card
data the engine never reads: a strike from Doctor Doom, Loki, co2e Magneto,
or Doctor Octopus performs only the generic bookkeeping (bystander capture,
strike counter, log line) and the printed text silently no-ops. This WP adds
a per-mastermind resolver for each, on the `resolveRedSkullStrike` pattern
locked by WP-386 / D-24188, so a co2e match plays the strikes the cards
print. Every "or" / "may" clause resolves by **deterministic auto-pick** — no
new `G` field, no RNG, no pending-choice prompt.

## User-Visible Impact

In a deployed co2e match, a Master Strike from any of the four masterminds
now changes each player's hand as the card prints, with one HUD log line per
player naming what happened. Today those strikes produce only the strike
counter and a bystander capture, so a player sees a strike resolve with no
consequence. Doctor Doom's strikes additionally escalate across the match (1
card, then 2, then 3…) as Omens accumulate.

## Assumes

- **WP-389 / D-24193 — HARD DEPENDENCY, must land first.** Until it does,
  `findMastermindCards` selects the **last** non-tactic mastermind face,
  which for every co2e mastermind is the **Epic** face. The four texts this
  WP implements are the **base** faces, so without WP-389 the engine would
  resolve base-face text while the board shows the Epic card. ⏸ not yet on
  `main`.
- **WP-024** — `mastermindStrikeHandler` in
  `packages/game-engine/src/rules/mastermindHandlers.ts` dispatches on
  `G.selection.mastermindId`. ✅ on `main`.
- **WP-386 / D-24188** — `resolveRedSkullStrike` establishes the resolver
  pattern (sorted player iteration, direct `G` mutation, deterministic
  auto-pick, one `pushLog` line per player). ✅ on `main` (PR #792).
- **WP-179** — `G.cardTraits[extId]` carries `{ heroClass, team }`, built at
  setup, read-only at runtime. ✅ on `main`. This is the load-bearing
  dependency: it is what makes team/class gating possible without a registry
  read. (The existing `// why:` on `MAGNETO_HAND_SIZE_LIMIT` claims
  `G.cardKeywords` carries no team affiliation — true, but stale as a
  capability statement since WP-179 landed `G.cardTraits`.)
- **WP-200** — `mastermindStrikeResolved` is the handler's terminal
  emission. ✅ on `main`.
- **D-15401** — `captureBystanderOntoMastermind` runs generically before the
  per-mastermind branch. ✅ on `main`.
- **D-21502** — S.H.I.E.L.D. starters carry no `cardStats` entry; cost reads
  fall back to 0. ✅ on `main`.
- **D-24183 / WP-382** — the zoneOps move idiom used for the discard path.
  ✅ on `main`.
- `WOUND_EXT_ID` is exported from
  `packages/game-engine/src/setup/pilesInit.js`. ✅ on `main`.
- `moveCardFromZone(source, destination, extId)` is exported from
  `packages/game-engine/src/moves/zoneOps.js`. ✅ on `main`.
- `gainWound(woundsPile, playerDiscard)` is exported from
  `packages/game-engine/src/board/wounds.logic.js` and is **non-mutating**
  (returns `{ woundsPile, playerDiscard }`). ✅ on `main`.
- co2e card data is complete and real 2nd-edition (heroes, masterminds,
  villains, henchmen, schemes, support). ✅ on `main` (PRs #774…#794).
- Baseline: `origin/main` @ `9c456412`; engine suite **1991 pass / 464
  suites / 0 fail** observed at draft.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline (handlers never
  live in `G`; `applyRuleEffects` applies returned effects; per-mastermind
  text effects mutate `G` inline in the handler per the Magneto / Red Skull
  precedent)
- `.claude/rules/architecture.md` §Rule Execution Pipeline, §Prohibited AI
  Failure Patterns
- `packages/game-engine/src/rules/mastermindHandlers.ts` —
  **AUTHORITATIVE for** the dispatch chain, the Magneto / Red Skull branch
  shape, `selectRedSkullKoTarget`, and the WP-200 emission ordering
- `packages/game-engine/src/moves/zoneOps.ts` — **AUTHORITATIVE for** the
  `moveCardFromZone` return contract (`{ from, to, found }`)
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — the Red
  Skull describe-block is the test template
- `packages/game-engine/src/state/cardTraits.types.ts` —
  **AUTHORITATIVE for** the `{ heroClass, team }` entry shape this WP gates
  on
- `packages/game-engine/src/board/wounds.logic.ts` — **AUTHORITATIVE for**
  `gainWound`'s non-mutating return contract
- `docs/ai/work-packets/WP-389-mastermind-base-face-selection.md` +
  **D-24193** — **AUTHORITATIVE for** which mastermind face the engine plays;
  this WP is invalid until that lands
- `docs/ai/DECISIONS.md` — scan for D-15401 (strike bystander capture),
  D-21502 (statless starters), D-24183 (zoneOps move idiom), D-24188
  (deterministic auto-pick precedent)
- `data/cards/co2e.json` — the four base-face Master Strike texts this WP
  implements
- `docs/legendary-universal-rules-v23.md` §"Grey Heroes" — the tabletop
  definition referenced by the deferred branches (not implemented here)

## Design Rationale

The 2026-07-16 Red Skull live-game review found the strike dispatcher
implemented exactly one mastermind (Magneto). WP-386 added the second (Red
Skull). This WP closes the rest of the co2e set.

**Scope is bounded by which face the engine plays.** co2e carries **ten**
authored Master Strike texts — a base and an Epic face for each of five
masterminds. This WP implements the **base** faces (Red Skull's landed in
WP-386), so it covers the remaining **four**.

That is correct only once WP-389 lands. At draft time the classifier in
`mastermind.setup.ts` assigns `baseCard` on every non-tactic face with no
early exit, so the **last** one wins — the Epic face, for all five co2e
masterminds and for 65 masterminds across 24 sets. Dispatch is unaffected
(it keys on `G.selection.mastermindId`, not the card id), so these resolvers
would still fire; they would simply resolve base-face text against an Epic
card on the board. WP-389 makes the first non-tactic face the base card and
is this WP's hard dependency. D-24193 carries the full history.

An earlier draft of this WP asserted the opposite — that setup picks the
first non-tactic face and Epic faces are therefore unreachable. That was
false, and it is the same wrong premise behind the WP-386 `// why:` comment
and the `master-strike` wiki page. Their dispositions differ and neither is
work for this WP: the wiki page was corrected at WP-389's **drafting**
commit, and the WP-386 comment needs **no edit at all** — WP-389 makes its
claim true as written. Do not "fix" that comment here.

**Why deterministic auto-pick.** Every one of the four texts is a player
choice ("or", "may"). Honoring the choice needs a pending-choice model with a
UIState projection and a client prompt shipped together — without all three
the engine hard-freezes (the documented `pending*` failure mode). D-24188
already chose deterministic auto-pick for exactly this reason and shipped.
This WP extends that precedent rather than opening a UX arc.

**Why no new `G` state.** Two of the four texts name a persistent stack
("Omen of Doom", "Hypno-Thrall"). Neither requires a new field here:

- **Doom's Omens are already counted.** Every Doom strike stacks exactly one
  Omen, so the Omen count is the strike count. `G.counters.masterStrikeCount`
  is incremented by the generic `modifyCounter` effect, which the pipeline
  applies **after** the handler returns — so at resolver time the count for
  the strike being resolved is `(masterStrikeCount ?? 0) + 1`.
- **Loki's Thrall branch is the branch we do not take.** The auto-pick takes
  the discard branch, which needs no stack.

**The two bounded fidelity gaps** (stated plainly rather than buried): Loki's
and Doctor Octopus's alternate branches (stack a Hypno-Thrall; reveal the top
8 and discard non-grey Heroes in random order) are **not** implemented. A
player who cannot take the implemented branch — no Strength Hero in hand for
Loki, no Spider-Friends Hero for Doctor Octopus — takes a **logged no-op**
instead of the alternate branch, and so escapes the strike entirely. This is
a real faithfulness gap. It is deliberate: the alternate branches require a
new mastermind-adjacent zone (Thralls) and `ctx.random` threading plus a
"non-grey Hero" predicate, which together are a larger WP than this one.
D-24192 records the gap and names the follow-up.

For the record, the follow-up will not need to invent "non-grey": the
tabletop rulebook (`docs/legendary-universal-rules-v23.md`, "Grey Heroes")
defines it as *grey-colored cards with no Hero Class* — i.e.
`G.cardTraits[extId]?.heroClass == null`. It is unused by this WP.

## Scope (In)

- A per-mastermind id constant and resolver for each of the four base faces,
  added beside `MASTERMIND_MAGNETO` / `MASTERMINDS_RED_SKULL` in
  `mastermindHandlers.ts`:
  - `co2e/doctor-doom` → `resolveDoctorDoomStrike`
  - `co2e/loki` → `resolveLokiStrike`
  - `co2e/magneto` → `resolveCo2eMagnetoStrike`
  - `co2e/doctor-octopus` → `resolveDoctorOctopusStrike`
- Four new mutually-exclusive branches in the existing dispatch chain.
- A shared pure helper for "lowest-cost eligible card in hand, tie → lowest
  hand index", generalized from `selectRedSkullKoTarget` by a **plain
  discriminator argument** — a trait kind (`'any' | 'team' | 'heroClass'`)
  plus the slug to match — **not** a predicate callback. Rationale:
  `.claude/rules/code-style.md` §Functions bans higher-order functions
  (closures-as-config) unless the framework requires them; a predicate
  parameter is exactly that. `selectRedSkullKoTarget` keeps its behavior.
- Tests in `mastermindHandlers.test.ts` — one describe-block per resolver,
  mirroring the Red Skull block.
- A comment-only correction to the stale `MAGNETO_HAND_SIZE_LIMIT` `// why:`
  claim that no team data exists (no behavior change).

## Out of Scope

- **`core/magneto`** — different printed text; `resolveMagnetoStrike` is
  untouched, as is `MASTERMIND_MAGNETO`.
- **Epic faces** (all five) — their strike text is out of scope. After
  WP-389 they are unreachable entirely (no opt-in exists yet); before it,
  they are what the board shows, which is precisely why WP-389 gates this WP.
- **Loki's Hypno-Thrall branch** and **Doctor Octopus's reveal-8 branch** —
  the bounded gaps above.
- Any new `G` field, zone, `RuleEffect` type, move, or phase change.
- Any RNG; `ctx` stays unread (`_ctx`).
- Mastermind **tactic** Fight: effects; HYDRA villain Fight: markers.
- Pending-choice / KO-choice UX.
- Any card-data (`data/cards/co2e.json`) change.

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  four id constants, four resolvers, the shared discriminator-parameterized
  lowest-cost selector (trait kind + slug, not a callback), four dispatch
  branches, and the comment correction
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified**
  — one describe-block per new resolver, covering AC-1..AC-9
- `docs/ai/STATUS.md` — **modified** — close-out entry for this WP
- `docs/ai/DECISIONS.md` — **modified** — D-24192 flips from Drafted to
  Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-388 checkbox flip
  with date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-418 status
  flip to Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip this WP's node glyph
  `📝` → `✅`, then `pnpm roadmap:counts:write`. Required: the drafting commit
  added the `📝` node, and the WP-386 precedent (`7bd2cc6e`) flips it at
  execution. The counts table self-heals via the `roadmap-counts.yml` cron;
  the node glyph does not.

## Non-Negotiable Constraints

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+
> - Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`
> - No `Math.random()`; no wall-clock reads; no new dependency
> - No `boardgame.io` and no registry import in `mastermindHandlers.ts`
>   (it has neither today)
> - Moves never throw; the handler never throws — a malformed, empty, or
>   all-Wound hand degrades to a logged no-op
> - No new `G` field, zone, `RuleEffect` type, move, or phase change
> - Locked contract values: see `## Contract` below — do not re-derive them
> - If any item below is unclear or appears to conflict with the source,
>   STOP and ask rather than improvising

## Contract

### Shared eligibility + selection

A hand card is a **Hero** iff `extId !== WOUND_EXT_ID`. Cost is
`gameState.cardStats[extId]?.cost ?? 0` (D-21502). Selection among eligible
cards is **lowest cost, tie → lowest hand index** (strict `<` preserves the
first match), matching D-24188.

Trait reads are `gameState.cardTraits[extId]?.team` and
`?.heroClass`, compared against normalized lowercase slugs. Locked slug
values: `'x-men'`, `'spider-friends'`, `'strength'`.

### Per-mastermind behavior

Player iteration order is `Object.keys(gameState.playerZones).sort()` for
every resolver below (the Magneto / Red Skull pattern).

**`co2e/doctor-doom`** — *"Stack this Strike next to Doctor Doom as 'Omen of
Doom.' Then each player discards cards equal to the number of Omens or gains
a Wound."*
`omenCount = (gameState.counters.masterStrikeCount ?? 0) + 1`. Per player: if
`hand.length >= omenCount`, discard exactly `omenCount` cards chosen by the
shared selection rule applied repeatedly (lowest cost first); else
`gainWound`. No Omen zone is created.

**`co2e/loki`** — *"Each player discards a [hc:strength] Hero or stacks a
non-grey Hero from their hand next to Loki as a Hypno-Thrall."*
Per player: discard the selected Strength Hero
(`cardTraits[extId]?.heroClass === 'strength'`, Wounds excluded). If none →
logged no-op (the Thrall branch is out of scope).

**`co2e/magneto`** — *"Each player discards an [team:x-men] Hero or gains a
Wound."*
Per player: discard the selected X-Men Hero
(`cardTraits[extId]?.team === 'x-men'`, Wounds excluded); if none →
`gainWound`. **Fully faithful** — a player with no X-Men Hero must take the
Wound on the tabletop too.

**`co2e/doctor-octopus`** — *"Each player may discard a
[team:spider-friends] Hero. Any player who doesn't must reveal the top 8
cards…"*
Per player: discard the selected Spider-Friends Hero
(`cardTraits[extId]?.team === 'spider-friends'`, Wounds excluded). If none →
logged no-op (the reveal-8 branch is out of scope).

### Mutation idioms

Both mutation helpers are **non-mutating and return new arrays; both of
their outputs must be assigned back.**

Discard-from-hand uses the WP-382 / D-24183 idiom —
`moveCardFromZone(playerZones.hand, playerZones.discard, selectedExtId)`,
which returns `{ from, to, found }` (fungible ids: first-match removal ≡
index removal). Assign **both** `playerZones.hand = result.from` **and**
`playerZones.discard = result.to`. Note the Red Skull precedent at
`mastermindHandlers.ts` assigns only `.from`, because its destination was a
throwaway `[]` and the KO went through `koCard` — copying that call shape
here would silently drop the discarded card.

Wound gain uses `gainWound(gameState.piles.wounds, playerZones.discard)` and
likewise assigns **both** returned arrays back.

### Handler ordering (unchanged)

`captureBystanderOntoMastermind` → per-mastermind branch → WP-200 emission →
`return buildGenericStrikeEffects()`.

## Vision Alignment

- **Vision clauses touched:** §1 (Faithful Legendary rules), §2 (Real card
  content behaves as printed), §22 (Deterministic Eval).
- **Conflict assertion:** No conflict: this WP preserves all touched
  clauses — it makes printed card text faithful where it was silently
  skipped, and records the two branches it does not yet implement rather
  than misrepresenting coverage.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..7 are crossed.
- **Determinism preservation:** Every auto-pick is deterministic (cost then
  hand-index; no RNG, no `ctx.random.*`) and replay-faithful (§22). The
  recorded sentinel fixture and `PRE_WP080_HASH` oracle use `core/dr-doom`,
  and the runtime-observed sim matrix pins `core/dr-doom`, so no co2e branch
  is reachable from them — all committed hash and artifact surfaces are
  expected byte-identical; any drift is a STOP-and-investigate, never a
  silent re-pin.

## Funding Surface Gate

N/A — engine gameplay fidelity only; no UI funding affordances, no
user-visible funding copy, no funding channels referenced (§20.1 surfaces
absent).

## API Catalog Update

N/A per D-11804 — no HTTP endpoint and no `apps/server`-reachable library
function is added, modified, removed, or status-changed.

## Acceptance Criteria

- **AC-1** A `co2e/doctor-doom` strike with `masterStrikeCount = 0` makes each
  player discard exactly 1 card (lowest cost, tie → lowest index); with
  `masterStrikeCount = 2`, exactly 3 cards. A player whose hand is smaller
  than the Omen count gains a Wound instead and discards nothing.
- **AC-2** A `co2e/loki` strike discards exactly one Strength Hero per player;
  a player with no Strength Hero has an unchanged hand and a logged no-op.
- **AC-3** A `co2e/magneto` strike discards exactly one X-Men Hero per player;
  a player with none gains a Wound (wounds pile shrinks by 1, discard grows
  by 1). An empty wounds pile degrades to a no-op without throwing.
- **AC-4** A `co2e/doctor-octopus` strike discards exactly one Spider-Friends
  Hero per player; a player with none has an unchanged hand and a logged
  no-op.
- **AC-5** Wounds in hand are never selected by any of the four resolvers.
- **AC-6** `core/magneto` and both Red Skull ids behave byte-identically to
  `main`; a mastermind matching none of the six ids takes no branch.
- **AC-7** Every resolver emits exactly one `pushLog` line per player, and
  each strike mutates each player's hand at most as specified (never twice).
- **AC-8** The generic strike behavior — D-15401 capture, `masterStrikeCount`
  increment, WP-200 emission and payload — is unchanged.
- **AC-9** The handler never throws for any input: empty hand, all-Wound
  hand, missing `cardStats` entry, missing `cardTraits` entry, empty wounds
  pile, absent `counters.masterStrikeCount`.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; the new
   describe-blocks pass and the pre-existing Magneto / Red Skull blocks are
   unchanged and green.
3. `pnpm -r build` exits 0.
4. `pnpm sim:runtime-observed:check` exits 0 **and performs no
   regeneration**. The recorded fixture and runtime-observed matrix use
   `core/dr-doom`, so no co2e branch is reachable from them; regeneration
   means something leaked outside the new branches — STOP and investigate,
   never re-baseline.
5. Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-identical (no new `G`
   field, and the fixture mastermind is not co2e).
6. `git diff --name-only` (staged changes) equals the seven-file allowlist
   exactly.

## Definition of Done

- [ ] All Acceptance Criteria AC-1..AC-9 satisfied.
- [ ] All Verification Steps green with the recorded observed output.
- [ ] **No files outside `## Files Expected to Change` were modified**
      (`git diff --name-only` on staged changes = the seven-file allowlist).
- [ ] `docs/ai/DECISIONS.md` — D-24192 flipped to Active.
- [ ] `docs/ai/STATUS.md` close-out entry recorded.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` rows flipped with date.
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026
      live-on-surface verification recorded (a deployed co2e match where a
      Doom / Loki / Magneto / Doctor Octopus strike produces the specified
      hand change plus HUD log lines). Operator-pending on deploy is
      acceptable if recorded as such.

## Reserved Decision (lands at execution)

**D-24192 — co2e mastermind strike texts resolve by deterministic auto-pick;
two alternate branches deliberately unimplemented.** Drafted in
`docs/ai/DECISIONS.md` at this WP's drafting commit; flips to Active at
execution. Full rationale, the per-mastermind branch table, the recorded
fidelity gap, and the rejected alternatives live in the D-entry itself.

## Lint Gate Self-Review (00.3)

Run at draft against all 21 sections; independently audited rather than
self-asserted. First pass returned NOT SATISFIED on §1, §2, §3, §4, §5, §15,
§15.1, §17 — all governance-surface omissions relative to WP-386's shape,
no technical-design defect. All were corrected in place: `## Non-Negotiable
Constraints` added; `WOUND_EXT_ID` / `moveCardFromZone` added to `§Assumes`;
`§Context (Read First)` rewritten as a read list with the rationale moved to
`## Design Rationale`; one-line descriptions added to every
`§Files Expected to Change` entry; the DoD converted to checkboxes with the
scope-boundary check added; the `**User-Visible Surface:**` header
declaration and `## User-Visible Impact` added; the §17.2 conflict assertion
stated in required form. §10, §11, §18, §20, §21 resolve N/A with named
justifications. Re-run after the corrections: SATISFIED.
