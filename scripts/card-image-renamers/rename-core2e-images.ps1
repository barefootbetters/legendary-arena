# Renames the converted Core Set 2nd Edition WebP files from their
# source-side names (2e<Type><Name>.webp) to the deterministic R2
# convention core2e-<ribbon>-<slug>.webp.
#
# Source: original\core2e   ->   Destination: renamed\core2e
#
# why: resolve the staging root from the script's own location so this is
# portable across machines (the older rename/convert scripts hardcoded a
# per-machine absolute path and broke when moved).
$StagingRoot = $PSScriptRoot
$src = Join-Path $StagingRoot "original\core2e"
$dst = Join-Path $StagingRoot "renamed\core2e"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
Remove-Item "$dst\*" -Force -ErrorAction SilentlyContinue
Write-Host "Cleared destination folder."

# Ribbon codes (per the upstream card-types.json prefix registry):
#   hr hero · mm mastermind · me mastermind-epic · mt mastermind-tactic
#   vi villain · hm henchman · sc scheme · st scheme-twist · ms master-strike
#   by bystander · wd wound · sk sidekick
#   sa shield-agent · so shield-officer · tr shield-trooper
$renames = @(
    # ============================================================
    # HEROES (hr) — PLACEHOLDER slugs.
    # The 2e source filenames carry only rarity (_1Rare / _2Common /
    # _3Common / _4Uncommon), NOT the card title the R2 hero convention
    # uses for its slug segment. No core2e card data exists yet to look
    # the titles up. These names use the rarity as a placeholder slug and
    # MUST be replaced with the real card-title slugs before R2 upload.
    # Rarity map: _1Rare->rare  _2Common->common-1  _3Common->common-2  _4Uncommon->uncommon
    # ============================================================
    @{ Old = "2eHeroBlackWidow_1Rare.webp";     New = "core2e-hr-black-widow-rare.webp" },
    @{ Old = "2eHeroBlackWidow_2Common.webp";   New = "core2e-hr-black-widow-common-1.webp" },
    @{ Old = "2eHeroBlackWidow_3Common.webp";   New = "core2e-hr-black-widow-common-2.webp" },
    @{ Old = "2eHeroBlackWidow_4Uncommon.webp"; New = "core2e-hr-black-widow-uncommon.webp" },

    @{ Old = "2eHeroCaptainAmerica_1Rare.webp";     New = "core2e-hr-captain-america-rare.webp" },
    @{ Old = "2eHeroCaptainAmerica_2Common.webp";   New = "core2e-hr-captain-america-common-1.webp" },
    @{ Old = "2eHeroCaptainAmerica_3Common.webp";   New = "core2e-hr-captain-america-common-2.webp" },
    @{ Old = "2eHeroCaptainAmerica_4Uncommon.webp"; New = "core2e-hr-captain-america-uncommon.webp" },

    @{ Old = "2eHeroCyclops_1Rare.webp";     New = "core2e-hr-cyclops-rare.webp" },
    @{ Old = "2eHeroCyclops_2Common.webp";   New = "core2e-hr-cyclops-common-1.webp" },
    @{ Old = "2eHeroCyclops_3Common.webp";   New = "core2e-hr-cyclops-common-2.webp" },
    @{ Old = "2eHeroCyclops_4Uncommon.webp"; New = "core2e-hr-cyclops-uncommon.webp" },

    @{ Old = "2eHeroEmmaFrost_1Rare.webp";     New = "core2e-hr-emma-frost-rare.webp" },
    @{ Old = "2eHeroEmmaFrost_2Common.webp";   New = "core2e-hr-emma-frost-common-1.webp" },
    @{ Old = "2eHeroEmmaFrost_3Common.webp";   New = "core2e-hr-emma-frost-common-2.webp" },
    @{ Old = "2eHeroEmmaFrost_4Uncommon.webp"; New = "core2e-hr-emma-frost-uncommon.webp" },

    @{ Old = "2eHeroGambit_1Rare.webp";     New = "core2e-hr-gambit-rare.webp" },
    @{ Old = "2eHeroGambit_2Common.webp";   New = "core2e-hr-gambit-common-1.webp" },
    @{ Old = "2eHeroGambit_3Common.webp";   New = "core2e-hr-gambit-common-2.webp" },
    @{ Old = "2eHeroGambit_4Uncommon.webp"; New = "core2e-hr-gambit-uncommon.webp" },

    @{ Old = "2eHeroHawkeye_1Rare.webp";     New = "core2e-hr-hawkeye-rare.webp" },
    @{ Old = "2eHeroHawkeye_2Common.webp";   New = "core2e-hr-hawkeye-common-1.webp" },
    @{ Old = "2eHeroHawkeye_3Common.webp";   New = "core2e-hr-hawkeye-common-2.webp" },
    @{ Old = "2eHeroHawkeye_4Uncommon.webp"; New = "core2e-hr-hawkeye-uncommon.webp" },

    @{ Old = "2eHeroHulk_1Rare.webp";     New = "core2e-hr-hulk-rare.webp" },
    @{ Old = "2eHeroHulk_2Common.webp";   New = "core2e-hr-hulk-common-1.webp" },
    @{ Old = "2eHeroHulk_3Common.webp";   New = "core2e-hr-hulk-common-2.webp" },
    @{ Old = "2eHeroHulk_4Uncommon.webp"; New = "core2e-hr-hulk-uncommon.webp" },

    @{ Old = "2eHeroIronMan_1Rare.webp";     New = "core2e-hr-iron-man-rare.webp" },
    @{ Old = "2eHeroIronMan_2Common.webp";   New = "core2e-hr-iron-man-common-1.webp" },
    @{ Old = "2eHeroIronMan_3Common.webp";   New = "core2e-hr-iron-man-common-2.webp" },
    @{ Old = "2eHeroIronMan_4Uncommon.webp"; New = "core2e-hr-iron-man-uncommon.webp" },

    @{ Old = "2eHeroNickFury_1Rare.webp";     New = "core2e-hr-nick-fury-rare.webp" },
    @{ Old = "2eHeroNickFury_2Common.webp";   New = "core2e-hr-nick-fury-common-1.webp" },
    @{ Old = "2eHeroNickFury_3Common.webp";   New = "core2e-hr-nick-fury-common-2.webp" },
    @{ Old = "2eHeroNickFury_4Uncommon.webp"; New = "core2e-hr-nick-fury-uncommon.webp" },

    @{ Old = "2eHeroRogue_1Rare.webp";     New = "core2e-hr-rogue-rare.webp" },
    @{ Old = "2eHeroRogue_2Common.webp";   New = "core2e-hr-rogue-common-1.webp" },
    @{ Old = "2eHeroRogue_3Common.webp";   New = "core2e-hr-rogue-common-2.webp" },
    @{ Old = "2eHeroRogue_4Uncommon.webp"; New = "core2e-hr-rogue-uncommon.webp" },

    @{ Old = "2eHeroSpider-Man_1Rare.webp";     New = "core2e-hr-spider-man-rare.webp" },
    @{ Old = "2eHeroSpider-Man_2Common.webp";   New = "core2e-hr-spider-man-common-1.webp" },
    @{ Old = "2eHeroSpider-Man_3Common.webp";   New = "core2e-hr-spider-man-common-2.webp" },
    @{ Old = "2eHeroSpider-Man_4Uncommon.webp"; New = "core2e-hr-spider-man-uncommon.webp" },

    @{ Old = "2eHeroSpider-ManMilesMorales_1Rare.webp";     New = "core2e-hr-spider-man-miles-morales-rare.webp" },
    @{ Old = "2eHeroSpider-ManMilesMorales_2Common.webp";   New = "core2e-hr-spider-man-miles-morales-common-1.webp" },
    @{ Old = "2eHeroSpider-ManMilesMorales_3Common.webp";   New = "core2e-hr-spider-man-miles-morales-common-2.webp" },
    @{ Old = "2eHeroSpider-ManMilesMorales_4Uncommon.webp"; New = "core2e-hr-spider-man-miles-morales-uncommon.webp" },

    @{ Old = "2eHeroStorm_1Rare.webp";     New = "core2e-hr-storm-rare.webp" },
    @{ Old = "2eHeroStorm_2Common.webp";   New = "core2e-hr-storm-common-1.webp" },
    @{ Old = "2eHeroStorm_3Common.webp";   New = "core2e-hr-storm-common-2.webp" },
    @{ Old = "2eHeroStorm_4Uncommon.webp"; New = "core2e-hr-storm-uncommon.webp" },

    @{ Old = "2eHeroThor_1Rare.webp";     New = "core2e-hr-thor-rare.webp" },
    @{ Old = "2eHeroThor_2Common.webp";   New = "core2e-hr-thor-common-1.webp" },
    @{ Old = "2eHeroThor_3Common.webp";   New = "core2e-hr-thor-common-2.webp" },
    @{ Old = "2eHeroThor_4Uncommon.webp"; New = "core2e-hr-thor-uncommon.webp" },

    @{ Old = "2eHeroWolverine_1Rare.webp";     New = "core2e-hr-wolverine-rare.webp" },
    @{ Old = "2eHeroWolverine_2Common.webp";   New = "core2e-hr-wolverine-common-1.webp" },
    @{ Old = "2eHeroWolverine_3Common.webp";   New = "core2e-hr-wolverine-common-2.webp" },
    @{ Old = "2eHeroWolverine_4Uncommon.webp"; New = "core2e-hr-wolverine-uncommon.webp" },

    # ============================================================
    # MASTERMINDS — base (mm), Epic (me), 4 named tactics (mt) each.
    # 2e filenames name each tactic, so there is no Tactic1-4 ordering
    # ambiguity (unlike 1st edition). Slugs taken verbatim from the names.
    # ============================================================
    @{ Old = "2eMastermind_DoctorDoom.webp";                          New = "core2e-mm-doctor-doom.webp" },
    @{ Old = "2eMastermind_DoctorDoomEpic.webp";                      New = "core2e-me-doctor-doom.webp" },
    @{ Old = "2eMastermind_DoctorDoomTacticDarkTechnology.webp";      New = "core2e-mt-doctor-doom-dark-technology.webp" },
    @{ Old = "2eMastermind_DoctorDoomTacticMonarchsDecree.webp";      New = "core2e-mt-doctor-doom-monarchs-decree.webp" },
    @{ Old = "2eMastermind_DoctorDoomTacticSecretsofTimeTravel.webp"; New = "core2e-mt-doctor-doom-secrets-of-time-travel.webp" },
    @{ Old = "2eMastermind_DoctorDoomTacticTreasuresofLatveria.webp"; New = "core2e-mt-doctor-doom-treasures-of-latveria.webp" },

    @{ Old = "2eMastermind_DoctorOctopus.webp";                             New = "core2e-mm-doctor-octopus.webp" },
    @{ Old = "2eMastermind_DoctorOctopusEpic.webp";                         New = "core2e-me-doctor-octopus.webp" },
    @{ Old = "2eMastermind_DoctorOctopusTacticAbsoluteOctarchy.webp";       New = "core2e-mt-doctor-octopus-absolute-octarchy.webp" },
    @{ Old = "2eMastermind_DoctorOctopusTacticHighOctane.webp";             New = "core2e-mt-doctor-octopus-high-octane.webp" },
    @{ Old = "2eMastermind_DoctorOctopusTacticOctalOctyls.webp";            New = "core2e-mt-doctor-octopus-octal-octyls.webp" },
    @{ Old = "2eMastermind_DoctorOctopusTacticOctetofValenceElectrons.webp";New = "core2e-mt-doctor-octopus-octet-of-valence-electrons.webp" },

    @{ Old = "2eMastermind_Loki.webp";                          New = "core2e-mm-loki.webp" },
    @{ Old = "2eMastermind_LokiEpic.webp";                      New = "core2e-me-loki.webp" },
    @{ Old = "2eMastermind_LokiTacticBrokenIllusions.webp";     New = "core2e-mt-loki-broken-illusions.webp" },
    @{ Old = "2eMastermind_LokiTacticCruelManipulations.webp";  New = "core2e-mt-loki-cruel-manipulations.webp" },
    @{ Old = "2eMastermind_LokiTacticScionoftheFrostGiants.webp";New = "core2e-mt-loki-scion-of-the-frost-giants.webp" },
    @{ Old = "2eMastermind_LokiTacticWhispersandLies.webp";     New = "core2e-mt-loki-whispers-and-lies.webp" },

    @{ Old = "2eMastermind_Magneto.webp";                             New = "core2e-mm-magneto.webp" },
    @{ Old = "2eMastermind_MagnetoEpic.webp";                         New = "core2e-me-magneto.webp" },
    @{ Old = "2eMastermind_MagnetoTacticBitterCaptor.webp";           New = "core2e-mt-magneto-bitter-captor.webp" },
    @{ Old = "2eMastermind_MagnetoTacticCrushinSteel.webp";           New = "core2e-mt-magneto-crushin-steel.webp" },
    @{ Old = "2eMastermind_MagnetoTacticElectromagneticShockwave.webp";New = "core2e-mt-magneto-electromagnetic-shockwave.webp" },
    @{ Old = "2eMastermind_MagnetoTacticImprisoningSphere.webp";      New = "core2e-mt-magneto-imprisoning-sphere.webp" },

    @{ Old = "2eMastermind_RedSkull.webp";                                New = "core2e-mm-red-skull.webp" },
    @{ Old = "2eMastermind_RedSkullEpic.webp";                            New = "core2e-me-red-skull.webp" },
    @{ Old = "2eMastermind_RedSkullTacticDustofDeath.webp";               New = "core2e-mt-red-skull-dust-of-death.webp" },
    @{ Old = "2eMastermind_RedSkullTacticRuthlessCommand.webp";           New = "core2e-mt-red-skull-ruthless-command.webp" },
    @{ Old = "2eMastermind_RedSkullTacticTwoMoreShallTakeItsPlace.webp";  New = "core2e-mt-red-skull-two-more-shall-take-its-place.webp" },
    @{ Old = "2eMastermind_RedSkullTacticVastResources.webp";            New = "core2e-mt-red-skull-vast-resources.webp" },

    # ============================================================
    # VILLAINS (vi) — grouped. Group slugs taken from the 2e filenames.
    # NOTE: some 2e group names differ from 1st edition (e.g. "Skulls"
    # here vs "skrulls" in 1st-ed core; "Sinister Spider-Foes" vs
    # "spider-foes"). Confirm the group slugs against the eventual
    # core2e card data before R2 upload.
    # ============================================================
    @{ Old = "2eVillainBrotherhoodOfMutantsJuggernaut.webp"; New = "core2e-vi-brotherhood-of-mutants-juggernaut.webp" },
    @{ Old = "2eVillainBrotherhoodOfMutantsMystique.webp";   New = "core2e-vi-brotherhood-of-mutants-mystique.webp" },
    @{ Old = "2eVillainBrotherhoodOfMutantsSabretooth.webp"; New = "core2e-vi-brotherhood-of-mutants-sabretooth.webp" },
    @{ Old = "2eVillainBrotherhoodOfMutantsTheBlob.webp";    New = "core2e-vi-brotherhood-of-mutants-the-blob.webp" },

    @{ Old = "2eVillainEnemiesofAsgardDestroyer.webp";          New = "core2e-vi-enemies-of-asgard-destroyer.webp" },
    @{ Old = "2eVillainEnemiesofAsgardEnchantress.webp";        New = "core2e-vi-enemies-of-asgard-enchantress.webp" },
    @{ Old = "2eVillainEnemiesofAsgardFrostGiantWarrior.webp";  New = "core2e-vi-enemies-of-asgard-frost-giant-warrior.webp" },
    @{ Old = "2eVillainEnemiesofAsgardYmirFrostGiantKing.webp"; New = "core2e-vi-enemies-of-asgard-ymir-frost-giant-king.webp" },

    @{ Old = "2eVillainHydraBaronStruckerSupremeHydra.webp"; New = "core2e-vi-hydra-baron-strucker-supreme-hydra.webp" },
    @{ Old = "2eVillainHydraEndlessArmiesOfHydra.webp";      New = "core2e-vi-hydra-endless-armies-of-hydra.webp" },
    @{ Old = "2eVillainHydraHydraKidnappers.webp";           New = "core2e-vi-hydra-hydra-kidnappers.webp" },
    @{ Old = "2eVillainHydraViper.webp";                     New = "core2e-vi-hydra-viper.webp" },

    @{ Old = "2eVillainMastersofEvilBaronZemo.webp"; New = "core2e-vi-masters-of-evil-baron-zemo.webp" },
    @{ Old = "2eVillainMastersofEvilMelter.webp";    New = "core2e-vi-masters-of-evil-melter.webp" },
    @{ Old = "2eVillainMastersofEvilUltron.webp";    New = "core2e-vi-masters-of-evil-ultron.webp" },
    @{ Old = "2eVillainMastersofEvilWhirlwind.webp"; New = "core2e-vi-masters-of-evil-whirlwind.webp" },

    @{ Old = "2eVillainRadiationAbomination.webp";        New = "core2e-vi-radiation-abomination.webp" },
    @{ Old = "2eVillainRadiationMaestroWastelandHulk.webp";New = "core2e-vi-radiation-maestro-wasteland-hulk.webp" },
    @{ Old = "2eVillainRadiationTheLeader.webp";          New = "core2e-vi-radiation-the-leader.webp" },
    @{ Old = "2eVillainRadiationZzzax.webp";              New = "core2e-vi-radiation-zzzax.webp" },

    @{ Old = "2eVillainSinisterSpider-FoesGreenGoblin.webp"; New = "core2e-vi-sinister-spider-foes-green-goblin.webp" },
    @{ Old = "2eVillainSinisterSpider-FoesScorpion.webp";    New = "core2e-vi-sinister-spider-foes-scorpion.webp" },
    @{ Old = "2eVillainSinisterSpider-FoesTheLizard.webp";   New = "core2e-vi-sinister-spider-foes-the-lizard.webp" },
    @{ Old = "2eVillainSinisterSpider-FoesVenom.webp";       New = "core2e-vi-sinister-spider-foes-venom.webp" },

    @{ Old = "2eVillainSinisterSyndicateBeetle.webp";    New = "core2e-vi-sinister-syndicate-beetle.webp" },
    @{ Old = "2eVillainSinisterSyndicateBoomerang.webp"; New = "core2e-vi-sinister-syndicate-boomerang.webp" },
    @{ Old = "2eVillainSinisterSyndicateHydro-Man.webp"; New = "core2e-vi-sinister-syndicate-hydro-man.webp" },
    @{ Old = "2eVillainSinisterSyndicateSpeedDemon.webp";New = "core2e-vi-sinister-syndicate-speed-demon.webp" },

    @{ Old = "2eVillainSkullsPaibokThePowerSkrull.webp"; New = "core2e-vi-skulls-paibok-the-power-skrull.webp" },
    @{ Old = "2eVillainSkullsSkrullQueenVeranke.webp";   New = "core2e-vi-skulls-skrull-queen-veranke.webp" },
    @{ Old = "2eVillainSkullsSkrullShapeshifter.webp";   New = "core2e-vi-skulls-skrull-shapeshifter.webp" },
    @{ Old = "2eVillainSkullsSuper-Skrull.webp";         New = "core2e-vi-skulls-super-skrull.webp" },

    # ============================================================
    # HENCHMEN (hm)
    # ============================================================
    @{ Old = "2eHenchmenDoombotLegion.webp";     New = "core2e-hm-doombot-legion.webp" },
    @{ Old = "2eHenchmenHandNinjas.webp";        New = "core2e-hm-hand-ninjas.webp" },
    @{ Old = "2eHenchmenSavageLandMutates.webp"; New = "core2e-hm-savage-land-mutates.webp" },
    @{ Old = "2eHenchmenSentinel.webp";          New = "core2e-hm-sentinel.webp" },

    # ============================================================
    # SCHEMES (sc)
    # ============================================================
    @{ Old = "2eSchemeBankRobberyHostageCrisis.webp";               New = "core2e-sc-bank-robbery-hostage-crisis.webp" },
    @{ Old = "2eSchemeEnshroudedIdentity.webp";                     New = "core2e-sc-enshrouded-identity.webp" },
    @{ Old = "2eSchemeNegativeZonePrisonOutbreak.webp";             New = "core2e-sc-negative-zone-prison-outbreak.webp" },
    @{ Old = "2eSchemePortalsToTheDarkDimension.webp";              New = "core2e-sc-portals-to-the-dark-dimension.webp" },
    @{ Old = "2eSchemeReplaceEarthsLeadersWithKillbots.webp";       New = "core2e-sc-replace-earths-leaders-with-killbots.webp" },
    @{ Old = "2eSchemeSecretInvasionOfTheSkrullShapeshifters.webp"; New = "core2e-sc-secret-invasion-of-the-skrull-shapeshifters.webp" },
    @{ Old = "2eSchemeSuperHeroCivilWar.webp";                      New = "core2e-sc-super-hero-civil-war.webp" },
    @{ Old = "2eSchemeTheLegacyVirus.webp";                         New = "core2e-sc-the-legacy-virus.webp" },
    @{ Old = "2eSchemeUnleashThePowerOfTheCosmicCube.webp";         New = "core2e-sc-unleash-the-power-of-the-cosmic-cube.webp" },

    # Scheme Twist (st)
    @{ Old = "2eSchemeTwist.webp"; New = "core2e-st-scheme-twist.webp" },

    # ============================================================
    # S.H.I.E.L.D. — Agent (sa), Officer (so), Trooper (tr).
    # 2e adds five named Officer variants (Covert / Instinct / Ranged /
    # Strength / Tech). Confirm whether these belong under so or a
    # special (sp) prefix against the eventual card data before upload.
    # ============================================================
    @{ Old = "2eSHIELDAgent.webp";          New = "core2e-sa-agent.webp" },
    @{ Old = "2eSHIELDOfficer.webp";        New = "core2e-so-officer.webp" },
    @{ Old = "2eSHIELDOfficerCovert.webp";  New = "core2e-so-officer-covert.webp" },
    @{ Old = "2eSHIELDOfficerInstinct.webp";New = "core2e-so-officer-instinct.webp" },
    @{ Old = "2eSHIELDOfficerRanged.webp";  New = "core2e-so-officer-ranged.webp" },
    @{ Old = "2eSHIELDOfficerStrength.webp";New = "core2e-so-officer-strength.webp" },
    @{ Old = "2eSHIELDOfficerTech.webp";    New = "core2e-so-officer-tech.webp" },
    @{ Old = "2eSHIELDTrooper.webp";        New = "core2e-tr-trooper.webp" },

    # ============================================================
    # MASTER STRIKE (ms)
    # ============================================================
    @{ Old = "2eMasterStrike.webp"; New = "core2e-ms-master-strike.webp" },

    # ============================================================
    # BYSTANDERS (by) — 2e has named bystanders plus the generic one.
    # ============================================================
    @{ Old = "2eBystander.webp";                     New = "core2e-by-bystander.webp" },
    @{ Old = "2eBystanderExperimentalGeneticist.webp";New = "core2e-by-experimental-geneticist.webp" },
    @{ Old = "2eBystanderKindlyCaretaker.webp";      New = "core2e-by-kindly-caretaker.webp" },
    @{ Old = "2eBystanderPoliceOfficer.webp";        New = "core2e-by-police-officer.webp" },

    # ============================================================
    # SIDEKICK (sk)
    # ============================================================
    @{ Old = "2eDaringSidekick.webp"; New = "core2e-sk-daring-sidekick.webp" },

    # ============================================================
    # WOUND (wd)
    # ============================================================
    @{ Old = "2eWound.webp"; New = "core2e-wd-wound.webp" }
)

# why: the scrape pulled one stray non-card page photo
# (20220108_175929.webp). It is intentionally absent from the rename map,
# so it is not copied into renamed\core2e. Nothing to do; noted here so a
# future reader knows its omission is deliberate, not a missed card.

$errors = 0
# why: Copy-Item preserves the source LastWriteTime, so every copy would
# show the date the WebP was generated, not when this script ran. Stamping
# each copy with $now makes a fresh run visible at a glance in Explorer.
$now = Get-Date
foreach ($r in $renames) {
    $oldPath = Join-Path $src $r.Old
    $newPath = Join-Path $dst $r.New
    if (Test-Path $oldPath) {
        Copy-Item -Path $oldPath -Destination $newPath
        (Get-Item -LiteralPath $newPath).LastWriteTime = $now
        Write-Host "  OK: $($r.New)" -ForegroundColor Green
    } else {
        Write-Host "  NOT FOUND: $($r.Old)" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "Done! All $($renames.Count) files copied successfully." -ForegroundColor Cyan
} else {
    Write-Host "Done! $($renames.Count - $errors)/$($renames.Count) succeeded, $errors errors." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "BEFORE UPLOADING TO R2 -- verify these against the physical 2e cards / card data:" -ForegroundColor Yellow
Write-Host "  HEROES: all 60 hero slugs are PLACEHOLDERS (rare / common-1 / common-2 /" -ForegroundColor Yellow
Write-Host "          uncommon). Replace with the real card-title slugs before upload." -ForegroundColor Yellow
Write-Host "  GROUPS: 'skulls' (was 'skrulls' in 1st-ed) and 'sinister-spider-foes'" -ForegroundColor Yellow
Write-Host "          (was 'spider-foes') follow the 2e source names -- confirm." -ForegroundColor Yellow
Write-Host "  SHIELD: five named Officer variants filed under 'so' -- confirm so vs sp." -ForegroundColor Yellow
Write-Host ""
Write-Host "Files in destination ($((Get-ChildItem $dst).Count) total):" -ForegroundColor Cyan
Get-ChildItem $dst | Select-Object -ExpandProperty Name | Sort-Object
