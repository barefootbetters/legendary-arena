import { test, describe } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  validate,
  summarize,
  generateSchema,
  lagnSchema,
  UNEXPRESSIBLE_CONSTRAINTS,
  EXPECTED_REFINEMENT_COUNT,
  LAGN_VERSION,
  LAGN_VERSION_1_0_0,
  LAGN_VERSION_1_1_0,
  LAGN_VERSION_1_2_0,
  LAGN_VERSION_1_3_0,
  LAGN_VERSION_1_4_0
} from './validator'
import { migrateToCurrent } from './migrate'

/** Tier-1 fixture at the given version; callers override `setup` as needed. */
function buildSetupDocument(version: string, setupOverrides: Record<string, unknown> = {}) {
  return {
    lagn_version: version,
    game_id: 'game-pool-001',
    variant: 'solo',
    player_count: 1,
    setup: {
      mastermind: { id: 'mm-001', name: 'Mastermind' },
      scheme: { id: 'sch-001', name: 'Scheme A' },
      villain_groups: [{ id: 'vg-001', name: 'Villain Group 1' }],
      henchmen_groups: [{ id: 'hm-001', name: 'Henchmen 1' }],
      heroes: [{ id: 'h-001', name: 'Hero 1' }],
      bystanders_count: 30,
      wounds_count: 0,
      shield_officers_count: 0,
      sidekicks_count: 0,
      ...setupOverrides
    }
  }
}

describe('LAGN v1.0 Validator', () => {
  // ============================================================================
  // Tier 1: Game Setup Validation
  // ============================================================================

  describe('Tier 1 (Setup) — Valid Cases', () => {
    test('minimal valid setup (Tier 1 only)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Thanos' },
          scheme: { id: 'sch-001', name: 'Scheme A' },
          villain_groups: [{ id: 'vg-001', name: 'Villain Group 1' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen 1' }],
          heroes: [{ id: 'h-001', name: 'Hero 1' }],
          bystanders_count: 5,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.errors, undefined)
    })

    test('full setup with all required fields', () => {
      const lagn = {
        lagn_version: '1.0.0',
        $schema: 'https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json',
        game_id: 'game-full-001',
        variant: 'cooperative',
        player_count: 3,
        setup: {
          mastermind: { id: 'mm-loki', name: 'Loki' },
          scheme: { id: 'sch-avengers', name: 'The Avengers Scheme' },
          villain_groups: [
            { id: 'vg-chitauri', name: 'Chitauri' },
            { id: 'vg-infiltrators', name: 'Infiltrators' }
          ],
          henchmen_groups: [
            { id: 'hm-aliens', name: 'Alien Drones' },
            { id: 'hm-assassins', name: 'Assassins' }
          ],
          heroes: [
            { id: 'h-ironman', name: 'Iron Man' },
            { id: 'h-captain', name: 'Captain America' },
            { id: 'h-hulk', name: 'Hulk' }
          ],
          bystanders_count: 10,
          wounds_count: 5,
          shield_officers_count: 2,
          sidekicks_count: 3
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })

    test('setup with different variant (competitive)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-pvp-001',
        variant: 'competitive',
        player_count: 2,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 3,
          wounds_count: 1,
          shield_officers_count: 0,
          sidekicks_count: 1
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })
  })

  describe('Tier 1 (Setup) — Invalid Cases', () => {
    test('missing game_id', () => {
      const lagn = {
        lagn_version: '1.0.0',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
      assert(result.errors && result.errors.length > 0)
    })

    test('invalid variant enum', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'invalid-variant',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })

    test('missing setup.mastermind', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })
  })

  // ============================================================================
  // Tier 2: Card Catalog Validation
  // ============================================================================

  describe('Tier 2 (Card Catalog) — Valid Cases', () => {
    test('Tier 1 + single card type (mastermind only)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            {
              card_type: 'mastermind',
              ext_id: 'mm-ext-001',
              name: 'Thanos'
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })

    test('Tier 1 + mixed card types', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-002',
        variant: 'cooperative',
        player_count: 2,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            {
              card_type: 'mastermind',
              ext_id: 'mm-ext-001',
              name: 'Thanos'
            },
            {
              card_type: 'scheme',
              ext_id: 'sch-ext-001',
              name: 'Infinity Gems'
            },
            {
              card_type: 'villain_group',
              ext_id: 'vg-ext-001',
              name: 'Black Order'
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })

    test('Tier 1 + all 8 card types', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-003',
        variant: 'cooperative',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            { card_type: 'mastermind', ext_id: 'mm-1', name: 'Mastermind' },
            { card_type: 'scheme', ext_id: 'sch-1', name: 'Scheme' },
            { card_type: 'villain_group', ext_id: 'vg-1', name: 'Villain' },
            {
              card_type: 'henchmen_group',
              ext_id: 'hm-1',
              name: 'Henchmen',
              rarity_code: 'c1'
            },
            {
              card_type: 'hero',
              ext_id: 'h-1',
              name: 'Hero',
              hero_class: ['strength'],
              rarity_code: 'c2'
            },
            { card_type: 'shield_officer', ext_id: 'so-1', name: 'Officer' },
            { card_type: 'sidekick', ext_id: 'sk-1', name: 'Sidekick' },
            { card_type: 'wound', ext_id: 'w-1', name: 'Wound' },
            { card_type: 'bystander', ext_id: 'by-1', name: 'Bystander' }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })
  })

  describe('Tier 2 (Card Catalog) — Invalid Cases', () => {
    test('invalid rarity_code', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            {
              card_type: 'henchmen_group',
              ext_id: 'hm-1',
              name: 'Henchmen',
              rarity_code: 'invalid-rarity'
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })

    test('invalid hero_class array value', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            {
              card_type: 'hero',
              ext_id: 'h-1',
              name: 'Hero',
              hero_class: ['invalid-class'],
              rarity_code: 'c1'
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })

    test('missing required card field (ext_id)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        card_catalog: {
          cards: [
            {
              card_type: 'hero',
              name: 'Hero',
              hero_class: ['strength'],
              rarity_code: 'c1'
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })
  })

  // ============================================================================
  // Tier 3: Replay Log Validation
  // ============================================================================

  describe('Tier 3 (Replay) — Valid Cases', () => {
    test('empty replay (no turns)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: []
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })

    test('replay with single turn and valid seq', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: [
            {
              turn_number: 1,
              active_player_id: 'player-1',
              player_actions: [
                { seq: 0, action_type: 'hero_play' },
                { seq: 1, action_type: 'hero_recruit' },
                { seq: 2, action_type: 'villain_attack' }
              ]
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })

    test('replay with multiple turns', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'cooperative',
        player_count: 2,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: [
            {
              turn_number: 1,
              active_player_id: 'player-1',
              player_actions: [{ seq: 0, action_type: 'hero_play' }]
            },
            {
              turn_number: 2,
              active_player_id: 'player-2',
              player_actions: [{ seq: 0, action_type: 'hero_recruit' }]
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, true)
    })
  })

  describe('Tier 3 (Replay) — Invalid seq Constraint', () => {
    test('seq with gaps (invalid)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: [
            {
              turn_number: 1,
              active_player_id: 'player-1',
              player_actions: [
                { seq: 0, action_type: 'hero_play' },
                { seq: 2, action_type: 'hero_recruit' },
                { seq: 3, action_type: 'villain_attack' }
              ]
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
      assert(result.errors && result.errors.length > 0)
    })

    test('seq with duplicates (invalid)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: [
            {
              turn_number: 1,
              active_player_id: 'player-1',
              player_actions: [
                { seq: 0, action_type: 'hero_play' },
                { seq: 1, action_type: 'hero_recruit' },
                { seq: 1, action_type: 'villain_attack' }
              ]
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })

    test('seq unordered (invalid)', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-001',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        },
        replay: {
          turns: [
            {
              turn_number: 1,
              active_player_id: 'player-1',
              player_actions: [
                { seq: 2, action_type: 'hero_play' },
                { seq: 1, action_type: 'hero_recruit' },
                { seq: 0, action_type: 'villain_attack' }
              ]
            }
          ]
        }
      }
      const result = validate(lagn)
      assert.strictEqual(result.valid, false)
    })
  })

  // ============================================================================
  // Summarize Function
  // ============================================================================

  // ============================================================================
  // Versioning + Support Pools (WP-036 / D-24195)
  // ============================================================================

  describe('Version acceptance', () => {
    test('1.0.0 documents still validate unchanged', () => {
      assert.strictEqual(validate(buildSetupDocument(LAGN_VERSION_1_0_0)).valid, true)
    })

    test('1.1.0 documents validate', () => {
      assert.strictEqual(validate(buildSetupDocument(LAGN_VERSION_1_1_0)).valid, true)
    })

    test('an unknown version is rejected', () => {
      assert.strictEqual(validate(buildSetupDocument('2.0.0')).valid, false)
    })

    test('LAGN_VERSION is the version this build writes', () => {
      assert.strictEqual(LAGN_VERSION, LAGN_VERSION_1_4_0)
    })
  })

  describe('Support pools', () => {
    const pool = {
      bystanders: {
        mode: 'explicit',
        cards: [
          { ext_id: 'core/hostage', copies: 20 },
          { ext_id: 'core/witness', copies: 10 }
        ]
      }
    }

    test('a pool summing to its count is accepted on 1.1.0', () => {
      const doc = buildSetupDocument(LAGN_VERSION_1_1_0, { support_pools: pool })
      assert.strictEqual(validate(doc).valid, true)
    })

    test('a pool disagreeing with its count is rejected', () => {
      const doc = buildSetupDocument(LAGN_VERSION_1_1_0, {
        support_pools: {
          bystanders: { mode: 'explicit', cards: [{ ext_id: 'core/hostage', copies: 29 }] }
        }
      })
      assert.strictEqual(validate(doc).valid, false)
    })

    // why: the schema is not .strict(), so zod would otherwise STRIP this field
    // and report the document valid — a preset that saves and comes back empty.
    // The version gate is what turns that silent loss into a loud failure.
    test('pools on a 1.0.0 document are rejected, not silently stripped', () => {
      const doc = buildSetupDocument(LAGN_VERSION_1_0_0, { support_pools: pool })
      const result = validate(doc)
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors?.some((message) => /support_pools/.test(message)),
        'Expected the error to name support_pools'
      )
    })

    test('sets mode requires sets; explicit mode forbids them', () => {
      const missingSets = buildSetupDocument(LAGN_VERSION_1_1_0, {
        support_pools: {
          bystanders: { mode: 'sets', cards: [{ ext_id: 'core/hostage', copies: 30 }] }
        }
      })
      assert.strictEqual(validate(missingSets).valid, false)

      const withSets = buildSetupDocument(LAGN_VERSION_1_1_0, {
        support_pools: {
          bystanders: {
            mode: 'sets',
            sets: ['core'],
            cards: [{ ext_id: 'core/hostage', copies: 30 }]
          }
        }
      })
      assert.strictEqual(validate(withSets).valid, true)
    })

    test('duplicate ext_ids and zero copies are rejected', () => {
      const duplicate = buildSetupDocument(LAGN_VERSION_1_1_0, {
        support_pools: {
          bystanders: {
            mode: 'explicit',
            cards: [
              { ext_id: 'core/hostage', copies: 15 },
              { ext_id: 'core/hostage', copies: 15 }
            ]
          }
        }
      })
      assert.strictEqual(validate(duplicate).valid, false)

      const zeroCopies = buildSetupDocument(LAGN_VERSION_1_1_0, {
        bystanders_count: 0,
        support_pools: {
          bystanders: { mode: 'explicit', cards: [{ ext_id: 'core/hostage', copies: 0 }] }
        }
      })
      assert.strictEqual(validate(zeroCopies).valid, false)
    })
  })

  describe('Migration', () => {
    test('a 1.0.0 document migrates to the current version and then validates', () => {
      // why: WP-406 flipped the writer to 1.4.0, so migrateToCurrent now walks the
      // full registered chain 1.0.0 -> 1.4.0 (every step became reachable at the
      // flip). Each hop is a pure restamp; the migrated document validates at 1.4.0.
      const original = buildSetupDocument(LAGN_VERSION_1_0_0)
      const result = migrateToCurrent(original)
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.payload['lagn_version'], LAGN_VERSION)
      assert.deepStrictEqual(result.applied, [
        '1.0.0->1.1.0',
        '1.1.0->1.2.0',
        '1.2.0->1.3.0',
        '1.3.0->1.4.0'
      ])
      assert.strictEqual(validate(result.payload).valid, true)
    })

    test('migration does not invent pools from counts', () => {
      const result = migrateToCurrent(buildSetupDocument(LAGN_VERSION_1_0_0))
      const setup = result.payload['setup'] as Record<string, unknown>
      assert.strictEqual(setup['support_pools'], undefined)
      assert.strictEqual(setup['bystanders_count'], 30)
    })

    test('a document already at the current version is returned unchanged', () => {
      // why: "current" is the writer version, now 1.4.0 (WP-406). A document
      // already at it needs no migration — applied is empty and the payload is
      // returned byte-identical.
      const original = buildSetupDocument(LAGN_VERSION_1_4_0)
      const result = migrateToCurrent(original)
      assert.strictEqual(result.error, undefined)
      assert.deepStrictEqual(result.applied, [])
      assert.deepStrictEqual(result.payload, original)
    })

    test('unreadable input fails loud rather than half-migrating', () => {
      assert.ok(migrateToCurrent(null).error)
      assert.ok(migrateToCurrent({ setup: {} }).error)
      assert.ok(migrateToCurrent({ lagn_version: '0.9.0' }).error)
    })
  })

  describe('summarize() function', () => {
    test('returns all nulls for invalid data', () => {
      const invalid = { invalid: 'data' }
      const summary = summarize(invalid)
      assert.strictEqual(summary.valid, false)
      assert.strictEqual(summary.game_id, null)
      assert.strictEqual(summary.variant, null)
      assert.strictEqual(summary.player_count, null)
      assert.strictEqual(summary.result, null)
    })

    test('extracts fields from valid Tier 1', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-123',
        variant: 'solo',
        player_count: 1,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const summary = summarize(lagn)
      assert.strictEqual(summary.valid, true)
      assert.strictEqual(summary.game_id, 'game-123')
      assert.strictEqual(summary.variant, 'solo')
      assert.strictEqual(summary.player_count, 1)
    })

    test('handles missing result field gracefully', () => {
      const lagn = {
        lagn_version: '1.0.0',
        game_id: 'game-456',
        variant: 'cooperative',
        player_count: 2,
        setup: {
          mastermind: { id: 'mm-001', name: 'Mastermind' },
          scheme: { id: 'sch-001', name: 'Scheme' },
          villain_groups: [{ id: 'vg-001', name: 'Villains' }],
          henchmen_groups: [{ id: 'hm-001', name: 'Henchmen' }],
          heroes: [{ id: 'h-001', name: 'Hero' }],
          bystanders_count: 0,
          wounds_count: 0,
          shield_officers_count: 0,
          sidekicks_count: 0
        }
      }
      const summary = summarize(lagn)
      assert.strictEqual(summary.valid, true)
      assert.strictEqual(summary.result, 'unknown')
    })
  })
})

// ============================================================================
// JSON Schema Derivation (WP-392 / D-24196)
// ============================================================================

/**
 * Counts the zod refinement nodes reachable from a schema.
 *
 * why: `.refine()` / `.superRefine()` wrap their subject in a ZodEffects node.
 * Those predicates are exactly what JSON Schema derivation cannot express, so
 * counting the nodes tells us whether the UNEXPRESSIBLE_CONSTRAINTS allowlist
 * still describes the whole set. Walks the internal `_def` tree because zod
 * exposes no public traversal API.
 */
function countRefinementNodes(schema: unknown): number {
  const visited = new Set<unknown>()

  function walk(node: any): number {
    if (node === null || typeof node !== 'object' || visited.has(node)) {
      return 0
    }
    visited.add(node)

    const definition = node._def
    if (definition === undefined) {
      return 0
    }

    let found = definition.typeName === 'ZodEffects' ? 1 : 0

    // why: each zod type parks its children under a different _def key, and
    // there is no common accessor. Probing the known container keys covers
    // every construct this schema uses.
    const children: unknown[] = []
    if (definition.schema !== undefined) children.push(definition.schema)
    if (definition.innerType !== undefined) children.push(definition.innerType)
    if (definition.type !== undefined) children.push(definition.type)
    if (Array.isArray(definition.options)) children.push(...definition.options)
    if (definition.shape !== undefined) {
      const shape = typeof definition.shape === 'function' ? definition.shape() : definition.shape
      children.push(...Object.values(shape))
    }

    for (const child of children) {
      found += walk(child)
    }
    return found
  }

  return walk(schema)
}

describe('JSON Schema derivation', () => {
  test('every zod refinement is recorded in UNEXPRESSIBLE_CONSTRAINTS', () => {
    // why: this is the drift guard the package previously lacked. Derivation
    // drops refinements silently; if someone adds a .refine() without adding a
    // matching allowlist entry, the published schema quietly stops describing
    // what the validator enforces. Failing here forces the decision to be made
    // and written down rather than discovered in production.
    assert.strictEqual(
      countRefinementNodes(lagnSchema),
      EXPECTED_REFINEMENT_COUNT,
      'lagnSchema gained or lost a .refine()/.superRefine(). JSON Schema cannot ' +
        'express these, so each one must be documented in UNEXPRESSIBLE_CONSTRAINTS ' +
        'in validator.ts — add or remove the matching entry.'
    )
  })

  test('every allowlist entry states a path, a constraint, and a reason', () => {
    for (const entry of UNEXPRESSIBLE_CONSTRAINTS) {
      assert.ok(entry.path.length > 0, 'allowlist entry is missing a path')
      assert.ok(entry.constraint.length > 0, `${entry.path} is missing a constraint`)
      assert.ok(entry.reason.length > 0, `${entry.path} is missing a reason`)
    }
  })

  test('published contract fields survive derivation', () => {
    // why: zod-to-json-schema emits its own $schema and drops title/description,
    // so these are re-applied by hand after the spread. Producers stamp the
    // 2020-12 URL and consumers pin it — a silent draft change would break them.
    const schema = generateSchema()
    assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
    assert.strictEqual(schema.title, 'LAGN v1.1 — Legendary Arena Game Notation')
    assert.deepStrictEqual(schema.properties.lagn_version.enum, [
      LAGN_VERSION_1_0_0,
      LAGN_VERSION_1_1_0,
      LAGN_VERSION_1_2_0,
      LAGN_VERSION_1_3_0,
      LAGN_VERSION_1_4_0
    ])
    // why: the writer stamps 1.4.0 as of WP-406 — the result-LAGN producer emits
    // players[], which the version gate requires. Readers still accept every
    // version back to 1.0.0, so no stored record migrates.
    assert.strictEqual(LAGN_VERSION, LAGN_VERSION_1_4_0)
    assert.strictEqual(
      schema.properties.$schema.default,
      'https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json'
    )
    assert.deepStrictEqual(schema.required, [
      'lagn_version',
      'game_id',
      'variant',
      'player_count',
      'setup'
    ])
  })

  test('derivation closes the divergences the hand-written schema carried', () => {
    // why: the hand-written copy described card_catalog items and replay turns
    // as bare `{ type: 'object' }` while zod enforced a 9-branch discriminated
    // union and a fully typed turn. Those two were the largest silent gaps
    // between the published contract and the validator.
    const schema = generateSchema()
    const cardItems = schema.properties.card_catalog.properties.cards.items
    assert.strictEqual(cardItems.anyOf.length, 9, 'card_catalog items lost its union')

    const turnItems = schema.properties.replay.properties.turns.items
    assert.ok(turnItems.properties.turn_number, 'replay turns items is untyped again')
    assert.ok(turnItems.properties.active_player_id, 'replay turns items is untyped again')
  })

  test('unknown keys stay permitted, matching zod strip semantics', () => {
    // why: lagnSchema never calls .strict(), so zod drops unknown keys and
    // still parses. The library's default emits additionalProperties: false,
    // which would reject documents validate() accepts.
    const schema = generateSchema()
    assert.strictEqual(schema.additionalProperties, true)
    assert.strictEqual(schema.properties.setup.additionalProperties, true)
  })

  test('the committed schemas/lagn-v1.json matches the generator', () => {
    // why: CI regenerates and diffs, but only on the lagn-schema-drift job.
    // Asserting it here too means a stale committed schema fails the unit
    // suite as well, close to where the source changed.
    const committed = JSON.parse(
      readFileSync(new URL('../schemas/lagn-v1.json', import.meta.url), 'utf8')
    )
    assert.deepStrictEqual(committed, generateSchema())
  })
})

describe('published JSON Schema accepts the shipped fixtures', () => {
  // why: the whole point of deriving is that the published schema and the
  // validator agree. Checking fixtures against zod alone would not prove that —
  // this compiles the generated JSON Schema with a real JSON Schema engine and
  // runs every example through it, the same way an external consumer would.
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  addFormats(ajv)
  const compiled = ajv.compile(generateSchema())

  const fixtures = [
    'tier1-setup-only.lagn.json',
    'tier1-support-pools.lagn.json',
    'tier2-with-catalog.lagn.json',
    'tier3-with-replay.lagn.json',
    'tier2-provenance.lagn.json',
    'tier1-hero-alternates.lagn.json',
    'tier1-players.lagn.json'
  ]

  for (const fixture of fixtures) {
    test(`${fixture} validates against the published schema`, () => {
      const document = JSON.parse(
        readFileSync(new URL(`../examples/${fixture}`, import.meta.url), 'utf8')
      )
      const isValid = compiled(document)
      assert.ok(
        isValid,
        `${fixture} failed the published schema: ${JSON.stringify(compiled.errors)}`
      )
      // why: zod must agree with the published schema on every fixture. A
      // fixture passing one and failing the other is precisely the drift this
      // packet exists to prevent.
      assert.strictEqual(validate(document).valid, true, `${fixture} failed zod`)
    })
  }
})

// ============================================================================
// Card Metadata Provenance (WP-394 / D-24198)
// ============================================================================

describe('LAGN 1.2.0 provenance', () => {
  /** A 1.2.0 Tier-1 document; callers layer provenance on top. */
  function buildProvenanceDocument(version: string, extras: Record<string, unknown> = {}) {
    return { ...buildSetupDocument(version), ...extras }
  }

  const VALID_CATALOG_REF = {
    source: 'legendary-arena-registry',
    registry_version: 'sha256:' + 'a'.repeat(64),
    set_content_hashes: { core: 'sha256:' + 'b'.repeat(64) }
  }

  test('AC-2: a 1.1.0 document carrying catalog_ref is REJECTED', () => {
    // why: this is the behaviour change. Today the unknown key is silently
    // stripped and the document validates; after the gate it fails loudly.
    const result = validate(
      buildProvenanceDocument(LAGN_VERSION_1_1_0, { catalog_ref: VALID_CATALOG_REF })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) => error.includes('provenance requires lagn_version')),
      `expected the version-gate message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-2: a 1.2.0 document WITHOUT provenance is accepted', () => {
    assert.strictEqual(validate(buildProvenanceDocument(LAGN_VERSION_1_2_0)).valid, true)
  })

  test('a 1.2.0 document WITH catalog_ref is accepted', () => {
    const result = validate(
      buildProvenanceDocument(LAGN_VERSION_1_2_0, { catalog_ref: VALID_CATALOG_REF })
    )
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  test('AC-3: effect_snapshot without catalog_ref is rejected', () => {
    const result = validate(
      buildProvenanceDocument(LAGN_VERSION_1_2_0, {
        card_catalog: {
          cards: [
            {
              card_type: 'mastermind',
              ext_id: 'core/thanos',
              name: 'Thanos',
              effect_snapshot: {
                text: ['Master Strike.'],
                source_hash: 'sha256:' + 'c'.repeat(64)
              }
            }
          ]
        }
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) => error.includes('effect_snapshot requires')),
      `expected the catalog_ref-pin message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('a hash that is not a real sha256 digest is rejected', () => {
    // why: the prefix alone would accept "sha256:not-a-digest". The pattern is
    // also what keeps the derived JSON Schema compilable — zod's startsWith
    // emits `^sha256\:`, an invalid Unicode-mode escape that made ajv throw.
    const result = validate(
      buildProvenanceDocument(LAGN_VERSION_1_2_0, {
        catalog_ref: { ...VALID_CATALOG_REF, registry_version: 'sha256:not-a-digest' }
      })
    )
    assert.strictEqual(result.valid, false)
  })

  test('AC-5: migrateToCurrent targets the writer version (1.4.0 as of WP-406)', () => {
    const migratedFrom100 = migrateToCurrent(buildSetupDocument(LAGN_VERSION_1_0_0))
    assert.strictEqual(migratedFrom100.error, undefined)
    assert.strictEqual(migratedFrom100.payload.lagn_version, LAGN_VERSION)

    // why: WP-406 flipped the writer to 1.4.0, so the previously-unreachable
    // 1.1.0 -> 1.2.0 -> 1.3.0 -> 1.4.0 steps are now REACHABLE — a 1.2.0 document
    // migrates FORWARD to 1.4.0. It was returned untouched only while the writer
    // sat at 1.1.0.
    const from120 = migrateToCurrent(buildProvenanceDocument(LAGN_VERSION_1_2_0))
    assert.strictEqual(from120.payload.lagn_version, LAGN_VERSION_1_4_0)
    assert.deepStrictEqual(from120.applied, ['1.2.0->1.3.0', '1.3.0->1.4.0'])
  })

  test('AC-5: support_pools survives migration untouched', () => {
    const withPools = buildSetupDocument(LAGN_VERSION_1_1_0, {
      bystanders_count: 2,
      support_pools: {
        bystanders: {
          mode: 'explicit',
          cards: [{ ext_id: 'core/bystander', copies: 2 }]
        }
      }
    })
    const migrated = migrateToCurrent(withPools)
    assert.strictEqual(migrated.error, undefined)
    const setup = migrated.payload.setup as Record<string, unknown>
    assert.ok(setup.support_pools, 'support_pools was dropped by migration')
  })

  test('AC-8: no JSON-pointer field anywhere in the generated schema', () => {
    const serialized = JSON.stringify(generateSchema())
    assert.ok(!/json_?pointer/i.test(serialized), 'a JSON-pointer field leaked in')
  })

  test('AC-9: lagn-spec still has no dependency on the registry package', () => {
    // why: hash COMPUTATION belongs to the producer packet. Importing WP-393's
    // canonicalJson.ts would invent a lagn-spec -> registry edge that
    // ARCHITECTURE.md does not have, to save a few lines.
    const packageManifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    )
    const allDependencies = {
      ...(packageManifest.dependencies ?? {}),
      ...(packageManifest.devDependencies ?? {})
    }
    assert.ok(
      !Object.keys(allDependencies).includes('@legendary-arena/registry'),
      'lagn-spec gained a registry dependency'
    )
  })
})

// ============================================================================
// LAGN 1.3.0 Hero Alternates (WP-402 / D-24210 / D-24211)
// ============================================================================

describe('LAGN 1.3.0 hero alternates', () => {
  const BENCH = [
    { id: 'core/gambit', name: 'Gambit' },
    { id: 'core/storm', name: 'Storm' }
  ]

  test('AC-1: a 1.3.0 document carrying hero_alternates validates', () => {
    const result = validate(
      buildSetupDocument(LAGN_VERSION_1_3_0, { hero_alternates: BENCH })
    )
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  test('AC-6: no producer emits 1.3.0 — the writer skipped it (now 1.4.0)', () => {
    // why: WP-402 added 1.3.0 to the READ set only; it never flipped the writer.
    // WP-406 later flipped the writer to 1.4.0, skipping 1.3.0 — so 1.3.0 stays a
    // read-only version no producer emits, and the stamped version is 1.4.0.
    assert.strictEqual(LAGN_VERSION, LAGN_VERSION_1_4_0)
    assert.notStrictEqual(LAGN_VERSION, LAGN_VERSION_1_3_0)
  })

  for (const version of [LAGN_VERSION_1_0_0, LAGN_VERSION_1_1_0, LAGN_VERSION_1_2_0]) {
    test(`AC-2: hero_alternates on a ${version} document is REJECTED, never stripped`, () => {
      // why: lagnSchema is not .strict(), so an ungated bench would vanish on
      // parse and the document would look clean — the worst available failure.
      const result = validate(buildSetupDocument(version, { hero_alternates: BENCH }))
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors?.some((error) =>
          error.includes('setup.hero_alternates requires lagn_version 1.3.0 or later')
        ),
        `expected the version-gate message, got: ${JSON.stringify(result.errors)}`
      )
    })
  }

  test('AC-3: an alternate id also present in setup.heroes is rejected', () => {
    const result = validate(
      buildSetupDocument(LAGN_VERSION_1_3_0, {
        heroes: [{ id: 'core/gambit', name: 'Gambit' }],
        hero_alternates: [{ id: 'core/gambit', name: 'Gambit' }]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes('is listed as both a played hero and an alternate')
      ),
      `expected the overlap message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-3: a repeated alternate id is rejected', () => {
    const result = validate(
      buildSetupDocument(LAGN_VERSION_1_3_0, {
        hero_alternates: [
          { id: 'core/gambit', name: 'Gambit' },
          { id: 'core/gambit', name: 'Gambit' }
        ]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes('is listed more than once among the hero alternates')
      ),
      `expected the duplicate message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-5: a 1.3.0 document carrying catalog_ref validates (the ordinal-gate fix)', () => {
    // why: the pre-fix `=== LAGN_VERSION_1_2_0` gate REJECTS this — provenance is
    // legal on 1.2.0 and every later version, but equality only recognized 1.2.0.
    // This case is red against the equality gate and green against the ordinal one
    // (D-24211). Demonstrated by mutation in the session log.
    // why: catalog_ref sits at the DOCUMENT ROOT, not under setup — spreading it
    // after buildSetupDocument() rather than into its setupOverrides. A nested
    // catalog_ref would be stripped and the doc would pass for the wrong reason,
    // never exercising the version gate at all.
    const result = validate({
      ...buildSetupDocument(LAGN_VERSION_1_3_0),
      catalog_ref: {
        source: 'legendary-arena-registry',
        registry_version: 'sha256:' + 'a'.repeat(64),
        set_content_hashes: { core: 'sha256:' + 'b'.repeat(64) }
      }
    })
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  test('AC-7: migrateToCurrent steps a 1.3.0 input forward to 1.4.0', () => {
    // why: WP-406 flipped the writer to 1.4.0, so the 1.3.0 -> 1.4.0 step is now
    // REACHABLE — a 1.3.0 document migrates forward one hop (it was returned
    // untouched only while the writer sat at 1.1.0). The restamp carries the bench
    // through untouched: migration only advances the version marker, never the setup.
    const original = buildSetupDocument(LAGN_VERSION_1_3_0, { hero_alternates: BENCH })
    const result = migrateToCurrent(original)
    assert.strictEqual(result.error, undefined)
    assert.strictEqual(result.payload.lagn_version, LAGN_VERSION_1_4_0)
    assert.deepStrictEqual(result.applied, ['1.3.0->1.4.0'])
    assert.deepStrictEqual(result.payload.setup, original.setup)
  })

  test('AC-7: migration never invents a bench from setup.heroes', () => {
    // why: migration is forward-only and may not fabricate information that was
    // never in the source. A 1.0.0 document migrated forward has no bench.
    const migrated = migrateToCurrent(buildSetupDocument(LAGN_VERSION_1_0_0))
    const setup = migrated.payload.setup as Record<string, unknown>
    assert.strictEqual(setup.hero_alternates, undefined)
  })
})

// ============================================================================
// LAGN 1.4.0 Match Participants + Scoring Profile (WP-405 / D-24214 / D-24215)
// ============================================================================

describe('LAGN 1.4.0 match participants + scoring profile', () => {
  /**
   * A Tier-1 document at `version` with a chosen player_count, plus any root
   * blocks (players / scoring_profile) layered on. `players` / `scoring_profile`
   * sit at the DOCUMENT ROOT, so they are spread after buildSetupDocument()
   * rather than into setupOverrides — a nested copy would be stripped and the
   * document would pass for the wrong reason, never exercising the gate.
   */
  function buildPlayersDocument(
    version: string,
    playerCount: number,
    rootBlocks: Record<string, unknown> = {}
  ) {
    return { ...buildSetupDocument(version), player_count: playerCount, ...rootBlocks }
  }

  const ROSTER = [
    { seat: 0, player_id: 'player-ana', display_name: 'Ana' },
    { seat: 1, player_id: 'player-devon' }
  ]

  test('AC-1: a 1.4.0 document carrying players[] and scoring_profile validates', () => {
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 3, {
        players: ROSTER,
        scoring_profile: 'legends-gauntlet-v1'
      })
    )
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  for (const version of [
    LAGN_VERSION_1_0_0,
    LAGN_VERSION_1_1_0,
    LAGN_VERSION_1_2_0,
    LAGN_VERSION_1_3_0
  ]) {
    test(`AC-2: players[] on a ${version} document is REJECTED, never stripped`, () => {
      // why: lagnSchema is not .strict(), so an ungated roster would vanish on
      // parse and the document would look clean — the worst available failure.
      const result = validate(buildPlayersDocument(version, 3, { players: ROSTER }))
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors?.some((error) =>
          error.includes(
            'players and scoring_profile require lagn_version 1.4.0 or later'
          )
        ),
        `expected the version-gate message, got: ${JSON.stringify(result.errors)}`
      )
    })

    test(`AC-2: scoring_profile on a ${version} document is REJECTED, never stripped`, () => {
      const result = validate(
        buildPlayersDocument(version, 3, { scoring_profile: 'legends-gauntlet-v1' })
      )
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors?.some((error) =>
          error.includes(
            'players and scoring_profile require lagn_version 1.4.0 or later'
          )
        ),
        `expected the version-gate message, got: ${JSON.stringify(result.errors)}`
      )
    })
  }

  test('AC-3: a duplicate seat is rejected', () => {
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 3, {
        players: [
          { seat: 0, player_id: 'player-ana' },
          { seat: 0, player_id: 'player-devon' }
        ]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes('seat 0 is listed more than once — one participant per seat')
      ),
      `expected the duplicate-seat message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-3: a duplicate player_id is rejected', () => {
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 3, {
        players: [
          { seat: 0, player_id: 'player-ana' },
          { seat: 1, player_id: 'player-ana' }
        ]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes(
          'player_id player-ana is listed more than once — a player cannot occupy two seats'
        )
      ),
      `expected the duplicate-player message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-3: a seat >= player_count is rejected', () => {
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 2, {
        players: [{ seat: 2, player_id: 'player-ana' }]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes('seat 2 is out of range — seats run 0 to player_count-1 (1)')
      ),
      `expected the seat-range message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('AC-3: more participants than player_count is rejected', () => {
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 1, {
        players: [
          { seat: 0, player_id: 'player-ana' },
          { seat: 1, player_id: 'player-devon' }
        ]
      })
    )
    assert.strictEqual(result.valid, false)
    assert.ok(
      result.errors?.some((error) =>
        error.includes(
          'players lists 2 participants but player_count is 1 — a match cannot credit more players than seats'
        )
      ),
      `expected the over-count message, got: ${JSON.stringify(result.errors)}`
    )
  })

  test('a roster shorter than player_count is accepted (bot seats carry no entry)', () => {
    // why: the count check is `<=`, not `==`. A 3-seat match with two human
    // participants and one bot is valid — the bot seat carries no entry.
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 3, { players: ROSTER })
    )
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  test('AC-5: scoring_profile accepts any string and is not enum-constrained', () => {
    // why: the concrete profile set is the leaderboard's, not this package's. A
    // never-before-seen profile name must validate — an enum here would be
    // fabrication (D-24215).
    const result = validate(
      buildPlayersDocument(LAGN_VERSION_1_4_0, 3, {
        scoring_profile: 'a-brand-new-division-nobody-has-seen'
      })
    )
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors))
  })

  test('AC-6: the writer stamps 1.4.0 as of WP-406 (the result-LAGN producer)', () => {
    // why: WP-405 added 1.4.0 to the READ set only (reader-only). WP-406 flips the
    // WRITE value to 1.4.0 because the result-LAGN producer emits players[], which
    // the version gate requires. Readers still accept every version back to 1.0.0.
    assert.strictEqual(LAGN_VERSION, LAGN_VERSION_1_4_0)
  })

  test('AC-7: migrateToCurrent leaves a 1.4.0 input unchanged with applied: []', () => {
    // why: LAGN_VERSION is still 1.1.0, so a 1.4.0 input is already NEWER than the
    // writer target. It is left untouched — never downgraded, never re-stamped,
    // never invents participants — and the 1.3.0 -> 1.4.0 step is registered but
    // UNREACHABLE. Mirrors the 1.2.0 / 1.3.0 precedents exactly.
    const original = buildPlayersDocument(LAGN_VERSION_1_4_0, 3, {
      players: ROSTER,
      scoring_profile: 'legends-gauntlet-v1'
    })
    const result = migrateToCurrent(original)
    assert.strictEqual(result.error, undefined)
    assert.strictEqual(result.payload.lagn_version, LAGN_VERSION_1_4_0)
    assert.deepStrictEqual(result.applied, [])
    assert.deepStrictEqual(result.payload, original)
  })
})
