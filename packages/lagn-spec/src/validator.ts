import { z } from 'zod'

// ============================================================================
// LAGN Zod Schema — Single Source of Truth
// ============================================================================

// why: WP-036 / D-24195 — before this, the literal '1.0.0' was duplicated
// across 5 production sites and ~30 fixtures with no single source, so any
// bump meant editing 35 places. These constants follow the convention already
// set by packages/game-engine/src/versioning/versioning.check.ts:22-30 —
// version constants live in TS, deliberately not read from package.json, so
// the value carries no build-pipeline coupling. package.json is the
// human-readable copy, bumped in lockstep.

/** The first published LAGN version. Still accepted; still valid. */
export const LAGN_VERSION_1_0_0 = '1.0.0'

/** Adds optional `setup.support_pools` (WP-036). Strict superset of 1.0.0. */
export const LAGN_VERSION_1_1_0 = '1.1.0'

/** The version this build stamps on documents it writes. */
export const LAGN_VERSION = LAGN_VERSION_1_1_0

/**
 * Every version this build can read, oldest first.
 *
 * why: readers accept the full list while writers emit only LAGN_VERSION.
 * That asymmetry is what keeps existing records readable without forcing a
 * migration pass over stored games.
 */
export const LAGN_SUPPORTED_VERSIONS = [
  LAGN_VERSION_1_0_0,
  LAGN_VERSION_1_1_0
] as const

export type LagnVersion = (typeof LAGN_SUPPORTED_VERSIONS)[number]

// Enums
const ActionTypeEnum = z.enum([
  'villain_reveal',
  'villain_attack',
  'villain_escape',
  'hero_recruit',
  'hero_play',
  'hero_discard',
  'mastermind_twist',
  'mastermind_attack',
  'bystander_capture',
  'bystander_release',
  'wound_dealt',
  'shield_deploy'
])

const VillainPhaseEventEnum = z.enum([
  'ambush',
  'patrol',
  'guard',
  'escape_attempted'
])

const OutcomeEnum = z.enum(['victory', 'defeat'])

const LossConditionEnum = z.enum([
  'mastermind_defeated',
  'city_overrun',
  'deck_exhausted'
])

const RarityCodeEnum = z.enum(['c1', 'c2', 'c3', 'uc', 'uc2', 'uc3', 'ra'])

const HeroClassEnum = z.enum([
  'strength',
  'instinct',
  'covert',
  'tech',
  'ranged'
])

const CardTypeEnum = z.enum([
  'mastermind',
  'scheme',
  'villain_group',
  'henchmen_group',
  'hero',
  'shield_officer',
  'sidekick',
  'wound',
  'bystander'
])

// ============================================================================
// TIER 1: Game Setup (Required)
// ============================================================================

// why: WP-036 / D-24195 — support pools name WHICH cards fill the four supply
// piles; the *_count fields carry only how many. Mirrors the MATCH-SETUP
// envelope shape locked by D-24194, translated to LAGN's snake_case and its
// `shield_officers` naming (matching shield_officers_count).
//
// Added to `setup` rather than the document root because that is where the
// counts they constrain already live — keeping a pool and its count in one
// object makes the sum-equals-count check a local refinement instead of the
// cross-block invariant the MATCH-SETUP side had to accept.
const SupportPoolSchema = z.object({
  mode: z.enum(['sets', 'explicit']),
  sets: z.array(z.string()).min(1).optional(),
  cards: z.array(
    z.object({
      ext_id: z.string(),
      copies: z.number().int().positive()
    })
  ).min(1)
}).superRefine((pool, ctx) => {
  if (pool.mode === 'sets' && pool.sets === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sets'],
      message: 'A support pool in "sets" mode must list the set abbreviations it was drawn from'
    })
  }
  if (pool.mode === 'explicit' && pool.sets !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sets'],
      message: 'A support pool in "explicit" mode must not carry a sets array'
    })
  }
  const seen = new Set<string>()
  for (const card of pool.cards) {
    if (seen.has(card.ext_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cards'],
        message: `Support pool lists ${card.ext_id} more than once — combine duplicates into one entry with summed copies`
      })
      break
    }
    seen.add(card.ext_id)
  }
})

const SupportPoolsSchema = z.object({
  bystanders: SupportPoolSchema.optional(),
  wounds: SupportPoolSchema.optional(),
  shield_officers: SupportPoolSchema.optional(),
  sidekicks: SupportPoolSchema.optional()
})

/** Pairs each pool with the count field it must sum to. */
const SUPPORT_POOL_COUNT_FIELD = {
  bystanders: 'bystanders_count',
  wounds: 'wounds_count',
  shield_officers: 'shield_officers_count',
  sidekicks: 'sidekicks_count'
} as const

const GameSetupSchema = z.object({
  mastermind: z.object({
    id: z.string(),
    name: z.string()
  }),
  scheme: z.object({
    id: z.string(),
    name: z.string()
  }),
  villain_groups: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ).min(1),
  henchmen_groups: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ).min(1),
  heroes: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ).min(1),
  bystanders_count: z.number().int().min(0),
  wounds_count: z.number().int().min(0),
  shield_officers_count: z.number().int().min(0),
  sidekicks_count: z.number().int().min(0),
  support_pools: SupportPoolsSchema.optional()
}).superRefine((setup, ctx) => {
  // why: a pool that disagrees with its count describes a different pile than
  // the engine builds. Checked here rather than at the root because both
  // halves live in `setup`.
  if (setup.support_pools === undefined) {
    return
  }
  for (const [kind, countField] of Object.entries(SUPPORT_POOL_COUNT_FIELD)) {
    const pool = setup.support_pools[kind as keyof typeof SUPPORT_POOL_COUNT_FIELD]
    if (pool === undefined) {
      continue
    }
    const total = pool.cards.reduce((sum, card) => sum + card.copies, 0)
    const declared = setup[countField]
    if (total !== declared) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['support_pools', kind, 'cards'],
        message: `The ${kind} pool sums to ${total} copies but ${countField} declares ${declared}`
      })
    }
  }
})

// ============================================================================
// TIER 2: Full Card Catalog (Optional)
// ============================================================================

const CardSchema = z.discriminatedUnion('card_type', [
  z.object({
    card_type: z.literal('mastermind'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('scheme'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('villain_group'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('henchmen_group'),
    ext_id: z.string(),
    name: z.string(),
    rarity_code: RarityCodeEnum,
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('hero'),
    ext_id: z.string(),
    name: z.string(),
    hero_class: HeroClassEnum.array().min(1),
    rarity_code: RarityCodeEnum,
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('shield_officer'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('sidekick'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('wound'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  }),
  z.object({
    card_type: z.literal('bystander'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional()
  })
])

const CardCatalogSchema = z.object({
  cards: z.array(CardSchema).min(1)
})

// ============================================================================
// TIER 3: Turn-by-Turn Replay Log (Optional)
// ============================================================================

const ActionSchema = z.object({
  seq: z.number().int().min(0),
  action_type: ActionTypeEnum,
  actor_player_id: z.string().optional(),
  target_card_ext_id: z.string().optional(),
  details: z.record(z.unknown()).optional()
})

const VillainEventSchema = z.object({
  phase: VillainPhaseEventEnum,
  card_ext_id: z.string()
})

const TurnSchema = z.object({
  turn_number: z.number().int().min(1),
  active_player_id: z.string(),
  villain_events: z.array(VillainEventSchema).optional(),
  player_actions: z.array(ActionSchema).optional(),
  stage_transitions: z.array(
    z.object({
      from: z.enum(['start', 'main', 'cleanup']),
      to: z.enum(['start', 'main', 'cleanup'])
    })
  ).optional()
})

const ReplaySchema = z.object({
  turns: z.array(TurnSchema).optional()
})

// Validate seq constraint: strictly increasing by 1, no gaps, no duplicates
// The seq values must appear in order: [0,1,2...] or [1,2,3...] etc.
const validateSeqConstraint = (actions: Array<{ seq: number }>): boolean => {
  if (actions.length === 0) return true
  const seqs = actions.map(a => a.seq)

  // Get the starting seq value
  const firstSeq = seqs[0]

  // Check that each seq is exactly firstSeq + index
  for (let i = 0; i < seqs.length; i++) {
    if (seqs[i] !== firstSeq + i) return false
  }

  return true
}

// ============================================================================
// Root LAGN Schema
// ============================================================================

export const lagnSchema = z.object({
  lagn_version: z.enum(LAGN_SUPPORTED_VERSIONS),
  $schema: z.string().url().optional(),
  game_id: z.string(),
  variant: z.enum(['solo', 'cooperative', 'competitive']),
  player_count: z.number().int().min(1).max(5),
  setup: GameSetupSchema,
  card_catalog: CardCatalogSchema.optional(),
  replay: ReplaySchema.optional(),
  result: z.object({
    outcome: OutcomeEnum,
    loss_condition: LossConditionEnum.optional(),
    victory_points: z.number().int().optional(),
    timestamp: z.string().datetime().optional()
  }).optional()
}).refine(
  (data) => {
    if (data.replay?.turns) {
      for (const turn of data.replay.turns) {
        if (turn.player_actions && turn.player_actions.length > 0) {
          if (!validateSeqConstraint(turn.player_actions)) {
            return false
          }
        }
      }
    }
    return true
  },
  {
    message: 'Replay action seq must be strictly increasing with no gaps or duplicates',
    path: ['replay', 'seq']
  }
).refine(
  // why: WP-036 / D-24195 — this schema has no .strict(), so zod STRIPS unknown
  // keys rather than rejecting them. Without this check a support_pools block
  // written into a 1.0.0 document would vanish silently and the preset would
  // come back empty — the worst available failure mode. Version-gating the
  // field turns that silent loss into a loud error, without making the whole
  // schema strict (which would reject documents that pass today).
  (data) => data.lagn_version !== LAGN_VERSION_1_0_0 || data.setup.support_pools === undefined,
  {
    message: `setup.support_pools requires lagn_version ${LAGN_VERSION_1_1_0} or later — a ${LAGN_VERSION_1_0_0} document cannot carry support pools`,
    path: ['setup', 'support_pools']
  }
)

export type LAGN = z.infer<typeof lagnSchema>

// ============================================================================
// Validator Functions
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export function validate(json: unknown): ValidationResult {
  const result = lagnSchema.safeParse(json)
  if (result.success) {
    return { valid: true }
  }
  const errors = result.error.errors.map((err) => {
    const path = err.path.length > 0 ? err.path.join('.') : 'root'
    return `${path}: ${err.message}`
  })
  return { valid: false, errors }
}

export interface SummarizeResult {
  valid: boolean
  game_id: string | null
  variant: string | null
  player_count: number | null
  result: string | null
}

export function summarize(json: unknown): SummarizeResult {
  const validation = validate(json)
  if (!validation.valid) {
    return {
      valid: false,
      game_id: null,
      variant: null,
      player_count: null,
      result: null
    }
  }

  const data = json as Record<string, any>
  const outcome = data.result?.outcome ?? 'unknown'
  const result = `${outcome}${
    data.result?.loss_condition ? ` (${data.result.loss_condition})` : ''
  }`

  return {
    valid: true,
    game_id: String(data.game_id ?? null),
    variant: String(data.variant ?? null),
    player_count: typeof data.player_count === 'number' ? data.player_count : null,
    result
  }
}

// ============================================================================
// JSON Schema Generation
// ============================================================================

export function generateSchema(): Record<string, any> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'LAGN v1.1 — Legendary Arena Game Notation',
    description: 'Three-tier JSON format for Legendary Arena game records: Tier 1 (setup), Tier 2 (card catalog), Tier 3 (replay log)',
    type: 'object',
    properties: {
      lagn_version: {
        type: 'string',
        enum: [...LAGN_SUPPORTED_VERSIONS]
      },
      $schema: {
        type: 'string',
        format: 'uri',
        default: 'https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json'
      },
      game_id: {
        type: 'string',
        description: 'Unique game identifier'
      },
      variant: {
        type: 'string',
        enum: ['solo', 'cooperative', 'competitive']
      },
      player_count: {
        type: 'integer',
        minimum: 1,
        maximum: 5
      },
      setup: {
        type: 'object',
        required: [
          'mastermind',
          'scheme',
          'villain_groups',
          'henchmen_groups',
          'heroes',
          'bystanders_count',
          'wounds_count',
          'shield_officers_count',
          'sidekicks_count'
        ],
        properties: {
          mastermind: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          scheme: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          villain_groups: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          },
          henchmen_groups: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          },
          heroes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          },
          bystanders_count: { type: 'integer', minimum: 0 },
          wounds_count: { type: 'integer', minimum: 0 },
          shield_officers_count: { type: 'integer', minimum: 0 },
          sidekicks_count: { type: 'integer', minimum: 0 },
          // why: WP-036 — optional in 1.1.0, absent in 1.0.0. JSON Schema
          // expresses the shape only; the sum-equals-count invariant and the
          // version gate are zod refinements with no JSON Schema equivalent,
          // the same way the replay `seq` constraint already is.
          support_pools: {
            type: 'object',
            properties: {
              bystanders: { $ref: '#/$defs/support_pool' },
              wounds: { $ref: '#/$defs/support_pool' },
              shield_officers: { $ref: '#/$defs/support_pool' },
              sidekicks: { $ref: '#/$defs/support_pool' }
            }
          }
        }
      },
      card_catalog: {
        type: 'object',
        properties: {
          cards: {
            type: 'array',
            minItems: 1,
            items: { type: 'object' }
          }
        }
      },
      replay: {
        type: 'object',
        properties: {
          turns: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      },
      result: {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['victory', 'defeat'] },
          loss_condition: {
            type: 'string',
            enum: [
              'mastermind_defeated',
              'city_overrun',
              'deck_exhausted'
            ]
          },
          victory_points: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    },
    $defs: {
      support_pool: {
        type: 'object',
        required: ['mode', 'cards'],
        properties: {
          mode: { type: 'string', enum: ['sets', 'explicit'] },
          sets: { type: 'array', minItems: 1, items: { type: 'string' } },
          cards: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['ext_id', 'copies'],
              properties: {
                ext_id: { type: 'string' },
                copies: { type: 'integer', minimum: 1 }
              }
            }
          }
        }
      }
    },
    required: ['lagn_version', 'game_id', 'variant', 'player_count', 'setup']
  }
}

