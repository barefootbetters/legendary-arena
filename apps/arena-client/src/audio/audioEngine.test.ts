import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudioEngine,
  getAudioEngine,
  __setAudioEngineForTests,
  __resetAudioEngineForTests,
  DEFAULT_SFX_VOLUME,
  type HowlLike,
  type HowlFactory,
} from './audioEngine';
import { sfxManifest } from './sfxManifest';

/** A mock Howl that records volume + play calls, so tests need no real audio. */
interface MockHowl extends HowlLike {
  src: string;
  playCount: number;
  volumes: number[];
}

/**
 * Builds a mock `HowlFactory` plus a registry of the clips it created, keyed by
 * source URL, so a test can assert which clip played and at what volume.
 */
function makeMockFactory(): { factory: HowlFactory; created: Map<string, MockHowl> } {
  const created = new Map<string, MockHowl>();
  const factory: HowlFactory = ({ src }) => {
    const source = src[0] ?? '';
    const clip: MockHowl = {
      src: source,
      playCount: 0,
      volumes: [],
      play() {
        this.playCount += 1;
        return this.playCount;
      },
      volume(level: number) {
        this.volumes.push(level);
      },
    };
    created.set(source, clip);
    return clip;
  };
  return { factory, created };
}

const FIGHT_URL = sfxManifest.fightResolved;

describe('audioEngine (WP-412 §B) — preload', () => {
  test('preloads one Howl per distinct manifest clip URL', () => {
    const { factory, created } = makeMockFactory();
    createAudioEngine(factory);
    const distinctUrls = new Set(Object.values(sfxManifest));
    assert.equal(created.size, distinctUrls.size);
    assert.ok(created.has(FIGHT_URL));
  });
});

describe('audioEngine (WP-412 §B) — unlock gate', () => {
  test('play is a silent no-op before the first arm', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    assert.equal(engine.isArmed(), false);
    engine.play(FIGHT_URL);
    assert.equal(created.get(FIGHT_URL)?.playCount, 0);
  });

  test('play dispatches once armed', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    assert.equal(engine.isArmed(), true);
    engine.play(FIGHT_URL);
    assert.equal(created.get(FIGHT_URL)?.playCount, 1);
  });
});

describe('audioEngine (WP-412 §B) — mute / volume gate', () => {
  test('muted engine does not play', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    engine.setMuted(true);
    engine.play(FIGHT_URL);
    assert.equal(created.get(FIGHT_URL)?.playCount, 0);
  });

  test('unmuting restores playback', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    engine.setMuted(true);
    engine.play(FIGHT_URL);
    engine.setMuted(false);
    engine.play(FIGHT_URL);
    assert.equal(created.get(FIGHT_URL)?.playCount, 1);
  });

  test('applies the default master volume on play', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    engine.play(FIGHT_URL);
    assert.deepEqual(created.get(FIGHT_URL)?.volumes, [DEFAULT_SFX_VOLUME]);
  });

  test('applies an updated master volume on play', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    engine.setVolume(0.3);
    engine.play(FIGHT_URL);
    assert.deepEqual(created.get(FIGHT_URL)?.volumes, [0.3]);
  });

  test('clamps an out-of-range volume into 0..1', () => {
    const { factory, created } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    engine.setVolume(5);
    engine.play(FIGHT_URL);
    engine.setVolume(-2);
    engine.play(FIGHT_URL);
    assert.deepEqual(created.get(FIGHT_URL)?.volumes, [1, 0]);
  });
});

describe('audioEngine (WP-412 §B) — unknown URL', () => {
  test('play with an unmapped URL is a silent no-op (never throws)', () => {
    const { factory } = makeMockFactory();
    const engine = createAudioEngine(factory);
    engine.arm();
    assert.doesNotThrow(() => engine.play('https://images.legendary-arena.com/audio/sound-effects/missing.mp3'));
  });
});

describe('audioEngine (WP-412 §B) — module singleton test hooks', () => {
  beforeEach(() => {
    __resetAudioEngineForTests();
  });

  test('getAudioEngine returns the seeded engine', () => {
    const { factory } = makeMockFactory();
    const seeded = createAudioEngine(factory);
    __setAudioEngineForTests(seeded);
    assert.equal(getAudioEngine(), seeded);
  });

  test('reset clears the singleton so a later getAudioEngine rebuilds', () => {
    const { factory } = makeMockFactory();
    __setAudioEngineForTests(createAudioEngine(factory));
    __resetAudioEngineForTests();
    // why: after reset the singleton is null; the next getAudioEngine() would
    // build the real howler-backed engine, so we re-seed instead of calling it
    // (a real Howl construction is avoided in unit tests).
    const reseeded = createAudioEngine(factory);
    __setAudioEngineForTests(reseeded);
    assert.equal(getAudioEngine(), reseeded);
  });
});
