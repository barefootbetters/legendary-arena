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
last-reviewed: 2026-07-27
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
- The [synergy call-out ladder](#synergy-callouts) + Arena Announcer —
  naming the player's chain reactions (**Combo! → Team-Up! →
  Unstoppable! → LEGENDARY!**)

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
rhythm *is* the narrative rising-and-falling action; this layer names it. The
[flow-channel map](dopamine-triggers.md#flow-channel) plots that arc beat by
beat.

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
a board. The moment-to-moment tracking of that agency against rising challenge
is the [flow-channel map](dopamine-triggers.md#flow-channel) on the Dopamine
page.

### Synergy call-outs — naming the chain {#synergy-callouts}

When a play detonates a chain of hero abilities, the engine already
counts the chain, and the [visual](visual-effects.md#combo-signal) and
[audio](sound-effects.md#tiered-combo) layers already escalate a flash and
a sting with it. This section adds the **meaning** layer to that same
moment: a **named call-out** that shouts *what the player just did* — the
Legendary-Arena answer to *Candy Crush*'s **"Sweet! → Tasty! → Delicious!
→ Divine!"**, the escalating labels Mr. Toffee announces as a cascade
grows.

Why a *word* matters where a particle burst does not:

- **It makes mastery legible.** A burst says "big"; a word says "you
  pulled off a **Team-Up**." The escalating combo is the deck-builder's
  deepest reward — the [dopamine page's](dopamine-triggers.md) tier-3
  "I *built* this" feel — and a **name** is what the player repeats,
  screenshots, and chases.
- **It is comic-book-native.** The escalating splash-panel exclamation is
  the genre's own grammar. A rising **"Combo! → Unstoppable! →
  LEGENDARY!"** reads as a comic hero-moment, not a match-3 sweet — the
  same beat, re-voiced into *this* mythology (the
  [authorial-voice](#authorial-voice) test: every beat should feel like it
  belongs to this game).
- **The apex *is the brand.*** The rarest rung lands on the game's own
  word — **LEGENDARY!** — so the biggest synergy a player ever pulls says
  the title of the game back to them. That is the tightest single line of
  narrative-mechanical alignment in the whole feel layer.

**The default heroic ladder** (a naming proposal; the tier boundaries are
the locked [Combo Tier Contract](visual-effects.md#combo-tier-contract),
not this page's to move):

| Chain (`lastPlayEffectsFired`) | Call-out | The beat it names |
|---|---|---|
| `1` | **Combo!** | your play connected |
| `2` | **Team-Up!** | two heroes clicked — the core Marvel fantasy |
| `3–4` | **Unstoppable!** | you built a real engine |
| `>= 5` | **LEGENDARY!** | the rare, celebrated crescendo — the brand word (the locked apex tier, D-24246) |

![Animated mock of the synergy call-out ladder: the words Combo!, then Team-Up!, then Unstoppable!, then a gold glowing LEGENDARY! each pop on-screen in turn as a hero-ability chain grows, then the sequence loops.](/narrative-psychology/synergy-callout-ladder.svg "width=62%")

*Illustrative proposal mock of the heroic ladder escalating with the chain — a
CSS-only animated SVG (no JavaScript, so it animates on the JS-free wiki) that
loops and holds the apex **LEGENDARY!** as a static frame under
`prefers-reduced-motion`. The word is the proposal; the tier boundaries are the
locked [Combo Tier Contract](visual-effects.md#combo-tier-contract). In the game
the word rides the same `lastPlayEffectsFired` scalar as the
[combo flash](visual-effects.md#synergy-callout) and peaks with it. Animation
source: [synergy-callout.py](../ewiki/narrative-psychology/synergy-callout.py) —
regenerate with `python synergy-callout.py`.*

The words are a first proposal — the concrete copy artifact this hook owes,
exactly like the [per-event narrative copy](#decisions-pending). Alternates
in the same register: *Synergy!, Rally!, Blitz!, Rampage!, Crescendo!*
Whatever the final set, it takes the same [IP pass](#ip-boundary-mandatory)
as all narrative copy — generic superlatives are fine; a trademarked team
or character name as a label word is not. The apex **LEGENDARY!** rung is
**now locked** as the fourth shared combo tier (`>= 5`), decided on the
[Visual Effects side](visual-effects.md#synergy-callout) via **WP-425 / D-24246**
so the label and a matching sting share the one boundary — never a label-only
threshold. WP-425 shipped the **audio** sting; this on-screen `LEGENDARY!`
label is the future visual consumer of the same locked tier.

#### Faction battle cries — the team's own call-out {#faction-cries}

The generic ladder names the *size* of a chain. A **faction battle cry**
names *who did it*: when the synergy fires while the player is acting a
recognizable hero or team, the call-out becomes that faction's signature
shout instead of the generic word. A three-effect Avengers chain doesn't
read **Unstoppable!** — it reads **AVENGERS ASSEMBLE!** This is the
Archetype and Nostalgia [meaning hooks](#the-four-meaning-hooks) compressed
into a single word: the deepest inherited investment a Marvel fan carries,
fired at the exact moment they earned it. It is also the sharpest possible
answer to the [authorial-voice](#authorial-voice) test — nobody mistakes
"Flame On!" for a generic arena game.

**Two axes, one label.** The call-out carries *magnitude* and *identity*
independently:

- **Magnitude** — the combo tier (`comboTierForCount`) — drives the
  *presentation*: how big the flash, how loud the sting, whether it earns
  the apex full-screen treatment.
- **Identity** — the **acting card's team / hero** — drives the *words*.
  The client already holds this: it is the same acting-entity identity the
  [team leitmotif](music-authoring.md#team-keys) reads to pick a motif, so
  a battle cry is the **spoken-word twin of the team motif** — no new
  engine signal.

So a big Avengers chain splashes **AVENGERS ASSEMBLE!** at apex intensity;
a small one pops **Avengers Assemble!** modestly — same words, tier-scaled.
Identity and magnitude are orthogonal, so a cry rides **whatever tier
fires**, from `small` up to the locked apex — the cries are gated on IP
below, **not** on the combo-tier count.

**Precedence** (most specific wins; the ladder guarantees it is never
silent):

1. **Character cry** — the acting hero has a signature line of their own.
2. **Team cry** — the acting card's team has one.
3. **Generic ladder** — the [Combo! / Team-Up! / Unstoppable! / LEGENDARY!](#synergy-callouts)
   fallback for any card whose team/hero has no signature cry yet.

The seed set — the most universally recognizable Marvel cries:

| Faction / hero | Battle cry | Granularity |
|---|---|---|
| Avengers | **Avengers Assemble!** | team |
| X-Men | **To me, my X-Men!** | team |
| Thing (Fantastic Four) | **It's Clobberin' Time!** | character |
| Human Torch | **Flame On!** | character |
| Hulk | **Hulk Smash!** | character |
| Spider-Man | **With great power comes great responsibility** | character |
| Thor | **For Asgard!** | character |
| Namor | **Imperius Rex!** | character |
| Luke Cage | **Sweet Christmas!** | character |

The map is **extensible and sparse**: teams and heroes without a cry fall
through to the generic ladder, so coverage grows one entry at a time
without gaps. (Spider-Man's line is a full sentence, not a two-word shout —
at the `small`/`medium` tiers it likely needs a shortened on-screen form; a
display-fit call flagged in [Decisions Pending](#decisions-pending).)

> **These cries are licensing-gated — this *is* the IP pass, not a
> footnote.** Unlike the generic ladder (original superlatives), the battle
> cries are **verbatim, famous, and several are registered Marvel
> trademarks** ("Avengers Assemble," "It's Clobberin' Time," "Flame On,"
> and "Hulk Smash" among them). They are the single highest-scrutiny copy
> in the entire feel layer. Legendary Arena is a **licensed** Marvel
> product (royalties to Marvel and Upper Deck), so the cries live inside
> the same license as the characters themselves — but *catchphrase* usage
> in on-screen text/VO can be scoped separately from card-likeness rights,
> so the seed set ships **only after the Marvel / Upper Deck license scope
> is confirmed to cover it.** That confirmation is exactly the
> [IP / licensing pass](#ip-boundary-mandatory) this page already mandates
> for character-leaning copy. It also *tensions the current wording* of
> that boundary (which forbids lifting "dialogue verbatim"): reconciling
> "don't fabricate or lift lore into original copy" with "use the licensed
> characters' own signature cries, within license" is recorded as **D-24259**
> — the reconciliation framework plus the licensing gate. The locked boundary
> *text* is amended on ratification of that entry (its exact proposed wording
> lives in D-24259), **not** here — and no cry ships until the licensing
> confirmation clears.

#### The announcer — an original "Arena" voice, not a borrowed one {#arena-announcer}

*Candy Crush*'s call-outs are inseparable from **Mr. Toffee's** voice: the
label and the vocal are one recognizable brand asset. The equivalent here
is a house **Arena Announcer** — an original esports-caster / comic-splash
narrator persona that voices the ladder (**"Combo!" … "Team-Up!" …
"LEGENDARY!"**). Two hard constraints:

- **Original, not an impression.** The announcer is *not* a Marvel
  character and never imitates one — no character voice, catchphrase, or
  name. It is the arena's own host, which keeps it clear of the
  [IP boundary](#ip-boundary-mandatory) and lets it become *our*
  recognizable asset (the [Soul / Authorial Voice](#authorial-voice) test:
  a signature a player learns to recognize as *this* game).
- **v1 is the on-screen word; the voice is an enhancement.** The text
  call-out is buildable today on the live combo scalar (it rides the
  shipped [`useComboCue`](visual-effects.md#combo-signal) pattern). A
  *voiced* announcer is an added audio layer on
  [Sound Effects](sound-effects.md#tiered-combo) — recorded VO or a
  synthesized voice, layered over (or in place of) the existing
  `combo-small/medium/big` stings — and can follow later without blocking
  the label.

Under the [Playstyle lens](#playstyle-modes) the ladder and the announcer
re-theme with everything else: the **destroyer** skin swaps the heroic
ladder for a conquest one (e.g. *Strike! → Havoc! → Domination! →
CATACLYSM!*) in a harsher announcer register — same locked tiers, same
scalar, pure re-skin. That variant is **Tier 3 / out of v1 scope**, like
the rest of the lens.

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
  two frameworks reinforce the one moment. Its
  [flow-channel map](dopamine-triggers.md#flow-channel) ties each story beat
  to a challenge/skill state.
- **[Music Authoring](music-authoring.md).** The leitmotif grammar is a
  narrative device as much as an audio one — team-keyed motifs are the
  nostalgia and identity hook made audible.
- **[Visual Effects](visual-effects.md).** Owns the mechanics of the
  builder/destroyer re-theme and of the
  [synergy call-out](visual-effects.md#synergy-callout) render (the label
  keyed to the locked combo tier); this page owns their narrative rationale
  and the [naming ladder](#synergy-callouts).
- **[Sound Effects](sound-effects.md).** The audio twin of the call-out:
  the escalating [combo cue](sound-effects.md#tiered-combo) is the sting
  the label rides, and the voiced [Arena Announcer](#arena-announcer) — the
  *Candy Crush* Mr.-Toffee analog — would layer on that page's audio
  engine.
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
- **Synergy call-out wording** ([synergy call-outs](#synergy-callouts)) —
  lock the heroic ladder (the **Combo! / Team-Up! / Unstoppable!**
  proposal, or an alternate), and decide whether the label starts at the
  `small` tier or holds until `medium` for restraint (the *flash* fires at
  `small` either way — a [Visual Effects](visual-effects.md#synergy-callout)
  cross-decision). The apex **LEGENDARY!** rung is **no longer open** — it
  landed as the locked fourth shared combo tier (WP-425 / D-24246); only the
  three-lower-tier *wording* remains a copy call.
- **Faction battle cries — licensing gate** ([faction cries](#faction-cries)) —
  the seed set (**Avengers Assemble!**, **Hulk Smash!**, …) is verbatim,
  trademark-heavy Marvel copy. It ships **only after** the Marvel / Upper
  Deck license scope is confirmed to cover on-screen catchphrase use, and it
  tensions the current [IP boundary](#ip-boundary-mandatory) wording (which
  forbids lifting dialogue verbatim). The reconciliation framework + gate is
  recorded as **D-24259**; the boundary text is amended only on ratification.
- **Arena Announcer — voiced in v1, or text-first?**
  ([the announcer](#arena-announcer)) The on-screen word ships without it;
  a voiced call-out is an [audio-layer](sound-effects.md#tiered-combo)
  enhancement. Decide recorded VO vs a synthesized voice — either way an
  **original** persona, never a Marvel-character impression (IP pass).
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
- **Destroyer-lens call-out variant** — the villain-themed synergy ladder
  and announcer register (e.g. *Strike! → Havoc! → CATACLYSM!*) is part of
  the [Playstyle lens](#playstyle-modes) re-skin; Tier 3, v1 ships the
  single heroic ladder.
- **Voiced Arena Announcer** — the recorded/synthesized
  [announcer VO](#arena-announcer) is a follow-on audio layer; v1 is the
  on-screen word riding the shipped combo scalar.

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
