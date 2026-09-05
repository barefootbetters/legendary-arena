#!/usr/bin/env python3
"""
strike-blocked.py — synthesize the "strike blocked" shield-block clang.

The audio sibling of ewiki/visual-effects/block-shield.py: this generates the
SOUND that plays alongside the WP-647 shield-block VfxOverlay burst, on the
`strikeBlocked` notable event (masterStrike / schemeTwist / ambush). It is the
audio half of the Captain-America shield spinning in to INTERCEPT a threat —
the defensive mirror of the Master Strike "uh-oh" jolt, so it reads as RELIEF,
not dread: bright, metallic, resolving upward.

Original synthesis — no sample source — so the clip carries no third-party or
CC0 licence obligation at all. That is the cleanest commercial-safe posture for
a revenue-generating site (see wiki/sound-effects.md § Licensing posture), and
it is stronger than the CC0-first default the discrete clips use.

Three layers (mono, 44.1 kHz):
  A. Contact transient   — a bright band-passed noise "chk" (metal-on-metal touch)
  B. Metallic body       — an inharmonic struck-disc "clang" (the shield ringing)
  C. Deflection ricochet — a high ping gliding UP and away (energy thrown off = relief)
  (+ a tiny low body thump for weight, gone in ~40 ms)

Dependencies: numpy only (no scipy — the band-pass is done in the FFT domain).

Regenerate the source WAV:
    python ewiki/sound-effects/strike-blocked.py strike-blocked.wav

Encode + upload to R2 (audio bytes are NEVER committed to git — D-24219, R2 is
the sole audio surface). Put strike-blocked.wav in a source dir, then:
    node scripts/upload-move-sfx-to-r2.mjs --src <that-dir>
The manifest key that plays it is `strikeBlocked` in
apps/arena-client/src/audio/sfxManifest.ts →
https://images.legendary-arena.com/audio/sound-effects/strike-blocked.mp3
"""

import sys
import numpy as np

SAMPLE_RATE = 44100
DURATION_SECONDS = 0.62
RANDOM_SEED = 6470  # why: deterministic output — regenerating gives the same byte.


def make_time_axis(duration_seconds):
    return np.linspace(0.0, duration_seconds, int(SAMPLE_RATE * duration_seconds), endpoint=False)


def exponential_decay(time_axis, tau_seconds):
    """A simple exponential amplitude envelope, 1.0 at t=0."""
    return np.exp(-time_axis / tau_seconds)


def bandpass(signal, low_hz, high_hz):
    """
    FFT-domain band-pass (numpy only, no scipy). A cosine-tapered passband
    between low_hz and high_hz — smooth edges so the noise transient has no
    ringing artefacts. Good enough for shaping a 10 ms noise burst.
    """
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(signal.shape[0], d=1.0 / SAMPLE_RATE)
    mask = np.zeros(freqs.shape[0])
    passband = (freqs >= low_hz) & (freqs <= high_hz)
    mask[passband] = 1.0
    # why: taper the band edges over ~300 Hz so the filter does not ring.
    taper_hz = 300.0
    for index, frequency in enumerate(freqs):
        if low_hz - taper_hz <= frequency < low_hz:
            mask[index] = 0.5 * (1.0 - np.cos(np.pi * (frequency - (low_hz - taper_hz)) / taper_hz))
        elif high_hz < frequency <= high_hz + taper_hz:
            mask[index] = 0.5 * (1.0 + np.cos(np.pi * (frequency - high_hz) / taper_hz))
    return np.fft.irfft(spectrum * mask, n=signal.shape[0])


def contact_transient(time_axis, generator):
    """Layer A — a short, bright metal-contact 'chk'. Very fast decay."""
    noise = generator.standard_normal(time_axis.shape[0])
    shaped = bandpass(noise, 1800.0, 8000.0)
    envelope = exponential_decay(time_axis, tau_seconds=0.010)
    return shaped * envelope


def metallic_body(time_axis, generator):
    """
    Layer B — the struck-disc 'clang': a stack of INHARMONIC partials so it
    reads as struck metal (a shield), not a tuned musical note. Higher partials
    decay faster (the timbre darkens as it rings, like real metal), and a few
    partials are paired with a small detune to beat and shimmer.
    """
    fundamental_hz = 523.0  # C5 — a bright, confident base for the ring.
    # why: non-integer ratios = a metallic/bell spectrum (a harmonic stack would
    # sound like an organ note). Energy is weighted into 0.8-4 kHz for "clang".
    partial_ratios = [1.00, 1.51, 2.09, 2.67, 3.55, 4.74, 5.98, 7.61, 9.30]
    partial_gains = [1.00, 0.72, 0.85, 0.66, 0.78, 0.55, 0.42, 0.30, 0.20]

    body = np.zeros(time_axis.shape[0])
    for ratio, gain in zip(partial_ratios, partial_gains):
        # why: higher partials ring shorter — tau shrinks with frequency.
        frequency_hz = fundamental_hz * ratio
        tau = 0.42 / (1.0 + 0.9 * ratio)
        detune = 1.0 + generator.uniform(-0.004, 0.004)  # subtle per-strike detune
        partial = np.sin(2.0 * np.pi * frequency_hz * detune * time_axis)
        # why: a faint detuned twin on the stronger partials -> slow beating shimmer.
        if gain >= 0.7:
            twin = np.sin(2.0 * np.pi * frequency_hz * (detune + 0.006) * time_axis)
            partial = 0.7 * partial + 0.3 * twin
        body += gain * partial * exponential_decay(time_axis, tau)
    return body


def deflection_ricochet(time_axis):
    """
    Layer C — the threat's energy thrown OFF the shield: a high ping that
    glides UPWARD as it decays, delayed a hair so it reads as 'ricochet after
    contact'. The upward glide is what makes the beat feel like relief/victory
    rather than an impact.
    """
    onset_seconds = 0.028
    start_hz, end_hz = 2600.0, 3050.0
    glide_seconds = 0.22
    # Instantaneous phase for a linear upward frequency glide.
    glide = np.clip(time_axis / glide_seconds, 0.0, 1.0)
    instantaneous_hz = start_hz + (end_hz - start_hz) * glide
    phase = 2.0 * np.pi * np.cumsum(instantaneous_hz) / SAMPLE_RATE
    ping = np.sin(phase) + 0.35 * np.sin(2.0 * phase)  # a little 2nd harmonic sparkle
    envelope = exponential_decay(time_axis, tau_seconds=0.13)
    gate = (time_axis >= onset_seconds).astype(float)
    return ping * envelope * gate


def body_thump(time_axis):
    """A tiny low thump for physical weight — gone in ~40 ms, never muddy."""
    thump = np.sin(2.0 * np.pi * 108.0 * time_axis)
    return thump * exponential_decay(time_axis, tau_seconds=0.035)


def soft_clip(signal, drive=1.3):
    """Gentle tanh saturation — glues the layers and adds a metallic edge."""
    return np.tanh(signal * drive) / np.tanh(drive)


def apply_edge_fades(signal, fade_in_ms=1.5, fade_out_ms=60.0):
    """Kill start/end clicks (the encode step adds its own 80 ms tail fade too)."""
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
    normalized = signal / peak * 0.92 if peak > 0 else signal  # ~ -0.7 dBFS peak
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
        0.55 * contact_transient(time_axis, generator)
        + 0.85 * metallic_body(time_axis, generator)
        + 0.60 * deflection_ricochet(time_axis)
        + 0.30 * body_thump(time_axis)
    )
    mix = soft_clip(mix, drive=1.3)
    mix = apply_edge_fades(mix)
    write_wav_16bit_mono(output_path, mix)

    rms = float(np.sqrt(np.mean(mix ** 2)))
    print(f"wrote {output_path}  {DURATION_SECONDS:.2f}s  peak={np.max(np.abs(mix)):.3f}  rms={rms:.3f}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "strike-blocked.wav"
    main(out)
