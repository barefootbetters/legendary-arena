---
title: Split Card
type: Mechanic
tags:
  - layer-engine
  - layer-registry
  - hero-deck
  - data-shape
  - cvwr
  - status-partial
related:
  - transform.md
  - cardextid.md
  - card-type-taxonomy.md
  - card-effect-system.md
  - r2-image-naming-convention.md
  - play-board.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\split-card.md (this page — https://ewiki.legendary-arena.com/split-card/)
  - ../docs/legendary-universal-rules-v23.md
  - ../data/metadata/rules-full.json
  - ../data/cards/cvwr.json
  - ../data/cards/mgtg.json
  - ../data/cards/xmen.json
  - ../data/cards/msis.json
  - ../data/cards/bkwd.json
  - ../packages/registry/src/heroImageUrl.ts
  - ../packages/game-engine/src/setup/buildHeroDeck.ts
  - ../packages/game-engine/src/setup/buildCardTraits.ts
  - ../packages/game-engine/src/moves/splitFaceChoice.resolve.ts
  - ../apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue
  - ../apps/registry-viewer/src/registry/shared.ts
  - ../apps/registry-viewer/src/components/CardGrid.vue
  - ../apps/registry-viewer/src/components/CardDetail.vue
  - ../docs/ai/work-packets/WP-724-split-hero-choose-a-side-engine.md
  - ../docs/ai/work-packets/WP-725-split-hero-choose-a-side-client.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-26
---

# Split Card

## Summary

A **Split Card** is one physical Hero card with **two miniature Hero cards printed
side by side**. The rulebook calls it a **Divided Card**. When you play it, you pick
one half and use only that half. There are **39** of them across five sets (Civil
War has 20). Every surface that shows one has to answer the same question: *which
half is on the left?* The card data doesn't record that directly. This page explains
how to work it out.

## Mechanics

### The rule (Universal Rules v23, p. 49)

The rulebook's *Divided Cards* entry (p. 49; summarized as `divided` in
`data/metadata/rules-full.json`) sets four rules. Paraphrased:

| When | The card counts as… |
|---|---|
| **Recruiting** it from the HQ | **one cost**. Both halves print the same number, and you pay it once, not twice. |
| **Playing** it | **only the half you choose.** You get that half's Recruit, Attack and abilities, and ignore the other half "as if it didn't exist." |
| **Anywhere else** (hand, deck, discard, HQ…) | **both halves at once**: all their Hero Classes, Teams, card names and Hero Names. It is "a multicolored card", and its printed Attack/Recruit is the **total** of both halves. It is still **one card**, not two. |
| **After it's played** | only the chosen half. It is no longer multicolored. |

In the data, every one of the 39 pairs has **the same cost on both halves** and
**two different Hero Classes**, which is why the in-hand "counts as both" rule
matters.

### Reading the physical card: the lower slot is the left half

A split card is one **landscape** image with a portrait half on each side:

![Captain America, Secret Avenger — Inspire a Nation (left) / Inspire a Man (right)](https://images.legendary-arena.com/cvwr/cvwr-hr-captain-america-secret-avenger-inspire-a-man-inspire-a-nation.webp "width=360px")

In `data/cards/*.json` a split card is a `physicalCards[]` entry with two `sides`.
Each side is a normal `cards[]` entry with its own name, class, cost, abilities and
`slot`:

```json
{ "id": "p2", "count": 5, "sides": ["inspire-a-man", "inspire-a-nation"],
  "imageUrl": "…/cvwr-hr-captain-america-secret-avenger-inspire-a-man-inspire-a-nation.webp" }
```

**`sides[]` is not left-to-right order.** In the card above, `sides[0]` is
*Inspire a Man*, which is the **right** half. The image filename is built from
`sides[]` in the same order (D-14702), so it misleads the same way. **19 of the 39**
split cards list their faces in the opposite order to how they are printed. Most of
these are in Civil War, where `sides[]` is close to alphabetical.

**The reliable signal is `slot`: the face with the lower `slot` is the left half.**
We checked this by eye against the R2 images for 9 cards across all five sets,
including every sampled card where `slot` and `sides[]` disagree. All 39 pairs have
distinct slots. The registry viewer uses exactly this rule
(`orderSplitSidesLeftToRight` in `apps/registry-viewer/src/registry/shared.ts`).

> D-14702 *intended* `sides[]` to be physical order ("side A on the left/top … is
> first in the array"), and its Drax example holds. But the Civil War, X-Men, MCU
> Infinity Saga and Rocket & Groot entries were entered close to alphabetical and
> never reordered. Until the data is corrected, treat `sides[]` as an **identity**
> order, not a **layout** order.

### In the engine (WP-724 / WP-725)

- **Deck identity (D-24545).** `heroCardInstanceExtIds` in `buildHeroDeck.ts` emits
  **both** faces for each copy: a **primary** instance (`sides[0]`,
  `isPrimaryFace: true`) and an **alternate** instance (`sides[1]`). The shuffled
  Hero deck holds only primary instances, so one physical copy is still one draw.
  Stats, ability hooks, display data and traits are built for **both** faces.
  `buildSplitFaces` records a primary→alternate map in `G.splitFaces`. That map is
  present **only when the match has a split Hero**, so non-split games hash exactly
  as before.
- **Choose a side at play time (D-24546).** Playing a split card puts it in play as
  its primary face, holds back its economy and abilities, and creates a
  `PendingSplitFaceChoice` that blocks all other moves for the **active** player.
  `resolveSplitFaceChoice({ face: 'a' | 'b' })` swaps the in-play ext_id to the
  chosen face when needed, then grants that face's Attack/Recruit and fires its
  abilities. The bot always picks face `a`. Split is a **structural** property of the
  card, not a keyword, so no new `HeroKeyword` exists for it.
- **The prompt (WP-725).** `SplitFaceChoicePrompt.vue` shows two buttons labelled
  with each face's name, its `+N Attack / +N Recruit`, and its ability text (rendered
  through `AbilityText`).

### In the registry viewer (cards.legendary-arena.com)

- **Grid crop.** Both faces share one landscape image. A portrait tile cropped from
  the center shows the seam between the halves, so each face's tile is anchored to
  its own half with `object-position` (#2410).
- **Split badge.** Split faces show a **Split** badge in the top-left of the tile.
  Hovering it names the other half (#2417).
- **Card data.** The detail panel's data grid, and the Data view, show a
  **Split Card** row, e.g. *"Left half · other half: Inspire a Man"* (#2416).

## Interactions

- **[Transform](transform.md).** Both mechanics give one Hero card two forms. Their
  lifecycles differ. A Transformed card is a **separate** card kept aside outside
  the deck, and it swaps in on a trigger. A split card is **one** card whose face is
  chosen **every time it is played**. Both reuse the same strip-`#copy`-and-map
  ext_id swap when a face changes in play.
- **[CardExtId](cardextid.md).** Each face has its own ext_id
  (`<setAbbr>/<heroSlug>/<cardSlug>#<copyIndex>`). The alternate face reuses the
  primary's `#copyIndex`, so the two are recognizably the same physical copy.
- **Class and team gates** ([Card Effect System](card-effect-system.md)). Once the
  card is played, `G.cardTraits` is looked up by the **chosen** face's ext_id, so
  "play a [Strength] card" style synergies see the half you actually played.
- **Image naming** ([R2 Image Naming Convention](r2-image-naming-convention.md)).
  Two-sided heroes use `{setAbbr}-hr-{heroSlug}-{sides[0]}-{sides[1]}.webp`
  (D-14702), so the filename inherits the same ordering caveat as `sides[]`.
- **[Play Board](play-board.md).** While a choice is pending, every action move is
  blocked. The prompt is the only way forward.

## Edge Cases

- **Off-play the engine sees only one class, not both.** The rulebook says a split
  card in hand, deck or discard counts as **all** its classes, teams and names, is
  multicolored, and has a summed printed Attack/Recruit. The engine keeps an unplayed
  split card as its **primary** instance only. `buildCardTraits` gives each face its
  own trait entry, but a card that hasn't been played carries just the primary
  ext_id. So a check like "reveal a [Tech] Hero" or "a multicolored card" looking at
  your hand sees `sides[0]`'s class, not both. That under-credits the player. The
  gap isn't recorded as a decision yet.
- **The prompt's buttons follow `sides[]`, not the printed layout.** Face A (the
  first button) is always `sides[0]`, so on the 19 cards listed out of order the
  buttons appear in the opposite order to the card art.
- **Never read left/right from `sides[0]` or the filename.** Use `slot` (lower =
  left). The engine's `isPrimaryFace` means "listed first in the data", not "left
  half". Don't conflate them.
- **The printed cost counts once.** Both halves always print the same cost; the
  recruit cost is that number, not the sum.
- **Summed printed values only apply off-play.** When something reads a split card's
  printed Attack/Recruit while it isn't in play, the rulebook uses the total of both
  halves. Once it's played, only the chosen half counts.

## Data Files

Every split card, grouped by set. **Left** and **Right** are the printed layout,
worked out from `slot`. **`sides[0]` = left?** shows whether the data's own order
happens to match the layout.

| Hero | Set | Card | Left half | Right half | Cost | Copies | `sides[0]` = left? |
|---|---|---|---|---|---|---|---|
| Captain America, Secret Avenger | Civil War | ![Inspire a Nation / Inspire a Man](https://images.legendary-arena.com/cvwr/cvwr-hr-captain-america-secret-avenger-inspire-a-man-inspire-a-nation.webp "width=120px") | **Inspire a Nation** (Strength) | **Inspire a Man** (Instinct) | 3 | 5 | no |
| Cloak & Dagger | Civil War | ![Above / Below](https://images.legendary-arena.com/cvwr/cvwr-hr-cloak-dagger-above-below.webp "width=120px") | **Above** (Covert) | **Below** (Ranged) | 3 | 5 | yes |
| Cloak & Dagger | Civil War | ![Darkness / Light](https://images.legendary-arena.com/cvwr/cvwr-hr-cloak-dagger-darkness-light.webp "width=120px") | **Darkness** (Covert) | **Light** (Ranged) | 6 | 3 | yes |
| Cloak & Dagger | Civil War | ![Flee / Fight](https://images.legendary-arena.com/cvwr/cvwr-hr-cloak-dagger-fight-flee.webp "width=120px") | **Flee** (Covert) | **Fight** (Ranged) | 4 | 5 | no |
| Daredevil | Civil War | ![Hidden Identity / Revealed Identity](https://images.legendary-arena.com/cvwr/cvwr-hr-daredevil-hidden-identity-revealed-identity.webp "width=120px") | **Hidden Identity** (Instinct) | **Revealed Identity** (Strength) | 6 | 6 | yes |
| Falcon | Civil War | ![Talk with Birds / Squawk Back](https://images.legendary-arena.com/cvwr/cvwr-hr-falcon-squawk-back-talk-with-birds.webp "width=120px") | **Talk with Birds** (Ranged) | **Squawk Back** (Instinct) | 4 | 5 | no |
| Goliath | Civil War | ![Brilliant Biochemist / Massive Warrior](https://images.legendary-arena.com/cvwr/cvwr-hr-goliath-brilliant-biochemist-massive-warrior.webp "width=120px") | **Brilliant Biochemist** (Tech) | **Massive Warrior** (Strength) | 4 | 5 | yes |
| Hercules | Civil War | ![Manly Dullard / Boy Genius](https://images.legendary-arena.com/cvwr/cvwr-hr-hercules-boy-genius-manly-dullard.webp "width=120px") | **Manly Dullard** (Strength) | **Boy Genius** (Tech) | 3 | 5 | no |
| Hulkling | Civil War | ![Half-Kree / Half-Skrull](https://images.legendary-arena.com/cvwr/cvwr-hr-hulkling-half-kree-half-skrull.webp "width=120px") | **Half-Kree** (Strength) | **Half-Skrull** (Covert) | 4 | 5 | yes |
| Luke Cage | Civil War | ![Cautious / Reckless](https://images.legendary-arena.com/cvwr/cvwr-hr-luke-cage-cautious-reckless.webp "width=120px") | **Cautious** (Strength) | **Reckless** (Instinct) | 3 | 5 | yes |
| Patriot | Civil War | ![Incredible Effort / Effortless](https://images.legendary-arena.com/cvwr/cvwr-hr-patriot-effortless-incredible-effort.webp "width=120px") | **Incredible Effort** (Covert) | **Effortless** (Tech) | 5 | 3 | no |
| Peter Parker | Civil War | ![Protect My Family / Hot Bowl of Soup](https://images.legendary-arena.com/cvwr/cvwr-hr-peter-parker-hot-bowl-of-soup-protect-my-family.webp "width=120px") | **Protect My Family** (Tech) | **Hot Bowl of Soup** (Instinct) | 2 | 3 | no |
| Speedball | Civil War | ![Double Down / Bubble Up](https://images.legendary-arena.com/cvwr/cvwr-hr-speedball-bubble-up-double-down.webp "width=120px") | **Double Down** (Ranged) | **Bubble Up** (Covert) | 5 | 3 | no |
| Stature | Civil War | ![Crush Ants / Crush File Sizes](https://images.legendary-arena.com/cvwr/cvwr-hr-stature-crush-ants-crush-file-sizes.webp "width=120px") | **Crush Ants** (Strength) | **Crush File Sizes** (Tech) | 5 | 5 | yes |
| Storm & Black Panther | Civil War | ![Gathering Rain Clouds / Gathering Clues](https://images.legendary-arena.com/cvwr/cvwr-hr-storm-black-panther-gathering-clues-gathering-rain-clouds.webp "width=120px") | **Gathering Rain Clouds** (Ranged) | **Gathering Clues** (Instinct) | 2 | 5 | no |
| Storm & Black Panther | Civil War | ![Lightning Strike / Pouncing Strike](https://images.legendary-arena.com/cvwr/cvwr-hr-storm-black-panther-lightning-strike-pouncing-strike.webp "width=120px") | **Lightning Strike** (Ranged) | **Pouncing Strike** (Instinct) | 3 | 5 | yes |
| Storm & Black Panther | Civil War | ![Tsunami of Water / Tsunami of Justice](https://images.legendary-arena.com/cvwr/cvwr-hr-storm-black-panther-tsunami-of-justice-tsunami-of-water.webp "width=120px") | **Tsunami of Water** (Ranged) | **Tsunami of Justice** (Covert) | 5 | 3 | no |
| Tigra | Civil War | ![Friendship / Ferocity](https://images.legendary-arena.com/cvwr/cvwr-hr-tigra-ferocity-friendship.webp "width=120px") | **Friendship** (Covert) | **Ferocity** (Instinct) | 2 | 5 | no |
| Vision | Civil War | ![Lighter than Air / Harder than Diamond](https://images.legendary-arena.com/cvwr/cvwr-hr-vision-harder-than-diamond-lighter-than-air.webp "width=120px") | **Lighter than Air** (Ranged) | **Harder than Diamond** (Tech) | 6 | 3 | no |
| Wiccan | Civil War | ![Supersonic Spells / Supersonic Speed](https://images.legendary-arena.com/cvwr/cvwr-hr-wiccan-supersonic-speed-supersonic-spells.webp "width=120px") | **Supersonic Spells** (Ranged) | **Supersonic Speed** (Covert) | 4 | 3 | no |
| Star-Lord | MCU Guardians of the Galaxy | ![Give / Take](https://images.legendary-arena.com/mgtg/mgtg-hr-star-lord-give-take.webp "width=120px") | **Give** (Covert) | **Take** (Ranged) | 4 | 2 | yes |
| Gamora | MCU Guardians of the Galaxy | ![Forgive / Resent](https://images.legendary-arena.com/mgtg/mgtg-hr-gamora-forgive-resent.webp "width=120px") | **Forgive** (Covert) | **Resent** (Instinct) | 2 | 2 | yes |
| Rocket & Groot | MCU Guardians of the Galaxy | ![Passion / Compassion](https://images.legendary-arena.com/mgtg/mgtg-hr-rocket-groot-compassion-passion.webp "width=120px") | **Passion** (Tech) | **Compassion** (Covert) | 2 | 3 | no |
| Rocket & Groot | MCU Guardians of the Galaxy | ![Don't Press this Button / Press the Button](https://images.legendary-arena.com/mgtg/mgtg-hr-rocket-groot-dont-press-this-button-press-the-button.webp "width=120px") | **Don't Press this Button** (Ranged) | **Press the Button** (Tech) | 4 | 3 | yes |
| Rocket & Groot | MCU Guardians of the Galaxy | ![Tricky / Simple](https://images.legendary-arena.com/mgtg/mgtg-hr-rocket-groot-simple-tricky.webp "width=120px") | **Tricky** (Tech) | **Simple** (Strength) | 5 | 2 | no |
| Drax | MCU Guardians of the Galaxy | ![Remove his Spine / Also Illegal](https://images.legendary-arena.com/mgtg/mgtg-hr-drax-rhomann-dey-remove-his-spine-also-illegal.webp "width=120px") | **Remove his Spine** (Strength) | **Also Illegal** (Instinct) | 6 | 2 | yes |
| Drax | MCU Guardians of the Galaxy | ![I am Invisible / Xandar is Invincible](https://images.legendary-arena.com/mgtg/mgtg-hr-drax-irani-rael-i-am-invisible-xandar-is-invincible.webp "width=120px") | **I am Invisible** (Instinct) | **Xandar is Invincible** (Tech) | 4 | 3 | yes |
| Mantis | MCU Guardians of the Galaxy | ![Selfless / Selfish](https://images.legendary-arena.com/mgtg/mgtg-hr-mantis-selfish-selfless.webp "width=120px") | **Selfless** (Instinct) | **Selfish** (Ranged) | 4 | 3 | no |
| Aurora & Northstar | X-Men | ![Blazing Flare / Blazing Fists](https://images.legendary-arena.com/xmen/xmen-hr-aurora-northstar-blazing-flare-blazing-fists.webp "width=120px") | **Blazing Flare** (Ranged) | **Blazing Fists** (Strength) | 4 | 5 | yes |
| Colossus & Wolverine | X-Men | ![Reliable / Unpredictable](https://images.legendary-arena.com/xmen/xmen-hr-colossus-wolverine-reliable-unpredictable.webp "width=120px") | **Reliable** (Strength) | **Unpredictable** (Instinct) | 3 | 5 | yes |
| Legion | X-Men | ![Bend Steel / Bend Light](https://images.legendary-arena.com/xmen/xmen-hr-legion-bend-light-bend-steel.webp "width=120px") | **Bend Steel** (Strength) | **Bend Light** (Covert) | 2 | 5 | no |
| Legion | X-Men | ![Channel Time / Channel Fire](https://images.legendary-arena.com/xmen/xmen-hr-legion-channel-fire-channel-time.webp "width=120px") | **Channel Time** (Instinct) | **Channel Fire** (Tech) | 5 | 3 | no |
| Legion | X-Men | ![Split Personality / Split Eardrums](https://images.legendary-arena.com/xmen/xmen-hr-legion-split-eardrums-split-personality.webp "width=120px") | **Split Personality** (Tech) | **Split Eardrums** (Ranged) | 3 | 5 | no |
| Wanda & Vision | MCU The Infinity Saga | ![Rage / Grief](https://images.legendary-arena.com/msis/msis-hr-wanda-vision-grief-rage.webp "width=120px") | **Rage** (Covert) | **Grief** (Tech) | 5 | 2 | no |
| Wanda & Vision | MCU The Infinity Saga | ![Hold On / Let Go](https://images.legendary-arena.com/msis/msis-hr-wanda-vision-hold-on-let-go.webp "width=120px") | **Hold On** (Covert) | **Let Go** (Ranged) | 3 | 3 | yes |
| Wanda & Vision | MCU The Infinity Saga | ![Magic / Science](https://images.legendary-arena.com/msis/msis-hr-wanda-vision-magic-science.webp "width=120px") | **Magic** (Ranged) | **Science** (Tech) | 5 | 2 | yes |
| Falcon & Winter Soldier | Black Widow | ![Attune / Atone](https://images.legendary-arena.com/bkwd/bkwd-hr-falcon-winter-soldier-attune-atone.webp "width=120px") | **Attune** (Ranged) | **Atone** (Strength) | 3 | 5 | yes |
| Falcon & Winter Soldier | Black Widow | ![Relocate / Reload](https://images.legendary-arena.com/bkwd/bkwd-hr-falcon-winter-soldier-relocate-reload.webp "width=120px") | **Relocate** (Instinct) | **Reload** (Tech) | 4 | 5 | yes |
| Falcon & Winter Soldier | Black Widow | ![New Wings / New Plan](https://images.legendary-arena.com/bkwd/bkwd-hr-falcon-winter-soldier-new-wings-new-plan.webp "width=120px") | **New Wings** (Tech) | **New Plan** (Covert) | 5 | 3 | yes |

## History

- **WP-138 / WP-140**: two-sided hero cards first entered the data (39 entries
  across `bkwd`, `mgtg`, `cvwr`, `msis`, `xmen`).
- **D-14101 (WP-141)**: `G.heroDeck` carried only `sides[0]`, so the second face
  could never be played.
- **D-14702 (WP-147)**: two-sided image filenames use `sides[]` order, intended as
  physical order.
- **D-24545 / D-24546 (WP-724, #2213)**: both faces enumerated into `G`; face
  chosen at play time. Un-defers D-14101.
- **WP-725 (#2214)**: `SplitFaceChoicePrompt.vue`.
- **#2410 / #2416 / #2417 (2026-09-26)**: registry viewer crops each face to its own
  half by slot, shows a Split Card data row, and adds a Split badge on grid tiles.

## References

- Rule: `docs/legendary-universal-rules-v23.md`, *Divided Cards* (p. 49), with the
  summary in `data/metadata/rules-full.json` (`key: "divided"`).
- Card data: `data/cards/{cvwr,mgtg,xmen,msis,bkwd}.json` (`physicalCards[].sides`,
  `cards[].slot`).
- Image filename builder: `packages/registry/src/heroImageUrl.ts` (D-14702).
- Deck identity + `G.splitFaces`: `packages/game-engine/src/setup/buildHeroDeck.ts`
  (`heroCardInstanceExtIds`, `buildSplitFaces`), D-24545.
- Per-face traits: `packages/game-engine/src/setup/buildCardTraits.ts`.
- Choice move: `packages/game-engine/src/moves/splitFaceChoice.resolve.ts`
  (`isSplitCardInstance`, `resolveSplitFaceChoice`), D-24546.
- Client prompt: `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue`
  (WP-725).
- Registry viewer: `apps/registry-viewer/src/registry/shared.ts`
  (`orderSplitSidesLeftToRight`, `physicalCardImageHalf`, `splitPartnerName`),
  `CardGrid.vue`, `CardDetail.vue`, `CardDataDisplay.vue`.
- Work packets: `docs/ai/work-packets/WP-724-split-hero-choose-a-side-engine.md`,
  `docs/ai/work-packets/WP-725-split-hero-choose-a-side-client.md`.
- Decisions: `docs/ai/DECISIONS.md` D-14101, D-14702, D-24545, D-24546.
