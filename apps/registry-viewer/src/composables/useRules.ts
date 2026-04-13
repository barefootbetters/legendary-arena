/**
 * useRules.ts
 * Provides static rule glossary and keyword definitions for the registry viewer.
 *
 * Two lookup sources:
 *   RULES_GLOSSARY  — 18 game-mechanic rules from seed_rules.sql, keyed by code.
 *                     Referenced in ability text as [rule:X].
 *   KEYWORD_GLOSSARY — Common gameplay keywords that appear across multiple sets,
 *                      keyed by lowercase keyword name.
 *                      Referenced in ability text as [keyword:X].
 *
 * Ability text may also contain icon/hc/team tokens which are handled by
 * parseAbilityText() but do not have definitions — they're rendered as labels only.
 */

export interface RuleEntry {
  label:   string;
  summary: string;
}

// ── Rules glossary (from seed_rules.sql) ──────────────────────────────────────
// Key: rule code value (matches [rule:X] tokens in ability text)
export const RULES_GLOSSARY: Map<string, RuleEntry> = new Map([
  ["shards", {
    label:   "Shards",
    summary: "Shard tokens represent cosmic energy. Players can spend a Shard for +1 Attack. Villains and Masterminds gain +1 Attack per Shard on them.",
  }],
  ["multiclasscards", {
    label:   "Multiclass Cards",
    summary: "A multiclass card counts as both of its Hero Classes. Great for triggering multiple Superpower Abilities.",
  }],
  ["multiplemasterminds", {
    label:   "Multiple Masterminds",
    summary: "When Villains escape, they can ascend to become additional Masterminds. All Masterminds must be defeated to win.",
  }],
  ["divided", {
    label:   "Divided Card",
    summary: "A Divided Card has two mini-cards printed on one card. When played, choose which side to use. The cost is the cost of one side, not both.",
  }],
  ["traps", {
    label:   "Traps",
    summary: "When a Trap is played from the Villain Deck, you must complete a challenge this turn to avoid it. Success puts it in your Victory Pile.",
  }],
  ["locations", {
    label:   "Locations",
    summary: "Locations are placed above city spaces. They don't move and don't count as Villains. Fight them by spending the listed Attack to claim them.",
  }],
  ["transformingschemes", {
    label:   "Transforming Schemes",
    summary: "Double-sided Schemes that flip over mid-game. Start with the Setup side face up. When told to Transform, flip it over.",
  }],
  ["adaptingmasterminds", {
    label:   "Adapting Masterminds",
    summary: "Adapting Masterminds have only Tactic cards — no main card. The top Tactic counts as the Mastermind. After each Strike, Adapt: shuffle Tactics and reveal a new one on top.",
  }],
  ["villainousweapons", {
    label:   "Villainous Weapons",
    summary: "Weapons captured by Villains boost their Attack. When you defeat that Villain, you claim the Weapon as an Artifact for your own hand.",
  }],
  ["asterisk", {
    label:   "Asterisk Symbol (*)",
    summary: "A * on VP or Attack means there's something unusual about that value — like Size-Changing or a special condition required to fight.",
  }],
  ["sidekicks", {
    label:   "Sidekicks",
    summary: "Pay 2 Recruit to take one Sidekick per turn from the Sidekick Stack. When played, return it to the bottom of the Stack.",
  }],
  ["chooseavillain", {
    label:   "Choose a Villain Group",
    summary: "Pick one specific Villain Group by name. You can count Henchman Groups but not multiple groups at once via shared words.",
  }],
  ["veiledschemes", {
    label:   "Veiled Schemes",
    summary: "Start with this side face up. At a certain point it transforms into a randomly selected Unveiled Scheme.",
  }],
  ["unveiledschemes", {
    label:   "Unveiled Schemes",
    summary: "The transformed version of a Veiled Scheme. Use these rules once the Scheme has flipped to this side.",
  }],
  ["woundsonvillains", {
    label:   "Wounds on Villains",
    summary: "Place a Wound on a Villain to give it -1 Attack. Wounds are returned to the Wound Stack when that Villain is defeated or leaves the city.",
  }],
  ["ambushschemes", {
    label:   "Ambush Schemes",
    summary: "Played alongside the main Scheme. Triggers an immediate effect when drawn. Scheme Twists now trigger both Schemes. Defeat the Ambush Scheme for bonus VP.",
  }],
  ["grievouswounds", {
    label:   "Grievous Wounds",
    summary: "Harder-to-heal Wounds with unique Healing abilities like \"Spend 5 Recruit to KO this Wound.\" Still count as Wounds for all effects.",
  }],
  ["enragingwounds", {
    label:   "Enraging Wounds",
    summary: "Wounds that can be played from hand for bonuses like Recruit or Attack. Each has a unique Healing condition. Still count as Wounds for all effects.",
  }],
  // Generic rule references found in ability text
  ["additional mastermind", {
    label:   "Additional Mastermind",
    summary: "This enemy ascends to become an additional Mastermind. All Masterminds must be defeated to win. No Tactics — fight it once to claim it.",
  }],
  ["transforms", {
    label:   "Transforms",
    summary: "Flip this double-sided card over to its other face. Use only the rules now showing.",
  }],
]);

// ── Keyword glossary (complete, sourced from keywords-full.json) ─────────────
// Key: lowercase keyword code (matches the base keyword in [keyword:X] tokens).
// Card data uses mixed-case variations like "Berserk", "Focus 2", "Patrol the Bank".
// The lookupKeyword() function normalizes these to match against base keywords.
export const KEYWORD_GLOSSARY: Map<string, string> = new Map([
  ["teleport", "Instead of playing, you may set aside a card with the keyword \u201cTeleport\u201d. If you do, add it to your new hand at the end of your turn as an extra card."],
  ["bribe", "You can fight villains with the keyword \u201cBribe\u201d by spending any combination of Attack and/or Recruit points."],
  ["versatile", "This keyword represents Heroes who think quickly on their feet to react perfectly to any situation. \u201cVersatile 2\u201d means \u201cYou get +2 Recruit or +2 Attack.\u201d You choose all Recruit or all Attack when you play the card."],
  ["focus", "The \u201cFocus\u201d keyword lets you transform your Recruit Points into powerful, flexible effects. When you play a card with a Focus ability, you can pay the cost on the left side to get the effect on the right side, as many times as you want."],
  ["burrow", "\u201cBurrow\u201d means: \u201cFight: If the Streets were empty, put this Villain back into the Streets.\u201d When you fight a Villain with Burrow, do all of that Villain\u2019s Fight effects."],
  ["cosmicthreat", "Villains with Cosmic Threat have incredibly high Attack values with a special vulnerability. If an enemy has Cosmic Threat Ranged, that means: \u201cOnce per turn, for each Ranged card you reveal, this Enemy gets \u22123 Attack this turn.\u201d"],
  ["wallcrawl", "\u201cWall-Crawl\u201d means: \u201cWhen you recruit this Hero, you may put it on top of your deck.\u201d"],
  ["feast", "\u201cFeast\u201d means \u201cFight: KO the top card of your deck.\u201d Likewise, \u201cFeast on each player\u201d means \u201cKO the top card of each player\u2019s deck.\u201d"],
  ["demolish", "\u201cDemolish each player\u201d means \u201cReveal the top card of the Ally/Hero Deck, note its cost, and put it on the bottom of the Ally/Hero Deck. Each player reveals their hand and discards each card with that cost.\u201d"],
  ["dodge", "Dodge means \u201cDuring your turn, you may discard this card from your hand to draw another card.\u201d When you Dodge a card from your hand, ignore all the other text on that card."],
  ["elusive", "\u201cElusive 6\u201d means \u201cYou can only fight this Adversary if you have made at least 6 Recruit this turn.\u201d You don\u2019t have to spend that Recruit, you just have to have made that much."],
  ["xtremeattack", "\u201cX-Treme Attack\u201d means \u201cThis Adversary gets +1 Attack for each other Adversary in the city with X-Treme Attack.\u201d"],
  ["artifact", "When you gain a Hero Artifact, put it in your discard pile. When you draw that Artifact later, you may play it in front of you and use its effects. It stays in front of you for the rest of the game."],
  ["thrownartifact", "Thrown Artifacts can be \u201cthrown\u201d at the perfect moment. After playing it, instead of keeping it in play, put it into your discard pile at end of turn (or use it once and discard)."],
  ["uruenchantedweapons", "Uru-Enchanted Weapons combine nanotech and nuclear fusion to mimic the power of the fabled Mjolnir."],
  ["riseofthelivingdead", "\u201cRise of the Living Dead\u201d means \u201cEach player checks the top card of their Victory Pile. If that card is a Villain with a Rise of the Living Dead ability, that Villain reenters the city.\u201d"],
  ["crossdimensionalrampage", "\u201cCross-Dimensional Hulk Rampage\u201d means \u201cEach player reveals one of their Hulk Heroes or a Hulk card in their Victory Pile or gains a Wound.\u201d Similar for other character rampages."],
  ["spectrum", "You can use a card\u2019s Spectrum abilities only if you have at least 3 classes of Hero (e.g. Covert, Strength and Ranged). Grey S.H.I.E.L.D. Heroes and normal Sidekicks don\u2019t have classes."],
  ["patrol", "You can use the Patrol ability only if the specified city space has no cards in it. If that city space becomes empty later in the turn, it\u2019s too late to use the Patrol ability."],
  ["circleofkungfu", "\u201c5th Circle of Kung-Fu\u201d means \u201cDuring your turn, this Villain has +5 Attack unless you reveal a Hero that costs 5 or more.\u201d Likewise for other Circles."],
  ["fatefulresurrection", "\u201cFight: Fateful Resurrection\u201d means \u201cReveal the top card of the Villain Deck. If it\u2019s a Scheme Twist or Master Strike, this Villain reenters the city.\u201d"],
  ["charge", "\u201cAmbush: Charge one space\u201d means after this Villain enters the Sewers, it charges forward an extra space, pushing other Villains forward. This might cause more escapes."],
  ["manoutoftime", "This keyword means \u201cAfter you use this card\u2019s abilities, set it aside. At the end of this turn, put it on the bottom of your deck.\u201d Represents heroes fighting in both past and present."],
  ["savior", "This means \u201cUse this ability if you have at least 3 Bystanders in your Victory Pile.\u201d"],
  ["abomination", "This keyword is used by Villains that are twisted genetic experiments. \u201cAbomination\u201d means \u201cThis gets +1 Attack for each Abomination card in the KO pile.\u201d"],
  ["sizechanging", "Some Hero cards say \u201cSize-Changing: Covert.\u201d This means \u201cThis card\u2019s printed Attack is also its Victory Points. When you play this card, it has the Covert class.\u201d"],
  ["phasing", "During your turn, if a card with Phasing is in your hand, you may swap it with the top card of your deck."],
  ["fortify", "Some Villains say \u201cEscape: Fortify the Mastermind. While it\u2019s fortified, the Mastermind can\u2019t be fought.\u201d Put this Villain on the specified place; while there, it has the listed effect."],
  ["shieldclearance", "If a Villain says \u201cS.H.I.E.L.D. Clearance,\u201d you must discard a S.H.I.E.L.D. Hero as an additional cost to fight that Villain."],
  ["excessiveviolence", "Some Heroes say \u201cExcessive Violence: Draw a card.\u201d You can use this ability by spending 1 Attack more than you need when you fight a Villain."],
  ["revenge", "\u201cRevenge for Evil Deadpool Corpse\u201d means \u201cThis Villain gets +1 Attack for each Evil Deadpool Corpse Villain in your Victory Pile.\u201d"],
  ["investigate", "\u201cInvestigate for a Tech card\u201d means \u201cLook at the top two cards of your deck. Reveal a Tech card from among them and draw it. Put the rest back on the bottom of your deck.\u201d"],
  ["hiddenwitness", "Represents Villains and Masterminds hiding behind layers of informants, victims, and stooges. Hidden Witnesses are Bystanders captured face-down."],
  ["xgene", "\u201cX-Gene Ranged: You get +2 Attack\u201d means \u201cIf you have a Ranged card in your discard pile, you get +2 Attack.\u201d"],
  ["piercingenergy", "Some Heroes give you \u201cPiercing Energy\u201d points. Piercing Energy can be used to fight enemies and ignores effects that would increase the enemy\u2019s Attack."],
  ["berserk", "\u201cBerserk\u201d means \u201cDiscard the top card of your deck. You get +Attack equal to the discarded card\u2019s printed Attack.\u201d If the discarded card gives \u201c+2 Attack\u201d, you count 2."],
  ["soaringflight", "\u201cSoaring Flight\u201d means \u201cWhen you recruit this Hero, set it aside. At the end of this turn, add it to your new hand as an extra card.\u201d"],
  ["lightshow", "Once per turn, if you played at least two Lightshow cards this turn, you can use a single Lightshow ability from any of those cards."],
  ["dominate", "Some Villains \u201cDominate\u201d Hero cards. This means \u201cPut those Heroes under this enemy. This enemy gets +1 Attack for each Hero it\u2019s Dominating.\u201d"],
  ["humanshield", "\u201cAmbush: This Villain captures 2 Human Shields\u201d means the Villain captures the top 2 cards of the Bystander Stack face-down. You can\u2019t fight a Villain while it has any Human Shields."],
  ["dangersense", "\u201cDanger Sense 2\u201d means \u201cReveal the top 2 cards of the Villain Deck. You get +1 Attack for each Villain you revealed. Put them all back in the same order.\u201d"],
  ["striker", "This means \u201cThis gets +1 Attack for each Master Strike in the KO pile and/or stacked next to the Mastermind.\u201d"],
  ["coordinate", "Coordinating allows you to let another player \u201cborrow\u201d one of your cards. Put a card from your hand in front of another player. On that player\u2019s next turn, they play it and return it to you afterward."],
  ["cheeringcrowds", "\u201cCheering Crowds\u201d means \u201cYou may play this card twice in a row if you return a Bystander from your Victory Pile to the bottom of the Bystander Stack.\u201d"],
  ["transform", "Each Hero in this set has special \u201cTransformed\u201d cards. When you play a card that says Transform, swap it with one of your Transformed cards."],
  ["outwit", "\u201cOutwit\u201d means \u201cYou may reveal a Tech Hero from your hand. If you do, use this Outwit ability.\u201d Represents genius-level intellect characters."],
  ["smash", "\u201cSmash 3\u201d means \u201cYou may discard another card from your hand. If you do, you get +3 Attack.\u201d"],
  ["woundedfury", "\u201cWounded Fury\u201d means \u201cYou get +1 Attack for each Wound in your discard pile.\u201d"],
  ["conqueror", "\u201cBridge Conqueror 3\u201d means \u201cThis gets +3 Attack while any Villain is on the Bridge.\u201d"],
  ["microscopicsizechanging", "Far beyond other Size-Changing heroes, Ant-Man and Wasp can shrink down smaller than an atom, to the quantum Microverse."],
  ["empowered", "\u201cYou get Empowered by Strength\u201d means \u201cYou get +1 Attack for each Strength card in the HQ.\u201d"],
  ["chivalrousduel", "You can\u2019t gang up on an enemy in a Chivalrous Duel \u2014 you have to pick just one Hero Name to duel the enemy."],
  ["symbiotebonds", "You must fight the combined strength of the host and symbiote to split them apart, then finish what remains in a second fight."],
  ["digest", "\u201cDigest 2: Draw a card\u201d means use this ability only if you have at least 2 cards in your Victory Pile."],
  ["indigestion", "Indigestion abilities trigger when Carnage or Venom is eating somebody and gets indigestion \u2014 reversing Digest effects in chaotic ways."],
  ["switcheroo", "\u201cSwitcheroo 4\u201d means \u201cYou may swap a card from your hand with a card from the HQ that costs 4 or less.\u201d"],
  ["hyperspeed", "\u201cHyperspeed 5\u201d means \u201cReveal the top 5 cards of your deck. Choose one to add to your hand. Discard the rest.\u201d Represents blindingly fast strikes."],
  ["darkmemories", "\u201cDark Memories\u201d means \u201cThis gets +1 Attack for each Hero Class among cards in your discard pile.\u201d"],
  ["laststand", "\u201cLast Stand\u201d means \u201cThis gets +1 Attack for each empty space in the city.\u201d"],
  ["undercover", "Represents sending agents off the grid on special missions. Heroes go \u201cUndercover\u201d face-down in your Victory Pile to be Unleashed later."],
  ["shieldlevel", "S.H.I.E.L.D. Level represents agents unlocking special abilities as they rise through the ranks. Higher levels unlock more powerful effects."],
  ["hydralevel", "Hydra Level represents villains rising through the ranks of the Hydra organization, achieving greater power by helping operatives escape."],
  ["worthy", "Some Hero cards say \u201cIf you are Worthy, draw a card.\u201d You become Worthy this turn if you recruited a card that costs 0 or fought a Villain that costs 0."],
  ["moonlightsunlight", "Vampires and Werewolves are vicious at night (Moonlight), while Sunspot gains strength from sunlight. Moonlight/Sunlight effects depend on the top card of the Wound Stack."],
  ["wakingnightmare", "\u201cWaking Nightmare\u201d means \u201cReveal the top card of your deck. If that card costs 0, KO it.\u201d Represents psychological horror attacks."],
  ["burnshards", "\u201cBurn 2 Shards: Draw two cards\u201d means you may spend that many Shards to do the listed effect. You don\u2019t get the normal +1 Attack per Shard when you burn them."],
  ["celestialboon", "Celestials cannot be truly defeated by mortals. However, if you manage to fight a Celestial, it is impressed with your efforts and grants you a Celestial Boon."],
  ["contestofchampions", "Some Villains say \u201cContest of Champions Strength.\u201d This means \u201cEach player reveals a Strength Hero or gains a Wound.\u201d Represents the Grandmaster\u2019s games."],
  ["whenrecruited", "\u201cWhen Recruited: You get +3 Attack.\u201d Use this ability immediately when you recruit this Hero, not when you play it later."],
  ["thronesfavor", "When you \u201cgain the Throne\u2019s Favor,\u201d take a nearby object to represent it. There is only ever one Throne\u2019s Favor in the game. While you have it, you get bonuses."],
  ["momentum", "\u201cMomentum 3\u201d means \u201cThis Villain gets +3 Attack if it entered the city on a previous turn (not the current turn).\u201d"],
  ["clone", "Clone represents characters that are literal clones or can create copies. Clone cards can be played multiple times or duplicated."],
  ["shatter", "\u201cShatter a Villain in the Sewers\u201d means \u201cHalve that enemy\u2019s current Attack (round up to the nearest whole number).\u201d"],
  ["prey", "\u201cPrey on the fewest Tech\u201d means after this Villain enters, each player reveals their hand. The player with the fewest Tech cards suffers the Prey effect."],
  ["tacticalformation", "\u201cTactical Formation 445: You get +3 Attack\u201d means \u201cYou get this bonus if you played Heroes costing exactly 4, 4, and 5 this turn.\u201d"],
  ["astralplane", "The Fear Lords move enemies beyond the physical world to a realm of pure psychic energy, where they prey on the human psyche."],
  ["demonicbargain", "Demons offer gifts of power with a dark price. Demonic Bargain lets you gain powerful effects at the cost of giving the Mastermind benefits."],
  ["ritualartifact", "Ritual Artifacts use the Artifact rules with a twist \u2014 they can be \u201ccharged up\u201d with mystic energy and unleashed for powerful effects."],
  ["triggeredartifact", "\u201cTriggered Artifact \u2014 Whenever you draw a card during your turn, you get +1 Attack.\u201d Triggered Artifacts activate automatically on their trigger condition."],
  ["excessivekindness", "Excessive Kindness works like Excessive Violence, except you trigger it by spending 1 Recruit more than you need when recruiting a Hero."],
  ["command", "\u201cTaserface gets +2 Attack while he Commands the Ravagers.\u201d A Villain \u201cCommands\u201d their group as long as it\u2019s the leftmost Villain of that group in the city."],
  ["villainousweapons", "Villains and Masterminds can capture Villainous Weapons to become even more powerful. If you defeat them, you can seize those weapons as Artifacts."],
  ["ambush", "Some Heroes say \u201cInstinct Ambush: Draw a card.\u201d When another player recruits this Hero from the HQ, you may use its Ambush ability."],
  ["unleash", "\u201cUnleash a Hero from Undercover\u201d means return that Hero from your Victory Pile to your hand, ready to play."],
  ["whenrecruitedundercover", "\u201cWhen Recruited: Send this Undercover\u201d means put this Hero face-down in your Victory Pile when recruited. It can be Unleashed later."],
  ["sacrifice", "Several Heroes say things like \u201cRanged Sacrifice: Take another turn after this one.\u201d Sacrifice means KO this card to use the powerful Sacrifice ability."],
  ["endgame", "\u201cEndgame: +3 Attack\u201d means this enemy gets +3 Attack for each Master Strike that has occurred so far this game."],
  ["bloodfrenzy", "Blood Frenzy represents vampires and werewolves gaining strength from every kind of blood they drain. You get bonuses for each Instinct or Strength card you played this turn."],
  ["huntforvictims", "\u201cHunt for Victims\u201d means \u201cKO a Bystander that is captured by any Villain or Mastermind or in the Escape Pile. If you can\u2019t, then this captures a Bystander instead.\u201d"],
  ["haunt", "\u201cAmbush: Haunt the rightmost unhaunted Hero in the HQ\u201d means tuck this Villain beneath that Hero. While haunted, that Hero costs +2 Recruit more."],
  ["whatif", "\u201cWhat If\u2026?: You get +3 Recruit\u201d means choose a Hero Class or Hero Name. Reveal the top card of your deck. If it matches, use the What If ability."],
  ["liberate", "\u201cLiberate\u201d means \u201cKO a card from your hand or discard pile that costs 0.\u201d Represents destroying oppressive enemy technology."],
  ["soulbind", "\u201cSoulbind a Villain\u201d means put a Villain from the city into your Victory Pile without fighting it. Represents binding dark souls to devour their power."],
  ["heist", "Once per turn, if you played any Heroes with Heist abilities, you may attempt a Heist: reveal the top card of the Villain Deck. If it\u2019s not a Scheme Twist or Master Strike, use all your Heist abilities."],
  ["antics", "\u201cAntics: You get +2 Attack\u201d represents Ant-Man using his power to control ants, shrink to ant size, or grow ants to giant size."],
  ["explore", "\u201cExplore\u201d means \u201cReveal the top two cards of your deck. Put any one card on top of your deck and the other on the bottom.\u201d"],
  ["doublecross", "\u201cDouble-Cross each player\u201d means each player reveals their hand and discards one of their highest-cost \u201cdoubles\u201d (a card that has the same cost as another card in your hand)."],
  ["cybermod", "In 2099, Heroes augment their bodies with cybernetic enhancements. \u201cCyber-Mod Wound\u201d means \u201cYou may gain a Wound to use this ability.\u201d"],
  ["fatedfuture", "\u201cFated Future\u201d means \u201cReveal the top card of the Villain Deck. If that card does something bad to players, use this Fated Future ability.\u201d"],
  ["fightorfail", "\u201cFight or Fail: KO one of your Heroes\u201d \u2014 do this effect if you successfully fight that Enemy OR if you try but the Attack bonus causes you to fail."],
  ["weaponxsequence", "The Weapon X Sequence means each successive copy of this card you play gets stronger. The first gives a base effect, the second gives more, and so on."],
  ["fail", "\u201cFail: You gain a Wound\u201d \u2014 do this effect if you try to fight that Enemy but the Berserk Attack bonus causes you to fail. You can\u2019t try unless you have enough for the printed Attack."],
]);

// ── Hero class glossary (superpower abilities) ─────────────────────────────
// Key: lowercase hero class name (matches the X in [hc:X])
// Superpower abilities trigger when you play a card of the matching hero class.
export const HERO_CLASS_GLOSSARY: Map<string, string> = new Map([
  ["covert", "Superpower Ability — triggers if you played another Covert (green) card this turn. Covert heroes use stealth, espionage, and precision."],
  ["instinct", "Superpower Ability — triggers if you played another Instinct (pink) card this turn. Instinct heroes rely on primal senses, reflexes, and feral power."],
  ["ranged", "Superpower Ability — triggers if you played another Ranged (blue) card this turn. Ranged heroes attack from a distance using energy blasts, arrows, or projectiles."],
  ["strength", "Superpower Ability — triggers if you played another Strength (red) card this turn. Strength heroes overpower enemies with raw physical might."],
  ["tech", "Superpower Ability — triggers if you played another Tech (yellow) card this turn. Tech heroes use gadgets, armor, and advanced technology."],
]);

/**
 * Look up a hero class description by name (case-insensitive).
 * Returns the description string, or null if not found.
 */
export function lookupHeroClass(name: string): string | null {
  return HERO_CLASS_GLOSSARY.get(name.toLowerCase()) ?? null;
}

// ── Ability text token types ──────────────────────────────────────────────────
export type TokenType = "text" | "keyword" | "rule" | "icon" | "hc" | "team";

export interface AbilityToken {
  type:  TokenType;
  value: string;  // The X in [type:X], or plain text for type="text"
  raw:   string;  // The original markup string
}

// ── parseAbilityText ──────────────────────────────────────────────────────────
/**
 * Parse a single ability text line into typed tokens.
 * Splits on [type:value] markup, yielding interleaved text and token segments.
 *
 * Example input:  "[keyword:Patrol]: If it's empty, you get +1[icon:recruit]."
 * Example output: [
 *   { type: "keyword", value: "Patrol",  raw: "[keyword:Patrol]" },
 *   { type: "text",    value: ": If it's empty, you get +1", raw: "" },
 *   { type: "icon",    value: "recruit", raw: "[icon:recruit]" },
 *   { type: "text",    value: ".",       raw: "" },
 * ]
 */
export function parseAbilityText(text: string): AbilityToken[] {
  const tokens: AbilityToken[] = [];
  // Matches [keyword:X], [icon:X], [hc:X], [team:X], [rule:X]
  const pattern = /\[(keyword|icon|hc|team|rule):([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Plain text before this token
    if (match.index > lastIndex) {
      tokens.push({
        type:  "text",
        value: text.slice(lastIndex, match.index),
        raw:   "",
      });
    }

    const tokenType = match[1] as TokenType;
    const tokenValue = match[2] ?? "";

    tokens.push({
      type:  tokenType,
      value: tokenValue,
      raw:   match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Any remaining plain text
  if (lastIndex < text.length) {
    tokens.push({
      type:  "text",
      value: text.slice(lastIndex),
      raw:   "",
    });
  }

  return tokens;
}

// ── lookupKeyword ─────────────────────────────────────────────────────────────
/**
 * Look up a keyword definition by name.
 * Card data uses mixed-case variations like "Berserk", "Focus 2",
 * "Patrol the Bank", "Double Striker". This function tries:
 *   1. Exact lowercase match
 *   2. Match after stripping spaces (e.g., "wallcrawl" for "Wall-Crawl")
 *   3. Prefix match against known keys (e.g., "Patrol the Bank" -> "patrol")
 * Returns the summary string, or null if not found.
 */
export function lookupKeyword(name: string): string | null {
  const lower = name.toLowerCase();
  // why: exact match covers most tokens like "Berserk" -> "berserk"
  if (KEYWORD_GLOSSARY.has(lower)) return KEYWORD_GLOSSARY.get(lower)!;

  // why: some keywords have hyphens/spaces stripped in their keys
  const stripped = lower.replace(/[\s-]+/g, "");
  if (KEYWORD_GLOSSARY.has(stripped)) return KEYWORD_GLOSSARY.get(stripped)!;

  // why: card data uses parameterized forms like "Focus 2", "Patrol the Bank",
  // "Danger Sense 3", "Elusive 6" — match the longest known key that starts the token
  let bestMatch: string | null = null;
  for (const key of KEYWORD_GLOSSARY.keys()) {
    if (lower.startsWith(key) && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }
    // Also try against the stripped form
    const keyStripped = key.replace(/[\s-]+/g, "");
    if (stripped.startsWith(keyStripped) && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }
  }
  return bestMatch ? KEYWORD_GLOSSARY.get(bestMatch)! : null;
}

// ── lookupRule ────────────────────────────────────────────────────────────────
/**
 * Look up a rules glossary entry by code (case-insensitive).
 * Tries both the exact value and a slugified version.
 * Returns the RuleEntry, or null if not found.
 */
export function lookupRule(code: string): RuleEntry | null {
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  // Try exact match first
  if (RULES_GLOSSARY.has(code.toLowerCase())) {
    return RULES_GLOSSARY.get(code.toLowerCase()) ?? null;
  }
  // Try without spaces
  for (const [key, entry] of RULES_GLOSSARY) {
    if (key.replace(/\s+/g, "") === normalizedCode) {
      return entry;
    }
  }
  return null;
}
