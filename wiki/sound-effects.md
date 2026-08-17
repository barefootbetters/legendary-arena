---
title: Sound Effects
type: Guide
tags:
  - layer-engine
  - trigger
  - phase-play
  - audio
  - music
  - motif
  - arena-client
  - research
related:
  - design-system-overview.md
  - master-strike.md
  - scheme-twist.md
  - villain-deck.md
  - turn-system.md
  - rule-execution-pipeline.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\sound-effects.md (this page — https://ewiki.legendary-arena.com/sound-effects/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/events/notableEvents.compose.ts
  - ../packages/game-engine/src/rules/ruleHooks.types.ts
  - ../packages/game-engine/src/moves/coreMoves.types.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../packages/game-engine/src/endgame/endgame.evaluate.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/turn/turnPhases.types.ts
  - ../apps/arena-client/src/composables/useComboCue.ts
  - ../apps/arena-client/src/components/play/AudioControls.vue
  - ../apps/arena-client/src/vfx/effectIntensity.ts
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-08-16
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
and lays out the danger-meter formula that would drive the music. It
also specs three richer layers on top: **motif-driven event cues**
(class/team leitmotifs, whose composition grammar lives on
[Music Authoring](music-authoring.md#motif-matrix)), a **tiered combo
cue** that escalates with the size of a synergy chain, and **endgame
stingers** for all three real match outcomes (heroes win, scheme wins,
tie). Most of this page is still `draft` research rather than an
implementation contract, but three pieces have **shipped**: the client-only
audio foundation (WP-412), the [Surface-2 player-action move cue](#surface-2)
(WP-421 / D-24241) fired on the local move dispatch, and the
[tiered combo cue](#tiered-combo) (WP-413 / D-24228) that rides the
`lastPlayEffectsFired` signal (D-24221).
The remaining sound mappings and library picks are proposals; the event
vocabulary, the endgame outcomes, the projected `UIState` signals, and the
architectural boundaries are sourced to code.

## Architecture & runtime status

Audio is a **pure client-side reaction to projected `UIState`** — it inherits
the [Feel-Layer Contract](design-system-overview.md#feel-layer-contract) in
full: client-side only; reads projected `UIState`, never `G` / `ctx` / the game
log; zero determinism footprint; degrades cleanly to silence. When several cues
want the same frame, the shared
[Event priority & coalescing contract](design-system-overview.md#event-priority)
governs the outcome — the audio layer MUST reach the **identical** decision as
the [visual layer](visual-effects.md), so a suppressed sting is also a
suppressed flash.

**Shipped** (live on `play.legendary-arena.com`):

- Client-only audio foundation — WP-412 / D-24224.
- Tiered [combo cue](#tiered-combo) (`combo-small` … `combo-legendary`) —
  WP-413 / WP-425 (D-24228 / D-24246); rides `lastPlayEffectsFired` (D-24221).
- [Surface-2](#surface-2) player-action move cues (five of six moves) —
  WP-421 / D-24241.

**Approved design** (contracted, not yet built):

- Surface-1 notable-event cues; Surface-4 endgame stingers.

**Research** (proposal-level, no WP scoped):

- [Motif playback](#motif-cues) wiring; the adaptive danger-meter score; the
  **voiced** [Arena Announcer](#arena-announcer) VO (its on-screen call-out
  twin shipped with WP-556 — only the *voice* is still unscoped).

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
player-visible outcomes. Six variants are locked, and — unlike the
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
| `healResolved` | A player uses the Wound Healing ability (KOs Wounds from hand) | Soft restorative chime / positive heal shimmer | Kenney Interface Sounds (positive); OpenGameArt 80 CC0 RPG SFX (heal) |

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

#### Surface 2 — Player action moves (tactile local feedback) {#surface-2}

The client dispatches these moves, so it plays a sound on the local
action for immediate tactile feedback — **independent of** (and ahead of)
the authoritative result. This is the one surface that fires on a *dispatch*
rather than a projected `UIState` frame, which is exactly why it can sound
`recruitHero` (which emits **no** notable event) and why the felt cues don't
wait on a server round-trip. **Five of these six moves shipped in WP-421**
(`playCard`, `recruitHero`, `fightVillain`, `drawCards`, `endTurn`); the sixth,
`dodgeCard`, is an engine-only move with no client dispatch path and is **not**
wired (see the callout below).

| Action (move) | Wired? | Fires when | Suggested sound character | Candidate CC0 source | R2 clip path | Preview |
|---|---|---|---|---|---|---|
| `playCard` | ✅ WP-421 | A card is played from hand | Card whoosh / place | OpenGameArt Card Game Sounds ("Play card") | `audio/sound-effects/play-card.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/play-card.mp3" >}} |
| `recruitHero` | ✅ WP-421 | A hero is recruited from HQ | Positive "purchase" chime | Kenney Interface Sounds; OpenGameArt Card Game Sounds | `audio/sound-effects/recruit-hero.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/recruit-hero.mp3" >}} |
| `fightVillain` | ✅ WP-421 | A player attacks a City villain | Sword/impact swing | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (blade) | `audio/sound-effects/attack-villain.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/attack-villain.mp3" >}} |
| `drawCards` | ✅ WP-421 | Start-of-turn draw / any draw | Card draw / short shuffle | OpenGameArt Card Game Sounds ("Draw card" / "Shuffle") | `audio/sound-effects/draw-cards.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/draw-cards.mp3" >}} |
| `dodgeCard` | ❌ engine-only | Dodge — discard a card to draw a replacement | Quick card flick | OpenGameArt Card Game Sounds ("Tap" / "Untap") | `audio/sound-effects/dodge.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/dodge.mp3" >}} |
| `endTurn` | ✅ WP-421 | The player ends their turn | Soft confirm / pass-turn notification | OpenGameArt Card Game Sounds ("Notification"); Kenney UI Audio | `audio/sound-effects/end-turn.mp3` | {{< audio-inline src="https://images.legendary-arena.com/audio/sound-effects/end-turn.mp3" >}} |

> **Shipped (WP-421 / EC-456, D-24241).** The five ✅ moves are **live**. The
> Surface-2 layer mirrors the Surface-1 pattern — a `move → clip` manifest
> ([`moveSfxManifest.ts`](../apps/arena-client/src/audio/moveSfxManifest.ts), a
> **partial** `Partial<Record<UiMoveName, string>>`) played by a consumer
> ([`useMoveSounds.ts`](../apps/arena-client/src/composables/useMoveSounds.ts))
> through the same [`audioEngine`](../apps/arena-client/src/audio/audioEngine.ts)
> as Surface 1 and the [combo cue](#tiered-combo), so it inherits the WP-412
> autoplay-unlock / master mute / master volume gates — **no** new dependency,
> engine, control, or channel. But it does **not** watch `UIState` like those two:
> the cue fires from the single `submitMove` dispatch chokepoint in
> [`App.vue`](../apps/arena-client/src/App.vue) **before** relaying intent to the
> live client, because a move cue must track the *local action* (a snapshot watch
> would miss `recruitHero`, which emits no event, and would delay the
> felt-immediately cues). The `R2 clip path` column is relative to the
> `images.legendary-arena.com/audio/sound-effects/` prefix (the repo image-URL
> rule — hyphens, never underscores) and matches `moveSfxManifest.ts`
> filename-for-filename.
>
> **`dodgeCard` is the one unwired row.** It is an **engine-only** move
> ([`packages/game-engine/src/moves/dodgeCard.ts`](../packages/game-engine/src/moves/dodgeCard.ts))
> — it is **not** in the `UiMoveName` union and the click-to-play surface has no
> dispatch path that emits it, so its clip **cannot** fire today. WP-421 leaves it
> unmapped (mapping it would not typecheck; a `moveSfxManifest.test.ts` case pins
> its absence) as a documented gap for a later UI-affordance WP that adds a dodge
> control.
>
> **Assets are live on R2.** The five CC0 move clips are already uploaded under
> `audio/sound-effects/` — GET-verified `200` / `content-type: audio/mpeg` / valid
> mp3 (`ID3`): `play-card.mp3` (11.8 KB), `recruit-hero.mp3` (3.6 KB),
> `attack-villain.mp3` (4.7 KB), `draw-cards.mp3` (10.0 KB), `end-turn.mp3`
> (4.4 KB). So the previews above play and the runtime cue is audible; the only
> WP-421 D-24026 step still open is the live eyeball on the deployed bundle once
> the code merges. (Code ships asset-independent anyway — tests mock the `Howl` —
> and a missing clip would be a fail-soft `play()` no-op.)

> **Recruit has no result event — and that is why Surface 2 is dispatch-keyed.**
> `recruitHero` emits no notable event; the only signals are the local move
> dispatch and the resulting `UIState.hq` slot / `discardCount` deltas. WP-421
> plays the recruit cue on the dispatch itself (the `submitMove` chokepoint),
> which is the only hook that fires for it at all.

#### Surface 3 — Turn lifecycle (rule triggers)

`onTurnStart` and `onTurnEnd` are two of the five `RuleTriggerName`
values; the client sees the effect as a turn boundary in `UIState`. A
subtle "your turn" cue is the main candidate here — used sparingly to
avoid fatigue.

#### Surface 4 — Outcome / endgame

[`evaluateEndgame`](../packages/game-engine/src/endgame/endgame.evaluate.ts)
resolves every match to exactly one of **three** outcomes —
[`EndgameOutcome`](../packages/game-engine/src/endgame/endgame.types.ts) is
`'heroes-win' | 'scheme-wins' | 'tie'`. Each deserves its own endgame
stinger:

| Outcome | Triggers (counter) | Stinger character |
|---|---|---|
| **`heroes-win`** | `mastermindDefeated` ≥ 1 (also Surface 1's notable event) | Triumphant **victory fanfare** + a **crowd cheer** — the biggest positive cue in the game |
| **`scheme-wins`** | `schemeLoss` ≥ 1 — *the scheme completes*. Since **D-24317** this is the **only** loss counter: the generic "8 villains escaped" condition was retired, and an escape-driven loss (Negative Zone, Midtown Bank Robbery) now latches `schemeLoss` through the scheme's own escaped-pile threshold | Dark, **deflating** loss sting + a **crowd boo**; the underlying reason (an escape stampede vs. the scheme snapping shut) can still take distinct stings — read it from the scheme's loss condition, not from a separate counter |
| **`tie`** | `finalTurnTie` ≥ 1 — a deck emptied and the final turn ended with no win or loss (WP-367 / D-24159) | Something **wry and unresolved** — neither fanfare nor dirge; good and evil both walk away |

Loss conditions checked before victory, so a simultaneous trigger resolves
as a loss (rulebook precedence). The two `scheme-wins` reasons and the
tie also feed the adaptive score below — escapes and twists escalate
`menace`, and the deck-exhaustion **final turn** is its own tense late-game
state.

> **The tie is real, and deck-exhaustion is *not* a loss.** A common
> mistake is to treat "a deck ran out" as a heroes-lose. In this engine an
> emptied Hero or Villain deck latches `finalTurnTriggered`, the current
> turn is played out, and if nobody has won or lost by its end the match is
> a **`tie`** (`finalTurnTie`). It is a first-class, tracked outcome — give
> it its own sting, don't fold it into the loss cue.

### Motif-driven event cues (class/team leitmotifs) {#motif-cues}

The generic clips above are the fast path — one fixed stinger per event. A
richer option layers a **composed leitmotif** on top of (or in place of)
the generic clip, so the Master Strike you hear is coloured by *who* struck
and *who* is at the table. The motif grammar — **major = heroes, minor =
villains, hero class → instrument, hero team → key, interval size →
power** — is specified on
[Music Authoring](music-authoring.md#motif-matrix); this section is the
*playback* side: which projected signal names the entity whose motif plays.

- **Master Strike** (`mastermindStrikeResolved`) → the acting
  **Mastermind's** minor motif. The client already knows the match's
  Mastermind (match configuration / `UIState`), so it can select the motif
  with no new event field.
- **Scheme Twist** (`schemeTwistResolved`) → the **Scheme's** minor motif.
- **A hero acting** (`playCard`, `fightResolved`, `recruitHero`) → that
  **hero's** major motif — its team's key, its class's instrument. The
  client knows the hero from the local move and HQ / in-play state.

Each of the 26 teams is pinned to one of the **twelve chromatic root notes**
(all twelve are in use), with the *side* setting the mode — **major for the
heroes, minor for the villains/masterminds**, and each villain group mirrored
onto the **same root as the hero team it opposes** (S.H.I.E.L.D. G major ↔
HYDRA G minor, X-Men D major ↔ Brotherhood D minor, and so on). The client
picks the playback key straight from the acting entity's team; it never has
to know music theory, just the team id. The full team→key table (and the
class→instrument map that picks the *timbre*) is the authoritative
composition data on
[Music Authoring → Team → key](music-authoring.md#team-keys).

Because teammates share a key, two heroes comboing produces **consonant,
harmonizing** motifs — a musical reward for on-team synergy that pairs with
the [tiered combo cue](#tiered-combo) below. Motifs are tiny generated
three-note phrases (MuseScore-rendered from the motif map by the
[generator](music-authoring.md#motif-matrix), D-24225), so they live in the
**SFX sprite** alongside the discrete clips (the long adaptive loops stay
separate — see below). When a single moment carries both a per-theme sting and
an entity motif — a Master Strike is both the `ES02` sting and the Mastermind's
minor motif — the two **layer**: the theme sting at full level, the entity
motif on top at **−6 to −9 dB** (identity over scenario weight; D-24226).

> **Signal note.** Motif *selection* needs only the acting entity's
> identity (class / team / alignment), which the client already has: the
> hero roster and the Mastermind / Scheme come from the match
> configuration and `UIState`. No new engine event is required to *pick* a
> motif — the only truly unsoundable moments are those with no event at all
> (villain escape; see Edge Cases).

### Tiered combo / synergy cue {#tiered-combo}

Reward clever play with **escalating** sound: when one card's effect
triggers another — and that triggers a third — the cue climbs with the size
of the chain, so bigger combos literally sound bigger. This is the audio
counterpart to the engine's hero-class synergy (the `requiresKeyword` /
`[hc:X]` gates that fire when the right classes are in play).

> **Shipped (WP-413 / EC-448, D-24228).** Unlike the rest of this page, the
> tiered combo cue is **live**, not a proposal — it was the missing signal
> that unblocked it. `UIState.game.lastPlayEffectsFired` (a hero-play
> synergy-effect count, D-24221) projects exactly the tally the earlier draft
> said the client "cannot see today." The arena-client
> [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts)
> composable watches that scalar and, on each increase, plays the matching
> clip from
> [`comboCueManifest.ts`](../apps/arena-client/src/audio/comboCueManifest.ts).
> It is client-only, reads the projected count, never touches `G`/`ctx`, and
> is hash-excluded — so determinism is untouched.

The shipped tiers key on `lastPlayEffectsFired`. The original three-tier
mapping (D-24228) was **extended with an apex fourth tier by WP-425 /
D-24246**, so the live boundaries are now
`0 → none, 1 → small, 2 → medium, 3–4 → big, ≥5 → legendary`:

| `lastPlayEffectsFired` | Clip | Feel |
|---|---|---|
| `1` | `combo-small` — rising **two-note sparkle** | "Nice — that linked." |
| `2` | `combo-medium` — the same shape, **higher and brighter** | The chain is building. |
| `3–4` | `combo-big` — a full ascending **flourish** | A satisfying pay-off — the game cheering you on |
| `>= 5` | `combo-legendary` — the apex **crescendo sting** | The rare, brag-worthy peak — the brand word lands (WP-425 / D-24246) |

The tiers **ascend** (each step higher than the last); when motifs are in
play a combo cue can be written in the acting hero's team key so it
harmonizes with the [motif](#motif-cues) that spawned it (a future layering
pass, not part of the shipped cue). The apex `combo-legendary` sting is the
audio half of the shared **`>= 5` LEGENDARY! tier** — the [visual call-out](visual-effects.md#synergy-callout)
consumes the *identical* boundary, one `comboTierForCount` (D-24246). The
audio sting shipped with WP-425 **and the on-screen `LEGENDARY!` call-out
shipped with WP-556** — so the apex boundary now drives **three** renderers
(the sting, the flash, and the on-screen word), one mapping.

Audition the four shipped tiers:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-small.mp3" caption="WP-413 combo cue (CC0) — tier 1 (lastPlayEffectsFired = 1), rising sparkle" >}}

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-medium.mp3" caption="WP-413 combo cue (CC0) — tier 2 (lastPlayEffectsFired = 2), higher and brighter" >}}

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-big.mp3" caption="WP-413 combo cue (CC0) — tier 3 (lastPlayEffectsFired = 3–4), ascending flourish" >}}

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/combo-legendary.mp3" caption="WP-425 combo cue — apex tier 4 (lastPlayEffectsFired >= 5), the LEGENDARY! crescendo" >}}

> **Contrast the villain side.** `FightResolvedEvent.appliedEffects` already
> lists the keywords that fired, so a villain-effect chain has always been
> countable — the hero-play `lastPlayEffectsFired` count (D-24221) is what
> brought the *hero* side to parity and made this cue buildable.

#### The voiced layer — announcer & faction cries (enhancement) {#combo-voice}

The four stings above are the *shipped* audio, and the **on-screen naming
layer that rides the same scalar now ships too** — the
[synergy call-out ladder](visual-effects.md#synergy-callout)
(**Team-Up! → Unstoppable! → LEGENDARY!**) landed with WP-556 as on-screen
text (the `small` tier flashes wordlessly, so the ladder's word starts at
`medium`; the earlier **Combo!** label for `small` was retired). What is
**not** yet built is the *voiced* layer over that text — a house **Arena
Announcer** speaking the ladder, layered over (or in place of) these stings,
plus the [faction battle cries](visual-effects.md#faction-cries)
(**AVENGERS ASSEMBLE!**, **HULK SMASH!** …). Two constraints carry straight
through from the [Arena Announcer spec below](#arena-announcer):

- **The on-screen text shipped; the voice is the remaining layer.** The
  word is live on the combo scalar (WP-556, the on-screen twin of the
  [`useComboCue`](visual-effects.md#combo-signal) pattern); a recorded or
  synthesized announcer VO is an added audio pass on top of
  `combo-small … combo-legendary` and never blocks the label.
- **Original team cries voice naturally; verbatim character cries stay
  text-first.** A team shout like "Avengers Assemble!" can be voiced by the
  original announcer, but first-person character lines ("Hulk Smash!") stay
  **text-first** — an announcer impersonating a Marvel character is an
  IP / casting matter, gated by the same
  [licensing pass](visual-effects.md#faction-cries) as the cries
  themselves (D-24259).

##### The Arena Announcer — an original voice, not a borrowed one {#arena-announcer}

*Candy Crush*'s call-outs are inseparable from **Mr. Toffee's** voice: the label and the vocal are one recognizable brand asset. The equivalent here is a house **Arena Announcer** — an original esports-caster / comic-splash narrator persona that voices the now-shipped on-screen [synergy call-out ladder](visual-effects.md#synergy-callout) (**"Team-Up!" … "Unstoppable!" … "LEGENDARY!"**). Two hard constraints:

- **Original, not an impression.** The announcer is *not* a Marvel character and never imitates one — no character voice, catchphrase, or name. It is the arena's own host, which keeps it clear of the [IP boundary](design-system-overview.md#ip-boundary-mandatory) and lets it become *our* recognizable asset (the [Soul / Authorial Voice](design-system-overview.md#soul-authorial-voice) test: a signature a player learns to recognize as *this* game).
- **The on-screen word shipped (WP-556); the voice is the enhancement.** The text call-out is **live** on the combo scalar — WP-556 shipped it as the on-screen twin of the [`useComboCue`](visual-effects.md#combo-signal) pattern, with the word starting at `medium` (the `small` tier flashes wordlessly). A *voiced* announcer is an added audio layer here — recorded VO or a synthesized voice, layered over (or in place of) the existing `combo-small` … `combo-legendary` stings — and can follow later without blocking the label. When voiced, it tracks the on-screen word: `medium` up (Team-Up! → Unstoppable! → LEGENDARY!), silent at `small` like the label.

**Original team cries voice naturally; verbatim character cries stay text-first.** A team shout like "Avengers Assemble!" can be voiced by the original announcer, but first-person character lines ("Hulk Smash!") stay **text-first** — an announcer impersonating a Marvel character is an IP / casting matter, gated by the same [licensing pass](visual-effects.md#faction-cries) as the cries themselves (D-24259).

Under the [Playstyle lens](design-system-overview.md#playstyle-modes) the ladder and the announcer re-theme with everything else: the **destroyer** skin swaps the heroic ladder for a conquest one (e.g. *Strike! → Havoc! → Domination! → CATACLYSM!*) in a harsher announcer register — same locked tiers, same scalar, pure re-skin. That variant is **Tier 3 / out of v1 scope**, like the rest of the lens.

### Adaptive background music — the danger meter

> **Shipped (WP-560).** The adaptive score is built. A separate music
> channel crossfades between three CC0 loops as
> `UIState.progress.menaceTier` moves `calm → rising → critical`, mounted
> beside the SFX consumers at the shared play root. Two implementation
> notes worth carrying forward: it runs on its **own** `musicEngine.ts`,
> because the shipped SFX engine is strictly fire-and-forget and could not
> loop or fade (D-24369 §1); and unlike the
> [Danger Meter](visual-effects.md), music is **decoration, not
> information** — it defaults on below SFX volume with its own toggle, and
> the master mute silences it (D-24369 §4).

The request: a background score that **intensifies as the villains get
closer to winning.** The engine now projects that progress directly, so
the score reads one number instead of reconstructing the loss rules.

#### The signal (projected by the engine, WP-557)

`UIState.progress` carries the whole signal (D-24366):

| Field | Meaning |
|---|---|
| `menace` | Normalized **0..1** progress toward the active scheme's Evil-Wins condition |
| `menaceTier` | The band `menace` falls in — `calm` / `rising` / `critical` |
| `schemeLossProgress` | The condition-aware numerator (twists, or matching escaped-pile entries) |
| `schemeLossThreshold` | The resolved denominator; **omitted** for a scheme with no fixed one |

**Read `menace` — do not recompute it.** The denominator is not a
constant: it comes from the active scheme's `lossThreshold` /
`lossThresholdByPlayerCount` (Super Hero Civil War is 8 at 2–3 players
but **5** at 4–5), and a scheme declaring a `resourceLossCondition` has
the twist clock suppressed entirely in favour of its own threshold
(D-24315). The engine resolves all of that in one place so the score and
the [visual danger meter](visual-effects.md) can never disagree.

> **Correction (WP-557).** An earlier version of this page specified
> `escapeProgress = escapedVillains / ESCAPE_LIMIT` with `ESCAPE_LIMIT = 8`.
> That formula is **retired**. **D-24317** removed the generic
> "8 villains escaped = evil wins" loss: escapes now end the game only for
> a scheme that declares an escaped-pile condition of its own (Negative Zone
> at 12 villains, Midtown Bank Robbery at 8 bystanders), and those are
> already folded into `menace`. Driving music off `escapedVillains / 8`
> would fill the meter toward a threshold that no longer ends anything.
> `UIState.progress.escapedVillains` remains projected, but as a statistic —
> not a loss clock.

#### The tiers

The band boundaries are a **shared contract** locked once for both the
score and the visual meter, so "critical" means the same thing in both:

| `menace` | `menaceTier` |
|---|---|
| `< 0.34` | `calm` |
| `>= 0.34` and `< 0.67` | `rising` |
| `>= 0.67` | `critical` |

A scheme with no fixed denominator (Super Hero Civil War's hero deck,
Legacy Virus's wound stack — both "the pile ran out" losses) omits
`schemeLossThreshold` and reports `menace` against the twist-count doom
clock those schemes already run on. `schemeLoss >= 1` remains terminal:
resolve straight to the win/loss sting and stop the loop.

#### Technique — horizontal now, vertical later (shipped horizontal)

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
| endgame | Win fanfare / loss sting / **wry tie sting** (one-shot), stop loop | `heroes-win` vs `scheme-wins` vs deck-exhaustion `tie` (Surface 4) |

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

### Sourcing candidates (CC0-first)

Per-event candidate picks are **not catalogued here** — a long list of
Freesound / OpenGameArt / Kenney names drifts fast and just duplicates the
Licensing posture source families below. To source a clip: take the **intent**
from the `Suggested sound character` column of the Surface 1 / Surface 1b /
[Surface 2](#surface-2) tables, then draw from a CC0 family in the
[Licensing posture](#licensing-posture) (Kenney, the OpenGameArt CC0 packs, or a
CC0-filtered Freesound search), auditioning against the
[Audio previews](#audio-previews) below. For **bespoke** per-theme / per-hero
music and stings, see [Music Authoring](music-authoring.md). Confirm each
asset's license on its own page before use.

### Audio previews

One CC0 candidate clip per event, hosted on R2 and embedded with the
`audio` shortcode — native `<audio>` controls, no JavaScript, so the
wiki's JS-free invariant holds. Representative picks, not final
selections; the shortcode is documented in
[Ewiki Authoring](ewiki-authoring.md). Grouped by the four signal
surfaces above.

> **The shipped-cue previews.** Two groups here audition exactly what
> `play.legendary-arena.com` plays today, filename-for-filename with the runtime
> manifests — keep them in sync, changing a filename here only when the manifest
> changes: (1) the six Surface-1 event clips (Master Strike, Scheme Twist, Villain
> Ambush, Villain defeated, Mastermind defeated, Heal) match
> [`sfxManifest.ts`](../apps/arena-client/src/audio/sfxManifest.ts); (2) the five
> Surface-2 move clips (Play a card, Recruit a hero, Attack a villain, Draw cards,
> End turn) match
> [`moveSfxManifest.ts`](../apps/arena-client/src/audio/moveSfxManifest.ts) (WP-421).
> The remaining previews — Dodge, Your turn begins, Wound / KO / bystander, and
> the endgame stings — are candidate picks for surfaces not yet wired (`dodgeCard`
> is engine-only; see [Surface 2](#surface-2)).

**Master Strike** — dramatic boss stinger:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" caption="OpenGameArt CC0 — Sinister Boss Appears" >}}

**Scheme Twist** — ominous approach:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/scheme-twist.mp3" caption="OpenGameArt CC0 — Evil Approach" >}}

**Villain Ambush (`ambushResolved`)** — a menacing entrance:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/ambush.mp3" caption="Shipped ambush.mp3 — WP-412 (CC0); the clip play.legendary-arena.com actually plays (sfxManifest.ts)" >}}

**Villain defeated** — a solid hit:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/villain-defeated.mp3" caption="OpenGameArt 80 CC0 RPG SFX — metal impact" >}}

**Mastermind defeated (`mastermindDefeated`)** — the full victory fanfare (the match's peak reward):

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/mastermind-defeated-win.mp3" caption="Shipped mastermind-defeated-win.mp3 — WP-412 (CC0); the clip play.legendary-arena.com actually plays (sfxManifest.ts)" >}}

**Heal (`healResolved`)** — a soft restorative chime:

{{< audio src="https://images.legendary-arena.com/audio/sound-effects/heal.mp3" caption="Restorative heal chime (CC0)" >}}

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

### Licensing posture (commercial-safe first) {#licensing-posture}

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

- **[Design System Overview → reward psychology](design-system-overview.md#reward-psychology).** The *why and when*
  behind these cues; its
  [visual–audio pairing table](design-system-overview.md#visual-audio-pairing) is
  the shared per-event signature this page and Visual Effects both implement,
  and its [flow-channel map](design-system-overview.md#flow-channel) shows where
  each moment sits across a match.
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
  returning players keep their preference. *(Shipped context: WP-556 added a
  persisted, unified **Effect-Intensity** control in
  [`AudioControls.vue`](../apps/arena-client/src/components/play/AudioControls.vue)
  whose **`off`** setting also flips the audio master mute — one switch
  silences the whole feel layer, audio and VFX together — so any new audio
  control should compose with that unified off, not add a parallel one.)*
- **Determinism is untouched.** Restated from the
  [Feel-Layer Contract](design-system-overview.md#feel-layer-contract): audio is
  pure client-side presentation — it never reads or writes `G` / `ctx`, never
  affects validation, and is absent from the state hash.
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
  — the six `NotableGameEventType` variants and their payloads
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
- [`apps/arena-client/src/composables/useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts)
  — the **shipped** tiered combo cue (WP-413 / EC-448); watches
  `lastPlayEffectsFired` and plays the tier clip on each increase
- [`apps/arena-client/src/audio/comboCueManifest.ts`](../apps/arena-client/src/audio/comboCueManifest.ts)
  — the combo-tier → clip map (`combo-small` / `combo-medium` / `combo-big`)
- [`apps/arena-client/src/audio/moveSfxManifest.ts`](../apps/arena-client/src/audio/moveSfxManifest.ts)
  — the **shipped** Surface-2 `move → clip` map (WP-421 / EC-456); a **partial**
  `Partial<Record<UiMoveName, string>>` over the five dispatchable action moves
- [`apps/arena-client/src/composables/useMoveSounds.ts`](../apps/arena-client/src/composables/useMoveSounds.ts)
  — the Surface-2 consumer; returns `playMoveSound(name)`, plays through the WP-412
  engine (no watch — imperative on dispatch)
- [`apps/arena-client/src/App.vue`](../apps/arena-client/src/App.vue)
  — the single Surface-2 wiring host: `playMoveSound(name)` in the `submitMove`
  dispatch closure, before relaying intent to the live client

## Open Questions

- **Partially shipped; the rest is unscoped.** The client-only audio
  foundation (WP-412), the [Surface-2 player-action move cue](#surface-2)
  (WP-421 / EC-456, five of six moves — `dodgeCard` is engine-only), and the
  [tiered combo cue](#tiered-combo) (WP-413 / EC-448) have landed. The remaining
  layers — Surface-3 turn-lifecycle cues, the Surface-4 endgame stings, the
  adaptive music score, and a dodge UI affordance so `dodgeCard` can be
  dispatched (and sounded) — still need a WP defining their contract.
- **Asset delivery — bundle vs CDN.** Ship clips/loops inside the
  arena-client bundle, or host them on R2 (the
  `images.legendary-arena.com` precedent suggests a `sounds.` / R2 path
  could work)? Music loops especially argue for CDN + lazy load.
- **Two gaps worth an event add.** (1) `escapeResolved` (WP-186) so
  villain escapes — including a bystander carried off — can be sounded;
  (2) a `heroRecruited` signal so recruit doesn't rely on client-side
  delta-watching. Both are optional; v1 SFX can proceed without them. *(A
  third former gap — a hero-play chain count — is now closed: the
  [tiered combo cue](#tiered-combo) escalates on `lastPlayEffectsFired`,
  D-24221 / D-24228.)*
- **Motif matrix — playback wiring.** The motif *grammar* and *production*
  are settled: the grammar on
  [Music Authoring](music-authoring.md#motif-matrix), the generator that
  renders the motifs from `audio-motif-map.json` under D-24225, the runtime
  **data home** under D-24227 (a slim registry generated into the arena-client
  build), and the sting **layering** under D-24226 (−6/−9 dB). Still open: the
  **per-entity note phrases** (the generator ships a systematic default today),
  and which WP wires motif *selection* into the [audio layer](#motif-cues) and
  packs the SFX sprite. No new engine event is needed to pick a motif — only
  the data and the playback code.
- **Music technique — decided (not open).** Horizontal re-sequencing with CC0
  loops for v1 is locked (see [Decision Summary](#decision-summary)); vertical
  stem layering is a future consideration only if a commissioned stemmed score
  exists.
- **Accessibility.** Respect a reduced-motion / reduced-audio
  preference and default volumes conservatively.

## Decision Summary

A 60-second read of where this page stands.

**Locked**

- Client-side audio only; `UIState`-driven; never reads `G` / `ctx` / the game
  log; zero determinism footprint (inherits the
  [Feel-Layer Contract](design-system-overview.md#feel-layer-contract)).
- CC0-first licensing (commercial-safe); avoid CC-BY-NC entirely.
- Combo tiers are shared with the
  [visual layer](visual-effects.md#synergy-callout) — one `comboTierForCount`,
  never a per-renderer copy.
- Simultaneous cues obey the shared
  [Event priority & coalescing contract](design-system-overview.md#event-priority).
- Adaptive music ships **horizontal re-sequencing** for v1.

**Shipped** — WP-412 foundation · WP-413 / WP-425 combo cue · WP-421 move cues.

**Deferred** — the `escapeResolved` event (WP-186) · motif playback wiring · the
voiced Arena Announcer VO (the on-screen call-out twin shipped with WP-556; only
the *voice* is deferred) · the adaptive-music implementation · a dodge UI
affordance so `dodgeCard` can be dispatched and sounded · vertical stem layering
(only if a commissioned stemmed score exists).

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (6 locked variants) + payloads; header notes
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
  added because `G.messages` is not projected), D-24159 / WP-367 (the
  deck-exhaustion final-turn **tie** — the third `EndgameOutcome`, driving
  the tie stinger), D-24221 (`lastPlayEffectsFired` — the hero-play
  synergy-effect count that unblocked the combo cue), D-24224 (the
  client-only, howler-backed audio foundation), D-24225 (the motif
  generator), D-24226 (motif × theme-sting layering at −6/−9 dB), D-24227
  (motif lookup as a slim runtime registry), D-24228 (the **shipped** tiered
  combo cue — WP-413 / EC-448), D-24241 (the **shipped** Surface-2 player-action
  move cue — WP-421 / EC-456; dispatch-keyed, five of six moves, `dodgeCard`
  engine-only)
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
