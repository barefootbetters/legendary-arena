import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

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

/**
 * Adds optional card-metadata provenance (WP-394). Strict superset of 1.1.0.
 *
 * why: 1.2.0 and not 1.1.0 — 1.1.0 is already allocated to
 * `setup.support_pools` (D-24195), which must survive untouched.
 */
export const LAGN_VERSION_1_2_0 = '1.2.0'

/**
 * Adds optional `setup.hero_alternates` — a bench of reserve heroes named in a
 * saved loadout, alongside the heroes actually played (WP-402). Strict superset
 * of 1.2.0.
 *
 * why: 1.3.0 and not 1.2.0 — 1.2.0 is already allocated to provenance (D-24198),
 * which must survive untouched.
 */
export const LAGN_VERSION_1_3_0 = '1.3.0'

/**
 * Adds two optional, top-level, DESCRIPTIVE blocks — `players` (match
 * participants) and `scoring_profile` (a plain string label) — so a
 * server-emitted result LAGN describes who played and under what profile
 * (WP-405). Strict superset of 1.3.0.
 *
 * why: 1.4.0 and not 1.3.0 — 1.3.0 is already allocated to hero_alternates
 * (D-24210), which must survive untouched.
 */
export const LAGN_VERSION_1_4_0 = '1.4.0'

/**
 * The version this build stamps on documents it writes.
 *
 * why: deliberately still 1.1.0 even though readers now accept 1.2.0. Nothing
 * populates provenance yet, so bumping the writer would move the wire format
 * of a catalogued endpoint for zero benefit. The producer-wiring packet flips
 * this together with the producers, and updates api-endpoints.md in the same
 * commit.
 */
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
  LAGN_VERSION_1_1_0,
  LAGN_VERSION_1_2_0,
  LAGN_VERSION_1_3_0,
  LAGN_VERSION_1_4_0
] as const

export type LagnVersion = (typeof LAGN_SUPPORTED_VERSIONS)[number]

/**
 * True when `version` is `minimum` or any later supported version.
 *
 * why: D-24211 — version gates compare ORDINALLY, never with `===` against a
 * single constant. The provenance gate shipped as `=== LAGN_VERSION_1_2_0`,
 * which read correctly only while 1.2.0 was the newest version; the WP-402 draft
 * scaffold measured the consequence — a 1.3.0 document carrying `catalog_ref`
 * was REJECTED by a message that itself promises "1.2.0 or later". Ordinality is
 * by position in LAGN_SUPPORTED_VERSIONS (oldest-first), the same array every
 * reader already trusts. Both arguments are supported versions by the time any
 * refinement runs — the root `lagn_version` enum has already accepted the
 * value — so both indices are non-negative.
 */
function isLagnVersionAtLeast(version: LagnVersion, minimum: LagnVersion): boolean {
  return LAGN_SUPPORTED_VERSIONS.indexOf(version) >= LAGN_SUPPORTED_VERSIONS.indexOf(minimum)
}

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
  // why: a SIBLING block, never more entries in `setup.heroes`. Hero count is
  // exact-enforced downstream against PLAYER_COUNT_SETUP (3/5/6 heroes by seat
  // count); seven entries in `heroes` would validate here and then throw on
  // match create. The bench is additive to whatever the seat count requires.
  //
  // why: loadout metadata only — the reserves of a saved shortlist — and NEVER
  // gameplay state. Nothing derives a match composition from it; `setup.heroes`
  // stays the sole authority on what is on the board (D-24210).
  //
  // why: NO `.max()`. A cap in a published open standard cannot be relaxed
  // without a major version bump and buys nothing the producing UI (WP-404,
  // which offers two slots) cannot enforce itself.
  hero_alternates: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ).min(1).optional(),
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
}).superRefine((setup, ctx) => {
  // why: JSON Schema cannot express a disjointness rule between two arrays or a
  // uniqueness rule within one. A hero is either played or benched, never both,
  // and no ext_id may appear twice among the alternates. Checked here rather
  // than at the root because both `heroes` and `hero_alternates` live in `setup`.
  if (setup.hero_alternates === undefined) {
    return
  }
  const playedHeroIds = new Set(setup.heroes.map((hero) => hero.id))
  const seenAlternateIds = new Set<string>()
  for (const alternate of setup.hero_alternates) {
    if (playedHeroIds.has(alternate.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hero_alternates'],
        message: `${alternate.id} is listed as both a played hero and an alternate — a hero is one or the other, never both`
      })
    }
    if (seenAlternateIds.has(alternate.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hero_alternates'],
        message: `${alternate.id} is listed more than once among the hero alternates`
      })
    }
    seenAlternateIds.add(alternate.id)
  }
})

// ============================================================================
// Card Metadata Provenance (Optional, 1.2.0+)
// ============================================================================

// why: WP-394 / D-24198 — provenance is EVIDENCE, not authority. The registry
// remains the source of truth for what a card is; these blocks record what the
// producer read so a replay can be audited without registry or network access.
// Every field is optional, so 1.0.0 and 1.1.0 documents validate unchanged.

/**
 * Matches a `sha256:<64 lowercase hex>` digest.
 *
 * why: an explicit regex rather than zod's `.startsWith('sha256:')`. startsWith
 * derives the JSON Schema pattern `^sha256\:`, and `\:` is an INVALID escape
 * under Unicode-mode regex — ajv throws `SyntaxError: Invalid regular
 * expression` compiling the published schema, making the contract unusable by
 * a strict validator. Caught by the fixture suite, not by inspection.
 *
 * why: it is also the stricter constraint. A prefix check accepts
 * `sha256:not-a-digest`; this does not.
 */
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

const CatalogRefSchema = z.object({
  // why: a closed set, not a free string. `source` is the discriminator that
  // says WHICH registry produced these hashes; in a format whose purpose is
  // machine-verifiable audit, an open string defeats the check.
  source: z.enum(['legendary-arena-registry']),
  /**
   * `sha256:<hex>` identifying the card data the producer actually loaded.
   *
   * why: validated for SHAPE only here. This packet computes no hashes —
   * RFC 8785 canonicalization is the producer's contract (WP-393's
   * `canonicalJson.ts`), and importing it would invent a `lagn-spec` ->
   * `registry` package edge that ARCHITECTURE.md does not have.
   *
   * why: per D-24197 this identifies the producer's LOAD SCOPE, not a global
   * registry snapshot. The authoritative per-set evidence is
   * `set_content_hashes`.
   */
  registry_version: z.string().regex(SHA256_DIGEST_PATTERN),
  /** Set abbreviation -> `sha256:<hex>`. Shape-validated only; see above. */
  set_content_hashes: z.record(z.string().regex(SHA256_DIGEST_PATTERN))
})

const RegistryRefSchema = z.object({
  /** Set-qualified `setAbbr/slug` in the D-10014 id space. */
  ext_id: z.string(),
  /**
   * Which printed face this entry names.
   *
   * why: ships even though `faces[]` is deferred to a later version. Multi-face
   * is present-tense, not speculative — D-24193 records 65 masterminds across
   * 24 sets whose Epic face was played unchosen. Without a discriminator an
   * audit bundle cannot tell a base face from an Epic one, which is exactly
   * the question provenance exists to answer.
   */
  face_id: z.string().optional()
})

const EffectSnapshotSchema = z.object({
  text: z.array(z.string()).min(1),
  tokens: z.array(
    z.object({
      kind: z.enum(['keyword', 'icon', 'hero_class', 'team', 'custom']),
      value: z.string(),
      amount: z.number().int().optional()
    })
  ).optional(),
  /** `sha256:<hex>` over the source the text was frozen from. Shape only. */
  source_hash: z.string().regex(SHA256_DIGEST_PATTERN)
})

const ProvenanceImageSchema = z.object({
  uri: z.string().url(),
  mime_type: z.string().optional(),
  role: z.enum(['card-front', 'card-back', 'tactic', 'transformed']).optional()
})

// ============================================================================
// TIER 2: Full Card Catalog (Optional)
// ============================================================================

/**
 * Optional provenance members shared by every card-catalog entry.
 *
 * why: spread into all NINE discriminated-union variants rather than repeated.
 * The style rule is duplicate-first-abstract-on-the-third-copy; nine copies of
 * three fields is well past that, and a hand-maintained ninth copy is exactly
 * where a variant silently diverges.
 */
const PROVENANCE_CARD_FIELDS = {
  registry_ref: RegistryRefSchema.optional(),
  effect_snapshot: EffectSnapshotSchema.optional(),
  image: ProvenanceImageSchema.optional()
} as const

const CardSchema = z.discriminatedUnion('card_type', [
  z.object({
    card_type: z.literal('mastermind'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('scheme'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('villain_group'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('henchmen_group'),
    ext_id: z.string(),
    name: z.string(),
    rarity_code: RarityCodeEnum,
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('hero'),
    ext_id: z.string(),
    name: z.string(),
    hero_class: HeroClassEnum.array().min(1),
    rarity_code: RarityCodeEnum,
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('shield_officer'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('sidekick'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('wound'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
  }),
  z.object({
    card_type: z.literal('bystander'),
    ext_id: z.string(),
    name: z.string(),
    image_url: z.string().url().optional(),
    image_thumb_url: z.string().url().optional(),
    ...PROVENANCE_CARD_FIELDS
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
// Match Participants + Scoring Profile (Optional, 1.4.0+)
// ============================================================================

// why: WP-405 / D-24214 / D-24215 — `players` and `scoring_profile` are
// DESCRIPTIVE metadata on an exported match record, never a scoring/credit
// input. Competitive credit is `matchId -> bgio blob -> re-reduce -> re-verify
// hash -> AccountId`, server-side (D-5301 / D-24126); the server never trusts a
// client-supplied identity or score. A reader that scored from either block
// would reopen the D-5301 trust hole. They let a portable record SAY who played
// and under which profile — nothing SCORES from them. This packet is reader-only
// (`LAGN_VERSION` is not flipped); a future server-producer packet emits them.

/**
 * One match participant: which seat, the participant's public id, and an
 * optional display name.
 *
 * why: `player_id` is validated as a plain string only — no id-format regex.
 * The producer packet decides the value, bound by the privacy rule that it MUST
 * be a PUBLIC, shareable id (a handle or public player id) and NEVER the
 * internal server `AccountId` (D-24214 / D-5201): LAGN travels in `?lagn=`
 * base64url links and decorative saved loadouts, so an internal id would leak
 * identity into every share. Inventing an id grammar here would fabricate a
 * shape this contract has no authority over.
 *
 * why: `seat` caps at 4 because `player_count` caps at 5 (seats run
 * 0..player_count-1). The tighter per-document `seat < player_count` bound is a
 * root refinement, since it depends on a sibling field JSON Schema cannot reach.
 */
const PlayerSchema = z.object({
  seat: z.number().int().min(0).max(4),
  player_id: z.string(),
  display_name: z.string().optional()
})

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
  // why: DESCRIPTIVE participant metadata, 1.4.0+ (D-24214). NEVER a scoring,
  // credit, ranking, or verification input — the server re-executes the blob
  // and owns credit (D-5301 / D-24126). `.min(1)` because an empty roster is a
  // missing key, not an empty array; `.optional()` because most documents carry
  // no roster (the loadout writer never emits it).
  players: z.array(PlayerSchema).min(1).optional(),
  // why: a plain string LABEL naming which scoring ruleset a completed match
  // belongs to, 1.4.0+ (D-24215) — never scoring authority. Deliberately NOT an
  // enum: the concrete profile set is owned by the leaderboard / Hall of Legends,
  // not this package; an invented enum would fabricate a vocabulary this contract
  // has no authority over and force a LAGN major bump per new division.
  scoring_profile: z.string().optional(),
  catalog_ref: CatalogRefSchema.optional(),
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
).refine(
  // why: JSON Schema cannot express a dependency between one member's presence
  // and a sibling's value. Without this gate a provenance block written into a
  // pre-1.2.0 document would be silently STRIPPED (lagnSchema has no
  // .strict(), so zod drops unknown keys and still parses) — the audit trail
  // would vanish on parse and the document would look clean. Rejecting loudly
  // is the only honest option.
  (data) => {
    // why: ORDINAL, not equality (D-24211). `=== LAGN_VERSION_1_2_0` rejected a
    // 1.3.0 document carrying provenance — measured red in the WP-402 scaffold —
    // even though provenance is legal on 1.2.0 and every later version. The
    // message already promised "or later"; the code now matches it.
    if (isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_2_0)) {
      return true
    }
    if (data.catalog_ref !== undefined) {
      return false
    }
    for (const card of data.card_catalog?.cards ?? []) {
      if (card.registry_ref !== undefined || card.effect_snapshot !== undefined) {
        return false
      }
    }
    return true
  },
  {
    message:
      `provenance requires lagn_version ${LAGN_VERSION_1_2_0} or later — ` +
      `an earlier document cannot carry catalog_ref, registry_ref, or effect_snapshot`,
    path: ['catalog_ref']
  }
).refine(
  // why: also inexpressible in JSON Schema — a cross-block presence rule. An
  // effect_snapshot is evidence, and evidence without the catalog_ref that
  // pins WHICH registry snapshot it came from cannot be verified against
  // anything. Requiring the pin keeps a snapshot from looking authoritative
  // when it is unanchored.
  (data) => {
    if (data.catalog_ref !== undefined) {
      return true
    }
    for (const card of data.card_catalog?.cards ?? []) {
      if (card.effect_snapshot !== undefined) {
        return false
      }
    }
    return true
  },
  {
    message:
      'effect_snapshot requires a document-level catalog_ref — a frozen effect ' +
      'is unverifiable without the registry snapshot it was taken from',
    path: ['card_catalog', 'cards', 'effect_snapshot']
  }
).refine(
  // why: same silent-strip hazard the support_pools and provenance gates guard
  // against. `lagnSchema` is not `.strict()`, so a bench written into a pre-1.3.0
  // document would be STRIPPED on parse — the saved shortlist's reserves would
  // vanish and the preset would come back short, with no error. Rejecting loudly
  // is the only honest option. Ordinal (D-24211) so every version from 1.3.0
  // onward carries it.
  (data) => isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_3_0) || data.setup.hero_alternates === undefined,
  {
    message: `setup.hero_alternates requires lagn_version ${LAGN_VERSION_1_3_0} or later — an earlier document cannot carry hero alternates`,
    path: ['setup', 'hero_alternates']
  }
).refine(
  // why: same silent-strip hazard the support_pools, provenance, and
  // hero_alternates gates guard against. `lagnSchema` is not `.strict()`, so
  // `players` / `scoring_profile` written into a pre-1.4.0 document would be
  // STRIPPED on parse — the participant roster and profile label would vanish
  // with no error, the worst available failure. Rejecting loudly is the only
  // honest option. One combined gate for both fields. Ordinal (D-24211) so every
  // version from 1.4.0 onward carries them.
  (data) =>
    isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_4_0) ||
    (data.players === undefined && data.scoring_profile === undefined),
  {
    message: `players and scoring_profile require lagn_version ${LAGN_VERSION_1_4_0} or later — an earlier document cannot carry match participants or a scoring profile`,
    path: ['players']
  }
).superRefine((data, ctx) => {
  // why: JSON Schema cannot express any of these — a count comparison against a
  // sibling field, a per-seat range keyed on that sibling, or uniqueness within
  // an array on a single object field. Checked at the root because `players` and
  // `player_count` are both root members.
  if (data.players === undefined) {
    return
  }
  // why: `<=`, never `==`. A bot seat carries no participant entry, so a roster
  // shorter than player_count is valid; only MORE participants than seats is
  // wrong — a match cannot credit more players than it has seats.
  if (data.players.length > data.player_count) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['players'],
      message: `players lists ${data.players.length} participants but player_count is ${data.player_count} — a match cannot credit more players than seats`
    })
  }
  const seenSeats = new Set<number>()
  const seenPlayerIds = new Set<string>()
  for (const participant of data.players) {
    if (participant.seat > data.player_count - 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['players'],
        message: `seat ${participant.seat} is out of range — seats run 0 to player_count-1 (${data.player_count - 1})`
      })
    }
    if (seenSeats.has(participant.seat)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['players'],
        message: `seat ${participant.seat} is listed more than once — one participant per seat`
      })
    }
    seenSeats.add(participant.seat)
    if (seenPlayerIds.has(participant.player_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['players'],
        message: `player_id ${participant.player_id} is listed more than once — a player cannot occupy two seats`
      })
    }
    seenPlayerIds.add(participant.player_id)
  }
})

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

// why: WP-392 / D-24196 — this file used to maintain the schema twice: the zod
// schema above, and a hand-written JSON Schema literal below that happened to
// describe the same shape. Nothing checked the two against each other. The CI
// drift guard compared the committed schemas/lagn-v1.json against the
// *generator*, not against zod, so the published contract could describe a
// different format than the validator enforced — and already did (card_catalog
// items and replay turns were untyped `{ type: 'object' }` in the hand-written
// copy against full typed schemas in zod). generateSchema() is now derived from
// lagnSchema, so that class of drift cannot recur.

/**
 * Constraints `lagnSchema` enforces that JSON Schema cannot express.
 *
 * why: derivation silently drops every zod `.refine()` / `.superRefine()` —
 * they are arbitrary predicates with no JSON Schema equivalent. Dropping them
 * is unavoidable; dropping them *silently* is the hazard this package already
 * shipped once. Each entry here is a deliberate, recorded acceptance.
 *
 * This list is enforced: `validator.test.ts` walks the zod tree, counts the
 * refinement nodes, and fails if the count disagrees with `refinementCount`
 * below. Adding a `.refine()` without documenting it here breaks the build.
 *
 * The array is also embedded in the generated JSON Schema as
 * `x-lagn-unexpressible-constraints`, so consumers validating against the
 * published schema alone can see what it does *not* check for them.
 */
export const UNEXPRESSIBLE_CONSTRAINTS = [
  {
    path: 'setup.support_pools.<pool>',
    constraint:
      'A pool in "sets" mode must carry a sets array; a pool in "explicit" mode must not. No card ext_id may repeat within a pool.',
    reason:
      'Conditional presence keyed on a sibling value, plus a uniqueness check on an object field. JSON Schema if/then could express the first half but not the second.'
  },
  {
    path: 'setup.support_pools',
    constraint:
      'Each pool\'s card copies must sum to the matching *_count field in setup.',
    reason: 'Cross-field arithmetic. JSON Schema has no sum or comparison operators.'
  },
  {
    path: 'replay.turns[].player_actions[].seq',
    constraint:
      'seq must increase by exactly 1 across a turn\'s actions — no gaps, no duplicates, no reordering.',
    reason:
      'A relation between adjacent array elements. JSON Schema can constrain items individually but cannot compare them.'
  },
  {
    path: 'lagn_version / catalog_ref / card_catalog.cards[].{registry_ref,effect_snapshot}',
    constraint: `Any provenance block requires lagn_version ${LAGN_VERSION_1_2_0}; an earlier document may not carry one.`,
    reason:
      'Cross-field dependency between the root version and optional blocks at two nesting levels. Expressible only as a deeply-nested if/then duplicating the whole structure.'
  },
  {
    path: 'card_catalog.cards[].effect_snapshot / catalog_ref',
    constraint:
      'An effect_snapshot anywhere in the catalog requires a document-level catalog_ref.',
    reason:
      'Presence of a nested member conditioned on a member of the root object. JSON Schema dependentRequired works within one object, not across nesting levels.'
  },
  {
    path: 'lagn_version / setup.support_pools',
    constraint: `setup.support_pools requires lagn_version ${LAGN_VERSION_1_1_0}; a ${LAGN_VERSION_1_0_0} document may not carry it.`,
    reason:
      'Cross-field dependency between the root version and a nested optional block. Expressible as a deeply-nested if/then, but only by hand-writing exactly the duplicate structure this derivation exists to eliminate.'
  },
  {
    path: 'setup.heroes / setup.hero_alternates',
    constraint:
      'No hero_alternates ext_id may also appear in setup.heroes, and none may repeat within hero_alternates.',
    reason:
      'Disjointness between two arrays plus uniqueness within one. JSON Schema uniqueItems compares whole items, not a single field, and cannot relate one array to another.'
  },
  {
    path: `lagn_version / setup.hero_alternates`,
    constraint: `setup.hero_alternates requires lagn_version ${LAGN_VERSION_1_3_0}; an earlier document may not carry it.`,
    reason:
      'Cross-field dependency between the root version and a nested optional block. Expressible as a deeply-nested if/then, but only by hand-writing exactly the duplicate structure this derivation exists to eliminate.'
  },
  {
    path: `lagn_version / players / scoring_profile`,
    constraint: `players and scoring_profile require lagn_version ${LAGN_VERSION_1_4_0}; an earlier document may not carry either.`,
    reason:
      'Cross-field dependency between the root version and two optional root blocks. Expressible as a deeply-nested if/then, but only by hand-writing exactly the duplicate structure this derivation exists to eliminate.'
  },
  {
    path: 'players / player_count',
    constraint:
      'players holds at most player_count entries (bot seats carry none), each seat is in 0..player_count-1, and both seat and player_id are unique across the roster.',
    reason:
      'A count comparison against a sibling field, a per-item range keyed on that sibling, and uniqueness within an array on a single object field. JSON Schema has no cross-field arithmetic, and uniqueItems compares whole items, not one field.'
  }
] as const

/**
 * How many zod refinement nodes `lagnSchema` is expected to contain.
 *
 * why: one entry in UNEXPRESSIBLE_CONSTRAINTS per refinement node. The
 * SupportPoolSchema superRefine raises three distinct issues but is a single
 * node, so its entry describes all three together.
 */
export const EXPECTED_REFINEMENT_COUNT = UNEXPRESSIBLE_CONSTRAINTS.length

/**
 * Builds the published JSON Schema by deriving it from `lagnSchema`.
 *
 * Everything structural comes from zod. The post-processing below re-applies
 * only the published metadata zod has no way to carry — the document title,
 * description, the draft URL every producer stamps, and the `$schema` property
 * default — plus the recorded list of constraints the derivation cannot express.
 */
export function generateSchema(): Record<string, any> {
  const derived = zodToJsonSchema(lagnSchema, {
    // why: the library has no 2020-12 target, and its 'jsonSchema2019-09' one
    // emits the draft-04 boolean form of exclusiveMinimum (`exclusiveMinimum:
    // true` alongside `minimum: 0`), which is invalid under the 2020-12 URL
    // this document declares. 'jsonSchema7' emits the numeric form 2020-12
    // actually uses, and every other keyword it produces here — type,
    // properties, required, enum, const, anyOf, minItems, minimum, maximum,
    // format, additionalProperties — is unchanged between draft-07 and 2020-12.
    target: 'jsonSchema7',
    // why: inline every subschema instead of emitting $defs. The hand-written
    // copy hoisted only support_pool; letting zod decide what to hoist would
    // make the committed file churn whenever an unrelated shape is reused.
    $refStrategy: 'none',
    // why: refinements wrap their subject in a ZodEffects node. 'input' emits
    // the shape being refined rather than nothing at all — the refinement
    // predicate itself is what lands in UNEXPRESSIBLE_CONSTRAINTS.
    effectStrategy: 'input',
    // why: lagnSchema does not call .strict(), so zod STRIPS unknown keys and
    // still parses. A document carrying extra keys is therefore valid, which
    // is `additionalProperties: true` — matching the hand-written schema, which
    // omitted the keyword entirely. The library's default would emit `false`
    // and reject documents the validator accepts.
    removeAdditionalStrategy: 'strict'
  }) as Record<string, any>

  return {
    ...derived,
    // why: these five override the derivation and must stay after the spread —
    // zod-to-json-schema emits its own `$schema` (the draft-07 URL matching its
    // target), and letting that win would silently republish the contract under
    // a different draft than every producer stamps.
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'LAGN v1.1 — Legendary Arena Game Notation',
    description: 'Three-tier JSON format for Legendary Arena game records: Tier 1 (setup), Tier 2 (card catalog), Tier 3 (replay log)',
    properties: {
      ...derived.properties,
      $schema: {
        ...derived.properties.$schema,
        default: 'https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json'
      },
      game_id: {
        ...derived.properties.game_id,
        description: 'Unique game identifier'
      }
    },
    'x-lagn-unexpressible-constraints': UNEXPRESSIBLE_CONSTRAINTS.map((entry) => ({
      path: entry.path,
      constraint: entry.constraint
    }))
  }
}

