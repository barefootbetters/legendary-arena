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

## Mechanics

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

#### 2. Good versus evil — the match as a moral arc

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

#### 4. Agency — "I act on the world"

Self-determination research puts **autonomy** at the center of intrinsic
motivation: the game feels meaningful when the player's choices visibly shape
the story. The local action moves (`playCard`, `recruitHero`, `fightVillain`)
are the player *authoring* the narrative — the framing should make each feel
like a deliberate story move, not a menu selection.

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
  its [shared trigger spine](design-system-overview.md#shared-trigger-spine)
  has a "Narrative" column this page expands into full story beats.
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

## Open Questions

- **No Work Packet is scoped yet.** Pre-design research. In implementation
  this becomes narrative copy + framing consumed by the visual/audio WPs,
  plus the Playstyle lens toggle — not a WP of its own unless the lens grows
  its own mechanics.
- **Playstyle Modes: section or standalone page?** Documented here as a
  narrative lens. If it grows distinct progression / cosmetics / a villain
  campaign, graduate it to a standalone **Playstyle Modes Framework** page.
- **Per-event narrative copy.** The concrete artifact this framework should
  produce: a heroic-lens and a destroyer-lens copy line per spine event,
  keyed by acting entity where identity is known.
- **How deep does the villain power-fantasy go?** A pure re-theme (v1) vs a
  genuine "play as the villains" mode is a design fork — the re-theme is in
  scope now; the full mode is a larger, separate question.
- **IP-safe framing review.** Narrative copy leaning on Marvel characters
  should get a licensing/IP pass before shipping, to keep theme on the right
  side of the license.

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
