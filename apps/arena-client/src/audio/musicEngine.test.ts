import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMusicEngine,
  DEFAULT_MUSIC_VOLUME,
  type MusicHowlFactory,
  type MusicHowlLike,
} from './musicEngine';
import { DEFAULT_SFX_VOLUME } from './audioEngine';

interface TrackCall {
  url: string;
  plays: number;
  stops: number;
  fades: Array<{ from: number; to: number }>;
  volumes: number[];
}

/** Records every track the engine builds and every call made to it. */
function makeRecordingFactory(): {
  factory: MusicHowlFactory;
  tracks: Map<string, TrackCall>;
} {
  const tracks = new Map<string, TrackCall>();
  const factory: MusicHowlFactory = (config) => {
    const url = config.src[0] ?? '';
    const record: TrackCall = { url, plays: 0, stops: 0, fades: [], volumes: [] };
    tracks.set(url, record);
    const track: MusicHowlLike = {
      play: () => {
        record.plays = record.plays + 1;
        return 1;
      },
      stop: () => {
        record.stops = record.stops + 1;
      },
      volume: (level: number) => {
        record.volumes.push(level);
      },
      fade: (from: number, to: number) => {
        record.fades.push({ from, to });
      },
    };
    return track;
  };
  return { factory, tracks };
}

const CALM = 'https://images.legendary-arena.com/audio/music/menace-calm.mp3';
const RISING = 'https://images.legendary-arena.com/audio/music/menace-rising.mp3';

describe('musicEngine (WP-560) — gates', () => {
  let recorder: ReturnType<typeof makeRecordingFactory>;

  beforeEach(() => {
    recorder = makeRecordingFactory();
  });

  test('AC-5: nothing plays before the unlock gesture', () => {
    // why: browser autoplay policy — a pre-arm crossfade is a silent no-op and
    // is NEVER queued to blast on unlock.
    const engine = createMusicEngine(recorder.factory);

    engine.crossfadeTo(CALM);

    assert.equal(engine.currentTrackUrl(), null);
    assert.equal(recorder.tracks.size, 0);
  });

  test('plays once armed', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();

    engine.crossfadeTo(CALM);

    assert.equal(engine.currentTrackUrl(), CALM);
    assert.equal(recorder.tracks.get(CALM)?.plays, 1);
  });

  test('AC-6: master mute stops what is already playing', () => {
    // why: unlike a one-shot, a bed is already sounding when the gate flips.
    // Muting must SILENCE it, not merely refuse the next start.
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.setMuted(true);

    assert.equal(engine.currentTrackUrl(), null);
    assert.equal(recorder.tracks.get(CALM)?.stops, 1);
  });

  test('AC-6: a muted engine refuses to start a track', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.setMuted(true);

    engine.crossfadeTo(CALM);

    assert.equal(engine.currentTrackUrl(), null);
  });

  test('AC-6: disabling music stops the bed independently of mute', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.setEnabled(false);

    assert.equal(engine.currentTrackUrl(), null);
    assert.equal(recorder.tracks.get(CALM)?.stops, 1);
  });
});

describe('musicEngine (WP-560) — crossfade behaviour', () => {
  let recorder: ReturnType<typeof makeRecordingFactory>;

  beforeEach(() => {
    recorder = makeRecordingFactory();
  });

  test('AC-2: the first track fades IN from silence rather than cutting in', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();

    engine.crossfadeTo(CALM);

    const calm = recorder.tracks.get(CALM);
    assert.deepEqual(calm?.fades, [{ from: 0, to: DEFAULT_MUSIC_VOLUME }]);
  });

  test('AC-2: a tier change fades the old track out and the new one in', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.crossfadeTo(RISING);

    assert.deepEqual(recorder.tracks.get(CALM)?.fades.at(-1), {
      from: DEFAULT_MUSIC_VOLUME,
      to: 0,
    });
    assert.deepEqual(recorder.tracks.get(RISING)?.fades.at(-1), {
      from: 0,
      to: DEFAULT_MUSIC_VOLUME,
    });
    assert.equal(engine.currentTrackUrl(), RISING);
  });

  test('AC-3: crossfading to the track already playing is a no-op', () => {
    // why: the engine is the last line of defence for the change-only rule.
    // Even if a consumer fires repeatedly, the bed must not restart.
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.crossfadeTo(CALM);
    engine.crossfadeTo(CALM);

    assert.equal(recorder.tracks.get(CALM)?.plays, 1);
    assert.equal(recorder.tracks.get(CALM)?.fades.length, 1);
  });

  test('AC-7: stop() halts the bed and clears the current track', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.stop();

    assert.equal(engine.currentTrackUrl(), null);
    assert.equal(recorder.tracks.get(CALM)?.stops, 1);
  });

  test('a track is constructed once and reused across crossfades', () => {
    const engine = createMusicEngine(recorder.factory);
    engine.arm();

    engine.crossfadeTo(CALM);
    engine.crossfadeTo(RISING);
    engine.crossfadeTo(CALM);

    assert.equal(recorder.tracks.size, 2);
    assert.equal(recorder.tracks.get(CALM)?.plays, 2);
  });
});

describe('musicEngine (WP-560) — volume', () => {
  test('AC-8: the music default sits BELOW the SFX default', () => {
    // why: D-24369 §4 — a bed at cue level drowns the very stings it frames.
    assert.equal(
      DEFAULT_MUSIC_VOLUME < DEFAULT_SFX_VOLUME,
      true,
      `music ${DEFAULT_MUSIC_VOLUME} must be below SFX ${DEFAULT_SFX_VOLUME}`,
    );
  });

  test('setVolume applies immediately to the playing track', () => {
    const recorder = makeRecordingFactory();
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.setVolume(0.4);

    assert.equal(recorder.tracks.get(CALM)?.volumes.at(-1), 0.4);
  });

  test('an out-of-range volume clamps rather than reaching howler', () => {
    const recorder = makeRecordingFactory();
    const engine = createMusicEngine(recorder.factory);
    engine.arm();
    engine.crossfadeTo(CALM);

    engine.setVolume(5);
    assert.equal(recorder.tracks.get(CALM)?.volumes.at(-1), 1);

    engine.setVolume(-2);
    assert.equal(recorder.tracks.get(CALM)?.volumes.at(-1), 0);
  });
});
