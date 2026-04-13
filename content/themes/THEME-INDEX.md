# Theme Index

> **This file is planning and progress tracking only.**
> It is NOT consumed by the engine, registry, or validation tools.
> The authoritative data sources are the individual JSON files in `content/themes/`.

Canonical index and completion record for all currently supported themes.
Themes are validated against the card registry catalog and committed as static JSON files.

**Card data constraint:** Themes can only be composed from the 40 card sets in
`data/cards/`. Themes referencing events or characters without card set support
are not viable and should not be planned here.

### Index Rules (Locked)

1. Each Theme ID appears **exactly once** in this index.
2. A theme belongs to **one primary category** only.
3. Cross-category relevance is documented in the **Notes** column, not by duplication.
4. Categories are editorial and organizational — they do not affect schema or runtime behavior.
5. Totals in the Summary table are advisory. Recompute only when committing themes.

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Committed and validated |
| 📋 | Planned (not yet authored) |

## Categories

Themes are organized by narrative category, not by authoring order.
Categories are environment-first or team-first — a character can appear in
multiple categories depending on the story context.

**Card Sets column:** shorthand set abbreviations indicating where required
cards originate (informational; not validated here).

| Category | Scope |
|----------|-------|
| X-Men & Mutant Sagas | Mutant team arcs, Brotherhood, Phoenix Force, alternate timelines |
| Cosmic & Galactic | Space empires, Infinity Gems, Guardians, Fantastic Four cosmic arcs |
| Avengers & Major Events | Avengers team arcs, crossover events, registration, civil wars |
| Spider-Man & Symbiotes | Spider-verse heroes, symbiote arcs, Sinister Six |
| Street-Level & Noir | Marvel Knights, Kingpin, Punisher, Daredevil, crime syndicates |
| Espionage & Faction Wars | S.H.I.E.L.D., HYDRA, secret societies, political conflicts |
| Horror & Supernatural | Midnight Sons, occult threats, demonic invasions |
| Fantastic Four & Classic Villains | FF family, iconic single-villain scenarios, Doom, Galactus |
| Team-Ups & Deep Cuts | Smaller teams, character spotlights, deep-cut sets |

---

## X-Men & Mutant Sagas

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | dark-phoenix-saga | Dark Phoenix Saga | Uncanny X-Men #129–137 (1980) | xmen | Flagship theme |
| ✅ | brotherhood-uprising | Brotherhood Uprising | X-Men Vol 2 #25 (1993) | core | Magneto + Legacy Virus |
| ✅ | days-of-future-past | Days of Future Past | Uncanny X-Men #141–142 (1981) | xmen, core | Time-travel dystopia |
| ✅ | age-of-apocalypse | Age of Apocalypse | 1995 Event | dkcy | Apocalypse mastermind |
| ✅ | messiah-complex | Messiah Complex | 2007 Crossover | msmc | Hope Summers birth |
| ✅ | mutant-massacre | Mutant Massacre | Uncanny X-Men #210–213 (1986) | dkcy | Marauders slaughter |
| ✅ | x-cutioners-song | X-Cutioner's Song | 1992 Crossover | dkcy | Stryfe + Cable |
| ✅ | onslaught-unleashed | Onslaught Unleashed | X-Men Vol 2 #53–54 (1996) | xmen | Onslaught mastermind |
| ✅ | shadow-king-psychic-war | Shadow King's Psychic War | Uncanny X-Men #117 (1979) | xmen | Shadow King mastermind |
| ✅ | mojoworld-deathtraps | Mojoworld Deathtraps | Longshot #1–6 (1985) | xmen | Mojo mastermind |
| ✅ | inferno | Inferno | X-Men #241–243 (1989) | dkcy | Mephisto; demonic invasion |
| ✅ | phoenix-five | Phoenix Five | Avengers vs. X-Men (2012) | xmen, core | Phoenix Force + AvX |

---

## Cosmic & Galactic

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | infinity-gauntlet | Infinity Gauntlet | Infinity Gauntlet #1–6 (1991) | gotg | Thanos + Guardians |
| ✅ | kree-skrull-war | Kree-Skrull War | Avengers #89–97 (1971) | gotg | kree-skrull-war-the scheme |
| ✅ | annihilation | Annihilation | Annihilation #1–6 (2006) | anni | Annihilus mastermind |
| ✅ | galactus-devourer | Galactus the Devourer | Fantastic Four #48–50 (1966) | ff04 | Galactus trilogy |
| ✅ | war-of-kings | War of Kings | War of Kings #1–6 (2009) | rlmk | Inhumans vs Shi'ar |
| ✅ | negative-zone-breakout | Negative Zone Breakout | Fantastic Four #251–256 (1983) | ff04, anni | Annihilus + Negative Zone |
| ✅ | realm-of-kings | Realm of Kings | 2010 Event | rlmk | Post-War of Kings |
| ✅ | black-order-assault | Black Order Assault | Infinity #1–6 (2013) | cosm, msis | Thanos' lieutenants |
| ✅ | contest-of-champions | Contest of Champions | Contest of Champions #1–3 (1982) | cosm | Grandmaster mastermind |
| ✅ | silver-surfer-herald | Silver Surfer: Herald of Galactus | Silver Surfer (1980s) | ff04 | Silver Surfer hero |
| ✅ | annihilation-conquest | Annihilation: Conquest | 2007 Event | cosm | Phalanx invasion |

---

## Avengers & Major Events

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | civil-war | Civil War | Civil War #1–7 (2006) | cvwr | Registration Act |
| ✅ | world-war-hulk | World War Hulk | World War Hulk #1–5 (2007) | wwhk | Hulk's return from Sakaar |
| ✅ | fear-itself | Fear Itself | Fear Itself #1–7 (2011) | fear | Serpent + Worthy |
| ✅ | dark-reign | Dark Reign | 2008–2009 Status Quo | rvlt | Hood / Norman Osborn |
| ✅ | secret-wars-battleworld | Secret Wars: Battleworld | Secret Wars (2015) | ssw1, ssw2 | Battleworld domains |
| ✅ | ultron-age | Age of Ultron | Age of Ultron #1–10 (2013) | antm | Ultron mastermind |
| ✅ | siege-of-asgard | Siege of Asgard | Siege #1–4 (2010) | asrd | Asgard on Earth |
| ✅ | avengers-disassembled | Avengers Disassembled | Avengers #500–503 (2004) | rvlt | Scarlet Witch |
| ✅ | house-of-m | House of M | House of M #1–8 (2005) | rvlt | "No more mutants" |
| ✅ | thunderbolts-dark-reign | Thunderbolts (Dark Reign) | Thunderbolts vol. 2 | cvwr | Thunderbolts villain group |

---

## Spider-Man & Symbiotes

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | maximum-carnage | Maximum Carnage | ASM #378–380 (1993) | pttr | Symbiote rampage |
| ✅ | clone-saga | Clone Saga | 1994–1996 Arc | pttr | Ben Reilly era |
| ✅ | sinister-six-assault | Sinister Six Assault | ASM Annual #1 (1964) | pttr | sinister-six villain group |
| ✅ | venom-lethal-protector | Venom: Lethal Protector | Venom: LP #1–6 (1993) | vnom | Eddie Brock |
| ✅ | spider-friends-unite | Spider-Friends Unite | Multiple stories | pttr | Spider-verse faction |
| ✅ | superior-spider-man | Superior Spider-Man | Superior Spider-Man #1–33 (2013) | pttr, core | Doc Ock in Peter's body |

---

## Street-Level & Noir

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | dark-city-streets | Dark City Streets | Daredevil #170–172 (1981) | dkcy | Kingpin + Marvel Knights |
| ✅ | noir-underworld | Noir Underworld | Noir mini-series (2009) | noir | 1930s Spider-Man |
| ✅ | five-families-of-crime | Five Families of Crime | Daredevil / Kingpin arcs | dkcy | Crime syndicate war |
| ✅ | punisher-max | Punisher MAX | Garth Ennis run (2004–2009) | dkcy | Punisher hero |
| ✅ | deadpool-chaos | Deadpool Chaos | Multiple Deadpool runs | dead | Merc with a mouth |

---

## Espionage & Faction Wars

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | secret-invasion | Secret Invasion | Secret Invasion #1–8 (2008) | core | Skrull infiltration |
| ✅ | cosmic-cube-crisis | Cosmic Cube Crisis | Tales of Suspense #79–81 (1966) | core | Red Skull + HYDRA |
| ✅ | hydra-uprising | HYDRA Uprising | Multiple classic sources | shld | Classic HYDRA |
| ✅ | shield-vs-hydra | S.H.I.E.L.D. vs HYDRA | Multiple sources | shld | Espionage faction war |
| ✅ | red-skull-classic | Red Skull (Classic) | Captain America Comics #1 (1941) | ca75 | WWII origin |
| ✅ | black-widow-espionage | Black Widow: Espionage | Black Widow stories | bkwd | |

---

## Horror & Supernatural

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | midnight-sons-rising | Midnight Sons Rising | Multiple sources | mdns | Supernatural heroes |
| ✅ | dormammu-dark-dimension | Dormammu's Dark Dimension | Doctor Strange stories | dstr | Dormammu mastermind |
| ✅ | ghost-rider-vengeance | Ghost Rider: Spirit of Vengeance | 1990s Ghost Rider | dkcy | Ghost Rider hero |

---

## Fantastic Four & Classic Villains

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | dooms-killbot-agenda | Doom's Killbot Agenda | Fantastic Four #196–200 (1978) | core | Dr. Doom classic |
| ✅ | doom-empire | Doctor Doom Empire | Various Doom stories | core | Latverian conquest |
| ✅ | mole-man-subterranea | Mole Man's Subterranea | Fantastic Four #1 (1961) | ff04 | Mole Man mastermind |
| ✅ | kang-conqueror | Kang the Conqueror | Avengers #8 (1964) | anni | Time-travel threat |
| ✅ | cosmic-rays | Bathe the Earth in Cosmic Rays | Fantastic Four classic | ff04 | FF scheme |
| ✅ | aim-modok | A.I.M. and M.O.D.O.K. | Strange Tales #146 (1966) | shld | a-i-m-hydra-offshoot |
| ✅ | inhumans-royal-family | Inhumans Royal Family | Inhumans #1 (1975) | rlmk | Black Bolt + Inhumans |

---

## Team-Ups & Deep Cuts

| Status | Theme ID | Theme Name | Comic / Arc | Card Sets | Notes |
|-------:|----------|------------|-------------|-----------|-------|
| ✅ | defenders-classic | Defenders (Classic) | 1970s Defenders | vill | defenders villain group |
| ✅ | kang-variants | Kang Variants | Multiple Kang stories | anni | Time-traveler army |
| ✅ | x-force-extreme | X-Force (Extreme) | 1990s X-Force | dkcy | Cable's strike team |
| ✅ | weapon-x-program | Weapon X Program | Marvel Comics Presents #72–84 (1991) | wpnx | |
| ✅ | new-mutants-academy | New Mutants Academy | New Mutants #1 (1983) | nmut | |
| ✅ | doctor-strange-sorcerer | Doctor Strange, Sorcerer Supreme | Doctor Strange stories | dstr | |
| ✅ | champions-young-heroes | Champions: Young Heroes | Champions (2016) | chmp | |
| ✅ | black-panther-wakanda | Black Panther of Wakanda | Black Panther stories | bkpt | |

---

## Summary

| Category | Total | Committed | Planned |
|----------|------:|----------:|--------:|
| X-Men & Mutant Sagas | 12 | 12 | 0 |
| Cosmic & Galactic | 11 | 11 | 0 |
| Avengers & Major Events | 10 | 10 | 0 |
| Spider-Man & Symbiotes | 6 | 6 | 0 |
| Street-Level & Noir | 5 | 5 | 0 |
| Espionage & Faction Wars | 6 | 6 | 0 |
| Horror & Supernatural | 3 | 3 | 0 |
| Fantastic Four & Classic Villains | 7 | 7 | 0 |
| Team-Ups & Deep Cuts | 8 | 8 | 0 |
| **Total** | **68** | **68** | **0** |

Additional categories (Jungle/Primal, Underwater/Atlantean, Mythic/God-Tier)
can be added when card sets exist to support them. Current card data does not
have sufficient depth for standalone categories in those areas.
