import { test, describe } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  validate,
  summarize,
  LAGN_VERSION,
  LAGN_VERSION_1_0_0,
  LAGN_VERSION_1_1_0
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
      assert.strictEqual(LAGN_VERSION, LAGN_VERSION_1_1_0)
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
      const original = buildSetupDocument(LAGN_VERSION_1_0_0)
      const result = migrateToCurrent(original)
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.payload['lagn_version'], LAGN_VERSION)
      assert.deepStrictEqual(result.applied, ['1.0.0->1.1.0'])
      assert.strictEqual(validate(result.payload).valid, true)
    })

    test('migration does not invent pools from counts', () => {
      const result = migrateToCurrent(buildSetupDocument(LAGN_VERSION_1_0_0))
      const setup = result.payload['setup'] as Record<string, unknown>
      assert.strictEqual(setup['support_pools'], undefined)
      assert.strictEqual(setup['bystanders_count'], 30)
    })

    test('a document already at the current version is returned unchanged', () => {
      const original = buildSetupDocument(LAGN_VERSION_1_1_0)
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
