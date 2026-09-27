---
title: Visual Effects Design Ancestry
type: Guide
tags:
  - visual
  - vfx
  - juice
  - design-ancestry
  - arena-client
  - phase-play
  - research
related:
  - visual-effects.md
  - design-system-overview.md
  - sound-effects.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\visual-effects-design-ancestry.md (this page — https://ewiki.legendary-arena.com/visual-effects-design-ancestry/)
  - ../apps/arena-client/src/vfx/comboVfxManifest.ts
  - ../apps/arena-client/src/components/play/VfxOverlay.vue
  - ../apps/arena-client/src/composables/useVillainSlashVfx.ts
  - ../apps/arena-client/src/composables/useSlashGesture.ts
  - ../apps/arena-client/src/components/play/HandRow.vue
  - ../apps/arena-client/src/components/play/handArc.ts
  - ../apps/arena-client/src/components/play/CardTile.vue
  - ../apps/arena-client/src/components/play/HQRow.vue
  - ../apps/arena-client/src/components/play/TopHudBar.vue
  - ../apps/arena-client/src/components/hud/EndgameSummary.vue
  - ../apps/server/src/bot-ally/botAllyDriver.mjs
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../packages/game-engine/src/hero/heroConditions.evaluate.ts
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-26
---

# Visual Effects Design Ancestry

## Summary

The in-game juice layer on `play.legendary-arena.com` is not inventing a new
feel language. It translates three proven commercial feel systems — *Candy
Crush Saga*, *Fruit Ninja* and *Hearthstone* — onto the shared trigger spine.
This page records, pattern by pattern, what the client has **adopted**
(shipped), what is **proposed** against the same contract, and what it
**deliberately does not copy**. It is background for the
[Visual Effects Framework](visual-effects.md): it adds no trigger, changes no
tier boundary, and does not reopen D-24365. The
[VFX Trigger Contract](visual-effects.md#vfx-trigger-contract) remains the
governance layer.

## Mechanics

### Why these three {#why-these-three}

Each game sells one sensation, and the three sensations map onto three
different parts of this client:

| Source game | Sensation it owns | What that means on this client |
|---|---|---|
| *Candy Crush Saga* | A cascade you can name, and a bigger cascade looks bigger | The combo scalar → the shared `comboTierForCount` → a burst, a call-out word and a sting that crest together |
| *Fruit Ninja* | The stroke is the attack, and the board keeps the mark | Slash to fight + the villain card split along the cut + the takedown words |
| *Hearthstone* | Cards are physical objects you lift, read and slam — and you can always tell what just happened | The hand lift and arc (shipped), the turn handoff, affordability at a glance, the ally-play reveal (mostly proposal) |

**One signal, many renderers still holds.** These games supply character and
pacing, not new engine events (VFX Invariant #6).

Two things these games teach are easy to miss because they are not
particles. First, **readability beats spectacle**: all three make it obvious
what just happened and what you can do next, and they pace the table so a
person can follow it. Second, **the effect happens where the action
happened**: a Candy Crush score pops on the candy that scored, and a Fruit Ninja
splash lands on the fruit that was cut.

### Candy Crush Saga — named cascades {#candy-crush}

**What the game does.** Candy Crush's juice is not the match. It is the cascade
after the match. Falling candies make new matches, and the board shouts an
escalating word as the chain grows (Sweet! → Tasty! → Delicious! → Divine!).
Three properties matter here:

- **The word names magnitude, not the tap.** A single match is quiet. The shout
  starts when a chain exists.
- **Each rung is drawn bigger than the last.** Particle count, camera punch and
  label scale ascend together.
- **The rarest rung is gated.** Divine is not "one more Sweet". It is a fourth,
  scarce ceiling.

The same game also pops a floating score on the piece that scored, and ends a
level with an end-of-level count-up that converts what is left into points
before the stars fill in.

**Adopted** — shipped on the one locked combo scalar
(`UIState.game.lastPlayEffectsFired` → `comboTierForCount`):

| Candy Crush pattern | Arena adoption | Status |
|---|---|---|
| An escalating on-screen word as the cascade grows | Synergy call-out: Team-Up! (medium) → Unstoppable! (big) → LEGENDARY! (≥ 5) | Shipped (WP-556) |
| Contrast through restraint — don't name a lone match | The flash starts at `small` (count 1); the word starts at `medium` (count 2) | Shipped (WP-556) |
| A bigger chain looks bigger | Particles 40 → 90 → 140 → 200 by tier; the impact pulse only at big / legendary | Shipped (WP-556) |
| A scarce fourth rung above the common cascade | The apex tier `>= 5 → legendary`, shared with the audio sting | Locked (D-24246); visual shipped (WP-556) |
| The word, burst and sound peak on the same beat | The shared renderer contract: same field, same tier map, same fire time, same intensity gate | Contract + shipped |
| Reduced motion keeps the noun | `shouldRender('word')` survives `low` and `prefers-reduced-motion`; shake and particles drop | Shipped (WP-556) |
| The rarest rung stops getting bigger | The `legendary` tier is a fixed 200 particles — the budget ceiling — so a chain of 9 throws the same burst as a chain of 5 | Shipped (WP-556) |

**Proposed, in character, same contract:**

- **Put the pop on the piece that scored.** Every burst except the villain-slash
  spray fires from one fixed spot just below screen centre
  (`origin: { x: 0.5, y: 0.62 }` in `VfxOverlay.vue`), including the
  mastermind-hit ladder. The villain slash already measures its City space.
  Anchoring the combo burst to the played card and the hit to the Mastermind
  tile is the Candy Crush lesson.
- **Float the number the player cares about.** The Candy Crush score pop is the
  score. Here that is the Attack and Recruit a play produced, read as the
  `economy` delta on the play frame (`+⚔ 4`, `+★ 2`). Floating the effect count
  (`lastPlayEffectsFired`) instead would read as "+3 Attack" when it means
  "three effects fired".
- **A short gold afterglow** on the card that set off a big or legendary chain,
  so the board remembers who detonated it.
- **The end-of-level count-up.** The closest analog to Candy Crush's level-end
  tally is the endgame report: VP counting up, penalties ticking off, then the
  grade stamping in. Today [`EndgameSummary.vue`](../apps/arena-client/src/components/hud/EndgameSummary.vue)
  renders the grade as a static badge. It is the frame players screenshot, and
  it appears on every outcome, so it also gives `scheme-wins` and `tie` a
  payoff. The scheme-wins and tie finales themselves stay proposal.

**Not copying:**

- Food-themed copy (Sweet / Tasty / Delicious / Divine). The words are owned by
  [Design System Overview → narrative meaning](design-system-overview.md#narrative-meaning);
  the shipped defaults are original superlatives.
- A fifth spoken rung, or any visual-only threshold past the apex. Tier
  boundaries may not diverge from audio.
- Particle density that keeps climbing past the 200-particle ceiling.
  LEGENDARY! stays rare by not getting bigger.
- Faction or character battle cries as a silent swap for the generic ladder.
  They are licensing-gated (D-24259) and stay off until the Marvel / Upper Deck
  scope covers on-screen catchphrases.

### Fruit Ninja — the stroke is the attack {#fruit-ninja}

**What the game does.** Fruit Ninja's juice is kinesthetic. A white blade trail
follows the finger; the fruit splits along the stroke; juice of the fruit's own
colour hits the dojo wall and lingers; three or more in one motion becomes a
named combo. The trail is cosmetic. The slice is the input.

**Adopted.** The City row is the dojo, and a villain in a space is the fruit.

| Fruit Ninja pattern | Arena adoption | Status |
|---|---|---|
| A blade trail follows the pointer | A white-core, lavender-glow tapered ribbon on the click-through overlay that fades within 170 ms | Shipped (WP-756) |
| The fruit splits along the cut | The card art is clipped into two halves; a click-fight uses a rotating per-defeat angle, a gesture fight takes the stroke's angle | Shipped (WP-755 / WP-756) |
| Juice sprays along the cut | A villain-purple droplet spray plus stains that fade over 2.4 s (full intensity only) | Shipped (WP-755) |
| Three or more in one motion earns a name | Same-player defeats within 4 s: DOUBLE TAKEDOWN! → TRIPLE TAKEDOWN! → RAMPAGE! | Shipped (WP-755) |
| The trail is juice, not rules | The gesture sends the same `fightVillain` intent a click does; the engine confirms each fight; the trail is hidden at intensity `off` and under reduced motion | Shipped (WP-756) |
| A tap is still a tap | A press becomes a stroke only after 8 px (mouse) or 16 px (touch / pen); on a scrolling row a 350 ms hold arms the slash | Shipped (WP-756 / WP-761) |
| The blade can be put away | A 🗡️ Slash to fight toggle beside Effect Intensity; on by default | Shipped (WP-756) |

Same family: the Excessive Violence crossed-swords slash-burst (WP-746) is the
"I meant to overspend" cousin of the City slash — steel and crimson instead of
fruit ink, gated by the same `shouldRender` contract.

**Proposed, in character:**

- **A 1–2 frame hit-stop** on the sliced halves at the moment of the cut, gated
  as `'shake'` so reduced motion never gets it. Fruit Ninja's slice feels heavy
  because time hiccups.
- **Per-villain or per-team splatter colour** (a named follow-up on the VFX
  page). Low payoff for the content work it needs.
- **Stains that persist on a City space** until the next card sits there or the
  turn ends. Treat this one with care: the City row is where players read
  villain art and fight costs, so ink that outlives the defeat can become noise
  over the next villain.

**Not copying:**

- Blade skins, dojo backgrounds, or Frenzy / Freeze bananas. Those are content
  unlocks, not feel.
- A speed or clock rule on the stroke. The full-crossing rule exists so no
  client clock is needed (VFX Invariant #5).
- Fail-juice on a Guard, a Patrol or a rejected choice. A skipped target stays
  quiet, and so does the 3 s abandon path.
- Letting the gesture spend Excessive Violence. A stroke only fights what the
  Fight button would allow when the stroke starts.

### Hearthstone — cards are objects, and the table is readable {#hearthstone}

**What the game does.** Most of Hearthstone's juice lives between the big
spells. A hand card lifts on hover; the hand sits on a fan; a draw flies from
the deck into a slot and the neighbours reflow; a play scales up so the other
player can read it, then slams to the board; a card glows when its condition is
live; the turn boundary is announced; the End Turn button tells you when you
are out of moves; damage shakes the thing that was hit; the AI takes its turn at
a pace a person can follow. The social contract is "I saw what you just did."

**Adopted.** This is the thinnest of the three ancestries on the live client.
The VFX page groups it apart from the notable-event juice as the
[client-local card-feel pass](visual-effects.md#card-interaction-feel): pointer,
hand contents and local affordances, with no new engine event.

| Hearthstone pattern | Arena adoption | Status |
|---|---|---|
| Hover lift on a hand card | The card rises 12 px and scales to 1.06 with a shadow and a `z-index` bump; pointer devices only, off at intensity `off` and under reduced motion; a disabled tile never lifts ([`CardTile.vue`](../apps/arena-client/src/components/play/CardTile.vue)) | Shipped (WP-699) |
| The hand fan / arc | A 24° shallow arc ([`handArc.ts`](../apps/arena-client/src/components/play/handArc.ts)); cards overlap past six instead of scrolling; the hovered card straightens and nudges its neighbours 12 px | Shipped (WP-699) |
| A draw flies in and the neighbours reflow | Proposal. One blocker: [`HandRow.vue`](../apps/arena-client/src/components/play/HandRow.vue) keys each card `${cardId}-${index}`, so a play re-keys every later card and Vue remounts them. Keys by occurrence (`cardId#n`) plus `<TransitionGroup>` give FLIP reflow with no new dependency | Proposal |
| The playable / mana-dim glow | Does not apply to the hand: playing a card costs nothing here, so a "playable" glow would light every non-Wound card and say nothing. The hand grey-out is dropped | Dropped (hand) |
| The "condition active" glow | A rim on hand cards whose superpower condition already holds for the cards in play — owner-only, projected by the engine (the WP-710 predicate `heroConditionHoldsForInPlay` already exists). It tells the player "play this now and it chains", and feeds the shipped combo ladder | Proposal — WP-776 drafted |
| Unaffordable dim where things cost something | The HQ gate ships (the button is disabled with a tooltip), but an unaffordable HQ hero looks the same as an affordable one at rest, and on touch there is no cue. City villains and the Mastermind turn their "Fight N" badge red when unaffordable (#2413), but that badge shows only when the projected cost differs from the printed one, so a printed-cost villain gets no cue either. The proposal turns the cost the player reads red, whichever badge that is | Proposal — WP-775 drafted |
| A legal-target highlight | A rim on the villains a slash would actually fight (the gesture only counts villains fightable when the stroke starts) | Proposal — WP-775 drafted |
| End Turn says when you are done | Deliberately not copied. #2044 made the active Step box the only turn guide, and the client cannot honestly know that no affordable action remains (Dodge and exorcise have no client surface, the heal lock and haunting are not applied to the board, and defeat requirements and several pending choices are not projected). A "done" cue that is sometimes wrong is worse than none | Declined (D-24612) |
| The turn is announced | A non-blocking YOUR TURN / PLAYER N'S TURN banner on a play-phase seat change, with the auditioned `turn-start.mp3` on your own turn only. Today the HUD's "Active:" label prints the raw seat id ([`TopHudBar.vue`](../apps/arena-client/src/components/play/TopHudBar.vue)). In solo the seat never changes, so nothing is announced, and the client has no seat names before gameover, so seats read "You" / "Player N" | Proposal — WP-774 drafted |
| The AI plays at a readable pace | The bot ally's move loop has no pause between moves — only retry back-offs ([`botAllyDriver.mjs`](../apps/server/src/bot-ally/botAllyDriver.mjs)) — so a solo player sees a bot turn land all at once | Proposal — WP-773 drafted |
| A played card is shown to the table | Blocked by D-12803: every other seat's `inPlayCards` / `inPlayDisplay` is redacted ([`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts)), so a viewer sees only `inPlayCount` tick up. D-12803 concedes in-play cards are face-up at a real table; superseding it is cheaper than a new event. Seats are teammates here, so this is ally awareness | Blocked on a D-12803 supersession |
| Damage shakes the damaged object | The full-bleed local-seat wound vignette ships (WP-650); a per-panel positional shake is the flagged follow-up | Partial |
| A legendary moment takes over the frame | The heroes-win gold storm, bloom and VICTORY! banner in its own overlay slot, seeded so a reconnect does not replay it | Shipped (WP-690; also on the Final Blow, WP-687) |

The [Surface 3](visual-effects.md#surface-3) action-move cues (the recruit pull
from the HQ, the play trail and place-ripple, the dodge flick) are the rest of
this ancestry. They fire from the local move dispatch, not from notable events.

**Not copying:**

- Golden-card looping shaders, foil tilt, or animated portraits. They are out of
  the library posture (D-24365) and the brand-token scope.
- A targeting arrow that implies a cost on `playCard`. Playing from hand costs
  nothing.
- Canned emotes and one-click rematch. Those are networked social and lobby
  features, not this layer.
- Driving the ally reveal off the game log. The log is narration, not a trigger
  vocabulary (D-20008 / D-20002).

### Cross-walk — one table {#cross-walk}

How the three ancestries land on the four VFX surfaces and the card-feel pass:

| Ancestry | Surface 1 notable events | Surface 2 combo | Surface 3 local moves | Surface 4 endgame | Card feel (client-local) |
|---|---|---|---|---|---|
| *Candy Crush* | — | Call-out ladder + scaled burst + shared tier map (shipped); card-anchored burst and `economy`-delta float (proposal) | — | Heroes-win storm (shipped); the tally-and-grade count-up and the scheme-wins / tie finales (proposal) | — |
| *Fruit Ninja* | Villain slash on `fightResolved`; the Excessive Violence slash (shipped) | Takedown words on a 4 s same-player window (shipped) | Slash to fight + the long-press arm (shipped) | — | The blade trail is juice, not rules (shipped) |
| *Hearthstone* | Wound vignette (shipped); per-panel shake, KO, capture and rescue (proposal) | — | Recruit / draw / play / dodge cues (proposal) | VICTORY! frame takeover (shipped) | Hover lift + arc (shipped); turn handoff, affordability, superpower rim, bot pacing (drafted); ally reveal (blocked on D-12803) |

### Shared rules these games taught {#shared-rules}

These are not new policy. They are why the
[VFX Trigger Contract](visual-effects.md#vfx-trigger-contract) looks the way it
does:

- **Name the link, not the tap** (*Candy Crush*). The flash at 1, the word at 2.
  Locked by WP-556.
- **The input can be the effect** (*Fruit Ninja*). Slash to fight sends a normal
  fight; the trail is presentation.
- **The object moves because you asked** (*Hearthstone*). Hover, fan, draw and
  the place-ripple never wait on a notable event.
- **Keep the noun when motion dies.** All three degrade to a readable label
  under reduced motion; `shouldRender('word')` is that rule.
- **One magnitude map.** Candy Crush's Divine is not a visual-only extra rung;
  the apex tier is shared with audio (D-24246).
- **Drop overflow, don't queue it.** None of the three stacks every simultaneous
  celebration. The event-storm coalescing algorithm is still the open shared
  piece with the audio layer.
- **Readability before spectacle** (*Hearthstone*). Pace the table, announce the
  turn, show what is affordable. These cost less than a new burst and pay off on
  every turn instead of once a combo.

## Interactions

- **[Visual Effects Framework](visual-effects.md)** — the contract, the four
  surfaces and the shipped WPs this page describes. Its
  [card-interaction feel](visual-effects.md#card-interaction-feel) table carries
  the same Hearthstone statuses as the table above.
- **[Design System Overview](design-system-overview.md)** — the
  [reward psychology](design-system-overview.md#reward-psychology) and
  [narrative meaning](design-system-overview.md#narrative-meaning) behind these
  choices, and the shared [event-priority contract](design-system-overview.md#event-priority)
  the coalescing algorithm must satisfy.
- **[Sound Effects](sound-effects.md)** — the audio twin of the same triggers,
  including the auditioned turn-start cue and the combo stings that crest with
  the Candy Crush ladder.

## Edge Cases

What "adopted" does **not** mean:

- **It does not mean the client should look like those games.** Palettes, type
  and brand marks stay on the Legendary Arena token system.
- **It does not mean new gameplay events.** VFX Invariant #6 still holds: VFX
  never invents a trigger. Two gaps stay open, for different reasons. The ally
  reveal is blocked by a **projection decision** — D-12803 redacts other seats'
  in-play cards — so it needs a D-12803 supersession, not a new event. Escape
  juice is blocked by the deferred `escapeResolved` **event** (D-20001).
- **It does not mean new libraries.** `canvas-confetti` plus hand-rolled CSS /
  WAAPI stay locked (D-24365). A Motion- or GSAP-driven hand would reopen that
  decision.
- **It does not mean shipping licensed Marvel cries** under cover of "Hulk
  Smash is just a Hearthstone voice line." Faction cries remain gated by
  D-24259.
- **"Opponent" is Hearthstone's word, not ours.** Hearthstone is one player
  against another. In Legendary Arena every seat shares one outcome, so the
  equivalent patterns are about reading an ally, not a rival.

## Open Questions

- **Supersede D-12803?** Making in-play cards public unblocks the ally reveal and
  lets the table see what a teammate played this turn. It is an engine
  projection decision (a filter change plus a DECISIONS entry), so it needs an
  explicit call before any reveal WP is drafted.
- **Event-storm coalescing.** The algorithm (queue / merge / suppress / replace)
  is still unpicked and must be decided together with audio. The Master Strike
  vignette is the natural place to decide it, because Loki's strike wounds every
  player who cannot reveal, so the strike vignette and the local wound vignette
  land on the same frame.

## References

- [Visual Effects Framework](visual-effects.md) — the governing page.
- [DECISIONS.md](../docs/ai/DECISIONS.md):
  - D-24365 — the VFX foundation, the library posture and the intensity gate.
  - D-24246 — the apex combo tier, shared by audio and visual.
  - D-24259 — faction battle cries are licensing-gated.
  - D-24584 / D-24585 / D-24592 — the villain slash, slash to fight, and the
    long-press slash.
  - D-24574 — the WP-750 fight-cost badge the HQ cue would mirror.
  - D-12803 — other seats' `inPlayCards` / `inPlayDisplay` are redacted.
  - D-20001 — the `NotableGameEvent` union and its minimal payload; `escapeResolved`
    deferred.
  - D-20002 / D-20008 — a notable event's narrative is plain English composed once
    by the engine, and a Mastermind defeat raises a curated event because the raw
    engine log is not a trigger vocabulary.
- WP-556, WP-690, WP-699, WP-746, WP-750, WP-755, WP-756, WP-761 — the shipped
  packets cited above.
- WP-773 (bot-ally turn pacing), WP-774 (turn handoff banner), WP-775
  (board affordability cues), WP-776 (superpower-ready glow) — drafted
  2026-09-26.
- [`heroConditions.evaluate.ts`](../packages/game-engine/src/hero/heroConditions.evaluate.ts)
  — `heroConditionHoldsForInPlay`, the WP-710 predicate the superpower rim
  would reuse.
