import { z } from 'zod'
import { lagnSchema } from './validator.js'

export type LAGN = z.infer<typeof lagnSchema>

export type GameSetup = z.infer<typeof lagnSchema>['setup']

/**
 * A benched hero named in a saved loadout (1.3.0+, WP-402 / D-24210).
 *
 * why: reserve only — never played and never gameplay state. Mirrors the
 * `{ id, name }` shape of a played hero exactly. Inferred from `lagnSchema` like
 * every other type here, so a schema change cannot leave the exported type behind.
 */
export type HeroAlternate = NonNullable<GameSetup['hero_alternates']>[number]

// ── Card metadata provenance (1.2.0+, WP-394 / D-24198) ──────────────────────
// why: inferred from lagnSchema like every other type here rather than
// hand-authored, so a schema change cannot leave the exported type behind.

/** Which registry snapshot the producer read. Optional; absent pre-1.2.0. */
export type CatalogRef = z.infer<typeof lagnSchema>['catalog_ref']

/** Which card and printed face a catalog entry names. */
export type RegistryRef = NonNullable<
  NonNullable<z.infer<typeof lagnSchema>['card_catalog']>['cards'][number]['registry_ref']
>

/** A frozen copy of effect text — evidence, not authority. */
export type EffectSnapshot = NonNullable<
  NonNullable<z.infer<typeof lagnSchema>['card_catalog']>['cards'][number]['effect_snapshot']
>
export type CardCatalog = z.infer<typeof lagnSchema>['card_catalog']
export type Replay = z.infer<typeof lagnSchema>['replay']

export type Card = z.infer<typeof lagnSchema>['card_catalog'] extends {
  cards: (infer C)[]
}
  ? C
  : never

export type Action = z.infer<typeof lagnSchema>['replay'] extends {
  turns: Array<{ player_actions: (infer A)[] }>
}
  ? A
  : never

export type VillainEvent = z.infer<typeof lagnSchema>['replay'] extends {
  turns: Array<{ villain_events: (infer V)[] }>
}
  ? V
  : never

export type Turn = z.infer<typeof lagnSchema>['replay'] extends {
  turns: (infer T)[]
}
  ? T
  : never

export type GameResult = z.infer<typeof lagnSchema>['result']

export type ActionType =
  | 'villain_reveal'
  | 'villain_attack'
  | 'villain_escape'
  | 'hero_recruit'
  | 'hero_play'
  | 'hero_discard'
  | 'mastermind_twist'
  | 'mastermind_attack'
  | 'bystander_capture'
  | 'bystander_release'
  | 'wound_dealt'
  | 'shield_deploy'

export type VillainPhaseEvent =
  | 'ambush'
  | 'patrol'
  | 'guard'
  | 'escape_attempted'

export type Outcome = 'victory' | 'defeat'

export type LossCondition =
  | 'mastermind_defeated'
  | 'city_overrun'
  | 'deck_exhausted'

export type RarityCode = 'c1' | 'c2' | 'c3' | 'uc' | 'uc2' | 'uc3' | 'ra'

export type HeroClass = 'strength' | 'instinct' | 'covert' | 'tech' | 'ranged'

export type CardType =
  | 'mastermind'
  | 'scheme'
  | 'villain_group'
  | 'henchmen_group'
  | 'hero'
  | 'shield_officer'
  | 'sidekick'
  | 'wound'
  | 'bystander'

export type Variant = 'solo' | 'cooperative' | 'competitive'

// Compile-time type check: verify types derive from schema
type TypeCheck = LAGN extends z.infer<typeof lagnSchema> ? true : false
