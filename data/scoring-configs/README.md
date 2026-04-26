# `data/scoring-configs/` — Canonical Authoring Origin for `ScenarioScoringConfig`

This directory is the **single authoring origin** for every
`ScenarioScoringConfig` instance the PAR pipeline consumes (D-5306a). One
JSON file per scenario; the filename encodes the scenario key.

## Filename encoding (locked)

Filenames use the `scenarioKeyToFilename` encoding from
`packages/game-engine/src/simulation/par.storage.ts:scenarioKeyToFilename`:

- `::` (scenario-key delimiter) → `--`
- `+` (multi-villain-group separator) → `_`
- file extension: `.json`

Example: scenario key `test-scheme-par::test-mastermind-par::test-villain-group-par`
maps to filename `test-scheme-par--test-mastermind-par--test-villain-group-par.json`.

The engine-side loader (`packages/game-engine/src/scoring/scoringConfigLoader.ts`)
imports `scenarioKeyToFilename` directly so the encoded form matches the PAR
artifact storage layout byte-for-byte (PS-4).

## File shape

Each file is a serialized `ScenarioScoringConfig` per the type declared at
`packages/game-engine/src/scoring/parScoring.types.ts:145`. Every required
field must be present; `validateScoringConfig`
(`packages/game-engine/src/scoring/parScoring.logic.ts`) is the sole structural
validator. Authors run the loader (or a higher-level CI check) to confirm a
new file parses cleanly before publication.

## Determinism contract

Object keys MUST be sorted alphabetically on write. This mirrors the
`ParIndex.scenarios` ordering rule and the canonical-JSON serialization used
by PAR artifact storage. Diffs across two structurally-equivalent config
revisions then surface as semantic changes only, never as key-ordering noise.

## Consumer chain (load-once, embed-into-artifact)

1. PAR aggregator (`packages/game-engine/src/simulation/par.aggregator.ts`)
   reads its `ScenarioScoringConfig` input via the loader at calibration
   time.
2. The aggregator's caller passes the same config to
   `writeSimulationParArtifact` / `writeSeedParArtifact`, which embed it
   verbatim into the PAR artifact on disk.
3. `buildParIndex` materializes `scoringConfig` inline into each
   `ParIndex.scenarios[key]` entry at index-build time (D-5306b).
4. The server gate (`apps/server/src/par/parGate.mjs`) loads the index at
   startup and returns `scoringConfig` from `checkParPublished` without ever
   touching this directory.
5. Future leaderboard / submission code (WP-053+) consumes
   `checkParPublished(scenarioKey).scoringConfig` directly. Drift between
   the published PAR and the config used to score it becomes structurally
   impossible.

## Design rationale (`-- why:` log)

-- why: D-5306 chose Option A (bundle config into the PAR publication) so
that competitive scoring derives `(scenarioKey, parValue, scoringConfig)`
from a single authoritative artifact. Without this directory, configs would
live in a parallel catalog and Option B's structural drift surface would
remain.

-- why: D-5306a places the canonical authoring origin under `data/` rather
than inside the engine package. The engine should not contain mutable
authoring sources; `data/` already holds card metadata and migrations as a
versioned content namespace and is the natural sibling for scoring configs.

-- why: D-5306b mandates inline materialization into `ParIndex` so the
server gate can return `scoringConfig` from `checkParPublished` without a
filesystem hit. The gate's fs-free invariant at request time (D-5103) is
preserved because the index is loaded once at startup and the embedded
config is the gate's only source.

-- why: the server layer never reads this directory. PAR config flows into
the server exclusively through the in-memory `ParIndex` produced by the
engine's `loadParIndex` helper. A grep of `apps/server/src/par/` for this
directory's path returns zero — the layer boundary is verifiable by
construction.

-- why: alphabetical key ordering on write is a determinism contract, not a
style preference. Two structurally-equivalent configs must produce
byte-identical files so that artifact hashes (`sha256:…`) computed
downstream remain stable across regenerations. Key-order drift would cause
artifact-hash churn for no semantic reason.

-- why: filename encoding is grep-enforced against `scenarioKeyToFilename`.
Hand-rolling the `::` → `--` substitution in a script would create a second
encoding source that could drift from the PAR storage layout. Re-using the
engine's helper keeps the encoding choke-point at one site.

## Adding a new scenario

1. Compute the scenario key per `buildScenarioKey` from
   `packages/game-engine/src/scoring/parScoring.keys.ts`.
2. Compute the filename per `scenarioKeyToFilename`.
3. Author the JSON with alphabetical keys at every level.
4. Run `validateScoringConfig` against the parsed payload (the loader does
   this on every read; a CI script may pre-flight it during authoring).
5. Bump `scoringConfigVersion` if the file replaces an existing entry whose
   weights, caps, or `parBaseline` changed — leaderboard entries pin to the
   integer version and historical comparability relies on the bump.
