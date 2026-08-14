---
title: Design System Overview
type: Guide
tags:
  - design-system
  - visual
  - audio
  - psychology
  - reward
  - pacing
  - narrative
  - archetype
  - playstyle
  - juice
  - arena-client
  - research
related:
  - visual-effects.md
  - sound-effects.md
  - music-authoring.md
  - gameplay-strategy.md
  - par-simulation-calibration.md
  - master-strike.md
  - turn-system.md
  - villain-deck.md
  - vision.md
  - monetization-model.md
  - play-board.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\design-system-overview.md (this page — https://ewiki.legendary-arena.com/design-system-overview/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
  - Design session 2026-08-13 — the "powerless to protector" north star, the "power reveals character" pillar, the card-counting / anticipation coaching layer, and the seven-reward-driver model (competence / agency / identity + prediction-error and investment lenses); consolidation of the reward-psychology and narrative-meaning references into this hub
last-reviewed: 2026-08-13
---

# Design System Overview

## The heart — powerless to protector {#the-heart}

Before any mechanic or metric, the feeling. Legendary Arena's feel layer
exists to deliver one arc: **the scrawny kid with a big heart who couldn't
protect his friends, gets the strength, and becomes the protector.** Steve
Rogers before and after the serum — the underdog who rises and shields the
people he loves from the bullies. Every cascade, every tension spike, every
combo crescendo the sensory layers play is in service of that single
transformation: *powerless to heroic, and the purpose of protecting others.*

That makes the heart this hub's **design filter.** Before tuning a knob or
adding an effect, ask: *does this serve the scrawny-kid-to-hero feeling, or is
it just noise?* If it doesn't move a player closer to feeling the
transformation, it doesn't belong — however much dopamine it would technically
produce. This is the felt core the [Vision](vision.md)'s *good-versus-evil
power fantasy / heroic momentum* names (VISION §The Fantasy, D-24235); the
[reward psychology](#reward-psychology) below is how the feel layer delivers it.

**The second pillar — power reveals character; it does not create it.** The
same serum, the same fame, the same strength hand two different hearts two
different destinies: do you use the power to dominate, or to protect? Legendary
Arena maps that fork onto real mechanics rather than leaving it as theme — the
home-run hitter versus the team player, conquest versus rescue. That is the
[builder / destroyer lens](#playstyle-modes): the identical trigger spine,
re-coloured by which heart the player brings to it. The feel layer serves
*both* — the point is that the game reveals the choice, and celebrates
whichever one the player authors.

**Reward creates intensity; meaning creates memory.** Reward alone makes a
moment *exciting* — but not *remembered*. The moments a player carries for years
are the ones where reward and meaning arrive **together**: defeating a Mastermind
is *satisfying* because it is a victory, and *memorable* because it completes the
journey from powerless to protector. Dopamine provides the energy;
[narrative](#narrative-meaning) provides the significance. That is the division of
labour across the feel layer — the [reward psychology](#reward-psychology) makes a
moment *land*, the [narrative meaning](#narrative-meaning) makes it *matter* — and
it is why [identity](#identity) sits among the reward drivers below: identity is
the seam where the two meet.

## Summary

This page is the **north star** for the sensory-and-feel layer of
`play.legendary-arena.com` — the umbrella that ties together how the game
*feels* to play: what you see (juice), what you hear (audio), why it's
satisfying (reward psychology), and what it *means* (narrative). It exists
to answer one organizing question Jeff raised: **how do these framework
docs stay interconnected instead of siloing into a pile of pages nobody
cross-references?**

The answer is a **shared trigger spine**. Every treatment — visual, audio,
reward-pacing, narrative — reacts to the *same* small vocabulary of engine
events the client already receives (a Master Strike resolved, a villain
defeated, a synergy chain fired). Because they all hang off that one
vocabulary, the cross-links write themselves: a Master Strike firing a red
screen-shake, a dramatic sting, a dopamine "threat" spike, and a
good-versus-evil story beat are four reactions to the *one*
`mastermindStrikeResolved` event. Kill the silo at the vocabulary, not with a
table of contents.

**The feel layer is now two implementation pages plus this hub.** There are
exactly two things a Work Packet builds — the [Visual Effects](visual-effects.md)
layer and the [Sound Effects](sound-effects.md) layer — and this hub is the
**shared contract they both implement**: the reward classification, the pacing
invariants, the narrative framing rules, the [visual–audio pairing
table](#visual-audio-pairing), and the [reward-psychology](#reward-psychology)
and [narrative-meaning](#narrative-meaning) references that explain *why* the
cues are timed and coloured the way they are. The dopamine and narrative
frameworks were never their own code layer — they are pacing and framing
contracts on the two sensory layers — so they live here, at the shared root,
rather than as separate pages the sensory layers had to chase.

No feel-layer code ships today beyond the shipped audio foundation and combo
cue — this is `draft` research. Only the event vocabulary, the projected
`UIState` signals, and the architectural boundaries are sourced to code; the
treatments and psychology are proposals.

**How to read this page.** The [heart](#the-heart) above and the
[Soul / Authorial Voice](#soul-authorial-voice) principle are the *lens* over
the whole feel layer — the point of view that keeps it authored rather than
competent-but-generic. The [Feel-Layer Contract](#feel-layer-contract) is the
**invariant both sensory layers inherit** — the input-surface boundary, the
reward classification, the pacing and framing MUSTs. The [shared trigger
spine](#shared-trigger-spine) is the **canonical event vocabulary**; the
[visual–audio pairing table](#visual-audio-pairing) is the joint per-event
signature both layers implement. The two reference appendices —
[Reward psychology](#reward-psychology) and [Narrative meaning](#narrative-meaning)
— are the deep "why," and [Decisions Pending](#decisions-pending) /
[Deferred](#deferred) are the roadmap.

## Soul / Authorial Voice (Feel-Layer Principle) {#soul-authorial-voice}

The feel layer must communicate a clear creative point of view. Competent
juice, audio, dopamine timing, and narrative beats are **not enough** — the
layer should feel *authored*, not merely competent. This principle sits
*above* the sensory layers: they answer "what do we show, play, reward, and
mean at each event?"; this answers the question one level up — **what makes
the whole feel layer feel alive and authored rather than a polished but
interchangeable pile of reactions?**

It is a **principle, not a hard invariant** — the [Feel-Layer
Contract](#feel-layer-contract) below owns the immovable MUST-NOTs. This is
the taste filter the treatments are read against. A treatment passes when it
can answer "yes" to these tests, not merely "is this competent?":

- **Distinctive identity** — the visual + audio signature is not
  interchangeable with any other arena game; a player should be able to
  recognize a Master Strike by its sound alone.
- **Personality** — heroes, factions, and arenas carry character (animation
  quirks, motif, environmental storytelling), not neutral stat-block polish.
- **Visible care in "unnecessary" details** — small flourishes, reactive
  atmosphere, and satisfying idiosyncratic feedback that move neither balance
  nor retention, and are there because someone cared.
- **A single strong fantasy** — one bright-line good-versus-evil Marvel
  fantasy the team is willing to lean into, rather than sanding every edge
  for maximum broad appeal.
- **Friction and character in the moment-to-moment feel** — not pure
  frictionless smoothness; the texture is part of the identity.

This is the filter that keeps the [shared trigger
spine](#shared-trigger-spine) from producing a generic "screen-shake +
sting + reward spike" reaction at every row.

### Authorial voice, applied to narrative {#authorial-voice}

The [narrative meaning](#narrative-meaning) reference below inherits this
principle directly. Accuracy and voice are *both* required: a beat that is
accurate (rides true `UIState`, per the [framing invariants](#framing-invariants))
but generic (interchangeable with any other arena game's copy) satisfies the
governance layer yet fails this filter. Accuracy is the floor; voice is the
ceiling. The narrative-specific tests:

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

## Feel-Layer Contract

This section is the **immovable governance layer** shared by both sensory
layers (visual, audio). Each page also carries its own page-specific contract;
this is the one they both inherit. It does not change without a `DECISIONS.md`
entry.

### The Feel-Layer Invariant

Every feel-layer treatment is a **pure client-side reaction to projected
`UIState`.** This single rule is what makes the layers composable — they all
speak the same input language, so they react to the same moment independently
and in sync, and none can ever disagree with the engine about what happened.

### Allowed input surfaces

The only signals any feel-layer treatment may read — all already projected:

- `UIState.notableEvents` — the six locked event variants.
- `UIState.game.lastPlayEffectsFired` — the combo chain count (D-24221).
- **Local move dispatch** — the client's own moves (`playCard`,
  `recruitHero`, `fightVillain`, `drawCards`, `dodgeCard`, `endTurn`).
- `UIState` outcome / progress fields — `EndgameOutcome`,
  `progress.escapedVillains`, `scheme.twistCount`, `players[].woundCount`.

### Forbidden input surfaces

- `G` / `ctx` — engine-internal state is never read.
- `G.messages` — the game log is **not** projected (D-20008); anything
  built on it works in the engine and silently does nothing in the browser.
- **Any server round-trip** — the feel layer derives entirely from
  already-projected `UIState`.

> **Projection has two gates, not one.** "Already projected" means a
> field survived *both* `buildUIState` **and** the
> `filterUIStateForAudience` audience whitelist — the filter rebuilds the
> shared-board objects field-by-field and silently drops any new
> **optional** field it wasn't taught to copy (no TypeScript catch). A
> signal `buildUIState` emits is not usable here until the filter passes it
> through. See [Play Board → the projection→render contract](play-board.md#edge-cases).

### Reward classification (locked vocabulary) {#reward-classification}

Every spine event resolves to one of four classes; both sensory layers must
treat them consistently:

| Class | Spine events | Cue posture |
|---|---|---|
| **Reward** | `fightResolved`, `mastermindDefeated`, `healResolved`, a combo (`lastPlayEffectsFired >= 1`) | Celebrate — the positive payoff |
| **Threat** | `mastermindStrikeResolved`, `schemeTwistResolved`, `ambushResolved`, rising `escapedVillains` / `scheme.twistCount` | Menace — **never** a positive cue |
| **Relief** | a Master Strike survived without disaster, a City threat cleared (`fightResolved`), `healResolved` | The exhale after tension |
| **Resolution** | `heroes-win` / `scheme-wins` / `tie` | The peak-end finale — weighted heaviest |

### Pacing invariants (MUST) {#pacing-invariants}

- **Contrast through restraint** — the big treatments are reserved for
  peaks; routine actions stay subtle.
- **Anticipation before payoff** — a micro-beat of build-up precedes the
  resolution cue.
- **One crescendo per resolved move** — simultaneous events merge or
  sequence into a single crescendo, never a collision.
- **Reward the skill, not the luck** — the escalating-combo payoff is
  attributed to the player's deck-building, not to randomness.
- **Player authorship over randomness** — the sharpened form of the line above:
  the strongest rewards must originate from the player's decisions, preparation,
  construction, and timing, so the felt attribution is "**I** authored this
  outcome" more often than "the game produced it." The sensory peak follows an
  *authored* moment. (A clarification of the existing skill-not-luck invariant,
  not a new constraint — it names why [competence](#competence) and
  [agency](#agency) sit among the reward drivers.)

### Framing invariants (MUST) {#framing-invariants}

The [narrative meaning](#narrative-meaning) layer is a **framing contract** —
copy, palette accent, and motif identity — expressed *through* the two sensory
layers. It reads the acting-entity identity and the outcome the client already
holds; it renders nothing of its own and adds zero engine footprint.

- **Framing rides on true `UIState`.** Every narrated beat maps to the real
  engine outcome — never narrate a rescue that didn't happen, never soften a
  loss into a win. The engine's truth is the ground the story sits on.
- **The beat mapping is fixed to the outcome, not the theme.** The
  [story-beat mapping](#beat-mapping) binds each spine event to its canonical
  beat; the [builder/destroyer lens](#playstyle-modes) re-colours the
  *telling*, never *which event happened*.
- **The Playstyle lens is presentation only.** It must never alter the real
  `EndgameOutcome` — a "destroyer victory" narrative still maps to the
  engine's actual result.

### IP boundary (mandatory) {#ip-boundary-mandatory}

Marvel characters and lore are **licensed IP.** Narrative copy is original
and evocative; it never lifts published bios, dialogue, or lore verbatim.
Copy leaning on specific characters gets an IP / licensing pass before
shipping. The one deliberate exception — the [faction battle
cries](visual-effects.md#faction-cries), which *are* verbatim, trademark-heavy
catchphrases — is licensing-gated and ships only after the Marvel / Upper Deck
license scope is confirmed to cover on-screen catchphrase use (D-24259).

### Non-Goals — no feel-layer treatment may

- write `G` / `ctx` or modify game state;
- participate in move validation, or add authoritative timing / sequencing
  the engine doesn't already own;
- affect replay or determinism (the whole layer is absent from the state
  hash);
- require server-side processing;
- fire a positive cue when the menace rises (threat is tension, not reward);
- change the engine, the events, the outcomes, or the rules via the narrative
  lens (it is pure presentation);
- reproduce copyrighted Marvel text or art outside the licensing-gated
  [faction cries](visual-effects.md#faction-cries);
- gate play, pressure spend, manufacture scarcity, or build a compulsion loop
  — the [Vision](vision.md) bright lines ([Monetization Model](monetization-model.md))
  bound the whole layer, which is a retention / perceived-quality lever, free
  to all players;
- reach for **false dopamine** — engagement without mastery. Making the
  compulsion-loop line concrete, the framework MUST NOT use loot-box
  anticipation, artificial scarcity, reward timers, forced re-engagement,
  login-streak anxiety, or near-miss manipulation *disconnected from player
  skill* (a legitimate near miss ties to a board state the player can improve;
  a rigged tease does not — see [Variable ratio](#variable-ratio)). These
  manufacture compulsion; this framework rewards competence, agency, identity,
  and relief instead.

The reward loop lives entirely inside the **free game.**

### The shared trigger spine is canonical

The [trigger spine](#shared-trigger-spine) below is the **single source** of
the event vocabulary. The sensory pages reference a row by its engine name
(`fightResolved`); they never re-define the vocabulary. This is the
anti-silo mechanism itself — the cross-links *are* the shared event names.

## Mechanics

### The design principle: react to the engine, not to each other

Per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth
and the UI consumes **read-only projections**. Every feel-layer treatment
is therefore a *pure client-side reaction* to `UIState`: it reads what the
engine already decided, and renders/plays/frames a response. None of them
write `G`, influence an outcome, or add any engine or determinism
footprint. That single constraint is what makes them composable — they all
speak the same input language (`UIState`), so they can all react to the
same moment independently and in sync.

This is already proven, not theoretical: the **audio layer shipped** on
exactly this pattern — a client-only, `UIState`-reading foundation
(WP-412) and a tiered combo cue (WP-413) — with zero engine changes. The
visual layer mirrors it. The reward-pacing and narrative layers are lenses
*over* the same signals, which is why they live in this hub rather than as
separate code.

### The shared trigger spine {#shared-trigger-spine}

This is the canonical event vocabulary both sensory layers reference. It is
projected on `UIState` and reaches the browser today (unless noted). Each
sensory page maps these same rows to its own medium — this table is the
**single place** the vocabulary is defined; the pages point here rather than
re-listing it.

| Trigger (engine signal) | Client source | The moment | Visual | Audio | Dopamine | Narrative |
|---|---|---|---|---|---|---|
| `mastermindStrikeResolved` | `UIState.notableEvents` | The Mastermind strikes back | screen-shake + red vignette | dramatic stinger | **threat spike** | evil asserts itself |
| `schemeTwistResolved` | `UIState.notableEvents` | The villains' plan advances | desaturation ripple | ominous low sting | dread / rising stakes | the plot thickens |
| `ambushResolved` | `UIState.notableEvents` | A villain crashes into the City | edge-glow + card slam | menacing whoosh | surprise threat | a new foe arrives |
| `fightResolved` | `UIState.notableEvents` (+ `bystandersRescued`, `appliedEffects`) | You defeat a villain / free a bystander | impact burst + coin flourish | triumphant hit | **reward hit** | a heroic rescue |
| `mastermindDefeated` | `UIState.notableEvents` | The Mastermind is vanquished (win) | victory bloom + confetti | victory fanfare | **peak reward** | good triumphs |
| `healResolved` | `UIState.notableEvents` | You heal wounds | green shimmer | restorative chime | relief | recovery |
| `lastPlayEffectsFired` (1 / 2 / 3+) | `UIState.game.lastPlayEffectsFired` | A synergy **chain** cascades | escalating combo flash | escalating combo cue | **escalating reward** | mastery / momentum |
| `playCard` / `recruitHero` / `fightVillain` / `drawCards` / `dodgeCard` / `endTurn` | local move dispatch | Your own actions | card motion / glow | tactile clicks | agency / flow | you act on the world |
| `onTurnStart` / `onTurnEnd` | turn boundary in `UIState` | Turn hand-off | subtle sweep | soft "your turn" | anticipation | your moment |
| Endgame: `heroes-win` / `scheme-wins` / `tie` | `EndgameOutcome` | The match resolves | full-screen finale | fanfare / dirge / wry sting | **resolution** | the story ends |

**Signal readiness, in brief** (the treatments share these limits):

- **Ready today:** the six `notableEvents`, `lastPlayEffectsFired` (the
  combo chain count — the flagship "cascade" signal, D-24221), the
  local-move dispatches, and the three endgame outcomes.
- **Keyword-only precision:** `appliedEffects` tells you *what kind* of
  sub-effect fired (wound / KO / capture) but not the target or count.
- **No hook today:** villain **escape** is log-only (deferred
  `escapeResolved`, WP-186 / D-20001) — a dramatic moment none of the
  treatments can react to until that event is added.
- **Never usable:** `G.messages` (the game log) is **not** projected to
  clients (D-20008). No treatment may build on it.

### Story-beat mapping {#beat-mapping}

Every match is a compressed good-versus-evil story: the villains scheme and
strike, the heroes build strength and push back, and it resolves in triumph,
tragedy, or an uneasy draw. The [reward](#reward-psychology) threat/reward
rhythm *is* the narrative rising-and-falling action; this mapping names it.
The [flow-channel map](#flow-channel) plots that arc beat by beat. The beat is
**fixed to the outcome** ([framing invariants](#framing-invariants)); the
[builder/destroyer lens](#playstyle-modes) re-colours the telling, never which
event happened.

| Spine event | Story beat |
|---|---|
| `ambushResolved` | A new foe crashes the gates |
| `schemeTwistResolved` | The villains' plan advances — the plot thickens |
| `mastermindStrikeResolved` | Evil asserts itself — the darkest hour |
| `fightResolved` | A heroic rescue; the tide turns |
| `mastermindDefeated` | Good triumphs — the climax |
| Endgame `heroes-win` | The story's triumphant resolution |
| Endgame `scheme-wins` | Tragedy — the city falls |
| Endgame `tie` | An unresolved stand-off; both sides withdraw |

### Priority tiers {#priority-tiers}

Reward weight ranks which moments earn the biggest sensory budget; a Work
Packet times the cues in this order rather than treating every reward
equally. Both sensory layers build in this order.

**Tier 1 — Peaks** (the biggest budget):

- The endgame finale (`heroes-win` / `scheme-wins` / `tie`) — peak-end
- A Mastermind vanquished (`mastermindDefeated`)
- A 3+ synergy chain (`lastPlayEffectsFired >= 3`)

**Tier 2 — Standard rewards & reliefs**:

- `fightResolved` (with the bystander flourish when one is freed)
- 1–2 combo chains
- `healResolved`

**Tier 3 — Ambient & tension pacing**:

- Rising-menace ambient treatment (`escapedVillains` / `scheme.twistCount`)
- Difficulty ↔ reward coupling (a clutch win near the escape cap feels
  bigger)

### Visual–audio pairing {#visual-audio-pairing}

The core rule holds: **visual and audio must peak together on the same spine
event.** A flash without its sting (or a sting without its flash) weakens the
dopamine beat and breaks the sense of one authored moment. This is the concrete
pairing artifact — the per-event sensory signature both the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers implement.

Pairing principles:

1. **Same trigger, same timing** — both layers react to the identical
   `UIState` event and peak within ~50–100 ms of each other.
2. **Intensity matching** — high-dopamine or high-threat moments get higher
   visual amplitude *and* higher audio intensity; low moments stay restrained.
3. **Narrative colouring** — the same mechanical event can shift palette,
   particle behaviour, and motif by the [Playstyle lens](#playstyle-modes)
   (builder vs destroyer) and the acting entity.
4. **Escalation language** — combo tiers, Mastermind Tactics, and the endgame
   reuse one consistent visual–audio grammar so the player learns to read it.
5. **Reduced-motion / intensity preference** — both layers degrade cleanly
   together (visuals simplify; audio drops to essential stingers only).

| Spine event / moment | Visual treatment | Audio treatment | Combined dopamine intent | Intensity |
|---|---|---|---|---|
| `playCard` (ordinary) | Subtle card glow + small motion | Soft tactile click | Micro-agency | Low |
| `lastPlayEffectsFired` tier 1 | Small escalating flash | Short rising cue | First synergy hit | Medium |
| `lastPlayEffectsFired` tier 2–3+ | Stronger chain flashes + particles | Escalating combo cue (rising pitch/intensity) | Variable-ratio peak | High |
| `recruitHero` (desired card) | Satisfying scale-up + HQ slot glow | Warm positive chime | Progress reward | Medium |
| `fightResolved` (City Villain) | Impact burst + coin / VP flourish | Triumphant short hit | Standard reward | Medium |
| `fightResolved` (Mastermind Tactic) | Heavier impact + distinct Tactic flash | Stronger triumphant hit + motif accent | High-stakes reward | High |
| `mastermindDefeated` | Full-screen victory bloom + confetti / light | Full victory fanfare | Peak reward + closure | Very High |
| `mastermindStrikeResolved` | Red screen-shake + vignette | Dramatic low stinger | Threat spike | High |
| `schemeTwistResolved` | Desaturation ripple or dark pulse | Ominous low sting | Rising stakes / dread | High |
| `ambushResolved` | Edge glow + card slam | Menacing whoosh | Surprise threat | Medium–High |
| `healResolved` | Soft green shimmer | Restorative chime | Relief / recovery | Medium |
| Endgame `heroes-win` | Full-screen finale (bright) | Victory fanfare | Peak + meaning | Very High |
| Endgame `scheme-wins` | Full-screen finale (dark / cracked) | Dirge or unresolved sting | Punishment / tragedy | High |
| Endgame `tie` | Muted, balanced finale | Wry or unresolved sting | Ambiguous closure | Medium |

**Escalation grammar** (so the language stays consistent):

- **Combo tiers** share one visual family (flashes) and one audio family
  (rising cue), so tier 1 → tier 3 reads as a single continuous escalation.
- **Mastermind Tactics** share DNA with ordinary `fightResolved` but are
  clearly "heavier" (bigger particles, a lower + stronger hit, an optional
  motif overlay).
- **Threat events** (Strike, Twist, Ambush) share a dark/ominous palette and
  low-frequency audio so the player instantly reads "danger."
- **Relief / healing** uses the opposite language (cool / green, higher,
  softer).

**Playstyle colouring.** When the builder/destroyer [lens](#playstyle-modes)
is active, only the *skin* changes — the timing and intensity skeleton stays
identical: **builder** (brighter palette, cleaner particles, heroic musical
accents on reward events); **destroyer** (darker/harsher palette and impacts,
motifs that celebrate conquest on the same mechanical events).

**Implementation notes.** Author the visual and audio peaks to land on the
same frame (or within one) of the spine event becoming visible; scale both
under a single global **Effect Intensity** preference so amplitude and
volume/complexity move together; and in reduced-motion mode suppress big
screen-shakes, heavy particles, and long blooms while keeping the essential
audio stingers (or a minimal visual pulse). Audition the **audio treatment**
column against the authoritative
[Sound Effects → Audio previews](sound-effects.md#audio-previews).

### The two sensory layers + this hub {#planned-pages}

Two pages are built; this hub is the contract they both implement.

1. **[Visual Effects Framework](visual-effects.md)** — *drafted.* The
   "juice": escalating combo flashes, particle bursts, screen-shake, card
   motion, and full-screen finales. Its flagship is the chain-reaction
   combo flash off `lastPlayEffectsFired` — buildable today, mirroring the
   shipped audio combo cue. It also owns the on-screen
   [synergy call-out](visual-effects.md#synergy-callout) ladder and the
   [faction battle cries](visual-effects.md#faction-cries) render.
2. **[Sound Effects](sound-effects.md)** — *drafted, foundation shipped.*
   The audio twin: discrete event cues, an adaptive danger-meter score, the
   shipped tiered combo cue, and the voiced
   [Arena Announcer](sound-effects.md#arena-announcer). Companion:
   [Music Authoring](music-authoring.md) (the composed-motif / leitmotif
   grammar).

The **reward psychology** (why the loop is satisfying) and the **narrative
meaning** (what it means) are not separate pages — they are the
[reward-psychology](#reward-psychology) and [narrative-meaning](#narrative-meaning)
references in this hub, which both sensory layers read.

### How the cross-links stay healthy

The anti-silo mechanism, stated plainly:

- **One vocabulary, defined once.** The [shared trigger spine](#shared-trigger-spine)
  lives here and nowhere else. The sensory pages reference a row by its
  engine name (`fightResolved`), so a reader on the Visual page can jump to
  the same row's Audio or Narrative treatment.
- **Twin moments cite each other.** A combo *flash* (Visual) and a combo
  *cue* (Audio) both fire off the one `lastPlayEffectsFired` change and are
  written to peak together — each page links the other at that row, and both
  consume the one [pairing table](#visual-audio-pairing).
- **The engine is the source of truth for "what happened."** Because every
  treatment reads the same `UIState`, they can never disagree about whether
  a Master Strike occurred — only about how to dramatize it. That shared
  ground truth is the cross-reference.

## Interactions

- **[Visual Effects Framework](visual-effects.md)** and
  **[Sound Effects](sound-effects.md)** — the two sensory frameworks; they
  must stay in lockstep at each spine row (a flash and its sting peak
  together), both implementing this hub's contract.
- **[Music Authoring](music-authoring.md)** — the composed-motif layer that
  colours audio (and, via team key, harmonizes combo flourishes) by *who*
  is acting; the nostalgia/identity hook made audible.
- **[Gameplay Strategy](gameplay-strategy.md)** — the skill model behind the
  reward psychology: "reward the skill, not the luck" means the escalating
  payoff is earned by that page's Rank-0 construction and Rank-1 play order,
  and its [coaching layers](gameplay-strategy.md#coaching-layers) are the
  reward side of the [card-counting / anticipation](#card-counting) layer.
- **[PAR Simulation Calibration](par-simulation-calibration.md)** — the
  machine performance of the same decisions the [card-counting](#card-counting)
  layer coaches against.
- **[Master Strike](master-strike.md)** and **[Villain Deck](villain-deck.md)**
  — the engine subsystems that emit most of the spine's triggers.
- **[Vision](vision.md)** and **[Monetization Model](monetization-model.md)**
  — the guardrails: the feel layer is a retention / perceived-quality lever,
  never a revenue gate and never a pay-to-win or dark-pattern surface. Polish
  is free to all players. Vision §The Fantasy (D-24235) is the source of the
  [powerless-to-protector heart](#the-heart).

## Edge Cases

- **The spine is a client-side reaction surface, not an engine contract.**
  Nothing here changes the engine; every treatment is pure
  `UIState`-reading presentation. If a treatment ever needs the engine to
  emit something new (e.g. `escapeResolved`), that is an engine WP with its
  own `DECISIONS.md` entry — not a change to this page.
- **The three sensory-expansion senses are out of browser scope.** Smell
  and taste (essential-oil / snack pairings) and physical haptics were
  raised in design discussion and are correctly **deferred** — they belong
  to the physical STEM-kit / diorama product
  ([Legendary Forge](legendary-forge.md)), not to the web feel layer. This
  overview scopes only what a browser can deliver: visual, audio, and (where
  a device supports it) light haptic feedback.
- **Peaks need valleys.** The peak-end and contrast mechanisms *depend* on
  the early/routine game being under-stated. Over-juicing the whole match
  flattens the very peaks the feel layer exists to create — a content-tuning
  constraint, not just a code one.
- **Peak-end is strongest for a bounded match.** The rule holds most cleanly
  for a single, discrete match with a clear start and end; across many
  sessions, remembered satisfaction is also carried by narrative meaning and
  skill attribution, not the finale alone. Season-end and Pass milestones act
  as *secondary* ends — the same restraint applies, though their pacing
  belongs to the Pass spec, not this contract.
- **The Playstyle lens is presentation only.** The builder/destroyer toggle
  re-frames copy, palette, and which beats are celebrated — it must never
  change the engine, the events, the rules, or the outcome. A destroyer
  "winning" narrative still maps to the engine's real `EndgameOutcome`.
- **Don't let framing lie about the game state.** Narrative colour rides on
  top of the true `UIState` — never narrate a rescue that didn't happen or
  soften a loss into a win.
- **Keep psychology inside the bright lines.** The reward psychology
  documents *why the game is fun*, not *how to make it compulsive*. Any
  mechanic that would gate play, pressure spend, or exploit a compulsion
  loop is out of scope by [Vision](vision.md) rule — flag it there, don't
  encode it here.

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six `NotableGameEventType` variants that make up most of the spine
  (each carries a `narrative` field the framing builds on)
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the `UIState` contract every treatment reads (`notableEvents`,
  `game.lastPlayEffectsFired`, `progress`, `scheme`, `players`)
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo chain count's origin (`lastPlayEffectsFired`)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome` (the three finales), `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections; the constraint that makes the treatments
  composable

## Acceptance Criteria

The feel layer is coherent as a system — across both sensory layers and this
shared contract — when:

- Every treatment references the [shared trigger spine](#shared-trigger-spine)
  by engine event name and defines no competing vocabulary of its own.
- No treatment reads a [forbidden input surface](#forbidden-input-surfaces).
- Twin moments share one mapping — a combo *flash* and combo *cue* both
  consume the same `comboTierForCount` and peak together (the
  [pairing table](#visual-audio-pairing)).
- Routine actions stay subtle; the [Tier-1 peaks](#priority-tiers) get the
  largest treatment; the endgame (peak-end) is heaviest.
- **No** positive cue fires on a threat-class event or on rising menace.
- Every narrated beat maps to the real engine outcome (the
  [framing invariants](#framing-invariants)); narrative copy is original and
  IP-cleared.
- With the whole feel layer mounted, bot-vs-bot determinism proofs and
  replays pass unchanged (the layer is absent from the state hash).
- The whole layer respects the reduced-motion / intensity preference and
  degrades cleanly to nothing when disabled.
- Nothing in the layer gates play or pressures spend.

## Decisions Pending

Open choices a Work Packet must resolve:

- **No implementation Work Packet is scoped yet.** The build would follow
  the audio arc's WP pattern (foundation → combo cue → event coverage),
  mirrored for the visual layer.
- **Effect-priority table** — turn the qualitative intensity bands of the
  [visual–audio pairing table](#visual-audio-pairing) into the exact numeric
  per-event weights a WP consumes (spine events only; meta / Pass moments are
  out of scope).
- **Build-up timing per tier** — how long the anticipation micro-beat is
  before a combo / reveal payoff (needs playtesting).
- **Simultaneous-event sequencing rule** — the merge/sequence algorithm for
  the "one crescendo per resolved move" invariant, shared by both layers.
- **Preference surface** — the reduced-motion / effect-intensity control and
  the builder/destroyer narrative-lens toggle both live in player
  preferences; decide whether that's one settings panel or split across the
  sensory frameworks.
- **Playstyle Modes: section or standalone?** Documented here as a lens; if
  it grows distinct progression / cosmetics / a full villain campaign, it
  graduates to a standalone **Playstyle Modes** page.
- **Per-event narrative copy** — a heroic-lens and a destroyer-lens copy line
  per spine event, keyed by acting entity where identity is known.

## Deferred

Out of scope for the browser feel layer / v1:

- **Sensory-expansion appendix** — the deferred smell / taste / haptic ideas
  belong to the physical STEM-kit / diorama product
  ([Legendary Forge](legendary-forge.md)).
- **Difficulty ↔ reward coupling** — modulating reward intensity by how close
  the menace counters are to the loss cap. Buildable, but a Tier-3 tuning pass.
- **The builder/destroyer lens variants themselves** — Tier 3; v1 ships a
  single default (heroic) theme.
- **Villain-escape narration / effects** — blocked on the engine emitting
  `escapeResolved` (WP-186 / D-20001); no client hook today.

## Meta / Pass moments are out of scope

Post-match celebrations — XP gains, Legendary Pass level-ups, reward claims, and
season-end recognition — are **not** governed by this spine contract. They are
meta-surface moments owned by the Legendary Pass product spec (see
[Monetization Model](monetization-model.md) → Seasonal engagement), held to the
same Non-Goals (no spend pressure, no compulsion, deterministic, skill-attributed
where applicable) but paced separately. This contract covers only the in-match
spine events the two sensory layers react to. Rule of thumb: a Pass claim must
never borrow the sensory-intensity language reserved for a Mastermind defeat or
the endgame finale.

---

## Appendix R — Reward psychology (reference) {#reward-psychology}

This is the **"why is this loop satisfying?"** reference underneath the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers. Those pages decide *what* a moment looks and sounds like; this
explains *why* a given moment lands as a reward, a threat, or a relief, and is
the rationale behind the [reward classification](#reward-classification), the
[pacing invariants](#pacing-invariants), the [priority tiers](#priority-tiers),
and the [pairing table](#visual-audio-pairing) above.

This is **engagement craft, not compulsion engineering.** Legendary Arena's
satisfaction comes from *good play being visibly rewarded* — a well-built
synergy chain, a clutch rescue, a Mastermind vanquished. Per [Vision](vision.md),
the game never gates play behind spend and is never pay-to-win; the reward loop
lives entirely inside the free game.

### The seven reward drivers {#seven-drivers}

Each driver is a *pattern* in how the spine's events arrive over time — not a
new signal. The client already has everything needed to detect them. The first
three are the **behavioural-economics** engine (what the events *do* to the
player); the next three are the **self-determination** engine (what the player
*becomes*); peak-end binds the memory. Together they are why a player bonds to
Legendary Arena, not merely why a single moment feels good.

**The set is treated as closed.** Seven is clean, teachable, and
governance-friendly; a new psychological idea should have to justify itself
*under* one of the seven (as the [prediction-error](#prediction-error) and
[investment](#investment) lenses do) rather than becoming an eighth driver. Add
a driver only when it explains a satisfaction none of the seven already
explain.

#### 1. Variable reward — the villain-deck reveal {#variable-reward}

The strongest *moment-to-moment* driver is **not knowing what comes next.**
Every villain-deck reveal ([Villain Deck](villain-deck.md)) is a sealed outcome
— a harmless card, a menacing Ambush, a Scheme Twist, or a Master Strike —
resolved from a deterministic-but-player-unknown shuffle (`ctx.random`, so it
replays identically yet feels random *to the player*). That variable-ratio shape
is the classic reason "flip the top card" is compelling.

- **Design use:** give the *reveal itself* a beat of anticipation before the
  outcome cue resolves — a brief hold, then the payoff. The
  [Turn System](turn-system.md) reveal step is the anticipation window; the
  `notableEvents` (`ambushResolved` / `schemeTwistResolved` /
  `mastermindStrikeResolved`) are the resolution.
- **Guardrail:** the variability is *in the game's own randomness*, which
  the player already accepted by sitting down — it is not a manufactured
  loot-box or a spend-gated pull.
- **Sharper account — prediction error, not randomness.** Behaviourally the hit
  is not the randomness itself but the *violation of expectation*: reward tracks
  how far the outcome **beat the forecast** the brain was already running
  (Schultz, Dayan & Montague 1997). See the
  [prediction-error lens](#prediction-error) below.

#### 2. Escalation — the synergy chain (the flagship) {#escalation}

The chain-reaction combo is a **compounding** reward: one card's effect
fires another, and another, and each step should pay off bigger than the
last. This is the dopamine engine behind the
[combo flash](visual-effects.md#combo-signal)
and the [combo cue](sound-effects.md#tiered-combo), and it rides the live
`UIState.game.lastPlayEffectsFired` count (D-24221).

| `lastPlayEffectsFired` | Reward feel | Why it lands |
|---|---|---|
| `1` | "That worked." | Baseline confirmation — the play did something |
| `2` | "Oh — it *linked*." | The surprise of a second effect firing unprompted |
| `>= 3` | "I *built* this." | Attribution of a big payoff to the player's own deck-building skill — the deepest satisfaction a deck-builder offers |

- **Design use:** the ascending visual/audio tiers must **peak together**
  and land *after* a micro-beat of build-up, so a 3-chain reads as a
  crescendo the player caused, not a random flash. The `>= 3` row is already a
  [competence](#competence) hit — the escalation and the "I engineered it"
  feeling arrive on the same event.

#### 3. Relief — discharging the menace {#relief}

Losing hurts more than winning feels good, so the villains *closing in* is a
potent negative driver that makes the eventual win sweeter — and **removing a
threat** is its own reward, distinct from any positive gain. The tension and its
discharge are one driver:

- **The tension** rides two already-projected counters climbing toward defeat:
  `UIState.progress.escapedVillains` → loss at `ESCAPE_LIMIT` (8), and
  `UIState.scheme.twistCount` → the scheme completes at its own limit
  (`schemeLoss` flips terminal). This is the emotional core of the *adaptive
  danger-meter score* on [Sound Effects](sound-effects.md) and a candidate for a
  rising *ambient* visual menace.
- **The discharge** is `fightResolved` (a villain cleared from the City),
  `healResolved` (wounds KO'd), or a Master Strike *survived* without disaster —
  the built tension, released.

- **Design use:** pair the relief cue's *character* to the tension it discharges
  — a bigger exhale after a bigger scare — and never fire a positive cue while
  the menace is still *rising* (that is threat, not reward).

#### 4. Competence — "I engineered this" {#competence}

The strongest *intrinsic* driver in the game is the evidence that the player's
own understanding, planning, or execution shaped the outcome — the competence
need at the centre of Self-Determination Theory (Deci & Ryan 1985; Ryan & Deci
2000). Thinning is not satisfying because cards vanish; it is satisfying because
the player feels *sharper*. A 3-chain is not satisfying because particles fired;
it is satisfying because the player realises they *built* the engine that
chained.

- **Where it already lives:** the `>= 3` [escalation](#escalation) row, every
  successful [thin](gameplay-strategy.md#deck-thinning), a correctly-sequenced
  hand ([Rank 1](gameplay-strategy.md#rank-1)), a well-read
  [card-count](#card-counting), a well-timed Mastermind push
  ([Rank 2](gameplay-strategy.md#rank-2)).
- **Design use:** a reward moment should make *why* the player succeeded legible
  — surface the class that enabled the chain, the thin that raised the density —
  so the takeaway is "**I** did that," never "the game gave me that." This is the
  reward side of [Gameplay Strategy](gameplay-strategy.md#coaching-layers)'s four
  coachable layers.

#### 5. Agency — "I chose this" {#agency}

A chosen reward is valued more than an identical granted one — the autonomy need,
the second SDT pillar (Ryan & Deci 2000). "A card appeared" and "I *recruited*
that card" are mechanically identical and emotionally miles apart; the second
validates that the player *authored* the moment. Legendary Arena is dense with
real choices: recruit vs. fight, when to attempt a Tactic, sacrificing a
this-turn gain for future deck quality.

- **Where it already lives:** the interleave order (recruit ↔ fight), the
  Mastermind-timing decision ([Rank 2](gameplay-strategy.md#rank-2)), the escape
  KO pick, every construction and thinning call.
- **Design use:** let the *choosing* carry weight, not only the outcome — a
  chosen line that pays off should read as the player's decision vindicated, not
  as the game's gift. This is the reward-side twin of the
  [Narrative Agency hook](#the-four-meaning-hooks) ("I act on the world").

#### 6. Identity — "the hero I am" {#identity}

People repeat actions that confirm who they believe they are (identity-based
motivation; Oyserman 2009) — one of the deepest reasons Marvel, RPG, and
faction games earn loyalty. The reward is not "I won"; it is "**I am the kind of
hero who wins this way.**" Two players can take the mechanically-identical action
and feel opposite rewards: one *rescued the civilian*, the other *cleared an
obstacle to conquest*.

- **Where it already lives:** this is the reward face of this hub's
  [second pillar](#the-heart) (power *reveals* character) and of the
  [builder / destroyer lens](#playstyle-modes) — the same spine event, coloured
  by which heart the player brought to it.
- **Design use:** let identity-affirming beats (a bystander rescued, a teammate
  shielded, a ruthless overrun) carry a flavour the player recognises as
  *theirs* — the mechanical outcome may be identical, the emotional outcome must
  not be.

#### 7. Peak-end — the finale carries the memory {#peak-end}

Players remember a session by its **emotional peak** and its **ending**
(the peak-end rule; Kahneman & Fredrickson 1993, Redelmeier & Kahneman 1996),
far more than its average — an effect a 2022 meta-analysis found large and
robust (Alaybek et al. 2022, *r* = 0.581 across 174 effect sizes). The three endgame outcomes
(`heroes-win` / `scheme-wins` / `tie`) are the disproportionately-weighted
end beat — which is exactly why the [visual finale](visual-effects.md#endgame)
and the [endgame stinger](sound-effects.md) get
the biggest treatment in the game.

- **Design use:** spend the effect budget lavishly on the finale and on the
  single biggest mid-match peak (a Mastermind vanquished). A restrained
  early game makes the peak read as a peak.

#### Supporting lens — positive prediction error {#prediction-error}

Not a headline driver but the mechanism *under* [variable reward](#variable-reward):
the brain constantly forecasts the next outcome, and the reward spike scales with
how far reality **exceeds** that forecast, not with raw randomness (Schultz,
Dayan & Montague 1997). The implication for the sensory layers: occasionally
mark *"that was bigger than expected"* — an unforeseen combo extension, a perfect
HQ refill, an improbable comeback line — rather than giving every outcome the
same cue. A surprise that beats the forecast has earned a larger beat than a
result that merely met it.

#### Supporting lens — investment amplification (the IKEA effect) {#investment}

People value what they helped build (the IKEA effect; Norton, Mochon & Ariely
2012), and Legendary Arena is fundamentally a *construction* game. The player
grows attached to their deck, their engine, their line — so a late combo is not
just a combo, it is **proof their earlier decisions paid off**, and it lands
harder the more [class focus](gameplay-strategy.md#rank-0),
[thinning](gameplay-strategy.md#deck-thinning), and planning went in first. This
is why the drivers feed [competence](#competence) and [identity](#identity)
rather than standing alone, and why the [powerless → protector](#the-heart) arc
works: the hero is *built*, not granted.

- **Design use:** let the size of a payoff track the investment behind it — the
  same combo should feel bigger at the end of a deliberately-built engine than as
  an early fluke.

### Core reinforcement principles {#reinforcement-principles}

The [seven reward drivers](#seven-drivers) rest on a small set of
operant-conditioning principles. This table is the quick reference — each
principle is already expressed by one or more of those drivers, so it is a
*lens on the same behaviour*, not a competing list. (The behavioural-economics
principles below feed drivers 1–3 and 7; the [competence](#competence),
[agency](#agency), and [identity](#identity) drivers add the
self-determination side those operant principles don't capture.)

| Principle | What it means | How Legendary uses it |
|---|---|---|
| **Variable-ratio reinforcement** | Reward comes after an unpredictable number of actions | Superpower chains, desired HQ recruits, high-value City fights (see [Variable ratio](#variable-ratio)) |
| **Immediate feedback** | The reward — or its absence — is felt within seconds | Card play → a Superpower fires (or doesn't); `fightResolved`; a recruit lands |
| **Anticipation > consumption** | The build-up often feels better than the moment itself | Setting up a class chain, deciding to push the Mastermind, watching the HQ refill |
| **Threat → relief cycle** | Tension followed by resolution produces a strong spike | A Master Strike / Scheme Twist answered by a successful response or recovery |
| **Progress / mastery rewards** | Visible improvement in future expected value | Every successful thin, every additional class card recruited |
| **Escalating peaks** | Later rewards feel bigger because of earlier investment | First Tactic < mid-game Tactics < the final Mastermind defeat |
| **Near misses** | Almost succeeding raises motivation rather than lowering it | One Attack short of a Tactic; the almost-right class card in hand |

### Variable ratio — the reinforcement schedule underneath {#variable-ratio}

The variable-reward mechanism above names the strongest driver; this is *why*.
A **variable-ratio schedule** delivers a reward after an unpredictable number
of responses — the count changes each time but averages to a value (VR-5 ≈ a
reward every fifth response on average). It is the most powerful
partial-reinforcement schedule in operant-conditioning research (Ferster &
Skinner): it produces high, steady engagement, resists extinction, and runs on
anticipation — "the next one might be it."

| Schedule | Reward rule | Response pattern | Extinction resistance | Game analogue |
|---|---|---|---|---|
| **Fixed ratio (FR)** | Every N responses | Fast, then a pause after the reward | Medium | "Defeat 10 enemies for a chest" |
| **Variable ratio (VR)** | On average every N (unpredictable) | High and steady | **Highest** | HQ recruits, a rare card appearing, Superpower chains |
| **Fixed interval (FI)** | First response after a set time | Slow, then fast near the deadline | Low–Medium | Daily-login rewards |
| **Variable interval (VI)** | First response after a varying time | Steady but moderate | High | Random world events |

**How variable ratio shows up in Legendary Arena** — and how much of it the
*player* controls:

| System | VR character | What the player experiences |
|---|---|---|
| **HQ recruit** | Strong VR | The next card to surface in the HQ is unpredictable — sometimes exactly the class/cost you need, sometimes useless. Near-pure variable-ratio. |
| **Class Superpower chains** | Skill-modulated VR | After [thinning](gameplay-strategy.md#deck-thinning) and class focus, Superpowers fire more often — a reliable engine with residual unpredictability. |
| **City Villain fights** | Mild VR | Which Villains are present, and whether you hold exact Attack, is partly random. |
| **Mastermind Tactics** | Player-initiated VR | The player chooses *when* to attempt the high-stakes reward ([Rank 2](gameplay-strategy.md#rank-2)); success still isn't guaranteed. |
| **Hero Deck order** | Foundational VR | The shuffled shared Hero Deck is the variable-ratio source feeding the HQ. |
| **Combo tier** (`lastPlayEffectsFired`) | Escalating VR | Longer chains are rarer but pay more — variable-ratio escalation. |

The distinction that keeps this framework honest is **who authors the
schedule**:

- **Pure VR** — HQ refills, exact card appearance: the game's own randomness,
  which the player accepted by sitting down.
- **Skill-modulated VR** — Superpower *density*, which improves with
  [construction](gameplay-strategy.md#rank-0), class focus, and
  [thinning](gameplay-strategy.md#deck-thinning).
- **Player-initiated, high-stakes VR** — choosing to attempt a Mastermind
  Tactic ([Rank 2](gameplay-strategy.md#rank-2)).

**Near misses** are part of VR's pull: one Attack short of a Tactic, or one
slot away from the right class card, *raises* motivation. Attribute the near
miss to a board state the player can improve — never to a rigged tease.

**Bright-line guard.** Variable ratio is powerful enough to be abused, which
is exactly why the [Feel-Layer Contract](#feel-layer-contract) and the
[Vision](vision.md) bright lines ([Monetization Model](monetization-model.md))
are hard boundaries here: never gate core progress behind pay-driven VR, and
never build an extinction-resistant "just one more" loop that exploits loss
aversion ([Monetization Model](monetization-model.md) Guardrails #1 and #5, and
the [Vision](vision.md) Non-Goals). The healthiest variable ratio in Legendary
Arena is the kind the
player *earns* through [Rank 0–2 decisions](gameplay-strategy.md) —
construction, play order, and Mastermind timing — which supports flow and
mastery, not compulsion.

### Card counting — the honest skill beneath the luck {#card-counting}

Variable ratio explains why *not knowing* is compelling; this is its skilled
counterpart — **narrowing** what you don't know. It is the legitimate cousin of
luck: a poker player can't see the next card, but by tracking what has already
been played they can play the odds. Card counting is not clairvoyance; it is
*tracking probabilities from known information* — and it is a genuine skill, the
one that separates a thoughtful player from a button-masher.

Legendary Arena is built for it because **the deck composition is known.** A
hero contributes a fixed set of 14 cards, with fixed counts of each. So a sharp
player reasons exactly the way a card-counter does: *the rare five-cost hasn't
surfaced yet, this many cards are left, so it is statistically due — therefore I
should bank recruit power now, so I can grab it the moment it appears in the
[HQ](gameplay-strategy.md#rank-1).* That is not luck. That is preparation
meeting probability — the deepest expression of "reward the skill, not the luck."

This adds a dimension the reward loop can coach **honestly.** Call it
**anticipation:** did the player keep recruit capacity in reserve when a
high-value card was statistically likely to appear? The omniscient
[PAR simulation](par-simulation-calibration.md) knows the card was literally
next in the deck — but even without revealing that, it can coach from what the
player *could already see:* "based on what had already been played, that rare
was probably coming, and you were tapped out when it arrived." No hidden
information is exposed; the lesson is only how to reason from the visible board.
That honesty is the point — this teaches a real skill rather than spoiling the
draw.

**Four coachable layers** then stack into a genuinely deep analytical game —
chess-and-poker deep:

| Layer | The skill | Graded against |
|---|---|---|
| **Sequencing** | Play order within a turn — firing the chain in the right order | The [Rank 1](gameplay-strategy.md#rank-1) optimal line |
| **Acquisition** | *What* to recruit, and *when* | Class focus + [thinning](gameplay-strategy.md#deck-thinning) value |
| **Anticipation** | Tracking the known deck; banking capacity for the statistically-due card | The probability the player could infer from visible play |
| **Efficiency** | The whole turn measured against the optimal line | [PAR](par-simulation-calibration.md) — the machine performance of the same decisions |

Anticipation is the newest of the four and the most poker-like: it rewards a
player for reasoning from public information, never from a rigged tease or a
peek at hidden state — the same bright line the [variable-ratio guard](#variable-ratio)
draws. Like the rest of this framework it serves mastery and flow, not
compulsion.

### Flow channel dynamics {#flow-channel}

Beyond individual rewards, a whole match should stay inside the **flow
channel** — the band where challenge and the player's (rising) skill track
each other, avoiding boredom (skill ≫ challenge) and anxiety (challenge ≫
skill). Legendary's flow is largely *self-authored*: because the player builds
their own skill ceiling over a match (construction, thinning, class focus),
the same Mastermind Tactic that is anxiety on turn 3 is deep flow on turn 9.

The map below places the key game moments on that channel and ties each to the
driver(s) that carry it. (Villain **escape** has no discrete client event —
it surfaces only as the rising `escapedVillains` counter; the deferred
`escapeResolved` hook is WP-186 / D-20001.)

| Phase | Game moment | Channel position / state | Drivers + spine signal | Design note |
|---|---|---|---|---|
| Early | First 1–2 turns (mostly S.H.I.E.L.D. cards) | Lower-left edge; mild tension / learning | Dopamine (low consistency); `playCard` / `recruitHero` | High S.H.I.E.L.D. dilution keeps skill low vs board pressure |
| Early | First HQ recruit | Moving rightward; small positive flow | Narrative (Agency) + Dopamine; `recruitHero` | First clear agency signal |
| Early | Forced hero KO on a Villain escape | Slight anxiety spike; tension | Narrative (threat); rising `escapedVillains` (no escape event) + KO choice | A pressured choice while still weak |
| Mid | Aggressive [thinning](gameplay-strategy.md#deck-thinning) of starting S.H.I.E.L.D. cards | Strong rightward move; growing flow | Narrative (Agency) + Dopamine (mastery); KO effects | Player actively raises their own skill ceiling |
| Mid | First clean class Superpower chain (post-thinning) | Deep inside channel; strong flow | Dopamine (reliable reward) + Narrative (teamwork); `lastPlayEffectsFired` | One of the purest flow moments in the game |
| Mid | Recruit ↔ fight interleaving | Inside channel; flow + agency | Narrative (Agency); `recruitHero` + `fightResolved` | Real-time micro-adjustment of challenge |
| Mid | A dead hand of off-class / weak cards | Drops toward boredom or mild anxiety | Dopamine (variance); `playCard` | Earlier construction / thinning choices made visible in failure |
| Escalation | Deciding to take the first Mastermind Tactic | Upper edge; peak engagement / productive tension | Narrative (rising action) + Dopamine (high-stakes); `fightResolved` (Mastermind) | Player deliberately escalates challenge ([Rank 2](gameplay-strategy.md#rank-2)) |
| Escalation | Taking a 2nd/3rd Tactic while the City is controlled | Deep high-skill flow; strong flow | Narrative (climax building) + Dopamine; `fightResolved` (Mastermind) | Skill and challenge both high and matched |
| Escalation | City flooding + escapes while pushing the Mastermind | Pushed toward anxiety; recovery demand | Narrative (darkest hour) + Dopamine (threat); `ambushResolved` + rising `escapedVillains` | Tests the quality of earlier Rank 0–2 decisions |
| Escalation | Scheme Twist or Master Strike | Sudden upward spike; threat → possible recovery | Narrative (plot thickens / evil asserts) + Dopamine (threat spike); `schemeTwistResolved`, `mastermindStrikeResolved` | Classic threat spike; recovery depends on prior mastery |
| Climax | Final Mastermind Tactic (the winning fight) | Top of the channel; peak flow or peak anxiety | Narrative (good triumphs) + Dopamine (peak reward); `mastermindDefeated` | Highest challenge meets highest accumulated skill |
| Resolution | Victory after a hard-fought race | Exiting upward into mastery; satisfaction + closure | Narrative (resolution) + Dopamine (peak); `EndgameOutcome` (heroes-win) | Flow often breaks into reflection |
| Resolution | Defeat by the Scheme while close | Exiting into anxiety / frustration; loss of control | Narrative (tragedy) + Dopamine (punishment); `EndgameOutcome` (scheme-wins) | Challenge exceeded skill at the critical moment |

**The dopamine curve across a match** — the shape the pacing aims for:

```
Early game
├── Low consistency (S.H.I.E.L.D. dilution)
├── Small progress rewards (first recruits, first thins)
└── Occasional threat spikes (early Ambush / Strike)

Mid game (after thinning + class focus)
├── Rising baseline of reliable Superpower rewards
├── Strong variable-ratio from HQ and City
└── Player begins to control escalation (first Tactics)

Late game
├── High-stakes Mastermind decisions dominate
├── Threat spikes become more dangerous
└── Potential for the highest peaks (final Tactics + victory)
```

**The mechanical levers that shape the curve** are mostly the *player's* to
pull — which is what makes the dopamine feel earned:

1. **Class density + thinning speed** — together these decide whether
   Superpowers feel like a reliable engine (steady dopamine) or rare jackpots
   (high variance). The biggest player-controlled influence on a session's
   dopamine profile.
2. **Mastermind timing** — the player chooses when to inject the highest-stakes
   variable rewards. Early Tactics: higher risk, higher potential peaks.
   Delayed Tactics: safer but flatter.
3. **HQ refill variance** — the shuffled Hero Deck order creates natural near
   misses and jackpot recruits; one of the purest variable-ratio elements.
4. **Interleaving recruit / fight** — moment-to-moment control over pursuing
   progress rewards (recruit) versus immediate combat rewards (fight).
5. **Threat density (Strikes, Twists, escapes)** — how often the
   tension → relief cycle fires. Too many without recovery tools → anxiety;
   too few → a flat curve.

**Design implications.** Keep four reward types distinct so the curve stays
varied rather than monotonous: **reliable engine rewards** (post-thinning
Superpowers) to sustain long flow; **high-variance jackpots** (a perfect HQ
card, a big Mastermind swing) for memorable peaks; **threat → relief cycles**
to break the monotony; and **player-authored escalation** (Mastermind timing,
thinning aggression) so the dopamine feels earned rather than given. This is
also where the [Soul / Authorial Voice](#soul-authorial-voice) principle bites:
when the player feels they shaped both the consistency and the peaks through
their [Rank 0–2 decisions](gameplay-strategy.md), the hits carry more meaning
and produce stronger flow.

### Pacing — the discipline that separates juice from noise

More cues is not more dopamine. The drivers above only pay off if they are
**spaced and prioritized** (the [pacing invariants](#pacing-invariants) above
are the MUST form of this):

- **Contrast requires restraint.** If every card play triggers a full-screen
  flourish, nothing feels special. Reserve the big treatments for the peaks
  (3+ combos, defeats, the finale) and keep routine actions subtle.
- **Anticipation before payoff.** A micro-beat of build-up (the reveal hold,
  the combo crescendo) makes the resolution land harder than an instant flash.
- **Don't stack simultaneous peaks into mud.** When several events resolve in
  one move (a fight that triggers a chain that rescues a bystander), sequence
  or merge the cues so they read as one crescendo, not a collision.
- **Fatigue is real.** Repetitive identical cues dull fast; vary within a tier
  (the [motif](music-authoring.md#motif-matrix) layer does this for audio by
  keying to the acting hero).

---

## Appendix N — Narrative meaning (reference) {#narrative-meaning}

This is the **"what does it mean?"** reference — the layer that makes a match
feel like a *story*, not just a sequence of legal moves. Where the
[reward psychology](#reward-psychology) explains why the loop is *satisfying*,
this explains why it's *meaningful*: the pull of Marvel lore, hero archetypes,
good-versus-evil mythology, and nostalgia. The same engine events the sensory
layers dramatize, this *narrates* — so a single moment carries reward
(dopamine), spectacle (visual/audio), and meaning (narrative) at once. It is a
[framing contract](#framing-invariants) expressed through the two sensory
layers; it renders nothing of its own. (Marvel characters and lore are licensed
IP; this treats theme and framing, not reproduction — see the
[IP boundary](#ip-boundary-mandatory).)

### The four meaning hooks {#the-four-meaning-hooks}

#### 1. Archetype — heroes and villains as story roles

Players don't recruit "a card with +2 attack" — they recruit *Spider-Man*,
*Wolverine*, *Cyclops*. Each carries an archetype the player already knows,
so the game inherits decades of characterization for free. The engine
already knows *who* is acting at every spine event (the acting hero from the
local move and in-play state; the Mastermind and Scheme from match
configuration), so narrative framing needs **no new signal** — it reads the
identity the client already has.

- **Design use:** colour the *copy and framing* of a beat by the actor —
  a `fightResolved` narrated as "Wolverine tears through the henchmen" reads
  differently from the generic "villain defeated," using the event's
  `narrative` field and the acting entity's identity. Surface the distinctive
  traits players already associate with each hero or villain (Wolverine's
  ferocity, Spider-Man's quips and responsibility, a Mastermind's particular
  brand of menace). Generic "villain defeated" copy is the failure mode this
  hook exists to prevent.

#### 2. Good versus evil — the match as a moral arc

Every match is a compressed good-versus-evil story; the
[story-beat mapping](#beat-mapping) above binds each spine event to its
canonical beat (a Master Strike is "evil asserts itself," a villain defeated is
"a heroic rescue," a Mastermind vanquished is "good triumphs"). The
[dopamine](#reward-psychology) threat/reward rhythm *is* the narrative
rising-and-falling action; this layer names it.

#### 3. Nostalgia — inherited investment

Marvel lore is a nostalgia engine: a returning player brings childhood
attachment to these characters that the game did not have to build. This is
why the [music-authoring](music-authoring.md) **leitmotif** grammar matters
to *narrative*, not just audio — a recognizable theme keyed to a team
(S.H.I.E.L.D., X-Men, the Avengers) triggers identity and memory the instant
it plays.

- **Design use:** lean on recognizable team/character identity in framing,
  motif, and palette so the player feels "these are *my* heroes." Nostalgia
  only creates soul when treated with care; cheap or interchangeable nostalgia
  reads as soulless.

#### 4. Agency — "I act on the world"

Self-determination research puts **autonomy** at the center of intrinsic
motivation: the game feels meaningful when the player's choices visibly shape
the story. The local action moves (`playCard`, `recruitHero`, `fightVillain`)
are the player *authoring* the narrative — the framing should make each feel
like a deliberate story move, not a menu selection. The moment-to-moment
tracking of that agency against rising challenge is the
[flow-channel map](#flow-channel). This is the meaning-side twin of the
[Agency reward driver](#agency).

### The synergy call-out and faction cries (render lives on the sensory pages)

When a play detonates a chain of hero abilities, the engine counts the chain,
and the sensory layers escalate a flash and a sting with it. The **meaning**
layer adds a **named call-out** that shouts *what the player just did* — the
Legendary-Arena answer to *Candy Crush*'s "Sweet! → Tasty! → Delicious! →
Divine!". A *word* matters where a particle burst does not: it makes mastery
legible ("you pulled off a **Team-Up!**"), it is comic-book-native, and the
apex rung lands on the game's own word — **LEGENDARY!** — so the biggest synergy
a player ever pulls says the title of the game back to them.

The **render** of the call-out ladder and the identity-driven **faction battle
cries** lives on the sensory pages, keyed to the locked combo tier:

- The on-screen [synergy call-out ladder](visual-effects.md#synergy-callout)
  (**Combo! → Team-Up! → Unstoppable! → LEGENDARY!**) and the
  [faction battle cries](visual-effects.md#faction-cries)
  (**AVENGERS ASSEMBLE!**, **HULK SMASH!** …) render on
  [Visual Effects](visual-effects.md).
- The voiced [Arena Announcer](sound-effects.md#arena-announcer) — the
  *Candy Crush* Mr.-Toffee analog — speaks the ladder on
  [Sound Effects](sound-effects.md).

The faction cries are the [Archetype](#the-four-meaning-hooks) and Nostalgia
hooks compressed into a single word — but they are verbatim, trademark-heavy
Marvel copy and ship only behind the [IP boundary](#ip-boundary-mandatory)'s
licensing gate (D-24259).

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
this is a **narrative re-frame over the identical trigger spine**, selected by
a preference toggle:

- **What changes:** copy, framing, palette accent, which side's beats get the
  celebratory treatment — pure presentation.
- **What does not change:** the engine, the events, the outcomes, the rules.
  The toggle adds **zero** engine footprint and cannot affect a result — it
  is a client-side lens.

This is the same fork the [heart](#the-heart)'s "power reveals character" pillar
names and the [Identity reward driver](#identity) rewards. The *visual*
mechanics of the re-theme are specced under
[Visual Effects → narrative lens](visual-effects.md#playstyle-lens); the lens is
**Tier 3 / out of v1 scope** (v1 ships the single heroic default). If it grows
its own mechanics (distinct progression, distinct cosmetics, a full villain
campaign), it graduates to a standalone **Playstyle Modes** page.

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (6 locked variants) + the per-event `narrative` field;
  header notes `G.messages` is not projected and `escapeResolved` is deferred
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the projected signals every treatment reads (`notableEvents`,
  `game.lastPlayEffectsFired`, `progress`, `scheme`, `players`)
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo chain count's origin (`lastPlayEffectsFired`)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome` (the three finales), `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24221 (`lastPlayEffectsFired`,
  the combo chain signal), D-24228 (shipped tiered combo cue), D-24224
  (client-only audio foundation), D-24246 (the apex `legendary` combo tier),
  D-24259 (faction-cry licensing reconciliation), D-20001 / D-20008
  (notable-event payload; log not projected), D-24159 / WP-367 (the
  deck-exhaustion tie), D-24235 (Vision §The Fantasy)
- Peak-end rule research — Kahneman & Fredrickson (1993); Redelmeier & Kahneman
  (1996); Alaybek, B., Dalal, R. S., Fyffe, S., Aitken, J. A., Zhou, Y., Qu, X.,
  Roman, A., & Baines, J. I. (2022). *All's well that ends (and peaks) well? A
  meta-analysis of the peak-end rule and duration neglect.* Organizational
  Behavior and Human Decision Processes, 170, 104149
  (https://doi.org/10.1016/j.obhdp.2022.104149) — peak-end effect *r* = 0.581
  (95% CI 0.487–0.661)
- Self-Determination Theory — Deci, E. L., & Ryan, R. M. (1985). *Intrinsic
  Motivation and Self-Determination in Human Behavior.* Plenum; Ryan, R. M., &
  Deci, E. L. (2000). *Self-determination theory and the facilitation of
  intrinsic motivation, social development, and well-being.* American
  Psychologist, 55(1), 68–78 (https://doi.org/10.1037/0003-066X.55.1.68) — the
  competence and autonomy needs behind the [competence](#competence) and
  [agency](#agency) drivers
- Reward prediction error — Schultz, W., Dayan, P., & Montague, P. R. (1997).
  *A neural substrate of prediction and reward.* Science, 275(5306), 1593–1599
  (https://doi.org/10.1126/science.275.5306.1593) — the
  [prediction-error lens](#prediction-error)
- The IKEA effect — Norton, M. I., Mochon, D., & Ariely, D. (2012). *The IKEA
  effect: When labor leads to love.* Journal of Consumer Psychology, 22(3),
  453–460 (https://doi.org/10.1016/j.jcps.2011.08.002) — the
  [investment-amplification lens](#investment)
- Identity-based motivation — Oyserman, D. (2009). *Identity-based motivation:
  Implications for action-readiness, procedural-readiness, and consumer
  behavior.* Journal of Consumer Psychology, 19(3), 250–260
  (https://doi.org/10.1016/j.jcps.2009.05.008) — the [identity](#identity) driver
- Companion feel-layer pages: [Visual Effects](visual-effects.md),
  [Sound Effects](sound-effects.md), [Music Authoring](music-authoring.md)
- [Vision](vision.md) §The Fantasy (emotional identity), D-24235 — the
  good-versus-evil power fantasy / "heroic momentum" the
  [powerless-to-protector heart](#the-heart) makes felt
- [Gameplay Strategy](gameplay-strategy.md) and
  [PAR Simulation Calibration](par-simulation-calibration.md) — the Rank 0–2
  decision hierarchy and its machine performance, i.e. the skill the
  [card-counting / anticipation layer](#card-counting) coaches against
- Design session 2026-08-13 — origin of the
  [powerless-to-protector heart](#the-heart), the "power reveals character"
  pillar, the [card-counting / anticipation](#card-counting) coaching layer, and
  the consolidation of the reward-psychology and narrative-meaning references
  into this hub
