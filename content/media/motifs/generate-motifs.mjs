// Motif generator for Legendary Arena.
//
// Reads the authoritative motif system (audio-motif-map.json) and, for each
// requested (team x class) pair, produces a locked three-note leitmotif as
// three sibling files:
//
//   <team-slug>_<class>.mid   — portable score (the master; re-renderable)
//   <team-slug>_<class>.wav   — rendered audio (trimmed)
//   <team-slug>_<class>.mp3   — 320 kbps distribution encode (loudnorm I=-13)
//
// Two renderers turn the MIDI into audio:
//   - MuseScore (default) — MuseScore 4's headless CLI + its bundled sampled
//     instruments (MS Basic). Real orchestral timbres. Deterministic.
//   - Synth (--synth fallback) — a dependency-free Node oscillator bank. Used
//     when MuseScore is not installed, or forced with --synth for a build with
//     no external tool. Recognizable but not sampled.
// The MIDI is the invariant either way — only the timbre differs, so a batch
// can be re-rendered at higher fidelity later without changing the notes.
//
// The grammar (from audio-motif-map.json):
//   - team  -> KEY   (which root the phrase is written in)
//   - class -> INSTRUMENT (which timbre carries it) + register
//   - side  -> MODE + resolution DIRECTION (hero = major, rising;
//              villain = minor, falling; grey = minor, flippable)
//   - power -> interval size (this MVP uses the "standard card" default;
//              wider power intervals are a play-time modifier, not baked in)
//
// This script is the complete, deterministic provenance: the script (plus
// MuseScore's fixed soundfont, or the built-in synth) regenerates every byte.
// Per D-24219 no audio is committed to git — only this script is tracked; all
// .mid/.wav/.mp3 outputs live on pCloud.
//
// Usage:
//   node generate-motifs.mjs [--all] [--synth] [--out <dir>] [--map <path>]
//                            [--musescore <path-to-MuseScore4.exe>]
//   (no flags = MVP set: X-family + Avengers-family x 5 classes, via MuseScore)

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const SAMPLE_RATE = 44100;

// why: default working locations follow the D-24219 audio layout — the map
// and every rendered output live on pCloud, never in the repo tree.
const DEFAULT_MAP = 'C:\\pcloud\\LA\\audio\\audio-motif-map.json';
const DEFAULT_OUT = 'C:\\pcloud\\LA\\audio\\motifs';

// why: standard MuseScore 4 install locations, checked in order. Override with
// --musescore <path> or the MUSESCORE_BIN env var when installed elsewhere.
const MUSESCORE_CANDIDATES = [
  'C:\\Program Files\\MuseScore 4\\bin\\MuseScore4.exe',
  'C:\\Program Files (x86)\\MuseScore 4\\bin\\MuseScore4.exe',
];

// why: the MVP slice per the authoring guide's priority list — the two
// families with the highest on-team synergy visibility. All X teams share
// root D; all Avengers-family teams share root C; Brotherhood is the D-minor
// villain mirror of the X-Men, so the family harmony and the major/minor
// mirror are both audible in one batch.
const MVP_TEAM_NAMES = [
  'X-Men', 'X-Force', 'X-Factor Investigations', 'Brotherhood',
  'Avengers', 'New Warriors', 'Champions',
];

// Pitch class per root note name. why: sharps and flats that name the same
// key both map to the same semitone (F# and Gb -> 6).
const PITCH_CLASS = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

// Per-class synthesis (synth fallback) + General MIDI voice (MuseScore).
// `harmonics` is a list of [partialRatio, amplitude] for the fallback synth;
// inharmonic ratios (Tech) give a bell timbre. `register` shifts the whole
// phrase in octaves so a family's instruments stack without mud (Instinct low,
// Ranged high). `gmProgram` is the 0-indexed GM patch written into the MIDI so
// both MuseScore and any other sampler pick the right instrument.
const CLASS_VOICES = {
  covert: {
    label: 'Covert — muted / pizzicato strings',
    harmonics: [[1, 1.0], [2, 0.35], [3, 0.16], [4, 0.08]],
    attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.06,
    register: 0, detuneCents: 6, vibratoHz: 0, vibratoCents: 0, breath: 0,
    gmProgram: 45, // Pizzicato Strings
  },
  instinct: {
    label: 'Instinct — low cellos & basses',
    harmonics: [[1, 1.0], [2, 0.6], [3, 0.42], [4, 0.24], [5, 0.12]],
    attack: 0.03, decay: 0.12, sustain: 0.65, release: 0.18,
    register: -2, detuneCents: 4, vibratoHz: 5, vibratoCents: 5, breath: 0,
    gmProgram: 42, // Cello
  },
  ranged: {
    label: 'Ranged — flute / piccolo',
    harmonics: [[1, 1.0], [2, 0.14], [3, 0.05]],
    attack: 0.045, decay: 0.06, sustain: 0.8, release: 0.12,
    register: 1, detuneCents: 0, vibratoHz: 5.5, vibratoCents: 9, breath: 0.05,
    gmProgram: 73, // Flute
  },
  strength: {
    label: 'Strength — trumpets & trombones',
    harmonics: [[1, 1.0], [2, 0.72], [3, 0.52], [4, 0.36], [5, 0.22], [6, 0.12]],
    attack: 0.02, decay: 0.09, sustain: 0.72, release: 0.14,
    register: 0, detuneCents: 0, vibratoHz: 4.5, vibratoCents: 4, breath: 0,
    gmProgram: 56, // Trumpet
  },
  tech: {
    label: 'Tech — tuned percussion / synth',
    harmonics: [[1, 1.0], [2.76, 0.5], [5.4, 0.26], [8.9, 0.12]],
    attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.12,
    register: 0, detuneCents: 0, vibratoHz: 0, vibratoCents: 0, breath: 0,
    gmProgram: 11, // Vibraphone
  },
};

const CLASS_ORDER = ['covert', 'instinct', 'ranged', 'strength', 'tech'];

// Three-note phrase as semitone offsets from the team root. Hero = major
// arpeggio rising to a bright resolution; villain/grey = minor arpeggio
// falling to an ominous one — the exact inversion, with the third carrying
// the audible major/minor colour.
const HERO_PHRASE = [0, 4, 7]; // root, major third, fifth (ascending)
const VILLAIN_PHRASE = [7, 3, 0]; // fifth, minor third, root (descending)

const NOTE_START = [0.0, 0.2, 0.4]; // seconds
const NOTE_LENGTH = 0.26; // seconds each note sounds (before release)

// why: MuseScore renders each short motif with a fixed reverb/measure tail
// (~5 s). This trims trailing dead air below -45 dB while keeping a natural
// 0.4 s reverb tail. The .mp3 additionally gets the pipeline's locked loudness.
const TRIM_FILTER = 'silenceremove=stop_periods=-1:stop_threshold=-45dB:stop_silence=0.4';
const LOUDNORM_FILTER = 'loudnorm=I=-13:LRA=11:TP=-1';

/**
 * Turn a root-note name and a chosen octave into a MIDI note number.
 * @param {string} rootName - e.g. "D", "Eb", "F#".
 * @param {number} octave - scientific-pitch octave for the root.
 * @returns {number} MIDI note number (C4 = 60).
 */
function rootMidiNote(rootName, octave) {
  const pitchClass = PITCH_CLASS[rootName];
  if (pitchClass === undefined) {
    throw new Error(`Unknown root note "${rootName}" — check audio-motif-map.json against the PITCH_CLASS table.`);
  }
  return 12 * (octave + 1) + pitchClass;
}

/**
 * Render one three-note motif to a mono Float array in [-1, 1] (synth path).
 * @param {number[]} midiNotes - the three MIDI note numbers, in play order.
 * @param {object} voice - a CLASS_VOICES entry.
 * @returns {Float64Array} the mono sample buffer.
 */
function synthesizeMotif(midiNotes, voice) {
  const totalSeconds = NOTE_START[2] + NOTE_LENGTH + voice.release + 0.05;
  const sampleCount = Math.ceil(totalSeconds * SAMPLE_RATE);
  const buffer = new Float64Array(sampleCount);

  for (let noteIndex = 0; noteIndex < 3; noteIndex += 1) {
    addNoteToBuffer(buffer, midiNotes[noteIndex], NOTE_START[noteIndex], voice);
  }

  peakNormalize(buffer, 0.89); // why: leave ~1 dB headroom before ffmpeg loudnorm.
  return buffer;
}

/**
 * Additively synthesize a single note and mix it into the buffer in place.
 * @param {Float64Array} buffer - the mono output buffer.
 * @param {number} midiNote - the note to sound.
 * @param {number} startSeconds - when the note begins.
 * @param {object} voice - a CLASS_VOICES entry.
 * @returns {void}
 */
function addNoteToBuffer(buffer, midiNote, startSeconds, voice) {
  const baseFrequency = 440 * Math.pow(2, (midiNote - 69) / 12);
  const startSample = Math.floor(startSeconds * SAMPLE_RATE);
  const soundingSeconds = NOTE_LENGTH + voice.release;
  const soundingSamples = Math.floor(soundingSeconds * SAMPLE_RATE);

  for (let offset = 0; offset < soundingSamples; offset += 1) {
    const sampleIndex = startSample + offset;
    if (sampleIndex >= buffer.length) {
      break;
    }
    const timeSeconds = offset / SAMPLE_RATE;
    const envelope = envelopeAt(timeSeconds, voice);
    if (envelope <= 0) {
      continue;
    }

    // why: gentle vibrato / detune give the synth voices life; the flute adds
    // a touch of breath noise. All deterministic (no RNG) so re-runs are
    // byte-identical.
    const vibrato = voice.vibratoCents === 0
      ? 1
      : Math.pow(2, (voice.vibratoCents / 1200) * Math.sin(2 * Math.PI * voice.vibratoHz * timeSeconds));
    const detune = voice.detuneCents === 0
      ? 1
      : Math.pow(2, voice.detuneCents / 1200);

    let sampleValue = 0;
    for (const [partialRatio, partialAmplitude] of voice.harmonics) {
      const frequency = baseFrequency * partialRatio * vibrato * detune;
      sampleValue += partialAmplitude * Math.sin(2 * Math.PI * frequency * timeSeconds);
    }
    if (voice.breath > 0) {
      sampleValue += voice.breath * deterministicNoise(sampleIndex);
    }

    buffer[sampleIndex] += envelope * sampleValue * 0.25;
  }
}

/**
 * ADSR envelope value at a given time within a note.
 * @param {number} timeSeconds - seconds since the note started.
 * @param {object} voice - a CLASS_VOICES entry.
 * @returns {number} envelope gain in [0, 1].
 */
function envelopeAt(timeSeconds, voice) {
  const sustainStart = voice.attack + voice.decay;
  if (timeSeconds < voice.attack) {
    return timeSeconds / voice.attack;
  }
  if (timeSeconds < sustainStart) {
    const throughDecay = (timeSeconds - voice.attack) / voice.decay;
    return 1 - (1 - voice.sustain) * throughDecay;
  }
  if (timeSeconds < NOTE_LENGTH) {
    // why: pluck / bell voices (sustain 0) keep decaying past the decay stage
    // toward silence instead of holding a flat sustain.
    if (voice.sustain === 0) {
      const decayTail = Math.exp(-(timeSeconds - sustainStart) * 6);
      return decayTail;
    }
    return voice.sustain;
  }
  const releaseProgress = (timeSeconds - NOTE_LENGTH) / voice.release;
  const levelAtRelease = voice.sustain === 0
    ? Math.exp(-(NOTE_LENGTH - sustainStart) * 6)
    : voice.sustain;
  return Math.max(0, levelAtRelease * (1 - releaseProgress));
}

/**
 * A cheap deterministic pseudo-noise sample for breath texture.
 * @param {number} index - the absolute sample index.
 * @returns {number} a value in roughly [-1, 1].
 */
function deterministicNoise(index) {
  // why: a hashed sine, not Math.random(), so output stays byte-identical
  // across runs (the same determinism discipline the audio pipeline expects).
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return 2 * (value - Math.floor(value)) - 1;
}

/**
 * Scale a buffer in place so its loudest sample hits the target peak.
 * @param {Float64Array} buffer - the mono buffer.
 * @param {number} targetPeak - desired absolute peak in [0, 1].
 * @returns {void}
 */
function peakNormalize(buffer, targetPeak) {
  let peak = 0;
  for (const sample of buffer) {
    const magnitude = Math.abs(sample);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  if (peak === 0) {
    return;
  }
  const gain = targetPeak / peak;
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] *= gain;
  }
}

/**
 * Encode a mono Float buffer as a 16-bit PCM WAV file.
 * @param {Float64Array} buffer - the mono buffer in [-1, 1].
 * @returns {Buffer} the complete WAV file bytes.
 */
function encodeWav(buffer) {
  const bytesPerSample = 2;
  const dataLength = buffer.length * bytesPerSample;
  const wav = Buffer.alloc(44 + dataLength);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < buffer.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, buffer[index]));
    wav.writeInt16LE(Math.round(clamped * 32767), 44 + index * bytesPerSample);
  }
  return wav;
}

/**
 * Write a variable-length quantity (MIDI delta-time encoding).
 * @param {number} value - the non-negative integer to encode.
 * @returns {number[]} the encoded bytes.
 */
function variableLengthQuantity(value) {
  const bytes = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  return bytes;
}

/**
 * Build a Standard MIDI File (format 0) for a three-note motif.
 * @param {number[]} midiNotes - the three notes in play order.
 * @param {object} voice - a CLASS_VOICES entry (for the GM program).
 * @returns {Buffer} the complete .mid file bytes.
 */
function encodeMidi(midiNotes, voice) {
  const ticksPerQuarter = 480;
  const ticksPerNote = 192; // ~0.2 s at 120 bpm — matches the synth spacing.
  const events = [];

  events.push(...variableLengthQuantity(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20); // tempo 120 bpm
  events.push(...variableLengthQuantity(0), 0xc0, voice.gmProgram); // program change

  for (let noteIndex = 0; noteIndex < 3; noteIndex += 1) {
    events.push(...variableLengthQuantity(0), 0x90, midiNotes[noteIndex], 96); // note on
    events.push(...variableLengthQuantity(ticksPerNote), 0x80, midiNotes[noteIndex], 0); // note off
  }
  events.push(...variableLengthQuantity(0), 0xff, 0x2f, 0x00); // end of track

  const trackBody = Buffer.from(events);
  const header = Buffer.alloc(14);
  header.write('MThd', 0);
  header.writeUInt32BE(6, 4);
  header.writeUInt16BE(0, 8); // format 0
  header.writeUInt16BE(1, 10); // one track
  header.writeUInt16BE(ticksPerQuarter, 12);

  const trackHeader = Buffer.alloc(8);
  trackHeader.write('MTrk', 0);
  trackHeader.writeUInt32BE(trackBody.length, 4);

  return Buffer.concat([header, trackHeader, trackBody]);
}

/**
 * Compute the three MIDI notes for a (team, class) motif.
 * @param {object} team - a team entry from the map (root, side, mode).
 * @param {object} voice - a CLASS_VOICES entry (for the register shift).
 * @returns {number[]} the three MIDI notes in play order.
 */
function motifNotes(team, voice) {
  const isHero = team.side === 'hero';
  const phrase = isHero ? HERO_PHRASE : VILLAIN_PHRASE;
  const baseOctave = 4 + voice.register;
  const root = rootMidiNote(team.root, baseOctave);
  return phrase.map((semitones) => root + semitones);
}

/**
 * Parse CLI flags into a small options object.
 * @returns {{all: boolean, synth: boolean, out: string, map: string, musescore: string|null}} the options.
 */
function parseArguments() {
  const options = { all: false, synth: false, out: DEFAULT_OUT, map: DEFAULT_MAP, musescore: null };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--all') {
      options.all = true;
    } else if (argv[index] === '--synth') {
      options.synth = true;
    } else if (argv[index] === '--out') {
      options.out = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--map') {
      options.map = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--musescore') {
      options.musescore = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

/**
 * Slugify a team name to the icon-set convention (e.g. "X-Men" -> "x-men").
 * @param {string} name - the team display name.
 * @returns {string} the slug.
 */
function teamSlug(name) {
  return name.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Locate the MuseScore 4 executable, or return null if not found.
 * @param {object} options - the parsed CLI options.
 * @returns {string|null} an existing executable path, or null.
 */
function locateMuseScore(options) {
  const candidates = [];
  if (options.musescore) {
    candidates.push(options.musescore);
  }
  if (process.env.MUSESCORE_BIN) {
    candidates.push(process.env.MUSESCORE_BIN);
  }
  candidates.push(...MUSESCORE_CANDIDATES);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Build the list of motif jobs (one per team x class) to produce.
 * @param {object} map - the parsed audio-motif-map.json.
 * @param {object} options - the parsed CLI options.
 * @returns {Array<object>} the motif specs.
 */
function buildMotifSpecs(map, options) {
  const teams = Object.values(map.teams).filter((team) => {
    if (team.root === null) {
      return false; // why: neutral Unaffiliated has no home key — no motif.
    }
    return options.all || MVP_TEAM_NAMES.includes(team.name);
  });

  const specs = [];
  for (const team of teams) {
    const slug = teamSlug(team.name);
    for (const className of CLASS_ORDER) {
      const voice = CLASS_VOICES[className];
      const baseName = `${slug}_${className}`;
      specs.push({
        team, voice, baseName,
        notes: motifNotes(team, voice),
        midiPath: join(options.out, `${baseName}.mid`),
        wavPath: join(options.out, `${baseName}.wav`),
        mp3Path: join(options.out, `${baseName}.mp3`),
      });
    }
  }
  return specs;
}

/**
 * Render every spec with MuseScore: one batch boot to raw WAVs, then trim each
 * to the final .wav and loudness-encode the .mp3.
 * @param {Array<object>} specs - the motif specs.
 * @param {string} museScoreBin - the MuseScore executable path.
 * @returns {void}
 */
function renderWithMuseScore(specs, museScoreBin) {
  const jobEntries = specs.map((spec) => ({
    in: spec.midiPath,
    out: `${spec.wavPath.slice(0, -4)}.raw.wav`,
  }));
  const jobPath = join(tmpdir(), 'legendary-motif-job.json');
  writeFileSync(jobPath, JSON.stringify(jobEntries, null, 2));

  // why: a single MuseScore invocation renders the whole batch — booting the
  // app once instead of per file. 10-minute ceiling guards a hung render.
  execFileSync(museScoreBin, ['-j', jobPath], { stdio: 'ignore', timeout: 600000 });

  for (const spec of specs) {
    const rawWav = `${spec.wavPath.slice(0, -4)}.raw.wav`;
    if (!existsSync(rawWav)) {
      throw new Error(`MuseScore did not render "${rawWav}" — check the MuseScore install or run with --synth.`);
    }
    execFileSync('ffmpeg', ['-y', '-i', rawWav, '-af', TRIM_FILTER, spec.wavPath], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-i', rawWav, '-af', `${TRIM_FILTER},${LOUDNORM_FILTER}`, '-b:a', '320k', spec.mp3Path], { stdio: 'ignore' });
    unlinkSync(rawWav);
  }
}

/**
 * Render one spec with the built-in synth fallback (no external tools).
 * @param {object} spec - a motif spec.
 * @returns {void}
 */
function renderWithSynth(spec) {
  writeFileSync(spec.wavPath, encodeWav(synthesizeMotif(spec.notes, spec.voice)));
  // why: match the pipeline's locked encode (loudnorm I=-13, 320 kbps) so
  // motifs sit at the same loudness as theme stings in the SFX layer.
  execFileSync('ffmpeg', ['-y', '-i', spec.wavPath, '-af', LOUDNORM_FILTER, '-b:a', '320k', spec.mp3Path], { stdio: 'ignore' });
}

function main() {
  const options = parseArguments();
  const map = JSON.parse(readFileSync(options.map, 'utf8'));
  mkdirSync(options.out, { recursive: true });

  const specs = buildMotifSpecs(map, options);

  // why: the MIDI is the master — write it first for every motif regardless of
  // which renderer produces the audio, so a re-render never regenerates notes.
  for (const spec of specs) {
    writeFileSync(spec.midiPath, encodeMidi(spec.notes, spec.voice));
  }

  const museScoreBin = options.synth ? null : locateMuseScore(options);
  let renderer;
  if (options.synth) {
    renderer = 'synth (forced)';
  } else if (museScoreBin) {
    renderer = `MuseScore (${museScoreBin})`;
  } else {
    renderer = 'synth (MuseScore not found — install MuseScore 4 or pass --musescore)';
  }
  process.stdout.write(`Renderer: ${renderer}\n`);

  if (museScoreBin) {
    renderWithMuseScore(specs, museScoreBin);
  } else {
    for (const spec of specs) {
      renderWithSynth(spec);
    }
  }

  for (const spec of specs) {
    process.stdout.write(`  ${spec.baseName}  (${spec.team.root} ${spec.team.mode})\n`);
  }
  process.stdout.write(`\nProduced ${specs.length} motifs (mid + wav + mp3) to ${options.out}\n`);
}

main();
