# @legendary-arena/replay-producer

CLI Producer App (D-6301) that wraps `buildSnapshotSequence` (WP-063) with file I/O to emit deterministic `ReplaySnapshotSequence` JSON.

This app is the first instance of the `cli-producer-app` code category. It is strictly I/O + arg parsing + canonical serialization; all gameplay logic lives in `@legendary-arena/game-engine`. No registry imports at runtime, no `boardgame.io` imports, no network or database access.

## Usage

```
pnpm --filter @legendary-arena/replay-producer produce-replay \
  --in  <path-to-inputs.json> \
  [--out <path-to-sequence.json>] \
  [--match-id <string>] \
  [--produced-at <iso-timestamp>]
```

- `--in` is required; the file must be a valid `ReplayInputsFile` with `version === 1`.
- `--out` is optional; when absent the sequence is written to stdout so piping is safe.
- `--match-id` sets `metadata.matchId` on the output, overriding any `metadata.matchId` in the input file.
- `--produced-at` sets `metadata.producedAt` on the output. Supplying this flag is the deterministic path — without it the CLI falls back to `new Date().toISOString()`, which breaks byte-identical determinism across runs.

Progress and diagnostic messages are written to stderr so stdout carries only the JSON artifact. Optional stderr summary is enabled by `DEBUG=replay-producer` or `DEBUG=*`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Success. |
| `1`  | Invalid args (missing `--in`, unknown flag, malformed flag value). |
| `2`  | Input parse error (file unreadable, invalid JSON, `version !== 1`, shape check failed). |
| `3`  | Engine error (`Game.setup()` threw for the provided `MatchSetupConfig`). |
| `4`  | Output write error (unwritable path, permission denied, disk full). |

## Determinism

With `--produced-at` fixed to a constant ISO timestamp, two runs against the same input file produce byte-identical output. The top-level JSON keys are emitted in sorted order per D-6302; nested objects inherit engine-produced key order (no recursive sort). The `seed` stored in the input file is retained for traceability but is ignored by the determinism-only replay harness per D-0205.

## See also

- `docs/ai/work-packets/WP-063-replay-snapshot-producer.md` — spec.
- `docs/ai/execution-checklists/EC-071-replay-snapshot-producer.checklist.md` — execution checklist.
- `docs/ai/DECISIONS.md §D-6301 / §D-6302 / §D-6303 / §D-6304 / §D-6305` — governance.
- `packages/game-engine/src/replay/buildSnapshotSequence.ts` — the pure helper this CLI wraps.
