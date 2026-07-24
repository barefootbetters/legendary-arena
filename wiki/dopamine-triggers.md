---
title: Dopamine Trigger Framework
type: Guide
tags:
  - design-system
  - psychology
  - reward
  - juice
  - pacing
  - arena-client
  - research
related:
  - design-system-overview.md
  - visual-effects.md
  - sound-effects.md
  - narrative-psychology.md
  - turn-system.md
  - villain-deck.md
  - vision.md
  - monetization-model.md
  - gameplay-strategy.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\dopamine-triggers.md (this page — https://ewiki.legendary-arena.com/dopamine-triggers/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
last-reviewed: 2026-07-22
---

# Dopamine Trigger Framework

## Summary

This page is the **reward-psychology reference** for
`play.legendary-arena.com` — the "why is this loop satisfying?" layer that
sits underneath the [Visual Effects](visual-effects.md) and
[Sound Effects](sound-effects.md) frameworks. Those two pages decide *what*
a moment looks and sounds like; this page explains *why* a given moment
lands as a reward, a threat, or a relief, and how to **pace and time** the
sensory cues so the payoff feels earned rather than noisy.

It maps the [shared trigger spine](design-system-overview.md#shared-trigger-spine)
to the small set of reward mechanisms that actually drive satisfaction in a
deck-builder: **variable reward** (you don't know what the villain deck
will reveal), **escalating reward** (a synergy chain that keeps paying
off), **loss aversion** (the escape and scheme counters climbing toward
defeat), and the **peak-end** shape of a match (the finale carries
disproportionate emotional weight). Each maps to signals the client already
receives, so the framework is buildable on the same client-side reaction
surface as visual and audio.

This is **engagement craft, not compulsion engineering.** Legendary Arena's
satisfaction comes from *good play being visibly rewarded* — a well-built
synergy chain, a clutch rescue, a Mastermind vanquished. Per
[Vision](vision.md), the game never gates play behind spend and is never
pay-to-win ([Monetization Model](monetization-model.md)); the reward loop
lives entirely inside the free game. This page documents how to make winning
*feel* as good as it is, and nothing more.

No feel-layer code beyond the shipped audio foundation ships today — this is
`draft` research. Only the event vocabulary, the projected `UIState`
signals, and the architectural boundaries are sourced to code; the pacing
and reward mappings are proposals.

**How to read this page.** The [Dopamine Contract](#dopamine-contract) below
is the **fixed governance layer** — the reward classification, pacing
invariants, and bright lines a future Work Packet is judged against. The
[Mechanics](#mechanics) are **design detail** (evolvable), and
[Decisions Pending](#decisions-pending) / [Deferred](#deferred) are the
**roadmap**.

## Dopamine Contract

This section is the **immovable governance layer** of the page. The reward
*psychology* below it may evolve; the classification, the pacing
invariants, and the bright lines here may not without a `DECISIONS.md`
entry.

### What this layer is — and is not

The Dopamine framework is **not its own code layer** and emits nothing at
runtime. It is a **pacing + priority contract** the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers implement. Its deliverables are a reward classification, a priority
ranking, and timing/sequencing rules those two layers honour — never a
runtime of its own.

### Reward classification (locked vocabulary)

Every spine event resolves to one of four classes; both sensory layers must
treat them consistently:

| Class | Spine events | Cue posture |
|---|---|---|
| **Reward** | `fightResolved`, `mastermindDefeated`, `healResolved`, a combo (`lastPlayEffectsFired >= 1`) | Celebrate — the positive payoff |
| **Threat** | `mastermindStrikeResolved`, `schemeTwistResolved`, `ambushResolved`, rising `escapedVillains` / `scheme.twistCount` | Menace — **never** a positive cue |
| **Relief** | a Master Strike survived without disaster, a City threat cleared (`fightResolved`), `healResolved` | The exhale after tension |
| **Resolution** | `heroes-win` / `scheme-wins` / `tie` | The peak-end finale — weighted heaviest |

### Pacing invariants (MUST)

- **Contrast through restraint** — the big treatments are reserved for
  peaks; routine actions stay subtle.
- **Anticipation before payoff** — a micro-beat of build-up precedes the
  resolution cue.
- **One crescendo per resolved move** — simultaneous events merge or
  sequence into a single crescendo, never a collision.
- **Reward the skill, not the luck** — the escalating-combo payoff is
  attributed to the player's deck-building, not to randomness.

### Non-Goals — this framework MUST NOT

- add any engine or determinism footprint (it is pure client-side pacing);
- fire a positive cue when the menace rises (threat is tension, not reward);
- introduce any reward that gates play, pressures spend, manufactures
  scarcity, or builds a compulsion loop — the [Vision](vision.md) bright
  lines ([Monetization Model](monetization-model.md)) are hard boundaries,
  not guidance.

The reward loop lives entirely inside the **free game.**

## Mechanics

### Priority tiers {#priority-tiers}

Reward weight ranks which moments earn the biggest sensory budget; a Work
Packet times the cues in this order rather than treating every reward
equally:

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

### The five reward mechanisms

Each mechanism is a *pattern* in how the spine's events arrive over time —
not a new signal. The client already has everything needed to detect them.

#### 1. Variable reward — the villain-deck reveal

The single strongest satisfaction driver in the game is **not knowing what
comes next.** Every villain-deck reveal
([Villain Deck](villain-deck.md)) is a sealed outcome — a harmless card, a
menacing Ambush, a Scheme Twist, or a Master Strike — resolved from a
deterministic-but-player-unknown shuffle (`ctx.random`, so it replays
identically yet feels random *to the player*). That variable-ratio shape is
the classic reason "flip the top card" is compelling.

- **Design use:** give the *reveal itself* a beat of anticipation before the
  outcome cue resolves — a brief hold, then the payoff. The
  [Turn System](turn-system.md) reveal step is the anticipation window; the
  `notableEvents` (`ambushResolved` / `schemeTwistResolved` /
  `mastermindStrikeResolved`) are the resolution.
- **Guardrail:** the variability is *in the game's own randomness*, which
  the player already accepted by sitting down — it is not a manufactured
  loot-box or a spend-gated pull.

#### 2. Escalating reward — the synergy chain (the flagship)

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
  crescendo the player caused, not a random flash. Reward the *skill*, not
  the luck.

#### 3. Loss aversion — the menace counters

Losing hurts more than winning feels good — so the villains *closing in* is
a potent (negative) driver that makes the eventual win sweeter. Two
already-projected counters climb toward defeat:

- `UIState.progress.escapedVillains` → loss at `ESCAPE_LIMIT` (8).
- `UIState.scheme.twistCount` → the scheme completes at its own limit
  (`schemeLoss` flips terminal).

- **Design use:** this is the emotional core of the *adaptive danger-meter
  score* on [Sound Effects](sound-effects.md)
  and a candidate for a rising *ambient* visual menace. Pressure builds
  tension; relieving it (defeating the threat, see below) is the reward.

#### 4. Relief — defeating the threat / healing

Reward isn't only positive gains; **removing a threat** is its own hit.
`fightResolved` (a villain cleared from the City), `healResolved` (wounds
KO'd), and a Master Strike *survived* without disaster are relief beats —
the tension built by loss-aversion, discharged.

- **Design use:** pair the relief cue's *character* to the tension it
  discharges — a bigger exhale after a bigger scare.

#### 5. Peak-end — the finale carries the memory

Players remember a session by its **emotional peak** and its **ending**
(the peak-end rule), far more than its average. The three endgame outcomes
(`heroes-win` / `scheme-wins` / `tie`) are the disproportionately-weighted
end beat — which is exactly why the [visual finale](visual-effects.md#endgame)
and the [endgame stinger](sound-effects.md) get
the biggest treatment in the game.

- **Design use:** spend the effect budget lavishly on the finale and on the
  single biggest mid-match peak (a Mastermind vanquished). A restrained
  early game makes the peak read as a peak.

### Core reinforcement principles {#reinforcement-principles}

The [five reward mechanisms](#the-five-reward-mechanisms) rest on a small set
of operant-conditioning principles. This table is the quick reference — each
principle is already expressed by one or more of those mechanisms, so it is a
*lens on the same behaviour*, not a competing list.

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
is exactly why the [Dopamine Contract](#dopamine-contract) and the
[Vision](vision.md) bright lines ([Monetization Model](monetization-model.md))
are hard boundaries here: never gate core progress behind pay-driven VR, and
never build an extinction-resistant "just one more" loop that exploits loss
aversion. The healthiest variable ratio in Legendary Arena is the kind the
player *earns* through [Rank 0–2 decisions](gameplay-strategy.md) —
construction, play order, and Mastermind timing — which supports flow and
mastery, not compulsion.

### Flow channel dynamics {#flow-channel}

Beyond individual rewards, a whole match should stay inside the **flow
channel** — the band where challenge and the player's (rising) skill track
each other, avoiding boredom (skill ≫ challenge) and anxiety (challenge ≫
skill). Legendary's flow is largely *self-authored*: because the player builds
their own skill ceiling over a match (construction, thinning, class focus),
the same Mastermind Tactic that is anxiety on turn 3 is deep flow on turn 9.

The map below places the key game moments on that channel and ties each to the
framework(s) that carry it. (Villain **escape** has no discrete client event —
it surfaces only as the rising `escapedVillains` counter; the deferred
`escapeResolved` hook is WP-186 / D-20001.)

| Phase | Game moment | Channel position / state | Frameworks + spine signal | Design note |
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

**Design implications.** The framework should keep four reward types distinct
so the curve stays varied rather than monotonous: **reliable engine rewards**
(post-thinning Superpowers) to sustain long flow; **high-variance jackpots**
(a perfect HQ card, a big Mastermind swing) for memorable peaks;
**threat → relief cycles** to break the monotony; and **player-authored
escalation** (Mastermind timing, thinning aggression) so the dopamine feels
earned rather than given. This is also where the
[Soul / Authorial Voice](design-system-overview.md#soul-authorial-voice)
principle bites: when the player feels they shaped both the consistency and
the peaks through their [Rank 0–2 decisions](gameplay-strategy.md), the hits
carry more meaning and produce stronger flow.

### Visual–audio pairing {#visual-audio-pairing}

The [Design System Overview](design-system-overview.md) rule holds: **visual
and audio must peak together on the same spine event.** A flash without its
sting (or a sting without its flash) weakens the dopamine beat and breaks the
sense of one authored moment. This section is the concrete pairing artifact
— the per-event sensory signature both the [Visual Effects](visual-effects.md)
and [Sound Effects](sound-effects.md) layers implement (it drafts the
[effect-priority table](#decisions-pending) this framework owed).

Pairing principles:

1. **Same trigger, same timing** — both layers react to the identical
   `UIState` event and peak within ~50–100 ms of each other.
2. **Intensity matching** — high-dopamine or high-threat moments get higher
   visual amplitude *and* higher audio intensity; low moments stay restrained.
3. **Narrative colouring** — the same mechanical event can shift palette,
   particle behaviour, and motif by the [Playstyle lens](narrative-psychology.md#playstyle-modes)
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

**Playstyle colouring.** When the builder/destroyer
[lens](narrative-psychology.md#playstyle-modes) is active, only the *skin*
changes — the timing and intensity skeleton stays identical: **builder**
(brighter palette, cleaner particles, heroic musical accents on reward
events); **destroyer** (darker/harsher palette and impacts, motifs that
celebrate conquest on the same mechanical events).

**Implementation notes.** Author the visual and audio peaks to land on the
same frame (or within one) of the spine event becoming visible; scale both
under a single global **Effect Intensity** preference so amplitude and
volume/complexity move together; and in reduced-motion mode suppress big
screen-shakes, heavy particles, and long blooms while keeping the essential
audio stingers (or a minimal visual pulse).

#### Audio treatment previews {#audio-treatment-previews}

Audition the **audio treatment** column of the pairing table above. These are
the same CC0 clips catalogued on
[Sound Effects → Audio previews](sound-effects.md#audio-previews) — the
authoritative sound library — re-embedded here in *dopamine order* so the
reward/threat/relief intent of each cue is audible next to its classification.
Each uses the JS-free [`audio` shortcode](ewiki-authoring.md) (native
`<audio>` controls). Representative picks, not final selections; where a clip
is shared with the Sound Effects catalogue the caption matches so the
cross-reference stays honest.

**`playCard` (ordinary)** — soft tactile click (Micro-agency · Low):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/play-card.mp3" caption="Kenney Casino Audio (CC0) — card place" >}}

**`lastPlayEffectsFired` tier 1** — short rising cue (First synergy hit ·
Medium). The shipped combo cue rides the live `lastPlayEffectsFired` count
(D-24221 / D-24228):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-small.mp3" caption="WP-413 combo cue (CC0) — tier 1 rising sparkle" >}}

**`lastPlayEffectsFired` tier 2–3+** — escalating combo cue, rising
pitch/intensity (Variable-ratio peak · High). Tier 2 and the 3+ flourish are
the same shape, higher and brighter, so the chain reads as one continuous
escalation:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-medium.mp3" caption="WP-413 combo cue (CC0) — tier 2, higher" >}}

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-big.mp3" caption="WP-413 combo cue (CC0) — tier 3+ ascending flourish" >}}

**`recruitHero` (desired card)** — warm positive chime (Progress reward ·
Medium):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/recruit-hero.mp3" caption="Kenney Interface Sounds (CC0) — confirmation" >}}

**`fightResolved` (City Villain)** — triumphant short hit (Standard reward ·
Medium):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/villain-defeated.mp3" caption="OpenGameArt 80 CC0 RPG SFX — metal impact" >}}

**`fightResolved` (Mastermind Tactic)** — a stronger triumphant hit with a
**motif accent** layered on top (High-stakes reward · High). The base impact
below is the same clip as a City fight; the Tactic version layers the acting
Mastermind's motif over it at −6/−9 dB (see
[Music Authoring → motif matrix](music-authoring.md#motif-matrix), D-24226):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/villain-defeated.mp3" caption="OpenGameArt 80 CC0 RPG SFX — metal impact (base; motif layers on top)" >}}

**`mastermindDefeated`** — full victory fanfare (Peak reward + closure · Very
High). The wired event plays the shipped triumphant cue below; the fuller
victory theme is auditioned on the Endgame `heroes-win` finale further down:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/mastermind-defeated.mp3" caption="Shipped mastermind-defeated.mp3 — WP-412 (CC0); the clip play.legendary-arena.com actually plays" >}}

**`mastermindStrikeResolved`** — dramatic low stinger (Threat spike · High):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" caption="OpenGameArt CC0 — Sinister Boss Appears" >}}

**`schemeTwistResolved`** — ominous low sting (Rising stakes / dread · High):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/scheme-twist.mp3" caption="OpenGameArt CC0 — Evil Approach" >}}

**`ambushResolved`** — menacing whoosh (Surprise threat · Medium–High):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/ambush.mp3" caption="Shipped ambush.mp3 — WP-412 (CC0); the clip play.legendary-arena.com actually plays" >}}

**`healResolved`** — restorative chime (Relief / recovery · Medium):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/heal.mp3" caption="Restorative heal chime (CC0)" >}}

**Endgame `heroes-win`** — victory fanfare (Peak + meaning · Very High). The
endgame finale is an unwired Surface-4 stinger; `heroes-win` is driven by
`mastermindDefeated`, but the finale auditions a fuller victory theme than the
wired event cue above — the peak-end finale earns the biggest treatment:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/mastermind-defeated-win.mp3" caption="OpenGameArt CC0 — full victory theme (endgame-finale candidate; not yet wired)" >}}

**Endgame `scheme-wins`** — dirge or unresolved sting (Punishment / tragedy ·
High):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/heroes-lose.mp3" caption="OpenGameArt CC0 — Epic Endgame Cinematic" >}}

**Endgame `tie`** — wry or unresolved sting (Ambiguous closure · Medium). *No
CC0 tie clip is hosted yet* — the candidate picks (a neutral, suspended
cadence — neither fanfare nor dirge) are listed under
[Sound Effects → Match tied](sound-effects.md#example-sound-picks-per-eventaction);
this row gets a player once one is sourced.

### Pacing — the discipline that separates juice from noise

More cues is not more dopamine. The mechanisms above only pay off if they
are **spaced and prioritized**:

- **Contrast requires restraint.** If every card play triggers a
  full-screen flourish, nothing feels special. Reserve the big treatments
  for the peaks (3+ combos, defeats, the finale) and keep routine actions
  (draw, single-effect play) subtle.
- **Anticipation before payoff.** A micro-beat of build-up (the reveal hold,
  the combo crescendo) makes the resolution land harder than an instant
  flash.
- **Don't stack simultaneous peaks into mud.** When several events resolve
  in one move (a fight that triggers a chain that rescues a bystander),
  sequence or merge the cues so they read as one crescendo, not a collision.
- **Fatigue is real.** Repetitive identical cues dull fast; vary within a
  tier (the [motif](music-authoring.md#motif-matrix) layer does this for
  audio by keying to the acting hero).

### Where this framework lives

Nowhere new. The Dopamine framework is **not its own code layer** — it is
the *timing and priority contract* that the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers implement. It reads the same client-side `UIState` reaction surface
(per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), engine owns truth, UI
consumes read-only projections), adds zero engine footprint, and expresses
itself entirely through *how* the two sensory layers schedule their cues.
Concretely, it becomes: an effect-priority table, a per-tier build-up
timing, and a "one crescendo per resolved move" sequencing rule shared by
both layers.

## Interactions

- **[Design System Overview](design-system-overview.md).** The parent hub;
  its [shared trigger spine](design-system-overview.md#shared-trigger-spine)
  has a "Dopamine" column that this page expands — reward vs threat vs
  relief per event.
- **[Visual Effects](visual-effects.md)** and
  **[Sound Effects](sound-effects.md).** This framework is the *why and
  when* behind their *what*; the three must agree on which moments are peaks
  and how build-up is timed.
- **[Narrative Psychology](narrative-psychology.md).** The complementary
  driver — dopamine is the *reward* hook, narrative is the *meaning* hook.
  A Mastermind defeat is both a peak reward *and* "good triumphs"; the two
  frameworks reinforce the same moment from different angles.
- **[Villain Deck](villain-deck.md).** The source of variable reward (the
  reveal) and the menace counters (escape / twist).
- **[Gameplay Strategy](gameplay-strategy.md).** What "reward the skill, not
  the luck" *means*: the escalating-combo payoff is earned by that page's
  Rank-0 Hero Deck construction and Rank-1 play order, so the reward is
  attributed to a real decision rather than to the random draw.
- **[Vision](vision.md)** and **[Monetization Model](monetization-model.md).**
  The bright lines: the reward loop is free-game engagement craft, never a
  spend-pressure or pay-to-win surface.

## Edge Cases

- **Reward the skill, not the luck.** The escalating-combo hit is powerful
  precisely because the player *built* the deck that chained — attribute the
  payoff to their choice. Rewarding pure randomness the same way trains the
  wrong lesson and cheapens the real synergy peaks.
- **The counters climb for the villains, not the player.** Loss-aversion
  tension comes from `escapedVillains` / `twistCount` — but they are only
  *tension*, not a reward to celebrate. Don't fire a positive cue when the
  menace rises; save the payoff for discharging it.
- **`lastPlayEffectsFired` is a scalar, per-play, reset each turn.** It is
  not a running session tally — the escalating-reward mechanism is
  *within one play*, not cumulative across a turn. (Same signal caveat the
  visual/audio combo consumers live with.)
- **Peaks need valleys.** The peak-end and contrast mechanisms *depend* on
  the early/routine game being under-stated. Over-juicing the whole match
  flattens the very peaks this framework exists to create — this is a
  content-tuning constraint, not just a code one.
- **Determinism and boundaries are untouched.** Like every feel-layer
  framework, this is pure client-side reaction: it never reads into or
  writes `G`/`ctx`, never affects validation, never branches engine logic.
- **Stay inside the Vision bright lines.** This documents why the *free
  game* is satisfying. Anything that would convert reward psychology into
  spend pressure, artificial scarcity, or a compulsion loop is out of scope
  by [Vision](vision.md) rule — it belongs nowhere in this framework.

## Code Touchpoints

- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — `G.lastPlayEffectsFired`, the escalating-reward chain count
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — `game.lastPlayEffectsFired`, `progress.escapedVillains`,
  `scheme.twistCount`, `players[].woundCount`, `notableEvents` — every
  reward/threat/relief signal this framework times against
- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six event variants classified here as reward / threat / relief
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ESCAPE_LIMIT` — the peak-end finale and the
  loss-aversion ceiling
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — the read-only-projection
  boundary that keeps this a client-side timing contract, not engine logic

## Acceptance Criteria

This framework has no runtime of its own, so it is satisfied when the
sensory implementation it governs exhibits all of the following (each
observable in play). No Work Packet is scoped yet; when the visual/audio
WPs land, "the pacing contract holds" means:

- Routine actions (draw, single-effect play) stay visibly and audibly
  subtle; the Tier-1 peaks get the largest treatment.
- A synergy chain's visual and audio tiers **peak together** after a
  build-up beat (the shared `comboTierForCount` mapping).
- When one move resolves several spine events, the cues read as **one
  crescendo**, not a collision.
- **No** positive cue fires on a threat-class event or on rising menace.
- The endgame finale (peak-end) carries the heaviest treatment of the
  match.
- Nothing in the pacing layer reads or writes `G`/`ctx`, affects
  validation, or appears in the determinism hash.
- No mechanic gates play, pressures spend, or builds a compulsion loop.

## Decisions Pending

Open choices the visual/audio WPs must resolve (not recommendations):

- **Effect-priority table** — the concrete artifact this framework owes: an
  exact per-event reward weight both sensory layers consume, refining the
  [priority tiers](#priority-tiers) into a full ranking. The
  [visual–audio pairing](#visual-audio-pairing) table is the first draft (a
  per-event intensity band); the open work is turning the qualitative bands
  into the exact numeric weights a WP consumes.
- **Build-up timing per tier** — how long the anticipation micro-beat is
  before a combo / reveal payoff. Needs playtesting: too long feels laggy,
  too short kills the crescendo.
- **Simultaneous-event sequencing rule** — the merge/sequence algorithm for
  the "one crescendo per resolved move" invariant, shared by both layers.

## Deferred

Out of scope for v1:

- **Difficulty ↔ reward coupling** — modulating reward intensity by how
  close the menace counters are to the loss cap (a clutch win near the
  escape cap feels bigger). Buildable from `escapedVillains` /
  `scheme.twistCount`, but a Tier-3 tuning pass, not a v1 concern.

## References

- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the projected reward/threat signals
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo chain count's origin
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24221 (`lastPlayEffectsFired`,
  the escalating-reward chain signal), D-24228 (the shipped tiered combo cue
  this framework paces)
- [Vision](vision.md), [Monetization Model](monetization-model.md) — the
  bright lines: free-game engagement craft, never pay-to-win or
  spend-pressure
- Companion feel-layer pages: [Design System Overview](design-system-overview.md),
  [Visual Effects](visual-effects.md), [Sound Effects](sound-effects.md),
  [Narrative Psychology](narrative-psychology.md)
