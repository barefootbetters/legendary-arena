#!/usr/bin/env python3
"""
wound-gained.py — synthesize the "wound gained" dull damage thud.

The audio half of the WP-650 wound-gained damage vignette, played when the local
player's `woundCount` increases. It is the SONIC OPPOSITE of strike-blocked.py's
bright metallic shield clang: this is the sound of TAKING the hit instead of
blocking it — low, dull, muffled, bending DOWNWARD (a loss, not a triumph), gone
fast. No bright partials, no upward ricochet.

Original synthesis (no sample source) — the cleanest commercial-licence posture,
stronger than the CC0-first default. The audio sibling of the visual layer's
red vignette in VfxOverlay.vue.

Three layers (mono, 44.1 kHz):
  A. Body thud        — a low sine dropping in pitch (a gut impact), the core
  B. Muffled impact   — a low-passed noise burst, the dull "thwump" of contact
  C. Dark undertone   — a low detuned pair for a touch of pain/dissonance

Dependencies: numpy only (no scipy — the low-pass is done in the FFT domain).

Regenerate the source WAV:
    python ewiki/sound-effects/wound-gained.py wound-gained.wav

Encode + upload to R2 (audio bytes are NEVER committed to git — R2 is the sole
audio surface). Put wound-gained.wav in a source dir, then:
    node scripts/upload-move-sfx-to-r2.mjs --src <that-dir>
The clip is played by useWoundCue via woundCueManifest's WOUND_GAINED_CLIP →
https://images.legendary-arena.com/audio/sound-effects/wound-gained.mp3
"""

import sys
import numpy as np

SAMPLE_RATE = 44100
DURATION_SECONDS = 0.42
RANDOM_SEED = 9204  # why: deterministic output — regenerating gives the same byte.


def make_time_axis(duration_seconds):
    return np.linspace(0.0, duration_seconds, int(SAMPLE_RATE * duration_seconds), endpoint=False)


def exponential_decay(time_axis, tau_seconds):
    return np.exp(-time_axis / tau_seconds)


def lowpass(signal, cutoff_hz):
    """
    FFT-domain low-pass (numpy only) with a cosine roll-off above the cutoff —
    keeps the thud dull (no bright content), no filter ringing.
    """
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(signal.shape[0], d=1.0 / SAMPLE_RATE)
    roll_hz = 400.0
    mask = np.ones(freqs.shape[0])
    for index, frequency in enumerate(freqs):
        if frequency <= cutoff_hz:
            mask[index] = 1.0
        elif frequency <= cutoff_hz + roll_hz:
            mask[index] = 0.5 * (1.0 + np.cos(np.pi * (frequency - cutoff_hz) / roll_hz))
        else:
            mask[index] = 0.0
    return np.fft.irfft(spectrum * mask, n=signal.shape[0])


def body_thud(time_axis):
    """
    Layer A — the core gut impact: a low sine gliding DOWN from ~130 Hz to
    ~55 Hz over the first ~80 ms, then decaying. The downward bend is the
    'damage/loss' shape (opposite the shield's upward ricochet).
    """
    start_hz, end_hz = 130.0, 55.0
    bend_seconds = 0.08
    bend = np.clip(time_axis / bend_seconds, 0.0, 1.0)
    instantaneous_hz = start_hz + (end_hz - start_hz) * bend
    phase = 2.0 * np.pi * np.cumsum(instantaneous_hz) / SAMPLE_RATE
    return np.sin(phase) * exponential_decay(time_axis, tau_seconds=0.16)


def muffled_impact(time_axis, generator):
    """Layer B — a dull low-passed noise 'thwump' at contact; very fast decay."""
    noise = generator.standard_normal(time_axis.shape[0])
    shaped = lowpass(noise, 220.0)
    return shaped * exponential_decay(time_axis, tau_seconds=0.045)


def dark_undertone(time_axis):
    """
    Layer C — a low, slightly detuned pair (~98 Hz + ~104 Hz) that beats into a
    dull dissonant undertone — a hint of 'pain', not a musical note. Low level.
    """
    a = np.sin(2.0 * np.pi * 98.0 * time_axis)
    b = np.sin(2.0 * np.pi * 104.0 * time_axis)
    return (0.6 * a + 0.4 * b) * exponential_decay(time_axis, tau_seconds=0.11)


def soft_clip(signal, drive=1.2):
    """Gentle saturation for a bit of body/weight — kept mild so it stays dull."""
    return np.tanh(signal * drive) / np.tanh(drive)


def apply_edge_fades(signal, fade_in_ms=1.0, fade_out_ms=50.0):
    out = signal.copy()
    fade_in = int(SAMPLE_RATE * fade_in_ms / 1000.0)
    fade_out = int(SAMPLE_RATE * fade_out_ms / 1000.0)
    if fade_in > 0:
        out[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    if fade_out > 0:
        out[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
    return out


def write_wav_16bit_mono(path, signal):
    import wave

    peak = float(np.max(np.abs(signal)))
    normalized = signal / peak * 0.90 if peak > 0 else signal  # ~ -0.9 dBFS peak
    samples = np.int16(np.clip(normalized, -1.0, 1.0) * 32767)
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(samples.tobytes())


def main(output_path):
    generator = np.random.default_rng(RANDOM_SEED)
    time_axis = make_time_axis(DURATION_SECONDS)

    mix = (
        0.90 * body_thud(time_axis)
        + 0.45 * muffled_impact(time_axis, generator)
        + 0.30 * dark_undertone(time_axis)
    )
    mix = soft_clip(mix, drive=1.2)
    mix = apply_edge_fades(mix)
    write_wav_16bit_mono(output_path, mix)

    rms = float(np.sqrt(np.mean(mix ** 2)))
    print(f"wrote {output_path}  {DURATION_SECONDS:.2f}s  peak={np.max(np.abs(mix)):.3f}  rms={rms:.3f}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "wound-gained.wav"
    main(out)
