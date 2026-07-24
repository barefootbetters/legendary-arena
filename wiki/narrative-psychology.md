---
title: Narrative Psychology Framework
type: Guide
tags:
  - design-system
  - narrative
  - psychology
  - archetype
  - playstyle
  - motif
  - arena-client
  - research
related:
  - design-system-overview.md
  - visual-effects.md
  - sound-effects.md
  - music-authoring.md
  - dopamine-triggers.md
  - master-strike.md
  - villain-deck.md
  - gameplay-strategy.md
  - vision.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\narrative-psychology.md (this page — https://ewiki.legendary-arena.com/narrative-psychology/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
last-reviewed: 2026-07-22
---

# Narrative Psychology Framework

## Summary

This page is the **meaning-and-resonance reference** for
`play.legendary-arena.com` — the layer that makes a match feel like a
*story*, not just a sequence of legal moves. Where the
[Dopamine Trigger Framework](dopamine-triggers.md) explains why the loop is
*satisfying*, this page explains why it's *meaningful*: the pull of Marvel
lore, hero archetypes, good-versus-evil mythology, and nostalgia — the hooks
that make players invested beyond the mechanics.

It maps the [shared trigger spine](design-system-overview.md#shared-trigger-spine)
to **story beats**: a Master Strike is "evil asserts itself," a villain
defeated is "a heroic rescue," a Mastermind vanquished is "good triumphs."
The same engine events the visual and audio layers dramatize, this layer
*narrates* — so a single moment carries reward (dopamine), spectacle
(visual/audio), and meaning (narrative) at once, reinforcing each other.

It also houses the **Playstyle Modes** concept — the builder-versus-destroyer
lens Jeff raised: some players want to build a hero, a team, a rescued city;
others want the villain power-fantasy of overrunning it. A preference toggle
re-frames the *identical* engine events through a heroic or a villainous
narrative, without building two games.

No feel-layer code beyond the shipped audio foundation ships today — this is
`draft` research. Only the event vocabulary, the projected `UIState`
signals, and the architectural boundaries are sourced to code; the narrative
mappings are proposals. (Marvel characters and lore are licensed IP; this
page treats theme and framing, not reproduction of copyrighted text.)

### Soul / Authorial Voice (inherited principle) {#authorial-voice}

This framework inherits the
[Soul / Authorial Voice](design-system-overview.md#soul-authorial-voice)
principle from the Design System Overview.

Competent story beats are not enough. The narrative layer must feel
*authored* — it should communicate a clear creative point of view rather than
generic good-versus-evil framing. The four meaning hooks below exist to give
the game personality and emotional texture, not merely to label engine
events.

Practical tests this page owns:

- Characters and factions carry distinctive personality (quirks, voice,
  recognizable identity) rather than functioning as interchangeable stat
  blocks.
- Framing and copy show visible care in details that do not affect balance or
  retention (small flourishes of character, atmosphere, and environmental
  storytelling).
- The good-versus-evil fantasy is leaned into with conviction instead of
  being sanded down for maximum broad appeal.
- Every beat should feel like it belongs to *this* game's specific mythology,
  not a template arena narrative.

Accuracy and voice are *both* required: a beat that is accurate (rides true
`UIState`, per the [Narrative Contract](#narrative-contract)) but generic
(interchangeable with any other arena game's copy) satisfies the governance
layer yet fails this filter. Accuracy is the floor; voice is the ceiling.

**How to read this page.** The [Narrative Contract](#narrative-contract)
below is the **fixed governance layer** — the framing invariants, the beat
mapping's fidelity to real outcomes, and the IP boundary a future Work
Packet is judged against. The [Mechanics](#mechanics) are **design detail**
(evolvable), and [Decisions Pending](#decisions-pending) /
[Deferred](#deferred) are the **roadmap**.

## Narrative Contract

This section is the **immovable governance layer** of the page. The story
*framing* below it may evolve; the invariants, the beat mapping's fidelity
to real outcomes, and the IP boundary here may not without a `DECISIONS.md`
entry.

### What this layer is — and is not

The Narrative framework is **not its own code layer**. It is a **framing
contract** — copy, palette accent, and motif identity — expressed *through*
the [Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers. It reads the acting-entity identity and the outcome the client
already holds; it renders nothing of its own and adds zero engine footprint.

### Framing invariants (MUST)

- **Framing rides on true `UIState`.** Every narrated beat maps to the real
  engine outcome — never narrate a rescue that didn't happen, never soften a
  loss into a win. The engine's truth is the ground the story sits on.
- **The beat mapping is fixed to the outcome, not the theme.** The
  [story-beat table](#beat-mapping) binds each spine event to its canonical
  beat; the builder/destroyer lens re-colours the *telling*, never
  *which event happened*.

### Non-Goals — this framework MUST NOT

- change the engine, the events, the outcomes, or the rules;
- add any engine or determinism footprint (it is pure client-side framing);
- let the Playstyle lens alter the real `EndgameOutcome` — a "destroyer
  victory" narrative still maps to the engine's actual result;
- reproduce copyrighted Marvel text or art — this layer themes and
  archetypes only (see the IP boundary below).

### IP boundary (mandatory)

Marvel characters and lore are **licensed IP.** Narrative copy is original
and evocative; it never lifts published bios, dialogue, or lore verbatim.
Copy leaning on specific characters gets an IP / licensing pass before
shipping.

## Mechanics

### Priority tiers {#priority-tiers}

Narrative framing is layered in this order rather than all at once:

**Tier 1 — The good-versus-evil arc** (the core beats):

- The antagonist beats (`mastermindStrikeResolved`, `schemeTwistResolved`,
  `ambushResolved`) and the heroic beats (`fightResolved`,
  `mastermindDefeated`), each framed to its canonical story moment
- The three endgame resolutions (triumph / tragedy / stand-off)

**Tier 2 — Identity colouring**:

- Per-actor archetype framing (who is acting, from identity the client
  already holds)
- Team leitmotif / nostalgia identity (via [Music Authoring](music-authoring.md))

**Tier 3 — The Playstyle lens & depth**:

- The builder/destroyer re-theme ([Playstyle Modes](#playstyle-modes))
- Per-entity narrative copy depth

### The four meaning hooks

#### 1. Archetype — heroes and villains as story roles

Players don't recruit "a card with +2 attack" — they recruit *Spider-Man*,
*Wolverine*, *Cyclops*. Each carries an archetype the player already knows,
so the game inherits decades of characterization for free. The engine
already knows *who* is acting at every spine event (the acting hero from the
local move and in-play state; the Mastermind and Scheme from match
configuration), so narrative framing needs **no new signal** — it reads the
identity the client already has.

- **Design use:** color the *copy and framing* of a beat by the actor —
  a `fightResolved` narrated as "Wolverine tears through the henchmen" reads
  differently from the generic "villain defeated," using the event's
  `narrative` field and the acting entity's identity.

Personality is the difference between an archetype and a living character.
Framing should surface the distinctive traits players already associate with
each hero or villain (Wolverine's ferocity, Spider-Man's quips and
responsibility, a Mastermind's particular brand of menace) so the beat feels
specific rather than generic. Generic "villain defeated" copy is the failure
mode this hook exists to prevent.

#### 2. Good versus evil — the match as a moral arc {#beat-mapping}

Every match is a compressed good-versus-evil story: the villains scheme and
strike, the heroes build strength and push back, and it resolves in triumph,
tragedy, or an uneasy draw. The [dopamine](dopamine-triggers.md) threat/reward
rhythm *is* the narrative rising-and-falling action; this layer names it.

| Spine event | Story beat |
|---|---|
| `ambushResolved` | A new foe crashes the gates |
| `schemeTwistResolved` | The villains' plan advances — the plot thickens |
| `mastermindStrikeResolved` | Evil asserts itself — the darkest hour |
| `fightResolved` | A heroic rescue; the tide turns |
| `mastermindDefeated` | Good triumphs — the climax |
| Endgame `scheme-wins` | Tragedy — the city falls |
| Endgame `tie` | An unresolved stand-off; both sides withdraw |

#### 3. Nostalgia — inherited investment

Marvel lore is a nostalgia engine: a returning player brings childhood
attachment to these characters that the game did not have to build. This is
why the [music-authoring](music-authoring.md) **leitmotif** grammar matters
to *narrative*, not just audio — a recognizable theme keyed to a team
(S.H.I.E.L.D., X-Men, the Avengers) triggers identity and memory the instant
it plays.

- **Design use:** lean on recognizable team/character identity in framing,
  motif, and palette so the player feels "these are *my* heroes," not
  interchangeable stat blocks.

Nostalgia only creates soul when it is treated with care. Re-using team
identity and leitmotifs is not enough; the framing must feel like it respects
the emotional weight players already bring. Cheap or interchangeable nostalgia
reads as soulless.

#### 4. Agency — "I act on the world"

Self-determination research puts **autonomy** at the center of intrinsic
motivation: the game feels meaningful when the player's choices visibly shape
the story. The local action moves (`playCard`, `recruitHero`, `fightVillain`)
are the player *authoring* the narrative — the framing should make each feel
like a deliberate story move, not a menu selection.

Agency becomes meaningful when the player's actions feel like deliberate story
moves with personality and consequence, not menu selections. Framing should
make the player feel they are authoring a specific tale, not merely optimizing
a board.

### Playstyle Modes — the builder / destroyer lens {#playstyle-modes}

The sharpest narrative idea in scope: capitalize on **both** player
motivations without building two games.

- **Builders** want to construct — a hero, a team, a family, a rescued city.
  The heroic lens: `fightResolved` is a *rescue*, `mastermindDefeated` is
  *salvation*, the reward beats celebrate *building and protecting*.
- **Destroyers** want the power-fantasy — to overrun the city, to watch the
  scheme win. The villainous lens: the same events reframed as *conquest*,
  the menace counters climbing read as *progress toward domination*.

The engine already supports controlling the villains against the heroes, so
this is a **narrative re-frame over the identical trigger spine**, selected
by a preference toggle:

- **What changes:** copy, framing, palette accent, which side's beats get the
  celebratory treatment — pure presentation.
- **What does not change:** the engine, the events, the outcomes, the rules.
  The toggle adds **zero** engine footprint and cannot affect a result — it
  is a client-side lens, exactly like the visual and audio layers.

This is the same re-theme specced from the effects side under
[Visual Effects → narrative lens](visual-effects.md#playstyle-lens); this
page owns the *narrative* rationale, that page owns the *visual* mechanics.
The lens lives in player preferences beside the reduced-motion control.

> **Scope note.** Playstyle Modes is documented here as a section because it
> *is* a narrative lens. If it grows its own mechanics (distinct
> progression, distinct cosmetics, a full villain campaign), it should
> graduate to a standalone **Playstyle Modes Framework** page — flagged in
> Open Questions, not pre-built.

### Where this framework lives

Like [dopamine](dopamine-triggers.md), the narrative layer is **not its own
code layer** — it is a *framing contract* expressed through the
[visual](visual-effects.md) and [audio](sound-effects.md) layers plus copy.
It reads the same client-side `UIState` reaction surface (per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), engine owns truth, UI consumes
read-only projections) and the acting-entity identity the client already
holds. It adds zero engine footprint. Concretely it becomes: the narrative
copy/framing per spine event, the motif/palette identity per team, and the
Playstyle Modes lens toggle.

## Interactions

- **[Design System Overview](design-system-overview.md).** The parent hub;
  this page expands the "Narrative" column of the
  [shared trigger spine](design-system-overview.md#shared-trigger-spine) into
  full story beats and inherits the
  [Soul / Authorial Voice](design-system-overview.md#soul-authorial-voice)
  principle defined there.
- **[Dopamine Trigger Framework](dopamine-triggers.md).** The complementary
  driver — dopamine is the *reward* hook, narrative is the *meaning* hook.
  The same Mastermind defeat is a peak reward *and* the story's climax; the
  two frameworks reinforce the one moment.
- **[Music Authoring](music-authoring.md).** The leitmotif grammar is a
  narrative device as much as an audio one — team-keyed motifs are the
  nostalgia and identity hook made audible.
- **[Visual Effects](visual-effects.md).** Owns the mechanics of the
  builder/destroyer re-theme; this page owns its narrative rationale.
- **[Master Strike](master-strike.md)** and **[Villain Deck](villain-deck.md).**
  The engine subsystems that produce the antagonist beats (Strike, Twist,
  Ambush) the good-versus-evil arc is built from.
- **[Gameplay Strategy](gameplay-strategy.md).** The skill model behind two
  of the meaning hooks: **Agency** ("I act on the world") and **Archetype**
  are the meaning-side of the highest-leverage player decisions — Hero Deck
  construction and deck thinning — the player authoring their team and their
  deck's quality.
- **[Vision](vision.md).** The narrative must stay true to what the game
  *is* — a good-versus-evil Marvel deck-builder; framing never contradicts
  the vision's identity.

## Edge Cases

- **Marvel IP is licensed — theme, don't reproduce.** This framework covers
  *framing and archetype*, not reproduction of copyrighted character text or
  art. Keep narrative copy original and evocative; don't lift published
  bios, dialogue, or lore verbatim.
- **Narrative reads identity, and identity is already on the client.** The
  acting hero, the Mastermind, and the Scheme are known from the local move
  and match configuration — narrative framing needs no new engine event. The
  one exception is the same gap the other layers hit: **villain escape** has
  no client signal (log-only, deferred `escapeResolved`, WP-186 / D-20001),
  so "the villain got away" is a story beat with no hook today.
- **The Playstyle lens is presentation only.** The builder/destroyer toggle
  re-frames copy, palette, and which beats are celebrated — it must never
  change the engine, the events, the rules, or the outcome. A destroyer
  "winning" narrative still maps to the engine's real `EndgameOutcome`; the
  lens dramatizes it, it does not redefine it.
- **Don't let framing lie about the game state.** Narrative color rides on
  top of the true `UIState` — never narrate a rescue that didn't happen or
  soften a loss into a win. The engine's truth is the ground the story sits
  on.
- **Determinism and boundaries are untouched.** Pure client-side reaction:
  no reads into or writes of `G`/`ctx`, no effect on validation, no engine
  branching.

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six events (each carries a `narrative` field the framing builds on)
  mapped here to story beats
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the acting-entity identity and match configuration the narrative reads
  (heroes in play, Mastermind, Scheme)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, the three story resolutions (triumph / tragedy /
  stand-off)
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — the read-only-projection
  boundary that keeps narrative a client-side framing contract, not engine
  logic

## Acceptance Criteria

This framework has no runtime of its own; it is satisfied when the copy and
framing the sensory layers carry exhibit all of the following. No Work
Packet is scoped yet; when one lands, "the framing contract holds" means:

- Every narrated beat maps to the real engine outcome — no beat narrates a
  state that did not occur.
- The builder/destroyer lens (when built) changes only presentation:
  bot-vs-bot determinism proofs pass unchanged with it toggled either way,
  and the real `EndgameOutcome` is never altered.
- Narrative copy is original — no verbatim Marvel text/art — and has passed
  an IP / licensing review before shipping.
- Framing reads only identity / outcome already on the client; it adds no
  engine-event dependency beyond the documented signals, and degrades
  cleanly where a beat has no hook (villain escape).
- The v1 layer ships a single default theme; the lens is a follow-on.

## Decisions Pending

Open choices a Work Packet must resolve (not recommendations):

- **Playstyle Modes: section or standalone page?** Documented here as a
  narrative lens. If it grows distinct progression / cosmetics / a full
  villain campaign, graduate it to a standalone **Playstyle Modes
  Framework** page.
- **Per-event narrative copy** — the concrete artifact this framework owes:
  a heroic-lens and a destroyer-lens copy line per spine event, keyed by
  acting entity where identity is known.
- **How deep does the villain power-fantasy go?** A pure re-theme (v1) vs a
  genuine "play as the villains" mode is a design fork — the re-theme is in
  scope now; the full mode is a larger, separate question.

## Deferred

Out of scope for v1:

- **The builder/destroyer lens variants themselves** — Tier 3; v1 ships a
  single default theme.
- **Villain-escape narration** — the "the villain got away" beat is blocked
  on the engine emitting `escapeResolved` (WP-186 / D-20001); it has no
  client hook today.

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` and the per-event `narrative` field
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the identity/config signals narrative framing reads
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, the three story resolutions
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-20001 (deferred
  `escapeResolved` — the one un-narratable beat), D-24159 / WP-367 (the
  deck-exhaustion tie — the stand-off resolution)
- [Music Authoring](music-authoring.md) — the leitmotif grammar (narrative
  identity made audible)
- Companion feel-layer pages: [Design System Overview](design-system-overview.md),
  [Visual Effects](visual-effects.md), [Sound Effects](sound-effects.md),
  [Dopamine Trigger Framework](dopamine-triggers.md)
