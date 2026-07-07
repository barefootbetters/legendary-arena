---
title: Sound Effects
type: Guide
tags:
  - layer-engine
  - trigger
  - phase-play
  - audio
  - arena-client
  - research
related:
  - master-strike.md
  - scheme-twist.md
  - villain-deck.md
  - turn-system.md
  - rule-execution-pipeline.md
  - monetization-model.md
status: draft
source:
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/events/notableEvents.compose.ts
  - ../packages/game-engine/src/rules/ruleHooks.types.ts
  - ../packages/game-engine/src/moves/coreMoves.types.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../packages/game-engine/src/endgame/endgame.evaluate.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/turn/turnPhases.types.ts
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-07-07
---

# Sound Effects

## Summary

This page is a **design reference** for adding audio to
`play.legendary-arena.com` — both discrete **sound effects** (Master
Strike, Scheme Twist, defeating a villain, gaining a wound, capturing a
bystander, recruiting a hero, and so on) and an **adaptive background
score** that intensifies as the villains close in on winning. It
catalogs the engine signals the client can actually observe, maps each
to a suggested sound, records where royalty-free source audio lives,
and lays out the danger-meter formula that would drive the music. No
audio ships today — this page is `draft` research, not an
implementation contract. The sound mappings and library picks are
proposals; only the event vocabulary, the projected `UIState` signals,
and the architectural boundaries are sourced to code.

## Mechanics

### The trigger surface

Audio is a **client-side presentation concern**. It can only react to
what the client actually receives — fields on the projected `UIState`
(chiefly the `notableEvents` stream) — **not** engine-internal `G` and
**not** the game log. `G.messages` is *not* projected to clients, so
any audio built on the log would work in the engine and silently do
nothing in the browser. The candidate signals, in decreasing order of
how ready they are to drive audio:

#### Surface 1 — Notable events (the primary, ready-made hook)

`NotableGameEvent` is the engine's append-only record of high-level
player-visible outcomes. Five variants are locked, and — unlike the
game log — they **are** projected as `UIState.notableEvents`. The arena
client already streams them through
[`useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
and renders them in
[`NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue).
A sound layer rides this exact stream — one clip per event type — with
zero new engine work.

| Event (`NotableGameEventType`) | Fires when | Suggested sound character | Candidate CC0 source |
|---|---|---|---|
| `mastermindStrikeResolved` | A Mastermind Strike card is revealed and resolved | Big dramatic orchestral **stinger** — the signature "uh-oh" moment | OpenGameArt CC0 Cinematic (danger / "Sinister Boss Appears") |
| `schemeTwistResolved` | A Scheme Twist is revealed and resolved | Ominous low sting; darker/subtler than a Strike | OpenGameArt CC0 Cinematic |
| `ambushResolved` | A villain with an `Ambush:` marker enters the City | Menacing whoosh / short threat sting | Kenney Impact Sounds; OpenGameArt CC0 Cinematic |
| `fightResolved` | A player defeats a villain or henchman in the City | Triumphant impact/hit, with a coin/bystander flourish when `bystandersRescued > 0` | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (coins/gems) |
| `mastermindDefeated` | All tactics defeated — the Mastermind is vanquished (win) | Victory fanfare — the biggest positive cue in the game | OpenGameArt CC0 Cinematic; Kenney RPG Audio |

#### Surface 1b — Sub-effects inside a fight or ambush (`appliedEffects`)

`FightResolvedEvent` and `AmbushResolvedEvent` don't just say "a fight
happened" — each carries `appliedEffects: VillainEffectKeyword[]` (the
villain-effect keywords that actually fired, in dispatch order) and a
human-readable `narrative`. That lets a sound layer play **finer cues
nested inside** a fight/ambush without any new engine event. The
keyword labels are defined in
[`notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts).

| Game moment | Client signal | Suggested sound | Candidate CC0 source |
|---|---|---|---|
| **Wound gained** | `appliedEffects` contains `gainWoundEachPlayer` / `gainWoundCurrentPlayer`; also a delta on `UIState.players[id].woundCount`; scheme wounds show as `schemeTwistResolved` with `resolverKey === 'woundAll'` | Dull painful thud / low impact | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (hurt) |
| **Hero KO'd** | `appliedEffects` contains `koHeroCurrentPlayer` / `koHeroEachPlayer` / `koHeroEachPlayerMag2`; the KO'd heroes are named in `narrative` | Sharp negative "loss" cue / shatter | Kenney Interface (negative); OpenGameArt 80 CC0 RPG SFX |
| **Bystander captured** | `appliedEffects` contains `captureBystander` | Ominous grab / capture sting | OpenGameArt CC0 Cinematic; Kenney Impact |
| **Bystander rescued** | `FightResolvedEvent.bystandersRescued > 0` (and `MastermindDefeatedEvent.bystandersRescued`) | Bright rescue chime / coin | OpenGameArt 80 CC0 RPG SFX (coins); Kenney Interface (positive) |

> **Precision limit.** `appliedEffects` carries the **keyword only** —
> not which bystander was captured or how many wounds each player took.
> A keyword is enough to trigger a sound; per-target detail is not
> available without new event fields (see Edge Cases).

#### Surface 2 — Player action moves (tactile local feedback)

The client dispatches these moves, so it can play a sound on the local
action for immediate tactile feedback (independent of the authoritative
result). The three core moves are `drawCards`, `playCard`, and
`endTurn`; the card-specific moves add fight/recruit/dodge.

| Action (move) | Fires when | Suggested sound character | Candidate CC0 source |
|---|---|---|---|
| `playCard` | A card is played from hand | Card whoosh / place | OpenGameArt Card Game Sounds ("Play card") |
| `recruitHero` | A hero is recruited from HQ | Positive "purchase" chime | Kenney Interface Sounds; OpenGameArt Card Game Sounds |
| `fightVillain` | A player attacks a City villain | Sword/impact swing | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (blade) |
| `drawCards` | Start-of-turn draw / any draw | Card draw / short shuffle | OpenGameArt Card Game Sounds ("Draw card" / "Shuffle") |
| `dodgeCard` | Dodge — discard a card to draw a replacement | Quick card flick | OpenGameArt Card Game Sounds ("Tap" / "Untap") |
| `endTurn` | The player ends their turn | Soft confirm / pass-turn notification | OpenGameArt Card Game Sounds ("Notification"); Kenney UI Audio |

> **Recruit has no result event.** `recruitHero` emits no notable
> event; the only signals are the local move dispatch and the
> resulting `UIState.hq` slot / `discardCount` deltas. The move-dispatch
> hook is the simplest place to play a recruit sound.

#### Surface 3 — Turn lifecycle (rule triggers)

`onTurnStart` and `onTurnEnd` are two of the five `RuleTriggerName`
values; the client sees the effect as a turn boundary in `UIState`. A
subtle "your turn" cue is the main candidate here — used sparingly to
avoid fatigue.

#### Surface 4 — Outcome / endgame

The three `ENDGAME_CONDITIONS` counters decide the match
([`endgame.evaluate.ts`](../packages/game-engine/src/endgame/endgame.evaluate.ts)).
The win side (`mastermindDefeated`) is covered by Surface 1's notable
event. The two loss conditions — `escapedVillains` reaching
`ESCAPE_LIMIT` (8) and `schemeLoss` reaching 1 — are candidates for a
single somber "heroes lose" sting, and they also drive the adaptive
score below.

### Adaptive background music — the danger meter

The request: a background score that **intensifies as the villains get
closer to winning.** The two loss conditions give a clean, already-
projected progress signal, so this is buildable client-side today.

#### The signal (confirmed projected)

- `UIState.progress.escapedVillains` — running count of villains that
  escaped the City (loss at `ESCAPE_LIMIT` = 8).
- `UIState.scheme.twistCount` — running count of Scheme Twists resolved
  (`twistPile.length`). The scheme flips `schemeLoss` to 1 when *its
  own* twist limit is reached (scheme-specific), and `schemeLoss >= 1`
  is terminal.

#### The formula

Compute a normalized 0..1 "menace" from whichever loss condition is
furthest along:

```
escapeProgress = escapedVillains / ESCAPE_LIMIT          // ESCAPE_LIMIT = 8
schemeProgress = twistCount / activeSchemeTwistLimit     // scheme-specific limit
menace         = clamp(max(escapeProgress, schemeProgress), 0, 1)
```

When the active scheme's twist limit isn't known to the client, treat
each resolved twist as a discrete escalation step and any
`schemeLoss >= 1` (or `escapedVillains >= 8`) as terminal — resolve
straight to the win/loss sting and stop the loop.

#### Technique — start horizontal, upgrade to vertical later

There are two ways to make music adaptive:

- **Horizontal re-sequencing** — crossfade between a few discrete,
  independently-composed loops as `menace` crosses thresholds.
- **Vertical layering** — play synchronized *stems* of one track and
  fade individual layers (drums, strings, brass) in as `menace` rises.

**Recommendation: ship horizontal re-sequencing first.** Vertical
layering needs stems recorded in sync — you cannot assemble that from
independent off-the-shelf CC0 tracks; it requires a commissioned or
self-produced score. Horizontal re-sequencing gets most of the effect
from any three loopable CC0 tracks and can be built now. Upgrade to
vertical layering later if a custom score with stems is produced.

A workable three-tier mapping:

| `menace` band | Music tier | Feel |
|---|---|---|
| `0.00 – 0.33` | Calm exploration loop | Early game; villains not yet a threat |
| `0.33 – 0.66` | Rising-tension loop | The scheme is progressing; pressure building |
| `0.66 – 1.00` | Critical / boss loop | Evil is one or two steps from winning |
| endgame | Win fanfare / loss sting (one-shot), stop loop | `mastermindDefeated` vs `schemeLoss`/escape cap |

One-shot stingers (Master Strike, Scheme Twist) briefly **duck** the
music, then it returns — a standard "sidechain" polish move.

#### Implementation shape

- **[howler.js](https://howlerjs.com/)** is the recommended wrapper:
  Web Audio with an HTML5 fallback, cross-browser, and it handles the
  crossfades, per-track gain, and the autoplay-unlock gesture.
- Keep two loops decoded at once (current tier + the tier being faded
  toward) to stay CPU-cheap; crossfade gain over ~1–2 seconds so tier
  changes aren't jarring.
- The music layer subscribes to `UIState`, recomputes `menace` on each
  update, and only crossfades when the tier actually changes.

#### Sourcing the score (CC0-first)

> For **bespoke per-theme** music (a unique score per scenario or hero
> rather than shared CC0 tracks), see [Music Authoring](music-authoring.md)
> — the Suno pipeline that produces the `ambient-loop` / `main-theme`
> tiers and event stings referenced from theme JSON. The CC0 options
> below are the generic fallback.

- **OpenGameArt CC0 music** — CC0, no attribution. Real tracks from the
  CC0 Cinematic Music pack map straight onto the tiers: calm —
  "Medieval: The Old Tower Inn" / "At Home - Orchestral"; tense —
  "Battle Theme A" / "Determined Pursuit"; critical — "Boss Battle
  Music" / "Sinister Boss Appears!" / "Prepare to fight"; win —
  "Victory Theme for RPG"; loss — "Laments of the War" / "Epic Endgame
  Cinematic". The base layer for the whole score.
- **Incompetech / Kevin MacLeod** — a large, high-quality tension and
  orchestral catalog, but **CC-BY (attribution required), not CC0.**
  Usable if the credit string is tracked; a paid no-attribution license
  (~$30/track) exists if you want it clean.
- Avoid CC-BY-NC (non-commercial) music entirely — see licensing below.

### Example sound picks per event/action

Three concrete, commercially-safe starting points per event. The
**Freesound** links are pre-filtered to CC0; the named **OpenGameArt**
and **Kenney** entries point at specific CC0 packs (audition and
confirm each asset's license on its page before use). These are
starting points to audition, not final picks.

**Master Strike (`mastermindStrikeResolved`)** — a big dramatic hit:
- OpenGameArt CC0 Cinematic — "Sinister Boss Appears!" (short intro sting)
- Kenney Impact Sounds — a heavy bell / metal impact
- [Freesound CC0: "orchestral hit"](https://freesound.org/search/?q=orchestral+hit&f=license:%22Creative+Commons+0%22)

**Scheme Twist (`schemeTwistResolved`)** — ominous, lower than a Strike:
- OpenGameArt CC0 Cinematic — "Evil Approach" (opening bars)
- [Freesound CC0: "ominous sting"](https://freesound.org/search/?q=ominous+sting&f=license:%22Creative+Commons+0%22)
- [Freesound CC0: "dark whoosh"](https://freesound.org/search/?q=dark+whoosh&f=license:%22Creative+Commons+0%22)

**Villain Ambush (`ambushResolved`)** — a menacing entrance:
- OpenGameArt 80 CC0 RPG SFX — a creature roar
- Kenney Impact Sounds — a sharp plate / punch impact
- [Freesound CC0: "monster roar"](https://freesound.org/search/?q=monster+roar&f=license:%22Creative+Commons+0%22)

**Villain defeated (`fightResolved`)** — a satisfying hit, coin flourish when a bystander is freed:
- Kenney Impact Sounds — a solid punch / metal impact
- OpenGameArt 80 CC0 RPG SFX — coins / gems (the bystander flourish)
- [Freesound CC0: "sword impact"](https://freesound.org/search/?q=sword+impact&f=license:%22Creative+Commons+0%22)

**Mastermind defeated / win (`mastermindDefeated`)** — the biggest positive cue:
- OpenGameArt CC0 Cinematic — "Victory Theme for RPG"
- OpenGameArt CC0 Cinematic — "A Legend Will Rise (Orchestral)"
- [Freesound CC0: "victory fanfare"](https://freesound.org/search/?q=victory+fanfare&f=license:%22Creative+Commons+0%22)

**Wound gained** — a dull, painful thud:
- OpenGameArt 80 CC0 RPG SFX — a creature "hurt"
- Kenney Impact Sounds — a soft body impact
- [Freesound CC0: "punch impact"](https://freesound.org/search/?q=punch+impact&f=license:%22Creative+Commons+0%22)

**Hero KO'd** — a sharp negative loss cue:
- Kenney Interface Sounds — an "error" / negative tone
- [Freesound CC0: "power down"](https://freesound.org/search/?q=power+down&f=license:%22Creative+Commons+0%22)
- [Freesound CC0: "defeat"](https://freesound.org/search/?q=defeat&f=license:%22Creative+Commons+0%22)

**Bystander captured** — an ominous grab:
- OpenGameArt 80 CC0 RPG SFX — chains
- OpenGameArt CC0 Cinematic — "Bit Forest stinger"
- [Freesound CC0: "chains"](https://freesound.org/search/?q=chains&f=license:%22Creative+Commons+0%22)

**Bystander rescued** — a bright reward chime:
- OpenGameArt 80 CC0 RPG SFX — coins / gems
- Kenney Interface Sounds — a "confirmation" / positive tone
- [Freesound CC0: "reward chime"](https://freesound.org/search/?q=reward+chime&f=license:%22Creative+Commons+0%22)

**Play card (`playCard`)** — a card whoosh / place:
- OpenGameArt Card Game Sounds — "Play card"
- [Freesound CC0: "card place"](https://freesound.org/search/?q=card+place&f=license:%22Creative+Commons+0%22)
- [Freesound CC0: "card flip"](https://freesound.org/search/?q=card+flip&f=license:%22Creative+Commons+0%22)

**Recruit hero (`recruitHero`)** — a positive purchase chime:
- Kenney Interface Sounds — a "confirmation" chime
- OpenGameArt 80 CC0 RPG SFX — coins
- [Freesound CC0: "cash register"](https://freesound.org/search/?q=cash+register&f=license:%22Creative+Commons+0%22)

**Attack a villain (`fightVillain`)** — a sword swing:
- OpenGameArt 80 CC0 RPG SFX — blade
- Kenney RPG Audio — a metal / impact hit
- [Freesound CC0: "sword swing"](https://freesound.org/search/?q=sword+swing&f=license:%22Creative+Commons+0%22)

**Draw cards (`drawCards`)** — a card draw / short shuffle:
- OpenGameArt Card Game Sounds — "Draw card"
- OpenGameArt Card Game Sounds — "Shuffle"
- [Freesound CC0: "card deal"](https://freesound.org/search/?q=card+deal&f=license:%22Creative+Commons+0%22)

**Dodge (`dodgeCard`)** — a quick card flick:
- OpenGameArt Card Game Sounds — "Tap" / "Untap"
- Kenney Interface Sounds — a "tick" / switch
- [Freesound CC0: "card swipe"](https://freesound.org/search/?q=card+swipe&f=license:%22Creative+Commons+0%22)

**End turn (`endTurn` / `onTurnEnd`)** — a soft confirm / pass:
- OpenGameArt Card Game Sounds — "Notification (pass turn)"
- Kenney UI Audio — a soft switch / confirm
- [Freesound CC0: "notification chime"](https://freesound.org/search/?q=notification+chime&f=license:%22Creative+Commons+0%22)

**Your turn begins (`onTurnStart`)** — a gentle attention cue:
- Kenney Interface Sounds — a "select" / bong tone
- OpenGameArt Card Game Sounds — "Notification"
- [Freesound CC0: "notification bell"](https://freesound.org/search/?q=notification+bell&f=license:%22Creative+Commons+0%22)

**Heroes lose (endgame — escape cap or `schemeLoss`)** — a somber sting:
- OpenGameArt CC0 Cinematic — "Laments of the War" (closing bars)
- OpenGameArt CC0 Cinematic — "Epic Endgame Cinematic"
- [Freesound CC0: "game over"](https://freesound.org/search/?q=game+over&f=license:%22Creative+Commons+0%22)

### Audio previews

One CC0 candidate clip per event, hosted on R2 and embedded with the
`audio` shortcode — native `<audio>` controls, no JavaScript, so the
wiki's JS-free invariant holds. Representative picks, not final
selections; the shortcode is documented in
[Ewiki Authoring](ewiki-authoring.md). Grouped by the four signal
surfaces above.

**Master Strike** — dramatic boss stinger:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" caption="OpenGameArt CC0 — Sinister Boss Appears" >}}

**Scheme Twist** — ominous approach:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/scheme-twist.mp3" caption="OpenGameArt CC0 — Evil Approach" >}}

**Villain Ambush** — a menacing entrance:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/villain-ambush.mp3" caption="OpenGameArt 80 CC0 RPG SFX — creature roar" >}}

**Villain defeated** — a solid hit:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/villain-defeated.mp3" caption="OpenGameArt 80 CC0 RPG SFX — metal impact" >}}

**Mastermind defeated (win)** — victory fanfare:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/mastermind-defeated-win.mp3" caption="OpenGameArt CC0 — Victory Theme for RPG" >}}

**Wound gained** — a dull, painful thud:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/wound-gained.mp3" caption="OpenGameArt 80 CC0 RPG SFX — creature hurt" >}}

**Hero KO'd** — a sharp negative cue:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/hero-ko.mp3" caption="Kenney Interface Sounds (CC0) — error" >}}

**Bystander captured** — an ominous grab:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/bystander-captured.mp3" caption="OpenGameArt 80 CC0 RPG SFX — chains" >}}

**Bystander rescued** — bright reward chime:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/bystander-rescued.mp3" caption="OpenGameArt 80 CC0 RPG SFX — coins" >}}

**Play a card** — card place:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/play-card.mp3" caption="Kenney Casino Audio (CC0) — card place" >}}

**Recruit a hero** — positive purchase chime:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/recruit-hero.mp3" caption="Kenney Interface Sounds (CC0) — confirmation" >}}

**Attack a villain** — a sword swing:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/attack-villain.mp3" caption="OpenGameArt 80 CC0 RPG SFX — blade" >}}

**Draw cards** — card draw:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/draw-cards.mp3" caption="Kenney Casino Audio (CC0) — card draw" >}}

**Dodge** — a quick card flick:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/dodge.mp3" caption="Kenney Casino Audio (CC0) — card flick" >}}

**End turn** — a soft confirm:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/end-turn.mp3" caption="Kenney Interface Sounds (CC0) — soft confirm" >}}

**Your turn begins** — a gentle attention cue:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/turn-start.mp3" caption="Kenney Interface Sounds (CC0) — attention tone" >}}

**Heroes lose** — a somber endgame cue:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/heroes-lose.mp3" caption="OpenGameArt CC0 — Epic Endgame Cinematic" >}}

### Where an audio layer would live

Audio belongs entirely in `arena-client` (the Vue app at
`play.legendary-arena.com`). Per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth and
the UI consumes read-only projections — so both the SFX layer and the
music layer read `UIState` (notable events + progress counters) and
play clips. They never write `G`, never influence an outcome, and add
**zero** engine or determinism footprint. Bot-vs-bot simulations,
replays, and determinism proofs are unaffected because none of them
render audio.

### Licensing posture (commercial-safe first)

`legendary-arena.com` is a commercial site, so the default is **CC0**
(public-domain dedication): no attribution, unrestricted commercial
use, no redistribution limits, and therefore no ongoing obligation that
could surface later. In order of fit:

- **Kenney.nl** — CC0, no attribution. Consistent, game-ready SFX packs
  (Interface, Impact, RPG Audio, UI Audio). The safest base layer.
- **OpenGameArt.org CC0 packs** — CC0, no attribution. Card Game
  Sounds, 80 CC0 RPG SFX, CC0 Cinematic Music, CC0 music loops. Verify
  each asset's license on its page — OpenGameArt hosts non-CC0 licenses
  too.
- **Freesound.org** — mixed licenses; a real API exists for
  programmatic search/download. Filter strictly to CC0 (or track CC-BY
  attribution). Use for one-off gaps, not the base layer.
- **Incompetech (music)** — CC-BY; excellent catalog, but carries a
  per-track credit obligation. Track it if used.
- **Zapsplat** — large library, but the free tier **requires crediting
  "ZapSplat"** in-project and forbids redistribution of the raw sounds.
  A fallback if the credit obligation is tracked; not the default.

**Avoid CC-BY-NC entirely** — the "NC" (non-commercial) clause makes it
unusable on a revenue-generating site.

## Interactions

- **[Master Strike](master-strike.md).** `mastermindStrikeResolved` is
  the highest-drama SFX candidate and a natural "spike the music"
  moment; the overlay it drives already exists.
- **[Scheme Twist](scheme-twist.md).** `schemeTwistResolved` is the
  sibling stinger, and each twist also advances `scheme.twistCount` —
  so it both plays a cue *and* pushes the music toward the next tier.
- **[Villain Deck](villain-deck.md).** The reveal pipeline produces the
  Ambush, Scheme Twist, and Master Strike events, increments
  `escapedVillains` on escape, and captures/attaches bystanders — the
  source of most audio triggers and the danger meter's escape count.
- **[Turn System](turn-system.md).** Supplies the `onTurnStart` /
  `onTurnEnd` lifecycle cues and the stage boundaries that gate when
  action-move sounds are legal.
- **[Rule Execution Pipeline](rule-execution-pipeline.md).** Emits the
  rule triggers; the audio layer only observes results, never the
  pipeline.
- **[Monetization Model](monetization-model.md).** Audio polish is a
  retention / perceived-quality lever, not a revenue vector in itself.
  Sound never gates play and never becomes pay-to-win; a cosmetic
  "sound pack" or alternate score would only ever be an optional
  flourish.

## Edge Cases

- **Bystander escaping with a villain has no client signal.** When a
  villain escapes the City it can carry a captured bystander away
  (lost), but the escape path is **log-only** — it narrates into
  `G.messages` and emits *no* notable event (deferred `escapeResolved`,
  WP-186 / D-20001, per the header of
  [`notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)).
  So "a bystander was carried off" — and villain escape generally —
  cannot be sounded today without adding that event. This is the one
  requested moment with no ready hook.
- **`appliedEffects` is keyword-only.** For wound / KO / bystander-
  capture cues, the event tells you the *kind* of effect but not the
  target or count (e.g. `captureBystander` with no bystander id; a
  wound keyword with no per-player tally). A keyword is enough to fire
  a sound; anything richer needs new event fields. Hero-KO is the
  exception — the KO'd heroes are named in `narrative`.
- **Do not drive audio off the game log.** `G.messages` is **not**
  projected to clients (per the `notableEvents.types.ts` header and
  D-20008). Only `notableEvents` and typed `UIState` surfaces reach the
  browser. Building audio on the log would work in the engine and do
  nothing in production.
- **The scheme twist limit is scheme-specific.** `schemeLoss >= 1` is
  the terminal flip, but the number of twists that trips it varies by
  scheme — there is no single "N twists = loss" constant. The danger
  meter should treat `twistCount` against the active scheme's limit
  where known, and otherwise escalate per-twist with `schemeLoss >= 1`
  as terminal.
- **Browser autoplay policy.** Browsers block audio until the first
  user gesture. Both layers need an interaction-gated "audio unlock"
  (first click/tap) before anything plays, plus persistent mute/volume
  controls (localStorage) — ideally separate SFX and music sliders — so
  returning players keep their preference.
- **Determinism is untouched, and must stay that way.** Audio is pure
  presentation: it must never read into or write out of `G`/`ctx`,
  never affect move validation, and never branch engine logic. The
  determinism invariant ([ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md))
  is a non-issue precisely because audio stays client-side.
- **Attribution obligations travel with the asset.** A CC0 clip is
  free-and-clear forever; a Zapsplat, Incompetech, or CC-BY asset
  carries a credit (and for Zapsplat, no-redistribution) obligation
  that must be tracked per-asset. Prefer CC0 to avoid a growing credits
  ledger.
- **Asset weight.** Keep SFX short and web-friendly (OGG/MP3/WebM);
  music loops are larger, so decide bundle-vs-CDN delivery deliberately
  (see Open Questions) and lazy-load tiers that aren't playing yet.

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the five `NotableGameEventType` variants and their payloads
  (`appliedEffects`, `bystandersRescued`, `narrative`, `resolverKey`)
- [`packages/game-engine/src/events/notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts)
  — where `appliedEffects` keyword labels (wound / KO / capture) are
  composed
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — `UIState` contract: `notableEvents`, `players[].woundCount`,
  `progress.escapedVillains`, `scheme.twistCount`, `hq`
- [`packages/game-engine/src/endgame/endgame.evaluate.ts`](../packages/game-engine/src/endgame/endgame.evaluate.ts)
  — the loss/win conditions the danger meter mirrors
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT`
- [`packages/game-engine/src/rules/ruleHooks.types.ts`](../packages/game-engine/src/rules/ruleHooks.types.ts)
  — `RuleTriggerName` (`onTurnStart` / `onTurnEnd`)
- [`packages/game-engine/src/moves/coreMoves.types.ts`](../packages/game-engine/src/moves/coreMoves.types.ts)
  — `CoreMoveName` (`drawCards` / `playCard` / `endTurn`)
- [`packages/game-engine/src/moves/recruitHero.ts`](../packages/game-engine/src/moves/recruitHero.ts)
  — recruit path (no notable event; HQ/discard deltas only)
- [`apps/arena-client/src/composables/useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
  — existing client stream of notable events; the natural attach point
  for a sound layer
- [`apps/arena-client/src/components/play/NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
  — existing overlay driven by the same stream

## Open Questions

- **No Work Packet is scoped yet.** This page is pre-design research.
  Implementation would need a WP defining the audio layer's contract,
  the SFX/music mute-volume UX, and initial event coverage.
- **Asset delivery — bundle vs CDN.** Ship clips/loops inside the
  arena-client bundle, or host them on R2 (the
  `images.legendary-arena.com` precedent suggests a `sounds.` / R2 path
  could work)? Music loops especially argue for CDN + lazy load.
- **Two gaps worth an event add.** (1) `escapeResolved` (WP-186) so
  villain escapes — including a bystander carried off — can be sounded;
  (2) a `heroRecruited` signal so recruit doesn't rely on client-side
  delta-watching. Both are optional; v1 can proceed without them.
- **Music: re-sequencing now, stems later?** Ship horizontal
  re-sequencing with CC0 loops for v1; revisit vertical layering only
  if a custom stemmed score is commissioned.
- **Accessibility.** Respect a reduced-motion / reduced-audio
  preference and default volumes conservatively.

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (5 locked variants) + payloads; header notes
  `G.messages` is not projected and `escapeResolved` is deferred
- [`packages/game-engine/src/events/notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts)
  — `appliedEffects` keyword labels
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — `progress.escapedVillains`, `scheme.twistCount`,
  `players[].woundCount`, `notableEvents`
- [`packages/game-engine/src/endgame/endgame.evaluate.ts`](../packages/game-engine/src/endgame/endgame.evaluate.ts),
  [`endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — loss/win conditions, `ESCAPE_LIMIT`
- [`packages/game-engine/src/rules/ruleHooks.types.ts`](../packages/game-engine/src/rules/ruleHooks.types.ts),
  [`moves/coreMoves.types.ts`](../packages/game-engine/src/moves/coreMoves.types.ts)
  — triggers and core moves
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections; determinism invariant
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-20001 (minimal notable-event
  payload; deferred `escapeResolved`), D-20008 (`mastermindDefeated`
  added because `G.messages` is not projected)
- Sound-effect libraries (verify each asset's license on its page):
  - [Kenney.nl — Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0)
  - [Kenney.nl — Impact Sounds](https://kenney.nl/assets/impact-sounds) (CC0)
  - [Kenney.nl — RPG Audio](https://kenney.nl/assets/rpg-audio) (CC0)
  - [OpenGameArt — Card Game Sounds](https://opengameart.org/content/card-game-sounds) (CC0)
  - [OpenGameArt — 80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) (CC0)
  - [Freesound.org](https://freesound.org/) (mixed licenses; API — filter to CC0)
  - [Zapsplat — Standard License](https://www.zapsplat.com/license-type/standard-license/) (free tier requires "ZapSplat" credit; no redistribution)
- Background-music libraries and adaptive-music technique:
  - [OpenGameArt — CC0 Music](https://opengameart.org/content/cc0-music-0) (CC0)
  - [OpenGameArt — CC0 Cinematic Music](https://opengameart.org/content/cc0-cinematic-music) (CC0)
  - [OpenGameArt — CC0 Fantasy Music & Sounds](https://opengameart.org/content/cc0-fantasy-music-sounds) (CC0)
  - [Incompetech / Kevin MacLeod](https://incompetech.com/music/royalty-free/music.html) (CC-BY — attribution required)
  - [howler.js](https://howlerjs.com/) — Web Audio wrapper for layered/crossfaded playback
  - [Vertical layering vs. horizontal resequencing](https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing) — adaptive-music technique primer
